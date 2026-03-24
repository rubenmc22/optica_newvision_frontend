import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
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
import * as bootstrap from 'bootstrap';



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
  mostrarMenuExport: boolean = false;

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

  tabActivo: 'tipos' | 'metodos' | 'formas' | 'pendientes' = 'tipos';

  historialCierres: CierreDiario[] = [];

  private destroy$ = new Subject<void>();

  // En el componente, agrega estas propiedades para los análisis en vivo
  analisisVentas: {
    soloConsulta: { cantidad: number; total: number; montoMedico: number; montoOptica: number };
    consultaProductos: { cantidad: number; total: number; montoMedico: number; montoProductos: number };
    soloProductos: { cantidad: number; total: number };
  } = {
      soloConsulta: { cantidad: 0, total: 0, montoMedico: 0, montoOptica: 0 },
      consultaProductos: { cantidad: 0, total: 0, montoMedico: 0, montoProductos: 0 },
      soloProductos: { cantidad: 0, total: 0 }
    };

  analisisMetodosPago: {
    efectivo: { total: number; porMoneda: { dolar: number; euro: number; bolivar: number }; cantidad: number };
    punto: { total: number; porBanco: any[]; cantidad: number };
    pagomovil: { total: number; cantidad: number; porBanco: any[] };
    transferencia: { total: number; cantidad: number; porBanco: any[] };
    zelle: { total: number; cantidad: number };
    mixto: { total: number; cantidad: number };
  } = {
      efectivo: { total: 0, porMoneda: { dolar: 0, euro: 0, bolivar: 0 }, cantidad: 0 },
      punto: { total: 0, porBanco: [], cantidad: 0 },
      pagomovil: { total: 0, cantidad: 0, porBanco: [] },
      transferencia: { total: 0, cantidad: 0, porBanco: [] },
      zelle: { total: 0, cantidad: 0 },
      mixto: { total: 0, cantidad: 0 }
    };

  analisisFormasPago: {
    contado: { cantidad: number; total: number };
    abono: { cantidad: number; total: number; montoAbonado: number; deudaPendiente: number };
    cashea: { cantidad: number; total: number; montoInicial: number; deudaPendiente: number; cuotasPendientes: number };
    deContadoPendiente: { cantidad: number; total: number; deudaPendiente: number };
  } = {
      contado: { cantidad: 0, total: 0 },
      abono: { cantidad: 0, total: 0, montoAbonado: 0, deudaPendiente: 0 },
      cashea: { cantidad: 0, total: 0, montoInicial: 0, deudaPendiente: 0, cuotasPendientes: 0 },
      deContadoPendiente: { cantidad: 0, total: 0, deudaPendiente: 0 }
    };

  analisisVentasPendientes: any[] = [];

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

  filtroHistorialDesde: string = '';
  filtroHistorialHasta: string = '';

  constructor(
    private fb: FormBuilder,
    private decimalPipe: DecimalPipe,
    private datePipe: DatePipe,
    private cierreCajaService: CierreCajaService,
    private historialVentaService: HistorialVentaService,
    private cdr: ChangeDetectorRef,
    private systemConfigService: SystemConfigService,
    private tasaCambiariaService: TasaCambiariaService, // Nuevo
    private userStateService: UserStateService,
    private swalService: SwalService
  ) {
    this.inicializarForms();
    this.checkMobile();

    // Inicializar fechas del historial AQUÍ en el constructor
    const fechaFin = new Date();
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - 30);

    this.filtroHistorialDesde = this.datePipe.transform(fechaInicio, 'yyyy-MM-dd') || '';
    this.filtroHistorialHasta = this.datePipe.transform(fechaFin, 'yyyy-MM-dd') || '';
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
  private obtenerConfiguracionSistema(): void {
    this.monedaSistema = this.systemConfigService.getMonedaPrincipal();
    this.simboloMonedaSistema = this.systemConfigService.getSimboloMonedaPrincipal();

    this.inicioCajaForm.patchValue({
      moneda: this.monedaSistema
    });

    // Obtener tasas de cambio
    this.tasaCambiariaService.getTasaActual().subscribe({
      next: (tasas: any) => {
        this.tasasCambio = {
          dolar: tasas?.tasa_usd || tasas?.dolar || 1,
          euro: tasas?.tasa_eur || tasas?.euro || 1,
          bolivar: 1
        };
      },
      error: (error) => {
        console.error('Error al cargar tasas:', error);
        this.tasasCambio = {
          dolar: this.systemConfigService.getTasaPorId('dolar') || 1,
          euro: this.systemConfigService.getTasaPorId('euro') || 1,
          bolivar: 1
        };
      }
    });
  }

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
      efectivoRealUSD: [0],
      efectivoRealEUR: [0],
      efectivoRealVES: [0],
      transferenciaRealTotal: [0],
      pagomovilRealTotal: [0],
      zelleReal: [0],
      notasCierre: [''],
      imprimirResumen: [true],
      enviarEmail: [false],
      adjuntarComprobantes: [true]
    });

    this.filtroForm = this.fb.group({
      tipo: ['todos'],
      metodoPago: ['todos'],
      usuario: ['todos'],
      categoria: ['todos'],
      fechaDesde: [null],
      fechaHasta: [null],
      montoMin: [null],
      montoMax: [null]
    });
  }

  private inicializarTasasCambio(): void {
    // Obtener tasas del servicio
    this.tasaCambiariaService.getTasaActual().subscribe({
      next: (tasas: any) => {
        // Asegurar que siempre tengamos los 3 valores requeridos
        this.tasasCambio = {
          dolar: tasas?.tasa_usd || tasas?.dolar || this.systemConfigService.getTasaPorId('dolar') || 1,
          euro: tasas?.tasa_eur || tasas?.euro || this.systemConfigService.getTasaPorId('euro') || 1,
          bolivar: 1,
          ...tasas
        };

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

  private calcularAnalisisDesdeTransacciones(): void {
    // Resetear análisis
    this.analisisVentas = {
      soloConsulta: { cantidad: 0, total: 0, montoMedico: 0, montoOptica: 0 },
      consultaProductos: { cantidad: 0, total: 0, montoMedico: 0, montoProductos: 0 },
      soloProductos: { cantidad: 0, total: 0 }
    };

    this.analisisMetodosPago = {
      efectivo: { total: 0, porMoneda: { dolar: 0, euro: 0, bolivar: 0 }, cantidad: 0 },
      punto: { total: 0, porBanco: [], cantidad: 0 },
      pagomovil: { total: 0, cantidad: 0, porBanco: [] },
      transferencia: { total: 0, cantidad: 0, porBanco: [] },
      zelle: { total: 0, cantidad: 0 },
      mixto: { total: 0, cantidad: 0 }
    };

    this.analisisFormasPago = {
      contado: { cantidad: 0, total: 0 },
      abono: { cantidad: 0, total: 0, montoAbonado: 0, deudaPendiente: 0 },
      cashea: { cantidad: 0, total: 0, montoInicial: 0, deudaPendiente: 0, cuotasPendientes: 0 },
      deContadoPendiente: { cantidad: 0, total: 0, deudaPendiente: 0 }
    };

    this.analisisVentasPendientes = [];

    // Procesar cada transacción
    this.transacciones.forEach(trans => {
      if (trans.tipo !== 'venta') return;

      // 1. Tipos de venta
      this.procesarTipoVenta(trans);

      // 2. Métodos de pago
      this.procesarMetodosPago(trans);

      // 3. Formas de pago
      this.procesarFormasPago(trans);

      // 4. Ventas pendientes
      this.procesarVentasPendientes(trans);
    });

  }

  private procesarTipoVenta(trans: Transaccion): void {
    // Determinar tipo de venta basado en los productos o consulta
    const tieneConsulta = trans.detalleMetodosPago?.some(m => m.tipo === 'consulta');
    const tieneProductos = trans.productos && trans.productos.length > 0;

    if (tieneConsulta && !tieneProductos) {
      // Solo consulta
      this.analisisVentas.soloConsulta.cantidad++;
      this.analisisVentas.soloConsulta.total += trans.monto;
      // Estimar montos médico/óptica (70%/30% como ejemplo)
      this.analisisVentas.soloConsulta.montoMedico += trans.monto * 0.7;
      this.analisisVentas.soloConsulta.montoOptica += trans.monto * 0.3;
    }
    else if (tieneConsulta && tieneProductos) {
      // Consulta + productos
      this.analisisVentas.consultaProductos.cantidad++;
      this.analisisVentas.consultaProductos.total += trans.monto;
      // Estimar montos
      this.analisisVentas.consultaProductos.montoMedico += trans.monto * 0.3;
      this.analisisVentas.consultaProductos.montoProductos += trans.monto * 0.7;
    }
    else if (tieneProductos && !tieneConsulta) {
      // Solo productos
      this.analisisVentas.soloProductos.cantidad++;
      this.analisisVentas.soloProductos.total += trans.monto;
    }
  }

  private procesarMetodosPago(trans: Transaccion): void {
    if (!trans.detalleMetodosPago) return;

    trans.detalleMetodosPago.forEach(metodo => {
      const tipo = metodo.tipo;
      const monto = metodo.monto || trans.monto;
      const moneda = metodo.moneda || 'dolar';

      if (tipo === 'efectivo') {
        this.analisisMetodosPago.efectivo.total += monto;
        this.analisisMetodosPago.efectivo.cantidad++;
        if (moneda === 'dolar') this.analisisMetodosPago.efectivo.porMoneda.dolar += monto;
        else if (moneda === 'euro') this.analisisMetodosPago.efectivo.porMoneda.euro += monto;
        else if (moneda === 'bolivar') this.analisisMetodosPago.efectivo.porMoneda.bolivar += monto;
      }
      else if (tipo === 'punto') {
        this.analisisMetodosPago.punto.total += monto;
        this.analisisMetodosPago.punto.cantidad++;
        const banco = metodo.bancoNombre || metodo.banco || 'Otro';  // ← Usar bancoNombre
        let bancoExistente = this.analisisMetodosPago.punto.porBanco.find(b => b.banco === banco);
        if (!bancoExistente) {
          bancoExistente = {
            banco: banco,
            bancoCodigo: metodo.bancoCodigo || '',
            total: 0,
            cantidad: 0
          };
          this.analisisMetodosPago.punto.porBanco.push(bancoExistente);
        }
        bancoExistente.total += monto;
        bancoExistente.cantidad++;
      }
      else if (tipo === 'pagomovil') {
        this.analisisMetodosPago.pagomovil.total += monto;
        this.analisisMetodosPago.pagomovil.cantidad++;
        const banco = metodo.bancoNombre || metodo.banco || 'Otro';
        if (banco !== 'Otro') {
          let bancoExistente = this.analisisMetodosPago.pagomovil.porBanco.find(b => b.banco === banco);
          if (!bancoExistente) {
            bancoExistente = {
              banco: banco,
              bancoCodigo: metodo.bancoCodigo || '',
              total: 0,
              cantidad: 0
            };
            this.analisisMetodosPago.pagomovil.porBanco.push(bancoExistente);
          }
          bancoExistente.total += monto;
          bancoExistente.cantidad++;
        }
      }
      else if (tipo === 'transferencia') {
        this.analisisMetodosPago.transferencia.total += monto;
        this.analisisMetodosPago.transferencia.cantidad++;
        const banco = metodo.bancoNombre || metodo.banco || 'Otro';
        if (banco !== 'Otro') {
          let bancoExistente = this.analisisMetodosPago.transferencia.porBanco.find(b => b.banco === banco);
          if (!bancoExistente) {
            bancoExistente = {
              banco: banco,
              bancoCodigo: metodo.bancoCodigo || '',
              total: 0,
              cantidad: 0
            };
            this.analisisMetodosPago.transferencia.porBanco.push(bancoExistente);
          }
          bancoExistente.total += monto;
          bancoExistente.cantidad++;
        }
      }
      else if (tipo === 'zelle') {
        this.analisisMetodosPago.zelle.total += monto;
        this.analisisMetodosPago.zelle.cantidad++;
      }
    });

    // Si tiene múltiples métodos, marcar como mixto
    if (trans.detalleMetodosPago.length > 1) {
      this.analisisMetodosPago.mixto.total += trans.monto;
      this.analisisMetodosPago.mixto.cantidad++;
    }
  }

  private procesarFormasPago(trans: Transaccion): void {
    const formaPago = trans.formaPago;
    const monto = trans.monto;

    switch (formaPago) {
      case 'contado':
        this.analisisFormasPago.contado.cantidad++;
        this.analisisFormasPago.contado.total += monto;
        break;
      case 'abono':
        this.analisisFormasPago.abono.cantidad++;
        this.analisisFormasPago.abono.total += monto;
        this.analisisFormasPago.abono.montoAbonado += monto;
        // La deuda pendiente se calcula por separado
        break;
      case 'cashea':
        this.analisisFormasPago.cashea.cantidad++;
        this.analisisFormasPago.cashea.total += monto;
        this.analisisFormasPago.cashea.montoInicial += monto * 0.4;
        this.analisisFormasPago.cashea.deudaPendiente += monto * 0.6;
        this.analisisFormasPago.cashea.cuotasPendientes += 3;
        break;
      case 'de_contado-pendiente':
        this.analisisFormasPago.deContadoPendiente.cantidad++;
        this.analisisFormasPago.deContadoPendiente.total += monto;
        this.analisisFormasPago.deContadoPendiente.deudaPendiente += monto;
        break;
    }
  }

  private procesarVentasPendientes(trans: Transaccion): void {
    const formaPago = trans.formaPago;
    const tieneDeuda = formaPago === 'de_contado-pendiente' ||
      (formaPago === 'abono' && trans.monto > 0) ||
      (formaPago === 'cashea' && trans.monto > 0);

    if (tieneDeuda && trans.numeroVenta) {
      let deuda = trans.monto;
      if (formaPago === 'abono') {
        deuda = trans.monto * 0.5; // Estimación
      } else if (formaPago === 'cashea') {
        deuda = trans.monto * 0.6; // Estimación
      }

      this.analisisVentasPendientes.push({
        numeroVenta: trans.numeroVenta,
        cliente: trans.cliente?.nombre || 'Cliente',
        total: trans.monto,
        formaPago: formaPago === 'de_contado-pendiente' ? 'Pendiente' :
          (formaPago === 'abono' ? 'Abono' : 'Cashea'),
        deuda: deuda,
        fecha: trans.fecha
      });
    }
  }

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
      // Solo filtrar si hay transacciones
      if (this.transacciones && this.transacciones.length > 0) {
        this.filtrarTransacciones();
      }
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

  realizarCierre(): void {
    if (this.cierreForm.invalid || !this.cierreActual || !this.currentUser) return;

    const formValue = this.cierreForm.value;

    // Recolectar valores reales ingresados
    const detalleReal: any = {
      efectivo: {
        usd: formValue.efectivoRealUSD || 0,
        eur: formValue.efectivoRealEUR || 0,
        ves: formValue.efectivoRealVES || 0
      },
      punto: [],
      transferencia: formValue.transferenciaRealTotal || 0,
      pagomovil: formValue.pagomovilRealTotal || 0,
      zelle: formValue.zelleReal || 0,
      notasCierre: formValue.notasCierre || '',
      fechaCierre: new Date(),
      usuarioCierre: this.currentUser.nombre
    };

    // Recolectar punto de venta por banco
    this.analisisMetodosPago.punto.porBanco.forEach(banco => {
      const controlName = `puntoReal_${banco.bancoCodigo || banco.banco.replace(/\s/g, '_')}`;
      const montoReal = formValue[controlName] || 0;
      detalleReal.punto.push({
        banco: banco.banco,
        bancoCodigo: banco.bancoCodigo,
        montoReal: montoReal,
        montoSistema: banco.total,
        diferencia: montoReal - banco.total
      });
    });

    // Guardar detalle en el cierre actual
    this.cierreActual.detalleCierreReal = detalleReal;
    this.cierreActual.estado = 'cerrado';
    this.cierreActual.efectivoFinalReal = this.getEfectivoRealTotal();
    this.cierreActual.diferencia = this.getDiferenciaTotal();
    this.cierreActual.notasCierre = formValue.notasCierre;
    this.cierreActual.usuarioCierre = this.currentUser.nombre;
    this.cierreActual.fechaCierre = new Date();

    this.guardarCierreEnBackend().then(() => {
      this.cerrarModal('cierreCajaModal');
      this.swalService.showSuccess('Cierre realizado', 'El cierre de caja se ha guardado correctamente.');

      if (formValue.imprimirResumen) {
        this.imprimirResumen();
      }
    }).catch(error => {
      console.error('Error al guardar cierre:', error);
      this.swalService.showError('Error', 'No se pudo guardar el cierre. Por favor, intente nuevamente.');
    });
  }

  filtrarTransacciones(): void {
    // Si no hay transacciones, establecer array vacío
    if (!this.transacciones || this.transacciones.length === 0) {
      this.transaccionesFiltradas = [];
      return;
    }

    const filtros = this.filtroForm.value;

    this.transaccionesFiltradas = this.transacciones.filter(trans => {
      // Filtrar por tipo
      if (filtros.tipo !== 'todos' && trans.tipo !== filtros.tipo) {
        return false;
      }

      // Filtrar por método de pago
      if (filtros.metodoPago !== 'todos' && trans.metodoPago !== filtros.metodoPago) {
        return false;
      }

      // Filtrar por usuario
      if (filtros.usuario !== 'todos' && trans.usuario !== filtros.usuario) {
        return false;
      }

      // Filtrar por categoría
      if (filtros.categoria !== 'todos' && trans.categoria !== filtros.categoria) {
        return false;
      }

      // Filtrar por monto
      if (filtros.montoMin !== null && trans.monto < filtros.montoMin) return false;
      if (filtros.montoMax !== null && trans.monto > filtros.montoMax) return false;

      // Filtrar por fecha - IMPORTANTE: las fechas en la transacción son objetos Date
      if (filtros.fechaDesde || filtros.fechaHasta) {
        const fechaTrans = new Date(trans.fecha);
        // Normalizar fechas para comparar solo la parte de fecha (sin hora)
        const fechaTransStr = fechaTrans.toISOString().split('T')[0];

        if (filtros.fechaDesde && filtros.fechaDesde !== '') {
          const fechaDesdeStr = new Date(filtros.fechaDesde).toISOString().split('T')[0];
          if (fechaTransStr < fechaDesdeStr) return false;
        }

        if (filtros.fechaHasta && filtros.fechaHasta !== '') {
          const fechaHastaStr = new Date(filtros.fechaHasta).toISOString().split('T')[0];
          if (fechaTransStr > fechaHastaStr) return false;
        }
      }

      return true;
    });
  }

  private procesarResumenDiario(resumen: any): void {
    // 1. Procesar ventas como transacciones
    if (resumen.ventas && Array.isArray(resumen.ventas)) {
      this.procesarVentasParaTransacciones(resumen.ventas);
    } else {
      console.warn('⚠️ No hay ventas en el resumen');
      this.transacciones = [];
    }

    // 2. Cargar cierre existente si hay (SOLO para días pasados)
    if (resumen.cierreExistente) {
      this.cierreActual = resumen.cierreExistente;
      console.log('📦 Cierre existente cargado para historial');
    } else {
      // Para el día actual SIN cierre, dejar cierreActual como null
      // NO crear cierre automáticamente
      this.cierreActual = null;
      console.log('📭 No hay cierre para este día');
    }

    // 3. Limpiar y reconstruir controles dinámicos del formulario
    this.limpiarControlesBancos();
    this.agregarControlesBancos();

    // 4. Si hay cierre, precargar los valores reales
    if (this.cierreActual && this.cierreActual.detalleCierreReal) {
      this.precargarValoresReales();
    }

    // 5. Actualizar el cierre con los análisis en vivo (si hay cierre)
    if (this.cierreActual) {
      this.actualizarResumen();
    }

    // 6. Filtrar transacciones para la vista
    this.filtrarTransacciones();

    this.ultimaActualizacion = new Date();

  }

  private limpiarControlesBancos(): void {
    const prefijos = ['puntoReal_'];

    prefijos.forEach(prefijo => {
      const keys = Object.keys(this.cierreForm.controls).filter(key => key.startsWith(prefijo));
      keys.forEach(key => {
        this.cierreForm.removeControl(key);
      });
    });
  }

  private agregarControlesBancos(): void {
    if (this.analisisMetodosPago?.punto?.porBanco) {
      this.analisisMetodosPago.punto.porBanco.forEach(banco => {
        const controlName = `puntoReal_${banco.bancoCodigo || banco.banco.replace(/\s/g, '_')}`;
        if (!this.cierreForm.contains(controlName)) {
          this.cierreForm.addControl(controlName, this.fb.control(0));
        }
      });
    }
  }
  private precargarValoresReales(): void {
    if (!this.cierreActual?.detalleCierreReal) return;

    const real = this.cierreActual.detalleCierreReal;

    // Cargar efectivo por moneda
    if (real.efectivo) {
      this.cierreForm.patchValue({
        efectivoRealUSD: real.efectivo.usd || 0,
        efectivoRealEUR: real.efectivo.eur || 0,
        efectivoRealVES: real.efectivo.ves || 0
      });
    }

    // Cargar punto de venta por banco
    if (real.punto && Array.isArray(real.punto)) {
      real.punto.forEach((item: any) => {
        const controlName = `puntoReal_${item.bancoCodigo || item.banco.replace(/\s/g, '_')}`;
        if (this.cierreForm.contains(controlName)) {
          this.cierreForm.get(controlName)?.setValue(item.montoReal || 0);
        }
      });
    }

    // Cargar transferencias por banco
    if (real.transferencia && Array.isArray(real.transferencia)) {
      real.transferencia.forEach((item: any) => {
        const controlName = `transferenciaReal_${item.bancoCodigo || item.banco.replace(/\s/g, '_')}`;
        if (this.cierreForm.contains(controlName)) {
          this.cierreForm.get(controlName)?.setValue(item.montoReal || 0);
        }
      });
    }

    // Cargar pago móvil por banco
    if (real.pagomovil && Array.isArray(real.pagomovil)) {
      real.pagomovil.forEach((item: any) => {
        const controlName = `pagomovilReal_${item.bancoCodigo || item.banco.replace(/\s/g, '_')}`;
        if (this.cierreForm.contains(controlName)) {
          this.cierreForm.get(controlName)?.setValue(item.montoReal || 0);
        }
      });
    }

    // Cargar Zelle
    if (real.zelle !== undefined) {
      this.cierreForm.patchValue({ zelleReal: real.zelle });
    }

    // Cargar notas de cierre
    if (real.notasCierre) {
      this.cierreForm.patchValue({ notasCierre: real.notasCierre });
    }

  }

  private procesarVentasParaTransacciones(ventas: any[]): void {
    this.transacciones = [];

    ventas.forEach(venta => {
      // Extraer información de consulta si existe
      const tieneConsulta = venta.consulta && (venta.consulta.pagoMedico > 0 || venta.consulta.pagoOptica > 0);
      const tieneProductos = venta.productos && venta.productos.length > 0;

      // Crear detalle de métodos de pago enriquecido
      const detalleMetodos = venta.metodosDePago?.map(m => ({
        tipo: m.tipo,
        monto: m.monto,
        moneda: m.moneda || 'dolar',
        referencia: m.referencia,
        banco: m.bancoNombre || m.banco,           // ← Incluir banco
        bancoNombre: m.bancoNombre,                 // ← Incluir bancoNombre
        bancoCodigo: m.bancoCodigo                  // ← Incluir bancoCodigo
      })) || [];

      // Si es consulta, agregar como método de pago separado
      if (tieneConsulta && venta.consulta?.pagoMedico > 0) {
        detalleMetodos.push({
          tipo: 'consulta',
          monto: venta.consulta.pagoMedico,
          moneda: 'dolar'
        });
      }

      const transaccionVenta: Transaccion = {
        id: venta.key || `VENTA-${venta.numero_venta}`,
        tipo: 'venta',
        descripcion: `Venta #${venta.numero_venta} - ${venta.cliente?.informacion?.nombreCompleto || 'Cliente'}`,
        monto: venta.total_pagado || venta.total,
        fecha: new Date(venta.fecha),
        metodoPago: this.determinarMetodoPagoPrincipal(venta.metodosDePago),
        usuario: venta.asesor?.nombre || venta.auditoria?.usuarioCreacion?.nombre || 'Usuario',
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
        detalleMetodosPago: detalleMetodos,
        productos: venta.productos,
        asesor: venta.asesor?.nombre,
        ordenTrabajoGenerada: venta.generarOrdenTrabajo,
        sede: venta.sede,
        tieneConsulta: tieneConsulta,
        tieneProductos: tieneProductos
      };

      this.transacciones.push(transaccionVenta);
    });

    // Recalcular análisis cada vez que cambian las transacciones
    this.calcularAnalisisDesdeTransacciones();
  }

  actualizarResumen(): void {
    if (!this.cierreActual) return;

    // Sincronizar el cierre con los análisis en vivo
    this.cierreActual.ventasPorTipo = { ...this.analisisVentas };
    this.cierreActual.metodosPago = JSON.parse(JSON.stringify(this.analisisMetodosPago));
    this.cierreActual.formasPago = JSON.parse(JSON.stringify(this.analisisFormasPago));
    this.cierreActual.ventasPendientes = [...this.analisisVentasPendientes];

    // Actualizar ventas por método de pago (para compatibilidad)
    this.cierreActual.ventasEfectivo = this.analisisMetodosPago.efectivo.total;
    this.cierreActual.ventasTarjeta = this.analisisMetodosPago.punto.total;
    this.cierreActual.ventasTransferencia = this.analisisMetodosPago.transferencia.total;
    this.cierreActual.ventasPagomovil = this.analisisMetodosPago.pagomovil.total;
    this.cierreActual.ventasZelle = this.analisisMetodosPago.zelle.total;

    // Actualizar transacciones en el cierre
    this.cierreActual.transacciones = [...this.transacciones];

    // Actualizar otros cálculos
    this.cierreActual.otrosIngresos = this.transacciones
      .filter(t => t.tipo === 'ingreso')
      .reduce((sum, t) => sum + t.monto, 0);

    this.cierreActual.egresos = this.getTotalEgresos();
    this.cierreActual.efectivoFinalTeorico = this.getEfectivoFinalTeorico();
    this.cierreActual.diferencia = (this.cierreActual.efectivoFinalReal || 0) - this.cierreActual.efectivoFinalTeorico;

    // Actualizar totales
    if (this.cierreActual.totales) {
      this.cierreActual.totales.ingresos = this.getTotalIngresos();
      this.cierreActual.totales.egresos = this.getTotalEgresos();
      this.cierreActual.totales.neto = this.getNetoDia();
      this.cierreActual.totales.ventasContado = this.analisisFormasPago.contado.total;
      this.cierreActual.totales.ventasCredito = this.analisisFormasPago.abono.deudaPendiente + this.analisisFormasPago.cashea.deudaPendiente;
      this.cierreActual.totales.ventasPendientes = this.analisisFormasPago.deContadoPendiente.total;
    }

    this.ultimaActualizacion = new Date();
  }

  private determinarMetodoPagoPrincipal(metodosDePago: any[]): string {
    if (!metodosDePago || metodosDePago.length === 0) {
      return 'pendiente';
    }

    if (metodosDePago.length === 1) {
      const tipo = metodosDePago[0].tipo;
      return tipo === 'punto' ? 'punto' : tipo;
    }

    return 'mixto';
  }

  getTotalMetodoPago(metodo: string): number {
    let total = 0;
    this.transacciones.forEach(transaccion => {
      // Solo contar ventas y ingresos
      if (transaccion.tipo === 'venta' || transaccion.tipo === 'ingreso') {
        if (transaccion.metodoPago === metodo) {
          total += transaccion.monto;
        } else if (transaccion.detalleMetodosPago && transaccion.detalleMetodosPago.length > 0) {
          // Para transacciones con múltiples métodos, sumar el método específico
          transaccion.detalleMetodosPago.forEach((m: any) => {
            if (m.tipo === metodo) {
              total += m.monto;
            }
          });
        }
      }
    });
    return total;
  }

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
    const inicial = this.cierreActual.efectivoInicial || 0;
    const ventasEfectivo = this.analisisMetodosPago?.efectivo?.total || 0;
    const egresosEfectivo = this.getEgresosEfectivo();
    const teorico = inicial + ventasEfectivo - egresosEfectivo;

    return teorico;
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

  eliminarTransaccion(transaccion: Transaccion): void {
    if (transaccion.numeroVenta) {
      this.swalService.showError(
        'No se puede eliminar',
        'Esta transacción proviene de una venta registrada. Para eliminarla, cancele la venta correspondiente.'
      );
      return;
    }

    this.swalService.showConfirm(
      '¿Eliminar transacción?',
      `¿Estás seguro de eliminar la transacción "${transaccion.descripcion}"?`,
      'Sí, eliminar',
      'Cancelar'
    ).then((result) => {
      if (result.isConfirmed) {
        this.transacciones = this.transacciones.filter(t => t.id !== transaccion.id);
        this.actualizarResumen();
        this.filtrarTransacciones();
        this.swalService.showSuccess('Eliminada', 'Transacción eliminada correctamente');
      }
    });
  }

  iniciarCaja(): void {
    if (this.inicioCajaForm.invalid || !this.sedeActual || !this.currentUser) return;

    const formValue = this.inicioCajaForm.value;

    this.cierreActual = {
      id: `CIERRE-${this.datePipe.transform(new Date(), 'yyyy-MM-dd')}-${this.sedeActual.key}`,
      fecha: new Date(),
      efectivoInicial: parseFloat(formValue.efectivoInicial),

      // Ventas por método (originales)
      ventasEfectivo: 0,
      ventasTarjeta: 0,
      ventasTransferencia: 0,
      ventasDebito: 0,
      ventasCredito: 0,
      ventasPagomovil: 0,
      ventasZelle: 0,

      // NUEVAS PROPIEDADES - Inicializar con los análisis actuales
      ventasPorTipo: { ...this.analisisVentas },
      metodosPago: JSON.parse(JSON.stringify(this.analisisMetodosPago)),
      formasPago: JSON.parse(JSON.stringify(this.analisisFormasPago)),
      ventasPendientes: [...this.analisisVentasPendientes],

      totales: {
        ingresos: this.getTotalIngresos(),
        egresos: this.getTotalEgresos(),
        neto: this.getNetoDia(),
        ventasContado: this.analisisFormasPago.contado.total,
        ventasCredito: this.analisisFormasPago.abono.deudaPendiente + this.analisisFormasPago.cashea.deudaPendiente,
        ventasPendientes: this.analisisFormasPago.deContadoPendiente.total
      },

      // Propiedades existentes
      otrosIngresos: this.transacciones.filter(t => t.tipo === 'ingreso').reduce((sum, t) => sum + t.monto, 0),
      egresos: this.getTotalEgresos(),
      efectivoFinalTeorico: parseFloat(formValue.efectivoInicial) + this.analisisMetodosPago.efectivo.total,
      efectivoFinalReal: 0,
      diferencia: 0,
      observaciones: formValue.observaciones,
      estado: 'abierto',
      usuarioApertura: this.currentUser.nombre,
      usuarioCierre: '',
      fechaApertura: new Date(),
      transacciones: [...this.transacciones],
      notasCierre: '',
      archivosAdjuntos: [],
      sede: this.sedeActual.key,
      monedaPrincipal: formValue.moneda || this.monedaSistema,
      tasasCambio: this.tasasCambio,
      metodosPagoDetallados: this.calcularMetodosPagoDetallados()
    };

    // Cerrar modal
    this.cerrarModal('inicioCajaModal');

    this.swalService.showSuccess('Caja iniciada', `Caja iniciada con ${this.formatCurrency(this.cierreActual.efectivoInicial)}`);
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

    // Cerrar modal usando nuestro método
    this.cerrarModal('transaccionModal');
    this.transaccionEditando = null;

    this.swalService.showSuccess('Transacción guardada', 'La transacción se ha registrado correctamente.');
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
    const clases: { [key: string]: string } = {
      abierto: 'estado-abierto',
      cerrado: 'estado-cerrado',
      revisado: 'estado-revisado',
      conciliado: 'estado-conciliado',
      'sin-iniciar': 'estado-sin-iniciar',
      'sin-cierre': 'estado-sin-cierre'
    };
    return clases[estado] || 'estado-default';
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

  exportarReporte(): void {
    this.mostrarMenuExport = false;

    if (!this.cierreActual && this.transaccionesFiltradas.length === 0) {
      this.swalService.showWarning('Sin datos', 'No hay datos para exportar');
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
        diferencia: this.getDiferenciaTotal(),
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

  cambiarFecha(dias: number): void {
    const nuevaFecha = new Date(this.fechaSeleccionada);
    nuevaFecha.setDate(nuevaFecha.getDate() + dias);
    this.fechaSeleccionada = nuevaFecha;

    // Al cambiar de fecha, resetear el cierreActual ANTES de cargar datos
    // para que no se muestre el cierre anterior mientras carga
    this.cierreActual = null;
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

  cargarHistorialCierres(): void {
    const fechaDesde = new Date(this.filtroHistorialDesde);
    const fechaHasta = new Date(this.filtroHistorialHasta);

    this.cierreCajaService.obtenerHistorialCierres(fechaDesde, fechaHasta, this.sedeActual?.key || 'guatire')
      .subscribe({
        next: (cierres) => {
          this.historialCierres = cierres;
        },
        error: (error) => {
          console.error('Error al cargar historial:', error);
          this.swalService.showError('Error', 'No se pudo cargar el historial de cierres');
        }
      });
  }

  getTotalVentasCierre(cierre: CierreDiario): number {
    return cierre.ventasEfectivo + cierre.ventasTarjeta + cierre.ventasTransferencia +
      cierre.ventasDebito + cierre.ventasCredito + cierre.ventasPagomovil + cierre.ventasZelle;
  }

  verDetalleCierre(cierre: CierreDiario): void {
    this.cierreActual = cierre;
    this.fechaSeleccionada = new Date(cierre.fecha);
    this.cargarDatosFecha();

    // Cerrar modal de historial
    const modal = bootstrap.Modal.getInstance(document.getElementById('historialCierresModal')!);
    modal?.hide();
  }

  anularCierre(cierre: CierreDiario): void {
    this.swalService.showConfirm(
      '¿Anular cierre?',
      `¿Estás seguro de anular el cierre del ${this.datePipe.transform(cierre.fecha, 'dd/MM/yyyy')}?<br>
     <small class="text-danger">Esta acción registrará el motivo de anulación y cambiará el estado a revisado.</small>`,
      'Sí, anular',
      'Cancelar'
    ).then((result) => {
      if (result.isConfirmed) {
        this.swalService.showInputPrompt(
          'Motivo de anulación',
          'Por favor, indica el motivo de la anulación:',
          'textarea'
        ).then((motivo) => {
          if (motivo) {
            this.cierreCajaService.anularCierre(cierre.id, motivo).subscribe({
              next: () => {
                this.swalService.showSuccess('Cierre anulado', 'El cierre ha sido anulado correctamente');
                this.cargarHistorialCierres();
              },
              error: (error) => {
                this.swalService.showError('Error', 'No se pudo anular el cierre');
              }
            });
          }
        });
      }
    });
  }

  abrirModalInicioCaja(): void {
    if (!this.sedeActual) {
      this.swalService.showWarning('Sede requerida', 'Debes estar asignado a una sede para iniciar caja.');
      return;
    }

    this.inicioCajaForm.patchValue({
      efectivoInicial: 0,
      observaciones: 'Caja abierta normalmente',
      moneda: this.monedaSistema
    });

    const modalElement = document.getElementById('inicioCajaModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  abrirModalCierre(): void {
    if (!this.cierreActual) {
      this.swalService.showWarning('Sin cierre activo', 'No hay una caja abierta para cerrar.');
      return;
    }

    // Resetear valores del formulario
    this.cierreForm.patchValue({
      efectivoRealUSD: 0,
      efectivoRealEUR: 0,
      efectivoRealVES: 0,
      zelleReal: 0,
      notasCierre: '',
      imprimirResumen: true,
      enviarEmail: false,
      adjuntarComprobantes: true
    });

    // Limpiar y reconstruir controles de bancos
    this.limpiarControlesBancos();
    this.agregarControlesBancos();

    // Forzar recalcular diferencias después de reconstruir controles
    setTimeout(() => {
      this.recalcularDiferencias();
    }, 100);

    // Suscribirse a cambios en el formulario
    this.suscribirCambiosFormularioCierre();

    const modalElement = document.getElementById('cierreCajaModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  abrirModalTransaccion(transaccion?: Transaccion): void {
    if (transaccion && transaccion.numeroVenta) {
      this.swalService.showInfo(
        'Venta registrada',
        `Esta transacción proviene de la venta #${transaccion.numeroVenta}. 
            Para modificarla, edite la venta correspondiente.`
      );
      return;
    }

    this.transaccionEditando = transaccion || null;

    if (transaccion) {
      this.transaccionForm.patchValue({
        tipo: transaccion.tipo,
        descripcion: transaccion.descripcion,
        monto: transaccion.monto,
        metodoPago: transaccion.metodoPago,
        categoria: transaccion.categoria || 'venta_lentes',
        observaciones: transaccion.observaciones || '',
        comprobante: transaccion.comprobante || ''
      });
    } else {
      this.transaccionForm.reset({
        tipo: 'venta',
        metodoPago: 'efectivo',
        categoria: 'venta_lentes',
        monto: 0
      });
    }

    const modalElement = document.getElementById('transaccionModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  abrirHistorial(): void {
    // Cargar historial de los últimos 30 días por defecto
    const fechaFin = new Date();
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - 30);

    this.filtroHistorialDesde = this.datePipe.transform(fechaInicio, 'yyyy-MM-dd') || '';
    this.filtroHistorialHasta = this.datePipe.transform(fechaFin, 'yyyy-MM-dd') || '';

    this.cargarHistorialCierres();

    const modalElement = document.getElementById('historialCierresModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  cerrarModal(modalId: string): void {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      if (modal) {
        modal.hide();
      }

      // Remover backdrop si queda
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.remove();
      }
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
  }

  // Métodos auxiliares
  getColorMetodoPago(metodo: string): string {
    const colores: { [key: string]: string } = {
      'efectivo': '#22c55e',
      'tarjeta': '#8b5cf6',
      'punto': '#8b5cf6',
      'transferencia': '#3b82f6',
      'pagomovil': '#ec4899',
      'zelle': '#8b5cf6',
      'mixto': '#f59e0b'
    };
    return colores[metodo] || '#64748b';
  }

  getIconoMetodoPago(metodo: string): string {
    const iconos: { [key: string]: string } = {
      'efectivo': 'bi-cash',
      'tarjeta': 'bi-credit-card',
      'punto': 'bi-credit-card',
      'transferencia': 'bi-bank',
      'pagomovil': 'bi-phone',
      'zelle': 'bi-globe2',
      'mixto': 'bi-wallet2'
    };
    return iconos[metodo] || 'bi-receipt';
  }

  verDetalleVenta(numeroVenta: string): void {
    // Aquí puedes navegar al detalle de la venta
  }

  get totalConsultas(): number {
    return this.analisisVentas?.soloConsulta?.total || 0;
  }

  get totalConsultaProductos(): number {
    return this.analisisVentas?.consultaProductos?.total || 0;
  }

  get totalSoloProductos(): number {
    return this.analisisVentas?.soloProductos?.total || 0;
  }

  get puntosPorBanco(): any[] {
    return this.analisisMetodosPago?.punto?.porBanco || [];
  }

  get pagosMovilPorBanco(): any[] {
    return this.analisisMetodosPago?.pagomovil?.porBanco || [];
  }

  get transferenciasPorBanco(): any[] {
    return this.analisisMetodosPago?.transferencia?.porBanco || [];
  }

  get efectivoDolar(): number {
    return this.analisisMetodosPago?.efectivo?.porMoneda?.dolar || 0;
  }

  get efectivoEuro(): number {
    return this.analisisMetodosPago?.efectivo?.porMoneda?.euro || 0;
  }

  get efectivoBolivar(): number {
    return this.analisisMetodosPago?.efectivo?.porMoneda?.bolivar || 0;
  }

  get totalContado(): number {
    return this.analisisFormasPago?.contado?.total || 0;
  }

  get totalAbonos(): number {
    return this.analisisFormasPago?.abono?.total || 0;
  }

  get totalCashea(): number {
    return this.analisisFormasPago?.cashea?.total || 0;
  }

  get totalPendientes(): number {
    return this.analisisFormasPago?.deContadoPendiente?.total || 0;
  }

  get ventasPendientesLista(): any[] {
    return this.analisisVentasPendientes || [];
  }

  get esDiaActual(): boolean {
    return this.fechaSeleccionada.toDateString() === new Date().toDateString();
  }

  get totalVentasKPI(): number {
    return this.analisisVentas.soloConsulta.total +
      this.analisisVentas.consultaProductos.total +
      this.analisisVentas.soloProductos.total;
  }

  get totalPendientesKPI(): number {
    return this.analisisFormasPago.deContadoPendiente.total;
  }

  get netoDiaKPI(): number {
    return this.getTotalIngresos() - this.getTotalEgresos();
  }

  get efectivoInicial(): number {
    return this.cierreActual?.efectivoInicial || 0;
  }

  get efectivoFinalTeorico(): number {
    if (!this.cierreActual) return 0;
    return this.cierreActual.efectivoInicial + this.analisisMetodosPago.efectivo.total - this.getEgresosEfectivo();
  }

  getTotalVentasHistorial(): number {
    return this.historialCierres.reduce((sum, cierre) => sum + this.getTotalVentasCierre(cierre), 0);
  }

  getDiferenciaTotalHistorial(): number {
    return this.historialCierres.reduce((sum, cierre) => sum + cierre.diferencia, 0);
  }

  exportarHistorial(): void {
    const data = {
      cierres: this.historialCierres,
      fechaGeneracion: new Date(),
      usuario: this.currentUser?.nombre,
      sede: this.sedeActual?.nombre,
      totales: {
        totalCierres: this.historialCierres.length,
        totalVentas: this.getTotalVentasHistorial(),
        totalDiferencia: this.getDiferenciaTotalHistorial()
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial-cierres-${this.datePipe.transform(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  private suscribirCambiosFormularioCierre(): void {
    // Suscribirse a cambios en efectivo por moneda
    this.cierreForm.get('efectivoRealUSD')?.valueChanges.subscribe(() => {
      this.recalcularDiferencias();
    });
    this.cierreForm.get('efectivoRealEUR')?.valueChanges.subscribe(() => {
      this.recalcularDiferencias();
    });
    this.cierreForm.get('efectivoRealVES')?.valueChanges.subscribe(() => {
      this.recalcularDiferencias();
    });

    // Suscribirse a cambios en Zelle
    this.cierreForm.get('zelleReal')?.valueChanges.subscribe(() => {
      this.recalcularDiferencias();
    });

    // Suscribirse a cambios en notas de cierre
    this.cierreForm.get('notasCierre')?.valueChanges.subscribe(() => {
      this.recalcularDiferencias();
    });
  }

  recalcularDiferencias(): void {
    if (!this.cierreActual) return;

    // 1. Calcular diferencia de efectivo
    const efectivoReal = this.getEfectivoRealTotal();
    const efectivoTeorico = this.getEfectivoFinalTeorico();
    const diferenciaEfectivo = efectivoReal - efectivoTeorico;

    // 2. Calcular diferencias por método de pago
    const diferenciasPunto = this.calcularDiferenciasPunto();
    const diferenciaTransferencia = this.getDiferenciaTransferencia();
    const diferenciaPagomovil = this.getDiferenciaPagomovil();
    const diferenciaZelle = this.getDiferenciaZelle();

    // 3. Calcular diferencia total
    const diferenciaTotal = diferenciaEfectivo +
      diferenciasPunto.total +
      diferenciaTransferencia +
      diferenciaPagomovil +
      diferenciaZelle;

    // 4. Actualizar el cierre actual
    this.cierreActual.diferencia = diferenciaTotal;
    this.cierreActual.efectivoFinalReal = efectivoReal;

    // 5. Actualizar el resumen de diferencias
    this.cierreActual.resumenDiferencias = {
      efectivo: {
        diferencia: diferenciaEfectivo,
        justificacion: ''
      },
      punto: {
        diferencia: diferenciasPunto.total,
        justificacion: '',
        porBanco: diferenciasPunto.porBanco
      },
      transferencia: {
        diferencia: diferenciaTransferencia,
        justificacion: ''
      },
      pagomovil: {
        diferencia: diferenciaPagomovil,
        justificacion: ''
      },
      zelle: {
        diferencia: diferenciaZelle,
        justificacion: ''
      },
      total: diferenciaTotal,
      requiereJustificacion: Math.abs(diferenciaTotal) > 0.01
    };

    // Forzar detección de cambios
    this.cdr.detectChanges();
  }

  private calcularDiferenciasPunto(): { total: number; porBanco: any[] } {
    let total = 0;
    const porBanco: any[] = [];

    this.analisisMetodosPago.punto.porBanco.forEach(banco => {
      const controlName = `puntoReal_${banco.bancoCodigo || banco.banco.replace(/\s/g, '_')}`;
      const montoReal = this.cierreForm.get(controlName)?.value || 0;
      const montoSistema = banco.total;
      const diferencia = montoReal - montoSistema;

      total += diferencia;

      porBanco.push({
        banco: banco.banco,
        bancoCodigo: banco.bancoCodigo,
        montoReal: montoReal,
        montoSistema: montoSistema,
        diferencia: diferencia,
        cantidadReal: 0,
        cantidadSistema: banco.cantidad
      });
    });

    return { total, porBanco };
  }

  getEfectivoRealTotal(): number {
    const usd = this.cierreForm.get('efectivoRealUSD')?.value || 0;
    const eur = this.cierreForm.get('efectivoRealEUR')?.value || 0;
    const ves = this.cierreForm.get('efectivoRealVES')?.value || 0;

    // Convertir todo a USD
    const eurToUsd = eur * (this.tasasCambio?.euro || 1.05);
    const vesToUsd = ves / (this.tasasCambio?.bolivar || 60.5);

    const total = usd + eurToUsd + vesToUsd;
    return total;
  }

  // Diferencia de efectivo
  getDiferenciaEfectivo(): number {
    const real = this.getEfectivoRealTotal();
    const teorico = this.getEfectivoFinalTeorico();
    const diff = real - teorico;
    return diff;
  }

  // Diferencia de punto de venta
  getDiferenciaPunto(): number {
    let realTotal = 0;
    let sistemaTotal = 0;

    if (this.analisisMetodosPago?.punto?.porBanco) {
      this.analisisMetodosPago.punto.porBanco.forEach(banco => {
        const controlName = `puntoReal_${banco.bancoCodigo || banco.banco.replace(/\s/g, '_')}`;
        const montoReal = this.cierreForm.get(controlName)?.value || 0;
        realTotal += montoReal;
        sistemaTotal += banco.total;
      });
    }

    const diff = realTotal - sistemaTotal;
    return diff;
  }

  getDiferenciaTransferencia(): number {
    const real = this.cierreForm.get('transferenciaRealTotal')?.value || 0;
    const sistema = this.analisisMetodosPago?.transferencia?.total || 0;
    return real - sistema;
  }

  // Diferencia de pago móvil (ahora global)
  getDiferenciaPagomovil(): number {
    const real = this.cierreForm.get('pagomovilRealTotal')?.value || 0;
    const sistema = this.analisisMetodosPago?.pagomovil?.total || 0;
    return real - sistema;
  }

  // Diferencia de Zelle
  getDiferenciaZelle(): number {
    const real = this.cierreForm.get('zelleReal')?.value || 0;
    const sistema = this.analisisMetodosPago?.zelle?.total || 0;
    return real - sistema;
  }

  // Diferencia total
  getDiferenciaTotal(): number {
    const diff = this.getDiferenciaEfectivo() +
      this.getDiferenciaPunto() +
      this.getDiferenciaTransferencia() +
      this.getDiferenciaPagomovil() +
      this.getDiferenciaZelle();
    return diff;
  }

  private redondear(valor: number, decimales: number = 2): number {
    return Number(valor.toFixed(decimales));
  }
  // Métodos para verificar diferencias
  tieneDiferenciaPunto(): boolean {
    return Math.abs(this.getDiferenciaPunto()) > 0.01;
  }

  tieneDiferenciaTransferencia(): boolean {
    return Math.abs(this.getDiferenciaTransferencia()) > 0.01;
  }

  // Verificar si hay diferencia en pago móvil
  tieneDiferenciaPagomovil(): boolean {
    return Math.abs(this.getDiferenciaPagomovil()) > 0.01;
  }

  tieneDiferenciaZelle(): boolean {
    return Math.abs(this.getDiferenciaZelle()) > 0.01;
  }

  tieneDiferenciaTotal(): boolean {
    return Math.abs(this.getDiferenciaTotal()) > 0.01;
  }

  getDiferenciaPuntoFormateada(): string {
    const diff = this.getDiferenciaPunto();
    return diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
  }

  getDiferenciaTransferenciaFormateada(): string {
    const diff = this.getDiferenciaTransferencia();
    return diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
  }

  // Formatear diferencia de pago móvil
  getDiferenciaPagomovilFormateada(): string {
    const diff = this.getDiferenciaPagomovil();
    return diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
  }

  getDiferenciaZelleFormateada(): string {
    const diff = this.getDiferenciaZelle();
    return diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
  }

  getDiferenciaTotalFormateada(): string {
    const diff = this.getDiferenciaTotal();
    return diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
  }

  // Métodos auxiliares para el modal
  getDiferenciaPuntoPorBanco(bancoCodigo: string): number {
    const controlName = `puntoReal_${bancoCodigo}`;
    const montoReal = this.cierreForm.get(controlName)?.value || 0;
    const bancoData = this.analisisMetodosPago.punto.porBanco.find(b => b.bancoCodigo === bancoCodigo);
    const montoSistema = bancoData?.total || 0;
    return montoReal - montoSistema;
  }

  getDiferenciaBadgeClass(diferencia: number): string {
    if (Math.abs(diferencia) < 0.01) return 'bg-secondary';
    return diferencia > 0 ? 'bg-success' : 'bg-danger';
  }

  getDiferenciaClass(diferencia: number): string {
    if (Math.abs(diferencia) < 0.01) return 'diferencia-cero';
    return diferencia > 0 ? 'diferencia-positiva' : 'diferencia-negativa';
  }

  getDiferenciaTotalClass(): string {
    const diff = this.getDiferenciaTotal();
    if (Math.abs(diff) < 0.01) return 'text-secondary';
    return diff > 0 ? 'text-success' : 'text-danger';
  }

  getDiferenciaTotalClassValor(diff: number): string {
    if (Math.abs(diff) < 0.01) return 'text-secondary';
    return diff > 0 ? 'text-success' : 'text-danger';
  }

  getEfectivoTeoricoPorcentaje(): number {
    const teorico = this.efectivoFinalTeorico;
    const real = this.getEfectivoRealTotal();
    if (teorico === 0) return 0;
    const porcentaje = (real / teorico) * 100;
    return Math.min(100, Math.max(0, porcentaje));
  }

  getMensajeAlertaClass(): string {
    const diff = this.getDiferenciaTotal();
    if (Math.abs(diff) < 0.01) return 'alert-success';
    return diff > 0 ? 'alert-warning' : 'alert-danger';
  }

  getMensajeIcono(): string {
    const diff = this.getDiferenciaTotal();
    if (Math.abs(diff) < 0.01) return 'bi-check-circle-fill';
    return diff > 0 ? 'bi-arrow-up-circle-fill' : 'bi-arrow-down-circle-fill';
  }

  getMensajeDiferencia(): string {
    const diff = this.getDiferenciaTotal();
    if (Math.abs(diff) < 0.01) {
      return '¡Perfecto! Todos los montos coinciden con el sistema.';
    }
    return diff > 0
      ? 'Sobrante en caja. Verifique si hubo ingresos no registrados.'
      : 'Faltante en caja. Verifique egresos o errores en el conteo.';
  }

  // Métodos para la card de información dinámica
  getInfoCardClass(): string {
    const tipo = this.transaccionForm.get('tipo')?.value;
    switch (tipo) {
      case 'venta':
        return 'bg-success bg-opacity-10';
      case 'ingreso':
        return 'bg-info bg-opacity-10';
      case 'egreso':
        return 'bg-danger bg-opacity-10';
      case 'ajuste':
        return 'bg-warning bg-opacity-10';
      default:
        return 'bg-light';
    }
  }

  getInfoIcon(): string {
    const tipo = this.transaccionForm.get('tipo')?.value;
    switch (tipo) {
      case 'venta':
        return 'bi-cart-check-fill text-success';
      case 'ingreso':
        return 'bi-arrow-up-circle-fill text-info';
      case 'egreso':
        return 'bi-arrow-down-circle-fill text-danger';
      case 'ajuste':
        return 'bi-arrow-left-right text-warning';
      default:
        return 'bi-info-circle-fill text-secondary';
    }
  }

  getInfoTitle(): string {
    const tipo = this.transaccionForm.get('tipo')?.value;
    switch (tipo) {
      case 'venta':
        return 'Venta registrada:';
      case 'ingreso':
        return 'Ingreso extra:';
      case 'egreso':
        return 'Egreso/Gasto:';
      case 'ajuste':
        return 'Ajuste de caja:';
      default:
        return 'Información:';
    }
  }

  getInfoMessage(): string {
    const tipo = this.transaccionForm.get('tipo')?.value;
    switch (tipo) {
      case 'venta':
        return 'Esta transacción se registrará como una venta normal. Afecta el efectivo teórico.';
      case 'ingreso':
        return 'Este ingreso extra se suma al total del día. No afecta el cálculo de efectivo teórico.';
      case 'egreso':
        return 'Este egreso resta del efectivo. Asegúrese de registrar el comprobante correspondiente.';
      case 'ajuste':
        return 'Este ajuste modifica el saldo de caja. Debe incluir una justificación en observaciones.';
      default:
        return 'Complete los campos para registrar la transacción.';
    }
  }

  toggleExportMenu(): void {
    this.mostrarMenuExport = !this.mostrarMenuExport;

    // Cerrar menú al hacer clic fuera
    if (this.mostrarMenuExport) {
      setTimeout(() => {
        document.addEventListener('click', this.cerrarMenuClickExterno.bind(this));
      }, 100);
    }
  }

  cerrarMenuClickExterno(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const container = document.querySelector('.export-button-container');

    if (container && !container.contains(target)) {
      this.mostrarMenuExport = false;
      document.removeEventListener('click', this.cerrarMenuClickExterno.bind(this));
    }
  }

  exportarReportePDF(): void {
    this.mostrarMenuExport = false;

    // Reutilizar el método de impresión existente, pero con opción de guardar como PDF
    const contenido = this.generarContenidoReporte();

    // Crear una ventana para imprimir/guardar como PDF
    const ventana = window.open('', '_blank');
    if (ventana) {
      ventana.document.write(contenido);
      ventana.document.close();
      setTimeout(() => {
        ventana.print();
        // No cerramos automáticamente para permitir guardar como PDF
        // ventana.close();
      }, 500);
    }
  }

  // Método auxiliar para generar el contenido del reporte
  private generarContenidoReporte(): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cierre de Caja - ${this.datePipe.transform(this.fechaSeleccionada, 'dd/MM/yyyy')}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        .resumen { border: 1px solid #ccc; padding: 15px; margin-bottom: 20px; border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f4f4f4; }
        .total { font-weight: bold; }
        .diferencia { color: ${this.getDiferenciaTotal() >= 0 ? 'green' : 'red'}; }
        .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
        .kpi-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
        .kpi-value { font-size: 24px; font-weight: bold; color: #667eea; }
        .kpi-label { font-size: 12px; color: #666; }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Cierre de Caja</h1>
        <p>${this.sedeActual?.nombre || 'Óptica'} - ${this.datePipe.transform(this.fechaSeleccionada, 'dd/MM/yyyy')}</p>
      </div>
      
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-value">${this.formatCurrency(this.efectivoInicial)}</div>
          <div class="kpi-label">Efectivo Inicial</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${this.formatCurrency(this.totalVentasKPI)}</div>
          <div class="kpi-label">Total Ventas</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${this.formatCurrency(this.totalPendientesKPI)}</div>
          <div class="kpi-label">Total Pendiente</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${this.formatCurrency(this.netoDiaKPI)}</div>
          <div class="kpi-label">Neto del Día</div>
        </div>
      </div>
      
      <div class="resumen">
        <h2>Resumen del Día</h2>
        <p><strong>Estado:</strong> ${this.getEstadoTexto(this.cierreActual?.estado)}</p>
        <p><strong>Efectivo Inicial:</strong> ${this.formatCurrency(this.cierreActual?.efectivoInicial)}</p>
        <p><strong>Ventas Efectivo:</strong> ${this.formatCurrency(this.cierreActual?.ventasEfectivo)}</p>
        <p><strong>Total Ventas:</strong> ${this.formatCurrency(this.getTotalVentas())}</p>
        <p><strong>Egresos:</strong> ${this.formatCurrency(this.cierreActual?.egresos)}</p>
        <p class="diferencia"><strong>Diferencia:</strong> ${this.formatCurrency(this.getDiferenciaTotal())}</p>
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
              <td>${this.formatCurrency(t.monto)}</td>
              <td>${t.usuario}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <p class="no-print" style="margin-top: 30px; color: #666;">
        Generado el: ${this.datePipe.transform(new Date(), 'dd/MM/yyyy HH:mm')}
      </p>
    </body>
    </html>
  `;
  }

  exportarReporteJSON(): void {
    this.mostrarMenuExport = false;
    this.exportarReporte(); // Reutiliza el método existente
  }

  // Método para exportar a Excel
  exportarExcel(): void {
    if (!this.cierreActual && this.transaccionesFiltradas.length === 0) {
      this.swalService.showWarning('Sin datos', 'No hay datos para exportar a Excel');
      return;
    }

    // Preparar datos para Excel
    const datosExcel = {
      resumen: {
        fecha: this.fechaSeleccionada,
        sede: this.sedeActual?.nombre,
        estado: this.cierreActual?.estado || 'Sin cierre',
        efectivoInicial: this.efectivoInicial,
        totalVentas: this.totalVentasKPI,
        totalPendiente: this.totalPendientesKPI,
        netoDia: this.netoDiaKPI,
        diferencia: this.getDiferenciaTotal()
      },
      ventasPorTipo: {
        soloConsulta: {
          cantidad: this.analisisVentas.soloConsulta.cantidad,
          total: this.analisisVentas.soloConsulta.total
        },
        consultaProductos: {
          cantidad: this.analisisVentas.consultaProductos.cantidad,
          total: this.analisisVentas.consultaProductos.total
        },
        soloProductos: {
          cantidad: this.analisisVentas.soloProductos.cantidad,
          total: this.analisisVentas.soloProductos.total
        }
      },
      metodosPago: this.analisisMetodosPago,
      formasPago: this.analisisFormasPago,
      transacciones: this.transaccionesFiltradas.map(t => ({
        descripcion: t.descripcion,
        tipo: t.tipo,
        metodoPago: t.metodoPago,
        monto: t.monto,
        usuario: t.usuario,
        fecha: t.fecha,
        numeroVenta: t.numeroVenta || '',
        cliente: t.cliente?.nombre || ''
      }))
    };

    // Convertir a CSV para Excel
    const convertToCSV = (data: any[]): string => {
      const headers = Object.keys(data[0]);
      const csvRows = [];
      csvRows.push(headers.join(','));

      for (const row of data) {
        const values = headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
          if (value instanceof Date) return `"${value.toLocaleString()}"`;
          return value;
        });
        csvRows.push(values.join(','));
      }

      return csvRows.join('\n');
    };

    // Crear archivo CSV
    const transaccionesCSV = convertToCSV(datosExcel.transacciones);
    const resumenCSV = `Resumen,Cierre de Caja\nFecha,${this.datePipe.transform(this.fechaSeleccionada, 'dd/MM/yyyy')}\nSede,${this.sedeActual?.nombre}\nEstado,${this.cierreActual?.estado || 'Sin cierre'}\nEfectivo Inicial,${this.efectivoInicial}\nTotal Ventas,${this.totalVentasKPI}\nTotal Pendiente,${this.totalPendientesKPI}\nNeto Día,${this.netoDiaKPI}\nDiferencia,${this.getDiferenciaTotal()}\n\n`;

    const contenidoCompleto = resumenCSV + '\n\nTRANSACCIONES\n' + transaccionesCSV;

    // Crear blob y descargar
    const blob = new Blob(["\uFEFF" + contenidoCompleto], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cierre-caja-${this.datePipe.transform(this.fechaSeleccionada, 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.swalService.showSuccess('Exportado', 'Reporte exportado a Excel correctamente');
  }

  importarRespaldo(): void {
    this.mostrarMenuExport = false;

    // Crear input file oculto
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          try {
            const data = JSON.parse(e.target.result);
            this.procesarImportacion(data);
          } catch (error) {
            this.swalService.showError('Error', 'El archivo no es un JSON válido');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  procesarImportacion(data: any): void {
    if (data.cierre) {
      this.cierreActual = data.cierre;
      this.actualizarResumen();
      this.filtrarTransacciones();
      this.swalService.showSuccess('Importación exitosa', 'Los datos se han cargado correctamente');
    } else {
      this.swalService.showWarning('Formato inválido', 'El archivo no contiene datos de cierre válidos');
    }
  }
}
