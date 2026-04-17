import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { CierreCajaService } from './cierre-caja.service';
import { ExcelExportService } from '../../../core/services/excel-export/excel-export.service';
import { SystemConfigService } from './../../system-config/system-config.service';
import { TasaCambiariaService } from './../../../core/services/tasaCambiaria/tasaCambiaria.service';
import { UserStateService } from './../../../core/services/userState/user-state-service';
import { Sede, SedeCompleta } from '../../../view/login/login-interface';
import { CierreDiario, Transaccion, ResumenMetodoPago, TasasCambio } from './cierre-caja.interfaz';
import { User, Rol, AuthData, AuthResponse, Cargo } from '../../../Interfaces/models-interface';
import { SwalService } from '../../../core/services/swal/swal.service';
import { GenerarVentaService } from '../generar-venta/generar-venta.service';
import { buildVentaPaymentCatalog, VentaReceiverAccountOption } from '../shared/payment-catalog.util';
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
    punto: { total: number; porBanco: any[]; cantidad: number };
    pagomovil: { total: number; cantidad: number; porBanco: any[] };
    transferencia: { total: number; cantidad: number; porBanco: any[] };
    zelle: { total: number; cantidad: number; porBanco: any[] };
  } = {
      efectivo: { total: 0, porMoneda: { dolar: 0, euro: 0, bolivar: 0 }, cantidad: 0 },
      punto: { total: 0, porBanco: [], cantidad: 0 },
      pagomovil: { total: 0, cantidad: 0, porBanco: [] },
      transferencia: { total: 0, cantidad: 0, porBanco: [] },
      zelle: { total: 0, cantidad: 0, porBanco: [] }
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
  cuentasReceptorasConfiguradasPorMetodo: Record<string, VentaReceiverAccountOption[]> = buildVentaPaymentCatalog().cuentasReceptorasPorMetodo;

  // Métodos de pago disponibles
  metodosPago = [
    { valor: 'efectivo', label: 'Efectivo', icono: 'bi-cash-coin', color: '#10b981' },
    { valor: 'tarjeta', label: 'Tarjeta', icono: 'bi-credit-card', color: '#8b5cf6' },
    { valor: 'transferencia', label: 'Transferencia', icono: 'bi-bank', color: '#3b82f6' },
    { valor: 'debito', label: 'Débito', icono: 'bi-credit-card-2-back', color: '#0ea5e9' },
    { valor: 'credito', label: 'Crédito', icono: 'bi-credit-card-2-front', color: '#f59e0b' },
    { valor: 'pagomovil', label: 'Pago Móvil', icono: 'bi-phone', color: '#ec4899' },
    { valor: 'zelle', label: 'Zelle', icono: 'bi-globe-americas', color: '#8b5cf6' }
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
  usaModoDummy = false;

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
    private cdr: ChangeDetectorRef,
    private systemConfigService: SystemConfigService,
    private tasaCambiariaService: TasaCambiariaService, // Nuevo
    private userStateService: UserStateService,
    private generarVentaService: GenerarVentaService,
    private excelExportService: ExcelExportService,
    private swalService: SwalService
  ) {
    this.inicializarForms();
    this.checkMobile();
    this.usaModoDummy = this.cierreCajaService.estaUsandoDummy();

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
          this.cuentasReceptorasConfiguradasPorMetodo = catalogo.cuentasReceptorasPorMetodo;

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
    return this.getMontoRealMetodoPorDestino(tipo, item) - Number(item?.total || 0);
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
      tipo: ['venta', Validators.required],
      descripcion: ['', [Validators.required, Validators.minLength(3)]],
      monto: [0, [Validators.required, Validators.min(0.01)]],
      metodoPago: ['efectivo', Validators.required],
      categoria: ['venta_lentes'],
      comprobante: [''],
      observaciones: ['']
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
      punto: { total: 0, porBanco: [], cantidad: 0 },
      pagomovil: { total: 0, cantidad: 0, porBanco: [] },
      transferencia: { total: 0, cantidad: 0, porBanco: [] },
      zelle: { total: 0, cantidad: 0, porBanco: [] }
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

    trans.detalleMetodosPago.forEach(metodo => {
      const tipo = metodo.tipo;
      const montoOriginal = Number(metodo.monto || 0);
      const moneda = metodo.moneda || trans.monedaOriginal || trans.moneda || 'USD';
      const monedaNormalizada = this.obtenerCodigoMoneda(moneda);
      const montoEnMonedaSistema = this.getMontoMetodoPagoSistema(metodo, trans);

      if (tipo === 'efectivo') {
        this.analisisMetodosPago.efectivo.total += montoEnMonedaSistema;
        this.analisisMetodosPago.efectivo.cantidad++;

        if (monedaNormalizada === 'USD') {
          this.analisisMetodosPago.efectivo.porMoneda.dolar += montoOriginal;
        } else if (monedaNormalizada === 'EUR') {
          this.analisisMetodosPago.efectivo.porMoneda.euro += montoOriginal;
        } else {
          this.analisisMetodosPago.efectivo.porMoneda.bolivar += montoOriginal;
        }
      }
      else if (tipo === 'punto') {
        this.analisisMetodosPago.punto.total += montoEnMonedaSistema;
        this.analisisMetodosPago.punto.cantidad++;

        const destino = this.obtenerInfoDestinoMetodo(metodo, 'punto');
        let bancoExistente = this.analisisMetodosPago.punto.porBanco.find(b => b.destinoKey === destino.destinoKey);
        if (!bancoExistente) {
          bancoExistente = {
            ...destino,
            total: 0,
            totalOriginal: 0,
            cantidad: 0
          };
          this.analisisMetodosPago.punto.porBanco.push(bancoExistente);
        }
        bancoExistente.total += montoEnMonedaSistema;
        bancoExistente.totalOriginal += montoOriginal;
        bancoExistente.cantidad++;
      }
      else if (tipo === 'pagomovil') {
        this.analisisMetodosPago.pagomovil.total += montoEnMonedaSistema;
        this.analisisMetodosPago.pagomovil.cantidad++;

        const destino = this.obtenerInfoDestinoMetodo(metodo, 'pagomovil');
        let bancoExistente = this.analisisMetodosPago.pagomovil.porBanco.find(b => b.destinoKey === destino.destinoKey);
        if (!bancoExistente) {
          bancoExistente = {
            ...destino,
            total: 0,
            totalOriginal: 0,
            cantidad: 0
          };
          this.analisisMetodosPago.pagomovil.porBanco.push(bancoExistente);
        }
        bancoExistente.total += montoEnMonedaSistema;
        bancoExistente.totalOriginal += montoOriginal;
        bancoExistente.cantidad++;
      }
      else if (tipo === 'transferencia') {
        this.analisisMetodosPago.transferencia.total += montoEnMonedaSistema;
        this.analisisMetodosPago.transferencia.cantidad++;

        const destino = this.obtenerInfoDestinoMetodo(metodo, 'transferencia');
        let bancoExistente = this.analisisMetodosPago.transferencia.porBanco.find(b => b.destinoKey === destino.destinoKey);
        if (!bancoExistente) {
          bancoExistente = {
            ...destino,
            total: 0,
            totalOriginal: 0,
            cantidad: 0
          };
          this.analisisMetodosPago.transferencia.porBanco.push(bancoExistente);
        }
        bancoExistente.total += montoEnMonedaSistema;
        bancoExistente.totalOriginal += montoOriginal;
        bancoExistente.cantidad++;
      }
      else if (tipo === 'zelle') {
        this.analisisMetodosPago.zelle.total += montoEnMonedaSistema;
        this.analisisMetodosPago.zelle.cantidad++;

        const destino = this.obtenerInfoDestinoMetodo(metodo, 'zelle');
        let bancoExistente = this.analisisMetodosPago.zelle.porBanco.find(b => b.destinoKey === destino.destinoKey);
        if (!bancoExistente) {
          bancoExistente = {
            ...destino,
            total: 0,
            totalOriginal: 0,
            cantidad: 0
          };
          this.analisisMetodosPago.zelle.porBanco.push(bancoExistente);
        }
        bancoExistente.total += montoEnMonedaSistema;
        bancoExistente.totalOriginal += montoOriginal;
        bancoExistente.cantidad++;
      }
    });

  }

  private procesarFormasPago(trans: Transaccion): void {
    const formaPago = trans.formaPago;
    const total = trans.montoTotal ?? this.getMontoTransaccionSistema(trans);
    const abonado = trans.montoPagado ?? this.getMontoTransaccionSistema(trans);
    const deuda = trans.deudaPendiente ?? Math.max(0, total - abonado);

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
        this.analisisFormasPago.deContadoPendiente.deudaPendiente += deuda || total;
        break;
    }
  }

  private procesarVentasPendientes(trans: Transaccion): void {
    const formaPago = trans.formaPago;
    const tieneDeuda = formaPago === 'de_contado-pendiente' ||
      (formaPago === 'abono' && (trans.deudaPendiente || 0) > 0) ||
      (formaPago === 'cashea' && (trans.deudaPendiente || 0) > 0);

    if (tieneDeuda && trans.numeroVenta) {
      const deuda = trans.deudaPendiente || 0;

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
  }

  private formatearFechaLocal(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private esMismaFechaCalendario(fechaA: Date | string, fechaB: Date | string): boolean {
    return this.formatearFechaLocal(new Date(fechaA)) === this.formatearFechaLocal(new Date(fechaB));
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

  private procesarVentasParaTransacciones(ventas: any[]): void {
    this.transacciones = [];

    ventas.forEach(venta => {
      const tasasHistoricas = venta.formaPagoDetalle?.tasasActuales || venta.formaPago?.tasasActuales || [];
      const monedaVenta = venta.moneda || 'USD';
      const totalOriginal = Number(venta.total || 0);
      const pagadoOriginal = Number(venta.formaPagoDetalle?.totalPagado ?? venta.total_pagado ?? 0);
      const deudaOriginal = Number(venta.formaPagoDetalle?.deuda ?? Math.max(0, totalOriginal - pagadoOriginal));
      const totalSistema = this.convertirMontoConTasas(totalOriginal, monedaVenta, this.monedaSistema, tasasHistoricas);
      const pagadoSistema = this.convertirMontoConTasas(pagadoOriginal, monedaVenta, this.monedaSistema, tasasHistoricas);
      const deudaSistema = this.convertirMontoConTasas(deudaOriginal, monedaVenta, this.monedaSistema, tasasHistoricas);

      // Extraer información de consulta si existe
      const tieneConsulta = venta.consulta && (venta.consulta.pagoMedico > 0 || venta.consulta.pagoOptica > 0);
      const tieneProductos = venta.productos && venta.productos.length > 0;

      const metodosVenta = Array.isArray(venta.metodosDePago) ? venta.metodosDePago : [];
      const metodosAbonos = (venta.formaPagoDetalle?.abonos || []).flatMap((abono: any) =>
        Array.isArray(abono?.metodosDePago) ? abono.metodosDePago : []
      );

      // Crear detalle de métodos de pago enriquecido incluyendo abonos del día
      const detalleMetodos = [...metodosVenta, ...metodosAbonos].map(m => ({
        tipo: m.tipo,
        monto: m.monto,
        moneda: m.moneda || venta.moneda || 'USD',
        montoEnBolivar: m.montoEnBolivar,
        montoEnMonedaVenta: m.montoEnMonedaVenta,
        montoEnMonedaSistema: Number(m.montoEnMonedaSistema ?? m.montoMonedaSistema ?? this.convertirMontoConTasas(Number(m.monto || 0), m.moneda || venta.moneda || 'USD', this.monedaSistema, tasasHistoricas)),
        tasaUsada: m.tasaUsada,
        referencia: m.referencia,
        banco: m.bancoNombre || m.banco,           // ← Incluir banco
        bancoNombre: m.bancoNombre,                 // ← Incluir bancoNombre
        bancoCodigo: m.bancoCodigo,                 // ← Incluir bancoCodigo
        bancoReceptorCodigo: m.bancoReceptorCodigo || m.cuentaReceptora?.bancoCodigo,
        bancoReceptorNombre: m.bancoReceptorNombre || m.cuentaReceptora?.bancoNombre,
        bancoReceptor: m.bancoReceptor || m.cuentaReceptora?.descripcionCuenta || m.cuentaReceptora?.bancoNombre,
        cuentaReceptoraId: m.cuentaReceptoraId || m.cuentaReceptora?.id,
        cuentaReceptoraAlias: m.cuentaReceptoraAlias || m.cuentaReceptora?.alias,
        cuentaReceptoraUltimos4: m.cuentaReceptoraUltimos4 || m.cuentaReceptora?.ultimos4,
        cuentaReceptoraEmail: m.cuentaReceptoraEmail || m.cuentaReceptora?.correo || m.cuentaReceptora?.email,
        cuentaReceptoraTitular: m.cuentaReceptoraTitular || m.cuentaReceptora?.titular || m.cuentaReceptora?.ownerName,
        cuentaReceptoraDocumento: m.cuentaReceptoraDocumento || m.cuentaReceptora?.cedulaRif || m.cuentaReceptora?.ownerId,
        cuentaReceptoraTelefono: m.cuentaReceptoraTelefono || m.cuentaReceptora?.telefono || m.cuentaReceptora?.phone,
        cuentaReceptoraDescripcion: m.cuentaReceptoraDescripcion || m.cuentaReceptora?.descripcionCuenta
      })) || [];

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

    const tipo = metodosDePago[0].tipo;
    return tipo === 'punto' ? 'punto' : tipo;
  }

  getTotalMetodoPago(metodo: string): number {
    let total = 0;
    this.transacciones.forEach(transaccion => {
      if (transaccion.tipo === 'venta' || transaccion.tipo === 'ingreso') {
        if (transaccion.metodoPago === metodo) {
          total += this.getMontoTransaccionSistema(transaccion);
        } else if (transaccion.detalleMetodosPago && transaccion.detalleMetodosPago.length > 0) {
          transaccion.detalleMetodosPago.forEach((m: any) => {
            if (m.tipo === metodo) {
              total += this.getMontoMetodoPagoSistema(m, transaccion);
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
    const nuevaTransaccion: Transaccion = {
      id: this.transaccionEditando?.id || `TRX-${Date.now()}`,
      tipo: formValue.tipo,
      descripcion: formValue.descripcion,
      monto: parseFloat(formValue.monto),
      montoOriginal: parseFloat(formValue.monto),
      montoSistema: this.redondearMonto(parseFloat(formValue.monto)),
      fecha: new Date(),
      metodoPago: formValue.metodoPago,
      moneda: this.obtenerCodigoMoneda(this.monedaSistema),
      monedaOriginal: this.obtenerCodigoMoneda(this.monedaSistema),
      usuario: this.currentUser?.nombre || 'Usuario',
      estado: 'confirmado',
      categoria: formValue.categoria,
      observaciones: formValue.observaciones,
      comprobante: formValue.comprobante
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

  formatearTipoPago(tipo: string): string {
    const tipos: { [key: string]: string } = {
      'efectivo': 'EFECTIVO',
      'debito': 'T. DÉBITO',
      'credito': 'T. CRÉDITO',
      'pagomovil': 'PAGO MÓVIL',
      'transferencia': 'TRANSFERENCIA',
      'zelle': 'ZELLE',
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
    return this.getMontoCierreConvertido(cierre, cierre.efectivoInicial || 0);
  }

  getVentasEfectivoCierre(cierre: CierreDiario): number {
    return this.getMontoCierreConvertido(cierre, cierre.ventasEfectivo || 0);
  }

  getEfectivoFinalRealCierre(cierre: CierreDiario): number {
    return this.getMontoCierreConvertido(cierre, cierre.efectivoFinalReal || 0);
  }

  getDiferenciaCierre(cierre: CierreDiario): number {
    return this.getMontoCierreConvertido(cierre, cierre.diferencia || 0);
  }

  getTotalVentasCierre(cierre: CierreDiario): number {
    const total = cierre.ventasEfectivo + cierre.ventasTarjeta + cierre.ventasTransferencia +
      cierre.ventasDebito + cierre.ventasCredito + cierre.ventasPagomovil + cierre.ventasZelle;

    return this.convertirMontoConTasas(total, cierre.monedaPrincipal || 'USD', this.monedaSistema);
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
        tipo: 'ingreso',
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
      'zelle': '#8b5cf6'
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
      'zelle': 'bi-globe2'
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
    if (!this.cierreActual) return 0;
    return this.cierreActual.efectivoInicial + this.analisisMetodosPago.efectivo.total - this.getEgresosEfectivo();
  }

  getTotalVentasHistorial(): number {
    return this.historialCierres.reduce((sum, cierre) => sum + this.getTotalVentasCierre(cierre), 0);
  }

  getDiferenciaTotalHistorial(): number {
    return this.historialCierres.reduce((sum, cierre) => sum + this.getDiferenciaCierre(cierre), 0);
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
      const diferencia = montoReal - montoSistema;

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

    return { total, porBanco };
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
        diferencia: montoReal - montoSistema,
        cantidadSistema: item?.cantidad || 0,
        cantidadReal: 0
      };
    });
  }

  private getDiferenciaMetodoDesdeDestinos(tipo: 'punto' | 'transferencia' | 'pagomovil' | 'zelle'): number {
    return this.getDestinosMetodo(tipo).reduce((sum, item) => {
      return sum + this.getDiferenciaMetodoPorDestino(tipo, item);
    }, 0);
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
    const transacciones = this.obtenerTransaccionesReporte().map((transaccion) => ({
      hora: this.datePipe.transform(transaccion.fecha, 'HH:mm') || '',
      descripcion: transaccion.descripcion,
      tipo: transaccion.tipo,
      metodo: this.formatearTipoPago(transaccion.metodoPago),
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
      sede: this.sedeActual?.nombre || 'Óptica',
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
        { label: 'Diferencia total', value: diferenciaTotal, format: 'currency', clase: diferenciaTotal > 0 ? 'positive' : diferenciaTotal < 0 ? 'negative' : '' },
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
        { forma: 'Pendiente por pago', total: Number(this.analisisFormasPago.deContadoPendiente.total || 0), deudaPendiente: Number(this.analisisFormasPago.deContadoPendiente.deudaPendiente || 0), cantidad: Number(this.analisisFormasPago.deContadoPendiente.cantidad || 0) }
      ],
      metodos,
      transacciones
    };
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
                ${this.escapeHtml(reporte.sede)}<br>
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
          : '<section class="section-block"><div class="note-box">No hay métodos electrónicos con desglose por banco receptor para este día.</div></section>'}

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
              ${reporte.transacciones.map((fila: any) => `
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
              `).join('')}
            </tbody>
          </table>
        </section>

        <div class="footer-note">${this.escapeHtml(reporte.notaFinal)}</div>
      </div>
    `;
  }

  private generarContenidoReporte(): string {
    const reporte = this.construirReporteEstructurado();

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
      const diferenciaEfectivo = efectivoReal - efectivoTeorico;

      // 2. Calcular diferencias por método de pago (YA CONVERTIDAS A USD)
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

    // El efectivo inicial YA DEBE ESTAR en moneda del sistema
    const inicial = this.cierreActual.efectivoInicial || 0;

    // Las ventas en efectivo YA DEBEN ESTAR en moneda del sistema
    const ventasEfectivo = this.analisisMetodosPago?.efectivo?.total || 0;

    const egresosEfectivo = this.getEgresosEfectivoEnMonedaSistema();

    const teorico = inicial + ventasEfectivo - egresosEfectivo;

    return teorico;
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

    return totalEgresos;
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
















  // Agrega estos métodos al final de tu componente, antes de la última llave }

  // Obtener el total esperado de efectivo por moneda específica
  getTotalEfectivoEsperadoPorMoneda(moneda: string): number {
    if (!this.cierreActual) return 0;

    const inicial = this.getEfectivoInicialPorMoneda(moneda);
    const ventas = this.getVentasEfectivoPorMoneda(moneda);

    return inicial + ventas;
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
  getVentasEfectivoPorMoneda(moneda: string): number {
    switch (moneda) {
      case 'USD':
        return this.analisisMetodosPago?.efectivo?.porMoneda?.dolar || 0;
      case 'EUR':
        return this.analisisMetodosPago?.efectivo?.porMoneda?.euro || 0;
      case 'VES':
        return this.analisisMetodosPago?.efectivo?.porMoneda?.bolivar || 0;
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

    return real - sistema;
  }

  // Diferencia de pago móvil
  getDiferenciaPagomovil(): number {
    if (this.getDestinosMetodo('pagomovil').length) {
      return this.getDiferenciaMetodoDesdeDestinos('pagomovil');
    }

    const real = Number(this.cierreForm.get('pagomovilRealTotal')?.value || 0);
    const sistema = Number(this.analisisMetodosPago?.pagomovil?.total || 0);

    return real - sistema;
  }

  // Diferencia de Zelle (ya está en USD)
  getDiferenciaZelle(): number {
    if (this.getDestinosMetodo('zelle').length) {
      return this.getDiferenciaMetodoDesdeDestinos('zelle');
    }

    const real = Number(this.cierreForm.get('zelleReal')?.value || 0);
    const sistema = Number(this.analisisMetodosPago?.zelle?.total || 0);

    return real - sistema;
  }

  // Diferencia de efectivo
  getDiferenciaEfectivo(): number {
    const real = this.getEfectivoRealTotal();
    const teorico = this.getEfectivoFinalTeorico();
    return real - teorico;
  }

  // Diferencia total
  getDiferenciaTotal(): number {
    const diffEfectivo = this.getDiferenciaEfectivo();
    const diffPunto = this.getDiferenciaPunto();
    const diffTransferencia = this.getDiferenciaTransferencia();
    const diffPagomovil = this.getDiferenciaPagomovil();
    const diffZelle = this.getDiferenciaZelle();

    return diffEfectivo + diffPunto + diffTransferencia + diffPagomovil + diffZelle;
  }




}
