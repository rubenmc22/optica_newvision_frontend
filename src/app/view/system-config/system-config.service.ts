import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, delay, of, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import {
  MonedaBaseRequest,
  MonedaBaseResponse,
  NotificationEmailGetResponse,
  NotificationEmailSettings,
  NotificationEmailUpsertRequest,
  NotificationEmailUpsertResponse,
  PaymentMethodAccount,
  PaymentMethodBank,
  PaymentMethodConfig,
  PaymentMethodsGetResponse,
  PaymentMethodsSettings,
  PaymentMethodsUpsertRequest,
  PaymentMethodsUpsertResponse,
  SystemConfig
} from './system-config.interface';
import { environment } from '../../../environments/environment';
import { TasaCambiariaService } from './../../core/services/tasaCambiaria/tasaCambiaria.service';



@Injectable({
  providedIn: 'root'
})

export class SystemConfigService {
  private readonly CONFIG_KEY = 'opticlass_system_config';
  private readonly NOTIFICATION_EMAILS_KEY = 'opticlass_notification_emails';
  private readonly PAYMENT_METHODS_KEY = 'opticlass_payment_methods_settings';

  // Configuración por defecto
  private defaultConfig: SystemConfig = {
    monedaPrincipal: 'USD',
    simboloMoneda: '$',
    decimales: 2,
    ultimaActualizacion: new Date().toISOString()
  };

  private readonly defaultNotificationEmails: NotificationEmailSettings = {
    habilitado: true,
    correoPrincipal: 'notificaciones@opticanewvision.com',
    correoSecundario: 'respaldo.notificaciones@opticanewvision.com',
    correoSeleccionado: 'principal',
    ultimaActualizacion: new Date().toISOString()
  };

  private readonly defaultPaymentMethodBanks: PaymentMethodBank[] = [
    { code: '0102', name: 'Banco de Venezuela', scope: 'national', active: true },
    { code: '0104', name: 'Venezolano de Crédito', scope: 'national', active: true },
    { code: '0105', name: 'Mercantil', scope: 'national', active: true },
    { code: '0108', name: 'Banco Provincial', scope: 'national', active: true },
    { code: '0114', name: 'Bancaribe', scope: 'national', active: true },
    { code: '0115', name: 'Banco Exterior', scope: 'national', active: true },
    { code: '0128', name: 'Banco Caroni', scope: 'national', active: true },
    { code: '0134', name: 'Banesco', scope: 'national', active: true },
    { code: '0137', name: 'Banco Sofitasa', scope: 'national', active: true },
    { code: '0138', name: 'Banco Plaza', scope: 'national', active: true },
    { code: '0146', name: 'Banco de la Gente Emprendedora', scope: 'national', active: true },
    { code: '0151', name: 'Banco Fondo Común', scope: 'national', active: true },
    { code: '0156', name: '100% Banco', scope: 'national', active: true },
    { code: '0157', name: 'DelSur', scope: 'national', active: true },
    { code: '0163', name: 'Banco del Tesoro', scope: 'national', active: true },
    { code: '0166', name: 'Banco Agrícola de Venezuela', scope: 'national', active: true },
    { code: '0168', name: 'Bancrecer', scope: 'national', active: true },
    { code: '0169', name: 'Mi Banco', scope: 'national', active: true },
    { code: '0171', name: 'Banco Activo', scope: 'national', active: true },
    { code: '0172', name: 'Bancamiga', scope: 'national', active: true },
    { code: '0173', name: 'Banco Internacional de Desarrollo', scope: 'national', active: true },
    { code: '0174', name: 'Banplus', scope: 'national', active: true },
    { code: '0175', name: 'Banco Bicentenario del Pueblo', scope: 'national', active: true },
    { code: '0177', name: 'Banco de la Fuerza Armada Nacional Bolivariana', scope: 'national', active: true },
    { code: '0191', name: 'Banco Nacional de Crédito', scope: 'national', active: true },
    { code: '0601', name: 'Instituto Municipal de Crédito Popular', scope: 'national', active: true },
    { code: 'BOFAUS3N', name: 'Bank of America (BOFA)', scope: 'international', active: true },
    { code: 'CHASUS33', name: 'JPMorgan Chase Bank', scope: 'international', active: true },
    { code: 'CITIUS33', name: 'Citibank N.A.', scope: 'international', active: true },
    { code: 'WFBIUS6S', name: 'Wells Fargo Bank', scope: 'international', active: true },
    { code: 'USBKUS44', name: 'U.S. Bank', scope: 'international', active: true },
    { code: 'PNCCUS33', name: 'PNC Bank', scope: 'international', active: true }
  ];

  private readonly defaultPaymentMethodsSettings: PaymentMethodsSettings = {
    bankCatalog: this.defaultPaymentMethodBanks,
    methods: [
      {
        key: 'efectivo',
        label: 'Efectivo',
        description: 'Pago inmediato en caja para operaciones presenciales.',
        enabled: true,
        currency: 'MULTI',
        requiresReceiverAccount: false,
        isCustom: false,
        accounts: []
      },
      {
        key: 'punto_de_venta',
        label: 'Punto de Venta',
        description: 'Cobro con tarjetas procesadas a través de puntos de venta físicos internos.',
        enabled: true,
        currency: 'VES',
        requiresReceiverAccount: true,
        isCustom: false,
        accounts: [
          {
            id: 'punto-1',
            bank: 'Bancamiga',
            bankCode: '0172',
            ownerName: '',
            ownerId: '',
            phone: '',
            accountDescription: 'Punto de venta interno - Óptica Principal'
          },
          {
            id: 'punto-2',
            bank: 'Banco Nacional de Crédito',
            bankCode: '0191',
            ownerName: '',
            ownerId: '',
            phone: '',
            accountDescription: 'Punto de venta interno - Óptica Sucursal'
          }
        ]
      },
      {
        key: 'pago_movil',
        label: 'Pago Móvil',
        description: 'Pago móvil interbancario con selección de banco receptor.',
        enabled: true,
        currency: 'VES',
        requiresReceiverAccount: true,
        isCustom: false,
        accounts: [
          {
            id: 'pm-1',
            bank: 'Banco Provincial',
            bankCode: '0108',
            ownerName: 'Ruben Martinez',
            ownerId: '24367965',
            phone: '04123920817',
            accountDescription: 'Cuenta personal de Ruben'
          },
          {
            id: 'pm-2',
            bank: 'Banco de Venezuela',
            bankCode: '0102',
            ownerName: 'Jesus Castro',
            ownerId: '25874563',
            phone: '04241456878',
            accountDescription: 'Cuenta personal de Jesus'
          }
        ]
      },
      {
        key: 'transferencia',
        label: 'Transferencia',
        description: 'Transferencia bancaria tradicional a cuentas receptoras autorizadas.',
        enabled: true,
        currency: 'VES',
        requiresReceiverAccount: true,
        isCustom: false,
        accounts: [
          {
            id: 'trf-1',
            bank: 'Banco de Venezuela',
            bankCode: '0102',
            ownerName: 'Ruben Perez',
            ownerId: 'V-12345678',
            phone: '04121234567',
            accountDescription: 'Cuenta personal de Ruben'
          },
          {
            id: 'trf-2',
            bank: 'Banesco',
            bankCode: '0134',
            ownerName: 'Ender Rodriguez',
            ownerId: 'V-23456789',
            phone: '04169876543',
            accountDescription: 'Cuenta Ender'
          }
        ]
      },
      {
        key: 'zelle',
        label: 'Zelle',
        description: 'Transferencia electrónica en USD con destino operativo definido.',
        enabled: true,
        currency: 'USD',
        requiresReceiverAccount: true,
        isCustom: false,
        accounts: [
          {
            id: 'zelle-1',
            bank: 'Bank of America (BOFA)',
            bankCode: 'BOFAUS3N',
            ownerName: 'Ruben Perez',
            ownerId: 'V-12345678',
            phone: '+15875551234',
            email: 'ruben.perez@email.com',
            accountDescription: 'Cuenta personal de Ruben (Zelle)'
          }
        ]
      },
      {
        key: 'binance',
        label: 'Binance',
        description: 'Recepción de pagos digitales con wallet operativa y titular configurado.',
        enabled: false,
        currency: 'USDT',
        requiresReceiverAccount: true,
        isCustom: false,
        accounts: [
          {
            id: 'binance-1',
            bank: '',
            bankCode: '',
            ownerName: 'Ruben Martinez',
            ownerId: '',
            phone: '',
            walletAddress: 'TRX-TN8J8A2EXAMPLEWALLET001',
            accountDescription: 'Wallet principal para cobros por Binance Pay'
          }
        ]
      }
    ],
    ultimaActualizacion: new Date().toISOString()
  };

  private configSubject = new BehaviorSubject<SystemConfig>(this.getConfig());
  public config$ = this.configSubject.asObservable();

  constructor(
    private http: HttpClient,
    private tasaCambiariaService: TasaCambiariaService
  ) {
    this.inicializarConfig();
    this.obtenerConfigDesdeBackend();
  }

  /**
   * Obtiene la configuración actual del sistema
   */
  getConfig(): SystemConfig {
    const saved = localStorage.getItem(this.CONFIG_KEY);
    return saved ? JSON.parse(saved) : { ...this.defaultConfig };
  }

  /**
   * Indica si la configuración de correos ya fue persistida localmente
   */
  tieneCorreosNotificacionPersistidos(): boolean {
    return !!localStorage.getItem(this.NOTIFICATION_EMAILS_KEY);
  }

  /**
   * Indica si la configuración de métodos de pago ya fue persistida localmente
   */
  tieneMetodosPagoPersistidos(): boolean {
    return !!localStorage.getItem(this.PAYMENT_METHODS_KEY);
  }

  /**
   * Guarda la configuración en localStorage y notifica a los observadores
   */
  private saveConfig(config: SystemConfig): void {
    localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
    this.configSubject.next(config);
  }

  /**
   * Obtiene la configuración local de correos de notificación
   */
  private getNotificationEmails(): NotificationEmailSettings {
    const saved = localStorage.getItem(this.NOTIFICATION_EMAILS_KEY);
    if (!saved) {
      return { ...this.defaultNotificationEmails };
    }

    try {
      return JSON.parse(saved) as NotificationEmailSettings;
    } catch (error) {
      console.warn('No se pudo leer la configuración local de correos de notificación:', error);
      return { ...this.defaultNotificationEmails };
    }
  }

  /**
   * Guarda la configuración local de correos de notificación
   */
  private saveNotificationEmails(config: NotificationEmailSettings): NotificationEmailSettings {
    localStorage.setItem(this.NOTIFICATION_EMAILS_KEY, JSON.stringify(config));
    return config;
  }

  /**
   * Obtiene los correos de notificación persistidos localmente
   */
  obtenerCorreosNotificacion(): Observable<NotificationEmailGetResponse> {
    return of({
      message: 'ok',
      correos: this.getNotificationEmails()
    }).pipe(delay(250));
  }

  /**
   * Obtiene los métodos de pago configurables persistidos localmente
   */
  obtenerMetodosPagoConfigurables(): Observable<PaymentMethodsGetResponse> {
    return of({
      message: 'ok',
      paymentMethods: this.getPaymentMethodsSettings()
    }).pipe(delay(280));
  }

  /**
   * Guarda la configuración inicial de correos de notificación
   */
  guardarCorreosNotificacion(payload: NotificationEmailUpsertRequest): Observable<NotificationEmailUpsertResponse> {
    return this.persistNotificationEmails(
      payload,
      'Los correos de notificación fueron guardados correctamente.'
    );
  }

  /**
   * Actualiza la configuración existente de correos de notificación
   */
  actualizarCorreosNotificacion(payload: NotificationEmailUpsertRequest): Observable<NotificationEmailUpsertResponse> {
    return this.persistNotificationEmails(
      payload,
      'Los correos de notificación fueron actualizados correctamente.'
    );
  }

  /**
   * Guarda la configuración inicial de métodos de pago
   */
  guardarMetodosPagoConfigurables(payload: PaymentMethodsUpsertRequest): Observable<PaymentMethodsUpsertResponse> {
    return this.persistPaymentMethods(
      payload,
      'La configuración de métodos de pago fue guardada correctamente.'
    );
  }

  /**
   * Actualiza la configuración existente de métodos de pago
   */
  actualizarMetodosPagoConfigurables(payload: PaymentMethodsUpsertRequest): Observable<PaymentMethodsUpsertResponse> {
    return this.persistPaymentMethods(
      payload,
      'La configuración de métodos de pago fue actualizada correctamente.'
    );
  }

  /**
  * Persiste la configuración de correos y devuelve la estructura esperada por la vista
   */
  private persistNotificationEmails(
    payload: NotificationEmailUpsertRequest,
    message: string
  ): Observable<NotificationEmailUpsertResponse> {
    const config = this.saveNotificationEmails({
      habilitado: payload.habilitado,
      correoPrincipal: this.normalizarCorreo(payload.correoPrincipal),
      correoSecundario: this.normalizarCorreo(payload.correoSecundario),
      correoSeleccionado: payload.correoSeleccionado,
      ultimaActualizacion: new Date().toISOString()
    });

    return of({
      message,
      correos: config
    }).pipe(delay(350));
  }

  /**
   * Obtiene la configuración local de métodos de pago
   */
  private getPaymentMethodsSettings(): PaymentMethodsSettings {
    const saved = localStorage.getItem(this.PAYMENT_METHODS_KEY);
    if (!saved) {
      return this.clonePaymentMethodsSettings(this.defaultPaymentMethodsSettings);
    }

    try {
      return this.normalizePaymentMethodsSettings(JSON.parse(saved) as PaymentMethodsSettings);
    } catch (error) {
      console.warn('No se pudo leer la configuración local de métodos de pago:', error);
      return this.clonePaymentMethodsSettings(this.defaultPaymentMethodsSettings);
    }
  }

  /**
   * Guarda la configuración local de métodos de pago
   */
  private savePaymentMethodsSettings(config: PaymentMethodsSettings): PaymentMethodsSettings {
    localStorage.setItem(this.PAYMENT_METHODS_KEY, JSON.stringify(config));
    return config;
  }

  /**
   * Persiste la configuración local de métodos de pago
   */
  private persistPaymentMethods(
    payload: PaymentMethodsUpsertRequest,
    message: string
  ): Observable<PaymentMethodsUpsertResponse> {
    const config = this.savePaymentMethodsSettings(
      this.normalizePaymentMethodsSettings({
        bankCatalog: payload.bankCatalog,
        methods: payload.methods,
        ultimaActualizacion: new Date().toISOString()
      })
    );

    return of({
      message,
      paymentMethods: config
    }).pipe(delay(350));
  }

  /**
   * Normaliza la estructura de métodos de pago antes de persistirla
   */
  private normalizePaymentMethodsSettings(settings: PaymentMethodsSettings): PaymentMethodsSettings {
    const bankCatalog = this.mergePaymentMethodBanks(settings?.bankCatalog);

    const methodSource = Array.isArray(settings?.methods) && settings.methods.length
      ? settings.methods
      : this.defaultPaymentMethodsSettings.methods;

    return {
      bankCatalog,
      methods: methodSource.map(method => this.normalizePaymentMethod(method, bankCatalog)),
      ultimaActualizacion: settings?.ultimaActualizacion || new Date().toISOString()
    };
  }

  /**
   * Normaliza un método de pago individual
   */
  private normalizePaymentMethod(method: PaymentMethodConfig, bankCatalog: PaymentMethodBank[]): PaymentMethodConfig {
    const requiresReceiverAccount = !!method?.requiresReceiverAccount;

    return {
      key: this.normalizeMethodKey(method?.key || method?.label || 'metodo_pago'),
      label: `${method?.label || 'Método de pago'}`.trim(),
      description: `${method?.description || ''}`.trim(),
      enabled: !!method?.enabled,
      currency: this.normalizeMethodCurrency(method?.currency),
      requiresReceiverAccount,
      isCustom: !!method?.isCustom,
      accounts: requiresReceiverAccount
        ? (Array.isArray(method?.accounts) ? method.accounts : []).map(account => this.normalizePaymentAccount(account, bankCatalog))
        : []
    };
  }

  /**
   * Normaliza una cuenta receptora individual
   */
  private normalizePaymentAccount(account: PaymentMethodAccount, bankCatalog: PaymentMethodBank[]): PaymentMethodAccount {
    const normalizedCode = `${account?.bankCode || ''}`.trim();
    const canonicalBank = this.resolveCanonicalBank({
      code: normalizedCode,
      name: `${account?.bank || ''}`.trim()
    });
    const matchedBank = bankCatalog.find(bank => bank.code === (canonicalBank?.code || normalizedCode)) || canonicalBank;

    return {
      id: `${account?.id || this.generateLocalId('account')}`,
      bank: matchedBank?.name || `${account?.bank || ''}`.trim(),
      bankCode: matchedBank?.code || normalizedCode,
      ownerName: `${account?.ownerName || ''}`.trim(),
      ownerId: `${account?.ownerId || ''}`.trim(),
      phone: `${account?.phone || ''}`.trim(),
      email: `${account?.email || ''}`.trim().toLowerCase(),
      walletAddress: `${account?.walletAddress || ''}`.trim(),
      accountDescription: `${account?.accountDescription || ''}`.trim()
    };
  }

  /**
   * Normaliza el alcance del banco en el catálogo
   */
  private normalizeBankScope(bank: Partial<PaymentMethodBank> | undefined): 'national' | 'international' {
    if (bank?.scope === 'international' || bank?.scope === 'national') {
      return bank.scope;
    }

    const knownBank = this.resolveCanonicalBank(bank);

    if (knownBank) {
      return knownBank.scope;
    }

    const code = `${bank?.code || ''}`.trim().toUpperCase();

    return /[A-Z]/.test(code) ? 'international' : 'national';
  }

  /**
   * Normaliza el estado activo del banco para soportar desactivación lógica
   */
  private normalizeBankActive(bank: Partial<PaymentMethodBank> | undefined): boolean {
    return bank?.active !== false;
  }

  /**
   * Mezcla el catálogo persistido con el catálogo por defecto para no perder bancos base ni bancos agregados manualmente
   */
  private mergePaymentMethodBanks(bankCatalog: PaymentMethodBank[] | undefined): PaymentMethodBank[] {
    const mergedBanks = new Map<string, PaymentMethodBank>();

    this.defaultPaymentMethodBanks.forEach(bank => {
      mergedBanks.set(bank.code.trim().toUpperCase(), { ...bank });
    });

    (Array.isArray(bankCatalog) ? bankCatalog : [])
      .map(bank => {
        const canonicalBank = this.resolveCanonicalBank(bank);

        return {
          code: canonicalBank?.code || `${bank?.code || ''}`.trim(),
          name: canonicalBank?.name || `${bank?.name || ''}`.trim(),
          scope: canonicalBank?.scope || this.normalizeBankScope(bank),
          active: this.normalizeBankActive(bank)
        };
      })
      .filter(bank => !!bank.code && !!bank.name)
      .forEach(bank => {
        mergedBanks.set(bank.code.trim().toUpperCase(), bank);
      });

    return Array.from(mergedBanks.values()).sort((current, next) => {
      if (current.scope !== next.scope) {
        return current.scope === 'national' ? -1 : 1;
      }

      if (current.active !== next.active) {
        return current.active ? -1 : 1;
      }

      return current.name.localeCompare(next.name);
    });
  }

  /**
   * Normaliza el identificador interno del método
   */
  private normalizeMethodKey(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'metodo_pago';
  }

  /**
   * Normaliza la moneda configurada para un método
   */
  private normalizeMethodCurrency(currency: string | undefined): 'VES' | 'USD' | 'EUR' | 'CRYPTO' | 'USDT' | 'BTC' | 'ETH' | 'MULTI' {
    const currencies = ['VES', 'USD', 'EUR', 'CRYPTO', 'USDT', 'BTC', 'ETH', 'MULTI'];
    return currencies.includes(`${currency || ''}`) ? currency as 'VES' | 'USD' | 'EUR' | 'CRYPTO' | 'USDT' | 'BTC' | 'ETH' | 'MULTI' : 'VES';
  }

  /**
   * Intenta resolver un banco a su representación canónica a partir del nombre o código.
   */
  private resolveCanonicalBank(bank: Partial<PaymentMethodBank> | { code?: string; name?: string } | undefined): PaymentMethodBank | undefined {
    const normalizedName = this.normalizeBankName(`${bank?.name || ''}`.trim());
    const normalizedCode = `${bank?.code || ''}`.trim().toUpperCase();

    if (normalizedName) {
      const byName = this.defaultPaymentMethodBanks.find(item => this.normalizeBankName(item.name) === normalizedName);
      if (byName) {
        return byName;
      }
    }

    if (!normalizedCode) {
      return undefined;
    }

    return this.defaultPaymentMethodBanks.find(item => item.code.toUpperCase() === normalizedCode);
  }

  /**
   * Normaliza variantes históricas de nombre para corregir catálogos viejos.
   */
  private normalizeBankName(value: string): string {
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    const aliases: Record<string, string> = {
      'banco exterior c.a. banco universal': 'banco exterior',
      'banco caroni': 'banco caroni',
      'banco caribe': 'banco caroni',
      'banco sofitasa banco universal c.a.': 'banco sofitasa',
      'banco plaza banco universal': 'banco plaza',
      'banco de la gente emprendedora c.a.': 'banco de la gente emprendedora',
      'banco fondo comun': 'banco fondo comun',
      '100 banco': '100% banco',
      '100% banco': '100% banco',
      'banco del sur': 'delsur',
      'delsur': 'delsur',
      'bancamiga banco universal c.a.': 'bancamiga',
      'banplus banco universal c.a.': 'banplus',
      'banco bicentenario': 'banco bicentenario del pueblo',
      'banco bicentenario del pueblo': 'banco bicentenario del pueblo',
      'banco de la fuerza armada nacional bolivariana': 'banco de la fuerza armada nacional bolivariana',
      'banfanb': 'banco de la fuerza armada nacional bolivariana',
      'banco nacional de credito': 'banco nacional de credito',
      'bnc venezuela': 'banco nacional de credito',
      'bod': 'banco nacional de credito'
    };

    return aliases[normalized] || normalized;
  }

  /**
   * Genera un identificador local simple para registros temporales
   */
  private generateLocalId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Crea una copia profunda de la configuración local de métodos de pago
   */
  private clonePaymentMethodsSettings(settings: PaymentMethodsSettings): PaymentMethodsSettings {
    return JSON.parse(JSON.stringify(settings)) as PaymentMethodsSettings;
  }

  /**
   * Normaliza el valor del correo antes de persistirlo
   */
  private normalizarCorreo(correo: string): string {
    return correo.trim().toLowerCase();
  }

  /**
   * Inicializa la configuración si no existe
   */
  private inicializarConfig(): void {
    const currentConfig = this.getConfig();
    if (!currentConfig.ultimaActualizacion) {
      this.saveConfig(this.defaultConfig);
    }
  }

  /**
   * Cambia la moneda principal del sistema y guarda en el backend
   */
  cambiarMonedaPrincipal(nuevaMoneda: 'USD' | 'EUR' | 'VES'): Observable<MonedaBaseResponse> {
    const config = this.getConfig();
    const nuevoConfig: SystemConfig = {
      ...config,
      monedaPrincipal: nuevaMoneda,
      simboloMoneda: this.obtenerSimboloMoneda(nuevaMoneda),
      ultimaActualizacion: new Date().toISOString()
    };

    // Guardar localmente inmediatamente
    this.saveConfig(nuevoConfig);

    // Guardar en el backend
    return this.actualizarMonedaBaseBackend(nuevaMoneda).pipe(
      tap({
        next: (response) => {
          // Emitir evento específico para cambio de moneda
          this.notificarCambioMoneda(nuevaMoneda);
        },
        error: (error) => {
          console.error('❌ Error guardando en backend:', error);
          // Aún así notificar el cambio local
          this.notificarCambioMoneda(nuevaMoneda);
        }
      })
    );
  }

  private notificarCambioMoneda(nuevaMoneda: string): void {
    // El config$ ya se actualiza automáticamente, pero podemos emitir un evento específico si es necesario
  }

  /**
   * Convierte un monto entre monedas
   */
  convertirMonto(monto: number, monedaOrigen: string, monedaDestino?: string): number {
    if (!monedaDestino) {
      monedaDestino = this.getMonedaPrincipal();
    }

    if (monedaOrigen === monedaDestino) return monto;

    try {
      const tasaOrigen = this.getTasaPorId(monedaOrigen);
      const tasaDestino = this.getTasaPorId(monedaDestino);
      const montoEnBs = monto * tasaOrigen;
      const resultado = montoEnBs / tasaDestino;

      return Number(resultado.toFixed(this.getConfig().decimales));
    } catch (error) {
      console.error('❌ Error en conversión de moneda:', error);
      return monto;
    }
  }

  /**
   * Actualiza la moneda base en el backend
   */
  private actualizarMonedaBaseBackend(monedaBase: string): Observable<MonedaBaseResponse> {
    const request: MonedaBaseRequest = {
      monedaBase: this.convertirMonedaParaBackend(monedaBase)
    };

    return this.http.put<MonedaBaseResponse>(`${environment.apiUrl}/configuracion/moneda_base-update`, request);
  }

  /**
   * Obtiene la moneda base desde el backend
   */
  obtenerMonedaBaseBackend(): Observable<MonedaBaseResponse> {
    return this.http.get<MonedaBaseResponse>(`${environment.apiUrl}/configuracion/moneda_base-get`);
  }

  /**
   * Convierte el código de moneda al formato que espera el backend
   */
  private convertirMonedaParaBackend(moneda: string): string {
    const conversiones: { [key: string]: string } = {
      'USD': 'dolar',
      'EUR': 'euro',
      'VES': 'bolivar'
    };
    return conversiones[moneda] || 'dolar';
  }

  /**
   * Convierte el código de moneda del backend al formato del frontend
   */
  private convertirMonedaDesdeBackend(moneda: string): 'USD' | 'EUR' | 'VES' {
    const conversiones: { [key: string]: 'USD' | 'EUR' | 'VES' } = {
      'dolar': 'USD',
      'euro': 'EUR',
      'bolivar': 'VES'
    };
    return conversiones[moneda] || 'USD';
  }

  /**
   * Obtiene la configuración desde el backend
   */
  obtenerConfigDesdeBackend(): void {
    this.obtenerMonedaBaseBackend().subscribe({
      next: (response) => {

        if (response && response.moneda_base) {
          const monedaPrincipal = this.convertirMonedaDesdeBackend(response.moneda_base);

          const nuevoConfig: SystemConfig = {
            ...this.getConfig(),
            monedaPrincipal: monedaPrincipal,
            simboloMoneda: this.obtenerSimboloMoneda(monedaPrincipal),
            ultimaActualizacion: new Date().toISOString()
          };

          this.saveConfig(nuevoConfig);
        }
      },
      error: (error) => {
        console.warn('No se pudo cargar configuración desde backend, usando configuración local:', error);
      }
    });
  }

  /**
   * Obtiene el símbolo de la moneda
   */
  private obtenerSimboloMoneda(moneda: string): string {
    const simbolos: { [key: string]: string } = {
      'USD': '$',
      'EUR': '€',
      'VES': 'Bs.'
    };
    return simbolos[moneda] || '$';
  }

  /**
   * Obtiene las tasas actuales desde el servicio existente
   */
  getTasasActuales(): Observable<{ usd: number; eur: number }> {
    return this.tasaCambiariaService.getTasas();
  }

  /**
   * Obtiene el valor actual de una tasa específica
   */
  getTasaPorId(id: string): number {
    const tasasActuales = this.tasaCambiariaService.getTasaActualValor();

    switch (id.toLowerCase()) {
      case 'dolar':
      case 'usd':
        return tasasActuales.usd;
      case 'euro':
      case 'eur':
        return tasasActuales.eur;
      case 'bolivar':
      case 'ves':
        return 1;
      default:
        return 1;
    }
  }

  /**
   * Obtiene información completa de tasas desde la API
   */
  getTasasCompletas(): Observable<any> {
    return this.tasaCambiariaService.getTasaActual();
  }

  /**
   * Reinicia la configuración a los valores por defecto
   */
  resetConfig(): void {
    this.saveConfig({ ...this.defaultConfig });
  }

  /**
   * Obtiene la moneda principal actual
   */
  getMonedaPrincipal(): string {
    return this.getConfig().monedaPrincipal;
  }

  /**
   * Obtiene el símbolo de la moneda principal
   */
  getSimboloMonedaPrincipal(): string {
    return this.getConfig().simboloMoneda;
  }

  /**
   * Actualiza las tasas desde BCV usando el servicio existente
   */
  actualizarTasasBCV(): Observable<any> {
    return this.tasaCambiariaService.updateTasaBCV();
  }
}