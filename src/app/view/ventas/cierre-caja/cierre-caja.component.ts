import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CierreCajaService } from './cierre-caja.service';
import { HistorialVentaService } from '../../ventas/historial-ventas/historial-ventas.service';
import { SystemConfigService } from './../../system-config/system-config.service';
import { TasaCambiariaService } from './../../../core/services/tasaCambiaria/tasaCambiaria.service';
import { UserStateService, SedeInfo } from './../../../core/services/userState/user-state-service';
import { CierreDiario, Transaccion, ResumenMetodoPago, TasasCambio } from './cierre-caja.interfaz';
import { User, Rol, AuthData, AuthResponse, Cargo } from '../../../Interfaces/models-interface';
import { SwalService } from '../../../core/services/swal/swal.service';



@Component({
  selector: 'app-cierre-caja',
  standalone: false,
  templateUrl: './cierre-caja.component.html',
  styleUrls: ['./cierre-caja.component.scss'],
  providers: [DecimalPipe, DatePipe]
})

export class CierreCajaComponent implements OnInit, OnDestroy {
  fechaSeleccionada: Date = new Date();
  cierreActual: CierreDiario | null = null;
  transacciones: Transaccion[] = [];
  transaccionesFiltradas: Transaccion[] = [];
  mostrarFiltros = false;
  ultimaActualizacion = new Date();
  isMobile = false;

  // Información del usuario y sede
  sedeActual: SedeInfo | null = null;
  currentUser: User | null = null;

  // Configuración del sistema
  monedaSistema: string = 'USD';
  simboloMonedaSistema: string = '$';

  tasasCambio: TasasCambio = {
    dolar: 1,
    euro: 1,
    bolivar: 1
    // Otras propiedades se pueden agregar dinámicamente
  };

  private destroy$ = new Subject<void>();

  // Métodos de pago disponibles
  metodosPago = [
    { valor: 'efectivo', label: 'Efectivo', icono: 'bi-cash-coin', color: '#10b981' },
    { valor: 'tarjeta', label: 'Tarjeta', icono: 'bi-credit-card', color: '#8b5cf6' },
    { valor: 'transferencia', label: 'Transferencia', icono: 'bi-bank', color: '#3b82f6' },
    { valor: 'debito', label: 'Débito', icono: 'bi-credit-card-2-back', color: '#0ea5e9' },
    { valor: 'credito', label: 'Crédito', icono: 'bi-credit-card-2-front', color: '#f59e0b' },
    { valor: 'pagomovil', label: 'Pago Móvil', icono: 'bi-phone', color: '#ec4899' },
    { valor: 'zelle', label: 'Zelle', icono: 'bi-globe-americas', color: '#8b5cf6' },
    { valor: 'mixto', label: 'Mixto', icono: 'bi-wallet2', color: '#f59e0b' }
  ];

  // Tipos de transacción
  tiposTransaccion = [
    { valor: 'venta', label: 'Venta', icono: 'bi-cart-check', color: '#10b981' },
    { valor: 'ingreso', label: 'Ingreso', icono: 'bi-plus-circle', color: '#3b82f6' },
    { valor: 'egreso', label: 'Egreso', icono: 'bi-dash-circle', color: '#ef4444' },
    { valor: 'ajuste', label: 'Ajuste', icono: 'bi-arrow-left-right', color: '#8b5cf6' }
  ];

  // Forms
  inicioCajaForm: FormGroup;
  transaccionForm: FormGroup;
  cierreForm: FormGroup;
  filtroForm: FormGroup;

  // Estados modales
  mostrarModalInicio = false;
  mostrarModalTransaccion = false;
  mostrarModalCierre = false;
  mostrarHistorial = false;
  transaccionEditando: Transaccion | null = null;

  // Estados de carga
  cargandoDatos: boolean = false;
  guardandoCierre: boolean = false;

  constructor(
    private fb: FormBuilder,
    private decimalPipe: DecimalPipe,
    private datePipe: DatePipe,
    private cierreCajaService: CierreCajaService,
    private historialVentaService: HistorialVentaService,
    private systemConfigService: SystemConfigService,
    private tasaCambiariaService: TasaCambiariaService, // Nuevo
    private userStateService: UserStateService,
    private swalService: SwalService
  ) {
    this.inicializarForms();
    this.checkMobile();
  }

  @HostListener('window:resize')
  onResize() {
    this.checkMobile();
  }

  ngOnInit(): void {
    this.obtenerConfiguracionSistema();
    this.obtenerUsuarioYSede();
    this.inicializarTasasCambio();
    this.cargarDatosFecha();
    this.iniciarActualizacionAutomatica();
    this.configurarSuscripciones();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // === INICIALIZACIÓN ===

  private inicializarForms(): void {
    this.inicioCajaForm = this.fb.group({
      efectivoInicial: [0, [Validators.required, Validators.min(0)]],
      observaciones: ['Caja abierta normalmente'],
      moneda: ['USD', Validators.required]
    });

    this.transaccionForm = this.fb.group({
      tipo: ['venta', Validators.required],
      descripcion: ['', [Validators.required, Validators.minLength(3)]],
      monto: [0, [Validators.required, Validators.min(0.01)]],
      metodoPago: ['efectivo', Validators.required],
      categoria: ['venta_lentes'],
      comprobante: [''],
      observaciones: ['']
    });

    this.cierreForm = this.fb.group({
      efectivoFinalReal: [0, [Validators.required, Validators.min(0)]],
      observaciones: [''],
      notasCierre: ['Cierre realizado satisfactoriamente'],
      imprimirResumen: [true],
      enviarEmail: [false],
      adjuntarComprobantes: [true]
    });

    this.filtroForm = this.fb.group({
      tipo: ['todos'],
      metodoPago: ['todos'],
      usuario: ['todos'],
      categoria: ['todos'],
      fechaDesde: [this.datePipe.transform(new Date(), 'yyyy-MM-dd')],
      fechaHasta: [this.datePipe.transform(new Date(), 'yyyy-MM-dd')],
      montoMin: [null],
      montoMax: [null]
    });
  }

  // Actualizar el método obtenerConfiguracionSistema:
  private obtenerConfiguracionSistema(): void {
    this.monedaSistema = this.systemConfigService.getMonedaPrincipal();
    this.simboloMonedaSistema = this.systemConfigService.getSimboloMonedaPrincipal();

    // Obtener tasas de cambio del servicio de tasas
    this.tasaCambiariaService.getTasaActual().subscribe({
      next: (tasas: any) => {
        this.tasasCambio = {
          dolar: tasas?.tasa_usd || tasas?.dolar || 1,
          euro: tasas?.tasa_eur || tasas?.euro || 1,
          bolivar: 1
        };
        console.log('Tasas cargadas:', this.tasasCambio);
      },
      error: (error) => {
        console.error('Error al cargar tasas:', error);
        // Valores por defecto
        this.tasasCambio = {
          dolar: this.systemConfigService.getTasaPorId('dolar') || 1,
          euro: this.systemConfigService.getTasaPorId('euro') || 1,
          bolivar: 1
        };
      }
    });
  }

  // Método para inicializar/obtener tasas
  private inicializarTasasCambio(): void {
    // Obtener tasas del servicio
    this.tasaCambiariaService.getTasaActual().subscribe({
      next: (tasas: any) => {
        // Asegurar que siempre tengamos los 3 valores requeridos
        this.tasasCambio = {
          dolar: tasas?.tasa_usd || tasas?.dolar || this.systemConfigService.getTasaPorId('dolar') || 1,
          euro: tasas?.tasa_eur || tasas?.euro || this.systemConfigService.getTasaPorId('euro') || 1,
          bolivar: 1, // Siempre 1 para bolívares
          // Podemos agregar otras monedas si es necesario
          ...tasas // Copiar otras propiedades que puedan venir
        };

        console.log('Tasas cargadas:', this.tasasCambio);
      },
      error: (error) => {
        console.error('Error al cargar tasas:', error);
        // Valores por defecto
        this.tasasCambio = {
          dolar: this.systemConfigService.getTasaPorId('dolar') || 1,
          euro: this.systemConfigService.getTasaPorId('euro') || 1,
          bolivar: 1
        };
      }
    });
  }

  // Actualizar el método procesarVentasParaTransacciones:
  private procesarVentasParaTransacciones(ventas: any[]): void {
    this.transacciones = [];

    ventas.forEach(venta => {
      // Solo procesar ventas completadas
      if (venta.estado !== 'completada' && venta.estatus_pago !== 'completado') {
        return;
      }

      // Crear transacción principal
      const transaccionVenta: Transaccion = {
        id: venta.key || `VENTA-${venta.numero_venta}`,
        tipo: 'venta',
        descripcion: `Venta #${venta.numero_venta}`,
        monto: venta.total_pagado || venta.total || 0,
        fecha: new Date(venta.fecha),
        metodoPago: this.determinarMetodoPagoPrincipal(venta.metodosDePago),
        usuario: venta.asesor?.nombre || venta.auditoria?.usuarioCreacion?.nombre || 'Desconocido',
        estado: 'confirmado',
        categoria: 'venta',
        numeroVenta: venta.numero_venta,
        cliente: {
          nombre: venta.cliente?.informacion?.nombreCompleto || 'Cliente',
          cedula: venta.cliente?.informacion?.cedula || '',
          telefono: venta.cliente?.informacion?.telefono,
          email: venta.cliente?.informacion?.email
        },
        formaPago: venta.formaPago,
        detalleMetodosPago: venta.metodosDePago,
        productos: venta.productos,
        asesor: venta.asesor?.nombre,
        ordenTrabajoGenerada: venta.generarOrdenTrabajo,
        sede: venta.sede
      };

      this.transacciones.push(transaccionVenta);
    });
  }

  private determinarMetodoPagoPrincipal(metodosDePago: any[]): string {
    if (!metodosDePago || metodosDePago.length === 0) {
      return 'efectivo';
    }

    if (metodosDePago.length === 1) {
      return metodosDePago[0].tipo;
    }

    return 'mixto';
  }

  // Actualizar el método para obtener métodos de pago únicos:
  getMetodosPagoUnicos(): Array<{ valor: string, label: string }> {
    const metodos = new Set<string>();

    this.transacciones.forEach(transaccion => {
      metodos.add(transaccion.metodoPago);
    });

    return Array.from(metodos).map(metodo => ({
      valor: metodo,
      label: this.formatearTipoPago(metodo)
    }));
  }

  private obtenerUsuarioYSede(): void {
    this.userStateService.currentUser$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(user => {
      this.currentUser = user;

      if (user) {
        this.transaccionForm.patchValue({
          usuario: user.nombre
        });
      }
    });

    this.userStateService.sedeActual$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(sede => {
      this.sedeActual = sede;
    });
  }

  private configurarSuscripciones(): void {
    // Suscribirse a cambios en el formulario de filtro
    this.filtroForm.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.filtrarTransacciones();
    });

    // Suscribirse a cambios en el efectivo final real
    this.cierreForm.get('efectivoFinalReal')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(valor => {
      if (this.cierreActual) {
        const diferencia = valor - this.getEfectivoFinalTeorico();
        this.cierreActual.diferencia = diferencia;
      }
    });
  }

  private checkMobile(): void {
    this.isMobile = window.innerWidth < 768;
  }

  // === CARGA DE DATOS ===

  cargarDatosFecha(): void {
    if (!this.sedeActual) {
      this.swalService.showWarning('Sede no seleccionada', 'Selecciona una sede para continuar.');
      return;
    }

    this.cargandoDatos = true;

    this.cierreCajaService.obtenerResumenDiario(this.fechaSeleccionada, this.sedeActual.key)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resumen) => {
          this.procesarResumenDiario(resumen);
          this.cargandoDatos = false;
        },
        error: (error) => {
          console.error('Error al cargar datos:', error);
          this.swalService.showError('Error', 'No se pudieron cargar los datos del día.');
          this.cargandoDatos = false;
        }
      });
  }

  private procesarResumenDiario(resumen: any): void {
    // Procesar ventas como transacciones
    if (resumen.ventas && Array.isArray(resumen.ventas)) {
      this.procesarVentasParaTransacciones(resumen.ventas);
    }

    // Cargar cierre existente si hay
    if (resumen.cierreExistente) {
      this.cierreActual = resumen.cierreExistente;
    } else {
      this.inicializarCierreNuevo();
    }

    // Actualizar estadísticas si hay
    if (resumen.estadisticas) {
      this.actualizarConEstadisticas(resumen.estadisticas);
    }

    // Filtrar y actualizar
    this.filtrarTransacciones();
    this.actualizarResumen();
    this.ultimaActualizacion = new Date();
  }

  private inicializarCierreNuevo(): void {
    if (!this.sedeActual || !this.currentUser) return;

    this.cierreActual = {
      id: `CIERRE-${this.datePipe.transform(this.fechaSeleccionada, 'yyyy-MM-dd')}-${this.sedeActual.key}`,
      fecha: new Date(),
      efectivoInicial: 0,
      ventasEfectivo: 0,
      ventasTarjeta: 0,
      ventasTransferencia: 0,
      ventasDebito: 0,
      ventasCredito: 0,
      ventasPagomovil: 0,
      ventasZelle: 0,
      otrosIngresos: 0,
      egresos: 0,
      efectivoFinalTeorico: 0,
      efectivoFinalReal: 0,
      diferencia: 0,
      observaciones: '',
      estado: 'abierto',
      usuarioApertura: this.currentUser.nombre,
      usuarioCierre: '',
      fechaApertura: new Date(),
      transacciones: this.transacciones,
      notasCierre: '',
      archivosAdjuntos: [],
      sede: this.sedeActual.key,
      monedaPrincipal: this.monedaSistema,
      tasasCambio: this.tasasCambio,
      metodosPagoDetallados: this.calcularMetodosPagoDetallados()
    };
  }

  private actualizarConEstadisticas(estadisticas: any): void {
    if (!this.cierreActual) return;

    // Actualizar con estadísticas del backend si están disponibles
    if (estadisticas.totalVentas) {
      this.cierreActual.ventasEfectivo = estadisticas.totalEfectivo || 0;
      this.cierreActual.ventasTarjeta = estadisticas.totalTarjeta || 0;
      this.cierreActual.ventasTransferencia = estadisticas.totalTransferencia || 0;
    }
  }

  // === MÉTODOS DE CÁLCULO ===

  getTotalVentas(): number {
    if (!this.cierreActual) return 0;

    return this.cierreActual.ventasEfectivo +
      this.cierreActual.ventasTarjeta +
      this.cierreActual.ventasTransferencia +
      this.cierreActual.ventasDebito +
      this.cierreActual.ventasCredito +
      this.cierreActual.ventasPagomovil +
      this.cierreActual.ventasZelle;
  }

  getEfectivoFinalTeorico(): number {
    if (!this.cierreActual) return 0;

    return this.cierreActual.efectivoInicial +
      this.cierreActual.ventasEfectivo -
      this.getEgresosEfectivo();
  }

  getEgresosEfectivo(): number {
    return this.transacciones
      .filter(t => t.tipo === 'egreso' && t.metodoPago === 'efectivo')
      .reduce((sum, t) => sum + t.monto, 0);
  }

  getDiferencia(): number {
    if (!this.cierreActual) return 0;
    return this.cierreActual.diferencia;
  }

  getTotalIngresos(): number {
    return this.transacciones
      .filter(t => t.tipo === 'venta' || t.tipo === 'ingreso')
      .reduce((sum, t) => sum + t.monto, 0);
  }

  getTotalEgresos(): number {
    return this.transacciones
      .filter(t => t.tipo === 'egreso')
      .reduce((sum, t) => sum + t.monto, 0);
  }

  getNetoDia(): number {
    return this.getTotalIngresos() - this.getTotalEgresos();
  }

  getTotalMetodoPago(metodo: string): number {
    return this.transacciones
      .filter(t => t.metodoPago === metodo && (t.tipo === 'venta' || t.tipo === 'ingreso'))
      .reduce((sum, t) => sum + t.monto, 0);
  }

  getPorcentajeMetodoPago(metodo: string): number {
    const total = this.getTotalIngresos();
    if (total === 0) return 0;
    return (this.getTotalMetodoPago(metodo) / total) * 100;
  }

  getResumenMetodosPago(): any[] {
    const metodosAgrupados = new Map<string, {
      label: string;
      total: number;
      cantidad: number;
      color: string;
    }>();

    // Inicializar todos los métodos conocidos
    this.metodosPago.forEach(metodo => {
      metodosAgrupados.set(metodo.valor, {
        label: metodo.label,
        total: 0,
        cantidad: 0,
        color: metodo.color
      });
    });

    // Contar transacciones
    this.transacciones.forEach(transaccion => {
      if (transaccion.tipo === 'venta' || transaccion.tipo === 'ingreso') {
        const metodo = transaccion.metodoPago;

        if (!metodosAgrupados.has(metodo)) {
          // Si es un método no definido, crear una entrada
          metodosAgrupados.set(metodo, {
            label: this.formatearTipoPago(metodo),
            total: 0,
            cantidad: 0,
            color: '#64748b' // Color por defecto
          });
        }

        const datos = metodosAgrupados.get(metodo)!;
        datos.total += transaccion.monto;
        datos.cantidad += 1;
      }
    });

    const totalIngresos = this.getTotalIngresos();

    return Array.from(metodosAgrupados.entries())
      .map(([valor, datos]) => ({
        metodo: datos.label,
        total: datos.total,
        porcentaje: totalIngresos > 0 ? (datos.total / totalIngresos) * 100 : 0,
        cantidad: datos.cantidad,
        color: datos.color,
        valor: valor
      }))
      .filter(item => item.total > 0);
  }


  // === MÉTODOS DE TRANSACCIONES ===

  abrirModalTransaccion(): void {
    this.transaccionEditando = null;
    this.transaccionForm.reset({
      tipo: 'venta',
      metodoPago: 'efectivo',
      categoria: 'venta_lentes',
      monto: 0
    });
    this.mostrarModalTransaccion = true;
  }

  filtrarTransacciones(): void {
    const filtros = this.filtroForm.value;

    this.transaccionesFiltradas = this.transacciones.filter(trans => {
      // Filtrar por tipo
      if (filtros.tipo !== 'todos' && trans.tipo !== filtros.tipo) return false;

      // Filtrar por método de pago
      if (filtros.metodoPago !== 'todos' && trans.metodoPago !== filtros.metodoPago) return false;

      // Filtrar por usuario
      if (filtros.usuario !== 'todos' && trans.usuario !== filtros.usuario) return false;

      // Filtrar por categoría
      if (filtros.categoria !== 'todos' && trans.categoria !== filtros.categoria) return false;

      // Filtrar por monto
      if (filtros.montoMin && trans.monto < filtros.montoMin) return false;
      if (filtros.montoMax && trans.monto > filtros.montoMax) return false;

      // Filtrar por fecha
      if (filtros.fechaDesde || filtros.fechaHasta) {
        const fechaTrans = new Date(trans.fecha);
        const fechaDesde = filtros.fechaDesde ? new Date(filtros.fechaDesde) : null;
        const fechaHasta = filtros.fechaHasta ? new Date(filtros.fechaHasta) : null;

        if (fechaDesde && fechaTrans < fechaDesde) return false;
        if (fechaHasta && fechaTrans > fechaHasta) return false;
      }

      return true;
    });
  }

  editarTransaccion(transaccion: Transaccion): void {
    if (transaccion.numeroVenta) {
      this.swalService.showInfo(
        'Venta registrada',
        `Esta transacción proviene de la venta #${transaccion.numeroVenta}. 
        Para modificarla, edite la venta correspondiente.`
      );
      return;
    }

    this.transaccionEditando = transaccion;
    this.transaccionForm.patchValue({
      tipo: transaccion.tipo,
      descripcion: transaccion.descripcion,
      monto: transaccion.monto,
      metodoPago: transaccion.metodoPago,
      categoria: transaccion.categoria,
      observaciones: transaccion.observaciones || '',
      comprobante: transaccion.comprobante || ''
    });
    this.mostrarModalTransaccion = true;
  }

  guardarTransaccion(): void {
    if (this.transaccionForm.invalid) return;

    const formValue = this.transaccionForm.value;
    const nuevaTransaccion: Transaccion = {
      id: this.transaccionEditando?.id || `TRX-${Date.now()}`,
      tipo: formValue.tipo,
      descripcion: formValue.descripcion,
      monto: parseFloat(formValue.monto),
      fecha: new Date(),
      metodoPago: formValue.metodoPago,
      usuario: this.currentUser?.nombre || 'Usuario',
      estado: 'confirmado',
      categoria: formValue.categoria,
      observaciones: formValue.observaciones,
      comprobante: formValue.comprobante
    };

    if (this.transaccionEditando) {
      const index = this.transacciones.findIndex(t => t.id === this.transaccionEditando?.id);
      if (index !== -1) {
        this.transacciones[index] = nuevaTransaccion;
      }
    } else {
      this.transacciones.unshift(nuevaTransaccion);
    }

    this.actualizarResumen();
    this.filtrarTransacciones();
    this.mostrarModalTransaccion = false;
    this.transaccionEditando = null;
  }

  eliminarTransaccion(transaccion: Transaccion): void {
    if (transaccion.numeroVenta) {
      this.swalService.showError(
        'No se puede eliminar',
        'Esta transacción proviene de una venta registrada. Para eliminarla, cancele la venta correspondiente.'
      );
      return;
    }

    if (confirm(`¿Estás seguro de eliminar la transacción "${transaccion.descripcion}"?`)) {
      this.transacciones = this.transacciones.filter(t => t.id !== transaccion.id);
      this.actualizarResumen();
      this.filtrarTransacciones();
    }
  }

  // === MANEJO DE CIERRE ===

  abrirModalInicioCaja(): void {
    if (!this.sedeActual) {
      this.swalService.showError('Sede requerida', 'Debes estar asignado a una sede para iniciar caja.');
      return;
    }

    this.inicioCajaForm.patchValue({
      efectivoInicial: 0,
      observaciones: '',
      moneda: this.monedaSistema
    });
    this.mostrarModalInicio = true;
  }

  iniciarCaja(): void {
    if (this.inicioCajaForm.invalid || !this.sedeActual || !this.currentUser) return;

    const formValue = this.inicioCajaForm.value;

    this.cierreActual = {
      id: `CIERRE-${this.datePipe.transform(new Date(), 'yyyy-MM-dd')}-${this.sedeActual.key}`,
      fecha: new Date(),
      efectivoInicial: parseFloat(formValue.efectivoInicial),
      ventasEfectivo: 0,
      ventasTarjeta: 0,
      ventasTransferencia: 0,
      ventasDebito: 0,
      ventasCredito: 0,
      ventasPagomovil: 0,
      ventasZelle: 0,
      otrosIngresos: 0,
      egresos: 0,
      efectivoFinalTeorico: parseFloat(formValue.efectivoInicial),
      efectivoFinalReal: 0,
      diferencia: 0,
      observaciones: formValue.observaciones,
      estado: 'abierto',
      usuarioApertura: this.currentUser.nombre,
      usuarioCierre: '',
      fechaApertura: new Date(),
      transacciones: [],
      notasCierre: '',
      archivosAdjuntos: [],
      sede: this.sedeActual.key,
      monedaPrincipal: formValue.moneda,
      tasasCambio: this.tasasCambio,
      metodosPagoDetallados: []
    };

    this.transacciones = [];
    this.actualizarResumen();
    this.mostrarModalInicio = false;

    this.guardarCierreEnBackend();
  }

  abrirModalCierre(): void {
    if (!this.cierreActual) return;

    this.cierreForm.patchValue({
      efectivoFinalReal: this.getEfectivoFinalTeorico(),
      observaciones: this.cierreActual.observaciones,
      notasCierre: ''
    });

    this.mostrarModalCierre = true;
  }

  realizarCierre(): void {
    if (this.cierreForm.invalid || !this.cierreActual || !this.currentUser) return;

    const formValue = this.cierreForm.value;

    this.cierreActual.estado = 'cerrado';
    this.cierreActual.efectivoFinalReal = parseFloat(formValue.efectivoFinalReal);
    this.cierreActual.diferencia = this.getDiferencia();
    this.cierreActual.notasCierre = formValue.notasCierre;
    this.cierreActual.usuarioCierre = this.currentUser.nombre;
    this.cierreActual.fechaCierre = new Date();

    this.guardarCierreEnBackend().then(() => {
      this.swalService.showSuccess('Cierre realizado', 'El cierre de caja se ha guardado correctamente.');
      this.mostrarModalCierre = false;

      if (formValue.imprimirResumen) {
        this.imprimirResumen();
      }
    }).catch(error => {
      this.swalService.showError('Error', 'No se pudo guardar el cierre. Por favor, intente nuevamente.');
    });
  }

  guardarCierre(): void {
    if (!this.cierreActual) {
      this.swalService.showError('Error', 'No hay cierre de caja activo.');
      return;
    }

    this.actualizarResumen();

    this.guardarCierreEnBackend().then(() => {
      this.swalService.showSuccess('Éxito', 'Cambios guardados correctamente.');
      this.ultimaActualizacion = new Date();
    }).catch(error => {
      this.swalService.showError('Error', 'No se pudieron guardar los cambios.');
      console.error('Error al guardar cierre:', error);
    });
  }

  private guardarCierreEnBackend(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.cierreActual) {
        reject('No hay cierre para guardar');
        return;
      }

      this.guardandoCierre = true;

      this.cierreCajaService.guardarCierre(this.cierreActual).subscribe({
        next: () => {
          this.guardandoCierre = false;
          resolve();
        },
        error: (error) => {
          this.guardandoCierre = false;
          console.error('Error al guardar cierre:', error);
          reject(error);
        }
      });
    });
  }

  // === ACTUALIZACIÓN DE RESUMEN ===

  actualizarResumen(): void {
    if (!this.cierreActual) return;

    // Actualizar ventas por método de pago
    this.cierreActual.ventasEfectivo = this.getTotalMetodoPago('efectivo');
    this.cierreActual.ventasTarjeta = this.getTotalMetodoPago('tarjeta');
    this.cierreActual.ventasTransferencia = this.getTotalMetodoPago('transferencia');
    this.cierreActual.ventasDebito = this.getTotalMetodoPago('debito');
    this.cierreActual.ventasCredito = this.getTotalMetodoPago('credito');
    this.cierreActual.ventasPagomovil = this.getTotalMetodoPago('pagomovil');
    this.cierreActual.ventasZelle = this.getTotalMetodoPago('zelle');

    // Actualizar otros cálculos
    this.cierreActual.otrosIngresos = this.transacciones
      .filter(t => t.tipo === 'ingreso')
      .reduce((sum, t) => sum + t.monto, 0);

    this.cierreActual.egresos = this.getTotalEgresos();
    this.cierreActual.efectivoFinalTeorico = this.getEfectivoFinalTeorico();
    this.cierreActual.diferencia = this.cierreActual.efectivoFinalReal - this.cierreActual.efectivoFinalTeorico;

    // Actualizar métodos de pago detallados
    this.cierreActual.metodosPagoDetallados = this.calcularMetodosPagoDetallados();

    this.ultimaActualizacion = new Date();
  }

  private calcularMetodosPagoDetallados(): any[] {
    const metodosAgrupados = new Map<string, any>();

    this.transacciones.forEach(transaccion => {
      if (transaccion.tipo === 'venta' || transaccion.tipo === 'ingreso') {
        const metodo = transaccion.metodoPago;

        if (!metodosAgrupados.has(metodo)) {
          metodosAgrupados.set(metodo, {
            metodo: this.formatearTipoPago(metodo),
            total: 0,
            cantidad: 0
          });
        }

        const datos = metodosAgrupados.get(metodo)!;
        datos.total += transaccion.monto;
        datos.cantidad += 1;
      }
    });

    return Array.from(metodosAgrupados.values());
  }

  // === MÉTODOS DE UI ===

  getIconoTipoTransaccion(tipo: string): string {
    const tipoEncontrado = this.tiposTransaccion.find(t => t.valor === tipo);
    return tipoEncontrado ? `bi ${tipoEncontrado.icono}` : 'bi-receipt';
  }

  getColorTipoTransaccion(tipo: string): string {
    const tipoEncontrado = this.tiposTransaccion.find(t => t.valor === tipo);
    return tipoEncontrado ? tipoEncontrado.color : '#64748b';
  }

  formatearTipoPago(tipo: string): string {
    const tipos: { [key: string]: string } = {
      'efectivo': 'EFECTIVO',
      'debito': 'T. DÉBITO',
      'credito': 'T. CRÉDITO',
      'pagomovil': 'PAGO MÓVIL',
      'transferencia': 'TRANSFERENCIA',
      'zelle': 'ZELLE',
      'mixto': 'MIXTO',
      'tarjeta': 'TARJETA',
      'contado': 'CONTADO',
      'abono': 'ABONO',
      'cashea': 'CASHEA',
      'de_contado-pendiente': 'PENDIENTE'
    };

    return tipos[tipo.toLowerCase()] || tipo.toUpperCase();
  }

  getEstadoClass(estado: string): string {
    return `estado-${estado || 'abierto'}`;
  }

  getEstadoTexto(estado: string): string {
    const estados: { [key: string]: string } = {
      abierto: 'Caja Abierta',
      cerrado: 'Caja Cerrada',
      revisado: 'Revisado',
      conciliado: 'Conciliado'
    };
    return estados[estado] || 'Sin estado';
  }

  // === EXPORTACIÓN E IMPRESIÓN ===

  exportarReporte(): void {
    if (!this.cierreActual) {
      this.swalService.showError('Error', 'No hay datos de cierre para exportar.');
      return;
    }

    const data = {
      cierre: this.cierreActual,
      transacciones: this.transaccionesFiltradas,
      resumen: {
        totalVentas: this.getTotalVentas(),
        totalIngresos: this.getTotalIngresos(),
        totalEgresos: this.getTotalEgresos(),
        netoDia: this.getNetoDia(),
        diferencia: this.getDiferencia(),
        metodosPago: this.getResumenMetodosPago()
      },
      sede: this.sedeActual,
      fecha: this.fechaSeleccionada,
      timestamp: new Date(),
      configuracion: {
        monedaPrincipal: this.monedaSistema,
        simboloMoneda: this.simboloMonedaSistema,
        tasasCambio: this.tasasCambio
      }
    };

    // Crear y descargar JSON
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cierre-caja-${this.sedeActual?.key || 'sede'}-${this.datePipe.transform(this.fechaSeleccionada, 'yyyy-MM-dd')}.json`;
    a.click();
    window.URL.revokeObjectURL(url);

    this.swalService.showSuccess('Exportado', 'Reporte exportado correctamente.');
  }

  imprimirResumen(): void {
    // Crear contenido para imprimir
    const contenido = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cierre de Caja - ${this.datePipe.transform(this.fechaSeleccionada, 'dd/MM/yyyy')}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          .resumen { border: 1px solid #ccc; padding: 15px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f4f4f4; }
          .total { font-weight: bold; }
          .diferencia { color: ${this.getDiferencia() >= 0 ? 'green' : 'red'}; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>Cierre de Caja - ${this.sedeActual?.nombre || 'Óptica'}</h1>
        <p>Fecha: ${this.datePipe.transform(this.fechaSeleccionada, 'dd/MM/yyyy')}</p>
        <p>Sede: ${this.sedeActual?.nombre || ''}</p>
        
        <div class="resumen">
          <h2>Resumen del Día</h2>
          <p>Efectivo Inicial: ${this.decimalPipe.transform(this.cierreActual?.efectivoInicial, '1.2-2')}</p>
          <p>Ventas Efectivo: ${this.decimalPipe.transform(this.cierreActual?.ventasEfectivo, '1.2-2')}</p>
          <p>Ventas Tarjeta: ${this.decimalPipe.transform(this.cierreActual?.ventasTarjeta, '1.2-2')}</p>
          <p>Ventas Transferencia: ${this.decimalPipe.transform(this.cierreActual?.ventasTransferencia, '1.2-2')}</p>
          <p>Total Ventas: ${this.decimalPipe.transform(this.getTotalVentas(), '1.2-2')}</p>
          <p>Egresos: ${this.decimalPipe.transform(this.cierreActual?.egresos, '1.2-2')}</p>
          <p class="diferencia">Diferencia: ${this.decimalPipe.transform(this.getDiferencia(), '1.2-2')}</p>
        </div>
        
        <h2>Transacciones (${this.transaccionesFiltradas.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Descripción</th>
              <th>Tipo</th>
              <th>Método Pago</th>
              <th>Monto</th>
              <th>Usuario</th>
            </tr>
          </thead>
          <tbody>
            ${this.transaccionesFiltradas.map(t => `
              <tr>
                <td>${t.descripcion}</td>
                <td>${t.tipo}</td>
                <td>${t.metodoPago}</td>
                <td>${this.decimalPipe.transform(t.monto, '1.2-2')}</td>
                <td>${t.usuario}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <p class="no-print" style="margin-top: 30px; color: #666;">
          Impreso el: ${this.datePipe.transform(new Date(), 'dd/MM/yyyy HH:mm')}
        </p>
      </body>
      </html>
    `;

    // Abrir ventana de impresión
    const ventana = window.open('', '_blank');
    if (ventana) {
      ventana.document.write(contenido);
      ventana.document.close();
      setTimeout(() => {
        ventana.print();
        ventana.close();
      }, 500);
    }
  }

  // === MANEJO DE FECHAS ===

  cambiarFecha(dias: number): void {
    const nuevaFecha = new Date(this.fechaSeleccionada);
    nuevaFecha.setDate(nuevaFecha.getDate() + dias);
    this.fechaSeleccionada = nuevaFecha;
    this.cargarDatosFecha();
  }

  abrirSelectorFecha(): void {
    const input = document.createElement('input');
    input.type = 'date';
    input.value = this.datePipe.transform(this.fechaSeleccionada, 'yyyy-MM-dd') || '';
    input.onchange = (event: any) => {
      if (event.target.value) {
        this.fechaSeleccionada = new Date(event.target.value);
        this.cargarDatosFecha();
      }
    };
    input.click();
  }

  // === GETTERS ÚTILES ===

  get transaccionesEfectivo(): Transaccion[] {
    return this.transacciones.filter(t =>
      t.metodoPago === 'efectivo' && t.tipo === 'venta'
    );
  }

  get transaccionesTarjeta(): Transaccion[] {
    return this.transacciones.filter(t =>
      ['tarjeta', 'debito', 'credito'].includes(t.metodoPago) && t.tipo === 'venta'
    );
  }

  get transaccionesTransferencia(): Transaccion[] {
    return this.transacciones.filter(t =>
      t.metodoPago === 'transferencia' && t.tipo === 'venta'
    );
  }

  get hayCierreAnterior(): boolean {
    // Implementar lógica para verificar cierre del día anterior
    return false;
  }

  get totalTransacciones(): number {
    return this.transacciones.length;
  }

  get transaccionesConfirmadas(): number {
    return this.transacciones.filter(t => t.estado === 'confirmado').length;
  }

  // === HELPERS ===

  formatCurrency(value: number): string {
    return this.decimalPipe.transform(value, '1.2-2') || '0.00';
  }

  formatDate(date: Date): string {
    return this.datePipe.transform(date, 'dd/MM/yyyy HH:mm') || '';
  }

  // === ACTUALIZACIÓN AUTOMÁTICA ===

  private iniciarActualizacionAutomatica(): void {
    setInterval(() => {
      this.ultimaActualizacion = new Date();
    }, 60000); // Actualizar cada minuto
  }
}
