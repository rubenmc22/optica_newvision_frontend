import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Paciente } from '../pacientes/paciente-interface';
import { HistoriaMedica, HistoriaMedicaCompleta, Conformidad, Recomendaciones, TipoMaterial, Antecedentes, ExamenOcular, Medico, RespuestaCreacionHistoria } from './historias_medicas-interface';
import {
  OPCIONES_REF,
  OPCIONES_ANTECEDENTES,
  MOTIVOS_CONSULTA,
  TIPOS_CRISTALES,
  MATERIALES
} from 'src/app/shared/constants/historias-medicas';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HistoriaMedicaService } from '../../core/services/historias-medicas/historias-medicas.service';

import * as bootstrap from 'bootstrap';
import { SwalService } from '../../core/services/swal/swal.service';
import { ModalService } from '../../core/services/modal/modal.service';
import { PacientesService } from '../../core/services/pacientes/pacientes.service';
import { UserStateService } from '../../core/services/userState/user-state-service';
import { HttpErrorResponse } from '@angular/common/http';

import { Subject, Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap, takeUntil } from 'rxjs/operators';
import { EmpleadosService } from './../../core/services/empleados/empleados.service';
import { Empleado } from '../../Interfaces/models-interface';


declare var $: any;

@Component({
  selector: 'app-historias-medicas',
  standalone: false,
  templateUrl: './historias-medicas.component.html',
  styleUrls: ['./historias-medicas.component.scss']
})
export class HistoriasMedicasComponent implements OnInit {
  // Estados del componente
  busqueda: string = '';
  // Agrega esto en la sección de propiedades de tu componente
  input$ = new Subject<string>();
  cargando: boolean = false;
  mostrarElementos = false;
  mostrarSinHistorial = false;
  modoEdicion: boolean = false;
  mostrarInputOtroMotivo = false;
  maxDate: string;
  sedeActiva: string = '';
  sedeFiltro: string = this.sedeActiva;
  filtro: string = '';
  sedesDisponibles: string[] = [];
  pacienteParaNuevaHistoria: Paciente | null = null;

  //Empleados
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
  historiaSeleccionada: HistoriaMedica | null = null;
  pacienteIdSeleccionado: string | null = null;
  historial: HistoriaMedica[] = [];
  historiasMock: Record<string, HistoriaMedica[]> = {};
  notaConformidad: string = 'PACIENTE CONFORME CON LA EXPLICACION  REALIZADA POR EL ASESOR SOBRE LAS VENTAJAS Y DESVENTAJAS DE LOS DIFERENTES TIPOS DE CRISTALES Y MATERIAL DE MONTURA, NO SE ACEPTARAN MODIFICACIONES LUEGO DE HABER RECIBIDO LA INFORMACION Y FIRMADA LA HISTORIA POR EL PACIENTE.';
  mostrarMaterialPersonalizado: boolean[] = [];

  // Declaración sin inicialización directa
  historiaForm: FormGroup;

  opcionesRef = OPCIONES_REF;
  opcionesAntecedentes = OPCIONES_ANTECEDENTES;
  motivosConsulta = MOTIVOS_CONSULTA;
  tiposCristales = TIPOS_CRISTALES;
  materiales: typeof MATERIALES;
  typeahead$ = new Subject<string>();
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
  ) {

    this.materiales = MATERIALES;
    this.materialLabels = new Map<TipoMaterial, string>(
      this.materiales.map(m => [m.value as TipoMaterial, m.label])
    );

    this.maxDate = new Date().toISOString().split('T')[0];
    this.historiaForm = this.fb.group({}); // Inicialización básica
    this.inicializarFormulario();
  }

  crearHistoriaNueva(): void {
    this.historiaSeleccionada = null;
    this.iniciarFlujoHistoria();
  }

  verificarMaterialOtro(index: number): void {
    const materialesSeleccionados = this.recomendaciones.at(index).get('material')?.value || [];
    this.mostrarMaterialPersonalizado[index] = materialesSeleccionados.includes('OTRO');
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
      recomendaciones: this.fb.array([this.crearRecomendacion()]),
      // cristal: ['', Validators.required],
      //  material: ['', Validators.required],
      // montura: ['', Validators.required],
      //observaciones: ['']
    });
  }

  onPacienteSeleccionado(): void {
    const paciente = this.historiaForm.get('paciente')?.value;
    console.log('Paciente', paciente);
    this.pacienteParaNuevaHistoria = paciente;
  }

  onMedicoSeleccionado(medico: Medico): void {
    console.log('Médico seleccionado:', medico);
    this.medicoSeleccionado = medico;
  }

  private limpiarDatosPaciente(): void {
    this.historial = [];
    this.historiaSeleccionada = null;
  }

  private loadEmployees(): void {
    this.isLoading = true;
    this.empleadosService.getAllEmpleados().subscribe((empleados: Empleado[]) => {
      // Filtra solo oftalmólogos y optometristas
      this.medicoTratante = empleados.filter(emp =>
        emp.cargoId === 'oftalmologo' || emp.cargoId === 'optometrista'
      );
      this.filteredEmployees = [...this.employees]; // Copia filtrada para búsquedas
      this.isLoading = false;
    }, error => {
      console.error('Error al cargar empleados:', error);
      this.isLoading = false;
    });
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
    console.log('Paciente seleccionado:', paciente);

    // Aquí puedes cargar las historias médicas del paciente
    this.cargarHistoriasMedicas(id);
  }

  seleccionarHistoriasPorPaciente(paciente: Paciente | null): void {
    if (!paciente) {
      console.log('Selección limpiada');
      this.limpiarDatos();
      return;
    }

    console.log('Paciente seleccionado:', paciente);
    this.pacienteSeleccionado = paciente;

    // Cargar historias médicas del paciente
    this.cargarHistoriasMedicas(paciente.key);
  }

  limpiarDatos(): void {
    this.pacienteSeleccionado = null;
    // Limpiar otros datos relacionados si es necesario
  }

  private inicializarSedeDesdeUsuario(): void {
    this.userStateService.currentUser$.subscribe(user => {
      this.sedeActiva = user?.sede ?? 'guatire';
      this.sedeFiltro = this.sedeActiva;
      // console.log('Sede activa:', this.sedeActiva);
      this.cargarPacientes();
    });
  }

  ngOnInit(): void {
    this.typeahead$
      .pipe(
        debounceTime(200),
        distinctUntilChanged()
      )
      .subscribe(term => {
        // Puedes usar esto para filtrar pacientes si lo prefieres
        this.filtro = term;
        this.actualizarPacientesFiltrados();
      });

    this.historiasMock = {};
    this.inicializarSedeDesdeUsuario();
    this.configurarSubscripciones();
    this.cargarPacientes();

    // En el ngOnInit, después de inicializar otras propiedades
    this.input$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => this.cargando = true),
      switchMap(term => this.filtrarPacientes(term))
    ).subscribe();

    // ✨ Forzamos cambio de referencia al terminar la carga inicial
    setTimeout(() => {
      this.pacienteIdSeleccionado = null;
      this.pacienteSeleccionado = null;
    }, 0);
  }

  private filtrarPacientes(term: string): Observable<Paciente[]> {
    if (!term.trim()) {
      return of(this.pacientes);
    }
    return of(this.pacientes.filter(paciente =>
      paciente.informacionPersonal.nombreCompleto.toLowerCase().includes(term.toLowerCase()) ||
      paciente.informacionPersonal.cedula.toLowerCase().includes(term.toLowerCase())
    ));
  }

  // Métodos de carga de datos
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

        this.actualizarPacientesFiltrados(); // ← Aquí
        const sedesSet = new Set<string>();
        this.pacientes.forEach((p) => {
          if (p.sede) sedesSet.add(p.sede);
        });
        this.sedesDisponibles = Array.from(sedesSet);
      },
      error: (error) => {
        console.error('Error al cargar pacientes:', error);
        this.swalService.showError('Error', 'No se han podido cargar los pacientes');
        this.pacientes = [];
      }
    });
  }

  textoABooleano(valor: any): boolean {
    return valor?.toString().toLowerCase() === 'sí' || valor === true;
  }

  formatearFecha(fechaIso: string): string {
    if (!fechaIso || typeof fechaIso !== 'string') return 'Fecha inválida';

    // Evita formatear si ya está en formato DD/MM/YYYY
    if (fechaIso.includes('/') && !fechaIso.includes('T')) return fechaIso;

    const fechaLimpiada = fechaIso.split('T')[0]; // elimina hora si está presente
    const [anio, mes, dia] = fechaLimpiada.split('-');
    return `${dia}/${mes}/${anio}`;
  }

  iniciarFlujoHistoria(): void {
    if (this.historiaSeleccionada) {
      this.precargarHistoriaSeleccionada();
    } else {
      this.loadEmployees();
      this.prepararNuevaHistoria();
    }

    $('#historiaModal').modal('show');
  }

  getMaterialLabel(materiales: TipoMaterial | TipoMaterial[]): string {
    if (!materiales) return 'No especificado';

    const array = Array.isArray(materiales) ? materiales : [materiales];
    return array.map(m => this.materialLabels.get(m) || m).join(', ');
  }

  private precargarHistoriaSeleccionada(): void {
    this.modoEdicion = true;
    this.historiaForm.reset();

    const h = this.historiaSeleccionada!;
    const dc = h.datosConsulta;
    const ant = h.antecedentes;
    const eo = h.examenOcular;
    const dt = h.diagnosticoTratamiento;

    this.historiaForm.patchValue({
      horaEvaluacion: h.horaEvaluacion,
      pacienteId: h.pacienteId,

      // Datos de consulta
      motivo: Array.isArray(dc.motivo) ? dc.motivo : [dc.motivo],
      otroMotivo: dc.otroMotivo,
      medico: dc.medico,
      asesor: dc.asesor,
      cedulaAsesor: dc.cedulaAsesor,

      // Antecedentes
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

    // Guardar el estado original del formulario para detectar cambios
    this.formOriginalHistoria = this.historiaForm.value;

  }

  private prepararNuevaHistoria(): void {
    this.historiaForm.reset();
    this.modoEdicion = false;
    this.recomendaciones.clear(); // si usas FormArray
    this.agregarRecomendacion();  // agrega una recomendación vacía
  }

  guardarHistoria(): void {
    console.log('this.modoEdicion', this.modoEdicion);
    if (this.modoEdicion) {
      // this.actualizarHistoria(); // aún por implementar
    } else {
      this.crearHistoria(); // ya lo tienes listo
    }
  }

  private construirHistoriaMedica(): HistoriaMedica {
    const formValue = this.historiaForm.value;

    return {
      id: this.modoEdicion && this.historiaSeleccionada ? this.historiaSeleccionada.id : `h${Date.now()}`,
      nHistoria: this.modoEdicion && this.historiaSeleccionada ? this.historiaSeleccionada.nHistoria : `HIS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      fecha: new Date().toISOString(),
      horaEvaluacion: formValue.horaEvaluacion,
      pacienteId: formValue.pacienteId.id || formValue.pacienteId,

      datosConsulta: {
        motivo: formValue.motivo.includes('Otro') ? formValue.otroMotivo : formValue.motivo,
        otroMotivo: formValue.otroMotivo,
        medico: formValue.medico,
        asesor: formValue.asesor,
        cedulaAsesor: formValue.cedulaAsesor
      },

      antecedentes: this.mapAntecedentes(),

      examenOcular: this.mapExamenOcular(),

      diagnosticoTratamiento: {
        diagnostico: formValue.diagnostico ?? '',
        tratamiento: formValue.tratamiento ?? ''
      },

      recomendaciones: this.mapRecomendaciones(),

      conformidad: {
        notaConformidad: this.notaConformidad,
        firmaPaciente: '',
        firmaMedico: '',
        firmaAsesor: ''
      },

      auditoria: {
        fechaCreacion: new Date().toISOString(),
        creadoPor: 'usuario_actual',
        fechaActualizacion: this.modoEdicion ? new Date().toISOString() : undefined,
        actualizadoPor: this.modoEdicion ? 'usuario_actual' : undefined
      }
    };
  }

  private mapExamenOcular(): ExamenOcular {
    const f = this.historiaForm.value;

    return {
      lensometria: {
        esf_od: f.len_esf_od,
        cil_od: f.len_cil_od,
        eje_od: f.len_eje_od,
        add_od: f.len_add_od,
        av_lejos_od: f.len_av_lejos_od,
        av_cerca_od: f.len_av_cerca_od,
        av_lejos_bi: f.len_av_lejos_bi,
        av_bi: f.len_av_bi,
        esf_oi: f.len_esf_oi,
        cil_oi: f.len_cil_oi,
        eje_oi: f.len_eje_oi,
        add_oi: f.len_add_oi,
        av_lejos_oi: f.len_av_lejos_oi,
        av_cerca_oi: f.len_av_cerca_oi,
        av_cerca_bi: f.len_av_cerca_bi
      },
      refraccion: {
        esf_od: f.ref_esf_od,
        cil_od: f.ref_cil_od,
        eje_od: f.ref_eje_od,
        add_od: f.ref_add_od,
        avccl_od: f.ref_avccl_od,
        avccc_od: f.ref_avccc_od,
        avccl_bi: f.ref_avccl_bi,
        avccc_bi: f.ref_avccc_bi,
        esf_oi: f.ref_esf_oi,
        cil_oi: f.ref_cil_oi,
        eje_oi: f.ref_eje_oi,
        add_oi: f.ref_add_oi,
        avccl_oi: f.ref_avccl_oi,
        avccc_oi: f.ref_avccc_oi
      },
      refraccionFinal: {
        esf_od: f.ref_final_esf_od,
        cil_od: f.ref_final_cil_od,
        eje_od: f.ref_final_eje_od,
        add_od: f.ref_final_add_od,
        alt_od: f.ref_final_alt_od,
        dp_od: f.ref_final_dp_od,
        esf_oi: f.ref_final_esf_oi,
        cil_oi: f.ref_final_cil_oi,
        eje_oi: f.ref_final_eje_oi,
        add_oi: f.ref_final_add_oi,
        alt_oi: f.ref_final_alt_oi,
        dp_oi: f.ref_final_dp_oi
      },
      avsc_avae_otros: {
        avsc_od: f.avsc_od,
        avae_od: f.avae_od,
        otros_od: f.otros_od,
        avsc_oi: f.avsc_oi,
        avae_oi: f.avae_oi,
        otros_oi: f.otros_oi,
        avsc_bi: f.avsc_bi
      }
    };
  }

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

  private mapRecomendaciones(): Recomendaciones[] {
    return this.recomendaciones.controls.map(control => {
      const grupo = control as FormGroup;

      const materialesSeleccionados: string[] = grupo.get('material')?.value || [];
      const otrosMaterialesRaw: string = grupo.get('materialPersonalizado')?.value?.trim() || '';
      console.log('materialesSeleccionados:', grupo.get('material')?.value);

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

  private crearHistoria(): void {
    // Validar que hay un paciente seleccionado
    if (!this.pacienteParaNuevaHistoria) {
      this.swalService.showError('Error', 'No hay ningún paciente seleccionado');
      return;
    }

    // Validar que el formulario es válido
    if (this.historiaForm.invalid) {
      this.swalService.showError('Error', 'Por favor complete todos los campos requeridos');
      return;
    }

    // Obtener valores del formulario
    const formValue = this.historiaForm.value;

    const historia: any = {
      pacienteId: this.pacienteParaNuevaHistoria.key,
      datosConsulta: {
        motivo: Array.isArray(formValue.motivo) ? formValue.motivo : [formValue.motivo],
        otroMotivo: formValue.otroMotivo || '',
        medico: formValue.medico?.cedula || 'Médico no especificado',
      },
      examenOcular: {
        lensometria: {
          esf_od: formValue.len_esf_od || '',
          cil_od: formValue.len_cil_od || '',
          eje_od: formValue.len_eje_od || '',
          add_od: formValue.len_add_od || '',
          av_lejos_od: formValue.len_av_lejos_od || '',
          av_cerca_od: formValue.len_av_cerca_od || '',
          av_lejos_bi: formValue.len_av_lejos_bi || '',
          av_bi: formValue.len_av_bi || '',
          esf_oi: formValue.len_esf_oi || '',
          cil_oi: formValue.len_cil_oi || '',
          eje_oi: formValue.len_eje_oi || '',
          add_oi: formValue.len_add_oi || '',
          av_lejos_oi: formValue.len_av_lejos_oi || '',
          av_cerca_oi: formValue.len_av_cerca_oi || '',
          av_cerca_bi: formValue.len_av_cerca_bi || ''
        },
        refraccion: {
          esf_od: formValue.ref_esf_od || '',
          cil_od: formValue.ref_cil_od || '',
          eje_od: formValue.ref_eje_od || '',
          add_od: formValue.ref_add_od || '',
          avccl_od: formValue.ref_avccl_od || '',
          avccc_od: formValue.ref_avccc_od || '',
          avccl_bi: formValue.ref_avccl_bi || '',
          avccc_bi: formValue.ref_avccc_bi || '',
          esf_oi: formValue.ref_esf_oi || '',
          cil_oi: formValue.ref_cil_oi || '',
          eje_oi: formValue.ref_eje_oi || '',
          add_oi: formValue.ref_add_oi || '',
          avccl_oi: formValue.ref_avccl_oi || '',
          avccc_oi: formValue.ref_avccc_oi || ''
        },
        refraccionFinal: {
          esf_od: formValue.ref_final_esf_od || '',
          cil_od: formValue.ref_final_cil_od || '',
          eje_od: formValue.ref_final_eje_od || '',
          add_od: formValue.ref_final_add_od || '',
          alt_od: formValue.ref_final_alt_od || '',
          dp_od: formValue.ref_final_dp_od || '',
          esf_oi: formValue.ref_final_esf_oi || '',
          cil_oi: formValue.ref_final_cil_oi || '',
          eje_oi: formValue.ref_final_eje_oi || '',
          add_oi: formValue.ref_final_add_oi || '',
          alt_oi: formValue.ref_final_alt_oi || '',
          dp_oi: formValue.ref_final_dp_oi || ''
        },
        avsc_avae_otros: {
          avsc_od: formValue.avsc_od || '',
          avae_od: formValue.avae_od || '',
          otros_od: formValue.otros_od || '',
          avsc_oi: formValue.avsc_oi || '',
          avae_oi: formValue.avae_oi || '',
          otros_oi: formValue.otros_oi || '',
          avsc_bi: formValue.avsc_bi || ''
        }
      },
      diagnosticoTratamiento: {
        diagnostico: formValue.diagnostico || '',
        tratamiento: formValue.tratamiento || ''
      },
      recomendaciones: this.mapRecomendaciones(),
      conformidad: {
        notaConformidad: this.notaConformidad,
      },
    };

    // Mostrar carga mientras se procesa
    this.cargando = true;

    this.historiaService.createHistoria(historia).subscribe({
      next: (respuesta) => {
        this.cargando = false;
        const historiaCreada = respuesta.historial_medico;
        this.cerrarModal('#historiaModal');
        this.swalService.showSuccess(
          '¡Historia creada!',
          `Historia médica #${historiaCreada.nHistoria ?? 'sin número'} registrada correctamente`
        );

        if (!this.historial) {
          this.historial = [];
        }
        this.historial.unshift(historiaCreada);
        this.historiaSeleccionada = historiaCreada;

        this.historiaForm.reset();
        this.modoEdicion = false;
      },

      error: (err) => {
        this.cargando = false;
        console.error('Error al guardar historia:', err);

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

  // Para manejar la lógica de modificación del formulario
  historiaModificada(): boolean {
    if (!this.modoEdicion) return true;

    const actual = this.historiaForm.value;

    const camposModificados = Object.keys(this.formOriginalHistoria).some(key => {
      const valorActual = actual[key];
      const valorOriginal = this.formOriginalHistoria[key];

      // Si son arrays, comparar con lógica personalizada
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



  /* private actualizarHistoria(historia: HistoriaMedica): void {
     this.historiaService.updateHistoria(historia.id, historia).subscribe({
       next: () => {
         this.swalService.showSuccess('¡Historia actualizada!', 'Los cambios fueron guardados correctamente.');
         this.seleccionarPacientePorId(historia.pacienteId);
       },
       error: (err) => {
         console.error('Error al actualizar historia:', err);
         this.swalService.showError('Error', 'No se pudo actualizar la historia médica.');
       }
     });
   }*/


  cerrarModal(id: string): void {
    const modalElement = document.getElementById(id);

    if (modalElement) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      modal?.hide();
    }

    //   this.resetearFormulario();
  }

  get recomendaciones(): FormArray {
    return this.historiaForm.get('recomendaciones') as FormArray;
  }

  crearRecomendacion(rec?: Recomendaciones): FormGroup {
    return this.fb.group({
      cristal: [rec?.cristal || null, Validators.required], // Cambiado a null
      material: [rec?.material || [], Validators.required], // Array vacío
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

  // Métodos públicos
  compareStrings(a: string, b: string): boolean {
    return a === b;
  }

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


  @ViewChild('selectorPaciente') selectorPaciente!: ElementRef;

  filtrarPaciente = (term: string, item: Paciente): boolean => {
    const texto = term.toLowerCase();
    return item.informacionPersonal.nombreCompleto.toLowerCase().includes(texto) ||
      item.informacionPersonal.cedula.toLowerCase().includes(texto);
  };

  verDetalle(historia: HistoriaMedica): void {
    this.historiaSeleccionada = historia;

    setTimeout(() => {
      const detalle = document.getElementById('detalleExamen');
      if (detalle) {
        detalle.scrollTop = 0;
      }
    }, 100);
  }

  searchFn(term: string, item: any): boolean {
    const texto = term.toLowerCase();
    const nombre = item.informacionPersonal?.nombreCompleto?.toLowerCase() ?? '';
    const cedula = String(item.informacionPersonal?.cedula).toLowerCase();

    return nombre.includes(texto) || cedula.includes(texto);
  }


  actualizarPacientesFiltrados(): void {
    const filtroTexto = this.filtro.trim().toLowerCase();
    const sedeFiltro = this.sedeFiltro?.toLowerCase() ?? 'todas';

    console.log('filtroTexto', filtroTexto);
    this.pacientesFiltrados = this.pacientes.filter(paciente => {
      const info = paciente.informacionPersonal;
      const sedePaciente = paciente.sede?.toLowerCase() ?? 'sin-sede';

      const coincideTexto =
        info.nombreCompleto?.toLowerCase().includes(filtroTexto) ||
        String(info.cedula)?.toLowerCase().includes(filtroTexto);

      const coincideSede =
        sedeFiltro === 'todas' || sedePaciente === sedeFiltro;

      return coincideSede && coincideTexto;
    });

    // Verificar si el seleccionado sigue en la lista
    const siguePresente = this.pacientesFiltrados.some(p =>
      this.compararPacientes(p, this.pacienteSeleccionado)
    );

    if (!siguePresente) {
      this.pacienteSeleccionado = null;
    }
  }

  compararPacientes(p1: any, p2: any): boolean {
    return p1 && p2
      ? p1.informacionPersonal?.cedula === p2.informacionPersonal?.cedula
      : false;
  }



  get patologias(): string[] {
    return this.historiaSeleccionada?.antecedentes?.patologias ?? [];
  }

  get patologiaOcular(): string[] {
    return this.historiaSeleccionada?.antecedentes?.patologiaOcular ?? [];
  }

  /* editarHistoria(historia: HistoriaMedica): void {
     this.modoEdicion = true;
 
     const motivo = Array.isArray(historia.motivo) ? historia.motivo : [historia.motivo];
     const esMotivoPersonalizado = motivo.some(m => !this.motivosConsulta.includes(m));
 
     this.historiaForm.patchValue({
       ...historia,
       motivo: esMotivoPersonalizado ? ['Otro'] : motivo,
       otroMotivo: esMotivoPersonalizado ? historia.motivo.toString() : '',
       pacienteId: this.pacientes.find(p => p.id === historia.pacienteId)
     });
 
     this.mostrarInputOtroMotivo = esMotivoPersonalizado;
     $('#historiaModal').modal('show');
   }*/

  /*  nuevaHistoria(): void {
      this.modoEdicion = false;
      this.historiaForm.reset({
        fecha: new Date().toISOString().split('T')[0],
        pacienteId: this.pacienteSeleccionado
      });
      this.mostrarInputOtroMotivo = false;
  
      const modalElement = document.getElementById('historiaModal');
      if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
      }
    }*/

  cargarHistoriasMedicas(pacienteId: string): void {
    this.cargando = true;
    this.historiaService.getHistoriasPorPaciente(pacienteId).subscribe({
      next: (historias: HistoriaMedica[]) => {
        this.historial = historias;
        this.historiaSeleccionada = this.historial[0] || null;

        this.mostrarSinHistorial = this.historial.length === 0;
        this.mostrarElementos = this.historial.length > 0;

        this.cargando = false;
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

  calcularEdad(fechaNacimiento: string | undefined): number {
    if (!fechaNacimiento) return 0; // o algún valor por defecto

    const nacimiento = new Date(fechaNacimiento);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();

    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }

    return edad;
  }
}