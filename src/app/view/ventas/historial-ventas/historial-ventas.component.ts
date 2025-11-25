import { Component, OnInit, HostListener, ViewChild, TemplateRef } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { SwalService } from '../../../core/services/swal/swal.service';
import { HistorialVentaService } from './../historial-ventas/historial-ventas.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Tasa } from '../../../Interfaces/models-interface';
import { GenerarVentaService } from './../generar-venta/generar-venta.service';
import { take } from 'rxjs/operators';
import { SystemConfigService } from '../../system-config/system-config.service';
import { Subscription } from 'rxjs';
import { EmpleadosService } from './../../../core/services/empleados/empleados.service';
import { LoaderService } from './../../../shared/loader/loader.service';


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

  // Propiedades para los filtros
  asesores: any[] = [];
  especialistas: any[] = [];
  ventasFiltradas: any[] = [];
  ventasOriginales: any[] = [];
  totalVentas: number = 0;
  presetActivo: string = '';

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

  // Paginación
  paginaActual = 1;
  itemsPorPagina = 10;
  totalPaginas: number = 1;

  // Propiedades para el modal confirmacion cancelar venta
  selectedVenta: any = null;
  motivoCancelacion: string = '';

  // Nuevas propiedades para edición de ventas
  editarVentaForm!: FormGroup;
  monedaEfectivo: string = 'USD'; // Solo para el selector de moneda en efectivo en el modal

  //Propiedades para tasas de cambio
  tasasPorId: { [key: string]: number } = {};
  tasasDisponibles: any[] = [];
  monedasDisponibles: any[] = [];

  // === NUEVAS PROPIEDADES PARA MONEDA DEL SISTEMA ===
  monedaSistema: string = 'USD';
  simboloMonedaSistema: string = '$';
  private configSubscription!: Subscription;

  tasaCableada: number = 243.00; // Tasa temporal mientras el API se ajusta

  // Propiedades para paginación avanzada - CORREGIDAS
  paginacion = {
    paginaActual: 1,
    itemsPorPagina: 25,
    totalItems: 0,
    totalPaginas: 0,
    itemsPorPaginaOpciones: [10, 25, 50, 100, 250],
    rangoPaginas: [] as number[]
  };

  filtros = {
    busquedaGeneral: '',
    asesor: '',
    especialista: '',
    estado: '',
    formaPago: '', // Nuevo filtro
    fechaDesde: '',
    fechaHasta: ''
  };

  private modoBusquedaGlobal: boolean = false;

  // Mapeos de monedas
  private readonly idMap: Record<string, string> = {
    usd: 'dolar',
    ves: 'bolivar',
    bs: 'bolivar',
    eur: 'euro',
    $: 'dolar',
    '€': 'euro'
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
  ) {
    this.inicializarFormularioEdicion();
  }

  ngOnInit() {
    this.obtenerConfiguracionSistema();
    this.suscribirCambiosConfiguracion();
    this.cargarDatosIniciales();
    this.setMaxDate();
  }

  ngOnDestroy(): void {
    if (this.configSubscription) {
      this.configSubscription.unsubscribe();
    }
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
    //console.log('Fecha máxima configurada:', this.maxDate);
  }

  // Getter para el FormArray de métodos de pago
  get metodosPagoArray(): FormArray {
    return this.editarVentaForm.get('metodosPago') as FormArray;
  }

  private cargarDatosIniciales(): void {
    this.loader.showWithMessage('🔄 Cargando historial de ventas...');
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

        // Cargar primera página de ventas
        this.cargarVentasPagina(1);
      },
      error: (error) => {
        console.error('Error al cargar tasas de cambio:', error);
        this.tasasPorId = {
          'dolar': 36.5,
          'euro': 39.2,
          'bolivar': 1
        };
        this.cargarVentasPagina(1);
      }
    });
  }

  /**
  * Carga los empleados desde el API y los separa en asesores y especialistas
  */
  private cargarEmpleados(): void {
    this.empleadosService.getAllEmpleados().subscribe({
      next: (response: any) => {
        console.log('Respuesta completa del servicio de empleados:', response);

        let usuarios: any[] = [];

        // Manejar diferentes formatos de respuesta
        if (Array.isArray(response)) {
          // Caso 1: El servicio retorna un array directamente
          usuarios = response;
          console.log('Se recibió array directamente de empleados:', usuarios.length);
        } else if (response && response.message === 'ok' && Array.isArray(response.usuarios)) {
          // Caso 2: El servicio retorna {message: "ok", usuarios: [...]}
          usuarios = response.usuarios;
          console.log('Se recibió respuesta estructurada de empleados:', usuarios.length);
        } else if (response && Array.isArray(response)) {
          // Caso 3: El servicio retorna un array en otra propiedad
          usuarios = response;
          console.log('Se recibió array en propiedad de empleados:', usuarios.length);
        } else {
          console.error('Formato de respuesta inesperado del servicio de empleados:', response);
          this.establecerEmpleadosPorDefecto();
          return;
        }

        this.procesarEmpleados(usuarios);
      },
      error: (error) => {
        console.error('Error al cargar empleados:', error);
        this.establecerEmpleadosPorDefecto();
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

    console.log('Empleados activos encontrados:', empleadosActivos.length);

    // ASESORES: Todos los empleados activos sin importar el cargo
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

    console.log('Asesores cargados:', this.asesores);
    console.log('Especialistas cargados:', this.especialistas);

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
   * Establece valores por defecto si falla la carga de empleados
   */
  private establecerEmpleadosPorDefecto(): void {
    console.log('Estableciendo empleados por defecto');

    this.asesores = [
      { id: 1, nombre: 'Ana García', cedula: '', cargo: 'Asesor', rol: 'Asesor', estatus: true },
      { id: 2, nombre: 'Carlos López', cedula: '', cargo: 'Asesor', rol: 'Asesor', estatus: true },
      { id: 3, nombre: 'María Rodríguez', cedula: '', cargo: 'Asesor', rol: 'Asesor', estatus: true }
    ];

    this.especialistas = [
      { id: 1, nombre: 'Dr. Pérez', cedula: '', cargo: 'Optometrista', tipo: 'Optometrista', estatus: true },
      { id: 2, nombre: 'Dra. Martínez', cedula: '', cargo: 'Oftalmólogo', tipo: 'Oftalmólogo', estatus: true },
      { id: 3, nombre: 'Dr. González', cedula: '', cargo: 'Optometrista', tipo: 'Optometrista', estatus: true }
    ];
  }

  /**
   * Carga una página específica de ventas desde el servidor
   */
  private cargarVentasPagina(pagina: number, aplicarFiltros: boolean = true): void {
    this.loader.showWithMessage('📋 Cargando ventas...');

    const filtrosParaServicio = aplicarFiltros ? this.filtros : {};

    this.historialVentaService.obtenerHistorialVentas(
      pagina,
      this.paginacion.itemsPorPagina,
      filtrosParaServicio
    ).subscribe({
      next: (response: any) => {
        console.log('📦 RESPUESTA PAGINADA DEL API:');
        console.log('- Página:', pagina);
        console.log('- Ventas recibidas:', response.ventas?.length);
        console.log('- Total items:', response.totalItems);
        console.log('- Total páginas:', response.totalPaginas);

        if (response.message === 'ok' && response.ventas) {
          // Procesar las ventas de la página actual
          const ventasPagina = response.ventas.map((ventaApi: any) =>
            this.adaptarVentaDelApi(ventaApi)
          );

          // Actualizar propiedades de paginación
          this.paginacion.paginaActual = pagina;
          this.paginacion.totalItems = response.totalItems || 0;
          this.paginacion.totalPaginas = response.totalPaginas || 1;

          // Asignar ventas filtradas (que ahora son solo las de la página actual)
          this.ventasFiltradas = ventasPagina;

          // Si estamos en modo búsqueda global, guardar todas las ventas para estadísticas
          if (this.modoBusquedaGlobal) {
            this.ventasOriginales = ventasPagina;
          }

          // Generar rango de páginas
          this.generarRangoPaginas();

          // Cargar estadísticas si es necesario
          if (this.hayFiltrosActivos()) {
            this.cargarEstadisticasConFiltros();
          }

        } else {
          console.error('Respuesta inesperada del API de ventas:', response);
          this.ventasFiltradas = [];
          this.paginacion.totalItems = 0;
          this.paginacion.totalPaginas = 1;
        }

        setTimeout(() => {
          this.loader.hide();
        }, 500);
      },
      error: (error) => {
        console.error('❌ ERROR al cargar ventas paginadas:', error);
        this.loader.hide();
        this.swalService.showError('Error', 'No se pudieron cargar las ventas. Verifique su conexión.');
      }
    });
  }

  /**
   * Carga estadísticas con los filtros aplicados
   */
  private cargarEstadisticasConFiltros(): void {
    this.historialVentaService.obtenerEstadisticasVentas(this.filtros).subscribe({
      next: (estadisticas: any) => {
        // Actualizar las estadísticas con los datos del servidor
        // Esto depende de cómo esté estructurada la respuesta del API
        console.log('Estadísticas con filtros:', estadisticas);
      },
      error: (error) => {
        console.error('Error al cargar estadísticas:', error);
        // En caso de error, calcular estadísticas localmente con las ventas cargadas
        this.calcularEstadisticasLocales();
      }
    });
  }

  /**
   * Calcula estadísticas localmente (fallback)
   */
  private calcularEstadisticasLocales(): void {
    // Esta función se usaría si el endpoint de estadísticas falla
    // Calcula basándose en las ventasOriginales
  }

  /**
   * Maneja cambios en los filtros
   */
  onFiltroChange(): void {
    this.modoBusquedaGlobal = !!this.filtros.busquedaGeneral;
    this.paginacion.paginaActual = 1;

    // Si hay búsqueda general, cargar desde servidor con filtros
    if (this.hayFiltrosActivos()) {
      this.cargarVentasPagina(1, true);
    } else {
      // Si no hay filtros, volver a cargar primera página sin filtros
      this.cargarVentasPagina(1, false);
    }
  }

  /**
   * Aplica filtros y paginación (modificado para usar servidor)
   */
  aplicarFiltrosYPaginacion(): void {
    this.paginacion.paginaActual = 1;
    this.cargarVentasPagina(1, true);
  }

  /**
   * Navegación entre páginas
   */
  irAPagina(pagina: number | string): void {
    const paginaNum = typeof pagina === 'string' ? parseInt(pagina, 10) : pagina;

    if (paginaNum >= 1 && paginaNum <= this.paginacion.totalPaginas) {
      this.cargarVentasPagina(paginaNum, this.hayFiltrosActivos());
    }
  }

  cambiarItemsPorPagina(): void {
    this.paginacion.paginaActual = 1;
    this.cargarVentasPagina(1, this.hayFiltrosActivos());
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

  /**
   * Limpia filtros y vuelve a cargar primera página
   */
  limpiarFiltros() {
    this.filtros = {
      busquedaGeneral: '',
      asesor: '',
      especialista: '',
      fechaDesde: '',
      fechaHasta: '',
      estado: '',
      formaPago: '',
    };
    this.modoBusquedaGlobal = false;
    this.paginacion.paginaActual = 1;
    this.fechaUnica = '';

    // Volver a cargar primera página sin filtros
    this.cargarVentasPagina(1, false);
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

  aplicarFechas(): void {
    this.closeDatepicker();
    this.aplicarFiltrosYPaginacion();
  }

  getMonedaVenta(): string {
    return this.selectedVenta?.moneda || 'dolar';
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

      case 'semana_pasada':
        const diaSemanaActual = hoy.getDay();
        const diffLunesPasado = diaSemanaActual === 0 ? -13 : -6 - diaSemanaActual;

        fechaDesde = new Date(hoy);
        fechaDesde.setDate(hoy.getDate() + diffLunesPasado);

        fechaHasta = new Date(fechaDesde);
        fechaHasta.setDate(fechaDesde.getDate() + 6);

        this.filtros.fechaDesde = fechaDesde.toISOString().split('T')[0];
        this.filtros.fechaHasta = fechaHasta.toISOString().split('T')[0];
        break;

      case 'mes':
        fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        fechaHasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

        this.filtros.fechaDesde = fechaDesde.toISOString().split('T')[0];
        this.filtros.fechaHasta = fechaHasta.toISOString().split('T')[0];
        break;

      case 'mes_pasado':
        fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        fechaHasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);

        this.filtros.fechaDesde = fechaDesde.toISOString().split('T')[0];
        this.filtros.fechaHasta = fechaHasta.toISOString().split('T')[0];
        break;

      case 'trimestre':
        const trimestreActual = Math.floor(hoy.getMonth() / 3);
        const mesInicioTrimestre = trimestreActual * 3;
        const mesFinTrimestre = mesInicioTrimestre + 2;

        fechaDesde = new Date(hoy.getFullYear(), mesInicioTrimestre, 1);
        fechaHasta = new Date(hoy.getFullYear(), mesFinTrimestre + 1, 0);

        this.filtros.fechaDesde = fechaDesde.toISOString().split('T')[0];
        this.filtros.fechaHasta = fechaHasta.toISOString().split('T')[0];
        break;
    }

    this.fechaUnica = '';
    this.aplicarFiltrosYPaginacion();
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

  onFechaUnicaChange(): void {
    this.presetActivo = '';

    if (this.fechaUnica) {
      const hoy = new Date().toISOString().split('T')[0];

      if (this.fechaUnica > hoy) {
        this.fechaUnica = '';
        this.filtros.fechaDesde = '';
        this.filtros.fechaHasta = '';
        alert('No puedes seleccionar fechas futuras');
        return;
      }

      this.filtros.fechaDesde = this.fechaUnica;
      this.filtros.fechaHasta = this.fechaUnica;
    } else {
      this.filtros.fechaDesde = '';
      this.filtros.fechaHasta = '';
    }

    this.aplicarFiltrosYPaginacion();
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
        console.log('📦 RESPUESTA DEL API:');
        console.log('- Total ventas recibidas:', response.ventas?.length);

        if (response.message === 'ok' && response.ventas) {
          // Procesar TODAS las ventas
          const todasLasVentas = response.ventas.map((ventaApi: any) =>
            this.adaptarVentaDelApi(ventaApi)
          );

          // Guardar todas las ventas
          this.ventasOriginales = todasLasVentas;

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
        console.error('❌ ERROR al cargar ventas:', error);
        this.loader.hide();
      }
    });
  }

  /**
   * Aplica paginación a un conjunto de ventas
   */
  private aplicarPaginacion(ventas: any[] = this.ventasOriginales): void {
    if (!ventas || ventas.length === 0) {
      this.ventasFiltradas = [];
      this.totalVentas = 0;
      this.totalPaginas = 1;
      this.paginaActual = 1;
      return;
    }

    // Asegurar que itemsPorPagina sea válido
    if (this.itemsPorPagina <= 0) {
      this.itemsPorPagina = 10;
    }

    // Calcular índices para la paginación
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    const fin = inicio + this.itemsPorPagina;

    // Aplicar paginación
    this.ventasFiltradas = ventas.slice(inicio, fin);

    // Actualizar estadísticas de paginación
    this.totalVentas = ventas.length;
    this.totalPaginas = Math.ceil(this.totalVentas / this.itemsPorPagina);

    // Asegurar que la página actual sea válida
    if (this.paginaActual > this.totalPaginas && this.totalPaginas > 0) {
      this.paginaActual = this.totalPaginas;
      // Re-aplicar paginación con la página corregida
      this.aplicarPaginacion(ventas);
    }

    console.log(`📊 PAGINACIÓN CLIENTE:`);
    console.log(`- Total ventas: ${this.totalVentas}`);
    console.log(`- Mostrando: ${this.ventasFiltradas.length} ventas`);
    console.log(`- Página: ${this.paginaActual} de ${this.totalPaginas}`);
    console.log(`- Items por página: ${this.itemsPorPagina}`);
  }

  private adaptarVentaDelApi(ventaApi: any): any {
    const venta = ventaApi.venta;
    const totales = ventaApi.totales;
    const cliente = ventaApi.cliente;
    const asesor = ventaApi.asesor;
    const productos = ventaApi.productos;
    const metodosPago = ventaApi.metodosPago;
    const formaPago = ventaApi.formaPago;

    // Determinar el estado para filtros
    const estadoVenta = this.determinarEstadoVenta(venta.estatus_venta);

    return {
      // Información básica
      id: venta.key, // Usar el key como ID
      key: venta.key,
      numeroControl: this.generarNumeroControl(venta.key),
      fecha: new Date(venta.fecha),
      estado: estadoVenta,
      estadoPago: this.mapearEstadoPago(venta.estatus_pago),
      estadoParaFiltros: this.mapearEstadoParaFiltros(venta.estatus_venta),
      montoTotal: totales.total,

      // Información del cliente
      paciente: {
        nombre: cliente.informacion.nombreCompleto,
        cedula: cliente.informacion.cedula,
        telefono: cliente.informacion.telefono,
        email: cliente.informacion.email
      },

      // Personal
      asesor: {
        id: asesor.id,
        nombre: asesor.nombre
      },
      especialista: {
        id: 0, // Por defecto, ya que no viene en el API
        nombre: 'No asignado'
      },

      // Productos y servicios
      productos: productos.map((prod: any) => ({
        id: prod.datos.id.toString(),
        nombre: prod.datos.nombre,
        codigo: prod.datos.codigo,
        precio: prod.precio_unitario,
        precioConIva: prod.precio_unitario, // Asumir mismo precio
        cantidad: prod.cantidad,
        aplicaIva: prod.total !== prod.precio_unitario * prod.cantidad,
        iva: 0, // Calcular si es necesario
        subtotal: prod.precio_unitario * prod.cantidad,
        total: prod.total
      })),

      servicios: [], // No viene en el API actual

      // Métodos de pago
      metodosPago: metodosPago.map((metodo: any) => ({
        // Datos originales del API
        tipo: metodo.tipo,
        monto: metodo.monto,
        moneda_id: metodo.moneda_id,
        monto_en_moneda_de_venta: metodo.monto_en_moneda_de_venta,
        referencia: metodo.referencia,
        bancoCodigo: metodo.bancoCodigo,
        bancoNombre: metodo.bancoNombre,

        // Para compatibilidad con el formato anterior
        conversionBs: this.calcularConversionBs(
          metodo.monto_en_moneda_de_venta || metodo.monto,
          metodo.moneda_id
        ),
        banco: metodo.bancoNombre ? `${metodo.bancoCodigo} - ${metodo.bancoNombre}` : null
      })),

      // Información adicional
      mostrarDetalle: false,
      sede: 'guatire', // Por defecto, ya que no viene en el API
      moneda: venta.moneda,
      formaPago: venta.formaPago,
      descuento: totales.descuento || 0,
      observaciones: venta.observaciones,
      asesorNombre: asesor.nombre,

      // Totales
      subtotal: totales.subtotal,
      totalIva: totales.iva || 0,
      totalDescuento: totales.descuento || 0,
      total: totales.total,

      // Estados de pago
      pagoCompleto: totales.totalPagado >= totales.total,
      financiado: formaPago.tipo === 'cashea',

      // Información específica por forma de pago
      montoAbonado: formaPago.tipo === 'abono' ? formaPago.montoInicial : totales.totalPagado,
      nivelCashea: formaPago.nivel,
      montoInicial: formaPago.montoInicial,
      cantidadCuotas: formaPago.cantidadCuotas,
      montoPorCuota: formaPago.montoPorCuota,
      cuotasAdelantadas: formaPago.cuotas?.filter((c: any) => c.seleccionada).map((c: any) => ({
        numero: c.numero,
        monto: c.monto,
        fechaVencimiento: c.fecha_vencimiento
      })) || [],
      totalAdelantado: formaPago.montoAdelantado,

      // NUEVO: Incluir deuda pendiente específica para Cashea
      deudaPendiente: formaPago.deudaPendiente || 0,

      // Información de cancelación (si aplica)
      motivo_cancelacion: venta.motivo_cancelacion,
      fecha_cancelacion: venta.fecha_cancelacion ? new Date(venta.fecha_cancelacion) : null,

      // Historia médica (si existe)
      historiaMedica: ventaApi.ultima_historia_medica || null
    };
  }

  private determinarEstadoVenta(estatusVenta: string): string {
    // Si está cancelada en el API, mantener cancelada
    if (estatusVenta === 'cancelada' || estatusVenta === 'cancelado') {
      return 'cancelada';
    }

    return 'completada';
  }

  /**
   * Genera un número de control basado en el key de la venta
   */
  private generarNumeroControl(ventaKey: string): string {
    // Usar los últimos 6 caracteres del key como número de control
    return ventaKey.slice(-6).toUpperCase();
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

  /**
   * Calcula la conversión a bolívares
   */
  private calcularConversionBs(monto: number, moneda: string): number {
    if (moneda === 'bolivar') return monto;

    const tasa = this.tasasPorId[moneda] || 1;
    return this.redondear(monto * tasa);
  }

  private mapearEstadoParaFiltros(estatusPago: string): string {
    const mapeo: { [key: string]: string } = {
      'completada': 'completada',
      'pagado_por_cashea': 'pendiente',
      'pendiente': 'pendiente',
      'cancelado': 'cancelada',
      'cancelada': 'cancelada'
    };

    return mapeo[estatusPago] || estatusPago;
  }

  getRangoPaginas(): number[] {
    this.totalPaginas = Math.ceil(this.totalVentas / this.itemsPorPagina);

    if (this.totalPaginas <= 7) {
      return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
    }

    const paginas: number[] = [];
    const paginaInicio = Math.max(2, this.paginaActual - 1);
    const paginaFin = Math.min(this.totalPaginas - 1, this.paginaActual + 1);

    paginas.push(1);

    if (paginaInicio > 2) {
      paginas.push(-1);
    }

    for (let i = paginaInicio; i <= paginaFin; i++) {
      paginas.push(i);
    }

    if (paginaFin < this.totalPaginas - 1) {
      paginas.push(-1);
    }

    if (this.totalPaginas > 1) {
      paginas.push(this.totalPaginas);
    }

    return paginas;
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

    // Ordenar las ventas originales
    this.ventasOriginales.sort((a, b) => {
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

    // Re-aplicar filtros y paginación después de ordenar
    this.aplicarFiltrosYPaginacion();
  }

  toggleDetalleVenta(ventaId: number) {
    const venta = this.ventasFiltradas.find(v => v.id === ventaId);
    if (venta) {
      venta.mostrarDetalle = !venta.mostrarDetalle;
    }
  }

  verRecibo(venta: any) {
    // console.log('Ver recibo:', venta);
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

  cambiarPagina(pagina: number) {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
      this.aplicarPaginacion();
    }
  }

  getEstadoTexto(venta: any): string {
    // Primero verificar si está cancelada
    if (venta.estado === 'cancelada') {
      return '❌ Cancelada';
    }

    // Luego verificar si tiene deuda pendiente
    const deuda = this.getDeudaPendiente(venta);
    if (deuda > 0) {
      return '⏳ Pendiente por pago';
    }

    // Finalmente, si está completada y sin deuda
    if (venta.estado === 'completada') {
      return '✅ Completada';
    }

    // Para cualquier otro caso
    return venta.estado || 'Desconocido';
  }

  getEstadoClase(venta: any): string {
    const estadoTexto = this.getEstadoTexto(venta);

    if (estadoTexto.includes('✅ Completada')) {
      return 'bg-success';
    } else if (estadoTexto.includes('⏳ Pendiente')) {
      return 'bg-warning';
    } else if (estadoTexto.includes('❌ Cancelada')) {
      return 'bg-danger';
    } else {
      return 'bg-secondary';
    }
  }

  cancelarVenta(venta: any) {
    //console.log('Cancelar venta:', venta);
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
      `¿Está completamente seguro de cancelar la venta #${this.selectedVenta.id}? Esta acción no se puede deshacer.`,
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

  /**
 * Cancela una venta usando el API real
 */
  private procesarCancelacion(): void {
    if (!this.selectedVenta?.key) {
      this.swalService.showError('Error', 'No se puede cancelar la venta: falta información.');
      return;
    }

    this.historialVentaService.anularVenta(
      this.selectedVenta.key,
      this.motivoCancelacion
    ).subscribe({
      next: (response: any) => {
        if (response.success || response.message === 'ok') {
          this.swalService.showSuccess('Éxito', 'Venta cancelada exitosamente.');

          // Actualizar la venta localmente
          this.selectedVenta.estado = 'cancelada';
          this.selectedVenta.estadoPago = 'cancelado';
          this.selectedVenta.motivo_cancelacion = this.motivoCancelacion;
          this.selectedVenta.fecha_cancelacion = new Date();

          // Actualizar en ambas listas
          this.actualizarVentaEnListas(this.selectedVenta);

        } else {
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

  /**
   * Procesa la edición/abono de una venta usando el API real
   */
  private procesarEdicionVenta(modal: any, formData: any): void {
    if (!this.selectedVenta?.key) {
      this.swalService.showError('Error', 'No se puede actualizar la venta: falta información.');
      return;
    }

    const datosActualizados = {
      montoAbonado: formData.montoAbonado,
      observaciones: formData.observaciones,
      metodosPago: formData.metodosPago,
      fechaActualizacion: new Date().toISOString()
    };

    this.historialVentaService.realizarAbono(this.selectedVenta.key, datosActualizados)
      .subscribe({
        next: (response: any) => {
          if (response.success || response.message === 'ok') {
            this.swalService.showSuccess('Éxito', 'Venta actualizada correctamente.');

            // Actualizar la venta localmente
            const ventaActualizada = {
              ...this.selectedVenta,
              montoAbonado: formData.montoAbonado,
              observaciones: formData.observaciones,
              metodosPago: formData.metodosPago
            };

            this.actualizarVentaEnListas(ventaActualizada);
            modal.close();

          } else {
            this.swalService.showError('Error', response.message || 'No se pudo actualizar la venta.');
          }
        },
        error: (error) => {
          console.error('Error al actualizar venta:', error);

          let mensajeError = 'No se pudo actualizar la venta. Verifique su conexión.';
          if (error.error?.message) {
            mensajeError = error.error.message;
          }

          this.swalService.showError('Error', mensajeError);
        }
      });
  }

  /**
   * Actualiza una venta en ambas listas (original y filtrada)
   */
  private actualizarVentaEnListas(ventaActualizada: any): void {
    // Actualizar en ventas originales
    const indexOriginal = this.ventasOriginales.findIndex(v => v.key === ventaActualizada.key);
    if (indexOriginal !== -1) {
      this.ventasOriginales[indexOriginal] = {
        ...this.ventasOriginales[indexOriginal],
        ...ventaActualizada
      };
    }

    // Actualizar en ventas filtradas
    const indexFiltrado = this.ventasFiltradas.findIndex(v => v.key === ventaActualizada.key);
    if (indexFiltrado !== -1) {
      this.ventasFiltradas[indexFiltrado] = {
        ...this.ventasFiltradas[indexFiltrado],
        ...ventaActualizada
      };
    }
  }

  /**
   * Limpia la selección de cancelación
   */
  private limpiarSeleccionCancelacion(): void {
    this.selectedVenta = null;
    this.motivoCancelacion = '';
  }

  verDetalleCompleto(venta: any) {
    console.log('Ver detalle completo:', venta);

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

  getTotalPagadoVenta(venta: any): number {
    if (!venta.metodosPago || !venta.metodosPago.length) return 0;

    return venta.metodosPago.reduce((total: number, pago: any) => {
      return total + (pago.monto || 0);
    }, 0);
  }

  // ========== MÉTODOS PARA EDICIÓN DE VENTAS ==========

  // Método para determinar si mostrar el botón de edición
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

  guardarEdicionVenta(modal: any): void {

    // Primero forzar validación de todos los métodos
    this.metodosPagoArray.controls.forEach((control, index) => {
      this.validarMontoMetodoPago(index);
    });

    if (this.editarVentaForm.invalid) {
      this.marcarControlesComoSucios(this.editarVentaForm);
      this.swalService.showWarning('Advertencia', 'Por favor complete todos los campos requeridos correctamente.');
      return;
    }

    const formValue = this.editarVentaForm.value;
    const totalMetodosPago = this.calcularTotalMetodosPago();

    if (Math.abs(totalMetodosPago - formValue.montoAbonado) > 0.01) {

      const totalMetodosStr = totalMetodosPago.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
      const montoAbonadoStr = formValue.montoAbonado.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

      this.swalService.showWarning('Advertencia',
        `La suma de los métodos de pago (${totalMetodosStr}) no coincide con el monto abonado (${montoAbonadoStr}).`);
      return;
    }

    // Formatear los valores para el mensaje de confirmación
    const nuevoMontoStr = formValue.montoAbonado.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
    const nuevoSaldoStr = (this.selectedVenta.total - formValue.montoAbonado).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

    this.swalService.showConfirm(
      'Confirmar Edición',
      `¿Está seguro de actualizar el abono de esta venta?<br>
     <strong>Nuevo monto abonado:</strong> ${nuevoMontoStr}<br>
     <strong>Nuevo saldo pendiente:</strong> ${nuevoSaldoStr}`,
      'Sí, Guardar Cambios',
      'Revisar'
    ).then((result) => {
      if (result.isConfirmed) {
        this.procesarEdicionVenta(modal, formValue);
      }
    });
  }


  private generarNuevoRecibo(venta: any): void {
    //   console.log('Generando nuevo recibo para venta:', venta);
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
    setTimeout(() => {
      this.calcularPorcentajeAbonado();
      this.ajustarMontosMetodosPago();
    });
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
    const metodoGroup = this.fb.group({
      tipo: ['', Validators.required],
      monto: [0, [Validators.required, Validators.min(0)]]
    });

    this.metodosPagoArray.push(metodoGroup);

    // Suscribirse a cambios del monto
    const index = this.metodosPagoArray.length - 1;
    metodoGroup.get('monto')?.valueChanges.subscribe(value => {
      if (value !== null && value !== undefined) {
        this.validarMontoMetodoPago(index);
      }
    });

    metodoGroup.get('tipo')?.valueChanges.subscribe(tipo => {
      this.onMetodoPagoChange(index);
    });
  }

  private agregarMetodoPagoExistente(metodo: any): void {
    const metodoGroup = this.fb.group({
      tipo: [metodo.tipo || '', Validators.required],
      monto: [metodo.monto || 0, [Validators.required, Validators.min(0)]]
    });

    const index = this.metodosPagoArray.length;
    this.metodosPagoArray.push(metodoGroup);

    metodoGroup.get('monto')?.valueChanges.subscribe(value => {
      if (value !== null && value !== undefined) {
        this.validarMontoMetodoPago(index);
      }
    });
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

    const total = this.selectedVenta.total || 0;
    const abonado = this.selectedVenta.montoAbonado || 0;
    const deuda = total - abonado;

    return Math.max(0, deuda);
  }

  calcularPorcentajeAbonado(): number {
    if (!this.selectedVenta || !this.selectedVenta.total) return 0;

    const montoAbonadoAnterior = this.selectedVenta.montoAbonado || 0;
    const nuevoMontoAbonado = this.editarVentaForm?.get('montoAbonado')?.value || 0;

    const totalAbonado = montoAbonadoAnterior + nuevoMontoAbonado;

    let porcentaje = (totalAbonado / this.selectedVenta.total) * 100;
    porcentaje = Math.min(porcentaje, 100);

    return Math.round(porcentaje);
  }

  // CORRECCIÓN: Obtener monto máximo permitido en moneda de venta
  getMontoMaximoPermitido(): number {
    return this.calcularMontoDeuda();
  }

  reinicializarFormularioConDeuda() {
    const montoDeuda = this.calcularMontoDeuda();

    // console.log('Reinicializando formulario con deuda:', montoDeuda, 'Moneda:', this.getMonedaVenta());

    if (this.editarVentaForm) {
      this.editarVentaForm.patchValue({
        montoAbonado: montoDeuda,
        observaciones: this.selectedVenta.observaciones || ''
      });

      this.metodosPagoArray.clear();

      if (this.selectedVenta.metodosPago && this.selectedVenta.metodosPago.length > 0) {
        this.selectedVenta.metodosPago.forEach((metodo: any) => {
          this.agregarMetodoPagoExistente(metodo);
        });
      } else {
        this.agregarMetodoPago();
      }
    } else {
      this.inicializarFormulario();
    }

    this.editarVentaForm.get('montoAbonado')?.setValidators([
      Validators.required,
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

  // CORRECCIÓN: Obtener montos de progreso en moneda de venta
  getMontosProgreso(): string {
    if (!this.selectedVenta) return '$0.00 / $0.00';

    const montoAbonadoAnterior = this.selectedVenta.montoAbonado || 0;
    const nuevoMontoAbonado = this.editarVentaForm?.get('montoAbonado')?.value || 0;
    const totalAbonado = montoAbonadoAnterior + nuevoMontoAbonado;

    const simbolo = this.getSimboloMonedaVenta();
    return `${simbolo}${totalAbonado.toFixed(2)} / ${simbolo}${this.selectedVenta.total.toFixed(2)}`;
  }

  getSimboloMonedaMetodo(tipoPago: string): string {
    switch (tipoPago) {
      case 'efectivo':
        // Para efectivo, usar la moneda seleccionada en el selector
        return this.getSimboloMonedaEfectivo();
      case 'pagomovil':
      case 'transferencia':
      case 'debito':
      case 'credito':
        return 'Bs. '; // Siempre bolívares para métodos locales
      case 'zelle':
        return '$'; // Siempre dólares para Zelle
      default:
        return this.simboloMonedaSistema; // ← Usar símbolo del sistema por defecto
    }
  }

  getSimboloMonedaEfectivo(): string {
    // Si el sistema está configurado en bolívares, usar Bs. para efectivo
    if (this.monedaSistema === 'BS' || this.monedaSistema === 'VES' || this.monedaSistema === 'Bs') {
      return 'Bs. ';
    }

    // Para otros casos, usar el selector local
    switch (this.monedaEfectivo) {
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'Bs': return 'Bs. ';
      default: return this.simboloMonedaSistema; // ← Usar símbolo del sistema por defecto
    }
  }

  getMonedaParaMetodo(index: number): string {
    const metodoControl = this.metodosPagoArray.at(index);
    const tipoPago = metodoControl?.get('tipo')?.value;

    switch (tipoPago) {
      case 'efectivo':
        return this.monedaEfectivo.toLowerCase() === 'bs' ? 'bolivar' :
          this.monedaEfectivo.toLowerCase() === 'eur' ? 'euro' : 'dolar';
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

  // NUEVO MÉTODO: Formatear monto según la moneda del sistema
  formatearMontoSistema(monto: number): string {
    if (monto === null || monto === undefined || isNaN(monto)) {
      return `${this.simboloMonedaSistema}0.00`;
    }

    const montoNumerico = Number(monto);

    if (isNaN(montoNumerico)) {
      return `${this.simboloMonedaSistema}0.00`;
    }

    return `${this.simboloMonedaSistema}${montoNumerico.toFixed(2)}`;
  }

  // MÉTODO MEJORADO: Para mostrar montos en tablas/resúmenes
  getMontoParaMostrar(venta: any, monto: number): string {
    // Si la venta está en la misma moneda del sistema, mostrar directamente
    const monedaVenta = venta?.moneda || 'dolar';
    const monedaSistemaNormalizada = this.normalizarMonedaParaVenta(this.monedaSistema);

    if (monedaVenta === monedaSistemaNormalizada) {
      return this.formatearMontoSistema(monto);
    }

    // Si es diferente, convertir y mostrar
    const montoConvertido = this.convertirMonto(monto, monedaVenta, monedaSistemaNormalizada);
    return this.formatearMontoSistema(montoConvertido);
  }

  // CORRECCIÓN: Función de conversión mejorada
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

    // console.log(`Validando método ${index}: Ingresado=${montoIngresado}, Máximo=${montoMaximo}, Moneda=${this.getMonedaParaMetodo(index)}`);

    if (montoIngresado > montoMaximo) {
      //console.log(`Ajustando monto del método ${index} de ${montoIngresado} a ${montoMaximo}`);

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

  getConversionBs(monto: number): number {
    const monedaVenta = this.getMonedaVenta();

    if (monedaVenta === 'bolivar') {
      return monto;
    }

    const tasa = this.tasasPorId[monedaVenta] || 1;
    return this.redondear(monto * tasa);
  }

  obtenerEquivalenteBs(monto: number): number {
    const moneda = this.getMonedaVenta();
    const tasa = this.tasasPorId?.[moneda] ?? 1;
    return moneda === 'bolivar' ? monto : monto * tasa;
  }

  // CORRECCIÓN: Redondear números
  private redondear(valor: number, decimales: number = 2): number {
    return Math.round(valor * Math.pow(10, decimales)) / Math.pow(10, decimales);
  }

  // CORRECCIÓN: Al cambiar método de pago
  onMetodoPagoChange(index: number) {
    const metodoControl = this.metodosPagoArray.at(index);
    const tipoPago = metodoControl?.get('tipo')?.value;

    //console.log(`Método ${index} cambiado a: ${tipoPago}, Símbolo: ${this.getSimboloParaMetodo(index)}`);

    // Resetear monto si el tipo de pago cambia
    metodoControl.patchValue({
      monto: 0
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

  // CORRECCIÓN: Obtener símbolo para método específico
  getSimboloParaMetodo(index: number): string {
    const metodoControl = this.metodosPagoArray.at(index);
    const tipoPago = metodoControl?.get('tipo')?.value;
    return this.getSimboloMonedaMetodo(tipoPago);
  }

  // CORRECCIÓN: Verificar si hay efectivo para mostrar selector
  hayMetodoEfectivoSeleccionado(): boolean {
    if (!this.metodosPagoArray || this.metodosPagoArray.length === 0) {
      return false;
    }

    return this.metodosPagoArray.controls.some(control =>
      control.get('tipo')?.value === 'efectivo'
    );
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

  getDeudaPendiente(venta: any): number {
    if (!venta) return 0;

    // Si la venta está cancelada, no hay deuda
    if (venta.estado === 'cancelada') {
      return 0;
    }

    // Para ventas con Cashea, usar la deuda pendiente del API
    if (venta.formaPago === 'cashea' && venta.financiado) {
      return venta.deudaPendiente || 0;
    }

    // Para abonos, calcular la diferencia
    if (venta.formaPago === 'abono') {
      const total = venta.total || 0;
      const abonado = venta.montoAbonado || 0;
      return Math.max(0, total - abonado);
    }

    // Para contado, verificar si el pago está completo
    if (venta.formaPago === 'contado') {
      const total = venta.total || 0;
      const pagado = this.getTotalPagadoVenta(venta) || 0;
      return Math.max(0, total - pagado);
    }

    return 0;
  }

  // Método para obtener el estatus de pago
  getEstatusPago(venta: any): string {
    if (venta.estado === 'cancelada') {
      return 'Cancelado';
    }

    const deuda = this.getDeudaPendiente(venta);

    if (deuda === 0) {
      return 'Pago completado';
    } else {
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


  // Método para mostrar tasa
  getTasaDisplay(): string {
    return `Tasa: 1 USD = ${this.tasaCableada} Bs`;
  }














  // Método corregido para obtener el monto display
  getMontoDisplayMetodoPago(metodo: any, venta: any): string {
    const monedaPago = this.getMonedaDelMetodo(metodo);
    const monto = this.getMontoOriginalDelMetodo(metodo, monedaPago);

    return this.formatearMontoConMoneda(monto, monedaPago);
  }

  // Método para obtener el monto original correcto
  getMontoOriginalDelMetodo(metodo: any, monedaPago: string): number {
    // Si el método tiene monto_en_moneda_de_venta, significa que el monto principal está en bolívares
    if (metodo.monto_en_moneda_de_venta !== undefined && metodo.monto_en_moneda_de_venta !== null) {
      // Para débito/transferencia: monto está en bolívares, monto_en_moneda_de_venta en dólares
      return metodo.monto;
    }

    // Si tiene conversionBs, significa que el monto principal está en dólares
    if (metodo.conversionBs !== undefined && metodo.conversionBs !== null) {
      // Para pagomóvil/efectivo: monto está en dólares, conversionBs en bolívares
      if (monedaPago === 'bolivar') {
        return metodo.conversionBs;
      } else {
        return metodo.monto;
      }
    }

    // Por defecto, usar el monto principal
    return metodo.monto;
  }

  // Método corregido para el equivalente
  getEquivalenteDisplay(metodo: any, venta: any): string {
    const monedaPago = this.getMonedaDelMetodo(metodo);
    const monedaSistema = this.normalizarMonedaParaVenta(this.monedaSistema);

    // Si el pago ya está en la moneda del sistema, no mostrar equivalente
    if (monedaPago === monedaSistema) {
      return '';
    }

    // ASIGNAR DIRECTAMENTE el valor que ya viene convertido del API
    if (metodo.monto_en_moneda_de_venta !== undefined && metodo.monto_en_moneda_de_venta !== null) {
      return `Equivale a: ${this.formatearMontoConDecimales(metodo.monto_en_moneda_de_venta, monedaSistema)}`;
    }

    // Solo para métodos que no tienen monto_en_moneda_de_venta (API antiguo)
    if (metodo.conversionBs !== undefined && metodo.conversionBs !== null) {
      if (monedaPago === 'bolivar' && monedaSistema === 'dolar') {
        return `Equivale a: ${this.formatearMontoConDecimales(metodo.monto, 'dolar')}`;
      } else if (monedaPago === 'dolar' && monedaSistema === 'bolivar') {
        return `Equivale a: ${this.formatearMontoConDecimales(metodo.conversionBs, 'bolivar')}`;
      }
    }

    return '';
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





  // En el componente, agrega este método para obtener la tasa correcta
  getTasaBolivar(): number {
    if (!this.selectedVenta) return this.tasaCableada;

    const monedaVenta = this.selectedVenta.moneda;

    // Si la venta es en dólares, usar tasa dólar
    if (monedaVenta === 'dolar') {
      return this.tasasPorId['dolar'] || this.tasaCableada;
    }

    // Si la venta es en euros, usar tasa euro
    if (monedaVenta === 'euro') {
      return this.tasasPorId['euro'] || (this.tasaCableada * 0.85); // Aproximación EUR/USD
    }

    return this.tasaCableada;
  }

  // Método mejorado para obtener el display del tipo de pago
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

  /**
   * Aplica filtros estándar a las ventas
   */
  private aplicarFiltrosEstándar(ventas: any[]): any[] {
    let resultado = [...ventas];

    // Filtro de asesor
    if (this.filtros.asesor) {
      resultado = resultado.filter(venta =>
        venta.asesor.id.toString() === this.filtros.asesor
      );
    }

    // Filtro de especialista
    if (this.filtros.especialista) {
      resultado = resultado.filter(venta =>
        venta.especialista.id.toString() === this.filtros.especialista
      );
    }

    // Filtro de estado
    if (this.filtros.estado === 'pendiente') {
      resultado = resultado.filter(venta =>
        this.ventaTienePendiente(venta)
      );
    } else if (this.filtros.estado === 'completada') {
      resultado = resultado.filter(venta =>
        this.esVentaCompletada(venta)
      );
    } else if (this.filtros.estado === 'cancelada') {
      resultado = resultado.filter(venta =>
        venta.estado === 'cancelada'
      );
    }

    // Filtro de fechas
    if (this.filtros.fechaDesde) {
      const fechaDesde = new Date(this.filtros.fechaDesde);
      fechaDesde.setHours(0, 0, 0, 0);
      resultado = resultado.filter(venta => {
        const fechaVenta = new Date(venta.fecha);
        fechaVenta.setHours(0, 0, 0, 0);
        return fechaVenta >= fechaDesde;
      });
    }

    if (this.filtros.fechaHasta) {
      const fechaHasta = new Date(this.filtros.fechaHasta);
      fechaHasta.setHours(23, 59, 59, 999);
      resultado = resultado.filter(venta => {
        const fechaVenta = new Date(venta.fecha);
        return fechaVenta <= fechaHasta;
      });
    }

    return resultado;
  }

  /**
   * Aplica ordenamiento a las ventas
   */
  private aplicarOrdenamiento(ventas: any[]): any[] {
    const ventasOrdenadas = [...ventas];

    return ventasOrdenadas.sort((a, b) => {
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

  /**
   * Aplica búsqueda general
   */
  private aplicarBusquedaGeneral(ventas: any[]): any[] {
    if (!this.filtros.busquedaGeneral) return ventas;

    const busqueda = this.filtros.busquedaGeneral.toLowerCase();
    return ventas.filter(venta =>
      venta.paciente.nombre.toLowerCase().includes(busqueda) ||
      venta.paciente.cedula.toLowerCase().includes(busqueda) ||
      venta.numeroControl.toLowerCase().includes(busqueda)
    );
  }

  /**
   * Métodos de paginación avanzada
   */
  private aplicarPaginacionAvanzada(ventas: any[] = this.ventasOriginales): void {
    if (!ventas || ventas.length === 0) {
      this.ventasFiltradas = [];
      this.paginacion.totalItems = 0;
      this.paginacion.totalPaginas = 1;
      this.paginacion.paginaActual = 1;
      return;
    }

    // Calcular índices
    const inicio = (this.paginacion.paginaActual - 1) * this.paginacion.itemsPorPagina;
    const fin = inicio + this.paginacion.itemsPorPagina;

    // Aplicar paginación
    this.ventasFiltradas = ventas.slice(inicio, fin);
    this.paginacion.totalItems = ventas.length;
    this.paginacion.totalPaginas = Math.ceil(this.paginacion.totalItems / this.paginacion.itemsPorPagina);

    // Generar rango de páginas para navegación
    this.generarRangoPaginas();

    // Ajustar página actual si es necesario
    if (this.paginacion.paginaActual > this.paginacion.totalPaginas && this.paginacion.totalPaginas > 0) {
      this.paginacion.paginaActual = this.paginacion.totalPaginas;
      this.aplicarPaginacionAvanzada(ventas);
    }
  }

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

  /**
   * Determina si una venta tiene pendiente
   */
  private ventaTienePendiente(venta: any): boolean {
    if (venta.estado === 'cancelada') {
      return false;
    }
    const deuda = this.getDeudaPendiente(venta);
    return deuda > 0;
  }

  /**
   * Determina si una venta está completada
   */
  private esVentaCompletada(venta: any): boolean {
    return venta.estado === 'completada' && this.getDeudaPendiente(venta) === 0;
  }

  // Métodos para las tarjetas de resumen
  getTotalVentas(): number {
    return this.ventasOriginales?.length || 0;
  }

  getVentasCompletadas(): number {
    return this.ventasOriginales?.filter(venta =>
      venta.estado === 'completada' && this.getDeudaPendiente(venta) === 0
    ).length || 0;
  }

  getVentasPendientes(): number {
    return this.ventasOriginales?.filter(venta =>
      this.ventaTienePendiente(venta)
    ).length || 0;
  }

  getVentasCanceladas(): number {
    return this.ventasOriginales?.filter(venta =>
      venta.estado === 'cancelada'
    ).length || 0;
  }

  getMontoCompletadas(): string {
    const ventasCompletadas = this.ventasOriginales?.filter(venta =>
      venta.estado === 'completada' && this.getDeudaPendiente(venta) === 0
    ) || [];

    const total = ventasCompletadas.reduce((sum, venta) => sum + venta.montoTotal, 0);
    return this.formatearMontoSistema(total);
  }

  getMontoPendientes(): string {
    const ventasPendientes = this.ventasOriginales?.filter(venta =>
      this.ventaTienePendiente(venta)
    ) || [];

    const total = ventasPendientes.reduce((sum, venta) => sum + this.getDeudaPendiente(venta), 0);
    return this.formatearMontoSistema(total);
  }

  getMontoCanceladas(): string {
    const ventasCanceladas = this.ventasOriginales?.filter(venta =>
      venta.estado === 'cancelada'
    ) || [];

    const total = ventasCanceladas.reduce((sum, venta) => sum + venta.montoTotal, 0);
    return this.formatearMontoSistema(total);
  }

  // Métodos auxiliares para los filtros activos
  getAsesorNombre(asesorId: string): string {
    const asesor = this.asesores.find(a => a.id.toString() === asesorId);
    return asesor?.nombre || 'Asesor';
  }

  getEspecialistaNombre(especialistaId: string): string {
    const especialista = this.especialistas.find(e => e.id.toString() === especialistaId);
    return especialista?.nombre || 'Especialista';
  }

  getEstadoDisplay(estado: string): string {
    const estados: { [key: string]: string } = {
      'completada': 'Completada',
      'pendiente': 'Pendiente',
      'cancelada': 'Cancelada'
    };
    return estados[estado] || estado;
  }

  getFormaPagoDisplay(formaPago: string): string {
    const formas: { [key: string]: string } = {
      'contado': 'Contado',
      'abono': 'Abono',
      'cashea': 'Cashea',
      'credito': 'Crédito'
    };
    return formas[formaPago] || formaPago;
  }

  // Método para verificar si hay filtros activos
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

}


