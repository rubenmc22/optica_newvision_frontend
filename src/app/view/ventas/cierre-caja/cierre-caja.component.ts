import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, debounceTime, catchError, map } from 'rxjs/operators';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { CierreCajaService } from './cierre-caja.service';
import { ExcelExportService } from '../../../core/services/excel-export/excel-export.service';
import { SystemConfigService } from './../../system-config/system-config.service';
import { TasaCambiariaService } from './../../../core/services/tasaCambiaria/tasaCambiaria.service';
import { UserStateService } from './../../../core/services/userState/user-state-service';
import { Sede, SedeCompleta } from '../../../view/login/login-interface';
import { CierreDiario, Transaccion, ResumenMetodoPago, TasasCambio, TransaccionCobroDia, TransaccionDetalleMetodoPago } from './cierre-caja.interfaz';
import { User, Rol, AuthData, AuthResponse, Cargo } from '../../../Interfaces/models-interface';
import { SwalService } from '../../../core/services/swal/swal.service';
import { GenerarVentaService } from '../generar-venta/generar-venta.service';
import {
  buildVentaPaymentCatalog,
  VentaPaymentCatalog,
  VentaPaymentMethodOption,
  VentaReceiverAccountOption
} from '../shared/payment-catalog.util';
import * as bootstrap from 'bootstrap';


type ManualTransactionType = 'ingreso' | 'egreso';

interface ManualTransactionOption {
  valor: ManualTransactionType;
  label: string;
  icono: string;
  color: string;
  descripcion: string;
}

interface ManualTransactionCategoryOption {
  value: string;
  label: string;
  icono: string;
  descripcion: string;
}

interface ManualPaymentMethodOption {
  valor: string;
  label: string;
  icono: string;
  color: string;
  descripcion: string;
}

interface HistorialDashboardData {
  reporte: any;
  efectivoInicial: number;
  totalVentas: number;
  totalPendiente: number;
  netoDia: number;
  efectivoContado: number;
  efectivoTeorico: number;
  diferenciaCaja: number;
  diferenciaTotal: number;
  egresosOperativos: number;
  transaccionesRegistradas: number;
  ventasPendientes: number;
  desgloseDiferencias: Array<{ clave: string; label: string; valor: number }>;
}



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
  detalleVentaExpandidaId: string | null = null;
  mostrarFiltros = false;
  ultimaActualizacion = new Date();
  isMobile = false;
  mostrarMenuExport: boolean = false;
  mostrarMenuExportHistorial: boolean = false;

  // Información del usuario y sede
  sedeActual: SedeCompleta | null = null;
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

  tasasReferenciaBolivar: TasasCambio = {
    dolar: 1,
    euro: 1,
    bolivar: 1
  };

  tabActivo: 'tipos' | 'metodos' | 'formas' | 'pendientes' = 'tipos';

  tabActivoCierre: 'efectivo' | 'punto' | 'transferencias' | 'pagomovil' | 'zelle' = 'efectivo';
  hayDiferencia: boolean = false;
  comentarioRequerido: boolean = false;
  historialCierres: CierreDiario[] = [];
  bloqueoOperativoActual: any = null;
  private historialDashboardData = new Map<string, HistorialDashboardData>();
  private actualizandoValidaciones: boolean = false;
  private recalculando: boolean = false;
  private suscripcionesFormularioCierreInicializadas: boolean = false;
  private destroy$ = new Subject<void>();
  // En las propiedades de la clase
  private _diferenciaTotal: number = 0;
  private _efectivoTeorico: number = 0;
  private _efectivoReal: number = 0;

  totalEfectivoInicialCalculado: number = 0;


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
    punto: { total: number; ingresos: number; egresos: number; porBanco: any[]; cantidad: number };
    pagomovil: { total: number; ingresos: number; egresos: number; cantidad: number; porBanco: any[] };
    transferencia: { total: number; ingresos: number; egresos: number; cantidad: number; porBanco: any[] };
    zelle: { total: number; ingresos: number; egresos: number; cantidad: number; porBanco: any[] };
  } = {
      efectivo: { total: 0, porMoneda: { dolar: 0, euro: 0, bolivar: 0 }, cantidad: 0 },
      punto: { total: 0, ingresos: 0, egresos: 0, porBanco: [], cantidad: 0 },
      pagomovil: { total: 0, ingresos: 0, egresos: 0, cantidad: 0, porBanco: [] },
      transferencia: { total: 0, ingresos: 0, egresos: 0, cantidad: 0, porBanco: [] },
      zelle: { total: 0, ingresos: 0, egresos: 0, cantidad: 0, porBanco: [] }
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
  private readonly coloresMetodoPago: Record<string, string> = {
    efectivo: '#16a34a',
    punto: '#7c3aed',
    tarjeta: '#7c3aed',
    debito: '#0f766e',
    credito: '#d97706',
    transferencia: '#2563eb',
    pagomovil: '#db2777',
    zelle: '#4f46e5',
    mixto: '#475569',
    binance: '#f59e0b'
  };
  readonly tiposTransaccionManual: ManualTransactionOption[] = [
    {
      valor: 'ingreso',
      label: 'Ingreso manual',
      icono: 'bi-plus-circle-fill',
      color: '#2563eb',
      descripcion: 'Entrada extraordinaria o regularización que no llega desde una venta automática.'
    },
    {
      valor: 'egreso',
      label: 'Egreso manual',
      icono: 'bi-dash-circle-fill',
      color: '#dc2626',
      descripcion: 'Salida de caja por pago, gasto o devolución que debe impactar el cierre del día.'
    }
  ];
  private readonly categoriasTransaccionManual: Record<ManualTransactionType, ManualTransactionCategoryOption[]> = {
    ingreso: [
      {
        value: 'aporte_caja',
        label: 'Aporte a caja',
        icono: 'bi-safe2',
        descripcion: 'Reposición de fondo o ingreso manual para sostener la operatividad del día.'
      },
      {
        value: 'cobro_saldo_pendiente',
        label: 'Cobro de saldo pendiente',
        icono: 'bi-cash-stack',
        descripcion: 'Regularización manual de un abono o saldo que no entró desde ventas.'
      },
      {
        value: 'reintegro_caja',
        label: 'Reintegro de caja',
        icono: 'bi-arrow-counterclockwise',
        descripcion: 'Devolución de un gasto o reintegro operativo al fondo del día.'
      },
      {
        value: 'ingreso_financiero',
        label: 'Ingreso financiero',
        icono: 'bi-bank2',
        descripcion: 'Intereses, comisiones a favor o ajustes positivos provenientes del banco.'
      },
      {
        value: 'otro_ingreso',
        label: 'Otro ingreso manual',
        icono: 'bi-plus-square',
        descripcion: 'Ingreso excepcional que requiere soporte claro para auditoría.'
      }
    ],
    egreso: [
      {
        value: 'pago_proveedor',
        label: 'Pago a proveedor',
        icono: 'bi-box-seam',
        descripcion: 'Pago de mercancía, laboratorio, insumos o servicios de proveedor.'
      },
      {
        value: 'gasto_operativo',
        label: 'Gasto operativo',
        icono: 'bi-building-gear',
        descripcion: 'Papelería, limpieza, agua, café, transporte o gasto corriente del día.'
      },
      {
        value: 'retiro_caja',
        label: 'Retiro de caja',
        icono: 'bi-cash-coin',
        descripcion: 'Retiro programado para resguardo, traslado o control interno.'
      },
      {
        value: 'pago_servicio',
        label: 'Pago de servicio',
        icono: 'bi-receipt-cutoff',
        descripcion: 'Internet, electricidad, agua, telefonía o servicios recurrentes.'
      },
      {
        value: 'nomina_comision',
        label: 'Nómina o comisión',
        icono: 'bi-people-fill',
        descripcion: 'Pago manual a personal, incentivo, comisión o apoyo operativo.'
      },
      {
        value: 'gasto_bancario',
        label: 'Gasto bancario',
        icono: 'bi-bank',
        descripcion: 'Comisiones, cargos, mantenimiento o diferencias bancarias.'
      },
      {
        value: 'reembolso_cliente',
        label: 'Reembolso al cliente',
        icono: 'bi-arrow-return-left',
        descripcion: 'Devolución manual de dinero por anulación, ajuste comercial o garantía.'
      },
      {
        value: 'otro_egreso',
        label: 'Otro egreso manual',
        icono: 'bi-dash-square',
        descripcion: 'Salida extraordinaria que debe quedar plenamente justificada.'
      }
    ]
  };
  cuentasReceptorasConfiguradasPorMetodo: Record<string, VentaReceiverAccountOption[]> = buildVentaPaymentCatalog().cuentasReceptorasPorMetodo;

  // Métodos de pago disponibles
  metodosPago: ManualPaymentMethodOption[] = this.construirOpcionesMetodosPago(buildVentaPaymentCatalog().tiposPago);

  // Tipos de transacción
  tiposTransaccion = [
    { valor: 'venta', label: 'Venta', icono: 'bi-cart-check', color: '#10b981' },
    { valor: 'ingreso', label: 'Ingreso / Abono', icono: 'bi-plus-circle', color: '#3b82f6' },
    { valor: 'egreso', label: 'Egreso', icono: 'bi-dash-circle', color: '#ef4444' },
    { valor: 'ajuste', label: 'Ajuste', icono: 'bi-arrow-left-right', color: '#8b5cf6' }
  ];
  readonly opcionesFiltroTipoTransaccion = [
    { valor: 'venta', label: 'Ventas del dia', icono: 'bi-cart-check', color: '#10b981' },
    { valor: 'solo_abonos', label: 'Abonos cobrados', icono: 'bi-calendar-check', color: '#0f766e' },
    { valor: 'ingreso', label: 'Ingresos manuales', icono: 'bi-plus-circle', color: '#3b82f6' },
    { valor: 'egreso', label: 'Egresos manuales', icono: 'bi-dash-circle', color: '#ef4444' },
    { valor: 'ajuste', label: 'Ajustes operativos', icono: 'bi-arrow-left-right', color: '#8b5cf6' }
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
  usaModoDummy = false;

  // Estados de carga
  cargandoDatos: boolean = false;
  guardandoCierre: boolean = false;
  historialCargando: boolean = false;

  filtroHistorialDesde: string = '';
  filtroHistorialHasta: string = '';
  historialDetalleSeleccionado: CierreDiario | null = null;
  historialDetallePreviewUrl: SafeResourceUrl | null = null;
  historialDetalleCargando: boolean = false;
  private historialDetalleObjectUrl: string | null = null;
  private reabrirHistorialAlCerrarDetalle: boolean = false;

  constructor(
    private fb: FormBuilder,
    private decimalPipe: DecimalPipe,
    private datePipe: DatePipe,
    private cierreCajaService: CierreCajaService,
    private cdr: ChangeDetectorRef,
    private systemConfigService: SystemConfigService,
    private tasaCambiariaService: TasaCambiariaService, // Nuevo
    private userStateService: UserStateService,
    private generarVentaService: GenerarVentaService,
    private excelExportService: ExcelExportService,
    private swalService: SwalService,
    private sanitizer: DomSanitizer
  ) {
    this.inicializarForms();
    this.checkMobile();
    this.usaModoDummy = this.cierreCajaService.estaUsandoDummy();
    this.establecerRangoHistorialSemanaActual();
  }

  @HostListener('window:resize')
  onResize() {
    this.checkMobile();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;

    if (this.mostrarMenuExportHistorial && !target?.closest('.historial-export-dropdown')) {
      this.mostrarMenuExportHistorial = false;
    }
  }

  ngOnInit(): void {
    this.obtenerConfiguracionSistema();
    this.cargarCuentasReceptorasConfiguradas();
    this.obtenerUsuarioYSede();
    this.suscribirVentasGeneradas();
    this.configurarSuscripciones();

  }

  private cargarCuentasReceptorasConfiguradas(): void {
    this.systemConfigService.obtenerMetodosPagoConfigurables()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ paymentMethods }) => {
          const catalogo = buildVentaPaymentCatalog(paymentMethods);
          this.aplicarCatalogoMetodosPago(catalogo);

          if (!this.transacciones.length) {
            return;
          }

          this.calcularAnalisisDesdeTransacciones();
          this.limpiarControlesBancos();
          this.agregarControlesBancos();

          if (this.cierreActual?.detalleCierreReal) {
            this.precargarValoresReales();
          }

          if (this.cierreActual) {
            this.actualizarResumen();
          }

          this.filtrarTransacciones();
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.warn('No se pudieron cargar las cuentas receptoras configuradas para cierre de caja:', error);
        }
      });
  }

  private aplicarCatalogoMetodosPago(catalogo: VentaPaymentCatalog): void {
    this.cuentasReceptorasConfiguradasPorMetodo = catalogo.cuentasReceptorasPorMetodo;
    this.metodosPago = this.construirOpcionesMetodosPago(catalogo.tiposPago);
    this.sincronizarFormularioTransaccion();
  }

  private construirOpcionesMetodosPago(metodos: VentaPaymentMethodOption[]): ManualPaymentMethodOption[] {
    return metodos.map((metodo) => ({
      valor: this.normalizarClaveMetodoPago(metodo.value),
      label: this.limpiarEtiquetaMetodoPago(metodo.label),
      icono: metodo.icon || 'bi-wallet2',
      color: this.obtenerColorMetodoPagoConfigurado(metodo.value),
      descripcion: this.construirDescripcionMetodoPago(metodo)
    }));
  }

  private limpiarEtiquetaMetodoPago(label: string): string {
    return String(label || '')
      .replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/, '')
      .trim();
  }

  private obtenerColorMetodoPagoConfigurado(metodo: string): string {
    return this.coloresMetodoPago[this.normalizarClaveMetodoPago(metodo)] || '#475569';
  }

  private construirDescripcionMetodoPago(metodo: VentaPaymentMethodOption): string {
    const clave = this.normalizarClaveMetodoPago(metodo.value);
    const cuentas = this.cuentasReceptorasConfiguradasPorMetodo?.[clave] || [];

    if (cuentas.length > 0) {
      return `Usa ${cuentas.length === 1 ? 'la cuenta receptora configurada' : `${cuentas.length} destinos configurados`} del sistema.`;
    }

    switch (clave) {
      case 'efectivo':
        return 'Impacta directamente el efectivo físico disponible para cierre.';
      case 'punto':
        return 'Registra pagos electrónicos procesados por punto de venta.';
      case 'transferencia':
        return 'Registra movimientos bancarios con soporte y referencia.';
      case 'pagomovil':
        return 'Registra pagos móviles usando los bancos receptores configurados.';
      case 'zelle':
        return 'Registra ingresos o egresos en USD vía cuenta Zelle.';
      default:
        return 'Método configurable tomado desde la parametrización general del sistema.';
    }
  }

  private normalizarClaveMetodoPago(valor: string): string {
    const clave = String(valor || '').trim().toLowerCase();

    if (['tarjeta'].includes(clave)) {
      return 'punto';
    }

    return clave;
  }

  get tipoTransaccionManualActual(): ManualTransactionType {
    return this.transaccionForm?.get('tipo')?.value === 'egreso' ? 'egreso' : 'ingreso';
  }

  get categoriasTransaccionDisponibles(): ManualTransactionCategoryOption[] {
    return this.categoriasTransaccionManual[this.tipoTransaccionManualActual] || [];
  }

  get categoriaTransaccionActual(): ManualTransactionCategoryOption | null {
    const categoria = String(this.transaccionForm?.get('categoria')?.value || '').trim();
    return this.categoriasTransaccionDisponibles.find((item) => item.value === categoria) || null;
  }

  get metodoPagoSeleccionado(): ManualPaymentMethodOption | null {
    const metodo = this.normalizarClaveMetodoPago(this.transaccionForm?.get('metodoPago')?.value || '');
    return this.metodosPago.find((item) => item.valor === metodo) || null;
  }

  get cuentasReceptorasMetodoSeleccionado(): VentaReceiverAccountOption[] {
    const metodo = this.normalizarClaveMetodoPago(this.transaccionForm?.get('metodoPago')?.value || '');
    return this.cuentasReceptorasConfiguradasPorMetodo?.[metodo] || [];
  }

  get cuentaReceptoraSeleccionada(): VentaReceiverAccountOption | null {
    const cuentaId = String(this.transaccionForm?.get('cuentaReceptoraId')?.value || '').trim();
    return this.cuentasReceptorasMetodoSeleccionado.find((item) => item.id === cuentaId) || null;
  }

  get requiereCuentaReceptora(): boolean {
    return this.cuentasReceptorasMetodoSeleccionado.length > 0;
  }

  get mostrarAvisoSinCuentasConfiguradas(): boolean {
    const metodo = this.normalizarClaveMetodoPago(this.transaccionForm?.get('metodoPago')?.value || '');
    return metodo !== 'efectivo' && !this.requiereCuentaReceptora;
  }

  get etiquetaCuentaReceptora(): string {
    return this.tipoTransaccionManualActual === 'egreso' ? 'Cuenta de salida' : 'Destino configurado';
  }

  get placeholderCuentaReceptora(): string {
    return this.tipoTransaccionManualActual === 'egreso'
      ? 'Selecciona la cuenta o canal desde donde sale el pago'
      : 'Selecciona el destino operativo';
  }

  get etiquetaCampoComprobante(): string {
    return this.normalizarClaveMetodoPago(this.transaccionForm?.get('metodoPago')?.value || '') === 'efectivo'
      ? 'Soporte o comprobante'
      : 'Referencia o comprobante';
  }

  get placeholderCampoComprobante(): string {
    const metodo = this.normalizarClaveMetodoPago(this.transaccionForm?.get('metodoPago')?.value || '');

    switch (metodo) {
      case 'pagomovil':
        return 'Ej. referencia del pago móvil';
      case 'transferencia':
        return 'Ej. número de transferencia';
      case 'zelle':
        return 'Ej. email, código o soporte Zelle';
      case 'punto':
        return 'Ej. lote, voucher o soporte POS';
      default:
        return 'Ej. factura, recibo o nota interna';
    }
  }

  get placeholderDescripcionTransaccion(): string {
    const categoria = this.categoriaTransaccionActual?.label?.toLowerCase();

    if (!categoria) {
      return 'Describe con precisión el movimiento que impacta la caja.';
    }

    return `Ej. detalle concreto de ${categoria}`;
  }

  get ayudaObservacionesTransaccion(): string {
    if (this.categoriaRequiereObservaciones()) {
      return 'Esta categoría requiere una justificación clara para facilitar el control del cierre.';
    }

    return 'Agrega contexto útil para auditoría, soporte o validación posterior.';
  }

  seleccionarTipoTransaccion(tipo: ManualTransactionType): void {
    this.transaccionForm.patchValue({ tipo });
    this.sincronizarFormularioTransaccion();
  }

  seleccionarMetodoPago(metodo: string): void {
    this.transaccionForm.patchValue({ metodoPago: this.normalizarClaveMetodoPago(metodo) });
    this.sincronizarFormularioTransaccion();
  }

  private getCategoriaPredeterminada(tipo: ManualTransactionType): string {
    return this.categoriasTransaccionManual[tipo]?.[0]?.value || 'otro_ingreso';
  }

  private getMetodoPagoPredeterminado(): string {
    return this.metodosPago[0]?.valor || 'efectivo';
  }

  private sincronizarFormularioTransaccion(): void {
    if (!this.transaccionForm) {
      return;
    }

    const tipoControl = this.transaccionForm.get('tipo');
    const categoriaControl = this.transaccionForm.get('categoria');
    const metodoControl = this.transaccionForm.get('metodoPago');
    const comprobanteControl = this.transaccionForm.get('comprobante');
    const observacionesControl = this.transaccionForm.get('observaciones');
    const cuentaControl = this.transaccionForm.get('cuentaReceptoraId');

    const tipoActual = tipoControl?.value === 'egreso' ? 'egreso' : 'ingreso';
    const categoriasDisponibles = this.categoriasTransaccionManual[tipoActual] || [];
    const metodosDisponibles = this.metodosPago;
    const metodoActual = this.normalizarClaveMetodoPago(metodoControl?.value || this.getMetodoPagoPredeterminado());

    if (!metodosDisponibles.some((item) => item.valor === metodoActual)) {
      metodoControl?.setValue(this.getMetodoPagoPredeterminado(), { emitEvent: false });
    } else if (metodoActual !== metodoControl?.value) {
      metodoControl?.setValue(metodoActual, { emitEvent: false });
    }

    if (!categoriasDisponibles.some((item) => item.value === categoriaControl?.value)) {
      categoriaControl?.setValue(this.getCategoriaPredeterminada(tipoActual), { emitEvent: false });
    }

    const cuentas = this.cuentasReceptorasConfiguradasPorMetodo?.[metodoActual] || [];
    const cuentaActual = String(cuentaControl?.value || '').trim();

    if (cuentas.length) {
      cuentaControl?.setValidators([Validators.required]);

      if (cuentas.length === 1 && !cuentaActual) {
        cuentaControl?.setValue(cuentas[0].id, { emitEvent: false });
      } else if (cuentaActual && !cuentas.some((cuenta) => cuenta.id === cuentaActual)) {
        cuentaControl?.setValue('', { emitEvent: false });
      }
    } else {
      cuentaControl?.clearValidators();
      if (cuentaActual) {
        cuentaControl?.setValue('', { emitEvent: false });
      }
    }

    if (this.metodoRequiereComprobante()) {
      comprobanteControl?.setValidators([Validators.required, Validators.minLength(4)]);
    } else {
      comprobanteControl?.clearValidators();
    }

    if (this.categoriaRequiereObservaciones()) {
      observacionesControl?.setValidators([Validators.required, Validators.minLength(8)]);
    } else {
      observacionesControl?.clearValidators();
    }

    categoriaControl?.updateValueAndValidity({ emitEvent: false });
    metodoControl?.updateValueAndValidity({ emitEvent: false });
    cuentaControl?.updateValueAndValidity({ emitEvent: false });
    comprobanteControl?.updateValueAndValidity({ emitEvent: false });
    observacionesControl?.updateValueAndValidity({ emitEvent: false });
  }

  private metodoRequiereComprobante(): boolean {
    return this.normalizarClaveMetodoPago(this.transaccionForm?.get('metodoPago')?.value || '') !== 'efectivo';
  }

  private categoriaRequiereObservaciones(): boolean {
    const categoria = String(this.transaccionForm?.get('categoria')?.value || '').trim();
    return ['otro_ingreso', 'otro_egreso', 'retiro_caja', 'reembolso_cliente'].includes(categoria);
  }

  private construirDetalleMetodoPagoManual(monto: number): Transaccion['detalleMetodosPago'] {
    const cuenta = this.cuentaReceptoraSeleccionada;
    const metodo = this.normalizarClaveMetodoPago(this.transaccionForm?.get('metodoPago')?.value || '');
    const referencia = String(this.transaccionForm?.get('comprobante')?.value || '').trim();

    return [
      {
        tipo: metodo,
        monto: this.redondearMonto(monto),
        moneda: this.obtenerCodigoMoneda(this.monedaSistema),
        montoEnMonedaSistema: this.redondearMonto(monto),
        referencia: referencia || undefined,
        banco: cuenta?.nombre || undefined,
        bancoNombre: cuenta?.nombre || undefined,
        bancoCodigo: cuenta?.codigo || undefined,
        bancoReceptor: cuenta?.displayText || undefined,
        bancoReceptorNombre: cuenta?.nombre || undefined,
        bancoReceptorCodigo: cuenta?.codigo || undefined,
        cuentaReceptoraId: cuenta?.id || undefined,
        cuentaReceptoraAlias: cuenta?.displayTitle || undefined,
        cuentaReceptoraEmail: cuenta?.email || undefined,
        cuentaReceptoraTitular: cuenta?.ownerName || undefined,
        cuentaReceptoraDocumento: cuenta?.ownerId || undefined,
        cuentaReceptoraTelefono: cuenta?.phone || undefined,
        cuentaReceptoraDescripcion: cuenta?.accountDescription || undefined
      }
    ];
  }

  ngOnDestroy(): void {
    this.limpiarVistaPreviaHistorial();
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
      next: (response: any) => {

        // Extraer las tasas del array
        const tasasArray = response?.tasas || [];
        const tasasCache = this.tasaCambiariaService.getTasaActualValor();

        // Buscar cada tasa por su id
        const tasaDolar = Number(tasasArray.find((t: any) => t.id === 'dolar')?.valor || tasasCache?.usd || this.tasasReferenciaBolivar.dolar || 1);
        const tasaEuro = Number(tasasArray.find((t: any) => t.id === 'euro')?.valor || tasasCache?.eur || this.tasasReferenciaBolivar.euro || 1);
        const tasaBolivar = tasasArray.find((t: any) => t.id === 'bolivar')?.valor || 1;

        this.tasasReferenciaBolivar = {
          dolar: tasaDolar,
          euro: tasaEuro,
          bolivar: tasaBolivar
        };

        // Configurar tasas según la moneda del sistema
        if (this.monedaSistema === 'USD') {
          // Convertir todo a USD
          // 1 USD = 1 USD
          // 1 EUR = tasaEuro / tasaDolar USD
          // 1 VES = 1 / tasaDolar USD
          this.tasasCambio = {
            dolar: 1,
            euro: tasaEuro / tasaDolar,  // Ej: 542.64 / 474.06 = 1.1447
            bolivar: 1 / tasaDolar       // Ej: 1 / 474.06 = 0.00211
          };
        }
        else if (this.monedaSistema === 'EUR') {
          // Convertir todo a EUR
          this.tasasCambio = {
            dolar: tasaDolar / tasaEuro,  // Ej: 474.06 / 542.64 = 0.8737
            euro: 1,
            bolivar: 1 / tasaEuro         // Ej: 1 / 542.64 = 0.00184
          };
        }
        else { // VES o Bs.
          // Convertir todo a VES
          this.tasasCambio = {
            dolar: tasaDolar,   // Ej: 474.06
            euro: tasaEuro,     // Ej: 542.64
            bolivar: 1
          };
        }

        this.calcularTotalEfectivoInicial();
        this.refrescarAnalisisMonetario();
      },
      error: (error) => {
        console.error('Error al cargar tasas:', error);
        const tasasCache = this.tasaCambiariaService.getTasaActualValor();
        const tasaDolar = Number(tasasCache?.usd || this.tasasReferenciaBolivar.dolar || 1);
        const tasaEuro = Number(tasasCache?.eur || this.tasasReferenciaBolivar.euro || 1);

        this.tasasReferenciaBolivar = {
          dolar: tasaDolar,
          euro: tasaEuro,
          bolivar: 1
        };

        // Valores por defecto según moneda del sistema
        if (this.monedaSistema === 'USD') {
          this.tasasCambio = {
            dolar: 1,
            euro: tasaDolar > 0 ? (tasaEuro / tasaDolar) : 1,
            bolivar: tasaDolar > 0 ? (1 / tasaDolar) : 1
          };
        } else if (this.monedaSistema === 'EUR') {
          this.tasasCambio = {
            dolar: tasaEuro > 0 ? (tasaDolar / tasaEuro) : 1,
            euro: 1,
            bolivar: tasaEuro > 0 ? (1 / tasaEuro) : 1
          };
        } else {
          this.tasasCambio = {
            dolar: tasaDolar,
            euro: tasaEuro,
            bolivar: 1
          };
        }
        this.calcularTotalEfectivoInicial();
        this.refrescarAnalisisMonetario();
      }
    });
  }

  private refrescarAnalisisMonetario(): void {
    if (!this.transacciones.length) {
      return;
    }

    this.calcularAnalisisDesdeTransacciones();

    if (this.cierreActual) {
      this.actualizarResumen();
    }

    this.filtrarTransacciones();
  }

  private redondearMonto(valor: number, decimales: number = 2): number {
    if (!Number.isFinite(valor)) {
      return 0;
    }

    return Number(valor.toFixed(decimales));
  }

  private normalizarMoneda(moneda?: string): 'dolar' | 'euro' | 'bolivar' {
    const valor = (moneda || 'USD').toString().trim().toLowerCase();

    if (['usd', 'dolar', 'dólar', '$'].includes(valor)) {
      return 'dolar';
    }

    if (['eur', 'euro', '€'].includes(valor)) {
      return 'euro';
    }

    return 'bolivar';
  }

  private obtenerCodigoMoneda(moneda?: string): 'USD' | 'EUR' | 'VES' {
    const monedaNormalizada = this.normalizarMoneda(moneda);

    if (monedaNormalizada === 'dolar') {
      return 'USD';
    }

    if (monedaNormalizada === 'euro') {
      return 'EUR';
    }

    return 'VES';
  }

  private obtenerMonedaSistemaNormalizada(): 'dolar' | 'euro' | 'bolivar' {
    return this.normalizarMoneda(this.monedaSistema);
  }

  private obtenerMapaTasasHistoricas(
    tasasHistoricas?: Array<{ moneda: string; tasa: number; valor?: number }>
  ): Record<string, number> {
    const tasas: Record<string, number> = {
      dolar: this.tasasReferenciaBolivar?.dolar || 1,
      euro: this.tasasReferenciaBolivar?.euro || 1,
      bolivar: 1
    };

    (tasasHistoricas || []).forEach((item) => {
      const moneda = this.normalizarMoneda(item?.moneda);
      const tasa = Number(item?.tasa ?? item?.valor ?? 0);

      if (Number.isFinite(tasa) && tasa > 0) {
        tasas[moneda] = tasa;
      }
    });

    return tasas;
  }

  private convertirMontoConTasas(
    monto: number,
    monedaOrigen?: string,
    monedaDestino?: string,
    tasasHistoricas?: Array<{ moneda: string; tasa: number; valor?: number }>
  ): number {
    const montoSeguro = Number(monto || 0);
    const origen = this.normalizarMoneda(monedaOrigen);
    const destino = this.normalizarMoneda(monedaDestino || this.monedaSistema);

    if (!montoSeguro) {
      return 0;
    }

    if (origen === destino) {
      return this.redondearMonto(montoSeguro);
    }

    const tasas = this.obtenerMapaTasasHistoricas(tasasHistoricas);
    const montoEnBolivar = origen === 'bolivar'
      ? montoSeguro
      : montoSeguro * (tasas[origen] || 1);

    if (destino === 'bolivar') {
      return this.redondearMonto(montoEnBolivar);
    }

    return this.redondearMonto(montoEnBolivar / (tasas[destino] || 1));
  }

  private obtenerTasasHistoricasTransaccion(transaccion?: Transaccion | null): Array<{ moneda: string; tasa: number; valor?: number }> {
    if (transaccion?.tasasHistoricas?.length) {
      return transaccion.tasasHistoricas;
    }

    return [
      { moneda: 'dolar', tasa: this.tasasReferenciaBolivar?.dolar || 1, valor: this.tasasReferenciaBolivar?.dolar || 1 },
      { moneda: 'euro', tasa: this.tasasReferenciaBolivar?.euro || 1, valor: this.tasasReferenciaBolivar?.euro || 1 },
      { moneda: 'bolivar', tasa: 1, valor: 1 }
    ];
  }

  getTasaUSDaVESActual(): number {
    const tasaReferencia = Number(this.tasasReferenciaBolivar?.dolar ?? 0);

    if (tasaReferencia > 0) {
      return tasaReferencia;
    }

    const bolivarEnMonedaSistema = Number(this.tasasCambio?.bolivar ?? 0);
    return bolivarEnMonedaSistema > 0 ? (1 / bolivarEnMonedaSistema) : 1;
  }

  private convertirMontoTransaccion(
    transaccion: Transaccion | null | undefined,
    monto: number,
    monedaOrigen?: string,
    monedaDestino?: string
  ): number {
    return this.convertirMontoConTasas(
      monto,
      monedaOrigen || transaccion?.monedaOriginal || transaccion?.moneda || this.monedaSistema,
      monedaDestino || this.monedaSistema,
      this.obtenerTasasHistoricasTransaccion(transaccion)
    );
  }

  getMontoTransaccionSistema(transaccion: Transaccion): number {
    if (typeof transaccion.montoSistema === 'number' && Number.isFinite(transaccion.montoSistema)) {
      return transaccion.montoSistema;
    }

    return this.convertirMontoTransaccion(
      transaccion,
      transaccion.montoOriginal ?? transaccion.monto,
      transaccion.monedaOriginal || transaccion.moneda || this.monedaSistema,
      this.monedaSistema
    );
  }

  getMontoTransaccionReferenciaBolivar(transaccion: Transaccion): number {
    return this.convertirMontoTransaccion(
      transaccion,
      transaccion.montoOriginal ?? transaccion.monto,
      transaccion.monedaOriginal || transaccion.moneda || this.monedaSistema,
      'VES'
    );
  }

  getMontoMetodoPagoSistema(metodo: any, transaccion?: Transaccion): number {
    if (!metodo) {
      return 0;
    }

    const montoSistemaPersistido = Number(metodo.montoEnMonedaSistema ?? metodo.montoMonedaSistema);
    if (Number.isFinite(montoSistemaPersistido) && montoSistemaPersistido > 0) {
      return this.redondearMonto(montoSistemaPersistido);
    }

    return this.convertirMontoTransaccion(
      transaccion,
      Number(metodo.monto || 0),
      metodo.moneda || transaccion?.monedaOriginal || transaccion?.moneda || this.monedaSistema,
      this.monedaSistema
    );
  }

  getMontoMetodoPagoReferenciaBolivar(metodo: any, transaccion?: Transaccion): number {
    if (!metodo) {
      return 0;
    }

    return this.convertirMontoTransaccion(
      transaccion,
      Number(metodo.monto || 0),
      metodo.moneda || transaccion?.monedaOriginal || transaccion?.moneda || this.monedaSistema,
      'VES'
    );
  }

  getTextoMontoOriginalTransaccion(transaccion: Transaccion): string {
    const montoOriginal = Number(transaccion.montoOriginal ?? transaccion.monto ?? 0);
    const moneda = this.obtenerCodigoMoneda(transaccion.monedaOriginal || transaccion.moneda || this.monedaSistema);

    if (!montoOriginal) {
      return '';
    }

    return `${montoOriginal.toFixed(2)} ${moneda}`;
  }

  getTextoReferenciaBolivarTransaccion(transaccion: Transaccion): string {
    const referencia = this.getMontoTransaccionReferenciaBolivar(transaccion);
    const monedaOriginal = this.normalizarMoneda(transaccion.monedaOriginal || transaccion.moneda || this.monedaSistema);

    if (!referencia || monedaOriginal === 'bolivar') {
      return '';
    }

    return `Ref. Bs. ${referencia.toFixed(2)}`;
  }

  getTextoMontoOriginalBanco(banco: any): string {
    const montoOriginal = Number(banco?.totalOriginal || 0);
    const monedaOriginal = this.obtenerCodigoMoneda(banco?.monedaOriginal || 'VES');

    if (!montoOriginal) {
      return '';
    }

    if (monedaOriginal === this.obtenerCodigoMoneda(this.monedaSistema)) {
      return '';
    }

    return `${montoOriginal.toFixed(2)} ${monedaOriginal}`;
  }

  getTotalOriginalMetodo(tipo: 'transferencia' | 'pagomovil' | 'punto' | 'zelle'): number {
    const bancos = this.analisisMetodosPago?.[tipo]?.porBanco || [];

    return bancos.reduce((sum: number, banco: any) => sum + Number(banco?.totalOriginal || 0), 0);
  }

  getDestinosMetodo(tipo: 'punto' | 'transferencia' | 'pagomovil' | 'zelle'): any[] {
    return this.analisisMetodosPago?.[tipo]?.porBanco || [];
  }

  private limpiarTextoDestino(valor: unknown): string | null {
    const texto = (valor || '').toString().replace(/\s+/g, ' ').trim();
    return texto || null;
  }

  private limpiarReferenciaDestino(valor: string | null): string | null {
    if (!valor) {
      return null;
    }

    const partes = valor
      .split(/\s+-\s+/)
      .map((parte) => parte.trim())
      .filter((parte) => parte && !parte.includes('@'));

    return partes.length ? partes.join(' - ') : null;
  }

  private extraerBancoDesdeDescripcion(descripcion: string | null): string | null {
    const texto = this.limpiarTextoDestino(descripcion);

    if (!texto) {
      return null;
    }

    return texto.split(/\s+\(|\s+-\s+/)[0]?.trim() || null;
  }

  private extraerTelefonoDesdeDescripcion(descripcion: string | null): string | null {
    const texto = this.limpiarTextoDestino(descripcion);
    const match = texto?.match(/Telf\.\s*([^\-)]+)/i);
    return this.limpiarTextoDestino(match?.[1] || null);
  }

  private extraerDocumentoDesdeDescripcion(descripcion: string | null): string | null {
    const texto = this.limpiarTextoDestino(descripcion);
    const match = texto?.match(/CI\.\s*([^\-)]+)/i);
    return this.limpiarTextoDestino(match?.[1] || null);
  }

  private extraerCorreoDesdeDescripcion(descripcion: string | null): string | null {
    const texto = this.limpiarTextoDestino(descripcion);
    const match = texto?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return this.limpiarTextoDestino(match?.[0] || null)?.toLowerCase() || null;
  }

  private normalizarComparacionCuenta(valor: unknown): string {
    return `${valor || ''}`
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private resolverCuentaReceptoraConfigurada(metodo: any, tipo: 'punto' | 'transferencia' | 'pagomovil' | 'zelle'): VentaReceiverAccountOption | null {
    const cuentas = this.cuentasReceptorasConfiguradasPorMetodo?.[tipo] || [];

    if (!cuentas.length) {
      return null;
    }

    const cuentaReceptoraId = this.limpiarTextoDestino(metodo?.cuentaReceptoraId || null);
    if (cuentaReceptoraId) {
      const cuentaPorId = cuentas.find((cuenta) => cuenta.id === cuentaReceptoraId);
      if (cuentaPorId) {
        return cuentaPorId;
      }
    }

    const bancoCodigo = this.limpiarTextoDestino(metodo?.bancoReceptorCodigo || metodo?.bancoCodigo || null);
    const bancoNombre = this.limpiarTextoDestino(metodo?.bancoReceptorNombre || metodo?.bancoNombre || this.extraerBancoDesdeDescripcion(metodo?.bancoReceptor || null));
    const telefono = this.limpiarTextoDestino(metodo?.cuentaReceptoraTelefono || this.extraerTelefonoDesdeDescripcion(metodo?.bancoReceptor || null));
    const documento = this.limpiarTextoDestino(metodo?.cuentaReceptoraDocumento || this.extraerDocumentoDesdeDescripcion(metodo?.bancoReceptor || null));
    const correo = this.limpiarTextoDestino(metodo?.cuentaReceptoraEmail || this.extraerCorreoDesdeDescripcion(metodo?.bancoReceptor || null))?.toLowerCase() || null;
    const descripcion = this.normalizarComparacionCuenta(
      metodo?.cuentaReceptoraDescripcion
      || metodo?.cuentaReceptoraAlias
      || this.extraerDatosBancoReceptor(metodo?.bancoReceptor || null, bancoNombre).detalleCuenta
    );

    let candidatas = cuentas.filter((cuenta) => {
      if (bancoCodigo && cuenta.codigo !== bancoCodigo) {
        return false;
      }

      if (bancoNombre && cuenta.nombre && this.normalizarComparacionCuenta(cuenta.nombre) !== this.normalizarComparacionCuenta(bancoNombre)) {
        return false;
      }

      return true;
    });

    if (!candidatas.length && bancoCodigo) {
      candidatas = cuentas.filter((cuenta) => cuenta.codigo === bancoCodigo);
    }

    if (!candidatas.length && bancoNombre) {
      candidatas = cuentas.filter((cuenta) => this.normalizarComparacionCuenta(cuenta.nombre) === this.normalizarComparacionCuenta(bancoNombre));
    }

    const coincidenciaExacta = candidatas.find((cuenta) => {
      const coincideTelefono = telefono && cuenta.phone && this.normalizarComparacionCuenta(cuenta.phone) === this.normalizarComparacionCuenta(telefono);
      const coincideDocumento = documento && cuenta.ownerId && this.normalizarComparacionCuenta(cuenta.ownerId) === this.normalizarComparacionCuenta(documento);
      const coincideCorreo = correo && cuenta.email && this.normalizarComparacionCuenta(cuenta.email) === this.normalizarComparacionCuenta(correo);

      return (coincideTelefono && coincideDocumento) || coincideCorreo;
    });

    if (coincidenciaExacta) {
      return coincidenciaExacta;
    }

    const coincidenciaPorContacto = candidatas.find((cuenta) => {
      const coincideTelefono = telefono && cuenta.phone && this.normalizarComparacionCuenta(cuenta.phone) === this.normalizarComparacionCuenta(telefono);
      const coincideDocumento = documento && cuenta.ownerId && this.normalizarComparacionCuenta(cuenta.ownerId) === this.normalizarComparacionCuenta(documento);
      return !!coincideTelefono || !!coincideDocumento;
    });

    if (coincidenciaPorContacto) {
      return coincidenciaPorContacto;
    }

    if (descripcion) {
      const coincidenciaPorDescripcion = candidatas.find((cuenta) => this.normalizarComparacionCuenta(cuenta.accountDescription) === descripcion);
      if (coincidenciaPorDescripcion) {
        return coincidenciaPorDescripcion;
      }
    }

    return candidatas.length === 1 ? candidatas[0] : null;
  }

  private extraerDatosBancoReceptor(descripcion: string | null, bancoNombre: string | null): { detalleCuenta: string | null; referenciaCuenta: string | null } {
    const texto = this.limpiarTextoDestino(descripcion);
    const banco = this.limpiarTextoDestino(bancoNombre);

    if (!texto) {
      return { detalleCuenta: null, referenciaCuenta: null };
    }

    if (banco && texto === banco) {
      return { detalleCuenta: null, referenciaCuenta: null };
    }

    if (banco && texto.startsWith(`${banco} (`)) {
      const resto = texto.slice(banco.length).trim();
      const matchConReferencia = resto.match(/^\((.+)\)\s-\s(.+)$/);
      if (matchConReferencia) {
        return {
          detalleCuenta: this.limpiarTextoDestino(matchConReferencia[2]),
          referenciaCuenta: this.limpiarReferenciaDestino(matchConReferencia[1])
        };
      }

      const matchSoloDetalle = resto.match(/^\((.+)\)$/);
      if (matchSoloDetalle) {
        return {
          detalleCuenta: this.limpiarTextoDestino(matchSoloDetalle[1]),
          referenciaCuenta: null
        };
      }

      if (resto.startsWith('- ')) {
        return {
          detalleCuenta: this.limpiarTextoDestino(resto.slice(2)),
          referenciaCuenta: null
        };
      }
    }

    if (banco && texto.startsWith(`${banco} - `)) {
      return {
        detalleCuenta: this.limpiarTextoDestino(texto.slice(banco.length + 3)),
        referenciaCuenta: null
      };
    }

    const indiceSeparador = texto.lastIndexOf(' - ');
    if (indiceSeparador > -1) {
      const encabezado = texto.slice(0, indiceSeparador).trim();
      const detalle = texto.slice(indiceSeparador + 3).trim();
      const ultimoParentesis = encabezado.lastIndexOf('(');

      if (ultimoParentesis > -1 && encabezado.endsWith(')')) {
        return {
          detalleCuenta: this.limpiarTextoDestino(detalle),
          referenciaCuenta: this.limpiarReferenciaDestino(encabezado.slice(ultimoParentesis + 1, -1))
        };
      }

      return {
        detalleCuenta: this.limpiarTextoDestino(detalle),
        referenciaCuenta: null
      };
    }

    return {
      detalleCuenta: texto,
      referenciaCuenta: null
    };
  }

  private ordenarTransaccionesPorFechaDesc(transacciones: Transaccion[]): Transaccion[] {
    return [...transacciones].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }

  private normalizarClaveControlBanco(valor: string): string {
    return (valor || 'destino')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'destino';
  }

  private obtenerPrefijoMetodo(tipo: 'punto' | 'transferencia' | 'pagomovil' | 'zelle'): string {
    switch (tipo) {
      case 'punto':
        return 'puntoReal_';
      case 'transferencia':
        return 'transferenciaReal_';
      case 'pagomovil':
        return 'pagomovilReal_';
      default:
        return 'zelleReal_';
    }
  }

  getNombreControlMetodo(tipo: 'punto' | 'transferencia' | 'pagomovil' | 'zelle', item: any): string {
    const clave = item?.destinoKey || item?.bancoCodigo || this.normalizarClaveControlBanco(item?.banco || item?.destinoLabel || tipo);
    return `${this.obtenerPrefijoMetodo(tipo)}${clave}`;
  }

  private obtenerInfoDestinoMetodo(metodo: any, tipo: 'punto' | 'transferencia' | 'pagomovil' | 'zelle'): any {
    const cuentaConfigurada = this.resolverCuentaReceptoraConfigurada(metodo, tipo);
    const bancoPuntoDesdeDescripcion = this.extraerBancoDesdeDescripcion(metodo?.bancoReceptor || null);
    const bancoBase = tipo === 'punto'
      ? (cuentaConfigurada?.nombre || metodo?.bancoNombre || metodo?.bancoReceptorNombre || metodo?.cuentaReceptora?.bancoNombre || metodo?.banco || bancoPuntoDesdeDescripcion || 'Otro')
      : (cuentaConfigurada?.nombre || metodo?.bancoReceptorNombre || metodo?.bancoReceptor || metodo?.bancoNombre || metodo?.banco || (tipo === 'zelle' ? 'Cuenta Zelle principal' : 'Destino sin identificar'));
    const bancoCodigo = tipo === 'punto'
      ? (cuentaConfigurada?.codigo || metodo?.bancoCodigo || metodo?.bancoReceptorCodigo || metodo?.cuentaReceptora?.bancoCodigo || this.normalizarClaveControlBanco(bancoBase).toUpperCase())
      : (cuentaConfigurada?.codigo || metodo?.bancoReceptorCodigo || metodo?.bancoCodigo || this.normalizarClaveControlBanco(bancoBase).toUpperCase());
    const datosBancoReceptor = this.extraerDatosBancoReceptor(metodo?.bancoReceptor || null, bancoBase);
    const cuentaCorreo = this.limpiarTextoDestino(
      cuentaConfigurada?.email
      || metodo?.cuentaReceptoraEmail
      || metodo?.cuentaReceptora?.correo
      || metodo?.cuentaReceptora?.email
      || this.extraerCorreoDesdeDescripcion(metodo?.bancoReceptor || null)
    )?.toLowerCase() || null;
    const cuentaAlias = cuentaConfigurada?.accountDescription
      || metodo?.cuentaReceptoraAlias
      || metodo?.cuentaReceptoraDescripcion
      || metodo?.cuentaReceptoraDetalle
      || datosBancoReceptor.detalleCuenta
      || metodo?.cuentaReceptora?.descripcionCuenta
      || metodo?.cuentaReceptora?.titular
      || cuentaCorreo
      || metodo?.cuentaReceptora?.ultimos4
      || null;
    const cuentaId = cuentaConfigurada?.id || metodo?.cuentaReceptoraId || null;
    const cuentaTitular = cuentaConfigurada?.ownerName || metodo?.cuentaReceptoraTitular || metodo?.cuentaReceptora?.titular || metodo?.cuentaReceptora?.ownerName || null;
    const cuentaDocumento = cuentaConfigurada?.ownerId || metodo?.cuentaReceptoraDocumento || metodo?.cuentaReceptoraCedulaRif || metodo?.cuentaReceptora?.cedulaRif || metodo?.cuentaReceptora?.ownerId || null;
    const cuentaTelefono = cuentaConfigurada?.phone || metodo?.cuentaReceptoraTelefono || metodo?.cuentaReceptora?.telefono || metodo?.cuentaReceptora?.phone || null;
    const detalleCuenta = cuentaAlias && cuentaAlias !== bancoBase
      ? cuentaAlias
      : (cuentaTitular && cuentaTitular !== bancoBase ? cuentaTitular : null);
    const referenciaCuenta = [
      cuentaTelefono ? `Telf. ${cuentaTelefono}` : null,
      cuentaDocumento ? `CI. ${cuentaDocumento}` : null
    ].filter(Boolean).join(' - ') || datosBancoReceptor.referenciaCuenta || null;
    const destinoLabel = detalleCuenta
      ? `${bancoBase} (${detalleCuenta})`
      : bancoBase;
    const identidadZelle = cuentaId
      || cuentaCorreo
      || [cuentaTelefono, cuentaDocumento].filter(Boolean).join('_')
      || cuentaAlias
      || cuentaTitular
      || bancoBase;
    const destinoKey = tipo === 'zelle'
      ? this.normalizarClaveControlBanco(`zelle_${identidadZelle}`)
      : this.normalizarClaveControlBanco(`${bancoCodigo}_${cuentaId || cuentaAlias || bancoBase}_${metodo?.moneda || this.monedaSistema}`);

    return {
      banco: bancoBase,
      bancoCodigo,
      destinoKey,
      destinoLabel,
      cuentaAlias,
      cuentaId,
      detalleCuenta,
      referenciaCuenta,
      cuentaTitular,
      cuentaDocumento,
      cuentaTelefono,
      monedaOriginal: this.obtenerCodigoMoneda(metodo?.moneda || this.monedaSistema)
    };
  }

  getTituloDestino(item: any): string {
    return item?.destinoLabel || item?.banco || 'Destino sin identificar';
  }

  getDetalleDestino(item: any): string | null {
    if (item?.destinoLabel && item?.detalleCuenta) {
      return null;
    }

    return item?.detalleCuenta || null;
  }

  getReferenciaDestino(item: any): string | null {
    return item?.referenciaCuenta || null;
  }

  getMontoRealMetodoPorDestino(tipo: 'punto' | 'transferencia' | 'pagomovil' | 'zelle', item: any): number {
    return Number(this.cierreForm.get(this.getNombreControlMetodo(tipo, item))?.value || 0);
  }

  getDiferenciaMetodoPorDestino(tipo: 'punto' | 'transferencia' | 'pagomovil' | 'zelle', item: any): number {
    return this.redondearMonto(this.getMontoRealMetodoPorDestino(tipo, item) - Number(item?.total || 0));
  }

  autoCompletarMetodoPorDestino(tipo: 'punto' | 'transferencia' | 'pagomovil' | 'zelle', item: any): void {
    const controlName = this.getNombreControlMetodo(tipo, item);
    const montoSistema = Number(item?.total || 0);

    this.cierreForm.patchValue({ [controlName]: montoSistema });
  }

  getMontoSistemaEnBolivar(monto: number): number {
    return this.convertirMontoConTasas(monto, this.monedaSistema, 'VES');
  }

  private obtenerDetalleEfectivoInicialFormulario(): { Bs: number; USD: number; EUR: number } {
    return {
      Bs: this.redondearMonto(Number(this.inicioCajaForm.get('efectivoInicialBs')?.value || 0)),
      USD: this.redondearMonto(Number(this.inicioCajaForm.get('efectivoInicialUsd')?.value || 0)),
      EUR: this.redondearMonto(Number(this.inicioCajaForm.get('efectivoInicialEur')?.value || 0))
    };
  }

  private calcularTotalEfectivoInicialDesdeDetalle(detalle: { Bs: number; USD: number; EUR: number }): number {
    const total = this.convertirMontoConTasas(detalle.USD, 'USD', this.monedaSistema) +
      this.convertirMontoConTasas(detalle.EUR, 'EUR', this.monedaSistema) +
      this.convertirMontoConTasas(detalle.Bs, 'VES', this.monedaSistema);

    return this.redondearMonto(total);
  }

  getEquivalenteMonedaApertura(moneda: 'USD' | 'EUR' | 'VES'): number {
    const detalle = this.obtenerDetalleEfectivoInicialFormulario();

    switch (moneda) {
      case 'USD':
        return this.convertirMontoConTasas(detalle.USD, 'USD', this.monedaSistema);
      case 'EUR':
        return this.convertirMontoConTasas(detalle.EUR, 'EUR', this.monedaSistema);
      case 'VES':
        return this.convertirMontoConTasas(detalle.Bs, 'VES', this.monedaSistema);
      default:
        return 0;
    }
  }

  private inicializarForms(): void {
    this.inicioCajaForm = this.fb.group({
      efectivoInicialBs: [0, [Validators.required, Validators.min(0)]],
      efectivoInicialUsd: [0, [Validators.required, Validators.min(0)]],
      efectivoInicialEur: [0, [Validators.required, Validators.min(0)]],
      observaciones: ['Caja abierta normalmente'],
      moneda: ['USD', Validators.required]
    });

    this.transaccionForm = this.fb.group({
      tipo: ['ingreso', Validators.required],
      descripcion: ['', [Validators.required, Validators.minLength(3)]],
      monto: [0, [Validators.required, Validators.min(0.01)]],
      metodoPago: [this.getMetodoPagoPredeterminado(), Validators.required],
      categoria: [this.getCategoriaPredeterminada('ingreso'), Validators.required],
      comprobante: [''],
      observaciones: [''],
      cuentaReceptoraId: ['']
    });

    this.cierreForm = this.fb.group({
      efectivoRealUSD: [null, [Validators.required, Validators.min(0)]],
      efectivoRealEUR: [null, [Validators.required, Validators.min(0)]],
      efectivoRealVES: [null, [Validators.required, Validators.min(0)]],
      transferenciaRealTotal: [null, [Validators.required, Validators.min(0)]],
      pagomovilRealTotal: [null, [Validators.required, Validators.min(0)]],
      zelleReal: [null],
      notasCierre: [''],
      imprimirResumen: [false],
      enviarEmail: [false],
      adjuntarComprobantes: [true]
    });

    this.configurarValidadoresFormularioCierre();

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

  private obtenerControlesMontoRequeridosCierre(): string[] {
    const controles = ['efectivoRealUSD', 'efectivoRealEUR', 'efectivoRealVES'];

    if (this.getDestinosMetodo('punto').length) {
      controles.push(...this.getDestinosMetodo('punto').map((item) => this.getNombreControlMetodo('punto', item)));
    }

    if (this.getDestinosMetodo('transferencia').length) {
      controles.push(...this.getDestinosMetodo('transferencia').map((item) => this.getNombreControlMetodo('transferencia', item)));
    } else if ((this.analisisMetodosPago?.transferencia?.total || 0) > 0) {
      controles.push('transferenciaRealTotal');
    }

    if (this.getDestinosMetodo('pagomovil').length) {
      controles.push(...this.getDestinosMetodo('pagomovil').map((item) => this.getNombreControlMetodo('pagomovil', item)));
    } else if ((this.analisisMetodosPago?.pagomovil?.total || 0) > 0) {
      controles.push('pagomovilRealTotal');
    }

    if (this.getDestinosMetodo('zelle').length) {
      controles.push(...this.getDestinosMetodo('zelle').map((item) => this.getNombreControlMetodo('zelle', item)));
    } else if ((this.analisisMetodosPago?.zelle?.total || 0) > 0) {
      controles.push('zelleReal');
    }

    return controles.filter((controlName) => this.cierreForm.contains(controlName));
  }

  private configurarValidadoresFormularioCierre(): void {
    if (!this.cierreForm) {
      return;
    }

    const controlesRequeridos = new Set(this.obtenerControlesMontoRequeridosCierre());
    const controlesNoMonetarios = new Set(['notasCierre', 'imprimirResumen', 'enviarEmail', 'adjuntarComprobantes']);

    Object.keys(this.cierreForm.controls).forEach((controlName) => {
      if (controlesNoMonetarios.has(controlName)) {
        return;
      }

      const control = this.cierreForm.get(controlName);
      if (!control) {
        return;
      }

      if (controlesRequeridos.has(controlName)) {
        control.setValidators([Validators.required, Validators.min(0)]);
      } else {
        control.clearValidators();

        if (control.value === null || control.value === undefined || control.value === '') {
          control.setValue(0, { emitEvent: false });
        }
      }

      control.updateValueAndValidity({ emitEvent: false });
    });
  }

  private tieneCamposMontosCierreCompletos(): boolean {
    return this.obtenerControlesMontoRequeridosCierre().every((controlName) => {
      const valor = this.cierreForm.get(controlName)?.value;
      return valor !== null && valor !== undefined && valor !== '';
    });
  }

  puedeCerrarCaja(): boolean {
    const comentario = this.cierreForm.get('notasCierre')?.value?.trim() || '';

    if (!this.tieneCamposMontosCierreCompletos()) {
      return false;
    }

    if (this.cierreForm.invalid) {
      return false;
    }

    if (this.comentarioRequerido && comentario.length < 10) {
      return false;
    }

    return true;
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
      punto: { total: 0, ingresos: 0, egresos: 0, porBanco: [], cantidad: 0 },
      pagomovil: { total: 0, ingresos: 0, egresos: 0, cantidad: 0, porBanco: [] },
      transferencia: { total: 0, ingresos: 0, egresos: 0, cantidad: 0, porBanco: [] },
      zelle: { total: 0, ingresos: 0, egresos: 0, cantidad: 0, porBanco: [] }
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
      this.procesarMetodosPago(trans);

      if (trans.categoria === 'abono_venta') {
        return;
      }

      if (trans.tipo !== 'venta') return;

      // 1. Tipos de venta
      this.procesarTipoVenta(trans);

      // 2. Formas de pago
      this.procesarFormasPago(trans);

      // 3. Ventas pendientes
      this.procesarVentasPendientes(trans);
    });

  }

  private procesarTipoVenta(trans: Transaccion): void {
    const tipoVenta = trans.tipoVenta || (trans.tieneConsulta && trans.tieneProductos
      ? 'consulta_productos'
      : trans.tieneConsulta
        ? 'solo_consulta'
        : 'solo_productos');
    const monedaOrigen = trans.monedaOriginal || trans.moneda || this.monedaSistema;
    const totalSistema = trans.montoTotal
      ? this.convertirMontoTransaccion(trans, trans.montoTotal, monedaOrigen, this.monedaSistema)
      : this.getMontoTransaccionSistema(trans);
    const montoMedicoSistema = this.convertirMontoTransaccion(trans, trans.consulta?.pagoMedico || 0, monedaOrigen, this.monedaSistema);
    const montoOpticaSistema = this.convertirMontoTransaccion(trans, trans.consulta?.pagoOptica || 0, monedaOrigen, this.monedaSistema);
    const montoProductosOriginal = (trans.productos || []).reduce((sum: number, producto: any) => {
      const precio = Number(producto?.precioUnitario ?? producto?.precio ?? 0);
      const cantidad = Number(producto?.cantidad || 1);
      return sum + (precio * cantidad);
    }, 0);
    const montoProductosSistema = this.convertirMontoTransaccion(trans, montoProductosOriginal, monedaOrigen, this.monedaSistema);

    if (tipoVenta === 'solo_consulta') {
      this.analisisVentas.soloConsulta.cantidad++;
      this.analisisVentas.soloConsulta.total += totalSistema;
      this.analisisVentas.soloConsulta.montoMedico += montoMedicoSistema;
      this.analisisVentas.soloConsulta.montoOptica += montoOpticaSistema;
      return;
    }

    if (tipoVenta === 'consulta_productos') {
      this.analisisVentas.consultaProductos.cantidad++;
      this.analisisVentas.consultaProductos.total += totalSistema;
      this.analisisVentas.consultaProductos.montoMedico += montoMedicoSistema;
      this.analisisVentas.consultaProductos.montoProductos += montoProductosSistema;
      return;
    }

    this.analisisVentas.soloProductos.cantidad++;
    this.analisisVentas.soloProductos.total += totalSistema;
  }

  private procesarMetodosPago(trans: Transaccion): void {
    if (!trans.detalleMetodosPago) return;

    const factor = trans.tipo === 'egreso' ? -1 : 1;

    trans.detalleMetodosPago.forEach(metodo => {
      const tipo = metodo.tipo;
      const montoOriginal = Number(metodo.monto || 0);
      const moneda = metodo.moneda || trans.monedaOriginal || trans.moneda || 'USD';
      const monedaNormalizada = this.obtenerCodigoMoneda(moneda);
      const montoEnMonedaSistema = this.getMontoMetodoPagoSistema(metodo, trans) * factor;
      const montoOriginalAjustado = montoOriginal * factor;

      if (tipo === 'efectivo') {
        this.analisisMetodosPago.efectivo.total += montoEnMonedaSistema;
        this.analisisMetodosPago.efectivo.cantidad++;

        if (monedaNormalizada === 'USD') {
          this.analisisMetodosPago.efectivo.porMoneda.dolar += montoOriginalAjustado;
        } else if (monedaNormalizada === 'EUR') {
          this.analisisMetodosPago.efectivo.porMoneda.euro += montoOriginalAjustado;
        } else {
          this.analisisMetodosPago.efectivo.porMoneda.bolivar += montoOriginalAjustado;
        }
      }
      else if (tipo === 'punto') {
        this.analisisMetodosPago.punto.total += montoEnMonedaSistema;
        this.acumularTotalesMetodo(this.analisisMetodosPago.punto, montoEnMonedaSistema);
        this.analisisMetodosPago.punto.cantidad++;

        const destino = this.obtenerInfoDestinoMetodo(metodo, 'punto');
        let bancoExistente = this.analisisMetodosPago.punto.porBanco.find(b => b.destinoKey === destino.destinoKey);
        if (!bancoExistente) {
          bancoExistente = this.crearAcumuladorDestinoMetodo(destino);
          this.analisisMetodosPago.punto.porBanco.push(bancoExistente);
        }
        this.acumularDestinoMetodo(bancoExistente, montoEnMonedaSistema, montoOriginalAjustado);
      }
      else if (tipo === 'pagomovil') {
        this.analisisMetodosPago.pagomovil.total += montoEnMonedaSistema;
        this.acumularTotalesMetodo(this.analisisMetodosPago.pagomovil, montoEnMonedaSistema);
        this.analisisMetodosPago.pagomovil.cantidad++;

        const destino = this.obtenerInfoDestinoMetodo(metodo, 'pagomovil');
        let bancoExistente = this.analisisMetodosPago.pagomovil.porBanco.find(b => b.destinoKey === destino.destinoKey);
        if (!bancoExistente) {
          bancoExistente = this.crearAcumuladorDestinoMetodo(destino);
          this.analisisMetodosPago.pagomovil.porBanco.push(bancoExistente);
        }
        this.acumularDestinoMetodo(bancoExistente, montoEnMonedaSistema, montoOriginalAjustado);
      }
      else if (tipo === 'transferencia') {
        this.analisisMetodosPago.transferencia.total += montoEnMonedaSistema;
        this.acumularTotalesMetodo(this.analisisMetodosPago.transferencia, montoEnMonedaSistema);
        this.analisisMetodosPago.transferencia.cantidad++;

        const destino = this.obtenerInfoDestinoMetodo(metodo, 'transferencia');
        let bancoExistente = this.analisisMetodosPago.transferencia.porBanco.find(b => b.destinoKey === destino.destinoKey);
        if (!bancoExistente) {
          bancoExistente = this.crearAcumuladorDestinoMetodo(destino);
          this.analisisMetodosPago.transferencia.porBanco.push(bancoExistente);
        }
        this.acumularDestinoMetodo(bancoExistente, montoEnMonedaSistema, montoOriginalAjustado);
      }
      else if (tipo === 'zelle') {
        this.analisisMetodosPago.zelle.total += montoEnMonedaSistema;
        this.acumularTotalesMetodo(this.analisisMetodosPago.zelle, montoEnMonedaSistema);
        this.analisisMetodosPago.zelle.cantidad++;

        const destino = this.obtenerInfoDestinoMetodo(metodo, 'zelle');
        let bancoExistente = this.analisisMetodosPago.zelle.porBanco.find(b => b.destinoKey === destino.destinoKey);
        if (!bancoExistente) {
          bancoExistente = this.crearAcumuladorDestinoMetodo(destino);
          this.analisisMetodosPago.zelle.porBanco.push(bancoExistente);
        }
        this.acumularDestinoMetodo(bancoExistente, montoEnMonedaSistema, montoOriginalAjustado);
      }
    });

  }

  private crearAcumuladorDestinoMetodo(destino: any): any {
    return {
      ...destino,
      total: 0,
      totalOriginal: 0,
      ingresos: 0,
      egresos: 0,
      ingresosOriginal: 0,
      egresosOriginal: 0,
      cantidad: 0
    };
  }

  private acumularTotalesMetodo(objetivo: { ingresos: number; egresos: number }, montoSistema: number): void {
    if (montoSistema >= 0) {
      objetivo.ingresos += montoSistema;
      return;
    }

    objetivo.egresos += Math.abs(montoSistema);
  }

  private acumularDestinoMetodo(destino: any, montoSistema: number, montoOriginal: number): void {
    destino.total += montoSistema;
    destino.totalOriginal += montoOriginal;

    if (montoSistema >= 0) {
      destino.ingresos += montoSistema;
      destino.ingresosOriginal += Math.abs(montoOriginal);
    } else {
      destino.egresos += Math.abs(montoSistema);
      destino.egresosOriginal += Math.abs(montoOriginal);
    }

    destino.cantidad++;
  }

  private procesarFormasPago(trans: Transaccion): void {
    const formaPago = trans.formaPago;
    const total = trans.montoTotal ?? this.getMontoTransaccionSistema(trans);
    const abonado = trans.montoPagado ?? this.getMontoTransaccionSistema(trans);
    const deuda = this.obtenerDeudaPendienteAnalisis(trans, total, abonado);

    switch (formaPago) {
      case 'contado':
        this.analisisFormasPago.contado.cantidad++;
        this.analisisFormasPago.contado.total += abonado;
        break;
      case 'abono':
        this.analisisFormasPago.abono.cantidad++;
        this.analisisFormasPago.abono.total += total;
        this.analisisFormasPago.abono.montoAbonado += abonado;
        this.analisisFormasPago.abono.deudaPendiente += deuda;
        break;
      case 'cashea':
        this.analisisFormasPago.cashea.cantidad++;
        this.analisisFormasPago.cashea.total += total;
        this.analisisFormasPago.cashea.montoInicial += abonado;
        this.analisisFormasPago.cashea.deudaPendiente += deuda;
        this.analisisFormasPago.cashea.cuotasPendientes += 3;
        break;
      case 'de_contado-pendiente':
        this.analisisFormasPago.deContadoPendiente.cantidad++;
        this.analisisFormasPago.deContadoPendiente.total += total;
        this.analisisFormasPago.deContadoPendiente.deudaPendiente += deuda;
        break;
    }
  }

  private procesarVentasPendientes(trans: Transaccion): void {
    const formaPago = trans.formaPago;
    const deuda = this.obtenerDeudaPendienteAnalisis(trans);
    const tieneDeuda = deuda > 0.009 && (
      formaPago === 'de_contado-pendiente' ||
      formaPago === 'abono' ||
      formaPago === 'cashea'
    );

    if (tieneDeuda && trans.numeroVenta) {
      this.analisisVentasPendientes.push({
        numeroVenta: trans.numeroVenta,
        cliente: trans.cliente?.nombre || 'Cliente',
        total: trans.montoTotal || this.getMontoTransaccionSistema(trans),
        formaPago: formaPago === 'de_contado-pendiente' ? 'Pendiente' :
          (formaPago === 'abono' ? 'Abono' : 'Cashea'),
        deuda: deuda,
        fecha: trans.fecha
      });
    }
  }

  private obtenerDeudaPendienteAnalisis(
    trans: Transaccion,
    totalCalculado?: number,
    abonadoCalculado?: number
  ): number {
    const total = Number(totalCalculado ?? trans.montoTotal ?? this.getMontoTransaccionSistema(trans) ?? 0);
    const abonado = Number(abonadoCalculado ?? trans.montoPagado ?? this.getMontoTransaccionSistema(trans) ?? 0);
    const deudaTransaccion = Number(trans.deudaPendiente ?? NaN);
    const deudaBase = Number.isFinite(deudaTransaccion)
      ? deudaTransaccion
      : Math.max(0, total - abonado);

    return this.redondearMonto(Math.max(0, deudaBase));
  }

  getOpcionesFiltroMetodoPago(): Array<{ valor: string, label: string }> {
    const metodosPresentes = new Set<string>();

    this.transacciones.forEach((transaccion) => {
      const metodo = this.normalizarClaveMetodoPago(transaccion.metodoPago);
      if (metodo) {
        metodosPresentes.add(metodo);
      }
    });

    const opcionesSistema = this.metodosPago
      .filter((metodo) => metodosPresentes.has(this.normalizarClaveMetodoPago(metodo.valor)))
      .map((metodo) => ({
        valor: this.normalizarClaveMetodoPago(metodo.valor),
        label: this.formatearEtiquetaFiltroMetodo(metodo.valor)
      }));

    const extras = Array.from(metodosPresentes)
      .filter((metodo) => !opcionesSistema.some((opcion) => opcion.valor === metodo))
      .sort((a, b) => a.localeCompare(b))
      .map((metodo) => ({
        valor: metodo,
        label: this.formatearEtiquetaFiltroMetodo(metodo)
      }));

    return [...opcionesSistema, ...extras];
  }

  private formatearEtiquetaFiltroMetodo(metodo: string): string {
    const clave = this.normalizarClaveMetodoPago(metodo);

    if (clave === 'mixto') {
      return 'Mixto / combinado';
    }

    if (clave === 'punto') {
      return 'Punto de venta';
    }

    return this.formatearTipoPago(clave);
  }

  private obtenerUsuarioYSede(): void {
    const usuarioInicial = this.userStateService.getCurrentUser();
    if (usuarioInicial) {
      this.currentUser = usuarioInicial;
      this.transaccionForm.patchValue({
        usuario: usuarioInicial.nombre
      });
    }

    const sedeInicial = this.userStateService.getSedeActual();
    if (sedeInicial?.key) {
      this.sedeActual = sedeInicial;
      this.cargarDatosFecha();
    }

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
      const sedeCambio = sede?.key && sede?.key !== this.sedeActual?.key;
      this.sedeActual = sede;

      if (sedeCambio) {
        this.cargarDatosFecha();
      }
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

    this.transaccionForm.get('tipo')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => this.sincronizarFormularioTransaccion());

    this.transaccionForm.get('metodoPago')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => this.sincronizarFormularioTransaccion());

    this.transaccionForm.get('categoria')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => this.sincronizarFormularioTransaccion());

    this.sincronizarFormularioTransaccion();
  }

  private formatearFechaLocal(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private normalizarFechaOperativaLocal(fecha: Date | string | null | undefined): Date | null {
    if (fecha instanceof Date && !Number.isNaN(fecha.getTime())) {
      return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0, 0);
    }

    const texto = String(fecha || '').trim();
    const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
    }

    const fechaNormalizada = new Date(texto);
    if (Number.isNaN(fechaNormalizada.getTime())) {
      return null;
    }

    return new Date(fechaNormalizada.getFullYear(), fechaNormalizada.getMonth(), fechaNormalizada.getDate(), 12, 0, 0, 0);
  }

  private esMismaFechaCalendario(fechaA: Date | string, fechaB: Date | string): boolean {
    const fechaANormalizada = this.normalizarFechaOperativaLocal(fechaA);
    const fechaBNormalizada = this.normalizarFechaOperativaLocal(fechaB);

    if (!fechaANormalizada || !fechaBNormalizada) {
      return false;
    }

    return this.formatearFechaLocal(fechaANormalizada) === this.formatearFechaLocal(fechaBNormalizada);
  }

  private suscribirVentasGeneradas(): void {
    this.generarVentaService.ventaCreada$
      .pipe(takeUntil(this.destroy$))
      .subscribe((payload: any) => {
        const sedeEvento = String(payload?.sede || '').trim().toLowerCase();
        const sedeActual = String(this.sedeActual?.key || '').trim().toLowerCase();

        if (!sedeEvento || !sedeActual || sedeEvento !== sedeActual) {
          return;
        }

        if (!this.esMismaFechaCalendario(payload?.fecha || new Date(), this.fechaSeleccionada)) {
          return;
        }

        this.cargarDatosFecha();
      });
  }

  private checkMobile(): void {
    this.isMobile = window.innerWidth < 768;
  }

  cargarDatosFecha(): void {
    if (!this.sedeActual) {
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

  filtrarTransacciones(): void {
    // Si no hay transacciones, establecer array vacío
    if (!this.transacciones || this.transacciones.length === 0) {
      this.transaccionesFiltradas = [];
      return;
    }

    const filtros = this.filtroForm.value;

    this.transaccionesFiltradas = this.ordenarTransaccionesPorFechaDesc(this.transacciones.filter(trans => {
      // Filtrar por tipo
      if (filtros.tipo === 'solo_abonos' && trans.categoria !== 'abono_venta') {
        return false;
      }

      if (filtros.tipo !== 'todos' && filtros.tipo !== 'solo_abonos' && trans.tipo !== filtros.tipo) {
        return false;
      }

      // Filtrar por método de pago
      if (filtros.metodoPago !== 'todos' && this.normalizarClaveMetodoPago(trans.metodoPago) !== this.normalizarClaveMetodoPago(filtros.metodoPago)) {
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
    }));
  }

  private procesarResumenDiario(resumen: any): void {
    this.bloqueoOperativoActual = resumen?.bloqueoOperativo || null;

    // 1. Procesar ventas como transacciones
    if (resumen.ventas && Array.isArray(resumen.ventas)) {
      this.procesarVentasParaTransacciones(resumen.ventas);
    } else {
      console.warn('⚠️ No hay ventas en el resumen');
      this.transacciones = [];
    }

    if (resumen.abonosDelDia && Array.isArray(resumen.abonosDelDia) && resumen.abonosDelDia.length) {
      this.agregarAbonosDelDiaComoTransacciones(resumen.abonosDelDia);
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

    if (resumen.transaccionesManuales && Array.isArray(resumen.transaccionesManuales) && resumen.transaccionesManuales.length) {
      this.transacciones = this.ordenarTransaccionesPorFechaDesc([...this.transacciones, ...resumen.transaccionesManuales]);
      this.calcularAnalisisDesdeTransacciones();
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
    const prefijos = ['puntoReal_', 'transferenciaReal_', 'pagomovilReal_', 'zelleReal_'];

    prefijos.forEach(prefijo => {
      const keys = Object.keys(this.cierreForm.controls).filter(key => key.startsWith(prefijo));
      keys.forEach(key => {
        this.cierreForm.removeControl(key);
      });
    });
  }

  private agregarControlesBancos(): void {
    (['punto', 'transferencia', 'pagomovil', 'zelle'] as const).forEach((tipo) => {
      this.getDestinosMetodo(tipo).forEach((destino) => {
        const controlName = this.getNombreControlMetodo(tipo, destino);
        if (!this.cierreForm.contains(controlName)) {
          this.cierreForm.addControl(controlName, this.fb.control(null, [Validators.required, Validators.min(0)]));
        }
      });
    });

    this.configurarValidadoresFormularioCierre();
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
        const controlName = this.getNombreControlMetodo('punto', item);
        if (this.cierreForm.contains(controlName)) {
          this.cierreForm.get(controlName)?.setValue(item.montoReal || 0);
        }
      });
    }

    // Cargar transferencias por banco
    const transferenciasReales = Array.isArray(real.transferencia)
      ? real.transferencia
      : Array.isArray(real.transferencia?.porBanco)
        ? real.transferencia.porBanco
        : [];
    if (transferenciasReales.length) {
      transferenciasReales.forEach((item: any) => {
        const controlName = this.getNombreControlMetodo('transferencia', item);
        if (this.cierreForm.contains(controlName)) {
          this.cierreForm.get(controlName)?.setValue(item.montoReal || 0);
        }
      });
    } else if ((real as any).transferencia !== undefined && !Array.isArray(real.transferencia)) {
      this.cierreForm.patchValue({ transferenciaRealTotal: (real as any).transferencia || 0 });
    }

    // Cargar pago móvil por banco
    const pagosMovilesReales = Array.isArray(real.pagomovil)
      ? real.pagomovil
      : Array.isArray(real.pagomovil?.porBanco)
        ? real.pagomovil.porBanco
        : [];
    if (pagosMovilesReales.length) {
      pagosMovilesReales.forEach((item: any) => {
        const controlName = this.getNombreControlMetodo('pagomovil', item);
        if (this.cierreForm.contains(controlName)) {
          this.cierreForm.get(controlName)?.setValue(item.montoReal || 0);
        }
      });
    } else if ((real as any).pagomovil !== undefined && !Array.isArray(real.pagomovil)) {
      this.cierreForm.patchValue({ pagomovilRealTotal: (real as any).pagomovil || 0 });
    }

    // Cargar Zelle
    const zelleReal = Array.isArray(real.zelle) ? real.zelle : [];
    if (zelleReal.length) {
      zelleReal.forEach((item: any) => {
        const controlName = this.getNombreControlMetodo('zelle', item);
        if (this.cierreForm.contains(controlName)) {
          this.cierreForm.get(controlName)?.setValue(item.montoReal || 0);
        }
      });
    } else if (real.zelle !== undefined) {
      this.cierreForm.patchValue({ zelleReal: real.zelle });
    }

    // Cargar notas de cierre
    if (real.notasCierre) {
      this.cierreForm.patchValue({ notasCierre: real.notasCierre });
    }

    this.configurarValidadoresFormularioCierre();

  }

  private construirDetalleMetodoPagoNormalizado(
    metodo: any,
    monedaVenta: string,
    tasasHistoricas: Array<{ moneda: string; tasa: number; valor?: number }>
  ): TransaccionDetalleMetodoPago {
    return {
      tipo: metodo?.tipo,
      monto: Number(metodo?.monto || 0),
      moneda: metodo?.moneda || monedaVenta || 'USD',
      montoEnBolivar: metodo?.montoEnBolivar,
      montoEnMonedaVenta: Number(
        metodo?.montoEnMonedaVenta ??
        this.convertirMontoConTasas(Number(metodo?.monto || 0), metodo?.moneda || monedaVenta || 'USD', monedaVenta, tasasHistoricas)
      ),
      montoEnMonedaSistema: Number(
        metodo?.montoEnMonedaSistema ??
        metodo?.montoMonedaSistema ??
        this.convertirMontoConTasas(Number(metodo?.monto || 0), metodo?.moneda || monedaVenta || 'USD', this.monedaSistema, tasasHistoricas)
      ),
      tasaUsada: metodo?.tasaUsada,
      referencia: metodo?.referencia,
      banco: metodo?.bancoNombre || metodo?.banco,
      bancoNombre: metodo?.bancoNombre,
      bancoCodigo: metodo?.bancoCodigo,
      bancoReceptorCodigo: metodo?.bancoReceptorCodigo || metodo?.cuentaReceptora?.bancoCodigo,
      bancoReceptorNombre: metodo?.bancoReceptorNombre || metodo?.cuentaReceptora?.bancoNombre,
      bancoReceptor: metodo?.bancoReceptor || metodo?.cuentaReceptora?.descripcionCuenta || metodo?.cuentaReceptora?.bancoNombre,
      cuentaReceptoraId: metodo?.cuentaReceptoraId || metodo?.cuentaReceptora?.id,
      cuentaReceptoraAlias: metodo?.cuentaReceptoraAlias || metodo?.cuentaReceptora?.alias,
      cuentaReceptoraUltimos4: metodo?.cuentaReceptoraUltimos4 || metodo?.cuentaReceptora?.ultimos4,
      cuentaReceptoraEmail: metodo?.cuentaReceptoraEmail || metodo?.cuentaReceptora?.correo || metodo?.cuentaReceptora?.email,
      cuentaReceptoraTitular: metodo?.cuentaReceptoraTitular || metodo?.cuentaReceptora?.titular || metodo?.cuentaReceptora?.ownerName,
      cuentaReceptoraDocumento: metodo?.cuentaReceptoraDocumento || metodo?.cuentaReceptora?.cedulaRif || metodo?.cuentaReceptora?.ownerId,
      cuentaReceptoraTelefono: metodo?.cuentaReceptoraTelefono || metodo?.cuentaReceptora?.telefono || metodo?.cuentaReceptora?.phone,
      cuentaReceptoraDescripcion: metodo?.cuentaReceptoraDescripcion || metodo?.cuentaReceptora?.descripcionCuenta
    };
  }

  private obtenerMontoCobroEnMonedaVenta(
    metodosDePago: TransaccionDetalleMetodoPago[],
    monedaVenta: string,
    montoFallback: number,
    tasasHistoricas: Array<{ moneda: string; tasa: number; valor?: number }>
  ): number {
    if (metodosDePago.length) {
      return this.redondearMonto(
        metodosDePago.reduce((sum, metodo) => (
          sum + Number(
            metodo.montoEnMonedaVenta ??
            this.convertirMontoConTasas(Number(metodo.monto || 0), metodo.moneda || monedaVenta, monedaVenta, tasasHistoricas)
          )
        ), 0)
      );
    }

    return this.redondearMonto(Number(montoFallback || 0));
  }

  private obtenerMontoCobroEnMonedaSistema(
    metodosDePago: TransaccionDetalleMetodoPago[],
    monedaVenta: string,
    montoFallback: number,
    tasasHistoricas: Array<{ moneda: string; tasa: number; valor?: number }>
  ): number {
    if (metodosDePago.length) {
      return this.redondearMonto(
        metodosDePago.reduce((sum, metodo) => (
          sum + Number(
            metodo.montoEnMonedaSistema ??
            this.convertirMontoConTasas(Number(metodo.monto || 0), metodo.moneda || monedaVenta, this.monedaSistema, tasasHistoricas)
          )
        ), 0)
      );
    }

    return this.redondearMonto(
      this.convertirMontoConTasas(Number(montoFallback || 0), monedaVenta, this.monedaSistema, tasasHistoricas)
    );
  }

  private construirCobrosDelDiaVenta(
    venta: any,
    monedaVenta: string,
    tasasHistoricas: Array<{ moneda: string; tasa: number; valor?: number }>
  ): TransaccionCobroDia[] {
    const cobrosDelDia: TransaccionCobroDia[] = [];
    const metodosVenta = Array.isArray(venta?.metodosDePago) ? venta.metodosDePago : [];
    const detallePagoInicial = metodosVenta.map((metodo: any) => this.construirDetalleMetodoPagoNormalizado(metodo, monedaVenta, tasasHistoricas));
    const montoPagoInicial = this.obtenerMontoCobroEnMonedaVenta(
      detallePagoInicial,
      monedaVenta,
      Number(venta?.total_pagado ?? 0),
      tasasHistoricas
    );
    const montoPagoInicialSistema = this.obtenerMontoCobroEnMonedaSistema(
      detallePagoInicial,
      monedaVenta,
      Number(venta?.total_pagado ?? 0),
      tasasHistoricas
    );

    if (detallePagoInicial.length && montoPagoInicialSistema > 0) {
      cobrosDelDia.push({
        id: `${venta?.key || venta?.numero_venta || Date.now()}-pago-inicial`,
        tipo: 'pago_inicial',
        etiqueta: 'Pago inicial',
        fecha: venta?.fecha ? new Date(venta.fecha) : new Date(),
        monto: montoPagoInicial,
        montoSistema: montoPagoInicialSistema,
        deudaPendiente: Math.max(0, Number(venta?.total || 0) - montoPagoInicial),
        observaciones: 'Cobro registrado al momento de generar la venta.',
        metodosDePago: detallePagoInicial
      });
    }

    const abonosDelDia = Array.isArray(venta?.formaPagoDetalle?.abonos)
      ? venta.formaPagoDetalle.abonos.filter((abono: any) => this.esMismaFechaCalendario(abono?.fecha || venta?.fecha, this.fechaSeleccionada))
      : [];

    abonosDelDia.forEach((abono: any) => {
      const detalleMetodosAbono = (Array.isArray(abono?.metodosDePago) ? abono.metodosDePago : [])
        .map((metodo: any) => this.construirDetalleMetodoPagoNormalizado(metodo, monedaVenta, tasasHistoricas));
      const montoAbono = this.obtenerMontoCobroEnMonedaVenta(
        detalleMetodosAbono,
        monedaVenta,
        Number(abono?.montoAbonado || 0),
        tasasHistoricas
      );
      const montoAbonoSistema = this.obtenerMontoCobroEnMonedaSistema(
        detalleMetodosAbono,
        monedaVenta,
        Number(abono?.montoAbonado || 0),
        tasasHistoricas
      );

      cobrosDelDia.push({
        id: `${venta?.key || venta?.numero_venta || Date.now()}-abono-${abono?.numero || cobrosDelDia.length + 1}`,
        tipo: 'abono',
        etiqueta: `Abono #${abono?.numero || cobrosDelDia.length}`,
        fecha: abono?.fecha ? new Date(abono.fecha) : (venta?.fecha ? new Date(venta.fecha) : new Date()),
        monto: montoAbono,
        montoSistema: montoAbonoSistema,
        deudaPendiente: Number(abono?.deudaPendiente || 0),
        observaciones: abono?.observaciones || '',
        metodosDePago: detalleMetodosAbono
      });
    });

    return cobrosDelDia;
  }

  private procesarVentasParaTransacciones(ventas: any[]): void {
    this.transacciones = [];
    this.detalleVentaExpandidaId = null;

    ventas.forEach(venta => {
      const tasasHistoricas = venta.formaPagoDetalle?.tasasActuales || venta.formaPago?.tasasActuales || [];
      const monedaVenta = venta.moneda || 'USD';
      const totalOriginal = Number(venta.total || 0);
      const totalSistema = this.convertirMontoConTasas(totalOriginal, monedaVenta, this.monedaSistema, tasasHistoricas);

      // Extraer información de consulta si existe
      const tieneConsulta = venta.consulta && (venta.consulta.pagoMedico > 0 || venta.consulta.pagoOptica > 0);
      const tieneProductos = venta.productos && venta.productos.length > 0;

      const cobrosDelDia = this.construirCobrosDelDiaVenta(venta, monedaVenta, tasasHistoricas);
      const detalleMetodos = cobrosDelDia.flatMap((cobro) => cobro.metodosDePago || []);
      const pagadoOriginal = cobrosDelDia.length
        ? this.redondearMonto(cobrosDelDia.reduce((sum, cobro) => sum + Number(cobro.monto || 0), 0))
        : Number(venta.formaPagoDetalle?.totalPagado ?? venta.total_pagado ?? 0);
      const pagadoSistema = cobrosDelDia.length
        ? this.redondearMonto(cobrosDelDia.reduce((sum, cobro) => sum + Number(cobro.montoSistema || 0), 0))
        : this.convertirMontoConTasas(pagadoOriginal, monedaVenta, this.monedaSistema, tasasHistoricas);
      const deudaOriginal = Math.max(0, totalOriginal - pagadoOriginal);
      const deudaSistema = Math.max(0, totalSistema - pagadoSistema);

      const transaccionVenta: Transaccion = {
        id: venta.key || `VENTA-${venta.numero_venta}`,
        tipo: 'venta',
        descripcion: `Venta #${venta.numero_venta} - ${venta.cliente?.informacion?.nombreCompleto || 'Cliente'}`,
        monto: pagadoSistema,
        montoSistema: pagadoSistema,
        montoOriginal: pagadoOriginal || totalOriginal,
        montoTotal: totalSistema,
        montoPagado: pagadoSistema,
        deudaPendiente: deudaSistema,
        fecha: new Date(venta.fecha),
        metodoPago: this.determinarMetodoPagoPrincipal(detalleMetodos),
        moneda: this.obtenerCodigoMoneda(venta.moneda),
        monedaOriginal: this.obtenerCodigoMoneda(venta.moneda),
        tasasHistoricas: tasasHistoricas,
        usuario: venta.asesor?.nombre || venta.auditoria?.usuarioCreacion?.nombre || 'Usuario',
        estado: 'confirmado',
        estatusPago: deudaOriginal > 0.009 ? 'pendiente' : 'completado',
        categoria: 'venta',
        numeroVenta: venta.numero_venta,
        cobrosDelDia,
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
        tieneProductos: tieneProductos,
        tipoVenta: venta.tipoVenta,
        consulta: venta.consulta
      };

      this.transacciones.push(transaccionVenta);
    });

    this.transacciones = this.ordenarTransaccionesPorFechaDesc(this.transacciones);

    // Recalcular análisis cada vez que cambian las transacciones
    this.calcularAnalisisDesdeTransacciones();
  }

  private agregarAbonosDelDiaComoTransacciones(abonosDelDia: any[]): void {
    const transaccionesAbono = abonosDelDia.map((abono) => {
      const tasasHistoricas = Array.isArray(abono?.tasasHistoricas) ? abono.tasasHistoricas : [];
      const monedaAbono = abono?.moneda || 'USD';
      const montoAbonadoOriginal = Number(abono?.montoAbonado || 0);
      const montoAbonadoSistema = this.convertirMontoConTasas(montoAbonadoOriginal, monedaAbono, this.monedaSistema, tasasHistoricas);
      const deudaPendienteSistema = this.convertirMontoConTasas(Number(abono?.deudaPendiente || 0), monedaAbono, this.monedaSistema, tasasHistoricas);
      const detalleMetodos = (Array.isArray(abono?.metodosDePago) ? abono.metodosDePago : []).map((m: any) => ({
        tipo: m.tipo,
        monto: Number(m.monto || 0),
        moneda: m.moneda || monedaAbono,
        montoEnBolivar: m.montoEnBolivar,
        montoEnMonedaVenta: m.montoEnMonedaVenta,
        montoEnMonedaSistema: Number(m.montoEnMonedaSistema ?? this.convertirMontoConTasas(Number(m.monto || 0), m.moneda || monedaAbono, this.monedaSistema, tasasHistoricas)),
        tasaUsada: m.tasaUsada,
        referencia: m.referencia,
        banco: m.bancoNombre || m.banco,
        bancoNombre: m.bancoNombre,
        bancoCodigo: m.bancoCodigo,
        bancoReceptorCodigo: m.bancoReceptorCodigo,
        bancoReceptorNombre: m.bancoReceptorNombre,
        bancoReceptor: m.bancoReceptor,
        cuentaReceptoraId: m.cuentaReceptoraId,
        cuentaReceptoraAlias: m.cuentaReceptoraAlias,
        cuentaReceptoraUltimos4: m.cuentaReceptoraUltimos4,
        cuentaReceptoraEmail: m.cuentaReceptoraEmail,
        cuentaReceptoraTitular: m.cuentaReceptoraTitular,
        cuentaReceptoraDocumento: m.cuentaReceptoraDocumento,
        cuentaReceptoraTelefono: m.cuentaReceptoraTelefono,
        cuentaReceptoraDescripcion: m.cuentaReceptoraDescripcion
      }));
      const nombreCliente = abono?.cliente?.informacion?.nombreCompleto || abono?.cliente?.nombre || 'Cliente';

      return {
        id: abono?.id || `ABONO-${abono?.numeroVenta || Date.now()}`,
        tipo: 'ingreso',
        descripcion: `Abono recibido hoy - Venta #${abono?.numeroVenta || 'N/A'} - ${nombreCliente}`,
        monto: montoAbonadoSistema,
        montoSistema: montoAbonadoSistema,
        montoOriginal: montoAbonadoOriginal,
        montoTotal: montoAbonadoSistema,
        montoPagado: montoAbonadoSistema,
        deudaPendiente: deudaPendienteSistema,
        fecha: abono?.fecha ? new Date(abono.fecha) : new Date(),
        metodoPago: this.determinarMetodoPagoPrincipal(detalleMetodos),
        moneda: this.obtenerCodigoMoneda(monedaAbono),
        monedaOriginal: this.obtenerCodigoMoneda(monedaAbono),
        tasasHistoricas,
        usuario: abono?.usuario || abono?.asesor?.nombre || 'Usuario',
        estado: 'confirmado',
        estatusPago: deudaPendienteSistema > 0 ? 'pendiente' : 'completado',
        categoria: 'abono_venta',
        numeroVenta: abono?.numeroVenta || '',
        cliente: {
          nombre: nombreCliente,
          cedula: abono?.cliente?.informacion?.cedula || abono?.cliente?.cedula || '',
          telefono: abono?.cliente?.informacion?.telefono || abono?.cliente?.telefono || '',
          email: abono?.cliente?.informacion?.email || abono?.cliente?.email || ''
        },
        formaPago: abono?.formaPago === 'cashea' ? 'cashea' : abono?.formaPago === 'de_contado-pendiente' ? 'de_contado-pendiente' : 'abono',
        detalleMetodosPago: detalleMetodos,
        asesor: abono?.asesor?.nombre,
        sede: abono?.sede,
        tipoVenta: abono?.tipoVenta
      } as Transaccion;
    });

    const mapa = new Map<string, Transaccion>();
    [...this.transacciones, ...transaccionesAbono].forEach((transaccion) => {
      mapa.set(transaccion.id, transaccion);
    });

    this.transacciones = this.ordenarTransaccionesPorFechaDesc(Array.from(mapa.values()));
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
      .reduce((sum, t) => sum + this.getMontoTransaccionSistema(t), 0);

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
      this.cierreActual.totales.ventasPendientes = this.getDeudaTotalDelDia();
    }

    this.ultimaActualizacion = new Date();
  }

  private determinarMetodoPagoPrincipal(metodosDePago: any[]): string {
    if (!metodosDePago || metodosDePago.length === 0) {
      return 'pendiente';
    }

    const tiposUnicos = Array.from(new Set(
      metodosDePago
        .map((metodo) => this.normalizarClaveMetodoPago(String(metodo?.tipo || '')))
        .filter(Boolean)
    ));

    if (tiposUnicos.length > 1) {
      return 'mixto';
    }

    return tiposUnicos[0] || 'pendiente';
  }

  getTotalMetodoPago(metodo: string): number {
    let total = 0;
    this.transacciones.forEach(transaccion => {
      const factor = transaccion.tipo === 'egreso' ? -1 : 1;
      if (transaccion.tipo === 'venta' || transaccion.tipo === 'ingreso' || transaccion.tipo === 'egreso') {
        if (transaccion.metodoPago === metodo && (!transaccion.detalleMetodosPago || transaccion.detalleMetodosPago.length === 0)) {
          total += this.getMontoTransaccionSistema(transaccion) * factor;
        } else if (transaccion.detalleMetodosPago && transaccion.detalleMetodosPago.length > 0) {
          transaccion.detalleMetodosPago.forEach((m: any) => {
            if (m.tipo === metodo) {
              total += this.getMontoMetodoPagoSistema(m, transaccion) * factor;
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
        datos.total += this.getMontoTransaccionSistema(transaccion);
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
    if (this.tieneBloqueoPorCierrePendienteAnterior()) {
      this.mostrarAvisoCierrePendienteAnterior();
      return;
    }

    if (this.inicioCajaForm.invalid || !this.sedeActual || !this.currentUser) return;

    const formValue = this.inicioCajaForm.value;
    const efectivoInicialDetalle = this.obtenerDetalleEfectivoInicialFormulario();
    const { Bs: bs, USD: usd, EUR: eur } = efectivoInicialDetalle;
    const totalEfectivoInicial = this.calcularTotalEfectivoInicialDesdeDetalle(efectivoInicialDetalle);
    const descripcionApertura = (formValue.observaciones || '').trim();

    this.guardandoCierre = true;

    this.cierreCajaService.abrirCaja({
      fecha: this.fechaSeleccionada,
      sede: this.sedeActual.key,
      efectivoInicial: {
        totalSistema: totalEfectivoInicial,
        detalle: efectivoInicialDetalle
      },
      tasasCambio: this.tasasCambio,
      observaciones: descripcionApertura
    }).subscribe({
      next: () => {
        this.guardandoCierre = false;
        this.cerrarModal('inicioCajaModal');
        this.cargarDatosFecha();

        const mensajeDetalle = `Total en ${this.simboloMonedaSistema}: ${totalEfectivoInicial.toFixed(2)} | Bs. ${bs} | USD $${usd} | EUR €${eur}`;
        this.swalService.showSuccess('Caja iniciada', `Caja iniciada con: ${mensajeDetalle}`);
      },
      error: (error) => {
        this.guardandoCierre = false;
        console.error('Error al iniciar caja:', error);
        this.swalService.showError('Error', error?.error?.message || 'No se pudo iniciar la caja.');
      }
    });
  }

  guardarTransaccion(): void {
    if (this.transaccionForm.invalid) return;

    if (!this.cierreActual || this.cierreActual.estado !== 'abierto') {
      this.swalService.showWarning('Caja cerrada', 'Debes tener una caja abierta para registrar transacciones manuales.');
      return;
    }

    const formValue = this.transaccionForm.value;
    const monto = parseFloat(formValue.monto);
    const nuevaTransaccion: Transaccion = {
      id: this.transaccionEditando?.id || `TRX-${Date.now()}`,
      tipo: formValue.tipo,
      descripcion: formValue.descripcion,
      monto: monto,
      montoOriginal: monto,
      montoSistema: this.redondearMonto(monto),
      fecha: new Date(),
      metodoPago: this.normalizarClaveMetodoPago(formValue.metodoPago),
      moneda: this.obtenerCodigoMoneda(this.monedaSistema),
      monedaOriginal: this.obtenerCodigoMoneda(this.monedaSistema),
      usuario: this.currentUser?.nombre || 'Usuario',
      estado: 'confirmado',
      categoria: formValue.categoria,
      observaciones: formValue.observaciones,
      comprobante: formValue.comprobante,
      detalleMetodosPago: this.construirDetalleMetodoPagoManual(monto)
    };

    if (this.transaccionEditando) {
      this.cierreCajaService.actualizarTransaccionManual(this.transaccionEditando.id, nuevaTransaccion).subscribe({
        next: () => {
          this.cerrarModal('transaccionModal');
          this.transaccionEditando = null;
          this.cargarDatosFecha();
          this.swalService.showSuccess('Transacción guardada', 'La transacción se ha actualizado correctamente.');
        },
        error: (error) => {
          console.error('Error al actualizar transacción:', error);
          this.swalService.showError('Error', error?.error?.message || 'No se pudo actualizar la transacción.');
        }
      });
    } else {
      this.cierreCajaService.crearTransaccionManual(this.cierreActual.id, nuevaTransaccion).subscribe({
        next: () => {
          this.cerrarModal('transaccionModal');
          this.transaccionEditando = null;
          this.cargarDatosFecha();
          this.swalService.showSuccess('Transacción guardada', 'La transacción se ha registrado correctamente.');
        },
        error: (error) => {
          console.error('Error al crear transacción:', error);
          this.swalService.showError('Error', error?.error?.message || 'No se pudo registrar la transacción.');
        }
      });
    }
  }

  guardarCierre(): void {
    if (!this.usaModoDummy) {
      this.cargarDatosFecha();
      this.swalService.showInfo('Sincronizado', 'Las transacciones manuales se guardan al registrarlas. El cierre final se persiste al cerrar la caja.');
      return;
    }

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

      const formValue = this.cierreForm.getRawValue();
      const payload = {
        cierreId: this.cierreActual.id,
        fecha: this.datePipe.transform(this.fechaSeleccionada, 'yyyy-MM-dd'),
        efectivo: {
          teoricoFinal: this.getEfectivoFinalTeorico(),
          realFinal: this.getEfectivoRealTotal(),
          diferencia: this.getDiferenciaEfectivo(),
          detalleReal: {
            usd: Number(formValue.efectivoRealUSD || 0),
            eur: Number(formValue.efectivoRealEUR || 0),
            ves: Number(formValue.efectivoRealVES || 0)
          }
        },
        conciliacion: {
          punto: this.construirDetalleMetodoReal('punto'),
          transferencia: this.construirDetalleMetodoReal('transferencia'),
          pagomovil: this.construirDetalleMetodoReal('pagomovil'),
          zelle: this.construirDetalleMetodoReal('zelle')
        },
        diferenciaTotal: this.getDiferenciaTotal(),
        estadoConciliacion: Math.abs(this.getDiferenciaTotal()) > 0.01 ? 'diferencia' : 'cuadrado',
        notasCierre: formValue.notasCierre || '',
        opciones: {
          imprimirResumen: !!formValue.imprimirResumen,
          enviarEmail: !!formValue.enviarEmail,
          adjuntarComprobantes: !!formValue.adjuntarComprobantes
        }
      };

      this.cierreCajaService.cerrarCaja(payload).subscribe({
        next: () => {
          this.guardandoCierre = false;
          this.cargarDatosFecha();
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
        datos.total += this.getMontoTransaccionSistema(transaccion);
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

  esAbonoEnHistorial(transaccion: Transaccion): boolean {
    return transaccion.categoria === 'abono_venta';
  }

  getEtiquetaHistorialTransaccion(transaccion: Transaccion): string {
    if (this.esAbonoEnHistorial(transaccion)) {
      return 'Abono del dia';
    }

    if (transaccion.tipo === 'venta') {
      return 'Venta del dia';
    }

    if (transaccion.tipo === 'ingreso') {
      return 'Ingreso manual';
    }

    if (transaccion.tipo === 'egreso') {
      return 'Egreso manual';
    }

    return 'Ajuste';
  }

  getIconoHistorialTransaccion(transaccion: Transaccion): string {
    if (this.esAbonoEnHistorial(transaccion)) {
      return 'bi-calendar-check';
    }

    if (transaccion.tipo === 'venta') {
      return 'bi-cart-check';
    }

    if (transaccion.tipo === 'ingreso') {
      return 'bi-plus-circle';
    }

    if (transaccion.tipo === 'egreso') {
      return 'bi-dash-circle';
    }

    return 'bi-arrow-left-right';
  }

  getColorHistorialTransaccion(transaccion: Transaccion): string {
    if (this.esAbonoEnHistorial(transaccion)) {
      return '#0f766e';
    }

    return this.getColorTipoTransaccion(transaccion.tipo);
  }

  getDescripcionHistorialTransaccion(transaccion: Transaccion): string {
    if (this.esAbonoEnHistorial(transaccion)) {
      return 'Cobro aplicado a una venta de una fecha anterior';
    }

    if (transaccion.tipo === 'venta') {
      return '';
    }

    return transaccion.descripcion;
  }

  getTituloHistorialTransaccion(transaccion: Transaccion): string {
    if (transaccion.cliente?.nombre) {
      return transaccion.cliente.nombre;
    }

    return this.getDescripcionHistorialTransaccion(transaccion);
  }

  private getEtiquetaFormaPagoTransaccion(transaccion: Transaccion): string {
    if (!transaccion.numeroVenta) {
      return '';
    }

    if (transaccion.formaPago === 'de_contado-pendiente') {
      return 'De contado pendiente por pago';
    }

    if (transaccion.formaPago === 'abono') {
      return 'Abono';
    }

    if (transaccion.formaPago === 'cashea') {
      return 'Cashea';
    }

    if (transaccion.formaPago === 'contado') {
      return 'Contado';
    }

    return 'Forma no definida';
  }

  getTextoFormaPagoHistorial(transaccion: Transaccion): string {
    return this.getEtiquetaFormaPagoTransaccion(transaccion);
  }

  getTextoFormaPagoMetodoHistorial(transaccion: Transaccion): string {
    const formaPago = this.getEtiquetaFormaPagoTransaccion(transaccion);
    const metodo = this.formatearTipoPago(transaccion.metodoPago || '');

    if (formaPago && metodo) {
      return `${formaPago} / ${metodo}`;
    }

    return formaPago || metodo || 'Sin método identificado';
  }

  getTextoEstadoPagoHistorial(transaccion: Transaccion): string {
    if (!transaccion.numeroVenta) {
      return '';
    }

    const estado = String(transaccion.estatusPago || '').trim().toLowerCase();
    const deudaPendiente = Number(transaccion.deudaPendiente || 0);

    if (estado === 'completado' || estado === 'pagado' || deudaPendiente <= 0.009) {
      return 'Pago completo';
    }

    if (estado === 'pendiente' || estado === 'por_pagar' || deudaPendiente > 0) {
      return 'Pendiente por pago';
    }

    return 'Estado de pago';
  }

  getColorEstadoPagoHistorial(transaccion: Transaccion): string {
    return this.getTextoEstadoPagoHistorial(transaccion) === 'Pago completo' ? '#15803d' : '#b45309';
  }

  getIconoEstadoPagoHistorial(transaccion: Transaccion): string {
    return this.getTextoEstadoPagoHistorial(transaccion) === 'Pago completo' ? 'bi-check-circle' : 'bi-hourglass-split';
  }

  getDetalleAbonoHistorial(transaccion: Transaccion): string {
    if (!this.esAbonoEnHistorial(transaccion)) {
      return '';
    }

    const saldo = Number(transaccion.deudaPendiente || 0);
    return `Saldo pendiente luego del abono: ${this.decimalPipe.transform(saldo, '1.2-2') || '0.00'} ${this.simboloMonedaSistema}`;
  }

  puedeExpandirCobrosVenta(transaccion: Transaccion): boolean {
    return transaccion.tipo === 'venta' && Boolean(transaccion.cobrosDelDia?.some((cobro) => cobro.tipo === 'abono'));
  }

  toggleDetalleCobrosVenta(transaccion: Transaccion, event?: Event): void {
    event?.stopPropagation();

    if (!this.puedeExpandirCobrosVenta(transaccion)) {
      return;
    }

    this.detalleVentaExpandidaId = this.detalleVentaExpandidaId === transaccion.id ? null : transaccion.id;
  }

  esDetalleCobrosVentaExpandido(transaccion: Transaccion): boolean {
    return this.detalleVentaExpandidaId === transaccion.id;
  }

  getCantidadAbonosCobroDia(transaccion: Transaccion): number {
    return transaccion.cobrosDelDia?.filter((cobro) => cobro.tipo === 'abono').length || 0;
  }

  getTextoResumenMetodosCobro(cobro: TransaccionCobroDia): string {
    const metodosUnicos = Array.from(new Set((cobro.metodosDePago || []).map((metodo) => this.formatearTipoPago(metodo.tipo))));
    return metodosUnicos.join(' + ') || 'Sin método identificado';
  }

  getMontoCobroDiaSistema(cobro: TransaccionCobroDia): number {
    return Number(cobro.montoSistema ?? cobro.monto ?? 0);
  }

  formatearTipoPago(tipo: string): string {
    const metodoConfigurado = this.metodosPago.find((metodo) => metodo.valor === this.normalizarClaveMetodoPago(tipo));
    if (metodoConfigurado) {
      return metodoConfigurado.label;
    }

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

  private normalizarEstadoVisual(estado: string, fecha?: Date | string): string {
    const estadoNormalizado = String(estado || '').trim().toLowerCase();
    const fechaReferencia = fecha || this.fechaSeleccionada;

    if (['abierto', 'revisado'].includes(estadoNormalizado) && fechaReferencia && !this.esMismaFechaCalendario(fechaReferencia, new Date())) {
      return 'pendiente-cierre';
    }

    return estadoNormalizado;
  }

  esCierrePendienteVisual(cierre: { estado?: string; fecha?: Date | string } | null | undefined): boolean {
    if (!cierre) {
      return false;
    }

    return this.normalizarEstadoVisual(cierre.estado || '', cierre.fecha) === 'pendiente-cierre';
  }

  getEstadoClass(estado: string, fecha?: Date | string): string {
    const estadoVisual = this.normalizarEstadoVisual(estado, fecha);
    const clases: { [key: string]: string } = {
      abierto: 'estado-abierto',
      cerrado: 'estado-cerrado',
      revisado: 'estado-revisado',
      conciliado: 'estado-conciliado',
      'pendiente-cierre': 'estado-pendiente-cierre',
      'sin-iniciar': 'estado-sin-iniciar',
      'sin-cierre': 'estado-sin-cierre'
    };
    return clases[estadoVisual] || 'estado-default';
  }

  getEstadoTexto(estado: string, fecha?: Date | string): string {
    const estadoVisual = this.normalizarEstadoVisual(estado, fecha);
    const estados: { [key: string]: string } = {
      abierto: 'Caja Abierta',
      cerrado: 'Caja Cerrada',
      revisado: 'Revisado',
      conciliado: 'Conciliado',
      'pendiente-cierre': 'Pendiente por cerrar'
    };
    return estados[estadoVisual] || 'Sin estado';
  }

  getEstadoIconClass(estado: string, fecha?: Date | string): string {
    const estadoVisual = this.normalizarEstadoVisual(estado, fecha);
    const iconos: { [key: string]: string } = {
      abierto: 'bi-play-circle-fill',
      cerrado: 'bi-lock-fill',
      revisado: 'bi-check-circle-fill',
      conciliado: 'bi-arrow-repeat',
      'pendiente-cierre': 'bi-exclamation-triangle-fill'
    };

    return iconos[estadoVisual] || 'bi-circle-fill';
  }

  getTextoReferenciaFecha(): string {
    const fechaTexto = this.datePipe.transform(this.fechaSeleccionada, 'dd/MM/yyyy');
    if (!fechaTexto) {
      return '';
    }

    return this.esCierrePendienteVisual(this.cierreActual)
      ? `Caja pendiente del ${fechaTexto}`
      : `Cierre del ${fechaTexto}`;
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
    this.abrirVentanaReporte(true);
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

  refrescarTransaccionesDia(): void {
    if (this.cargandoDatos) {
      return;
    }

    this.cargarDatosFecha();
  }

  cargarHistorialCierres(): void {
    this.mostrarMenuExportHistorial = false;

    if (!this.filtroHistorialDesde || !this.filtroHistorialHasta) {
      this.establecerRangoHistorialSemanaActual();
    }

    const fechaDesde = new Date(`${this.filtroHistorialDesde}T00:00:00`);
    const fechaHasta = new Date(`${this.filtroHistorialHasta}T23:59:59.999`);

    if (Number.isNaN(fechaDesde.getTime()) || Number.isNaN(fechaHasta.getTime())) {
      this.swalService.showWarning('Rango inválido', 'Selecciona un rango de fechas válido para consultar el historial.');
      return;
    }

    this.historialCargando = true;

    this.cierreCajaService.obtenerHistorialCierres(fechaDesde, fechaHasta, this.sedeActual?.key || 'guatire')
      .subscribe({
        next: (cierres) => {
          const cierresOrdenados = [...(cierres || [])]
            .filter((cierre) => String(cierre?.estado || '').trim().toLowerCase() !== 'abierto')
            .sort((a, b) => {
            const fechaA = new Date(a.fechaCierre || a.fecha || 0).getTime();
            const fechaB = new Date(b.fechaCierre || b.fecha || 0).getTime();
            return fechaB - fechaA;
          });

          this.historialCierres = cierresOrdenados;

          if (!cierresOrdenados.length) {
            this.historialDashboardData.clear();
            this.historialCargando = false;
            return;
          }

          this.enriquecerHistorialConDashboard(cierresOrdenados);
        },
        error: (error) => {
          console.error('Error al cargar historial:', error);
          this.historialCargando = false;
          this.swalService.showError('Error', 'No se pudo cargar el historial de cierres');
        }
      });
  }

  private getHistorialDashboardKey(cierre: CierreDiario): string {
    return String(cierre?.id || `${this.datePipe.transform(cierre?.fecha, 'yyyy-MM-dd') || 'sin-fecha'}-${cierre?.sede || 'sin-sede'}`);
  }

  private getDashboardHistorialData(cierre: CierreDiario): HistorialDashboardData | null {
    return this.historialDashboardData.get(this.getHistorialDashboardKey(cierre)) || null;
  }

  getDesgloseDiferenciasActual(): Array<{ clave: string; label: string; valor: number }> {
    return [
      { clave: 'efectivo', label: 'Efectivo', valor: this.getDiferenciaEfectivo() },
      { clave: 'punto', label: 'Punto de venta', valor: this.getDiferenciaPunto() },
      { clave: 'transferencia', label: 'Transferencia', valor: this.getDiferenciaTransferencia() },
      { clave: 'pagomovil', label: 'Pago móvil', valor: this.getDiferenciaPagomovil() },
      { clave: 'zelle', label: 'Zelle', valor: this.getDiferenciaZelle() }
    ].filter((item) => Math.abs(item.valor) > 0.01);
  }

  getDesgloseDiferenciasHistorial(cierre: CierreDiario): Array<{ clave: string; label: string; valor: number }> {
    const dashboard = this.getDashboardHistorialData(cierre);
    if (dashboard?.desgloseDiferencias?.length) {
      return dashboard.desgloseDiferencias;
    }

    const items = [
      { clave: 'efectivo', label: 'Efectivo', valor: this.getDiferenciaEfectivoCierre(cierre) },
      { clave: 'otros', label: 'Otros métodos', valor: this.getDiferenciaOtrosMetodosCierre(cierre) }
    ];

    return items.filter((item) => Math.abs(item.valor) > 0.01);
  }

  private enriquecerHistorialConDashboard(cierres: CierreDiario[]): void {
    this.historialDashboardData.clear();

    const solicitudes = cierres.map((cierre) => {
      const fechaOperativa = this.normalizarFechaOperativaLocal(cierre?.fecha);
      const sedeHistorial = this.sedeActual?.key || cierre?.sede;

      if (!fechaOperativa || Number.isNaN(fechaOperativa.getTime()) || !sedeHistorial) {
        return of({ key: this.getHistorialDashboardKey(cierre), data: null as HistorialDashboardData | null });
      }

      return this.cierreCajaService.obtenerResumenDiario(fechaOperativa, sedeHistorial).pipe(
        map((resumen) => ({
          key: this.getHistorialDashboardKey(cierre),
          data: this.construirDashboardDataDesdeResumenHistorial(resumen, cierre)
        })),
        catchError((error) => {
          console.error('Error al enriquecer cierre histórico con datos del dashboard:', error);
          return of({ key: this.getHistorialDashboardKey(cierre), data: null as HistorialDashboardData | null });
        })
      );
    });

    forkJoin(solicitudes)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resultados) => {
          resultados.forEach((resultado) => {
            if (resultado.data) {
              this.historialDashboardData.set(resultado.key, resultado.data);
            }
          });

          this.historialCargando = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error al completar el dashboard del historial:', error);
          this.historialCargando = false;
        }
      });
  }

  getMonedaOrigenCierre(cierre: CierreDiario): string {
    return this.obtenerCodigoMoneda(cierre.monedaPrincipal || this.monedaSistema);
  }

  getMontoCierreConvertido(cierre: CierreDiario, monto: number): number {
    return this.convertirMontoConTasas(
      Number(monto || 0),
      cierre.monedaPrincipal || this.monedaSistema,
      this.monedaSistema
    );
  }

  getEfectivoInicialCierre(cierre: CierreDiario): number {
    const dashboard = this.getDashboardHistorialData(cierre);
    if (dashboard) {
      return dashboard.efectivoInicial;
    }

    return this.getMontoCierreConvertido(cierre, cierre.efectivoInicial || 0);
  }

  getVentasEfectivoCierre(cierre: CierreDiario): number {
    return this.getMontoCierreConvertido(cierre, cierre.ventasEfectivo || 0);
  }

  getEfectivoFinalRealCierre(cierre: CierreDiario): number {
    const dashboard = this.getDashboardHistorialData(cierre);
    if (dashboard) {
      return dashboard.efectivoContado;
    }

    return this.getMontoCierreConvertido(cierre, cierre.efectivoFinalReal || 0);
  }

  getEfectivoFinalTeoricoCierre(cierre: CierreDiario): number {
    const dashboard = this.getDashboardHistorialData(cierre);
    if (dashboard) {
      return dashboard.efectivoTeorico;
    }

    return this.getMontoCierreConvertido(cierre, cierre.efectivoFinalTeorico || 0);
  }

  getIngresosRegistradosCierre(cierre: CierreDiario): number {
    const dashboard = this.getDashboardHistorialData(cierre);
    if (dashboard) {
      return dashboard.totalVentas;
    }

    const ingresos = Number(cierre?.totales?.ingresos || 0);
    return this.getMontoCierreConvertido(cierre, ingresos);
  }

  getEgresosOperativosCierre(cierre: CierreDiario): number {
    const dashboard = this.getDashboardHistorialData(cierre);
    if (dashboard) {
      return dashboard.egresosOperativos;
    }

    const egresos = Number(cierre?.totales?.egresos || cierre?.egresos || 0);
    return this.getMontoCierreConvertido(cierre, egresos);
  }

  getDiferenciaCierre(cierre: CierreDiario): number {
    const dashboard = this.getDashboardHistorialData(cierre);
    if (dashboard) {
      return dashboard.diferenciaTotal;
    }

    return this.getMontoCierreConvertido(cierre, cierre.diferencia || 0);
  }

  getDiferenciaEfectivoCierre(cierre: CierreDiario): number {
    const dashboard = this.getDashboardHistorialData(cierre);
    if (dashboard) {
      return dashboard.diferenciaCaja;
    }

    return this.redondearMonto(this.getEfectivoFinalRealCierre(cierre) - this.getEfectivoFinalTeoricoCierre(cierre));
  }

  getDiferenciaOtrosMetodosCierre(cierre: CierreDiario): number {
    const dashboard = this.getDashboardHistorialData(cierre);
    if (dashboard) {
      return this.redondearMonto(dashboard.diferenciaTotal - dashboard.diferenciaCaja);
    }

    return this.redondearMonto(this.getDiferenciaCierre(cierre) - this.getDiferenciaEfectivoCierre(cierre));
  }

  getTotalVentasCierre(cierre: CierreDiario): number {
    const dashboard = this.getDashboardHistorialData(cierre);
    if (dashboard) {
      return dashboard.totalVentas;
    }

    if (Number(cierre?.totales?.ingresos || 0) > 0) {
      return this.getIngresosRegistradosCierre(cierre);
    }

    const total = cierre.ventasEfectivo + cierre.ventasTarjeta + cierre.ventasTransferencia +
      cierre.ventasDebito + cierre.ventasCredito + cierre.ventasPagomovil + cierre.ventasZelle;

    return this.convertirMontoConTasas(total, cierre.monedaPrincipal || 'USD', this.monedaSistema);
  }

  getTotalPendienteCierre(cierre: CierreDiario): number {
    const dashboard = this.getDashboardHistorialData(cierre);
    if (dashboard) {
      return dashboard.totalPendiente;
    }

    return Number(cierre?.formasPago?.abono?.deudaPendiente || 0)
      + Number(cierre?.formasPago?.cashea?.deudaPendiente || 0)
      + Number(cierre?.formasPago?.deContadoPendiente?.deudaPendiente || 0);
  }

  getTotalTransaccionesCierre(cierre: CierreDiario): number {
    const dashboard = this.getDashboardHistorialData(cierre);
    if (dashboard) {
      return dashboard.transaccionesRegistradas;
    }

    return Array.isArray(cierre?.transacciones) ? cierre.transacciones.length : 0;
  }

  getNetoOperativoCierre(cierre: CierreDiario): number {
    const dashboard = this.getDashboardHistorialData(cierre);
    if (dashboard) {
      return dashboard.netoDia;
    }

    if (Number(cierre?.totales?.neto || 0) !== 0) {
      return this.getMontoCierreConvertido(cierre, Number(cierre?.totales?.neto || 0));
    }

    return this.getTotalVentasCierre(cierre) + Number(cierre?.otrosIngresos || 0) - Number(cierre?.egresos || 0);
  }

  getUsuarioResponsableCierre(cierre: CierreDiario): string {
    return cierre?.usuarioCierre || cierre?.usuarioApertura || 'Sin usuario';
  }

  getFechaJornadaHistorial(cierre: CierreDiario): string {
    return this.datePipe.transform(cierre?.fecha, 'dd/MM/yyyy') || 'Sin fecha';
  }

  getFechaHoraCierreHistorial(cierre: CierreDiario): string {
    const fechaReferencia = cierre?.fechaCierre || cierre?.fecha;
    const formato = cierre?.fechaCierre ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy';
    return this.datePipe.transform(fechaReferencia, formato) || 'Sin fecha';
  }

  getFechaOperativaCierre(cierre: CierreDiario): string {
    return this.datePipe.transform(cierre?.fechaCierre || cierre?.fecha, 'dd/MM/yyyy HH:mm') || 'Sin fecha';
  }

  getObservacionHistorialCierre(cierre: CierreDiario): string {
    const texto = String(cierre?.notasCierre || cierre?.observaciones || '').trim();
    return texto || 'Sin observaciones registradas';
  }

  getResumenMetodosHistorial(cierre: CierreDiario): Array<{ label: string; total: number }> {
    const metodos = [
      { label: 'Efectivo', total: Number(cierre?.metodosPago?.efectivo?.total || 0) },
      { label: 'Punto', total: Number(cierre?.metodosPago?.punto?.total || 0) },
      { label: 'Transferencia', total: Number(cierre?.metodosPago?.transferencia?.total || 0) },
      { label: 'Pago móvil', total: Number(cierre?.metodosPago?.pagomovil?.total || 0) },
      { label: 'Zelle', total: Number(cierre?.metodosPago?.zelle?.total || 0) }
    ];

    return metodos
      .filter((metodo) => metodo.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }

  private getEstadoTecnicoHistorialClave(cierre: CierreDiario): 'conciliado' | 'descuadre' | 'auditado' | 'cerrado' | 'pendiente' {
    const estado = String(cierre?.estado || '').trim().toLowerCase();
    const estadoConciliacion = String(cierre?.estadoConciliacion || cierre?.detalleCierreReal?.estadoConciliacion || '').trim().toLowerCase();
    const diferencia = Math.abs(this.getDiferenciaCierre(cierre));

    if (estado === 'revisado') {
      return 'auditado';
    }

    if (estadoConciliacion === 'diferencia' || diferencia > 0.01) {
      return 'descuadre';
    }

    if (['conciliado', 'cuadrado'].includes(estadoConciliacion)) {
      return 'conciliado';
    }

    if (estado === 'cerrado') {
      return 'cerrado';
    }

    return 'pendiente';
  }

  getEstadoTecnicoHistorialTexto(cierre: CierreDiario): string {
    const estado = this.getEstadoTecnicoHistorialClave(cierre);
    const mapa = {
      conciliado: 'Cuadre validado',
      descuadre: 'Descuadre de caja',
      auditado: 'Cierre auditado',
      cerrado: 'Cierre registrado',
      pendiente: 'Conciliación pendiente'
    };

    return mapa[estado];
  }

  getEstadoTecnicoHistorialIcono(cierre: CierreDiario): string {
    const estado = this.getEstadoTecnicoHistorialClave(cierre);
    const mapa = {
      conciliado: 'bi-shield-check',
      descuadre: 'bi-exclamation-diamond',
      auditado: 'bi-clipboard2-check',
      cerrado: 'bi-journal-check',
      pendiente: 'bi-hourglass-split'
    };

    return mapa[estado];
  }

  getEstadoTecnicoHistorialClase(cierre: CierreDiario): string {
    const estado = this.getEstadoTecnicoHistorialClave(cierre);
    return `historial-chip--${estado}`;
  }

  getEstadoAdministrativoHistorialTexto(cierre: CierreDiario): string {
    const estado = String(cierre?.estado || '').trim().toLowerCase();

    if (estado === 'revisado') {
      return 'Registro revisado';
    }

    if (estado === 'cerrado') {
      return 'Registro cerrado';
    }

    if (estado === 'abierto') {
      return 'Jornada abierta';
    }

    return 'Registro operativo';
  }

  toggleHistorialExportMenu(event: MouseEvent): void {
    event.stopPropagation();

    if (!this.historialCierres.length) {
      return;
    }

    this.mostrarMenuExportHistorial = !this.mostrarMenuExportHistorial;
  }

  verDetalleCierre(cierre: CierreDiario): void {
    this.historialDetalleSeleccionado = cierre;
    this.actualizarVistaPreviaHistorial(cierre);

    const historialModalElement = document.getElementById('historialCierresModal');
    const historialModal = historialModalElement ? bootstrap.Modal.getInstance(historialModalElement) : null;
    this.reabrirHistorialAlCerrarDetalle = !!historialModalElement?.classList.contains('show');
    historialModal?.hide();

    const modalElement = document.getElementById('historialDetalleModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      window.setTimeout(() => modal.show(), this.reabrirHistorialAlCerrarDetalle ? 180 : 0);
    }
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

    if (this.tieneBloqueoPorCierrePendienteAnterior()) {
      this.mostrarAvisoCierrePendienteAnterior();
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

  tieneBloqueoPorCierrePendienteAnterior(): boolean {
    return !!this.bloqueoOperativoActual?.cierrePendienteAnterior;
  }

  get mensajeBloqueoCierrePendienteAnterior(): string {
    const fecha = this.bloqueoOperativoActual?.cierrePendienteAnterior?.fechaFormateada;
    if (!fecha) {
      return 'Existe una caja pendiente de un día anterior. Debe conciliarse y cerrarse antes de iniciar una nueva jornada.';
    }

    return `Existe una caja pendiente del ${fecha}. Debe conciliarse y cerrarse antes de iniciar una nueva jornada.`;
  }

  private mostrarAvisoCierrePendienteAnterior(): void {
    this.swalService.showWarning(
      'Cierre pendiente',
      `
      <div style="text-align:left">
        <p style="margin-bottom:12px">${this.mensajeBloqueoCierrePendienteAnterior}</p>
        <p style="margin-bottom:0">Debes cerrar la caja pendiente desde este módulo antes de abrir la caja del día actual.</p>
      </div>
      `,
      true,
      7000
    );
  }

  abrirModalCierre(): void {
    if (!this.cierreActual) {
      this.swalService.showWarning('Sin cierre activo', 'No hay una caja abierta para cerrar.');
      return;
    }

    // Resetear valores del formulario (sin emitir eventos)
    this.cierreForm.patchValue({
      efectivoRealUSD: 0,
      efectivoRealEUR: 0,
      efectivoRealVES: 0,
      transferenciaRealTotal: 0,
      pagomovilRealTotal: 0,
      zelleReal: 0,
      notasCierre: '',
      imprimirResumen: false
    }, { emitEvent: false });

    // Limpiar y reconstruir controles de bancos
    this.limpiarControlesBancos();
    this.agregarControlesBancos();

    // Suscribirse a cambios en el formulario (solo una vez)
    if (!this._suscripcionFormulario) {
      this.suscribirCambiosFormularioCierre();
      this._suscripcionFormulario = true;
    }

    // Forzar recalcular diferencias después de reconstruir controles
    setTimeout(() => {
      this.recalcularDiferencias();
    }, 100);

    const modalElement = document.getElementById('cierreCajaModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  private _suscripcionFormulario: boolean = false;

  abrirModalTransaccion(transaccion?: Transaccion): void {
    if ((!this.cierreActual || this.cierreActual.estado !== 'abierto') && !transaccion) {
      this.swalService.showWarning('Caja no disponible', 'Debes iniciar una caja antes de registrar transacciones manuales.');
      return;
    }

    if ((!this.cierreActual || this.cierreActual.estado !== 'abierto') && transaccion) {
      this.swalService.showWarning('Caja cerrada', 'Solo puedes editar transacciones manuales mientras la caja esté abierta.');
      return;
    }

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
      const detalleMetodo = transaccion.detalleMetodosPago?.[0];
      this.transaccionForm.patchValue({
        tipo: transaccion.tipo === 'egreso' ? 'egreso' : 'ingreso',
        descripcion: transaccion.descripcion,
        monto: transaccion.monto,
        metodoPago: this.normalizarClaveMetodoPago(transaccion.metodoPago),
        categoria: transaccion.categoria || this.getCategoriaPredeterminada(transaccion.tipo === 'egreso' ? 'egreso' : 'ingreso'),
        observaciones: transaccion.observaciones || '',
        comprobante: transaccion.comprobante || '',
        cuentaReceptoraId: detalleMetodo?.cuentaReceptoraId || ''
      });
    } else {
      this.transaccionForm.reset({
        tipo: 'ingreso',
        descripcion: '',
        monto: 0,
        metodoPago: this.getMetodoPagoPredeterminado(),
        categoria: this.getCategoriaPredeterminada('ingreso'),
        comprobante: '',
        observaciones: '',
        cuentaReceptoraId: ''
      });
    }

    this.sincronizarFormularioTransaccion();

    const modalElement = document.getElementById('transaccionModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  abrirHistorial(): void {
    this.establecerRangoHistorialSemanaActual();

    this.cargarHistorialCierres();

    const modalElement = document.getElementById('historialCierresModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  aplicarPresetHistorial(rango: 'semana' | 'mes' | '30dias'): void {
    const hoy = new Date();
    const fechaInicio = new Date(hoy);
    const fechaFin = new Date(hoy);

    if (rango === 'semana') {
      const diaSemana = hoy.getDay();
      const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
      fechaInicio.setDate(hoy.getDate() + diffLunes);
    } else if (rango === 'mes') {
      fechaInicio.setDate(1);
    } else {
      fechaInicio.setDate(hoy.getDate() - 29);
    }

    this.filtroHistorialDesde = this.datePipe.transform(fechaInicio, 'yyyy-MM-dd') || '';
    this.filtroHistorialHasta = this.datePipe.transform(fechaFin, 'yyyy-MM-dd') || '';
    this.cargarHistorialCierres();
  }

  cerrarDetalleHistorialModal(): void {
    this.cerrarModal('historialDetalleModal');
    this.limpiarVistaPreviaHistorial();
    this.historialDetalleSeleccionado = null;

    if (this.reabrirHistorialAlCerrarDetalle) {
      const modalElement = document.getElementById('historialCierresModal');
      if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        window.setTimeout(() => modal.show(), 160);
      }
    }

    this.reabrirHistorialAlCerrarDetalle = false;
  }

  imprimirDetalleHistorial(): void {
    if (!this.historialDetalleObjectUrl) {
      this.swalService.showWarning('Sin vista previa', 'Aún no hay un reporte listo para imprimir.');
      return;
    }

    const ventana = window.open(this.historialDetalleObjectUrl, '_blank');
    if (!ventana) {
      this.swalService.showWarning('Ventana bloqueada', 'Habilita las ventanas emergentes para imprimir el reporte.');
      return;
    }

    ventana.onload = () => {
      ventana.focus();
      ventana.print();
    };
  }

  private establecerRangoHistorialSemanaActual(): void {
    const hoy = new Date();
    const fechaInicio = new Date(hoy);
    const diaSemana = hoy.getDay();
    const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;

    fechaInicio.setDate(hoy.getDate() + diffLunes);

    this.filtroHistorialDesde = this.datePipe.transform(fechaInicio, 'yyyy-MM-dd') || '';
    this.filtroHistorialHasta = this.datePipe.transform(hoy, 'yyyy-MM-dd') || '';
  }

  private actualizarVistaPreviaHistorial(cierre: CierreDiario): void {
    this.limpiarVistaPreviaHistorial();
    this.historialDetalleCargando = true;

    const dashboard = this.getDashboardHistorialData(cierre);
    if (dashboard?.reporte) {
      try {
        const html = this.generarContenidoReporte(dashboard.reporte);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const objectUrl = window.URL.createObjectURL(blob);

        this.historialDetalleObjectUrl = objectUrl;
        this.historialDetallePreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl);
      } finally {
        this.historialDetalleCargando = false;
      }

      return;
    }

    const fechaCierre = this.normalizarFechaOperativaLocal(cierre?.fecha);
    const sedeHistorial = this.sedeActual?.key || cierre?.sede;

    if (!fechaCierre || Number.isNaN(fechaCierre.getTime()) || !sedeHistorial) {
      this.actualizarVistaPreviaHistorialFallback(cierre);
      return;
    }

    this.cierreCajaService.obtenerResumenDiario(fechaCierre, sedeHistorial).subscribe({
      next: (resumen) => {
        try {
          const reporte = this.construirReporteEstructuradoDesdeResumenHistorial(resumen, cierre);
          const html = this.generarContenidoReporte(reporte);
          const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
          const objectUrl = window.URL.createObjectURL(blob);

          this.historialDetalleObjectUrl = objectUrl;
          this.historialDetallePreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl);
        } catch (error) {
          console.error('Error al construir la vista previa histórica desde el resumen:', error);
          this.actualizarVistaPreviaHistorialFallback(cierre);
          return;
        }

        this.historialDetalleCargando = false;
      },
      error: (error) => {
        console.error('Error al cargar el resumen del cierre histórico:', error);
        this.actualizarVistaPreviaHistorialFallback(cierre);
      }
    });
  }

  private actualizarVistaPreviaHistorialFallback(cierre: CierreDiario): void {
    try {
      const html = this.generarContenidoReporte(this.construirReporteEstructuradoDesdeCierre(cierre));
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const objectUrl = window.URL.createObjectURL(blob);

      this.historialDetalleObjectUrl = objectUrl;
      this.historialDetallePreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl);
    } finally {
      this.historialDetalleCargando = false;
    }
  }

  private ejecutarConResumenHistorial<T>(resumen: any, cierreFallback: CierreDiario, generador: (cierreReferencia: CierreDiario) => T): T {
    const snapshot = {
      fechaSeleccionada: this.fechaSeleccionada,
      cierreActual: this.cierreActual,
      transacciones: this.transacciones,
      transaccionesFiltradas: this.transaccionesFiltradas,
      analisisVentas: this.analisisVentas,
      analisisMetodosPago: this.analisisMetodosPago,
      analisisFormasPago: this.analisisFormasPago,
      analisisVentasPendientes: this.analisisVentasPendientes,
      cierreForm: this.cierreForm.getRawValue(),
      detalleVentaExpandidaId: this.detalleVentaExpandidaId,
      ultimaActualizacion: this.ultimaActualizacion
    };

    const cierrePersistido = JSON.parse(JSON.stringify(resumen?.cierreExistente || cierreFallback || null));
    const cierreTrabajo = JSON.parse(JSON.stringify(cierrePersistido || null));

    try {
      this.fechaSeleccionada = this.normalizarFechaOperativaLocal(cierreFallback?.fecha) || this.fechaSeleccionada;
      this.cierreActual = cierreTrabajo || resumen?.cierreExistente || cierreFallback;
      this.transacciones = [];
      this.transaccionesFiltradas = [];
      this.detalleVentaExpandidaId = null;

      if (Array.isArray(resumen?.ventas) && resumen.ventas.length) {
        this.procesarVentasParaTransacciones(resumen.ventas);
      } else {
        this.transacciones = [];
        this.calcularAnalisisDesdeTransacciones();
      }

      if (Array.isArray(resumen?.abonosDelDia) && resumen.abonosDelDia.length) {
        this.agregarAbonosDelDiaComoTransacciones(resumen.abonosDelDia);
      }

      if (Array.isArray(resumen?.transaccionesManuales) && resumen.transaccionesManuales.length) {
        this.transacciones = this.ordenarTransaccionesPorFechaDesc([...this.transacciones, ...resumen.transaccionesManuales]);
        this.calcularAnalisisDesdeTransacciones();
      }

      this.cierreForm.patchValue({
        efectivoRealUSD: 0,
        efectivoRealEUR: 0,
        efectivoRealVES: 0,
        transferenciaRealTotal: 0,
        pagomovilRealTotal: 0,
        zelleReal: 0,
        notasCierre: '',
        imprimirResumen: false,
        enviarEmail: false,
        adjuntarComprobantes: true
      }, { emitEvent: false });

      this.limpiarControlesBancos();
      this.agregarControlesBancos();

      if (this.cierreActual?.detalleCierreReal) {
        this.precargarValoresReales();
      }

      this.transaccionesFiltradas = [...this.transacciones];

      if (this.cierreActual) {
        this.actualizarResumen();
      }

      const cierreReferencia = cierrePersistido || resumen?.cierreExistente || cierreFallback;
      return generador(cierreReferencia);
    } finally {
      this.fechaSeleccionada = snapshot.fechaSeleccionada;
      this.cierreActual = snapshot.cierreActual;
      this.transacciones = snapshot.transacciones;
      this.transaccionesFiltradas = snapshot.transaccionesFiltradas;
      this.analisisVentas = snapshot.analisisVentas;
      this.analisisMetodosPago = snapshot.analisisMetodosPago;
      this.analisisFormasPago = snapshot.analisisFormasPago;
      this.analisisVentasPendientes = snapshot.analisisVentasPendientes;
      this.limpiarControlesBancos();
      this.agregarControlesBancos();
      this.cierreForm.patchValue(snapshot.cierreForm, { emitEvent: false });
      this.detalleVentaExpandidaId = snapshot.detalleVentaExpandidaId;
      this.ultimaActualizacion = snapshot.ultimaActualizacion;
    }
  }

  private construirDashboardDataDesdeResumenHistorial(resumen: any, cierreFallback: CierreDiario): HistorialDashboardData {
    return this.ejecutarConResumenHistorial(resumen, cierreFallback, (cierreReferencia) => {
      const reporte = this.aplicarContextoHistoricoAlReporte(this.construirReporteEstructurado(), cierreReferencia);
      const diferenciaCaja = this.getDiferenciaEfectivo();
      const diferenciaPunto = this.getDiferenciaPunto();
      const diferenciaTransferencia = this.getDiferenciaTransferencia();
      const diferenciaPagomovil = this.getDiferenciaPagomovil();
      const diferenciaZelle = this.getDiferenciaZelle();
      const efectivoInicial = this.efectivoInicial;
      const totalVentas = this.totalVentasKPI;
      const totalPendiente = this.totalPendientesKPI;
      const netoDia = this.netoDiaKPI;
      const efectivoContado = this.getEfectivoRealTotal();
      const efectivoTeorico = this.getEfectivoFinalTeorico();
      const egresosOperativos = this.getTotalEgresos();
      const diferenciaTotal = this.getDiferenciaTotal();
      const desgloseDiferencias = [
        { clave: 'efectivo', label: 'Efectivo', valor: diferenciaCaja },
        { clave: 'punto', label: 'Punto de venta', valor: diferenciaPunto },
        { clave: 'transferencia', label: 'Transferencia', valor: diferenciaTransferencia },
        { clave: 'pagomovil', label: 'Pago móvil', valor: diferenciaPagomovil },
        { clave: 'zelle', label: 'Zelle', valor: diferenciaZelle }
      ].filter((item) => Math.abs(item.valor) > 0.01);

      reporte.kpis = [
        { label: 'Efectivo Inicial', value: efectivoInicial },
        { label: 'Total Ventas', value: totalVentas },
        { label: 'Total Pendiente', value: totalPendiente },
        { label: 'Neto del Día', value: netoDia },
        { label: 'Diferencia General', value: diferenciaTotal, clase: diferenciaTotal > 0 ? 'positive' : diferenciaTotal < 0 ? 'negative' : '' }
      ];

      reporte.conciliacion = [
        { label: 'Efectivo teórico final', value: efectivoTeorico, format: 'currency' },
        { label: 'Efectivo real contado', value: efectivoContado, format: 'currency' },
        { label: 'Diferencia en efectivo', value: diferenciaCaja, format: 'currency', clase: diferenciaCaja > 0 ? 'positive' : diferenciaCaja < 0 ? 'negative' : '' },
        ...desgloseDiferencias
          .filter((item) => item.clave !== 'efectivo')
          .map((item) => ({
            label: `Diferencia en ${item.label.toLowerCase()}`,
            value: item.valor,
            format: 'currency',
            clase: item.valor > 0 ? 'positive' : item.valor < 0 ? 'negative' : ''
          })),
        { label: 'Diferencia general de cierre', value: diferenciaTotal, format: 'currency', clase: diferenciaTotal > 0 ? 'positive' : diferenciaTotal < 0 ? 'negative' : '' },
        { label: 'Usuario apertura', value: this.cierreActual?.usuarioApertura || 'N/A', format: 'text' },
        { label: 'Usuario cierre', value: this.cierreActual?.usuarioCierre || 'N/A', format: 'text' }
      ];

      return {
        reporte,
        efectivoInicial,
        totalVentas,
        totalPendiente,
        netoDia,
        efectivoContado,
        efectivoTeorico,
        diferenciaCaja,
        diferenciaTotal,
        egresosOperativos,
        transaccionesRegistradas: this.transacciones.length,
        ventasPendientes: this.analisisVentasPendientes.length,
        desgloseDiferencias
      };
    });
  }

  private construirReporteEstructuradoDesdeResumenHistorial(resumen: any, cierreFallback: CierreDiario): any {
    return this.construirDashboardDataDesdeResumenHistorial(resumen, cierreFallback).reporte;
  }

  private limpiarVistaPreviaHistorial(): void {
    if (this.historialDetalleObjectUrl) {
      window.URL.revokeObjectURL(this.historialDetalleObjectUrl);
      this.historialDetalleObjectUrl = null;
    }

    this.historialDetallePreviewUrl = null;
    this.historialDetalleCargando = false;
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
    const metodoConfigurado = this.metodosPago.find((item) => item.valor === this.normalizarClaveMetodoPago(metodo));
    if (metodoConfigurado) {
      return metodoConfigurado.color;
    }

    return this.coloresMetodoPago[this.normalizarClaveMetodoPago(metodo)] || '#64748b';
  }

  getIconoMetodoPago(metodo: string): string {
    const metodoConfigurado = this.metodosPago.find((item) => item.valor === this.normalizarClaveMetodoPago(metodo));
    if (metodoConfigurado) {
      return metodoConfigurado.icono;
    }

    const iconos: { [key: string]: string } = {
      'efectivo': 'bi-cash',
      'tarjeta': 'bi-credit-card',
      'punto': 'bi-credit-card',
      'debito': 'bi-credit-card-2-back',
      'credito': 'bi-credit-card-2-front',
      'transferencia': 'bi-bank',
      'pagomovil': 'bi-phone',
      'zelle': 'bi-globe2',
      'mixto': 'bi-shuffle'
    };
    return iconos[this.normalizarClaveMetodoPago(metodo)] || 'bi-receipt';
  }

  verDetalleVenta(numeroVenta: string): void {
    const numeroVentaNormalizado = String(numeroVenta || '').trim().toLowerCase();
    const ventaPendiente = this.analisisVentasPendientes.find((venta) => (
      String(venta?.numeroVenta || '').trim().toLowerCase() === numeroVentaNormalizado
    ));
    const transaccionVenta = this.transacciones.find((transaccion) => (
      transaccion.tipo === 'venta'
      && String(transaccion.numeroVenta || '').trim().toLowerCase() === numeroVentaNormalizado
    ));

    if (!ventaPendiente && !transaccionVenta) {
      this.swalService.showWarning('Detalle no disponible', 'No se encontró la venta dentro del cierre actual.');
      return;
    }

    this.swalService.showInfo(
      `Detalle venta #${this.escapeHtml(numeroVenta)}`,
      this.construirHtmlDetalleVentaPendiente(transaccionVenta, ventaPendiente),
      {
        width: '960px',
        padding: '0.95rem',
        heightAuto: false,
        scrollbarPadding: false,
        customClass: {
          popup: 'swal-modern-popup info-popup swal-detail-popup',
          title: 'swal-modern-title swal-detail-title',
          htmlContainer: 'swal-modern-content swal-detail-content',
          confirmButton: 'swal-modern-confirm info-btn',
          closeButton: 'swal-modern-close'
        }
      }
    );
  }

  private construirHtmlDetalleVentaPendiente(transaccion: Transaccion | undefined, ventaPendiente?: any): string {
    const cliente = transaccion?.cliente?.nombre || ventaPendiente?.cliente || 'Cliente no identificado';
    const total = Number(ventaPendiente?.total ?? transaccion?.montoTotal ?? transaccion?.monto ?? 0);
    const saldo = Number(ventaPendiente?.deuda ?? transaccion?.deudaPendiente ?? 0);
    const abonado = Number(transaccion?.montoPagado ?? Math.max(0, total - saldo));
    const fecha = transaccion?.fecha || ventaPendiente?.fecha;
    const numeroVenta = transaccion?.numeroVenta || ventaPendiente?.numeroVenta || 'N/A';
    const formaPago = transaccion ? this.getTextoFormaPagoHistorial(transaccion) : (ventaPendiente?.formaPago || 'Forma no definida');
    const estadoPago = transaccion ? this.getTextoEstadoPagoHistorial(transaccion) : (saldo > 0.009 ? 'Pendiente por pago' : 'Pago completo');
    const asesor = transaccion?.usuario || transaccion?.asesor || 'Usuario';
    const cobrosHtml = transaccion ? this.construirHtmlCobrosVentaPendiente(transaccion) : '';

    return `
      <div style="text-align:left; display:grid; gap:12px; max-height:min(50vh, 470px); overflow-y:auto; overflow-x:hidden; padding-right:2px;">
        <div style="display:grid; grid-template-columns:minmax(0, 1.55fr) minmax(270px, 0.95fr); gap:12px; align-items:start;">
          <div style="padding:14px; border-radius:14px; background:#ffffff; border:1px solid #e2e8f0; display:grid; gap:12px;">
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
              <div style="min-width:0;">
                <div style="font-size:1.02rem; font-weight:700; color:#0f172a; line-height:1.3;">${this.escapeHtml(cliente)}</div>
                <div style="font-size:0.82rem; color:#64748b; margin-top:4px;">
                  Venta #${this.escapeHtml(numeroVenta)} · ${this.escapeHtml(formaPago)} · ${this.escapeHtml(estadoPago)}
                </div>
              </div>
              <div style="padding:0.38rem 0.7rem; border-radius:999px; background:${saldo > 0.009 ? '#fff7ed' : '#f0fdf4'}; border:1px solid ${saldo > 0.009 ? '#fed7aa' : '#bbf7d0'}; color:${saldo > 0.009 ? '#c2410c' : '#166534'}; font-size:0.74rem; font-weight:700; white-space:nowrap;">
                ${this.escapeHtml(estadoPago)}
              </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px;">
              <div style="padding:10px 12px; border-radius:12px; background:#f8fafc; border:1px solid #e2e8f0; min-width:0;">
                <div style="font-size:0.7rem; color:#64748b; text-transform:uppercase; letter-spacing:0.04em;">Total venta</div>
                <div style="font-size:0.98rem; font-weight:700; color:#0f172a; margin-top:4px;">${this.formatCurrency(total)} ${this.escapeHtml(this.monedaSistema)}</div>
              </div>
              <div style="padding:10px 12px; border-radius:12px; background:#f0fdf4; border:1px solid #bbf7d0; min-width:0;">
                <div style="font-size:0.7rem; color:#166534; text-transform:uppercase; letter-spacing:0.04em;">Cobrado</div>
                <div style="font-size:0.98rem; font-weight:700; color:#166534; margin-top:4px;">${this.formatCurrency(abonado)} ${this.escapeHtml(this.monedaSistema)}</div>
              </div>
              <div style="padding:10px 12px; border-radius:12px; background:#fff7ed; border:1px solid #fed7aa; min-width:0;">
                <div style="font-size:0.7rem; color:#9a3412; text-transform:uppercase; letter-spacing:0.04em;">Saldo pendiente</div>
                <div style="font-size:0.98rem; font-weight:700; color:#c2410c; margin-top:4px;">${this.formatCurrency(saldo)} ${this.escapeHtml(this.monedaSistema)}</div>
              </div>
            </div>
          </div>

          <div style="padding:14px; border-radius:14px; background:#f8fafc; border:1px solid #e2e8f0; display:grid; gap:8px; align-content:start;">
            <div style="font-size:0.72rem; color:#64748b; text-transform:uppercase; letter-spacing:0.04em; font-weight:700;">Datos de la venta</div>
            <div style="font-size:0.8rem; color:#334155;"><strong>Fecha:</strong> ${this.escapeHtml(fecha ? this.formatDate(new Date(fecha)) : 'Sin fecha')}</div>
            <div style="font-size:0.8rem; color:#334155;"><strong>Asesor:</strong> ${this.escapeHtml(asesor)}</div>
            ${transaccion?.cliente?.cedula ? `<div style="font-size:0.8rem; color:#334155;"><strong>Cédula:</strong> ${this.escapeHtml(transaccion.cliente.cedula)}</div>` : ''}
          </div>
        </div>

        ${cobrosHtml}
      </div>
    `;
  }

  private construirHtmlCobrosVentaPendiente(transaccion: Transaccion): string {
    const cobros = Array.isArray(transaccion.cobrosDelDia) ? transaccion.cobrosDelDia : [];

    if (!cobros.length) {
      return '';
    }

    const items = cobros.map((cobro) => {
      const fechaCobro = cobro?.fecha ? this.datePipe.transform(cobro.fecha, 'dd/MM/yyyy HH:mm') : 'Sin fecha';
      const saldoCobro = Number(cobro?.deudaPendiente ?? NaN);
      const metodosCobroHtml = this.construirHtmlMetodosPorCobroPendiente(cobro);

      return `
        <li style="margin:0; padding:12px 0; border-top:1px solid #e2e8f0; display:grid; gap:6px;">
          <div style="display:grid; grid-template-columns:minmax(0, 1fr) auto; gap:12px; align-items:start;">
            <div style="min-width:0; display:grid; gap:4px;">
              <strong style="color:#0f172a;">${this.escapeHtml(cobro.etiqueta || 'Cobro')}</strong>
              <div style="font-size:0.78rem; color:#64748b;">${this.escapeHtml(fechaCobro || '')}</div>
              <div style="font-size:0.8rem; color:#334155;">${this.escapeHtml(this.getTextoResumenMetodosCobro(cobro))}</div>
            </div>
            <span style="font-weight:700; color:#0f766e; white-space:nowrap; align-self:start;">${this.formatCurrency(this.getMontoCobroDiaSistema(cobro))} ${this.escapeHtml(this.monedaSistema)}</span>
          </div>
          ${metodosCobroHtml}
          ${Number.isFinite(saldoCobro) ? `<div style="font-size:0.78rem; color:#9a3412;">Saldo luego de este cobro: ${this.formatCurrency(saldoCobro)} ${this.escapeHtml(transaccion.monedaOriginal || transaccion.moneda || this.monedaSistema)}</div>` : ''}
        </li>
      `;
    }).join('');

    return `
      <div style="padding:12px 14px; border-radius:14px; background:#ffffff; border:1px solid #e2e8f0; display:grid; gap:4px;">
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
          <div style="font-size:0.84rem; font-weight:700; color:#0f172a;">Cobros del día aplicados a esta venta</div>
          <div style="font-size:0.74rem; color:#64748b;">${cobros.length} ${cobros.length === 1 ? 'registro' : 'registros'}</div>
        </div>
        <ul style="list-style:none; margin:0; padding:0; display:grid;">${items}</ul>
      </div>
    `;
  }

  private construirHtmlMetodosPorCobroPendiente(cobro: TransaccionCobroDia): string {
    const metodos = Array.isArray(cobro.metodosDePago) ? cobro.metodosDePago : [];

    if (!metodos.length) {
      return '';
    }

    const items = metodos.map((metodo) => {
      const montoMetodo = Number(
        metodo.montoEnMonedaSistema
        ?? metodo.montoEnMonedaVenta
        ?? metodo.monto
        ?? 0
      );

      return `
        <li style="margin:0; padding:0; display:flex; justify-content:space-between; gap:12px; align-items:flex-start; font-size:0.78rem;">
          <span style="color:#475569;">${this.escapeHtml(this.formatearTipoPago(metodo.tipo))}</span>
          <strong style="color:#0f172a; white-space:nowrap;">${this.formatCurrency(montoMetodo)} ${this.escapeHtml(this.monedaSistema)}</strong>
        </li>
      `;
    }).join('');

    return `
      <div style="margin-top:2px; padding:10px; border-radius:10px; background:#f8fafc; border:1px solid #e2e8f0; display:grid; gap:8px;">
        <div style="font-size:0.72rem; font-weight:700; color:#334155; text-transform:uppercase; letter-spacing:0.04em;">Desglose por método</div>
        <ul style="list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:6px 12px;">${items}</ul>
      </div>
    `;
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
    return this.getDeudaTotalDelDia();
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
    return this.getDeudaTotalDelDia();
  }

  get netoDiaKPI(): number {
    return this.getTotalIngresos() - this.getTotalEgresos();
  }

  getDeudaTotalDelDia(): number {
    return (this.analisisFormasPago.abono.deudaPendiente || 0)
      + (this.analisisFormasPago.cashea.deudaPendiente || 0)
      + (this.analisisFormasPago.deContadoPendiente.deudaPendiente || 0);
  }

  get efectivoInicial(): number {
    return this.cierreActual?.efectivoInicial || 0;
  }

  get efectivoFinalTeorico(): number {
    return this.getEfectivoFinalTeorico();
  }

  getTotalVentasHistorial(): number {
    return this.historialCierres.reduce((sum, cierre) => sum + this.getTotalVentasCierre(cierre), 0);
  }

  getDiferenciaTotalHistorial(): number {
    return this.historialCierres.reduce((sum, cierre) => sum + this.getDiferenciaCierre(cierre), 0);
  }

  exportarHistorial(formato: 'excel' | 'pdf' = 'excel'): void {
    this.mostrarMenuExportHistorial = false;

    if (!this.historialCierres.length) {
      this.swalService.showWarning('Sin historial', 'No hay cierres en el rango seleccionado para exportar.');
      return;
    }

    const resumen = [
      {
        Indicador: 'Sede',
        Valor: this.sedeActual?.nombre || 'General'
      },
      {
        Indicador: 'Rango consultado',
        Valor: `${this.filtroHistorialDesde || 'N/A'} al ${this.filtroHistorialHasta || 'N/A'}`
      },
      {
        Indicador: 'Registros',
        Valor: this.historialCierres.length
      },
      {
        Indicador: 'Ingresos registrados',
        Valor: this.getTotalVentasHistorial()
      },
      {
        Indicador: 'Descuadre total',
        Valor: this.getDiferenciaTotalHistorial()
      }
    ];

    const cierres = this.historialCierres.map((cierre) => ({
      Fecha: this.datePipe.transform(cierre.fecha, 'dd/MM/yyyy') || '',
      FechaCierre: this.getFechaOperativaCierre(cierre),
      EstadoTecnico: this.getEstadoTecnicoHistorialTexto(cierre),
      EstadoRegistro: this.getEstadoAdministrativoHistorialTexto(cierre),
      IngresosRegistrados: this.getTotalVentasCierre(cierre),
      NetoOperativo: this.getNetoOperativoCierre(cierre),
      EgresosOperativos: this.getEgresosOperativosCierre(cierre),
      EfectivoInicial: this.getEfectivoInicialCierre(cierre),
      EfectivoContado: this.getEfectivoFinalRealCierre(cierre),
      DescuadreCaja: this.getDiferenciaCierre(cierre),
      Transacciones: this.getTotalTransaccionesCierre(cierre),
      UsuarioApertura: cierre.usuarioApertura || '',
      UsuarioCierre: cierre.usuarioCierre || '',
      Observaciones: this.getObservacionHistorialCierre(cierre)
    }));

    const transacciones = this.historialCierres.flatMap((cierre) => (
      Array.isArray(cierre.transacciones)
        ? cierre.transacciones.map((transaccion) => ({
          FechaCierre: this.datePipe.transform(cierre.fecha, 'dd/MM/yyyy') || '',
          Hora: this.datePipe.transform(transaccion.fecha, 'HH:mm') || '',
          Tipo: transaccion.tipo,
          Descripcion: transaccion.descripcion,
          Metodo: this.getTextoFormaPagoMetodoHistorial(transaccion),
          Monto: Number(transaccion.montoSistema ?? transaccion.monto ?? 0),
          Usuario: transaccion.usuario || '',
          Venta: transaccion.numeroVenta || '',
          Cliente: transaccion.cliente?.nombre || ''
        }))
        : []
    ));

    if (formato === 'pdf') {
      this.exportarHistorialPdf(resumen, cierres);
      return;
    }

    try {
      this.excelExportService.exportMultipleSheets([
        {
          data: resumen,
          sheetName: 'Resumen',
          columnWidths: { A: 24, B: 38 }
        },
        {
          data: cierres,
          sheetName: 'Cierres',
          columnWidths: { A: 14, B: 20, C: 18, D: 16, E: 16, F: 16, G: 16, H: 16, I: 16, J: 14, K: 24, L: 24, M: 40 }
        },
        ...(transacciones.length
          ? [{
            data: transacciones,
            sheetName: 'Transacciones',
            columnWidths: { A: 14, B: 10, C: 14, D: 34, E: 18, F: 14, G: 22, H: 16, I: 26 }
          }]
          : [])
      ], `historial-cierres-${this.normalizarTextoArchivo(this.sedeActual?.nombre || 'general')}`);

      this.swalService.showSuccess('Exportado', 'Historial exportado a Excel correctamente.');
    } catch (error) {
      console.error('Error al exportar historial de cierres:', error);
      this.swalService.showError('Error', 'No se pudo exportar el historial de cierres.');
    }
  }

  private exportarHistorialPdf(resumen: Array<{ Indicador: string; Valor: string | number }>, cierres: any[]): void {
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 14;
      const usableWidth = pageWidth - (marginX * 2);
      let cursorY = 16;

      const ensureSpace = (requiredHeight: number) => {
        if (cursorY + requiredHeight > pageHeight - 14) {
          pdf.addPage();
          cursorY = 16;
        }
      };

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.text('Historial de cierres de caja', marginX, cursorY);
      cursorY += 7;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(71, 85, 105);
      pdf.text(`Rango: ${this.filtroHistorialDesde || 'N/A'} al ${this.filtroHistorialHasta || 'N/A'}`, marginX, cursorY);
      cursorY += 5;
      pdf.text(this.obtenerTextoSedeReporte(this.sedeActual?.nombre || 'General', this.sedeActual?.direccion), marginX, cursorY);
      cursorY += 8;

      pdf.setTextColor(15, 23, 42);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10.5);
      pdf.text('Resumen ejecutivo', marginX, cursorY);
      cursorY += 5;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      resumen.forEach((item) => {
        ensureSpace(5);
        pdf.text(`${item.Indicador}: ${String(item.Valor)}`, marginX, cursorY);
        cursorY += 4.5;
      });

      cursorY += 3;
      cierres.forEach((cierre) => {
        const observaciones = pdf.splitTextToSize(`Observaciones: ${cierre.Observaciones || 'Sin observaciones'}`, usableWidth - 8);
        const blockHeight = 26 + (observaciones.length * 4);
        ensureSpace(blockHeight);

        pdf.setDrawColor(219, 229, 240);
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(marginX, cursorY, usableWidth, blockHeight, 3, 3, 'FD');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(15, 23, 42);
        pdf.text(`${cierre.Fecha} · ${cierre.EstadoTecnico}`, marginX + 4, cursorY + 6);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.7);
        pdf.setTextColor(71, 85, 105);
        pdf.text(`Cierre: ${cierre.FechaCierre}`, marginX + 4, cursorY + 11);
        pdf.text(`Registro: ${cierre.EstadoRegistro}`, marginX + 4, cursorY + 15);
        pdf.text(`Responsable: ${cierre.UsuarioCierre || cierre.UsuarioApertura || 'N/A'}`, marginX + 4, cursorY + 19);

        pdf.setTextColor(15, 23, 42);
        pdf.text(`Ingresos: ${this.formatCurrency(Number(cierre.IngresosRegistrados || 0))} ${this.monedaSistema}`, marginX + 88, cursorY + 11);
        pdf.text(`Efectivo contado: ${this.formatCurrency(Number(cierre.EfectivoContado || 0))} ${this.monedaSistema}`, marginX + 88, cursorY + 15);
        pdf.text(`Descuadre: ${this.formatCurrency(Number(cierre.DescuadreCaja || 0))} ${this.monedaSistema}`, marginX + 88, cursorY + 19);

        pdf.setTextColor(71, 85, 105);
        pdf.text(observaciones, marginX + 4, cursorY + 24);

        cursorY += blockHeight + 5;
      });

      pdf.save(`historial-cierres-${this.normalizarTextoArchivo(this.sedeActual?.nombre || 'general')}.pdf`);
      this.swalService.showSuccess('Exportado', 'Historial exportado a PDF correctamente.');
    } catch (error) {
      console.error('Error al exportar historial de cierres a PDF:', error);
      this.swalService.showError('Error', 'No se pudo exportar el historial de cierres en PDF.');
    }
  }

  private suscribirCambiosFormularioCierre(): void {
    if (this.suscripcionesFormularioCierreInicializadas) {
      return;
    }

    this.suscripcionesFormularioCierreInicializadas = true;

    this.cierreForm.valueChanges.pipe(
      debounceTime(300),
      takeUntil(this.destroy$)
    ).subscribe(() => this.recalcularDiferencias());
  }

  private calcularDiferenciasPunto(): { total: number; porBanco: any[] } {
    let total = 0;
    const porBanco: any[] = [];

    this.analisisMetodosPago.punto.porBanco.forEach(banco => {
      const controlName = this.getNombreControlMetodo('punto', banco);
      const montoReal = Number(this.cierreForm.get(controlName)?.value || 0);
      const montoSistema = Number(banco.total || 0);
      const diferencia = this.redondearMonto(montoReal - montoSistema);

      total += diferencia;

      porBanco.push({
        banco: banco.banco,
        bancoCodigo: banco.bancoCodigo,
        destinoKey: banco.destinoKey,
        destinoLabel: banco.destinoLabel,
        montoReal: montoReal,
        montoSistema: montoSistema,
        diferencia: diferencia,
        cantidadReal: 0,
        cantidadSistema: banco.cantidad
      });
    });

    return { total: this.redondearMonto(total), porBanco };
  }

  private construirDetalleMetodoReal(tipo: 'punto' | 'transferencia' | 'pagomovil' | 'zelle'): any[] {
    return this.getDestinosMetodo(tipo).map((item) => {
      const montoReal = this.getMontoRealMetodoPorDestino(tipo, item);
      const montoSistema = Number(item?.total || 0);

      return {
        banco: item?.banco,
        bancoCodigo: item?.bancoCodigo,
        destinoKey: item?.destinoKey,
        destinoLabel: item?.destinoLabel,
        montoReal,
        montoSistema,
        diferencia: this.redondearMonto(montoReal - montoSistema),
        cantidadSistema: item?.cantidad || 0,
        cantidadReal: 0
      };
    });
  }

  private getDiferenciaMetodoDesdeDestinos(tipo: 'punto' | 'transferencia' | 'pagomovil' | 'zelle'): number {
    return this.redondearMonto(this.getDestinosMetodo(tipo).reduce((sum, item) => {
      return sum + this.getDiferenciaMetodoPorDestino(tipo, item);
    }, 0));
  }

  // Métodos para verificar diferencias
  tieneDiferenciaPunto(): boolean {
    return Math.abs(this.getDiferenciaPunto()) > 0.01;
  }

  tieneDiferenciaTransferencia(): boolean {
    return Math.abs(this.getDiferenciaTransferencia()) > 0.01;
  }

  tieneDiferenciaEfectivo(): boolean {
    return Math.abs(this.getDiferenciaEfectivo()) > 0.01;
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

  getDiferenciaPuntoPorBanco(bancoCodigo: string | any): number {
    const bancoData = typeof bancoCodigo === 'object'
      ? bancoCodigo
      : this.analisisMetodosPago.punto.porBanco.find(b => b.bancoCodigo === bancoCodigo || b.destinoKey === bancoCodigo);
    const controlName = bancoData ? this.getNombreControlMetodo('punto', bancoData) : `puntoReal_${bancoCodigo}`;
    const montoReal = Number(this.cierreForm.get(controlName)?.value || 0);
    const montoSistema = Number(bancoData?.total || 0);

    return montoReal - montoSistema;
  }

  getDiferenciaClass(diferencia: number): string {
    if (Math.abs(diferencia) < 0.01) return 'diferencia-cero';
    return diferencia > 0 ? 'diferencia-positiva' : 'diferencia-negativa';
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
      if (this.tieneAjusteCambiarioEfectivo()) {
        return 'Arqueo cuadrado. La variación visible corresponde a referencia cambiaria del efectivo y no a un sobrante o faltante operativo.';
      }

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
      case 'ingreso':
        return 'tone-ingreso';
      case 'egreso':
        return 'tone-egreso';
      default:
        return 'tone-neutral';
    }
  }

  getInfoIcon(): string {
    return this.metodoPagoSeleccionado?.icono
      || (this.transaccionForm.get('tipo')?.value === 'egreso'
        ? 'bi-arrow-up-right-circle'
        : 'bi-arrow-down-left-circle');
  }

  getInfoTitle(): string {
    return this.categoriaTransaccionActual?.label
      || (this.transaccionForm.get('tipo')?.value === 'egreso' ? 'Egreso manual' : 'Ingreso manual');
  }

  getInfoMessage(): string {
    const tipo = this.transaccionForm.get('tipo')?.value === 'egreso' ? 'egreso' : 'ingreso';
    const metodo = this.metodoPagoSeleccionado?.label || 'método seleccionado';
    const categoria = this.categoriaTransaccionActual?.descripcion || 'Movimiento manual listo para registrarse en el cierre.';
    const cuenta = this.cuentaReceptoraSeleccionada?.displayTitle
      ? ` Destino operativo: ${this.cuentaReceptoraSeleccionada.displayTitle}.`
      : '';

    if (tipo === 'egreso') {
      return `${categoria} Se registrará como salida de caja usando ${metodo}.${cuenta}`;
    }

    return `${categoria} Se registrará como entrada adicional del día usando ${metodo}.${cuenta}`;
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

  async exportarReportePDF(): Promise<void> {
    this.mostrarMenuExport = false;

    if (!this.hayDatosParaExportar()) {
      this.swalService.showWarning('Sin datos', 'No hay datos para exportar a PDF');
      return;
    }

    const reporte = this.construirReporteEstructurado();
    const contenedor = this.crearContenedorTemporalReporte(reporte);

    this.swalService.showLoadingAlert('Generando PDF...');

    try {
      document.body.appendChild(contenedor);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const canvas = await html2canvas(contenedor, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: Math.ceil(contenedor.scrollWidth),
        height: Math.ceil(contenedor.scrollHeight),
        windowWidth: Math.ceil(contenedor.scrollWidth),
        windowHeight: Math.ceil(contenedor.scrollHeight)
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgData = canvas.toDataURL('image/png', 1.0);
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let remainingHeight = imgHeight;
      let offsetY = 0;

      pdf.addImage(imgData, 'PNG', 0, offsetY, imgWidth, imgHeight, undefined, 'FAST');
      remainingHeight -= pageHeight;

      while (remainingHeight > 0.1) {
        offsetY = remainingHeight - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, offsetY, imgWidth, imgHeight, undefined, 'FAST');
        remainingHeight -= pageHeight;
      }

      pdf.save(`${this.obtenerNombreBaseReporte()}.pdf`);
      this.swalService.showSuccess('Exportado', 'Reporte exportado a PDF correctamente');
    } catch (error) {
      console.error('Error al exportar reporte a PDF:', error);
      this.swalService.showError('Error', 'No se pudo exportar el reporte a PDF.');
    } finally {
      if (contenedor.parentNode) {
        contenedor.parentNode.removeChild(contenedor);
      }
      this.swalService.closeLoading();
    }
  }

  private abrirVentanaReporte(cerrarDespuesDeImprimir: boolean): void {
    const contenido = this.generarContenidoReporte();
    const ventana = window.open('', '_blank');

    if (!ventana) {
      this.swalService.showWarning('Ventana bloqueada', 'Habilita las ventanas emergentes para imprimir el reporte.');
      return;
    }

    ventana.document.write(contenido);
    ventana.document.close();

    if (cerrarDespuesDeImprimir) {
      ventana.onafterprint = () => ventana.close();
    }

    setTimeout(() => {
      ventana.focus();
      ventana.print();
    }, 350);
  }

  private hayDatosParaExportar(): boolean {
    return !!(this.cierreActual || this.transacciones.length || this.transaccionesFiltradas.length);
  }

  private escapeHtml(value: unknown): string {
    return (value ?? '')
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private obtenerNombreSedeCompleto(sede?: string | null): string {
    const nombreSede = String(this.sedeActual?.nombre || sede || '').trim();

    if (!nombreSede) {
      return 'Óptica';
    }

    return nombreSede;
  }

  private obtenerDireccionSedePrincipal(direccion?: string | null): string {
    const direccionCompleta = String(this.sedeActual?.direccion || direccion || '').trim();

    if (!direccionCompleta) {
      return '';
    }

    return direccionCompleta
      .split(',')
      .map((segmento) => segmento.trim())
      .find(Boolean) || direccionCompleta;
  }

  private obtenerTextoSedeReporte(sede?: string | null, direccion?: string | null): string {
    const referenciaSede = this.obtenerDireccionSedePrincipal(direccion) || this.obtenerNombreSedeCompleto(sede);
    return `Sede: ${referenciaSede}`;
  }

  private obtenerTransaccionesReporte(): Transaccion[] {
    const lista = this.transacciones.length ? this.transacciones : this.transaccionesFiltradas;
    return this.ordenarTransaccionesPorFechaDesc(lista);
  }

  private obtenerDetalleRealMetodoReporte(tipo: 'punto' | 'transferencia' | 'pagomovil' | 'zelle', item?: any): any | null {
    const detalleMetodo = this.cierreActual?.detalleCierreReal?.[tipo];
    const registros = Array.isArray(detalleMetodo)
      ? detalleMetodo
      : tipo === 'zelle' && typeof detalleMetodo === 'number'
        ? [{
          banco: 'Zelle',
          destinoLabel: 'Total general',
          montoReal: detalleMetodo,
          montoSistema: this.analisisMetodosPago.zelle.total,
          diferencia: Number(detalleMetodo) - Number(this.analisisMetodosPago.zelle.total || 0)
        }]
        : [];

    if (!registros.length) {
      return null;
    }

    if (!item) {
      return registros[0];
    }

    return registros.find((registro: any) => {
      if (registro?.destinoKey && item?.destinoKey) {
        return registro.destinoKey === item.destinoKey;
      }

      if (registro?.destinoLabel && item?.destinoLabel) {
        return registro.destinoLabel === item.destinoLabel;
      }

      if (registro?.bancoCodigo && item?.bancoCodigo && registro?.banco) {
        return registro.bancoCodigo === item.bancoCodigo && registro.banco === item.banco;
      }

      return registro?.banco === item?.banco;
    }) || null;
  }

  private construirSeccionMetodoReporte(tipo: 'punto' | 'transferencia' | 'pagomovil' | 'zelle', titulo: string): any | null {
    const analisisMetodo = this.analisisMetodosPago?.[tipo];
    const totalMetodo = Number(analisisMetodo?.total || 0);

    if (!totalMetodo) {
      return null;
    }

    const destinos = this.getDestinosMetodo(tipo);
    const filas = (destinos.length ? destinos : [null]).map((destino) => {
      const detalleReal = this.obtenerDetalleRealMetodoReporte(tipo, destino);
      const diferencia = Number(detalleReal?.diferencia || 0);

      return {
        destino: destino ? this.getTituloDestino(destino) : 'Total general',
        detalle: destino ? this.getDetalleDestino(destino) : null,
        referencia: destino ? this.getReferenciaDestino(destino) : null,
        montoOriginal: destino ? this.getTextoMontoOriginalBanco(destino) : 'N/A',
        sistema: destino ? Number(destino?.total || 0) : totalMetodo,
        real: detalleReal ? Number(detalleReal?.montoReal || 0) : null,
        diferencia,
        operaciones: destino ? Number(destino?.cantidad || 0) : Number(analisisMetodo?.cantidad || 0)
      };
    });

    return {
      tipo,
      titulo,
      total: totalMetodo,
      filas
    };
  }

  private construirReporteEstructurado(): any {
    const detalleInicial = this.cierreActual?.efectivoInicialDetalle;
    const mostrarConciliacion = !!this.cierreActual?.detalleCierreReal;
    const diferenciaTotal = this.getDiferenciaTotal();
    const diferenciaEfectivo = this.getDiferenciaEfectivo();
    const diferenciaOtrosMetodos = this.getDiferenciaOtrosMetodos();
    const transacciones = this.obtenerTransaccionesReporte().map((transaccion) => ({
      hora: this.datePipe.transform(transaccion.fecha, 'HH:mm') || '',
      descripcion: transaccion.descripcion,
      tipo: transaccion.tipo,
      metodo: this.getTextoFormaPagoMetodoHistorial(transaccion),
      monto: Number(transaccion.monto || 0),
      usuario: transaccion.usuario || '',
      numeroVenta: transaccion.numeroVenta || '',
      cliente: transaccion.cliente?.nombre || ''
    }));

    const metodos = [
      this.construirSeccionMetodoReporte('punto', 'Punto de venta'),
      this.construirSeccionMetodoReporte('transferencia', 'Transferencias'),
      this.construirSeccionMetodoReporte('pagomovil', 'Pago móvil'),
      this.construirSeccionMetodoReporte('zelle', 'Zelle')
    ].filter(Boolean);

    return {
      sede: this.obtenerNombreSedeCompleto(),
      direccion: this.obtenerDireccionSedePrincipal(),
      fecha: this.datePipe.transform(this.fechaSeleccionada, 'dd/MM/yyyy') || '',
      fechaArchivo: this.datePipe.transform(this.fechaSeleccionada, 'yyyy-MM-dd') || '',
      generadoEn: this.datePipe.transform(new Date(), 'dd/MM/yyyy HH:mm') || '',
      estado: this.getEstadoTexto(this.cierreActual?.estado || '', this.cierreActual?.fecha),
      monedaSistema: this.monedaSistema,
      mostrarConciliacion,
      notaFinal: `Documento generado desde el módulo de cierre de caja. Los montos están expresados en ${this.monedaSistema}${mostrarConciliacion ? ' e incluyen conciliación real guardada al cierre.' : '.'}`,
      kpis: [
        { label: 'Efectivo Inicial', value: this.efectivoInicial },
        { label: 'Total Ventas', value: this.totalVentasKPI },
        { label: 'Total Pendiente', value: this.totalPendientesKPI },
        { label: 'Neto del Día', value: this.netoDiaKPI },
        { label: 'Diferencia Total', value: diferenciaTotal, clase: diferenciaTotal > 0 ? 'positive' : diferenciaTotal < 0 ? 'negative' : '' }
      ],
      resumenOperativo: [
        { label: 'Transacciones del día', value: transacciones.length },
        { label: 'Ventas pendientes', value: this.analisisVentasPendientes.length },
        { label: 'Egresos registrados', value: this.getTotalEgresos(), format: 'currency' },
        { label: 'Cobrado e ingresos netos', value: this.netoDiaKPI, format: 'currency' },
        { label: 'Notas de cierre', value: this.cierreActual?.notasCierre || this.cierreActual?.detalleCierreReal?.notasCierre || 'Sin observaciones', format: 'text' }
      ],
      conciliacion: [
        { label: 'Efectivo teórico final', value: this.getEfectivoFinalTeorico(), format: 'currency' },
        { label: 'Efectivo real contado', value: this.getEfectivoRealTotal(), format: 'currency' },
        { label: 'Diferencia de efectivo', value: diferenciaEfectivo, format: 'currency', clase: diferenciaEfectivo > 0 ? 'positive' : diferenciaEfectivo < 0 ? 'negative' : '' },
        ...(Math.abs(diferenciaOtrosMetodos) > 0.01 ? [{ label: 'Ajuste por otros métodos', value: diferenciaOtrosMetodos, format: 'currency', clase: diferenciaOtrosMetodos > 0 ? 'positive' : diferenciaOtrosMetodos < 0 ? 'negative' : '' }] : []),
        { label: 'Diferencia total conciliada', value: diferenciaTotal, format: 'currency', clase: diferenciaTotal > 0 ? 'positive' : diferenciaTotal < 0 ? 'negative' : '' },
        { label: 'Usuario apertura', value: this.cierreActual?.usuarioApertura || 'N/A', format: 'text' },
        { label: 'Usuario cierre', value: this.cierreActual?.usuarioCierre || 'N/A', format: 'text' }
      ],
      efectivoPorMoneda: [
        { moneda: 'USD', inicial: Number(detalleInicial?.USD || 0), ventas: Number(this.analisisMetodosPago.efectivo.porMoneda.dolar || 0), real: Number(this.cierreActual?.detalleCierreReal?.efectivo?.usd || 0) },
        { moneda: 'EUR', inicial: Number(detalleInicial?.EUR || 0), ventas: Number(this.analisisMetodosPago.efectivo.porMoneda.euro || 0), real: Number(this.cierreActual?.detalleCierreReal?.efectivo?.eur || 0) },
        { moneda: 'VES', inicial: Number(detalleInicial?.Bs || 0), ventas: Number(this.analisisMetodosPago.efectivo.porMoneda.bolivar || 0), real: Number(this.cierreActual?.detalleCierreReal?.efectivo?.ves || 0) }
      ],
      formasPago: [
        { forma: 'Contado', total: Number(this.analisisFormasPago.contado.total || 0), deudaPendiente: 0, cantidad: Number(this.analisisFormasPago.contado.cantidad || 0) },
        { forma: 'Abono', total: Number(this.analisisFormasPago.abono.total || 0), deudaPendiente: Number(this.analisisFormasPago.abono.deudaPendiente || 0), cantidad: Number(this.analisisFormasPago.abono.cantidad || 0) },
        { forma: 'Cashea', total: Number(this.analisisFormasPago.cashea.total || 0), deudaPendiente: Number(this.analisisFormasPago.cashea.deudaPendiente || 0), cantidad: Number(this.analisisFormasPago.cashea.cantidad || 0) },
        { forma: 'De contado pendiente por pago', total: Number(this.analisisFormasPago.deContadoPendiente.total || 0), deudaPendiente: Number(this.analisisFormasPago.deContadoPendiente.deudaPendiente || 0), cantidad: Number(this.analisisFormasPago.deContadoPendiente.cantidad || 0) }
      ],
      metodos,
      transacciones
    };
  }

  private aplicarContextoHistoricoAlReporte(reporte: any, cierre: CierreDiario): any {
    return {
      ...reporte,
      sede: this.obtenerNombreSedeCompleto(this.sedeActual?.nombre || cierre?.sede || reporte?.sede),
      direccion: this.obtenerDireccionSedePrincipal(this.sedeActual?.direccion || reporte?.direccion),
      fecha: this.getFechaJornadaHistorial(cierre),
      fechaArchivo: this.datePipe.transform(cierre?.fecha || this.fechaSeleccionada, 'yyyy-MM-dd') || reporte?.fechaArchivo || '',
      generadoEn: this.getFechaHoraCierreHistorial(cierre),
      estado: this.getEstadoTecnicoHistorialTexto(cierre),
      notaFinal: `Vista previa histórica del cierre seleccionado. Jornada ${this.getFechaJornadaHistorial(cierre)}.${cierre?.fechaCierre ? ` Cierre ejecutado el ${this.getFechaHoraCierreHistorial(cierre)}.` : ''} Los montos se muestran en ${this.monedaSistema} para consulta operativa.`
    };
  }

  private construirReporteEstructuradoDesdeCierre(cierre: CierreDiario): any {
    const mostrarConciliacion = !!cierre?.detalleCierreReal;
    const diferenciaTotal = this.getDiferenciaCierre(cierre);
    const diferenciaEfectivo = this.getDiferenciaEfectivoCierre(cierre);
    const diferenciaOtrosMetodos = this.getDiferenciaOtrosMetodosCierre(cierre);
    const transacciones = (Array.isArray(cierre?.transacciones) ? cierre.transacciones : []).map((transaccion) => ({
      hora: this.datePipe.transform(transaccion.fecha, 'HH:mm') || '',
      descripcion: transaccion.descripcion,
      tipo: transaccion.tipo,
      metodo: this.getTextoFormaPagoMetodoHistorial(transaccion),
      monto: Number(transaccion.montoSistema ?? transaccion.monto ?? 0),
      usuario: transaccion.usuario || '',
      numeroVenta: transaccion.numeroVenta || '',
      cliente: transaccion.cliente?.nombre || ''
    }));

    return this.aplicarContextoHistoricoAlReporte({
      sede: this.obtenerNombreSedeCompleto(this.sedeActual?.nombre || cierre?.sede),
      direccion: this.obtenerDireccionSedePrincipal(),
      fecha: this.datePipe.transform(cierre?.fecha, 'dd/MM/yyyy') || '',
      fechaArchivo: this.datePipe.transform(cierre?.fecha, 'yyyy-MM-dd') || '',
      generadoEn: this.datePipe.transform(cierre?.fechaCierre || cierre?.fecha || new Date(), 'dd/MM/yyyy HH:mm') || '',
      estado: this.getEstadoTecnicoHistorialTexto(cierre),
      monedaSistema: this.monedaSistema,
      mostrarConciliacion,
      notaFinal: `Vista previa histórica del cierre de caja. Los montos se muestran en ${this.monedaSistema} para consulta operativa.`,
      kpis: [
        { label: 'Efectivo Inicial', value: this.getEfectivoInicialCierre(cierre) },
        { label: 'Ingresos registrados', value: this.getTotalVentasCierre(cierre) },
        { label: 'Neto Operativo', value: this.getNetoOperativoCierre(cierre) },
        { label: 'Egresos operativos', value: this.getEgresosOperativosCierre(cierre) },
        { label: 'Descuadre de caja', value: this.getDiferenciaCierre(cierre), clase: this.getDiferenciaCierre(cierre) > 0 ? 'positive' : this.getDiferenciaCierre(cierre) < 0 ? 'negative' : '' }
      ],
      resumenOperativo: [
        { label: 'Transacciones registradas', value: this.getTotalTransaccionesCierre(cierre) },
        { label: 'Estado técnico', value: this.getEstadoTecnicoHistorialTexto(cierre), format: 'text' },
        { label: 'Ingresos registrados', value: this.getTotalVentasCierre(cierre), format: 'currency' },
        { label: 'Egresos operativos', value: this.getEgresosOperativosCierre(cierre), format: 'currency' },
        { label: 'Responsable', value: this.getUsuarioResponsableCierre(cierre), format: 'text' },
        { label: 'Notas de cierre', value: this.getObservacionHistorialCierre(cierre), format: 'text' }
      ],
      conciliacion: [
        { label: 'Efectivo teórico final', value: this.getEfectivoFinalTeoricoCierre(cierre), format: 'currency' },
        { label: 'Efectivo real contado', value: this.getEfectivoFinalRealCierre(cierre), format: 'currency' },
        { label: 'Diferencia de efectivo', value: diferenciaEfectivo, format: 'currency', clase: diferenciaEfectivo > 0 ? 'positive' : diferenciaEfectivo < 0 ? 'negative' : '' },
        ...(Math.abs(diferenciaOtrosMetodos) > 0.01 ? [{ label: 'Ajuste por otros métodos', value: diferenciaOtrosMetodos, format: 'currency', clase: diferenciaOtrosMetodos > 0 ? 'positive' : diferenciaOtrosMetodos < 0 ? 'negative' : '' }] : []),
        { label: 'Diferencia total conciliada', value: diferenciaTotal, format: 'currency', clase: diferenciaTotal > 0 ? 'positive' : diferenciaTotal < 0 ? 'negative' : '' },
        { label: 'Usuario apertura', value: cierre?.usuarioApertura || 'N/A', format: 'text' },
        { label: 'Usuario cierre', value: cierre?.usuarioCierre || 'N/A', format: 'text' }
      ],
      efectivoPorMoneda: [
        { moneda: 'USD', inicial: Number(cierre?.efectivoInicialDetalle?.USD || 0), ventas: Number(cierre?.metodosPago?.efectivo?.porMoneda?.dolar || 0), real: Number(cierre?.detalleCierreReal?.efectivo?.usd || 0) },
        { moneda: 'EUR', inicial: Number(cierre?.efectivoInicialDetalle?.EUR || 0), ventas: Number(cierre?.metodosPago?.efectivo?.porMoneda?.euro || 0), real: Number(cierre?.detalleCierreReal?.efectivo?.eur || 0) },
        { moneda: 'VES', inicial: Number(cierre?.efectivoInicialDetalle?.Bs || 0), ventas: Number(cierre?.metodosPago?.efectivo?.porMoneda?.bolivar || 0), real: Number(cierre?.detalleCierreReal?.efectivo?.ves || 0) }
      ],
      formasPago: [
        { forma: 'Contado', total: Number(cierre?.totales?.ventasContado || 0), deudaPendiente: 0, cantidad: 0 },
        { forma: 'Crédito operativo', total: Number(cierre?.totales?.ventasCredito || 0), deudaPendiente: Number(cierre?.totales?.ventasCredito || 0), cantidad: 0 },
        { forma: 'Pendiente por liquidar', total: Number(cierre?.totales?.ventasPendientes || 0), deudaPendiente: Number(cierre?.totales?.ventasPendientes || 0), cantidad: 0 }
      ].filter((item) => item.total > 0 || item.deudaPendiente > 0),
      metodos: this.construirSeccionesMetodoHistorial(cierre),
      transacciones
    }, cierre);
  }

  private construirSeccionesMetodoHistorial(cierre: CierreDiario): any[] {
    const secciones = [
      { tipo: 'punto', titulo: 'Punto de venta', total: Number(cierre?.metodosPago?.punto?.total || 0), filas: cierre?.metodosPago?.punto?.porBanco || [] },
      { tipo: 'transferencia', titulo: 'Transferencias', total: Number(cierre?.metodosPago?.transferencia?.total || 0), filas: cierre?.metodosPago?.transferencia?.porBanco || [] },
      { tipo: 'pagomovil', titulo: 'Pago móvil', total: Number(cierre?.metodosPago?.pagomovil?.total || 0), filas: cierre?.metodosPago?.pagomovil?.porBanco || [] },
      { tipo: 'zelle', titulo: 'Zelle', total: Number(cierre?.metodosPago?.zelle?.total || 0), filas: cierre?.metodosPago?.zelle?.porBanco || [] }
    ];

    return secciones
      .filter((seccion) => seccion.total > 0)
      .map((seccion) => ({
        tipo: seccion.tipo,
        titulo: seccion.titulo,
        total: seccion.total,
        filas: (Array.isArray(seccion.filas) ? seccion.filas : []).map((fila: any) => {
          const detalleReal = this.obtenerDetalleRealMetodoHistorial(cierre, seccion.tipo, fila);
          return {
            destino: fila?.destinoLabel || fila?.banco || 'Destino no identificado',
            detalle: fila?.detalleCuenta || fila?.cuentaTitular || null,
            referencia: fila?.referenciaCuenta || fila?.cuentaDocumento || fila?.cuentaTelefono || null,
            montoOriginal: Number(fila?.totalOriginal || 0) > 0
              ? `${this.formatCurrency(Number(fila.totalOriginal || 0))} ${this.escapeHtml(this.obtenerCodigoMoneda(fila?.monedaOriginal || this.monedaSistema))}`
              : `${this.formatCurrency(Number(fila?.total || 0))} ${this.escapeHtml(this.monedaSistema)}`,
            sistema: Number(fila?.total || 0),
            real: detalleReal ? Number(detalleReal?.montoReal || 0) : null,
            diferencia: detalleReal ? Number(detalleReal?.diferencia || 0) : 0,
            operaciones: Number(fila?.cantidad || 0)
          };
        })
      }));
  }

  private obtenerDetalleRealMetodoHistorial(cierre: CierreDiario, tipo: string, fila: any): any | null {
    const detalleReal = (cierre?.detalleCierreReal as any)?.[tipo];

    if (!Array.isArray(detalleReal)) {
      return null;
    }

    return detalleReal.find((item: any) => {
      const bancoFila = String(fila?.bancoCodigo || fila?.banco || '').trim().toLowerCase();
      const bancoReal = String(item?.bancoCodigo || item?.banco || '').trim().toLowerCase();
      const destinoFila = String(fila?.destinoKey || fila?.destinoLabel || '').trim().toLowerCase();
      const destinoReal = String(item?.destinoKey || item?.destinoLabel || '').trim().toLowerCase();

      return (bancoFila && bancoFila === bancoReal) || (destinoFila && destinoFila === destinoReal);
    }) || null;
  }

  private obtenerEstilosReporte(): string {
    return `
      :root { color-scheme: light; }
      .report-root, .report-root * { box-sizing: border-box; }
      .report-root { font-family: 'Segoe UI', Arial, sans-serif; margin: 24px; color: #1f2937; }
      .report-root h1, .report-root h2, .report-root h3, .report-root p { margin: 0; }
      .report-root .header { background: linear-gradient(135deg, #0f4c81, #2b7a78); color: #fff; padding: 24px; border-radius: 14px; margin-bottom: 18px; }
      .report-root .header-top { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
      .report-root .header-title { font-size: 28px; font-weight: 700; margin-bottom: 6px; }
      .report-root .header-meta { font-size: 13px; opacity: 0.92; line-height: 1.5; }
      .report-root .badge { display: inline-block; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.24); padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
      .report-root .kpi-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
      .report-root .kpi-card { background: #f8fafc; border: 1px solid #e5e7eb; padding: 14px; border-radius: 12px; }
      .report-root .kpi-label { display: block; color: #64748b; font-size: 12px; margin-bottom: 6px; }
      .report-root .kpi-value { font-size: 22px; font-weight: 700; color: #0f172a; }
      .report-root .layout-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 16px; margin-bottom: 18px; }
      .report-root .panel { border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px; background: #fff; }
      .report-root .panel h2 { font-size: 16px; margin-bottom: 14px; color: #0f172a; }
      .report-root .summary-list { display: grid; gap: 10px; }
      .report-root .summary-item { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px dashed #e5e7eb; padding-bottom: 8px; }
      .report-root .summary-item:last-child { border-bottom: 0; padding-bottom: 0; }
      .report-root .summary-label { color: #475569; }
      .report-root .summary-value { font-weight: 700; text-align: right; }
      .report-root .section-block { margin-bottom: 18px; }
      .report-root .section-title-row { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 10px; }
      .report-root .section-title-row h3 { font-size: 15px; color: #0f172a; }
      .report-root .section-total { font-size: 13px; font-weight: 700; color: #0f4c81; }
      .report-root table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
      .report-root th, .report-root td { border: 1px solid #e5e7eb; padding: 9px 10px; text-align: left; vertical-align: top; font-size: 12px; }
      .report-root th { background: #f8fafc; color: #334155; font-weight: 700; }
      .report-root .muted { color: #64748b; font-size: 11px; margin-top: 3px; }
      .report-root .positive { color: #047857; font-weight: 700; }
      .report-root .negative { color: #b91c1c; font-weight: 700; }
      .report-root .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .report-root .note-box { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; font-size: 12px; color: #475569; }
      .report-root .footer-note { margin-top: 16px; color: #64748b; font-size: 11px; }
      @media print {
        body { margin: 12px; }
        .report-root .panel, .report-root .kpi-card, .report-root .header { break-inside: avoid; }
      }
    `;
  }

  private formatearValorReporte(item: any, incluirMoneda: boolean = true): string {
    if (item?.format === 'currency') {
      return `${this.formatCurrency(Number(item?.value || 0))}${incluirMoneda ? ` ${this.escapeHtml(this.monedaSistema)}` : ''}`;
    }

    return this.escapeHtml(item?.value ?? '');
  }

  private generarBloqueMetodoReporte(seccion: any, mostrarConciliacion: boolean): string {
    return `
      <section class="section-block">
        <div class="section-title-row">
          <h3>${this.escapeHtml(seccion.titulo)}</h3>
          <span class="section-total">${this.formatCurrency(seccion.total)} ${this.escapeHtml(this.monedaSistema)}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Banco receptor / destino</th>
              <th>Monto original</th>
              <th>Sistema</th>
              ${mostrarConciliacion ? '<th>Real</th><th>Diferencia</th>' : ''}
              <th>Ops</th>
            </tr>
          </thead>
          <tbody>
            ${seccion.filas.map((fila: any) => `
              <tr>
                <td>
                  <strong>${this.escapeHtml(fila.destino)}</strong>
                  ${fila.detalle ? `<div class="muted">${this.escapeHtml(fila.detalle)}</div>` : ''}
                  ${fila.referencia ? `<div class="muted">${this.escapeHtml(fila.referencia)}</div>` : ''}
                </td>
                <td>${this.escapeHtml(fila.montoOriginal || 'N/A')}</td>
                <td>${this.formatCurrency(fila.sistema)} ${this.escapeHtml(this.monedaSistema)}</td>
                ${mostrarConciliacion ? `<td>${fila.real !== null ? `${this.formatCurrency(fila.real)} ${this.escapeHtml(this.monedaSistema)}` : 'N/A'}</td>` : ''}
                ${mostrarConciliacion ? `<td class="${fila.diferencia > 0 ? 'positive' : fila.diferencia < 0 ? 'negative' : ''}">${fila.real !== null ? `${this.formatCurrency(fila.diferencia)} ${this.escapeHtml(this.monedaSistema)}` : 'N/A'}</td>` : ''}
                <td>${fila.operaciones}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
    `;
  }

  private generarCuerpoReporte(reporte: any): string {
    return `
      <div class="report-root">
        <div class="header">
          <div class="header-top">
            <div>
              <div class="header-title">Cierre de Caja Diario</div>
              <div class="header-meta">
                ${this.escapeHtml(this.obtenerTextoSedeReporte(reporte.sede, reporte.direccion))}<br>
                Fecha: ${this.escapeHtml(reporte.fecha)}<br>
                Generado: ${this.escapeHtml(reporte.generadoEn)}
              </div>
            </div>
            <span class="badge">${this.escapeHtml(reporte.estado)}</span>
          </div>
        </div>

        <div class="kpi-grid">
          ${reporte.kpis.map((kpi: any) => `
            <div class="kpi-card">
              <div class="kpi-label">${this.escapeHtml(kpi.label)}</div>
              <div class="kpi-value ${this.escapeHtml(kpi.clase || '')}">${this.formatCurrency(Number(kpi.value || 0))}</div>
            </div>
          `).join('')}
        </div>

        <div class="layout-grid">
          <div class="panel">
            <h2>Resumen operativo</h2>
            <div class="summary-list">
              ${reporte.resumenOperativo.map((item: any) => `
                <div class="summary-item">
                  <span class="summary-label">${this.escapeHtml(item.label)}</span>
                  <span class="summary-value ${this.escapeHtml(item.clase || '')}">${this.formatearValorReporte(item)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="panel">
            <h2>Conciliación de efectivo</h2>
            <div class="summary-list">
              ${reporte.conciliacion.map((item: any) => `
                <div class="summary-item">
                  <span class="summary-label">${this.escapeHtml(item.label)}</span>
                  <span class="summary-value ${this.escapeHtml(item.clase || '')}">${this.formatearValorReporte(item)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="two-col">
          <div class="panel">
            <h2>Efectivo por moneda</h2>
            <table>
              <thead>
                <tr>
                  <th>Moneda</th>
                  <th>Inicial</th>
                  <th>Ventas</th>
                  ${reporte.mostrarConciliacion ? '<th>Real contado</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${reporte.efectivoPorMoneda.map((fila: any) => `
                  <tr>
                    <td>${this.escapeHtml(fila.moneda)}</td>
                    <td>${this.formatCurrency(fila.inicial)}</td>
                    <td>${this.formatCurrency(fila.ventas)}</td>
                    ${reporte.mostrarConciliacion ? `<td>${this.formatCurrency(fila.real)}</td>` : ''}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="panel">
            <h2>Formas de pago</h2>
            <table>
              <thead>
                <tr>
                  <th>Forma</th>
                  <th>Total</th>
                  <th>Deuda pendiente</th>
                  <th>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                ${reporte.formasPago.map((fila: any) => `
                  <tr>
                    <td>${this.escapeHtml(fila.forma)}</td>
                    <td>${this.formatCurrency(fila.total)}</td>
                    <td>${this.formatCurrency(fila.deudaPendiente)}</td>
                    <td>${fila.cantidad}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        ${reporte.metodos.length
          ? reporte.metodos.map((seccion: any) => this.generarBloqueMetodoReporte(seccion, reporte.mostrarConciliacion)).join('')
          : ''}

        <section class="section-block">
          <div class="section-title-row">
            <h3>Transacciones del día</h3>
            <span class="section-total">${reporte.transacciones.length} registros</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Descripción</th>
                <th>Tipo</th>
                <th>Método</th>
                <th>Monto</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              ${reporte.transacciones.length ? reporte.transacciones.map((fila: any) => `
                <tr>
                  <td>${this.escapeHtml(fila.hora)}</td>
                  <td>
                    <strong>${this.escapeHtml(fila.descripcion)}</strong>
                    ${fila.numeroVenta ? `<div class="muted">Venta #${this.escapeHtml(fila.numeroVenta)}${fila.cliente ? ` · ${this.escapeHtml(fila.cliente)}` : ''}</div>` : ''}
                  </td>
                  <td>${this.escapeHtml(fila.tipo)}</td>
                  <td>${this.escapeHtml(fila.metodo)}</td>
                  <td>${this.formatCurrency(fila.monto)} ${this.escapeHtml(reporte.monedaSistema)}</td>
                  <td>${this.escapeHtml(fila.usuario)}</td>
                </tr>
              `).join('') : `<tr><td colspan="6" class="muted">No hay transacciones registradas para este cierre.</td></tr>`}
            </tbody>
          </table>
        </section>

        <div class="footer-note">${this.escapeHtml(reporte.notaFinal)}</div>
      </div>
    `;
  }

  private generarContenidoReporte(reporteBase?: any): string {
    const reporte = reporteBase || this.construirReporteEstructurado();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cierre de Caja - ${this.escapeHtml(reporte.fecha)}</title>
        <style>${this.obtenerEstilosReporte()}</style>
      </head>
      <body>
        ${this.generarCuerpoReporte(reporte)}
      </body>
      </html>
    `;
  }

  private crearContenedorTemporalReporte(reporte: any): HTMLDivElement {
    const contenedor = document.createElement('div');
    contenedor.style.position = 'fixed';
    contenedor.style.left = '-10000px';
    contenedor.style.top = '0';
    contenedor.style.width = '1120px';
    contenedor.style.background = '#ffffff';
    contenedor.style.zIndex = '-1';
    contenedor.innerHTML = `<style>${this.obtenerEstilosReporte()}</style>${this.generarCuerpoReporte(reporte)}`;
    return contenedor;
  }

  private normalizarTextoArchivo(valor: string): string {
    return (valor || 'reporte')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'reporte';
  }

  private obtenerNombreBaseReporte(): string {
    const sede = this.normalizarTextoArchivo(this.sedeActual?.nombre || 'general');
    const fecha = this.datePipe.transform(this.fechaSeleccionada, 'yyyy-MM-dd') || this.normalizarTextoArchivo(new Date().toISOString().split('T')[0]);
    return `cierre-caja-${sede}-${fecha}`;
  }

  private obtenerNombreHojaExcel(titulo: string): string {
    const limpio = titulo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .trim();

    return (limpio || 'Hoja').slice(0, 31);
  }

  exportarReporteJSON(): void {
    this.mostrarMenuExport = false;
    this.exportarReporte(); // Reutiliza el método existente
  }

  // Método para exportar a Excel
  exportarExcel(): void {
    this.mostrarMenuExport = false;

    if (!this.hayDatosParaExportar()) {
      this.swalService.showWarning('Sin datos', 'No hay datos para exportar a Excel');
      return;
    }

    const reporte = this.construirReporteEstructurado();
    const hojas = [
      {
        data: [
          ...reporte.kpis.map((item: any) => ({ Seccion: 'KPI', Indicador: item.label, Valor: item.value, Moneda: reporte.monedaSistema })),
          ...reporte.resumenOperativo.map((item: any) => ({ Seccion: 'Resumen operativo', Indicador: item.label, Valor: item.value, Moneda: item.format === 'currency' ? reporte.monedaSistema : '' })),
          ...reporte.conciliacion.map((item: any) => ({ Seccion: 'Conciliación de efectivo', Indicador: item.label, Valor: item.value, Moneda: item.format === 'currency' ? reporte.monedaSistema : '' }))
        ],
        sheetName: 'Resumen',
        columnWidths: { A: 24, B: 30, C: 18, D: 12 }
      },
      {
        data: reporte.efectivoPorMoneda.map((fila: any) => ({
          Moneda: fila.moneda,
          Inicial: fila.inicial,
          Ventas: fila.ventas,
          RealContado: reporte.mostrarConciliacion ? fila.real : null
        })),
        sheetName: 'Efectivo',
        columnWidths: { A: 12, B: 16, C: 16, D: 18 }
      },
      {
        data: reporte.formasPago.map((fila: any) => ({
          Forma: fila.forma,
          Total: fila.total,
          DeudaPendiente: fila.deudaPendiente,
          Cantidad: fila.cantidad
        })),
        sheetName: 'FormasPago',
        columnWidths: { A: 24, B: 16, C: 18, D: 12 }
      },
      ...reporte.metodos.map((seccion: any) => ({
        data: seccion.filas.map((fila: any) => ({
          Destino: fila.destino,
          Detalle: fila.detalle || '',
          Referencia: fila.referencia || '',
          MontoOriginal: fila.montoOriginal || '',
          Sistema: fila.sistema,
          Real: reporte.mostrarConciliacion ? fila.real : null,
          Diferencia: reporte.mostrarConciliacion ? fila.diferencia : null,
          Operaciones: fila.operaciones
        })),
        sheetName: this.obtenerNombreHojaExcel(seccion.titulo),
        columnWidths: { A: 28, B: 28, C: 22, D: 18, E: 16, F: 16, G: 16, H: 12 }
      })),
      {
        data: reporte.transacciones.map((fila: any) => ({
          Hora: fila.hora,
          Descripcion: fila.descripcion,
          Tipo: fila.tipo,
          Metodo: fila.metodo,
          Monto: fila.monto,
          Usuario: fila.usuario,
          NumeroVenta: fila.numeroVenta,
          Cliente: fila.cliente
        })),
        sheetName: 'Transacciones',
        columnWidths: { A: 10, B: 36, C: 14, D: 18, E: 16, F: 28, G: 16, H: 24 }
      }
    ];

    try {
      this.excelExportService.exportMultipleSheets(hojas, this.obtenerNombreBaseReporte());
      this.swalService.showSuccess('Exportado', 'Reporte exportado a Excel correctamente');
    } catch (error) {
      console.error('Error al exportar reporte a Excel:', error);
      this.swalService.showError('Error', 'No se pudo exportar el reporte a Excel.');
    }
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

  calcularTotalEfectivoInicial(): void {
    this.totalEfectivoInicialCalculado = this.calcularTotalEfectivoInicialDesdeDetalle(
      this.obtenerDetalleEfectivoInicialFormulario()
    );
  }

  // Auto completar montos
  autoCompletar(campo: string, montoSistema: number): void {
    this.cierreForm.get(campo)?.setValue(montoSistema);
  }

  autoCompletarBanco(campo: string, montoSistema: number): void {
    this.cierreForm.get(campo)?.setValue(montoSistema);
  }

  // Eventos para inputs (focus que limpia el 0)
  onInputFocus(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    if (input.value === '0' || input.value === '0.00') {
      input.value = '';
    }
  }

  onInputBlur(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    const controlName = input.getAttribute('formControlName');

    if (!controlName) {
      return;
    }

    const formulario = this.inicioCajaForm.get(controlName)
      ? this.inicioCajaForm
      : this.cierreForm.get(controlName)
        ? this.cierreForm
        : this.transaccionForm.get(controlName)
          ? this.transaccionForm
          : null;

    if (!formulario) {
      return;
    }

    const valorCrudo = `${input.value ?? ''}`.trim().replace(',', '.');
    const esFormularioCierre = formulario === this.cierreForm;

    if (valorCrudo === '' && esFormularioCierre) {
      input.value = '';
      formulario.get(controlName)?.setValue(null, { emitEvent: false });
      formulario.get(controlName)?.markAsTouched();
      this.verificarDiferenciaYComentario();
      return;
    }

    const valorNumerico = valorCrudo === '' ? 0 : Number(valorCrudo);
    const valorFinal = Number.isFinite(valorNumerico) && valorNumerico >= 0 ? this.redondearMonto(valorNumerico) : 0;

    input.value = valorFinal.toFixed(2);
    formulario.get(controlName)?.setValue(valorFinal, { emitEvent: false });

    if (formulario === this.inicioCajaForm) {
      this.calcularTotalEfectivoInicial();
    } else if (esFormularioCierre) {
      formulario.get(controlName)?.markAsTouched();
      this.recalcularDiferencias();
    }
  }











  verificarDiferenciaYComentario(): void {
    // Evitar recursión
    if (this.actualizandoValidaciones) return;

    this.actualizandoValidaciones = true;

    try {
      this.configurarValidadoresFormularioCierre();

      const montosCompletos = this.tieneCamposMontosCierreCompletos();
      const diferenciaTotal = montosCompletos ? Math.abs(this.getDiferenciaTotal()) : 0;
      const hayDiferenciaNueva = montosCompletos && diferenciaTotal > 0.01;

      // Solo actualizar si cambió el estado
      this.hayDiferencia = hayDiferenciaNueva;
      this.comentarioRequerido = hayDiferenciaNueva;

      const notasControl = this.cierreForm.get('notasCierre');

      if (this.comentarioRequerido) {
        notasControl?.setValidators([Validators.required, Validators.minLength(10)]);
      } else {
        notasControl?.clearValidators();
      }

      notasControl?.updateValueAndValidity({ emitEvent: false });
    } finally {
      this.actualizandoValidaciones = false;
    }
  }

  // Método para actualizar si el botón de cierre debe estar habilitado
  actualizarBotonCierre(): void {
    const tieneComentarioValido = this.comentarioRequerido
      ? (this.cierreForm.get('notasCierre')?.value?.trim().length >= 10)
      : true;

    const tieneValoresValidos = this.cierreForm.valid;
    const botonHabilitado = tieneValoresValidos && tieneComentarioValido;

    // Puedes usar esto en el template o guardarlo en una propiedad
    // Por ahora, solo actualizamos el estado del formulario
    if (!botonHabilitado) {
      this.cierreForm.markAsPending();
    }
  }

  // Método para obtener la clase del botón de cierre
  getBotonCierreClass(): string {
    const diferenciaTotal = Math.abs(this.getDiferenciaTotal());
    if (diferenciaTotal > 0.01) {
      return 'btn-cerrar-con-diferencia';
    }
    return 'btn-cerrar-sin-diferencia';
  }

  // Método para obtener el texto del botón de cierre
  getBotonCierreTexto(): string {
    const diferenciaTotal = Math.abs(this.getDiferenciaTotal());
    if (diferenciaTotal > 0.01) {
      return '⚠️ Cerrar con Diferencia';
    }
    return '✓ Cerrar Caja';
  }


  recalcularDiferencias(): void {
    if (this.recalculando || !this.cierreActual) return;

    this.recalculando = true;

    try {
      // 1. Calcular diferencia de efectivo
      const efectivoReal = this.getEfectivoRealTotal();
      const efectivoTeorico = this.getEfectivoFinalTeorico();
      const diferenciaEfectivo = this.redondearMonto(efectivoReal - efectivoTeorico);

      // 2. Calcular diferencias por método de pago (YA CONVERTIDAS A USD)
      const diferenciasPunto = this.calcularDiferenciasPunto();
      const diferenciaTransferencia = this.getDiferenciaTransferencia();
      const diferenciaPagomovil = this.getDiferenciaPagomovil();
      const diferenciaZelle = this.getDiferenciaZelle();

      // 3. Calcular diferencia total
      const diferenciaTotal = this.redondearMonto(diferenciaEfectivo +
        diferenciasPunto.total +
        diferenciaTransferencia +
        diferenciaPagomovil +
        diferenciaZelle);

      // 4. Actualizar el cierre actual
      this.cierreActual.diferencia = diferenciaTotal;
      this.cierreActual.efectivoFinalReal = efectivoReal;

      // 5. Actualizar propiedades calculadas
      this._diferenciaTotal = diferenciaTotal;
      this._efectivoTeorico = efectivoTeorico;
      this._efectivoReal = efectivoReal;

      // 6. Verificar si hay diferencia
      this.verificarDiferenciaYComentario();

      // 7. Forzar detección de cambios
      this.cdr.detectChanges();

    } finally {
      this.recalculando = false;
    }
  }

  // Modificar el método realizarCierre existente
  realizarCierre(): void {
    if (!this.tieneCamposMontosCierreCompletos()) {
      this.swalService.showWarning(
        'Conciliación incompleta',
        'Debes completar todos los montos de la conciliación antes de cerrar la caja.'
      );
      return;
    }

    // Validar comentario si hay diferencia
    const diferenciaTotal = Math.abs(this.getDiferenciaTotal());
    const comentario = this.cierreForm.get('notasCierre')?.value?.trim();

    if (diferenciaTotal > 0.01 && (!comentario || comentario.length < 10)) {
      this.swalService.showWarning(
        'Comentario requerido',
        'Debes explicar la diferencia en el campo "Notas de Cierre" (mínimo 10 caracteres)'
      );
      return;
    }

    if (this.cierreForm.invalid) {
      this.swalService.showWarning('Formulario inválido', 'Por favor, completa todos los campos requeridos.');
      return;
    }

    if (!this.cierreActual || !this.currentUser) return;

    const formValue = this.cierreForm.value;

    // Recolectar valores reales ingresados
    const detalleReal: any = {
      efectivo: {
        usd: formValue.efectivoRealUSD || 0,
        eur: formValue.efectivoRealEUR || 0,
        ves: formValue.efectivoRealVES || 0
      },
      punto: this.construirDetalleMetodoReal('punto'),
      transferencia: this.construirDetalleMetodoReal('transferencia'),
      pagomovil: this.construirDetalleMetodoReal('pagomovil'),
      zelle: this.getDestinosMetodo('zelle').length
        ? this.construirDetalleMetodoReal('zelle')
        : (formValue.zelleReal || 0),
      notasCierre: formValue.notasCierre || '',
      fechaCierre: new Date(),
      usuarioCierre: this.currentUser.nombre
    };

    // Guardar detalle en el cierre actual
    this.cierreActual.detalleCierreReal = detalleReal;
    this.cierreActual.estado = 'cerrado';
    this.cierreActual.efectivoFinalReal = this.getEfectivoRealTotal();
    this.cierreActual.diferencia = this.getDiferenciaTotal();
    this.cierreActual.notasCierre = formValue.notasCierre;
    this.cierreActual.usuarioCierre = this.currentUser.nombre;
    this.cierreActual.fechaCierre = new Date();

    // Mostrar confirmación si hay diferencia
    if (diferenciaTotal > 0.01) {
      this.swalService.showConfirm(
        '¿Cerrar caja con diferencia?',
        `La caja presenta una diferencia de ${this.getDiferenciaTotalFormateada()}.<br>
         <strong>Comentario:</strong> "${comentario}"<br><br>
         ¿Estás seguro de cerrar la caja?`,
        'Sí, cerrar con diferencia',
        'Cancelar'
      ).then((result) => {
        if (result.isConfirmed) {
          this.guardarYCerrarCaja(formValue);
        }
      });
    } else {
      this.guardarYCerrarCaja(formValue);
    }
  }

  // Método auxiliar para guardar y cerrar caja
  private guardarYCerrarCaja(formValue: any): void {
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

  convertirAMonedaSistema(monto: number, monedaOrigen: string): number {
    return this.convertirMontoConTasas(monto, monedaOrigen, this.monedaSistema);
  }

  // Obtener tasa de conversión hacia la moneda del sistema
  private getTasaHaciaSistema(monedaOrigen: string): number {
    const tasaOrigen = this.tasasCambio?.[monedaOrigen.toLowerCase()];

    if (!tasaOrigen) return 1;

    if (this.monedaSistema === 'USD') {
      if (monedaOrigen === 'USD') return 1;
      if (monedaOrigen === 'EUR') return tasaOrigen;
      if (monedaOrigen === 'VES') return 1 / tasaOrigen;
    }

    if (this.monedaSistema === 'EUR') {
      if (monedaOrigen === 'EUR') return 1;
      if (monedaOrigen === 'USD') return 1 / tasaOrigen;
      if (monedaOrigen === 'VES') return (1 / this.tasasCambio.bolivar) * (1 / tasaOrigen);
    }

    if (this.monedaSistema === 'VES') {
      if (monedaOrigen === 'VES') return 1;
      if (monedaOrigen === 'USD') return tasaOrigen;
      if (monedaOrigen === 'EUR') return tasaOrigen;
    }

    return 1;
  }

  // Obtener el total real de efectivo en moneda del sistema
  getEfectivoRealTotal(): number {
    const usd = this.cierreForm.get('efectivoRealUSD')?.value || 0;
    const eur = this.cierreForm.get('efectivoRealEUR')?.value || 0;
    const ves = this.cierreForm.get('efectivoRealVES')?.value || 0;

    return this.redondearMonto(
      this.convertirMontoConTasas(usd, 'USD', this.monedaSistema) +
      this.convertirMontoConTasas(eur, 'EUR', this.monedaSistema) +
      this.convertirMontoConTasas(ves, 'VES', this.monedaSistema)
    );
  }

  getEfectivoFinalTeorico(): number {
    if (!this.cierreActual) return 0;

    const efectivoEsperadoUSD = this.getTotalEfectivoEsperadoPorMoneda('USD');
    const efectivoEsperadoEUR = this.getTotalEfectivoEsperadoPorMoneda('EUR');
    const efectivoEsperadoVES = this.getTotalEfectivoEsperadoPorMoneda('VES');

    return this.redondearMonto(
      this.convertirMontoConTasas(efectivoEsperadoUSD, 'USD', this.monedaSistema) +
      this.convertirMontoConTasas(efectivoEsperadoEUR, 'EUR', this.monedaSistema) +
      this.convertirMontoConTasas(efectivoEsperadoVES, 'VES', this.monedaSistema)
    );
  }

  getEgresosEfectivoEnMonedaSistema(): number {
    let totalEgresos = 0;

    this.transacciones
      .filter(t => t.tipo === 'egreso' && t.metodoPago === 'efectivo')
      .forEach(transaccion => {
        let montoEnMonedaSistema = transaccion.monto;

        // Si el egreso tiene moneda específica, convertir
        if (transaccion.moneda && transaccion.moneda !== this.monedaSistema) {
          montoEnMonedaSistema = this.convertirAMonedaSistema(transaccion.monto, transaccion.moneda);
        }

        totalEgresos += montoEnMonedaSistema;
      });

    return this.redondearMonto(totalEgresos);
  }

  getDiferenciaTotalFormateada(): string {
    const diff = this.getDiferenciaTotal();
    const signo = diff > 0 ? '+' : '';
    return `${signo}${diff.toFixed(2)} ${this.simboloMonedaSistema}`;
  }

  getDiferenciaPorMoneda(moneda: string): number {
    const real = this.getMontoRealPorMoneda(moneda);
    const sistema = this.getMontoSistemaPorMoneda(moneda);

    return this.redondearMonto(real - sistema);
  }

  getDiferenciaBadgeClass(diferencia: number): string {
    if (Math.abs(diferencia) < 0.01) return 'bg-secondary';
    return diferencia > 0 ? 'bg-success' : 'bg-danger';
  }

  getDiferenciaTotalClass(): string {
    const diff = this.getDiferenciaTotal();
    if (Math.abs(diff) < 0.01) return 'text-secondary';
    return diff > 0 ? 'text-success' : 'text-danger';
  }

  getMontoRealPorMoneda(moneda: string): number {
    switch (moneda) {
      case 'USD':
        return this.cierreForm.get('efectivoRealUSD')?.value || 0;
      case 'EUR':
        return this.cierreForm.get('efectivoRealEUR')?.value || 0;
      case 'VES':
        return this.cierreForm.get('efectivoRealVES')?.value || 0;
      default:
        return 0;
    }
  }

  getMontoSistemaPorMoneda(moneda: string): number {
    return this.getTotalEfectivoEsperadoPorMoneda(moneda);
  }

  getValorHistoricoMovimientosEfectivo(): number {
    return this.redondearMonto(this.analisisMetodosPago?.efectivo?.total || 0);
  }

  getValorActualMovimientosEfectivo(): number {
    const usd = this.getMovimientoNetoEfectivoPorMoneda('USD');
    const eur = this.getMovimientoNetoEfectivoPorMoneda('EUR');
    const ves = this.getMovimientoNetoEfectivoPorMoneda('VES');

    return this.redondearMonto(
      this.convertirMontoConTasas(usd, 'USD', this.monedaSistema) +
      this.convertirMontoConTasas(eur, 'EUR', this.monedaSistema) +
      this.convertirMontoConTasas(ves, 'VES', this.monedaSistema)
    );
  }

  getAjusteCambiarioEfectivo(): number {
    return this.redondearMonto(this.getValorActualMovimientosEfectivo() - this.getValorHistoricoMovimientosEfectivo());
  }

  tieneAjusteCambiarioEfectivo(): boolean {
    return Math.abs(this.getAjusteCambiarioEfectivo()) > 0.01;
  }
















  // Agrega estos métodos al final de tu componente, antes de la última llave }

  // Obtener el total esperado de efectivo por moneda específica
  getTotalEfectivoEsperadoPorMoneda(moneda: string): number {
    if (!this.cierreActual) return 0;

    const inicial = this.getEfectivoInicialPorMoneda(moneda);
    const movimientosNetos = this.getMovimientoNetoEfectivoPorMoneda(moneda);

    return this.redondearMonto(inicial + movimientosNetos);
  }

  // Obtener efectivo inicial por moneda
  getEfectivoInicialPorMoneda(moneda: string): number {
    if (!this.cierreActual?.efectivoInicialDetalle) return 0;

    switch (moneda) {
      case 'USD':
        return this.cierreActual.efectivoInicialDetalle.USD || 0;
      case 'EUR':
        return this.cierreActual.efectivoInicialDetalle.EUR || 0;
      case 'VES':
        return this.cierreActual.efectivoInicialDetalle.Bs || 0;
      default:
        return 0;
    }
  }

  // Obtener ventas en efectivo por moneda
  getMovimientoNetoEfectivoPorMoneda(moneda: string): number {
    switch (moneda) {
      case 'USD':
        return this.redondearMonto(this.analisisMetodosPago?.efectivo?.porMoneda?.dolar || 0);
      case 'EUR':
        return this.redondearMonto(this.analisisMetodosPago?.efectivo?.porMoneda?.euro || 0);
      case 'VES':
        return this.redondearMonto(this.analisisMetodosPago?.efectivo?.porMoneda?.bolivar || 0);
      default:
        return 0;
    }
  }


  // Auto completar por moneda específica
  autoCompletarEfectivoTotalPorMoneda(moneda: string): void {
    const totalEsperado = this.getTotalEfectivoEsperadoPorMoneda(moneda);

    switch (moneda) {
      case 'USD':
        this.cierreForm.patchValue({ efectivoRealUSD: totalEsperado });
        break;
      case 'EUR':
        this.cierreForm.patchValue({ efectivoRealEUR: totalEsperado });
        break;
      case 'VES':
        this.cierreForm.patchValue({ efectivoRealVES: totalEsperado });
        break;
    }

    //this.swalService.showInfo('Auto completado', `Total esperado para ${moneda}: ${totalEsperado.toFixed(2)}`);
  }

  autoCompletarEfectivoTotal(): void {
    const totalEsperadoUSD = this.getTotalEfectivoEsperadoPorMoneda('USD');
    const totalEsperadoEUR = this.getTotalEfectivoEsperadoPorMoneda('EUR');
    const totalEsperadoVES = this.getTotalEfectivoEsperadoPorMoneda('VES');

    this.cierreForm.patchValue({
      efectivoRealUSD: totalEsperadoUSD,
      efectivoRealEUR: totalEsperadoEUR,
      efectivoRealVES: totalEsperadoVES
    });

   /* this.swalService.showInfo(
      'Auto completado',
      `Se ha completado con los totales esperados:
    USD: ${totalEsperadoUSD.toFixed(2)}
    EUR: ${totalEsperadoEUR.toFixed(2)}
    VES: ${totalEsperadoVES.toFixed(2)}`
    );*/
  }

  // Auto completar efectivo por moneda específica
  autoCompletarEfectivoPorMoneda(moneda: string): void {
    const totalEsperado = this.getTotalEfectivoEsperadoPorMoneda(moneda);

    switch (moneda) {
      case 'USD':
        this.cierreForm.patchValue({ efectivoRealUSD: totalEsperado });
      //  this.swalService.showInfo('Auto completado', `Total esperado para USD: ${totalEsperado.toFixed(2)}`);
        break;
      case 'EUR':
        this.cierreForm.patchValue({ efectivoRealEUR: totalEsperado });
      //  this.swalService.showInfo('Auto completado', `Total esperado para EUR: ${totalEsperado.toFixed(2)}`);
        break;
      case 'VES':
        this.cierreForm.patchValue({ efectivoRealVES: totalEsperado });
      //  this.swalService.showInfo('Auto completado', `Total esperado para VES: ${totalEsperado.toFixed(2)}`);
        break;
    }
  }

  // Auto completar Transferencia
  autoCompletarTransferencia(): void {
    if (this.getDestinosMetodo('transferencia').length) {
      this.getDestinosMetodo('transferencia').forEach((item) => this.autoCompletarMetodoPorDestino('transferencia', item));
      return;
    }

    const montoSistema = this.analisisMetodosPago?.transferencia?.total || 0;

    this.cierreForm.patchValue({ transferenciaRealTotal: montoSistema });
    //this.swalService.showInfo('Auto completado', `Monto del sistema: ${montoSistema.toFixed(2)} ${this.monedaSistema}`);
  }

  // Auto completar Pago Móvil
  autoCompletarPagomovil(): void {
    if (this.getDestinosMetodo('pagomovil').length) {
      this.getDestinosMetodo('pagomovil').forEach((item) => this.autoCompletarMetodoPorDestino('pagomovil', item));
      return;
    }

    const montoSistema = this.analisisMetodosPago?.pagomovil?.total || 0;

    this.cierreForm.patchValue({ pagomovilRealTotal: montoSistema });
   // this.swalService.showInfo('Auto completado', `Monto del sistema: ${montoSistema.toFixed(2)} ${this.monedaSistema}`);
  }

  // Auto completar Zelle
  autoCompletarZelle(): void {
    if (this.getDestinosMetodo('zelle').length) {
      this.getDestinosMetodo('zelle').forEach((item) => this.autoCompletarMetodoPorDestino('zelle', item));
      return;
    }

    const montoSistema = this.analisisMetodosPago?.zelle?.total || 0;
    this.cierreForm.patchValue({ zelleReal: montoSistema });
    //this.swalService.showInfo('Auto completado', `Monto del sistema: ${montoSistema.toFixed(2)} ${this.monedaSistema}`);
  }

  // Auto completar Punto por banco
  autoCompletarPuntoPorBanco(bancoCodigo: string, montoSistema: number): void {
    const banco = this.getDestinosMetodo('punto').find((item) => item.bancoCodigo === bancoCodigo || item.destinoKey === bancoCodigo);
    const controlName = banco ? this.getNombreControlMetodo('punto', banco) : `puntoReal_${bancoCodigo}`;

    this.cierreForm.patchValue({ [controlName]: montoSistema });
   // this.swalService.showInfo('Auto completado', `Monto del sistema para ${bancoCodigo}: ${montoSistema.toFixed(2)} ${this.monedaSistema}`);
  }

  // Convertir USD a VES para mostrar
  convertirUSDaVES(montoUSD: number): number {
    return montoUSD * this.getTasaUSDaVESActual();
  }

  // Formatear diferencia de punto
  getDiferenciaPuntoFormateada(): string {
    const diff = this.getDiferenciaPunto();
    return diff > 0 ? `+${diff.toFixed(2)} ${this.monedaSistema}` : `${diff.toFixed(2)} ${this.monedaSistema}`;
  }

  // Formatear diferencia de transferencia
  getDiferenciaTransferenciaFormateada(): string {
    const diff = this.getDiferenciaTransferencia();
    return diff > 0 ? `+${diff.toFixed(2)} ${this.monedaSistema}` : `${diff.toFixed(2)} ${this.monedaSistema}`;
  }

  // Formatear diferencia de pago móvil
  getDiferenciaPagomovilFormateada(): string {
    const diff = this.getDiferenciaPagomovil();
    return diff > 0 ? `+${diff.toFixed(2)} ${this.monedaSistema}` : `${diff.toFixed(2)} ${this.monedaSistema}`;
  }

  // Formatear diferencia de zelle
  getDiferenciaZelleFormateada(): string {
    const diff = this.getDiferenciaZelle();
    return diff > 0 ? `+${diff.toFixed(2)} ${this.monedaSistema}` : `${diff.toFixed(2)} ${this.monedaSistema}`;
  }

  // Getters para usar en el template
  get diferenciaTotal(): number {
    return this._diferenciaTotal;
  }

  get efectivoTeorico(): number {
    return this._efectivoTeorico;
  }

  get efectivoReal(): number {
    return this._efectivoReal;
  }

  get diferenciaTotalFormateada(): string {
    const signo = this._diferenciaTotal > 0 ? '+' : '';
    return `${signo}${this._diferenciaTotal.toFixed(2)} ${this.simboloMonedaSistema}`;
  }

  // Método para obtener la diferencia de efectivo formateada
  getDiferenciaEfectivoFormateada(): string {
    const diff = this.getDiferenciaEfectivo();
    const signo = diff > 0 ? '+' : '';
    return `${signo}${diff.toFixed(2)} ${this.simboloMonedaSistema}`;
  }

  // Formatear el total real de efectivo
  getEfectivoRealTotalFormateado(): string {
    return `${this.getEfectivoRealTotal().toFixed(2)} ${this.simboloMonedaSistema}`;
  }

  // Formatear el total teórico de efectivo
  getEfectivoTeoricoFormateado(): string {
    return `${this.getEfectivoFinalTeorico().toFixed(2)} ${this.simboloMonedaSistema}`;
  }

  // Diferencia de punto (convertir sistema de VES a USD correctamente)
  getDiferenciaPunto(): number {
    return this.getDiferenciaMetodoDesdeDestinos('punto');
  }

  // Diferencia de transferencia
  getDiferenciaTransferencia(): number {
    if (this.getDestinosMetodo('transferencia').length) {
      return this.getDiferenciaMetodoDesdeDestinos('transferencia');
    }

    const real = Number(this.cierreForm.get('transferenciaRealTotal')?.value || 0);
    const sistema = Number(this.analisisMetodosPago?.transferencia?.total || 0);

    return this.redondearMonto(real - sistema);
  }

  // Diferencia de pago móvil
  getDiferenciaPagomovil(): number {
    if (this.getDestinosMetodo('pagomovil').length) {
      return this.getDiferenciaMetodoDesdeDestinos('pagomovil');
    }

    const real = Number(this.cierreForm.get('pagomovilRealTotal')?.value || 0);
    const sistema = Number(this.analisisMetodosPago?.pagomovil?.total || 0);

    return this.redondearMonto(real - sistema);
  }

  // Diferencia de Zelle (ya está en USD)
  getDiferenciaZelle(): number {
    if (this.getDestinosMetodo('zelle').length) {
      return this.getDiferenciaMetodoDesdeDestinos('zelle');
    }

    const real = Number(this.cierreForm.get('zelleReal')?.value || 0);
    const sistema = Number(this.analisisMetodosPago?.zelle?.total || 0);

    return this.redondearMonto(real - sistema);
  }

  // Diferencia de efectivo
  getDiferenciaEfectivo(): number {
    const real = this.getEfectivoRealTotal();
    const teorico = this.getEfectivoFinalTeorico();
    return this.redondearMonto(real - teorico);
  }

  getDiferenciaOtrosMetodos(): number {
    return this.redondearMonto(this.getDiferenciaTotal() - this.getDiferenciaEfectivo());
  }

  // Diferencia total
  getDiferenciaTotal(): number {
    const diffEfectivo = this.getDiferenciaEfectivo();
    const diffPunto = this.getDiferenciaPunto();
    const diffTransferencia = this.getDiferenciaTransferencia();
    const diffPagomovil = this.getDiferenciaPagomovil();
    const diffZelle = this.getDiferenciaZelle();

    return this.redondearMonto(diffEfectivo + diffPunto + diffTransferencia + diffPagomovil + diffZelle);
  }




}
