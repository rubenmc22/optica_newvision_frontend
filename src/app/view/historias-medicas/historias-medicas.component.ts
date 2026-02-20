import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { take, catchError } from 'rxjs/operators';
import * as bootstrap from 'bootstrap';
import { ActivatedRoute, Router } from '@angular/router';
declare var $: any;

// cargarPacientes
import { Paciente, PacientesListState } from '../pacientes/paciente-interface';
import { HistoriaMedica, Recomendaciones, TipoMaterial, Antecedentes, ExamenOcular, Medico, DatosConsulta } from './historias_medicas-interface';
import { Empleado } from '../../Interfaces/models-interface';
import { Sede } from '../../view/login/login-interface';
import { LoaderService } from './../../shared/loader/loader.service';

// Constantes
import {
  OPCIONES_REF,
  OPCIONES_AV,
  OPCIONES_ANTECEDENTES_PERSONALES,
  OPCIONES_ANTECEDENTES_FAMILIARES,
  MOTIVOS_CONSULTA,
  TIPOS_CRISTALES,
  TIPOS_LENTES_CONTACTO,
  MATERIALES,
  TRATAMIENTOS_ADITIVOS
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
  tareasPendientes = 0;
  dataIsReady = false;

  esOftalmologoSeleccionado: boolean = false;
  esOptometristaSeleccionado: boolean = false;
  realizoCompraLentes: boolean = false;
  facturacionData: any = null;
  mostrarConfig: boolean = false;

  // Empleados
  isLoading = true;
  employees: any[] = [];
  medicoTratante: any[] = [];
  filteredEmployees: any[] = [];

  panelSuperiorColapsado = false;
  panelInferiorColapsado = false;

  // Datos
  pacientes: Paciente[] = [];
  pacientesFiltrados: Paciente[] = [];
  formOriginalHistoria: any = {};
  sedePacienteSeleccionado = '';
  medicoSeleccionado: Medico | null = null;
  pacienteSeleccionado: Paciente | null = null;
  historiaEnEdicion: HistoriaMedica | null = null;
  historiaSeleccionada: HistoriaMedica | null = null;
  pacienteIdSeleccionado: string | null = null;
  historial: HistoriaMedica[] = [];
  notaConformidad: string = 'PACIENTE CONFORME CON LA EXPLICACION  REALIZADA POR EL ASESOR SOBRE LAS VENTAJAS Y DESVENTAJAS DE LOS DIFERENTES TIPOS DE CRISTALES Y MATERIAL DE MONTURA, NO SE ACEPTARAN MODIFICACIONES LUEGO DE HABER RECIBIDO LA INFORMACION Y FIRMADA LA HISTORIA POR EL PACIENTE.';
  horaEvaluacion: string = '';
  mostrarBotonVolver = false;

  mostrarModalMontos: boolean = false;
  montoMedico: number = 20;
  montoOptica: number = 20;
  totalCalculado: number = 40;


  private navigationMap: { [key: string]: string } = {};
  private isNavigating = false;
  private currentRowMap: { [key: string]: string[] } = {};
  private columnMap: { [key: string]: string[] } = {};

  // Formulario
  historiaForm: FormGroup;

  // Constantes
  opcionesRef = OPCIONES_REF;
  opcionesAV = OPCIONES_AV;
  motivosConsulta = MOTIVOS_CONSULTA;
  tiposCristales = TIPOS_CRISTALES;
  tiposLentesContacto = TIPOS_LENTES_CONTACTO;
  materiales: typeof MATERIALES;
  materialLabels!: Map<TipoMaterial, string>;
  mostrarSelectLentesContacto: boolean = false;

  // ARRAYS DE VISIBILIDAD PARA RECOMENDACIONES 
  mostrarMedidasProgresivo: boolean[] = [];
  mostrarTipoLentesContacto: boolean[] = [];
  mostrarMaterialPersonalizado: boolean[] = [];

  readonly materialesValidos = new Set<TipoMaterial>([
    'CR39',
    'POLICARBONATO',
    'HI_INDEX_156',
    'HI_INDEX_167',
    'HI_INDEX_174',
    'OTRO'
  ]);

  montosForm: FormGroup;


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
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private loader: LoaderService
  ) {
    this.materiales = MATERIALES;
    this.materialLabels = new Map<TipoMaterial, string>(
      this.materiales.map(m => [m.value as TipoMaterial, m.label])
    );

    this.maxDate = new Date().toISOString().split('T')[0];
    this.historiaForm = this.fb.group({});
    this.inicializarFormulario();

    // Inicializar mapas de navegación
    this.initializeNavigationMaps();

    // En el constructor, ya lo tienes:
    this.montosForm = this.fb.group({
      montoMedico: [20],
      montoOptica: [20],
      total: [{ value: 40, disabled: true }]
    });

  }



  // ***************************
  // * Métodos de inicialización
  // ***************************

  ngOnInit(): void {
    const idPaciente = this.obtenerIdPacienteDesdeRuta();

    if (idPaciente) {
      const savedState = sessionStorage.getItem('pacientesListState');

      if (savedState) {
        try {
          const { desdePacientes } = JSON.parse(savedState) as PacientesListState;
          this.mostrarBotonVolver = !!desdePacientes;

          // Si el flag es falso, limpiar para no arrastrar estado viejo
          if (!desdePacientes) {
            sessionStorage.removeItem('pacientesListState');
            sessionStorage.removeItem('pacienteKey');
          }
        } catch {
          this.mostrarBotonVolver = false;
          sessionStorage.removeItem('pacientesListState');
          sessionStorage.removeItem('pacienteKey');
        }
      } else {
        this.mostrarBotonVolver = false;
        sessionStorage.removeItem('pacientesListState');
        sessionStorage.removeItem('pacienteKey');
      }
    } else {
      // Entrada directa sin idPaciente → no mostrar botón
      this.mostrarBotonVolver = false;
      sessionStorage.removeItem('pacientesListState');
      sessionStorage.removeItem('pacienteKey');
    }

    this.configurarSubscripciones();
    this.inicializarDatosIniciales();

    // Inicializar navegación
    this.initializeNavigationMaps();

    setTimeout(() => {
      this.pacienteIdSeleccionado = null;
      this.pacienteSeleccionado = null;
    }, 0);
  }

  private obtenerIdPacienteDesdeRuta(): string | null {
    let actual: ActivatedRoute | null = this.route;
    while (actual) {
      const param = actual.snapshot.paramMap.get('id');
      if (param) {
        return param.split('-')[0];
      }
      actual = actual.firstChild;
    }
    return null;
  }

  volverAlListado(): void {
    sessionStorage.removeItem('pacientesListState');
    this.router.navigate(['/pacientes']);
  }

  private inicializarFormulario(): void {
    this.historiaForm = this.fb.group({
      // Sección Paciente
      paciente: [null, Validators.required],
      medico: ['', Validators.required],
      motivo: [[], Validators.required],
      otroMotivo: [''],
      tipoCristalActual: [''],
      tipoLentesContacto: [''],
      ultimaGraduacion: [''],

      // Lensometría
      len_esf_od: [''],
      len_cil_od: [''],
      len_eje_od: [''],
      len_add_od: [''],
      len_av_lejos_od: [''],
      len_av_cerca_od: [''],
      len_av_lejos_bi: [''],
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
      ref_final_esf_od: ['', Validators.required],
      ref_final_cil_od: ['', Validators.required],
      ref_final_eje_od: ['', Validators.required],
      ref_final_add_od: ['', Validators.required],
      ref_final_alt_od: [''],
      ref_final_dp_od: [''],
      ref_final_esf_oi: ['', Validators.required],
      ref_final_cil_oi: ['', Validators.required],
      ref_final_eje_oi: ['', Validators.required],
      ref_final_add_oi: ['', Validators.required],
      ref_final_alt_oi: [''],
      ref_final_dp_oi: [''],

      // AVSC - AVAE - OTROS
      avsc_lejos_od: [''],
      avsc_cerca_od: [''],
      avae_od: [''],
      otros_od: [''],
      avsc_lejos_oi: [''],
      avsc_cerca_oi: [''],
      avae_oi: [''],
      otros_oi: [''],

      // Diagnóstico y Tratamiento
      diagnostico: [''],
      tratamiento: [''],

      // Recomendaciones
      recomendaciones: this.fb.array([this.crearRecomendacion()])

    });

    this.mostrarMedidasProgresivo = [false];
    this.mostrarTipoLentesContacto = [false];
    this.mostrarMaterialPersonalizado = [false];
  }

  private inicializarDatosIniciales(): void {
    this.iniciarCarga();
    this.tareaIniciada(); // forkJoin

    forkJoin({
      user: this.userStateService.currentUser$.pipe(
        take(1),
        catchError(error => {
          console.error('Error al cargar usuario:', error);
          this.snackBar.open('⚠️ Error al cargar su información de usuario. Por favor, intente nuevamente.', 'Cerrar', {
            duration: 5000,
            panelClass: ['snackbar-error']
          });
          return of(null); // Retorna null si hay error
        })
      ),
      sedes: this.authService.getSedes().pipe(
        take(1),
        catchError(error => {
          console.error('Error al cargar sedes:', error);
          this.snackBar.open('⚠️ No se pudieron cargar las sedes disponibles. Mostrando opciones limitadas.', 'Cerrar', {
            duration: 5000,
            panelClass: ['snackbar-warning']
          });
          return of({ sedes: [] }); // Retorna estructura con array vacío
        })
      )
    }).subscribe(({ user, sedes }) => {
      // Tu lógica original sigue igual aquí
      this.sedesDisponibles = (sedes.sedes ?? [])
        .map(s => ({
          key: s.key?.trim().toLowerCase() || '',
          nombre: s.nombre?.trim() || '',
          direccion: s.direccion || s.direccion_fiscal || '',
          direccion_fiscal: s.direccion_fiscal || '',
          telefono: s.telefono || s.telefono_contacto || '',
          email: s.email || s.correo_contacto || '',
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

      this.tareaFinalizada(); // forkJoin terminado

      this.loadEmployees();
      this.cargarPacientes();
    });
  }

  private iniciarCarga(): void {
    this.tareasPendientes = 0;
    this.loader.show();
  }

  private tareaIniciada(): void {
    this.tareasPendientes++;
    this.dataIsReady = false;
  }

  private tareaFinalizada(): void {

    this.tareasPendientes--;
    if (this.tareasPendientes <= 0) {
      setTimeout(() => this.loader.hide(), 300); // Delay visual
      this.dataIsReady = true;
    }
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
    this.onMotivoChange([]);
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
    if (this.historiaSeleccionada?.id && this.modoEdicion) {
      this.precargarHistoriaSeleccionada();
    } else {
      this.prepararNuevaHistoria();
    }

    // Usar el método mejorado para abrir modal
    this.abrirModalConFocus(false);

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
        cedula_asesor: '',

        facturacion: {
          tipoProfesional: 'optometrista',
          realizoCompraLentes: false,
          montoTotal: 0,
          pagoOptica: 0,
          pagoMedico: 0
        }
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
        usoDispositivo: '',
        antecedentesPersonales: [],
        antecedentesFamiliares: [],
        patologias: [],
        patologiaOcular: []
      },

      examenOcular: {
        lensometria: {
          esf_od: '', cil_od: '', eje_od: '', add_od: '',
          av_lejos_od: '', av_cerca_od: '', av_lejos_bi: '',
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
          avsc_lejos_od: '',
          avsc_cerca_od: '',
          avae_od: '',
          otros_od: '',

          avsc_lejos_oi: '',
          avsc_cerca_oi: '',
          avae_oi: '',
          otros_oi: ''

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
    const eo = h.examenOcular;
    const dt = h.diagnosticoTratamiento;

    const paciente = this.pacientesFiltrados.find(p => p.key === h.pacienteId);
    this.pacienteParaNuevaHistoria = paciente!;
    this.pacienteSeleccionado = paciente!;

    const cargarYPrecargar = () => {

      this.historiaForm.patchValue({
        paciente: paciente,
        motivo: Array.isArray(dc.motivo) ? dc.motivo : [dc.motivo],
        otroMotivo: dc.otroMotivo,
        medico: dc.medico ?? null,
        tipoCristalActual: dc.tipoCristalActual,
        ultimaGraduacion: dc.fechaUltimaGraduacion,

        // Lensometría
        len_esf_od: eo.lensometria.esf_od,
        len_cil_od: eo.lensometria.cil_od,
        len_eje_od: eo.lensometria.eje_od,
        len_add_od: eo.lensometria.add_od,
        len_av_lejos_od: eo.lensometria.av_lejos_od,
        len_av_cerca_od: eo.lensometria.av_cerca_od,
        len_av_lejos_bi: eo.lensometria.av_lejos_bi,
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

        // AVSC / AVAE / OTROS - VERSIÓN CORREGIDA (LEJOS/CERCA)
        avsc_lejos_od: eo.avsc_avae_otros.avsc_lejos_od,
        avsc_cerca_od: eo.avsc_avae_otros.avsc_cerca_od,
        avae_od: eo.avsc_avae_otros.avae_od,
        otros_od: eo.avsc_avae_otros.otros_od,

        avsc_lejos_oi: eo.avsc_avae_otros.avsc_lejos_oi,
        avsc_cerca_oi: eo.avsc_avae_otros.avsc_cerca_oi,
        avae_oi: eo.avsc_avae_otros.avae_oi,
        otros_oi: eo.avsc_avae_otros.otros_oi,


        // Diagnóstico / Tratamiento
        diagnostico: dt.diagnostico,
        tratamiento: dt.tratamiento
      });

      if (dc.facturacion) {
        this.esOftalmologoSeleccionado = dc.facturacion.tipoProfesional === 'oftalmologo';
        this.esOptometristaSeleccionado = dc.facturacion.tipoProfesional === 'optometrista';
        this.realizoCompraLentes = dc.facturacion.realizoCompraLentes || false;
        this.facturacionData = { ...dc.facturacion };
      } else {
        // Si no hay facturación, resetear
        this.esOftalmologoSeleccionado = false;
        this.esOptometristaSeleccionado = false;
        this.realizoCompraLentes = false;
        this.facturacionData = null;
      }


      this.onMotivoChange(this.historiaForm.value.motivo);

      this.recomendaciones.clear();

      // En el bucle de recomendaciones:
      h.recomendaciones.forEach((r, index) => {
        const grupo = this.crearRecomendacion(r);
        this.recomendaciones.push(grupo);

        // Extraer valor del cristal como string
        const valorCristal = this.obtenerValorCristalComoString(r.cristal);

        // Establecer visibilidad basada en los datos precargados
        const esProgresivo = this.esCristalProgresivo(valorCristal);
        const esMonofocalDigital = this.esMonofocalDigital(valorCristal);
        const mostrarMedidas = esProgresivo || esMonofocalDigital;

        this.mostrarMedidasProgresivo[index] = mostrarMedidas;
        this.mostrarTipoLentesContacto[index] = this.esLentesContacto(valorCristal);
        this.mostrarMaterialPersonalizado[index] = r.material?.includes('OTRO') || false;
      });

      this.formOriginalHistoria = this.historiaForm.value;
    }
    //Solo carga empleados si no están disponibles
    if (!this.medicoTratante || this.medicoTratante.length === 0) {
      this.loadEmployees(cargarYPrecargar);
    } else {
      cargarYPrecargar();
    }
    this.cdr.detectChanges();

  }

  private prepararNuevaHistoria(): void {
    if (this.modoEdicion) return;
    this.historiaForm.reset();
    this.recomendaciones.clear();
    this.agregarRecomendacion();
  }

  guardarHistoria(): void {
    if (this.modoEdicion && this.historiaSeleccionada) {
      this.updateHistoria();
    } else {
      this.crearHistoria();
    }
  }

  private refrescarHistoriaSeleccionada(): void {
    const idActual = this.historiaSeleccionada?.id;
    const pacienteKey = this.pacienteSeleccionado?.key;

    if (!idActual || !pacienteKey) return;

    this.cargando = true;

    this.historiaService.getHistoriasPorPaciente(pacienteKey).subscribe({
      next: (historias: HistoriaMedica[]) => {
        this.historial = historias.sort((a, b) => {
          const fechaA = new Date(a.auditoria?.fechaCreacion || '').getTime();
          const fechaB = new Date(b.auditoria?.fechaCreacion || '').getTime();

          if (fechaA !== fechaB) return fechaB - fechaA;

          const extraerSecuencia = (nHistoria: string): number => {
            const partes = nHistoria?.split('-');
            return partes?.length === 3 ? parseInt(partes[2], 10) : 0;
          };

          return extraerSecuencia(b.nHistoria) - extraerSecuencia(a.nHistoria);
        });

        const historiaActualizada = this.historial.find(h => h.id === idActual);
        this.historiaSeleccionada = historiaActualizada || this.historial[0] || null;

        this.setHoraEvaluacion();
        this.mostrarSinHistorial = this.historial.length === 0;
        this.mostrarElementos = this.historial.length > 0;
        this.cargando = false;
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error al refrescar historia:', error);
        this.snackBar.open(`⚠️ Error al refrescar la historia médica.`, 'Cerrar', {
          duration: 3000,
          panelClass: ['snackbar-warning']
        });
        this.cargando = false;
      }
    });
  }

  // Agrega este método en tu componente
  private formatearFechaParaBackend(fechaInput: any): string {
    // Si está vacío, null o undefined, retornar string vacío
    if (!fechaInput || fechaInput === '' || fechaInput === null || fechaInput === undefined) {
      return '';
    }

    // Si ya es una fecha válida
    if (fechaInput instanceof Date && !isNaN(fechaInput.getTime())) {
      return fechaInput.toISOString().split('T')[0];
    }

    // Si es string, intentar convertirlo
    if (typeof fechaInput === 'string') {
      const fecha = new Date(fechaInput);
      if (!isNaN(fecha.getTime())) {
        return fecha.toISOString().split('T')[0];
      }
    }

    // Si no se puede convertir, retornar vacío
    console.warn('No se pudo formatear la fecha:', fechaInput);
    return '';
  }

  private updateHistoria(): void {
    if (!this.historiaSeleccionada) return;
    this.cargando = true;
    const f = this.historiaForm.value;

    const historiaActualizada: HistoriaMedica = {
      ...this.historiaSeleccionada,
      datosConsulta: {
        motivo: Array.isArray(f.motivo) ? f.motivo : [f.motivo],
        otroMotivo: f.otroMotivo || '',
        tipoCristalActual: f.tipoCristalActual || '',
        fechaUltimaGraduacion: this.formatearFechaParaBackend(f.ultimaGraduacion),
        medico: typeof f.medico === 'object' && f.medico?.cedula
          ? f.medico.cedula
          : typeof f.medico === 'string'
            ? f.medico
            : '',
        facturacion: this.facturacionData
      },
      examenOcular: {
        lensometria: {
          esf_od: f.len_esf_od,
          cil_od: f.len_cil_od,
          eje_od: f.len_eje_od,
          add_od: f.len_add_od,
          av_lejos_od: f.len_av_lejos_od,
          av_cerca_od: f.len_av_cerca_od,
          av_lejos_bi: f.len_av_lejos_bi,
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
          avsc_lejos_od: f.avsc_lejos_od || '',
          avsc_cerca_od: f.avsc_cerca_od || '',
          avae_od: f.avae_od || '',
          otros_od: f.otros_od || '',

          // AVSC Lejos y Cerca para OI
          avsc_lejos_oi: f.avsc_lejos_oi || '',
          avsc_cerca_oi: f.avsc_cerca_oi || '',
          avae_oi: f.avae_oi || '',
          otros_oi: f.otros_oi || ''
        }
      },
      diagnosticoTratamiento: {
        diagnostico: f.diagnostico || '',
        tratamiento: f.tratamiento || ''
      },
      recomendaciones: this.mapRecomendaciones(),
      conformidad: {
        notaConformidad: this.notaConformidad || ''
      }
    };

    // console.log('Payload enviado:', historiaActualizada);

    this.historiaService.updateHistoria(this.historiaSeleccionada.nHistoria, historiaActualizada).subscribe({
      next: (res: any) => {
        const historia = res.historial_medico;

        const historiaAdaptada = {
          ...historia,
          datosConsulta: {
            ...historia.datosConsulta,
            medico: this.medicoSeleccionado?.cedula,
            facturacion: this.facturacionData
          }
        };

        const index = this.historial.findIndex(h => h.id === historiaAdaptada.id);
        if (index !== -1) this.historial[index] = historiaAdaptada;

        this.historiaSeleccionada = historiaAdaptada;
        this.swalService.showSuccess('¡Historia Actualizada!', 'Cambios guardados correctamente');
        $('#historiaModal').modal('hide');
        this.refrescarHistoriaSeleccionada();
        this.cargando = false;
      },

      error: (err) => {
        this.cargando = false;

        if (err.status === 409) {
          this.swalService.showWarning(
            'Conflicto',
            'Ya existe un registro con estos datos'
          );
          return;
        }

        if (err.status === 422 && err.error?.message) {
          this.swalService.showWarning(
            'Validación',
            err.error.message
          );
          return;
        }
      }
    });
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
        facturacion: this.facturacionData || '',
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

        const paciente = this.pacienteParaNuevaHistoria;
        if (!paciente) return;

        this.pacienteSeleccionado = paciente;

        // Recargar y seleccionar directamente la recién creada
        this.cargarHistoriasMedicas(
          paciente.key,
          undefined,
          historiaCreada.id
        );

        this.historiaForm.reset();
        this.modoEdicion = false;
      },
      error: (err) => {
        this.cargando = false;

        // Caso específico: historia duplicada
        if (err.status === 409) {
          this.swalService.showWarning(
            'Historia duplicada',
            'Ya existe una historia idéntica para este paciente'
          );
          return;
        }
      }
    });
  }

  // ***************************
  // * Métodos de pacientes
  // ***************************
  cargarPacientes(): void {
    this.tareaIniciada();
    this.pacientesService.getPacientes().subscribe({
      next: (data) => {
        this.pacientes = Array.isArray(data.pacientes)
          ? data.pacientes.map((p: any): Paciente => {
            const info = p.informacionPersonal;
            const historia = p.historiaClinica;
            const sedePaciente = (p.sedeId ?? '').toString().trim().toLowerCase();

            return {
              key: p.key,
              id: String(p.id),
              fechaRegistro: this.formatearFecha(p.created_at),
              sede: sedePaciente,
              redesSociales: p.redesSociales || [],

              informacionPersonal: {
                esMenorSinCedula: false,
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
                usoDispositivo: historia.usoDispositivo,
                //  tiempoUsoEstimado: historia.tiempoUsoEstimado ?? '',
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

        // 🔍 Precarga si hay idPaciente en la ruta
        let idPaciente: string | null = null;
        let actualRoute: ActivatedRoute | null = this.route;

        while (actualRoute) {
          idPaciente = actualRoute.snapshot.paramMap.get('id');
          if (idPaciente) break;
          actualRoute = actualRoute.firstChild;
        }

        if (idPaciente) {
          const id = idPaciente.split('-')[0];

          // Buscar paciente por su campo "id"
          const paciente = this.pacientes.find(p => p.id === id);

          if (paciente) {
            this.pacienteSeleccionado = paciente;
            this.pacienteIdSeleccionado = paciente.id; // aquí guardas el ID numérico
            this.pacienteParaNuevaHistoria = paciente;

            // Usar la key para cargar historias
            this.cargarHistoriasMedicas(paciente.key);
          } else {
            console.warn('Paciente no encontrado para precarga con ID:', id);
          }
        }
        this.tareaFinalizada();

      },
      error: (err: HttpErrorResponse) => {
        this.pacientes = [];

        // Caso específico: no hay pacientes registrados
        if (err.status === 404) {
          this.swalService.showWarning(
            'Sin registros',
            'No se encontraron pacientes en el sistema'
          );
          return;
        }
        this.tareaFinalizada();
      }
    });
  }

  cargarHistoriasMedicas(
    pacienteId: string,
    callback?: () => void,
    historiaIdSeleccionar?: string
  ): void {
    this.cargando = true;

    this.historiaService.getHistoriasPorPaciente(pacienteId).subscribe({
      next: (historias: HistoriaMedica[]) => {
        this.historial = historias.sort((a, b) => {
          const fechaA = new Date(a.auditoria?.fechaCreacion || '').getTime();
          const fechaB = new Date(b.auditoria?.fechaCreacion || '').getTime();

          if (fechaA !== fechaB) return fechaB - fechaA;

          const extraerSecuencia = (nHistoria: string): number => {
            const partes = nHistoria?.split('-');
            return partes?.length === 3 ? parseInt(partes[2], 10) : 0;
          };

          return extraerSecuencia(b.nHistoria) - extraerSecuencia(a.nHistoria);
        });

        if (historiaIdSeleccionar) {
          const encontrada = this.historial.find(h => h.id === historiaIdSeleccionar);
          this.historiaSeleccionada = encontrada || this.historial[0] || null;
        } else {
          this.historiaSeleccionada = this.historial[0] || null;
        }

        this.setHoraEvaluacion();
        this.mostrarSinHistorial = this.historial.length === 0;
        this.mostrarElementos = this.historial.length > 0;
        this.cargando = false;

        if (callback) callback();
      },
      error: (err: HttpErrorResponse) => {
        this.cargando = false;

        if (err.status === 404) {
          this.snackBar.open(
            '⚠️ No se encontraron historias médicas para este paciente.',
            'Cerrar',
            {
              duration: 3000,
              panelClass: ['snackbar-warning']
            }
          );
          return;
        }
      }

    });
  }

  async seleccionarHistoriasPorPaciente(paciente: Paciente | null): Promise<void> {
    if (!paciente) {
      this.limpiarDatos();
      this.sedePacienteSeleccionado = '';
      return;
    }

    this.pacienteSeleccionado = paciente;
    this.sedePacienteSeleccionado = this.obtenerSedeDesdePaciente(paciente);
    this.cargarHistoriasMedicas(paciente.key); // espera a que se cargue
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
    this.tareaIniciada();

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
      this.tareaFinalizada();
      this.cdr.detectChanges();

      if (callback) callback();
    }, error => {
      console.error('Error al cargar empleados:', error);
      this.snackBar.open(`⚠️ Error, No se pudieron cargar los Médicos.`, 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-warning']
      });

      this.isLoading = false;
      this.tareaFinalizada();
      if (callback) callback();
    });
  }

  onMedicoSeleccionado(medico: any): void {
    this.medicoSeleccionado = medico;

    // Resetear estado
    this.realizoCompraLentes = false;

    // Determinar tipo de profesional
    const medicoAny = medico as any;
    this.esOftalmologoSeleccionado = medicoAny?.cargoId === 'oftalmologo';
    this.esOptometristaSeleccionado = medicoAny?.cargoId === 'optometrista';

    // Si es oftalmólogo, cargar montos del servicio
    if (this.esOftalmologoSeleccionado) {
      const sede = this.sedePacienteSeleccionado || this.sedeActiva;

      this.historiaService.getMontosConsulta(sede, 'oftalmologo').subscribe({
        next: (montos) => {
          const pagoMedico = montos.montoMedico;
          const pagoOptica = montos.montoOptica;
          const montoBase = montos.total; // total ya es medico + optica

          this.facturacionData = {
            tipoProfesional: 'oftalmologo',
            realizoCompraLentes: false,
            montoBase: montoBase,
            montoTotal: montoBase, // Inicialmente igual al base
            pagoOptica: pagoOptica,
            pagoMedico: pagoMedico
          };

          console.log('Montos cargados del API:', montos);
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error cargando montos:', error);
          // Valores por defecto si hay error
          this.facturacionData = {
            tipoProfesional: 'oftalmologo',
            realizoCompraLentes: false,
            montoBase: 40,
            montoTotal: 40,
            pagoOptica: 20,
            pagoMedico: 20
          };
        }
      });
    } else {
      this.facturacionData = null;
    }

    this.cdr.detectChanges();
  }

  onCambioCompraLentes(): void {
    if (this.facturacionData) {
      const pagoMedico = this.facturacionData.pagoMedico;
      const pagoOptica = this.facturacionData.pagoOptica;
      const montoBase = pagoMedico + pagoOptica;

      if (this.realizoCompraLentes) {
        this.facturacionData.montoTotal = pagoMedico;
        this.facturacionData.pagoOptica = 0;
      } else {
        this.facturacionData.montoTotal = montoBase;
        this.facturacionData.pagoOptica = pagoOptica;
      }

      this.facturacionData.montoBase = montoBase;
      this.facturacionData.realizoCompraLentes = this.realizoCompraLentes;

      this.cdr.detectChanges();
    }
  }

  // Método principal de cálculo
  private calcularYActualizarFacturacion(): void {
    this.facturacionData = this.calcularFacturacion(
      this.medicoSeleccionado,
      this.realizoCompraLentes
    );

    // ✅ Forzar actualización de la vista
    this.cdr.detectChanges();
  }


  getNombreMedico(medico: { nombre?: string; cargo?: string } | null | undefined): string {
    if (!medico || !medico.nombre) return 'Médico no registrado';
    return medico.cargo ? `${medico.nombre} (${medico.cargo})` : medico.nombre;
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
      materialPersonalizado: [rec?.materialPersonalizado || ''],
      montura: [rec?.montura || ''],
      observaciones: [rec?.observaciones || ''],

      // Campos para medidas de progresivos (AGREGAR VALORES PRECARGADOS)
      medidaHorizontal: [rec?.medidaHorizontal || ''],
      medidaVertical: [rec?.medidaVertical || ''],
      medidaDiagonal: [rec?.medidaDiagonal || ''],
      medidaPuente: [rec?.medidaPuente || ''],

      // Campo para tipo de lentes de contacto
      tipoLentesContacto: [rec?.tipoLentesContacto || '']
    });
  }

  agregarRecomendacion(): void {
    this.recomendaciones.push(this.crearRecomendacion());

    // Añadir entradas en los arrays de visibilidad
    this.mostrarMedidasProgresivo.push(false);
    this.mostrarTipoLentesContacto.push(false);
    this.mostrarMaterialPersonalizado.push(false);
  }

  eliminarRecomendacion(index: number): void {
    this.recomendaciones.removeAt(index);

    // Remover también los estados de visibilidad
    this.mostrarMedidasProgresivo.splice(index, 1);
    this.mostrarTipoLentesContacto.splice(index, 1);
    this.mostrarMaterialPersonalizado.splice(index, 1);
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
        observaciones: grupo.get('observaciones')?.value || '',
        tipoLentesContacto: grupo.get('tipoLentesContacto')?.value || '',
        medidaHorizontal: grupo.get('medidaHorizontal')?.value || '',
        medidaVertical: grupo.get('medidaVertical')?.value || '',
        medidaDiagonal: grupo.get('medidaDiagonal')?.value || '',
        medidaPuente: grupo.get('medidaPuente')?.value || ''
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
        avsc_lejos_od: f.avsc_lejos_od || '',
        avsc_cerca_od: f.avsc_cerca_od || '',
        avae_od: f.avae_od || '',
        otros_od: f.otros_od || '',

        // AVSC Lejos y Cerca para OI
        avsc_lejos_oi: f.avsc_lejos_oi || '',
        avsc_cerca_oi: f.avsc_cerca_oi || '',
        avae_oi: f.avae_oi || '',
        otros_oi: f.otros_oi || ''
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
      usoDispositivo: f.usoDispositivo ?? false,
      antecedentesPersonales: f.antecedentesPersonales ?? [],
      antecedentesFamiliares: f.antecedentesFamiliares ?? [],
      patologias: f.patologias ?? [],
      patologiaOcular: f.patologiaOcular ?? []
    };
  }

  // Métodos para alternar el estado
  togglePanelSuperior() {
    this.panelSuperiorColapsado = !this.panelSuperiorColapsado;
  }

  togglePanelInferior() {
    this.panelInferiorColapsado = !this.panelInferiorColapsado;
  }

  // ***************************
  // * Métodos de sedes
  // ***************************
  actualizarPacientesPorSede(): void {
    this.limpiarDatos();

    const sedeId = this.sedeFiltro?.trim().toLowerCase();
    this.pacientesFiltradosPorSede = !sedeId
      ? [...this.pacientes]
      : this.pacientes.filter(p => p.sede === sedeId);
  }

  obtenerSedeDesdePaciente(paciente: Paciente): string {
    return paciente?.sede?.toLowerCase() || '';
  }

  // ***************************
  // * Métodos de búsqueda/filtrado
  // ***************************

  actualizarFiltroTexto(event: { term: string; items: any[] }): void {
    this.filtro = event.term;
    this.actualizarPacientesFiltrados();
  }

  logEventoSearch(event: any): void {
    //  console.log('Evento search:', event);
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

  formatearFecha(fechaIso: string | Date): string {
    if (!fechaIso) return 'Fecha inválida';

    const isoString = typeof fechaIso === 'string' ? fechaIso : fechaIso.toISOString();
    if (isoString.includes('/') && !isoString.includes('T')) return isoString;

    const fechaLimpiada = isoString.split('T')[0];
    const [anio, mes, dia] = fechaLimpiada.split('-');
    return `${dia}/${mes}/${anio}`;
  }

  setHoraEvaluacion() {
    const fecha = this.historiaSeleccionada?.auditoria?.fechaCreacion;
    this.horaEvaluacion = fecha
      ? new Intl.DateTimeFormat('es-VE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Caracas'
      }).format(new Date(fecha))
      : 'No registrada';
  }

  parseFechaSinZona(fecha: string | null): Date | null {
    if (!fecha) return null;
    const [año, mes, dia] = fecha.split('T')[0].split('-').map(Number);
    return new Date(año, mes - 1, dia); // Sin zona horaria
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
      otroMotivoControl?.enable(); // ✅ habilita el campo si aplica
    } else {
      otroMotivoControl?.clearValidators();
      otroMotivoControl?.setValue('');
      otroMotivoControl?.disable(); // ✅ deshabilita si no aplica
    }

    otroMotivoControl?.updateValueAndValidity();
  }

  getMotivoVisual(): string {
    const motivo = this.historiaSeleccionada?.datosConsulta?.motivo;
    const otro = this.historiaSeleccionada?.datosConsulta?.otroMotivo;

    if (Array.isArray(motivo)) {
      return motivo.includes('Otro')
        ? otro || 'No especificado'
        : motivo.join(', ');
    }

    return motivo === 'Otro'
      ? otro || 'No especificado'
      : motivo || 'No especificado';
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

    //REINICIAR ESTADOS DE FACTURACIÓN
    this.esOftalmologoSeleccionado = false;
    this.esOptometristaSeleccionado = false;
    this.realizoCompraLentes = false;
    this.facturacionData = null;
    this.medicoSeleccionado = null;

    //REINICIAR ARRAYS DE VISIBILIDAD DE RECOMENDACIONES
    this.mostrarMedidasProgresivo = [false];
    this.mostrarTipoLentesContacto = [false];
    this.mostrarMaterialPersonalizado = [false];

    this.mostrarConfig = false;
    this.facturacionData = null;

    //FORZAR DETECCIÓN DE CAMBIOS
    this.cdr.detectChanges();
  }

  // ***************************
  // * Métodos de validación
  // ***************************

  checkInvalidControls() {
    Object.keys(this.historiaForm.controls).forEach(key => {
      const control = this.historiaForm.get(key);
      if (control?.invalid) {
        /*  console.log(`Campo inválido: ${key}`, {
            value: control.value,
            errors: control.errors
          });*/
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

  getValorFormateado(valor: any): string {
    if (valor === null || valor === undefined || valor === '' || valor === 'null') {
      return '—';
    }

    // Si es un objeto, intenta extraer el valor
    if (typeof valor === 'object' && valor !== null) {
      // Para objetos de formularios reactivos
      if (valor.value !== undefined) {
        return this.formatNumeroOptico(valor.value);
      }
      // Para objetos con propiedad label
      if (valor.label !== undefined) {
        return this.formatNumeroOptico(valor.label);
      }
      // Para otros objetos, mostrar string
      return '—';
    }

    return this.formatNumeroOptico(valor);
  }

  private formatNumeroOptico(valor: any): string {
    if (valor === null || valor === undefined || valor === '') {
      return '—';
    }

    // Convertir a número si es posible
    const numValor = parseFloat(valor);

    if (!isNaN(numValor)) {
      // Formatear números ópticos con signo
      if (numValor > 0) {
        return `+${numValor}`;
      } else if (numValor < 0) {
        return numValor.toString();
      } else {
        return '0.00';
      }
    }

    // Si no es número, devolver el string original
    return valor.toString();
  }

  getValorClass(valor: any): string {
    if (valor === null || valor === undefined || valor === '') {
      return 'empty-cell';
    }

    let numValor: number;

    // Extraer valor numérico de objetos
    if (typeof valor === 'object' && valor !== null) {
      if (valor.value !== undefined) {
        numValor = parseFloat(valor.value);
      } else if (valor.label !== undefined) {
        numValor = parseFloat(valor.label);
      } else {
        return '';
      }
    } else {
      numValor = parseFloat(valor);
    }

    if (isNaN(numValor)) {
      return '';
    }

    // Clases para valores ópticos
    if (numValor > 0) {
      return 'valor-positivo';
    } else if (numValor < 0) {
      return 'valor-negativo';
    } else {
      return 'valor-cero';
    }
  }

  // Función para verificar si hay datos en los exámenes
  tieneDatosExamen(examen: any): boolean {
    if (!examen) return false;

    // Verificar si al menos un campo tiene datos
    const campos = Object.values(examen);
    return campos.some(campo => {
      if (campo === null || campo === undefined || campo === '') {
        return false;
      }

      // Si es objeto, verificar si tiene valores
      if (typeof campo === 'object') {
        return Object.values(campo).some(subCampo =>
          subCampo !== null && subCampo !== undefined && subCampo !== ''
        );
      }

      return true;
    });
  }

  private generarInfoSede(): string {
    const sedeKey = this.sedePacienteSeleccionado || this.sedeActiva;

    // Buscar la sede en las sedes disponibles que ya cargaste
    const sede = this.sedesDisponibles.find(s =>
      s.key?.toLowerCase() === sedeKey?.toLowerCase()
    );

    if (sede) {
      // Usar los datos reales de la sede
      const direccion = sede.direccion_fiscal || 'Dirección no especificada';
      const telefono = sede.telefono || 'Teléfono no disponible';
      const email = sede.email || 'Email no disponible';

      return `
      <div class="contacto-sede">
        <div class="direccion-linea">${direccion}</div>
        <div class="contacto-linea">
          <span class="telefono">${telefono}</span> | 
          <span class="email">${email}</span>
        </div>
      </div>
    `;
    }

    // Fallback si no encuentra la sede
    return `
    <div class="contacto-sede">
      <div class="direccion-linea">Sede no especificada</div>
    </div>
  `;
  }

  private obtenerNombreSede(): string {
    const sedeKey = this.sedePacienteSeleccionado || this.sedeActiva;

    // Buscar la sede en las sedes disponibles
    const sede = this.sedesDisponibles.find(s =>
      s.key?.toLowerCase() === sedeKey?.toLowerCase()
    );

    // Usar el nombre de la sede del servicio
    if (sede?.nombre) {
      return sede.nombre.toUpperCase();
    }

    // Si no hay nombre, usar la key con formato
    if (sedeKey) {
      return `SEDE ${sedeKey.toUpperCase()}`;
    }

    return 'SEDE PRINCIPAL';
  }

  imprimirHistoriaMedica() {
    // Mostrar loading mientras se genera
    this.cargando = true;

    setTimeout(() => {
      try {
        const printContent = this.generarContenidoImpresion();
        const ventana = window.open('', '_blank', 'width=1000,height=700');

        if (ventana) {
          ventana.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Historia Médica - ${this.pacienteSeleccionado?.informacionPersonal?.nombreCompleto || 'Paciente'}</title>
              <meta charset="utf-8">
              <style>
                ${this.obtenerEstilosImpresion()}
              </style>
            </head>
            <body onload="window.print(); window.onafterprint = function() { setTimeout(() => window.close(), 100); }">
              ${printContent}
            </body>
          </html>
        `);
          ventana.document.close();

          // Manejar el cierre de la ventana después de imprimir
          ventana.onbeforeunload = () => {
            this.cargando = false;
          };
        } else {
          this.cargando = false;
          this.swalService.showError('Error', 'No se pudo abrir la ventana de impresión. Verifica los bloqueadores de ventanas emergentes.');
        }
      } catch (error) {
        this.cargando = false;
        console.error('Error al imprimir:', error);
        this.swalService.showError('Error', 'Ocurrió un error al generar la impresión.');
      }
    }, 500);
  }

  private generarContenidoImpresion(): string {
    const fechaActual = new Date().toLocaleDateString('es-ES');
    const horaActual = new Date().toLocaleTimeString('es-ES');

    return `
    <div class="print-container">
      <!-- Encabezado de impresión -->
      </br>
      <div class="print-header">
        <div class="header-institucion">
          <h1>ÓPTICA NEW VISION LENS 2020</h1>
          <div class="info-contacto">
            ${this.generarInfoSede()}
          </div>

          </br>
          <p class="subtitle">Historia Médica</p>
        </div>
        <div class="header-info">
          <p><strong>Fecha de creación:</strong> ${this.formatearFecha(this.historiaSeleccionada?.auditoria?.fechaCreacion)}</p>
          <p><strong>N° Historia:</strong> ${this.historiaSeleccionada?.nHistoria || 'N/A'}</p>
        </div>
      </div>

      <!-- Información del paciente -->
      <div class="seccion-print no-break">
        <div class="seccion-header-print">
          <h2>INFORMACIÓN DEL PACIENTE</h2>
        </div>
        <div class="info-paciente-grid">
          <div class="info-item">
            <label>Nombre completo:</label>
            <span>${this.pacienteSeleccionado?.informacionPersonal?.nombreCompleto || 'No especificado'}</span>
          </div>
          <div class="info-item">
            <label>Cédula de identidad:</label>
            <span>${this.pacienteSeleccionado?.informacionPersonal?.cedula || 'No especificado'}</span>
          </div>
          <div class="info-item">
            <label>Edad:</label>
            <span>${this.calcularEdad(this.pacienteSeleccionado?.informacionPersonal?.fechaNacimiento)} años</span>
          </div>
          <div class="info-item">
            <label>Teléfono:</label>
            <span>${this.pacienteSeleccionado?.informacionPersonal?.telefono || 'No especificado'}</span>
          </div>
          <div class="info-item">
            <label>Ocupación:</label>
            <span>${this.pacienteSeleccionado?.informacionPersonal?.ocupacion || 'No especificado'}</span>
          </div>
          <div class="info-item full-width">
            <label>Dirección:</label>
            <span>${this.pacienteSeleccionado?.informacionPersonal?.direccion || 'No especificado'}</span>
          </div>
          <div class="info-item full-width">
            <label>Motivo de consulta:</label>
            <span>${this.getMotivoVisual()}</span>
          </div>
        </div>
      </div>

      <!-- Historia Clínica -->
      <div class="seccion-print no-break">
        <div class="seccion-header-print">
          <h2>HISTORIA CLÍNICA</h2>
        </div>
        <div class="datos-grid-print">
          <div class="dato-item-print">
            <label>Usa lentes:</label>
            <span>${this.pacienteSeleccionado?.historiaClinica?.usuarioLentes || 'No especificado'}</span>
          </div>
          <div class="dato-item-print">
            <label>Cristal actual:</label>
            <span>${this.historiaSeleccionada?.datosConsulta?.tipoCristalActual || 'No especificado'}</span>
          </div>
          <div class="dato-item-print">
            <label>Última graduación:</label>
            <span>${this.historiaSeleccionada?.datosConsulta?.fechaUltimaGraduacion ? this.formatearFecha(this.historiaSeleccionada.datosConsulta.fechaUltimaGraduacion) : 'No especificado'}</span>
          </div>
          <div class="dato-item-print">
            <label>Fotofobia:</label>
            <span>${this.pacienteSeleccionado?.historiaClinica?.fotofobia || 'No especificado'}</span>
          </div>
          <div class="dato-item-print">
            <label>Alergias:</label>
            <span>${this.pacienteSeleccionado?.historiaClinica?.alergicoA || 'No especificado'}</span>
          </div>
          <div class="dato-item-print">
            <label>Cirugía ocular:</label>
            <span>${this.pacienteSeleccionado?.historiaClinica?.cirugiaOcular || 'No especificado'}</span>
          </div>
          <div class="dato-item-print">
            <label>Tipo de cirugía:</label>
            <span>${this.pacienteSeleccionado?.historiaClinica?.cirugiaOcularDescripcion || 'No especificada'}</span>
          </div>
          <div class="dato-item-print">
            <label>Traumatismo ocular:</label>
            <span>${this.pacienteSeleccionado?.historiaClinica?.traumatismoOcular || 'No especificado'}</span>
          </div>
          <div class="dato-item-print">
            <label>Uso de dispositivos:</label>
            <span>${this.pacienteSeleccionado?.historiaClinica?.usoDispositivo || 'No especificado'}</span>
          </div>
        </div>

          <!-- Antecedentes en filas -->
        <div class="antecedentes-filas">
          <div class="fila-antecedente">
            <label class="label-antecedente">Antecedentes Personales:</label>
            <div class="tags-fila">
              ${(this.pacienteSeleccionado?.historiaClinica?.antecedentesPersonales ?? []).length > 0 ?
        this.pacienteSeleccionado.historiaClinica.antecedentesPersonales.map(ant =>
          `<span class="tag-fila">${ant}</span>`
        ).join('') :
        '<span class="tag-fila empty">No reportados</span>'
      }
            </div>
          </div>

          <div class="fila-antecedente">
            <label class="label-antecedente">Antecedentes Familiares:</label>
            <div class="tags-fila">
              ${(this.pacienteSeleccionado?.historiaClinica?.antecedentesFamiliares ?? []).length > 0 ?
        this.pacienteSeleccionado.historiaClinica.antecedentesFamiliares.map(ant =>
          `<span class="tag-fila">${ant}</span>`
        ).join('') :
        '<span class="tag-fila empty">No reportados</span>'
      }
            </div>
          </div>

          <div class="fila-antecedente">
            <label class="label-antecedente">Patologías Generales:</label>
            <div class="tags-fila">
              ${(this.pacienteSeleccionado?.historiaClinica?.patologias ?? []).length > 0 ?
        this.pacienteSeleccionado.historiaClinica.patologias.map(pat =>
          `<span class="tag-fila">${pat}</span>`
        ).join('') :
        '<span class="tag-fila empty">No reportados</span>'
      }
            </div>
          </div>

          <div class="fila-antecedente">
            <label class="label-antecedente">Patologías Oculares:</label>
            <div class="tags-fila">
              ${(this.pacienteSeleccionado?.historiaClinica?.patologiaOcular ?? []).length > 0 ?
        this.pacienteSeleccionado.historiaClinica.patologiaOcular.map(pat =>
          `<span class="tag-fila">${pat}</span>`
        ).join('') :
        '<span class="tag-fila empty">No reportados</span>'
      }
            </div>
          </div>
        </div>
      </div>

      <!-- Exámenes Oculares -->
      ${this.generarExamenesImpresion()}

      <!-- Diagnóstico y Tratamiento -->
      <div class="seccion-print no-break">
        <div class="seccion-header-print">
          <h2>DIAGNÓSTICO Y TRATAMIENTO</h2>
        </div>
        <div class="diagnostico-grid-print">
          <div class="diagnostico-item-print">
            <label>Diagnóstico:</label>
            <div class="diagnostico-content">
              ${this.historiaSeleccionada?.diagnosticoTratamiento?.diagnostico || 'No especificado'}
            </div>
          </div>
          <div class="diagnostico-item-print">
            <label>Tratamiento:</label>
            <div class="diagnostico-content">
              ${this.historiaSeleccionada?.diagnosticoTratamiento?.tratamiento || 'No especificado'}
            </div>
          </div>
        </div>
      </div>

      <!-- Recomendaciones -->
      ${this.generarRecomendacionesImpresion()}

      <!-- Firmas -->
      <div class="seccion-print no-break">
        <div class="seccion-header-print">
          <h2>FIRMAS Y AUTORIZACIONES</h2>
        </div>
        <div class="firmas-grid-print">
          <div class="firma-item-print">
            <div class="firma-label-print">Firma del Paciente</div>
            <div class="firma-space-print"></div>
            <div class="firma-info-print">
              <div>Nombre: ${this.pacienteSeleccionado?.informacionPersonal?.nombreCompleto}</div>
              <div>C.I: ${this.pacienteSeleccionado?.informacionPersonal?.cedula}</div>
            </div>
          </div>

          <div class="firma-item-print">
            <div class="firma-label-print">Firma del Especialista</div>
            <div class="firma-space-print"></div>
            <div class="firma-info-print">
              <div>${this.historiaSeleccionada?.datosConsulta?.medico?.nombre || 'No disponible'}</div>
              <div>C.I: ${this.historiaSeleccionada?.datosConsulta?.medico?.cedula || 'No disponible'}</div>
              <div>${this.historiaSeleccionada?.datosConsulta?.medico?.cargo || 'No disponible'}</div>
            </div>
          </div>
        </div>

        <div class="asesor-responsable-print">
          <div class="firma-label-print">Asesor Responsable</div>
          <div class="firma-info-print">
            <div>${this.historiaSeleccionada?.auditoria?.creadoPor?.nombre || 'Nombre del asesor'}</div>
            <div>C.I: ${this.historiaSeleccionada?.auditoria?.creadoPor?.cedula || 'Cedula'}</div>
            <div>${this.historiaSeleccionada?.auditoria?.creadoPor?.cargo || 'No disponible'}</div>
          </div>
        </div>
      </div>

      <!-- Pie de página -->
      <div class="print-footer">
        <p>Documento generado automáticamente por Optica New Vision Lens 2020</p>
      </div>
    </div>
  `;
  }

  private generarExamenesImpresion(): string {
    if (!this.historiaSeleccionada?.examenOcular) {
      return '';
    }

    return `
  <div class="seccion-print page-break">
    <div class="seccion-header-print">
      <h2>EXÁMENES OCULARES</h2>
    </div>

    <!-- Lensometría -->
    ${this.historiaSeleccionada.examenOcular.lensometria ? `
    <div class="examen-subseccion-print">
      <h3>Lensometría</h3>
      <table class="tabla-print">
        <thead>
          <tr>
            <th>Ojo</th>
            <th>ESF</th>
            <th>CIL</th>
            <th>EJE</th>
            <th>ADD</th>
            <th>AV Lejos</th>
            <th>AV Lejos BI</th>
            <th>AV Cerca</th>
            <th>AV Cerca BI</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>OD</strong></td>
            <td>${this.getValorFormateado(this.historiaSeleccionada.examenOcular.lensometria.esf_od)}</td>
            <td>${this.getValorFormateado(this.historiaSeleccionada.examenOcular.lensometria.cil_od)}</td>
            <td>${this.historiaSeleccionada.examenOcular.lensometria.eje_od || '—'}</td>
            <td>${this.getValorFormateado(this.historiaSeleccionada.examenOcular.lensometria.add_od)}</td>
            <td>${this.historiaSeleccionada.examenOcular.lensometria.av_lejos_od || '—'}</td>
            <td rowspan="2" class="merged-cell-print">${this.historiaSeleccionada.examenOcular.lensometria.av_lejos_bi || '—'}</td>
            <td>${this.historiaSeleccionada.examenOcular.lensometria.av_cerca_od || '—'}</td>
            <td rowspan="2" class="merged-cell-print">${this.historiaSeleccionada.examenOcular.lensometria.av_cerca_bi || '—'}</td>
          </tr>
          <tr>
            <td><strong>OI</strong></td>
            <td>${this.getValorFormateado(this.historiaSeleccionada.examenOcular.lensometria.esf_oi)}</td>
            <td>${this.getValorFormateado(this.historiaSeleccionada.examenOcular.lensometria.cil_oi)}</td>
            <td>${this.historiaSeleccionada.examenOcular.lensometria.eje_oi || '—'}</td>
            <td>${this.getValorFormateado(this.historiaSeleccionada.examenOcular.lensometria.add_oi)}</td>
            <td>${this.historiaSeleccionada.examenOcular.lensometria.av_lejos_oi || '—'}</td>
            <td>${this.historiaSeleccionada.examenOcular.lensometria.av_cerca_oi || '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- AVSC - AVAE - OTROS (VERSIÓN CORREGIDA CON LEJOS/CERCA) -->
    ${this.historiaSeleccionada.examenOcular.avsc_avae_otros ? `
    <div class="examen-subseccion-print">
      <h3>AVSC - AVAE - OTROS</h3>
      <table class="tabla-print">
        <thead>
          <tr>
            <th>Ojo</th>
            <th>AVSC Lejos</th>
            <th>AVSC Cerca</th>
            <th>AVAE</th>
            <th>OTROS</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>OD</strong></td>
            <td>${this.historiaSeleccionada.examenOcular.avsc_avae_otros.avsc_lejos_od || '—'}</td>
            <td>${this.historiaSeleccionada.examenOcular.avsc_avae_otros.avsc_cerca_od || '—'}</td>
            <td>${this.historiaSeleccionada.examenOcular.avsc_avae_otros.avae_od || '—'}</td>
            <td>${this.historiaSeleccionada.examenOcular.avsc_avae_otros.otros_od || '—'}</td>
          </tr>
          <tr>
            <td><strong>OI</strong></td>
            <td>${this.historiaSeleccionada.examenOcular.avsc_avae_otros.avsc_lejos_oi || '—'}</td>
            <td>${this.historiaSeleccionada.examenOcular.avsc_avae_otros.avsc_cerca_oi || '—'}</td>
            <td>${this.historiaSeleccionada.examenOcular.avsc_avae_otros.avae_oi || '—'}</td>
            <td>${this.historiaSeleccionada.examenOcular.avsc_avae_otros.otros_oi || '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- Hora de evaluación -->
    ${this.horaEvaluacion ? `
    <div class="hora-evaluacion-print">
      <strong>Hora de evaluación:</strong> ${this.horaEvaluacion}
    </div>
    ` : ''}

    <!-- Refracción -->
    ${this.historiaSeleccionada.examenOcular.refraccion ? `
    <div class="examen-subseccion-print">
      <h3>Refracción</h3>
      <table class="tabla-print">
        <thead>
          <tr>
            <th>Ojo</th>
            <th>ESF</th>
            <th>CIL</th>
            <th>EJE</th>
            <th>ADD</th>
            <th>AVCCL</th>
            <th>AVCCL BI</th>
            <th>AVCCC</th>
            <th>AVCCC BI</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>OD</strong></td>
            <td>${this.getValorFormateado(this.historiaSeleccionada.examenOcular.refraccion.esf_od)}</td>
            <td>${this.getValorFormateado(this.historiaSeleccionada.examenOcular.refraccion.cil_od)}</td>
            <td>${this.historiaSeleccionada.examenOcular.refraccion.eje_od || '—'}</td>
            <td>${this.getValorFormateado(this.historiaSeleccionada.examenOcular.refraccion.add_od)}</td>
            <td>${this.historiaSeleccionada.examenOcular.refraccion.avccl_od || '—'}</td>
            <td rowspan="2" class="merged-cell-print">${this.historiaSeleccionada.examenOcular.refraccion.avccl_bi || '—'}</td>
            <td>${this.historiaSeleccionada.examenOcular.refraccion.avccc_od || '—'}</td>
            <td rowspan="2" class="merged-cell-print">${this.historiaSeleccionada.examenOcular.refraccion.avccc_bi || '—'}</td>
          </tr>
          <tr>
            <td><strong>OI</strong></td>
            <td>${this.getValorFormateado(this.historiaSeleccionada.examenOcular.refraccion.esf_oi)}</td>
            <td>${this.getValorFormateado(this.historiaSeleccionada.examenOcular.refraccion.cil_oi)}</td>
            <td>${this.historiaSeleccionada.examenOcular.refraccion.eje_oi || '—'}</td>
            <td>${this.getValorFormateado(this.historiaSeleccionada.examenOcular.refraccion.add_oi)}</td>
            <td>${this.historiaSeleccionada.examenOcular.refraccion.avccl_oi || '—'}</td>
            <td>${this.historiaSeleccionada.examenOcular.refraccion.avccc_oi || '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- Refracción Final -->
    ${this.historiaSeleccionada.examenOcular.refraccionFinal ? `
    <div class="examen-subseccion-print">
      <h3>Refracción Final</h3>
      <table class="tabla-print">
        <thead>
          <tr>
            <th>Ojo</th>
            <th>ESF</th>
            <th>CIL</th>
            <th>EJE</th>
            <th>ADD</th>
            <th>ALT</th>
            <th>DP</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>OD</strong></td>
            <td>${this.getValorFormateado(this.historiaSeleccionada.examenOcular.refraccionFinal.esf_od)}</td>
            <td>${this.getValorFormateado(this.historiaSeleccionada.examenOcular.refraccionFinal.cil_od)}</td>
            <td>${this.historiaSeleccionada.examenOcular.refraccionFinal.eje_od || '—'}</td>
            <td>${this.getValorFormateado(this.historiaSeleccionada.examenOcular.refraccionFinal.add_od)}</td>
            <td>${this.historiaSeleccionada.examenOcular.refraccionFinal.alt_od || '—'}</td>
            <td>${this.historiaSeleccionada.examenOcular.refraccionFinal.dp_od || '—'}</td>
          </tr>
          <tr>
            <td><strong>OI</strong></td>
            <td>${this.getValorFormateado(this.historiaSeleccionada.examenOcular.refraccionFinal.esf_oi)}</td>
            <td>${this.getValorFormateado(this.historiaSeleccionada.examenOcular.refraccionFinal.cil_oi)}</td>
            <td>${this.historiaSeleccionada.examenOcular.refraccionFinal.eje_oi || '—'}</td>
            <td>${this.getValorFormateado(this.historiaSeleccionada.examenOcular.refraccionFinal.add_oi)}</td>
            <td>${this.historiaSeleccionada.examenOcular.refraccionFinal.alt_oi || '—'}</td>
            <td>${this.historiaSeleccionada.examenOcular.refraccionFinal.dp_oi || '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
    ` : ''}
  </div>
`;
  }

  private generarRecomendacionesImpresion(): string {
    if (!this.historiaSeleccionada?.recomendaciones || this.historiaSeleccionada.recomendaciones.length === 0) {
      return '';
    }

    const recomendacionesHTML = this.historiaSeleccionada.recomendaciones.map((rec, index) => {
      // Generar HTML para medidas si existen
      const medidasHTML = (rec.medidaHorizontal || rec.medidaVertical || rec.medidaDiagonal || rec.medidaPuente) ? `
        <div class="recomendacion-field">
          <label>Medidas:</label>
          <div class="medidas-detail">
            ${rec.medidaHorizontal ? `<div>Horizontal: ${rec.medidaHorizontal} cm</div>` : ''}
            ${rec.medidaVertical ? `<div>Vertical: ${rec.medidaVertical} cm</div>` : ''}
            ${rec.medidaDiagonal ? `<div>Diagonal: ${rec.medidaDiagonal} cm</div>` : ''}
            ${rec.medidaPuente ? `<div>Puente: ${rec.medidaPuente} cm</div>` : ''}
          </div>
        </div>
      ` : '';

      // Generar HTML para tipo de lentes de contacto si existe
      const lentesContactoHTML = rec.tipoLentesContacto ? `
        <div class="recomendacion-field">
          <label>Tipo de lentes de contacto:</label>
          <span>${rec.tipoLentesContacto}</span>
        </div>
      ` : '';

      return `
      <div class="recomendacion-item-print">
        <div class="recomendacion-header-print">
          <h4>Lente #${index + 1}</h4>
        </div>
        <div class="recomendacion-content-print">
          <div class="recomendacion-field">
            <label>Tipo de cristal:</label>
            <span>${rec.cristal?.label || 'No especificado'}</span>
          </div>
          ${lentesContactoHTML}
          <div class="recomendacion-field">
            <label>Material:</label>
            <span>${this.getMaterialLabel(rec.material)}</span>
          </div>
          ${medidasHTML}
          <div class="recomendacion-field">
            <label>Montura sugerida:</label>
            <span>${rec.montura || 'No especificada'}</span>
          </div>
          <div class="recomendacion-field full-width">
            <label>Observaciones:</label>
            <span>${rec.observaciones || 'Sin observaciones'}</span>
          </div>
        </div>
      </div>
    `;
    }).join('');

    return `
      <div class="seccion-print no-break">
        <div class="seccion-header-print">
          <h2>RECOMENDACIONES DE LENTES</h2>
        </div>
        ${recomendacionesHTML}
      </div>
    `;
  }

  private obtenerEstilosImpresion(): string {
    return `
    /* Reset para impresión */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12pt;
      line-height: 1.4;
      color: #000;
      margin: 0;
      padding: 15px;
      background: white;
    }
    
    .print-container {
      max-width: 100%;
    }
    
    /* Encabezado */
    .print-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #000;
    }
    
    .header-institucion h1 {
      font-size: 18pt;
      margin-bottom: 5px;
      color: #2c3e50;
    }
    
    .header-institucion .subtitle {
      font-size: 11pt;
      color: #666;
    }
    
    .contacto-sede {
      margin-top: 8px;
      font-size: 9pt;
      line-height: 1.3;
    }

    .direccion-linea {
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 2px;
    }

    .contacto-linea {
      color: #666;
    }

    .contacto-linea .telefono {
      color: #27ae60;
    }

    .contacto-linea .email {
      color: #e74c3c;
    }
    
    .header-info {
      text-align: right;
      font-size: 10pt;
    }
    
    /* Secciones */
    .seccion-print {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }
    
    .seccion-header-print {
      background: #f8f9fa;
      color: #2c3e50;
      padding: 10px 15px;
      margin-bottom: 15px;
      border-left: 4px solid #3498db;
    }
    
    .seccion-header-print h2 {
      font-size: 14pt;
      margin: 0;
      font-weight: bold;
    }
    
    /* Información del paciente */
    .info-paciente-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 10px;
      margin: 15px 0;
    }
    
    .info-item {
      display: flex;
      flex-direction: column;
    }
    
    .info-item.full-width {
      grid-column: 1 / -1;
    }
    
    .info-item label {
      font-weight: bold;
      font-size: 10pt;
      margin-bottom: 3px;
      color: #2c3e50;
    }
    
    .info-item span {
      background: #f8f9fa;
      border: 1px solid #ddd;
      padding: 8px;
      min-height: auto;
      font-size: 10pt;
    }
    
    /* Datos grid */
    .datos-grid-print {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
      margin: 15px 0;
    }
    
    .dato-item-print {
      display: flex;
      flex-direction: column;
    }
    
    .dato-item-print label {
      font-weight: bold;
      font-size: 10pt;
      margin-bottom: 3px;
      color: #2c3e50;
    }
    
    .dato-item-print span {
      background: #f8f9fa;
      border: 1px solid #ddd;
      padding: 8px;
      min-height: auto;
      font-size: 10pt;
    }
    
    /* Antecedentes en filas */
    .antecedentes-filas {
      margin: 15px 0;
    }
    
    .fila-antecedente {
      display: flex;
      align-items: flex-start;
      margin-bottom: 10px;
      page-break-inside: avoid;
    }
    
    .label-antecedente {
      font-weight: bold;
      font-size: 10pt;
      color: #2c3e50;
      min-width: 180px;
      margin-right: 15px;
      margin-top: 3px;
      flex-shrink: 0;
    }
    
    .tags-fila {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      flex: 1;
    }
    
    .tag-fila {
      background: #e9ecef;
      border: 1px solid #ced4da;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 9pt;
      white-space: nowrap;
    }
    
    .tag-fila.empty {
      font-style: italic;
      color: #6c757d;
      background: #f8f9fa;
    }
    
    /* Tablas */
    .tabla-print {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 9pt;
    }
    
    .tabla-print th,
    .tabla-print td {
      border: 1px solid #000;
      padding: 6px;
      text-align: center;
      vertical-align: middle;
    }
    
    .tabla-print th {
      background: #f8f9fa;
      font-weight: bold;
    }
    
    .tabla-print .merged-cell-print {
      background: #e9ecef;
      font-weight: bold;
    }
    
    .tabla-print td:first-child {
      font-weight: bold;
      background: #f8f9fa;
    }
    
    /* Exámenes */
    .examen-subseccion-print {
      margin-bottom: 20px;
    }
    
    .examen-subseccion-print h3 {
      font-size: 12pt;
      margin-bottom: 8px;
      color: #2c3e50;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
    }
    
    .hora-evaluacion-print {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      padding: 8px 12px;
      margin: 10px 0;
      border-radius: 4px;
      font-size: 10pt;
    }
    
    /* Diagnóstico */
    .diagnostico-grid-print {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin: 15px 0;
    }
    
    .diagnostico-item-print label {
      font-weight: bold;
      font-size: 10pt;
      margin-bottom: 5px;
      display: block;
      color: #2c3e50;
    }
    
    .diagnostico-content {
      background: #f8f9fa;
      border: 1px solid #ddd;
      padding: 10px;
      min-height: 60px;
      font-size: 10pt;
    }
    
    /* Recomendaciones */
    .recomendacion-item-print {
      border: 1px solid #ddd;
      padding: 12px;
      margin: 10px 0;
      page-break-inside: avoid;
    }
    
    .recomendacion-header-print h4 {
      font-size: 11pt;
      margin-bottom: 8px;
      color: #2c3e50;
    }
    
    .recomendacion-content-print {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
    }
    
    .recomendacion-field {
      display: flex;
      flex-direction: column;
    }
    
    .recomendacion-field.full-width {
      grid-column: 1 / -1;
    }
    
    .recomendacion-field label {
      font-weight: bold;
      font-size: 9pt;
      margin-bottom: 3px;
      color: #2c3e50;
    }
    
    .recomendacion-field span {
      background: #f8f9fa;
      border: 1px solid #ddd;
      padding: 6px;
      font-size: 9pt;
    }
    
    /* Firmas */
    .firmas-grid-print {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin: 20px 0;
    }
    
    .firma-item-print {
      text-align: center;
    }
    
    .firma-label-print {
      font-weight: bold;
      margin-bottom: 10px;
      font-size: 11pt;
    }
    
    .firma-space-print {
      height: 60px;
      border-bottom: 1px solid #000;
      margin-bottom: 10px;
    }
    
    .firma-info-print {
      font-size: 9pt;
      color: #666;
    }
    
    .firma-info-print div {
      margin-bottom: 2px;
    }
    
    .asesor-responsable-print {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      margin-top: 20px;
    }
    
    /* Pie de página */
    .print-footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
      font-size: 9pt;
      color: #666;
    }
    
    /* Control de saltos de página */
    .page-break {
      page-break-before: always;
    }
    
    .no-break {
      page-break-inside: avoid;
    }
    
    @media print {
      @page {
        margin: 1cm;
        size: A4;
      }
      
      body {
        margin: 0;
        padding: 0;
      }
      
      .print-container {
        padding: 0;
      }
      
      /* Mejorar legibilidad en impresión */
      * {
        -webkit-print-color-adjust: exact;
        color-adjust: exact;
      }
      
      .page-break {
        page-break-before: always;
      }
      
      .no-break {
        page-break-inside: avoid;
      }
    }
  `;
  }


  handleKeydown(event: KeyboardEvent): void {
    // DEBUG

    // Si estamos dentro de un dropdown, NO manejar navegación
    const isInsideDropdown = (event.target as HTMLElement).closest('.ng-dropdown-panel');
    if (isInsideDropdown) {
      return;
    }

    const activeElement = document.activeElement as HTMLElement;
    const isInExamen = activeElement.closest('.lensometria-moderna');

    if (!isInExamen) return;

    // Obtener el control name
    const controlName = this.getControlNameFromElement(activeElement);
    if (!controlName) return;

    // Manejar teclas
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        this.navigateToNextField(controlName);
        break;

      case 'ArrowRight':
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        this.navigateToNextField(controlName);
        break;

      case 'ArrowLeft':
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        this.navigateToPreviousField(controlName);
        break;

      case 'Tab':
        if (event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          this.navigateToPreviousField(controlName);
        } else {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          this.navigateToNextField(controlName);
        }
        break;
    }
  }

  // Método de respaldo para navegación
  private fallbackKeyNavigation(element: HTMLElement, event: KeyboardEvent): void {
    // Intentar navegar usando posición en la página
    const allFocusableElements = Array.from(
      document.querySelectorAll('.lensometria-moderna .ng-select-container, .lensometria-moderna .form-control-small')
    ) as HTMLElement[];

    const currentIndex = allFocusableElements.indexOf(element);

    if (currentIndex === -1) return;

    event.preventDefault();
    event.stopPropagation();

    switch (event.key) {
      case 'Enter':
      case 'ArrowRight':
      case 'Tab':
        if (currentIndex < allFocusableElements.length - 1) {
          allFocusableElements[currentIndex + 1].focus();
        }
        break;

      case 'ArrowLeft':
        if (currentIndex > 0) {
          allFocusableElements[currentIndex - 1].focus();
        }
        break;
    }
  }

  // Método mejorado para obtener controlName
  private getControlNameFromElement(element: HTMLElement): string | null {
    // Caso 1: Input directo
    if (element.getAttribute('formControlName')) {
      return element.getAttribute('formControlName');
    }

    // Caso 2: ng-select container
    if (element.classList.contains('ng-select-container')) {
      const ngSelect = element.closest('.ng-select');
      if (ngSelect) {
        const input = ngSelect.querySelector('[formControlName]');
        if (input) {
          return input.getAttribute('formControlName');
        }
        // Buscar en el ng-select mismo
        const controlName = ngSelect.getAttribute('formControlName');
        if (controlName) return controlName;
      }
    }

    // Caso 3: Buscar en padres
    let parent = element.parentElement;
    while (parent) {
      const controlName = parent.getAttribute('formControlName');
      if (controlName) return controlName;
      parent = parent.parentElement;
    }

    // Caso 4: Buscar por data attributes
    const dataControl = element.closest('[formControlName]');
    if (dataControl) {
      return dataControl.getAttribute('formControlName');
    }

    return null;
  }

  // Método simplificado para focus
  // REEMPLAZA el método focusOnField con este:

  private focusOnField(fieldName: string): void {
    this.isNavigating = true;

    // PRIMERO: Quitar focus del elemento actual
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement.blur) {
      activeElement.blur();
    }

    setTimeout(() => {
      // SEGUNDO: Limpiar todas las clases campo-activo anteriores
      const previousActive = document.querySelectorAll('.campo-activo');
      previousActive.forEach(el => {
        el.classList.remove('campo-activo');
      });

      // TERCERO: Buscar el nuevo elemento de varias maneras
      let element: HTMLElement | null = null;

      // Método 1: Buscar por formControlName directo
      const elementsByName = document.querySelectorAll(`[formControlName="${fieldName}"]`);
      if (elementsByName.length > 0) {
        element = elementsByName[0] as HTMLElement;
      }

      // Método 2: Si es un ng-select, buscar el container
      if (!element) {
        const ngSelects = document.querySelectorAll(`.ng-select[formControlName="${fieldName}"]`);
        if (ngSelects.length > 0) {
          const container = ngSelects[0].querySelector('.ng-select-container') as HTMLElement;
          if (container) {
            element = container;
          }
        }
      }

      // Método 3: Buscar por clase específica
      if (!element) {
        const byClass = document.querySelectorAll(`.campo-select [formControlName="${fieldName}"]`);
        if (byClass.length > 0) {
          element = byClass[0] as HTMLElement;
        }
      }

      if (element) {
        // CUARTO: Aplicar focus con diferentes métodos según el tipo
        if (element.tagName === 'INPUT') {
          // Es un input normal
          element.focus();
          (element as HTMLInputElement).select();
          element.classList.add('campo-activo');

        } else if (element.classList.contains('ng-select-container')) {
          // Es un ng-select container
          element.focus();
          element.classList.add('campo-activo');

          // También marcar el ng-select padre
          const ngSelect = element.closest('.ng-select');
          if (ngSelect) {
            ngSelect.classList.add('campo-activo');
          }

        } else {
          // Otro tipo de elemento
          element.focus();
          element.classList.add('campo-activo');
        }

        // QUINTO: Scroll si es necesario
        this.scrollToElement(element);

      } else {
        console.error('❌ NO se encontró el elemento para:', fieldName);

        // Intentar fallback: buscar por posición
        this.focusByFallback(fieldName);
      }

      this.isNavigating = false;
    }, 50); // Delay para asegurar que el blur anterior se complete
  }

  // Método auxiliar para scroll
  private scrollToElement(element: HTMLElement): void {
    const modalBody = document.querySelector('.modal-body-moderno');
    if (modalBody) {
      const elementRect = element.getBoundingClientRect();
      const modalRect = modalBody.getBoundingClientRect();

      // Si el elemento está fuera de la vista, hacer scroll
      if (elementRect.top < modalRect.top || elementRect.bottom > modalRect.bottom) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  // Método de fallback si no encuentra por nombre
  private focusByFallback(fieldName: string): void {
    // Mapear todos los campos en orden
    const allFields = [
      // Lensometría OD
      'len_esf_od', 'len_cil_od', 'len_eje_od', 'len_add_od',
      'len_av_lejos_od', 'len_av_cerca_od',

      // Lensometría OI
      'len_esf_oi', 'len_cil_oi', 'len_eje_oi', 'len_add_oi',
      'len_av_lejos_oi', 'len_av_cerca_oi',

      // Refracción OD
      'ref_esf_od', 'ref_cil_od', 'ref_eje_od', 'ref_add_od',
      'ref_avccl_od', 'ref_avccc_od',

      // Refracción OI
      'ref_esf_oi', 'ref_cil_oi', 'ref_eje_oi', 'ref_add_oi',
      'ref_avccl_oi', 'ref_avccc_oi',

      // Refracción Final OD
      'ref_final_esf_od', 'ref_final_cil_od', 'ref_final_eje_od', 'ref_final_add_od',
      'ref_final_alt_od', 'ref_final_dp_od',

      // Refracción Final OI
      'ref_final_esf_oi', 'ref_final_cil_oi', 'ref_final_eje_oi', 'ref_final_add_oi',
      'ref_final_alt_oi', 'ref_final_dp_oi',

      // AVSC/AVAE/OTROS OD
      'avsc_od', 'avae_od', 'otros_od',

      // AVSC/AVAE/OTROS OI
      'avsc_oi', 'avae_oi', 'otros_oi'
    ];

    const currentIndex = allFields.indexOf(fieldName);
    if (currentIndex === -1) return;

    // Buscar TODOS los elementos focusables en la página
    const allFocusable = Array.from(
      document.querySelectorAll('.lensometria-moderna .ng-select-container, .lensometria-moderna .form-control-small')
    ) as HTMLElement[];

    if (currentIndex < allFocusable.length) {
      const element = allFocusable[currentIndex];
      element.focus();
      element.classList.add('campo-activo');
    }
  }

  // Inicializar navegación cuando se abre el modal
  abrirModalConFocus(enfocarPrimerCampo: boolean = true): void {
    $('#historiaModal').modal('show');

    setTimeout(() => {
      // Configurar listeners globales
      this.setupGlobalKeyListeners();

      // Poner focus en el primer campo SOLO si se solicita
      if (enfocarPrimerCampo) {
        setTimeout(() => {
          this.focusOnField('len_esf_od');
        }, 300);
      }
    }, 300);
  }

  setupGlobalKeyListeners(): void {
    // Remover listeners anteriores
    document.removeEventListener('keydown', this.boundHandleKeydown);

    // Crear método bound
    this.boundHandleKeydown = this.handleKeydown.bind(this);

    // Agregar listener global
    document.addEventListener('keydown', this.boundHandleKeydown, true); // true para captura

    // También agregar al modal específicamente
    const modal = document.getElementById('historiaModal');
    if (modal) {
      modal.addEventListener('keydown', this.boundHandleKeydown, true);
    }

    // Detectar mouse vs teclado
    document.addEventListener('mousedown', () => {
      document.body.classList.add('using-mouse');
    });

    document.addEventListener('keydown', () => {
      document.body.classList.remove('using-mouse');
    }, { once: true });
  }

  // Agrega esta propiedad a tu clase
  private boundHandleKeydown: any;

  // Métodos para navegación por teclado
  private initializeNavigationMaps(): void {
    // Mapa principal para navegación horizontal (Enter/→)
    this.navigationMap = {
      // Lensometría - Fila OD
      'len_esf_od': 'len_cil_od',
      'len_cil_od': 'len_eje_od',
      'len_eje_od': 'len_add_od',
      'len_add_od': 'len_av_lejos_od',
      'len_av_lejos_od': 'len_av_cerca_od',
      'len_av_cerca_od': 'len_av_lejos_bi',

      // Lensometría - Fila OI (después de binocular OD)
      'len_esf_oi': 'len_cil_oi',
      'len_cil_oi': 'len_eje_oi',
      'len_eje_oi': 'len_add_oi',
      'len_add_oi': 'len_av_lejos_oi',
      'len_av_lejos_oi': 'len_av_cerca_oi',
      'len_av_cerca_oi': 'len_av_cerca_bi',

      // Refracción - Fila OD (después de binocular OI)
      'len_av_cerca_bi': 'ref_esf_od',
      'ref_esf_od': 'ref_cil_od',
      'ref_cil_od': 'ref_eje_od',
      'ref_eje_od': 'ref_add_od',
      'ref_add_od': 'ref_avccl_od',
      'ref_avccl_od': 'ref_avccc_od',
      'ref_avccc_od': 'ref_avccl_bi',
      'ref_avccl_bi': 'ref_avccc_bi',

      // Refracción - Fila OI (después de binocular)
      'ref_avccc_bi': 'ref_esf_oi',
      'ref_esf_oi': 'ref_cil_oi',
      'ref_cil_oi': 'ref_eje_oi',
      'ref_eje_oi': 'ref_add_oi',
      'ref_add_oi': 'ref_avccl_oi',
      'ref_avccl_oi': 'ref_avccc_oi',

      // Refracción Final - Fila OD
      'ref_avccc_oi': 'ref_final_esf_od',
      'ref_final_esf_od': 'ref_final_cil_od',
      'ref_final_cil_od': 'ref_final_eje_od',
      'ref_final_eje_od': 'ref_final_add_od',
      'ref_final_add_od': 'ref_final_alt_od',
      'ref_final_alt_od': 'ref_final_dp_od',

      // Refracción Final - Fila OI
      'ref_final_dp_od': 'ref_final_esf_oi',
      'ref_final_esf_oi': 'ref_final_cil_oi',
      'ref_final_cil_oi': 'ref_final_eje_oi',
      'ref_final_eje_oi': 'ref_final_add_oi',
      'ref_final_add_oi': 'ref_final_alt_oi',
      'ref_final_alt_oi': 'ref_final_dp_oi',

      // AVSC/AVAE/OTROS - Fila OD
      'ref_final_dp_oi': 'avsc_od',
      'avsc_od': 'avae_od',
      'avae_od': 'otros_od',

      // AVSC/AVAE/OTROS - Fila OI
      'otros_od': 'avsc_oi',
      'avsc_oi': 'avae_oi',
      'avae_oi': 'otros_oi',
    };

    // Mapa de filas para navegación vertical (↑/↓)
    this.currentRowMap = {
      'len_esf_od': ['len_esf_od', 'len_cil_od', 'len_eje_od', 'len_add_od', 'len_av_lejos_od', 'len_av_cerca_od'],
      'len_esf_oi': ['len_esf_oi', 'len_cil_oi', 'len_eje_oi', 'len_add_oi', 'len_av_lejos_oi', 'len_av_cerca_oi'],

      'ref_esf_od': ['ref_esf_od', 'ref_cil_od', 'ref_eje_od', 'ref_add_od', 'ref_avccl_od', 'ref_avccc_od'],
      'ref_esf_oi': ['ref_esf_oi', 'ref_cil_oi', 'ref_eje_oi', 'ref_add_oi', 'ref_avccl_oi', 'ref_avccc_oi'],

      'ref_final_esf_od': ['ref_final_esf_od', 'ref_final_cil_od', 'ref_final_eje_od', 'ref_final_add_od', 'ref_final_alt_od', 'ref_final_dp_od'],
      'ref_final_esf_oi': ['ref_final_esf_oi', 'ref_final_cil_oi', 'ref_final_eje_oi', 'ref_final_add_oi', 'ref_final_alt_oi', 'ref_final_dp_oi'],

      'avsc_od': ['avsc_od', 'avae_od', 'otros_od'],
      'avsc_oi': ['avsc_oi', 'avae_oi', 'otros_oi'],
    };

    // Mapa de columnas para navegación entre tablas similares
    this.columnMap = {
      'esfera': ['len_esf_od', 'len_esf_oi', 'ref_esf_od', 'ref_esf_oi', 'ref_final_esf_od', 'ref_final_esf_oi'],
      'cilindro': ['len_cil_od', 'len_cil_oi', 'ref_cil_od', 'ref_cil_oi', 'ref_final_cil_od', 'ref_final_cil_oi'],
      'eje': ['len_eje_od', 'len_eje_oi', 'ref_eje_od', 'ref_eje_oi', 'ref_final_eje_od', 'ref_final_eje_oi'],
      'add': ['len_add_od', 'len_add_oi', 'ref_add_od', 'ref_add_oi', 'ref_final_add_od', 'ref_final_add_oi'],
      'av_lejos': ['len_av_lejos_od', 'len_av_lejos_oi', 'ref_avccl_od', 'ref_avccl_oi'],
      'av_cerca': ['len_av_cerca_od', 'len_av_cerca_oi', 'ref_avccc_od', 'ref_avccc_oi'],
      'avsc': ['avsc_od', 'avsc_oi'],
      'avae': ['avae_od', 'avae_oi'],
      'alt': ['ref_final_alt_od', 'ref_final_alt_oi'],
      'dp': ['ref_final_dp_od', 'ref_final_dp_oi'],
      'otros': ['otros_od', 'otros_oi']
    };
  }

  // Navegar al siguiente campo (Enter/→)
  private navigateToNextField(currentField: string): void {
    this.isNavigating = true;

    const nextField = this.navigationMap[currentField];
    if (nextField) {
      setTimeout(() => {
        this.focusOnField(nextField);
        this.isNavigating = false;
      }, 50);
    } else {
      this.isNavigating = false;
    }
  }

  // Navegar al campo anterior (←)
  private navigateToPreviousField(currentField: string): void {
    this.isNavigating = true;

    // Buscar inversamente en el mapa de navegación
    for (const [fromField, toField] of Object.entries(this.navigationMap)) {
      if (toField === currentField) {
        setTimeout(() => {
          this.focusOnField(fromField);
          this.isNavigating = false;
        }, 50);
        return;
      }
    }

    // Si no se encontró, intentar buscar en la misma fila
    const currentFieldPosition = this.findFieldPosition(currentField);
    if (currentFieldPosition.row && currentFieldPosition.index > 0) {
      const prevInRow = this.currentRowMap[currentFieldPosition.row][currentFieldPosition.index - 1];
      setTimeout(() => {
        this.focusOnField(prevInRow);
        this.isNavigating = false;
      }, 50);
    } else {
      this.isNavigating = false;
    }
  }

  // Navegar hacia abajo (↓)
  private navigateDown(currentField: string): void {
    this.isNavigating = true;

    // Primero intentar navegar verticalmente dentro de la misma tabla
    const currentPosition = this.findFieldPosition(currentField);

    if (currentPosition.row && currentPosition.columnType) {
      // Encontrar el siguiente campo en la misma columna
      const columnFields = this.columnMap[currentPosition.columnType] || [];
      const currentIndex = columnFields.indexOf(currentField);

      if (currentIndex !== -1 && currentIndex < columnFields.length - 1) {
        const nextField = columnFields[currentIndex + 1];
        setTimeout(() => {
          this.focusOnField(nextField);
          this.isNavigating = false;
        }, 50);
        return;
      }
    }

    // Si no hay campo abajo, ir al siguiente en la fila
    this.navigateToNextField(currentField);
  }

  // Navegar hacia arriba (↑)
  private navigateUp(currentField: string): void {
    this.isNavigating = true;

    // Buscar campo arriba en la misma columna
    const currentPosition = this.findFieldPosition(currentField);

    if (currentPosition.columnType) {
      const columnFields = this.columnMap[currentPosition.columnType] || [];
      const currentIndex = columnFields.indexOf(currentField);

      if (currentIndex > 0) {
        const prevField = columnFields[currentIndex - 1];
        setTimeout(() => {
          this.focusOnField(prevField);
          this.isNavigating = false;
        }, 50);
        return;
      }
    }

    // Si no hay campo arriba, ir al anterior en la fila
    this.navigateToPreviousField(currentField);
  }

  // Encontrar la posición del campo en los mapas
  private findFieldPosition(fieldName: string): { row: string | null, columnType: string | null, index: number } {
    // Buscar en qué fila está
    for (const [row, fields] of Object.entries(this.currentRowMap)) {
      const index = fields.indexOf(fieldName);
      if (index !== -1) {
        // Determinar el tipo de columna
        let columnType = null;
        for (const [type, columns] of Object.entries(this.columnMap)) {
          if (columns.includes(fieldName)) {
            columnType = type;
            break;
          }
        }
        return { row, columnType, index };
      }
    }

    return { row: null, columnType: null, index: -1 };
  }

  // Cerrar dropdowns abiertos
  private closeOpenDropdowns(): void {
    const openDropdowns = document.querySelectorAll('.ng-select.ng-select-opened');
    openDropdowns.forEach((dropdown: Element) => {
      const container = dropdown.querySelector('.ng-select-container') as HTMLElement;
      if (container) {
        container.click(); // Clic para cerrar
      }
    });
  }

  // Cerrar dropdowns cuando se hace scroll en el modal
  setupModalScrollListener(): void {
    const modalBody = document.querySelector('#historiaModal .modal-body-moderno');

    if (modalBody) {
      modalBody.addEventListener('scroll', () => {
        this.closeOpenDropdowns();
      });
    }
  }

  fixSelectOverflow(event?: any): void {
    setTimeout(() => {
      // Solo ajustar si es realmente necesario
      const dropdowns = document.querySelectorAll('.ng-dropdown-panel');

      dropdowns.forEach((dropdown: Element) => {
        const panel = dropdown as HTMLElement;

        // Solo intervenir si el dropdown está fuera de la pantalla
        const rect = panel.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Si el dropdown se sale por la parte inferior
        if (rect.bottom > viewportHeight) {
          panel.style.maxHeight = '200px';
          panel.style.overflowY = 'auto';
        }

        // Asegurar z-index muy alto
        panel.style.zIndex = '999999';
      });
    }, 10);
  }

  // Método para iniciar edición con focus
  editarHistoriaConFocus(historia: HistoriaMedica | null): void {
    this.editarHistoria(historia);

    // Agregar delay para que se cargue el formulario
    setTimeout(() => {
      if (this.historiaSeleccionada?.examenOcular) {
        // Buscar el primer campo con datos o el primero vacío
        const firstEmptyField = this.findFirstEmptyField();
        if (firstEmptyField) {
          this.focusOnField(firstEmptyField);
        } else {
          this.focusOnField('len_esf_od');
        }
      }
    }, 500);
  }

  // Encontrar el primer campo vacío para poner focus
  private findFirstEmptyField(): string | null {
    const fieldOrder = [
      // Lensometría
      'len_esf_od', 'len_cil_od', 'len_eje_od', 'len_add_od', 'len_av_lejos_od', 'len_av_cerca_od',
      'len_esf_oi', 'len_cil_oi', 'len_eje_oi', 'len_add_oi', 'len_av_lejos_oi', 'len_av_cerca_oi',

      // Refracción
      'ref_esf_od', 'ref_cil_od', 'ref_eje_od', 'ref_add_od', 'ref_avccl_od', 'ref_avccc_od',
      'ref_esf_oi', 'ref_cil_oi', 'ref_eje_oi', 'ref_add_oi', 'ref_avccl_oi', 'ref_avccc_oi',

      // Refracción Final
      'ref_final_esf_od', 'ref_final_cil_od', 'ref_final_eje_od', 'ref_final_add_od', 'ref_final_alt_od', 'ref_final_dp_od',
      'ref_final_esf_oi', 'ref_final_cil_oi', 'ref_final_eje_oi', 'ref_final_add_oi', 'ref_final_alt_oi', 'ref_final_dp_oi',

      // AVSC/AVAE/OTROS
      'avsc_od', 'avae_od', 'otros_od',
      'avsc_oi', 'avae_oi', 'otros_oi'
    ];

    for (const field of fieldOrder) {
      const value = this.historiaForm.get(field)?.value;
      if (!value || value === '' || value === null || value === undefined) {
        return field;
      }
    }

    return null;
  }

  onModalShown(): void {
    this.initializeNavigationMaps();
    this.setupGlobalKeyListeners();

    setTimeout(() => {
      const modalBody = document.querySelector('#historiaModal .modal-body-moderno');
      if (modalBody) {
        modalBody.scrollTop = 0;
      }
    }, 100);

    // Corregir overflow de selects
    setTimeout(() => {
      this.fixSelectOverflow();
    }, 100);
  }

  // En el método onModalHidden():
  onModalHidden(): void {
    // Limpiar event listeners
    document.removeEventListener('keydown', this.handleKeydown.bind(this));
    window.removeEventListener('resize', this.fixSelectOverflow.bind(this));

    // Limpiar resaltado
    const activeFields = document.querySelectorAll('.campo-activo');
    activeFields.forEach(field => field.classList.remove('campo-activo'));

    // Limpiar clase using-mouse
    document.body.classList.remove('using-mouse');
  }

  onTipoCristalChange(valor: any): void {
    // Si el valor es un objeto (ng-select), extraer el valor
    const tipoCristal = typeof valor === 'object' ? valor?.value : valor;

    // Mostrar/ocultar select de lentes de contacto
    this.mostrarSelectLentesContacto = tipoCristal === 'LENTES_CONTACTO';

    // Si se cambia a otra opción, limpiar el campo de lentes de contacto
    if (!this.mostrarSelectLentesContacto) {
      this.historiaForm.get('tipoLentesContacto')?.setValue(null);
    }

    // Forzar detección de cambios
    this.cdr.detectChanges();
  }

  // Método para manejar cambios en materiales
  verificarMaterialOtro(index: number): void {
    const materialesSeleccionados = this.recomendaciones.at(index).get('material')?.value || [];
    this.mostrarMaterialPersonalizado[index] = materialesSeleccionados.includes('OTRO');

    if (!this.mostrarMaterialPersonalizado[index]) {
      const recomendacionGroup = this.recomendaciones.at(index) as FormGroup;
      recomendacionGroup.get('materialPersonalizado')?.setValue('');
    }
  }

  onCristalChange(event: any, index: number): void {
    // Extraer el valor como string
    const valorString = this.obtenerValorCristalComoString(event);

    // Mostrar medidas para PROGRESIVO o MONOFOCAL_DIGITAL
    const mostrarMedidas = this.requiereMedidas(valorString);

    // Verificar si es LENTES DE CONTACTO
    const esLentesContacto = this.esLentesContacto(valorString);

    // Actualizar visibilidad
    this.mostrarMedidasProgresivo[index] = mostrarMedidas;
    this.mostrarTipoLentesContacto[index] = esLentesContacto;

    // Limpiar campos si cambia de tipo
    const recomendacionGroup = this.recomendaciones.at(index) as FormGroup;

    if (!mostrarMedidas) {
      recomendacionGroup.get('medidaHorizontal')?.setValue('');
      recomendacionGroup.get('medidaVertical')?.setValue('');
      recomendacionGroup.get('medidaDiagonal')?.setValue('');
      recomendacionGroup.get('medidaPuente')?.setValue('');
    }

    if (!esLentesContacto) {
      recomendacionGroup.get('tipoLentesContacto')?.setValue('');
    }

    // Forzar detección de cambios
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 0);
  }

  // Método para verificar si es MONOFOCAL_DIGITAL
  private esMonofocalDigital(valor: string): boolean {
    if (!valor) return false;
    return valor.toUpperCase() === 'MONOFOCAL_DIGITAL';
  }

  // Método auxiliar para obtener el valor como string
  private obtenerValorCristalComoString(cristal: any): string {
    if (!cristal) return '';

    // Si ya es string
    if (typeof cristal === 'string') {
      return cristal;
    }

    // Si es objeto con propiedad value
    if (cristal && typeof cristal === 'object' && 'value' in cristal) {
      return String(cristal.value);
    }

    // Si es objeto sin propiedad value, intentar convertirlo
    return String(cristal);
  }

  // Método para verificar si es progresivo
  private esCristalProgresivo(valor: string): boolean {
    if (!valor) return false;
    return valor.toUpperCase().includes('PROGRESIVO');
  }

  // Método para verificar si es lentes de contacto
  private esLentesContacto(valor: string): boolean {
    if (!valor) return false;
    return valor.toUpperCase() === 'LENTES_CONTACTO';
  }

  // Método para verificar si el cristal requiere medidas
  private requiereMedidas(cristal: any): boolean {
    const valor = this.obtenerValorCristalComoString(cristal);
    const valorUpper = valor.toUpperCase();

    // Lista de tipos que requieren medidas
    const tiposConMedidas = [
      'PROGRESIVO_CONVENCIONAL',
      'PROGRESIVO_DIGITAL_BASICO',
      'PROGRESIVO_DIGITAL_INTERMEDIO',
      'PROGRESIVO_DIGITAL_AMPLIO',
      'MONOFOCAL_DIGITAL'
    ];

    return tiposConMedidas.some(tipo => valorUpper.includes(tipo));
  }

  // Toggle modo configuración
  toggleConfiguracion(): void {
    this.mostrarConfig = !this.mostrarConfig;
  }

  // Calcular pago óptica
  calcularPagoOptica(): number {
    if (!this.facturacionData) return 0;
    return (this.facturacionData.montoBase * this.facturacionData.porcentajeOptica) / 100;
  }

  // Calcular pago médico
  calcularPagoMedico(): number {
    if (!this.facturacionData) return 0;
    return (this.facturacionData.montoBase * this.facturacionData.porcentajeMedico) / 100;
  }

  // Validar que los porcentajes sumen 100
  validarPorcentajes(): void {
    if (!this.facturacionData) return;

    // Asegurar valores entre 0 y 100
    if (this.facturacionData.porcentajeOptica < 0) this.facturacionData.porcentajeOptica = 0;
    if (this.facturacionData.porcentajeOptica > 100) this.facturacionData.porcentajeOptica = 100;
    if (this.facturacionData.porcentajeMedico < 0) this.facturacionData.porcentajeMedico = 0;
    if (this.facturacionData.porcentajeMedico > 100) this.facturacionData.porcentajeMedico = 100;

    // Ajustar automáticamente si se pasa de 100
    if (this.facturacionData.porcentajeOptica + this.facturacionData.porcentajeMedico > 100) {
      this.facturacionData.porcentajeMedico = 100 - this.facturacionData.porcentajeOptica;
    }

    this.recalcularMontos();
  }

  // Calcular pago óptica en consulta sin compra
  calcularPagoOpticaSinCompra(): number {
    if (!this.facturacionData) return 0;
    return Math.round((this.facturacionData.montoBase * this.facturacionData.porcentajeOptica) / 100);
  }

  // Calcular pago médico en consulta sin compra
  calcularPagoMedicoSinCompra(): number {
    if (!this.facturacionData) return 0;
    return Math.round((this.facturacionData.montoBase * this.facturacionData.porcentajeMedico) / 100);
  }

  // Recalcular montos
  recalcularMontos(): void {
    if (!this.facturacionData) return;

    // Asegurar valores mínimos
    if (this.facturacionData.montoBase < 0) this.facturacionData.montoBase = 0;
    if (this.facturacionData.montoCompraLentes < 0) this.facturacionData.montoCompraLentes = 0;

    this.calcularYActualizarFacturacion();
  }



  // Actualizar total cuando cambian los montos
  actualizarTotalSinCompra(): void {
    if (!this.facturacionData) return;
    this.calcularYActualizarFacturacion();
  }

  // Calcular facturación
  private calcularFacturacion(medico: any, realizoCompra: boolean): any {
    if (!medico || medico.cargoId !== 'oftalmologo') {
      return {
        tipoProfesional: 'optometrista',
        realizoCompraLentes: false,
        pagoOpticaBase: 0,
        pagoMedicoBase: 0,
        pagoOptica: 0,
        pagoMedico: 0,
        montoTotal: 0
      };
    }

    // Usar los valores actuales de facturacionData
    const pagoOpticaBase = this.facturacionData?.pagoOpticaBase || 20;
    const pagoMedicoBase = this.facturacionData?.pagoMedicoBase || 20;
    const montoBase = pagoOpticaBase + pagoMedicoBase;

    if (realizoCompra) {
      // Con compra: solo paga el médico
      return {
        tipoProfesional: 'oftalmologo',
        realizoCompraLentes: true,
        montoBase: pagoMedicoBase,
        montoCompraLentes: pagoMedicoBase,
        pagoOpticaBase: pagoOpticaBase,
        pagoMedicoBase: pagoMedicoBase,
        pagoOptica: 0,
        pagoMedico: pagoMedicoBase,
        montoTotal: pagoMedicoBase
      };
    } else {
      // Sin compra: pagan ambos
      return {
        tipoProfesional: 'oftalmologo',
        realizoCompraLentes: false,
        montoBase: montoBase,
        montoCompraLentes: pagoMedicoBase,
        pagoOpticaBase: pagoOpticaBase,
        pagoMedicoBase: pagoMedicoBase,
        pagoOptica: pagoOpticaBase,
        pagoMedico: pagoMedicoBase,
        montoTotal: montoBase
      };
    }
  }

  private obtenerTipoEspecialista(): 'oftalmologo' | 'optometrista' {
    // Usar la propiedad 'cargo' que existe en la interfaz
    const cargo = this.medicoSeleccionado.cargoId?.toLowerCase() || '';

    if (cargo.includes('oftalmologo')) {
      return 'oftalmologo';
    }

    return 'optometrista';
  }

  calcularTotalMontos(): void {
    // Obtener valores crudos primero
    const medicoRaw = this.montosForm.get('montoMedico')?.value;
    const opticaRaw = this.montosForm.get('montoOptica')?.value;

    // Convertir a número
    const medico = Number(medicoRaw) || 0;
    const optica = Number(opticaRaw) || 0;

    // Calcular total
    const total = medico + optica;

    // Actualizar el total
    this.montosForm.get('total')?.setValue(total);

    // Forzar detección de cambios
    this.cdr.detectChanges();
  }

  onInputChange(event: any, campo: 'medico' | 'optica'): void {
    const valor = event.target.value;
    const soloNumeros = valor.replace(/[^0-9]/g, '');
    const numero = soloNumeros ? parseInt(soloNumeros, 10) : 0;

    if (campo === 'medico') {
      this.montoMedico = numero;
    } else {
      this.montoOptica = numero;
    }

    this.calcularTotal();

    // Actualizar el valor del input
    event.target.value = numero;
  }

  parseToNumber(value: any): number {
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    return isNaN(num) ? 0 : num;
  }












  // Prevenir caracteres no numéricos
  onKeyPress(event: KeyboardEvent): void {
    const charCode = event.which ? event.which : event.keyCode;
    // Permitir solo números (0-9) y teclas de control
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      event.preventDefault();
    }
  }

  // Limpiar el valor cuando cambia
  onMontoChange(): void {
    const medicoControl = this.montosForm.get('montoMedico');
    const opticaControl = this.montosForm.get('montoOptica');

    if (medicoControl) {
      const valorLimpio = this.limpiarValor(medicoControl.value);
      medicoControl.setValue(valorLimpio, { emitEvent: false });
    }

    if (opticaControl) {
      const valorLimpio = this.limpiarValor(opticaControl.value);
      opticaControl.setValue(valorLimpio, { emitEvent: false });
    }

    this.calcularTotal();
  }

  // Limpiar valor (eliminar caracteres no numéricos)
  limpiarValor(valor: any): number {
    if (!valor) return 0;
    const soloNumeros = String(valor).replace(/[^0-9]/g, '');
    return soloNumeros ? parseInt(soloNumeros, 10) : 0;
  }

  // Calcular total
  calcularTotal(): void {
    const medico = this.montosForm.get('montoMedico')?.value || 0;
    const optica = this.montosForm.get('montoOptica')?.value || 0;
    const total = Number(medico) + Number(optica);

    this.montosForm.get('total')?.setValue(total);
  }

  abrirModalMontos(): void {
    if (this.facturacionData) {
      this.montosForm.patchValue({
        montoMedico: this.facturacionData.pagoMedico || 20,
        montoOptica: this.facturacionData.pagoOptica || 20
      });
    } else {
      this.montosForm.patchValue({
        montoMedico: 20,
        montoOptica: 20
      });
    }

    this.calcularTotal();

    const modalElement = document.getElementById('modalMontos');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  guardarMontos(): void {
    const medico = Number(this.montosForm.get('montoMedico')?.value) || 0;
    const optica = Number(this.montosForm.get('montoOptica')?.value) || 0;
    const montoBase = medico + optica;
    const compraLentes = this.realizoCompraLentes;

    let pagoOptica = optica;
    let montoTotal = montoBase;

    if (compraLentes) {
      pagoOptica = 0;
      montoTotal = medico;
    }

    this.facturacionData = {
      tipoProfesional: 'oftalmologo',
      realizoCompraLentes: compraLentes,
      montoBase: montoBase,
      montoTotal: montoTotal,
      pagoOptica: pagoOptica,
      pagoMedico: medico
    };

    // Cerrar modal
    const modalElement = document.getElementById('modalMontos');
    if (modalElement) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      modal?.hide();
    }

    this.cdr.detectChanges();
  }

  cancelarMontos(): void {
    this.mostrarModalMontos = false;
    // Restaurar valores originales
    if (this.facturacionData) {
      this.montosForm.patchValue({
        montoMedico: this.facturacionData.pagoMedicoBase || 20,
        montoOptica: this.facturacionData.pagoOpticaBase || 20
      });
      this.calcularTotal();
    }
  }



}