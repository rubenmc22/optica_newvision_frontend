import { Component, OnDestroy, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { OPCIONES_REF } from 'src/app/shared/constants/historias-medicas';
import { ActivatedRoute, Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { Subscription } from 'rxjs';
import { ClienteService } from './../../clientes/clientes.services';
import { ProductoService } from './../../productos/producto.service';
import { parseDescripcionProductoCristal } from './../../productos/producto-cristal-config.util';
import { resolverClasificacionMaestra, normalizarTextoClasificacion } from './../../productos/producto-classification.catalog';
import { Producto } from './../../productos/producto.model';
import { ProductoConversionService } from './../../productos/productos-list/producto-conversion.service';
import { SystemConfigService } from './../../system-config/system-config.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EmpleadosService } from './../../../core/services/empleados/empleados.service';
import { ExcelExportService } from './../../../core/services/excel-export/excel-export.service';
import { GenerarVentaService } from '../generar-venta/generar-venta.service';
import { UserStateService } from './../../../core/services/userState/user-state-service';
import { Empleado, User } from './../../../Interfaces/models-interface';
import { SedeCompleta } from './../../login/login-interface';
import { PRESUPUESTO_VENTA_STORAGE_KEY, PresupuestoVentaDraft } from '../shared/presupuesto-venta-handoff.util';
import { HISTORIA_VENTA_HANDOFF_STORAGE_KEY } from '../shared/historia-venta-handoff.util';
import {
  HISTORIA_PRESUPUESTO_HANDOFF_STORAGE_KEY,
  PRESUPUESTO_HISTORIA_RETURN_STORAGE_KEY,
  HistoriaPresupuestoHandoff,
  PresupuestoHistoriaReturnDraft
} from '../shared/historia-presupuesto-handoff.util';
import { PresupuestoService } from './presupuesto.service';
import { LoaderService } from './../../../shared/loader/loader.service';
import { OpcionPresupuesto, OrigenFormulaPresupuesto, Presupuesto } from './presupuesto.interfaz';
import { SwalService } from '../../../core/services/swal/swal.service';
import { HistoriaMedicaService } from '../../../core/services/historias-medicas/historias-medicas.service';
import { PacientesService } from '../../../core/services/pacientes/pacientes.service';

@Component({
  selector: 'app-presupuesto',
  standalone: false,
  templateUrl: './presupuesto.component.html',
  styleUrls: ['./presupuesto.component.scss']
})


export class PresupuestoComponent implements OnInit, OnDestroy {
  @ViewChild('clienteCedulaInput') clienteCedulaInput!: ElementRef;

  private contadorOpcionesPresupuesto: number = 0;

  // Opciones de refracción para selects (igual que historia médica)
  public opcionesRef = OPCIONES_REF;

  // Variables principales
  mostrarModalNuevoPresupuesto: boolean = false;
  mostrarModalDetallePresupuesto: boolean = false;
  mostrarModalEliminar: boolean = false;
  mostrarModalConversionPresupuesto: boolean = false;
  mostrarModalRenovarPresupuesto: boolean = false;
  modoEditable: boolean = false;
  filtroBusqueda: string = '';
  filtroEstado: string = '';
  tabActiva: string = 'vigentes';
  diasParaAutoArchivo: number = 30;
  diasVencimientoSeleccionado: number = 7;

  // Agregar estas variables al inicio de la clase (después de las otras variables)
  presupuestosFiltradosVigentes: any[] = [];
  presupuestosFiltradosVencidos: any[] = [];
  presupuestosCombinados: any[] = []; // Para cuando no hay filtro activo

  // En tu componente
  terminoBusqueda: string = '';
  productosFiltrados: any[] = [];
  terminoBusquedaDetalleProducto: string = '';
  productosDetalleFiltrados: any[] = [];

  // Agrega estas variables al componente
  mostrarMenuExportar: boolean = false;
  opcionesExportar = [
    { id: 'vigentes', texto: 'Exportar Vigentes', icono: 'bi-file-earmark-check' },
    { id: 'vencidos', texto: 'Exportar Vencidos', icono: 'bi-file-earmark-x' },
    { id: 'todos', texto: 'Exportar Todos', icono: 'bi-files' }
  ];
  // Variables para el menú de exportar
  timeoutCerrarMenu: any;
  mostrarMenuAccionesDetalle: boolean = false;
  timeoutCerrarMenuDetalle: any;

  // Nuevo presupuesto
  nuevoPresupuesto: any = {
    codigo: '',
    cliente: this.getClienteVacio(),
    fechaCreacion: new Date(),
    fechaVencimiento: new Date(),
    diasVencimiento: 7,
    vendedor: '',
    opciones: [],
    opcionPrincipalId: '',
    productos: [],
    subtotal: 0,
    iva: 0,
    total: 0,
    observaciones: '',
    estado: 'vigente',
    formulaExterna: {
      activa: false,
      origen: null,
      refraccionFinal: {
        od: { esfera: null, cilindro: null, eje: null, adicion: null, alt: null, dp: null },
        oi: { esfera: null, cilindro: null, eje: null, adicion: null, alt: null, dp: null }
      }
    }
  };
  // Si tienes lógica para cargar o editar presupuestos, asegúrate de que los campos de refracción final también se inicialicen como null si están vacíos

  /**
   * Normaliza los campos de refracción final a null si están vacíos (para edición)
   */
  normalizarRefraccionFinal(presupuesto: any) {
    if (presupuesto && presupuesto.formulaExterna && presupuesto.formulaExterna.refraccionFinal) {
      ['od', 'oi'].forEach(ojo => {
        const ref = presupuesto.formulaExterna.refraccionFinal[ojo];
        if (ref) {
          ['esfera', 'cilindro', 'eje', 'adicion', 'alt', 'dp'].forEach(campo => {
            if (ref[campo] === '') ref[campo] = null;
          });
        }
      });
    }
  }

  fixSelectOverflow(): void {
    setTimeout(() => {
      const openedSelects = Array.from(document.querySelectorAll('.ng-select.ng-select-opened')) as HTMLElement[];
      const dropdowns = Array.from(document.querySelectorAll('.ng-dropdown-panel')) as HTMLElement[];

      if (!openedSelects.length || !dropdowns.length) {
        return;
      }

      const activeSelect = openedSelects[openedSelects.length - 1];
      const activePanel = dropdowns[dropdowns.length - 1];
      const selectContainer = activeSelect.querySelector('.ng-select-container') as HTMLElement | null;

      if (!selectContainer) {
        return;
      }

      const triggerRect = selectContainer.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const panelHeight = Math.min(activePanel.scrollHeight || 230, 230);
      const spaceAbove = triggerRect.top;
      const spaceBelow = viewportHeight - triggerRect.bottom;
      const shouldOpenTop = activePanel.classList.contains('ng-select-top') || spaceAbove > spaceBelow;
      const top = shouldOpenTop
        ? Math.max(8, triggerRect.top - panelHeight - 4)
        : Math.min(viewportHeight - panelHeight - 8, triggerRect.bottom + 4);
      const left = Math.min(
        Math.max(8, triggerRect.left),
        Math.max(8, viewportWidth - triggerRect.width - 8)
      );

      activePanel.style.position = 'fixed';
      activePanel.style.left = `${left}px`;
      activePanel.style.top = `${top}px`;
      activePanel.style.width = `${triggerRect.width}px`;
      activePanel.style.minWidth = `${triggerRect.width}px`;
      activePanel.style.maxWidth = `${triggerRect.width}px`;
      activePanel.style.maxHeight = `${panelHeight}px`;
      activePanel.style.overflowY = 'auto';
      activePanel.style.zIndex = '1000000';
      activePanel.style.visibility = 'visible';
      activePanel.style.opacity = '1';
      activePanel.style.pointerEvents = 'auto';
    }, 10);
  }

  // Llama a esta función después de cargar un presupuesto para edición:
  // this.normalizarRefraccionFinal(presupuestoEditado);

  // Variables para validación de cliente (usando tu estructura)
  validandoCliente: boolean = false;
  clienteEncontrado: boolean = false;
  validacionIntentada: boolean = false;
  mensajeValidacionCliente: string = '';
  cedulaAnterior: string = '';
  clienteSinPaciente = this.getClienteVacio();

  // Presupuesto seleccionado para detalle/edición
  presupuestoSeleccionado: any = null;
  presupuestoAEliminar: any = null;
  presupuestoParaConvertir: any = null;
  presupuestoParaRenovar: any = null;

  // Opciones
  opcionesVencimiento = [
    { valor: 7, texto: '7 días' },
    { valor: 10, texto: '10 días' },
    { valor: 20, texto: '20 días' },
    { valor: 30, texto: '30 días' }
  ];

  // Datos
  presupuestosVigentes: any[] = [];
  presupuestosVencidos: any[] = [];
  productosDisponibles: any[] = [];
  productosDisponiblesBase: Producto[] = [];
  productosCargando: boolean = false;

  monedaSistema: 'USD' | 'EUR' | 'VES' = 'USD';
  simboloMonedaSistema: string = '$';
  ivaPorcentaje: number = 16;
  usuarioActual: User | null = null;
  sedeActual: SedeCompleta | null = null;
  empleadosDisponibles: Empleado[] = [];

  private configSubscription?: Subscription;

  // Estadísticas
  estadisticas = {
    totalVigentes: 0,
    totalVencidos: 0,
    totalValor: 0,
    proximosAVencer: 0
  };

  // Modal para agregar producto
  mostrarModalAgregarProducto: boolean = false;
  mostrarModalCatalogoProductos: boolean = false;
  detalleModalOcultoPorCatalogo: boolean = false;
  posicionScrollDetalleAntesCatalogo: number = 0;
  opcionActivaNuevoId: string = '';
  opcionActivaDetalleId: string = '';
  opcionActivaConversionId: string = '';
  busquedaProducto: string = '';
  terminoBusquedaCatalogoProductos: string = '';
  categoriaFiltroCatalogoProductos: string = 'todas';
  productosCatalogoFiltrados: any[] = [];
  productosCatalogoRecienAgregados = new Set<string>();
  private timeoutIndicadoresCatalogo = new Map<string, any>();
  cargandoConsultaMedica: boolean = false;
  private historiaPresupuestoHandoffActivo: HistoriaPresupuestoHandoff | null = null;

  constructor(
    private clienteService: ClienteService,
    private productoService: ProductoService,
    private productoConversionService: ProductoConversionService,
    private systemConfigService: SystemConfigService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private empleadosService: EmpleadosService,
    private presupuestoService: PresupuestoService,
    private excelExportService: ExcelExportService,
    private generarVentaService: GenerarVentaService,
    private userStateService: UserStateService,
    private router: Router,
    private route: ActivatedRoute,
    private loader: LoaderService,
    private swalService: SwalService,
    private historiaService: HistoriaMedicaService,
    private pacientesService: PacientesService,
  ) { }

  ngOnInit() {
    // Cierra cualquier loader global residual de una vista previa para evitar overlays bloqueados.
    this.loader.forceHide();
    this.sincronizarContextoUsuario();
    this.obtenerConfiguracionSistema();
    this.suscribirCambiosConfiguracion();
    this.cargarDatos();
    this.inicializarNuevoPresupuesto();
    this.aplicarHandoffHistoriaPresupuestoSiExiste();
    void this.cargarAsesores();
    this.diasVencimientoSeleccionado = 7;
    this.inicializarPresupuestosFiltrados();
  }

  ngOnDestroy() {
    if (this.timeoutCerrarMenu) {
      clearTimeout(this.timeoutCerrarMenu);
    }

    if (this.configSubscription) {
      this.configSubscription.unsubscribe();
    }

    if (this.timeoutCerrarMenuDetalle) {
      clearTimeout(this.timeoutCerrarMenuDetalle);
    }

    document.body.classList.remove('modal-open');
  }

  private obtenerConfiguracionSistema(): void {
    this.monedaSistema = this.normalizarCodigoMoneda(this.systemConfigService.getMonedaPrincipal());
    this.simboloMonedaSistema = this.systemConfigService.getSimboloMonedaPrincipal();
  }

  private suscribirCambiosConfiguracion(): void {
    this.configSubscription = this.systemConfigService.config$.subscribe((config) => {
      this.monedaSistema = this.normalizarCodigoMoneda(config.monedaPrincipal);
      this.simboloMonedaSistema = config.simboloMoneda;
      this.reaplicarMonedaActualEnProductosDisponibles();
      this.reaplicarMonedaActualEnPresupuestoActivo();
      this.cdr.detectChanges();
    });
  }

  private sincronizarContextoUsuario(): void {
    this.usuarioActual = this.userStateService.getCurrentUser();
    this.sedeActual = this.userStateService.getSedeActual();

    if (!this.sedeActual && this.usuarioActual?.sede) {
      this.sedeActual = this.userStateService.getSedePorKey(this.usuarioActual.sede);
    }
  }

  private async cargarAsesores(): Promise<void> {
    try {
      const empleados = await lastValueFrom(this.empleadosService.getAllEmpleados());
      this.empleadosDisponibles = Array.isArray(empleados) ? empleados : [];
    } catch {
      this.empleadosDisponibles = [];
    }
  }

  inicializarPresupuestosFiltrados() {
    // Inicializar con todos los presupuestos
    if (this.presupuestosVigentes) {
      this.presupuestosFiltradosVigentes = [...this.presupuestosVigentes];
    }

    if (this.presupuestosVencidos) {
      this.presupuestosFiltradosVencidos = [...this.presupuestosVencidos];
    }

    this.presupuestosCombinados = [
      ...(this.presupuestosFiltradosVigentes || []),
      ...(this.presupuestosFiltradosVencidos || [])
    ];
  }

  getClienteVacio() {
    return {
      tipoPersona: 'natural',
      cedula: '',
      nombreCompleto: '',
      telefono: '',
      email: '',
      direccion: '',
      razonSocial: '',
      pacienteKey: null,
      pacienteId: null,
      key: null,
      id: null
    };
  }

  get opcionesNuevoPresupuesto(): OpcionPresupuesto[] {
    return Array.isArray(this.nuevoPresupuesto?.opciones) ? this.nuevoPresupuesto.opciones : [];
  }

  get opcionesDetallePresupuesto(): OpcionPresupuesto[] {
    return Array.isArray(this.presupuestoSeleccionado?.opciones) ? this.presupuestoSeleccionado.opciones : [];
  }

  get opcionesConversionPresupuesto(): OpcionPresupuesto[] {
    return Array.isArray(this.presupuestoParaConvertir?.opciones) ? this.presupuestoParaConvertir.opciones : [];
  }

  private crearIdOpcionPresupuesto(): string {
    this.contadorOpcionesPresupuesto += 1;
    return `opc-${Date.now()}-${this.contadorOpcionesPresupuesto}`;
  }

  private normalizarProductoPresupuestoPersistido(producto: any): any {
    const productoId = producto?.productoId ?? producto?.producto_id ?? producto?.id ?? null;
    const nombreVisible = this.obtenerNombreVisibleProducto(producto);

    return {
      ...producto,
      id: productoId,
      productoId,
      itemId: producto?.itemId,
      nombre: nombreVisible,
      descripcion: nombreVisible,
      codigo: String(producto?.codigo || producto?.productoCodigo || '').trim(),
      precio: Number(producto?.precio ?? producto?.precioUnitario ?? 0),
      precioUnitario: Number(producto?.precioUnitario ?? producto?.precio ?? 0),
      precioOriginal: Number(producto?.precioOriginal ?? producto?.precio ?? producto?.precioUnitario ?? 0),
      cantidad: Number(producto?.cantidad || 1),
      descuento: Number(producto?.descuento ?? producto?.descuentoPorcentaje ?? 0),
      descuentoPorcentaje: Number(producto?.descuentoPorcentaje ?? producto?.descuento ?? 0),
      subtotalLinea: Number(producto?.subtotalLinea || 0),
      total: Number(producto?.total ?? producto?.totalLinea ?? 0),
      totalLinea: Number(producto?.totalLinea ?? producto?.total ?? 0),
      moneda: producto?.moneda ?? this.monedaSistema,
      monedaOriginal: producto?.monedaOriginal ?? producto?.moneda ?? this.monedaSistema,
      tasaConversion: Number(producto?.tasaConversion ?? 1),
      categoria: producto?.categoria ?? producto?.producto?.categoria ?? producto?.configuracionTecnica?.categoria,
      cristalConfig: producto?.cristalConfig ?? producto?.configuracionTecnica?.cristalConfig ?? null,
      configuracionTecnica: producto?.configuracionTecnica ?? null,
      tipoItem: producto?.tipoItem ?? producto?.configuracionTecnica?.tipoItem ?? null,
      esConsulta: this.normalizarBanderaBooleana(producto?.esConsulta ?? producto?.configuracionTecnica?.esConsulta),
      aplicaIva: producto?.aplicaIva !== false
    };
  }

  private construirPayloadProductoPresupuesto(producto: any): any {
    const productoId = producto?.productoId ?? producto?.id ?? null;
    const precioUnitario = Number(producto?.precioUnitario ?? producto?.precio ?? 0);
    const descuentoPorcentaje = Number(producto?.descuentoPorcentaje ?? producto?.descuento ?? 0);
    const nombreVisible = this.obtenerNombreVisibleProducto(producto);

    return {
      productoId: productoId !== null && productoId !== undefined ? Number(productoId) : null,
      codigo: String(producto?.codigo || '').trim(),
      descripcion: nombreVisible,
      precioUnitario,
      cantidad: Number(producto?.cantidad || 1),
      descuentoPorcentaje,
      aplicaIva: this.lineaAplicaIva(producto),
      tipoItem: this.esLineaConsulta(producto) ? 'servicio_consulta' : (producto?.tipoItem || null),
      esConsulta: this.esLineaConsulta(producto),
      moneda: producto?.moneda || this.monedaSistema,
      precioOriginal: Number(producto?.precioOriginal ?? precioUnitario ?? 0),
      monedaOriginal: producto?.monedaOriginal || producto?.moneda || this.monedaSistema,
      tasaConversion: Number(producto?.tasaConversion ?? 1)
    };
  }

  private crearOpcionPresupuesto(nombre?: string, productos: any[] = [], overrides: Partial<OpcionPresupuesto> = {}): OpcionPresupuesto {
    const opcion: OpcionPresupuesto = {
      id: String(overrides.id || this.crearIdOpcionPresupuesto()),
      nombre: String(nombre || overrides.nombre || `Opción ${this.contadorOpcionesPresupuesto}`).trim(),
      productos: Array.isArray(productos)
        ? productos.map((producto) => this.normalizarProductoPresupuestoPersistido(producto))
        : [],
      subtotal: Number(overrides.subtotal || 0),
      descuentoTotal: Number(overrides.descuentoTotal || 0),
      iva: Number(overrides.iva || 0),
      total: Number(overrides.total || 0),
      observaciones: String(overrides.observaciones || ''),
      esPrincipal: Boolean(overrides.esPrincipal)
    };

    this.recalcularTotalesPresupuesto(opcion as any);
    return opcion;
  }

  private normalizarOpcionPresupuestoPersistida(opcion: any, index: number): OpcionPresupuesto {
    const productos = Array.isArray(opcion?.productos)
      ? opcion.productos.map((producto: any) => this.normalizarProductoPresupuestoPersistido(producto))
      : [];

    const opcionNormalizada = this.crearOpcionPresupuesto(opcion?.nombre || `Opción ${index + 1}`, productos, {
      id: String(opcion?.id || this.crearIdOpcionPresupuesto()),
      subtotal: Number(opcion?.subtotal || 0),
      descuentoTotal: Number(opcion?.descuentoTotal || 0),
      iva: Number(opcion?.iva || 0),
      total: Number(opcion?.total || 0),
      observaciones: String(opcion?.observaciones || ''),
      esPrincipal: Boolean(opcion?.esPrincipal)
    });

    this.recalcularTotalesPresupuesto(opcionNormalizada as any);
    return opcionNormalizada;
  }

  private asegurarOpcionesPresupuesto(presupuesto: any): OpcionPresupuesto[] {
    if (!presupuesto) {
      return [];
    }

    if (Array.isArray(presupuesto?.opciones) && presupuesto.opciones.length > 0) {
      const opcionesExistentes = presupuesto.opciones as OpcionPresupuesto[];
      let opcionPrincipalId = String(
        presupuesto?.opcionPrincipalId
        || opcionesExistentes.find((opcion) => opcion?.esPrincipal)?.id
        || opcionesExistentes[0]?.id
        || ''
      ).trim();

      if (!opcionesExistentes.some((opcion) => opcion?.id === opcionPrincipalId)) {
        opcionPrincipalId = String(opcionesExistentes[0]?.id || '').trim();
      }

      opcionesExistentes.forEach((opcion, index) => {
        if (!opcion.id) {
          opcion.id = this.crearIdOpcionPresupuesto();
        }

        if (!opcion.nombre || !String(opcion.nombre).trim()) {
          opcion.nombre = `Opción ${index + 1}`;
        }

        if (!Array.isArray(opcion.productos)) {
          opcion.productos = [];
        }

        opcion.productos = opcion.productos.map((producto: any) => this.normalizarProductoPresupuestoPersistido(producto));

        opcion.subtotal = Number(opcion.subtotal || 0);
        opcion.descuentoTotal = Number(opcion.descuentoTotal || 0);
        opcion.iva = Number(opcion.iva || 0);
        opcion.total = Number(opcion.total || 0);
        opcion.observaciones = String(opcion.observaciones || '');
        opcion.esPrincipal = opcion.id === opcionPrincipalId;
      });

      presupuesto.opcionPrincipalId = opcionPrincipalId;
      return opcionesExistentes;
    }

    const opcionesFuente = Array.isArray(presupuesto?.opciones) && presupuesto.opciones.length > 0
      ? presupuesto.opciones
      : [this.crearOpcionPresupuesto('Opción 1', presupuesto?.productos || [], {
        id: presupuesto?.opcionPrincipalId || this.crearIdOpcionPresupuesto(),
        subtotal: Number(presupuesto?.subtotal || 0),
        descuentoTotal: Number(presupuesto?.descuentoTotal || 0),
        iva: Number(presupuesto?.iva || 0),
        total: Number(presupuesto?.total || 0),
        esPrincipal: true
      })];

    const opciones = opcionesFuente.map((opcion: any, index: number) => this.normalizarOpcionPresupuestoPersistida(opcion, index));
    let opcionPrincipalId = String(
      presupuesto?.opcionPrincipalId
      || opciones.find((opcion) => opcion.esPrincipal)?.id
      || opciones[0]?.id
      || ''
    ).trim();

    if (!opciones.some((opcion) => opcion.id === opcionPrincipalId) && opciones.length > 0) {
      opcionPrincipalId = opciones[0].id;
    }

    opciones.forEach((opcion) => {
      opcion.esPrincipal = opcion.id === opcionPrincipalId;
      this.recalcularTotalesPresupuesto(opcion as any);
    });

    presupuesto.opciones = opciones;
    presupuesto.opcionPrincipalId = opcionPrincipalId;
    return opciones;
  }

  private obtenerOpcionPresupuesto(presupuesto: any, opcionId?: string | null): OpcionPresupuesto | null {
    const opciones = this.asegurarOpcionesPresupuesto(presupuesto);

    if (!opciones.length) {
      return null;
    }

    return opciones.find((opcion) => opcion.id === opcionId)
      || opciones.find((opcion) => opcion.id === presupuesto?.opcionPrincipalId)
      || opciones[0];
  }

  private sincronizarPresupuestoDesdeOpcion(presupuesto: any, opcion: OpcionPresupuesto | null): void {
    if (!presupuesto || !opcion) {
      return;
    }

    presupuesto.productos = opcion.productos;
    presupuesto.subtotal = Number(opcion.subtotal || 0);
    presupuesto.descuentoTotal = Number(opcion.descuentoTotal || 0);
    presupuesto.iva = Number(opcion.iva || 0);
    presupuesto.total = Number(opcion.total || 0);
  }

  private sincronizarResumenDesdeOpcionPrincipal(presupuesto: any): void {
    const opcionPrincipal = this.obtenerOpcionPresupuesto(presupuesto, presupuesto?.opcionPrincipalId);

    if (!opcionPrincipal) {
      return;
    }

    this.recalcularTotalesPresupuesto(opcionPrincipal as any);
    presupuesto.opcionPrincipalId = opcionPrincipal.id;
    this.sincronizarPresupuestoDesdeOpcion(presupuesto, opcionPrincipal);
  }

  private sincronizarOpcionActivaNuevo(opcionId?: string | null): void {
    const opcion = this.obtenerOpcionPresupuesto(this.nuevoPresupuesto, opcionId || this.opcionActivaNuevoId);

    if (!opcion) {
      this.opcionActivaNuevoId = '';
      return;
    }

    this.recalcularTotalesPresupuesto(opcion as any);
    this.opcionActivaNuevoId = opcion.id;
    this.sincronizarPresupuestoDesdeOpcion(this.nuevoPresupuesto, opcion);
  }

  private sincronizarOpcionActivaDetalle(opcionId?: string | null): void {
    const opcion = this.obtenerOpcionPresupuesto(this.presupuestoSeleccionado, opcionId || this.opcionActivaDetalleId);

    if (!opcion) {
      this.opcionActivaDetalleId = '';
      return;
    }

    this.recalcularTotalesPresupuesto(opcion as any);
    this.opcionActivaDetalleId = opcion.id;
    this.sincronizarPresupuestoDesdeOpcion(this.presupuestoSeleccionado, opcion);
  }

  private sincronizarOpcionActivaConversion(opcionId?: string | null): void {
    const opcion = this.obtenerOpcionPresupuesto(this.presupuestoParaConvertir, opcionId || this.opcionActivaConversionId);

    if (!opcion) {
      this.opcionActivaConversionId = '';
      return;
    }

    this.recalcularTotalesPresupuesto(opcion as any);
    this.opcionActivaConversionId = opcion.id;
    this.sincronizarPresupuestoDesdeOpcion(this.presupuestoParaConvertir, opcion);
  }

  private agregarOpcionEnPresupuesto(presupuesto: any, contexto: 'nuevo' | 'detalle'): void {
    const opciones = this.asegurarOpcionesPresupuesto(presupuesto);
    const nuevaOpcion = this.crearOpcionPresupuesto(`Opción ${opciones.length + 1}`);
    opciones.push(nuevaOpcion);

    if (!presupuesto.opcionPrincipalId) {
      presupuesto.opcionPrincipalId = nuevaOpcion.id;
      nuevaOpcion.esPrincipal = true;
    }

    if (contexto === 'nuevo') {
      this.sincronizarOpcionActivaNuevo(nuevaOpcion.id);
      return;
    }

    this.sincronizarOpcionActivaDetalle(nuevaOpcion.id);
  }

  private duplicarOpcionEnPresupuesto(presupuesto: any, contexto: 'nuevo' | 'detalle', opcionId?: string | null): void {
    const opcionBase = this.obtenerOpcionPresupuesto(presupuesto, opcionId);

    if (!opcionBase) {
      return;
    }

    const opciones = this.asegurarOpcionesPresupuesto(presupuesto);
    const copia = this.crearOpcionPresupuesto(`${opcionBase.nombre} copia`, opcionBase.productos, {
      observaciones: opcionBase.observaciones
    });
    opciones.push(copia);

    if (contexto === 'nuevo') {
      this.sincronizarOpcionActivaNuevo(copia.id);
      return;
    }

    this.sincronizarOpcionActivaDetalle(copia.id);
  }

  private eliminarOpcionEnPresupuesto(presupuesto: any, contexto: 'nuevo' | 'detalle', opcionId: string): void {
    const opciones = this.asegurarOpcionesPresupuesto(presupuesto);

    if (opciones.length <= 1) {
      this.snackBar.open('Debe conservar al menos una opción en el presupuesto', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    const index = opciones.findIndex((opcion) => opcion.id === opcionId);
    if (index === -1) {
      return;
    }

    const [opcionEliminada] = opciones.splice(index, 1);
    if (presupuesto.opcionPrincipalId === opcionEliminada.id) {
      presupuesto.opcionPrincipalId = opciones[0].id;
    }

    opciones.forEach((opcion) => {
      opcion.esPrincipal = opcion.id === presupuesto.opcionPrincipalId;
    });

    const siguiente = opciones[Math.max(0, index - 1)] || opciones[0];
    if (contexto === 'nuevo') {
      this.sincronizarOpcionActivaNuevo(siguiente.id);
      return;
    }

    this.sincronizarOpcionActivaDetalle(siguiente.id);
  }

  private marcarOpcionPrincipalEnPresupuesto(presupuesto: any, opcionId: string, contexto: 'nuevo' | 'detalle'): void {
    const opciones = this.asegurarOpcionesPresupuesto(presupuesto);
    presupuesto.opcionPrincipalId = opcionId;
    opciones.forEach((opcion) => {
      opcion.esPrincipal = opcion.id === opcionId;
    });

    if (contexto === 'nuevo') {
      this.sincronizarOpcionActivaNuevo(opcionId);
      return;
    }

    this.sincronizarOpcionActivaDetalle(opcionId);
  }

  agregarOpcionNuevo(): void {
    this.agregarOpcionEnPresupuesto(this.nuevoPresupuesto, 'nuevo');
  }

  duplicarOpcionNuevo(opcionId?: string | null): void {
    this.duplicarOpcionEnPresupuesto(this.nuevoPresupuesto, 'nuevo', opcionId || this.opcionActivaNuevoId);
  }

  eliminarOpcionNuevo(opcionId: string): void {
    this.eliminarOpcionEnPresupuesto(this.nuevoPresupuesto, 'nuevo', opcionId);
  }

  seleccionarOpcionNuevo(opcionId: string): void {
    this.sincronizarOpcionActivaNuevo(opcionId);
  }

  marcarOpcionPrincipalNuevo(opcionId: string): void {
    this.marcarOpcionPrincipalEnPresupuesto(this.nuevoPresupuesto, opcionId, 'nuevo');
  }

  agregarOpcionDetalle(): void {
    this.agregarOpcionEnPresupuesto(this.presupuestoSeleccionado, 'detalle');
  }

  duplicarOpcionDetalle(opcionId?: string | null): void {
    this.duplicarOpcionEnPresupuesto(this.presupuestoSeleccionado, 'detalle', opcionId || this.opcionActivaDetalleId);
  }

  eliminarOpcionDetalle(opcionId: string): void {
    this.eliminarOpcionEnPresupuesto(this.presupuestoSeleccionado, 'detalle', opcionId);
  }

  seleccionarOpcionDetalle(opcionId: string): void {
    this.sincronizarOpcionActivaDetalle(opcionId);
  }

  marcarOpcionPrincipalDetalle(opcionId: string): void {
    this.marcarOpcionPrincipalEnPresupuesto(this.presupuestoSeleccionado, opcionId, 'detalle');
  }

  seleccionarOpcionConversion(opcionId: string): void {
    this.sincronizarOpcionActivaConversion(opcionId);
  }

  private presupuestoTieneProductos(presupuesto: any): boolean {
    const opciones = Array.isArray(presupuesto?.opciones) ? presupuesto.opciones : [];

    if (opciones.length > 0) {
      return opciones.some((opcion) => Array.isArray(opcion.productos) && opcion.productos.length > 0);
    }

    const productos = Array.isArray(presupuesto?.productos) ? presupuesto.productos : [];
    return productos.length > 0;
  }

  private presupuestoTieneProductosNoConsulta(presupuesto: any): boolean {
    const opciones = Array.isArray(presupuesto?.opciones) ? presupuesto.opciones : [];

    if (opciones.length > 0) {
      return opciones.some((opcion) => Array.isArray(opcion?.productos) && opcion.productos.some((producto: any) => !this.esLineaConsulta(producto)));
    }

    const productos = Array.isArray(presupuesto?.productos) ? presupuesto.productos : [];
    return productos.some((producto: any) => !this.esLineaConsulta(producto));
  }

  getCantidadOpcionesConProductos(presupuesto: any): number {
    const opciones = Array.isArray(presupuesto?.opciones) ? presupuesto.opciones : [];
    return opciones.filter((opcion) => Array.isArray(opcion.productos) && opcion.productos.length > 0).length;
  }

  private obtenerProductosBusquedaPresupuesto(presupuesto: any): any[] {
    const opciones = Array.isArray(presupuesto?.opciones) ? presupuesto.opciones : [];

    if (opciones.length > 0) {
      return opciones.flatMap((opcion: any) => Array.isArray(opcion?.productos) ? opcion.productos : []);
    }

    return Array.isArray(presupuesto?.productos) ? presupuesto.productos : [];
  }

  private sincronizarClienteFormularioConPresupuesto(): void {
    const cliente = {
      ...this.getClienteVacio(),
      ...(this.nuevoPresupuesto?.cliente || {}),
      ...(this.clienteSinPaciente || {})
    };

    cliente.cedula = String(cliente.cedula || '').trim();
    cliente.nombreCompleto = String(cliente.nombreCompleto || '').trim();
    cliente.telefono = String(cliente.telefono || '').trim();
    cliente.email = String(cliente.email || '').trim();
    cliente.razonSocial = String(cliente.razonSocial || '').trim();

    this.clienteSinPaciente = { ...cliente };
    this.nuevoPresupuesto.cliente = { ...cliente };
  }

  private sincronizarClienteFormularioDesdePresupuesto(): void {
    this.clienteSinPaciente = {
      ...this.getClienteVacio(),
      ...(this.nuevoPresupuesto?.cliente || {})
    };
  }

  private limpiarContenidoDependienteNuevoPresupuesto(): void {
    const clienteActual = {
      ...this.getClienteVacio(),
      ...(this.nuevoPresupuesto?.cliente || {}),
      ...(this.clienteSinPaciente || {}),
      pacienteKey: null,
      pacienteId: null,
      key: null,
      id: null
    };
    const fechaCreacion = this.nuevoPresupuesto?.fechaCreacion
      ? new Date(this.nuevoPresupuesto.fechaCreacion)
      : new Date();
    const diasVencimiento = Number(this.nuevoPresupuesto?.diasVencimiento || 7);
    const fechaVencimiento = this.nuevoPresupuesto?.fechaVencimiento
      ? new Date(this.nuevoPresupuesto.fechaVencimiento)
      : new Date(fechaCreacion);

    this.timeoutIndicadoresCatalogo.forEach((timeoutId) => clearTimeout(timeoutId));
    this.timeoutIndicadoresCatalogo.clear();
    this.productosCatalogoRecienAgregados.clear();

    this.nuevoPresupuesto = {
      ...this.nuevoPresupuesto,
      cliente: clienteActual,
      historiaMedicaId: null,
      historiaNumero: null,
      pacienteKeyOrigen: null,
      pacienteIdOrigen: null,
      opciones: [],
      opcionPrincipalId: '',
      productos: [],
      subtotal: 0,
      descuentoTotal: 0,
      iva: 0,
      total: 0,
      observaciones: '',
      fechaCreacion,
      fechaVencimiento,
      diasVencimiento,
      diasRestantes: this.calcularDiasRestantesParaFecha(fechaVencimiento),
      formulaExterna: {
        activa: false,
        origen: null,
        refraccionFinal: this.crearRefraccionFinalVacia()
      }
    };

    this.historiaPresupuestoHandoffActivo = null;
    this.terminoBusqueda = '';
    this.productosFiltrados = [];
    this.terminoBusquedaCatalogoProductos = '';
    this.productosCatalogoFiltrados = [];

    this.asegurarOpcionesPresupuesto(this.nuevoPresupuesto);
    this.sincronizarOpcionActivaNuevo(this.nuevoPresupuesto.opcionPrincipalId);
    this.sincronizarClienteFormularioConPresupuesto();
  }

  validarEmail(email: string): boolean {
    if (!email || email.trim() === '') {
      return true;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email.trim());
  }

  validarCedula(cedula: string, tipoPersona: string): boolean {
    if (!cedula || cedula.trim() === '') {
      return false;
    }

    const cedulaLimpia = cedula.trim();

    if (tipoPersona === 'juridica') {
      return /^[JjVvGgEe]-?\d{7,9}$/.test(cedulaLimpia);
    }

    return /^\d{1,9}$/.test(cedulaLimpia);
  }

  validarNombre(nombre: string): boolean {
    if (!nombre || nombre.trim() === '') {
      return false;
    }

    if (this.clienteSinPaciente.tipoPersona === 'juridica') {
      return /^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s\.\,\-\&]+$/.test(nombre.trim());
    }

    return /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(nombre.trim());
  }

  validarTelefono(telefono: string): boolean {
    if (!telefono || telefono.trim() === '') {
      return false;
    }

    const telefonoLimpio = telefono.trim();
    const formatosAceptados = [
      /^\+\d{1,3}\s\d{7,15}$/,
      /^\d{1,3}\s\d{7,15}$/,
      /^\d{10,11}$/,
      /^\+?\d{10,15}$/,
      /^\d{1,3}\s+\d{7,15}$/
    ];

    return formatosAceptados.some((pattern) => pattern.test(telefonoLimpio));
  }

  getMensajeErrorCedula(): string {
    return this.clienteSinPaciente.tipoPersona === 'juridica'
      ? 'Formato de RIF invalido. Use J- seguido de 7-9 numeros.'
      : 'La cedula debe contener solo numeros y maximo 9 digitos.';
  }

  private getMensajeErrorTelefono(): string {
    return 'Formato invalido. Para Venezuela use 4121234567 o +58 4121234567.';
  }

  getEstadoCampoCedula(): { valido: boolean, mensaje: string } {
    const cedula = this.clienteSinPaciente.cedula;

    if (!cedula || cedula.trim() === '') {
      return { valido: false, mensaje: 'La cedula o RIF es obligatorio.' };
    }

    return {
      valido: this.validarCedula(cedula, this.clienteSinPaciente.tipoPersona),
      mensaje: this.getMensajeErrorCedula()
    };
  }

  onTipoPersonaChange(): void {
    const tipoPersonaAnterior = this.nuevoPresupuesto?.cliente?.tipoPersona === 'juridica' ? 'juridica' : 'natural';

    this.clienteSinPaciente.tipoPersona = this.clienteSinPaciente.tipoPersona === 'juridica' ? 'juridica' : 'natural';

    if (tipoPersonaAnterior !== this.clienteSinPaciente.tipoPersona) {
      this.limpiarContenidoDependienteNuevoPresupuesto();
    }

    this.limpiarEstadoValidacion();
    this.sincronizarClienteFormularioConPresupuesto();
  }

  onCampoEditadoManualmente(): void {
    this.sincronizarClienteFormularioConPresupuesto();
  }

  onCedulaChange(): void {
    const cedulaAnterior = String(this.nuevoPresupuesto?.cliente?.cedula || '').trim();
    let cedula = String(this.clienteSinPaciente.cedula || '').trim();

    if (this.clienteSinPaciente.tipoPersona === 'juridica') {
      const prefijo = cedula.charAt(0).toUpperCase();
      const numeros = cedula.replace(/[^0-9]/g, '');
      if (/[JVEG]/.test(prefijo)) {
        cedula = `${prefijo}-${numeros}`;
      }
    } else {
      cedula = cedula.replace(/\D/g, '').slice(0, 9);
    }

    this.clienteSinPaciente.cedula = cedula;

    if (cedula !== cedulaAnterior) {
      this.limpiarContenidoDependienteNuevoPresupuesto();
      this.clienteEncontrado = false;
      this.validacionIntentada = false;
      this.mensajeValidacionCliente = '';
    }

    if (this.cedulaAnterior && cedula !== this.cedulaAnterior) {
      this.clienteEncontrado = false;
      this.validacionIntentada = false;
      this.mensajeValidacionCliente = '';
    }

    this.sincronizarClienteFormularioConPresupuesto();
  }

  onCedulaBlur(): void {
    const cedula = String(this.clienteSinPaciente.cedula || '').trim();

    if (!cedula) {
      this.limpiarEstadoValidacion();
      return;
    }

    if (!this.validarCedula(cedula, this.clienteSinPaciente.tipoPersona)) {
      this.clienteEncontrado = false;
      this.validacionIntentada = false;
      this.mensajeValidacionCliente = this.getMensajeErrorCedula();
      return;
    }

    if (cedula.length >= 4 && cedula !== this.cedulaAnterior) {
      void this.validarClientePorCedula();
    }
  }

  onCedulaEnter(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.forzarValidacionCliente();
  }

  forzarValidacionCliente(): void {
    const cedula = String(this.clienteSinPaciente.cedula || '').trim();

    if (!cedula) {
      this.mensajeValidacionCliente = 'Ingrese una cedula o RIF para validar.';
      return;
    }

    if (!this.validarCedula(cedula, this.clienteSinPaciente.tipoPersona)) {
      this.mensajeValidacionCliente = this.getMensajeErrorCedula();
      return;
    }

    void this.validarClientePorCedula();
  }

  getClaseBotonValidar(): string {
    let clase = 'btn-validar-compact';

    if (this.validandoCliente) {
      clase += ' btn-validando';
    } else if (this.clienteEncontrado) {
      clase += ' btn-encontrado';
    } else if (this.validacionIntentada && this.clienteSinPaciente.cedula) {
      clase += ' btn-no-encontrado';
    }

    return clase;
  }

  getTooltipBotonValidar(): string {
    if (this.validandoCliente) {
      return 'Buscando cliente...';
    }

    if (this.clienteEncontrado) {
      return 'Cliente encontrado';
    }

    if (!this.clienteSinPaciente.cedula) {
      return 'Ingrese una cedula para buscar';
    }

    if (!this.validarCedula(this.clienteSinPaciente.cedula, this.clienteSinPaciente.tipoPersona)) {
      return 'Corrija el formato de la cedula o RIF';
    }

    return 'Buscar cliente en base de datos';
  }

  onNombreChange(): void {
    this.clienteSinPaciente.nombreCompleto = String(this.clienteSinPaciente.nombreCompleto || '');
    this.sincronizarClienteFormularioConPresupuesto();
  }

  onTelefonoChange(): void {
    this.clienteSinPaciente.telefono = String(this.clienteSinPaciente.telefono || '').replace(/[^\d+\s]/g, '');
    this.sincronizarClienteFormularioConPresupuesto();

    if (!this.clienteSinPaciente.telefono || this.validarTelefono(this.clienteSinPaciente.telefono)) {
      this.mensajeValidacionCliente = this.clienteEncontrado ? 'Cliente encontrado' : '';
      return;
    }

    this.mensajeValidacionCliente = this.getMensajeErrorTelefono();
  }

  onTelefonoBlur(): void {
    const telefono = String(this.clienteSinPaciente.telefono || '').trim();
    if (!telefono) {
      this.sincronizarClienteFormularioConPresupuesto();
      return;
    }

    this.clienteSinPaciente.telefono = telefono.replace(/\s+/g, ' ');
    this.sincronizarClienteFormularioConPresupuesto();

    if (!this.validarTelefono(this.clienteSinPaciente.telefono)) {
      this.mensajeValidacionCliente = this.getMensajeErrorTelefono();
    }
  }

  onEmailChange(): void {
    this.clienteSinPaciente.email = String(this.clienteSinPaciente.email || '').trim().toLowerCase();
    this.sincronizarClienteFormularioConPresupuesto();

    if (!this.validarEmail(this.clienteSinPaciente.email)) {
      this.mensajeValidacionCliente = 'Formato de email invalido.';
    }
  }

  private limpiarCamposCliente(): void {
    const cedulaActual = this.clienteSinPaciente.cedula;
    const tipoPersonaActual = this.clienteSinPaciente.tipoPersona;

    this.clienteSinPaciente = {
      ...this.getClienteVacio(),
      cedula: cedulaActual,
      tipoPersona: tipoPersonaActual
    };

    this.sincronizarClienteFormularioConPresupuesto();
  }

  private limpiarEstadoValidacion(): void {
    this.clienteEncontrado = false;
    this.validandoCliente = false;
    this.validacionIntentada = false;
    this.mensajeValidacionCliente = '';
    this.cedulaAnterior = '';
  }

  private autocompletarDatosCliente(respuesta: any): void {
    const cliente = respuesta?.cliente || respuesta || {};
    const pacienteKey = String(cliente?.pacienteKey || cliente?.paciente_key || '').trim() || null;
    const pacienteId = String(cliente?.pacienteId || cliente?.paciente_id || '').trim() || null;

    this.clienteSinPaciente = {
      ...this.getClienteVacio(),
      tipoPersona: cliente?.cedula?.toUpperCase?.().startsWith('J') ? 'juridica' : (cliente?.tipoPersona || this.clienteSinPaciente.tipoPersona || 'natural'),
      cedula: String(cliente?.cedula || this.clienteSinPaciente.cedula || '').trim(),
      nombreCompleto: String(cliente?.nombreCompleto || cliente?.nombre || cliente?.razonSocial || '').trim(),
      telefono: String(cliente?.telefono || '').trim(),
      email: String(cliente?.email || '').trim(),
      direccion: String(cliente?.direccion || '').trim(),
      razonSocial: String(cliente?.razonSocial || cliente?.nombreCompleto || cliente?.nombre || '').trim(),
      pacienteKey,
      pacienteId,
      key: String(cliente?.key || '').trim() || null,
      id: String(cliente?.id || '').trim() || null
    };

    this.sincronizarClienteFormularioConPresupuesto();
  }

  async validarClientePorCedula(): Promise<void> {
    const cedula = String(this.clienteSinPaciente.cedula || '').trim();

    if (!cedula || !this.validarCedula(cedula, this.clienteSinPaciente.tipoPersona)) {
      return;
    }

    this.cedulaAnterior = cedula;
    this.validandoCliente = true;
    this.clienteEncontrado = false;
    this.validacionIntentada = false;
    this.mensajeValidacionCliente = 'Buscando cliente...';

    try {
      const respuesta = await lastValueFrom(this.clienteService.buscarPorCedula(cedula));

      if (String(this.clienteSinPaciente.cedula || '').trim() !== cedula) {
        return;
      }

      this.validacionIntentada = true;
      const clienteExiste = Boolean(respuesta?.cliente?.cedula);

      if (clienteExiste) {
        this.autocompletarDatosCliente(respuesta);
        this.clienteEncontrado = true;
        this.mensajeValidacionCliente = 'Cliente encontrado';
      } else {
        this.clienteEncontrado = false;
        this.mensajeValidacionCliente = 'Cliente no encontrado. Complete los datos manualmente.';
        this.limpiarCamposCliente();
        this.clienteSinPaciente.cedula = cedula;
        this.sincronizarClienteFormularioConPresupuesto();
      }
    } catch (error) {
      console.error('Error validando cliente para presupuesto:', error);
      this.validacionIntentada = true;
      this.clienteEncontrado = false;
      this.mensajeValidacionCliente = 'No se pudo validar el cliente.';
      this.limpiarCamposCliente();
      this.clienteSinPaciente.cedula = cedula;
      this.sincronizarClienteFormularioConPresupuesto();
    } finally {
      this.validandoCliente = false;
      this.cdr.detectChanges();
    }
  }

  private aplicarPresupuestosDesdeFuente(presupuestos: any[]): void {
    const normalizados = presupuestos.map((presupuesto) => this.normalizarPresupuestoPersistido(presupuesto));

    this.presupuestosVigentes = normalizados.filter((presupuesto) => presupuesto.estadoColor !== 'vencido');
    this.presupuestosVencidos = normalizados.filter((presupuesto) => presupuesto.estadoColor === 'vencido');

    this.actualizarDiasRestantesDinamicos();
    this.inicializarPresupuestosFiltrados();
    this.filtrarPresupuestos();
    this.calcularEstadisticas();
  }

  private normalizarPresupuestoPersistido(presupuesto: any): any {
    const fechaCreacion = presupuesto?.fechaCreacion ? new Date(presupuesto.fechaCreacion) : new Date();
    const fechaVencimiento = presupuesto?.fechaVencimiento ? new Date(presupuesto.fechaVencimiento) : new Date();
    const productos = Array.isArray(presupuesto?.productos)
      ? presupuesto.productos.map((producto: any) => this.normalizarProductoPresupuestoPersistido(producto))
      : [];

    const subtotal = Number(presupuesto?.subtotal || 0);
    const descuentoTotal = Number(presupuesto?.descuentoTotal || 0);
    const iva = Number(presupuesto?.iva || 0);
    const total = Number(presupuesto?.total || 0);
    const formulaExterna = this.normalizarFormulaExternaPersistida(presupuesto?.formulaExterna);

    const presupuestoNormalizado: Presupuesto = {
      ...presupuesto,
      id: Number(presupuesto?.id || 0),
      codigo: String(presupuesto?.codigo || '').trim(),
      cliente: {
        ...this.getClienteVacio(),
        ...(presupuesto?.cliente || {})
      },
      fechaCreacion,
      fechaVencimiento,
      diasVencimiento: Number(presupuesto?.diasVencimiento || 7),
      productos,
      subtotal,
      descuentoTotal,
      iva,
      total,
      opciones: Array.isArray(presupuesto?.opciones) ? presupuesto.opciones : [],
      opcionPrincipalId: String(presupuesto?.opcionPrincipalId || ''),
      observaciones: presupuesto?.observaciones || '',
      formulaExterna,
      estado: presupuesto?.estado || 'vigente',
      estadoColor: presupuesto?.estadoColor || 'vigente',
      diasRestantes: Number(presupuesto?.diasRestantes ?? 0)
    };

    this.asegurarOpcionesPresupuesto(presupuestoNormalizado);
    this.sincronizarResumenDesdeOpcionPrincipal(presupuestoNormalizado);
    return presupuestoNormalizado;
  }

  private async cargarPresupuestosDesdeApi(mostrarError: boolean = true, autoArchivar: boolean = true): Promise<void> {
    try {
      if (autoArchivar) {
        await lastValueFrom(this.presupuestoService.autoArchivarPresupuestos(this.diasParaAutoArchivo));
      }

      const presupuestos = await lastValueFrom(this.presupuestoService.getPresupuestos());
      this.aplicarPresupuestosDesdeFuente(presupuestos);
    } catch (error) {
      console.error('Error cargando presupuestos desde API:', error);
      this.presupuestosVigentes = [];
      this.presupuestosVencidos = [];
      this.inicializarPresupuestosFiltrados();
      this.calcularEstadisticas();

      if (mostrarError) {
        this.snackBar.open('No se pudieron cargar los presupuestos', 'Cerrar', {
          duration: 3000,
          panelClass: ['snackbar-warning']
        });
      }
    }
  }

  private construirPayloadPresupuesto(presupuesto: any): any {
    const cliente = presupuesto?.cliente || this.getClienteVacio();
    const tipoPersona = cliente?.tipoPersona === 'juridica' ? 'juridica' : 'natural';
    const pacienteKey = String(
      cliente?.pacienteKey
      || presupuesto?.pacienteKeyOrigen
      || presupuesto?.historia?.pacienteKey
      || ''
    ).trim();
    const pacienteId = String(
      cliente?.pacienteId
      || presupuesto?.pacienteIdOrigen
      || presupuesto?.historia?.pacienteId
      || ''
    ).trim();
    const nombreCompleto = String(
      tipoPersona === 'juridica'
        ? (cliente?.razonSocial || cliente?.nombreCompleto || cliente?.nombre || '')
        : (cliente?.nombreCompleto || cliente?.nombre || '')
    ).trim();
    const opciones = this.asegurarOpcionesPresupuesto(presupuesto).map((opcion) => {
      this.recalcularTotalesPresupuesto(opcion as any);
      return {
        id: opcion.id,
        nombre: String(opcion.nombre || '').trim(),
        observaciones: String(opcion.observaciones || '').trim(),
        esPrincipal: opcion.id === presupuesto?.opcionPrincipalId,
        subtotal: Number(opcion.subtotal || 0),
        descuentoTotal: Number(opcion.descuentoTotal || 0),
        iva: Number(opcion.iva || 0),
        total: Number(opcion.total || 0),
        productos: (opcion.productos || []).map((producto: any) => this.construirPayloadProductoPresupuesto(producto))
      };
    });
    const opcionPrincipal = opciones.find((opcion) => opcion.esPrincipal) || opciones[0];
    const productosPrincipal = opcionPrincipal?.productos || [];

    return {
      codigo: String(presupuesto?.codigo || '').trim(),
      cliente: {
        tipoPersona,
        cedula: String(cliente?.cedula || '').trim(),
        nombreCompleto,
        razonSocial: tipoPersona === 'juridica' ? nombreCompleto : '',
        telefono: String(cliente?.telefono || '').trim(),
        email: String(cliente?.email || '').trim(),
        direccion: String(cliente?.direccion || '').trim(),
        pacienteKey: pacienteKey || null,
        pacienteId: pacienteId || null
      },
      historia: {
        id: String(presupuesto?.historiaMedicaId || presupuesto?.historia?.id || '').trim() || null,
        numero: String(presupuesto?.historiaNumero || presupuesto?.historia?.numero || '').trim() || null,
        pacienteKey: pacienteKey || null,
        pacienteId: pacienteId || null,
        especialistaTipo: String(presupuesto?.historia?.especialistaTipo || '').trim() || null
      },
      fechaCreacion: presupuesto?.fechaCreacion,
      fechaVencimiento: presupuesto?.fechaVencimiento,
      diasVencimiento: Number(presupuesto?.diasVencimiento || 7),
      vendedor: String(presupuesto?.vendedor || this.usuarioActual?.nombre || '').trim(),
      observaciones: this.construirObservacionesConFormulaExterna(presupuesto),
      formulaExterna: this.normalizarFormulaExternaPersistida(presupuesto?.formulaExterna),
      estado: String(presupuesto?.estado || 'vigente').trim(),
      ivaPorcentaje: this.ivaPorcentaje,
      opcionPrincipalId: opcionPrincipal?.id || '',
      opciones,
      productos: productosPrincipal.map((producto: any) => this.construirPayloadProductoPresupuesto(producto))
    };
  }

  private calcularDiasRestantesParaFecha(fecha: Date): number {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fechaComparar = new Date(fecha);
    fechaComparar.setHours(0, 0, 0, 0);

    return Math.ceil((fechaComparar.getTime() - hoy.getTime()) / (1000 * 3600 * 24));
  }

  inicializarNuevoPresupuesto() {
    this.sincronizarContextoUsuario();

    const fechaCreacion = new Date();
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 7);

    this.nuevoPresupuesto = {
      codigo: '',
      cliente: this.getClienteVacio(),
      historiaMedicaId: null,
      historiaNumero: null,
      pacienteKeyOrigen: null,
      pacienteIdOrigen: null,
      fechaCreacion,
      fechaVencimiento,
      diasVencimiento: 7,
      vendedor: this.usuarioActual?.nombre?.trim() || '',
      opciones: [],
      opcionPrincipalId: '',
      productos: [],
      subtotal: 0,
      descuentoTotal: 0,
      iva: 0,
      total: 0,
      observaciones: '',
      estado: 'vigente',
      estadoColor: 'vigente',
      diasRestantes: this.calcularDiasRestantesParaFecha(fechaVencimiento),
      formulaExterna: {
        activa: false,
        origen: null,
        refraccionFinal: this.crearRefraccionFinalVacia()
      }
    };
    this.historiaPresupuestoHandoffActivo = null;

    this.asegurarOpcionesPresupuesto(this.nuevoPresupuesto);
    this.sincronizarOpcionActivaNuevo(this.nuevoPresupuesto.opcionPrincipalId);

    this.sincronizarClienteFormularioDesdePresupuesto();
    this.limpiarEstadoValidacion();
  }

  cargarDatos() {
    this.cargarPresupuestos();
    this.cargarProductos();
  }

  cargarPresupuestos() {
    void this.cargarPresupuestosDesdeApi();
  }

  actualizarDiasRestantesDinamicos(): void {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Establece la hora a medianoche para comparar solo fechas

    // Actualizar presupuestos vigentes
    this.presupuestosVigentes.forEach(presupuesto => {
      if (['convertido', 'archivado', 'anulado'].includes(String(presupuesto.estadoColor || presupuesto.estado || '').toLowerCase())) {
        return;
      }

      const fechaVencimiento = new Date(presupuesto.fechaVencimiento);
      fechaVencimiento.setHours(0, 0, 0, 0); // Solo fecha

      // Calcular diferencia en días
      const diffTiempo = fechaVencimiento.getTime() - hoy.getTime();
      const diasRestantes = Math.ceil(diffTiempo / (1000 * 3600 * 24));

      presupuesto.diasRestantes = diasRestantes;

      // IMPORTANTE: Actualizar estadoColor basado en díasRestantes
      if (diasRestantes < 0) {
        // Si está vencido, moverlo a vencidos
        presupuesto.estadoColor = 'vencido';
        this.moverPresupuestoAVencidos(presupuesto);
      } else {
        // Mantener en vigentes con el estado correcto
        presupuesto.estadoColor = this.getEstadoColor(diasRestantes);
      }
    });

    // Actualizar presupuestos vencidos
    this.presupuestosVencidos.forEach(presupuesto => {
      if (['convertido', 'archivado', 'anulado'].includes(String(presupuesto.estadoColor || presupuesto.estado || '').toLowerCase())) {
        return;
      }

      const fechaVencimiento = new Date(presupuesto.fechaVencimiento);
      fechaVencimiento.setHours(0, 0, 0, 0);

      const diffTiempo = fechaVencimiento.getTime() - hoy.getTime();
      const diasRestantes = Math.ceil(diffTiempo / (1000 * 3600 * 24));

      presupuesto.diasRestantes = diasRestantes;
      presupuesto.estadoColor = 'vencido'; // Siempre vencido en esta lista
    });

    this.calcularEstadisticas();
  }

  // Método para mover presupuesto a vencidos
  moverPresupuestoAVencidos(presupuesto: any): void {
    // Remover de vigentes
    this.presupuestosVigentes = this.presupuestosVigentes.filter(p => p.id !== presupuesto.id);

    // Agregar a vencidos (si no existe ya)
    if (!this.presupuestosVencidos.some(p => p.id === presupuesto.id)) {
      this.presupuestosVencidos.push(presupuesto);
    }
  }

  // Asegúrate de que getEstadoColor esté definido
  getEstadoColor(diasRestantes: number): string {
    if (diasRestantes < 0) {
      return 'vencido';
    } else if (diasRestantes === 0) {
      return 'hoy';
    } else if (diasRestantes <= 3) {
      return 'proximo';
    } else {
      return 'vigente';
    }
  }

  cargarProductos() {
    this.productosCargando = true;

    this.productoService.getProductos().subscribe({
      next: ({ iva, productos }) => {
        this.ivaPorcentaje = iva ?? this.ivaPorcentaje;
        this.productosDisponiblesBase = productos.filter((producto) => producto.activo !== false);
        this.reaplicarMonedaActualEnProductosDisponibles();
        this.aplicarFiltroCatalogoProductos();
        this.productosCargando = false;
      },
      error: (error) => {
        console.error('Error al cargar productos reales para presupuesto:', error);
        this.productosDisponiblesBase = [];
        this.productosDisponibles = [];
        this.productosFiltrados = [];
        this.productosCargando = false;
        this.snackBar.open('No se pudieron cargar los productos reales para presupuesto', 'Cerrar', {
          duration: 3500,
          panelClass: ['snackbar-warning']
        });
      }
    });
  }

  // ========== MÉTODOS PARA PRODUCTOS ==========
  // Método unificado para buscar/filtrar productos
  filtrarProductos(termino?: string) {
    const busqueda = termino || this.terminoBusqueda;

    if (!busqueda) {
      this.productosFiltrados = [];
      return;
    }

    const terminoBusqueda = busqueda.toLowerCase().trim();
    const busquedaNormalizada = this.normalizarBusqueda(busqueda);

    this.productosFiltrados = this.productosDisponibles.filter((producto) => {
      const descripcion = String(producto?.descripcion || '').toLowerCase();
      const nombre = String(producto?.nombre || '').toLowerCase();
      const codigo = String(producto?.codigo || '');
      const codigoLower = codigo.toLowerCase();
      const codigoNormalizado = this.normalizarCodigoParaBusqueda(codigo);
      const idTexto = String(producto?.id || '').trim();

      return descripcion.includes(terminoBusqueda) ||
        nombre.includes(terminoBusqueda) ||
        idTexto.includes(terminoBusqueda) ||
        codigoLower.includes(terminoBusqueda) ||
        (busquedaNormalizada.length > 0 && (
          idTexto.includes(busquedaNormalizada) ||
          codigoNormalizado.includes(busquedaNormalizada) ||
          this.coincideCodigoParcial(codigo, busqueda)
        ));
    });
  }

  // Método de compatibilidad para el HTML antiguo
  buscarProductos(termino: string): any[] {
    if (!termino) {
      return this.productosDisponibles;
    }

    const busqueda = termino.toLowerCase().trim();
    const busquedaNormalizada = this.normalizarBusqueda(termino);

    return this.productosDisponibles.filter((producto) => {
      const descripcion = String(producto?.descripcion || '').toLowerCase();
      const nombre = String(producto?.nombre || '').toLowerCase();
      const codigo = String(producto?.codigo || '');
      const codigoLower = codigo.toLowerCase();
      const codigoNormalizado = this.normalizarCodigoParaBusqueda(codigo);
      const idTexto = String(producto?.id || '').trim();

      return descripcion.includes(busqueda) ||
        nombre.includes(busqueda) ||
        idTexto.includes(busqueda) ||
        codigoLower.includes(busqueda) ||
        (busquedaNormalizada.length > 0 && (
          idTexto.includes(busquedaNormalizada) ||
          codigoNormalizado.includes(busquedaNormalizada) ||
          this.coincideCodigoParcial(codigo, termino)
        ));
    });
  }

  eliminarProducto(index: number) {
    this.nuevoPresupuesto.productos.splice(index, 1);
    this.calcularTotales();
  }

  actualizarCantidad(producto: any, nuevaCantidad: number) {
    if (nuevaCantidad > 0) {
      producto.cantidad = nuevaCantidad;
      producto.total = producto.cantidad * producto.precio * (1 - (producto.descuento || 0) / 100);
      this.calcularTotales();
    }
  }

  actualizarDescuento(producto: any, nuevoDescuento: number) {
    if (nuevoDescuento >= 0 && nuevoDescuento <= 100) {
      producto.descuento = nuevoDescuento;
      producto.total = producto.cantidad * producto.precio * (1 - (producto.descuento || 0) / 100);
      this.calcularTotales();
    }
  }

  // ========== MÉTODOS PARA MODALES ==========
  abrirModalNuevoPresupuesto() {
    this.inicializarNuevoPresupuesto();
    this.mostrarModalNuevoPresupuesto = true;
    this.sincronizarEstadoBodyModal();
  }

  cerrarModalNuevoPresupuesto() {
    this.mostrarModalNuevoPresupuesto = false;
    this.inicializarNuevoPresupuesto();
    this.sincronizarEstadoBodyModal();
  }

  private leerHistoriaPresupuestoHandoff(): HistoriaPresupuestoHandoff | null {
    const handoffRaw = sessionStorage.getItem(HISTORIA_PRESUPUESTO_HANDOFF_STORAGE_KEY);
    if (!handoffRaw) {
      return null;
    }

    try {
      const handoff = JSON.parse(handoffRaw) as HistoriaPresupuestoHandoff;
      if (!handoff?.pacienteKey || !handoff?.historiaId || !Array.isArray(handoff?.opciones) || handoff.opciones.length === 0) {
        sessionStorage.removeItem(HISTORIA_PRESUPUESTO_HANDOFF_STORAGE_KEY);
        return null;
      }

      return handoff;
    } catch {
      sessionStorage.removeItem(HISTORIA_PRESUPUESTO_HANDOFF_STORAGE_KEY);
      return null;
    }
  }

  private aplicarHandoffHistoriaPresupuestoSiExiste(): void {
    const handoff = this.leerHistoriaPresupuestoHandoff();
    if (!handoff) {
      return;
    }

    sessionStorage.removeItem(HISTORIA_PRESUPUESTO_HANDOFF_STORAGE_KEY);
    this.inicializarNuevoPresupuesto();

    const opciones = handoff.opciones
      .map((opcion, index) => this.crearOpcionPresupuesto(opcion.nombre || `Recomendación ${index + 1}`, opcion.productos || [], {
        id: String(opcion.id || `hist-rec-${index + 1}`),
        observaciones: String(opcion.observaciones || '').trim(),
        esPrincipal: Boolean(opcion.esPrincipal)
      }))
      .filter((opcion) => Array.isArray(opcion.productos) && opcion.productos.length > 0);

    if (opciones.length === 0) {
      this.snackBar.open('La historia médica no tiene productos recomendados listos para presupuestar.', 'Cerrar', {
        duration: 4000,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    const cliente = {
      ...this.getClienteVacio(),
      ...(handoff.cliente || {}),
      pacienteKey: String(handoff.pacienteKey || '').trim() || null,
      pacienteId: String(handoff.pacienteId || '').trim() || null
    };

    this.nuevoPresupuesto.cliente = cliente;
    this.nuevoPresupuesto.historiaMedicaId = String(handoff.historiaId || '').trim() || null;
    this.nuevoPresupuesto.historiaNumero = String(handoff.historiaNumero || '').trim() || null;
    this.nuevoPresupuesto.historia = {
      ...(this.nuevoPresupuesto.historia || {}),
      id: String(handoff.historiaId || '').trim() || null,
      numero: String(handoff.historiaNumero || '').trim() || null,
      pacienteKey: String(handoff.pacienteKey || '').trim() || null,
      pacienteId: String(handoff.pacienteId || '').trim() || null,
      especialistaTipo: String(handoff.especialistaTipo || '').trim() || null
    };
    this.nuevoPresupuesto.pacienteKeyOrigen = String(handoff.pacienteKey || '').trim() || null;
    this.nuevoPresupuesto.pacienteIdOrigen = String(handoff.pacienteId || '').trim() || null;
    this.nuevoPresupuesto.observaciones = String(handoff.observaciones || '').trim();
    this.nuevoPresupuesto.formulaExterna = this.normalizarFormulaExternaPersistida(handoff.formulaExterna);
    this.nuevoPresupuesto.opciones = opciones;
    this.nuevoPresupuesto.opcionPrincipalId = String(
      handoff.opcionPrincipalId
      || opciones.find((opcion) => opcion.esPrincipal)?.id
      || opciones[0]?.id
      || ''
    ).trim();

    opciones.forEach((opcion) => {
      opcion.esPrincipal = opcion.id === this.nuevoPresupuesto.opcionPrincipalId;
    });

    this.historiaPresupuestoHandoffActivo = handoff;
    this.sincronizarClienteFormularioDesdePresupuesto();
    this.sincronizarResumenDesdeOpcionPrincipal(this.nuevoPresupuesto);
    this.sincronizarOpcionActivaNuevo(this.nuevoPresupuesto.opcionPrincipalId);
    this.mostrarModalNuevoPresupuesto = true;
    this.sincronizarEstadoBodyModal();
    this.cdr.detectChanges();

    this.snackBar.open(
      `Historia ${handoff.historiaNumero || handoff.historiaId} cargada en presupuesto con ${opciones.length} opción(es).`,
      'Cerrar',
      {
        duration: 4500,
        panelClass: ['snackbar-info']
      }
    );
  }

  abrirModalAgregarProducto() {
    this.mostrarModalAgregarProducto = true;
    this.busquedaProducto = '';
    this.buscarProductos('');
  }

  cerrarModalAgregarProducto() {
    this.mostrarModalAgregarProducto = false;
    this.busquedaProducto = '';
  }

  abrirModalCatalogoProductos(): void {
    const abrirDesdeDetalleEditable = this.mostrarModalDetallePresupuesto && this.modoEditable && !!this.presupuestoSeleccionado;

    if (abrirDesdeDetalleEditable) {
      this.posicionScrollDetalleAntesCatalogo = this.obtenerScrollModalDetalle();
      this.detalleModalOcultoPorCatalogo = true;
      this.mostrarModalDetallePresupuesto = false;
    }

    this.mostrarModalCatalogoProductos = true;
    this.terminoBusquedaCatalogoProductos = this.terminoBusqueda || '';
    this.categoriaFiltroCatalogoProductos = 'todas';
    this.aplicarFiltroCatalogoProductos();
    this.sincronizarEstadoBodyModal();
  }

  cerrarModalCatalogoProductos(): void {
    this.mostrarModalCatalogoProductos = false;
    this.limpiarIndicadoresCatalogoReciente();

    if (this.detalleModalOcultoPorCatalogo && this.presupuestoSeleccionado) {
      this.mostrarModalDetallePresupuesto = true;
      const posicionScroll = this.posicionScrollDetalleAntesCatalogo;

      setTimeout(() => {
        this.establecerScrollModalDetalle(posicionScroll);
      }, 0);
    }

    this.detalleModalOcultoPorCatalogo = false;
    this.posicionScrollDetalleAntesCatalogo = 0;
    this.sincronizarEstadoBodyModal();
  }

  obtenerCategoriasCatalogoProductos(): string[] {
    const categorias = this.productosDisponibles
      .map((producto) => this.obtenerCategoriaCatalogoProducto(producto))
      .filter((categoria) => Boolean(categoria));

    return Array.from(new Set(categorias)).sort((a, b) => a.localeCompare(b));
  }

  aplicarFiltroCatalogoProductos(): void {
    const termino = String(this.terminoBusquedaCatalogoProductos || '').trim().toLowerCase();
    const terminoNormalizado = this.normalizarBusqueda(termino);
    const categoriaFiltro = String(this.categoriaFiltroCatalogoProductos || 'todas').trim().toLowerCase();

    this.productosCatalogoFiltrados = this.productosDisponibles.filter((producto) => {
      const categoriaProducto = this.obtenerCategoriaCatalogoProducto(producto).toLowerCase();
      const categoriaValida = categoriaFiltro === 'todas' || categoriaProducto === categoriaFiltro;
      if (!categoriaValida) {
        return false;
      }

      if (!termino) {
        return true;
      }

      const descripcion = String(producto?.descripcion || '').toLowerCase();
      const nombre = String(producto?.nombre || '').toLowerCase();
      const codigo = String(producto?.codigo || '');
      const codigoLower = codigo.toLowerCase();
      const codigoNormalizado = this.normalizarCodigoParaBusqueda(codigo);
      const idTexto = String(producto?.id || '').trim();

      return descripcion.includes(termino)
        || nombre.includes(termino)
        || idTexto.includes(termino)
        || codigoLower.includes(termino)
        || (terminoNormalizado.length > 0 && (
          idTexto.includes(terminoNormalizado)
          || codigoNormalizado.includes(terminoNormalizado)
          || this.coincideCodigoParcial(codigo, termino)
        ));
    });
  }

  agregarProductoDesdeCatalogo(producto: any): void {
    const estaEditandoDetalle = this.modoEditable
      && !!this.presupuestoSeleccionado
      && (this.mostrarModalDetallePresupuesto || this.detalleModalOcultoPorCatalogo);

    if (estaEditandoDetalle) {
      this.agregarProductoDetalle(producto);
    } else {
      this.agregarProducto(producto);
    }

    this.marcarProductoRecienAgregadoCatalogo(producto?.id);
    this.aplicarFiltroCatalogoProductos();
  }

  obtenerCantidadProductoEnContextoCatalogo(productoId: unknown): number {
    const claveProducto = this.obtenerClaveProductoCatalogo(productoId);
    if (!claveProducto) {
      return 0;
    }

    const productosContexto = this.obtenerProductosContextoCatalogo();

    return productosContexto.reduce((total: number, producto: any) => {
      if (this.obtenerClaveProductoCatalogo(producto?.id) !== claveProducto) {
        return total;
      }

      return total + Number(producto?.cantidad || 1);
    }, 0);
  }

  esProductoRecienAgregadoEnCatalogo(productoId: unknown): boolean {
    const claveProducto = this.obtenerClaveProductoCatalogo(productoId);
    return Boolean(claveProducto && this.productosCatalogoRecienAgregados.has(claveProducto));
  }

  private obtenerProductosContextoCatalogo(): any[] {
    const estaEditandoDetalle = this.modoEditable
      && !!this.presupuestoSeleccionado
      && (this.mostrarModalDetallePresupuesto || this.detalleModalOcultoPorCatalogo);

    if (estaEditandoDetalle) {
      return Array.isArray(this.presupuestoSeleccionado?.productos)
        ? this.presupuestoSeleccionado.productos
        : [];
    }

    return Array.isArray(this.nuevoPresupuesto?.productos)
      ? this.nuevoPresupuesto.productos
      : [];
  }

  private marcarProductoRecienAgregadoCatalogo(productoId: unknown): void {
    const claveProducto = this.obtenerClaveProductoCatalogo(productoId);
    if (!claveProducto) {
      return;
    }

    this.productosCatalogoRecienAgregados.add(claveProducto);

    const timeoutPrevio = this.timeoutIndicadoresCatalogo.get(claveProducto);
    if (timeoutPrevio) {
      clearTimeout(timeoutPrevio);
    }

    const timeoutNuevo = setTimeout(() => {
      this.productosCatalogoRecienAgregados.delete(claveProducto);
      this.timeoutIndicadoresCatalogo.delete(claveProducto);
      this.cdr.detectChanges();
    }, 1800);

    this.timeoutIndicadoresCatalogo.set(claveProducto, timeoutNuevo);
  }

  private limpiarIndicadoresCatalogoReciente(): void {
    this.timeoutIndicadoresCatalogo.forEach((timeoutId) => clearTimeout(timeoutId));
    this.timeoutIndicadoresCatalogo.clear();
    this.productosCatalogoRecienAgregados.clear();
  }

  private obtenerClaveProductoCatalogo(productoId: unknown): string {
    if (productoId === null || productoId === undefined) {
      return '';
    }

    return String(productoId).trim();
  }

  async agregarConsultaMedica(): Promise<void> {
    if (this.nuevoPresupuesto.productos.some((producto: any) => this.esLineaConsulta(producto))) {
      this.snackBar.open('La consulta medica ya fue agregada al presupuesto', 'Cerrar', {
        duration: 2500,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    this.cargandoConsultaMedica = true;

    try {
      const montoSugerido = await this.obtenerMontoConsultaSugerido();
      this.nuevoPresupuesto.productos.push(this.crearLineaConsultaPresupuesto(montoSugerido));
      this.calcularTotales();
      this.snackBar.open('Consulta medica agregada al presupuesto', 'Cerrar', {
        duration: 2500,
        panelClass: ['snackbar-success']
      });
    } finally {
      this.cargandoConsultaMedica = false;
    }
  }

  async agregarConsultaMedicaDetalle(): Promise<void> {
    if (!this.presupuestoSeleccionado) {
      return;
    }

    if (this.presupuestoSeleccionado.productos.some((producto: any) => this.esLineaConsulta(producto))) {
      this.snackBar.open('Este presupuesto ya tiene una consulta medica agregada', 'Cerrar', {
        duration: 2500,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    this.cargandoConsultaMedica = true;

    try {
      const montoSugerido = await this.obtenerMontoConsultaSugerido();
      this.presupuestoSeleccionado.productos.push(this.crearLineaConsultaPresupuesto(montoSugerido));
      this.calcularTotalesDetalle();
      this.snackBar.open('Consulta medica agregada al presupuesto', 'Cerrar', {
        duration: 2500,
        panelClass: ['snackbar-success']
      });
    } finally {
      this.cargandoConsultaMedica = false;
    }
  }

  private obtenerCategoriaCatalogoProducto(producto: any): string {
    return String(this.obtenerCategoriaProductoPresupuesto(producto) || 'Sin categoria').trim() || 'Sin categoria';
  }

  confirmarEliminarPresupuesto(presupuesto: any) {
    this.presupuestoAEliminar = presupuesto;
    this.mostrarModalEliminar = true;
    this.sincronizarEstadoBodyModal();
  }

  cerrarModalEliminar() {
    this.mostrarModalEliminar = false;
    this.presupuestoAEliminar = null;
    this.sincronizarEstadoBodyModal();
  }

  estaModalAccionPresupuestoAbierto(): boolean {
    return this.mostrarModalEliminar || this.mostrarModalRenovarPresupuesto;
  }

  getPresupuestoModalAccion(): any {
    return this.mostrarModalEliminar ? this.presupuestoAEliminar : this.presupuestoParaRenovar;
  }

  esModalEliminarActivo(): boolean {
    return this.mostrarModalEliminar;
  }

  esModalRenovarActivo(): boolean {
    return this.mostrarModalRenovarPresupuesto;
  }

  cerrarModalAccionPresupuesto(): void {
    if (this.mostrarModalEliminar) {
      this.cerrarModalEliminar();
      return;
    }

    if (this.mostrarModalRenovarPresupuesto) {
      this.cerrarModalRenovarPresupuesto();
    }
  }

  confirmarModalAccionPresupuesto(): void {
    if (this.mostrarModalEliminar) {
      this.eliminarPresupuesto();
      return;
    }

    if (this.mostrarModalRenovarPresupuesto) {
      this.confirmarRenovacionPresupuesto();
    }
  }

  getTituloModalAccionPresupuesto(): string {
    return this.esModalEliminarActivo() ? 'Eliminar Presupuesto' : 'Renovar Presupuesto';
  }

  getIconoModalAccionPresupuesto(): string {
    return this.esModalEliminarActivo() ? 'bi-trash' : 'bi-arrow-repeat';
  }

  getTituloHeroModalAccionPresupuesto(): string {
    return this.esModalEliminarActivo()
      ? 'Se eliminará el presupuesto de forma permanente'
      : 'Se reactivará el presupuesto por 7 días adicionales';
  }

  getDescripcionModalAccionPresupuesto(): string {
    return this.esModalEliminarActivo()
      ? 'Este presupuesto dejará de estar disponible en el módulo y también será removido del almacenamiento local de pruebas.'
      : 'El presupuesto volverá al listado de vigentes con una nueva fecha de vencimiento para que puedas retomarlo y convertirlo más adelante si lo necesitas.';
  }

  getClaseHeroModalAccionPresupuesto(): string {
    return this.esModalEliminarActivo() ? 'conversion-hero conversion-hero--danger' : 'conversion-hero conversion-hero--warning';
  }

  getClaseIconoModalAccionPresupuesto(): string {
    return this.esModalEliminarActivo() ? 'conversion-icon conversion-icon--danger' : 'conversion-icon conversion-icon--warning';
  }

  getTextoEtiquetaFechaModalAccion(): string {
    return this.esModalEliminarActivo() ? 'Vence' : 'Vencimiento anterior';
  }

  getTextoBotonModalAccionPresupuesto(): string {
    return this.esModalEliminarActivo() ? 'Eliminar Permanentemente' : 'Renovar 7 Días';
  }

  getClaseBotonModalAccionPresupuesto(): string {
    return this.esModalEliminarActivo() ? 'btn btn-danger' : 'btn btn-warning';
  }

  // Método para calcular descuento total
  calcularDescuentoTotalPresupuesto(): number {
    if (!this.presupuestoSeleccionado) return 0;

    return this.presupuestoSeleccionado.productos.reduce((total: number, producto: any) => {
      const subtotalProducto = producto.precio * producto.cantidad;
      return total + (subtotalProducto * (producto.descuento / 100));
    }, 0);
  }

  async eliminarPresupuesto() {
    if (!this.presupuestoAEliminar) return;

    try {
      await lastValueFrom(this.presupuestoService.eliminarPresupuesto(Number(this.presupuestoAEliminar.id)));
      this.cerrarModalEliminar();
      await this.cargarPresupuestosDesdeApi(false);
      this.snackBar.open('Presupuesto eliminado correctamente', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-success']
      });
    } catch (error) {
      console.error('Error eliminando presupuesto:', error);
    }
  }

  // ========== UTILIDADES ==========

  cambiarTab(tab: string) {
    this.tabActiva = tab;
    this.actualizarDiasRestantesDinamicos();
  }

  seleccionarDiasVencimiento(dias: number) {
    this.nuevoPresupuesto.diasVencimiento = dias;
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + dias);
    this.nuevoPresupuesto.fechaVencimiento = fecha;
  }

  puedeMostrarSeccionesPosterioresNuevo(): boolean {
    return this.clienteEncontrado && !this.validandoCliente;
  }

  puedeGenerarPresupuesto(): boolean {
    const cliente = this.nuevoPresupuesto?.cliente || {};
    const cedula = String(cliente?.cedula || '').trim();
    const nombre = String(cliente?.nombreCompleto || '').trim();
    const tieneProductos = this.presupuestoTieneProductos(this.nuevoPresupuesto);
    const formulaValida = !this.esFormulaExternaActivaNuevo() || this.esFormulaExternaCompletaNuevo();

    return Boolean(cedula && nombre && tieneProductos && formulaValida);
  }

  async generarPresupuesto() {
    this.sincronizarClienteFormularioConPresupuesto();

    if (!this.puedeGenerarPresupuesto()) {
      if (!this.nuevoPresupuesto?.cliente?.cedula || !this.nuevoPresupuesto?.cliente?.nombreCompleto) {
        this.snackBar.open('Complete los datos del cliente', 'Cerrar', {
          duration: 3000,
          panelClass: ['snackbar-warning']
        });
        return;
      }

      this.snackBar.open('Agregue al menos un producto', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    if (!this.nuevoPresupuesto.cliente.cedula || !this.nuevoPresupuesto.cliente.nombreCompleto) {
      this.snackBar.open('Complete los datos del cliente', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    if (!this.presupuestoTieneProductos(this.nuevoPresupuesto)) {
      this.snackBar.open('Agregue al menos una opción con productos', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    if (this.esFormulaExternaActivaNuevo() && !this.esFormulaExternaCompletaNuevo()) {
      this.snackBar.open('Complete la refracción final de fórmula externa para continuar', 'Cerrar', {
        duration: 3500,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    try {
      const handoffHistoria = this.historiaPresupuestoHandoffActivo;
      const presupuestoNuevo = await lastValueFrom(
        this.presupuestoService.crearPresupuesto(this.construirPayloadPresupuesto(this.nuevoPresupuesto))
      );
      await this.cargarPresupuestosDesdeApi(false);
      this.cerrarModalNuevoPresupuesto();

      if (handoffHistoria) {
        this.historiaPresupuestoHandoffActivo = null;
      }

      this.snackBar.open(`Presupuesto ${presupuestoNuevo.codigo} generado exitosamente`, 'Cerrar', {
        duration: 4000,
        panelClass: ['snackbar-success']
      });

      if (handoffHistoria) {
        await this.gestionarRetornoAHistoriaTrasCrearPresupuesto(handoffHistoria, presupuestoNuevo);
      }
    } catch (error) {
      console.error('Error creando presupuesto:', error);
    }
  }

  private async gestionarRetornoAHistoriaTrasCrearPresupuesto(
    handoff: HistoriaPresupuestoHandoff,
    presupuestoNuevo: any
  ): Promise<void> {
    const decision = await this.swalService.showInfo(
      'Presupuesto generado',
      `El presupuesto ${presupuestoNuevo?.codigo || ''} ya quedó creado desde la historia médica ${handoff.historiaNumero || handoff.historiaId}. ¿Deseas mantenerte en presupuestos o regresar a la historia?`,
      {
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Mantenerme en presupuestos',
        cancelButtonText: 'Regresar a historia médica',
        allowOutsideClick: false,
        allowEscapeKey: false
      }
    );

    if (decision.isConfirmed) {
      return;
    }

    const retorno: PresupuestoHistoriaReturnDraft = {
      origen: 'presupuesto',
      historiaId: String(handoff.historiaId || ''),
      historiaNumero: String(handoff.historiaNumero || '').trim() || undefined,
      pacienteKey: String(handoff.pacienteKey || ''),
      pacienteId: String(handoff.pacienteId || '').trim() || undefined,
      pacienteCedula: String(handoff.pacienteCedula || '').trim() || undefined,
      presupuestoCodigo: String(presupuestoNuevo?.codigo || '').trim() || undefined
    };

    try {
      sessionStorage.setItem(PRESUPUESTO_HISTORIA_RETURN_STORAGE_KEY, JSON.stringify(retorno));
      await this.router.navigate(['/pacientes-historias']);
    } catch (error) {
      console.error('No se pudo preparar el retorno a la historia médica:', error);
      this.snackBar.open('No se pudo regresar automáticamente a la historia médica.', 'Cerrar', {
        duration: 4000,
        panelClass: ['snackbar-warning']
      });
    }
  }

  getEstadoTexto(estadoColor: string): string {
    const estados = {
      'vigente': 'Vigente',
      'proximo': 'Próximo a vencer',
      'hoy': 'Vence hoy',
      'vencido': 'Vencido',
      'convertido': 'Convertido',
      'archivado': 'Archivado',
      'anulado': 'Anulado'
    };
    return estados[estadoColor] || 'Vigente';
  }

  calcularEstadisticas() {
    this.estadisticas.totalVigentes = this.presupuestosFiltradosVigentes.length;
    this.estadisticas.totalVencidos = this.presupuestosFiltradosVencidos.length;

    const totalVigentes = this.presupuestosFiltradosVigentes.reduce((sum, p) => sum + (p.total || 0), 0);
    const totalVencidos = this.presupuestosFiltradosVencidos.reduce((sum, p) => sum + (p.total || 0), 0);
    this.estadisticas.totalValor = totalVigentes + totalVencidos;

    this.estadisticas.proximosAVencer = this.presupuestosFiltradosVigentes.filter(p => p.diasRestantes! <= 3).length;
  }

  // Método para limpiar búsqueda
  limpiarBusqueda() {
    this.filtroBusqueda = '';
    // Restablecer los arrays filtrados a los originales
    this.presupuestosFiltradosVigentes = [...this.presupuestosVigentes];
    this.presupuestosFiltradosVencidos = [...this.presupuestosVencidos];
    // Actualizar estadísticas
    this.calcularEstadisticas();
  }

  // Método para limpiar filtro de estado
  limpiarFiltroEstado() {
    this.filtroEstado = '';
    this.presupuestosFiltradosVigentes = [...this.presupuestosVigentes];
    this.presupuestosFiltradosVencidos = [...this.presupuestosVencidos];
    this.calcularEstadisticas();
  }

  // Método para limpiar todos los filtros
  limpiarFiltros() {
    this.filtroBusqueda = '';
    this.filtroEstado = '';
    this.presupuestosFiltradosVigentes = [...this.presupuestosVigentes];
    this.presupuestosFiltradosVencidos = [...this.presupuestosVencidos];
    this.calcularEstadisticas();

    // Mostrar mensaje
    this.snackBar.open('Filtros limpiados correctamente', 'Cerrar', {
      duration: 2000,
      panelClass: ['snackbar-info']
    });
  }

  // Método para manejar el evento keyup.enter en el buscador
  onSearchEnter(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.filtrarPresupuestos();
    }
  }

  // Método para exportar con opciones
  exportarExcel(tipo: 'vigentes' | 'vencidos' | 'todos' = 'vigentes'): void {
    try {
      let presupuestos: any[] = [];
      let nombre = '';

      switch (tipo) {
        case 'vigentes':
          presupuestos = this.presupuestosVigentes;
          nombre = 'Presupuestos_Vigentes';
          break;
        case 'vencidos':
          presupuestos = this.presupuestosVencidos;
          nombre = 'Presupuestos_Vencidos';
          break;
        case 'todos':
          presupuestos = [...this.presupuestosVigentes, ...this.presupuestosVencidos];
          nombre = 'Todos_Presupuestos';
          break;
        default:
          presupuestos = this.presupuestosVigentes;
          nombre = 'Presupuestos';
      }

      this.excelExportService.exportPresupuestos(presupuestos, nombre);

      this.snackBar.open(`Exportado ${presupuestos.length} presupuesto(s) a Excel`, 'Cerrar', {
        duration: 4000,
        panelClass: ['snackbar-success']
      });

    } catch (error: any) {
      console.error('Error al exportar a Excel:', error);
      this.snackBar.open(`Error: ${error.message}`, 'Cerrar', {
        duration: 4000,
        panelClass: ['snackbar-error']
      });
    }
  }

  // Método mejorado para filtrar presupuestos con búsqueda flexible
  filtrarPresupuestos() {
    // Primero, asegurarse de tener los datos actualizados
    if (!this.presupuestosVigentes && !this.presupuestosVencidos) {
      return;
    }

    // Convertir filtro de búsqueda a minúsculas para búsqueda case-insensitive
    const busqueda = this.filtroBusqueda ? this.filtroBusqueda.toLowerCase().trim() : '';

    // Filtrar presupuestos VIGENTES
    this.presupuestosFiltradosVigentes = this.presupuestosVigentes.filter(presupuesto => {
      // 1. Filtrar por estado (si hay filtro de estado)
      let pasaFiltroEstado = true;
      if (this.filtroEstado) {
        pasaFiltroEstado = presupuesto.estadoColor === this.filtroEstado;
      }

      // 2. Filtrar por búsqueda (si hay búsqueda)
      let pasaFiltroBusqueda = true;
      if (busqueda) {
        // Normalizar el código del presupuesto para búsqueda flexible
        const codigoNormalizado = this.normalizarCodigoParaBusqueda(presupuesto.codigo || '');

        // Normalizar la búsqueda del usuario
        const busquedaNormalizada = this.normalizarBusqueda(busqueda);

        // Buscar en múltiples campos
        const camposBusqueda = [
          codigoNormalizado,
          presupuesto.cliente?.nombreCompleto?.toLowerCase() || '',
          presupuesto.cliente?.cedula?.toLowerCase() || '',
          presupuesto.cliente?.nombre?.toLowerCase() || '',
          presupuesto.cliente?.apellido?.toLowerCase() || '',
          presupuesto.vendedor?.toLowerCase() || ''
        ].join(' ');

        // Verificar si coincide en algún campo
        pasaFiltroBusqueda = camposBusqueda.includes(busquedaNormalizada) ||
          // Búsqueda específica por código normalizado
          codigoNormalizado.includes(busquedaNormalizada) ||
          // Búsqueda parcial por último dígitos del código
          this.coincideCodigoParcial(presupuesto.codigo, busqueda);
      }

      return pasaFiltroEstado && pasaFiltroBusqueda;
    });

    // Filtrar presupuestos VENCIDOS
    this.presupuestosFiltradosVencidos = this.presupuestosVencidos.filter(presupuesto => {
      // 1. Filtrar por estado (si hay filtro de estado)
      let pasaFiltroEstado = true;
      if (this.filtroEstado) {
        pasaFiltroEstado = presupuesto.estadoColor === this.filtroEstado;
      }

      // 2. Filtrar por búsqueda (si hay búsqueda)
      let pasaFiltroBusqueda = true;
      if (busqueda) {
        // Normalizar el código del presupuesto para búsqueda flexible
        const codigoNormalizado = this.normalizarCodigoParaBusqueda(presupuesto.codigo || '');

        // Normalizar la búsqueda del usuario
        const busquedaNormalizada = this.normalizarBusqueda(busqueda);

        // Buscar en múltiples campos
        const camposBusqueda = [
          codigoNormalizado,
          presupuesto.cliente?.nombreCompleto?.toLowerCase() || '',
          presupuesto.cliente?.cedula?.toLowerCase() || '',
          presupuesto.cliente?.nombre?.toLowerCase() || '',
          presupuesto.cliente?.apellido?.toLowerCase() || '',
          presupuesto.vendedor?.toLowerCase() || ''
        ].join(' ');

        // Verificar si coincide en algún campo
        pasaFiltroBusqueda = camposBusqueda.includes(busquedaNormalizada) ||
          // Búsqueda específica por código normalizado
          codigoNormalizado.includes(busquedaNormalizada) ||
          // Búsqueda parcial por último dígitos del código
          this.coincideCodigoParcial(presupuesto.codigo, busqueda);
      }

      return pasaFiltroEstado && pasaFiltroBusqueda;
    });

    // Actualizar estadísticas
    this.calcularEstadisticas();
  }

  // Método auxiliar para normalizar código para búsqueda
  normalizarCodigoParaBusqueda(codigo: string): string {
    if (!codigo) return '';

    const limpio = codigo.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

    // Remover prefijo PR al inicio sin afectar letras internas
    return limpio.replace(/^pr/, '');
  }

  // Método auxiliar para normalizar búsqueda del usuario
  normalizarBusqueda(busqueda: string): string {
    if (!busqueda) return '';

    const limpio = busqueda.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

    // Remover prefijo PR al inicio si el usuario lo incluye
    return limpio.replace(/^pr/, '');
  }

  // Método para verificar coincidencia parcial del código
  coincideCodigoParcial(codigo: string, busqueda: string): boolean {
    if (!codigo || !busqueda) return false;

    // Extraer solo los números del código
    const numerosCodigo = codigo.replace(/\D/g, '');
    const numerosBusqueda = busqueda.replace(/\D/g, '');

    // Verificar si los números de búsqueda están contenidos en los números del código
    return numerosCodigo.includes(numerosBusqueda);
  }

  // Método para verificar si hay filtros activos (actualizado)
  hayFiltrosActivos(): boolean {
    return !!this.filtroBusqueda || !!this.filtroEstado;
  }

  // Método para obtener el texto de resultados filtrados (actualizado)
  getTextoResultadosFiltrados(): string {
    const totalFiltradosVigentes = this.presupuestosFiltradosVigentes?.length || 0;
    const totalFiltradosVencidos = this.presupuestosFiltradosVencidos?.length || 0;
    const totalFiltrados = totalFiltradosVigentes + totalFiltradosVencidos;

    const totalVigentes = this.presupuestosVigentes?.length || 0;
    const totalVencidos = this.presupuestosVencidos?.length || 0;
    const totalGeneral = totalVigentes + totalVencidos;

    // Si no hay filtros o si todos están mostrados
    if ((!this.filtroBusqueda && !this.filtroEstado) || totalFiltrados === totalGeneral) {
      return '';
    }

    let texto = '';

    if (this.tabActiva === 'vigentes') {
      texto = `${totalFiltradosVigentes} de ${totalVigentes} presupuestos vigentes`;
    } else {
      texto = `${totalFiltradosVencidos} de ${totalVencidos} presupuestos vencidos`;
    }

    if (this.filtroBusqueda) {
      texto += ` para "${this.filtroBusqueda}"`;
    }

    if (this.filtroEstado) {
      const estadoTexto = this.getEstadoTexto(this.filtroEstado);
      texto += ` (${estadoTexto})`;
    }

    return texto;
  }

  // Método para búsqueda más específica (opcional)
  buscarPresupuestoDetallado(valor: string) {
    const busqueda = valor.toLowerCase().trim();

    if (!busqueda) {
      this.presupuestosFiltradosVigentes = [...this.presupuestosVigentes];
      this.presupuestosFiltradosVencidos = [...this.presupuestosVencidos];
      return;
    }

    this.presupuestosFiltradosVigentes = this.presupuestosVigentes.filter(presupuesto => {
      // Buscar en código del presupuesto
      const coincideCodigo = presupuesto.codigo?.toLowerCase().includes(busqueda);

      // Buscar en cédula del cliente
      const coincideCedula = presupuesto.cliente?.cedula?.toLowerCase().includes(busqueda);

      // Buscar en nombre completo del cliente
      const coincideNombreCompleto = presupuesto.cliente?.nombreCompleto?.toLowerCase().includes(busqueda);

      // Buscar en nombre y apellido por separado
      const coincideNombre = presupuesto.cliente?.nombre?.toLowerCase().includes(busqueda);
      const coincideApellido = presupuesto.cliente?.apellido?.toLowerCase().includes(busqueda);

      // Buscar en vendedor
      const coincideVendedor = presupuesto.vendedor?.toLowerCase().includes(busqueda);

      // Buscar en productos (descripción o código)
      const coincideProductos = this.obtenerProductosBusquedaPresupuesto(presupuesto).some((producto: any) => {
        return producto.descripcion?.toLowerCase().includes(busqueda) ||
          producto.codigo?.toLowerCase().includes(busqueda);
      });

      return coincideCodigo || coincideCedula || coincideNombreCompleto ||
        coincideNombre || coincideApellido || coincideVendedor || coincideProductos;
    });

    this.presupuestosFiltradosVencidos = this.presupuestosVencidos.filter(presupuesto => {
      // Mismos criterios para vencidos
      const coincideCodigo = presupuesto.codigo?.toLowerCase().includes(busqueda);
      const coincideCedula = presupuesto.cliente?.cedula?.toLowerCase().includes(busqueda);
      const coincideNombreCompleto = presupuesto.cliente?.nombreCompleto?.toLowerCase().includes(busqueda);
      const coincideNombre = presupuesto.cliente?.nombre?.toLowerCase().includes(busqueda);
      const coincideApellido = presupuesto.cliente?.apellido?.toLowerCase().includes(busqueda);
      const coincideVendedor = presupuesto.vendedor?.toLowerCase().includes(busqueda);
      const coincideProductos = this.obtenerProductosBusquedaPresupuesto(presupuesto).some((producto: any) => {
        return producto.descripcion?.toLowerCase().includes(busqueda) ||
          producto.codigo?.toLowerCase().includes(busqueda);
      });

      return coincideCodigo || coincideCedula || coincideNombreCompleto ||
        coincideNombre || coincideApellido || coincideVendedor || coincideProductos;
    });
  }

  // Métodos para controlar el menú desplegable
  abrirMenuExportar(): void {
    if (this.timeoutCerrarMenu) {
      clearTimeout(this.timeoutCerrarMenu);
    }
    this.mostrarMenuExportar = true;
  }

  cerrarMenuExportar(): void {
    // Usar timeout para permitir mover el mouse entre el botón y el menú
    this.timeoutCerrarMenu = setTimeout(() => {
      this.mostrarMenuExportar = false;
    }, 300);
  }

  mantenerMenuAbierto(): void {
    if (this.timeoutCerrarMenu) {
      clearTimeout(this.timeoutCerrarMenu);
    }
  }

  abrirMenuAccionesDetalle(): void {
    if (this.timeoutCerrarMenuDetalle) {
      clearTimeout(this.timeoutCerrarMenuDetalle);
    }

    this.mostrarMenuAccionesDetalle = true;
  }

  cerrarMenuAccionesDetalle(): void {
    this.timeoutCerrarMenuDetalle = setTimeout(() => {
      this.mostrarMenuAccionesDetalle = false;
    }, 250);
  }

  mantenerMenuAccionesDetalleAbierto(): void {
    if (this.timeoutCerrarMenuDetalle) {
      clearTimeout(this.timeoutCerrarMenuDetalle);
    }
  }

  cerrarMenuAccionesDetalleInmediato(): void {
    this.mostrarMenuAccionesDetalle = false;

    if (this.timeoutCerrarMenuDetalle) {
      clearTimeout(this.timeoutCerrarMenuDetalle);
    }
  }

  seleccionarOpcionExportar(tipo: 'vigentes' | 'vencidos' | 'todos'): void {
    this.exportarExcel(tipo);
    this.mostrarMenuExportar = false;
    if (this.timeoutCerrarMenu) {
      clearTimeout(this.timeoutCerrarMenu);
    }
  }

  convertirAVenta(presupuesto: any) {
    if (!this.puedeConvertirPresupuesto(presupuesto)) {
      this.snackBar.open(this.obtenerMotivoNoConversion(presupuesto), 'Cerrar', {
        duration: 4000,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    this.presupuestoParaConvertir = JSON.parse(JSON.stringify(presupuesto));
    this.asegurarOpcionesPresupuesto(this.presupuestoParaConvertir);
    this.sincronizarOpcionActivaConversion(this.presupuestoParaConvertir.opcionPrincipalId);
    this.mostrarModalConversionPresupuesto = true;
    this.sincronizarEstadoBodyModal();
    this.cdr.detectChanges();
  }

  cerrarModalConversionPresupuesto(): void {
    this.mostrarModalConversionPresupuesto = false;
    this.presupuestoParaConvertir = null;
    this.opcionActivaConversionId = '';
    this.sincronizarEstadoBodyModal();
  }

  async confirmarConversionPresupuesto(): Promise<void> {
    if (!this.presupuestoParaConvertir) {
      return;
    }

    const presupuesto = this.presupuestoParaConvertir;

    try {
      const presupuestoConvertido = await lastValueFrom(
        this.presupuestoService.actualizarPresupuesto(
          Number(presupuesto.id),
          this.construirPayloadPresupuesto(presupuesto)
        )
      );

      const borradorVenta = this.mapearPresupuestoParaVenta(presupuestoConvertido);
      sessionStorage.removeItem(HISTORIA_VENTA_HANDOFF_STORAGE_KEY);
      sessionStorage.setItem(PRESUPUESTO_VENTA_STORAGE_KEY, JSON.stringify(borradorVenta));
      this.cerrarModalConversionPresupuesto();
      await this.cargarPresupuestosDesdeApi(false, false);

      const navegacionOk = await this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { vista: 'generacion-de-ventas' },
        queryParamsHandling: 'merge'
      });

      if (!navegacionOk) {
        sessionStorage.removeItem(PRESUPUESTO_VENTA_STORAGE_KEY);
        this.snackBar.open('No se pudo abrir el módulo de ventas', 'Cerrar', {
          duration: 3500,
          panelClass: ['snackbar-warning']
        });
        return;
      }

      this.snackBar.open(`Presupuesto ${presupuestoConvertido.codigo} cargado en ventas para continuar`, 'Cerrar', {
        duration: 4500,
        panelClass: ['snackbar-success']
      });
    } catch (error) {
      console.error('Error convirtiendo presupuesto:', error);
    }
  }

  renovarPresupuesto(presupuesto: any) {
    this.presupuestoParaRenovar = JSON.parse(JSON.stringify(presupuesto));
    this.mostrarModalRenovarPresupuesto = true;
    this.sincronizarEstadoBodyModal();
  }

  cerrarModalRenovarPresupuesto(): void {
    this.mostrarModalRenovarPresupuesto = false;
    this.presupuestoParaRenovar = null;
    this.sincronizarEstadoBodyModal();
  }

  async confirmarRenovacionPresupuesto(): Promise<void> {
    if (!this.presupuestoParaRenovar) {
      return;
    }

    const presupuesto = this.presupuestoParaRenovar;
    try {
      const renovado = await lastValueFrom(this.presupuestoService.renovarPresupuesto(Number(presupuesto.id), 7));
      this.cerrarModalRenovarPresupuesto();
      await this.cargarPresupuestosDesdeApi(false);

      if (this.presupuestoSeleccionado?.id === renovado.id) {
        this.presupuestoSeleccionado = JSON.parse(JSON.stringify(renovado));
        this.diasVencimientoSeleccionado = renovado.diasVencimiento || 7;
      }

      this.snackBar.open(`Presupuesto ${renovado.codigo} renovado por 7 días`, 'Cerrar', {
        duration: 4000,
        panelClass: ['snackbar-success']
      });
    } catch (error) {
      console.error('Error renovando presupuesto:', error);
    }
  }

  getFechaRenovacionPresupuesto(presupuesto: any): Date | null {
    if (!presupuesto) {
      return null;
    }

    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 7);
    return fecha;
  }

  getTextoFechaRenovacionPresupuesto(presupuesto: any): string {
    const fechaRenovacion = this.getFechaRenovacionPresupuesto(presupuesto);
    return fechaRenovacion ? this.formatFecha(fechaRenovacion) : 'N/A';
  }

  // Agregar estos métodos al componente

  actualizarProductoDetalle(index: number) {
    if (!this.presupuestoSeleccionado) return;

    const producto = this.presupuestoSeleccionado.productos[index];
    if (!producto) return;

    this.normalizarLineaPresupuesto(producto);
    this.calcularTotalesDetalle();
  }

  eliminarProductoDetalle(index: number) {
    if (!this.presupuestoSeleccionado) return;

    this.presupuestoSeleccionado.productos.splice(index, 1);
    this.calcularTotalesDetalle();
    this.filtrarProductosDetalle();
  }

  abrirModalAgregarProductoDetalle() {
    this.terminoBusquedaDetalleProducto = '';
    this.productosDetalleFiltrados = [];
  }

  filtrarProductosDetalle(): void {
    const termino = String(this.terminoBusquedaDetalleProducto || '').trim();

    if (!termino) {
      this.productosDetalleFiltrados = [];
      return;
    }

    const busqueda = termino.toLowerCase();
    const busquedaNormalizada = this.normalizarBusqueda(termino);

    this.productosDetalleFiltrados = this.productosDisponibles.filter((producto) => {
      const descripcion = String(producto?.descripcion || '').toLowerCase();
      const nombre = String(producto?.nombre || '').toLowerCase();
      const codigo = String(producto?.codigo || '');
      const codigoLower = codigo.toLowerCase();
      const codigoNormalizado = this.normalizarCodigoParaBusqueda(codigo);
      const idTexto = String(producto?.id || '').trim();

      return descripcion.includes(busqueda)
        || nombre.includes(busqueda)
        || idTexto.includes(busqueda)
        || codigoLower.includes(busqueda)
        || (busquedaNormalizada.length > 0 && (
          idTexto.includes(busquedaNormalizada)
          || codigoNormalizado.includes(busquedaNormalizada)
          || this.coincideCodigoParcial(codigo, termino)
        ));
    });
  }

  agregarProductoDetalle(producto: any): void {
    if (!this.presupuestoSeleccionado) return;

    const descripcionVisible = this.obtenerDescripcionVisibleProducto(producto);
    const productoExistente = this.presupuestoSeleccionado.productos.find((p: any) => p.id === producto.id);

    if (productoExistente) {
      productoExistente.cantidad += 1;
      productoExistente.total = productoExistente.cantidad * productoExistente.precio * (1 - (productoExistente.descuento || 0) / 100);
    } else {
      this.presupuestoSeleccionado.productos.push({
        id: producto.id,
        productoId: producto.id,
        nombre: producto.nombre,
        codigo: producto.codigo,
        descripcion: descripcionVisible,
        precio: Number(producto.precio || 0),
        precioUnitario: Number(producto.precio || 0),
        precioOriginal: producto.precioOriginal ?? producto.precio,
        moneda: producto.moneda ?? this.monedaSistema,
        monedaOriginal: producto.monedaOriginal ?? producto.moneda ?? this.monedaSistema,
        tasaConversion: producto.tasaConversion ?? 1,
        aplicaIva: producto.aplicaIva !== false,
        categoria: producto.categoria,
        cristalConfig: producto.cristalConfig,
        cantidad: 1,
        descuento: 0,
        descuentoPorcentaje: 0,
        total: Number(producto.precio || 0)
      });
    }

    this.calcularTotalesDetalle();
    this.terminoBusquedaDetalleProducto = '';
    this.productosDetalleFiltrados = [];
  }

  modificarCantidadDetalle(index: number, cambio: number): void {
    if (!this.presupuestoSeleccionado) return;

    const producto = this.presupuestoSeleccionado.productos[index];
    if (!producto) return;

    const nuevaCantidad = Number(producto.cantidad || 1) + cambio;
    if (nuevaCantidad < 1) {
      this.eliminarProductoDetalle(index);
      return;
    }

    producto.cantidad = nuevaCantidad;
    this.actualizarProductoDetalle(index);
  }

  calcularTotalesDetalle() {
    if (!this.presupuestoSeleccionado) return;

    const opcion = this.obtenerOpcionPresupuesto(this.presupuestoSeleccionado, this.opcionActivaDetalleId);
    if (!opcion) {
      return;
    }

    this.recalcularTotalesPresupuesto(opcion as any);
    this.sincronizarPresupuestoDesdeOpcion(this.presupuestoSeleccionado, opcion);
  }

  async imprimirPresupuesto(presupuesto: any) {
    this.sincronizarContextoUsuario();

    if (!this.empleadosDisponibles.length) {
      await this.cargarAsesores();
    }

    const presupuestoImpresion = this.normalizarPresupuestoPersistido(
      JSON.parse(JSON.stringify(presupuesto || {}))
    );

    const datosSede = this.obtenerDatosSedeImpresion();
    const nombreAsesor = this.obtenerNombreAsesor(presupuestoImpresion?.vendedor);
    const opcionesImpresion = this.asegurarOpcionesPresupuesto(presupuestoImpresion);
    const opcionPrincipal = this.obtenerOpcionPresupuesto(presupuestoImpresion, presupuestoImpresion?.opcionPrincipalId);
    const tieneMultiplesOpciones = opcionesImpresion.length > 1;
    const tituloPresupuestoImpresion = [
      String(presupuestoImpresion?.codigo || '').trim(),
      String(presupuestoImpresion?.cliente?.nombreCompleto || '').trim()
    ].filter(Boolean).join(' - ');

    if (!presupuestoImpresion.descuentoTotal) {
      presupuestoImpresion.descuentoTotal = this.calcularDescuentoTotalPresupuestoParaImpresion(presupuestoImpresion);
    }

    const resumenOpcionesHtml = tieneMultiplesOpciones
      ? opcionesImpresion.map((opcion: OpcionPresupuesto, index: number) =>
        this.construirTarjetaResumenImpresionOpcionPresupuesto(opcion, index, presupuestoImpresion?.opcionPrincipalId)
      ).join('')
      : '';
    const seccionesOpcionesHtml = opcionesImpresion.map((opcion: OpcionPresupuesto, index: number) =>
      this.construirSeccionImpresionOpcionPresupuesto(
        opcion,
        index,
        presupuestoImpresion?.opcionPrincipalId,
        opcionesImpresion.length
      )
    ).join('');

    const fechaActual = new Date();
    const fechaEmision = fechaActual.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const horaEmision = fechaActual.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const fechaVencimiento = new Date(presupuestoImpresion.fechaVencimiento).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    const estadoTexto = this.getEstadoTexto(presupuestoImpresion.estadoColor);
    const diasInfo = presupuestoImpresion.diasRestantes >= 0
      ? `${presupuestoImpresion.diasRestantes} días restantes`
      : `Vencido hace ${Math.abs(presupuestoImpresion.diasRestantes)} días`;
    const observacionesImpresion = this.obtenerObservacionesSinFormulaParaImpresion(presupuestoImpresion?.observaciones);

    const contactoSede = [
      datosSede.telefono && datosSede.telefono !== 'Sin teléfono' ? `Tel: ${this.escaparHtml(datosSede.telefono)}` : '',
      datosSede.email && datosSede.email !== 'Sin correo' ? `Email: ${this.escaparHtml(datosSede.email)}` : ''
    ].filter(Boolean).join(' | ');

    const direccionSede = datosSede.direccion && datosSede.direccion !== 'Dirección no disponible'
      ? this.escaparHtml(datosSede.direccion)
      : '';

    const contenidoHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${this.escaparHtml(tituloPresupuestoImpresion || String(presupuestoImpresion.codigo || 'Presupuesto'))}</title>
        <meta charset="UTF-8">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 11px;
                line-height: 1.3;
                color: #1f2937;
                background: #f8fafc;
                padding: 10mm 8mm;
            }
            @media print {
                @page { margin: 10mm 8mm; size: A4 portrait; }
                body { padding: 0; }
            }
            .presupuesto-container {
                max-width: 190mm;
                margin: 0 auto;
                background: #ffffff;
                border: 1px solid #dbe4f0;
                border-radius: 10px;
                box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
                padding: 10px 12px;
            }
            .header-compact {
                display: grid;
                grid-template-columns: 1fr auto;
                gap: 15px;
                margin-bottom: 12px;
                padding-bottom: 10px;
                border-bottom: 2px solid #1f4e79;
            }
            .empresa-nombre-compact {
                font-size: 16px;
                font-weight: 700;
                color: #1f4e79;
                margin-bottom: 2px;
            }
            .empresa-datos-compact { font-size: 9px; color: #666; line-height: 1.3; }
            .logo-mini {
                width: 60px; height: 60px;
                background: linear-gradient(135deg, #1f4e79, #2f6ea3);
                border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                color: #fff; font-weight: bold; font-size: 20px;
            }
            .titulo-principal {
                text-align: center;
                margin: 10px 0 15px 0;
                padding: 8px;
                background: linear-gradient(135deg, #1f4e79, #2f6ea3);
                color: white;
                border-radius: 6px;
            }
            .titulo-principal h1 { font-size: 16px; font-weight: 700; }
            .metadata-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
                margin-bottom: 12px;
            }
            .metadata-card {
                background: #f8fbff;
                border: 1px solid #d9e8f7;
                border-radius: 8px;
                padding: 6px 8px;
                text-align: center;
            }
            .metadata-label {
                font-size: 8px; color: #6c757d; font-weight: 600;
                text-transform: uppercase; margin-bottom: 2px; display: block;
            }
            .metadata-valor { font-size: 10px; font-weight: 600; color: #1f4e79; }
            .estado-badge { display: inline-block; padding: 2px 6px; border-radius: 10px; font-size: 8px; font-weight: 600; }
            .estado-vigente { background: #d4edda; color: #155724; }
            .estado-proximo { background: #fff3cd; color: #856404; }
            .estado-hoy { background: #cce5ff; color: #004085; }
            .estado-vencido { background: #f8d7da; color: #721c24; }
            .cliente-compact {
                background: #f8f9fa;
                border-radius: 6px;
                padding: 10px;
                margin-bottom: 12px;
                border: 1px solid #dee2e6;
            }
            .cliente-header {
                display: flex; justify-content: space-between; align-items: center;
                margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #dee2e6;
            }
            .cliente-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; font-size: 10px; }
            .cliente-item { display: flex; align-items: flex-start; }
            .cliente-label { font-weight: 600; color: #495057; min-width: 70px; margin-right: 5px; }
            .cliente-valor { color: #212529; flex: 1; }
            .comparativo-section {
              margin-bottom: 12px;
            }
            .comparativo-section h3 {
              font-size: 10px;
              color: #1f4e79;
              margin-bottom: 6px;
            }
            .opciones-comparativo-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
              gap: 8px;
            }
            .opcion-resumen-card {
              background: #f8fbff;
              border: 1px solid #d9e8f7;
              border-radius: 8px;
              padding: 8px;
            }
            .opcion-resumen-card--principal {
              background: #ebf4ff;
              border-color: #1f4e79;
            }
            .opcion-resumen-card__header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 8px;
              margin-bottom: 4px;
            }
            .opcion-resumen-card__title {
              font-size: 10px;
              font-weight: 700;
              color: #1f4e79;
            }
            .opcion-resumen-card__meta {
              font-size: 8px;
              color: #64748b;
            }
            .opcion-resumen-card__total {
              margin-top: 6px;
              text-align: right;
              font-size: 11px;
              font-weight: 700;
              color: #0f172a;
            }
            .opcion-badge {
              display: inline-flex;
              align-items: center;
              padding: 2px 6px;
              border-radius: 999px;
              background: #1f4e79;
              color: #fff;
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.03em;
            }
            .opcion-seccion {
              background: #ffffff;
              border: 1px solid #dbe4f0;
              border-radius: 8px;
              padding: 10px;
              margin-bottom: 10px;
            }
            .opcion-seccion__header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 10px;
              margin-bottom: 8px;
            }
            .opcion-seccion__titulo {
              font-size: 12px;
              font-weight: 700;
              color: #1f4e79;
            }
            .opcion-seccion__subtitulo {
              font-size: 9px;
              color: #64748b;
              margin-top: 2px;
            }
            .resumen-compacto--opcion {
              margin-bottom: 0;
            }
            .tabla-compacta {
                width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9px;
            }
            .tabla-compacta thead { background: #1f4e79; color: white; }
            .tabla-compacta th {
                padding: 6px 4px; font-weight: 600; text-align: center; font-size: 9px;
            }
            .tabla-compacta td {
                padding: 5px 4px; text-align: center; border-bottom: 1px solid #e9ecef; vertical-align: middle;
            }
            .tabla-compacta tbody tr:nth-child(even) { background-color: #f8f9fa; }
            .tabla-compacta .descripcion { text-align: left; font-size: 9.5px; max-width: 120px; }
            .tabla-compacta .precio, .tabla-compacta .total { text-align: center; min-width: 60px; font-weight: 600; }
            .tabla-compacta tbody tr.fila-consulta {
              background: linear-gradient(90deg, #eff6ff, #f8fbff) !important;
            }
            .tabla-compacta tbody tr.fila-consulta td {
              border-bottom: 1px solid #bfdbfe;
            }
            .servicio-badge {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              margin-top: 4px;
              padding: 2px 6px;
              border-radius: 999px;
              background: #dbeafe;
              color: #1d4ed8;
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.04em;
            }
            .servicio-badge::before {
              content: '';
              width: 6px;
              height: 6px;
              border-radius: 999px;
              background: #2563eb;
              display: inline-block;
            }
            .codigo-servicio {
              color: #1d4ed8;
              font-weight: 700;
            }
            .resumen-compacto { display: grid; grid-template-columns: 2fr 1fr; gap: 15px; margin-bottom: 12px; }
            .resumen-compacto--solo-info { grid-template-columns: 1fr; }
            .totales-compactos {
                background: #f8f9fa; border-radius: 6px; padding: 10px; border: 1px solid #dee2e6;
            }
            .total-line { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
            .total-line:not(:last-child) { border-bottom: 1px dashed #dee2e6; }
            .total-label { font-size: 10px; color: #495057; }
            .total-valor { font-weight: 600; font-size: 10px; }
            .total-final {
                background: #ebf4ff; border-radius: 4px; padding: 6px 8px; margin-top: 6px; border-left: 3px solid #1f4e79;
            }
            .total-final .total-label,
            .total-final .total-valor { color: #1f4e79; font-weight: 700; }
            .info-lateral {
                background: #fff9db; border: 1px solid #ffeaa7; border-radius: 6px; padding: 10px;
            }
            .info-lateral h4 {
                font-size: 10px; color: #856404; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #ffeaa7;
            }
            .info-item { font-size: 9px; margin-bottom: 4px; }
            .info-item--consulta {
              background: #eff6ff;
              border: 1px solid #bfdbfe;
              border-radius: 6px;
              padding: 6px;
              color: #1e3a8a;
            }
            .obs-section {
                background: #f1f5f9; border-radius: 6px; padding: 8px; border: 1px solid #dee2e6; margin-bottom: 10px;
            }
            .obs-section h4 { font-size: 10px; color: #1f4e79; margin-bottom: 6px; }
            .obs-content { font-size: 9px; color: #495057; line-height: 1.3; }
            .resumen-impresion-simple {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 8px;
              margin-bottom: 12px;
            }
            .resumen-impresion-simple__item {
              background: #f8fbff;
              border: 1px solid #d9e8f7;
              border-radius: 8px;
              padding: 8px;
            }
            .resumen-impresion-simple__label {
              display: block;
              font-size: 8px;
              font-weight: 700;
              color: #6c757d;
              text-transform: uppercase;
              margin-bottom: 4px;
            }
            .resumen-impresion-simple__value {
              font-size: 10px;
              font-weight: 700;
              color: #1f4e79;
            }
            .footer-compacto {
                text-align: center;
                font-size: 8px;
                color: #4b5563;
                padding: 8px;
                border-top: 1px solid #dbe2ea;
                background: #f8fbff;
                border-radius: 8px;
                line-height: 1.35;
            }
            .footer-brand { font-size: 9px; font-weight: 700; color: #1f4e79; margin-bottom: 3px; }
        </style>
    </head>
    <body>
        <div class="presupuesto-container">
            <div class="header-compact">
                <div>
                    <div class="empresa-nombre-compact">${this.escaparHtml(datosSede.nombreOptica)}</div>
                    <div class="empresa-datos-compact">
                        ${datosSede.rif ? `RIF: ${this.escaparHtml(datosSede.rif)}<br>` : ''}
                        ${this.escaparHtml(datosSede.direccion)}<br>
                        ${this.escaparHtml(datosSede.telefono)} | ${this.escaparHtml(datosSede.email)}
                    </div>
                </div>
                <div class="logo-mini">${this.escaparHtml(datosSede.iniciales)}</div>
            </div>

            <div class="titulo-principal">
              <h1>${this.escaparHtml(tituloPresupuestoImpresion || String(presupuestoImpresion.codigo || ''))}</h1>
            </div>

            <div class="metadata-grid">
                <div class="metadata-card">
                    <span class="metadata-label">EMISIÓN</span>
                    <span class="metadata-valor">${fechaEmision} ${horaEmision}</span>
                </div>
                <div class="metadata-card">
                    <span class="metadata-label">VENCIMIENTO</span>
                    <span class="metadata-valor">${fechaVencimiento}</span>
                </div>
                <div class="metadata-card">
                    <span class="metadata-label">VENDEDOR</span>
                    <span class="metadata-valor">${this.escaparHtml(nombreAsesor)}</span>
                </div>
                <div class="metadata-card">
                    <span class="metadata-label">ESTADO</span>
                  <span class="metadata-valor"><span class="estado-badge estado-${presupuestoImpresion.estadoColor}">${estadoTexto}</span></span>
                </div>
            </div>

            <div class="cliente-compact">
                <div class="cliente-header">
                    <h3>CLIENTE</h3>
                    <div style="font-size: 9px; color: #6c757d;">${diasInfo}</div>
                </div>
                <div class="cliente-grid">
                  <div class="cliente-item"><span class="cliente-label">Nombre:</span><span class="cliente-valor">${this.escaparHtml(presupuestoImpresion.cliente.nombreCompleto)}</span></div>
                  <div class="cliente-item"><span class="cliente-label">${presupuestoImpresion.cliente.tipoPersona === 'juridica' ? 'RIF:' : 'Cédula:'}</span><span class="cliente-valor">${this.escaparHtml(presupuestoImpresion.cliente.cedula)}</span></div>
                  <div class="cliente-item"><span class="cliente-label">Teléfono:</span><span class="cliente-valor">${this.escaparHtml(presupuestoImpresion.cliente.telefono || 'N/A')}</span></div>
                  <div class="cliente-item"><span class="cliente-label">Email:</span><span class="cliente-valor">${this.escaparHtml(presupuestoImpresion.cliente.email || 'N/A')}</span></div>
                </div>
            </div>

            <div class="resumen-impresion-simple">
                <div class="resumen-impresion-simple__item">
                    <span class="resumen-impresion-simple__label">Vendedor</span>
                    <span class="resumen-impresion-simple__value">${this.escaparHtml(nombreAsesor)}</span>
                </div>
                <div class="resumen-impresion-simple__item">
                    <span class="resumen-impresion-simple__label">Validez</span>
                    <span class="resumen-impresion-simple__value">${presupuestoImpresion.diasVencimiento || 7} días</span>
                </div>
                <div class="resumen-impresion-simple__item">
                    <span class="resumen-impresion-simple__label">Opciones</span>
                    <span class="resumen-impresion-simple__value">${opcionesImpresion.length}</span>
                </div>
                <div class="resumen-impresion-simple__item">
                    <span class="resumen-impresion-simple__label">Opción principal</span>
                    <span class="resumen-impresion-simple__value">${this.escaparHtml(opcionPrincipal?.nombre || 'N/A')}</span>
                </div>
            </div>

              ${tieneMultiplesOpciones ? `<div class="comparativo-section">
                <h3>Opciones para comparar</h3>
                <div class="opciones-comparativo-grid">
                  ${resumenOpcionesHtml}
                </div>
              </div>` : ''}

              ${seccionesOpcionesHtml}

            <div class="obs-section">
                <h4>OBSERVACIONES</h4>
              <div class="obs-content">${this.escaparHtml(observacionesImpresion || 'Sin observaciones adicionales.')}</div>
            </div>

            <div class="footer-compacto">
                <div class="footer-brand">${this.escaparHtml(datosSede.nombreOptica)}</div>
                ${contactoSede ? `<div>${contactoSede}</div>` : ''}
                ${direccionSede ? `<div>${direccionSede}</div>` : ''}
            </div>
        </div>
        <script>
            window.onload = function() {
            document.title = ${JSON.stringify(tituloPresupuestoImpresion || String(presupuestoImpresion.codigo || 'Presupuesto'))};
                setTimeout(function() { window.print(); }, 300);
            };
            window.onafterprint = function() {
                setTimeout(function() { window.close(); }, 800);
            };
        </script>
    </body>
    </html>
    `;

    const ventanaImpresion = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');

    if (ventanaImpresion) {
      ventanaImpresion.document.write(contenidoHTML);
      ventanaImpresion.document.close();

      this.snackBar.open(`Abriendo vista de impresión ${presupuestoImpresion.codigo}`, 'Cerrar', {
        duration: 2000,
        panelClass: ['snackbar-info']
      });
    } else {
      this.snackBar.open('Permite ventanas emergentes para imprimir', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-warning']
      });
    }
  }

  compartirPresupuestoPorWhatsApp(presupuesto: any): void {
    try {
      const presupuestoCompartir = this.normalizarPresupuestoPersistido(
        JSON.parse(JSON.stringify(presupuesto || {}))
      );
      const telefonoInicial = String(presupuestoCompartir?.cliente?.telefono || '').trim();
      const codigoPresupuesto = this.escaparHtml(String(presupuestoCompartir?.codigo || 'este presupuesto'));
      const nombreCliente = this.escaparHtml(String(presupuestoCompartir?.cliente?.nombreCompleto || 'el paciente'));

      this.swalService.showInfo(
        'Compartir por WhatsApp',
        `<div class="text-start">
          <p class="mb-2">Se abrirá WhatsApp con un resumen del presupuesto <strong>${codigoPresupuesto}</strong>.</p>
          <p class="mb-0 text-muted">Puedes ajustar el número de <strong>${nombreCliente}</strong> antes de continuar.</p>
        </div>`,
        {
          input: 'text',
          inputLabel: 'Número de WhatsApp',
          inputValue: telefonoInicial,
          inputPlaceholder: 'Ej: 4121234567 o +58 4121234567',
          showCancelButton: true,
          confirmButtonText: 'Abrir WhatsApp',
          cancelButtonText: 'Cancelar',
          focusConfirm: false,
          customClass: {
            actions: 'swal-modern-actions swal-modern-actions--presupuesto-select'
          },
          didOpen: () => {
            const input = document.querySelector('.swal2-input') as HTMLInputElement | null;
            if (input) {
              input.focus();
              input.select();
            }
          },
          inputValidator: (value) => {
            const telefono = String(value || '').trim();
            if (!telefono) {
              return 'Debes ingresar un número de teléfono';
            }

            if (!this.validarTelefono(telefono)) {
              return this.getMensajeErrorTelefono();
            }

            return null;
          }
        }
      ).then((result) => {
        if (!result.isConfirmed) {
          return;
        }

        const telefonoNormalizado = this.normalizarTelefonoParaWhatsApp(String(result.value || ''));

        if (!telefonoNormalizado) {
          this.swalService.showError('Número inválido', this.getMensajeErrorTelefono());
          return;
        }

        this.abrirWhatsAppPresupuesto(telefonoNormalizado, presupuestoCompartir);
      });
    } catch (error) {
      console.error('Error al compartir presupuesto por WhatsApp:', error);
      this.swalService.showError('Error', 'No se pudo abrir WhatsApp para compartir el presupuesto.');
    }
  }

  private abrirWhatsAppPresupuesto(telefono: string, presupuesto: any): void {
    const mensaje = this.construirMensajeWhatsAppPresupuesto(presupuesto);
    const urlWhatsApp = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;

    window.open(urlWhatsApp, '_blank');

    this.swalService.showSuccess('WhatsApp', 'Redirigiendo a WhatsApp para compartir el presupuesto.');
  }

  private construirMensajeWhatsAppPresupuesto(presupuesto: any): string {
    const presupuestoCompartir = this.normalizarPresupuestoPersistido(
      JSON.parse(JSON.stringify(presupuesto || {}))
    );
    const datosSede = this.obtenerDatosSedeImpresion();
    const opciones = this.asegurarOpcionesPresupuesto(presupuestoCompartir);
    const opcionPrincipal = this.obtenerOpcionPresupuesto(presupuestoCompartir, presupuestoCompartir?.opcionPrincipalId)
      || opciones[0]
      || null;
    const productos = Array.isArray(opcionPrincipal?.productos) && opcionPrincipal.productos.length
      ? opcionPrincipal.productos
      : (Array.isArray(presupuestoCompartir?.productos) ? presupuestoCompartir.productos : []);
    const fechaVencimiento = this.formatearFechaWhatsApp(presupuestoCompartir?.fechaVencimiento);
    const totalPresupuesto = Number(opcionPrincipal?.total ?? presupuestoCompartir?.total ?? 0);
    const lineasProductos = productos
      .slice(0, 6)
      .map((producto: any) => {
        const descripcion = this.limpiarTextoWhatsApp(
          this.obtenerDescripcionVisibleProducto(producto) || producto?.descripcion || producto?.nombre || 'Producto'
        );
        const cantidad = Number(producto?.cantidad || 1);
        return `• ${descripcion}${cantidad > 1 ? ` x${cantidad}` : ''}`;
      })
      .join('\n');
    const productosRestantes = productos.length > 6 ? `\n• y ${productos.length - 6} producto(s) más` : '';
    const observaciones = this.limpiarTextoWhatsApp(
      this.obtenerObservacionesSinFormulaParaImpresion(presupuestoCompartir?.observaciones)
    );
    const referenciaBs = this.debeMostrarReferenciaBs()
      ? this.formatMoneda(this.obtenerReferenciaBs(totalPresupuesto), 'VES')
      : '';

    let mensaje = `*${this.limpiarTextoWhatsApp(datosSede.nombreOptica)}*\n\n`;
    mensaje += `Hola ${this.limpiarTextoWhatsApp(presupuestoCompartir?.cliente?.nombreCompleto || 'cliente')}, compartimos su presupuesto óptico.\n\n`;
    mensaje += `*Código:* ${this.limpiarTextoWhatsApp(presupuestoCompartir?.codigo || 'N/A')}\n`;

    if (presupuestoCompartir?.cliente?.cedula) {
      mensaje += `*Cédula/RIF:* ${this.limpiarTextoWhatsApp(presupuestoCompartir.cliente.cedula)}\n`;
    }

    if (fechaVencimiento) {
      mensaje += `*Válido hasta:* ${fechaVencimiento}\n`;
    }

    if (opciones.length > 1) {
      mensaje += `*Opciones incluidas:* ${opciones.length}\n`;
    }

    mensaje += `*Total:* ${this.formatMoneda(totalPresupuesto)}\n`;

    if (referenciaBs) {
      mensaje += `*Referencia en Bs:* ${referenciaBs}\n`;
    }

    if (lineasProductos) {
      mensaje += `\n*Productos:*\n${lineasProductos}${productosRestantes}\n`;
    }

    if (observaciones) {
      mensaje += `\n*Observaciones:* ${observaciones}\n`;
    }

    mensaje += `\nSi deseas confirmar este presupuesto, puedes responder por esta vía.\n\n`;
    mensaje += `📍 *${this.limpiarTextoWhatsApp(datosSede.nombreOptica)}*\n`;

    if (datosSede.direccion && datosSede.direccion !== 'Dirección no disponible') {
      mensaje += `${this.limpiarTextoWhatsApp(datosSede.direccion)}\n`;
    }

    if (datosSede.telefono && datosSede.telefono !== 'Sin teléfono') {
      mensaje += `📞 ${this.limpiarTextoWhatsApp(datosSede.telefono)}\n`;
    }

    if (datosSede.email && datosSede.email !== 'Sin correo') {
      mensaje += `✉️ ${this.limpiarTextoWhatsApp(datosSede.email)}\n`;
    }

    return mensaje.trim();
  }

  private normalizarTelefonoParaWhatsApp(telefono: string): string | null {
    const telefonoBase = String(telefono || '').trim();
    if (!telefonoBase || !this.validarTelefono(telefonoBase)) {
      return null;
    }

    let telefonoLimpio = telefonoBase.replace(/\D/g, '');

    if (!telefonoLimpio) {
      return null;
    }

    if (telefonoLimpio.startsWith('00')) {
      telefonoLimpio = telefonoLimpio.slice(2);
    }

    if (telefonoLimpio.length === 11 && telefonoLimpio.startsWith('0')) {
      telefonoLimpio = `58${telefonoLimpio.slice(1)}`;
    } else if (telefonoLimpio.length === 10) {
      telefonoLimpio = `58${telefonoLimpio}`;
    }

    if (telefonoLimpio.length < 11 || telefonoLimpio.length > 15) {
      return null;
    }

    return telefonoLimpio;
  }

  private formatearFechaWhatsApp(fecha: string | Date | null | undefined): string {
    if (!fecha) {
      return '';
    }

    const fechaNormalizada = new Date(fecha);
    if (Number.isNaN(fechaNormalizada.getTime())) {
      return '';
    }

    return fechaNormalizada.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  private limpiarTextoWhatsApp(valor: unknown): string {
    return String(valor ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Método auxiliar para calcular porcentaje de descuento
  calcularPorcentajeDescuento(presupuesto: any): number {
    if (!presupuesto || !presupuesto.subtotal || presupuesto.subtotal === 0) return 0;

    const porcentaje = (presupuesto.descuentoTotal / presupuesto.subtotal) * 100;
    return Math.round(porcentaje * 100) / 100;
  }

  // Método auxiliar para calcular descuento total para impresión
  calcularDescuentoTotalPresupuestoParaImpresion(presupuesto: any): number {
    return this.calcularDescuentoTotalProductosParaImpresion(presupuesto?.productos || []);
  }

  private calcularDescuentoTotalProductosParaImpresion(productos: any[]): number {
    if (!Array.isArray(productos)) {
      return 0;
    }

    return productos.reduce((total: number, producto: any) => {
      const precio = Number(producto?.precio ?? producto?.precioUnitario ?? 0);
      const cantidad = Number(producto?.cantidad || 1);
      const descuento = Number(producto?.descuento ?? producto?.descuentoPorcentaje ?? 0);
      return total + ((precio * cantidad) * (descuento / 100));
    }, 0);
  }

  private construirTarjetaResumenImpresionOpcionPresupuesto(opcion: OpcionPresupuesto, index: number, opcionPrincipalId?: string): string {
    const productos = Array.isArray(opcion?.productos) ? opcion.productos : [];
    const productosSinConsulta = productos.filter((producto: any) => !this.esLineaConsulta(producto));
    const lineasConsulta = productos.filter((producto: any) => this.esLineaConsulta(producto));
    const esPrincipal = opcion?.id === opcionPrincipalId;
    const subtotal = Number(opcion?.subtotal || 0);
    const iva = Number(opcion?.iva || 0);

    return `
      <div class="opcion-resumen-card ${esPrincipal ? 'opcion-resumen-card--principal' : ''}">
          <div class="opcion-resumen-card__header">
              <span class="opcion-resumen-card__title">${this.escaparHtml(opcion?.nombre || `Opción ${index + 1}`)}</span>
              ${esPrincipal ? '<span class="opcion-badge">Principal</span>' : ''}
          </div>
          <div class="opcion-resumen-card__meta">
              ${productosSinConsulta.length} producto(s)${lineasConsulta.length > 0 ? ` + ${lineasConsulta.length} servicio(s)` : ''}
          </div>
          <div class="opcion-resumen-card__meta">Subtotal: ${this.formatMoneda(subtotal)}</div>
          <div class="opcion-resumen-card__meta">${this.getEtiquetaIva()}: ${this.formatMoneda(iva)}</div>
          <div class="opcion-resumen-card__total">${this.formatMoneda(opcion?.total || 0)}</div>
      </div>
    `;
  }

  private construirSeccionImpresionOpcionPresupuesto(opcion: OpcionPresupuesto, index: number, opcionPrincipalId?: string, totalOpciones: number = 1): string {
    const productos = Array.isArray(opcion?.productos) ? opcion.productos : [];
    const productosSinConsulta = productos.filter((producto: any) => !this.esLineaConsulta(producto));
    const lineasConsulta = productos.filter((producto: any) => this.esLineaConsulta(producto));
    const totalConsulta = lineasConsulta.reduce((sum: number, producto: any) => sum + Number(producto?.total || 0), 0);
    const totalProductos = productosSinConsulta.reduce((sum: number, producto: any) => sum + Number(producto?.total || 0), 0);
    const descuentoTotal = Number(opcion?.descuentoTotal || this.calcularDescuentoTotalProductosParaImpresion(productos));
    const subtotal = Number(opcion?.subtotal || 0);
    const subtotalNeto = subtotal - descuentoTotal;
    const porcentajeDescuento = subtotal > 0
      ? Math.round((descuentoTotal / subtotal) * 10000) / 100
      : 0;
    const total = Number(opcion?.total || 0);
    const referenciaBsTotal = this.debeMostrarReferenciaBs()
      ? this.formatMoneda(this.obtenerReferenciaBs(total), 'VES')
      : '';
    const filasProductosHtml = productos.map((producto: any, productoIndex: number) =>
      this.construirFilaImpresionPresupuesto(producto, productoIndex)
    ).join('');
    const esPrincipal = opcion?.id === opcionPrincipalId;
    const mostrarTotalesDetallados = totalOpciones <= 1;
    const observaciones = this.obtenerObservacionesSinFormulaParaImpresion(opcion?.observaciones);
    const mostrarCabecera = totalOpciones > 1 || !!observaciones || !!opcion?.nombre;
    const tituloOpcion = totalOpciones > 1
      ? this.escaparHtml(opcion?.nombre || `Opción ${index + 1}`)
      : 'Detalle del presupuesto';
    const subtitulo = totalOpciones > 1
      ? `${productos.length} ítem(s) cotizados${observaciones ? ` • ${this.escaparHtml(observaciones)}` : ''}`
      : `${productos.length} ítem(s) cotizados${observaciones ? ` • ${this.escaparHtml(observaciones)}` : ''}`;

    return `
      <div class="opcion-seccion">
          ${mostrarCabecera ? `<div class="opcion-seccion__header">
              <div>
                  <div class="opcion-seccion__titulo">${tituloOpcion}</div>
                  <div class="opcion-seccion__subtitulo">${subtitulo}</div>
              </div>
              ${esPrincipal ? '<span class="opcion-badge">Principal</span>' : ''}
          </div>` : ''}

          <table class="tabla-compacta">
              <thead>
                  <tr>
                      <th>#</th>
                      <th>DESCRIPCIÓN</th>
                      <th>CÓDIGO</th>
                      <th>PRECIO UNIT.</th>
                      <th>CANT.</th>
                      <th>DTO %</th>
                      <th>TOTAL</th>
                  </tr>
              </thead>
              <tbody>
                ${filasProductosHtml}
              </tbody>
          </table>

            <div class="resumen-compacto resumen-compacto--opcion ${mostrarTotalesDetallados ? '' : 'resumen-compacto--solo-info'}">
              ${mostrarTotalesDetallados ? `<div class="totales-compactos">
                <div class="total-line"><span class="total-label">Subtotal:</span><span class="total-valor">${this.formatMoneda(subtotal)}</span></div>
                ${descuentoTotal > 0 ? `
                <div class="total-line"><span class="total-label">Descuento (${porcentajeDescuento}%):</span><span class="total-valor">- ${this.formatMoneda(descuentoTotal)}</span></div>
                <div class="total-line"><span class="total-label">Subtotal Neto:</span><span class="total-valor">${this.formatMoneda(subtotalNeto)}</span></div>
                ` : ''}
                <div class="total-line"><span class="total-label">${this.getEtiquetaIva()}:</span><span class="total-valor">${this.formatMoneda(opcion?.iva || 0)}</span></div>
                <div class="total-final total-line"><span class="total-label">TOTAL:</span><span class="total-valor">${this.formatMoneda(total)}</span></div>
                ${referenciaBsTotal ? `<div class="total-line"><span class="total-label">REFERENCIA:</span><span class="total-valor">${referenciaBsTotal}</span></div>` : ''}
                ${referenciaBsTotal ? `<div class="print-note print-note--currency">La referencia en bolívares es informativa. El monto definitivo se calcula según la tasa vigente al momento de la compra.</div>` : ''}
              </div>` : ''}
              <div class="info-lateral">
                  <h4>RESUMEN</h4>
                  <div class="info-item"><strong>Productos:</strong> ${productosSinConsulta.length}</div>
                  ${lineasConsulta.length > 0 ? `<div class="info-item info-item--consulta"><strong>Servicio:</strong> ${lineasConsulta.length} consulta${lineasConsulta.length > 1 ? 's' : ''}<br><strong>Monto:</strong> ${this.formatMoneda(totalConsulta)}</div>` : ''}
                  <div class="info-item"><strong>Total productos:</strong> ${this.formatMoneda(totalProductos)}</div>
              </div>
          </div>
      </div>
    `;
  }

  private construirFilaImpresionPresupuesto(producto: any, index: number): string {
    const esConsulta = this.esLineaConsulta(producto);
    const descripcion = this.escaparHtml(esConsulta ? 'Consulta medica' : this.obtenerNombreVisibleProducto(producto));
    const codigo = this.escaparHtml(producto?.codigo || '-');
    const badgeServicio = esConsulta
      ? ''
      : '';
    const codigoHtml = esConsulta
      ? '<span class="codigo-servicio">Servicio</span>'
      : codigo;
    const descuentoHtml = esConsulta
      ? 'No aplica'
      : (producto?.descuento > 0 ? `${producto.descuento}%` : '-');

    return `
      <tr class="${esConsulta ? 'fila-consulta' : ''}">
          <td>${index + 1}</td>
          <td class="descripcion">${descripcion}${badgeServicio}</td>
          <td>${codigoHtml}</td>
          <td class="precio">${this.formatMoneda(producto?.precio)}</td>
          <td>${producto?.cantidad || 1}</td>
          <td>${descuentoHtml}</td>
          <td class="total">${this.formatMoneda(producto?.total)}</td>
      </tr>
    `;
  }

  // Método para formatear fecha (ya existe, pero lo incluyo por referencia)
  formatFecha(fecha: Date): string {
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  // Método para formatear moneda (ya existe, pero lo incluyo por referencia)
  formatMoneda(valor: number | null | undefined, moneda: string = this.monedaSistema): string {
    const monto = Number(valor || 0);
    const codigoMoneda = this.normalizarCodigoMoneda(moneda);
    const simbolo = this.obtenerSimboloMoneda(codigoMoneda);
    const valorFormateado = new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(monto));

    return `${monto < 0 ? '-' : ''}${simbolo} ${valorFormateado}`;
  }

  private obtenerSimboloMoneda(moneda: string): string {
    const codigoMoneda = this.normalizarCodigoMoneda(moneda);

    if (codigoMoneda === this.monedaSistema && this.simboloMonedaSistema?.trim()) {
      return this.simboloMonedaSistema.trim();
    }

    switch (codigoMoneda) {
      case 'USD':
        return '$';
      case 'EUR':
        return '€';
      default:
        return 'Bs.';
    }
  }

  private obtenerNombreAsesor(vendedor: unknown): string {
    const vendedorNormalizado = String(vendedor || '').trim();

    if (!vendedorNormalizado) {
      return this.usuarioActual?.nombre?.trim() || 'N/A';
    }

    const vendedorLower = vendedorNormalizado.toLowerCase();
    const empleado = this.empleadosDisponibles.find((item) => {
      const id = String(item.id || '').trim().toLowerCase();
      const cedula = String(item.cedula || '').trim().toLowerCase();
      const nombre = String(item.nombre || '').trim().toLowerCase();

      return vendedorLower === id || vendedorLower === cedula || vendedorLower === nombre;
    });

    if (empleado?.nombre?.trim()) {
      return empleado.nombre.trim();
    }

    const usuarioActual = this.usuarioActual?.nombre?.trim();
    if (usuarioActual) {
      const usuarioId = String(this.usuarioActual?.id || '').trim().toLowerCase();
      const usuarioCedula = String(this.usuarioActual?.cedula || '').trim().toLowerCase();
      const usuarioNombre = usuarioActual.toLowerCase();

      if ([usuarioId, usuarioCedula, usuarioNombre].includes(vendedorLower) || /^\d+$/.test(vendedorNormalizado)) {
        return usuarioActual;
      }
    }

    return vendedorNormalizado;
  }

  private obtenerDatosSedeImpresion(): {
    nombreOptica: string;
    rif: string;
    direccion: string;
    telefono: string;
    email: string;
    iniciales: string;
  } {
    const sede = this.sedeActual || (this.usuarioActual?.sede ? this.userStateService.getSedePorKey(this.usuarioActual.sede) : null);
    const nombreOptica = sede?.nombre_optica?.trim() || sede?.nombre?.trim() || this.usuarioActual?.sedeNombre?.trim() || 'New Vision Lens 2020';
    const rif = sede?.rif?.trim() || '';
    const direccion = sede?.direccion_fiscal?.trim() || sede?.direccion?.trim() || 'Dirección no disponible';
    const telefono = sede?.telefono?.trim() || 'Sin teléfono';
    const email = sede?.email?.trim() || 'Sin correo';

    return {
      nombreOptica,
      rif,
      direccion,
      telefono,
      email,
      iniciales: this.obtenerInicialesMarca(nombreOptica)
    };
  }

  private obtenerInicialesMarca(nombre: string): string {
    const palabras = String(nombre || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3);

    if (!palabras.length) {
      return 'NV';
    }

    return palabras.map((palabra) => palabra.charAt(0).toUpperCase()).join('');
  }

  private escaparHtml(valor: unknown): string {
    return String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  debeMostrarReferenciaBs(moneda: string = this.monedaSistema): boolean {
    return this.normalizarCodigoMoneda(moneda) !== 'VES';
  }

  obtenerReferenciaBs(monto: number | null | undefined, moneda: string = this.monedaSistema): number {
    if (!monto) {
      return 0;
    }

    return this.systemConfigService.convertirMonto(Number(monto), moneda, 'VES');
  }

  getTextoMonedaActual(): string {
    return `${this.simboloMonedaSistema} ${this.monedaSistema}`;
  }

  agregarProducto(producto: any) {
    if (this.debeBloquearSeleccionProductosPorFormulaExterna()) {
      this.snackBar.open('Complete la refracción final de fórmula externa antes de agregar productos', 'Cerrar', {
        duration: 3500,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    const descripcionVisible = this.obtenerDescripcionVisibleProducto(producto);

    // Verificar si el producto ya existe en la lista
    const productoExistente = this.nuevoPresupuesto.productos.find((p: any) => p.id === producto.id);

    if (productoExistente) {
      // Si ya existe, incrementar la cantidad
      productoExistente.cantidad += 1;
      this.actualizarProductoPorId(producto.id);
    } else {
      // Si no existe, agregar nuevo producto
      const productoAgregar = {
        id: producto.id,
        productoId: producto.id,
        nombre: producto.nombre,
        codigo: producto.codigo,
        descripcion: descripcionVisible,
        precio: producto.precio,
        precioUnitario: producto.precio,
        precioOriginal: producto.precioOriginal ?? producto.precio,
        moneda: producto.moneda ?? this.monedaSistema,
        monedaOriginal: producto.monedaOriginal ?? producto.moneda ?? this.monedaSistema,
        tasaConversion: producto.tasaConversion ?? 1,
        aplicaIva: producto.aplicaIva !== false,
        categoria: producto.categoria,
        cristalConfig: producto.cristalConfig,
        cantidad: 1,
        descuento: 0,
        descuentoPorcentaje: 0,
        total: producto.precio
      };

      this.nuevoPresupuesto.productos.push(productoAgregar);
    }

    this.calcularTotales();
    this.terminoBusqueda = '';
    this.productosFiltrados = [];

    // Mostrar mensaje de confirmación
    this.snackBar.open(`${descripcionVisible} agregado al presupuesto`, 'Cerrar', {
      duration: 2000,
      panelClass: ['snackbar-success']
    });
  }

  actualizarProductoPorId(productoId: number) {
    const index = this.nuevoPresupuesto.productos.findIndex((p: any) => p.id === productoId);
    if (index !== -1) {
      this.actualizarProducto(index);
    }
  }

  actualizarProducto(index: number) {
    const producto = this.nuevoPresupuesto.productos[index];

    this.normalizarLineaPresupuesto(producto);

    this.calcularTotales();
  }

  modificarCantidad(index: number, cambio: number) {
    const producto = this.nuevoPresupuesto.productos[index];
    const nuevaCantidad = producto.cantidad + cambio;

    if (nuevaCantidad < 1) {
      // Si la cantidad llega a 0, eliminar el producto
      this.eliminarProducto(index);
      return;
    }

    producto.cantidad = nuevaCantidad;
    this.actualizarProducto(index);
  }

  calcularTotales() {
    const opcion = this.obtenerOpcionPresupuesto(this.nuevoPresupuesto, this.opcionActivaNuevoId);
    if (!opcion) {
      return;
    }

    this.recalcularTotalesPresupuesto(opcion as any);
    this.sincronizarPresupuestoDesdeOpcion(this.nuevoPresupuesto, opcion);
  }

  esLineaConsulta(producto: any): boolean {
    const tipoItem = normalizarTextoClasificacion(producto?.tipoItem);
    const codigo = String(producto?.codigo || '').trim().toUpperCase();
    const categoria = normalizarTextoClasificacion(this.obtenerCategoriaProductoPresupuesto(producto));

    return Boolean(
      this.normalizarBanderaBooleana(producto?.esConsulta)
      || tipoItem === 'servicio_consulta'
      || codigo === 'CONSULTA-MEDICA'
      || categoria === 'consulta'
    );
  }

  tieneConsultaEnNuevoPresupuesto(): boolean {
    return Array.isArray(this.nuevoPresupuesto?.productos)
      && this.nuevoPresupuesto.productos.some((producto: any) => this.esLineaConsulta(producto));
  }

  tieneConsultaEnDetalle(): boolean {
    return Array.isArray(this.presupuestoSeleccionado?.productos)
      && this.presupuestoSeleccionado.productos.some((producto: any) => this.esLineaConsulta(producto));
  }

  lineaAplicaIva(producto: any): boolean {
    if (this.esLineaConsulta(producto)) {
      return false;
    }

    return producto?.aplicaIva !== false;
  }

  private normalizarLineaPresupuesto(producto: any): void {
    if (!producto) {
      return;
    }

    producto.precio = Math.max(0, Number(producto.precio || 0));
    producto.cantidad = Math.max(1, Number(producto.cantidad || 1));
    producto.descuento = Math.max(0, Math.min(100, Number(producto.descuento || 0)));

    if (this.esLineaConsulta(producto)) {
      producto.cantidad = 1;
      producto.descuento = 0;
      producto.aplicaIva = false;
      producto.tipoItem = 'servicio_consulta';
      producto.esConsulta = true;
    }

    const subtotal = producto.precio * producto.cantidad;
    const descuentoValor = subtotal * (producto.descuento / 100);
    producto.total = subtotal - descuentoValor;
  }

  private recalcularTotalesPresupuesto(presupuesto: any): void {
    const productos = Array.isArray(presupuesto?.productos) ? presupuesto.productos : [];

    presupuesto.subtotal = productos
      .reduce((sum: number, producto: any) => sum + (Number(producto.precio || 0) * Number(producto.cantidad || 1)), 0);

    presupuesto.descuentoTotal = productos
      .reduce((sum: number, producto: any) => sum + (Number(producto.precio || 0) * Number(producto.cantidad || 1) * (Number(producto.descuento || 0) / 100)), 0);

    const baseImponible = productos.reduce((sum: number, producto: any) => {
      if (!this.lineaAplicaIva(producto)) {
        return sum;
      }

      return sum + Number(producto.total || 0);
    }, 0);

    presupuesto.iva = baseImponible * this.getIvaFactor();
    presupuesto.total = (presupuesto.subtotal - presupuesto.descuentoTotal) + presupuesto.iva;
  }

  private async obtenerMontoConsultaSugerido(): Promise<number> {
    try {
      const response = await lastValueFrom(this.generarVentaService.getCostosConsulta('0'));
      const totalConsulta = Number.parseFloat(response?.totalConsulta || '0');
      return Number.isFinite(totalConsulta) && totalConsulta > 0 ? totalConsulta : 40;
    } catch {
      return 40;
    }
  }

  private crearLineaConsultaPresupuesto(monto: number): any {
    const precio = Math.max(0, Number(monto || 0));

    return {
      id: null,
      productoId: null,
      nombre: 'Consulta medica',
      codigo: 'CONSULTA-MEDICA',
      descripcion: 'Consulta medica',
      precio,
      precioUnitario: precio,
      precioOriginal: precio,
      moneda: this.monedaSistema,
      monedaOriginal: this.monedaSistema,
      tasaConversion: 1,
      categoria: 'consulta',
      cristalConfig: null,
      cantidad: 1,
      descuento: 0,
      descuentoPorcentaje: 0,
      total: precio,
      aplicaIva: false,
      tipoItem: 'servicio_consulta',
      esConsulta: true
    };
  }

  getEtiquetaIva(): string {
    return `IVA (${this.ivaPorcentaje}%)`;
  }

  private getIvaFactor(): number {
    return (this.ivaPorcentaje || 0) / 100;
  }

  private reaplicarMonedaActualEnProductosDisponibles(): void {
    if (!this.productosDisponiblesBase.length) {
      this.productosDisponibles = [];
      this.productosFiltrados = [];
      this.productosCatalogoFiltrados = [];
      return;
    }

    const productosConvertidos = this.productoConversionService.convertirListaProductosAmonedaSistema(this.productosDisponiblesBase);
    this.productosDisponibles = productosConvertidos.map((producto) => this.mapearProductoDisponible(producto));

    if (this.terminoBusqueda) {
      this.filtrarProductos();
    }

    if (this.mostrarModalCatalogoProductos) {
      this.aplicarFiltroCatalogoProductos();
    }
  }

  private reaplicarMonedaActualEnPresupuestoActivo(): void {
    if (this.nuevoPresupuesto.productos.length > 0) {
      this.nuevoPresupuesto.productos = this.convertirProductosPresupuesto(this.nuevoPresupuesto.productos);
      this.calcularTotales();
    }

    if (this.presupuestoSeleccionado?.productos?.length) {
      this.presupuestoSeleccionado.productos = this.convertirProductosPresupuesto(this.presupuestoSeleccionado.productos);
      this.calcularTotalesDetalle();
    }
  }

  private convertirProductosPresupuesto(productos: any[]): any[] {
    return productos.map((producto) => {
      const productoConvertido = this.productoConversionService.convertirProductoAmonedaSistema({
        precio: producto.precioOriginal ?? producto.precio,
        precioOriginal: producto.precioOriginal ?? producto.precio,
        moneda: producto.monedaOriginal ?? producto.moneda ?? this.monedaSistema,
        monedaOriginal: producto.monedaOriginal ?? producto.moneda ?? this.monedaSistema,
        precioConIva: producto.precioConIva,
        aplicaIva: producto.aplicaIva
      });

      const cantidad = Number(producto.cantidad || 1);
      const descuento = Number(producto.descuento || 0);
      const total = productoConvertido.precio * cantidad * (1 - descuento / 100);
      const nombreVisible = this.obtenerNombreVisibleProducto(producto);

      return {
        ...producto,
        nombre: nombreVisible,
        descripcion: nombreVisible,
        precio: productoConvertido.precio,
        precioOriginal: productoConvertido.precioOriginal ?? producto.precioOriginal ?? producto.precio,
        moneda: productoConvertido.moneda,
        monedaOriginal: productoConvertido.monedaOriginal ?? producto.monedaOriginal ?? producto.moneda ?? this.monedaSistema,
        tasaConversion: productoConvertido.tasaConversion ?? producto.tasaConversion ?? 1,
        total
      };
    });
  }

  private obtenerDescripcionVisibleProducto(producto: any): string {
    if (!producto) {
      return 'Producto';
    }

    const categoria = normalizarTextoClasificacion(this.obtenerCategoriaProductoPresupuesto(producto));
    const cristalConfig = this.obtenerCristalConfigPresupuesto(producto);
    const esCristal = categoria === 'cristales' || Boolean(cristalConfig);
    const nombreVisible = String(producto?.nombre || producto?.producto?.nombre || '').trim();

    if (!esCristal) {
      return nombreVisible || String(producto?.descripcion || 'Producto').trim();
    }

    const descripcionCristal = parseDescripcionProductoCristal(producto?.descripcion);
    const tipoCristal = String(cristalConfig?.tipoCristal || descripcionCristal.crystalConfig?.tipoCristal || '').trim();
    const descripcionUsuario = String(descripcionCristal.descripcionUsuario || '').trim();

    return nombreVisible || tipoCristal || descripcionUsuario || 'Cristal';
  }

  obtenerNombreVisibleProducto(producto: any): string {
    if (!producto) {
      return 'Producto';
    }

    const nombreVisible = String(producto?.nombre || producto?.producto?.nombre || '').trim();
    if (nombreVisible && !nombreVisible.includes('[NV_CRISTAL_CONFIG]')) {
      return nombreVisible;
    }

    if (this.esCategoriaCristalPresupuesto(producto)) {
      const nombreCristal = this.construirNombreCristalPresupuesto(this.obtenerCristalConfigPresupuesto(producto));
      if (nombreCristal) {
        return nombreCristal;
      }
    }

    return this.obtenerDescripcionVisibleProducto(producto);
  }

  mostrarFormulaExternaNuevo(): boolean {
    return this.permiteFormulaExternaSegunEspecialista(this.nuevoPresupuesto);
  }

  mostrarFormulaExternaDetalle(): boolean {
    return this.permiteFormulaExternaSegunEspecialista(this.presupuestoSeleccionado);
  }

  private permiteFormulaExternaSegunEspecialista(presupuesto: any): boolean {
    const vieneDeHistoriaMedica = this.esPresupuestoOriginadoDesdeHistoriaMedica(presupuesto);
    if (!vieneDeHistoriaMedica) {
      return true;
    }

    const tipoEspecialista = String(
      presupuesto?.historia?.especialistaTipo
      || presupuesto?.historia?.datosConsulta?.especialista?.tipo
      || this.historiaPresupuestoHandoffActivo?.especialistaTipo
      || ''
    )
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    if (!tipoEspecialista) {
      return false;
    }

    return tipoEspecialista === 'externo' || tipoEspecialista === 'externa';
  }

  private esPresupuestoOriginadoDesdeHistoriaMedica(presupuesto: any): boolean {
    if (!presupuesto) {
      return false;
    }

    const observaciones = String(presupuesto?.observaciones || '').trim().toLowerCase();
    const marcadoEnObservaciones = observaciones.includes('generado desde historia medica')
      || observaciones.includes('generado desde historia médica');

    if (presupuesto === this.nuevoPresupuesto) {
      return this.historiaPresupuestoHandoffActivo?.origen === 'historia-medica'
        || Boolean(this.nuevoPresupuesto?.historiaMedicaId || this.nuevoPresupuesto?.historia?.id)
        || marcadoEnObservaciones;
    }

    return presupuesto?.origen === 'historia-medica'
      || Boolean(presupuesto?.historiaMedicaId || presupuesto?.historia?.id)
      || marcadoEnObservaciones;
  }

  private mapearProductoDisponible(producto: Producto): any {
    const nombreVisible = this.obtenerNombreVisibleProducto(producto);

    return {
      id: producto.id,
      nombre: nombreVisible,
      codigo: producto.codigo,
      descripcion: nombreVisible,
      precio: producto.precio,
      precioOriginal: producto.precioOriginal ?? producto.precio,
      moneda: this.normalizarCodigoMoneda(producto.moneda),
      monedaOriginal: this.normalizarCodigoMoneda(producto.monedaOriginal || producto.moneda),
      categoria: producto.categoria,
      cristalConfig: producto.cristalConfig,
      stock: producto.stock,
      aplicaIva: producto.aplicaIva,
      tasaConversion: producto.tasaConversion ?? 1
    };
  }

  private normalizarCodigoMoneda(moneda: string | null | undefined): 'USD' | 'EUR' | 'VES' {
    const monedaNormalizada = String(moneda || '').trim().toLowerCase();

    if (['usd', 'dolar', '$'].includes(monedaNormalizada)) {
      return 'USD';
    }

    if (['eur', 'euro', '€'].includes(monedaNormalizada)) {
      return 'EUR';
    }

    return 'VES';
  }

  // En el método verDetallePresupuesto, agregar:
  verDetallePresupuesto(presupuesto: any) {
    this.presupuestoSeleccionado = JSON.parse(JSON.stringify(presupuesto)); // Copia profunda
    this.presupuestoSeleccionado.formulaExterna = this.normalizarFormulaExternaPersistida(this.presupuestoSeleccionado?.formulaExterna);
    this.asegurarOpcionesPresupuesto(this.presupuestoSeleccionado);
    this.sincronizarOpcionActivaDetalle(this.presupuestoSeleccionado.opcionPrincipalId);
    this.modoEditable = false; // Siempre empieza en modo vista
    this.diasVencimientoSeleccionado = presupuesto.diasVencimiento || 7;
    this.terminoBusquedaDetalleProducto = '';
    this.productosDetalleFiltrados = [];
    this.mostrarModalDetallePresupuesto = true;
    this.sincronizarEstadoBodyModal();
  }

  // Método para seleccionar días de vencimiento en modal de detalle
  seleccionarDiasVencimientoDetalle(dias: number): void {
    if (!this.presupuestoSeleccionado || !this.modoEditable) return;

    this.diasVencimientoSeleccionado = dias;

    // Calcular nueva fecha de vencimiento
    const fechaVencimiento = new Date(this.presupuestoSeleccionado.fechaCreacion);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + dias);

    this.presupuestoSeleccionado.fechaVencimiento = fechaVencimiento;
    this.presupuestoSeleccionado.diasVencimiento = dias;

    // Recalcular días restantes
    this.actualizarDiasRestantes();
  }

  // Método para actualizar días restantes
  actualizarDiasRestantes(): void {
    if (!this.presupuestoSeleccionado) return;

    const hoy = new Date();
    const fechaVencimiento = new Date(this.presupuestoSeleccionado.fechaVencimiento);
    const diffTiempo = fechaVencimiento.getTime() - hoy.getTime();
    const diasRestantes = Math.ceil(diffTiempo / (1000 * 3600 * 24));

    this.presupuestoSeleccionado.diasRestantes = diasRestantes;
    this.presupuestoSeleccionado.estadoColor = this.getEstadoColor(diasRestantes);
  }

  // Método para calcular días de validez (ya existe, pero actualizado)
  calcularDiasValidez(): number {
    if (!this.presupuestoSeleccionado) return 0;

    const fechaCreacion = new Date(this.presupuestoSeleccionado.fechaCreacion);
    const fechaVencimiento = new Date(this.presupuestoSeleccionado.fechaVencimiento);
    const diffTiempo = fechaVencimiento.getTime() - fechaCreacion.getTime();
    return Math.ceil(diffTiempo / (1000 * 3600 * 24));
  }

  // Método para actualizar fecha de vencimiento cuando se cambia manualmente
  // Método para actualizar fecha de vencimiento (ya existe, pero actualizado)
  onFechaVencimientoChange(event: any): void {
    if (!this.presupuestoSeleccionado || !this.modoEditable) return;

    const fecha = new Date(event.target.value);
    this.presupuestoSeleccionado.fechaVencimiento = fecha;

    // Recalcular días de validez basado en la fecha de creación
    const fechaCreacion = new Date(this.presupuestoSeleccionado.fechaCreacion);
    const diffTiempo = fecha.getTime() - fechaCreacion.getTime();
    const diasValidez = Math.ceil(diffTiempo / (1000 * 3600 * 24));

    // Actualizar días de vencimiento
    this.diasVencimientoSeleccionado = diasValidez;
    this.presupuestoSeleccionado.diasVencimiento = diasValidez;

    // Recalcular días restantes
    this.actualizarDiasRestantes();

    // Encontrar la opción de vencimiento más cercana
    const opcionesDias = [7, 10, 20, 30];
    let opcionMasCercana = 7;
    let diferenciaMinima = Math.abs(diasValidez - 7);

    opcionesDias.forEach(opcion => {
      const diferencia = Math.abs(diasValidez - opcion);
      if (diferencia < diferenciaMinima) {
        diferenciaMinima = diferencia;
        opcionMasCercana = opcion;
      }
    });

    // Actualizar botón seleccionado
    this.diasVencimientoSeleccionado = opcionMasCercana;
  }

  // Método para resetear el estado de edición al cerrar el modal
  resetearEstadoEdicion(): void {
    this.modoEditable = false;
    this.diasVencimientoSeleccionado = 7;
  }

  // Actualizar el método cerrarModalDetalle
  cerrarModalDetalle(): void {
    this.mostrarModalDetallePresupuesto = false;
    this.presupuestoSeleccionado = null;
    this.opcionActivaDetalleId = '';
    this.terminoBusquedaDetalleProducto = '';
    this.productosDetalleFiltrados = [];
    this.cerrarMenuAccionesDetalleInmediato();
    this.resetearEstadoEdicion();
    this.sincronizarEstadoBodyModal();
  }

  puedeConvertirPresupuesto(presupuesto: any): boolean {
    if (!presupuesto) {
      return false;
    }

    if (this.tieneVentaRegistrada(presupuesto)) {
      return false;
    }

    const estado = String(presupuesto.estadoColor || presupuesto.estado || '').toLowerCase();
    if (['archivado', 'anulado'].includes(estado)) {
      return false;
    }

    if (typeof presupuesto.diasRestantes === 'number') {
      return presupuesto.diasRestantes >= 0;
    }

    if (presupuesto.estadoColor) {
      return presupuesto.estadoColor !== 'vencido';
    }

    if (!presupuesto.fechaVencimiento) {
      return false;
    }

    const fechaVencimiento = new Date(presupuesto.fechaVencimiento);
    if (Number.isNaN(fechaVencimiento.getTime())) {
      return false;
    }

    const finDeVencimiento = new Date(fechaVencimiento);
    finDeVencimiento.setHours(23, 59, 59, 999);

    return finDeVencimiento.getTime() >= Date.now();
  }

  obtenerMotivoNoConversion(presupuesto: any): string {
    if (this.puedeConvertirPresupuesto(presupuesto)) {
      return 'Convertir a venta';
    }

    const codigo = presupuesto?.codigo || 'este presupuesto';
    if (this.tieneVentaRegistrada(presupuesto)) {
      return `${codigo} ya fue convertido en venta.`;
    }

    const estado = String(presupuesto?.estadoColor || presupuesto?.estado || '').toLowerCase();
    if (estado === 'archivado') {
      return `${codigo} está archivado y no puede convertirse en venta.`;
    }
    if (estado === 'anulado') {
      return `${codigo} está anulado y no puede convertirse en venta.`;
    }
    return `${codigo} está vencido y no puede convertirse en venta.`;
  }

  esVentaGenerada(presupuesto: any): boolean {
    return this.tieneVentaRegistrada(presupuesto);
  }

  private tieneVentaRegistrada(presupuesto: any): boolean {
    if (!presupuesto) {
      return false;
    }

    const posiblesIds = [
      presupuesto?.ventaId,
      presupuesto?.venta_id,
      presupuesto?.idVenta,
      presupuesto?.id_venta,
      presupuesto?.venta?.id,
      presupuesto?.ventaRelacionada?.id
    ];

    return posiblesIds.some((valor) => {
      if (valor === null || valor === undefined) {
        return false;
      }

      const texto = String(valor).trim().toLowerCase();
      return texto.length > 0 && texto !== '0' && texto !== 'null' && texto !== 'undefined';
    });
  }

  private sincronizarEstadoBodyModal(): void {
    const hayModalAbierto = this.mostrarModalNuevoPresupuesto
      || this.mostrarModalDetallePresupuesto
      || this.mostrarModalEliminar
      || this.mostrarModalConversionPresupuesto
      || this.mostrarModalRenovarPresupuesto
      || this.mostrarModalCatalogoProductos;

    document.body.classList.toggle('modal-open', hayModalAbierto);
  }

  private obtenerScrollModalDetalle(): number {
    const contenedor = document.querySelector('.modal-detalle-presupuesto .scrollable-modal') as HTMLElement | null;
    return contenedor?.scrollTop || 0;
  }

  private establecerScrollModalDetalle(posicion: number): void {
    const contenedor = document.querySelector('.modal-detalle-presupuesto .scrollable-modal') as HTMLElement | null;

    if (contenedor) {
      contenedor.scrollTop = Math.max(0, posicion || 0);
    }
  }

  private mapearPresupuestoParaVenta(presupuesto: any): PresupuestoVentaDraft {
    const opcionActiva = this.obtenerOpcionPresupuesto(
      presupuesto,
      presupuesto?.opcionPrincipalId || this.opcionActivaConversionId || this.opcionActivaDetalleId
    );
    const productosPresupuesto = Array.isArray(opcionActiva?.productos)
      ? opcionActiva.productos
      : (Array.isArray(presupuesto?.productos) ? presupuesto.productos : []);
    const lineasPresupuesto = this.construirLineasPresupuestoVenta(productosPresupuesto);
    const tieneLineaConsulta = lineasPresupuesto.some((linea) => linea.esConsulta === true);
    const lineasProducto = lineasPresupuesto.filter((linea) => linea.esConsulta !== true);
    const tieneLineasProducto = lineasProducto.length > 0;
    const tieneCategoriaCristal = lineasProducto.some((linea) => this.esCategoriaCristalPresupuesto(linea));

    const tipoVentaDerivada: 'solo_productos' | 'consulta_productos' | 'solo_consulta' =
      tieneLineaConsulta && !tieneLineasProducto
        ? 'solo_consulta'
        : (tieneCategoriaCristal || (tieneLineaConsulta && tieneLineasProducto))
          ? 'consulta_productos'
          : 'solo_productos';

    const requiereSoporteClinico = tipoVentaDerivada !== 'solo_productos';

    const historiaId = presupuesto?.historiaMedicaId
      ?? presupuesto?.historia_medica_id
      ?? presupuesto?.historiaId
      ?? presupuesto?.historia?.id;
    const historiaNumero = presupuesto?.historiaNumero
      ?? presupuesto?.historia?.nHistoria
      ?? presupuesto?.historia?.numero;
    const pacienteKey = presupuesto?.cliente?.key
      ?? presupuesto?.pacienteKeyOrigen
      ?? presupuesto?.paciente_key_origen
      ?? presupuesto?.historia?.pacienteKey
      ?? presupuesto?.cliente?.pacienteKey
      ?? presupuesto?.cliente?.paciente_id
      ?? presupuesto?.cliente?.pacienteId;

    return {
      origen: {
        id: presupuesto.id,
        codigo: presupuesto.codigo,
        fechaVencimiento: presupuesto.fechaVencimiento ? new Date(presupuesto.fechaVencimiento).toISOString() : undefined,
        total: opcionActiva?.total ?? presupuesto.total ?? 0
      },
      tipoVenta: tipoVentaDerivada,
      estadoValidacionClinica: requiereSoporteClinico ? 'pendiente' : 'no_requerida',
      requiereSoporteClinico,
      historia: {
        id: historiaId,
        numero: historiaNumero,
        pacienteKey: pacienteKey ? String(pacienteKey) : undefined,
        pacienteId: presupuesto?.pacienteIdOrigen ?? presupuesto?.paciente_id_origen ?? presupuesto?.cliente?.pacienteId ?? presupuesto?.cliente?.paciente_id,
        especialistaTipo: presupuesto?.historia?.datosConsulta?.especialista?.tipo
      },
      cliente: {
        tipoPersona: presupuesto?.cliente?.tipoPersona === 'juridica' ? 'juridica' : 'natural',
        nombreCompleto: presupuesto?.cliente?.nombreCompleto || '',
        cedula: presupuesto?.cliente?.cedula || '',
        telefono: presupuesto?.cliente?.telefono || '',
        email: presupuesto?.cliente?.email || '',
        pacienteKey: pacienteKey ? String(pacienteKey) : undefined,
        pacienteId: presupuesto?.pacienteIdOrigen ?? presupuesto?.paciente_id_origen ?? presupuesto?.cliente?.pacienteId ?? presupuesto?.cliente?.paciente_id
      },
      observaciones: presupuesto?.observaciones || '',
      productos: lineasPresupuesto
    };
  }

  private construirLineasPresupuestoVenta(productos: any[]): PresupuestoVentaDraft['productos'] {
    return (productos || []).map((producto: any, index: number) => {
      const esConsulta = this.esLineaConsulta(producto);
      const esCristalFormulado = this.esCristalFormuladoEnPresupuesto(producto);
      const categoriaOriginal = this.obtenerCategoriaProductoPresupuesto(producto);
      const categoria = normalizarTextoClasificacion(categoriaOriginal);
      const cristalConfig = this.obtenerCristalConfigPresupuesto(producto);
      const descripcion = this.obtenerDescripcionVisibleProducto(producto);
      const nombre = normalizarTextoClasificacion(producto?.nombre || producto?.producto?.nombre);
      const descripcionNormalizada = normalizarTextoClasificacion(descripcion);
      const material = normalizarTextoClasificacion(producto?.material || cristalConfig?.material);
      const codigo = normalizarTextoClasificacion(producto?.codigo);
      const subtipo = normalizarTextoClasificacion(cristalConfig?.tipoCristal || producto?.tipoLenteContacto || '');
      const textoPlano = [categoria, nombre, descripcionNormalizada, material, codigo]
        .filter(Boolean)
        .join(' | ');

      const clasificacionInferida = esConsulta
        ? {
          tipoItem: 'servicio_consulta' as const,
          requiereFormula: false,
          requierePaciente: true,
          requiereHistoriaMedica: true,
          permiteFormulaExterna: false,
          requiereItemPadre: false,
          requiereProcesoTecnico: false,
          esClasificacionConfiable: true
        }
        : resolverClasificacionMaestra(textoPlano, categoria, subtipo);

      const clasificacion = {
        ...clasificacionInferida,
        tipoItem: (!esConsulta && esCristalFormulado && clasificacionInferida.tipoItem === 'inventariable')
          ? 'base_formulado' as const
          : clasificacionInferida.tipoItem,
        requiereFormula: esConsulta ? false : (clasificacionInferida.requiereFormula || esCristalFormulado),
        requierePaciente: esConsulta
          ? true
          : (clasificacionInferida.requierePaciente || esCristalFormulado),
        permiteFormulaExterna: esConsulta
          ? false
          : (clasificacionInferida.permiteFormulaExterna || esCristalFormulado)
      };

      return {
        lineaKey: `presupuesto-linea-${index + 1}-${String(producto?.id ?? producto?.codigo ?? 'sin-id')}`,
        id: producto?.id,
        codigo: producto?.codigo,
        descripcion,
        categoria: categoriaOriginal,
        material: producto?.material || cristalConfig?.material,
        cantidad: Number(producto?.cantidad || 1),
        precioUnitario: Number(producto?.precio || 0),
        descuento: Number(producto?.descuento || 0),
        totalLinea: Number(producto?.total || 0),
        tipoItem: clasificacion.tipoItem,
        esConsulta,
        requiereFormula: clasificacion.requiereFormula,
        requierePaciente: clasificacion.requierePaciente,
        requiereHistoriaMedica: clasificacion.requiereHistoriaMedica,
        permiteFormulaExterna: clasificacion.permiteFormulaExterna,
        requiereItemPadre: clasificacion.requiereItemPadre,
        requiereProcesoTecnico: clasificacion.requiereProcesoTecnico,
        origenClasificacion: 'inferido',
        esClasificacionConfiable: clasificacion.esClasificacionConfiable,
        configuracionTecnica: null
      };
    });
  }

  private esCristalFormuladoEnPresupuesto(producto: any): boolean {
    const categoria = normalizarTextoClasificacion(this.obtenerCategoriaProductoPresupuesto(producto));
    const cristalConfig = this.obtenerCristalConfigPresupuesto(producto);
    const tipoCristal = normalizarTextoClasificacion(cristalConfig?.tipoCristal || producto?.tipoLenteContacto || '');
    const tieneCristalConfig = Boolean(cristalConfig);
    const esCristal = categoria === 'cristales' || tieneCristalConfig;

    if (!esCristal) {
      return false;
    }

    if (tipoCristal.includes('plano')) {
      return false;
    }

    return true;
  }

  private esCategoriaCristalPresupuesto(producto: any): boolean {
    const categoria = normalizarTextoClasificacion(this.obtenerCategoriaProductoPresupuesto(producto));
    return categoria === 'cristales' || categoria === 'cristal' || Boolean(this.obtenerCristalConfigPresupuesto(producto));
  }

  private obtenerCategoriaProductoPresupuesto(producto: any): string {
    const cristalConfigInferido = this.obtenerCristalConfigPresupuesto(producto);

    return String(
      producto?.categoria
      || producto?.producto?.categoria
      || producto?.configuracionTecnica?.categoria
      || producto?.cristalConfig?.categoria
      || producto?.configuracionTecnica?.cristalConfig?.categoria
      || (cristalConfigInferido ? 'Cristales' : '')
      || ''
    ).trim();
  }

  private obtenerCristalConfigPresupuesto(producto: any): any {
    return producto?.cristalConfig
      || producto?.configuracionTecnica?.cristalConfig
      || parseDescripcionProductoCristal(producto?.descripcion).crystalConfig
      || null;
  }

  private construirNombreCristalPresupuesto(config: any): string {
    if (!config) {
      return '';
    }

    const nombreExplicito = String(config?.nombre ?? '').trim();
    if (nombreExplicito) {
      return nombreExplicito;
    }

    return [
      String(config?.tipoCristal ?? config?.modelo ?? '').trim(),
      String(config?.presentacion ?? '').trim(),
      String(config?.material ?? '').trim(),
      ...(Array.isArray(config?.tratamientos) ? config.tratamientos.map((item: unknown) => String(item ?? '').trim()) : []),
      String(config?.rangoFormula ?? '').trim()
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  private normalizarBanderaBooleana(valor: unknown): boolean {
    if (typeof valor === 'boolean') {
      return valor;
    }

    if (typeof valor === 'number') {
      return valor === 1;
    }

    if (typeof valor === 'string') {
      const texto = valor.trim().toLowerCase();

      if (['true', '1', 'si', 'sí', 'yes'].includes(texto)) {
        return true;
      }

      if (['false', '0', 'no', 'null', 'undefined', ''].includes(texto)) {
        return false;
      }
    }

    return Boolean(valor);
  }

  onCambioFormulaExternaNuevo(activa: boolean): void {
    this.asegurarFormulaExternaEnPresupuesto(this.nuevoPresupuesto);
    this.nuevoPresupuesto.formulaExterna.activa = Boolean(activa);
    this.nuevoPresupuesto.formulaExterna.origen = activa
      ? (this.obtenerOrigenFormulaPresupuesto(this.nuevoPresupuesto) || 'externa')
      : null;
  }

  esFormulaExternaActivaNuevo(): boolean {
    return this.mostrarFormulaExternaNuevo()
      && Boolean(this.obtenerOrigenFormulaPresupuesto(this.nuevoPresupuesto));
  }

  esFormulaExternaCompletaNuevo(): boolean {
    return this.esFormulaExternaCompletaPresupuesto(this.nuevoPresupuesto);
  }

  debeBloquearSeleccionProductosPorFormulaExterna(): boolean {
    return this.mostrarFormulaExternaNuevo() && this.esFormulaExternaActivaNuevo() && !this.esFormulaExternaCompletaNuevo();
  }

  onCambioFormulaExternaDetalle(activa: boolean): void {
    this.asegurarFormulaExternaEnPresupuesto(this.presupuestoSeleccionado);
    this.presupuestoSeleccionado.formulaExterna.activa = Boolean(activa);
    this.presupuestoSeleccionado.formulaExterna.origen = activa
      ? (this.obtenerOrigenFormulaPresupuesto(this.presupuestoSeleccionado) || 'externa')
      : null;
  }

  esFormulaExternaActivaDetalle(): boolean {
    return this.mostrarFormulaExternaDetalle()
      && Boolean(this.obtenerOrigenFormulaPresupuesto(this.presupuestoSeleccionado));
  }

  esFormulaExternaCompletaDetalle(): boolean {
    return this.esFormulaExternaCompletaPresupuesto(this.presupuestoSeleccionado);
  }

  debeBloquearSeleccionProductosPorFormulaExternaDetalle(): boolean {
    return this.mostrarFormulaExternaDetalle() && this.esFormulaExternaActivaDetalle() && !this.esFormulaExternaCompletaDetalle();
  }

  async seleccionarOrigenFormulaNuevo(origen: OrigenFormulaPresupuesto): Promise<void> {
    await this.actualizarOrigenFormulaPresupuesto(this.nuevoPresupuesto, origen, false);
  }

  async seleccionarOrigenFormulaDetalle(origen: OrigenFormulaPresupuesto): Promise<void> {
    await this.actualizarOrigenFormulaPresupuesto(this.presupuestoSeleccionado, origen, true);
  }

  esOrigenFormulaNuevo(origen: OrigenFormulaPresupuesto): boolean {
    return this.obtenerOrigenFormulaPresupuesto(this.nuevoPresupuesto) === origen;
  }

  esOrigenFormulaDetalle(origen: OrigenFormulaPresupuesto): boolean {
    return this.obtenerOrigenFormulaPresupuesto(this.presupuestoSeleccionado) === origen;
  }

  getTituloBloqueFormulaNuevo(): string {
    return 'Formula de referencia';
  }

  getTituloBloqueFormulaDetalle(): string {
    return 'Formula de referencia';
  }

  getEtiquetaOrigenFormulaNuevo(): string {
    return this.getEtiquetaOrigenFormula(this.obtenerOrigenFormulaPresupuesto(this.nuevoPresupuesto));
  }

  getEtiquetaOrigenFormulaDetalle(): string {
    return this.getEtiquetaOrigenFormula(this.obtenerOrigenFormulaPresupuesto(this.presupuestoSeleccionado));
  }

  getDescripcionOrigenFormulaNuevo(): string {
    return this.getDescripcionOrigenFormula(this.obtenerOrigenFormulaPresupuesto(this.nuevoPresupuesto));
  }

  getDescripcionOrigenFormulaDetalle(): string {
    return this.getDescripcionOrigenFormula(this.obtenerOrigenFormulaPresupuesto(this.presupuestoSeleccionado));
  }

  getMensajeFormulaExternaIncompleta(): string {
    const origen = this.obtenerOrigenFormulaPresupuesto(this.presupuestoSeleccionado)
      || this.obtenerOrigenFormulaPresupuesto(this.nuevoPresupuesto)
      || 'externa';
    return `Para formula ${origen}, completa refraccion final (OD/OI: esfera, cilindro y eje) antes de agregar productos.`;
  }

  private getEtiquetaOrigenFormula(origen: OrigenFormulaPresupuesto | null): string {
    return origen === 'interna' ? 'Formula interna' : 'Formula externa';
  }

  private getDescripcionOrigenFormula(origen: OrigenFormulaPresupuesto | null): string {
    if (origen === 'interna') {
      return 'Usa esta referencia si los lentes actuales del paciente fueron hechos en la tienda; la lectura actual corresponde con la refraccion final de su ultima historia medica registrada.';
    }

    return 'Usa esta referencia si el paciente trae formula de fuera o si sus lentes actuales fueron hechos fuera de la tienda y se toman como referencia.';
  }

  private compararHistoriasPorRecencia(a: any, b: any): number {
    const fechaA = new Date(a?.auditoria?.fechaCreacion || a?.fecha || 0).getTime();
    const fechaB = new Date(b?.auditoria?.fechaCreacion || b?.fecha || 0).getTime();

    if (fechaA !== fechaB) {
      return fechaB - fechaA;
    }

    const extraerSecuencia = (nHistoria: unknown): number => {
      const partes = String(nHistoria || '').trim().split('-');
      return partes.length === 3 ? Number(partes[2]) || 0 : 0;
    };

    return extraerSecuencia(b?.nHistoria) - extraerSecuencia(a?.nHistoria);
  }

  private obtenerHistoriaConFormulaMasReciente(historias: any[]): any | null {
    if (!Array.isArray(historias) || !historias.length) {
      return null;
    }

    return historias
      .slice()
      .sort((a: any, b: any) => this.compararHistoriasPorRecencia(a, b))
      .find((historia: any) => this.obtenerFormulaInternaDesdeHistoria(historia)) || null;
  }

  private obtenerOrigenFormulaPresupuesto(presupuesto: any): OrigenFormulaPresupuesto | null {
    const origen = String(presupuesto?.formulaExterna?.origen || '').trim().toLowerCase();

    if (origen === 'externa' || origen === 'interna') {
      return origen;
    }

    if (this.normalizarBanderaBooleana(presupuesto?.formulaExterna?.activa)) {
      return 'externa';
    }

    return null;
  }

  private async actualizarOrigenFormulaPresupuesto(
    presupuesto: any,
    origen: OrigenFormulaPresupuesto,
    esDetalle: boolean
  ): Promise<void> {
    if (!presupuesto) {
      return;
    }

    this.asegurarFormulaExternaEnPresupuesto(presupuesto);
    const origenActual = this.obtenerOrigenFormulaPresupuesto(presupuesto);
    const nuevoOrigen = origenActual === origen ? null : origen;

    if (nuevoOrigen === 'interna') {
      const requiereConfirmacion = origenActual === 'externa'
        && this.presupuestoTieneDatosEnFormulaReferencia(presupuesto);

      if (requiereConfirmacion) {
        const decision = await this.swalService.showConfirm(
          'Cambiar a formula interna',
          'Se reemplazara la formula externa cargada por la ultima formula interna disponible del paciente.',
          'Cambiar',
          'Mantener externa'
        );

        if (!decision.isConfirmed) {
          return;
        }
      }

      const formulaAplicada = await this.cargarFormulaInternaDesdeUltimaHistoria(presupuesto, esDetalle);
      if (!formulaAplicada) {
        return;
      }
    }

    if (nuevoOrigen === 'externa' && origenActual === 'interna') {
      const requiereConfirmacion = this.presupuestoTieneDatosEnFormulaReferencia(presupuesto);

      if (requiereConfirmacion) {
        const decision = await this.swalService.showConfirm(
          'Cambiar a formula externa',
          'Se limpiara la formula interna cargada para que ingreses una referencia externa nueva.',
          'Cambiar',
          'Mantener interna'
        );

        if (!decision.isConfirmed) {
          return;
        }
      }

      presupuesto.formulaExterna.refraccionFinal = this.crearRefraccionFinalVacia();
    }

    presupuesto.formulaExterna.origen = nuevoOrigen;
    presupuesto.formulaExterna.activa = Boolean(nuevoOrigen);

    if (esDetalle) {
      this.cdr.detectChanges();
    }
  }

  private presupuestoTieneDatosEnFormulaReferencia(presupuesto: any): boolean {
    const refraccion = presupuesto?.formulaExterna?.refraccionFinal;

    if (!refraccion) {
      return false;
    }

    const valores = [
      refraccion?.od?.esfera,
      refraccion?.od?.cilindro,
      refraccion?.od?.eje,
      refraccion?.od?.adicion,
      refraccion?.od?.alt,
      refraccion?.od?.dp,
      refraccion?.oi?.esfera,
      refraccion?.oi?.cilindro,
      refraccion?.oi?.eje,
      refraccion?.oi?.adicion,
      refraccion?.oi?.alt,
      refraccion?.oi?.dp
    ];

    return valores.some((valor) => this.tieneValorFormula(valor));
  }

  private async cargarFormulaInternaDesdeUltimaHistoria(presupuesto: any, esDetalle: boolean): Promise<boolean> {
    this.asegurarFormulaExternaEnPresupuesto(presupuesto);

    let pacienteKey = this.obtenerPacienteKeyPresupuesto(presupuesto);
    let pacienteId = this.obtenerPacienteIdPresupuesto(presupuesto);

    if (!pacienteKey && !pacienteId) {
      const pacienteRelacionado = await this.resolverPacienteDesdeCedulaPresupuesto(presupuesto);
      pacienteKey = String(pacienteRelacionado?.key || '').trim();
      pacienteId = String(pacienteRelacionado?.id || '').trim();

      if (pacienteRelacionado) {
        this.asegurarReferenciaPacienteEnPresupuesto(presupuesto, pacienteRelacionado);
      }
    }

    if (!pacienteKey && !pacienteId) {
      presupuesto.formulaExterna.refraccionFinal = this.crearRefraccionFinalVacia();
      this.snackBar.open('No se encontro un paciente relacionado para recuperar formula interna.', 'Cerrar', {
        duration: 4000,
        panelClass: ['snackbar-warning']
      });
      return false;
    }

    try {
      const historias = pacienteKey
        ? await lastValueFrom(this.historiaService.getHistoriasPorPaciente(pacienteKey))
        : await lastValueFrom(this.historiaService.getHistoriasPaciente(pacienteId));
      const historiaConFormula = this.obtenerHistoriaConFormulaMasReciente(historias || []);

      const formulaInterna = this.obtenerFormulaInternaDesdeHistoria(historiaConFormula);
      if (!formulaInterna) {
        presupuesto.formulaExterna.refraccionFinal = this.crearRefraccionFinalVacia();
        this.snackBar.open('El paciente no tiene historias previas con refraccion final disponible para usar como formula interna.', 'Cerrar', {
          duration: 4500,
          panelClass: ['snackbar-warning']
        });
        return false;
      }

      presupuesto.formulaExterna.refraccionFinal = formulaInterna;

      let opcionesImportadas = 0;
      const recomendacionesDisponibles = this.construirOpcionesPresupuestoDesdeHistoriaPersistida(historiaConFormula);

      if (recomendacionesDisponibles.length > 0) {
        const puedeImportar = await this.confirmarImportacionRecomendacionesHistoriaSiAplica(
          presupuesto,
          historiaConFormula,
          recomendacionesDisponibles.length
        );

        if (puedeImportar) {
          opcionesImportadas = this.aplicarRecomendacionesHistoriaEnPresupuesto(
            presupuesto,
            historiaConFormula,
            recomendacionesDisponibles,
            esDetalle
          );
        }
      }

      const numeroHistoria = String(historiaConFormula?.nHistoria || historiaConFormula?.id || '').trim();
      this.snackBar.open(
        opcionesImportadas > 0
          ? `Formula interna y ${opcionesImportadas} recomendacion(es) cargadas desde la historia ${numeroHistoria || 'mas reciente'}.`
          : `Formula interna cargada desde la historia ${numeroHistoria || 'mas reciente'}.`,
        'Cerrar',
        {
          duration: 3500,
          panelClass: ['snackbar-info']
        }
      );

      if (esDetalle) {
        this.cdr.detectChanges();
      }

      return true;
    } catch (error) {
      console.error('No se pudo cargar la formula interna desde historias:', error);
      presupuesto.formulaExterna.refraccionFinal = this.crearRefraccionFinalVacia();
      this.snackBar.open('No se pudo recuperar la formula interna del paciente.', 'Cerrar', {
        duration: 4000,
        panelClass: ['snackbar-warning']
      });
      return false;
    }
  }

  private obtenerPacienteKeyPresupuesto(presupuesto: any): string {
    return String(
      presupuesto?.cliente?.pacienteKey
      || presupuesto?.pacienteKeyOrigen
      || presupuesto?.historia?.pacienteKey
      || ''
    ).trim();
  }

  private obtenerPacienteIdPresupuesto(presupuesto: any): string {
    return String(
      presupuesto?.cliente?.pacienteId
      || presupuesto?.pacienteIdOrigen
      || presupuesto?.historia?.pacienteId
      || ''
    ).trim();
  }

  private obtenerCedulaPresupuesto(presupuesto: any): string {
    return String(
      presupuesto?.cliente?.cedula
      || this.clienteSinPaciente?.cedula
      || ''
    ).trim();
  }

  private async resolverPacienteDesdeCedulaPresupuesto(presupuesto: any): Promise<any | null> {
    const cedula = this.obtenerCedulaPresupuesto(presupuesto);
    if (!cedula) {
      return null;
    }

    try {
      const respuesta = await lastValueFrom(this.pacientesService.getPacientes());
      const pacientes = Array.isArray(respuesta?.pacientes) ? respuesta.pacientes : [];
      const cedulaNormalizada = cedula.trim().toLowerCase();
      const candidatos = pacientes.filter((item: any) => {
        const cedulaItem = String(item?.informacionPersonal?.cedula || '').trim().toLowerCase();

        if (cedulaItem !== cedulaNormalizada) {
          return false;
        }

        return true;
      });

      if (candidatos.length <= 1) {
        return candidatos[0] || null;
      }

      let mejorCandidato: any | null = null;
      let mejorHistoria: any | null = null;

      for (const candidato of candidatos) {
        const pacienteKey = String(candidato?.key || '').trim();
        const pacienteId = String(candidato?.id || '').trim();

        if (!pacienteKey && !pacienteId) {
          continue;
        }

        const historias = pacienteKey
          ? await lastValueFrom(this.historiaService.getHistoriasPorPaciente(pacienteKey))
          : await lastValueFrom(this.historiaService.getHistoriasPaciente(pacienteId));

        const historiaConFormula = this.obtenerHistoriaConFormulaMasReciente(historias || []);

        if (!historiaConFormula) {
          continue;
        }

        if (!mejorHistoria || this.compararHistoriasPorRecencia(historiaConFormula, mejorHistoria) < 0) {
          mejorCandidato = candidato;
          mejorHistoria = historiaConFormula;
        }
      }

      return mejorCandidato || candidatos[0] || null;
    } catch (error) {
      console.error('No se pudo resolver el paciente por cedula para presupuesto:', error);
      return null;
    }
  }

  private asegurarReferenciaPacienteEnPresupuesto(presupuesto: any, paciente: any): void {
    if (!presupuesto || !paciente) {
      return;
    }

    presupuesto.pacienteKeyOrigen = String(paciente?.key || presupuesto?.pacienteKeyOrigen || '').trim() || null;
    presupuesto.pacienteIdOrigen = String(paciente?.id || presupuesto?.pacienteIdOrigen || '').trim() || null;

    presupuesto.cliente = {
      ...(presupuesto?.cliente || {}),
      pacienteKey: String(paciente?.key || presupuesto?.cliente?.pacienteKey || '').trim() || null,
      pacienteId: String(paciente?.id || presupuesto?.cliente?.pacienteId || '').trim() || null,
      key: String(paciente?.key || presupuesto?.cliente?.key || '').trim() || null,
      id: String(paciente?.id || presupuesto?.cliente?.id || '').trim() || null
    };

    presupuesto.historia = {
      ...(presupuesto?.historia || {}),
      pacienteKey: String(paciente?.key || presupuesto?.historia?.pacienteKey || '').trim() || null,
      pacienteId: String(paciente?.id || presupuesto?.historia?.pacienteId || '').trim() || null
    };
  }

  private obtenerFormulaInternaDesdeHistoria(historia: any): any | null {
    const refraccionFinal = historia?.examenOcular?.refraccionFinal;
    if (!refraccionFinal) {
      return null;
    }

    const formula = {
      od: {
        esfera: this.normalizarValorFormulaHistoria(refraccionFinal?.esf_od),
        cilindro: this.normalizarValorFormulaHistoria(refraccionFinal?.cil_od),
        eje: this.normalizarValorFormulaHistoria(refraccionFinal?.eje_od),
        adicion: this.normalizarValorFormulaHistoria(refraccionFinal?.add_od),
        alt: this.normalizarValorFormulaHistoria(refraccionFinal?.alt_od),
        dp: this.normalizarValorFormulaHistoria(refraccionFinal?.dp_od)
      },
      oi: {
        esfera: this.normalizarValorFormulaHistoria(refraccionFinal?.esf_oi),
        cilindro: this.normalizarValorFormulaHistoria(refraccionFinal?.cil_oi),
        eje: this.normalizarValorFormulaHistoria(refraccionFinal?.eje_oi),
        adicion: this.normalizarValorFormulaHistoria(refraccionFinal?.add_oi),
        alt: this.normalizarValorFormulaHistoria(refraccionFinal?.alt_oi),
        dp: this.normalizarValorFormulaHistoria(refraccionFinal?.dp_oi)
      }
    };

    if (!this.tieneValorFormula(formula.od.esfera)
      || !this.tieneValorFormula(formula.od.cilindro)
      || !this.tieneValorFormula(formula.od.eje)
      || !this.tieneValorFormula(formula.oi.esfera)
      || !this.tieneValorFormula(formula.oi.cilindro)
      || !this.tieneValorFormula(formula.oi.eje)) {
      return null;
    }

    return formula;
  }

  private normalizarValorFormulaHistoria(valor: unknown): string | null {
    const texto = String(valor ?? '').trim();
    return texto.length > 0 ? texto : null;
  }

  private crearRefraccionFinalVacia(): any {
    return {
      od: { esfera: null, cilindro: null, eje: null, adicion: null, alt: null, dp: null },
      oi: { esfera: null, cilindro: null, eje: null, adicion: null, alt: null, dp: null }
    };
  }

  private normalizarFormulaExternaPersistida(formulaExterna: any): any {
    const refraccion = formulaExterna?.refraccionFinal || {};
    const origenNormalizado = this.obtenerOrigenFormulaNormalizado(formulaExterna?.origen, formulaExterna?.activa);
    const normalizarValor = (valor: unknown): string | null => {
      const texto = String(valor ?? '').trim();
      return texto.length > 0 ? texto : null;
    };

    return {
      activa: Boolean(origenNormalizado),
      origen: origenNormalizado,
      refraccionFinal: {
        od: {
          esfera: normalizarValor(refraccion?.od?.esfera),
          cilindro: normalizarValor(refraccion?.od?.cilindro),
          eje: normalizarValor(refraccion?.od?.eje),
          adicion: normalizarValor(refraccion?.od?.adicion),
          alt: normalizarValor(refraccion?.od?.alt),
          dp: normalizarValor(refraccion?.od?.dp)
        },
        oi: {
          esfera: normalizarValor(refraccion?.oi?.esfera),
          cilindro: normalizarValor(refraccion?.oi?.cilindro),
          eje: normalizarValor(refraccion?.oi?.eje),
          adicion: normalizarValor(refraccion?.oi?.adicion),
          alt: normalizarValor(refraccion?.oi?.alt),
          dp: normalizarValor(refraccion?.oi?.dp)
        }
      }
    };
  }

  private async confirmarImportacionRecomendacionesHistoriaSiAplica(
    presupuesto: any,
    historia: any,
    totalOpciones: number
  ): Promise<boolean> {
    if (!this.presupuestoTieneProductosNoConsulta(presupuesto)) {
      return true;
    }

    const numeroHistoria = String(historia?.nHistoria || historia?.id || '').trim() || 'mas reciente';
    const etiquetaOpciones = totalOpciones === 1 ? '1 recomendacion' : `${totalOpciones} recomendaciones`;
    const decision = await this.swalService.showConfirm(
      'Importar recomendaciones de historia',
      `La historia ${numeroHistoria} tiene ${etiquetaOpciones} listas para presupuesto. Si continúas, se reemplazarán los productos actuales por esa selección.`,
      'Reemplazar',
      'Conservar actual'
    );

    return !!decision?.isConfirmed;
  }

  private aplicarRecomendacionesHistoriaEnPresupuesto(
    presupuesto: any,
    historia: any,
    opciones: OpcionPresupuesto[],
    esDetalle: boolean
  ): number {
    if (!presupuesto || !Array.isArray(opciones) || opciones.length === 0) {
      return 0;
    }

    presupuesto.historiaMedicaId = String(historia?.id || presupuesto?.historiaMedicaId || '').trim() || null;
    presupuesto.historiaNumero = String(historia?.nHistoria || presupuesto?.historiaNumero || '').trim() || null;
    presupuesto.historia = {
      ...(presupuesto?.historia || {}),
      id: String(historia?.id || presupuesto?.historia?.id || '').trim() || null,
      numero: String(historia?.nHistoria || presupuesto?.historia?.numero || '').trim() || null,
      pacienteKey: String(historia?.pacienteId || presupuesto?.historia?.pacienteKey || this.obtenerPacienteKeyPresupuesto(presupuesto) || '').trim() || null,
      pacienteId: String(historia?.paciente_id || historia?.pacienteKey || presupuesto?.historia?.pacienteId || this.obtenerPacienteIdPresupuesto(presupuesto) || '').trim() || null,
      especialistaTipo: String(historia?.datosConsulta?.especialista?.tipo || presupuesto?.historia?.especialistaTipo || '').trim() || null
    };

    presupuesto.opciones = opciones.map((opcion) => ({
      ...opcion,
      productos: Array.isArray(opcion?.productos)
        ? opcion.productos.map((producto: any) => this.normalizarProductoPresupuestoPersistido(producto))
        : []
    }));
    presupuesto.opcionPrincipalId = String(
      opciones.find((opcion) => opcion.esPrincipal)?.id
      || opciones[0]?.id
      || ''
    ).trim();

    presupuesto.opciones.forEach((opcion: OpcionPresupuesto) => {
      opcion.esPrincipal = opcion.id === presupuesto.opcionPrincipalId;
      this.recalcularTotalesPresupuesto(opcion as any);
    });

    this.sincronizarResumenDesdeOpcionPrincipal(presupuesto);

    if (esDetalle) {
      this.sincronizarOpcionActivaDetalle(presupuesto.opcionPrincipalId);
      this.cdr.detectChanges();
    } else {
      this.sincronizarOpcionActivaNuevo(presupuesto.opcionPrincipalId);
    }

    return presupuesto.opciones.length;
  }

  private construirOpcionesPresupuestoDesdeHistoriaPersistida(historia: any): OpcionPresupuesto[] {
    const recomendaciones = Array.isArray(historia?.recomendaciones) ? historia.recomendaciones : [];

    return recomendaciones
      .map((recomendacion: any, index: number) => {
        const productos = this.obtenerProductosPresupuestablesDesdeRecomendacionHistoria(recomendacion);
        if (productos.length === 0) {
          return null;
        }

        return this.crearOpcionPresupuesto(`Recomendación ${index + 1}`, productos, {
          id: `historia-${String(historia?.id || 'sin-id')}-rec-${index + 1}`,
          observaciones: String(recomendacion?.observaciones || '').trim(),
          esPrincipal: index === 0
        });
      })
      .filter((opcion): opcion is OpcionPresupuesto => !!opcion);
  }

  private obtenerProductosPresupuestablesDesdeRecomendacionHistoria(recomendacion: any): any[] {
    const categorias = this.obtenerCategoriasProductosDesdeRecomendacionHistoria(recomendacion);

    return categorias
      .map((categoria) => this.mapearProductoHistoriaAPresupuesto(categoria.producto, categoria.categoria, recomendacion))
      .filter(Boolean);
  }

  private obtenerCategoriasProductosDesdeRecomendacionHistoria(recomendacion: any): Array<{ categoria: string; producto: any }> {
    const categoriasPersistidas = Array.isArray(recomendacion?.seleccionProductos?.categorias)
      ? recomendacion.seleccionProductos.categorias
      : [];

    const categorias = categoriasPersistidas
      .map((item: any) => ({
        categoria: String(item?.categoria || item?.producto?.categoria || '').trim().toLowerCase(),
        producto: item?.producto || null
      }))
      .filter((item: { categoria: string; producto: any }) => !!item.categoria && !!item.producto?.id);

    if (categorias.length > 0) {
      return categorias;
    }

    const derivadas: Array<{ categoria: string; producto: any }> = [];
    const productoCristal = recomendacion?.seleccionProductos?.cristal;
    const productoMontura = recomendacion?.seleccionProductos?.montura;
    const filtrosAditivos = Array.isArray(recomendacion?.seleccionProductos?.filtrosAditivos)
      ? recomendacion.seleccionProductos.filtrosAditivos
      : [];
    const materiales = Array.isArray(recomendacion?.seleccionProductos?.materiales)
      ? recomendacion.seleccionProductos.materiales
      : [];

    if (productoCristal?.id) {
      derivadas.push({
        categoria: String(productoCristal?.categoria || (recomendacion?.tipoLentesContacto ? 'lentes de contacto' : 'cristales')).trim().toLowerCase(),
        producto: productoCristal
      });
    }

    if (productoMontura?.id) {
      derivadas.push({ categoria: 'monturas', producto: productoMontura });
    }

    filtrosAditivos.forEach((producto: any) => {
      if (producto?.id) {
        derivadas.push({ categoria: String(producto?.categoria || 'filtros/aditivos').trim().toLowerCase(), producto });
      }
    });

    materiales.forEach((producto: any) => {
      if (producto?.id) {
        derivadas.push({ categoria: String(producto?.categoria || 'materiales').trim().toLowerCase(), producto });
      }
    });

    return derivadas;
  }

  private mapearProductoHistoriaAPresupuesto(producto: any, categoria: string, recomendacion: any): any | null {
    if (!producto?.id) {
      return null;
    }

    const precio = Number(producto?.precioConIva ?? producto?.precio ?? 0);
    const descripcionBase = String(producto?.descripcion || producto?.nombre || 'Producto').trim();
    const medidas = this.construirDetalleMedidasRecomendacionHistoria(producto, categoria, recomendacion);
    const descripcion = medidas ? `${descripcionBase} · ${medidas}` : descripcionBase;

    return this.normalizarProductoPresupuestoPersistido({
      id: String(producto?.id),
      productoId: String(producto?.id),
      nombre: String(producto?.nombre || '').trim(),
      descripcion,
      codigo: String(producto?.codigo || '').trim(),
      precio,
      precioUnitario: precio,
      precioOriginal: Number(producto?.precioOriginal ?? producto?.precio ?? precio),
      cantidad: 1,
      descuento: 0,
      descuentoPorcentaje: 0,
      total: precio,
      moneda: producto?.moneda || this.monedaSistema,
      monedaOriginal: producto?.monedaOriginal || producto?.moneda || this.monedaSistema,
      tasaConversion: Number(producto?.tasaConversion ?? 1),
      aplicaIva: producto?.aplicaIva !== false,
      categoria: String(producto?.categoria || categoria || '').trim(),
      cristalConfig: producto?.cristalConfig || null
    });
  }

  private construirDetalleMedidasRecomendacionHistoria(producto: any, categoria: string, recomendacion: any): string {
    const categoriaNormalizada = String(categoria || '').trim().toLowerCase();
    const esCristal = categoriaNormalizada === 'cristales' || categoriaNormalizada === 'cristal';

    if (!esCristal) {
      return '';
    }

    const medidas = producto?.medidas || {
      horizontal: recomendacion?.medidaHorizontal,
      vertical: recomendacion?.medidaVertical,
      diagonal: recomendacion?.medidaDiagonal,
      puente: recomendacion?.medidaPuente
    };

    return [
      medidas?.horizontal ? `H ${medidas.horizontal}` : '',
      medidas?.vertical ? `V ${medidas.vertical}` : '',
      medidas?.diagonal ? `D ${medidas.diagonal}` : '',
      medidas?.puente ? `P ${medidas.puente}` : ''
    ].filter(Boolean).join(' · ');
  }

  private tieneValorFormula(valor: unknown): boolean {
    return String(valor ?? '').trim().length > 0;
  }

  private obtenerOrigenFormulaNormalizado(valor: unknown, activa?: unknown): OrigenFormulaPresupuesto | null {
    const origen = String(valor || '').trim().toLowerCase();

    if (origen === 'externa' || origen === 'interna') {
      return origen;
    }

    return this.normalizarBanderaBooleana(activa) ? 'externa' : null;
  }

  private asegurarFormulaExternaEnPresupuesto(presupuesto: any): void {
    if (!presupuesto) {
      return;
    }

    if (!presupuesto.formulaExterna) {
      presupuesto.formulaExterna = {
        activa: false,
        origen: null,
        refraccionFinal: this.crearRefraccionFinalVacia()
      };
    }

    if (!('origen' in presupuesto.formulaExterna)) {
      presupuesto.formulaExterna.origen = this.obtenerOrigenFormulaNormalizado(
        presupuesto.formulaExterna?.origen,
        presupuesto.formulaExterna?.activa
      );
    }

    if (!presupuesto.formulaExterna.refraccionFinal) {
      presupuesto.formulaExterna.refraccionFinal = this.crearRefraccionFinalVacia();
    }
  }

  private esFormulaExternaCompletaPresupuesto(presupuesto: any): boolean {
    const refraccion = presupuesto?.formulaExterna?.refraccionFinal;
    if (!refraccion) {
      return false;
    }

    return this.tieneValorFormula(refraccion?.od?.esfera)
      && this.tieneValorFormula(refraccion?.od?.cilindro)
      && this.tieneValorFormula(refraccion?.od?.eje)
      && this.tieneValorFormula(refraccion?.oi?.esfera)
      && this.tieneValorFormula(refraccion?.oi?.cilindro)
      && this.tieneValorFormula(refraccion?.oi?.eje);
  }

  private construirObservacionesConFormulaExterna(presupuesto: any): string {
    const observacionesBase = String(presupuesto?.observaciones || '').trim();
    const origenFormula = this.obtenerOrigenFormulaPresupuesto(presupuesto);

    if (!origenFormula) {
      return observacionesBase;
    }

    const refraccion = presupuesto?.formulaExterna?.refraccionFinal;
    const odEsf = String(refraccion?.od?.esfera || '').trim();
    const odCil = String(refraccion?.od?.cilindro || '').trim();
    const odEje = String(refraccion?.od?.eje || '').trim();
    const odAdd = String(refraccion?.od?.adicion || '').trim();
    const odAlt = String(refraccion?.od?.alt || '').trim();
    const odDp = String(refraccion?.od?.dp || '').trim();
    const oiEsf = String(refraccion?.oi?.esfera || '').trim();
    const oiCil = String(refraccion?.oi?.cilindro || '').trim();
    const oiEje = String(refraccion?.oi?.eje || '').trim();
    const oiAdd = String(refraccion?.oi?.adicion || '').trim();
    const oiAlt = String(refraccion?.oi?.alt || '').trim();
    const oiDp = String(refraccion?.oi?.dp || '').trim();

    const marcadorFormula = origenFormula === 'interna' ? 'FORMULA_INTERNA' : 'FORMULA_EXTERNA';
    const resumenFormula = [
      marcadorFormula,
      `OD(${odEsf}/${odCil}x${odEje}${odAdd ? ` ADD ${odAdd}` : ''}${odAlt ? ` ALT ${odAlt}` : ''}${odDp ? ` DP ${odDp}` : ''})`,
      `OI(${oiEsf}/${oiCil}x${oiEje}${oiAdd ? ` ADD ${oiAdd}` : ''}${oiAlt ? ` ALT ${oiAlt}` : ''}${oiDp ? ` DP ${oiDp}` : ''})`
    ].filter(Boolean).join(' | ');

    const observacionesSinFormula = observacionesBase
      .replace(/\s*\|\s*FORMULA_(?:EXTERNA|INTERNA)\s*\|\s*OD\([^|]+\)\s*\|\s*OI\([^|]+\)\s*$/i, '')
      .replace(/^FORMULA_(?:EXTERNA|INTERNA)\s*\|\s*OD\([^|]+\)\s*\|\s*OI\([^|]+\)\s*$/i, '')
      .trim();

    if (!observacionesSinFormula) {
      return resumenFormula;
    }

    return `${observacionesSinFormula} | ${resumenFormula}`;
  }

  private obtenerObservacionesSinFormulaParaImpresion(observaciones: any): string {
    return String(observaciones || '')
      .replace(/\s*\|\s*FORMULA_(?:EXTERNA|INTERNA)\s*\|\s*OD\([^|]+\)\s*\|\s*OI\([^|]+\)\s*$/i, '')
      .replace(/^FORMULA_(?:EXTERNA|INTERNA)\s*\|\s*OD\([^|]+\)\s*\|\s*OI\([^|]+\)\s*$/i, '')
      .trim();
  }

  // Método para guardar cambios del presupuesto
  async guardarCambiosPresupuesto(): Promise<void> {
    if (!this.presupuestoSeleccionado) return;

    if (this.esFormulaExternaActivaDetalle() && !this.esFormulaExternaCompletaDetalle()) {
      this.snackBar.open(this.getMensajeFormulaExternaIncompleta(), 'Cerrar', {
        duration: 3500,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    // Actualizar días de vencimiento según la selección actual
    if (this.modoEditable) {
      this.presupuestoSeleccionado.diasVencimiento = this.diasVencimientoSeleccionado;
    }

    try {
      const actualizado = await lastValueFrom(
        this.presupuestoService.actualizarPresupuesto(
          Number(this.presupuestoSeleccionado.id),
          this.construirPayloadPresupuesto(this.presupuestoSeleccionado)
        )
      );

      await this.cargarPresupuestosDesdeApi(false);
      this.snackBar.open('Presupuesto actualizado correctamente', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-success']
      });

      this.presupuestoSeleccionado = JSON.parse(JSON.stringify(actualizado));
      this.cerrarModalDetalle();
    } catch (error) {
      console.error('Error actualizando presupuesto:', error);
    }
  }

  // Método para obtener texto de días restantes para un presupuesto específico
  getTextoDiasRestantesParaPresupuesto(presupuesto: any): string {
    if (!presupuesto || presupuesto.diasRestantes === undefined) return '';

    const diasRestantes = presupuesto.diasRestantes;

    if (diasRestantes < 0) {
      return `Vencido hace ${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) !== 1 ? 's' : ''}`;
    } else if (diasRestantes === 0) {
      return 'Vence hoy';
    } else if (diasRestantes === 1) {
      return 'Vence mañana';
    } else {
      return `Vence en ${diasRestantes} días`;
    }
  }

  // Y modificar el original para usar con presupuestoSeleccionado
  getTextoDiasRestantes(): string {
    return this.getTextoDiasRestantesParaPresupuesto(this.presupuestoSeleccionado);
  }

  // Agrega estos métodos a tu componente
  getTituloEstadoVacio(): string {
    if (this.hayFiltrosActivos()) {
      return 'No se encontraron coincidencias';
    }

    if (this.tabActiva === 'vigentes') {
      return 'No hay presupuestos vigentes';
    } else {
      return 'No hay presupuestos vencidos';
    }
  }

  getMensajeEstadoVacio(): string {
    if (this.hayFiltrosActivos()) {
      let mensaje = 'No hay presupuestos ';
      mensaje += this.tabActiva === 'vigentes' ? 'vigentes' : 'vencidos';
      mensaje += ' que coincidan con ';

      if (this.filtroBusqueda && this.filtroEstado) {
        mensaje += 'la búsqueda y el filtro de estado.';
      } else if (this.filtroBusqueda) {
        mensaje += 'la búsqueda.';
      } else if (this.filtroEstado) {
        const estadoTexto = this.getEstadoTexto(this.filtroEstado);
        mensaje += `el filtro de estado (${estadoTexto}).`;
      }

      return mensaje;
    }

    if (this.tabActiva === 'vigentes') {
      return 'Comienza creando tu primer presupuesto para organizar tus cotizaciones y ventas.';
    } else {
      return 'Todos tus presupuestos están vigentes o no han vencido aún.';
    }
  }

  // Método para obtener detalles del filtro activo (opcional)
  getDetallesFiltroActivo(): string {
    if (!this.hayFiltrosActivos()) return '';

    let detalles = '';

    if (this.filtroBusqueda) {
      detalles += `Búsqueda: "${this.filtroBusqueda}"`;
    }

    if (this.filtroEstado) {
      if (detalles) detalles += ' • ';
      detalles += `Estado: ${this.getEstadoTexto(this.filtroEstado)}`;
    }

    return detalles;
  }

}