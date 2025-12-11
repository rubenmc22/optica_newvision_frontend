import { Component, OnInit, HostListener, ViewChild, TemplateRef } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { SwalService } from '../../../core/services/swal/swal.service';
import { HistorialVentaService } from './../historial-ventas/historial-ventas.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Tasa } from '../../../Interfaces/models-interface';
import { GenerarVentaService } from './../generar-venta/generar-venta.service';
import { take, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SystemConfigService } from '../../system-config/system-config.service';
import { Subscription, Subject } from 'rxjs';
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
  filtros = {
    busquedaGeneral: '',
    asesor: '',
    especialista: '',
    estado: '',
    formaPago: '',
    fechaDesde: '',
    fechaHasta: ''
  };

  // Paginación
  paginacion = {
    paginaActual: 1,
    itemsPorPagina: 25,
    totalItems: 0,
    totalPaginas: 0,
    itemsPorPaginaOpciones: [10, 25, 50, 100, 250],
    rangoPaginas: [] as number[]
  };

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

    // Suscribirse a cambios en el monto abonado
    this.editarVentaForm.get('montoAbonado')?.valueChanges.subscribe(value => {
      this.validarMontoAbono();
    });
  }

  ngOnDestroy(): void {
    if (this.configSubscription) {
      this.configSubscription.unsubscribe();
    }
  }

  onBusquedaBlur(): void {
    if (this.filtros.busquedaGeneral.trim()) {
      this.realizarBusqueda();
    }
  }

  onBusquedaInput(searchTerm: string): void {
    this.filtros.busquedaGeneral = searchTerm;
  }

  onBusquedaEnter(event: any): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.realizarBusqueda();
    }
  }

  private realizarBusqueda(): void {
    this.paginacion.paginaActual = 1;
    this.cargarVentasPagina(1, true);
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
        this.cargarVentasPagina(1, false);
      },
      error: (error) => {
        console.error('Error al cargar tasas de cambio:', error);
        this.tasasPorId = {
          'dolar': 36.5,
          'euro': 39.2,
          'bolivar': 1
        };
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
        console.log('📦 RESPUESTA DEL API:');
        console.log('- Total ventas recibidas:', response.ventas?.length);

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
        console.error('❌ ERROR al cargar ventas:', error);
        this.loader.hide();
      }
    });
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

    // Calcular el total pagado en la moneda de la venta
    const totalPagadoEnMonedaVenta = metodosPago.reduce((total: number, metodo: any) => {
      return total + (metodo.monto_en_moneda_de_venta || 0);
    }, 0);

    // Determinar si es Cashea
    const esCashea = formaPago?.tipo === 'cashea';

    // Preparar métodos de pago limpios
    const metodosPagoLimpios = metodosPago.map((metodo: any) => {
      const metodoLimpio: any = {
        tipo: metodo.tipo,
        monto: metodo.monto,
        montoPagado: metodo.monto_en_moneda_de_venta || metodo.monto,
        moneda_id: metodo.moneda_id,
        monto_en_moneda_de_venta: metodo.monto_en_moneda_de_venta,
        referencia: metodo.referencia
      };

      // Solo agregar información bancaria si existe
      if (metodo.bancoNombre) {
        metodoLimpio.bancoCodigo = metodo.bancoCodigo;
        metodoLimpio.bancoNombre = metodo.bancoNombre;

        // Solo crear propiedad 'banco' si ambos existen
        if (metodo.bancoCodigo && metodo.bancoNombre) {
          metodoLimpio.banco = `${metodo.bancoCodigo} - ${metodo.bancoNombre}`;
        } else if (metodo.bancoNombre) {
          metodoLimpio.banco = metodo.bancoNombre;
        }
      }

      // Solo agregar conversión si es diferente de bolívar
      if (metodo.moneda_id !== 'bolivar') {
        metodoLimpio.conversionBs = this.calcularConversionBs(
          metodo.monto_en_moneda_de_venta || metodo.monto,
          metodo.moneda_id
        );
      }

      return metodoLimpio;
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
      montoAbonado: totalPagadoEnMonedaVenta,
      pagoCompleto: totalPagadoEnMonedaVenta >= totales.total,
      deudaPendiente: Math.max(0, totales.total - totalPagadoEnMonedaVenta),

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
        nombre: asesor.nombre
      },
      especialista: {
        id: 0,
        nombre: 'No asignado'
      },
      //asesorNombre: asesor.nombre,

      // Contenido de la venta
      productos: productosLimpios,
      productosOriginales: ventaApi.productos,
      servicios: [],
      metodosPago: metodosPagoLimpios,

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
    console.log('Cancelar venta:', venta);
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

    this.historialVentaService.obtenerHistorialVentas(
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
          this.paginacion.totalItems = response.totalItems || 0;
          this.paginacion.totalPaginas = response.totalPaginas || 1;
          this.generarRangoPaginas();
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
    console.log('this.selectedVenta', this.selectedVenta);
    if (!this.selectedVenta?.key) {
      this.swalService.showError('Error', 'No se puede cancelar la venta: falta información.');
      return;
    }

    console.log('this.motivoCancelacion', this.motivoCancelacion);
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
    if (!venta || !venta.metodosPago || !venta.metodosPago.length) {
      // Intentar obtener de otras propiedades
      if (venta?.formaPago?.totalPagadoAhora) {
        return venta.formaPago.totalPagadoAhora;
      }
      if (venta?.totales?.totalPagado) {
        return venta.totales.totalPagado;
      }
      return 0;
    }

    // Sumar todos los montos en la moneda de la venta
    return venta.metodosPago.reduce((total: number, pago: any) => {
      const montoPagado = pago.monto_en_moneda_de_venta || 0;
      return total + montoPagado;
    }, 0);
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

      // Convertir moneda al formato exacto que espera el backend
      const monedaFormatoBackend = this.convertirMonedaParaBackend(monedaMetodo);

      // Limpiar valores - convertir cadenas vacías a null
      const referencia = metodo.referencia?.trim() || null;
      const bancoCodigo = metodo.bancoCodigo?.trim() || null;
      const bancoNombre = metodo.bancoNombre?.trim() || null;

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
        referencia: referencia,
        bancoCodigo: bancoCodigo,
        bancoNombre: bancoNombre,

        // Campos adicionales para debug y validación
        montoEnMonedaVenta: montoEnMonedaVenta,
        tasaConversion: this.obtenerTasaConversion(monedaFormatoBackend, this.getMonedaVenta()),
        monedaOriginal: monedaFormatoBackend,
        monedaVenta: this.getMonedaVenta()
      };

      console.log(`🔍 Método ${index} preparado:`, {
        tipo: metodoFormateado.tipo,
        montoOriginal: metodoFormateado.monto,
        monedaOriginal: metodoFormateado.moneda,
        montoEnMonedaVenta: metodoFormateado.montoEnMonedaVenta,
        tasa: metodoFormateado.tasaConversion
      });

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

    console.log('🔄 Actualizando venta local con datos del backend:', ventaActualizadaAPI);

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

    console.log('✅ Venta actualizada localmente:', {
      key: this.selectedVenta.key,
      montoAbonado: this.selectedVenta.montoAbonado,
      deudaPendiente: this.selectedVenta.deudaPendiente,
      totalMetodos: this.selectedVenta.metodosPago?.length || 0
    });
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
    const metodosPago = this.prepararMetodosPagoParaAPI();

    // Validar métodos antes de enviar
    if (!this.validarMetodosPagoAntesDeEnviar(metodosPago)) {
      return;
    }

    const totalMetodosEnMonedaVenta = this.calcularTotalMetodosPagoEnMonedaVenta();

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
    • Abonado anterior: ${this.formatearMoneda(montoAbonadoAnterior)}<br>
    • Nuevo abono: ${this.formatearMoneda(nuevoAbono)}<br>
    • Total abonado: ${this.formatearMoneda(totalAbonado)}<br>
    • Nueva deuda: ${this.formatearMoneda(nuevaDeudaPendiente)}<br><br>
    
    <strong>💳 Métodos de pago a registrar (${metodosPago.length}):</strong><br>
  `;

    metodosPago.forEach((metodo, index) => {
      const montoEnMonedaVenta = this.convertirMonto(
        metodo.monto,
        metodo.moneda,
        this.getMonedaVenta()
      );

      mensajeConfirmacion += `
      ${index + 1}. ${metodo.tipo}: ${this.formatearMoneda(metodo.monto, metodo.moneda)}
      ${metodo.moneda !== this.getMonedaVenta() ? `(≈ ${this.formatearMoneda(montoEnMonedaVenta)})` : ''}<br>
    `;
    });

    mensajeConfirmacion += `<br><strong>💰 Total en ${this.getMonedaVenta()}: ${this.formatearMoneda(totalMetodosEnMonedaVenta)}</strong>`;

    this.swalService.showConfirm(
      'Confirmar Abono Completo',
      mensajeConfirmacion,
      '✅ Sí, Registrar Abono Completo',
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

    console.log('📤 Enviando al backend:', requestData);
    console.log('📊 Métodos de pago:', metodosPago);
    console.log('💰 Total abonado:', montoAbonado);
    console.log('💵 Moneda de venta:', this.getMonedaVenta());

    this.enviarAbonoCompleto(modal, requestData);
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

  private validarMetodosPagoAntesDeEnviar(metodosPago: any[]): boolean {
    let errores: string[] = [];

    // Verificar que todos los métodos tengan monto > 0
    metodosPago.forEach((metodo, index) => {
      if (!metodo.monto || metodo.monto <= 0) {
        errores.push(`El método ${index + 1} (${metodo.tipo}) no tiene un monto válido`);
      }

      if (!metodo.moneda) {
        errores.push(`El método ${index + 1} (${metodo.tipo}) no tiene moneda especificada`);
      }
    });

    // Verificar conversiones
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

    const montoAbonado = this.editarVentaForm?.get('montoAbonado')?.value || 0;

    if (Math.abs(totalCalculado - montoAbonado) > 0.01) {
      errores.push(
        `La suma de los métodos (${this.formatearMoneda(totalCalculado)}) ` +
        `no coincide con el monto abonado (${this.formatearMoneda(montoAbonado)})`
      );
    }

    if (errores.length > 0) {
      this.swalService.showWarning(
        'Errores de validación',
        `<strong>Por favor corrija los siguientes errores:</strong><br><br>` +
        errores.map(error => `• ${error}`).join('<br>')
      );
      return false;
    }

    return true;
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
        'El abono se ha registrado correctamente con todos los métodos de pago.'
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

    // Mostrar en consola para debug
    console.log('🎯 Resumen del abono procesado:', {
      venta: venta.venta?.numero_venta,
      totalVenta: venta.totales?.total,
      totalPagado: venta.totales?.totalPagado,
      deudaPendiente: venta.formaPago?.deudaPendiente,
      metodosRegistrados: metodosRegistrados
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

  // Método para seleccionar moneda para un método de pago específico
  seleccionarMonedaEfectivo(index: number, moneda: string): void {
    const metodoControl = this.metodosPagoArray.at(index);

    // Validar que el método sea efectivo
    if (metodoControl.get('tipo')?.value !== 'efectivo') {
      return;
    }

    // Actualizar la moneda de efectivo global (para mantener compatibilidad)
    switch (moneda.toLowerCase()) {
      case 'usd':
      case 'dolar':
        this.monedaEfectivo = 'USD';
        break;
      case 'eur':
      case 'euro':
        this.monedaEfectivo = 'EUR';
        break;
      case 'bs':
      case 'bolivar':
        this.monedaEfectivo = 'Bs';
        break;
    }

    // Forzar recálculo de montos y validaciones
    setTimeout(() => {
      this.validarMontoMetodoPago(index);
      this.ajustarMontosMetodosPago();
    });
  }

  // Modificar getMonedaParaMetodo para usar monedas específicas por método
  getMonedaParaMetodo(index: number): string {
    const metodoControl = this.metodosPagoArray.at(index);
    const tipoPago = metodoControl?.get('tipo')?.value;

    switch (tipoPago) {
      case 'efectivo':
        // Para efectivo, usar la moneda seleccionada globalmente
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

  // Modificar getSimboloMonedaMetodo para ser consistente
  getSimboloMonedaMetodo(tipoPago: string): string {
    switch (tipoPago) {
      case 'efectivo':
        // Para efectivo, usar el símbolo de la moneda global
        return this.getSimboloMonedaEfectivo();
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

    // Si es efectivo y tiene moneda específica, actualizar la global
    if (metodo.tipo === 'efectivo' && metodo.moneda_id) {
      if (metodo.moneda_id === 'bolivar') {
        this.monedaEfectivo = 'Bs';
      } else if (metodo.moneda_id === 'euro') {
        this.monedaEfectivo = 'EUR';
      } else {
        this.monedaEfectivo = 'USD';
      }
    }

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

    // Redondear a 2 decimales para evitar problemas de precisión
    return Math.max(0, this.redondear(deuda, 2));
  }

  // Y actualizar tu función redondear para permitir decimales específicos
  private redondear(valor: number, decimales: number = 2): number {
    const factor = Math.pow(10, decimales);
    return Math.round(valor * factor) / factor;
  }

  // También asegúrate que getConversionBs redondee correctamente
  getConversionBs(monto: number): number {
    const monedaVenta = this.getMonedaVenta();

    if (monedaVenta === 'bolivar') {
      return this.redondear(monto, 2);
    }

    const tasa = this.tasasPorId[monedaVenta] || 1;
    return this.redondear(monto * tasa, 2);
  }

  // Obtener monto máximo permitido en moneda de venta
  getMontoMaximoPermitido(): number {
    return this.calcularMontoDeuda();
  }

  reinicializarFormularioConDeuda() {
    const montoDeuda = this.calcularMontoDeuda();

    if (this.editarVentaForm) {
      // Inicializar con valor vacío (null) en lugar del monto de deuda
      this.editarVentaForm.patchValue({
        montoAbonado: null, // Cambiado de montoDeuda a null
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

  // CORRECCIÓN: Obtener montos de progreso en moneda de venta
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
      'cancelada': 'Cancelada',
      'anulada': 'Cancelada'
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

  private cargarVentasPagina(pagina: number, esBusquedaConFiltros: boolean = false): void {
    if (esBusquedaConFiltros) {
      this.loader.showWithMessage('🔍 Aplicando filtros...');
    } else if (pagina === 1 && !this.hayFiltrosActivos()) {
      this.loader.showWithMessage('📋 Cargando historial de ventas...');
    } else {
      this.loader.showWithMessage('📋 Cargando ventas...');
    }

    this.historialVentaService.obtenerHistorialVentas(
      pagina,
      this.paginacion.itemsPorPagina,
      this.filtros
    ).subscribe({
      next: (response: any) => {
        console.log('📦 RESPUESTA PAGINADA DEL API:');
        console.log('- Página:', pagina);
        console.log('- Ventas recibidas:', response.ventas?.length);
        console.log('- Total items:', response.totalItems);
        console.log('- Total páginas:', response.totalPaginas);
        console.log('- Filtros aplicados:', this.filtros);

        if (response.message === 'ok' && response.ventas) {
          // Procesar las ventas de la página actual
          const ventasPagina = response.ventas.map((ventaApi: any) =>
            this.adaptarVentaDelApi(ventaApi)
          );

          // Actualizar propiedades de paginación con datos del backend
          this.paginacion.paginaActual = pagina;
          this.paginacion.totalItems = response.totalItems || 0;
          this.paginacion.totalPaginas = response.totalPaginas || 1;

          // Asignar ventas filtradas (solo las de la página actual)
          this.ventasFiltradas = ventasPagina;

          // Generar rango de páginas
          this.generarRangoPaginas();

          // Cargar estadísticas con los mismos filtros
          this.cargarEstadisticas();

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
   * Carga estadísticas con los filtros actuales
   */
  private cargarEstadisticas(): void {
    /* this.historialVentaService.obtenerEstadisticasVentas(this.filtros).subscribe({
       next: (estadisticas: any) => {
         console.log('📊 Estadísticas recibidas:', estadisticas);
         // Aquí puedes actualizar las tarjetas de resumen con los datos del backend
         // Por ejemplo:
         // this.actualizarTarjetasResumen(estadisticas);
       },
       error: (error) => {
         console.error('Error al cargar estadísticas:', error);
         // En caso de error, calcular estadísticas localmente con las ventas cargadas
         this.calcularEstadisticasLocales();
       }
     });*/
  }

  /**
   * Calcula estadísticas localmente (fallback)
   */
  private calcularEstadisticasLocales(): void {
    // Esta función se usaría si el endpoint de estadísticas falla
    // Calcula basándose únicamente en las ventas de la página actual
    // NOTA: Esto no será preciso ya que no tenemos todas las ventas
    console.warn('Usando cálculo local de estadísticas (puede ser impreciso)');
  }

  /**
   * Maneja cambios en los filtros 
   */
  onFiltroChange(): void {
    this.paginacion.paginaActual = 1;
    this.cargarVentasPagina(1, true);
  }

  /**
   * Limpia todos los filtros y vuelve a cargar
   */
  limpiarFiltros(): void {
    this.filtros = {
      busquedaGeneral: '',
      asesor: '',
      especialista: '',
      fechaDesde: '',
      fechaHasta: '',
      estado: '',
      formaPago: '',
    };
    this.paginacion.paginaActual = 1;
    this.fechaUnica = '';
    this.cargarVentasPagina(1, false);
  }

  // ========== MÉTODOS DE PAGINACIÓN ==========
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
    return this.paginacion.totalItems || 0;
  }

  getVentasCompletadas(): number {
    return this.ventasFiltradas.filter(venta =>
      venta.estado === 'completada' && this.getDeudaPendiente(venta) === 0
    ).length;
  }

  getVentasPendientes(): number {
    return this.ventasFiltradas.filter(venta =>
      this.ventaTienePendiente(venta)
    ).length;
  }

  getVentasCanceladas(): number {
    return this.ventasFiltradas.filter(venta =>
      venta.estado === 'cancelada'
    ).length;
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

  // Método para estadísticas (mantén la conversión)
  getMontoCompletadas(): string {
    const ventasCompletadas = this.ventasFiltradas.filter(venta =>
      venta.estado === 'completada' && this.getDeudaPendiente(venta) === 0
    );

    let total = 0;

    // Sumar convirtiendo cada monto a la moneda del sistema
    ventasCompletadas.forEach(venta => {
      const monedaVenta = venta.moneda || 'dolar';
      const monedaSistemaNormalizada = this.normalizarMonedaParaVenta(this.monedaSistema);

      if (monedaVenta === monedaSistemaNormalizada) {
        total += venta.montoTotal;
      } else {
        total += this.convertirMonto(venta.montoTotal, monedaVenta, monedaSistemaNormalizada);
      }
    });

    return this.formatearMoneda(total, this.monedaSistema);
  }

  getMontoPendientes(): string {
    const ventasPendientes = this.ventasFiltradas.filter(venta =>
      this.ventaTienePendiente(venta)
    );

    let total = 0;

    ventasPendientes.forEach(venta => {
      const deuda = this.getDeudaPendiente(venta);
      const monedaVenta = venta.moneda || 'dolar';
      const monedaSistemaNormalizada = this.normalizarMonedaParaVenta(this.monedaSistema);

      if (monedaVenta === monedaSistemaNormalizada) {
        total += deuda;
      } else {
        total += this.convertirMonto(deuda, monedaVenta, monedaSistemaNormalizada);
      }
    });

    return this.formatearMoneda(total, this.monedaSistema);
  }

  getMontoCanceladas(): string {
    const ventasCanceladas = this.ventasFiltradas.filter(venta =>
      venta.estado === 'cancelada'
    );

    let total = 0;

    ventasCanceladas.forEach(venta => {
      const monedaVenta = venta.moneda || 'dolar';
      const monedaSistemaNormalizada = this.normalizarMonedaParaVenta(this.monedaSistema);

      if (monedaVenta === monedaSistemaNormalizada) {
        total += venta.montoTotal;
      } else {
        total += this.convertirMonto(venta.montoTotal, monedaVenta, monedaSistemaNormalizada);
      }
    });

    return this.formatearMoneda(total, this.monedaSistema);
  }




  // ========== MÉTODOS PARA EL RECIBO ==========

  /**
  * Método para ver el recibo de una venta - VERSIÓN MEJORADA
  */
  verRecibo(venta: any): void {
    console.log('📄 Preparando recibo para venta:', venta);
    console.log('Datos de formaPago:', venta.formaPago);
    console.log('Deuda pendiente del API:', venta.formaPago?.deudaPendiente);
    console.log('Total venta:', venta.total);
    console.log('Total pagado:', this.getTotalPagadoVenta(venta));

    // VALIDACIÓN 1: Verificar que la venta no sea null/undefined
    if (!venta) {
      console.error('❌ Error crítico: venta es null o undefined');
      this.swalService.showError('Error', 'No se puede mostrar el recibo: información de venta no disponible');
      return;
    }

    // VALIDACIÓN 2: Verificar propiedades mínimas requeridas
    if (!venta.key || !venta.numeroControl) {
      console.warn('⚠️ Advertencia: venta no tiene propiedades clave:', venta);
      this.swalService.showWarning('Advertencia', 'La venta no tiene información completa');
    }

    // Cerrar modal anterior si está abierto
    this.cerrarModalRecibo();

    // Pequeño delay para asegurar limpieza
    setTimeout(() => this.iniciarReciboNuevo(venta), 50);
  }

  /**
   * Método auxiliar para iniciar un nuevo recibo
   */
  private iniciarReciboNuevo(venta: any): void {
    try {
      // Crear una copia para evitar mutaciones
      this.ventaParaRecibo = {
        ...venta,
        // Asegurar propiedades críticas con valores por defecto
        formaPago: venta.formaPago || 'contado',
        montoAbonado: venta.montoAbonado || 0,
        montoInicial: venta.montoInicial || 0,
        moneda: venta.moneda || 'dolar',
        total: venta.total || 0,
        subtotal: venta.subtotal || 0,
        totalIva: venta.totalIva || 0,
        descuento: venta.descuento || 0
      };

      console.log('venta', venta)

      console.log('✅ Venta preparada para recibo:', {
        key: this.ventaParaRecibo.key,
        numeroControl: this.ventaParaRecibo.numeroControl,
        formaPago: this.ventaParaRecibo.formaPago,
        montoAbonado: this.ventaParaRecibo.montoAbonado,
        total: this.ventaParaRecibo.total
      });

      // Preparar datos para el recibo
      this.prepararDatosRecibo(this.ventaParaRecibo);

      // Mostrar el modal después de preparar los datos
      setTimeout(() => {
        this.mostrarModalRecibo = true;

        // Forzar detección de cambios
        setTimeout(() => {
          this.scrollToTop();

          // Log para depuración
          console.log('🎯 Modal de recibo mostrado:', {
            mostrarModalRecibo: this.mostrarModalRecibo,
            ventaParaRecibo: !!this.ventaParaRecibo,
            datosRecibo: !!this.datosRecibo
          });
        }, 50);
      }, 50);

    } catch (error) {
      console.error('💥 Error crítico al preparar recibo:', error);
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
    console.log('📦 Productos disponibles:', {
      productosProcesados: this.ventaParaRecibo?.productos,
      productosOriginales: this.ventaParaRecibo?.productosOriginales
    });

    if (!this.ventaParaRecibo) {
      return [];
    }

    // PRIORIDAD 1: Usar productosOriginales si están disponibles
    if (this.ventaParaRecibo.productosOriginales &&
      this.ventaParaRecibo.productosOriginales.length > 0) {

      console.log('✅ Usando productos originales del API');

      return this.ventaParaRecibo.productosOriginales.map((prod: any) => {
        // Precio unitario sin IVA del API original
        const precioUnitarioSinIva = prod.precio_unitario_sin_iva || 0;
        const cantidad = prod.cantidad || 1;

        // Calcular subtotal: precio sin IVA × cantidad
        const subtotalCalculado = precioUnitarioSinIva * cantidad;

        console.log(`📊 Producto original "${prod.datos?.nombre}":`, {
          precio_unitario_sin_iva: precioUnitarioSinIva,
          cantidad: cantidad,
          subtotalCalculado: subtotalCalculado,
          totalOriginal: prod.total
        });

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
    console.log('⚠️ Usando productos procesados (fallback)');

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
   * Obtener métodos de pago seguros
   */
  getMetodosPagoSeguros(): any[] {
    if (!this.ventaParaRecibo || !this.ventaParaRecibo.metodosPago) {
      return [];
    }

    return this.ventaParaRecibo.metodosPago.map((metodo: any) => ({
      tipo: metodo.tipo || 'efectivo',
      monto: metodo.monto || 0,
      moneda: metodo.moneda_id || this.ventaParaRecibo.moneda || 'dolar',
      referencia: metodo.referencia,
      banco: metodo.banco || metodo.bancoNombre
    }));
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

    console.log('Cálculo de deuda:', { total, pagado, deuda });
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

    console.log('Cálculo de porcentaje:', { total, pagado, porcentaje, porcentajeRedondeado });
    return porcentajeRedondeado;
  }

  // Método para obtener total pagado
  getTotalPagadoSeguro(): number {
    return this.getTotalPagadoVenta(this.ventaParaRecibo);
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

      console.log('🖨️ Preparando productos ORIGINALES para impresión:',
        this.ventaParaRecibo.productosOriginales);

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

    // Prioridad 2: Calcular a partir de productos procesados
    console.log('🖨️ Preparando productos PROCESADOS para impresión:',
      this.ventaParaRecibo.productos);

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

  generarReciboHTML(datos: any): string {
    if (!datos) {
      datos = this.crearDatosReciboReal();
    }

    const formaPago = datos.configuracion?.formaPago || 'contado';
    const tituloRecibo = this.getTituloReciboParaHTML(formaPago);
    const mensajeFinal = this.getMensajeFinalParaHTML(formaPago);

    // Determinar si mostrar "Total a pagar" según la forma de pago
    const mostrarTotalAPagar = this.debeMostrarTotalAPagar(formaPago, datos);
    const textoTotalAPagar = this.getTextoTotalAPagarParaHTML(formaPago);

    // CREAR UNA FUNCIÓN LOCAL PARA FORMATEAR MONEDA
    const formatearMonedaLocal = (monto: number | null | undefined, moneda?: string) => {
      if (monto === null || monto === undefined || isNaN(monto)) {
        return this.obtenerSimboloMoneda(moneda || datos.configuracion?.moneda || 'dolar') + '0.00';
      }

      // Asegurarse de que es un número
      const montoNumerico = Number(monto);

      if (isNaN(montoNumerico)) {
        return this.obtenerSimboloMoneda(moneda || datos.configuracion?.moneda || 'dolar') + '0.00';
      }

      const monedaFinal = moneda || datos.configuracion?.moneda || 'dolar';
      const simbolo = this.obtenerSimboloMoneda(monedaFinal);

      return `${simbolo}${montoNumerico.toFixed(2)}`;
    };

    return `
  <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Recibo - ${datos.numeroVenta}</title>
          <style>
              /* Tus estilos CSS existentes se mantienen igual */
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
                  font-size: 8px;
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
                  font-size: 8px;
              }
              
              .cliente-compacto {
                  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                  border-left: 2px solid #2c5aa0;
                  padding: 6px;
                  font-size: 8px;
                  margin-bottom: 8px;
                  border-radius: 2px;
              }
              
              .tabla-productos {
                  width: 100%;
                  border-collapse: collapse;
                  margin-bottom: 8px;
                  font-size: 8px;
              }
              
              .tabla-productos th {
                  background: #2c5aa0;
                  color: white;
                  font-weight: 600;
                  padding: 3px 4px;
                  text-align: left;
                  border: 1px solid #dee2e6;
                  font-size: 8px;
              }
              
              .tabla-productos td {
                  border: 1px solid #dee2e6;
                  padding: 2px 3px;
                  vertical-align: middle;
                  font-size: 8px;
              }
              
              .text-center { text-align: center; }
              .text-end { text-align: right; }
              
              .metodos-compactos {
                  margin-bottom: 8px;
              }
              
              .metodo-item {
                  display: flex;
                  justify-content: space-between;
                  margin-bottom: 3px;
                  padding: 2px 0;
                  border-bottom: 1px dashed #dee2e6;
                  font-size: 8px;
              }
              
              .resumen-cashea {
                  background: #f8f9fa;
                  padding: 6px;
                  border-radius: 3px;
                  margin: 6px 0;
                  border-left: 2px solid #0dcaf0;
              }
              
              .pagos-section {
                  margin-bottom: 6px;
              }
              
              .pago-item {
                  display: flex;
                  justify-content: space-between;
                  margin-bottom: 3px;
                  padding: 3px 0;
                  border-bottom: 1px dashed #dee2e6;
                  font-size: 8px;
              }
              
              .pago-total {
                  display: flex;
                  justify-content: space-between;
                  margin-top: 4px;
                  padding-top: 4px;
                  border-top: 1px solid #ccc;
                  font-size: 8px;
              }
              
              .resumen-cuotas-compacto {
                  display: flex;
                  justify-content: center;
                  gap: 15px;
                  margin-top: 6px;
                  text-align: center;
              }
              
              .cuota-info {
                  text-align: center;
              }
              
              .monto-cuota {
                  font-size: 7px;
                  color: #666;
                  margin-top: 1px;
              }
              
              .resumen-abono {
                  background: #f8f9fa;
                  padding: 6px;
                  border-radius: 3px;
                  margin: 6px 0;
                  border-left: 2px solid #ffc107;
              }
              
              .abonos-section {
                  margin-bottom: 6px;
              }
              
              .abono-item {
                  display: flex;
                  justify-content: space-between;
                  margin-bottom: 3px;
                  padding: 3px 0;
                  border-bottom: 1px dashed #dee2e6;
                  font-size: 8px;
              }
              
              .total-abonado {
                  border-top: 1px solid #ccc;
                  padding-top: 3px;
                  margin-top: 3px;
              }
              
              .resumen-financiero {
                  background: white;
                  padding: 6px;
                  border-radius: 3px;
                  border: 1px solid #e9ecef;
                  margin: 6px 0;
              }
              
              .deuda-section, .progreso-section {
                  text-align: center;
                  margin-bottom: 6px;
              }
              
              .deuda-label, .progreso-label {
                  font-size: 7px;
                  color: #666;
                  margin-bottom: 1px;
              }
              
              .deuda-monto, .progreso-porcentaje {
                  font-size: 10px;
                  font-weight: bold;
              }
              
              .resumen-contado {
                  background: #f8f9fa;
                  padding: 6px;
                  border-radius: 3px;
                  margin: 6px 0;
                  border-left: 2px solid #198754;
                  text-align: center;
              }
              
              .totales-compactos {
                  margin-bottom: 8px;
              }
              
              .totales-compactos table {
                  width: 100%;
                  border-collapse: collapse;
                  font-size: 9px;
              }
              
              .totales-compactos td {
                  padding: 3px 4px;
                  border: 1px solid #dee2e6;
              }
              
              .table-success {
                  background: linear-gradient(135deg, #d4edda, #c3e6cb);
              }
              
              .table-info {
                  background: linear-gradient(135deg, #d1ecf1, #c3e6ff);
              }
              
              .observaciones-compactas {
                  margin-bottom: 8px;
              }
              
              .alert-warning {
                  background: #fff3cd;
                  border: 1px solid #ffeaa7;
                  color: #856404;
                  padding: 4px;
                  border-radius: 2px;
                  font-size: 8px;
              }
              
              .terminos-compactos {
                  border-top: 1px solid #ddd;
                  padding-top: 6px;
                  margin-top: 8px;
                  font-size: 7px;
                  color: #666;
              }
              
              .mensaje-final {
                  text-align: center;
                  border-top: 1px solid #ddd;
                  padding-top: 6px;
                  margin-top: 6px;
                  font-size: 9px;
                  color: #2c5aa0;
                  font-weight: bold;
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
              
              .progress {
                  background-color: #e9ecef;
                  border-radius: 4px;
                  overflow: hidden;
                  height: 3px;
                  margin: 2px auto;
                  width: 50%;
              }
              
              .progress-bar {
                  background-color: #198754;
                  height: 100%;
                  transition: width 0.6s ease;
              }
              
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
          // Usar precioUnitario que viene de prepararProductosParaRecibo
          const precioUnitario = producto.precio_unitario_sin_iva || 0;
          // Usar subtotal que viene de prepararProductosParaRecibo
          const subtotal = producto.subtotal || 0;

          console.log('producto HTML', producto);

          return `
                          <tr>
                              <td class="text-center">${index + 1}</td>
                              <td>${producto.nombre}</td>
                              <td class="text-center">${producto.cantidad || 1}</td>
                              <td class="text-end">${this.formatearMoneda(precioUnitario)}</td>
                              <td class="text-end">${this.formatearMoneda(subtotal)}</td>
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

              <!-- Métodos de pago -->
              ${datos.metodosPago && datos.metodosPago.length > 0 ? `
                  <div class="metodos-compactos page-break-avoid">
                      <h6 style="font-weight: bold; margin-bottom: 6px; color: #2c5aa0; border-bottom: 1px solid #2c5aa0; padding-bottom: 2px;">MÉTODOS DE PAGO</h6>
                      ${datos.metodosPago.map((metodo: any) => `
                          <div class="metodo-item">
                              <span>
                                  <span class="badge bg-primary"> ${this.formatearTipoPago(metodo.tipo)} </span>
                                  ${metodo.referencia ? '- Ref: ' + metodo.referencia : ''}
                                  ${metodo.banco ? '- ' + metodo.banco : ''}
                              </span>
                              <span> ${this.formatearMoneda(metodo.monto, metodo.moneda)}</span>
                          </div>
                      `).join('')}
                  </div>
              ` : ''}

              <!-- SECCIÓN CASHEA COMPLETA - CORREGIDA -->
              ${datos.cashea ? `
                  <div class="resumen-venta page-break-avoid">
                      <h6 style="font-weight: bold; margin-bottom: 6px; color: #2c5aa0; border-bottom: 1px solid #2c5aa0; padding-bottom: 2px;">RESUMEN DE VENTA</h6>
                      
                      <div class="resumen-cashea">
                          <!-- Forma de pago -->
                          <div style="text-align: center; margin-bottom: 8px;">
                              <span class="badge bg-info fs-6">PLAN CASHEA</span>
                          </div>

                          <!-- Información del plan Cashea -->
                          <div style="text-align: center; margin-bottom: 8px;">
                              <div class="cashea-info">
                                  <div class="nivel-cashea" style="margin-bottom: 4px;">
                                      <small class="text-muted">NIVEL</small>
                                      <div class="fw-bold text-primary" style="font-size: 10px;">${this.obtenerNombreNivelCashea(datos.cashea.nivel)}</div>
                                  </div>
                              </div>
                          </div>

                          <!-- Desglose de pagos - CORREGIDO -->
                          <div class="pagos-section">
                              <h6 style="text-align: center; margin-bottom: 8px; font-weight: bold; color: #2c5aa0; font-size: 10px;">DESGLOSE DE PAGOS</h6>

                              <!-- Pago inicial -->
                              <div class="pago-item">
                                  <div style="text-align: center; width: 50%;">
                                      <strong style="font-size: 9px;">Pago Inicial</strong>
                                  </div>
                                  <div style="text-align: center; width: 50%;">
                                      <strong style="font-size: 9px;">${this.formatearMoneda(datos.cashea.inicial)}</strong>
                                  </div>
                              </div>

                              <!-- Cuotas adelantadas -->
                              ${datos.cashea.cuotasAdelantadas > 0 ? `
                                  <div class="pago-item">
                                      <div style="text-align: center; width: 50%;">
                                          <strong style="font-size: 9px;">${datos.cashea.cuotasAdelantadas} Cuota${datos.cashea.cuotasAdelantadas > 1 ? 's' : ''} Adelantada${datos.cashea.cuotasAdelantadas > 1 ? 's' : ''}</strong>
                                      </div>
                                      <div style="text-align: center; width: 50%;">
                                          <strong style="font-size: 9px;">${this.formatearMoneda(datos.cashea.montoAdelantado)}</strong>
                                      </div>
                                  </div>
                              ` : ''}

                              <!-- Total pagado ahora - CORREGIDO: MISMA FILA QUE LOS TÍTULOS -->
                              <div class="pago-total">
                                  <div style="text-align: center; width: 50%;">
                                      <strong style="font-size: 9px;">TOTAL PAGADO AHORA:</strong>
                                  </div>
                                  <div style="text-align: center; width: 50%;">
                                      <strong class="text-success" style="font-size: 9px;">${this.formatearMoneda(datos.totales.totalPagado)}</strong>
                                  </div>
                              </div>
                          </div>

                          <!-- Resumen de cuotas -->
                          <div class="resumen-cuotas-compacto">
                              <div class="cuota-info">
                                  <small class="text-muted" style="font-size: 8px;">CUOTAS PENDIENTES</small>
                                  <div class="fw-bold text-warning" style="font-size: 10px;">${datos.cashea.cantidadCuotas - datos.cashea.cuotasAdelantadas}</div>
                                  <div class="monto-cuota">${this.formatearMoneda(datos.cashea.montoPorCuota)} c/u</div>
                              </div>
                              <div class="cuota-info">
                                  <small class="text-muted" style="font-size: 8px;">DEUDA PENDIENTE</small>
                                  <div class="fw-bold text-danger" style="font-size: 10px;">${this.formatearMoneda(datos.cashea.deudaPendiente)}</div>
                              </div>
                          </div>
                      </div>
                  </div>
              ` : ''}

              <!-- SECCIÓN ABONO -->
              ${datos.abono ? `
                  <div class="resumen-venta page-break-avoid">
                      <h6 style="font-weight: bold; margin-bottom: 6px; color: #2c5aa0; border-bottom: 1px solid #2c5aa0; padding-bottom: 2px;">RESUMEN DE VENTA</h6>
                      
                      <div class="resumen-abono">
                          <!-- Forma de pago -->
                          <div style="text-align: center; margin-bottom: 8px;">
                              <span class="badge bg-warning text-dark fs-6">ABONO PARCIAL</span>
                          </div>

                          <!-- Abonos realizados -->
                          <div class="abonos-section">
                              <h6 style="text-align: center; margin-bottom: 8px; font-weight: bold; color: #2c5aa0; font-size: 10px;">ABONOS REALIZADOS</h6>

                              <div class="abonos-list">
                                  <div class="abono-item">
                                      <div style="text-align: center; width: 50%;">
                                          <strong style="font-size: 9px;">${datos.fecha}</strong>
                                      </div>
                                      <div style="text-align: center; width: 50%;">
                                          <strong style="font-size: 9px;">${this.formatearMoneda(datos.abono.montoAbonado)}</strong>
                                      </div>
                                  </div>
                                  
                                  <!-- Total abonado EN LA MISMA SECCIÓN -->
                                  <div class="abono-item total-abonado" style="border-top: 1px solid #ccc; padding-top: 4px; margin-top: 4px;">
                                      <div style="text-align: center; width: 50%;">
                                          <strong style="font-size: 9px;">TOTAL ABONADO:</strong>
                                      </div>
                                      <div style="text-align: center; width: 50%;">
                                          <strong class="text-success" style="font-size: 9px;">${this.formatearMoneda(datos.abono.montoAbonado)}</strong>
                                      </div>
                                  </div>
                              </div>
                          </div>

                          <!-- Resumen financiero -->
                          <div class="resumen-financiero">
                              <div class="deuda-section">
                                  <div class="deuda-label">DEUDA PENDIENTE</div>
                                  <div class="deuda-monto text-danger">${this.formatearMoneda(datos.abono.deudaPendiente)}</div>
                              </div>

                              <div class="progreso-section">
                                  <div class="progreso-label">PORCENTAJE PAGADO</div>
                                  <div class="progreso-porcentaje text-success">${Math.round(datos.abono.porcentajePagado)}%</div>
                                  <div class="progress">
                                      <div class="progress-bar" style="width: ${datos.abono.porcentajePagado}%"></div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              ` : ''}

              ${!datos.cashea && !datos.abono ? `
                  <div class="resumen-venta page-break-avoid">
                      <h6 style="font-weight: bold; margin-bottom: 6px; color: #2c5aa0; border-bottom: 1px solid #2c5aa0; padding-bottom: 2px;">RESUMEN DE VENTA</h6>
                      
                      <div class="resumen-contado">
                          <div style="margin-bottom: 6px;">
                              <strong style="font-size: 10px;">Forma de pago:</strong><br>
                              <span class="badge bg-success">CONTADO</span>
                          </div>
                          <div>
                              <strong style="font-size: 10px;">Monto total:</strong><br>
                              ${this.formatearMoneda(datos.totales.totalPagado)}
                          </div>
                          <div style="margin-top: 6px; font-size: 9px; color: #666;">
                              El pago ha sido realizado en su totalidad
                          </div>
                      </div>
                  </div>
              ` : ''}

              <!-- Totales - MODIFICADO PARA INCLUIR "TOTAL A PAGAR" -->
              <div class="totales-compactos page-break-avoid">
                  <div style="display: flex; justify-content: flex-end;">
                      <div style="width: 50%;">
                          <table style="width: 100%;">
                              <tr>
                                  <td class="fw-bold" style="font-size: 10px;">Subtotal:</td>
                                  <td class="text-end" style="font-size: 10px;">${this.formatearMoneda(datos.totales.subtotal)}</td>
                              </tr>
                              <tr>
                                  <td class="fw-bold" style="font-size: 10px;">Descuento:</td>
                                  <td class="text-end text-danger" style="font-size: 10px;">- ${this.formatearMoneda(datos.totales.descuento)}</td>
                              </tr>
                              <tr>
                                  <td class="fw-bold" style="font-size: 10px;">IVA:</td>
                                  <td class="text-end" style="font-size: 10px;">${this.formatearMoneda(datos.totales.iva)}</td>
                              </tr>
                              ${mostrarTotalAPagar ? `
                                  <tr class="table-info">
                                      <td class="fw-bold" style="font-size: 11px;">${textoTotalAPagar}:</td>
                                      <td class="text-end fw-bold" style="font-size: 11px;">${this.formatearMoneda(datos.totales.total)}</td>
                                  </tr>
                              ` : ''}
                              <tr class="table-success">
                                  <td class="fw-bold" style="font-size: 11px;">${this.getTextoTotalPagadoParaHTML(formaPago)}:</td>
                                  <td class="text-end fw-bold" style="font-size: 11px;">${this.formatearMoneda(datos.totales.totalPagado)}</td>
                              </tr>
                          </table>
                      </div>
                  </div>
              </div>

              <!-- Observaciones -->
              ${datos.configuracion?.observaciones ? `
                  <div class="observaciones-compactas page-break-avoid">
                      <div class="alert-warning">
                          <strong>Observación:</strong> ${datos.configuracion.observaciones}
                      </div>
                  </div>
              ` : ''}

              <!-- Términos y condiciones -->
              <div class="terminos-compactos page-break-avoid">
                  <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 6px;">
                      <div>
                          <p style="margin-bottom: 2px;">
                              <i class="bi bi-exclamation-triangle"></i>
                              Pasados 30 días no nos hacemos responsables de trabajos no retirados
                          </p>
                          <p style="margin-bottom: 0;">
                              <i class="bi bi-info-circle"></i>
                              Estado de orden: tracking.optolapp.com
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
}



