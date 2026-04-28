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
import {
  HistoriaMedica,
  CategoriaProductoRecomendado,
  SeleccionProductosRecomendacion,
  Recomendaciones,
  TipoMaterial,
  Antecedentes,
  ExamenOcular,
  Medico,
  DatosConsulta,
  ProductoRecomendadoHistoria,
  OpcionSelect
} from './historias_medicas-interface';
import { Empleado } from '../../Interfaces/models-interface';
import { Sede, SedeCompleta } from '../../view/login/login-interface';
import { LoaderService } from './../../shared/loader/loader.service';

// Constantes
import {
  OPCIONES_REF,
  OPCIONES_AV,
  MOTIVOS_CONSULTA,
  TIPOS_CRISTALES,
  TIPOS_LENTES_CONTACTO,
  MATERIALES,
} from 'src/app/shared/constants/historias-medicas';

// Servicios
import { HistoriaMedicaService } from '../../core/services/historias-medicas/historias-medicas.service';
import { SwalService } from '../../core/services/swal/swal.service';
import { ModalService } from '../../core/services/modal/modal.service';
import { PacientesService } from '../../core/services/pacientes/pacientes.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { UserStateService } from '../../core/services/userState/user-state-service';
import { EmpleadosService } from './../../core/services/empleados/empleados.service';
import { ProductoService } from '../productos/producto.service';
import { Producto } from '../productos/producto.model';
import { PresupuestoService } from '../ventas/presupuesto/presupuesto.service';
import { OpcionPresupuesto, Presupuesto, ProductoPresupuesto } from '../ventas/presupuesto/presupuesto.interfaz';
import {
  HISTORIA_VENTA_HANDOFF_STORAGE_KEY,
  HistoriaVentaHandoff
} from '../ventas/shared/historia-venta-handoff.util';

interface ProductoRecomendableOption extends Producto {
  disabled: boolean;
}

interface OpcionPresupuestoImportableHistoria {
  nombre: string;
  detalle: string;
  esPrincipal: boolean;
  productos: Producto[];
  observaciones: string;
}


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
  private boundHandleKeydown: any;
  private boundMouseDownHandler: (() => void) | null = null;
  private boundKeyboardModeHandler: (() => void) | null = null;
  private isNavigating = false;
  private navigationRows: string[][] = [];

  // Formulario
  historiaForm: FormGroup;

  // Constantes
  opcionesRef = OPCIONES_REF;
  opcionesAV = OPCIONES_AV;
  ultimaGraduacionOpciones = [
    { key: '3m', label: 'Hace 3 meses' },
    { key: '6m', label: 'Hace 6 meses' },
    { key: '9m', label: 'Hace 9 meses' },
    { key: '1y', label: 'Hace 1 año' },
    { key: '2y+', label: 'Más de 2 años' }
  ];
  motivosConsulta = MOTIVOS_CONSULTA;
  tiposCristales = TIPOS_CRISTALES;
  tiposLentesContacto = TIPOS_LENTES_CONTACTO;
  materiales: typeof MATERIALES;
  materialLabels!: Map<TipoMaterial, string>;
  mostrarSelectLentesContacto: boolean = false;
  productosRecomendables: Producto[] = [];
  opcionesCategoriasRecomendablesCache: OpcionSelect[][][] = [];
  productosCategoriasRecomendablesCache: ProductoRecomendableOption[][][] = [];
  readonly categoriasRecomendablesPreferidas: string[] = ['cristales', 'lentes de contacto', 'monturas', 'liquidos', 'estuches', 'accesorios'];

  // ARRAYS DE VISIBILIDAD PARA RECOMENDACIONES 
  mostrarMedidasProgresivo: boolean[] = [];
  mostrarTipoLentesContacto: boolean[] = [];
  mostrarMaterialPersonalizado: boolean[] = [];
  cargandoPresupuestoPorCedula = false;
  autoAgregarRecomendacionesDesdePresupuesto = false;
  presupuestoImportadoEnHistoriaCodigo: string | null = null;
  recomendacionesImportadasDesdePresupuestoMeta: OpcionPresupuestoImportableHistoria[] = [];
  private readonly controlesNgSelectHistoria: string[] = [
    'medico',
    'tipoCristalActual',
    'tipoLentesContacto',
    'ultimaGraduacion',
    'len_esf_od', 'len_cil_od', 'len_eje_od', 'len_add_od', 'len_av_lejos_od', 'len_av_cerca_od',
    'len_esf_oi', 'len_cil_oi', 'len_eje_oi', 'len_add_oi', 'len_av_lejos_oi', 'len_av_cerca_oi',
    'len_av_lejos_bi', 'len_av_cerca_bi',
    'avsc_lejos_od', 'avsc_cerca_od', 'avae_od',
    'avsc_lejos_oi', 'avsc_cerca_oi', 'avae_oi',
    'ref_esf_od', 'ref_cil_od', 'ref_eje_od', 'ref_add_od', 'ref_avccl_od', 'ref_avccc_od',
    'ref_esf_oi', 'ref_cil_oi', 'ref_eje_oi', 'ref_add_oi', 'ref_avccl_oi', 'ref_avccc_oi',
    'ref_avccl_bi', 'ref_avccc_bi',
    'ref_final_esf_od', 'ref_final_cil_od', 'ref_final_eje_od', 'ref_final_add_od',
    'ref_final_esf_oi', 'ref_final_cil_oi', 'ref_final_eje_oi', 'ref_final_add_oi'
  ];

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
    private productoService: ProductoService,
    private presupuestoService: PresupuestoService,
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
      medico: [null, Validators.required],
      esFormulaExterna: [false],
      medicoReferido: [''],
      lugarConsultorio: [''],
      motivo: [[], Validators.required],
      otroMotivo: [''],
      tipoCristalActual: [null],
      tipoLentesContacto: [null],
      ultimaGraduacion: [null],

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

      // Refracción Final - AGREGAR VALIDADORES REQUIRED
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

      // Diagnóstico y Tratamiento - AGREGAR VALIDADORES REQUIRED
      diagnostico: ['', Validators.required],
      tratamiento: ['', Validators.required],

      // Recomendaciones
      recomendaciones: this.fb.array([this.crearRecomendacion()])
    });

    this.normalizarControlesNgSelectVacios();

    this.mostrarMedidasProgresivo = [false];
    this.mostrarTipoLentesContacto = [false];
    this.mostrarMaterialPersonalizado = [false];
  }

  private normalizarControlesNgSelectVacios(): void {
    this.controlesNgSelectHistoria.forEach((controlName) => {
      const control = this.historiaForm.get(controlName);
      if (!control) return;

      const valor = control.value;
      if (valor === '' || valor === undefined) {
        control.setValue(null, { emitEvent: false });
      }
    });
  }

  private resetearCamposSelectDeHistoria(): void {
    const valores: Record<string, null> = this.controlesNgSelectHistoria.reduce((acc, controlName) => {
      acc[controlName] = null;
      return acc;
    }, {} as Record<string, null>);

    this.historiaForm.patchValue({
      ...valores,
      motivo: []
    }, { emitEvent: false });
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
      ),
      productosResponse: this.productoService.getProductos().pipe(
        take(1),
        catchError(error => {
          console.error('Error al cargar productos para recomendaciones:', error);
          this.snackBar.open('⚠️ No se pudo cargar el catálogo de productos para recomendaciones.', 'Cerrar', {
            duration: 5000,
            panelClass: ['snackbar-warning']
          });
          return of({ iva: 16, productos: [] });
        })
      )
    }).subscribe(({ user, sedes, productosResponse }) => {
      // Tu lógica original sigue igual aquí
      this.sedesDisponibles = (sedes.sedes ?? [])
        .map(s => ({
          key: s.key?.trim().toLowerCase() || '',
          nombre: s.nombre?.trim() || '',
          nombre_optica: s.nombre_optica?.trim() || 'ÓPTICA NEW VISION LENS 2020',
          rif: s.rif?.trim() || '',
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
      this.productosRecomendables = (productosResponse.productos ?? []).filter(producto =>
        producto.activo !== false && (!this.sedeActiva || String(producto.sede || '').trim().toLowerCase() === this.sedeActiva)
      );
      this.refrescarProductosCategoriasRecomendables();

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
    this.resetearImportacionPresupuestoHistoria();
    this.onMotivoChange([]);

    // Resetear arrays de visibilidad a estado inicial
    this.mostrarMedidasProgresivo = [false];
    this.mostrarTipoLentesContacto = [false];
    this.mostrarMaterialPersonalizado = [false];

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
      // Asegurar arrays inicializados para nueva historia
      this.mostrarMedidasProgresivo = [false];
      this.mostrarTipoLentesContacto = [false];
      this.mostrarMaterialPersonalizado = [false];
    }

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
        especialista: {
          tipo: 'EXTERNO', // Valor por defecto, se actualizará al guardar
          externo: {
            nombre: '',
            lugarConsultorio: ''
          }
        },
        formulaExterna: false,
        pagoPendiente: false,
        nombre_asesor: '',
        cedula_asesor: '',
        tipoCristalActual: '',
        tipoLentesContacto: '',
        fechaUltimaGraduacion: ''
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
    this.resetearImportacionPresupuestoHistoria();
    this.historiaForm.reset();

    const h = this.historiaEnEdicion!;
    const dc = h.datosConsulta;
    const eo = h.examenOcular;
    const dt = h.diagnosticoTratamiento;

    const paciente = this.pacientesFiltrados.find(p => p.key === h.pacienteId);
    this.pacienteParaNuevaHistoria = paciente!;
    this.pacienteSeleccionado = paciente!;

    // Determinar el médico a seleccionar basado en la nueva estructura
    let medicoParaSeleccionar = null;
    let esFormulaExterna = dc.formulaExterna || false;
    let medicoReferido = '';
    let lugarConsultorio = '';

    if (dc.especialista) {
      if (dc.especialista.tipo === 'EXTERNO' && dc.especialista.externo) {
        // Médico externo
        medicoParaSeleccionar = this.medicoTratante.find(m => m.id === 'EXTERNO');
        medicoReferido = dc.especialista.externo.nombre || '';
        lugarConsultorio = dc.especialista.externo.lugarConsultorio || '';
      } else if (dc.especialista.tipo !== 'EXTERNO') {
        // Médico interno
        medicoParaSeleccionar = this.medicoTratante.find(m =>
          m.cedula === dc.especialista.cedula
        );

        // Si hay fórmula original, esos son los datos del médico externo referido
        if (dc.formulaOriginal?.medicoOrigen) {
          const origen = dc.formulaOriginal.medicoOrigen;
          medicoReferido = origen.nombre || '';
          lugarConsultorio = origen.lugarConsultorio || '';
          esFormulaExterna = true;
        }
      }
    }

    const cargarYPrecargar = () => {
      this.historiaForm.patchValue({
        paciente: paciente,
        motivo: Array.isArray(dc.motivo) ? dc.motivo : [dc.motivo],
        otroMotivo: dc.otroMotivo,
        medico: medicoParaSeleccionar,
        esFormulaExterna: esFormulaExterna,
        medicoReferido: medicoReferido,
        lugarConsultorio: lugarConsultorio,
        tipoCristalActual: dc.tipoCristalActual || null,
        tipoLentesContacto: dc.tipoLentesContacto || null,
        // Al precargar convertimos la fecha absoluta a la opción de rango
        ultimaGraduacion: this.obtenerOpcionRangoDesdeFecha(dc.fechaUltimaGraduacion) || null,

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

        // AVSC / AVAE / OTROS 
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

      this.mostrarSelectLentesContacto = dc.tipoCristalActual === 'LENTES_CONTACTO';

      this.onMotivoChange(this.historiaForm.value.motivo);

      // Limpiar arrays de visibilidad
      this.mostrarMedidasProgresivo = [];
      this.mostrarTipoLentesContacto = [];
      this.mostrarMaterialPersonalizado = [];

      this.recomendaciones.clear();

      h.recomendaciones.forEach((r, index) => {
        const grupo = this.crearRecomendacion(r);
        this.recomendaciones.push(grupo);
        const valorCristal = this.obtenerValorCristalComoString(this.obtenerCristalRecomendacionInicial(r));

        // Establecer visibilidad basada en los datos precargados
        const esProgresivo = this.esCristalProgresivo(valorCristal);
        const esMonofocalDigital = this.esMonofocalDigital(valorCristal);
        const mostrarMedidas = esProgresivo || esMonofocalDigital;

        this.mostrarMedidasProgresivo[index] = mostrarMedidas;
        this.mostrarTipoLentesContacto[index] = this.esLentesContacto(valorCristal);
        this.mostrarMaterialPersonalizado[index] = this.obtenerMaterialesRecomendacionInicial(r).includes('OTRO');
        this.sincronizarEstadoCategoriasRecomendacion(index);
      });

      this.normalizarControlesNgSelectVacios();
      this.formOriginalHistoria = this.historiaForm.value;
    }

    // Solo carga empleados si no están disponibles
    if (!this.medicoTratante || this.medicoTratante.length === 0) {
      this.loadEmployees(cargarYPrecargar);
    } else {
      cargarYPrecargar();
    }

    this.cdr.detectChanges();
  }

  // Convierte la opción seleccionada del select a una fecha ISO para el backend
  private mapUltimaGraduacionToDate(optionKey: string | null | undefined): string {
    if (!optionKey) return '';
    const ahora = new Date();
    let fecha: Date | null = null;

    switch (optionKey) {
      case '3m':
        fecha = new Date(ahora.getFullYear(), ahora.getMonth() - 3, ahora.getDate());
        break;
      case '6m':
        fecha = new Date(ahora.getFullYear(), ahora.getMonth() - 6, ahora.getDate());
        break;
      case '9m':
        fecha = new Date(ahora.getFullYear(), ahora.getMonth() - 9, ahora.getDate());
        break;
      case '1y':
        fecha = new Date(ahora.getFullYear() - 1, ahora.getMonth(), ahora.getDate());
        break;
      case '2y+':
        // Representamos "más de 2 años" como fecha hace 2 años
        fecha = new Date(ahora.getFullYear() - 2, ahora.getMonth(), ahora.getDate());
        break;
      default:
        fecha = null;
    }

    return fecha ? fecha.toISOString().split('T')[0] : '';
  }

  // Dada una fecha ISO, devuelve la opción de rango más cercana
  private obtenerOpcionRangoDesdeFecha(fechaIso: string | undefined | null): string {
    if (!fechaIso) return '';
    const fecha = new Date(fechaIso);
    if (isNaN(fecha.getTime())) return '';

    const ahora = new Date();
    const diffMs = ahora.getTime() - fecha.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const diffMonths = diffDays / 30;
    const diffYears = diffDays / 365;

    if (diffMonths <= 3) return '3m';
    if (diffMonths <= 6) return '6m';
    if (diffMonths <= 9) return '9m';
    if (diffYears <= 1.5) return '1y';
    return '2y+';
  }

  // Fuerza una pequeña restauración de placeholders en el modal (soluciona casos donde no se renderizan)
  private restaurarPlaceholdersDelModal(): void {
    try {
      const modal = document.getElementById('historiaModal');
      if (!modal) return;
      // Inputs, textareas y selects nativos
      const inputs = Array.from(modal.querySelectorAll('input, textarea, select')) as HTMLElement[];
      inputs.forEach((el) => {
        const placeholder = el.getAttribute('placeholder');
        if (placeholder !== null) {
          el.removeAttribute('placeholder');
          void el.offsetWidth;
          el.setAttribute('placeholder', placeholder);
        }
        // Forzar que el valor nativo sea cadena vacía para que el placeholder aparezca
        try {
          if ((el as HTMLInputElement).tagName === 'INPUT' || (el as HTMLInputElement).tagName === 'TEXTAREA') {
            const inputEl = el as HTMLInputElement;
            if (inputEl.value === null || inputEl.value === undefined) inputEl.value = '';
            // reasignar para forzar repintado
            const tmp = inputEl.value;
            inputEl.value = '';
            void inputEl.offsetWidth;
            inputEl.value = tmp;
            if (tmp === '') { inputEl.value = ''; }
          }
          if ((el as HTMLSelectElement).tagName === 'SELECT') {
            const sel = el as HTMLSelectElement;
            if (sel.selectedIndex < 0) sel.selectedIndex = 0;
            void sel.offsetWidth;
          }
        } catch (e) { /* ignore */ }
      });

      // ng-select (componente) — forzar re-render del placeholder
      const ngSelects = Array.from(modal.querySelectorAll('ng-select')) as HTMLElement[];
      ngSelects.forEach((ng) => {
        const ph = ng.getAttribute('placeholder');
        if (ph !== null) {
          ng.removeAttribute('placeholder');
          void ng.offsetWidth;
          ng.setAttribute('placeholder', ph);
        }
        // Si existe un container interno, también forzar reflow
        const container = ng.querySelector('.ng-select-container') as HTMLElement | null;
        if (container) {
          void container.offsetWidth;
          // Asegurar que el elemento placeholder interno tenga el texto correcto
          const innerPlaceholder = container.querySelector('.ng-placeholder') as HTMLElement | null;
          if (innerPlaceholder) {
            if ((!innerPlaceholder.textContent || innerPlaceholder.textContent.trim() === '') && ph) {
              innerPlaceholder.textContent = ph;
            }
            void innerPlaceholder.offsetWidth;
          }
        }
      });

      // Elementos con clase .ng-select-container sueltos
      const ngContainers = Array.from(modal.querySelectorAll('.ng-select-container')) as HTMLElement[];
      ngContainers.forEach((c) => { void c.offsetWidth; });

      // Forzar detección de cambios para que Angular re-renderice correctamente
      try { this.cdr.detectChanges(); } catch (e) { /* ignore */ }
    } catch (e) {
      // ignore
    }
  }

  private prepararNuevaHistoria(): void {
    if (this.modoEdicion) return;

    const pacienteInicial = this.pacienteSeleccionado ?? this.pacienteParaNuevaHistoria ?? null;

    this.historiaForm.reset();
    this.resetearCamposSelectDeHistoria();
    this.resetearImportacionPresupuestoHistoria();
    this.historiaForm.patchValue({ paciente: pacienteInicial }, { emitEvent: false });
    this.recomendaciones.clear();

    this.pacienteParaNuevaHistoria = pacienteInicial;

    // Agregar una recomendación vacía
    this.agregarRecomendacion();

    // Resetear arrays de visibilidad
    this.mostrarMedidasProgresivo = [false];
    this.mostrarTipoLentesContacto = [false];
    this.mostrarMaterialPersonalizado = [false];

    // Resetear otros estados
    this.mostrarSelectLentesContacto = false;
    this.medicoSeleccionado = null;
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
    const medicoSeleccionado = f.medico;
    const esFormulaExterna = f.esFormulaExterna || false;
    const esMedicoExterno = medicoSeleccionado?.id === 'EXTERNO';

    // Construir objeto especialista
    let especialista: any = {};

    if (esMedicoExterno) {
      especialista = {
        tipo: 'EXTERNO',
        externo: {
          nombre: f.medicoReferido || '',
          lugarConsultorio: f.lugarConsultorio || '',
        }
      };
    } else if (medicoSeleccionado) {
      const esOftalmologo = medicoSeleccionado.cargoId?.toLowerCase() === 'oftalmologo' ||
        medicoSeleccionado.cargo?.toLowerCase() === 'oftalmologo';

      especialista = {
        tipo: esOftalmologo ? 'OFTALMOLOGO' : 'OPTOMETRISTA',
        cedula: medicoSeleccionado.cedula,
        // nombre: medicoSeleccionado.nombre,
        // cargo: medicoSeleccionado.cargoNombre || medicoSeleccionado.cargo
      };
    }

    // Construir fórmula original (mantener la existente o crear nueva si es rectificación)
    let formulaOriginal = this.historiaSeleccionada.datosConsulta?.formulaOriginal || null;

    if (esFormulaExterna && !esMedicoExterno && f.medicoReferido && !formulaOriginal) {
      // Nueva rectificación (antes no había fórmula original)
      formulaOriginal = {
        medicoOrigen: {
          tipo: 'EXTERNO',
          nombre: f.medicoReferido || '',
          lugarConsultorio: f.lugarConsultorio || '',
        }
      };
    }

    const historiaActualizada: any = {
      ...this.historiaSeleccionada,
      datosConsulta: {
        motivo: Array.isArray(f.motivo) ? f.motivo : [f.motivo],
        otroMotivo: f.otroMotivo || '',
        tipoCristalActual: f.tipoCristalActual || '',
        tipoLentesContacto: f.tipoLentesContacto || '',
        fechaUltimaGraduacion: this.mapUltimaGraduacionToDate(f.ultimaGraduacion),

        // Nueva estructura
        especialista: especialista,
        formulaOriginal: formulaOriginal,
        formulaExterna: esFormulaExterna,
        pagoPendiente: this.determinarPagoPendiente(medicoSeleccionado, esFormulaExterna, esMedicoExterno)
      },
      examenOcular: this.mapExamenOcular(),
      diagnosticoTratamiento: {
        diagnostico: f.diagnostico || '',
        tratamiento: f.tratamiento || ''
      },
      recomendaciones: this.mapRecomendaciones(),
      conformidad: {
        notaConformidad: this.notaConformidad || ''
      }
    };

    this.historiaService.updateHistoria(this.historiaSeleccionada.nHistoria, historiaActualizada).subscribe({
      next: (res: any) => {
        const historia = res.historial_medico;

        const index = this.historial.findIndex(h => h.id === historia.id);
        if (index !== -1) this.historial[index] = historia;

        this.historiaSeleccionada = historia;
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

  // Agrega este método en el componente
  getPatologiasProcesadas(): string[] {
    return this.obtenerPatologiasHistoriaActual();
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
    const medicoSeleccionado = formValue.medico;
    const esFormulaExterna = formValue.esFormulaExterna || false;

    // Determinar si el médico seleccionado es externo
    const esMedicoExterno = medicoSeleccionado?.id === 'EXTERNO';

    // Construir objeto especialista
    let especialista: any = {};

    if (esMedicoExterno) {
      // Caso: Médico externo
      especialista = {
        tipo: 'EXTERNO',
        externo: {
          nombre: formValue.medicoReferido || '',
          lugarConsultorio: formValue.lugarConsultorio || '',
        }
      };
    } else if (medicoSeleccionado) {
      // Caso: Médico interno (Oftalmólogo u Optometrista)
      const esOftalmologo = medicoSeleccionado.cargoId?.toLowerCase() === 'oftalmologo' ||
        medicoSeleccionado.cargo?.toLowerCase() === 'oftalmologo';

      especialista = {
        tipo: esOftalmologo ? 'OFTALMOLOGO' : 'OPTOMETRISTA',
        cedula: medicoSeleccionado.cedula,
        //  nombre: medicoSeleccionado.nombre,
        // cargo: medicoSeleccionado.cargoNombre || medicoSeleccionado.cargo
      };
    }

    // Construir fórmula original (solo si es externa y hay médico interno)
    let formulaOriginal = null;
    if (esFormulaExterna && !esMedicoExterno && formValue.medicoReferido) {
      // Es rectificación de fórmula externa
      formulaOriginal = {
        medicoOrigen: {
          tipo: 'EXTERNO',
          nombre: formValue.medicoReferido || '',
          lugarConsultorio: formValue.lugarConsultorio || '',
        }
      };
    }

    const historia: any = {
      pacienteId: this.pacienteParaNuevaHistoria.key,
      datosConsulta: {
        motivo: Array.isArray(formValue.motivo) ? formValue.motivo : [formValue.motivo],
        otroMotivo: formValue.otroMotivo || '',
        tipoCristalActual: formValue.tipoCristalActual,
        tipoLentesContacto: formValue.tipoLentesContacto || '',
        fechaUltimaGraduacion: this.mapUltimaGraduacionToDate(formValue.ultimaGraduacion),

        // NUEVA ESTRUCTURA
        especialista: especialista,
        formulaOriginal: formulaOriginal,
        formulaExterna: esFormulaExterna,
        pagoPendiente: this.determinarPagoPendiente(medicoSeleccionado, esFormulaExterna, esMedicoExterno)
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
        const paciente = this.pacienteParaNuevaHistoria;

        this.cerrarModal('historiaModal');
        this.swalService.showInfo(
          'Historia médica registrada',
          `La historia médica #${historiaCreada.nHistoria ?? 'sin número'} fue registrada correctamente. Seleccione cómo desea continuar con la venta de este paciente.`,
          {
            icon: 'success',
            showDenyButton: !!paciente,
            showCancelButton: !!paciente,
            confirmButtonText: 'Cobrar solo consulta',
            denyButtonText: 'Continuar con consulta y productos',
            cancelButtonText: sessionStorage.getItem('desdePacientes') ? 'Volver a pacientes' : 'Cerrar',
            allowOutsideClick: false
          }
        ).then((result) => {
          if (result.isConfirmed && paciente) {
            this.iniciarGeneracionVentaDesdeHistoria(paciente, historiaCreada, 'solo_consulta');
            return;
          }

          if (result.isDenied && paciente) {
            this.iniciarGeneracionVentaDesdeHistoria(
              paciente,
              historiaCreada,
              'consulta_productos',
              this.autoAgregarRecomendacionesDesdePresupuesto
            );
            return;
          }

          if (sessionStorage.getItem('desdePacientes')) {
            this.limpiarEstadoRetornoPacientes();
            this.router.navigate(['/pacientes']);
          }
        }).catch(() => {});

        if (!paciente) return;

        this.pacienteSeleccionado = paciente;

        // ACTUALIZAR sedePacienteSeleccionado AQUÍ
        this.sedePacienteSeleccionado = this.obtenerSedeDesdePaciente(paciente);

        // Recargar y seleccionar directamente la recién creada
        this.cargarHistoriasMedicas(
          paciente.key,
          () => {
            const historiaEncontrada = this.historial.find(h => h.id === historiaCreada.id);

            if (historiaEncontrada) {
              this.historiaSeleccionada = historiaEncontrada;
            } else if (this.historial.length > 0) {
              this.historiaSeleccionada = this.historial[0];
            }

            // FORZAR DETECCIÓN DE CAMBIOS
            this.cdr.detectChanges();
          },
          historiaCreada.id
        );

        this.historiaForm.reset();
        this.resetearCamposSelectDeHistoria();
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

  private iniciarGeneracionVentaDesdeHistoria(
    paciente: Paciente,
    historia: HistoriaMedica,
    tipoVenta: 'solo_consulta' | 'consulta_productos',
    autoAgregarRecomendaciones: boolean = false
  ): void {
    const handoff: HistoriaVentaHandoff = {
      origen: 'historia-medica',
      pacienteKey: String(paciente.key || ''),
      pacienteId: String(paciente.id || ''),
      historiaId: String(historia.id || ''),
      historiaNumero: String(historia.nHistoria || '').trim() || undefined,
      tipoVenta,
      autoAgregarRecomendaciones: tipoVenta === 'consulta_productos' && autoAgregarRecomendaciones
    };

    try {
      sessionStorage.setItem(HISTORIA_VENTA_HANDOFF_STORAGE_KEY, JSON.stringify(handoff));
    } catch (error) {
      console.error('No se pudo guardar el handoff de historia hacia ventas:', error);
    }

    this.limpiarEstadoRetornoPacientes();
    this.router.navigate(['/ventas'], {
      queryParams: { vista: 'generacion-de-ventas' }
    });
  }

  private limpiarEstadoRetornoPacientes(): void {
    try {
      sessionStorage.removeItem('desdePacientes');
      sessionStorage.removeItem('pacienteParaHistoria');
      sessionStorage.removeItem('pacienteParaHistoriaProcesado');
    } catch (error) {
      console.warn('No se pudo limpiar el estado temporal de pacientes:', error);
    }
  }

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
                patologias: historia.patologias ?? []
              }
            };
          })
          : [];

        this.actualizarPacientesPorSede();
        this.actualizarPacientesFiltrados();

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
            this.pacienteIdSeleccionado = paciente.id;
            this.pacienteParaNuevaHistoria = paciente;

            // Usar la key para cargar historias
            this.cargarHistoriasMedicas(paciente.key);
          } else {
            console.warn('Paciente no encontrado para precarga con ID:', id);
          }
        }
        // Si se abrió desde el módulo de pacientes con un paciente recién creado,
        // precargarlo desde sessionStorage y abrir el modal para crear la historia.
        const vieneDesdePacientes = sessionStorage.getItem('desdePacientes') === '1';
        const pacienteParaHistoriaRaw = sessionStorage.getItem('pacienteParaHistoria');
        const pacienteParaHistoriaProcesado = sessionStorage.getItem('pacienteParaHistoriaProcesado');

        if (vieneDesdePacientes && pacienteParaHistoriaRaw) {
          try {
            const pacienteParsed = JSON.parse(pacienteParaHistoriaRaw);
            const marcadorPaciente = pacienteParsed.key || pacienteParsed.id || pacienteParsed.informacionPersonal?.cedula;

            if (marcadorPaciente && pacienteParaHistoriaProcesado === marcadorPaciente) {
              this.tareaFinalizada();
              return;
            }

            // Buscar por key en la lista cargada
            const encontrado = this.pacientes.find(p => p.key === (pacienteParsed.key || pacienteParsed.id));

            if (encontrado) {
              this.pacienteSeleccionado = encontrado;
              this.pacienteParaNuevaHistoria = encontrado;
              // Asegurar que el formulario tenga al paciente seleccionado
              try {
                this.historiaForm.patchValue({
                  paciente: encontrado,
                  medico: null
                });
                this.resetearCamposSelectDeHistoria();
                this.historiaForm.patchValue({ paciente: encontrado }, { emitEvent: false });
              } catch (e) { /* ignore */ }

              try {
                sessionStorage.setItem('pacienteParaHistoriaProcesado', encontrado.key || encontrado.id);
              } catch (e) { /* ignore */ }

              // Abrir modal para crear historia
              setTimeout(() => {
                this.abrirModalConFocus(false);
                this.cdr.detectChanges();
              }, 300);
            } else {
              // Si no se encuentra por key, intentar emparejar por cédula
              const porCedula = this.pacientes.find(p => p.informacionPersonal?.cedula === pacienteParsed.informacionPersonal?.cedula);
              if (porCedula) {
                this.pacienteSeleccionado = porCedula;
                this.pacienteParaNuevaHistoria = porCedula;
                try {
                  this.historiaForm.patchValue({
                    paciente: porCedula,
                    medico: null
                  });
                  this.resetearCamposSelectDeHistoria();
                  this.historiaForm.patchValue({ paciente: porCedula }, { emitEvent: false });
                } catch (e) {}
                try {
                  sessionStorage.setItem('pacienteParaHistoriaProcesado', porCedula.key || porCedula.id);
                } catch (e) { /* ignore */ }
                setTimeout(() => { this.abrirModalConFocus(false); this.cdr.detectChanges(); }, 300);
              }
            }
          } catch (err) {
            console.warn('Error parseando pacienteParaHistoria:', err);
          }
        } else if (!vieneDesdePacientes && pacienteParaHistoriaRaw) {
          try {
            sessionStorage.removeItem('pacienteParaHistoria');
            sessionStorage.removeItem('pacienteParaHistoriaProcesado');
          } catch (e) { /* ignore */ }
        }

        this.tareaFinalizada();

      },
      error: (err: HttpErrorResponse) => {
        this.pacientes = [];

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
        // Ordenar historias por fecha (más reciente primero)
        this.historial = historias.sort((a, b) => {
          const fechaA = new Date(a.auditoria?.fechaCreacion || a.fecha || '').getTime();
          const fechaB = new Date(b.auditoria?.fechaCreacion || b.fecha || '').getTime();

          if (fechaA !== fechaB) return fechaB - fechaA;

          // Si tienen la misma fecha, ordenar por número de historia
          const extraerSecuencia = (nHistoria: string): number => {
            const partes = nHistoria?.split('-');
            return partes?.length === 3 ? parseInt(partes[2], 10) : 0;
          };

          return extraerSecuencia(b.nHistoria) - extraerSecuencia(a.nHistoria);
        });

        // Seleccionar la historia adecuada
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
        console.error('Error al cargar historias:', err);

        if (err.status === 404) {
          this.snackBar.open(
            '⚠️ No se encontraron historias médicas para este paciente.',
            'Cerrar',
            {
              duration: 3000,
              panelClass: ['snackbar-warning']
            }
          );
          this.historial = [];
          this.historiaSeleccionada = null;
          this.mostrarElementos = false;
          this.mostrarSinHistorial = true;
        }

        if (callback) callback();
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

    this.cargarHistoriasMedicas(paciente.key, () => {
      this.cdr.detectChanges();
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
    this.cargarHistoriasMedicas(id);
  }

  onPacienteSeleccionado(): void {
    const paciente = this.historiaForm.get('paciente')?.value;
    this.pacienteParaNuevaHistoria = paciente;
  }

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

      const medicoExterno = {
        id: 'EXTERNO',
        cedula: 'EXTERNO',
        nombre: '🔷 MÉDICO EXTERNO',
        cargoId: 'externo',
        cargoNombre: 'Médico Externo',
        // Propiedades adicionales para que coincida con la estructura
        email: '',
        telefono: '',
        rolId: '',
        rolNombre: '',
        estatus: true,
        fechaNacimiento: '',
        avatarUrl: '',
        created_at: '',
        updated_at: '',
        editing: false,
        modified: false,
        hasErrors: false,
        errors: null,
        originalValues: null
      };

      this.medicoTratante.push(medicoExterno); // ← Agregar al final

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

  getNombreMedico(medico: { nombre?: string; cargo?: string } | null | undefined): string {
    if (!medico || !medico.nombre) return 'Médico no registrado';
    return medico.cargo ? `${medico.nombre} (${medico.cargo})` : medico.nombre;
  }

  get recomendaciones(): FormArray {
    return this.historiaForm.get('recomendaciones') as FormArray;
  }

  crearRecomendacion(rec?: Recomendaciones): FormGroup {
    const categoriasIniciales = this.obtenerCategoriasIniciales(rec);
    const medidasIniciales = this.obtenerMedidasRecomendacionPersistidas(rec);

    return this.fb.group({
      cristal: [this.obtenerCristalRecomendacionInicial(rec)],
      productoCristal: [this.obtenerProductoCristalInicial(rec)],
      material: [this.obtenerMaterialesRecomendacionInicial(rec)],
      materialPersonalizado: [this.obtenerMaterialPersonalizadoInicial(rec)],
      montura: [this.obtenerMonturaRecomendacionInicial(rec)],
      productoMontura: [this.obtenerProductoMonturaInicial(rec)],
      observaciones: [rec?.observaciones || ''],

      medidaHorizontal: [medidasIniciales?.horizontal || ''],
      medidaVertical: [medidasIniciales?.vertical || ''],
      medidaDiagonal: [medidasIniciales?.diagonal || ''],
      medidaPuente: [medidasIniciales?.puente || ''],

      tipoLentesContacto: [this.obtenerTipoLentesContactoRecomendacionInicial(rec)],
      categorias: this.fb.array(categoriasIniciales.map(categoria => this.crearCategoriaRecomendada(categoria)))
    });
  }

  getCategoriasRecomendadas(index: number): FormArray {
    return (this.recomendaciones.at(index) as FormGroup).get('categorias') as FormArray;
  }

  crearCategoriaRecomendada(categoria?: CategoriaProductoRecomendado): FormGroup {
    return this.fb.group({
      categoria: [String(categoria?.categoria || '').trim().toLowerCase() || null, Validators.required],
      producto: [categoria?.producto || null]
    });
  }

  agregarRecomendacion(): void {
    this.recomendaciones.push(this.crearRecomendacion());
    this.recomendacionesImportadasDesdePresupuestoMeta.push({
      nombre: '',
      detalle: '',
      esPrincipal: false,
      productos: [],
      observaciones: ''
    });

    // Añadir entradas en los arrays de visibilidad
    this.mostrarMedidasProgresivo.push(false);
    this.mostrarTipoLentesContacto.push(false);
    this.mostrarMaterialPersonalizado.push(false);

    this.sincronizarEstadoCategoriasRecomendacion(this.recomendaciones.length - 1);
    this.refrescarOpcionesCategoriasRecomendables(this.recomendaciones.length - 1);
    this.refrescarProductosCategoriasRecomendables(this.recomendaciones.length - 1);

    // Forzar detección de cambios
    this.cdr.detectChanges();
  }

  private resetearImportacionPresupuestoHistoria(): void {
    this.autoAgregarRecomendacionesDesdePresupuesto = false;
    this.presupuestoImportadoEnHistoriaCodigo = null;
    this.recomendacionesImportadasDesdePresupuestoMeta = [];
  }

  puedeImportarPresupuestoPorCedula(): boolean {
    return !!this.obtenerCedulaPacienteParaPresupuesto();
  }

  importarRecomendacionesDesdePresupuestoPorCedula(): void {
    const cedula = this.obtenerCedulaPacienteParaPresupuesto();
    if (!cedula) {
      this.snackBar.open('Seleccione un paciente con cédula para buscar su presupuesto.', 'Cerrar', {
        duration: 4000,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    this.cargandoPresupuestoPorCedula = true;

    this.presupuestoService.getPresupuestos().subscribe({
      next: async (presupuestos) => {
        this.cargandoPresupuestoPorCedula = false;

        const presupuestosPorCedula = this.filtrarPresupuestosPorCedula(presupuestos, cedula);
        if (presupuestosPorCedula.length === 0) {
          this.snackBar.open('No se encontraron presupuestos para la cédula del paciente.', 'Cerrar', {
            duration: 4500,
            panelClass: ['snackbar-warning']
          });
          return;
        }

        const presupuestoSeleccionado = await this.resolverPresupuestoParaImportacion(presupuestosPorCedula);
        if (!presupuestoSeleccionado) {
          return;
        }

        const opcionesImportables = this.extraerOpcionesPresupuestoImportables(presupuestoSeleccionado);
        const totalProductosImportables = opcionesImportables.reduce((total, opcion) => total + opcion.productos.length, 0);

        if (opcionesImportables.length === 0) {
          this.snackBar.open(
            `Se encontró el presupuesto ${presupuestoSeleccionado.codigo}, pero no hay productos disponibles en inventario para importarlo.`,
            'Cerrar',
            {
              duration: 5500,
              panelClass: ['snackbar-warning']
            }
          );
          return;
        }

        this.aplicarContextoFormulaExternaDesdePresupuesto(presupuestoSeleccionado);
        this.aplicarOpcionesPresupuestoEnRecomendaciones(presupuestoSeleccionado, opcionesImportables);

        this.snackBar.open(
          `Presupuesto ${presupuestoSeleccionado.codigo} importado: ${opcionesImportables.length} opción(es) convertidas en recomendaciones con ${totalProductosImportables} producto(s) en total.`,
          'Cerrar',
          {
            duration: 5500,
            panelClass: ['snackbar-success']
          }
        );
      },
      error: () => {
        this.cargandoPresupuestoPorCedula = false;
        this.snackBar.open('No se pudieron consultar los presupuestos por cédula.', 'Cerrar', {
          duration: 4500,
          panelClass: ['snackbar-error']
        });
      }
    });
  }

  private async resolverPresupuestoParaImportacion(presupuestos: Presupuesto[]): Promise<Presupuesto | null> {
    const ordenados = [...presupuestos].sort((a, b) => {
      const aArchivado = String(a?.estado || '').trim().toLowerCase() === 'archivado';
      const bArchivado = String(b?.estado || '').trim().toLowerCase() === 'archivado';

      if (aArchivado !== bArchivado) {
        return Number(aArchivado) - Number(bArchivado);
      }

      return this.obtenerTimestampPresupuesto(b) - this.obtenerTimestampPresupuesto(a);
    });

    if (ordenados.length === 1) {
      return ordenados[0];
    }

    const inputOptions = ordenados.reduce((acc, presupuesto, index) => {
      acc[String(index)] = this.getEtiquetaPresupuestoParaSelector(presupuesto);
      return acc;
    }, {} as Record<string, string>);

    const seleccion = await this.swalService.showInfo(
      'Seleccionar presupuesto',
      `Se encontraron ${ordenados.length} presupuestos para esta cédula. Elija cuál desea cargar en recomendaciones.`,
      {
        customClass: {
          actions: 'swal-modern-actions swal-modern-actions--presupuesto-select'
        },
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        confirmButtonText: 'Cargar presupuesto',
        input: 'select',
        inputOptions,
        inputValue: '0',
        inputPlaceholder: 'Seleccione un presupuesto',
        allowOutsideClick: false
      }
    );

    if (!seleccion?.isConfirmed) {
      this.snackBar.open('Importación de presupuesto cancelada.', 'Cerrar', {
        duration: 2500,
        panelClass: ['snackbar-info']
      });
      return null;
    }

    const indexSeleccionado = Number(seleccion.value);
    if (!Number.isFinite(indexSeleccionado) || !ordenados[indexSeleccionado]) {
      return ordenados[0];
    }

    return ordenados[indexSeleccionado];
  }

  private getEtiquetaPresupuestoParaSelector(presupuesto: Presupuesto): string {
    const codigo = String(presupuesto?.codigo || 'Sin codigo').trim();
    const fecha = this.getFechaPresupuestoParaSelector(presupuesto);
    const estado = this.getEstadoPresupuestoParaSelector(presupuesto);
    const total = this.getTotalPresupuestoParaSelector(presupuesto);
    const opciones = this.getCantidadOpcionesPresupuestoParaImportacion(presupuesto);

    return `${codigo} · ${fecha} · ${estado} · ${total} · ${opciones} opción(es)`;
  }

  private getFechaPresupuestoParaSelector(presupuesto: Presupuesto): string {
    const fechaRaw = (presupuesto as any)?.fechaCreacion || (presupuesto as any)?.created_at;
    if (!fechaRaw) {
      return 'Sin fecha';
    }

    return this.formatearFecha(fechaRaw as string);
  }

  private getEstadoPresupuestoParaSelector(presupuesto: Presupuesto): string {
    const estado = String((presupuesto as any)?.estadoColor || presupuesto?.estado || '').trim().toLowerCase();
    const mapaEstados: Record<string, string> = {
      vigente: 'Vigente',
      proximo: 'Proximo a vencer',
      hoy: 'Vence hoy',
      vencido: 'Vencido',
      archivado: 'Archivado',
      anulado: 'Anulado',
      convertido: 'Convertido'
    };

    return mapaEstados[estado] || 'Estado no definido';
  }

  private getTotalPresupuestoParaSelector(presupuesto: Presupuesto): string {
    const total = Number((presupuesto as any)?.total || 0);
    return `Total: ${total.toFixed(2)}`;
  }

  private obtenerCedulaPacienteParaPresupuesto(): string {
    const pacienteFormulario = this.historiaForm.get('paciente')?.value;
    const cedula = pacienteFormulario?.informacionPersonal?.cedula
      || this.pacienteParaNuevaHistoria?.informacionPersonal?.cedula
      || this.pacienteSeleccionado?.informacionPersonal?.cedula
      || '';

    return String(cedula || '').trim();
  }

  private filtrarPresupuestosPorCedula(presupuestos: Presupuesto[], cedula: string): Presupuesto[] {
    const cedulaObjetivo = this.normalizarTextoBusquedaPresupuesto(cedula);
    if (!cedulaObjetivo) {
      return [];
    }

    return (presupuestos || []).filter((presupuesto) => {
      const cedulaPresupuesto = this.normalizarTextoBusquedaPresupuesto(presupuesto?.cliente?.cedula);
      return !!cedulaPresupuesto && cedulaPresupuesto === cedulaObjetivo;
    });
  }

  private obtenerTimestampPresupuesto(presupuesto: Presupuesto | null | undefined): number {
    const fechaRaw = (presupuesto as any)?.fechaCreacion || (presupuesto as any)?.created_at || '';
    const timestamp = new Date(fechaRaw).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  private mapearLineasPresupuestoAProductosRecomendables(lineas: ProductoPresupuesto[]): Producto[] {
    const productosMapeados: Producto[] = [];
    const idsAgregados = new Set<string>();

    lineas.forEach((linea) => {
      if (this.esLineaConsultaPresupuesto(linea)) {
        return;
      }

      const productoEncontrado = this.buscarProductoRecomendableDesdeLineaPresupuesto(linea);
      const productoId = String(productoEncontrado?.id || '').trim();

      if (!productoEncontrado || !productoId || idsAgregados.has(productoId)) {
        return;
      }

      idsAgregados.add(productoId);
      productosMapeados.push(productoEncontrado);
    });

    return productosMapeados;
  }

  private getCantidadOpcionesPresupuestoParaImportacion(presupuesto: Presupuesto | null | undefined): number {
    return this.obtenerOpcionesPresupuestoParaHistoria(presupuesto).length;
  }

  private obtenerOpcionesPresupuestoParaHistoria(presupuesto: Presupuesto | null | undefined): OpcionPresupuesto[] {
    if (Array.isArray(presupuesto?.opciones) && presupuesto.opciones.length > 0) {
      const opcionPrincipalId = String(presupuesto?.opcionPrincipalId || '').trim();

      return presupuesto.opciones.map((opcion, index) => ({
        ...opcion,
        id: String(opcion?.id || `opcion-${index + 1}`),
        nombre: String(opcion?.nombre || `Opción ${index + 1}`).trim(),
        productos: Array.isArray(opcion?.productos) ? opcion.productos : [],
        esPrincipal: opcionPrincipalId ? opcion.id === opcionPrincipalId : Boolean(opcion?.esPrincipal)
      }));
    }

    return [{
      id: String(presupuesto?.opcionPrincipalId || 'opcion-1'),
      nombre: 'Opción 1',
      productos: Array.isArray(presupuesto?.productos) ? presupuesto.productos : [],
      subtotal: Number(presupuesto?.subtotal || 0),
      descuentoTotal: Number(presupuesto?.descuentoTotal || 0),
      iva: Number(presupuesto?.iva || 0),
      total: Number(presupuesto?.total || 0),
      observaciones: String(presupuesto?.observaciones || ''),
      esPrincipal: true
    }];
  }

  private extraerOpcionesPresupuestoImportables(presupuesto: Presupuesto): OpcionPresupuestoImportableHistoria[] {
    return this.obtenerOpcionesPresupuestoParaHistoria(presupuesto)
      .map((opcion, index) => {
        const productos = this.mapearLineasPresupuestoAProductosRecomendables(Array.isArray(opcion?.productos) ? opcion.productos : []);

        return {
          nombre: String(opcion?.nombre || `Opción ${index + 1}`).trim(),
          detalle: `${productos.length} producto(s)${opcion?.esPrincipal ? ' · Principal' : ''}`,
          esPrincipal: Boolean(opcion?.esPrincipal),
          productos,
          observaciones: String(opcion?.observaciones || '').trim()
        };
      })
      .filter((opcion) => opcion.productos.length > 0);
  }

  private esLineaConsultaPresupuesto(linea: ProductoPresupuesto | null | undefined): boolean {
    const codigo = String((linea as any)?.codigo || '').trim().toUpperCase();
    const descripcion = String((linea as any)?.descripcion || '').trim().toLowerCase();

    return codigo === 'CONSULTA-MEDICA' || descripcion.includes('consulta medica');
  }

  private buscarProductoRecomendableDesdeLineaPresupuesto(linea: ProductoPresupuesto): Producto | null {
    const idLinea = String((linea as any)?.id || '').trim();
    const codigoLinea = this.normalizarTextoBusquedaPresupuesto((linea as any)?.codigo);
    const descripcionLinea = this.normalizarTextoBusquedaPresupuesto((linea as any)?.descripcion);

    if (idLinea) {
      const porId = this.productosRecomendables.find((producto) => String(producto.id || '').trim() === idLinea);
      if (porId) {
        return porId;
      }
    }

    if (codigoLinea) {
      const porCodigo = this.productosRecomendables.find((producto) =>
        this.normalizarTextoBusquedaPresupuesto(producto.codigo) === codigoLinea
      );
      if (porCodigo) {
        return porCodigo;
      }
    }

    if (!descripcionLinea) {
      return null;
    }

    return this.productosRecomendables.find((producto) => {
      const nombreNormalizado = this.normalizarTextoBusquedaPresupuesto(producto.nombre);
      const descripcionNormalizada = this.normalizarTextoBusquedaPresupuesto(producto.descripcion);

      return nombreNormalizado === descripcionLinea
        || descripcionNormalizada === descripcionLinea
        || descripcionLinea.includes(nombreNormalizado)
        || nombreNormalizado.includes(descripcionLinea);
    }) || null;
  }

  private normalizarTextoBusquedaPresupuesto(valor: unknown): string {
    return String(valor || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private aplicarContextoFormulaExternaDesdePresupuesto(presupuesto: Presupuesto): void {
    const medicoExterno = this.medicoTratanteConExterno.find((medico) => medico.id === 'EXTERNO') || {
      id: 'EXTERNO',
      nombre: '🔷 MÉDICO EXTERNO',
      cedula: 'EXTERNO',
      cargoId: 'externo',
      cargoNombre: 'Médico Externo'
    };
    const medicoReferidoActual = String(this.historiaForm.get('medicoReferido')?.value || '');
    const lugarConsultorioActual = String(this.historiaForm.get('lugarConsultorio')?.value || '');

    this.historiaForm.patchValue({ medico: medicoExterno }, { emitEvent: false });
    this.onMedicoChange(medicoExterno);

    this.historiaForm.patchValue({
      esFormulaExterna: true,
      medicoReferido: medicoReferidoActual,
      lugarConsultorio: lugarConsultorioActual
    }, { emitEvent: false });

    // Precargar refracción final si existe en el presupuesto
    if (presupuesto.formulaExterna && typeof presupuesto.formulaExterna === 'object' && presupuesto.formulaExterna.refraccionFinal) {
      const refraccionFinal = presupuesto.formulaExterna.refraccionFinal;
      this.historiaForm.patchValue({
        ref_final_esf_od: refraccionFinal?.od?.esfera ?? null,
        ref_final_cil_od: refraccionFinal?.od?.cilindro ?? null,
        ref_final_eje_od: this.normalizarValorEjeFormulaExterna(refraccionFinal?.od?.eje),
        ref_final_add_od: refraccionFinal?.od?.adicion ?? null,
        ref_final_alt_od: refraccionFinal?.od?.alt ?? '',
        ref_final_dp_od: refraccionFinal?.od?.dp ?? '',
        ref_final_esf_oi: refraccionFinal?.oi?.esfera ?? null,
        ref_final_cil_oi: refraccionFinal?.oi?.cilindro ?? null,
        ref_final_eje_oi: this.normalizarValorEjeFormulaExterna(refraccionFinal?.oi?.eje),
        ref_final_add_oi: refraccionFinal?.oi?.adicion ?? null,
        ref_final_alt_oi: refraccionFinal?.oi?.alt ?? '',
        ref_final_dp_oi: refraccionFinal?.oi?.dp ?? ''
      }, { emitEvent: false });
      this.normalizarControlesNgSelectVacios();
    }

    this.onFormulaExternaChange();
  }

  private normalizarValorEjeFormulaExterna(valor: unknown): number | null {
    const texto = String(valor ?? '').replace('°', '').trim();
    if (!texto) {
      return null;
    }

    const numero = Number(texto);
    if (!Number.isFinite(numero) || numero < 1 || numero > 180) {
      return null;
    }

    return numero;
  }

  private aplicarOpcionesPresupuestoEnRecomendaciones(
    presupuesto: Presupuesto,
    opcionesImportables: OpcionPresupuestoImportableHistoria[]
  ): void {
    this.recomendaciones.clear();
    this.mostrarMedidasProgresivo = [];
    this.mostrarTipoLentesContacto = [];
    this.mostrarMaterialPersonalizado = [];
    this.opcionesCategoriasRecomendablesCache = [];
    this.productosCategoriasRecomendablesCache = [];
    this.recomendacionesImportadasDesdePresupuestoMeta = [];

    opcionesImportables.forEach((opcion, index) => {
      const grupo = this.crearRecomendacion();
      this.recomendaciones.push(grupo);
      this.mostrarMedidasProgresivo.push(false);
      this.mostrarTipoLentesContacto.push(false);
      this.mostrarMaterialPersonalizado.push(false);

      const categorias = this.getCategoriasRecomendadas(index);
      categorias.clear();

      opcion.productos.forEach((producto) => {
        const categoriaNormalizada = this.normalizarCategoriaRecomendable(producto.categoria) || 'accesorios';
        categorias.push(this.crearCategoriaRecomendada({
          categoria: categoriaNormalizada,
          producto: this.normalizarProductoRecomendado(producto)
        }));
      });

      grupo.patchValue({
        observaciones: [
          `Importado desde presupuesto ${presupuesto.codigo}`,
          opcion.nombre,
          opcion.esPrincipal ? 'opción principal' : '',
          opcion.observaciones
        ].filter(Boolean).join(' · ')
      }, { emitEvent: false });

      this.sincronizarEstadoCategoriasRecomendacion(index);
      this.refrescarOpcionesCategoriasRecomendables(index);
      this.refrescarProductosCategoriasRecomendables(index);
      this.onProductoCategoriaChange(index);
      this.recomendacionesImportadasDesdePresupuestoMeta.push(opcion);
    });

    this.autoAgregarRecomendacionesDesdePresupuesto = true;
    this.presupuestoImportadoEnHistoriaCodigo = String(presupuesto.codigo || '').trim() || null;
    this.cdr.detectChanges();
  }

  getResumenImportacionPresupuestoHistoria(): string | null {
    const cantidad = this.recomendacionesImportadasDesdePresupuestoMeta.length;

    if (cantidad <= 0) {
      return null;
    }

    return cantidad === 1 ? '1 opción importada' : `${cantidad} opciones importadas`;
  }

  getMetaRecomendacionImportada(index: number): OpcionPresupuestoImportableHistoria | null {
    const meta = this.recomendacionesImportadasDesdePresupuestoMeta[index];
    return meta?.nombre ? meta : null;
  }

  agregarCategoriaRecomendada(index: number): void {
    this.getCategoriasRecomendadas(index).push(this.crearCategoriaRecomendada());
    this.refrescarOpcionesCategoriasRecomendables(index);
    this.refrescarProductosCategoriasRecomendables(index);
    this.cdr.detectChanges();
  }

  eliminarCategoriaRecomendada(indexRecomendacion: number, indexCategoria: number): void {
    this.getCategoriasRecomendadas(indexRecomendacion).removeAt(indexCategoria);
    this.sincronizarEstadoCategoriasRecomendacion(indexRecomendacion);
    this.refrescarOpcionesCategoriasRecomendables(indexRecomendacion);
    this.refrescarProductosCategoriasRecomendables(indexRecomendacion);
    this.cdr.detectChanges();
  }

  eliminarRecomendacion(index: number): void {
    this.recomendaciones.removeAt(index);
    this.recomendacionesImportadasDesdePresupuestoMeta.splice(index, 1);

    this.mostrarMedidasProgresivo.splice(index, 1);
    this.mostrarTipoLentesContacto.splice(index, 1);
    this.mostrarMaterialPersonalizado.splice(index, 1);
    this.opcionesCategoriasRecomendablesCache.splice(index, 1);
    this.productosCategoriasRecomendablesCache.splice(index, 1);
  }

  private mapRecomendaciones(): Recomendaciones[] {
    return this.recomendaciones.controls.map(control => {
      const grupo = control as FormGroup;
      const categoriasSeleccionadas = this.obtenerCategoriasProductoSeleccionadasDesdeGrupo(grupo);
      const medidasCristal = this.obtenerMedidasGrupoRecomendacion(grupo);
      const seleccionProductos = this.construirSeleccionProductosRecomendacion(categoriasSeleccionadas, medidasCristal);

      return {
        observaciones: grupo.get('observaciones')?.value || '',
        seleccionProductos: seleccionProductos ?? undefined
      };
    });
  }

  private normalizarTextoOpcional(valor: any): string | undefined {
    const texto = String(valor ?? '').trim();
    return texto || undefined;
  }

  private normalizarMedidasRecomendacion(
    medidas: ProductoRecomendadoHistoria['medidas'] | null | undefined
  ): ProductoRecomendadoHistoria['medidas'] | undefined {
    if (!medidas) {
      return undefined;
    }

    const normalizadas = {
      horizontal: this.normalizarTextoOpcional(medidas.horizontal),
      vertical: this.normalizarTextoOpcional(medidas.vertical),
      diagonal: this.normalizarTextoOpcional(medidas.diagonal),
      puente: this.normalizarTextoOpcional(medidas.puente)
    };

    return normalizadas.horizontal || normalizadas.vertical || normalizadas.diagonal || normalizadas.puente
      ? normalizadas
      : undefined;
  }

  private obtenerMedidasGrupoRecomendacion(grupo: FormGroup): ProductoRecomendadoHistoria['medidas'] | undefined {
    return this.normalizarMedidasRecomendacion({
      horizontal: grupo.get('medidaHorizontal')?.value,
      vertical: grupo.get('medidaVertical')?.value,
      diagonal: grupo.get('medidaDiagonal')?.value,
      puente: grupo.get('medidaPuente')?.value
    });
  }

  private obtenerProductoClinicoRecomendacion(
    recomendacion: Recomendaciones | null | undefined
  ): ProductoRecomendadoHistoria | null {
    return this.obtenerProductoPorCategoriaRecomendacion(recomendacion, 'cristales')
      || this.obtenerProductoPorCategoriaRecomendacion(recomendacion, 'lentes de contacto')
      || recomendacion?.seleccionProductos?.cristal
      || null;
  }

  private obtenerMedidasRecomendacionPersistidas(
    recomendacion: Recomendaciones | null | undefined
  ): ProductoRecomendadoHistoria['medidas'] | undefined {
    const medidasProducto = this.normalizarMedidasRecomendacion(this.obtenerProductoClinicoRecomendacion(recomendacion)?.medidas);
    if (medidasProducto) {
      return medidasProducto;
    }

    return this.normalizarMedidasRecomendacion({
      horizontal: recomendacion?.medidaHorizontal,
      vertical: recomendacion?.medidaVertical,
      diagonal: recomendacion?.medidaDiagonal,
      puente: recomendacion?.medidaPuente
    });
  }

  getMedidasRecomendacionData(
    recomendacion: Recomendaciones | null | undefined
  ): ProductoRecomendadoHistoria['medidas'] | null {
    return this.obtenerMedidasRecomendacionPersistidas(recomendacion) || null;
  }

  getTipoLenteContactoRecomendadoValor(recomendacion: Recomendaciones | null | undefined): string | null {
    const productoClinico = this.obtenerProductoClinicoRecomendacion(recomendacion);
    return this.normalizarTextoOpcional(productoClinico?.tipoLenteContacto)
      || this.normalizarTextoOpcional(recomendacion?.tipoLentesContacto)
      || null;
  }

  private obtenerCristalRecomendacionInicial(rec?: Recomendaciones): string | null {
    const productoClinico = this.obtenerProductoClinicoRecomendacion(rec);
    const tipoCristal = this.obtenerTipoCristalDesdeProducto(productoClinico);
    if (tipoCristal) {
      return tipoCristal;
    }

    if (rec?.cristal) {
      return this.obtenerValorCristalComoString(rec.cristal);
    }

    return null;
  }

  private obtenerProductoCristalInicial(rec?: Recomendaciones): ProductoRecomendadoHistoria | null {
    return this.obtenerProductoClinicoRecomendacion(rec);
  }

  private obtenerMaterialesRecomendacionInicial(rec?: Recomendaciones): string[] {
    const material = rec?.material;

    if (Array.isArray(material)) {
      return material.map(valor => String(valor)).filter(Boolean);
    }

    if (material) {
      return [String(material)];
    }

    return [];
  }

  private obtenerMaterialPersonalizadoInicial(rec?: Recomendaciones): string {
    return String(rec?.materialPersonalizado || '').trim();
  }

  private obtenerMonturaRecomendacionInicial(rec?: Recomendaciones): string {
    return String(this.obtenerProductoPorCategoriaRecomendacion(rec, 'monturas')?.nombre || rec?.montura || rec?.seleccionProductos?.montura?.nombre || '').trim();
  }

  private obtenerProductoMonturaInicial(rec?: Recomendaciones): ProductoRecomendadoHistoria | null {
    return this.obtenerProductoPorCategoriaRecomendacion(rec, 'monturas') || rec?.seleccionProductos?.montura || null;
  }

  private obtenerTipoLentesContactoRecomendacionInicial(rec?: Recomendaciones): string | null {
    return this.getTipoLenteContactoRecomendadoValor(rec);
  }

  private obtenerCategoriasIniciales(rec?: Recomendaciones): CategoriaProductoRecomendado[] {
    const categoriasPersistidas = rec?.seleccionProductos?.categorias;
    if (Array.isArray(categoriasPersistidas) && categoriasPersistidas.length > 0) {
      return categoriasPersistidas
        .filter(categoria => !!categoria?.categoria)
        .map(categoria => ({
          categoria: String(categoria.categoria || '').trim().toLowerCase(),
          producto: categoria.producto || null
        }));
    }

    const categoriasDerivadas: CategoriaProductoRecomendado[] = [];
    const productoCristal = rec?.seleccionProductos?.cristal;
    const productoMontura = rec?.seleccionProductos?.montura;

    if (productoCristal) {
      categoriasDerivadas.push({
        categoria: String(productoCristal.categoria || (rec?.tipoLentesContacto ? 'lentes de contacto' : 'cristales')).trim().toLowerCase(),
        producto: productoCristal
      });
    } else if (rec?.cristal || rec?.tipoLentesContacto) {
      categoriasDerivadas.push({
        categoria: rec?.tipoLentesContacto ? 'lentes de contacto' : 'cristales',
        producto: null
      });
    }

    if (productoMontura) {
      categoriasDerivadas.push({ categoria: 'monturas', producto: productoMontura });
    } else if (String(rec?.montura || '').trim()) {
      categoriasDerivadas.push({ categoria: 'monturas', producto: null });
    }

    return categoriasDerivadas;
  }

  private construirSeleccionProductosRecomendacion(
    categoriasSeleccionadas: CategoriaProductoRecomendado[],
    medidasCristal?: ProductoRecomendadoHistoria['medidas']
  ): SeleccionProductosRecomendacion | null {
    const categorias = categoriasSeleccionadas
      .map(categoria => {
        const categoriaNormalizada = String(categoria.categoria || '').trim().toLowerCase();
        const producto = this.normalizarProductoRecomendado(categoria.producto || null);

        if (!producto) {
          return null;
        }

        return {
          categoria: categoriaNormalizada,
          producto: this.esCategoriaCristal(categoriaNormalizada)
            ? { ...producto, medidas: this.normalizarMedidasRecomendacion(medidasCristal) }
            : producto
        };
      })
      .filter((categoria): categoria is CategoriaProductoRecomendado & { producto: ProductoRecomendadoHistoria } => !!categoria)
      .filter(categoria => !!categoria.categoria && !!categoria.producto);

    return categorias.length > 0 ? { categorias } : null;
  }

  private obtenerCategoriasProductoSeleccionadasDesdeGrupo(grupo: FormGroup): CategoriaProductoRecomendado[] {
    const categorias = (grupo.get('categorias') as FormArray | null)?.controls ?? [];

    return categorias
      .map(control => control as FormGroup)
      .map(control => ({
        categoria: String(control.get('categoria')?.value || '').trim().toLowerCase(),
        producto: control.get('producto')?.value || null
      }))
      .filter(categoria => !!categoria.categoria && !!categoria.producto?.id)
      .map(categoria => ({
        categoria: categoria.categoria,
        producto: this.normalizarProductoRecomendado(categoria.producto)
      }))
      .filter((categoria): categoria is CategoriaProductoRecomendado & { producto: ProductoRecomendadoHistoria } => !!categoria.producto);
  }

  private normalizarProductoRecomendado(
    producto: Producto | ProductoRecomendadoHistoria | null | undefined
  ): ProductoRecomendadoHistoria | null {
    if (!producto?.id) {
      return null;
    }

    const productoExtendido = producto as any;
    const categoriaNormalizada = String(producto.categoria || '').trim().toLowerCase();
    const cristalConfig = productoExtendido.cristalConfig && typeof productoExtendido.cristalConfig === 'object'
      ? {
        tipoCristal: this.normalizarTextoOpcional(productoExtendido.cristalConfig.tipoCristal),
        presentacion: this.normalizarTextoOpcional(productoExtendido.cristalConfig.presentacion),
        material: this.normalizarTextoOpcional(productoExtendido.cristalConfig.material),
        proveedor: this.normalizarTextoOpcional(productoExtendido.cristalConfig.proveedor),
        tratamientos: Array.isArray(productoExtendido.cristalConfig.tratamientos)
          ? productoExtendido.cristalConfig.tratamientos.map((tratamiento: any) => String(tratamiento || '').trim()).filter(Boolean)
          : undefined,
        rangoFormula: this.normalizarTextoOpcional(productoExtendido.cristalConfig.rangoFormula),
        costoLaboratorio: typeof productoExtendido.cristalConfig.costoLaboratorio === 'number'
          ? productoExtendido.cristalConfig.costoLaboratorio
          : undefined,
        materialOtro: this.normalizarTextoOpcional(productoExtendido.cristalConfig.materialOtro)
      }
      : undefined;
    const esCristal = this.esCategoriaCristal(categoriaNormalizada);

    return {
      id: String(producto.id),
      nombre: String(producto.nombre || '').trim(),
      codigo: String(producto.codigo || '').trim(),
      categoria: String(producto.categoria || '').trim(),
      modelo: esCristal ? undefined : String(producto.modelo || '').trim() || undefined,
      marca: esCristal ? undefined : String(producto.marca || '').trim() || undefined,
      presentacion: this.normalizarTextoOpcional(cristalConfig?.presentacion),
      material: this.normalizarTextoOpcional(cristalConfig?.material || producto.material),
      color: String(producto.color || '').trim() || undefined,
      moneda: String(producto.moneda || '').trim() || undefined,
      precio: Number(producto.precio ?? 0),
      precioConIva: Number(producto.precioConIva ?? producto.precio ?? 0),
      aplicaIva: Boolean(producto.aplicaIva),
      sede: String(producto.sede || '').trim() || undefined,
      stock: Number(producto.stock ?? 0),
      proveedor: this.normalizarTextoOpcional(cristalConfig?.proveedor || producto.proveedor),
      descripcion: String(producto.descripcion || '').trim() || undefined,
      tipoCristal: this.normalizarTextoOpcional(productoExtendido.tipoCristal || cristalConfig?.tipoCristal),
      tipoLenteContacto: this.normalizarTextoOpcional(productoExtendido.tipoLenteContacto || productoExtendido.lenteContactoConfig?.tipoLenteContacto),
      cristalConfig,
      medidas: this.normalizarMedidasRecomendacion(productoExtendido.medidas)
    };
  }

  getProductosCristalRecomendables(index: number): ProductoRecomendableOption[] {
    const recomendacion = this.recomendaciones.at(index) as FormGroup | null;
    const tipoCristal = this.obtenerValorCristalComoString(recomendacion?.get('cristal')?.value);
    const categoriaObjetivo = this.esLentesContacto(tipoCristal) ? 'lentes de contacto' : 'cristales';
    const tipoLentesContacto = String(recomendacion?.get('tipoLentesContacto')?.value || '').trim().toLowerCase();

    return this.ordenarProductosRecomendables(this.productosRecomendables.filter(producto => {
      const categoriaProducto = String(producto.categoria || '').trim().toLowerCase();
      if (categoriaProducto !== categoriaObjetivo) {
        return false;
      }

      if (!tipoLentesContacto || categoriaObjetivo !== 'lentes de contacto') {
        return true;
      }

      const tipoProducto = String(producto.lenteContactoConfig?.tipoLenteContacto || producto.modelo || '').trim().toLowerCase();
      return !tipoProducto || tipoProducto === tipoLentesContacto;
    }).map(producto => this.mapProductoRecomendableOption(producto)));
  }

  getMonturasRecomendables(): ProductoRecomendableOption[] {
    return this.ordenarProductosRecomendables(this.productosRecomendables.filter(producto =>
      String(producto.categoria || '').trim().toLowerCase() === 'monturas'
    ).map(producto => this.mapProductoRecomendableOption(producto)));
  }

  compararProductoRecomendado = (
    actual: Producto | ProductoRecomendadoHistoria | null,
    seleccionado: Producto | ProductoRecomendadoHistoria | null
  ): boolean => {
    return !!actual && !!seleccionado ? String(actual.id) === String(seleccionado.id) : actual === seleccionado;
  };

  getEtiquetaProductoRecomendado(producto: Producto | ProductoRecomendadoHistoria | null | undefined): string {
    if (!producto) {
      return 'Producto no especificado';
    }

    const codigo = String(producto.codigo || '').trim();
    return codigo ? `${producto.nombre} (${codigo})` : producto.nombre;
  }

  getMensajeStockProductoRecomendado(producto: Producto | ProductoRecomendadoHistoria | null | undefined): string {
    const stock = Number(producto?.stock ?? 0);
    return stock > 0 ? `Stock: ${stock}` : 'Sin stock disponible';
  }

  esProductoRecomendadoSinStock(producto: Producto | ProductoRecomendadoHistoria | null | undefined): boolean {
    return Number(producto?.stock ?? 0) <= 0;
  }

  getOpcionesCategoriasRecomendables(indexRecomendacion: number, indexCategoria?: number): OpcionSelect[] {
    if (indexCategoria !== undefined) {
      const opcionesCache = this.opcionesCategoriasRecomendablesCache[indexRecomendacion]?.[indexCategoria];
      if (opcionesCache) {
        return opcionesCache;
      }
    }

    return this.construirOpcionesCategoriasRecomendables(indexRecomendacion, indexCategoria);
  }

  private construirOpcionesCategoriasRecomendables(indexRecomendacion: number, indexCategoria?: number): OpcionSelect[] {
    const categoriaActual = indexCategoria === undefined
      ? ''
      : this.normalizarCategoriaRecomendable((this.getCategoriasRecomendadas(indexRecomendacion).at(indexCategoria) as FormGroup | null)?.get('categoria')?.value);

    const categoriasSeleccionadas = this.getCategoriasRecomendadas(indexRecomendacion).controls
      .map(control => control as FormGroup)
      .map((control, index) => ({
        index,
        categoria: this.normalizarCategoriaRecomendable(control.get('categoria')?.value)
      }))
      .filter(item => !!item.categoria && item.index !== indexCategoria)
      .map(item => item.categoria);

    const categoriasBase = this.getCatalogoCategoriasRecomendables();

    const opciones = categoriasBase.filter(opcion => {
      if (categoriasSeleccionadas.includes(opcion.value as string)) {
        return false;
      }

      if ((opcion.value === 'cristales' && categoriasSeleccionadas.includes('lentes de contacto')) ||
        (opcion.value === 'lentes de contacto' && categoriasSeleccionadas.includes('cristales'))) {
        return false;
      }

      return true;
    });

    if (categoriaActual && !opciones.some(opcion => opcion.value === categoriaActual)) {
      return [
        ...opciones,
        {
          value: categoriaActual,
          label: this.formatearCategoriaRecomendable(categoriaActual)
        }
      ];
    }

    return opciones;
  }

  private refrescarOpcionesCategoriasRecomendables(indexRecomendacion: number): void {
    const categorias = this.getCategoriasRecomendadas(indexRecomendacion);
    this.opcionesCategoriasRecomendablesCache[indexRecomendacion] = categorias.controls.map((_, indexCategoria) =>
      this.construirOpcionesCategoriasRecomendables(indexRecomendacion, indexCategoria)
    );
  }

  private refrescarProductosCategoriasRecomendables(indexRecomendacion?: number): void {
    if (typeof indexRecomendacion === 'number') {
      const categorias = this.getCategoriasRecomendadas(indexRecomendacion);
      this.productosCategoriasRecomendablesCache[indexRecomendacion] = categorias.controls.map((_, indexCategoria) =>
        this.construirProductosPorCategoriaRecomendada(indexRecomendacion, indexCategoria)
      );
      return;
    }

    this.productosCategoriasRecomendablesCache = this.recomendaciones.controls.map((_, index) => {
      const categorias = this.getCategoriasRecomendadas(index);
      return categorias.controls.map((__, indexCategoria) =>
        this.construirProductosPorCategoriaRecomendada(index, indexCategoria)
      );
    });
  }

  puedeAgregarOtraCategoria(indexRecomendacion: number): boolean {
    const categorias = this.getCategoriasRecomendadas(indexRecomendacion);
    if (categorias.length === 0) {
      return true;
    }

    const ultimaCategoria = categorias.at(categorias.length - 1) as FormGroup | null;
    const categoriaSeleccionada = String(ultimaCategoria?.get('categoria')?.value || '').trim();

    if (!categoriaSeleccionada) {
      return false;
    }

    return this.getOpcionesCategoriasRecomendables(indexRecomendacion).length > 0;
  }

  getProductosPorCategoriaRecomendada(indexRecomendacion: number, indexCategoria: number): ProductoRecomendableOption[] {
    const productosCache = this.productosCategoriasRecomendablesCache[indexRecomendacion]?.[indexCategoria];
    if (productosCache) {
      return productosCache;
    }

    return this.construirProductosPorCategoriaRecomendada(indexRecomendacion, indexCategoria);
  }

  private construirProductosPorCategoriaRecomendada(indexRecomendacion: number, indexCategoria: number): ProductoRecomendableOption[] {
    const categoria = this.normalizarCategoriaRecomendable((this.getCategoriasRecomendadas(indexRecomendacion).at(indexCategoria) as FormGroup | null)?.get('categoria')?.value);

    if (!categoria) {
      return [];
    }

    if (this.esCategoriaCristal(categoria) || this.esCategoriaLenteContacto(categoria)) {
      return this.getProductosPorCategoriaBase(indexRecomendacion, categoria);
    }

    if (this.esCategoriaMontura(categoria)) {
      return this.getMonturasRecomendables();
    }

    return this.ordenarProductosRecomendables(this.productosRecomendables
      .filter(producto => this.normalizarCategoriaRecomendable(producto.categoria) === categoria)
      .map(producto => this.mapProductoRecomendableOption(producto)));
  }

  tieneProductosDisponiblesPorCategoria(indexRecomendacion: number, indexCategoria: number): boolean {
    return this.getProductosPorCategoriaRecomendada(indexRecomendacion, indexCategoria)
      .some(producto => !producto.disabled);
  }

  getMensajeDisponibilidadCategoria(indexRecomendacion: number, indexCategoria: number): string {
    const productos = this.getProductosPorCategoriaRecomendada(indexRecomendacion, indexCategoria);
    const categoria = this.obtenerCategoriaDesdeControl(indexRecomendacion, indexCategoria);
    const labelCategoria = this.getLabelCategoriaRecomendable(categoria).toLowerCase();

    if (productos.length === 0) {
      return `No hay productos de ${labelCategoria} disponibles en esta sede.`;
    }

    if (!productos.some(producto => !producto.disabled)) {
      return `No hay productos de ${labelCategoria} con stock disponible actualmente.`;
    }

    return 'Solo se pueden seleccionar productos con stock disponible.';
  }

  onCategoriaRecomendadaChange(indexRecomendacion: number, indexCategoria: number, valorSeleccionado?: string | null): void {
    const categoriaGroup = this.getCategoriasRecomendadas(indexRecomendacion).at(indexCategoria) as FormGroup;
    const categoriaNormalizada = this.normalizarCategoriaRecomendable(valorSeleccionado ?? categoriaGroup.get('categoria')?.value);

    categoriaGroup.get('categoria')?.setValue(categoriaNormalizada || null, { emitEvent: false });
    categoriaGroup.get('producto')?.setValue(null);

    queueMicrotask(() => {
      this.sincronizarEstadoCategoriasRecomendacion(indexRecomendacion);
      this.refrescarOpcionesCategoriasRecomendables(indexRecomendacion);
      this.refrescarProductosCategoriasRecomendables(indexRecomendacion);
      this.cdr.detectChanges();
    });
  }

  onProductoCategoriaChange(indexRecomendacion: number): void {
    this.sincronizarControlesLegacyRecomendacion(indexRecomendacion);
    this.cdr.detectChanges();
  }

  onTipoLenteContactoRecomendadoChange(indexRecomendacion: number, indexCategoria: number): void {
    const categoriaGroup = this.getCategoriasRecomendadas(indexRecomendacion).at(indexCategoria) as FormGroup | null;
    if (!categoriaGroup) {
      return;
    }

    categoriaGroup.get('producto')?.setValue(null, { emitEvent: false });
    this.refrescarProductosCategoriasRecomendables(indexRecomendacion);
    this.sincronizarControlesLegacyRecomendacion(indexRecomendacion);
    this.cdr.detectChanges();
  }

  getResumenCategoriasSeleccionadasFormulario(indexRecomendacion: number): Array<{ categoria: string; producto: string }> {
    return this.getCategoriasRecomendadas(indexRecomendacion).controls
      .map(control => control as FormGroup)
      .map(control => ({
        categoria: this.getLabelCategoriaRecomendable(control.get('categoria')?.value),
        producto: this.getEtiquetaProductoRecomendado(control.get('producto')?.value)
      }))
      .filter(item => item.categoria !== 'Sin categoría' && item.producto !== 'Producto no especificado');
  }

  esCategoriaRecomendacionCristal(indexRecomendacion: number, indexCategoria: number): boolean {
    const categoria = this.obtenerCategoriaDesdeControl(indexRecomendacion, indexCategoria);
    return this.esCategoriaCristal(categoria);
  }

  esCategoriaRecomendacionLentesContacto(indexRecomendacion: number, indexCategoria: number): boolean {
    const categoria = this.obtenerCategoriaDesdeControl(indexRecomendacion, indexCategoria);
    return this.esCategoriaLenteContacto(categoria);
  }

  esCategoriaRecomendacionMontura(indexRecomendacion: number, indexCategoria: number): boolean {
    const categoria = this.obtenerCategoriaDesdeControl(indexRecomendacion, indexCategoria);
    return this.esCategoriaMontura(categoria);
  }

  getLabelCategoriaRecomendable(categoria: string | null | undefined): string {
    const valor = this.normalizarCategoriaRecomendable(categoria);
    const opcion = this.getCatalogoCategoriasRecomendables().find(item => item.value === valor);
    return opcion?.label || valor || 'Sin categoría';
  }

  private mapProductoRecomendableOption(producto: Producto): ProductoRecomendableOption {
    return {
      ...producto,
      disabled: Number(producto.stock ?? 0) <= 0,
    };
  }

  private ordenarProductosRecomendables(productos: ProductoRecomendableOption[]): ProductoRecomendableOption[] {
    return [...productos].sort((productoA, productoB) => {
      if (productoA.disabled !== productoB.disabled) {
        return Number(productoA.disabled) - Number(productoB.disabled);
      }

      return String(productoA.nombre || '').localeCompare(String(productoB.nombre || ''), 'es', { sensitivity: 'base' });
    });
  }

  private getCatalogoCategoriasRecomendables(): OpcionSelect[] {
    const categoriasUnicas = Array.from(new Set(this.productosRecomendables
      .map(producto => this.normalizarCategoriaRecomendable(producto.categoria))
      .filter(Boolean)));

    const ordenadas = [...categoriasUnicas].sort((a, b) => {
      const indexA = this.categoriasRecomendablesPreferidas.indexOf(a);
      const indexB = this.categoriasRecomendablesPreferidas.indexOf(b);

      if (indexA === -1 && indexB === -1) {
        return a.localeCompare(b, 'es', { sensitivity: 'base' });
      }

      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    return ordenadas.map(categoria => ({
      value: categoria,
      label: this.formatearCategoriaRecomendable(categoria)
    }));
  }

  private formatearCategoriaRecomendable(categoria: string): string {
    const mapa: { [key: string]: string } = {
      'cristales': 'Cristal',
      'lentes de contacto': 'Lente de contacto',
      'monturas': 'Montura',
      'liquidos': 'Líquido',
      'estuches': 'Estuche',
      'accesorios': 'Accesorio'
    };

    return mapa[categoria] || categoria.charAt(0).toUpperCase() + categoria.slice(1);
  }

  private getProductosPorCategoriaBase(index: number, categoria: string): ProductoRecomendableOption[] {
    const recomendacion = this.recomendaciones.at(index) as FormGroup | null;
    const tipoLentesContacto = String(recomendacion?.get('tipoLentesContacto')?.value || '').trim().toLowerCase();
    const categoriaNormalizada = this.normalizarCategoriaRecomendable(categoria);

    return this.ordenarProductosRecomendables(this.productosRecomendables.filter(producto => {
      const categoriaProducto = this.normalizarCategoriaRecomendable(producto.categoria);
      if (categoriaProducto !== categoriaNormalizada) {
        return false;
      }

      if (!tipoLentesContacto || categoriaNormalizada !== 'lentes de contacto') {
        return true;
      }

      const tipoProducto = String(producto.lenteContactoConfig?.tipoLenteContacto || producto.modelo || '').trim().toLowerCase();
      return !tipoProducto || tipoProducto === tipoLentesContacto;
    }).map(producto => this.mapProductoRecomendableOption(producto)));
  }

  private obtenerCategoriaDesdeControl(indexRecomendacion: number, indexCategoria: number): string {
    return this.normalizarCategoriaRecomendable((this.getCategoriasRecomendadas(indexRecomendacion).at(indexCategoria) as FormGroup | null)?.get('categoria')?.value);
  }

  private esCategoriaCristal(categoria: string | null | undefined): boolean {
    return this.normalizarCategoriaRecomendable(categoria) === 'cristales';
  }

  private esCategoriaLenteContacto(categoria: string | null | undefined): boolean {
    return this.normalizarCategoriaRecomendable(categoria) === 'lentes de contacto';
  }

  private esCategoriaMontura(categoria: string | null | undefined): boolean {
    return this.normalizarCategoriaRecomendable(categoria) === 'monturas';
  }

  private normalizarCategoriaRecomendable(categoria: unknown): string {
    let valorFuente = categoria;

    if (categoria && typeof categoria === 'object') {
      const categoriaObj = categoria as { value?: unknown; label?: unknown };
      valorFuente = categoriaObj.value ?? categoriaObj.label ?? '';
    }

    const valor = String(valorFuente || '').trim().toLowerCase();

    if (!valor) {
      return '';
    }

    if (['cristal', 'cristales', 'lente formulado', 'lentes formulados'].includes(valor)) {
      return 'cristales';
    }

    if (['montura', 'monturas', 'armazon', 'armazones'].includes(valor)) {
      return 'monturas';
    }

    if (['lente de contacto', 'lentes de contacto', 'lente contacto', 'lentes contacto', 'lentes'].includes(valor)) {
      return 'lentes de contacto';
    }

    if (['liquido', 'liquidos'].includes(valor)) {
      return 'liquidos';
    }

    if (['estuche', 'estuches'].includes(valor)) {
      return 'estuches';
    }

    if (['accesorio', 'accesorios'].includes(valor)) {
      return 'accesorios';
    }

    return valor;
  }

  private sincronizarControlesLegacyRecomendacion(indexRecomendacion: number): void {
    const grupo = this.recomendaciones.at(indexRecomendacion) as FormGroup | null;
    if (!grupo) {
      return;
    }

    const categoriasSeleccionadas = this.obtenerCategoriasProductoSeleccionadasDesdeGrupo(grupo);
    const productoPrincipal = categoriasSeleccionadas.find(categoria =>
      this.esCategoriaCristal(categoria.categoria) || this.esCategoriaLenteContacto(categoria.categoria)
    )?.producto || null;
    const montura = categoriasSeleccionadas.find(categoria => this.esCategoriaMontura(categoria.categoria))?.producto || null;
    const tipoCristal = this.obtenerTipoCristalDesdeProducto(productoPrincipal);
    const tipoLenteContacto = this.obtenerTipoLenteContactoDesdeProducto(productoPrincipal);

    grupo.get('productoCristal')?.setValue(productoPrincipal, { emitEvent: false });
    grupo.get('productoMontura')?.setValue(montura, { emitEvent: false });
    grupo.get('montura')?.setValue(montura?.nombre || '', { emitEvent: false });
    grupo.get('cristal')?.setValue(tipoCristal || null, { emitEvent: false });
    grupo.get('tipoLentesContacto')?.setValue(tipoLenteContacto || null, { emitEvent: false });

    this.mostrarMedidasProgresivo[indexRecomendacion] = this.requiereMedidas(tipoCristal);
    this.mostrarTipoLentesContacto[indexRecomendacion] = this.esCategoriaLenteContacto(productoPrincipal?.categoria);
  }

  private obtenerTipoCristalDesdeProducto(producto: ProductoRecomendadoHistoria | null | undefined): string {
    if (!producto) {
      return '';
    }

    if (this.esCategoriaLenteContacto(producto.categoria)) {
      return 'LENTES_CONTACTO';
    }

    if (!this.esCategoriaCristal(producto.categoria)) {
      return '';
    }

    const tipoCristalSnapshot = String(producto.tipoCristal || '').trim();
    if (tipoCristalSnapshot) {
      return tipoCristalSnapshot;
    }

    const productoConConfig = this.productosRecomendables.find(item => String(item.id) === String(producto.id));
    return String(productoConConfig?.cristalConfig?.tipoCristal || productoConConfig?.modelo || producto.nombre || '').trim();
  }

  private obtenerTipoLenteContactoDesdeProducto(producto: ProductoRecomendadoHistoria | null | undefined): string {
    if (!producto || !this.esCategoriaLenteContacto(producto.categoria)) {
      return '';
    }

    const tipoLenteContactoSnapshot = String(producto.tipoLenteContacto || '').trim();
    if (tipoLenteContactoSnapshot) {
      return tipoLenteContactoSnapshot;
    }

    const productoConConfig = this.productosRecomendables.find(item => String(item.id) === String(producto.id));
    return String(productoConConfig?.lenteContactoConfig?.tipoLenteContacto || productoConConfig?.modelo || producto.nombre || '').trim();
  }

  private sincronizarEstadoCategoriasRecomendacion(indexRecomendacion: number): void {
    const grupo = this.recomendaciones.at(indexRecomendacion) as FormGroup | null;
    if (!grupo) {
      return;
    }

    const categorias = this.getCategoriasRecomendadas(indexRecomendacion).controls
      .map(control => control as FormGroup)
      .map(control => String(control.get('categoria')?.value || '').trim().toLowerCase())
      .filter(Boolean);

    const tieneCristal = categorias.some(categoria => this.esCategoriaCristal(categoria));
    const tieneLenteContacto = categorias.some(categoria => this.esCategoriaLenteContacto(categoria));

    const cristalControl = grupo.get('cristal');
    const tipoLentesControl = grupo.get('tipoLentesContacto');
    const medidaHorizontalControl = grupo.get('medidaHorizontal');
    const medidaVerticalControl = grupo.get('medidaVertical');
    const medidaDiagonalControl = grupo.get('medidaDiagonal');
    const medidaPuenteControl = grupo.get('medidaPuente');

    if (tieneCristal) {
      cristalControl?.setValidators([Validators.required]);
    } else {
      cristalControl?.clearValidators();
      cristalControl?.setValue(null, { emitEvent: false });
      this.mostrarMedidasProgresivo[indexRecomendacion] = false;
      medidaHorizontalControl?.clearValidators();
      medidaVerticalControl?.clearValidators();
      medidaDiagonalControl?.clearValidators();
      medidaPuenteControl?.clearValidators();
      medidaHorizontalControl?.setValue('', { emitEvent: false });
      medidaVerticalControl?.setValue('', { emitEvent: false });
      medidaDiagonalControl?.setValue('', { emitEvent: false });
      medidaPuenteControl?.setValue('', { emitEvent: false });
    }

    this.mostrarTipoLentesContacto[indexRecomendacion] = tieneLenteContacto;

    if (tieneLenteContacto) {
      tipoLentesControl?.setValidators([Validators.required]);
    } else {
      tipoLentesControl?.clearValidators();
      tipoLentesControl?.setValue(null, { emitEvent: false });
    }

    if (!tieneCristal && !tieneLenteContacto) {
      grupo.get('productoCristal')?.setValue(null, { emitEvent: false });
    }

    if (!categorias.some(categoria => this.esCategoriaMontura(categoria))) {
      grupo.get('productoMontura')?.setValue(null, { emitEvent: false });
      grupo.get('montura')?.setValue('', { emitEvent: false });
    }

    cristalControl?.updateValueAndValidity({ emitEvent: false });
    tipoLentesControl?.updateValueAndValidity({ emitEvent: false });
    medidaHorizontalControl?.updateValueAndValidity({ emitEvent: false });
    medidaVerticalControl?.updateValueAndValidity({ emitEvent: false });
    medidaDiagonalControl?.updateValueAndValidity({ emitEvent: false });
    medidaPuenteControl?.updateValueAndValidity({ emitEvent: false });

    this.sincronizarControlesLegacyRecomendacion(indexRecomendacion);
    this.refrescarOpcionesCategoriasRecomendables(indexRecomendacion);
  }

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

  togglePanelSuperior() {
    this.panelSuperiorColapsado = !this.panelSuperiorColapsado;
  }

  togglePanelInferior() {
    this.panelInferiorColapsado = !this.panelInferiorColapsado;
  }

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

  actualizarFiltroTexto(event: { term: string; items: any[] }): void {
    this.filtro = event.term;
    this.actualizarPacientesFiltrados();
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
      this.pacienteParaNuevaHistoria = null;
    }
  }

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

  getMaterialLabel(materiales: TipoMaterial | TipoMaterial[] | string | string[]): string {
    if (!materiales) return 'No especificado';

    const array = Array.isArray(materiales) ? materiales : [materiales];
    return array.map(material => {
      const materialNormalizado = String(material) as TipoMaterial;
      return this.materialLabels.get(materialNormalizado) || String(material);
    }).join(', ');
  }

  getProductosRecomendadosLabel(productos: ProductoRecomendadoHistoria[] | undefined | null): string {
    if (!productos || productos.length === 0) {
      return 'No especificado';
    }

    return productos
      .map(producto => producto.codigo ? `${producto.nombre} (${producto.codigo})` : producto.nombre)
      .join(', ');
  }

  getProductoRecomendadoLabel(producto: ProductoRecomendadoHistoria | undefined | null): string {
    if (!producto) {
      return 'No especificado';
    }

    return producto.codigo ? `${producto.nombre} (${producto.codigo})` : producto.nombre;
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
    // Si no está en modo edición (es creación), siempre retorna true
    if (!this.modoEdicion) {
      return true;
    }

    const actual = this.historiaForm.value;

    const camposModificados = Object.keys(this.formOriginalHistoria).some(key => {
      const valorActual = actual[key];
      const valorOriginal = this.formOriginalHistoria[key];

      if (Array.isArray(valorActual) && Array.isArray(valorOriginal)) {
        return !this.arraysIguales(valorActual, valorOriginal);
      }

      if (typeof valorActual === 'object' && valorActual !== null &&
        typeof valorOriginal === 'object' && valorOriginal !== null) {
        return JSON.stringify(valorActual) !== JSON.stringify(valorOriginal);
      }

      return valorActual !== valorOriginal;
    });

    return camposModificados;
  }

  arraysIguales(arr1: any[], arr2: any[]): boolean {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((val, i) => val === arr2[i]);
  }

  onMotivoChange(selectedOptions: any[]) {
    this.mostrarInputOtroMotivo = selectedOptions.includes('Otro');
    const otroMotivoControl = this.historiaForm.get('otroMotivo');

    if (this.mostrarInputOtroMotivo) {
      otroMotivoControl?.setValidators([Validators.required]);
      otroMotivoControl?.enable();
    } else {
      otroMotivoControl?.clearValidators();
      otroMotivoControl?.setValue('');
      otroMotivoControl?.disable();
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

  get ventasRelacionadasHistoriaSeleccionada() {
    return this.historiaSeleccionada?.trazabilidadVenta?.ventasRelacionadas || [];
  }

  get ventaActivaHistoriaSeleccionada() {
    return this.historiaSeleccionada?.trazabilidadVenta?.ventaActiva || null;
  }

  get historiaTieneTrazabilidadVenta(): boolean {
    return this.ventasRelacionadasHistoriaSeleccionada.length > 0;
  }

  get historiaTieneVentasAnuladas(): boolean {
    return this.ventasRelacionadasHistoriaSeleccionada.some((venta) => venta.anulada === true || venta.estadoVenta === 'anulada');
  }

  getEtiquetaEstadoVentaTrazabilidad(estadoVenta: string | null | undefined): string {
    const estado = `${estadoVenta || ''}`.trim().toLowerCase();

    switch (estado) {
      case 'anulada':
      case 'cancelada':
      case 'cancelado':
        return 'Venta anulada';
      case 'pendiente':
        return 'Venta pendiente';
      case 'completada':
        return 'Venta completada';
      default:
        return estado ? `Venta ${estado}` : 'Venta relacionada';
    }
  }

  getClaseEstadoVentaTrazabilidad(estadoVenta: string | null | undefined): string {
    const estado = `${estadoVenta || ''}`.trim().toLowerCase();

    if (estado === 'anulada' || estado === 'cancelada' || estado === 'cancelado') {
      return 'trace-badge trace-badge--cancelled';
    }

    if (estado === 'pendiente') {
      return 'trace-badge trace-badge--pending';
    }

    return 'trace-badge trace-badge--success';
  }

  getEtiquetaEstadoPagoTrazabilidad(estadoPago: string | null | undefined): string {
    const estado = `${estadoPago || ''}`.trim().toLowerCase();

    switch (estado) {
      case 'pagado_por_cashea':
        return 'Pagado por Cashea';
      case 'completada':
      case 'completado':
        return 'Pago completado';
      case 'pendiente':
        return 'Pago pendiente';
      default:
        return estado ? `Pago ${estado}` : 'Pago no disponible';
    }
  }

  getNumeroVentaTrazabilidad(venta: { numeroVenta?: string | null; numero_venta?: string | null; numeroControl?: string | number; ventaKey?: string | null } | null | undefined): string {
    const numeroVenta = `${venta?.numeroVenta || venta?.numero_venta || ''}`.trim();

    if (numeroVenta) {
      return numeroVenta;
    }

    const numeroControl = Number(venta?.numeroControl || 0);
    if (Number.isFinite(numeroControl) && numeroControl > 0) {
      return `V-${String(numeroControl).padStart(6, '0')}`;
    }

    return `${venta?.ventaKey || ''}`.trim() || 'Venta sin identificador';
  }

  esVentaActivaEnTrazabilidad(ventaKey: string | null | undefined): boolean {
    const ventaActivaKey = this.ventaActivaHistoriaSeleccionada?.ventaKey;
    return !!ventaKey && !!ventaActivaKey && `${ventaKey}` === `${ventaActivaKey}`;
  }

  formatearFechaTrazabilidad(fecha: string | Date | null | undefined): string {
    if (!fecha) {
      return 'Fecha no disponible';
    }

    const fechaDate = new Date(fecha);
    if (Number.isNaN(fechaDate.getTime())) {
      return 'Fecha no disponible';
    }

    return fechaDate.toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
    this.pacienteParaNuevaHistoria = null;
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
    this.resetearImportacionPresupuestoHistoria();

    // Resetear el formulario completo
    this.historiaForm.reset();
    this.resetearCamposSelectDeHistoria();
    this.historiaForm.patchValue({ paciente: null }, { emitEvent: false });

    // Limpiar el FormArray de recomendaciones
    this.recomendaciones.clear();

    // AGREGAR UNA RECOMENDACIÓN POR DEFECTO 
    this.agregarRecomendacion();

    // Resetear estados de facturación
    this.medicoSeleccionado = null;
    this.mostrarSelectLentesContacto = false;

    // Resetear arrays de visibilidad 
    this.mostrarMedidasProgresivo = [false];
    this.mostrarTipoLentesContacto = [false];
    this.mostrarMaterialPersonalizado = [false];

    // Forzar detección de cambios
    this.cdr.detectChanges();
  }

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

    if (typeof valor === 'object' && valor !== null) {
      if (valor.value !== undefined) {
        return this.formatNumeroOptico(valor.value);
      }
      if (valor.label !== undefined) {
        return this.formatNumeroOptico(valor.label);
      }
      return '—';
    }

    return this.formatNumeroOptico(valor);
  }

  private formatNumeroOptico(valor: any): string {
    if (valor === null || valor === undefined || valor === '') {
      return '—';
    }

    const numValor = parseFloat(valor);

    if (!isNaN(numValor)) {
      if (numValor > 0) {
        return `+${numValor}`;
      } else if (numValor < 0) {
        return numValor.toString();
      } else {
        return '0.00';
      }
    }

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

  private formatearRIF(rif: string | undefined): string {
    if (!rif) return 'No disponible';

    // Eliminar "rif" al inicio (case insensitive)
    let rifLimpio = rif.replace(/^rif/i, '');

    // Si ya tiene formato J-XXXXXXXX-X, devolverlo limpio
    if (/^[JVE]-?\d{1,9}-\d{1,2}$/i.test(rifLimpio)) {
      return rifLimpio.toUpperCase();
    }

    // Si solo tiene números, agregar J-
    if (/^\d+$/.test(rifLimpio)) {
      return `J-${rifLimpio}`;
    }

    // Si tiene formato con números y guiones pero sin letra
    if (/^\d+-\d+$/.test(rifLimpio)) {
      return `J-${rifLimpio}`;
    }

    return rifLimpio.toUpperCase();
  }

  private generarInfoSede(): string {
    const sedeKey = this.sedePacienteSeleccionado || this.sedeActiva;

    // Buscar la sede completa en las sedes disponibles
    const sede = this.sedesDisponibles.find(s => s.key === sedeKey);

    if (sede) {
      return `
      <div class="contacto-sede">
        <div class="nombre-optica">${sede.nombre_optica || 'ÓPTICA NEW VISION LENS 2020'}</div>
        <div class="direccion-linea">${sede.direccion}</div>
        <div class="contacto-linea">
          <span class="telefono">📞 ${sede.telefono}</span> | 
          <span class="email">✉️ ${sede.email}</span> | 
          <span class="rif-linea">📄 RIF: ${this.formatearRIF(sede.rif)}</span>
        </div>
      </div>
    `;
    }

    // Fallback
    return `
    <div class="contacto-sede">
      <div class="nombre-optica">ÓPTICA NEW VISION LENS 2020</div>
      <div class="direccion-linea">Sede no especificada</div>
    </div>
  `;
  }

  private formatearFechaHora(fechaIso: string | Date): string {
  if (!fechaIso) return 'No registrada';
  
  const fecha = new Date(fechaIso);
  if (isNaN(fecha.getTime())) return 'Fecha inválida';
  
  // Formatear fecha: dd/mm/yyyy
  const dia = fecha.getDate().toString().padStart(2, '0');
  const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
  const anio = fecha.getFullYear();
  
  // Formatear hora: HH:MM AM/PM
  const hora = fecha.getHours();
  const minutos = fecha.getMinutes().toString().padStart(2, '0');
  const ampm = hora >= 12 ? 'PM' : 'AM';
  const hora12 = hora % 12 || 12;
  
  return `${dia}/${mes}/${anio} ${hora12}:${minutos} ${ampm}`;
}

  imprimirHistoriaMedica() {
    // Mostrar loading mientras se genera
    this.cargando = true;

    setTimeout(() => {
      try {
        const printContent = this.generarContenidoImpresion();
        const ventana = window.open('', '_blank', 'width=1000,height=700');

        if (ventana) {
          const numeroHistoria = this.historiaSeleccionada?.nHistoria || 'Sin numero';
          const nombrePaciente = this.pacienteSeleccionado?.informacionPersonal?.nombreCompleto || 'Paciente';

          ventana.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${numeroHistoria} - ${nombrePaciente}</title>
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

  // Método para formatear fecha y hora juntas
  private generarContenidoImpresion(): string {
    const nombreEspecialista = this.obtenerNombreEspecialista(this.historiaSeleccionada);
    const cedulaEspecialista = this.obtenerCedulaEspecialista(this.historiaSeleccionada);
    const cargoEspecialista = this.obtenerCargoEspecialista(this.historiaSeleccionada);

    // Obtener datos del médico referido (para fórmula externa)
    const medicoReferido = this.obtenerNombreMedicoReferido(this.historiaSeleccionada);
    const lugarReferido = this.obtenerLugarMedicoReferido(this.historiaSeleccionada);
    const tieneMedicoReferido = this.obtenerMedicoReferido(this.historiaSeleccionada);
    const antecedentesPersonales = this.obtenerListadoHistoriaClinica('antecedentesPersonales');
    const antecedentesFamiliares = this.obtenerListadoHistoriaClinica('antecedentesFamiliares');
    const patologiasGenerales = this.obtenerPatologiasHistoriaActual();
    const notaConformidadImpresion = this.historiaSeleccionada?.conformidad?.notaConformidad || this.notaConformidad || 'No especificada';

    return `
    <div class="print-container">
      <!-- Encabezado de impresión -->
      <div class="print-header">
        <div class="header-institucion">
          ${this.generarInfoSede()}
          <p class="subtitle">Historia Médica</p>
        </div>
         <div class="header-info">
            <p><strong>Fecha/Hora:</strong> ${this.formatearFechaHora(this.historiaSeleccionada?.auditoria?.fechaCreacion)}</p>
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

      ${tieneMedicoReferido ? `
      <!-- Médico Referido (Fórmula Externa) -->
      <div class="seccion-print no-break">
        <div class="seccion-header-print">
          <h2>MÉDICO REFERIDO</h2>
        </div>
        <div class="medico-referido-print">
          <div class="medico-ref-info">
            <div class="medico-ref-nombre">
              <i class="bi bi-person-badge"></i>
              <strong>${medicoReferido}</strong>
            </div>
            <div class="medico-ref-lugar">
              <i class="bi bi-geo-alt"></i>
              ${lugarReferido}
            </div>
          </div>
          <div class="medico-ref-nota">
            <i class="bi bi-info-circle"></i>
            Esta historia corresponde a una fórmula externa emitida por el médico referido.
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Historia Clínica -->
      <div class="seccion-print no-break">
        <div class="seccion-header-print">
          <h2>HISTORIA CLÍNICA</h2>
        </div>
        <div class="datos-grid-print">
          <div class="dato-item-print">
            <label>Usa lentes:</label>
            <span>${this.formatearValorHistoriaClinica(this.obtenerValorHistoriaClinica('usuarioLentes'))}</span>
          </div>
          <div class="dato-item-print">
            <label>Cristal actual:</label>
            <span>${this.getTipoCristalActualConModelo()}</span>
          </div>
          <div class="dato-item-print">
            <label>Última graduación:</label>
            <span>${this.historiaSeleccionada?.datosConsulta?.fechaUltimaGraduacion ? this.formatearFecha(this.historiaSeleccionada.datosConsulta.fechaUltimaGraduacion) : 'No especificado'}</span>
          </div>
          <div class="dato-item-print">
            <label>Fotofobia:</label>
            <span>${this.formatearValorHistoriaClinica(this.obtenerValorHistoriaClinica('fotofobia'))}</span>
          </div>
          <div class="dato-item-print">
            <label>Alergias:</label>
            <span>${this.formatearValorHistoriaClinica(this.obtenerValorHistoriaClinica('alergicoA'))}</span>
          </div>
          <div class="dato-item-print">
            <label>Cirugía ocular:</label>
            <span>${this.formatearValorHistoriaClinica(this.obtenerValorHistoriaClinica('cirugiaOcular'))}</span>
          </div>
          <div class="dato-item-print">
            <label>Tipo de cirugía:</label>
            <span>${this.formatearValorHistoriaClinica(this.obtenerValorHistoriaClinica('cirugiaOcularDescripcion'), 'No especificada')}</span>
          </div>
          <div class="dato-item-print">
            <label>Traumatismo ocular:</label>
            <span>${this.formatearValorHistoriaClinica(this.obtenerValorHistoriaClinica('traumatismoOcular'))}</span>
          </div>
          <div class="dato-item-print">
            <label>Uso de dispositivos:</label>
            <span>${this.formatearValorHistoriaClinica(this.obtenerValorHistoriaClinica('usoDispositivo'))}</span>
          </div>
        </div>

        <!-- Antecedentes en filas -->
        <div class="antecedentes-filas">
          <div class="fila-antecedente">
            <label class="label-antecedente">Antecedentes Personales:</label>
            <div class="tags-fila">
              ${antecedentesPersonales.length > 0 ?
        antecedentesPersonales.map(ant =>
          `<span class="tag-fila">${ant}</span>`
        ).join('') :
        '<span class="tag-fila empty">No reportados</span>'
      }
            </div>
          </div>

          <div class="fila-antecedente">
            <label class="label-antecedente">Antecedentes Familiares:</label>
            <div class="tags-fila">
              ${antecedentesFamiliares.length > 0 ?
        antecedentesFamiliares.map(ant =>
          `<span class="tag-fila">${ant}</span>`
        ).join('') :
        '<span class="tag-fila empty">No reportados</span>'
      }
            </div>
          </div>

          <div class="fila-antecedente">
            <label class="label-antecedente">Patologías Generales:</label>
            <div class="tags-fila">
              ${patologiasGenerales.map(pat =>
        `<span class="tag-fila">${pat}</span>`
      ).join('') || '<span class="tag-fila empty">No reportados</span>'}
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

      <!-- Declaración de Conformidad -->
      <div class="seccion-print no-break">
        <div class="seccion-header-print">
          <h2>DECLARACIÓN DE CONFORMIDAD</h2>
        </div>
        <div class="diagnostico-grid-print">
          <div class="diagnostico-item-print full-width-print">
            <div class="diagnostico-content">
              ${notaConformidadImpresion}
            </div>
          </div>
        </div>
      </div>

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
              <div>${nombreEspecialista}</div>
              <div>C.I: ${cedulaEspecialista}</div>
              <div>${cargoEspecialista}</div>
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
        <p>Documento generado automáticamente por Óptica New Vision Lens 2020</p>
        <p class="print-date">Impreso el: ${new Date().toLocaleString('es-ES')}</p>
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
      const medidas = this.obtenerMedidasRecomendacionPersistidas(rec);
      const tipoLenteContacto = this.getTipoLenteContactoRecomendadoValor(rec);
      const cristalLabel = this.getCristalRecomendadoLabel(rec);
      const tipoCristalLabel = this.getTipoCristalRecomendadoLabel(rec);
      const monturaLabel = this.getMonturaRecomendadaLabel(rec);

      const medidasHTML = (medidas?.horizontal || medidas?.vertical || medidas?.diagonal || medidas?.puente) ? `
        <section class="recomendacion-panel-print">
          <div class="recomendacion-panel-print__header">
            <span class="recomendacion-panel-print__label">Medidas del lente</span>
          </div>
          <div class="medidas-grid-print">
            ${medidas?.horizontal ? `<div class="medida-pill-print"><label>Horizontal</label><span>${medidas.horizontal} cm</span></div>` : ''}
            ${medidas?.vertical ? `<div class="medida-pill-print"><label>Vertical</label><span>${medidas.vertical} cm</span></div>` : ''}
            ${medidas?.diagonal ? `<div class="medida-pill-print"><label>Diagonal</label><span>${medidas.diagonal} cm</span></div>` : ''}
            ${medidas?.puente ? `<div class="medida-pill-print"><label>Puente</label><span>${medidas.puente} cm</span></div>` : ''}
          </div>
        </section>
      ` : '';

      const lentesContactoHTML = tipoLenteContacto ? `
        <section class="recomendacion-panel-print recomendacion-panel-print--full">
          <div class="recomendacion-panel-print__header">
            <span class="recomendacion-panel-print__label">Lentes de contacto</span>
          </div>
          <div class="recomendacion-panel-print__value">${this.getTipoLenteContactoLabel(tipoLenteContacto)}</div>
        </section>
      ` : '';

      return `
      <div class="recomendacion-item-print">
        <div class="recomendacion-header-print">
          <div class="recomendacion-header-print__badge">Lente #${index + 1}</div>
          <div class="recomendacion-header-print__title-group">
            <strong>${tipoCristalLabel}</strong>
            ${tipoLenteContacto ? `<small>${this.getTipoLenteContactoLabel(tipoLenteContacto)}</small>` : ''}
          </div>
        </div>
        <div class="recomendacion-content-print">
          ${cristalLabel !== 'No aplica' ? `
            <section class="recomendacion-panel-print recomendacion-panel-print--highlight">
              <div class="recomendacion-panel-print__header">
                <span class="recomendacion-panel-print__label">Cristal</span>
              </div>
              <div class="recomendacion-panel-print__value">${cristalLabel}</div>
            </section>
          ` : ''}
          ${monturaLabel !== 'No especificada' ? `
            <section class="recomendacion-panel-print recomendacion-panel-print--soft">
              <div class="recomendacion-panel-print__header">
                <span class="recomendacion-panel-print__label">Monturas</span>
              </div>
              <div class="recomendacion-panel-print__value">${monturaLabel}</div>
            </section>
          ` : ''}
          ${lentesContactoHTML}
          ${medidasHTML}
          <section class="recomendacion-panel-print recomendacion-panel-print--notes recomendacion-panel-print--full">
            <div class="recomendacion-panel-print__header">
              <span class="recomendacion-panel-print__label">Observaciones</span>
            </div>
            <div class="recomendacion-panel-print__value recomendacion-panel-print__value--notes">${rec.observaciones || 'Sin observaciones'}</div>
          </section>
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
    /* Reset y configuración base */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #1a1f2e;
      background: white;
      padding: 0.4cm;
    }
    
    .print-container {
      max-width: 100%;
      background: white;
    }
    
    /* ========== ENCABEZADO MODERNO ========== */
    .print-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.2rem;
      padding-bottom: 0.8rem;
      border-bottom: 2px solid #e2e8f0;
      position: relative;
    }
    
    .print-header::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 60px;
      height: 2px;
      background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    }
    
    .header-institucion {
      flex: 1;
    }
    
    .header-institucion .nombre-optica {
      font-size: 16pt;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.3px;
      margin-bottom: 4px;
    }
    
    .header-institucion .sede-nombre {
      font-size: 10pt;
      font-weight: 500;
      color: #3b82f6;
      margin-bottom: 6px;
    }
    
    .contacto-sede {
      font-size: 7.5pt;
      color: #475569;
      line-height: 1.4;
    }
    
    .direccion-linea {
      color: #334155;
      margin-bottom: 2px;
    }
    
    .contacto-linea {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 3px;
    }
    
    .telefono, .email, .rif-linea {
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    
    .subtitle {
      font-size: 9pt;
      color: #64748b;
      margin-top: 4px;
      font-weight: 500;
    }
    
    .header-info {
      text-align: right;
      background: #f8fafc;
      padding: 8px 12px;
      border-radius: 10px;
    }
    
    .header-info p {
      font-size: 8.5pt;
      margin: 2px 0;
      color: #1e293b;
    }
    
    .header-info strong {
      font-weight: 600;
      color: #0f172a;
    }
    
    /* ========== SECCIONES ========== */
    .seccion-print {
      margin-bottom: 1.2rem;
      page-break-inside: avoid;
    }
    
    .seccion-header-print {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .seccion-header-print h2 {
      font-size: 11pt;
      font-weight: 600;
      color: #0f172a;
      letter-spacing: -0.2px;
      margin: 0;
      text-transform: uppercase;
      background: linear-gradient(135deg, #1e293b, #334155);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    
    /* ========== GRID INFORMACIÓN PACIENTE ========== */
    .info-paciente-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 8px;
    }
    
    .info-item {
      background: #f8fafc;
      border-radius: 8px;
      padding: 6px 10px;
      border: 1px solid #eef2ff;
    }
    
    .info-item.full-width {
      grid-column: span 4;
    }
    
    .info-item label {
      display: block;
      font-size: 7pt;
      font-weight: 600;
      color: #3b82f6;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 2px;
    }
    
    .info-item span {
      font-size: 9pt;
      font-weight: 500;
      color: #1e293b;
      display: block;
    }
    
    /* ========== DATOS GRID ========== */
    .datos-grid-print {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .dato-item-print {
      background: #fafcff;
      border: 1px solid #eef2ff;
      border-radius: 8px;
      padding: 6px 10px;
    }
    
    .dato-item-print label {
      font-size: 7pt;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      display: block;
      margin-bottom: 2px;
    }
    
    .dato-item-print span {
      font-size: 9pt;
      font-weight: 500;
      color: #0f172a;
      display: block;
    }
    
    /* ========== ANTECEDENTES ========== */
    .antecedentes-filas {
      margin: 8px 0;
    }
    
    .fila-antecedente {
      display: flex;
      align-items: flex-start;
      margin-bottom: 8px;
      padding: 6px 8px;
      background: #f8fafc;
      border-radius: 8px;
    }
    
    .label-antecedente {
      font-size: 8pt;
      font-weight: 600;
      color: #3b82f6;
      min-width: 140px;
      margin-right: 12px;
    }
    
    .tags-fila {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    
    .tag-fila {
      background: white;
      border: 1px solid #e2e8f0;
      padding: 3px 8px;
      border-radius: 20px;
      font-size: 7.5pt;
      color: #1e293b;
    }
    
    .tag-fila.empty {
      color: #94a3b8;
      font-style: italic;
      background: #f1f5f9;
    }
    
    /* ========== TABLAS MODERNAS ========== */
    .tabla-print {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      font-size: 7.5pt;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    
    .tabla-print th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 600;
      padding: 8px 6px;
      border: 1px solid #e2e8f0;
      text-align: center;
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    .tabla-print td {
      padding: 6px;
      border: 1px solid #eef2ff;
      text-align: center;
      background: white;
    }
    
    .tabla-print td:first-child {
      font-weight: 600;
      background: #fafcff;
    }
    
    .merged-cell-print {
      background: #f8fafc;
      font-weight: 500;
    }
    
    /* ========== EXÁMENES ========== */
    .examen-subseccion-print {
      margin-bottom: 16px;
    }
    
    .examen-subseccion-print h3 {
      font-size: 9pt;
      font-weight: 600;
      color: #334155;
      margin-bottom: 6px;
      padding-left: 8px;
      border-left: 3px solid #3b82f6;
    }
    
    .hora-evaluacion-print {
      background: #fef9e6;
      border-left: 3px solid #f59e0b;
      padding: 6px 12px;
      margin: 8px 0;
      border-radius: 8px;
      font-size: 8pt;
      color: #92400e;
    }
    
    /* ========== DIAGNÓSTICO ========== */
    .diagnostico-grid-print {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 8px 0;
    }
    
    .diagnostico-item-print {
      background: #f8fafc;
      border-radius: 10px;
      padding: 10px;
    }

    .diagnostico-item-print.full-width-print {
      grid-column: 1 / -1;
    }
    
    .diagnostico-item-print label {
      font-size: 8pt;
      font-weight: 600;
      color: #3b82f6;
      display: block;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    
    .diagnostico-content {
      font-size: 8.5pt;
      color: #1e293b;
      line-height: 1.4;
    }
    
    /* ========== RECOMENDACIONES ========== */
    .recomendacion-item-print {
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      border: 1px solid #dbe5f0;
      border-radius: 14px;
      padding: 12px;
      margin: 10px 0;
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);
    }

    .recomendacion-header-print {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 10px;
    }

    .recomendacion-header-print__badge {
      font-size: 8pt;
      font-weight: 700;
      color: #19538a;
      background: #eef6ff;
      padding: 4px 10px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
    }

    .recomendacion-header-print__title-group {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      text-align: right;
      gap: 2px;
    }

    .recomendacion-header-print__title-group strong {
      font-size: 8.5pt;
      color: #1e293b;
      line-height: 1.35;
    }

    .recomendacion-header-print__title-group small {
      font-size: 7pt;
      color: #64748b;
    }
    
    .recomendacion-content-print {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }

    .recomendacion-panel-print {
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid #dbe5f0;
      border-radius: 12px;
      padding: 10px;
    }

    .recomendacion-panel-print--highlight {
      background: linear-gradient(135deg, #f9fcff 0%, #edf5ff 100%);
      border-color: #bfd9f5;
    }

    .recomendacion-panel-print--soft {
      background: linear-gradient(135deg, #fffdfa 0%, #fff1dd 100%);
      border-color: #f1d2a4;
    }

    .recomendacion-panel-print--notes {
      background: linear-gradient(135deg, #fbfcfe 0%, #f4f7fb 100%);
    }

    .recomendacion-panel-print--full {
      grid-column: span 2;
    }

    .recomendacion-panel-print__label {
      font-size: 6.5pt;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .recomendacion-panel-print__value {
      font-size: 8pt;
      color: #1e293b;
      line-height: 1.45;
    }

    .recomendacion-panel-print__value--notes {
      color: #475569;
    }

    .medidas-grid-print {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .medida-pill-print {
      background: #f8fbff;
      border: 1px solid #d7e4f2;
      border-radius: 10px;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .medida-pill-print label {
      font-size: 6.2pt;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.06em;
      font-weight: 600;
    }

    .medida-pill-print span {
      font-size: 7.8pt;
      color: #1e293b;
      font-weight: 700;
    }
    
    /* ========== FIRMAS ========== */
    .firmas-grid-print {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin: 15px 0;
    }
    
    .firma-item-print {
      text-align: center;
    }
    
    .firma-label-print {
      font-size: 9pt;
      font-weight: 600;
      color: #334155;
      margin-bottom: 8px;
    }
    
    .firma-space-print {
      height: 50px;
      border-bottom: 1px solid #cbd5e1;
      margin-bottom: 8px;
    }
    
    .firma-info-print {
      font-size: 7.5pt;
      color: #64748b;
    }
    
    .asesor-responsable-print {
      text-align: center;
      margin-top: 15px;
      padding-top: 12px;
      border-top: 1px dashed #e2e8f0;
    }
    
    /* ========== MÉDICO REFERIDO ========== */
    .medico-referido-print {
      background: linear-gradient(135deg, #fef9e6, #fff7ed);
      border-radius: 12px;
      padding: 10px 14px;
      border-left: 4px solid #f59e0b;
    }
    
    .medico-ref-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .medico-ref-nombre {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 9pt;
    }
    
    .medico-ref-nombre strong {
      color: #92400e;
    }
    
    .medico-ref-lugar {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 8pt;
      color: #b45309;
      padding-left: 22px;
    }
    
    .medico-ref-nota {
      background: white;
      border-radius: 8px;
      padding: 6px 10px;
      margin-top: 8px;
      font-size: 7pt;
      color: #78716c;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    /* ========== PIE DE PÁGINA ========== */
    .print-footer {
      text-align: center;
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      font-size: 7pt;
      color: #94a3b8;
    }
    
    .print-date {
      margin-top: 4px;
    }
    
    /* ========== UTILIDADES ========== */
    .page-break {
      page-break-before: always;
    }
    
    .no-break {
      page-break-inside: avoid;
    }
    
    /* ========== MEDIA PRINT ========== */
    @media print {
      @page {
        margin: 0.8cm;
        size: A4;
      }
      
      body {
        margin: 0;
        padding: 0;
      }
      
      * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `;
}

  handleKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || (event.altKey && event.key !== 'ArrowDown')) {
      return;
    }

    const targetElement = event.target as HTMLElement | null;
    const isInsideDropdown = targetElement?.closest('.ng-dropdown-panel');
    if (isInsideDropdown && !this.isSideNavigationKey(event)) {
      return;
    }

    const activeElement = document.activeElement as HTMLElement | null;
    if (!activeElement) {
      return;
    }

    const controlName =
      (targetElement ? this.getControlNameFromElement(targetElement) : null)
      || this.getControlNameFromElement(activeElement);

    if (!controlName || !this.isNavigableExamField(controlName)) return;

    const selectElement = this.getNgSelectElement(targetElement || activeElement);
    const isSelectOpen = !!selectElement?.classList.contains('ng-select-opened');

    if (selectElement && isSelectOpen) {
      if (event.key === 'ArrowRight' || (event.key === 'Tab' && !event.shiftKey)) {
        this.preventNavigationEvent(event);
        this.closeNgSelect(selectElement);
        this.navigateToNextField(controlName);
      } else if (event.key === 'ArrowLeft' || (event.key === 'Tab' && event.shiftKey)) {
        this.preventNavigationEvent(event);
        this.closeNgSelect(selectElement);
        this.navigateToPreviousField(controlName);
      }

      return;
    }

    if (selectElement && this.shouldOpenSelectWithKeyboard(event)) {
      this.preventNavigationEvent(event);
      this.openNgSelect(selectElement);
      return;
    }

    switch (event.key) {
      case 'Enter':
        this.preventNavigationEvent(event);
        if (selectElement) {
          this.openNgSelect(selectElement);
        } else {
          this.navigateToNextField(controlName);
        }
        break;

      case 'ArrowRight':
        this.preventNavigationEvent(event);
        this.navigateToNextField(controlName);
        break;

      case 'ArrowLeft':
        this.preventNavigationEvent(event);
        this.navigateToPreviousField(controlName);
        break;

      case 'ArrowDown':
        this.preventNavigationEvent(event);
        this.navigateDown(controlName);
        break;

      case 'ArrowUp':
        this.preventNavigationEvent(event);
        this.navigateUp(controlName);
        break;

      case 'Tab':
        this.preventNavigationEvent(event);
        if (event.shiftKey) {
          this.navigateToPreviousField(controlName);
        } else {
          this.navigateToNextField(controlName);
        }
        break;
    }
  }

  private preventNavigationEvent(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  private isSideNavigationKey(event: KeyboardEvent): boolean {
    return event.key === 'ArrowLeft'
      || event.key === 'ArrowRight'
      || event.key === 'Tab';
  }

  private getControlNameFromElement(element: HTMLElement): string | null {
    const ngSelectElement = this.getNgSelectElement(element);
    if (ngSelectElement) {
      const controlName = ngSelectElement.getAttribute('formControlName');
      if (controlName) {
        return controlName;
      }
    }

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

  private getNgSelectElement(element: HTMLElement | null): HTMLElement | null {
    if (!element) {
      return null;
    }

    if (element.classList.contains('ng-select')) {
      return element;
    }

    return element.closest('.ng-select');
  }

  private shouldOpenSelectWithKeyboard(event: KeyboardEvent): boolean {
    return event.key === ' ' || event.key === 'Spacebar' || event.key === 'F4'
      || (event.altKey && event.key === 'ArrowDown');
  }

  private openNgSelect(selectElement: HTMLElement): void {
    if (selectElement.classList.contains('ng-select-opened')) {
      return;
    }

    const container = selectElement.querySelector('.ng-select-container') as HTMLElement | null;
    container?.click();

    setTimeout(() => {
      const searchInput = selectElement.querySelector('input') as HTMLInputElement | null;
      searchInput?.focus();
      this.fixSelectOverflow();
    }, 0);
  }

  private closeNgSelect(selectElement: HTMLElement): void {
    if (!selectElement.classList.contains('ng-select-opened')) {
      return;
    }

    const container = selectElement.querySelector('.ng-select-container') as HTMLElement | null;
    container?.click();
  }

  private isNavigableExamField(controlName: string): boolean {
    return this.getNavigationPosition(controlName) !== null;
  }

  private focusOnField(fieldName: string): void {
    this.isNavigating = true;

    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement.blur) {
      activeElement.blur();
    }

    setTimeout(() => {
      const previousActive = document.querySelectorAll('.campo-activo');
      previousActive.forEach(el => {
        el.classList.remove('campo-activo');
      });

      let element: HTMLElement | null = null;

      const elementsByName = document.querySelectorAll(`[formControlName="${fieldName}"]`);
      if (elementsByName.length > 0) {
        element = elementsByName[0] as HTMLElement;
      }

      if (!element) {
        const ngSelects = document.querySelectorAll(`.ng-select[formControlName="${fieldName}"]`);
        if (ngSelects.length > 0) {
          const container = ngSelects[0].querySelector('.ng-select-container') as HTMLElement;
          if (container) {
            element = container;
          }
        }
      }

      if (!element) {
        const byClass = document.querySelectorAll(`.campo-select [formControlName="${fieldName}"]`);
        if (byClass.length > 0) {
          element = byClass[0] as HTMLElement;
        }
      }

      if (element) {
        const relatedSelect = element.classList.contains('ng-select-container')
          ? element.closest('.ng-select') as HTMLElement | null
          : this.getNgSelectElement(element);

        if (relatedSelect) {
          this.closeNgSelect(relatedSelect);
        }

        if (element.tagName === 'INPUT') {
          element.focus();
          (element as HTMLInputElement).select();
          element.classList.add('campo-activo');

        } else if (element.classList.contains('ng-select-container')) {
          element.focus();
          element.classList.add('campo-activo');

          const ngSelect = element.closest('.ng-select');
          if (ngSelect) {
            ngSelect.classList.add('campo-activo');
          }

        } else {
          element.focus();
          element.classList.add('campo-activo');
        }

        this.scrollToElement(element);

      } else {
        console.error('❌ NO se encontró el elemento para:', fieldName);

        this.focusByFallback(fieldName);
      }

      this.isNavigating = false;
    }, 50);
  }

  private scrollToElement(element: HTMLElement): void {
    const modalBody = document.querySelector('.modal-body-moderno');
    if (modalBody) {
      const elementRect = element.getBoundingClientRect();
      const modalRect = modalBody.getBoundingClientRect();

      if (elementRect.top < modalRect.top || elementRect.bottom > modalRect.bottom) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  private focusByFallback(fieldName: string): void {
    const allFields = this.navigationRows.flat();

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
      // Restaurar placeholders en caso de que no se muestren correctamente
      setTimeout(() => this.restaurarPlaceholdersDelModal(), 350);
    }, 300);
  }

  setupGlobalKeyListeners(): void {
    document.removeEventListener('keydown', this.boundHandleKeydown);
    if (this.boundMouseDownHandler) {
      document.removeEventListener('mousedown', this.boundMouseDownHandler);
    }
    if (this.boundKeyboardModeHandler) {
      document.removeEventListener('keydown', this.boundKeyboardModeHandler);
    }

    this.boundHandleKeydown = this.handleKeydown.bind(this);
    this.boundMouseDownHandler = () => {
      document.body.classList.add('using-mouse');
    };
    this.boundKeyboardModeHandler = () => {
      document.body.classList.remove('using-mouse');
    };

    document.addEventListener('keydown', this.boundHandleKeydown, true);
    document.addEventListener('mousedown', this.boundMouseDownHandler);
    document.addEventListener('keydown', this.boundKeyboardModeHandler, true);

    const modal = document.getElementById('historiaModal');
    if (modal) {
      modal.removeEventListener('keydown', this.boundHandleKeydown, true);
      modal.addEventListener('keydown', this.boundHandleKeydown, true);
    }
  }



  // Métodos para navegación por teclado
  private initializeNavigationMaps(): void {
    this.navigationRows = [
      ['len_esf_od', 'len_cil_od', 'len_eje_od', 'len_add_od', 'len_av_lejos_od', 'len_av_cerca_od'],
      ['len_esf_oi', 'len_cil_oi', 'len_eje_oi', 'len_add_oi', 'len_av_lejos_oi', 'len_av_cerca_oi'],
      ['len_av_lejos_bi', 'len_av_cerca_bi'],
      ['avsc_lejos_od', 'avsc_cerca_od', 'avae_od', 'otros_od'],
      ['avsc_lejos_oi', 'avsc_cerca_oi', 'avae_oi', 'otros_oi'],
      ['ref_esf_od', 'ref_cil_od', 'ref_eje_od', 'ref_add_od', 'ref_avccl_od', 'ref_avccc_od'],
      ['ref_esf_oi', 'ref_cil_oi', 'ref_eje_oi', 'ref_add_oi', 'ref_avccl_oi', 'ref_avccc_oi'],
      ['ref_avccl_bi', 'ref_avccc_bi'],
      ['ref_final_esf_od', 'ref_final_cil_od', 'ref_final_eje_od', 'ref_final_add_od', 'ref_final_alt_od', 'ref_final_dp_od'],
      ['ref_final_esf_oi', 'ref_final_cil_oi', 'ref_final_eje_oi', 'ref_final_add_oi', 'ref_final_alt_oi', 'ref_final_dp_oi']
    ];
  }

  // Navegar al siguiente campo (Enter/→)
  private navigateToNextField(currentField: string): void {
    this.isNavigating = true;

    const position = this.getNavigationPosition(currentField);
    const nextField = position ? this.resolveFieldAt(position.rowIndex, position.columnIndex + 1, 'next') : null;

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

    const position = this.getNavigationPosition(currentField);
    const previousField = position ? this.resolveFieldAt(position.rowIndex, position.columnIndex - 1, 'previous') : null;

    if (previousField) {
      setTimeout(() => {
        this.focusOnField(previousField);
        this.isNavigating = false;
      }, 50);
    } else {
      this.isNavigating = false;
    }
  }

  // Navegar hacia abajo (↓)
  private navigateDown(currentField: string): void {
    this.isNavigating = true;

    const position = this.getNavigationPosition(currentField);
    const nextField = position ? this.resolveFieldAt(position.rowIndex + 1, position.columnIndex, 'down') : null;

    if (nextField) {
      setTimeout(() => {
        this.focusOnField(nextField);
        this.isNavigating = false;
      }, 50);
      return;
    }

    this.isNavigating = false;
  }

  // Navegar hacia arriba (↑)
  private navigateUp(currentField: string): void {
    this.isNavigating = true;

    const position = this.getNavigationPosition(currentField);
    const previousField = position ? this.resolveFieldAt(position.rowIndex - 1, position.columnIndex, 'up') : null;

    if (previousField) {
      setTimeout(() => {
        this.focusOnField(previousField);
        this.isNavigating = false;
      }, 50);
      return;
    }

    this.isNavigating = false;
  }

  private getNavigationPosition(fieldName: string): { rowIndex: number, columnIndex: number } | null {
    for (let rowIndex = 0; rowIndex < this.navigationRows.length; rowIndex++) {
      const columnIndex = this.navigationRows[rowIndex].indexOf(fieldName);
      if (columnIndex !== -1) {
        return { rowIndex, columnIndex };
      }
    }

    return null;
  }

  private resolveFieldAt(
    rowIndex: number,
    columnIndex: number,
    direction: 'next' | 'previous' | 'up' | 'down'
  ): string | null {
    if (direction === 'next') {
      if (rowIndex < 0 || rowIndex >= this.navigationRows.length) {
        return null;
      }

      const currentRow = this.navigationRows[rowIndex];
      if (columnIndex < currentRow.length) {
        return currentRow[columnIndex];
      }

      const nextRow = this.navigationRows[rowIndex + 1];
      return nextRow?.[0] ?? null;
    }

    if (direction === 'previous') {
      if (rowIndex < 0 || rowIndex >= this.navigationRows.length) {
        return null;
      }

      if (columnIndex >= 0) {
        return this.navigationRows[rowIndex][columnIndex] ?? null;
      }

      const previousRow = this.navigationRows[rowIndex - 1];
      return previousRow?.[previousRow.length - 1] ?? null;
    }

    if (rowIndex < 0 || rowIndex >= this.navigationRows.length) {
      return null;
    }

    const targetRow = this.navigationRows[rowIndex];
    if (!targetRow?.length) {
      return null;
    }

    const safeColumnIndex = Math.min(columnIndex, targetRow.length - 1);
    return targetRow[safeColumnIndex] ?? null;
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
      'avsc_lejos_od', 'avsc_cerca_od', 'avae_od', 'otros_od',
      'avsc_lejos_oi', 'avsc_cerca_oi', 'avae_oi', 'otros_oi'
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
    document.removeEventListener('keydown', this.boundHandleKeydown, true);

    const modal = document.getElementById('historiaModal');
    if (modal) {
      modal.removeEventListener('keydown', this.boundHandleKeydown, true);
    }

    if (this.boundMouseDownHandler) {
      document.removeEventListener('mousedown', this.boundMouseDownHandler);
    }

    if (this.boundKeyboardModeHandler) {
      document.removeEventListener('keydown', this.boundKeyboardModeHandler, true);
    }

    const activeFields = document.querySelectorAll('.campo-activo');
    activeFields.forEach(field => field.classList.remove('campo-activo'));

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

  // En tu componente
  private obtenerValorHistoriaClinica(campo: keyof Antecedentes): any {
    const valorAntecedente = this.historiaSeleccionada?.antecedentes?.[campo];
    if (this.tieneValorHistoriaClinica(valorAntecedente)) {
      return valorAntecedente;
    }

    return this.pacienteSeleccionado?.historiaClinica?.[campo];
  }

  private obtenerListadoHistoriaClinica(campo: 'antecedentesPersonales' | 'antecedentesFamiliares'): string[] {
    const listaAntecedente = this.procesarCampoArray(this.historiaSeleccionada?.antecedentes?.[campo]);
    if (listaAntecedente.length > 0) {
      return listaAntecedente;
    }

    return this.procesarCampoArray(this.pacienteSeleccionado?.historiaClinica?.[campo]);
  }

  private obtenerPatologiasHistoriaActual(): string[] {
    const patologiasAntecedente = this.procesarPatologias(this.historiaSeleccionada?.antecedentes?.patologias);
    if (patologiasAntecedente.length > 0) {
      return patologiasAntecedente;
    }

    return this.procesarPatologias(this.pacienteSeleccionado?.historiaClinica?.patologias);
  }

  private formatearValorHistoriaClinica(valor: any, valorVacio: string = 'No especificado'): string {
    if (valor === undefined || valor === null || valor === '') {
      return valorVacio;
    }

    if (typeof valor === 'boolean') {
      return valor ? 'Sí' : 'No';
    }

    return String(valor);
  }

  private tieneValorHistoriaClinica(valor: any): boolean {
    if (Array.isArray(valor)) {
      return valor.length > 0;
    }

    return valor !== undefined && valor !== null && valor !== '';
  }

  // Método genérico para procesar cualquier campo que pueda venir en diferentes formatos
  procesarCampoArray(valor: any): string[] {
    if (!valor) return [];

    // Si ya es un array
    if (Array.isArray(valor)) {
      return valor;
    }

    // Si es un string
    if (typeof valor === 'string') {
      const strValue = valor.trim();
      if (!strValue) return [];

      // Determinar el separador (| o ,)
      if (strValue.includes('|')) {
        return strValue.split('|')
          .map(item => item.trim())
          .filter(item => item !== '');
      }

      if (strValue.includes(',')) {
        return strValue.split(',')
          .map(item => item.trim())
          .filter(item => item !== '');
      }

      // Si es un string sin separadores
      return [strValue];
    }

    return [];
  }

  // Método específico para patologias
  private procesarPatologias(patologias: any): string[] {
    if (!patologias) return [];

    // Si ya es un array
    if (Array.isArray(patologias)) {
      return patologias;
    }

    // Si es un string
    if (typeof patologias === 'string') {
      const strValue = patologias.trim();
      if (!strValue) return [];

      // Probar primero con | como separador
      if (strValue.includes('|')) {
        return strValue.split('|')
          .map(item => item.trim())
          .filter(item => item !== '');
      }

      // Probar con , como separador
      if (strValue.includes(',')) {
        return strValue.split(',')
          .map(item => item.trim())
          .filter(item => item !== '');
      }

      // Si no hay separadores, es un solo elemento
      return [strValue];
    }

    return [];
  }

  onCristalChange(event: any, index: number): void {
    const valorString = this.obtenerValorCristalComoString(event);
    const mostrarMedidas = this.requiereMedidas(valorString);
    const esLentesContacto = this.esLentesContacto(valorString);

    const recomendacionGroup = this.recomendaciones.at(index) as FormGroup;
    const productoCristalControl = recomendacionGroup.get('productoCristal');
    const productoMonturaControl = recomendacionGroup.get('productoMontura');

    // Resetear el campo material a array vacío
    recomendacionGroup.get('material')?.setValue([]);
    recomendacionGroup.get('material')?.markAsPristine();
    recomendacionGroup.get('material')?.markAsUntouched();

    // Resetear material personalizado
    recomendacionGroup.get('materialPersonalizado')?.setValue('');
    this.mostrarMaterialPersonalizado[index] = false;

    // Actualizar visibilidad
    this.mostrarMedidasProgresivo[index] = mostrarMedidas;
    this.mostrarTipoLentesContacto[index] = esLentesContacto;
    productoCristalControl?.setValue(null);

    this.getCategoriasRecomendadas(index).controls
      .map(control => control as FormGroup)
      .filter(control => {
        const categoria = String(control.get('categoria')?.value || '').trim().toLowerCase();
        return this.esCategoriaCristal(categoria) || this.esCategoriaLenteContacto(categoria);
      })
      .forEach(control => control.get('producto')?.setValue(null, { emitEvent: false }));

    const tipoLentesControl = recomendacionGroup.get('tipoLentesContacto');
    const medidaHorizontalControl = recomendacionGroup.get('medidaHorizontal');
    const medidaVerticalControl = recomendacionGroup.get('medidaVertical');
    const medidaDiagonalControl = recomendacionGroup.get('medidaDiagonal');
    const medidaPuenteControl = recomendacionGroup.get('medidaPuente');

    // Manejar validadores y valores para medidas
    if (mostrarMedidas) {
      medidaHorizontalControl?.setValidators([Validators.required]);
      medidaVerticalControl?.setValidators([Validators.required]);
      medidaDiagonalControl?.setValidators([Validators.required]);
      medidaPuenteControl?.setValidators([Validators.required]);

    } else {
      medidaHorizontalControl?.clearValidators();
      medidaVerticalControl?.clearValidators();
      medidaDiagonalControl?.clearValidators();
      medidaPuenteControl?.clearValidators();

      medidaHorizontalControl?.setValue('');
      medidaVerticalControl?.setValue('');
      medidaDiagonalControl?.setValue('');
      medidaPuenteControl?.setValue('');
    }

    if (esLentesContacto) {
      tipoLentesControl?.setValidators([Validators.required]);
      if (!tipoLentesControl?.value) {
        tipoLentesControl?.setValue(null);
      } else {
        if (tipoLentesControl.value === '') {
          tipoLentesControl?.setValue(null);
        }
      }
    } else {
      tipoLentesControl?.clearValidators();
      tipoLentesControl?.setValue(null);
    }

    if (esLentesContacto) {
      recomendacionGroup.get('montura')?.setValue('');
      productoMonturaControl?.setValue(null);
    }

    // Actualizar validación de todos los campos
    medidaHorizontalControl?.updateValueAndValidity();
    medidaVerticalControl?.updateValueAndValidity();
    medidaDiagonalControl?.updateValueAndValidity();
    medidaPuenteControl?.updateValueAndValidity();
    tipoLentesControl?.updateValueAndValidity();

    // Forzar detección de cambios
    this.sincronizarControlesLegacyRecomendacion(index);
    setTimeout(() => {
      this.cdr.detectChanges();

    }, 0);
  }



  private esMonofocalDigital(valor: string): boolean {
    if (!valor) return false;
    return valor.toUpperCase() === 'MONOFOCAL_DIGITAL';
  }

  private obtenerValorCristalComoString(cristal: any): string {
    if (!cristal) return '';

    // Si es string
    if (typeof cristal === 'string') {
      return cristal;
    }

    // Si es objeto con propiedad value
    if (cristal && typeof cristal === 'object') {
      if ('value' in cristal && cristal.value) {
        return String(cristal.value);
      }
      if ('label' in cristal && cristal.label) {
        return String(cristal.label);
      }
    }

    return String(cristal);
  }

  private obtenerCategoriasPersistidasRecomendacion(recomendacion: Recomendaciones | null | undefined): CategoriaProductoRecomendado[] {
    const categorias = recomendacion?.seleccionProductos?.categorias;
    if (Array.isArray(categorias) && categorias.length > 0) {
      return categorias.filter(categoria => !!categoria?.categoria);
    }

    const derivadas: CategoriaProductoRecomendado[] = [];

    if (recomendacion?.seleccionProductos?.cristal) {
      derivadas.push({
        categoria: String(recomendacion.seleccionProductos.cristal.categoria || (recomendacion?.tipoLentesContacto ? 'lentes de contacto' : 'cristales')).trim().toLowerCase(),
        producto: recomendacion.seleccionProductos.cristal
      });
    }

    if (recomendacion?.seleccionProductos?.montura) {
      derivadas.push({ categoria: 'monturas', producto: recomendacion.seleccionProductos.montura });
    }

    return derivadas;
  }

  private obtenerProductoPorCategoriaRecomendacion(
    recomendacion: Recomendaciones | null | undefined,
    categoriaObjetivo: string
  ): ProductoRecomendadoHistoria | null {
    return this.obtenerCategoriasPersistidasRecomendacion(recomendacion)
      .find(categoria => String(categoria.categoria || '').trim().toLowerCase() === categoriaObjetivo)?.producto || null;
  }

  private tieneCategoriaClinica(recomendacion: Recomendaciones | null | undefined): boolean {
    return this.obtenerCategoriasPersistidasRecomendacion(recomendacion)
      .some(categoria => this.esCategoriaCristal(categoria.categoria) || this.esCategoriaLenteContacto(categoria.categoria));
  }

  // Método para verificar si es progresivo
  private esCristalProgresivo(valor: string): boolean {
    if (!valor) return false;
    return valor.toUpperCase().includes('PROGRESIVO');
  }

  // Método para verificar si es lentes de contacto
  private esLentesContacto(valor: string): boolean {
    if (!valor) return false;

    const valorNormalizado = valor.toString().toUpperCase().trim();

    // Detectar diferentes formatos posibles
    return valorNormalizado === 'LENTES_CONTACTO' ||
      valorNormalizado === 'LENTES DE CONTACTO' ||
      valorNormalizado.includes('LENTES') && valorNormalizado.includes('CONTACTO');
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

  getTipoCristalActualConModelo(): string {
    const tipoCristal = this.historiaSeleccionada?.datosConsulta?.tipoCristalActual;
    const modeloContacto = this.historiaSeleccionada?.datosConsulta?.tipoLentesContacto;

    if (!tipoCristal) return 'No especificado';

    const cristalEncontrado = TIPOS_CRISTALES.find(c => c.value === tipoCristal);
    let texto = cristalEncontrado?.label || tipoCristal;

    if (tipoCristal === 'LENTES_CONTACTO' && modeloContacto) {
      const modeloEncontrado = TIPOS_LENTES_CONTACTO.find(m => m.value === modeloContacto || m.label === modeloContacto);
      texto += ` - ${modeloEncontrado?.label || modeloContacto}`;
    }

    return texto;
  }

  getTipoCristalRecomendado(cristal: any): string {
    if (!cristal) return 'No especificado';

    if (typeof cristal === 'string') {
      const encontrado = TIPOS_CRISTALES.find(c => c.value === cristal || c.label === cristal);
      return encontrado?.label || cristal;
    }

    if (cristal.label) {
      return cristal.label;
    }

    return 'No especificado';
  }

  getCristalRecomendadoLabel(recomendacion: Recomendaciones | null | undefined): string {
    if (!this.tieneCategoriaClinica(recomendacion)) {
      return 'No aplica';
    }

    const productoCristal = this.obtenerProductoClinicoRecomendacion(recomendacion);
    if (productoCristal) {
      return this.getProductoRecomendadoLabel(productoCristal);
    }

    return this.getTipoCristalRecomendado(recomendacion?.cristal);
  }

  getTipoCristalRecomendadoLabel(recomendacion: Recomendaciones | null | undefined): string {
    if (!this.tieneCategoriaClinica(recomendacion)) {
      return 'Selección personalizada';
    }

    const productoCristal = this.obtenerProductoClinicoRecomendacion(recomendacion);
    const tipoCristal = this.obtenerTipoCristalDesdeProducto(productoCristal);

    if (tipoCristal) {
      return this.getTipoCristalRecomendado(tipoCristal);
    }

    return this.getTipoCristalRecomendado(recomendacion?.cristal);
  }

  getTipoLenteContactoRecomendado(recomendacion: Recomendaciones | null | undefined): string | null {
    const productoClinico = this.obtenerProductoClinicoRecomendacion(recomendacion);
    const tipoLente = this.obtenerTipoLenteContactoDesdeProducto(productoClinico);
    return String(tipoLente || recomendacion?.tipoLentesContacto || '').trim() || null;
  }

  getMedidasRecomendacion(recomendacion: Recomendaciones | null | undefined): ProductoRecomendadoHistoria['medidas'] | null {
    return this.obtenerMedidasRecomendacionPersistidas(recomendacion) || null;
  }

  getMaterialesRecomendadosLabel(recomendacion: Recomendaciones | null | undefined): string {
    if (this.tieneCategoriaClinica(recomendacion)) {
      return 'Incluido en el cristal seleccionado';
    }

    const materiales = recomendacion?.seleccionProductos?.materiales;
    if (materiales && materiales.length > 0) {
      return this.getProductosRecomendadosLabel(materiales);
    }

    const materialLabel = this.getMaterialLabel(recomendacion?.material || []);
    const materialPersonalizado = String(recomendacion?.materialPersonalizado || '').trim();

    if (!materialPersonalizado) {
      return materialLabel;
    }

    if (materialLabel === 'No especificado') {
      return materialPersonalizado;
    }

    if (materialLabel.toUpperCase().includes('OTRO')) {
      return `${materialLabel}: ${materialPersonalizado}`;
    }

    return `${materialLabel}, ${materialPersonalizado}`;
  }

  getMonturaRecomendadaLabel(recomendacion: Recomendaciones | null | undefined): string {
    const monturaDesdeCategorias = this.obtenerProductoPorCategoriaRecomendacion(recomendacion, 'monturas');
    if (monturaDesdeCategorias) {
      return this.getProductoRecomendadoLabel(monturaDesdeCategorias);
    }

    if (recomendacion?.seleccionProductos?.montura) {
      return this.getProductoRecomendadoLabel(recomendacion.seleccionProductos.montura);
    }

    return recomendacion?.montura || 'No especificada';
  }

  getFiltrosAditivosRecomendadosLabel(recomendacion: Recomendaciones | null | undefined): string {
    return this.getProductosRecomendadosLabel(recomendacion?.seleccionProductos?.filtrosAditivos);
  }

  getCategoriasRecomendadasLabel(recomendacion: Recomendaciones | null | undefined): string {
    const categorias = this.obtenerCategoriasPersistidasRecomendacion(recomendacion);

    if (categorias.length === 0) {
      return 'Sin categorías vinculadas';
    }

    return categorias.map(categoria => {
      const nombreCategoria = this.getLabelCategoriaRecomendable(categoria.categoria);
      const producto = categoria.producto ? this.getProductoRecomendadoLabel(categoria.producto) : 'Sin producto seleccionado';
      return `${nombreCategoria}: ${producto}`;
    }).join(' | ');
  }

  getTipoLenteContactoLabel(valor: string): string {
    if (!valor) return 'No especificado';
    const encontrado = TIPOS_LENTES_CONTACTO.find(t => t.value === valor || t.label === valor);
    return encontrado?.label || valor;
  }

  getModeloLenteContactoActual(): string {
    const modelo = this.historiaSeleccionada?.datosConsulta?.tipoLentesContacto;
    if (!modelo) return '';

    const encontrado = TIPOS_LENTES_CONTACTO.find(m =>
      m.value === modelo || m.label === modelo
    );

    return encontrado?.label || modelo;
  }

  // Método para verificar si el médico seleccionado es oftalmólogo (ignorando EXTERNO)
  esOftalmologoSeleccionado(): boolean {
    const medico = this.historiaForm.get('medico')?.value;
    if (!medico || typeof medico !== 'object' || medico.id === 'EXTERNO') return false;

    const cargo = medico.cargoId?.toLowerCase() || medico.cargo?.toLowerCase() || '';
    return cargo === 'oftalmologo' || cargo.includes('oftalmologo');
  }

  // Método para verificar si el médico seleccionado es optometrista (ignorando EXTERNO)
  esOptometristaSeleccionado(): boolean {
    const medico = this.historiaForm.get('medico')?.value;
    if (!medico || typeof medico !== 'object' || medico.id === 'EXTERNO') return false;

    const cargo = medico.cargoId?.toLowerCase() || medico.cargo?.toLowerCase() || '';
    return cargo === 'optometrista' || cargo.includes('optometrista');
  }

  // Método para obtener nombre del médico (con manejo de EXTERNO)
  getNombreMedicoSeleccionado(): string {
    const medico = this.historiaForm.get('medico')?.value;
    if (!medico) return 'seleccionado';

    if (medico.id === 'EXTERNO') {
      return 'Médico Externo';
    }

    if (typeof medico === 'object' && medico.nombre) {
      return medico.nombre;
    }

    return 'seleccionado';
  }

  onFormulaExternaChange(): void {
    const esFormulaExterna = this.historiaForm.get('esFormulaExterna')?.value;
    const medicoReferidoControl = this.historiaForm.get('medicoReferido');
    const lugarConsultorioControl = this.historiaForm.get('lugarConsultorio');

    if (esFormulaExterna) {
      // Requerir campos de fórmula externa
      medicoReferidoControl?.setValidators([Validators.required]);
      lugarConsultorioControl?.setValidators([Validators.required]);
    } else {
      // Limpiar validaciones y valores
      medicoReferidoControl?.clearValidators();
      lugarConsultorioControl?.clearValidators();
      medicoReferidoControl?.setValue('');
      lugarConsultorioControl?.setValue('');
    }

    medicoReferidoControl?.updateValueAndValidity();
    lugarConsultorioControl?.updateValueAndValidity();
    this.cdr.detectChanges();
  }

  esRecomendacionLentesContacto(index: number): boolean {
    const cristal = (this.recomendaciones.at(index) as FormGroup)?.get('cristal')?.value;
    return this.esLentesContacto(this.obtenerValorCristalComoString(cristal));
  }

  get medicoTratanteConExterno(): any[] {
    // Crear una copia de los médicos existentes
    const medicos = this.medicoTratante.map(medico => ({
      ...medico,
      id: medico.id || medico.cedula || `medico-${Math.random()}`,
    }));

    const medicoExterno = {
      id: 'EXTERNO',
      nombre: '🔷 MÉDICO EXTERNO',
      cedula: 'EXTERNO',
      cargoId: 'externo',
      cargoNombre: 'Médico Externo'
    };

    return [...medicos, medicoExterno];
  }

  private determinarPagoPendiente(medico: any, esFormulaExterna: boolean, esMedicoExterno: boolean): boolean {
    // Si es fórmula externa pura (solo registro, sin consulta)
    if (esFormulaExterna && esMedicoExterno) {
      return false; // No genera pago
    }

    // Si es rectificación de fórmula externa por especialista interno
    if (esFormulaExterna && !esMedicoExterno && medico) {
      const esOftalmologo = medico.cargoId?.toLowerCase() === 'oftalmologo' ||
        medico.cargo?.toLowerCase() === 'oftalmologo';
      return esOftalmologo; // Solo paga si lo rectifica oftalmólogo
    }

    // Consulta interna sin fórmula externa
    if (medico && !esMedicoExterno) {
      const esOftalmologo = medico.cargoId?.toLowerCase() === 'oftalmologo' ||
        medico.cargo?.toLowerCase() === 'oftalmologo';
      return esOftalmologo; // Oftalmólogo paga, optometrista no
    }

    return false;
  }

  // Métodos para obtener información del especialista
  obtenerNombreEspecialista(historia: any): string {
    if (!historia?.datosConsulta?.especialista) return 'No disponible';

    const esp = historia.datosConsulta.especialista;
    if (esp.tipo === 'EXTERNO' && esp.externo) {
      return esp.externo.nombre || 'Médico Externo';
    } else if (esp.tipo !== 'EXTERNO') {
      return esp.nombre || 'No disponible';
    }
    return 'No disponible';
  }

  obtenerCedulaEspecialista(historia: any): string {
    if (!historia?.datosConsulta?.especialista) return 'No disponible';

    const esp = historia.datosConsulta.especialista;
    if (esp.tipo === 'EXTERNO') {
      return 'EXTERNO';
    } else if (esp.tipo !== 'EXTERNO') {
      return esp.cedula || 'No disponible';
    }
    return 'No disponible';
  }

  obtenerCargoEspecialista(historia: any): string {
    if (!historia?.datosConsulta?.especialista) return 'No disponible';

    const esp = historia.datosConsulta.especialista;
    if (esp.tipo === 'EXTERNO') {
      return esp.externo?.lugarConsultorio || 'Médico Externo';
    } else if (esp.tipo !== 'EXTERNO') {
      return esp.cargo || esp.tipo || 'No disponible';
    }
    return 'No disponible';
  }

  // Método específico para el listado de historias
  obtenerNombreMedicoEspecialista(historia: any): string {
    if (!historia?.datosConsulta?.especialista) return 'Médico no registrado';

    const esp = historia.datosConsulta.especialista;
    if (esp.tipo === 'EXTERNO' && esp.externo) {
      return `🔷 ${esp.externo.nombre || 'Externo'}`;
    } else if (esp.tipo !== 'EXTERNO') {
      const cargo = esp.cargo || esp.tipo || '';
      return `${esp.nombre || 'Médico'} (${cargo})`;
    }
    return 'Médico no registrado';
  }

  esMedicoExternoSeleccionado(): boolean {
    const medico = this.historiaForm.get('medico')?.value;
    return medico?.id === 'EXTERNO' || medico?.cedula === 'EXTERNO';
  }

  // Actualizar el método que maneja cambios en el médico
  onMedicoChange(medico: any): void {
    const esExterno = this.esMedicoExternoSeleccionado();

    if (esExterno) {
      // Si es médico externo, activar fórmula externa automáticamente
      this.historiaForm.patchValue({ esFormulaExterna: true });

      // Habilitar validadores
      const medicoReferidoControl = this.historiaForm.get('medicoReferido');
      const lugarConsultorioControl = this.historiaForm.get('lugarConsultorio');
      medicoReferidoControl?.setValidators([Validators.required]);
      lugarConsultorioControl?.setValidators([Validators.required]);
    } else {
      // Si no es médico externo, desactivar fórmula externa
      this.historiaForm.patchValue({ esFormulaExterna: false });

      // Limpiar validaciones y valores
      const medicoReferidoControl = this.historiaForm.get('medicoReferido');
      const lugarConsultorioControl = this.historiaForm.get('lugarConsultorio');
      medicoReferidoControl?.clearValidators();
      lugarConsultorioControl?.clearValidators();
      medicoReferidoControl?.setValue('');
      lugarConsultorioControl?.setValue('');
    }

    // Actualizar validaciones
    this.historiaForm.get('medicoReferido')?.updateValueAndValidity();
    this.historiaForm.get('lugarConsultorio')?.updateValueAndValidity();
    this.cdr.detectChanges();
  }

  // Método para prevenir que se deshabilite el toggle
  prevenirCambio(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    // Mostrar mensaje informativo opcional
    this.snackBar.open(
      '⚠️ Al seleccionar "MÉDICO EXTERNO", la fórmula externa se activa automáticamente y no puede desactivarse. Si el paciente requiere rectificación, debe seleccionar un especialista interno.',
      'Entendido',
      {
        duration: 5000,
        panelClass: ['snackbar-info']
      }
    );
  }

  // Método para obtener el nombre del médico referido (de donde sea que esté)
  obtenerNombreMedicoReferido(historia: any): string {
    if (!historia?.datosConsulta) return 'No especificado';

    const dc = historia.datosConsulta;

    // Prioridad 1: Buscar en formulaOriginal.medicoOrigen
    if (dc.formulaOriginal?.medicoOrigen?.nombre) {
      return dc.formulaOriginal.medicoOrigen.nombre;
    }

    // Prioridad 2: Buscar en especialista.externo
    if (dc.especialista?.tipo === 'EXTERNO' && dc.especialista?.externo?.nombre) {
      return dc.especialista.externo.nombre;
    }

    return 'No especificado';
  }

  // Método para obtener el lugar del médico referido
  obtenerLugarMedicoReferido(historia: any): string {
    if (!historia?.datosConsulta) return 'No especificado';

    const dc = historia.datosConsulta;

    // Prioridad 1: Buscar en formulaOriginal.medicoOrigen
    if (dc.formulaOriginal?.medicoOrigen?.lugarConsultorio) {
      return dc.formulaOriginal.medicoOrigen.lugarConsultorio;
    }

    // Prioridad 2: Buscar en especialista.externo
    if (dc.especialista?.tipo === 'EXTERNO' && dc.especialista?.externo?.lugarConsultorio) {
      return dc.especialista.externo.lugarConsultorio;
    }

    return 'No especificado';
  }

  // Método para verificar si existe médico referido (para mostrar la tarjeta)
  obtenerMedicoReferido(historia: any): boolean {
    if (!historia?.datosConsulta) return false;

    const dc = historia.datosConsulta;

    // Verificar si hay datos en alguna de las ubicaciones
    const tieneEnFormulaOriginal = dc.formulaOriginal?.medicoOrigen?.nombre &&
      dc.formulaOriginal?.medicoOrigen?.lugarConsultorio;
    const tieneEnEspecialista = dc.especialista?.tipo === 'EXTERNO' &&
      dc.especialista?.externo?.nombre &&
      dc.especialista?.externo?.lugarConsultorio;

    return tieneEnFormulaOriginal || tieneEnEspecialista;
  }

  private obtenerSedeCompleta(sedeKey: string): SedeCompleta | undefined {
    return this.sedesDisponibles.find(s => s.key === sedeKey);
  }

}