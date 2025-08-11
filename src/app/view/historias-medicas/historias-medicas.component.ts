import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { take } from 'rxjs/operators';
import * as bootstrap from 'bootstrap';
declare var $: any;

// Interfaces
import { Paciente } from '../pacientes/paciente-interface';
import { HistoriaMedica, Recomendaciones, TipoMaterial, Antecedentes, ExamenOcular, Medico } from './historias_medicas-interface';
import { Empleado } from '../../Interfaces/models-interface';
import { Sede } from '../../view/login/login-interface';

// Constantes
import {
  OPCIONES_REF,
  OPCIONES_ANTECEDENTES,
  MOTIVOS_CONSULTA,
  TIPOS_CRISTALES,
  MATERIALES
} from 'src/app/shared/constants/historias-medicas';

// Servicios
import { HistoriaMedicaService } from '../../core/services/historias-medicas/historias-medicas.service';
import { SwalService } from '../../core/services/swal/swal.service';
import { ModalService } from '../../core/services/modal/modal.service';
import { PacientesService } from '../../core/services/pacientes/pacientes.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { UserStateService } from '../../core/services/userState/user-state-service';
import { EmpleadosService } from './../../core/services/empleados/empleados.service';


@Component({
  selector: 'app-historias-medicas',
  standalone: false,
  templateUrl: './historias-medicas.component.html',
  styleUrls: ['./historias-medicas.component.scss']
})
export class HistoriasMedicasComponent implements OnInit {
  // ViewChild
  @ViewChild('selectorPaciente') selectorPaciente!: ElementRef;

  // Estados del componente
  busqueda: string = '';
  cargando: boolean = false;
  mostrarElementos = false;
  mostrarSinHistorial = false;
  modoEdicion: boolean = false;
  mostrarInputOtroMotivo = false;
  maxDate: string;
  sedeActiva: string = '';
  sedeFiltro: string = this.sedeActiva;
  sedesDisponibles: Sede[] = [];
  filtro: string = '';
  pacienteParaNuevaHistoria: Paciente | null = null;
  pacientesFiltradosPorSede: Paciente[] = [];

  // Empleados
  isLoading = true;
  employees: any[] = [];
  medicoTratante: any[] = [];
  filteredEmployees: any[] = [];

  // Datos
  pacientes: Paciente[] = [];
  pacientesFiltrados: Paciente[] = [];
  formOriginalHistoria: any = {};
  medicoSeleccionado: Medico | null = null;
  pacienteSeleccionado: Paciente | null = null;
  historiaEnEdicion: HistoriaMedica | null = null;
  historiaSeleccionada: HistoriaMedica | null = null;
  pacienteIdSeleccionado: string | null = null;
  historial: HistoriaMedica[] = [];
  notaConformidad: string = 'PACIENTE CONFORME CON LA EXPLICACION  REALIZADA POR EL ASESOR SOBRE LAS VENTAJAS Y DESVENTAJAS DE LOS DIFERENTES TIPOS DE CRISTALES Y MATERIAL DE MONTURA, NO SE ACEPTARAN MODIFICACIONES LUEGO DE HABER RECIBIDO LA INFORMACION Y FIRMADA LA HISTORIA POR EL PACIENTE.';
  mostrarMaterialPersonalizado: boolean[] = [];

  // Formulario
  historiaForm: FormGroup;

  // Constantes
  opcionesRef = OPCIONES_REF;
  opcionesAntecedentes = OPCIONES_ANTECEDENTES;
  motivosConsulta = MOTIVOS_CONSULTA;
  tiposCristales = TIPOS_CRISTALES;
  materiales: typeof MATERIALES;
  materialLabels!: Map<TipoMaterial, string>;

  readonly materialesValidos = new Set<TipoMaterial>([
    'CR39',
    'AR_VERDE',
    'AR_BLUE_BLOCK',
    'FOTOCROMATICO_CR39',
    'FOTOCROMATICO_AR',
    'FOTOCROMATICO_BLUE_BLOCK',
    'POLICARBONATO',
    'HI_INDEX_156',
    'HI_INDEX_167',
    'HI_INDEX_174',
    'TRANSICION_PLUS',
    'FOTOSENSIBLE',
    'POLICARBONATO_BLUE_BLOCK',
    'OTRO'
  ]);

  constructor(
    private fb: FormBuilder,
    private modalService: ModalService,
    private swalService: SwalService,
    private historiaService: HistoriaMedicaService,
    private pacientesService: PacientesService,
    private userStateService: UserStateService,
    private snackBar: MatSnackBar,
    private empleadosService: EmpleadosService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.materiales = MATERIALES;
    this.materialLabels = new Map<TipoMaterial, string>(
      this.materiales.map(m => [m.value as TipoMaterial, m.label])
    );

    this.maxDate = new Date().toISOString().split('T')[0];
    this.historiaForm = this.fb.group({});
    this.inicializarFormulario();
  }

  // ***************************
  // * Métodos de inicialización
  // ***************************

  ngOnInit(): void {
    this.configurarSubscripciones();
    this.inicializarDatosIniciales();

    setTimeout(() => {
      this.pacienteIdSeleccionado = null;
      this.pacienteSeleccionado = null;
    }, 0);
  }

  private inicializarFormulario(): void {
    this.historiaForm = this.fb.group({
      // Sección Paciente
      paciente: [null, Validators.required],
      medico: ['', Validators.required],
      motivo: [[], Validators.required],
      otroMotivo: [''],
      tipoCristalActual: [''],
      ultimaGraduacion: [''],

      // Lensometría
      len_esf_od: [''],
      len_cil_od: [''],
      len_eje_od: [''],
      len_add_od: [''],
      len_av_lejos_od: [''],
      len_av_cerca_od: [''],
      len_av_lejos_bi: [''],
      len_av_bi: [''],
      len_esf_oi: [''],
      len_cil_oi: [''],
      len_eje_oi: [''],
      len_add_oi: [''],
      len_av_lejos_oi: [''],
      len_av_cerca_oi: [''],
      len_av_cerca_bi: [''],

      // Refracción
      ref_esf_od: [''],
      ref_cil_od: [''],
      ref_eje_od: [''],
      ref_add_od: [''],
      ref_avccl_od: [''],
      ref_avccc_od: [''],
      ref_avccl_bi: [''],
      ref_avccc_bi: [''],
      ref_esf_oi: [''],
      ref_cil_oi: [''],
      ref_eje_oi: [''],
      ref_add_oi: [''],
      ref_avccl_oi: [''],
      ref_avccc_oi: [''],

      // Refracción Final
      ref_final_esf_od: [''],
      ref_final_cil_od: [''],
      ref_final_eje_od: [''],
      ref_final_add_od: [''],
      ref_final_alt_od: [''],
      ref_final_dp_od: [''],
      ref_final_esf_oi: [''],
      ref_final_cil_oi: [''],
      ref_final_eje_oi: [''],
      ref_final_add_oi: [''],
      ref_final_alt_oi: [''],
      ref_final_dp_oi: [''],

      // AVSC - AVAE - OTROS
      avsc_od: [''],
      avae_od: [''],
      otros_od: [''],
      avsc_oi: [''],
      avae_oi: [''],
      otros_oi: [''],

      // Diagnóstico y Tratamiento
      diagnostico: [''],
      tratamiento: [''],

      // Recomendaciones
      recomendaciones: this.fb.array([this.crearRecomendacion()])
    });
  }

  private inicializarDatosIniciales(): void {
    forkJoin({
      user: this.userStateService.currentUser$.pipe(take(1)),
      sedes: this.authService.getSedes().pipe(take(1))
    }).subscribe(({ user, sedes }) => {
      this.sedesDisponibles = (sedes.sedes ?? [])
        .map(s => ({
          ...s,
          key: s.key?.trim().toLowerCase() || '',
          nombre: s.nombre?.trim() || ''
        }))
        .sort((a, b) =>
          a.nombre.replace(/^sede\s+/i, '').localeCompare(
            b.nombre.replace(/^sede\s+/i, ''),
            'es',
            { sensitivity: 'base' }
          )
        );

      const sedeUsuario = (user?.sede ?? '').trim().toLowerCase();
      const sedeValida = this.sedesDisponibles.some(s => s.key === sedeUsuario);

      this.sedeActiva = sedeValida ? sedeUsuario : '';
      this.sedeFiltro = this.sedeActiva;

      this.loadEmployees();
      this.cargarPacientes();
    });
  }

  private configurarSubscripciones(): void {
    this.historiaForm.get('motivo')?.valueChanges.subscribe((motivos: string[] | null) => {
      const otroMotivoControl = this.historiaForm.get('otroMotivo');

      if (motivos && motivos.includes('Otro')) {
        otroMotivoControl?.setValidators([Validators.required]);
      } else {
        otroMotivoControl?.clearValidators();
        otroMotivoControl?.setValue('');
      }
      otroMotivoControl?.updateValueAndValidity();
    });
  }

  // ***************************
  // * Métodos de historias médicas
  // ***************************

  crearHistoriaNueva(): void {
    this.historiaEnEdicion = this.generarHistoria('crear');
    this.modoEdicion = false;
    this.iniciarFlujoHistoria();
  }

  editarHistoria(historia: HistoriaMedica | null): void {
    if (!historia) {
      console.error('Error', 'No hay historia seleccionada para editar');
      return;
    }

    this.modoEdicion = true;
    this.historiaEnEdicion = JSON.parse(JSON.stringify(historia));
    this.iniciarFlujoHistoria();
  }

  iniciarFlujoHistoria(): void {
    console.log('this.historiaSeleccionada', this.historiaSeleccionada);

    if (this.historiaSeleccionada?.id && this.modoEdicion) {
      this.precargarHistoriaSeleccionada();
    } else {
      this.prepararNuevaHistoria();
    }

    $('#historiaModal').modal('show');
  }

  private generarHistoria(modo: 'crear' | 'editar', historiaExistente?: HistoriaMedica): HistoriaMedica {
    if (modo === 'editar' && historiaExistente) {
      return { ...historiaExistente };
    }

    const ahora = new Date();
    return {
      id: '',
      nHistoria: '',
      pacienteId: '',
      fecha: ahora.toISOString().split('T')[0],
      horaEvaluacion: ahora.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),

      datosConsulta: {
        motivo: [],
        otroMotivo: '',
        medico: { cedula: '', nombre: '', cargo: '' },
        nombre_asesor: '',
        cedula_asesor: ''
      },

      antecedentes: {
        tipoCristalActual: '',
        ultimaGraduacion: '',
        usuarioLentes: false,
        fotofobia: false,
        alergicoA: '',
        cirugiaOcular: false,
        cirugiaOcularDescripcion: '',
        traumatismoOcular: false,
        usaDispositivosElectronicos: false,
        tiempoUsoEstimado: '',
        antecedentesPersonales: [],
        antecedentesFamiliares: [],
        patologias: [],
        patologiaOcular: []
      },

      examenOcular: {
        lensometria: {
          esf_od: '', cil_od: '', eje_od: '', add_od: '',
          av_lejos_od: '', av_cerca_od: '', av_lejos_bi: '', av_bi: '',
          esf_oi: '', cil_oi: '', eje_oi: '', add_oi: '',
          av_lejos_oi: '', av_cerca_oi: '', av_cerca_bi: ''
        },
        refraccion: {
          esf_od: '', cil_od: '', eje_od: '', add_od: '',
          avccl_od: '', avccc_od: '', avccl_bi: '', avccc_bi: '',
          esf_oi: '', cil_oi: '', eje_oi: '', add_oi: '',
          avccl_oi: '', avccc_oi: ''
        },
        refraccionFinal: {
          esf_od: '', cil_od: '', eje_od: '', add_od: '', alt_od: '', dp_od: '',
          esf_oi: '', cil_oi: '', eje_oi: '', add_oi: '', alt_oi: '', dp_oi: ''
        },
        avsc_avae_otros: {
          avsc_od: '', avae_od: '', otros_od: '',
          avsc_oi: '', avae_oi: '', otros_oi: '',
          avsc_bi: ''
        }
      },

      diagnosticoTratamiento: {
        diagnostico: '',
        tratamiento: ''
      },

      recomendaciones: [],

      conformidad: {
        notaConformidad: ''
      },

      auditoria: {
        fechaCreacion: ahora.toISOString(),
        creadoPor: { nombre: '', cedula: '', cargo: '' },
        fechaActualizacion: '',
        actualizadoPor: { nombre: '', cedula: '', cargo: '' }
      }
    };
  }

  private precargarHistoriaSeleccionada(): void {
    this.modoEdicion = true;
    this.historiaForm.reset();

    const h = this.historiaEnEdicion!;
    const dc = h.datosConsulta;
    const ant = h.antecedentes ?? {} as Antecedentes;
    const eo = h.examenOcular;
    const dt = h.diagnosticoTratamiento;

    const paciente = this.pacientesFiltrados.find(p => p.key === h.pacienteId);
    this.pacienteParaNuevaHistoria = paciente!;
    this.pacienteSeleccionado = paciente!;

    const cargarYPrecargar = () => {
      const cedulaMedico = typeof dc.medico === 'object'
        ? dc.medico?.cedula
        : String(dc.medico);

      const medico = this.medicoTratante.find(
        m => m.cedula === cedulaMedico
      );

      this.historiaForm.patchValue({
        horaEvaluacion: h.horaEvaluacion,
        paciente: paciente,
        motivo: Array.isArray(dc.motivo) ? dc.motivo : [dc.motivo],
        otroMotivo: dc.otroMotivo,
        medico: medico ?? null,
        tipoCristalActual: ant.tipoCristalActual,
        ultimaGraduacion: ant.ultimaGraduacion,
        usuarioLentes: ant.usuarioLentes,
        fotofobia: ant.fotofobia,
        alergicoA: ant.alergicoA,
        cirugiaOcular: ant.cirugiaOcular,
        cirugiaOcularDescripcion: ant.cirugiaOcularDescripcion,
        traumatismoOcular: ant.traumatismoOcular,
        usaDispositivosElectronicos: ant.usaDispositivosElectronicos,
        tiempoUsoEstimado: ant.tiempoUsoEstimado,
        antecedentesPersonales: ant.antecedentesPersonales,
        antecedentesFamiliares: ant.antecedentesFamiliares,
        patologias: ant.patologias,
        patologiaOcular: ant.patologiaOcular,

        // Lensometría
        len_esf_od: eo.lensometria.esf_od,
        len_cil_od: eo.lensometria.cil_od,
        len_eje_od: eo.lensometria.eje_od,
        len_add_od: eo.lensometria.add_od,
        len_av_lejos_od: eo.lensometria.av_lejos_od,
        len_av_cerca_od: eo.lensometria.av_cerca_od,
        len_av_lejos_bi: eo.lensometria.av_lejos_bi,
        len_av_bi: eo.lensometria.av_bi,
        len_esf_oi: eo.lensometria.esf_oi,
        len_cil_oi: eo.lensometria.cil_oi,
        len_eje_oi: eo.lensometria.eje_oi,
        len_add_oi: eo.lensometria.add_oi,
        len_av_lejos_oi: eo.lensometria.av_lejos_oi,
        len_av_cerca_oi: eo.lensometria.av_cerca_oi,
        len_av_cerca_bi: eo.lensometria.av_cerca_bi,

        // Refracción
        ref_esf_od: eo.refraccion.esf_od,
        ref_cil_od: eo.refraccion.cil_od,
        ref_eje_od: eo.refraccion.eje_od,
        ref_add_od: eo.refraccion.add_od,
        ref_avccl_od: eo.refraccion.avccl_od,
        ref_avccc_od: eo.refraccion.avccc_od,
        ref_avccl_bi: eo.refraccion.avccl_bi,
        ref_avccc_bi: eo.refraccion.avccc_bi,
        ref_esf_oi: eo.refraccion.esf_oi,
        ref_cil_oi: eo.refraccion.cil_oi,
        ref_eje_oi: eo.refraccion.eje_oi,
        ref_add_oi: eo.refraccion.add_oi,
        ref_avccl_oi: eo.refraccion.avccl_oi,
        ref_avccc_oi: eo.refraccion.avccc_oi,

        // Refracción Final
        ref_final_esf_od: eo.refraccionFinal.esf_od,
        ref_final_cil_od: eo.refraccionFinal.cil_od,
        ref_final_eje_od: eo.refraccionFinal.eje_od,
        ref_final_add_od: eo.refraccionFinal.add_od,
        ref_final_alt_od: eo.refraccionFinal.alt_od,
        ref_final_dp_od: eo.refraccionFinal.dp_od,
        ref_final_esf_oi: eo.refraccionFinal.esf_oi,
        ref_final_cil_oi: eo.refraccionFinal.cil_oi,
        ref_final_eje_oi: eo.refraccionFinal.eje_oi,
        ref_final_add_oi: eo.refraccionFinal.add_oi,
        ref_final_alt_oi: eo.refraccionFinal.alt_oi,
        ref_final_dp_oi: eo.refraccionFinal.dp_oi,

        // AVSC / AVAE / OTROS
        avsc_od: eo.avsc_avae_otros.avsc_od,
        avae_od: eo.avsc_avae_otros.avae_od,
        otros_od: eo.avsc_avae_otros.otros_od,
        avsc_oi: eo.avsc_avae_otros.avsc_oi,
        avae_oi: eo.avsc_avae_otros.avae_oi,
        otros_oi: eo.avsc_avae_otros.otros_oi,
        avsc_bi: eo.avsc_avae_otros.avsc_bi,

        // Diagnóstico / Tratamiento
        diagnostico: dt.diagnostico,
        tratamiento: dt.tratamiento
      });


      this.recomendaciones.clear();
      h.recomendaciones.forEach(r => {
        const grupo = this.crearRecomendacion(r);
        this.recomendaciones.push(grupo);
      });

      this.formOriginalHistoria = this.historiaForm.value;
    }
    // ✅ Solo carga empleados si no están disponibles
    if (!this.medicoTratante || this.medicoTratante.length === 0) {
      this.loadEmployees(cargarYPrecargar);
    } else {
      cargarYPrecargar();
    }
  }

  private prepararNuevaHistoria(): void {
    if (this.modoEdicion) return;
    this.historiaForm.reset();
    this.recomendaciones.clear();
    this.agregarRecomendacion();
  }

  guardarHistoria(): void {
    if (this.modoEdicion && this.historiaSeleccionada) {
      const historiaActualizada = {
        ...this.historiaSeleccionada,
        ...this.historiaForm.value,
        recomendaciones: this.mapRecomendaciones()
      };

      /* this.historiaService.updateHistoria(this.historiaSeleccionada.id, historiaActualizada).subscribe({
     next: () => {
       this.historiaSeleccionada = historiaActualizada; // Mantiene la referencia
       this.swalService.showSuccess('¡Actualizado!', 'Cambios guardados correctamente');
       $('#historiaModal').modal('hide'); // Cierra el modal sin resetear historiaSeleccionada
     },
     error: (err) => {
       console.error('Error al actualizar:', err);
       this.swalService.showError('Error', 'No se pudieron guardar los cambios');
     }
   });
 } else {
   // Modo creación (manteniendo tu lógica existente)
   this.crearHistoria(); 
 }*/
      // Lógica de actualización aquí...
    } else {
      this.crearHistoria();
    }
  }

  private crearHistoria(): void {
    if (!this.pacienteParaNuevaHistoria) {
      this.swalService.showError('Error', 'No hay ningún paciente seleccionado');
      return;
    }

    if (this.historiaForm.invalid) {
      this.swalService.showError('Error', 'Por favor complete todos los campos requeridos');
      return;
    }

    const formValue = this.historiaForm.value;
    const historia: any = {
      pacienteId: this.pacienteParaNuevaHistoria.key,
      datosConsulta: {
        motivo: Array.isArray(formValue.motivo) ? formValue.motivo : [formValue.motivo],
        otroMotivo: formValue.otroMotivo || '',
        tipoCristalActual: formValue.tipoCristalActual,
        fechaUltimaGraduacion: formValue.ultimaGraduacion,
        medico: formValue.medico?.cedula,
      },
      examenOcular: this.mapExamenOcular(),
      diagnosticoTratamiento: {
        diagnostico: formValue.diagnostico || '',
        tratamiento: formValue.tratamiento || ''
      },
      recomendaciones: this.mapRecomendaciones(),
      conformidad: {
        notaConformidad: this.notaConformidad,
      },
    };

    this.cargando = true;

    this.historiaService.createHistoria(historia).subscribe({
      next: (respuesta) => {
        this.cargando = false;
        const historiaCreada = respuesta.historial_medico;

        this.cerrarModal('historiaModal');
        this.swalService.showSuccess(
          '¡Historia creada!',
          `Historia médica #${historiaCreada.nHistoria ?? 'sin número'} registrada correctamente`
        );

        // 🔄 Sincronizar paciente visualmente
        const paciente = this.pacienteParaNuevaHistoria;
        if (!paciente) {
          console.warn('No hay paciente para recargar historias médicas');
          return;
        }

        this.pacienteSeleccionado = paciente;
        this.cargarHistoriasMedicas(paciente.key, () => {
          this.historiaSeleccionada = historiaCreada;
        });

        this.historiaForm.reset();
        this.modoEdicion = false;
      },
      error: (err) => {
        this.cargando = false;
        let mensajeError = 'No se pudo guardar la historia médica';
        if (err.error?.message) {
          mensajeError += `: ${err.error.message}`;
        } else if (err.status === 409) {
          mensajeError = 'Ya existe una historia idéntica para este paciente';
        }

        this.swalService.showError('Error', mensajeError);
      }
    });
  }


  // ***************************
  // * Métodos de pacientes
  // ***************************

  cargarPacientes(): void {
    this.pacientesService.getPacientes().subscribe({
      next: (data) => {
        const getSedeFromKey = (key: string): string =>
          key?.split('-')[0]?.toLowerCase() ?? 'sin-sede';

        this.pacientes = Array.isArray(data.pacientes)
          ? data.pacientes.map((p: any) => {
            const info = p.informacionPersonal;
            const historia = p.historiaClinica;
            const sedePaciente = getSedeFromKey(p.key);

            return {
              key: p.key,
              fechaRegistro: this.formatearFecha(p.created_at),
              sede: sedePaciente,
              redesSociales: p.redesSociales || [],

              informacionPersonal: {
                nombreCompleto: info.nombreCompleto,
                cedula: info.cedula,
                telefono: info.telefono,
                email: info.email,
                fechaNacimiento: info.fechaNacimiento,
                edad: this.calcularEdad(info.fechaNacimiento),
                ocupacion: info.ocupacion,
                genero: info.genero === 'm' ? 'Masculino' : info.genero === 'f' ? 'Femenino' : 'Otro',
                direccion: info.direccion
              },

              historiaClinica: {
                usuarioLentes: historia.usuarioLentes ?? null,
                tipoCristalActual: historia.tipoCristalActual ?? '',
                ultimaGraduacion: historia.ultimaGraduacion ?? '',
                fotofobia: historia.fotofobia ?? null,
                traumatismoOcular: historia.traumatismoOcular ?? null,
                traumatismoOcularDescripcion: historia.traumatismoOcularDescripcion ?? '',
                usaDispositivosElectronicos: this.textoABooleano(historia.usaDispositivosElectronicos),
                tiempoUsoEstimado: historia.tiempoUsoEstimado ?? '',
                cirugiaOcular: historia.cirugiaOcular ?? null,
                cirugiaOcularDescripcion: historia.cirugiaOcularDescripcion ?? '',
                alergicoA: historia.alergicoA ?? null,
                antecedentesPersonales: historia.antecedentesPersonales ?? [],
                antecedentesFamiliares: historia.antecedentesFamiliares ?? [],
                patologias: historia.patologias ?? [],
                patologiaOcular: historia.patologiaOcular ?? []
              }
            };
          })
          : [];
        this.actualizarPacientesPorSede();
        this.actualizarPacientesFiltrados();
      },
      error: (error) => {
        console.error('Error al cargar pacientes:', error);
        this.swalService.showError('Error', 'No se han podido cargar los pacientes');
        this.pacientes = [];
      }
    });
  }

  cargarHistoriasMedicas(pacienteId: string, callback?: () => void): void {
    this.cargando = true;

    this.historiaService.getHistoriasPorPaciente(pacienteId).subscribe({
      next: (historias: HistoriaMedica[]) => {
        this.historial = historias.sort((a, b) => {
          const fechaA = new Date(a.auditoria?.fechaCreacion || '').getTime();
          const fechaB = new Date(b.auditoria?.fechaCreacion || '').getTime();

          if (fechaA !== fechaB) {
            return fechaB - fechaA; // más reciente primero
          }

          // Desempate por número de historia (últimos 3 dígitos)
          const extraerSecuencia = (nHistoria: string): number => {
            const partes = nHistoria?.split('-');
            return partes?.length === 3 ? parseInt(partes[2], 10) : 0;
          };

          const idA = extraerSecuencia(a.nHistoria);
          const idB = extraerSecuencia(b.nHistoria);
          return idB - idA;
        });

        this.historiaSeleccionada = this.historial[0] || null;
        this.mostrarSinHistorial = this.historial.length === 0;
        this.mostrarElementos = this.historial.length > 0;
        this.cargando = false;

        if (callback) callback();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error al cargar historias:', error);
        this.snackBar.open(`⚠️ Error, No se pudieron cargar las historias médicas.`, 'Cerrar', {
          duration: 3000,
          panelClass: ['snackbar-warning']
        });
        this.cargando = false;
      }
    });
  }



  seleccionarHistoriasPorPaciente(paciente: Paciente | null): void {
    if (!paciente) {
      this.limpiarDatos();
      return;
    }

    this.pacienteSeleccionado = paciente;
    this.cargarHistoriasMedicas(paciente.key);
  }

  selesccionarPacientePorId(id: string | null): void {
    if (!id) {
      this.pacienteSeleccionado = null;
      return;
    }

    const paciente = this.pacientes.find(p => p.key === id);
    if (!paciente) {
      console.error('Paciente no encontrado');
      return;
    }

    this.pacienteSeleccionado = paciente;
    this.cargarHistoriasMedicas(id);
  }

  onPacienteSeleccionado(): void {
    const paciente = this.historiaForm.get('paciente')?.value;
    this.pacienteParaNuevaHistoria = paciente;
  }

  // ***************************
  // * Métodos de empleados
  // ***************************

  private loadEmployees(callback?: () => void): void {
    this.isLoading = true;

    this.empleadosService.getAllEmpleados().subscribe((usuarios: any[]) => {
      const empleadosAdaptados: Empleado[] = usuarios.map(usuario => ({
        id: usuario.id,
        cedula: usuario.cedula,
        nombre: usuario.nombre,
        email: usuario.email,
        telefono: usuario.telefono,
        rolId: usuario.rolId,
        cargoId: usuario.cargoId,
        rolNombre: usuario.rolNombre,
        cargoNombre: usuario.cargoNombre,
        estatus: usuario.estatus,
        fechaNacimiento: usuario.fechaNacimiento,
        avatarUrl: usuario.avatarUrl,
        created_at: usuario.created_at,
        updated_at: usuario.updated_at,
        editing: usuario.editing,
        modified: usuario.modified,
        hasErrors: usuario.hasErrors,
        errors: usuario.errors,
        originalValues: usuario.originalValues
      }));

      const cargosValidos = ['optometrista', 'oftalmologo'];
      this.medicoTratante = empleadosAdaptados.filter(emp =>
        cargosValidos.includes(emp.cargoId)
      );

      this.filteredEmployees = [...empleadosAdaptados];
      this.isLoading = false;
      this.cdr.detectChanges();

      if (callback) callback();
    }, error => {
      console.error('Error al cargar empleados:', error);
      this.isLoading = false;
      if (callback) callback();
    });
  }

  onMedicoSeleccionado(medico: Medico): void {
    this.medicoSeleccionado = medico;
  }

  // ***************************
  // * Métodos de recomendaciones
  // ***************************

  get recomendaciones(): FormArray {
    return this.historiaForm.get('recomendaciones') as FormArray;
  }

  crearRecomendacion(rec?: Recomendaciones): FormGroup {
    return this.fb.group({
      cristal: [rec?.cristal || null, Validators.required],
      material: [rec?.material || [], Validators.required],
      materialPersonalizado: [''],
      montura: [rec?.montura || ''],
      observaciones: [rec?.observaciones || '']
    });
  }

  agregarRecomendacion(): void {
    this.recomendaciones.push(this.crearRecomendacion());
  }

  eliminarRecomendacion(index: number): void {
    this.recomendaciones.removeAt(index);
  }

  verificarMaterialOtro(index: number): void {
    const materialesSeleccionados = this.recomendaciones.at(index).get('material')?.value || [];
    this.mostrarMaterialPersonalizado[index] = materialesSeleccionados.includes('OTRO');
  }

  private mapRecomendaciones(): Recomendaciones[] {
    return this.recomendaciones.controls.map(control => {
      const grupo = control as FormGroup;
      const materialesSeleccionados: string[] = grupo.get('material')?.value || [];
      const otrosMaterialesRaw: string = grupo.get('materialPersonalizado')?.value?.trim() || '';

      const otrosMateriales = otrosMaterialesRaw
        ? otrosMaterialesRaw.split(',').map(m => m.trim()).filter(m => m)
        : [];

      const materialesCombinados = [
        ...materialesSeleccionados.filter(m => m !== 'OTRO'),
        ...otrosMateriales
      ].filter(m => this.materialesValidos.has(m as TipoMaterial)) as TipoMaterial[];

      return {
        cristal: grupo.get('cristal')?.value || [],
        material: materialesCombinados,
        montura: grupo.get('montura')?.value || '',
        cristalSugerido: grupo.get('cristalSugerido')?.value || '',
        observaciones: grupo.get('observaciones')?.value || ''
      };
    });
  }

  // ***************************
  // * Métodos de examen ocular
  // ***************************

  private mapExamenOcular(): ExamenOcular {
    const f = this.historiaForm.value;

    return {
      lensometria: {
        esf_od: f.len_esf_od || '',
        cil_od: f.len_cil_od || '',
        eje_od: f.len_eje_od || '',
        add_od: f.len_add_od || '',
        av_lejos_od: f.len_av_lejos_od || '',
        av_cerca_od: f.len_av_cerca_od || '',
        av_lejos_bi: f.len_av_lejos_bi || '',
        av_bi: f.len_av_bi || '',
        esf_oi: f.len_esf_oi || '',
        cil_oi: f.len_cil_oi || '',
        eje_oi: f.len_eje_oi || '',
        add_oi: f.len_add_oi || '',
        av_lejos_oi: f.len_av_lejos_oi || '',
        av_cerca_oi: f.len_av_cerca_oi || '',
        av_cerca_bi: f.len_av_cerca_bi || ''
      },
      refraccion: {
        esf_od: f.ref_esf_od || '',
        cil_od: f.ref_cil_od || '',
        eje_od: f.ref_eje_od || '',
        add_od: f.ref_add_od || '',
        avccl_od: f.ref_avccl_od || '',
        avccc_od: f.ref_avccc_od || '',
        avccl_bi: f.ref_avccl_bi || '',
        avccc_bi: f.ref_avccc_bi || '',
        esf_oi: f.ref_esf_oi || '',
        cil_oi: f.ref_cil_oi || '',
        eje_oi: f.ref_eje_oi || '',
        add_oi: f.ref_add_oi || '',
        avccl_oi: f.ref_avccl_oi || '',
        avccc_oi: f.ref_avccc_oi || ''
      },
      refraccionFinal: {
        esf_od: f.ref_final_esf_od || '',
        cil_od: f.ref_final_cil_od || '',
        eje_od: f.ref_final_eje_od || '',
        add_od: f.ref_final_add_od || '',
        alt_od: f.ref_final_alt_od || '',
        dp_od: f.ref_final_dp_od || '',
        esf_oi: f.ref_final_esf_oi || '',
        cil_oi: f.ref_final_cil_oi || '',
        eje_oi: f.ref_final_eje_oi || '',
        add_oi: f.ref_final_add_oi || '',
        alt_oi: f.ref_final_alt_oi || '',
        dp_oi: f.ref_final_dp_oi || ''
      },
      avsc_avae_otros: {
        avsc_od: f.avsc_od || '',
        avae_od: f.avae_od || '',
        otros_od: f.otros_od || '',
        avsc_oi: f.avsc_oi || '',
        avae_oi: f.avae_oi || '',
        otros_oi: f.otros_oi || '',
        avsc_bi: f.avsc_bi || ''
      }
    };
  }

  // ***************************
  // * Métodos de antecedentes
  // ***************************

  private mapAntecedentes(): Antecedentes {
    const f = this.historiaForm.value;

    return {
      tipoCristalActual: f.tipoCristalActual,
      ultimaGraduacion: f.ultimaGraduacion,
      usuarioLentes: f.usuarioLentes ?? false,
      fotofobia: f.fotofobia ?? false,
      alergicoA: f.alergicoA ?? '',
      cirugiaOcular: f.cirugiaOcular ?? false,
      cirugiaOcularDescripcion: f.cirugiaOcularDescripcion ?? '',
      traumatismoOcular: f.traumatismoOcular ?? false,
      usaDispositivosElectronicos: f.usaDispositivosElectronicos ?? false,
      tiempoUsoEstimado: f.tiempoUsoEstimado ?? '',
      antecedentesPersonales: f.antecedentesPersonales ?? [],
      antecedentesFamiliares: f.antecedentesFamiliares ?? [],
      patologias: f.patologias ?? [],
      patologiaOcular: f.patologiaOcular ?? []
    };
  }

  // ***************************
  // * Métodos de sedes
  // ***************************

  cargarSedes(): void {
    this.authService.getSedes().subscribe({
      next: (response) => {
        this.sedesDisponibles = response.sedes;
      },
      error: (err) => {
        console.error('Error al cargar sedes:', err);
      }
    });
  }

  actualizarPacientesPorSede(): void {
    this.limpiarDatos();

    const sedeId = this.sedeFiltro?.trim().toLowerCase();
    this.pacientesFiltradosPorSede = !sedeId
      ? [...this.pacientes]
      : this.pacientes.filter(p => p.sede === sedeId);
  }

  // ***************************
  // * Métodos de búsqueda/filtrado
  // ***************************

  actualizarFiltroTexto(event: { term: string; items: any[] }): void {
    this.filtro = event.term;
    this.actualizarPacientesFiltrados();
  }

  logEventoSearch(event: any): void {
    console.log('Evento search:', event);
  }

  filtrarPacientes(term: string): Observable<Paciente[]> {
    const sedeFiltrada = this.sedeFiltro?.trim().toLowerCase();

    const pacientesFiltrados = this.pacientes.filter(paciente => {
      const coincideConSede = !sedeFiltrada || paciente.sede === sedeFiltrada;
      const coincideConBusqueda =
        !term.trim() ||
        paciente.informacionPersonal.nombreCompleto.toLowerCase().includes(term.toLowerCase()) ||
        paciente.informacionPersonal.cedula.toLowerCase().includes(term.toLowerCase());

      return coincideConSede && coincideConBusqueda;
    });

    return of(pacientesFiltrados);
  }

  actualizarPacientesFiltrados(): void {
    const normalizar = (texto: string): string =>
      texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const filtroTexto = normalizar(this.filtro || '');
    const sedeFiltro = normalizar(this.sedeFiltro || 'todas');

    this.pacientesFiltrados = this.pacientes.filter(paciente => {
      const info = paciente.informacionPersonal;
      const nombre = normalizar(info?.nombreCompleto || '');
      const cedula = normalizar(String(info?.cedula || ''));
      const sedePaciente = normalizar(paciente.sede || 'sin-sede');

      const coincideTexto = !filtroTexto || (
        nombre.includes(filtroTexto) || cedula.includes(filtroTexto)
      );

      const coincideSede = sedeFiltro === 'todas' || sedePaciente === sedeFiltro;

      return coincideSede && coincideTexto;
    });

    const siguePresente = this.pacientesFiltrados.some(p =>
      this.compararPacientes(p, this.pacienteSeleccionado)
    );

    if (!siguePresente) {
      this.pacienteSeleccionado = null;
    }
  }

  // ***************************
  // * Métodos de utilidad
  // ***************************

  textoABooleano(valor: any): boolean {
    return valor?.toString().toLowerCase() === 'sí' || valor === true;
  }

  formatearFecha(fechaIso: string | Date): string {
    if (!fechaIso) return 'Fecha inválida';

    const isoString = typeof fechaIso === 'string' ? fechaIso : fechaIso.toISOString();
    if (isoString.includes('/') && !isoString.includes('T')) return isoString;

    const fechaLimpiada = isoString.split('T')[0];
    const [anio, mes, dia] = fechaLimpiada.split('-');
    return `${dia}/${mes}/${anio}`;
  }

  calcularEdad(fechaNacimiento: string | undefined): number {
    if (!fechaNacimiento) return 0;

    const nacimiento = new Date(fechaNacimiento);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();

    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }

    return edad;
  }

  getMaterialLabel(materiales: TipoMaterial | TipoMaterial[]): string {
    if (!materiales) return 'No especificado';

    const array = Array.isArray(materiales) ? materiales : [materiales];
    return array.map(m => this.materialLabels.get(m) || m).join(', ');
  }

  compararPacientes(p1: any, p2: any): boolean {
    return p1 && p2
      ? p1.informacionPersonal?.cedula === p2.informacionPersonal?.cedula
      : false;
  }

  filtrarPorNombreOCedula(term: string, item: any): boolean {
    const normalizar = (texto: string): string =>
      texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const filtro = normalizar(term);
    const nombre = normalizar(item.informacionPersonal?.nombreCompleto || '');
    const cedula = normalizar(String(item.informacionPersonal?.cedula || ''));

    return nombre.includes(filtro) || cedula.includes(filtro);
  }


  historiaModificada(): boolean {
    if (!this.modoEdicion) return true;

    const actual = this.historiaForm.value;

    const camposModificados = Object.keys(this.formOriginalHistoria).some(key => {
      const valorActual = actual[key];
      const valorOriginal = this.formOriginalHistoria[key];

      if (Array.isArray(valorActual) && Array.isArray(valorOriginal)) {
        return !this.arraysIguales(valorActual, valorOriginal);
      }

      return valorActual !== valorOriginal;
    });

    return camposModificados;
  }

  arraysIguales(arr1: any[], arr2: any[]): boolean {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((val, i) => val === arr2[i]);
  }

  // ***************************
  // * Métodos de UI/eventos
  // ***************************

  onMotivoChange(selectedOptions: any[]) {
    this.mostrarInputOtroMotivo = selectedOptions.includes('Otro');
    const otroMotivoControl = this.historiaForm.get('otroMotivo');

    if (this.mostrarInputOtroMotivo) {
      otroMotivoControl?.setValidators([Validators.required]);
    } else {
      otroMotivoControl?.clearValidators();
      otroMotivoControl?.setValue('');
    }
    otroMotivoControl?.updateValueAndValidity();
  }

  verDetalle(historia: HistoriaMedica): void {
    this.historiaSeleccionada = { ...historia };
    setTimeout(() => {
      const detalle = document.getElementById('detalleExamen');
      if (detalle) detalle.scrollTop = 0;
    }, 100);
  }

  limpiarDatos(): void {
    this.pacienteSeleccionado = null;
    this.historial = [];
    this.historiaSeleccionada = null;
    this.mostrarElementos = false;
    this.mostrarSinHistorial = false;
  }

  cerrarModal(id: string): void {
    const modalElement = document.getElementById(id);
    if (modalElement) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      modal?.hide();
    }
  }

  limpiarModal(): void {
    this.historiaEnEdicion = null;
    this.modoEdicion = false;
    this.historiaForm.reset();
    this.recomendaciones.clear();
  }

  // ***************************
  // * Métodos de validación
  // ***************************

  checkInvalidControls() {
    Object.keys(this.historiaForm.controls).forEach(key => {
      const control = this.historiaForm.get(key);
      if (control?.invalid) {
        console.log(`Campo inválido: ${key}`, {
          value: control.value,
          errors: control.errors
        });
      }
    });
  }

  // ***************************
  // * Getters
  // ***************************

  get patologias(): string[] {
    return this.historiaSeleccionada?.antecedentes?.patologias ?? [];
  }

  get patologiaOcular(): string[] {
    return this.historiaSeleccionada?.antecedentes?.patologiaOcular ?? [];
  }

  // ***************************
  // * Métodos de comparación
  // ***************************

  compareStrings(a: string, b: string): boolean {
    return a === b;
  }

  filtrarPaciente = (term: string, item: Paciente): boolean => {
    const texto = term.toLowerCase();
    return item.informacionPersonal.nombreCompleto.toLowerCase().includes(texto) ||
      item.informacionPersonal.cedula.toLowerCase().includes(texto);
  };

  searchFn(term: string, item: any): boolean {
    const texto = term.toLowerCase();
    const nombre = item.informacionPersonal?.nombreCompleto?.toLowerCase() ?? '';
    const cedula = String(item.informacionPersonal?.cedula).toLowerCase();

    return nombre.includes(texto) || cedula.includes(texto);
  }
}