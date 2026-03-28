import { Component, OnInit, HostListener, ViewChild, TemplateRef, ElementRef, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { SwalService } from '../../../core/services/swal/swal.service';
import { HistorialVentaService } from './../historial-ventas/historial-ventas.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GenerarVentaService } from './../generar-venta/generar-venta.service';
import { take } from 'rxjs/operators';
import { SystemConfigService } from '../../system-config/system-config.service';
import { Subscription, Subject, debounceTime } from 'rxjs';
import { EmpleadosService } from './../../../core/services/empleados/empleados.service';
import { LoaderService } from './../../../shared/loader/loader.service';
import { UserStateService } from '../../../core/services/userState/user-state-service';
import { EstadisticasVentas, ResumenFiltros, FiltrosVentas } from '../venta-interfaz';
import { ChartService } from '../../../core/services/chart-service/chart.service';
import { Chart, ChartData, ChartOptions } from 'chart.js';
import { Sede, SedeCompleta } from '../../../view/login/login-interface';


@Component({
  selector: 'app-historial-ventas',
  standalone: false,
  templateUrl: './historial-ventas.component.html',
  styleUrls: ['./historial-ventas.component.scss']
})

export class HistorialVentasComponent implements OnInit {

  @ViewChild('cancelarVentaModal') cancelarVentaModal!: TemplateRef<any>;
  @ViewChild('detalleVentaModal') detalleVentaModal!: TemplateRef<any>;
  @ViewChild('editarVentaModal') editarVentaModal!: TemplateRef<any>;
  @ViewChild('contenidoRecibo', { static: false }) contenidoRecibo!: ElementRef;
  @ViewChild('modalResumenFinanciero') modalResumenFinanciero!: any;
  @ViewChild('realizarPagoModal') realizarPagoModal!: TemplateRef<any>;

  private chartInstances: Chart[] = [];

  // Propiedades para los filtros
  asesores: any[] = [];
  especialistas: any[] = [];
  ventasFiltradas: any[] = [];
  presetActivo: string = '';

  private busquedaSubject = new Subject<string>();
  buscando: boolean = false;
  private ultimoTerminoBuscado: string = '';
  filtrosMejorados: any = {};

  private modalInstance: any;
  tipoOperacionPago: string = 'abono';
  realizarPagoForm!: FormGroup;

  // Nuevas propiedades para el datepicker
  showDatepicker: boolean = false;
  fechaUnica: string = '';

  // Para validación de fechas
  maxDate: string = '';
  minDate: string = '2020-01-01'

  // Ordenamiento
  ordenamiento = {
    campo: 'fecha',
    ascendente: false
  };

  // Propiedades para estadísticas
  estadisticas: any = {
    totalVentas: 0,
    ventasCompletadas: 0,
    ventasPendientes: 0,
    ventasCanceladas: 0,
    montoCompletadas: 0,
    montoPendientes: 0,
    montoCanceladas: 0,
    montoTotalGeneral: 0
  };

  estadisticasCargando = false;
  ventasCargando = false;
  private filtrosChanged$ = new Subject<void>();

  // Filtros específicos para el resumen financiero
  resumenFiltros: ResumenFiltros = {
    periodo: 'mes',
    fechaDesde: '',
    fechaHasta: '',
    anio: new Date().getFullYear(),
    mes: new Date().getMonth() + 1,
    asesor: '',
    formaPago: ''
  };

  resumenData = {
    montoTotal: 12500,
    totalAbonos: 8500,
    deudaPendiente: 4000,
    deudaCashea: 2500,
    deudaAbonos: 1200,
    deudaContado: 300,
    ventasContado: { cantidad: 15, montoTotal: 7500 },
    ventasAbono: { cantidad: 8, montoTotal: 3000 },
    ventasCashea: { cantidad: 5, montoTotal: 1500 },
    ventasCredito: { cantidad: 2, montoTotal: 500 }
  };

  mostrarFiltrosAvanzados: boolean = false;

  // Arrays para selectores
  anosDisponibles: number[] = [];
  mesesDisponibles = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Propiedades para el modal confirmacion cancelar venta
  selectedVenta: any = null;
  motivoCancelacion: string = '';

  // Nuevas propiedades para edición de ventas
  editarVentaForm!: FormGroup;
  monedaEfectivo: string = 'USD';

  // Propiedades para tasas de cambio
  tasasPorId: { [key: string]: number } = {};
  tasasDisponibles: any[] = [];
  monedasDisponibles: any[] = [];
  sedeInfo: SedeCompleta | null = null;
  sedesDisponibles: SedeCompleta[] = [];

  // Propiedades para moneda del sistema
  monedaSistema: string = 'USD';
  simboloMonedaSistema: string = '$';
  private configSubscription!: Subscription;

  tasaCableada: number = 243.00;

  // Propiedades para el modal de recibo
  mostrarModalRecibo: boolean = false;
  datosRecibo: any = null;
  ventaParaRecibo: any = null;

  // Propiedades para Cashea y Abono
  nivelCashea: string = '';
  cantidadCuotasCashea: number = 0;
  resumenCashea: any = { cantidad: 0, total: 0 };
  cuotasCashea: any[] = [];

  // Propiedades para cálculos
  porcentajeAbonadoDelTotal: number = 0;
  currentYear: number = new Date().getFullYear();

  // Filtros
  filtros: FiltrosVentas = {
    busquedaGeneral: '',
    estado: '',
    formaPago: '',
    asesor: '',
    especialista: '',
    fechaDesde: null,
    fechaHasta: null,
    tipoVenta: ''
  };

  bancosDisponibles: Array<{ codigo: string; nombre: string; displayText: string }> = [
    { codigo: '0102', nombre: 'Banco de Venezuela', displayText: '0102 - Banco de Venezuela' },
    { codigo: '0134', nombre: 'Banesco', displayText: '0134 - Banesco' },
    { codigo: '0104', nombre: 'Venezolano de Crédito', displayText: '0104 - Venezolano de Crédito' },
    { codigo: '0105', nombre: 'Mercantil', displayText: '0105 - Mercantil' },
    { codigo: '0114', nombre: 'Bancaribe', displayText: '0114 - Bancaribe' },
    { codigo: '0115', nombre: 'BOD', displayText: '0115 - BOD' },
    { codigo: '0116', nombre: 'Banco Plaza', displayText: '0116 - Banco Plaza' },
    { codigo: '0128', nombre: 'Banco Caribe', displayText: '0128 - Banco Caribe' },
    { codigo: '0108', nombre: 'Banco Provincial', displayText: '0108 - Banco Provincial' },
    { codigo: '0118', nombre: 'Banco del Sur', displayText: '0118 - Banco del Sur' },
    { codigo: '0121', nombre: 'Bancamiga', displayText: '0121 - Bancamiga' },
    { codigo: '0151', nombre: '100% Banco', displayText: '0151 - 100% Banco' },
    { codigo: '0156', nombre: 'Banco del Tesoro', displayText: '0156 - Banco del Tesoro' },
    { codigo: '0157', nombre: 'Banco Bicentenario', displayText: '0157 - Banco Bicentenario' },
    { codigo: '0163', nombre: 'Banco Fondo Común', displayText: '0163 - Banco Fondo Común' },
    { codigo: '0166', nombre: 'Banco Agrícola de Venezuela', displayText: '0166 - Banco Agrícola de Venezuela' },
    { codigo: '0168', nombre: 'Bancrecer', displayText: '0168 - Bancrecer' },
    { codigo: '0169', nombre: 'Mi Banco', displayText: '0169 - Mi Banco' },
    { codigo: '0171', nombre: 'Banco Activo', displayText: '0171 - Banco Activo' },
    { codigo: '0172', nombre: 'Bancamiga', displayText: '0172 - Bancamiga' },
    { codigo: '0173', nombre: 'Banco Internacional de Desarrollo', displayText: '0173 - Banco Internacional de Desarrollo' },
    { codigo: '0174', nombre: 'Banco Plaza', displayText: '0174 - Banco Plaza' },
    { codigo: '0175', nombre: 'Banco de la Fuerza Armada Nacional Bolivariana', displayText: '0175 - Banco de la Fuerza Armada Nacional Bolivariana' },
    { codigo: '0177', nombre: 'Banco del Tesoro', displayText: '0177 - Banco del Tesoro' },
    { codigo: '0191', nombre: 'Banco Nacional de Crédito', displayText: '0191 - Banco Nacional de Crédito' },
    { codigo: '0000', nombre: 'Otro', displayText: '0000 - Otro' }
  ];

  // Paginación
  paginacion = {
    paginaActual: 1,
    itemsPorPagina: 25,
    totalItems: 0,
    totalPaginas: 0,
    itemsPorPaginaOpciones: [10, 25, 50, 100, 250],
    rangoPaginas: [] as number[]
  };

  constructor(
    private modalService: NgbModal,
    private swalService: SwalService,
    private historialVentaService: HistorialVentaService,
    private fb: FormBuilder,
    private generarVentaService: GenerarVentaService,
    private systemConfigService: SystemConfigService,
    private empleadosService: EmpleadosService,
    private loader: LoaderService,
    private userStateService: UserStateService,
    private cdRef: ChangeDetectorRef,
    private chartService: ChartService
  ) {
    this.inicializarFormularioEdicion();
    //  this.inicializarFormularioPago();

    // Agrega este código para el debounce de estadísticas
    this.filtrosChanged$.pipe(
      debounceTime(500)
    ).subscribe(() => {
      this.cargarEstadisticas();
    });

    // Configurar búsqueda con debounce (300ms)
    this.busquedaSubject.pipe(
      debounceTime(400)
    ).subscribe(termino => {
      // Solo buscar si es diferente al último término buscado
      if (termino !== this.ultimoTerminoBuscado) {
        this.realizarBusquedaDinamica(termino);
      }
    });
  }

  ngOnInit() {
    this.obtenerConfiguracionSistema();
    this.suscribirCambiosConfiguracion();
    this.cargarDatosIniciales();
    this.setMaxDate();

    // Suscribirse a cambios en el monto abonado
    this.editarVentaForm.get('montoAbonado')?.valueChanges.subscribe(value => {
      this.validarMontoAbono();
    });

    // Obtener sede actual
    this.userStateService.sedeActual$.subscribe(sede => {
      this.sedeInfo = sede;
    });

    // Obtener todas las sedes (ya cargadas por el dashboard)
    this.userStateService.sedes$.subscribe(sedes => {
      this.sedesDisponibles = sedes;
    });
  }

  filtrarPorSede(sedeKey: string): void {
    // Usar sedes ya cargadas
    const sedeSeleccionada = this.userStateService.getSedePorKey(sedeKey);
    // ... lógica de filtrado
  }

  ngOnDestroy(): void {
    if (this.configSubscription) {
      this.configSubscription.unsubscribe();
    }

    // Limpiar el subject
    this.busquedaSubject.complete();

    // Destruir gráficos al cerrar
    this.destruirGraficos();
  }

  onBusquedaDinamica(termino: string): void {
    this.filtros.busquedaGeneral = termino;

    const debeBuscar = (termino.length >= 3 || termino.length === 0) &&
      termino !== this.ultimoTerminoBuscado &&
      !this.buscando;

    if (debeBuscar) {
      this.busquedaSubject.next(termino);
    }
  }

  // Método mejorado para procesar el término de búsqueda
  private procesarTerminoBusqueda(termino: string): any {
    if (!termino || termino.trim() === '') {
      return { texto: '', ultimosDigitos: '' };
    }

    const terminoLimpio = termino.trim();
    const soloNumeros = this.extraerNumeros(terminoLimpio);

    let resultado: any = {
      texto: terminoLimpio,
      soloNumeros: soloNumeros,
      ultimosDigitos: ''
    };

    // Si tiene números, extraer los últimos 3-4 dígitos para búsqueda flexible
    if (soloNumeros) {
      // Últimos 4 dígitos (o todos si tiene menos)
      resultado.ultimosDigitos = soloNumeros.slice(-4);

      // Detectar si es un número de venta
      if (this.esNumeroVenta(terminoLimpio)) {
        resultado.tipo = 'numero_venta';
        resultado.valorNormalizado = this.normalizarNumeroVenta(terminoLimpio);
      }
      // Detectar si es un número de historia
      else if (this.esNumeroHistoria(terminoLimpio)) {
        resultado.tipo = 'numero_historia';
        resultado.valorNormalizado = this.normalizarNumeroHistoria(terminoLimpio);
      }
      // Si son solo números, preparar para búsqueda flexible
      else {
        resultado.tipo = 'numeros';
        // Guardar también los primeros dígitos si son significativos
        if (soloNumeros.length >= 6) {
          resultado.primerosDigitos = soloNumeros.substring(0, 4);
        }
      }
    }

    return resultado;
  }

  private realizarBusquedaDinamica(termino: string): void {
    this.ultimoTerminoBuscado = termino;
    const terminoProcesado = this.procesarTerminoBusqueda(termino);
    this.filtros.busquedaGeneral = termino;

    this.filtrosMejorados = {
      texto: termino,
      soloNumeros: terminoProcesado.soloNumeros,
      ultimosDigitos: terminoProcesado.ultimosDigitos,
      tipo: terminoProcesado.tipo,
      valorNormalizado: terminoProcesado.valorNormalizado
    };

    this.paginacion.paginaActual = 1;

    this.buscando = true;

    this.cargarVentasPagina(1, false, true);
  }

  private inicializarFormularioEdicion(): void {
    this.editarVentaForm = this.fb.group({
      montoAbonado: [0, [Validators.required, Validators.min(0)]],
      metodosPago: this.fb.array([]),
      observaciones: ['']
    });
  }

  private setMaxDate(): void {
    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, '0');
    const day = String(hoy.getDate()).padStart(2, '0');
    this.maxDate = `${year}-${month}-${day}`;
  }

  // Getter para el FormArray de métodos de pago
  get metodosPagoArray(): FormArray {
    return this.editarVentaForm.get('metodosPago') as FormArray;
  }

  private cargarDatosIniciales(): void {
    this.loader.showWithMessage('🔄 Cargando historial de ventas...');

    // Inicializar estadísticas
    this.estadisticas = this.crearEstadisticasVacias();

    this.cargarEmpleados();
    this.cargarTasasCambio();
  }

  private cargarTasasCambio(): void {
    this.generarVentaService.getTasas().pipe(take(1)).subscribe({
      next: (tasasResponse) => {
        const tasas = tasasResponse.tasas ?? [];
        this.tasasDisponibles = tasas;
        this.monedasDisponibles = tasas;

        this.tasasPorId = {
          'dolar': tasas.find(t => t.id === 'dolar')?.valor || 36.5,
          'euro': tasas.find(t => t.id === 'euro')?.valor || 39.2,
          'bolivar': 1
        };

        // Cargar estadísticas y primera página en paralelo
        this.cargarEstadisticas();
        this.cargarVentasPagina(1, false);
      },
      error: (error) => {
        console.error('Error al cargar tasas de cambio:', error);
        this.tasasPorId = {
          'dolar': 36.5,
          'euro': 39.2,
          'bolivar': 1
        };

        // Cargar igual aunque falle tasas
        this.cargarEstadisticas();
        this.cargarVentasPagina(1, false);
      }
    });
  }

  /**
  * Carga los empleados desde el API y los separa en asesores y especialistas
  */
  private cargarEmpleados(): void {
    this.empleadosService.getAllEmpleados().subscribe({
      next: (response: any) => {

        let usuarios: any[] = [];

        // Manejar diferentes formatos de respuesta
        if (Array.isArray(response)) {
          // Caso 1: El servicio retorna un array directamente
          usuarios = response;
        }
        else if (response && response.message === 'ok' && Array.isArray(response.usuarios)) {
          // Caso 2: El servicio retorna {message: "ok", usuarios: [...]}
          usuarios = response.usuarios;
        }
        else if (response && Array.isArray(response)) {
          // Caso 3: El servicio retorna un array en otra propiedad
          usuarios = response;
        }
        else {
          console.error('Formato de respuesta inesperado del servicio de empleados:', response);
          return;
        }

        this.procesarEmpleados(usuarios);
      },
      error: (error) => {
        console.error('Error al cargar empleados:', error);
        this.swalService.showWarning('Advertencia', 'No se pudieron cargar los empleados. Se usarán datos de prueba.');
      }
    });
  }

  /**
   * Procesa la lista de empleados y los separa en asesores y especialistas
   */
  private procesarEmpleados(usuarios: any[]): void {
    // Filtrar solo empleados activos (usando estatus en lugar de activo)
    const empleadosActivos = usuarios.filter(usuario =>
      usuario.estatus === true || usuario.activo === true
    );

    //Todos los empleados activos sin importar el cargo
    this.asesores = empleadosActivos.map(usuario => ({
      id: usuario.id,
      nombre: usuario.nombre,
      cedula: usuario.cedula,
      cargo: usuario.cargoNombre || usuario.cargo?.nombre || 'Sin cargo',
      rol: usuario.rolNombre || usuario.rol?.nombre || 'Sin rol',
      estatus: usuario.estatus
    }));

    // ESPECIALISTAS: Solo optometristas y oftalmólogos activos
    const cargosEspecialistas = ['optometrista', 'oftalmologo', 'oftalmólogo'];

    this.especialistas = empleadosActivos
      .filter(usuario => {
        const cargoId = usuario.cargoId?.toLowerCase();
        const cargoNombre = usuario.cargoNombre?.toLowerCase();

        return cargosEspecialistas.includes(cargoId) ||
          cargosEspecialistas.includes(cargoNombre);
      })
      .map(usuario => ({
        id: usuario.id,
        nombre: usuario.nombre,
        cedula: usuario.cedula,
        cargo: usuario.cargoNombre || usuario.cargo?.nombre || 'Sin cargo',
        tipo: this.obtenerTipoEspecialista(usuario),
        estatus: usuario.estatus
      }));

    // Si no hay especialistas, mostrar advertencia
    if (this.especialistas.length === 0) {
      console.warn('No se encontraron especialistas (optometristas/oftalmólogos) activos');
    }
  }

  /**
   * Determina el tipo de especialista basado en el cargo
   */
  private obtenerTipoEspecialista(usuario: any): string {
    const cargoId = usuario.cargoId?.toLowerCase();
    const cargoNombre = usuario.cargoNombre?.toLowerCase();

    if (cargoId === 'optometrista' || cargoNombre === 'optometrista') {
      return 'Optometrista';
    } else if (cargoId === 'oftalmologo' || cargoNombre === 'oftalmólogo' || cargoNombre === 'oftalmologo') {
      return 'Oftalmólogo';
    } else {
      return 'Especialista';
    }
  }

  /**
   * Aplica filtros y paginación (modificado para usar servidor)
   */
  aplicarFiltrosYPaginacion(): void {
    this.paginacion.paginaActual = 1;
    this.cargarVentasPagina(1);
  }

  // Métodos para el datepicker moderno
  toggleDatepicker(): void {
    this.showDatepicker = !this.showDatepicker;
  }

  closeDatepicker(): void {
    this.showDatepicker = false;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: any): void {
    if (this.showDatepicker) {
      this.closeDatepicker();
    }
  }

  getMonedaVenta(): string {
    return this.selectedVenta?.moneda || 'dolar';
  }

  limpiarFechas(): void {
    this.filtros.fechaDesde = '';
    this.filtros.fechaHasta = '';
    this.fechaUnica = '';
    this.presetActivo = '';
    this.aplicarFiltrosYPaginacion();
  }

  onRangoChange(): void {
    this.presetActivo = '';
  }

  getFechaDisplay(): string {
    if (this.fechaUnica) {
      return this.formatFechaLocal(this.fechaUnica);
    } else if (this.filtros.fechaDesde && this.filtros.fechaHasta) {
      if (this.filtros.fechaDesde === this.filtros.fechaHasta) {
        return this.formatFechaLocal(this.filtros.fechaDesde);
      } else {
        return `${this.formatFechaLocal(this.filtros.fechaDesde)} - ${this.formatFechaLocal(this.filtros.fechaHasta)}`;
      }
    } else {
      return 'Seleccionar fecha';
    }
  }

  private formatFechaLocal(fechaString: string): string {
    if (!fechaString) return '';

    const [year, month, day] = fechaString.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  cargarVentas(): void {
    this.loader.showWithMessage('📋 Cargando historial de ventas...');

    this.historialVentaService.obtenerHistorialVentas().subscribe({
      next: (response: any) => {
        if (response.message === 'ok' && response.ventas) {
          // Procesar TODAS las ventas
          const todasLasVentas = response.ventas.map((ventaApi: any) =>
            this.adaptarVentaDelApi(ventaApi)
          );

          // Guardar todas las ventas
          this.ventasFiltradas = todasLasVentas;

          // Aplicar filtros y paginación
          this.aplicarFiltrosYPaginacion();

          setTimeout(() => {
            this.loader.hide();
          }, 500);

        } else {
          console.error('Respuesta inesperada del API de ventas:', response);
          this.loader.hide();
        }
      },
      error: (error) => {
        console.error('ERROR al cargar ventas:', error);
        this.loader.hide();
      }
    });
  }

  private adaptarVentaDelApi(ventaApi: any): any {
    const venta = ventaApi.venta;
    const totales = ventaApi.totales;
    const cliente = ventaApi.cliente;
    const asesor = ventaApi.asesor;
    const especialista = ventaApi.cliente.especialista;
    const productos = ventaApi.productos;
    const metodosPagoApi = ventaApi.metodosPago;
    const formaPago = ventaApi.formaPago;

    // Determinar el estado para filtros
    const estadoVenta = this.determinarEstadoVenta(venta.estatus_venta);

    // Calcular el total pagado en la moneda de la venta, necesitamos sumar todos los montoAbonado de cada grupo
    const totalPagadoEnMonedaVenta = metodosPagoApi.reduce((total: number, grupo: any) => {
      return total + (grupo.montoAbonado || 0);
    }, 0);

    // Determinar si es Cashea
    const esCashea = formaPago?.tipo === 'cashea';

    // Preparar métodos de pago manteniendo la estructura de grupos
    const metodosPagoAdaptados = metodosPagoApi.map((grupo: any) => {

      return {
        numero_pago: grupo.numero_pago || 1,
        montoAbonado: grupo.montoAbonado || 0,
        observaciones: grupo.observaciones,
        metodosPago: (grupo.metodosPago || []).map((metodo: any) => {

          return {
            tipo: metodo.tipo || 'efectivo',
            monto: metodo.monto || 0,
            moneda_id: metodo.moneda_id || 'dolar',
            monto_en_moneda_de_venta: metodo.monto_moneda_base || metodo.monto || 0,
            referencia: metodo.referencia,
            bancoCodigo: metodo.bancoCodigo,
            bancoNombre: metodo.bancoNombre,
            fechaRegistro: metodo.fechaRegistro,
            tasa_moneda: metodo.tasa_moneda
          };
        })
      };
    });

    // Preparar productos limpios
    const productosLimpios = productos.map((prod: any) => {
      // Calcular el subtotal correcto (precio unitario * cantidad)
      const subtotal = (prod.precio_unitario || 0) * (prod.cantidad || 1);

      // Calcular el total que viene del API
      const totalProducto = prod.total || 0;

      // Calcular el IVA correctamente (total - subtotal)
      const tieneIva = totalProducto > subtotal;
      const iva = tieneIva ? totalProducto - subtotal : 0;

      return {
        id: prod.datos.id.toString(),
        nombre: prod.datos.nombre,
        codigo: prod.datos.codigo,
        precio: prod.precio_unitario,
        cantidad: prod.cantidad,
        aplicaIva: tieneIva,
        iva: iva,
        subtotal: subtotal,
        total: totalProducto
      };
    });

    // Construir objeto final
    const ventaAdaptada: any = {
      // Identificadores únicos
      key: venta.key,
      numeroControl: venta.numero_venta,
      numeroRecibo: venta.numero_recibo,

      // Información temporal
      fecha: new Date(venta.fecha),

      // Estados
      estado: estadoVenta,
      estadoPago: this.mapearEstadoPago(venta.estatus_pago),
      estadoParaFiltros: this.mapearEstadoParaFiltros(venta.estatus_venta),

      // Totales financieros
      montoTotal: totales.total,
      subtotal: totales.subtotal,
      totalIva: totales.iva || 0,
      totalDescuento: totales.descuento || 0,
      total: totales.total,

      // Información de pago
      pagoCompleto: totalPagadoEnMonedaVenta >= totales.total,
      montoAbonado: totalPagadoEnMonedaVenta, // Usar la suma calculada
      deudaPendiente: formaPago?.deudaPendiente || Math.max(0, totales.total - totalPagadoEnMonedaVenta),

      // Configuración de la venta
      moneda: venta.moneda,
      formaPago: venta.formaPago,
      formaPagoCompleto: formaPago,
      descuento: totales.descuento || 0,
      observaciones: venta.observaciones,

      // Personas involucradas
      paciente: {
        nombre: cliente.informacion.nombreCompleto,
        cedula: cliente.informacion.cedula,
        telefono: cliente.informacion.telefono,
        email: cliente.informacion.email
      },
      asesor: {
        id: asesor.id,
        nombre: asesor.nombre,
        cedula: asesor.cedula
      },
      especialista: {
        id: especialista.id,
        nombre: especialista.nombre,
        cedula: especialista.cedula
      },

      // Contenido de la venta
      productos: productosLimpios,
      productosOriginales: ventaApi.productos,
      servicios: [],
      metodosPago: metodosPagoAdaptados, // ← Aquí usamos la estructura adaptada

      // Configuración local
      mostrarDetalle: false,
      sede: 'guatire',

      // Información de cancelación
      motivo_cancelacion: venta.motivo_cancelacion,
      fecha_cancelacion: venta.fecha_cancelacion ? new Date(venta.fecha_cancelacion) : null,

      // Historia médica
      historiaMedica: ventaApi.ultima_historia_medica || null,

      // Información del impuesto
      impuesto: venta.impuesto || 16
    };

    // Solo agregar información específica de Cashea si aplica
    if (esCashea && formaPago) {
      ventaAdaptada.financiado = true;
      ventaAdaptada.nivelCashea = formaPago.nivel;
      ventaAdaptada.montoInicial = formaPago.montoInicial;
      ventaAdaptada.cantidadCuotas = formaPago.cantidadCuotas;
      ventaAdaptada.montoPorCuota = formaPago.montoPorCuota;

      // Solo agregar cuotas adelantadas si existen
      if (formaPago.cuotas?.length > 0) {
        const cuotasSeleccionadas = formaPago.cuotas.filter((c: any) => c.seleccionada);
        if (cuotasSeleccionadas.length > 0) {
          ventaAdaptada.cuotasAdelantadas = cuotasSeleccionadas.map((c: any) => ({
            numero: c.numero,
            monto: c.monto,
            fechaVencimiento: c.fecha_vencimiento
          }));
          ventaAdaptada.totalAdelantado = formaPago.montoAdelantado || 0;
        }
      }
    } else {
      ventaAdaptada.financiado = false;
    }

    return ventaAdaptada;
  }

  private normalizarFormaPago(formaPagoApi: string): string {
    const mapeo: { [key: string]: string } = {
      'contado': 'contado',
      'de_contado': 'contado',
      'contado-pendiente': 'contado-pendiente',
      'de_contado-pendiente': 'contado-pendiente',
      'abono': 'abono',
      'cashea': 'cashea',
      'credito': 'credito'
    };

    const clave = formaPagoApi?.toLowerCase() || '';
    return mapeo[clave] || formaPagoApi;
  }

  private determinarEstadoVenta(estatusVenta: string): string {
    // Si está cancelada o anulada en el API, mantener cancelada
    if (estatusVenta === 'cancelada' || estatusVenta === 'cancelado' || estatusVenta === 'anulada') {
      return 'cancelada';
    }

    return 'completada';
  }

  /**
   * Mapea el estado de pago del API al formato del componente
   */
  private mapearEstadoPago(estatusPago: string): string {
    const mapeo: { [key: string]: string } = {
      'completada': 'completado',
      'pagado_por_cashea': 'parcial',
      'pendiente': 'parcial',
      'cancelado': 'cancelado'
    };

    return mapeo[estatusPago] || estatusPago;
  }

  private mapearEstadoParaFiltros(estatusPago: string): string {
    const mapeo: { [key: string]: string } = {
      'completada': 'completada',
      'pagado_por_cashea': 'pendiente',
      'pendiente': 'pendiente',
      'cancelado': 'cancelada',
      'cancelada': 'cancelada',
      'anulada': 'cancelada'
    };

    return mapeo[estatusPago] || estatusPago;
  }


  // Método para obtener el texto de la página
  getPaginaTexto(pagina: number): string {
    return pagina === -1 ? '...' : pagina.toString();
  }

  // Método para verificar si es puntos suspensivos
  esPuntosSuspensivos(pagina: number): boolean {
    return pagina === -1;
  }

  cambiarOrden() {
    this.ordenamiento.ascendente = !this.ordenamiento.ascendente;

    // Ordenar las ventas que ya están cargadas (ventasFiltradas)
    this.ventasFiltradas.sort((a, b) => {
      const factor = this.ordenamiento.ascendente ? 1 : -1;

      switch (this.ordenamiento.campo) {
        case 'fecha':
          return (new Date(a.fecha).getTime() - new Date(b.fecha).getTime()) * factor;
        case 'numeroControl':
          return (a.numeroControl.localeCompare(b.numeroControl)) * factor;
        case 'montoTotal':
          return (a.montoTotal - b.montoTotal) * factor;
        case 'paciente':
          return a.paciente.nombre.localeCompare(b.paciente.nombre) * factor;
        default:
          return 0;
      }
    });
  }

  toggleDetalleVenta(ventaKey: string) {
    const venta = this.ventasFiltradas.find(v => v.key === ventaKey);
    if (venta) {
      venta.mostrarDetalle = !venta.mostrarDetalle;
    }
  }

  generarInforme() {
    //console.log('Generar informe con filtros:', this.filtros);
  }

  // Método auxiliar para formatear el nombre (opcional)
  getNombreFormateado(nombreCompleto: string): string {
    if (!nombreCompleto) return '';

    const partes = nombreCompleto.split(' ');

    if (partes.length >= 2) {
      const primerNombre = partes[0];
      const ultimoApellido = partes[partes.length - 1];
      return `${primerNombre} ${ultimoApellido}`;
    }

    return nombreCompleto;
  }

  cancelarVenta(venta: any) {
    this.selectedVenta = venta;
    this.motivoCancelacion = '';

    this.modalService.open(this.cancelarVentaModal, {
      centered: true,
      backdrop: 'static',
      keyboard: false
    });
  }

  confirmarCancelacion(modal: any) {
    if (!this.motivoCancelacion?.trim()) {
      this.swalService.showWarning('Advertencia', 'Por favor ingrese el motivo de la cancelación.');
      return;
    }

    modal.close();

    this.swalService.showConfirm(
      'Confirmar Acción',
      `¿Está completamente seguro de cancelar la venta #${this.selectedVenta.numeroControl}? Esta acción no se puede deshacer.`,
      'Sí, Cancelar Venta',
      'Revisar'
    ).then((result) => {
      if (result.isConfirmed) {
        this.procesarCancelacion();
      } else {
        this.cancelarVenta(this.selectedVenta);
      }
    });
  }

  private recargarListaVentas(): void {
    this.loader.showWithMessage('🔄 Actualizando historial de ventas...');

    // Usa el método correcto del servicio
    this.historialVentaService.obtenerVentasPaginadas(
      this.paginacion.paginaActual,
      this.paginacion.itemsPorPagina,
      this.filtros
    ).subscribe({
      next: (response: any) => {
        if (response.message === 'ok' && response.ventas) {
          const ventasPagina = response.ventas.map((ventaApi: any) =>
            this.adaptarVentaDelApi(ventaApi)
          );

          this.ventasFiltradas = ventasPagina;
          this.paginacion.totalItems = response.pagination?.total || 0;
          this.paginacion.totalPaginas = response.pagination?.pages || 1;
          this.generarRangoPaginas();

          // También recargar estadísticas después de actualizar ventas
          this.cargarEstadisticas();
        }

        setTimeout(() => {
          this.loader.hide();
        }, 500);
      },
      error: (error) => {
        console.error('Error al recargar ventas:', error);
        this.loader.hide();
      }
    });
  }

  private procesarCancelacion(): void {
    if (!this.selectedVenta?.key) {
      this.swalService.showError('Error', 'No se puede cancelar la venta: falta información.');
      return;
    }

    let motivo_cancelacion = this.motivoCancelacion;

    this.historialVentaService.anularVenta(
      this.selectedVenta.key,
      motivo_cancelacion
    ).subscribe({
      next: (response: any) => {
        if (response.success || response.message === 'ok') {
          // Recargar la lista completa
          this.recargarListaVentas();

          this.limpiarSeleccionCancelacion();

        } else {
          console.log('error', response.message);
          this.swalService.showError('Error', response.message || 'No se pudo cancelar la venta.');
        }

        this.limpiarSeleccionCancelacion();
      },
      error: (error) => {
        console.error('Error en la solicitud de cancelación:', error);

        let mensajeError = 'No se pudo completar la solicitud. Verifique su conexión.';
        if (error.error?.message) {
          mensajeError = error.error.message;
        }

        this.swalService.showError('Error', mensajeError);
        this.limpiarSeleccionCancelacion();
      }
    });
  }

  validarMontoAbono(): void {
    const montoAbonado = this.editarVentaForm?.get('montoAbonado')?.value;
    const deudaPendiente = this.calcularMontoDeuda();

    // Si el valor es null, undefined o vacío, no hacer validación
    if (montoAbonado === null || montoAbonado === undefined || montoAbonado === '') {
      return;
    }

    if (montoAbonado > deudaPendiente) {
      this.swalService.showWarning(
        'Monto excedido',
        `El monto a abonar (${this.formatearMoneda(montoAbonado, this.getMonedaVenta())}) excede la deuda pendiente (${this.formatearMoneda(deudaPendiente, this.getMonedaVenta())}). Se establecerá el monto máximo permitido.`
      );

      // Establecer el monto máximo como valor por defecto
      this.editarVentaForm.patchValue({
        montoAbonado: deudaPendiente
      });
    }
  }

  /**
   * Limpia la selección de cancelación
   */
  private limpiarSeleccionCancelacion(): void {
    this.selectedVenta = null;
    this.motivoCancelacion = '';
  }

  /*verDetalleCompleto(venta: any) {
    console.log('Ver detalle completo:', venta);

    this.selectedVenta = venta;

    this.modalService.open(this.detalleVentaModal, {
      centered: true,
      size: 'lg',
      backdrop: true,
      keyboard: true
    });
  }*/
  verDetalleCompleto(venta: any) {
    if (venta.metodosPago?.length) {
    }

    this.selectedVenta = venta;

    this.modalService.open(this.detalleVentaModal, {
      centered: true,
      size: 'lg',
      backdrop: true,
      keyboard: true
    });
  }

  formatNumeroVenta(id: number): string {
    if (!id) return '#000';
    return `#${id.toString().padStart(3, '0')}`;
  }

  // Método para obtener el total pagado de una venta
  getTotalPagadoVenta(venta: any): number {
    if (!venta) return 0;

    //Usar totalPagado del objeto formaPago (si existe y es válido)
    if (venta?.formaPago?.totalPagadoAhora !== undefined &&
      venta?.formaPago?.totalPagadoAhora !== null) {
      return venta.formaPago.totalPagadoAhora;
    }

    //Usar montoAbonado directamente
    if (venta?.montoAbonado !== undefined && venta?.montoAbonado !== null) {
      return venta.montoAbonado;
    }

    //Calcular sumando métodos de pago (fallback)
    if (venta?.metodosPago && venta.metodosPago.length > 0) {
      let totalCalculado = 0;

      // Sumar montos en la moneda de la venta
      venta.metodosPago.forEach((pago: any) => {
        const montoPagado = pago.monto_en_moneda_de_venta || 0;
        totalCalculado += montoPagado;
      });

      return totalCalculado;
    }

    // Si no hay nada, devolver 0
    return 0;
  }

  mostrarBotonEditar(venta: any): boolean {
    if (!venta || venta.estado === 'cancelada') {
      return false;
    }

    const esAbonoConDeuda = venta.formaPago === 'abono' &&
      venta.montoAbonado < venta.total;

    return esAbonoConDeuda;
  }

  editarVenta(venta: any): void {
    this.selectedVenta = venta;

    this.reinicializarFormularioConDeuda();

    this.modalService.open(this.editarVentaModal, {
      centered: true,
      size: 'lg',
      backdrop: 'static'
    });
  }

  removerMetodoPago(index: number): void {
    this.metodosPagoArray.removeAt(index);

    setTimeout(() => {
      this.metodosPagoArray.controls.forEach((control, i) => {
        this.validarMontoMetodoPago(i);
      });
    });
  }

  calcularTotalMetodosPago(): number {
    return this.metodosPagoArray.controls.reduce((total, control) => {
      return total + (control.get('monto')?.value || 0);
    }, 0);
  }

  mostrarResumenCambio(): boolean {
    const montoAbonado = this.editarVentaForm.get('montoAbonado')?.value;
    return montoAbonado !== null && montoAbonado !== undefined && montoAbonado !== this.selectedVenta?.montoAbonado;
  }

  private prepararMetodosPagoParaAPI(): any[] {
    const metodosPagoParaAPI = [];

    this.metodosPagoArray.controls.forEach((control, index) => {
      const metodo = control.value;
      const monedaMetodo = this.getMonedaParaMetodo(index);

      const bancoObject = metodo.bancoObject;
      let bancoCodigo = '';
      let bancoNombre = '';

      // Si bancoObject es un objeto, extraer código y nombre
      if (bancoObject && typeof bancoObject === 'object') {
        bancoCodigo = bancoObject.codigo || '';
        bancoNombre = bancoObject.nombre || '';
      } else {
        // Si ya vienen como strings separados
        bancoCodigo = metodo.bancoCodigo || '';
        bancoNombre = metodo.bancoNombre || '';
      }

      if (this.necesitaReferencia(metodo.tipo) && (!metodo.referencia || metodo.referencia.trim() === '')) {
        throw new Error(`El método ${metodo.tipo} requiere un número de referencia`);
      }

      if (this.necesitaBanco(metodo.tipo) && (!bancoCodigo || !bancoNombre)) {
        throw new Error(`El método ${metodo.tipo} requiere seleccionar un banco`);
      }

      // Convertir moneda al formato exacto que espera el backend
      const monedaFormatoBackend = this.convertirMonedaParaBackend(monedaMetodo);

      // Calcular monto en moneda de venta para referencia
      const montoEnMonedaVenta = this.convertirMonto(
        Number(metodo.monto) || 0,
        monedaFormatoBackend,
        this.getMonedaVenta()
      );

      const metodoFormateado = {
        tipo: metodo.tipo || 'efectivo',
        monto: Number(metodo.monto) || 0,
        moneda: monedaFormatoBackend,
        referencia: metodo.referencia?.trim() || null,
        bancoCodigo: bancoCodigo?.trim() || null,
        bancoNombre: bancoNombre?.trim() || null,

        // Campos adicionales
        montoEnMonedaVenta: montoEnMonedaVenta,
        tasaConversion: this.obtenerTasaConversion(monedaFormatoBackend, this.getMonedaVenta()),
        monedaOriginal: monedaFormatoBackend,
        monedaVenta: this.getMonedaVenta()
      };

      metodosPagoParaAPI.push(metodoFormateado);
    });

    return metodosPagoParaAPI;
  }

  private convertirMonedaParaBackend(monedaId: string): string {
    const mapeo: { [key: string]: string } = {
      'dolar': 'dolar',
      'usd': 'dolar',
      'euro': 'euro',
      'eur': 'euro',
      'bolivar': 'bolivar',
      'ves': 'bolivar',
      'bs': 'bolivar'
    };

    const clave = monedaId?.toLowerCase() || 'dolar';
    return mapeo[clave] || 'dolar';
  }

  private actualizarVentaDespuesAbono(ventaActualizadaAPI: any): void {
    if (!ventaActualizadaAPI || !this.selectedVenta) return;

    // Obtener los nuevos métodos de pago del backend
    const nuevosMetodosPago = ventaActualizadaAPI.metodosPago || [];

    // Calcular nuevo monto abonado (suma de todos los métodos en moneda de venta)
    const nuevoMontoAbonado = nuevosMetodosPago.reduce((total: number, metodo: any) => {
      return total + (metodo.monto_en_moneda_de_venta || metodo.monto || 0);
    }, 0);

    // Actualizar la venta seleccionada
    this.selectedVenta = {
      ...this.selectedVenta,
      montoAbonado: nuevoMontoAbonado,
      metodosPago: [...(this.selectedVenta.metodosPago || []), ...nuevosMetodosPago],
      observaciones: this.editarVentaForm?.get('observaciones')?.value || this.selectedVenta.observaciones,
      deudaPendiente: ventaActualizadaAPI.formaPago?.deudaPendiente ||
        Math.max(0, this.selectedVenta.total - nuevoMontoAbonado)
    };

    // Actualizar en la lista de ventas filtradas
    const index = this.ventasFiltradas.findIndex(v => v.key === this.selectedVenta.key);
    if (index !== -1) {
      this.ventasFiltradas[index] = {
        ...this.ventasFiltradas[index],
        montoAbonado: this.selectedVenta.montoAbonado,
        metodosPago: this.selectedVenta.metodosPago,
        observaciones: this.selectedVenta.observaciones,
        deudaPendiente: this.selectedVenta.deudaPendiente
      };
    }
  }

  private limpiarMetodosVacios(): void {
    // Encontrar métodos completamente vacíos (sin tipo, monto, referencia ni banco)
    const indicesAEliminar: number[] = [];

    this.metodosPagoArray.controls.forEach((control, index) => {
      const tipo = control.get('tipo')?.value;
      const monto = control.get('monto')?.value;
      const referencia = control.get('referencia')?.value;
      const banco = control.get('bancoObject')?.value;

      // Si no tiene ningún dato, está vacío
      // PERO: no eliminar si es el único método disponible
      const estaVacio = !tipo && (!monto || monto === 0) && !referencia && !banco;

      if (estaVacio && this.metodosPagoArray.length > 1) {
        indicesAEliminar.push(index);
      }
    });

    // Eliminar de atrás hacia adelante para mantener los índices correctos
    indicesAEliminar.reverse().forEach(index => {
      this.metodosPagoArray.removeAt(index);
    });
  }

  guardarEdicionVenta(modal: any): void {

    // Verificar que haya al menos un método válido
    const metodosValidos = this.metodosPagoArray.controls.filter(control =>
      this.metodoTieneDatos(control)
    );

    if (metodosValidos.length === 0) {
      this.swalService.showWarning('Advertencia', 'Debe agregar al menos un método de pago válido.');
      return;
    }

    // Ahora validar
    if (!this.validarAntesDeGuardar()) {
      return;
    }
    // Continuar con el proceso normal...
    const formValue = this.editarVentaForm.value;
    const metodosPago = this.prepararMetodosPagoParaAPI();

    // Validar métodos antes de enviar
    if (!this.validarMetodosPagoAntesDeEnviar(metodosPago)) {
      return;
    }

    // Mostrar confirmación detallada
    const montoAbonadoAnterior = this.selectedVenta.montoAbonado || 0;
    const nuevoAbono = formValue.montoAbonado;
    const totalAbonado = montoAbonadoAnterior + nuevoAbono;

    const totalVenta = this.selectedVenta.total || 0;
    const nuevaDeudaPendiente = Math.max(0, totalVenta - totalAbonado);

    let mensajeConfirmacion = `
    <strong>📋 Confirmar abono de ${this.formatearMoneda(nuevoAbono)}</strong><br><br>
    
    <strong>Resumen de la venta:</strong><br>
    • Total venta: ${this.formatearMoneda(totalVenta)}<br>
    • Total abonado: ${this.formatearMoneda(totalAbonado)}<br>
    • Nueva deuda: ${this.formatearMoneda(nuevaDeudaPendiente)}<br><br>
    `;

    this.swalService.showConfirm(
      'Confirmar Abono Completo',
      mensajeConfirmacion,
      '✅ Sí, Registrar Abono',
      '❌ Cancelar'
    ).then((result) => {
      if (result.isConfirmed) {
        this.procesarAbono(modal, formValue);
      }
    });
  }

  private procesarAbono(modal: any, formData: any): void {
    if (!this.selectedVenta?.key) {
      this.swalService.showWarning('Error', 'No se puede registrar el abono: falta información de la venta.');
      return;
    }

    // Obtener TODOS los métodos de pago preparados
    const metodosPago = this.prepararMetodosPagoParaAPI();

    if (metodosPago.length === 0) {
      this.swalService.showWarning('Error', 'Debe agregar al menos un método de pago.');
      return;
    }

    // Calcular el total abonado en moneda de venta para verificación
    const totalMetodosEnMonedaVenta = this.calcularTotalMetodosPagoEnMonedaVenta();
    const montoAbonado = this.editarVentaForm?.get('montoAbonado')?.value || 0;

    // Verificar que la suma coincida
    if (Math.abs(totalMetodosEnMonedaVenta - montoAbonado) > 0.01) {
      this.swalService.showWarning(
        'Advertencia',
        `La suma de los métodos de pago no coincide con el monto abonado. ` +
        `Monto abonado: ${this.formatearMoneda(montoAbonado)}, ` +
        `Suma métodos: ${this.formatearMoneda(totalMetodosEnMonedaVenta)}. ` +
        `Por favor, ajuste los montos.`
      );
      return;
    }

    // Preparar el request según lo que espera el backend
    const requestData = this.prepararRequestParaBackend(metodosPago, montoAbonado);

    this.enviarAbonoCompleto(modal, requestData);
  }

  // Método para verificar si un método tiene datos completos
  metodoTieneDatos(control: AbstractControl): boolean {
    const tipo = control.get('tipo')?.value;
    const monto = control.get('monto')?.value;
    const referencia = control.get('referencia')?.value;
    const banco = control.get('bancoObject')?.value;

    // Si tiene algún valor, se considera que tiene datos
    return !!(tipo || monto || referencia || banco);
  }

  private prepararRequestParaBackend(metodosPago: any[], montoAbonado: number): any {
    // Estructura base del request
    const request: any = {
      // Información del abono
      montoAbonado: montoAbonado,

      // Lista completa de métodos de pago
      metodosPago: metodosPago.map(metodo => ({
        tipo: metodo.tipo || 'efectivo',
        monto: Number(metodo.monto) || 0,
        moneda: metodo.moneda || 'dolar',
        referencia: metodo.referencia || null,
        bancoCodigo: metodo.bancoCodigo || null,
        bancoNombre: metodo.bancoNombre || null,

        // Información adicional para el backend (opcional)
        montoEnMonedaVenta: this.convertirMonto(
          metodo.monto,
          metodo.moneda,
          this.getMonedaVenta()
        )
      })),

      // Información adicional
      observaciones: this.editarVentaForm?.get('observaciones')?.value || ''
    };

    return request;
  }

  private enviarAbonoCompleto(modal: any, requestData: any): void {
    this.loader.showWithMessage('💳 Procesando abono con múltiples métodos...');

    this.historialVentaService.realizarAbono(this.selectedVenta.key, requestData)
      .subscribe({
        next: (response: any) => {
          this.loader.hide();

          this.manejarRespuestaAbono(response, modal);
        },
        error: (error) => {
          this.loader.hide();
          this.manejarErrorAbono(error);
        }
      });
  }

  private manejarErrorAbono(error: any): void {
    console.error('❌ Error al registrar abono:', error);

    let mensajeError = 'No se pudo registrar el abono. Verifique su conexión.';
    let detallesError = '';

    if (error.error) {
      // Error del backend
      if (error.error.message) {
        mensajeError = error.error.message;
      }

      if (error.error.errors) {
        // Si hay errores de validación específicos
        detallesError = Object.entries(error.error.errors)
          .map(([campo, mensajes]: [string, any]) =>
            `<strong>${campo}:</strong> ${mensajes.join(', ')}`
          )
          .join('<br>');
      }
    } else if (error.message) {
      // Error de red u otro
      mensajeError = error.message;
    }

    // Mostrar error con detalles si existen
    if (detallesError) {
      this.swalService.showError(
        '❌ Error al procesar abono',
        `${mensajeError}<br><br><strong>Detalles:</strong><br>${detallesError}`
      );
    } else {
      this.swalService.showError('❌ Error', mensajeError);
    }

    // Opcional: Log detallado para debug
    console.error('Detalles del error:', {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      headers: error.headers,
      error: error.error
    });
  }

  private manejarRespuestaAbono(response: any, modal: any): void {
    if (response.success || response.message === 'ok') {
      // Mostrar resumen del abono procesado
      this.mostrarResumenAbonoProcesado(response);

      this.swalService.showSuccess(
        '✅ Abono registrado',
        'El abono se ha registrado correctamente.'
      );

      // Actualizar la venta localmente con los datos del backend
      this.actualizarVentaDespuesAbono(response.ventaActualizada || response.data);

      // Cerrar el modal
      modal.close();

      // Recargar la lista de ventas
      setTimeout(() => {
        this.recargarListaVentas();
      }, 500);

    } else {
      const mensajeError = response.message || response.error || 'No se pudo registrar el abono.';
      this.swalService.showError('❌ Error', mensajeError);
    }
  }

  private mostrarResumenAbonoProcesado(response: any): void {
    if (!response.venta) return;

    const venta = response.venta;
    const metodosRegistrados = venta.metodosPago || [];

    let resumen = '<strong>✅ Abono procesado correctamente</strong><br><br>';
    resumen += `<strong>Venta:</strong> ${venta.venta?.numero_venta || 'N/A'}<br>`;
    resumen += `<strong>Total venta:</strong> ${this.formatearMoneda(venta.totales?.total)}<br>`;
    resumen += `<strong>Total abonado anterior:</strong> ${this.formatearMoneda(this.selectedVenta?.montoAbonado || 0)}<br>`;
    resumen += `<strong>Nuevo abono:</strong> ${this.formatearMoneda(this.editarVentaForm?.get('montoAbonado')?.value || 0)}<br>`;
    resumen += `<strong>Total abonado ahora:</strong> ${this.formatearMoneda(venta.totales?.totalPagado || 0)}<br>`;
    resumen += `<strong>Deuda pendiente:</strong> ${this.formatearMoneda(venta.formaPago?.deudaPendiente || 0)}<br><br>`;

    resumen += '<strong>📋 Métodos de pago registrados:</strong><br>';

    metodosRegistrados.forEach((metodo: any, index: number) => {
      resumen += `${index + 1}. ${metodo.tipo}: `;
      resumen += `${metodo.monto} ${metodo.moneda_id}`;

      if (metodo.monto_en_moneda_de_venta && metodo.moneda_id !== this.getMonedaVenta()) {
        resumen += ` (≈ ${this.formatearMoneda(metodo.monto_en_moneda_de_venta)})`;
      }

      resumen += '<br>';
    });
  }

  private marcarControlesComoSucios(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      if (control instanceof FormGroup) {
        this.marcarControlesComoSucios(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach((arrayControl: AbstractControl) => {
          if (arrayControl instanceof FormGroup) {
            this.marcarControlesComoSucios(arrayControl);
          } else {
            arrayControl.markAsTouched();
          }
        });
      } else {
        control?.markAsTouched();
      }
    });
  }

  getMontoMaximo(): number {
    return this.calcularMontoDeuda();
  }

  onMontoAbonadoChange() {
    // Validar el monto ingresado
    this.validarMontoAbono();

    // Ajustar montos de métodos de pago si hay un valor válido
    const montoAbonado = this.editarVentaForm?.get('montoAbonado')?.value;
    if (montoAbonado !== null && montoAbonado !== undefined && montoAbonado !== '') {
      setTimeout(() => {
        this.ajustarMontosMetodosPago();
      });
    }
  }

  getConversionDisplay(): string {
    const montoAbonado = this.editarVentaForm?.get('montoAbonado')?.value;

    // Si no hay valor, mostrar el mensaje por defecto
    if (montoAbonado === null || montoAbonado === undefined || montoAbonado === '') {
      return '';
    }

    const monedaVenta = this.getMonedaVenta();
    const simbolo = this.getSimboloMonedaVenta();

    let display = `${simbolo} ${montoAbonado?.toFixed(2)}`;

    // Agregar conversión a bolívares si aplica
    if (monedaVenta !== 'bolivar') {
      const conversionBs = this.getConversionBs(montoAbonado);
      display += ` ⇄ ${conversionBs.toFixed(2)} Bs`;
    }

    // Agregar información de máximo permitido
    const maxPermitido = this.getMontoMaximoPermitido();
    display += ` (Máx: ${simbolo} ${maxPermitido.toFixed(2)})`;

    return display;
  }

  seleccionarMonedaEfectivo(index: number, moneda: string): void {
    const metodoControl = this.metodosPagoArray.at(index);

    // Validar que el método sea efectivo
    if (metodoControl.get('tipo')?.value !== 'efectivo') {
      return;
    }

    // Determinar el código de moneda
    let monedaCodigo = 'USD';
    switch (moneda.toLowerCase()) {
      case 'usd':
      case 'dolar':
        monedaCodigo = 'USD';
        break;
      case 'eur':
      case 'euro':
        monedaCodigo = 'EUR';
        break;
      case 'bs':
      case 'bolivar':
        monedaCodigo = 'Bs';
        break;
    }

    //Actualizar la moneda específica de este método
    metodoControl.patchValue({
      monedaEfectivo: monedaCodigo
    });

    // Forzar recálculo de montos y validaciones
    setTimeout(() => {
      this.validarMontoMetodoPago(index);
      this.ajustarMontosMetodosPago();
    });
  }

  // Reemplaza este método:
  getMonedaParaMetodo(index: number): string {
    const metodoControl = this.metodosPagoArray.at(index);
    const tipoPago = metodoControl?.get('tipo')?.value;

    switch (tipoPago) {
      case 'efectivo':
        // ✅ NUEVO: Usar la moneda específica de este método
        const monedaEfectivoMetodo = metodoControl?.get('monedaEfectivo')?.value || 'USD';
        return monedaEfectivoMetodo.toLowerCase() === 'bs' ? 'bolivar' :
          monedaEfectivoMetodo.toLowerCase() === 'eur' ? 'euro' : 'dolar';
      case 'pagomovil':
      case 'transferencia':
      case 'debito':
      case 'credito':
        return 'bolivar';
      case 'zelle':
        return 'dolar';
      default:
        return this.getMonedaVenta();
    }
  }

  // Modifica este método:
  getSimboloMonedaMetodo(index: number): string {
    const metodoControl = this.metodosPagoArray.at(index);
    const tipoPago = metodoControl?.get('tipo')?.value;

    switch (tipoPago) {
      case 'efectivo':
        // ✅ NUEVO: Usar símbolo de la moneda específica
        const monedaEfectivoMetodo = metodoControl?.get('monedaEfectivo')?.value || 'USD';
        switch (monedaEfectivoMetodo) {
          case 'USD': return '$';
          case 'EUR': return '€';
          case 'Bs': return 'Bs. ';
          default: return '$';
        }
      case 'pagomovil':
      case 'transferencia':
      case 'debito':
      case 'credito':
        return 'Bs. ';
      case 'zelle':
        return '$';
      default:
        return this.simboloMonedaSistema;
    }
  }

  // Método mejorado para obtener símbolo de moneda de efectivo
  getSimboloMonedaEfectivo(): string {
    switch (this.monedaEfectivo) {
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'Bs': return 'Bs. ';
      default: return '$';
    }
  }

  /**
   * Calcular porcentaje abonado para el modal de edición
   */
  calcularPorcentajeAbonadoEnModal(): number {
    if (!this.selectedVenta || !this.selectedVenta.total) return 0;

    const montoAbonadoAnterior = this.selectedVenta.montoAbonado || 0;
    const nuevoMontoAbonado = this.editarVentaForm?.get('montoAbonado')?.value || 0;

    const totalAbonado = montoAbonadoAnterior + nuevoMontoAbonado;

    let porcentaje = (totalAbonado / this.selectedVenta.total) * 100;
    porcentaje = Math.min(porcentaje, 100);

    return Math.round(porcentaje);
  }


  ajustarMontosMetodosPago(): void {
    this.metodosPagoArray.controls.forEach((control, index) => {
      this.validarMontoMetodoPago(index);
    });
  }

  abrirModalEdicion(venta: any) {
    this.selectedVenta = venta;
    this.reinicializarFormularioConDeuda();
  }

  inicializarFormulario() {
    const montoDeuda = this.calcularMontoDeuda();

    this.editarVentaForm = this.fb.group({
      montoAbonado: [montoDeuda, [
        Validators.required,
        Validators.min(0),
        Validators.max(this.selectedVenta?.total || 0)
      ]],
      metodosPago: this.fb.array([]),
      observaciones: ['']
    });

    this.agregarMetodoPago();

    this.editarVentaForm.get('montoAbonado')?.valueChanges.subscribe(value => {
      this.validarMontoMaximo(value);
    });

    this.metodosPagoArray.valueChanges.subscribe(() => {
    });
  }

  agregarMetodoPago(): void {
    //LIMITAR A MÁXIMO 5 MÉTODOS DE PAGO
    if (this.metodosPagoArray.length > 5) {
      this.swalService.showWarning(
        'Límite alcanzado',
        'No puedes agregar más de 5 métodos de pago.'
      );
      return;
    }

    const metodoGroup = this.fb.group({
      tipo: [''],
      monto: [null],
      monedaEfectivo: ['USD'],
      bancoCodigo: [''],
      bancoNombre: [''],
      referencia: [''],
      bancoObject: [null]
    });

    this.metodosPagoArray.push(metodoGroup);

    const index = this.metodosPagoArray.length - 1;

    // Suscribirse a cambios del tipo para agregar validadores dinámicamente
    metodoGroup.get('tipo')?.valueChanges.subscribe(tipo => {
      this.onMetodoPagoChange(index);

      if (tipo) {
        // Solo cuando se selecciona un tipo, agregar validadores
        metodoGroup.get('tipo')?.setValidators([Validators.required]);
        metodoGroup.get('monto')?.setValidators([Validators.required, Validators.min(0.01)]);

        if (this.necesitaBanco(tipo)) {
          metodoGroup.get('bancoObject')?.setValidators([Validators.required]);
          metodoGroup.get('bancoCodigo')?.setValidators([Validators.required]);
          metodoGroup.get('bancoNombre')?.setValidators([Validators.required]);
        } else {
          metodoGroup.get('bancoObject')?.clearValidators();
          metodoGroup.get('bancoCodigo')?.clearValidators();
          metodoGroup.get('bancoNombre')?.clearValidators();
        }

        if (this.necesitaReferencia(tipo)) {
          metodoGroup.get('referencia')?.setValidators([Validators.required]);
        } else {
          metodoGroup.get('referencia')?.clearValidators();
        }
      } else {
        // Si no hay tipo, limpiar validadores
        metodoGroup.get('monto')?.clearValidators();
        metodoGroup.get('bancoObject')?.clearValidators();
        metodoGroup.get('bancoCodigo')?.clearValidators();
        metodoGroup.get('bancoNombre')?.clearValidators();
        metodoGroup.get('referencia')?.clearValidators();
      }

      // Actualizar validadores sin marcar como tocado
      metodoGroup.get('tipo')?.updateValueAndValidity({ onlySelf: true, emitEvent: false });
      metodoGroup.get('monto')?.updateValueAndValidity({ onlySelf: true, emitEvent: false });
      metodoGroup.get('bancoObject')?.updateValueAndValidity({ onlySelf: true, emitEvent: false });
      metodoGroup.get('bancoCodigo')?.updateValueAndValidity({ onlySelf: true, emitEvent: false });
      metodoGroup.get('bancoNombre')?.updateValueAndValidity({ onlySelf: true, emitEvent: false });
      metodoGroup.get('referencia')?.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    });

    // Suscribirse a cambios del monto
    metodoGroup.get('monto')?.valueChanges.subscribe(value => {
      if (value !== null && value !== undefined) {
        this.validarMontoMetodoPago(index);
      }
    });
  }

  private validarAntesDeGuardar(): boolean {
    let errores: string[] = [];

    // Verificar que haya al menos un método con datos
    const metodosConDatos = this.metodosPagoArray.controls.filter(control =>
      this.metodoTieneDatos(control)
    );

    if (metodosConDatos.length === 0) {
      errores.push('Debe agregar al menos un método de pago válido.');
    }

    // Validar monto abonado
    const montoAbonado = this.editarVentaForm.get('montoAbonado')?.value;
    if (!montoAbonado || montoAbonado <= 0) {
      errores.push('Ingresa un monto válido a abonar (mayor a 0).');
    }

    // Validar que no exceda la deuda
    const montoDeuda = this.calcularMontoDeuda();
    if (montoAbonado > montoDeuda) {
      errores.push(`El monto a abonar excede la deuda pendiente (${this.formatearMoneda(montoDeuda)}).`);
    }

    // Marcar como tocados para mostrar errores visuales
    this.metodosPagoArray.controls.forEach((control, index) => {
      // Solo marcar si el método tiene tipo seleccionado (tiene datos)
      if (control.get('tipo')?.value) {
        control.get('monto')?.markAsTouched();

        const tipo = control.get('tipo')?.value;
        if (this.necesitaBanco(tipo)) {
          control.get('bancoObject')?.markAsTouched();
        }

        if (this.necesitaReferencia(tipo)) {
          control.get('referencia')?.markAsTouched();
        }
      }
    });

    // Validar cada método individualmente (solo los que tienen tipo)
    this.metodosPagoArray.controls.forEach((control, index) => {
      const tipo = control.get('tipo')?.value;

      if (!tipo) {
        // Si no tiene tipo pero tiene otros datos, marcar como error
        const tieneOtrosDatos = control.get('monto')?.value ||
          control.get('referencia')?.value ||
          control.get('bancoObject')?.value;

        if (tieneOtrosDatos) {
          errores.push(`Método ${index + 1}: Selecciona un tipo de pago`);
        }
        return;
      }

      const numeroMetodo = index + 1;

      // Validar monto
      const monto = control.get('monto')?.value;
      if (!monto || monto <= 0) {
        errores.push(`Método ${numeroMetodo} (${tipo}): Ingresa un monto válido (mayor a 0)`);
      }

      // Validar banco si es requerido
      if (this.necesitaBanco(tipo) && !control.get('bancoObject')?.value) {
        errores.push(`Método ${numeroMetodo} (${tipo}): Selecciona un banco`);
      }

      // Validar referencia si es requerida
      if (this.necesitaReferencia(tipo) && (!control.get('referencia')?.value || control.get('referencia')?.value.trim() === '')) {
        errores.push(`Método ${numeroMetodo} (${tipo}): Ingresa el número de referencia`);
      }
    });

    if (errores.length > 0) {
      this.swalService.showWarning(
        'Campos requeridos',
        `<strong>Por favor completa los siguientes campos:</strong><br><br>` +
        errores.map(error => `• ${error}`).join('<br>')
      );
      return false;
    }

    return true;
  }

  getSimboloMonedaParaVenta(venta: any): string {
    // Para ventas específicas, usar su moneda original
    const moneda = venta?.moneda || 'dolar';
    switch (moneda) {
      case 'dolar': return '$';
      case 'euro': return '€';
      case 'bolivar': return 'Bs.';
      default: return this.simboloMonedaSistema;
    }
  }

  getMonedaParaPipeVenta(): string {
    const moneda = this.getMonedaVenta();
    switch (moneda) {
      case 'dolar': return 'USD';
      case 'euro': return 'EUR';
      case 'bolivar': return 'Bs';
      default: return 'USD';
    }
  }

  calcularMontoDeuda(): number {
    if (!this.selectedVenta) return 0;

    //Intentar usar la deuda del API si está disponible
    if (this.selectedVenta?.formaPago?.deudaPendiente !== undefined &&
      this.selectedVenta?.formaPago?.deudaPendiente !== null) {
      return Math.max(0, this.selectedVenta.formaPago.deudaPendiente);
    }

    //Intentar usar la propiedad mapeada
    if (this.selectedVenta?.deudaPendiente !== undefined &&
      this.selectedVenta?.deudaPendiente !== null) {
      return Math.max(0, this.selectedVenta.deudaPendiente);
    }

    //Calcular manualmente usando totalPagado del API
    const totalVenta = this.selectedVenta.total || 0;
    const totalPagado = this.selectedVenta?.formaPago?.totalPagadoAhora ||
      this.selectedVenta?.montoAbonado || 0;

    return Math.max(0, totalVenta - totalPagado);
  }

  // Y actualizar tu función redondear para permitir decimales específicos
  private redondear(valor: number, decimales: number = 2): number {
    const factor = Math.pow(10, decimales);
    return Math.round(valor * factor) / factor;
  }

  // También asegúrate que getConversionBs redondee correctamente
  getConversionBs(monto: number, monedaOrigen?: string): number {
    // Si no se especifica monedaOrigen, usar la moneda de la venta
    const moneda = monedaOrigen || this.getMonedaVenta();

    if (moneda === 'bolivar') {
      return this.redondear(monto, 2);
    }

    const tasa = this.tasasPorId[moneda] || 1;
    return this.redondear(monto * tasa, 2);
  }


  // Obtener monto máximo permitido en moneda de venta
  getMontoMaximoPermitido(): number {
    return this.calcularMontoDeuda();
  }

  reinicializarFormularioConDeuda() {
    if (this.editarVentaForm) {
      // NO establecer montoAbonado aquí si vas a hacerlo después
      this.editarVentaForm.patchValue({
        // montoAbonado: null, // <- Comenta esta línea si existe
        observaciones: this.selectedVenta.observaciones || ''
      });

      // Limpiar métodos de pago
      this.metodosPagoArray.clear();
      this.agregarMetodoPago();

      if (this.selectedVenta.metodosPago && this.selectedVenta.metodosPago.length > 0) {
        // Opcional: Si quieres mostrar el último método de pago usado

      }
    } else {
      this.inicializarFormulario();
    }

    // Actualizar validadores para permitir valores vacíos inicialmente
    this.editarVentaForm.get('montoAbonado')?.setValidators([
      Validators.min(0),
      Validators.max(this.selectedVenta.total)
    ]);
    this.editarVentaForm.get('montoAbonado')?.updateValueAndValidity();
  }

  validarMontoMaximo(value: number) {
    if (value === null || value === undefined) return;

    const montoDeuda = this.calcularMontoDeuda();

    if (value > montoDeuda) {
      // console.log('Ajustando monto automáticamente de', value, 'a', montoDeuda);

      this.editarVentaForm.patchValue({
        montoAbonado: montoDeuda
      }, { emitEvent: false });
    }
  }

  //Obtener montos de progreso en moneda de venta
  getMontosProgreso(): string {
    if (!this.selectedVenta) return '$0.00 / $0.00';

    const montoAbonadoAnterior = this.selectedVenta.montoAbonado || 0;
    const nuevoMontoAbonado = this.editarVentaForm?.get('montoAbonado')?.value || 0;
    const totalAbonado = montoAbonadoAnterior + nuevoMontoAbonado;

    const simbolo = this.getSimboloMonedaVenta();
    return `${simbolo}${totalAbonado.toFixed(2)} / ${simbolo}${this.selectedVenta.total.toFixed(2)}`;
  }

  convertirMonto(monto: number, origen: string, destino: string): number {
    if (origen === destino) return this.redondear(monto);

    const tasas = {
      bolivar: 1,
      dolar: this.tasasPorId['dolar'] ?? 0,
      euro: this.tasasPorId['euro'] ?? 0
    };

    let montoEnBs: number;

    switch (origen) {
      case 'dolar':
        montoEnBs = monto * tasas.dolar;
        break;
      case 'euro':
        montoEnBs = monto * tasas.euro;
        break;
      case 'bolivar':
        montoEnBs = monto;
        break;
      default:
        montoEnBs = monto;
    }

    // Luego convertir de bolívares a la moneda destino
    let resultado: number;

    switch (destino) {
      case 'dolar':
        resultado = montoEnBs / tasas.dolar;
        break;
      case 'euro':
        resultado = montoEnBs / tasas.euro;
        break;
      case 'bolivar':
        resultado = montoEnBs;
        break;
      default:
        resultado = montoEnBs;
    }

    return this.redondear(resultado);
  }

  // CORRECCIÓN: Obtener monto máximo en la moneda del método
  getMontoMaximoParaMetodo(index: number): number {
    const montoAbonado = this.editarVentaForm.get('montoAbonado')?.value || 0;
    const monedaVenta = this.getMonedaVenta();
    const monedaMetodo = this.getMonedaParaMetodo(index);

    // Convertir el monto abonado (en moneda de venta) a la moneda del método
    let montoMaximoEnMonedaMetodo = this.convertirMonto(montoAbonado, monedaVenta, monedaMetodo);

    // Restar los otros métodos de pago ya ingresados
    const otrosMetodosEnMonedaMetodo = this.metodosPagoArray.controls.reduce((total, control, i) => {
      if (i !== index) {
        const montoOtro = control.get('monto')?.value || 0;
        const monedaOtro = this.getMonedaParaMetodo(i);
        // Convertir el monto del otro método a la moneda del método actual
        const montoConvertido = this.convertirMonto(montoOtro, monedaOtro, monedaMetodo);
        return total + montoConvertido;
      }
      return total;
    }, 0);

    montoMaximoEnMonedaMetodo = Math.max(0, montoMaximoEnMonedaMetodo - otrosMetodosEnMonedaMetodo);

    return this.redondear(montoMaximoEnMonedaMetodo);
  }

  // CORRECCIÓN: Validar monto del método de pago
  validarMontoMetodoPago(index: number): void {
    const metodoControl = this.metodosPagoArray.at(index);
    const montoIngresado = metodoControl?.get('monto')?.value || 0;
    const montoMaximo = this.getMontoMaximoParaMetodo(index);

    if (montoIngresado > montoMaximo) {
      metodoControl.patchValue({
        monto: montoMaximo
      }, { emitEvent: false });
    }
  }

  obtenerTasaConversion(monedaOrigen: string, monedaDestino: string): number {
    if (monedaOrigen === monedaDestino) return 1;

    const tasas = {
      bolivar: 1,
      dolar: this.tasasPorId['dolar'] ?? 0,
      euro: this.tasasPorId['euro'] ?? 0
    };

    const tasaOrigen = tasas[monedaOrigen as keyof typeof tasas] || 1;
    const tasaDestino = tasas[monedaDestino as keyof typeof tasas] || 1;

    return tasaOrigen / tasaDestino;
  }

  // CORRECCIÓN: Calcular total de métodos de pago en moneda de venta
  calcularTotalMetodosPagoEnMonedaVenta(): number {
    let total = 0;

    this.metodosPagoArray.controls.forEach((control, index) => {
      const monto = control.get('monto')?.value || 0;
      const monedaMetodo = this.getMonedaParaMetodo(index);
      const monedaVenta = this.getMonedaVenta();

      const montoEnMonedaVenta = this.convertirMonto(monto, monedaMetodo, monedaVenta);
      total += montoEnMonedaVenta;
    });

    return total;
  }

  // CORRECCIÓN: Calcular conversión para método específico
  getConversionParaMetodo(index: number): number {
    const metodoControl = this.metodosPagoArray.at(index);
    const monto = metodoControl?.get('monto')?.value || 0;
    const monedaMetodo = this.getMonedaParaMetodo(index);
    const monedaVenta = this.getMonedaVenta();

    return this.convertirMonto(monto, monedaMetodo, monedaVenta);
  }

  mostrarConversionParaMetodo(index: number): boolean {
    const monedaMetodo = this.getMonedaParaMetodo(index);
    const monedaVenta = this.getMonedaVenta();
    return monedaMetodo !== monedaVenta;
  }

  mostrarConversionBs(): boolean {
    return this.getMonedaVenta() !== 'bolivar';
  }

  obtenerEquivalenteBs(monto: number): number {
    const moneda = this.getMonedaVenta();
    const tasa = this.tasasPorId?.[moneda] ?? 1;
    return moneda === 'bolivar' ? monto : monto * tasa;
  }

  onMetodoPagoChange(index: number) {
    const metodoControl = this.metodosPagoArray.at(index);
    const tipoAnterior = metodoControl.get('tipo')?.value;
    const tipoNuevo = metodoControl.get('tipo')?.value;

    // Resetear monto si el tipo de pago cambia
    metodoControl.patchValue({
      monto: 0
    });

    // Si se cambia a efectivo, establecer moneda por defecto
    if (tipoNuevo === 'efectivo') {
      // Establecer moneda por defecto basada en la moneda del sistema o venta
      if (this.monedaSistema === 'BS' || this.monedaSistema === 'VES') {
        this.monedaEfectivo = 'Bs';
      } else if (this.monedaSistema === 'EUR') {
        this.monedaEfectivo = 'EUR';
      } else {
        this.monedaEfectivo = 'USD';
      }
    }

    // Forzar recálculo después del cambio
    setTimeout(() => {
      this.validarMontoMetodoPago(index);
    });
  }

  // CORRECCIÓN: Calcular diferencia en moneda de venta
  calcularDiferenciaMetodos(): number {
    const totalMetodosEnMonedaVenta = this.calcularTotalMetodosPagoEnMonedaVenta();
    const montoAbonado = this.editarVentaForm?.get('montoAbonado')?.value || 0;

    return Math.abs(totalMetodosEnMonedaVenta - montoAbonado);
  }

  // CORRECCIÓN: Validar pago completo en moneda de venta
  validarPagoCompleto(): boolean {
    const totalMetodosEnMonedaVenta = this.calcularTotalMetodosPagoEnMonedaVenta();
    const montoAbonado = this.editarVentaForm?.get('montoAbonado')?.value || 0;

    return Math.abs(totalMetodosEnMonedaVenta - montoAbonado) < 0.01;
  }

  //Obtener símbolo para método específico
  getSimboloParaMetodo(index: number): string {
    const metodoControl = this.metodosPagoArray.at(index);
    const tipoPago = metodoControl?.get('tipo')?.value;

    switch (tipoPago) {
      case 'efectivo':
        // Usar símbolo de la moneda específica de este método
        const monedaEfectivoMetodo = metodoControl?.get('monedaEfectivo')?.value || 'USD';
        switch (monedaEfectivoMetodo) {
          case 'USD': return '$';
          case 'EUR': return '€';
          case 'Bs': return 'Bs. ';
          default: return '$';
        }
      case 'pagomovil':
      case 'transferencia':
      case 'debito':
      case 'credito':
        return 'Bs. ';
      case 'zelle':
        return '$';
      default:
        return this.simboloMonedaSistema;
    }
  }

  getMontoRestanteParaMetodo(index: number): number {
    const montoAbonado = this.editarVentaForm.get('montoAbonado')?.value || 0;
    const monedaVenta = this.getMonedaVenta();

    // Calcular total de otros métodos convertidos a moneda de venta
    const totalOtrosMetodos = this.metodosPagoArray.controls.reduce((total, control, i) => {
      if (i !== index) {
        const monto = control.get('monto')?.value || 0;
        const monedaMetodo = this.getMonedaParaMetodo(i);
        const montoEnMonedaVenta = this.convertirMonto(monto, monedaMetodo, monedaVenta);
        return total + montoEnMonedaVenta;
      }
      return total;
    }, 0);

    const restanteEnMonedaVenta = Math.max(0, montoAbonado - totalOtrosMetodos);

    // Convertir a la moneda del método específico
    const monedaMetodo = this.getMonedaParaMetodo(index);
    return this.convertirMonto(restanteEnMonedaVenta, monedaVenta, monedaMetodo);
  }

  // Método para calcular la deuda restante después del nuevo abono
  calcularDeudaRestante(): number {
    if (!this.selectedVenta) return 0;

    const totalVenta = this.selectedVenta.total || 0;
    const montoAbonadoAnterior = this.selectedVenta.montoAbonado || 0;
    const nuevoAbono = this.editarVentaForm?.get('montoAbonado')?.value || 0;

    const deudaRestante = totalVenta - (montoAbonadoAnterior + nuevoAbono);

    return Math.max(0, deudaRestante);
  }

  // Método MEJORADO para obtener la deuda pendiente
  getDeudaPendiente(venta: any): number {
    if (!venta) return 0;

    // Si la venta está cancelada, no hay deuda
    if (venta.estado === 'cancelada') {
      return 0;
    }

    // Forma 1: deudaPendiente directo en formaPago
    if (venta?.formaPago?.deudaPendiente !== undefined &&
      venta?.formaPago?.deudaPendiente !== null) {
      const deudaAPI = venta.formaPago.deudaPendiente;
      return Math.max(0, deudaAPI);
    }

    // Forma 2: Buscar en formaPagoCompleto
    if (venta?.formaPagoCompleto?.deudaPendiente !== undefined &&
      venta?.formaPagoCompleto?.deudaPendiente !== null) {
      const deudaAPI = venta.formaPagoCompleto.deudaPendiente;
      return Math.max(0, deudaAPI);
    }

    // Forma 3: Buscar en propiedades mapeadas
    const deudaPendienteMapeada = venta?.deudaPendiente;
    if (deudaPendienteMapeada !== undefined && deudaPendienteMapeada !== null) {
      return Math.max(0, deudaPendienteMapeada);
    }

    // PRIORIDAD 2: Calcular basado en total y pagado
    const totalVenta = venta.total || 0;
    const totalPagado = this.getTotalPagadoVenta(venta);

    // Para evitar errores de precisión, redondear
    const deudaCalculada = Math.max(0, totalVenta - totalPagado);
    const deudaRedondeada = Math.round(deudaCalculada * 100) / 100;

    return deudaRedondeada;
  }

  // Método para obtener el estatus de pago
  getEstatusPago(venta: any): string {
    if (venta.estado === 'cancelada') {
      return 'Cancelado';
    }

    const deuda = this.getDeudaPendiente(venta);

    console.log('Deuda', deuda);

    if (deuda === 0) {
      return 'Pago completado';
    } else {
      // Para de_contado-pendiente, mostrar mensaje específico
      if (venta.formaPago === 'de_contado-pendiente') {
        return 'Pendiente de pago completo';
      }
      return 'Pendiente por pago';
    }
  }

  // Método para obtener la clase CSS del estatus de pago (actualizado)
  getEstatusPagoClase(venta: any): string {
    const estatus = venta.estadoPago || this.getEstatusPago(venta);

    switch (estatus) {
      case 'completado':
      case 'Pago completado':
        return 'estatus-completado';
      case 'parcial':
      case 'Pendiente por pago':
        return 'estatus-pendiente';
      case 'cancelado':
      case 'Cancelado':
        return 'estatus-cancelado';
      default: return 'estatus-pendiente';
    }
  }

  // === MÉTODOS PARA MONEDA DEL SISTEMA ===
  private obtenerConfiguracionSistema(): void {
    this.monedaSistema = this.systemConfigService.getMonedaPrincipal();
    this.simboloMonedaSistema = this.systemConfigService.getSimboloMonedaPrincipal();
  }

  private suscribirCambiosConfiguracion(): void {
    this.configSubscription = this.systemConfigService.config$.subscribe(config => {
      this.monedaSistema = config.monedaPrincipal;
      this.simboloMonedaSistema = config.simboloMoneda;
      // Si necesitas recargar datos cuando cambia la moneda, puedes hacerlo aquí
      // this.recargarDatosConNuevaMoneda();
    });
  }

  private normalizarMonedaParaVenta(monedaSistema: string): string {
    const mapaMonedas: { [key: string]: string } = {
      'USD': 'dolar',
      'EUR': 'euro',
      'VES': 'bolivar',
      'BS': 'bolivar',
      '€': 'euro',
      '$': 'dolar'
    };

    // Si es un símbolo, convertirlo directamente
    if (monedaSistema === '$' || monedaSistema === 'USD') return 'dolar';
    if (monedaSistema === '€' || monedaSistema === 'EUR') return 'euro';
    if (monedaSistema === 'Bs' || monedaSistema === 'VES' || monedaSistema === 'BS') return 'bolivar';

    // Para nombres completos
    return mapaMonedas[monedaSistema.toUpperCase()] || 'dolar';
  }



  // Método mejorado para mostrar montos en métodos de pago
  getMontoParaMostrarMetodoPago(metodo: any, venta: any): string {
    const monedaPago = metodo.moneda_id || this.getMonedaParaMetodoPorTipo(metodo.tipo);
    const monedaVenta = venta.moneda;

    // Si el pago es en la misma moneda de la venta, mostrar directamente
    if (monedaPago === monedaVenta) {
      return this.formatearMontoConMoneda(metodo.monto, monedaPago);
    }

    // Si el pago es en diferente moneda, mostrar el monto en la moneda del pago
    // y calcular el equivalente
    return this.formatearMontoConMoneda(metodo.monto, monedaPago);
  }

  // Método para obtener la moneda según el tipo de pago
  getMonedaParaMetodoPorTipo(tipoPago: string): string {
    switch (tipoPago) {
      case 'pagomovil':
      case 'transferencia':
      case 'debito':
      case 'credito':
        return 'bolivar';
      case 'zelle':
        return 'dolar';
      case 'efectivo':
        // Para efectivo, depende de lo seleccionado
        return this.monedaEfectivo.toLowerCase() === 'bs' ? 'bolivar' :
          this.monedaEfectivo.toLowerCase() === 'eur' ? 'euro' : 'dolar';
      default:
        return 'dolar';
    }
  }

  // Método para formatear monto con símbolo de moneda
  formatearMontoConMoneda(monto: number, moneda: string): string {
    const simbolo = this.getSimboloMoneda(moneda);
    return `${simbolo}${monto.toFixed(2)}`;
  }

  // Método para obtener símbolo de moneda
  getSimboloMoneda(moneda: string): string {
    switch (moneda) {
      case 'dolar': return '$';
      case 'euro': return '€';
      case 'bolivar': return 'Bs. ';
      default: return '$';
    }
  }

  // Método para obtener la moneda del método de pago
  getMonedaDelMetodo(metodo: any): string {
    // Si viene del API, usar moneda_id, sino determinar por tipo
    if (metodo.moneda_id) {
      return metodo.moneda_id;
    }

    // Determinar por tipo de pago
    switch (metodo.tipo) {
      case 'pagomovil':
      case 'transferencia':
      case 'debito':
      case 'credito':
        return 'bolivar';
      case 'zelle':
        return 'dolar';
      case 'efectivo':
        // Para histórico, asumir dólares si no hay información
        return 'dolar';
      default:
        return 'dolar';
    }
  }

  getTasaDisplay(): string {
    return `Tasa: 1 USD = ${this.tasaCableada} Bs`;
  }

  getMontoDisplayMetodoPago(metodo: any, venta: any): string {
    const monedaPago = metodo.moneda_id;
    const montoOriginal = metodo.monto || 0;
    const montoEnMonedaVenta = metodo.monto_en_moneda_de_venta || montoOriginal;

    // Formatear ambos montos
    const montoOriginalFormateado = this.formatearMoneda(montoOriginal, monedaPago);
    const montoConvertidoFormateado = this.formatearMoneda(montoEnMonedaVenta, venta.moneda);

    // Si es la misma moneda, mostrar solo uno
    if (monedaPago === venta.moneda) {
      return montoOriginalFormateado;
    }

    return `${montoOriginalFormateado} → ${montoConvertidoFormateado}`;
  }

  getEquivalenteDisplay(metodo: any, venta: any): string {
    if (!metodo.monto_en_moneda_de_venta || metodo.moneda_id === venta.moneda) {
      return '';
    }

    const montoOriginal = metodo.monto || 0;
    const montoConvertido = metodo.monto_en_moneda_de_venta;

    return `Equivale a: ${this.formatearMoneda(montoConvertido, venta.moneda)}`;
  }

  // Método para obtener el monto original correcto
  getMontoOriginalDelMetodo(metodo: any, monedaPago: string): number {
    if (metodo.monto_en_moneda_de_venta !== undefined && metodo.monto_en_moneda_de_venta !== null) {
      return metodo.monto;
    }

    if (metodo.conversionBs !== undefined && metodo.conversionBs !== null) {
      if (monedaPago === 'bolivar') {
        return metodo.conversionBs;
      } else {
        return metodo.monto;
      }
    }

    return metodo.monto;
  }

  // Método para formatear (sin cambios)
  formatearMontoConDecimales(monto: number, moneda: string): string {
    const simbolo = this.getSimboloMoneda(moneda);
    const montoFormateado = Number(monto).toFixed(2);
    return `${simbolo}${montoFormateado}`;
  }

  // Método mejorado para obtener banco
  getBancoDisplay(metodo: any): string {
    if (!metodo) return '';

    // Prioridad 1: bancoNombre y bancoCodigo del API
    if (metodo.bancoNombre) {
      return metodo.bancoCodigo ?
        `${metodo.bancoNombre} (${metodo.bancoCodigo})` :
        metodo.bancoNombre;
    }

    // Prioridad 2: propiedad banco (formato antiguo)
    if (metodo.banco) {
      return metodo.banco;
    }

    return '';
  }

  getTasaBolivar(): number {
    if (!this.selectedVenta) return this.tasaCableada;

    const monedaVenta = this.selectedVenta.moneda;

    // Si la venta es en dólares, usar tasa dólar
    if (monedaVenta === 'dolar') {
      return this.tasasPorId['dolar'] || this.tasaCableada;
    }

    // Si la venta es en euros, usar tasa euro
    if (monedaVenta === 'euro') {
      return this.tasasPorId['euro'] || (this.tasaCableada * 0.85);
    }

    return this.tasaCableada;
  }

  getTipoPagoDisplay(tipo: string): string {
    if (!tipo) return '';

    const mapeoTipos: { [key: string]: string } = {
      'efectivo': 'Efectivo',
      'pagomovil': 'Pago Móvil',
      'debito': 'Débito',
      'credito': 'Crédito',
      'transferencia': 'Transferencia',
      'zelle': 'Zelle'
    };

    return mapeoTipos[tipo] || tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase();
  }

  // Método para obtener la moneda de venta display
  getMonedaVentaDisplay(): string {
    if (!this.selectedVenta) return 'USD';

    const moneda = this.selectedVenta.moneda;
    switch (moneda) {
      case 'dolar': return 'USD';
      case 'euro': return 'EUR';
      case 'bolivar': return 'Bs';
      default: return 'USD';
    }
  }

  // Método para calcular el total de cuotas adelantadas
  getTotalCuotasAdelantadas(): number {
    if (!this.selectedVenta?.cuotasAdelantadas?.length) return 0;

    return this.selectedVenta.cuotasAdelantadas.reduce((total: number, cuota: any) => {
      return total + (cuota.monto || 0);
    }, 0);
  }

  // Método para calcular porcentaje de abono para una venta específica
  getPorcentajeAbonadoVenta(venta: any): number {
    if (!venta || venta.formaPago !== 'abono') return 0;

    const total = venta.total || 0;
    const abonado = venta.montoAbonado || 0;

    if (total === 0) return 0;

    return Math.round((abonado / total) * 100);
  }

  // Método para obtener símbolo de moneda de venta
  getSimboloMonedaVenta(): string {
    if (!this.selectedVenta) return '$';

    const moneda = this.selectedVenta.moneda;
    switch (moneda) {
      case 'dolar': return '$';
      case 'euro': return '€';
      case 'bolivar': return 'Bs. ';
      default: return '$';
    }
  }

  // Método para mostrar moneda formateada
  getMonedaDisplay(moneda: string): string {
    if (!moneda) return 'USD';

    const monedas: { [key: string]: string } = {
      'dolar': 'USD',
      'euro': 'EUR',
      'bolivar': 'BS'
    };

    return monedas[moneda] || moneda.toUpperCase();
  }

  // Método para calcular porcentaje abonado
  getPorcentajeAbonado(): number {
    if (!this.selectedVenta || this.selectedVenta.formaPago !== 'abono') return 0;

    const total = this.selectedVenta.total || 0;
    const abonado = this.selectedVenta.montoAbonado || 0;

    if (total === 0) return 0;

    return Math.round((abonado / total) * 100);
  }

  /* Formatea una fecha para mostrar
   */
  formatFecha(fecha: string | Date): string {
    if (!fecha) return '';

    const date = new Date(fecha);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  private ventaTienePendiente(venta: any): boolean {
    if (venta.estado === 'cancelada') {
      return false;
    }
    const deuda = this.getDeudaPendiente(venta);
    return deuda > 0;
  }

  getEspecialistaNombre(especialistaId: string): string {
    const especialista = this.especialistas.find(e => e.id.toString() === especialistaId);
    return especialista?.nombre || 'Especialista';
  }

  getEstadoDisplay(estado: string): string {
    const estados: { [key: string]: string } = {
      'completada': 'Completada',
      'pendiente': 'Pendiente',
      'cancelada': 'Cancelada',
      'anulada': 'Cancelada'
    };
    return estados[estado] || estado;
  }

  hayFiltrosActivos(): boolean {
    return !!(
      this.filtros.busquedaGeneral ||
      this.filtros.asesor ||
      this.filtros.especialista ||
      this.filtros.estado ||
      this.filtros.formaPago ||
      this.filtros.fechaDesde ||
      this.filtros.fechaHasta
    );
  }

  private cargarVentasPagina(pagina: number, esBusquedaConFiltros: boolean = false, esBusquedaDinamica: boolean = false): void {
    if (this.ventasCargando) return;

    this.ventasCargando = true;

    // Solo mostrar loader si NO es búsqueda dinámica
    if (!esBusquedaDinamica) {
      if (esBusquedaConFiltros) {
        this.loader.showWithMessage('🔍 Aplicando filtros...');
      } else if (pagina === 1 && !this.hayFiltrosActivos()) {
        this.loader.showWithMessage('📋 Cargando historial de ventas...');
      } else {
        this.loader.showWithMessage('📋 Cargando ventas...');
      }
    }

    // Preparar filtros para el backend
    const filtrosBackend = { ...this.filtros };

    // Si hay búsqueda mejorada, agregar los campos adicionales
    if (this.filtrosMejorados && this.filtrosMejorados.soloNumeros) {
      filtrosBackend.busquedaNumerica = this.filtrosMejorados.soloNumeros;
      filtrosBackend.ultimosDigitos = this.filtrosMejorados.ultimosDigitos;
      filtrosBackend.tipoBusqueda = this.filtrosMejorados.tipo || 'texto';

      if (this.filtrosMejorados.valorNormalizado) {
        filtrosBackend.valorNormalizado = this.filtrosMejorados.valorNormalizado;
      }
    }

    this.historialVentaService.obtenerVentasPaginadas(
      pagina,
      this.paginacion.itemsPorPagina,
      filtrosBackend
    ).subscribe({
      next: (response: any) => {
        this.ventasCargando = false;
        this.buscando = false;

        if (response.message === 'ok' && response.ventas) {
          const ventasPagina = response.ventas.map((ventaApi: any) =>
            this.adaptarVentaDelApi(ventaApi)
          );

          this.paginacion.paginaActual = pagina;
          this.paginacion.totalItems = response.pagination?.total || 0;
          this.paginacion.totalPaginas = response.pagination?.pages || 1;
          this.ventasFiltradas = ventasPagina;
          this.generarRangoPaginas();
        } else {
          console.error('Respuesta inesperada del API de ventas:', response);
          this.ventasFiltradas = [];
          this.paginacion.totalItems = 0;
          this.paginacion.totalPaginas = 1;
        }

        if (!esBusquedaDinamica) {
          setTimeout(() => {
            this.loader.hide();
          }, 500);
        }
      },
      error: (error) => {
        this.ventasCargando = false;
        this.buscando = false;
        console.error('❌ ERROR al cargar ventas paginadas:', error);

        if (!esBusquedaDinamica) {
          this.loader.hide();
        }

        this.swalService.showError('Error', 'No se pudieron cargar las ventas. Verifique su conexión.');
      }
    });
  }

  // Método para cargar estadísticas
  private cargarEstadisticas(): void {
    if (this.estadisticasCargando) return;

    this.estadisticasCargando = true;

    // Solo mostrar loader si no estamos ya cargando ventas
    if (!this.ventasCargando) {
      this.loader.showWithMessage('📊 Cargando estadísticas...');
    }

    this.historialVentaService.obtenerEstadisticasVentas(this.filtros).subscribe({
      next: (response: any) => {
        this.estadisticasCargando = false;

        console.log('📊 Respuesta de estadísticas:', response);

        if (response.message === 'ok') {
          // Usar los datos directamente del API
          this.estadisticas = {
            totalVentas: response.ventas || 0,
            ventasCompletadas: response.completadas || 0,
            ventasPendientes: response.pendientes || 0,
            ventasCanceladas: response.canceladas || 0,
            montoCompletadas: response.montoCompletadas || 0,
            montoPendientes: response.montoPendientes || 0,
            montoCanceladas: response.montoCanceladas || 0,
            montoTotalGeneral: response.montoTotalGeneral || 0
          };


          console.log('📊 Estadísticas actualizadas:', this.estadisticas);
        } else {
          console.warn('Formato de respuesta inesperado:', response);
          this.estadisticas = this.crearEstadisticasVacias();
        }

        // Forzar actualización de la vista
        this.cdRef.detectChanges();

        // Ocultar loader solo si no estamos cargando ventas
        if (!this.ventasCargando) {
          setTimeout(() => {
            this.loader.hide();
          }, 500);
        }
      },
      error: (error) => {
        this.estadisticasCargando = false;
        console.error('Error al cargar estadísticas:', error);
        this.estadisticas = this.crearEstadisticasVacias();

        if (!this.ventasCargando) {
          this.loader.hide();
        }
      }
    });
  }

  onFiltroChange(): void {
    this.paginacion.paginaActual = 1;
    this.cargarVentasPagina(1, true);

    this.filtrosChanged$.next();
  }


  limpiarFiltros(): void {
    this.filtros = {
      busquedaGeneral: '',
      estado: '',
      formaPago: '',
      asesor: '',
      especialista: '',
      fechaDesde: null,
      fechaHasta: null,
      tipoVenta: ''
    };
    this.paginacion.paginaActual = 1;
    this.fechaUnica = '';

    this.cargarVentasPagina(1, false);
    this.filtrosChanged$.next();
  }

  // ========== MÉTODOS DE PAGINACIÓN ==========
  irAPagina(pagina: number | string): void {
    const paginaNum = typeof pagina === 'string' ? parseInt(pagina, 10) : pagina;

    if (paginaNum >= 1 && paginaNum <= this.paginacion.totalPaginas) {
      this.cargarVentasPagina(paginaNum, this.hayFiltrosActivos());
      // No recargar estadísticas al cambiar de página
    }
  }

  cambiarItemsPorPagina(): void {
    this.paginacion.paginaActual = 1;
    this.cargarVentasPagina(1, this.hayFiltrosActivos());
    // No recargar estadísticas
  }

  primeraPagina(): void {
    this.irAPagina(1);
  }

  ultimaPagina(): void {
    this.irAPagina(this.paginacion.totalPaginas);
  }

  paginaAnterior(): void {
    this.irAPagina(this.paginacion.paginaActual - 1);
  }

  paginaSiguiente(): void {
    this.irAPagina(this.paginacion.paginaActual + 1);
  }

  // ========== MÉTODOS PARA FECHAS ==========
  aplicarFechas(): void {
    this.closeDatepicker();
    this.onFiltroChange();
  }

  onFechaUnicaChange(): void {
    this.presetActivo = '';

    if (this.fechaUnica) {
      const hoy = new Date().toISOString().split('T')[0];

      if (this.fechaUnica > hoy) {
        this.fechaUnica = '';
        this.filtros.fechaDesde = '';
        this.filtros.fechaHasta = '';
        return;
      }

      this.filtros.fechaDesde = this.fechaUnica;
      this.filtros.fechaHasta = this.fechaUnica;
    } else {
      this.filtros.fechaDesde = '';
      this.filtros.fechaHasta = '';
    }

    this.onFiltroChange();
  }

  setRangoPreset(tipo: string): void {
    const hoy = new Date();
    let fechaDesde = new Date();
    let fechaHasta = new Date();

    this.presetActivo = tipo;

    switch (tipo) {
      case 'hoy':
        this.filtros.fechaDesde = hoy.toISOString().split('T')[0];
        this.filtros.fechaHasta = hoy.toISOString().split('T')[0];
        break;

      case 'ayer':
        fechaDesde.setDate(hoy.getDate() - 1);
        this.filtros.fechaDesde = fechaDesde.toISOString().split('T')[0];
        this.filtros.fechaHasta = fechaDesde.toISOString().split('T')[0];
        break;

      case 'semana':
        const diaSemana = hoy.getDay();
        const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;

        fechaDesde = new Date(hoy);
        fechaDesde.setDate(hoy.getDate() + diffLunes);

        fechaHasta = new Date(fechaDesde);
        fechaHasta.setDate(fechaDesde.getDate() + 6);

        this.filtros.fechaDesde = fechaDesde.toISOString().split('T')[0];
        this.filtros.fechaHasta = fechaHasta.toISOString().split('T')[0];
        break;

      // ... otros casos del preset

      default:
        break;
    }

    this.fechaUnica = '';
    this.onFiltroChange();
  }

  // ========== MÉTODOS PARA TARJETAS DE RESUMEN ==========
  getTotalVentas(): number {
    return this.estadisticas.totalVentas || 0;
  }

  getVentasCompletadas(): number {
    return this.estadisticas.ventasCompletadas || 0;
  }

  getVentasPendientes(): number {
    return this.estadisticas.ventasPendientes || 0;
  }

  getVentasCanceladas(): number {
    return this.estadisticas.ventasCanceladas || 0;
  }

  /**
   * Genera el rango de páginas para la navegación
   */
  private generarRangoPaginas(): void {
    const totalPaginas = this.paginacion.totalPaginas;
    const paginaActual = this.paginacion.paginaActual;
    const rango: number[] = [];

    if (totalPaginas <= 7) {
      // Mostrar todas las páginas
      for (let i = 1; i <= totalPaginas; i++) {
        rango.push(i);
      }
    } else {
      // Lógica avanzada de rango
      if (paginaActual <= 4) {
        // Primeras páginas
        for (let i = 1; i <= 5; i++) rango.push(i);
        rango.push(-1); // Separador
        rango.push(totalPaginas);
      } else if (paginaActual >= totalPaginas - 3) {
        // Últimas páginas
        rango.push(1);
        rango.push(-1);
        for (let i = totalPaginas - 4; i <= totalPaginas; i++) rango.push(i);
      } else {
        // Páginas intermedias
        rango.push(1);
        rango.push(-1);
        for (let i = paginaActual - 1; i <= paginaActual + 1; i++) rango.push(i);
        rango.push(-1);
        rango.push(totalPaginas);
      }
    }

    this.paginacion.rangoPaginas = rango;
  }

  // Método mejorado para formatear con soporte de euro
  formatearMoneda(monto: number | null | undefined, moneda?: string): string {
    if (monto === null || monto === undefined || isNaN(monto)) {
      const monedaDefault = moneda || this.selectedVenta?.moneda || this.monedaSistema;
      return this.obtenerSimboloMoneda(monedaDefault) + '0,00';
    }

    const montoNumerico = Number(monto);

    if (isNaN(montoNumerico)) {
      const monedaDefault = moneda || this.selectedVenta?.moneda || this.monedaSistema;
      return this.obtenerSimboloMoneda(monedaDefault) + '0,00';
    }

    // Determinar moneda
    let monedaFinal = moneda;
    if (!monedaFinal && this.ventaParaRecibo) {
      monedaFinal = this.ventaParaRecibo.moneda || 'dolar';
    }
    if (!monedaFinal) {
      monedaFinal = this.monedaSistema;
    }

    const simbolo = this.obtenerSimboloMoneda(monedaFinal);
    return this.formatearNumeroVenezolano(montoNumerico, simbolo);
  }

  // Función para formatear números al estilo venezolano
  private formatearNumeroVenezolano(valor: number, simbolo: string): string {
    // Redondear a 2 decimales
    const valorRedondeado = Math.round(valor * 100) / 100;

    // Separar parte entera y decimal
    const partes = valorRedondeado.toString().split('.');
    let parteEntera = partes[0];
    let parteDecimal = partes[1] || '00';

    // Asegurar 2 decimales
    parteDecimal = parteDecimal.padEnd(2, '0');

    // Formatear parte entera con separadores de miles (puntos)
    parteEntera = parteEntera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    // Para bolívares, usar el formato específico
    if (simbolo === 'Bs.') {
      return `${simbolo} ${parteEntera},${parteDecimal}`;
    } else {
      // Para otras monedas
      return `${simbolo}${parteEntera},${parteDecimal}`;
    }
  }

  // Función para obtener el símbolo de moneda
  obtenerSimboloMoneda(moneda: string): string {
    // Normalizar la moneda
    const monedaNormalizada = moneda.toLowerCase();

    if (monedaNormalizada === 'bs' || monedaNormalizada === 'ves' || monedaNormalizada === 'bolivar' || monedaNormalizada === 'bolívar') {
      return 'Bs.';
    } else if (monedaNormalizada === 'eur' || monedaNormalizada === 'euro' || monedaNormalizada === '€') {
      return '€';
    } else {
      // Por defecto, dólares
      return '$';
    }
  }

  // Método para CONVERSIÓN A MONEDA DEL SISTEMA
  getMontoParaMostrar(venta: any, monto: number): string {
    if (!venta || monto === null || monto === undefined || isNaN(monto)) {
      return this.formatearMoneda(0, this.monedaSistema);
    }

    // Obtener la moneda de la venta
    const monedaVenta = venta.moneda || 'dolar';

    const monedaSistemaNormalizada = this.normalizarMonedaParaVenta(this.monedaSistema);

    // Si la moneda de la venta ya es la misma que la del sistema, mostrar directamente
    if (monedaVenta === monedaSistemaNormalizada) {
      return this.formatearMoneda(monto, this.monedaSistema);
    }

    // CONVERTIR a la moneda del sistema
    const montoConvertido = this.convertirMonto(monto, monedaVenta, monedaSistemaNormalizada);

    // Formatear en la moneda del sistema
    return this.formatearMoneda(montoConvertido, this.monedaSistema);
  }

  // Método para formatear montos del sistema
  formatearMontoSistema(monto: number): string {
    if (monto === null || monto === undefined || isNaN(monto)) {
      return this.formatearMoneda(0, this.monedaSistema);
    }

    const montoNumerico = Number(monto);

    if (isNaN(montoNumerico)) {
      return this.formatearMoneda(0, this.monedaSistema);
    }

    return this.formatearMoneda(montoNumerico, this.monedaSistema);
  }

  // ========== MÉTODOS PARA EL RECIBO ==========

  /**
  * Método para ver el recibo de una venta 
  */
  verRecibo(venta: any): void {
    console.log('📄 Abriendo recibo para venta:', venta);

    // 1. Cerrar modal anterior
    this.cerrarModalRecibo();

    // 2. Preparar datos
    setTimeout(() => {
      this.iniciarReciboNuevo(venta);

      // 3. Mostrar el modal
      this.mostrarModalRecibo = true;

      // 4. Resetear scroll DEL MODAL después de que se renderice
      setTimeout(() => this.resetScrollModal(), 50);
    }, 10);
  }

  private resetScrollModal(): void {
    // Solo resetear elementos DENTRO del modal
    const modalBody = document.querySelector('#reciboModal .modal-body');
    const reciboContainer = document.getElementById('contenidoRecibo');
    const modalContent = document.querySelector('#reciboModal .modal-content');

    // Resetear cada contenedor del modal
    [modalBody, reciboContainer, modalContent].forEach(element => {
      if (element) {
        (element as HTMLElement).scrollTop = 0;
        console.log(`✅ Scroll reseteado para: ${element.className || element.id}`);
      }
    });
  }

  /**
   * Método auxiliar para iniciar un nuevo recibo
   */
  private iniciarReciboNuevo(venta: any): void {
    try {
      // Crear una copia para evitar mutaciones
      this.ventaParaRecibo = {
        ...venta,
        formaPago: venta.formaPago || 'contado',
        montoAbonado: venta.montoAbonado || 0,
        montoInicial: venta.montoInicial || 0,
        moneda: venta.moneda || 'dolar',
        total: venta.total || 0,
        subtotal: venta.subtotal || 0,
        totalIva: venta.totalIva || 0,
        descuento: venta.descuento || 0
      };

      // Preparar datos para el recibo
      this.prepararDatosRecibo(this.ventaParaRecibo);

      // Mostrar el modal después de preparar los datos
      setTimeout(() => {
        this.mostrarModalRecibo = true;

        // Forzar detección de cambios
        setTimeout(() => {
          this.scrollToTop();
        }, 50);
      }, 50);

    } catch (error) {
      console.error('Error crítico al preparar recibo:', error);
      this.swalService.showError('Error',
        'Ocurrió un error inesperado al preparar el recibo. Por favor, intente nuevamente.');

      // Limpiar estado en caso de error
      this.cerrarModalRecibo();
    }
  }

  /**
   * Preparar los datos del recibo
   */
  private prepararDatosRecibo(venta: any): void {
    const fecha = new Date(venta.fecha);

    this.datosRecibo = {
      // Información básica
      numeroVenta: venta.numeroControl || `V-${venta.key.substring(0, 8)}`,
      fecha: this.formatFecha(fecha),
      hora: fecha.toLocaleTimeString('es-VE', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      vendedor: venta.asesorNombre || venta.asesor?.nombre || 'No asignado',

      // Cliente
      cliente: {
        nombre: venta.paciente?.nombre || 'CLIENTE GENERAL',
        cedula: venta.paciente?.cedula || 'N/A',
        telefono: venta.paciente?.telefono || 'N/A'
      },

      // Configuración
      configuracion: {
        formaPago: venta.formaPago || 'contado'
      },

      // Totales
      totalVenta: venta.total || 0,
      totalPagado: this.getTotalPagadoVenta(venta),

      // Información específica
      abono: {
        montoAbonado: venta.formaPago?.montoInicial || venta.montoAbonado || 0,
        deudaPendiente: venta.formaPago?.deudaPendiente || this.getDeudaPendiente(venta),
        porcentajePagado: this.calcularPorcentajePagado(venta)
      },

      // Cashea (si aplica)
      cashea: {
        nivel: venta.nivelCashea,
        inicial: venta.montoInicial || 0,
        cantidadCuotas: venta.cantidadCuotas || 0,
        cuotasAdelantadas: venta.cuotasAdelantadas?.length || 0,
        montoAdelantado: venta.totalAdelantado || 0,
        deudaPendiente: venta.deudaPendiente || 0
      },

      // Observaciones
      observaciones: venta.observaciones
    };

    // Preparar datos específicos según forma de pago
    if (venta.formaPago === 'cashea') {
      this.prepararDatosCashea(venta);
    } else if (venta.formaPago === 'abono') {
      this.calcularPorcentajeAbonado(venta);
    }
  }

  /**
   * Preparar datos específicos para Cashea
   */
  private prepararDatosCashea(venta: any): void {
    this.nivelCashea = venta.nivelCashea || 'inicial';
    this.cantidadCuotasCashea = venta.cantidadCuotas || 0;

    // Calcular cuotas adelantadas
    const cuotasAdelantadas = venta.cuotasAdelantadas || [];
    this.resumenCashea = {
      cantidad: cuotasAdelantadas.length,
      total: cuotasAdelantadas.reduce((sum: number, c: any) => sum + (c.monto || 0), 0)
    };

    // Generar calendario de cuotas
    this.generarCalendarioCuotas(venta);
  }

  /**
   * Generar calendario de cuotas para Cashea
   */
  private generarCalendarioCuotas(venta: any): void {
    const cuotas = [];
    const totalCuotas = venta.cantidadCuotas || 0;
    const montoPorCuota = venta.montoPorCuota || 0;
    const cuotasAdelantadas = venta.cuotasAdelantadas || [];
    const cuotasAdelantadasIds = cuotasAdelantadas.map((c: any) => c.numero);

    // Fecha base (fecha de la venta)
    const fechaBase = new Date(venta.fecha);

    for (let i = 1; i <= totalCuotas; i++) {
      const fechaCuota = new Date(fechaBase);
      fechaCuota.setMonth(fechaCuota.getMonth() + i);

      const esAdelantada = cuotasAdelantadasIds.includes(i);
      const esPagada = false; // Por defecto, se marcarían como pagadas en el historial

      cuotas.push({
        id: i,
        fecha: this.formatFecha(fechaCuota),
        monto: montoPorCuota,
        seleccionada: esAdelantada,
        pagada: esPagada
      });
    }

    this.cuotasCashea = cuotas;
  }

  /**
   * Calcular porcentaje abonado
   */
  private calcularPorcentajeAbonado(venta: any): void {
    const total = venta.total || 0;
    const abonado = venta.montoAbonado || 0;

    if (total > 0) {
      this.porcentajeAbonadoDelTotal = Math.round((abonado / total) * 100);
    } else {
      this.porcentajeAbonadoDelTotal = 0;
    }
  }

  /**
   * Calcular porcentaje pagado para el recibo
   */
  private calcularPorcentajePagado(venta: any): number {
    const total = venta.total || 0;
    const pagado = this.getTotalPagadoVenta(venta);

    if (total > 0) {
      return Math.round((pagado / total) * 100);
    }
    return 0;
  }

  /**
   * Obtener el título del recibo según tipo de venta
   */
  getTituloRecibo(): string {
    if (!this.ventaParaRecibo) return 'Recibo de Venta';

    const formaPago = this.ventaParaRecibo.formaPago;

    switch (formaPago) {
      case 'contado':
        return 'RECIBO DE VENTA';
      case 'abono':
        return 'RECIBO DE ABONO';
      case 'cashea':
        return 'RECIBO DE PLAN CASHEA';
      default:
        return 'RECIBO DE VENTA';
    }
  }

  /**
   * Obtener estado del recibo
   */
  getEstadoTexto(): string {
    if (!this.ventaParaRecibo) return 'Completada';

    if (this.ventaParaRecibo.estado === 'cancelada') {
      return 'Cancelada';
    }

    const deuda = this.getDeudaPendiente(this.ventaParaRecibo);
    if (deuda > 0) {
      return 'Pendiente por pago';
    }

    return 'Completada';
  }

  /**
   * Obtener clase CSS para el badge de estado
   */
  getEstadoBadgeClass(): string {
    const estado = this.getEstadoTexto();

    if (estado.includes('Cancelada')) return 'bg-danger';
    if (estado.includes('Pendiente')) return 'bg-warning';
    if (estado.includes('Completada')) return 'bg-success';

    return 'bg-secondary';
  }

  /**
   * Obtener productos seguros
   */
  getProductosSeguros(): any[] {
    if (!this.ventaParaRecibo) {
      return [];
    }

    // PRIORIDAD 1: Usar productosOriginales si están disponibles
    if (this.ventaParaRecibo.productosOriginales &&
      this.ventaParaRecibo.productosOriginales.length > 0) {

      return this.ventaParaRecibo.productosOriginales.map((prod: any) => {
        // Precio unitario sin IVA del API original
        const precioUnitarioSinIva = prod.precio_unitario_sin_iva || 0;
        const cantidad = prod.cantidad || 1;

        // Calcular subtotal: precio sin IVA × cantidad
        const subtotalCalculado = precioUnitarioSinIva * cantidad;

        return {
          nombre: prod.datos?.nombre || 'Producto sin nombre',
          cantidad: cantidad,
          precioUnitarioSinIva: precioUnitarioSinIva,
          precioUnitarioConIva: prod.precio_unitario || 0,
          subtotalCalculado: subtotalCalculado,
          totalOriginal: prod.total,
          tieneIva: prod.tiene_iva === 1
        };
      });
    }

    // PRIORIDAD 2: Usar productos procesados como fallback
    return (this.ventaParaRecibo.productos || []).map((prod: any) => {
      // Calcular precio sin IVA basado en el impuesto
      const impuesto = this.ventaParaRecibo.impuesto || 16;
      const precioConIVA = prod.precio || 0;
      const cantidad = prod.cantidad || 1;

      // Fórmula: precioSinIVA = precioConIVA / (1 + impuesto/100)
      const precioSinIVA = precioConIVA / (1 + (impuesto / 100));

      return {
        nombre: prod.nombre || 'Producto sin nombre',
        cantidad: cantidad,
        precioUnitarioSinIva: precioSinIVA,
        precioUnitarioConIva: precioConIVA,
        subtotalCalculado: precioSinIVA * cantidad
      };
    });
  }

  /**
   * Formatear tipo de pago
   */
  formatearTipoPago(tipo: string): string {
    const tipos: { [key: string]: string } = {
      'efectivo': 'Efectivo',
      'pagomovil': 'Pago Móvil',
      'transferencia': 'Transferencia',
      'debito': 'Débito',
      'credito': 'Crédito',
      'zelle': 'Zelle'
    };

    return tipos[tipo] || tipo.charAt(0).toUpperCase() + tipo.slice(1);
  }

  getDescuentoSeguro(): number {
    return this.ventaParaRecibo?.descuento || 0;
  }


  getMontoTotalSeguro(): number {
    if (!this.ventaParaRecibo) return 0;

    // Intentar obtener el total de múltiples fuentes
    const totalDelApi = this.ventaParaRecibo?.total ||
      this.ventaParaRecibo?.montoTotal ||
      this.datosRecibo?.totalVenta ||
      0;

    // Si el total parece incorrecto (menor que subtotal + IVA), calcularlo
    const subtotal = this.getSubtotalSeguro();
    const iva = this.getIvaSeguro();
    const totalCalculado = subtotal + iva;

    // Usar el mayor de los dos valores para evitar errores
    return Math.max(totalDelApi, totalCalculado);
  }

  getSubtotalSeguro(): number {
    return this.ventaParaRecibo?.subtotal ||
      this.datosRecibo?.subtotal ||
      0;
  }

  getIvaSeguro(): number {
    return this.ventaParaRecibo?.totalIva ||
      this.ventaParaRecibo?.iva ||
      this.datosRecibo?.iva ||
      0;
  }

  // Método para obtener la deuda pendiente específica para abono
  getDeudaPendienteAbono(): number {
    if (!this.ventaParaRecibo) return 0;

    // Usar la deuda del API si está disponible (del objeto formaPago)
    if (this.ventaParaRecibo.formaPago?.deudaPendiente !== undefined) {
      return this.ventaParaRecibo.formaPago.deudaPendiente;
    }

    // Si no, calcularlo basado en los datos
    const total = this.getMontoTotalSeguro();
    const pagado = this.getTotalPagadoSeguro();
    const deuda = Math.max(0, total - pagado);

    return deuda;
  }

  // Método para calcular porcentaje
  calcularPorcentajeParaRecibo(): number {
    if (!this.ventaParaRecibo || !this.ventaParaRecibo.total) return 0;

    const total = this.getMontoTotalSeguro();
    const pagado = this.getTotalPagadoSeguro();

    if (total === 0) return 0;

    const porcentaje = (pagado / total) * 100;
    const porcentajeRedondeado = Math.round(porcentaje);

    return porcentajeRedondeado;
  }

  // Método para obtener total pagado
  getTotalPagadoSeguro(): number {
    if (!this.ventaParaRecibo) return 0;

    // Para ventas de contado, usar montoAbonado o sumar métodos
    if (this.ventaParaRecibo.formaPago === 'contado') {
      // Usar montoAbonado si está disponible (como en tu ejemplo: 2685.51)
      if (this.ventaParaRecibo.montoAbonado) {
        return this.ventaParaRecibo.montoAbonado;
      }

      // Fallback: sumar métodos de pago
      const metodos = this.getMetodosPagoContado();
      if (metodos.length > 0) {
        return metodos.reduce((total, metodo) => {
          return total + (metodo.monto_en_moneda_de_venta || metodo.monto || 0);
        }, 0);
      }
    }

    // Para abonos, usar montoAbonado o sumar todos los abonos
    if (this.ventaParaRecibo.formaPago === 'abono') {
      return this.getTotalAbonado(this.ventaParaRecibo);
    }

    // Fallback general
    return this.ventaParaRecibo?.montoAbonado ||
      this.ventaParaRecibo?.formaPagoCompleto?.totalPagadoAhora || 0;
  }

  getDeudaPendienteCashea(): number {
    return this.ventaParaRecibo?.deudaPendiente || 0;
  }

  /**
   * Obtener nombre del nivel Cashea
   */
  obtenerNombreNivelCashea(nivel: string): string {
    const niveles: { [key: string]: string } = {
      'inicial': 'Inicial',
      'intermedio': 'Intermedio',
      'avanzado': 'Avanzado'
    };

    return niveles[nivel] || nivel.charAt(0).toUpperCase() + nivel.slice(1);
  }

  /**
   * Obtener mensaje final según estado
   */
  getMensajeFinal(): string {
    if (!this.ventaParaRecibo) return 'Gracias por su compra';

    if (this.ventaParaRecibo.estado === 'cancelada') {
      return 'Venta cancelada';
    }

    const deuda = this.getDeudaPendiente(this.ventaParaRecibo);

    if (deuda > 0) {
      return 'Pago pendiente por completar';
    }

    return '¡Gracias por su compra!';
  }

  // Método para obtener los abonos agrupados (también funciona para contado)
  getAbonosAgrupados(venta: any): any[] {
    if (!venta?.metodosPago || !Array.isArray(venta.metodosPago)) {
      return [];
    }

    return venta.metodosPago.map((grupo: any) => {
      const primerMetodo = grupo.metodosPago?.[0];
      const fechaAbono = primerMetodo?.fechaRegistro || venta.fecha;

      return {
        numeroPago: grupo.numero_pago || 1,
        fecha: fechaAbono,
        fechaFormateada: this.formatFechaAbono(fechaAbono),
        montoAbonado: grupo.montoAbonado || 0,
        observaciones: grupo.observaciones || '',
        metodosPago: grupo.metodosPago || [],
        cantidadMetodos: grupo.metodosPago?.length || 0,
        metodosDetalle: this.obtenerDetalleMetodosPago(grupo.metodosPago || [])
      };
    });
  }

  // Método para obtener detalles de métodos de pago
  obtenerDetalleMetodosPago(metodosPago: any[]): any[] {
    return metodosPago.map((metodo: any) => ({
      tipo: metodo.tipo || 'efectivo',
      monto: metodo.monto || 0,
      montoEnMonedaVenta: metodo.monto_en_moneda_de_venta || metodo.monto || 0,
      moneda: metodo.moneda_id || 'dolar',
      referencia: metodo.referencia,
      banco: metodo.bancoNombre || metodo.banco,
      fecha: metodo.fechaRegistro
    }));
  }

  // Método para formatear fecha de abono con hora
  formatFechaAbono(fechaString: string | Date): string {
    if (!fechaString) return 'Fecha no disponible';

    const fecha = new Date(fechaString);
    return fecha.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getTotalAbonado(venta: any): number {
    if (!venta?.metodosPago) return 0;

    return venta.metodosPago.reduce((total: number, abono: any) => {
      return total + (abono.montoAbonado || 0);
    }, 0);
  }

  /**
   * Cerrar modal de recibo
   */
  cerrarModalRecibo(): void {
    this.mostrarModalRecibo = false;

    // Limpiar primero la referencia
    this.ventaParaRecibo = null;

    // Luego limpiar otros datos
    this.datosRecibo = null;
    this.cuotasCashea = [];
    this.resumenCashea = { cantidad: 0, total: 0 };
    this.porcentajeAbonadoDelTotal = 0;
  }

  /**
   * Descargar PDF (placeholder - necesitarías una librería como jsPDF)
   */
  descargarPDF(): void {
    this.swalService.showInfo('Información', 'La descarga de PDF estará disponible próximamente');
  }

  /**
   * Compartir por WhatsApp
   */
  compartirWhatsApp(): void {
    const numero = this.datosRecibo?.cliente?.telefono?.replace(/\D/g, '');
    const mensaje = `*NEW VISION LENS*%0A%0A` +
      `*Recibo:* ${this.datosRecibo?.numeroVenta}%0A` +
      `*Cliente:* ${this.datosRecibo?.cliente?.nombre}%0A` +
      `*Fecha:* ${this.datosRecibo?.fecha}%0A` +
      `*Total:* ${this.formatearMoneda(this.datosRecibo?.totalVenta)}%0A%0A` +
      `¡Gracias por su compra!`;

    if (numero) {
      const url = `https://wa.me/58${numero}?text=${mensaje}`;
      window.open(url, '_blank');
    } else {
      this.swalService.showWarning('Atención', 'No se encontró número de teléfono para compartir');
    }
  }

  /**
   * Copiar enlace
   */
  copiarEnlace(): void {
    const enlace = `${window.location.origin}/ventas/recibo/${this.ventaParaRecibo?.key}`;

    navigator.clipboard.writeText(enlace).then(() => {
      this.swalService.showSuccess('Éxito', 'Enlace copiado al portapapeles');
    }).catch(err => {
      console.error('Error al copiar:', err);
      this.swalService.showError('Error', 'No se pudo copiar el enlace');
    });
  }

  /**
   * Scroll al top
   */
  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  getTituloReciboParaHTML(formaPago: string): string {
    switch (formaPago) {
      case 'contado': return 'RECIBO DE VENTA AL CONTADO';
      case 'abono': return 'RECIBO DE ABONO PARCIAL';
      case 'cashea': return 'RECIBO DE PLAN CASHEA';
      default: return 'RECIBO DE VENTA';
    }
  }

  getMensajeFinalParaHTML(formaPago: string): string {
    if (!this.ventaParaRecibo) return 'Gracias por su compra';

    if (this.ventaParaRecibo.estado === 'cancelada') {
      return 'Venta cancelada';
    }

    const deuda = this.getDeudaPendiente(this.ventaParaRecibo);

    if (deuda > 0) {
      return 'Pago pendiente por completar';
    }

    return '¡Gracias por su compra!';
  }

  debeMostrarTotalAPagar(formaPago: string, datos: any): boolean {
    return formaPago === 'abono' || formaPago === 'cashea';
  }

  getTextoTotalAPagarParaHTML(formaPago: string): string {
    switch (formaPago) {
      case 'abono': return 'TOTAL A PAGAR';
      case 'cashea': return 'TOTAL DEL PLAN';
      default: return 'TOTAL';
    }
  }

  getTextoTotalPagadoParaHTML(formaPago: string): string {
    switch (formaPago) {
      case 'abono': return 'ABONADO';
      case 'cashea': return 'PAGADO AHORA';
      default: return 'TOTAL PAGADO';
    }
  }

  private prepararProductosParaImpresion(): any[] {
    if (!this.ventaParaRecibo) {
      return [];
    }

    // Prioridad 1: Usar productosOriginales si están disponibles
    if (this.ventaParaRecibo.productosOriginales &&
      this.ventaParaRecibo.productosOriginales.length > 0) {

      return this.ventaParaRecibo.productosOriginales.map((prod: any) => {
        // Precio unitario sin IVA del API
        const precioUnitarioSinIva = prod.precio_unitario_sin_iva || 0;
        const cantidad = prod.cantidad || 1;

        // Calcular subtotal: precio sin IVA × cantidad
        const subtotal = precioUnitarioSinIva * cantidad;

        return {
          nombre: prod.datos?.nombre || 'Producto sin nombre',
          cantidad: cantidad,
          precio_unitario_sin_iva: precioUnitarioSinIva,
          precio_unitario: prod.precio_unitario || 0,
          subtotal: subtotal,
          total: prod.total || 0,
          tiene_iva: prod.tiene_iva === 1
        };
      });
    }

    return (this.ventaParaRecibo.productos || []).map((prod: any) => {
      const impuesto = this.ventaParaRecibo.impuesto || 16;
      const precioConIVA = prod.precio || 0;
      const cantidad = prod.cantidad || 1;

      // Calcular precio sin IVA
      const precioSinIVA = precioConIVA / (1 + (impuesto / 100));
      const subtotal = precioSinIVA * cantidad;

      return {
        nombre: prod.nombre || 'Producto sin nombre',
        cantidad: cantidad,
        precio_unitario_sin_iva: precioSinIVA,
        precio_unitario: precioConIVA,
        subtotal: subtotal,
        total: prod.total || 0,
        tiene_iva: prod.aplicaIva || false
      };
    });
  }

  crearDatosReciboReal(): any {
    if (!this.ventaParaRecibo) {
      console.error('Error: No hay ventaParaRecibo definida');
      return null;
    }

    const fecha = new Date(this.ventaParaRecibo.fecha);
    const totalPagado = this.getTotalPagadoVenta(this.ventaParaRecibo);
    const deudaPendiente = this.getDeudaPendiente(this.ventaParaRecibo);
    const porcentajePagado = this.ventaParaRecibo.total > 0
      ? Math.round((totalPagado / this.ventaParaRecibo.total) * 100)
      : 0;

    const productosParaImprimir = this.prepararProductosParaImpresion();

    return {
      // Información básica
      numeroVenta: this.ventaParaRecibo.numeroControl || `V-${this.ventaParaRecibo.key?.substring(0, 8)}`,
      fecha: this.formatFecha(fecha),
      hora: fecha.toLocaleTimeString('es-VE', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      vendedor: this.ventaParaRecibo.asesor?.nombre || 'No asignado',

      // Cliente
      cliente: {
        nombre: this.ventaParaRecibo.paciente?.nombre || 'CLIENTE GENERAL',
        cedula: this.ventaParaRecibo.paciente?.cedula || 'N/A',
        telefono: this.ventaParaRecibo.paciente?.telefono || 'N/A'
      },

      // Productos CORREGIDOS para impresión
      productos: productosParaImprimir,

      // Métodos de pago
      metodosPago: (this.ventaParaRecibo.metodosPago || []).map((metodo: any) => ({
        tipo: metodo.tipo || 'efectivo',
        monto: metodo.monto || 0,
        moneda: metodo.moneda_id || this.ventaParaRecibo.moneda || 'dolar',
        referencia: metodo.referencia,
        banco: metodo.banco || metodo.bancoNombre
      })),

      // Totales
      totales: {
        subtotal: this.ventaParaRecibo.subtotal || 0,
        descuento: this.ventaParaRecibo.descuento || 0,
        iva: this.ventaParaRecibo.totalIva || 0,
        total: this.ventaParaRecibo.total || 0,
        totalPagado: totalPagado
      },

      // Configuración
      configuracion: {
        formaPago: this.ventaParaRecibo.formaPago || 'contado',
        moneda: this.ventaParaRecibo.moneda || 'dolar',
        observaciones: this.ventaParaRecibo.observaciones
      },

      // Cashea (si aplica)
      cashea: this.ventaParaRecibo.formaPago === 'cashea' ? {
        nivel: this.ventaParaRecibo.nivelCashea,
        inicial: this.ventaParaRecibo.montoInicial || 0,
        cantidadCuotas: this.ventaParaRecibo.cantidadCuotas || 0,
        montoPorCuota: this.ventaParaRecibo.montoPorCuota || 0,
        cuotasAdelantadas: this.ventaParaRecibo.cuotasAdelantadas?.length || 0,
        montoAdelantado: this.ventaParaRecibo.totalAdelantado || 0,
        deudaPendiente: this.ventaParaRecibo.deudaPendiente || 0
      } : null,

      // Abono (si aplica)
      abono: this.ventaParaRecibo.formaPago === 'abono' ? {
        montoAbonado: this.ventaParaRecibo.montoAbonado || 0,
        deudaPendiente: deudaPendiente,
        porcentajePagado: porcentajePagado
      } : null
    };
  }

  // Método para generar cuotas Cashea (si no existe en historial)
  generarCuotasCashea(): void {
    if (!this.ventaParaRecibo || this.ventaParaRecibo.formaPago !== 'cashea') return;

    const cuotas = [];
    const totalCuotas = this.ventaParaRecibo.cantidadCuotas || 0;
    const montoPorCuota = this.ventaParaRecibo.montoPorCuota || 0;
    const cuotasAdelantadas = this.ventaParaRecibo.cuotasAdelantadas || [];

    // Fecha base (fecha de la venta)
    const fechaBase = new Date(this.ventaParaRecibo.fecha);

    for (let i = 1; i <= totalCuotas; i++) {
      const fechaCuota = new Date(fechaBase);
      fechaCuota.setMonth(fechaBase.getMonth() + i);

      const esAdelantada = cuotasAdelantadas.some((c: any) => c.numero === i);

      cuotas.push({
        numero: i,
        fecha: this.formatFecha(fechaCuota),
        monto: montoPorCuota,
        seleccionada: esAdelantada,
        pagada: false
      });
    }

    this.cuotasCashea = cuotas;
  }

  // Método específico para ventas de Cashea
  getMetodosPagoCashea(): any[] {
    if (!this.ventaParaRecibo || this.ventaParaRecibo.formaPago !== 'cashea') {
      return [];
    }

    const metodos: any[] = [];

    if (this.ventaParaRecibo.metodosPago && Array.isArray(this.ventaParaRecibo.metodosPago)) {
      this.ventaParaRecibo.metodosPago.forEach((grupo: any) => {
        if (grupo.metodosPago && Array.isArray(grupo.metodosPago)) {
          grupo.metodosPago.forEach((metodo: any) => {
            if (metodo && metodo.tipo) {
              metodos.push({
                tipo: metodo.tipo || 'efectivo',
                monto: metodo.monto || 0,
                monto_en_moneda_de_venta: metodo.monto_en_moneda_de_venta || metodo.monto,
                moneda: metodo.moneda_id || this.ventaParaRecibo.moneda || 'dolar',
                referencia: metodo.referencia,
                banco: metodo.bancoNombre || metodo.banco,
                fechaRegistro: metodo.fechaRegistro
              });
            }
          });
        }
      });
    }

    return metodos;
  }

  generarReciboHTML(datos: any): string {
    if (!datos) {
      datos = this.crearDatosReciboReal();
    }

    const formaPago = datos.configuracion?.formaPago || 'contado';
    const tituloRecibo = this.getTituloReciboParaHTML(formaPago);
    const mensajeFinal = this.getMensajeFinalParaHTML(formaPago);

    // Obtener métodos de pago según tipo
    const metodosPago = this.getMetodosPagoParaTipo(formaPago);

    // Determinar si mostrar "Total a pagar" según la forma de pago
    const mostrarTotalAPagar = this.debeMostrarTotalAPagar(formaPago, datos);
    const textoTotalAPagar = this.getTextoTotalAPagarParaHTML(formaPago);

    // CREAR FUNCIONES LOCALES
    const formatearMonedaLocal = (monto: number | null | undefined, moneda?: string) => {
      return this.formatearMoneda(monto, moneda);
    };

    const formatearTipoPagoLocal = (tipo: string) => {
      return this.formatearTipoPago(tipo);
    };

    // GENERAR SECCIÓN DE MÉTODOS DE PAGO
    const generarMetodosPagoHTML = () => {
      if (!metodosPago || metodosPago.length === 0) return '';
      return `
      <div style="margin-bottom: 12px;">
        <h6 style="font-weight: bold; margin-bottom: 6px; color: #2c5aa0; border-bottom: 1px solid #2c5aa0; padding-bottom: 2px;">MÉTODOS DE PAGO</h6>
        ${metodosPago.map((metodo: any, index: number) => `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; padding: 2px 0; border-bottom: 1px dashed #dee2e6; font-size: 12px;">
            <span>
              <span style="background: #2c5aa0; color: white; padding: 1px 3px; border-radius: 2px; font-size: 7px; margin-right: 3px;">
                ${formatearTipoPagoLocal(metodo.tipo)}
              </span>
              ${formatearMonedaLocal(metodo.monto_en_moneda_de_venta || metodo.monto, metodo.moneda)}
              ${metodo.referencia ? `<span style="color: #666; margin-left: 3px;">(Ref: ${metodo.referencia})</span>` : ''}
              ${metodo.banco ? `<span style="color: #666; margin-left: 3px;">- ${metodo.banco}</span>` : ''}
            </span>
            <small style="color: #666;">#${index + 1}</small>
          </div>
        `).join('')}
      </div>
    `;
    };

    // GENERAR SECCIÓN DE CONTADO
    const generarContadoHTML = () => {
      if (formaPago !== 'contado') return '';

      return `
      <div class="resumen-venta page-break-avoid">
        <h6 style="font-weight: bold; margin-bottom: 6px; color: #2c5aa0; border-bottom: 1px solid #2c5aa0; padding-bottom: 2px;">RESUMEN DE VENTA</h6>
        
        <div style="background: #f8f9fa; padding: 8px; border-radius: 3px; margin: 6px 0; border-left: 2px solid #198754;">
          <!-- Forma de pago -->
          <div style="text-align: center; margin-bottom: 8px;">
            <span style="background: #198754; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">CONTADO</span>
          </div>

          <!-- Métodos de pago -->
          ${generarMetodosPagoHTML()}

          <!-- Total pagado -->
          <div style="text-align: center; margin-top: 8px;">
            <strong style="display: block; margin-bottom: 2px; font-size: 9px;">TOTAL PAGADO</strong>
            <div style="font-size: 12px; font-weight: bold; color: #198754;">
              ${formatearMonedaLocal(datos.totales.totalPagado)}
            </div>
            <small style="color: #666; font-size: 7px;">El pago ha sido realizado en su totalidad</small>
          </div>
        </div>
      </div>
    `;
    };

    // GENERAR SECCIÓN DE CASHEA
    const generarCasheaHTML = () => {
      if (formaPago !== 'cashea' || !datos.cashea) return '';

      return `
      <div class="resumen-venta page-break-avoid">
        <h6 style="font-weight: bold; margin-bottom: 6px; color: #2c5aa0; border-bottom: 1px solid #2c5aa0; padding-bottom: 2px;">RESUMEN DE VENTA</h6>
        
        <div style="background: #f8f9fa; padding: 8px; border-radius: 3px; margin: 6px 0; border-left: 2px solid #0dcaf0;">
          <!-- Forma de pago -->
          <div style="text-align: center; margin-bottom: 8px;">
            <span style="background: #0dcaf0; color: black; padding: 2px 6px; border-radius: 3px; font-size: 10px;">PLAN CASHEA</span>
          </div>

          <!-- Información del plan Cashea -->
          <div style="text-align: center; margin-bottom: 8px;">
            <div>
              <div style="margin-bottom: 4px;">
                <small style="color: #666; font-size: 7px;">NIVEL</small>
                <div style="font-weight: bold; color: #2c5aa0; font-size: 10px;">
                  ${this.obtenerNombreNivelCashea(datos.cashea.nivel)}
                </div>
              </div>
            </div>
          </div>

          <!-- Métodos de pago -->
          ${generarMetodosPagoHTML()}

          <!-- Desglose de pagos -->
          <div>
            <h6 style="text-align: center; margin-bottom: 8px; font-weight: bold; color: #2c5aa0; font-size: 9px;">DESGLOSE DE PAGOS</h6>

            <!-- Pago inicial -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding: 4px 0; border-bottom: 1px dashed #dee2e6;">
              <div style="text-align: center; width: 50%;">
                <strong style="font-size: 12px;">Pago Inicial</strong>
              </div>
              <div style="text-align: center; width: 50%;">
                <strong style="font-size: 12px;">${formatearMonedaLocal(datos.cashea.inicial)}</strong>
              </div>
            </div>

            <!-- Cuotas adelantadas -->
            ${datos.cashea.cuotasAdelantadas > 0 ? `
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding: 4px 0; border-bottom: 1px dashed #dee2e6;">
                <div style="text-align: center; width: 50%;">
                  <strong style="font-size: 12px;">${datos.cashea.cuotasAdelantadas} Cuota${datos.cashea.cuotasAdelantadas > 1 ? 's' : ''} Adelantada${datos.cashea.cuotasAdelantadas > 1 ? 's' : ''}</strong>
                </div>
                <div style="text-align: center; width: 50%;">
                  <strong style="font-size: 12px;">${formatearMonedaLocal(datos.cashea.montoAdelantado)}</strong>
                </div>
              </div>
            ` : ''}

            <!-- Total pagado ahora -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 6px; border-top: 1px solid #ccc;">
              <div style="text-align: center; width: 50%;">
                <strong style="font-size: 9px;">TOTAL PAGADO AHORA:</strong>
              </div>
              <div style="text-align: center; width: 50%;">
                <strong style="font-size: 9px; color: #198754;">
                  ${formatearMonedaLocal(datos.totales.totalPagado)}
                </strong>
              </div>
            </div>
          </div>

          <!-- Resumen de cuotas -->
          <div style="display: flex; justify-content: center; gap: 15px; margin-top: 8px; text-align: center;">
            <div>
              <small style="color: #666; font-size: 7px;">CUOTAS PENDIENTES</small>
              <div style="font-weight: bold; color: #ffc107; font-size: 10px;">
                ${datos.cashea.cantidadCuotas - datos.cashea.cuotasAdelantadas}
              </div>
              <div style="font-size: 7px; color: #666; margin-top: 1px;">
                ${formatearMonedaLocal(datos.cashea.montoPorCuota)} c/u
              </div>
            </div>
            <div>
              <small style="color: #666; font-size: 7px;">DEUDA PENDIENTE</small>
              <div style="font-weight: bold; color: #dc3545; font-size: 10px;">
                ${formatearMonedaLocal(datos.cashea.deudaPendiente)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    };

    // GENERAR SECCIÓN DE ABONO
    const generarAbonoHTML = () => {
      if (formaPago !== 'abono' || !datos.abono) return '';

      // Obtener abonos agrupados
      const abonosAgrupados = this.getAbonosAgrupadosPublico(this.ventaParaRecibo);

      return `
      <div class="resumen-venta page-break-avoid">
        <h6 style="font-weight: bold; margin-bottom: 6px; color: #2c5aa0; border-bottom: 1px solid #2c5aa0; padding-bottom: 2px;">HISTORIAL DE ABONOS</h6>
        
        <div style="background: #f8f9fa; padding: 8px; border-radius: 3px; margin: 6px 0; border-left: 2px solid #ffc107;">
          <!-- Forma de pago -->
          <div style="text-align: center; margin-bottom: 8px;">
            <span style="background: #ffc107; color: black; padding: 2px 6px; border-radius: 3px; font-size: 10px;">ABONO PARCIAL</span>
          </div>

          <!-- Tabla de abonos -->
          ${abonosAgrupados.length > 0 ? `
            <div style="margin-bottom: 12px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                  <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                    <th style="padding: 4px; text-align: center; width: 15%;"># Abono</th>
                    <th style="padding: 4px; text-align: left; width: 25%;">Fecha</th>
                    <th style="padding: 4px; text-align: left; width: 40%;">Métodos de Pago</th>
                    <th style="padding: 4px; text-align: right; width: 20%;">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  ${abonosAgrupados.map((abono: any, index: number) => `
                    <tr style="border-bottom: 1px solid #dee2e6;">
                      <td style="padding: 4px; text-align: center;">
                        <span style="background: #6c757d; color: white; padding: 1px 4px; border-radius: 2px; font-size: 7px;">
                          ${abono.numeroPago}
                        </span>
                      </td>
                      <td style="padding: 4px;">${abono.fechaFormateada}</td>
                      <td style="padding: 4px;">
                        ${abono.metodosDetalle.map((metodo: any, idx: number) => `
                          <div style="margin-bottom: 1px;">
                            ${formatearTipoPagoLocal(metodo.tipo)}: 
                            ${formatearMonedaLocal(metodo.montoEnMonedaVenta || metodo.monto, metodo.moneda)}
                            ${metodo.referencia ? `(Ref: ${metodo.referencia})` : ''}
                            ${metodo.banco ? `- ${metodo.banco}` : ''}
                          </div>
                        `).join('')}
                      </td>
                      <td style="padding: 4px; text-align: right; font-weight: bold;">
                        ${formatearMonedaLocal(abono.montoAbonado, this.ventaParaRecibo.moneda)}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="background: #d4edda; font-weight: bold;">
                    <td colspan="3" style="padding: 4px; text-align: right;">TOTAL ABONADO:</td>
                    <td style="padding: 4px; text-align: right;">
                      ${formatearMonedaLocal(this.getTotalAbonadoPublico(this.ventaParaRecibo), this.ventaParaRecibo.moneda)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ` : ''}

          <!-- Resumen financiero -->
          <div style="background: white; padding: 8px; border-radius: 3px; border: 1px solid #e9ecef; margin: 6px 0;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px;">
              <div style="text-align: center;">
                <div style="font-size: 7px; color: #666; margin-bottom: 2px;">TOTAL A PAGAR</div>
                <div style="font-size: 12px; font-weight: bold; color: #2c5aa0;">
                  ${formatearMonedaLocal(datos.totales.total)}
                </div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 7px; color: #666; margin-bottom: 2px;">DEUDA PENDIENTE</div>
                <div style="font-size: 12px; font-weight: bold; color: #dc3545;">
                  ${formatearMonedaLocal(datos.abono.deudaPendiente)}
                </div>
              </div>
            </div>
            
            <div style="text-align: center;">
              <div style="font-size: 7px; color: #666; margin-bottom: 2px;">PORCENTAJE PAGADO</div>
              <div style="font-size: 12px; font-weight: bold; color: #198754; margin-bottom: 4px;">
                ${Math.round(datos.abono.porcentajePagado)}%
              </div>
              <div style="background: #e9ecef; border-radius: 4px; overflow: hidden; height: 4px; margin: 0 auto; width: 60%;">
                <div style="background: #198754; height: 100%; width: ${datos.abono.porcentajePagado}%;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    };

    // DETERMINAR QUÉ SECCIÓN MOSTRAR
    const seccionResumenHTML = formaPago === 'contado' ? generarContadoHTML() :
      formaPago === 'cashea' ? generarCasheaHTML() :
        formaPago === 'abono' ? generarAbonoHTML() : '';

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recibo - ${datos.numeroVenta}</title>
    <style>
        /* Estilos CSS existentes se mantienen igual */
        @page {
            margin: 0;
            size: A4;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            font-size: 10px;
            line-height: 1.15;
            color: #333;
            background: white;
            padding: 20mm 10mm 10mm 10mm;
            width: 210mm;
            height: 297mm;
            margin: 0 auto;
        }
        
        .recibo-container {
            width: 100%;
            max-width: 190mm;
            margin: 0 auto;
            background: white;
            padding: 0;
            height: auto;
            max-height: 257mm;
            overflow: hidden;
        }
        
        .recibo-header {
            text-align: center;
            border-bottom: 2px solid #2c5aa0;
            padding-bottom: 6px;
            margin-bottom: 8px;
        }
        
        .empresa-nombre {
            font-size: 16px;
            font-weight: bold;
            color: #2c5aa0;
            margin-bottom: 2px;
        }
        
        .empresa-info {
            font-size: 12px;
            color: #666;
            margin-bottom: 1px;
            line-height: 1.1;
        }
        
        .titulo-venta {
            font-size: 12px;
            font-weight: 600;
            color: #2c5aa0;
            margin: 6px 0 2px 0;
        }
        
        .info-rapida {
            background: #f8f9fa;
            padding: 4px;
            border-radius: 2px;
            border: 1px solid #dee2e6;
            margin-bottom: 8px;
            font-size: 12px;
        }
        
        .cliente-compacto {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-left: 2px solid #2c5aa0;
            padding: 6px;
            font-size: 12px;
            margin-bottom: 8px;
            border-radius: 2px;
        }
        
        .tabla-productos {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
            font-size: 12px;
        }
        
        .tabla-productos th {
            background: #2c5aa0;
            color: white;
            font-weight: 600;
            padding: 3px 4px;
            text-align: left;
            border: 1px solid #dee2e6;
            font-size: 12px;
        }
        
        .tabla-productos td {
            border: 1px solid #dee2e6;
            padding: 2px 3px;
            vertical-align: middle;
            font-size: 12px;
        }
        
        .text-center { text-align: center; }
        .text-end { text-align: right; }
        
        .resumen-cashea {
            background: #f8f9fa;
            padding: 6px;
            border-radius: 3px;
            margin: 6px 0;
            border-left: 2px solid #0dcaf0;
        }
        
        .resumen-abono {
            background: #f8f9fa;
            padding: 6px;
            border-radius: 3px;
            margin: 6px 0;
            border-left: 2px solid #ffc107;
        }
        
        .resumen-contado {
            background: #f8f9fa;
            padding: 6px;
            border-radius: 3px;
            margin: 6px 0;
            border-left: 2px solid #198754;
        }
        
        .text-danger { color: #dc3545; }
        .text-success { color: #198754; }
        .text-warning { color: #ffc107; }
        .text-primary { color: #2c5aa0; }
        .text-muted { color: #666; }
        
        .badge {
            display: inline-block;
            padding: 1px 3px;
            font-size: 7px;
            font-weight: 600;
            line-height: 1;
            text-align: center;
            white-space: nowrap;
            vertical-align: baseline;
            border-radius: 1px;
        }
        
        .bg-primary { background-color: #2c5aa0; color: white; }
        .bg-success { background-color: #198754; color: white; }
        .bg-info { background-color: #0dcaf0; color: black; }
        .bg-warning { background-color: #ffc107; color: black; }
        
        .fw-bold { font-weight: bold; }
        .small { font-size: 7px; }
        .fs-6 { font-size: 10px; }

        .page-break-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
        }

        @media print {
            body {
                padding: 20mm 10mm 10mm 10mm;
                margin: 0;
                width: 210mm;
                height: 297mm;
                font-size: 9px;
            }
            
            .recibo-container {
                border: none;
                padding: 0;
                box-shadow: none;
                max-height: 257mm;
                overflow: hidden;
            }

            @page {
                margin: 0;
                size: A4;
            }
            
            body {
                margin: 0;
                -webkit-print-color-adjust: exact;
            }
        }
    </style>
</head>
<body>
    <div class="recibo-container page-break-avoid">
        <!-- Encabezado -->
        <div class="recibo-header page-break-avoid">
            <div class="empresa-nombre">NEW VISION LENS</div>
            <div class="empresa-info">C.C. Candelaria, Local PB-04, Guarenas | Tel: 0212-365-39-42</div>
            <div class="empresa-info">RIF: J-123456789 | newvisionlens2020@gmail.com</div>
            <div class="titulo-venta">${tituloRecibo}</div>
        </div>

        <!-- Información rápida -->
        <div class="info-rapida page-break-avoid">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px;">
                <div><strong>Recibo:</strong> ${datos.numeroVenta}</div>
                <div><strong>Fecha:</strong> ${datos.fecha}</div>
                <div><strong>Hora:</strong> ${datos.hora}</div>
                <div><strong>Vendedor:</strong> ${datos.vendedor}</div>
            </div>
        </div>

        <!-- Cliente -->
        <div class="cliente-compacto page-break-avoid">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
                <div><strong>Cliente:</strong> ${datos.cliente.nombre}</div>
                <div><strong>Cédula:</strong> ${datos.cliente.cedula}</div>
                <div><strong>Teléfono:</strong> ${datos.cliente.telefono}</div>
            </div>
        </div>

        <!-- Productos -->
        <div class="productos-compactos page-break-avoid">
            <h6 style="font-weight: bold; margin-bottom: 6px; color: #2c5aa0; border-bottom: 1px solid #2c5aa0; padding-bottom: 2px;">PRODUCTOS</h6>
            <table class="tabla-productos">
                <thead>
                    <tr>
                        <th width="5%" class="text-center">#</th>
                        <th width="55%">Descripción</th>
                        <th width="10%" class="text-center">Cant</th>
                        <th width="15%" class="text-end">P. Unitario</th>
                        <th width="15%" class="text-end">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${datos.productos && datos.productos.length > 0
        ? datos.productos.map((producto: any, index: number) => {
          const precioUnitario = producto.precio_unitario_sin_iva || 0;
          const subtotal = producto.subtotal || 0;
          return `
                                <tr>
                                    <td class="text-center">${index + 1}</td>
                                    <td>${producto.nombre}</td>
                                    <td class="text-center">${producto.cantidad || 1}</td>
                                    <td class="text-end">${formatearMonedaLocal(precioUnitario)}</td>
                                    <td class="text-end">${formatearMonedaLocal(subtotal)}</td>
                                </tr>
                            `;
        }).join('')
        : `
                            <tr>
                                <td colspan="5" class="text-center text-muted">No hay productos registrados</td>
                            </tr>
                        `
      }
                </tbody>
            </table>
        </div>

        <!-- SECCIÓN DE RESUMEN (CONTADO/CASHEA/ABONO) -->
        ${seccionResumenHTML}

        <!-- Totales -->
        <div class="totales-compactos page-break-avoid">
            <div style="display: flex; justify-content: flex-end;">
                <div style="width: 50%;">
                    <table style="width: 100%;">
                        <tr>
                            <td class="fw-bold" style="font-size: 10px;">Subtotal:</td>
                            <td class="text-end" style="font-size: 10px;">${formatearMonedaLocal(datos.totales.subtotal)}</td>
                        </tr>
                        <tr>
                            <td class="fw-bold" style="font-size: 10px;">Descuento:</td>
                            <td class="text-end text-danger" style="font-size: 10px;">- ${formatearMonedaLocal(datos.totales.descuento)}</td>
                        </tr>
                        <tr>
                            <td class="fw-bold" style="font-size: 10px;">IVA:</td>
                            <td class="text-end" style="font-size: 10px;">${formatearMonedaLocal(datos.totales.iva)}</td>
                        </tr>
                        ${mostrarTotalAPagar ? `
                            <tr class="table-info">
                                <td class="fw-bold" style="font-size: 11px;">${textoTotalAPagar}:</td>
                                <td class="text-end fw-bold" style="font-size: 11px;">${formatearMonedaLocal(datos.totales.total)}</td>
                            </tr>
                        ` : ''}
                        <tr class="table-success">
                            <td class="fw-bold" style="font-size: 11px;">${this.getTextoTotalPagadoParaHTML(formaPago)}:</td>
                            <td class="text-end fw-bold" style="font-size: 11px;">${formatearMonedaLocal(datos.totales.totalPagado)}</td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>

        <!-- Observaciones -->
        ${datos.configuracion?.observaciones ? `
            <div class="observaciones-compactas page-break-avoid">
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 4px; border-radius: 2px; font-size: 12px;">
                    <strong>Observación:</strong> ${datos.configuracion.observaciones}
                </div>
            </div>
        ` : ''}
       </br></br>
        <!-- Términos y condiciones -->
        <div class="terminos-compactos page-break-avoid">
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 6px;">
                <div>
                    <p style="margin-bottom: 2px;">
                        <i class="bi bi-exclamation-triangle"></i>
                        Pasados 30 días no nos hacemos responsables de trabajos no retirados
                    </p>
                </div>
                <div style="text-align: right;">
                    <small>${new Date().getFullYear()} © New Vision Lens</small>
                </div>
            </div>
        </div>

        <!-- Mensaje final -->
        <div class="mensaje-final page-break-avoid">
            <i class="bi bi-check-circle"></i>
            ${mensajeFinal}
        </div>
    </div>
</body>
</html>
  `;
  }

  imprimirRecibo(): void {
    // Verificar primero que tengamos los datos necesarios
    if (!this.ventaParaRecibo) {
      console.error('Error: No hay venta seleccionada para imprimir recibo');
      this.swalService.showError('Error', 'No hay venta seleccionada. Primero seleccione una venta.');
      return;
    }

    // Asegurarse de que tenemos los datos del recibo
    if (!this.datosRecibo) {
      this.datosRecibo = this.crearDatosReciboReal();
    }

    // Validar que los datos tengan la estructura correcta
    if (!this.datosRecibo || !this.datosRecibo.productos || !Array.isArray(this.datosRecibo.productos)) {
      console.error('Error: Datos del recibo incompletos o inválidos:', this.datosRecibo);

      // Intentar recrear los datos
      try {
        this.datosRecibo = this.crearDatosReciboReal();

        if (!this.datosRecibo || !this.datosRecibo.productos) {
          this.swalService.showError('Error', 'No se pudieron generar los datos del recibo.');
          return;
        }
      } catch (error) {
        console.error('Error al recrear datos del recibo:', error);
        this.swalService.showError('Error', 'Error interno al preparar el recibo.');
        return;
      }
    }

    // Generar cuotas Cashea si no existen
    if (this.ventaParaRecibo?.formaPago === 'cashea' && (!this.cuotasCashea || this.cuotasCashea.length === 0)) {
      this.generarCuotasCashea();
    }

    const datos = this.datosRecibo;
    const htmlContent = this.generarReciboHTML(datos);

    const ventanaImpresion = window.open('', '_blank', 'width=400,height=600');

    if (!ventanaImpresion) {
      this.swalService.showError('Error', 'No se pudo abrir la ventana de impresión. Permite ventanas emergentes.');
      return;
    }

    ventanaImpresion.document.write(htmlContent);
    ventanaImpresion.document.close();

    // Esperar a que el contenido se cargue completamente
    ventanaImpresion.onload = () => {
      setTimeout(() => {
        try {
          ventanaImpresion.focus();

          ventanaImpresion.onafterprint = () => {
            setTimeout(() => {
              ventanaImpresion.close();
            }, 100);
          };

          ventanaImpresion.print();

        } catch (error) {
          console.error('Error al imprimir:', error);
          this.swalService.showInfo(
            'Recibo listo',
            'El recibo se ha generado. Usa Ctrl+P para imprimir manualmente.'
          );

          setTimeout(() => {
            ventanaImpresion.close();
          }, 2000);
        }
      }, 500);
    };

    setTimeout(() => {
      if (!ventanaImpresion.closed) {
        ventanaImpresion.close();
      }
    }, 10000);
  }

  // En tu componente TypeScript
  getIconoMetodoPago(tipo: string): string {
    switch (tipo?.toLowerCase()) {
      case 'efectivo':
        return 'bi-cash';
      case 'debito':
        return 'bi-credit-card';
      case 'credito':
        return 'bi-credit-card-fill';
      case 'pagomovil':
        return 'bi-phone';
      case 'transferencia':
        return 'bi-bank';
      case 'zelle':
        return 'bi-currency-dollar';
      default:
        return 'bi-question-circle';
    }
  }

  // Método para obtener productos con información de precios base
  getProductosSegurosDetalle(): any[] {
    if (!this.selectedVenta) {
      return [];
    }

    // Usar productos originales del API si están disponibles
    if (this.selectedVenta.productosOriginales &&
      this.selectedVenta.productosOriginales.length > 0) {

      return this.selectedVenta.productosOriginales.map((prod: any) => {
        const precioUnitarioSinIva = prod.precio_unitario_sin_iva || 0;
        const cantidad = prod.cantidad || 1;
        const tieneIva = prod.tiene_iva === 1;
        const precioUnitarioConIva = prod.precio_unitario || 0;
        const totalProducto = prod.total || 0;

        // Calcular IVA aplicado POR UNIDAD
        const ivaPorUnidad = tieneIva ? precioUnitarioConIva - precioUnitarioSinIva : 0;

        // Calcular IVA TOTAL para el producto (ivaPorUnidad × cantidad)
        const ivaTotalProducto = ivaPorUnidad * cantidad;

        const porcentajeIva = this.selectedVenta?.impuesto || 16;

        return {
          id: prod.datos?.id,
          nombre: prod.datos?.nombre || 'Producto sin nombre',
          codigo: prod.datos?.codigo || 'N/A',
          cantidad: cantidad,
          precioUnitarioSinIva: precioUnitarioSinIva,
          precioUnitarioConIva: precioUnitarioConIva,
          tieneIva: tieneIva,
          ivaPorUnidad: ivaPorUnidad,      // IVA por unidad
          ivaTotalProducto: ivaTotalProducto,  // IVA total (cantidad × ivaPorUnidad)
          porcentajeIva: porcentajeIva,
          total: totalProducto,
          // Para verificación
          subtotalSinIva: precioUnitarioSinIva * cantidad,
          subtotalConIva: precioUnitarioConIva * cantidad
        };
      });
    }

    // Fallback a productos procesados
    return (this.selectedVenta.productos || []).map((prod: any, index: number) => {
      const precioUnitario = prod.precio || 0;
      const cantidad = prod.cantidad || 1;
      const tieneIva = prod.aplicaIva || false;
      const impuesto = this.selectedVenta.impuesto || 16;
      const totalProducto = prod.total || precioUnitario * cantidad;

      // Calcular precio sin IVA
      const precioSinIva = precioUnitario / (1 + (impuesto / 100));
      const ivaPorUnidad = precioUnitario - precioSinIva;
      const ivaTotalProducto = ivaPorUnidad * cantidad;

      return {
        id: prod.id || `prod-${index}`,
        nombre: prod.nombre || 'Producto sin nombre',
        codigo: prod.codigo || 'N/A',
        cantidad: cantidad,
        precioUnitarioSinIva: precioSinIva,
        precioUnitarioConIva: precioUnitario,
        tieneIva: tieneIva,
        ivaPorUnidad: ivaPorUnidad,
        ivaTotalProducto: ivaTotalProducto,
        porcentajeIva: impuesto,
        total: totalProducto
      };
    });
  }


  // Métodos auxiliares
  necesitaBanco(tipoPago: string): boolean {
    return tipoPago === 'transferencia' || tipoPago === 'pagomovil';
  }

  necesitaReferencia(tipoPago: string): boolean {
    return tipoPago === 'transferencia' || tipoPago === 'pagomovil' || tipoPago === 'zelle';
  }

  // Método para verificar si hay método efectivo seleccionado
  hayMetodoEfectivoSeleccionado(): boolean {
    if (!this.metodosPagoArray || this.metodosPagoArray.length === 0) {
      return false;
    }

    return this.metodosPagoArray.controls.some(control =>
      control.get('tipo')?.value === 'efectivo'
    );
  }

  // Método para obtener placeholder de referencia
  getPlaceholderReferencia(tipoPago: string): string {
    switch (tipoPago) {
      case 'transferencia':
        return 'Ej: 1234567890 (N° de transferencia)';
      case 'pagomovil':
        return 'Ej: 12345678 (N° de pago móvil)';
      case 'zelle':
        return 'Ej: TRANS123456 (ID de transacción)';
      default:
        return 'N° de referencia';
    }
  }

  // Método para comparar bancos
  compararBanco(banco1: any, banco2: any): boolean {
    return banco1 && banco2 ? banco1.codigo === banco2.codigo : banco1 === banco2;
  }

  // Método para manejar cambio de banco
  onBancoChange(bancoObject: any, index: number): void {
    const metodoControl = this.metodosPagoArray.at(index);
    if (bancoObject) {
      metodoControl.patchValue({
        bancoCodigo: bancoObject.codigo,
        bancoNombre: bancoObject.nombre
      });
    } else {
      metodoControl.patchValue({
        bancoCodigo: null,
        bancoNombre: null
      });
    }
  }

  // Función para marcar todos los controles como tocados
  marcarTodosLosControlesComoTocados(formArray: FormArray): void {
    formArray.controls.forEach((control, index) => {
      if (control instanceof FormGroup) {
        Object.keys(control.controls).forEach(key => {
          const formControl = control.get(key);
          if (formControl) {
            formControl.markAsTouched();
          }
        });
      }
    });
  }

  // Función para verificar si un campo es requerido
  esCampoRequerido(controlName: string, tipoPago: string): boolean {
    switch (controlName) {
      case 'referencia':
        return this.necesitaReferencia(tipoPago);
      case 'bancoObject':
      case 'bancoCodigo':
      case 'bancoNombre':
        return this.necesitaBanco(tipoPago);
      case 'monto':
        return true;
      default:
        return false;
    }
  }

  // Modifica la función validarMetodosPagoAntesDeEnviar
  private validarMetodosPagoAntesDeEnviar(metodosPago: any[]): boolean {
    // Ya validamos todo en validarAntesDeGuardar(), así que aquí solo verificamos conversiones
    let errores: string[] = [];

    const monedaVenta = this.getMonedaVenta();
    let totalCalculado = 0;

    metodosPago.forEach((metodo, index) => {
      try {
        const montoConvertido = this.convertirMonto(
          metodo.monto,
          metodo.moneda,
          monedaVenta
        );
        totalCalculado += montoConvertido;
      } catch (error) {
        errores.push(`Error al convertir monto del método ${index + 1}: ${error}`);
      }
    });

    if (errores.length > 0) {
      this.swalService.showWarning(
        'Errores de conversión',
        `<strong>Por favor corrija los siguientes errores:</strong><br><br>` +
        errores.map(error => `• ${error}`).join('<br>')
      );
      return false;
    }

    return true;
  }

  // Método para determinar si un método está completo
  metodoEstaCompleto(metodoControl: AbstractControl): boolean {
    const tipo = metodoControl.get('tipo')?.value;

    // Si no hay tipo seleccionado, está incompleto
    if (!tipo) return false;

    const monto = metodoControl.get('monto')?.value;

    // Validar monto básico
    if (!monto || monto <= 0) return false;

    // Validar campos específicos según el tipo
    if (this.necesitaBanco(tipo)) {
      const bancoObject = metodoControl.get('bancoObject')?.value;
      if (!bancoObject) return false;
    }

    if (this.necesitaReferencia(tipo)) {
      const referencia = metodoControl.get('referencia')?.value;
      if (!referencia || referencia.trim() === '') return false;
    }

    return true;
  }

  // Método para determinar si un método está completamente vacío
  metodoEstaVacio(metodoControl: AbstractControl): boolean {
    const tipo = metodoControl.get('tipo')?.value;
    const monto = metodoControl.get('monto')?.value;
    const referencia = metodoControl.get('referencia')?.value;
    const banco = metodoControl.get('bancoObject')?.value;

    // Si no tiene ningún valor, está vacío
    return !tipo && !monto && !referencia && !banco;
  }

  // Método para determinar si un método tiene datos parciales
  metodoTieneDatosParciales(metodoControl: AbstractControl): boolean {
    const tipo = metodoControl.get('tipo')?.value;
    const monto = metodoControl.get('monto')?.value;
    const referencia = metodoControl.get('referencia')?.value;
    const banco = metodoControl.get('bancoObject')?.value;

    // Si tiene al menos un dato pero no está completo
    return (tipo || monto || referencia || banco) && !this.metodoEstaCompleto(metodoControl);
  }


  // Método para calcular el porcentaje real del descuento (con respecto al subtotal sin IVA)
  getPorcentajeDescuentoCalculado(venta: any): number {
    const subtotal = venta.subtotal || 0;
    const descuentoMonetario = this.getTotalDescuentoMoneda(venta);

    if (subtotal <= 0 || descuentoMonetario <= 0) {
      return 0;
    }

    // Calcular qué porcentaje representa el descuento monetario sobre el subtotal
    const porcentajeCalculado = (descuentoMonetario / subtotal) * 100;
    return porcentajeCalculado;
  }

  // Método mejorado para obtener el total de descuento en moneda
  getTotalDescuentoMoneda(venta: any): number {
    // Prioridad 1: Usar totalDescuento del API si está disponible
    if (venta.totalDescuento !== undefined && venta.totalDescuento !== null) {
      return venta.totalDescuento;
    }

    // Prioridad 2: Usar descuentoBs si está disponible
    if (venta.descuentoBs !== undefined && venta.descuentoBs !== null) {
      return venta.descuentoBs;
    }

    // Prioridad 3: Calcular basado en porcentaje de descuento
    if (venta.descuento && venta.descuento > 0) {
      // Calcular el descuento sobre el subtotal (antes de IVA)
      const subtotal = venta.subtotal || 0;
      return (subtotal * venta.descuento) / 100;
    }

    return 0;
  }

  // Método para calcular subtotal después del descuento (para verificación)
  getSubtotalDespuesDescuento(venta: any): number {
    const subtotal = venta.subtotal || 0;
    const descuento = this.getTotalDescuentoMoneda(venta);
    return Math.max(0, subtotal - descuento);
  }

  // Método específico para ventas de contado
  getMetodosPagoContado(): any[] {
    if (!this.ventaParaRecibo || this.ventaParaRecibo.formaPago !== 'contado') {
      return [];
    }

    const metodos: any[] = [];

    // Verificar si hay métodos de pago
    if (this.ventaParaRecibo.metodosPago && Array.isArray(this.ventaParaRecibo.metodosPago)) {
      // Recorrer todos los grupos de métodos de pago (puede haber uno o más)
      this.ventaParaRecibo.metodosPago.forEach((grupo: any) => {
        // Para contado, generalmente hay solo un grupo con numero_pago: 1
        if (grupo.metodosPago && Array.isArray(grupo.metodosPago)) {
          // Extraer todos los métodos de pago del grupo
          grupo.metodosPago.forEach((metodo: any) => {
            if (metodo && metodo.tipo) {
              metodos.push({
                tipo: metodo.tipo || 'efectivo',
                monto: metodo.monto || 0,
                monto_en_moneda_de_venta: metodo.monto_en_moneda_de_venta || metodo.monto,
                moneda: metodo.moneda_id || this.ventaParaRecibo.moneda || 'dolar',
                referencia: metodo.referencia,
                banco: metodo.bancoNombre || metodo.banco,
                fechaRegistro: metodo.fechaRegistro
              });
            }
          });
        }
      });
    }

    return metodos;
  }

  // Método mejorado getMetodosPagoSeguros() para compatibilidad
  getMetodosPagoSeguros(): any[] {
    if (!this.ventaParaRecibo) {
      return [];
    }

    // Para contado, usar el método específico
    if (this.ventaParaRecibo.formaPago === 'contado') {
      return this.getMetodosPagoContado();
    }

    // Para abonos, extraer todos los métodos de todos los grupos
    if (this.ventaParaRecibo.formaPago === 'abono') {
      const todosLosMetodos: any[] = [];

      if (this.ventaParaRecibo.metodosPago && Array.isArray(this.ventaParaRecibo.metodosPago)) {
        this.ventaParaRecibo.metodosPago.forEach((grupo: any) => {
          if (grupo.metodosPago && Array.isArray(grupo.metodosPago)) {
            grupo.metodosPago.forEach((metodo: any) => {
              if (metodo && metodo.tipo) {
                todosLosMetodos.push({
                  tipo: metodo.tipo || 'efectivo',
                  monto: metodo.monto || 0,
                  monto_en_moneda_de_venta: metodo.monto_en_moneda_de_venta || metodo.monto,
                  moneda: metodo.moneda_id || this.ventaParaRecibo.moneda || 'dolar',
                  referencia: metodo.referencia,
                  banco: metodo.bancoNombre || metodo.banco,
                  fechaRegistro: metodo.fechaRegistro
                });
              }
            });
          }
        });
      }

      return todosLosMetodos;
    }

    return [];
  }

  // Método para obtener métodos de pago según tipo
  getMetodosPagoParaTipo(tipo: string): any[] {
    switch (tipo) {
      case 'contado':
        return this.getMetodosPagoContado();
      case 'cashea':
        return this.getMetodosPagoCashea();
      case 'abono':
        return this.getMetodosPagoSeguros(); // Ya incluye lógica para abono
      default:
        return [];
    }
  }

  // Método para obtener abonos agrupados (público)
  getAbonosAgrupadosPublico(venta: any): any[] {
    return this.getAbonosAgrupados(venta);
  }

  // Método para obtener total abonado (público)
  getTotalAbonadoPublico(venta: any): number {
    return this.getTotalAbonado(venta);
  }

  // Método para crear estadísticas vacías
  private crearEstadisticasVacias(): any {
    return {
      totalVentas: 0,
      ventasCompletadas: 0,
      ventasPendientes: 0,
      ventasCanceladas: 0,
      montoCompletadas: 0,
      montoPendientes: 0,
      montoCanceladas: 0,
      montoTotalGeneral: 0
    };
  }

  // Método para calcular estadísticas con ventas
  private calcularEstadisticasConVentas(ventas: any[]): void {
    let totalVentas = 0;
    let ventasCompletadas = 0;
    let ventasPendientes = 0;
    let ventasCanceladas = 0;
    let montoCompletadas = 0;
    let montoPendientes = 0;
    let montoCanceladas = 0;
    let montoTotalGeneral = 0;

    ventas.forEach(venta => {
      totalVentas++;

      // Convertir todos los montos a la moneda del sistema para sumar consistentemente
      const monedaVenta = venta.moneda || 'dolar';
      const monedaSistemaNormalizada = this.normalizarMonedaParaVenta(this.monedaSistema);

      // Función para convertir cualquier monto
      const convertirMonto = (monto: number, monedaOrigen: string): number => {
        if (monedaOrigen === monedaSistemaNormalizada) return monto;
        return this.convertirMonto(monto, monedaOrigen, monedaSistemaNormalizada);
      };

      const totalVentaConvertido = convertirMonto(venta.total || 0, monedaVenta);
      montoTotalGeneral += totalVentaConvertido;

      if (venta.estado === 'cancelada') {
        ventasCanceladas++;
        montoCanceladas += totalVentaConvertido;
      } else {
        const deuda = this.getDeudaPendiente(venta);
        const deudaConvertida = convertirMonto(deuda, monedaVenta);

        if (deuda > 0) {
          ventasPendientes++;
          montoPendientes += deudaConvertida;
        } else {
          ventasCompletadas++;
          montoCompletadas += totalVentaConvertido;
        }
      }
    });

    this.estadisticas = {
      totalVentas,
      ventasCompletadas,
      ventasPendientes,
      ventasCanceladas,
      montoCompletadas,
      montoPendientes,
      montoCanceladas,
      montoTotalGeneral
    };

    console.log('📊 Estadísticas calculadas:', this.estadisticas);

    // Forzar actualización de la vista
    this.cdRef.detectChanges();
  }

  recargarEstadisticas(): void {
    this.cargarEstadisticas();
  }

  getCantidadVentasPorTipo(tipo: string): number {
    // Contar ventas por tipo con deuda pendiente
    return this.ventasFiltradas.filter(venta => {
      if (venta.estado === 'cancelada') return false;
      if (venta.formaPago !== tipo) return false;
      return this.getDeudaPendiente(venta) > 0;
    }).length;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private inicializarAnosDisponibles(): void {
    const currentYear = new Date().getFullYear();
    this.anosDisponibles = [];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      this.anosDisponibles.push(i);
    }
  }


  // Método para aplicar período
  aplicarPeriodoResumen(periodo: string): void {
    this.resumenFiltros.periodo = periodo;

    const hoy = new Date();

    switch (periodo) {
      case 'hoy':
        this.resumenFiltros.fechaDesde = this.formatDate(hoy);
        this.resumenFiltros.fechaHasta = this.formatDate(hoy);
        break;
      case 'ayer':
        const ayer = new Date(hoy);
        ayer.setDate(hoy.getDate() - 1);
        this.resumenFiltros.fechaDesde = this.formatDate(ayer);
        this.resumenFiltros.fechaHasta = this.formatDate(ayer);
        break;
      case 'semana':
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - hoy.getDay());
        this.resumenFiltros.fechaDesde = this.formatDate(inicioSemana);
        this.resumenFiltros.fechaHasta = this.formatDate(hoy);
        break;
      case 'mes':
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        this.resumenFiltros.fechaDesde = this.formatDate(inicioMes);
        this.resumenFiltros.fechaHasta = this.formatDate(hoy);
        break;
    }

    this.actualizarResumen();
  }

  activarPeriodoPersonalizado(): void {
    this.resumenFiltros.periodo = 'personalizado';
    // Si no hay fechas, establecer por defecto mes actual
    if (!this.resumenFiltros.fechaDesde) {
      const hoy = new Date();
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      this.resumenFiltros.fechaDesde = this.formatDate(inicioMes);
      this.resumenFiltros.fechaHasta = this.formatDate(hoy);
    }
  }

  // Método para actualizar el resumen
  actualizarResumen(): void {
    this.cargarDatosResumen();
  }

  // Método principal para cargar datos del resumen
  private cargarDatosResumen(): void {
    this.loader.showWithMessage('📊 Calculando resumen financiero...');

    // Crear objeto de filtros para el servicio
    const filtrosResumen = {
      fechaDesde: this.resumenFiltros.fechaDesde,
      fechaHasta: this.resumenFiltros.fechaHasta,
      anio: this.resumenFiltros.anio,
      mes: this.resumenFiltros.mes,
      asesor: this.resumenFiltros.asesor,
      formaPago: this.resumenFiltros.formaPago
    };

    // Aquí deberías llamar a tu servicio para obtener estadísticas financieras
    this.historialVentaService.obtenerEstadisticasFinancieras(filtrosResumen).subscribe({
      next: (response: any) => {
        if (response.message === 'ok') {
          this.resumenData = response.data;
        }
        this.loader.hide();
      },
      error: (error) => {
        console.error('Error al cargar resumen financiero:', error);
        this.loader.hide();
        this.swalService.showError('Error', 'No se pudo cargar el resumen financiero');
      }
    });
  }

  getPeriodoResumenTexto(): string {
    if (this.resumenFiltros.periodo === 'personalizado' && this.resumenFiltros.fechaDesde && this.resumenFiltros.fechaHasta) {
      return `${this.formatFechaLocal(this.resumenFiltros.fechaDesde)} - ${this.formatFechaLocal(this.resumenFiltros.fechaHasta)}`;
    }

    const periodos: { [key: string]: string } = {
      'hoy': 'Hoy',
      'ayer': 'Ayer',
      'semana': 'Esta semana',
      'mes': 'Este mes'
    };

    return periodos[this.resumenFiltros.periodo] || 'Período actual';
  }

  // Métodos para mostrar datos en el modal
  getMontoTotalGeneral(): string {
    return this.formatearMoneda(this.resumenData?.montoTotal || 0, this.monedaSistema);
  }

  getTotalAbonosRecibidos(): string {
    return this.formatearMoneda(this.resumenData?.totalAbonos || 0, this.monedaSistema);
  }

  getDeudaPendienteTotal(): string {
    return this.formatearMoneda(this.resumenData?.deudaPendiente || 0, this.monedaSistema);
  }

  getDeudaPorCashea(): string {
    return this.formatearMoneda(this.resumenData?.deudaCashea || 0, this.monedaSistema);
  }

  getDeudaPorAbonos(): string {
    return this.formatearMoneda(this.resumenData?.deudaAbonos || 0, this.monedaSistema);
  }

  getDeudaPorContadoPendiente(): string {
    return this.formatearMoneda(this.resumenData?.deudaContado || 0, this.monedaSistema);
  }

  getMontoContado(): string {
    return this.formatearMoneda(this.resumenData?.ventasContado?.montoTotal || 0, this.monedaSistema);
  }

  getMontoAbonos(): string {
    return this.formatearMoneda(this.resumenData?.ventasAbono?.montoTotal || 0, this.monedaSistema);
  }

  getMontoCashea(): string {
    return this.formatearMoneda(this.resumenData?.ventasCashea?.montoTotal || 0, this.monedaSistema);
  }

  getMontoCredito(): string {
    return this.formatearMoneda(this.resumenData?.ventasCredito?.montoTotal || 0, this.monedaSistema);
  }

  getCantidadVentasPorFormaPago(formaPago: string): number {
    switch (formaPago) {
      case 'contado': return this.resumenData?.ventasContado?.cantidad || 0;
      case 'abono': return this.resumenData?.ventasAbono?.cantidad || 0;
      case 'cashea': return this.resumenData?.ventasCashea?.cantidad || 0;
      case 'credito': return this.resumenData?.ventasCredito?.cantidad || 0;
      default: return 0;
    }
  }

  getPorcentajeDeuda(tipo: string): number {
    const deudaTotal = this.resumenData?.deudaPendiente || 0;
    if (deudaTotal === 0) return 0;

    let deudaTipo = 0;
    switch (tipo) {
      case 'cashea': deudaTipo = this.resumenData?.deudaCashea || 0; break;
      case 'abono': deudaTipo = this.resumenData?.deudaAbonos || 0; break;
      case 'contado': deudaTipo = this.resumenData?.deudaContado || 0; break;
    }

    return (deudaTipo / deudaTotal) * 100;
  }

  // Métodos para acciones
  generarInformeDesdeModal(): void {
    this.swalService.showInfo('Información', 'La generación de informe Excel estará disponible próximamente');
  }

  descargarResumenPDF(): void {
    this.swalService.showInfo('Información', 'La descarga del resumen PDF estará disponible próximamente');
  }

  getFechaRango(): string {
    if (this.resumenFiltros.fechaDesde && this.resumenFiltros.fechaHasta) {
      return `${this.formatFechaLocal(this.resumenFiltros.fechaDesde)} - ${this.formatFechaLocal(this.resumenFiltros.fechaHasta)}`;
    }
    return 'Período actual';
  }

  // Ajusta también el método hayFiltrosResumenActivos para considerar 0 como "sin filtro"
  hayFiltrosResumenActivos(): boolean {
    return !!(
      this.resumenFiltros.periodo ||
      (this.resumenFiltros.anio && this.resumenFiltros.anio !== 0) ||
      (this.resumenFiltros.mes && this.resumenFiltros.mes !== 0) ||
      this.resumenFiltros.asesor ||
      this.resumenFiltros.formaPago
    );
  }

  // Método para alternar filtros avanzados
  toggleFiltrosAvanzados(): void {
    this.mostrarFiltrosAvanzados = !this.mostrarFiltrosAvanzados;
  }

  // Método para contar filtros activos
  contarFiltrosActivos(): number {
    let count = 0;

    if (this.resumenFiltros.periodo && this.resumenFiltros.periodo !== '') count++;
    if (this.resumenFiltros.anio && this.resumenFiltros.anio !== 0) count++;
    if (this.resumenFiltros.mes && this.resumenFiltros.mes !== 0) count++;
    if (this.resumenFiltros.asesor && this.resumenFiltros.asesor !== '') count++;
    if (this.resumenFiltros.formaPago && this.resumenFiltros.formaPago !== '') count++;

    return count;
  }

  // Método para limpiar todos los filtros
  limpiarTodosLosFiltros(): void {
    this.resumenFiltros = {
      periodo: '',
      fechaDesde: '',
      fechaHasta: '',
      anio: 0,
      mes: 0,
      asesor: '',
      formaPago: ''
    };
    this.actualizarResumen();
  }

  // Métodos para limpiar filtros individuales (ya los tienes, asegúrate que funcionen)
  limpiarFiltroPeriodo(): void {
    this.resumenFiltros.periodo = '';
    this.resumenFiltros.fechaDesde = '';
    this.resumenFiltros.fechaHasta = '';
    this.actualizarResumen();
  }

  limpiarFiltroAnio(): void {
    this.resumenFiltros.anio = 0;
    this.actualizarResumen();
  }

  limpiarFiltroMes(): void {
    this.resumenFiltros.mes = 0;
    this.actualizarResumen();
  }

  limpiarFiltroAsesor(): void {
    this.resumenFiltros.asesor = '';
    this.actualizarResumen();
  }

  limpiarFiltroFormaPago(): void {
    this.resumenFiltros.formaPago = '';
    this.actualizarResumen();
  }

  // Métodos para display
  getPeriodoDisplay(): string {
    const periodos: { [key: string]: string } = {
      'hoy': 'Hoy',
      'ayer': 'Ayer',
      'semana': 'Esta semana',
      'mes': 'Este mes',
      'personalizado': 'Personalizado'
    };
    return periodos[this.resumenFiltros.periodo] || '';
  }

  getMesDisplay(): string {
    if (!this.resumenFiltros.mes || this.resumenFiltros.mes === 0) return '';
    const mesNum = Number(this.resumenFiltros.mes);
    return this.mesesDisponibles[mesNum - 1];
  }

  getFormaPagoDisplay(formaPago: string): string {
    const formas: { [key: string]: string } = {
      'contado': 'Contado',
      'de_contado-pendiente': 'Contado - Pendiente por Pago',
      'abono': 'Abono',
      'cashea': 'Cashea',
      'credito': 'Crédito'
    };
    return formas[formaPago] || formaPago;
  }

  getAsesorNombre(asesorId: string): string {
    const asesor = this.asesores.find(a => a.id.toString() === asesorId.toString());
    return asesor?.nombre || 'Asesor no encontrado';
  }

  // Método para cerrar el modal
  cerrarModal(): void {
    if (this.modalInstance) {
      this.modalInstance.hide();
    }

    // Destruir gráficos al cerrar
    this.destruirGraficos();
  }

  // Método para abrir el modal (actualizado)
  abrirModalResumenFinanciero(): void {
    // Inicializar años disponibles
    alert('Funcionalidad en construccion..');
    return;
    this.inicializarAnosDisponibles();

    // Establecer valores por defecto
    const hoy = new Date();
    this.resumenFiltros = {
      periodo: 'mes',
      fechaDesde: this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
      fechaHasta: this.formatDate(hoy),
      anio: hoy.getFullYear(),
      mes: hoy.getMonth() + 1,
      asesor: '',
      formaPago: ''
    };

    // Ocultar filtros avanzados por defecto
    this.mostrarFiltrosAvanzados = false;

    // Cargar asesores si no están cargados
    if (this.asesores.length === 0) {
      this.cargarEmpleados();
    }

    console.log('📊 Abriendo modal de resumen financiero');

    // Usar Bootstrap vanilla para abrir el modal
    const modalElement = document.getElementById('modalResumenFinanciero');
    if (modalElement) {
      this.modalInstance = new (window as any).bootstrap.Modal(modalElement);
      this.modalInstance.show();
    }

    // Inicializar gráficos después de abrir el modal
    setTimeout(() => {
      this.inicializarGraficosEnModal();
    }, 500);
  }

  // Método para limpiar al cerrar (opcional)
  limpiarModal(): void {
    this.mostrarFiltrosAvanzados = false;
    // Agrega aquí cualquier limpieza adicional
  }

  inicializarGraficosEnModal(): void {
    // Esperar un poco para que el DOM se renderice
    setTimeout(() => {
      this.crearTodosLosGraficos();
    }, 300);
  }

  private crearTodosLosGraficos(): void {
    // Limpiar gráficos anteriores
    this.destruirGraficos();

    // Crear nuevos gráficos
    const simboloMoneda = this.simboloMonedaSistema;

    // 1. Gráfico de Ventas por Día
    const chart1 = this.chartService.crearGraficoVentasPorDia('ventasPorDiaChart', simboloMoneda);
    if (chart1) this.chartInstances.push(chart1);

    // 2. Gráfico de Comparativa Mensual
    const chart2 = this.chartService.crearGraficoComparativaMensual('comparativaMensualChart', simboloMoneda);
    if (chart2) this.chartInstances.push(chart2);

    // 3. Gráfico de Distribución de Forma de Pago
    const chart3 = this.chartService.crearGraficoDistribucionPago('distribucionPagoChart');
    if (chart3) this.chartInstances.push(chart3);

    // 4. Gráfico de Tendencia de Deuda
    const chart4 = this.chartService.crearGraficoTendenciaDeuda('tendenciaDeudaChart', simboloMoneda);
    if (chart4) this.chartInstances.push(chart4);

    // 5. Gráfico de Ventas por Asesor
    const chart5 = this.chartService.crearGraficoVentasPorAsesor('ventasPorAsesorChart', simboloMoneda);
    if (chart5) this.chartInstances.push(chart5);
  }

  // En HistorialVentasComponent - Método corregido
  private destruirGraficos(): void {
    // Opción 1: Usar el método que destruye todos los gráficos
    this.chartService.destruirTodosLosGraficos();

    // Opción 2: Si necesitas destruir gráficos individualmente
    this.chartInstances.forEach(chart => {
      // Necesitas obtener el canvasId del gráfico
      // Esto depende de cómo almacenes la relación entre gráficos y canvasIds
    });

    this.chartInstances = [];
  }

  // Métodos para mostrar información de fechas
  getRangoFechasVentas(): string {
    const hoy = new Date();
    const hace7Dias = new Date();
    hace7Dias.setDate(hoy.getDate() - 6);

    return `${this.formatFecha(hace7Dias.toISOString())} - ${this.formatFecha(hoy.toISOString())}`;
  }

  getTotalVentasPeriodo(): number {
    return this.datosDePrueba?.ventasPorDia?.datos?.reduce((a: number, b: number) => a + b, 0) || 0;
  }

  getMaxVentaDia(): number {
    return Math.max(...(this.datosDePrueba?.ventasPorDia?.datos || [0]));
  }

  getPromedioVentas(): number {
    const total = this.getTotalVentasPeriodo();
    const dias = this.datosDePrueba?.ventasPorDia?.datos?.length || 1;
    return total / dias;
  }

  getTotalDias(): number {
    return this.datosDePrueba?.ventasPorDia?.datos?.length || 0;
  }

  // Métodos para comparativa mensual
  getMesActual(): string {
    return new Date().toLocaleDateString('es-ES', { month: 'long' });
  }

  getMesAnterior(): string {
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() - 1);
    return fecha.toLocaleDateString('es-ES', { month: 'long' });
  }

  getVentasMesActual(): number {
    return this.datosDePrueba?.comparativaMensual?.datosActual?.reduce((a: number, b: number) => a + b, 0) || 0;
  }

  getVentasMesAnterior(): number {
    return this.datosDePrueba?.comparativaMensual?.datosAnterior?.reduce((a: number, b: number) => a + b, 0) || 0;
  }

  getVariacion(): number {
    const actual = this.getVentasMesActual();
    const anterior = this.getVentasMesAnterior();
    if (anterior === 0) return 100;
    return ((actual - anterior) / anterior) * 100;
  }

  getVariacionClase(): string {
    return this.getVariacion() > 0 ? 'text-success' : 'text-danger';
  }

  getPorcentajeMeta(): number {
    const meta = 20000; // Meta mensual
    const actual = this.getVentasMesActual();
    return Math.min((actual / meta) * 100, 100);
  }

  // Métodos para distribución de pagos
  getDistribucionPago(): any[] {
    const datos = this.datosDePrueba?.distribucionFormaPago || { labels: [], datos: [] };
    const total = datos.datos.reduce((a: number, b: number) => a + b, 0);

    return datos.labels.map((label: string, index: number) => ({
      tipo: label,
      monto: datos.datos[index],
      porcentaje: Math.round((datos.datos[index] / total) * 100),
      color: datos.colores?.[index] || '#4361ee'
    }));
  }

  getTotalTransacciones(): number {
    return this.datosDePrueba?.distribucionFormaPago?.datos?.length || 0;
  }

  // Métodos para tendencia de deuda
  getDeudaTotalActual(): number {
    const deudas = this.datosDePrueba?.tendenciaDeuda;
    if (!deudas) return 0;

    const ultimaSemana = deudas.deudaCashea[deudas.deudaCashea.length - 1] || 0;
    return ultimaSemana;
  }

  getVariacionDeuda(): number {
    const deudas = this.datosDePrueba?.tendenciaDeuda;
    if (!deudas || deudas.deudaCashea.length < 2) return 0;

    const actual = deudas.deudaCashea[deudas.deudaCashea.length - 1];
    const anterior = deudas.deudaCashea[deudas.deudaCashea.length - 2];

    if (anterior === 0) return 100;
    return ((actual - anterior) / anterior) * 100;
  }

  getVariacionDeudaClase(): string {
    return this.getVariacionDeuda() > 0 ? 'text-danger' : 'text-success';
  }

  getTiposDeuda(): any[] {
    return [
      { nombre: 'Cashea', monto: 2500, cantidad: 5 },
      { nombre: 'Abonos', monto: 1200, cantidad: 8 },
      { nombre: 'Contado', monto: 300, cantidad: 2 }
    ];
  }

  // Métodos para asesores
  getMejorAsesor(): any {
    const datos = this.datosDePrueba?.ventasPorAsesor;
    if (!datos || !datos.datos.length) return null;

    const maxVentas = Math.max(...datos.datos);
    const index = datos.datos.indexOf(maxVentas);

    return {
      nombre: datos.labels[index],
      ventas: maxVentas
    };
  }

  getTopAsesores(limit: number = 3): any[] {
    const datos = this.datosDePrueba?.ventasPorAsesor;
    if (!datos) return [];

    const asesores = datos.labels.map((label: string, index: number) => ({
      nombre: label,
      ventas: datos.datos[index],
      porcentaje: (datos.datos[index] / Math.max(...datos.datos)) * 100
    }));

    return asesores
      .sort((a, b) => b.ventas - a.ventas)
      .slice(0, limit);
  }

  getTotalAsesores(): number {
    return this.datosDePrueba?.ventasPorAsesor?.labels?.length || 0;
  }

  getRankingBadgeClass(index: number): string {
    switch (index) {
      case 0: return 'bg-gold';
      case 1: return 'bg-silver';
      case 2: return 'bg-bronze';
      default: return 'bg-secondary';
    }
  }

  // Métodos auxiliares
  private get datosDePrueba() {
    return this.chartService.obtenerDatosDePrueba();
  }


  // Métodos para manejar cambios de período en gráficos

  cambiarTendenciaPeriodo(periodo: string): void {
    console.log(`Cambiando período de tendencia a: ${periodo}`);

    // Actualizar el texto del período
    const elemento = document.getElementById('tendenciaPeriodo');
    if (elemento) {
      switch (periodo) {
        case 'semanas':
          elemento.textContent = 'Últimas 4 semanas';
          break;
        case 'meses':
          elemento.textContent = 'Últimos 6 meses';
          break;
        case 'trimestres':
          elemento.textContent = 'Últimos 4 trimestres';
          break;
      }
    }

    // Aquí puedes actualizar los datos del gráfico según el período
    // Por ahora solo mostramos un mensaje
    this.swalService.showInfo('Cambio de período',
      `La tendencia se mostrará por ${periodo}. Esta funcionalidad se implementará próximamente.`);
  }

  cambiarPeriodoComparativa(periodo: string): void {
    console.log(`Cambiando período de comparativa a: ${periodo}`);

    // Actualizar los datos de prueba según el período
    switch (periodo) {
      case 'mes':
        this.chartService.actualizarDatosDePrueba({
          comparativaMensual: {
            labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
            datosActual: [12500, 14200, 13800, 16500, 15800, 17200],
            datosAnterior: [11800, 13000, 12500, 15200, 14500, 16000]
          }
        });
        break;
      case 'trimestre':
        this.chartService.actualizarDatosDePrueba({
          comparativaMensual: {
            labels: ['Q1', 'Q2', 'Q3', 'Q4'],
            datosActual: [40500, 49500, 52000, 58000],
            datosAnterior: [38000, 46500, 49000, 55000]
          }
        });
        break;
      case 'anio':
        this.chartService.actualizarDatosDePrueba({
          comparativaMensual: {
            labels: ['2021', '2022', '2023', '2024'],
            datosActual: [185000, 210000, 240000, 200000],
            datosAnterior: [165000, 190000, 220000, 180000]
          }
        });
        break;
    }

    // Recrear los gráficos con los nuevos datos
    this.recargarGraficos();

    this.swalService.showSuccess('Período cambiado',
      `La comparativa ahora se muestra por ${periodo}.`);
  }

  // Método para recargar gráficos
  private recargarGraficos(): void {
    this.destruirGraficos();
    setTimeout(() => {
      this.inicializarGraficosEnModal();
    }, 300);
  }


  /**
   *  REALIZAR PAGO = FORMA DE PAGO DE CONTADO - PENDIENTE
   */
  mostrarBotonRealizarPago(venta: any): boolean {
    if (!venta || venta.estado === 'cancelada') {
      return false;
    }

    // Usar el valor exacto del API: "de_contado-pendiente"
    const esContadoPendiente = venta.formaPago === 'de_contado-pendiente' &&
      this.getDeudaPendiente(venta) > 0;

    return esContadoPendiente;
  }

  // Método para abrir modal de pago
  abrirModalPagoCompleto(venta: any): void {
    this.selectedVenta = venta;

    // Reinicializar formulario
    this.reinicializarFormularioConDeuda();

    // Establecer el valor de montoAbonado a la deuda total
    const deudaTotal = this.calcularMontoDeuda();
    this.editarVentaForm.patchValue({
      montoAbonado: deudaTotal
    });

    // Limpiar y agregar método de pago
    this.metodosPagoArray.clear();
    this.agregarMetodoPago();

    // Abrir modal
    this.modalService.open(this.realizarPagoModal, {
      centered: true,
      size: 'lg',
      backdrop: 'static'
    });
  }

  // Método para guardar pago completo (similar a guardarEdicionVenta pero con validación extra)
  guardarPagoCompleto(modal: any): void {
    // Validar que sea pago completo
    const montoAbonado = this.editarVentaForm.get('montoAbonado')?.value;
    const deudaTotal = this.calcularMontoDeuda();

    if (Math.abs(montoAbonado - deudaTotal) > 0.01) {
      this.swalService.showWarning('Advertencia',
        'El pago debe ser por la totalidad de la deuda pendiente.');
      return;
    }

    // Usar el mismo método de guardar pero con mensaje diferente
    const mensajeConfirmacion = `
    <strong>💰 Confirmar pago completo de ${this.formatearMoneda(montoAbonado)}</strong><br><br>
    
    <strong>Resumen:</strong><br>
    • Total venta: ${this.formatearMoneda(this.selectedVenta.total)}<br>
    • Deuda pendiente: ${this.formatearMoneda(deudaTotal)}<br>
    • Nuevo pago: ${this.formatearMoneda(montoAbonado)}<br><br>
    
    <strong>⚠️ IMPORTANTE:</strong> Este es un pago único. La venta quedará totalmente saldada.
  `;

    this.swalService.showConfirm(
      'Confirmar Pago Completo',
      mensajeConfirmacion,
      '✅ Sí, Registrar Pago',
      '❌ Cancelar'
    ).then((result) => {
      if (result.isConfirmed) {
        // Re-habilitar el control antes de guardar
        const montoControl = this.editarVentaForm.get('montoAbonado');
        if (montoControl) {
          montoControl.enable();
        }

        // Usar el mismo método de guardar abono
        this.guardarEdicionVenta(modal);
      }
    });
  }

  // Método para mostrar botón de abono (ajustado)
  mostrarBotonAbonar(venta: any): boolean {
    if (!venta || venta.estado === 'cancelada') {
      return false;
    }

    // Solo para abonos con deuda
    const esAbonoConDeuda = venta.formaPago === 'abono' &&
      this.getDeudaPendiente(venta) > 0;

    return esAbonoConDeuda;
  }

  // Método para expandir textarea al hacer focus
  expandirTextarea(event: any): void {
    const textarea = event.target;
    textarea.classList.add('expanded');
    textarea.rows = 3;

    // Auto-focus y colocar cursor al final
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }, 10);
  }

  // Método para contraer textarea al perder focus (si está vacío)
  contraerTextarea(event: any): void {
    const textarea = event.target;
    const valor = textarea.value.trim();

    if (!valor) {
      textarea.classList.remove('expanded');
      textarea.rows = 1;
    }
  }

  // Método para agregar observaciones rápidas
  agregarObservacionRapida(texto: string): void {
    const control = this.editarVentaForm.get('observaciones');
    const valorActual = control?.value || '';

    // Si ya hay texto, agregar en nueva línea
    const separador = valorActual ? '\n' : '';
    const nuevoValor = valorActual + separador + texto;

    control?.setValue(nuevoValor);
    control?.markAsTouched();

    // Expandir automáticamente
    setTimeout(() => {
      const textarea = document.querySelector('.observaciones-textarea-compact') as HTMLTextAreaElement;
      if (textarea) {
        textarea.classList.add('expanded');
        textarea.rows = 3;
        textarea.focus();
      }
    }, 50);
  }

  getTipoVentaDisplay(tipo: string): string {
    const tipos: { [key: string]: string } = {
      'solo_consulta': 'Solo Consultas',
      'solo_productos': 'Solo Productos',
      'consulta_productos': 'Consulta + Productos'
    };
    return tipos[tipo] || 'Todas las ventas';
  }

  esNumeroVenta(termino: string): boolean {
    if (!termino) return false;
    // Patrones de número de venta:
    // - V-000098
    // - 000098
    // - 98
    // - V000098
    const patronVenta = /^(?:V-?)?\d+$/i;
    return patronVenta.test(termino.trim());
  }

  esNumeroHistoria(termino: string): boolean {
    if (!termino) return false;
    // Patrones de número de historia:
    // - H-20260216-001
    // - 20260216-001
    // - H20260216001
    const patronHistoria = /^(?:H-?)?\d{8}-?\d{3}$/i;
    return patronHistoria.test(termino.trim());
  }

  normalizarNumeroVenta(termino: string): string {
    const numeros = termino.replace(/\D/g, '');

    if (numeros.length < 3) {
      return numeros;
    }

    return numeros.padStart(6, '0');
  }

  normalizarNumeroHistoria(termino: string): string {
    const terminoLimpio = termino.replace(/^H-?/i, '');

    if (/^\d{8}-\d{3}$/.test(terminoLimpio)) {
      return terminoLimpio;
    }

    if (/^\d{11}$/.test(terminoLimpio)) {
      return `${terminoLimpio.substring(0, 8)}-${terminoLimpio.substring(8)}`;
    }

    const soloNumeros = terminoLimpio.replace(/\D/g, '');
    return soloNumeros;
  }

  private extraerNumeros(texto: string): string {
    if (!texto) return '';
    return texto.replace(/\D/g, '');
}



}