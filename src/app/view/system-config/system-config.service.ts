import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, delay, forkJoin, map, of, switchMap, tap } from 'rxjs';
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
  PaymentMethodBankApiItem,
  PaymentMethodBackendResponse,
  PaymentMethodBackendUpdateRequest,
  PaymentMethodBankBackendResponse,
  PaymentMethodBankBackendUpdateRequest,
  PaymentMethodBanksCatalogResponse,
  PaymentMethodConfig,
  PaymentMethodsBackendGetResponse,
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
    methods: [],
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
    const localSettings = this.getPaymentMethodsSettings();

    return forkJoin({
      banksResponse: this.obtenerCatalogoBancosReceptores().pipe(
        catchError((error) => {
          console.warn('No se pudo cargar el catálogo real de bancos receptores:', error);
          return of(null);
        })
      ),
      methodsResponse: this.obtenerMetodosPagoDesdeBackend().pipe(
        catchError((error) => {
          console.warn('No se pudo cargar la configuración de métodos de pago desde el backend:', error);
          return of(null);
        })
      )
    }).pipe(
      map(({ banksResponse, methodsResponse }) => {
        const hasBackendMethods = !!methodsResponse && Array.isArray(methodsResponse.metodos) && methodsResponse.metodos.length > 0;
        const paymentMethods = this.normalizePaymentMethodsSettings({
          bankCatalog: banksResponse ? this.adaptarBancosDesdeBackend(banksResponse.bancos) : localSettings.bankCatalog,
          methods: methodsResponse?.metodos ?? [],
          ultimaActualizacion: methodsResponse?.ultimaActualizacion || new Date().toISOString()
        });

        let message = 'ok';
        let persisted = false;

        if (banksResponse && methodsResponse) {
          message = methodsResponse.message;
          persisted = hasBackendMethods;
        } else if (banksResponse) {
          message = 'Catálogo de bancos cargado desde el backend; no hay métodos de pago agregados en este momento.';
          persisted = false;
        } else if (methodsResponse) {
          message = methodsResponse.message;
          persisted = hasBackendMethods;
        }

        return {
          message,
          paymentMethods,
          persisted
        };
      }),
      tap(({ paymentMethods }) => this.savePaymentMethodsSettings(paymentMethods))
    );
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
    return this.persistirMetodosPagoConfigurables(payload, 'Los métodos de pago fueron guardados correctamente.');
  }

  /**
   * Actualiza la configuración existente de métodos de pago
   */
  actualizarMetodosPagoConfigurables(payload: PaymentMethodsUpsertRequest): Observable<PaymentMethodsUpsertResponse> {
    return this.persistirMetodosPagoConfigurables(payload, 'Los métodos de pago fueron actualizados correctamente.');
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
   * Obtiene el catálogo real de bancos receptores desde el backend
   */
  private obtenerCatalogoBancosReceptores(): Observable<PaymentMethodBanksCatalogResponse> {
    return this.http.get<PaymentMethodBanksCatalogResponse>(`${environment.apiUrl}/configuracion/bancos_receptores-get`);
  }

  /**
   * Obtiene la lista de métodos de pago desde el backend
   */
  private obtenerMetodosPagoDesdeBackend(): Observable<PaymentMethodsBackendGetResponse> {
    return this.http.get<PaymentMethodsBackendGetResponse>(`${environment.apiUrl}/configuracion/metodos_pago_config-get`);
  }

  /**
   * Adapta los bancos del backend al catálogo del frontend
   */
  private adaptarBancosDesdeBackend(bancos: PaymentMethodBankApiItem[] | undefined): PaymentMethodBank[] {
    return (Array.isArray(bancos) ? bancos : []).map((banco) => ({
      code: `${banco?.codigo || ''}`.trim().toUpperCase(),
      name: `${banco?.nombre || ''}`.trim(),
      scope: banco?.scope === 'international' ? 'international' : 'national',
      active: banco?.activo !== false
    }));
  }

  /**
   * Persiste la configuración de bancos y métodos mediante operaciones individuales y luego refresca el estado agregado.
   */
  private persistirMetodosPagoConfigurables(
    payload: PaymentMethodsUpsertRequest,
    successMessage: string
  ): Observable<PaymentMethodsUpsertResponse> {
    const normalizedTarget = this.normalizePaymentMethodsSettings({
      bankCatalog: payload.bankCatalog,
      methods: payload.methods,
      ultimaActualizacion: new Date().toISOString()
    });
    const baseline = this.getPaymentMethodsSettings();
    const syncOperations = [
      ...this.construirOperacionesBancos(baseline.bankCatalog, normalizedTarget.bankCatalog),
      ...this.construirOperacionesMetodos(baseline.methods, normalizedTarget.methods)
    ];

    const sync$ = syncOperations.length ? forkJoin(syncOperations) : of([]);

    return sync$.pipe(
      switchMap(() => this.refrescarMetodosPagoDesdeBackend(normalizedTarget)),
      map((paymentMethods) => ({
        message: successMessage,
        paymentMethods
      })),
      tap(({ paymentMethods }) => this.savePaymentMethodsSettings(paymentMethods))
    );
  }

  /**
   * Refresca la configuración agregada desde backend usando fallback local si una de las colecciones falla.
   */
  private refrescarMetodosPagoDesdeBackend(fallback: PaymentMethodsSettings): Observable<PaymentMethodsSettings> {
    return forkJoin({
      banksResponse: this.obtenerCatalogoBancosReceptores().pipe(catchError(() => of(null))),
      methodsResponse: this.obtenerMetodosPagoDesdeBackend().pipe(catchError(() => of(null)))
    }).pipe(
      map(({ banksResponse, methodsResponse }) => this.normalizePaymentMethodsSettings({
        bankCatalog: banksResponse ? this.adaptarBancosDesdeBackend(banksResponse.bancos) : fallback.bankCatalog,
        methods: methodsResponse?.metodos || fallback.methods,
        ultimaActualizacion: methodsResponse?.ultimaActualizacion || fallback.ultimaActualizacion || new Date().toISOString()
      }))
    );
  }

  /**
   * Construye las operaciones de sincronización para bancos.
   */
  private construirOperacionesBancos(actuales: PaymentMethodBank[], siguientes: PaymentMethodBank[]): Observable<unknown>[] {
    const actualesPorCodigo = new Map(actuales.map((banco) => [banco.code, banco]));

    return siguientes.reduce<Observable<unknown>[]>((operations, banco) => {
      const actual = actualesPorCodigo.get(banco.code);

      if (!actual) {
        operations.push(this.crearBancoReceptor(banco));
        return operations;
      }

      if (this.bancoCambio(actual, banco)) {
        operations.push(this.actualizarBancoReceptor(banco));
      }

      return operations;
    }, []);
  }

  /**
   * Construye las operaciones de sincronización para métodos.
   */
  private construirOperacionesMetodos(actuales: PaymentMethodConfig[], siguientes: PaymentMethodConfig[]): Observable<unknown>[] {
    const actualesPorKey = new Map(actuales.map((metodo) => [metodo.key, metodo]));

    return siguientes.reduce<Observable<unknown>[]>((operations, metodo) => {
      const actual = actualesPorKey.get(metodo.key);

      if (!actual) {
        operations.push(this.crearMetodoPago(metodo));
        return operations;
      }

      if (this.metodoCambio(actual, metodo)) {
        operations.push(this.actualizarMetodoPago(metodo));
      }

      return operations;
    }, []);
  }

  /**
   * Crea un banco receptor en backend.
   */
  private crearBancoReceptor(banco: PaymentMethodBank): Observable<PaymentMethodBankBackendResponse> {
    return this.http.post<PaymentMethodBankBackendResponse>(
      `${environment.apiUrl}/configuracion/bancos_receptores-save`,
      this.construirPayloadBancoBackend(banco, true)
    );
  }

  /**
   * Actualiza un banco receptor en backend.
   */
  private actualizarBancoReceptor(banco: PaymentMethodBank): Observable<PaymentMethodBankBackendResponse> {
    return this.http.put<PaymentMethodBankBackendResponse>(
      `${environment.apiUrl}/configuracion/bancos_receptores-update/${encodeURIComponent(banco.code)}`,
      this.construirPayloadBancoBackend(banco, false)
    );
  }

  /**
   * Crea un método de pago en backend.
   */
  private crearMetodoPago(metodo: PaymentMethodConfig): Observable<PaymentMethodBackendResponse> {
    return this.http.post<PaymentMethodBackendResponse>(
      `${environment.apiUrl}/configuracion/metodos_pago_config-save`,
      this.construirPayloadMetodoBackend(metodo, true)
    );
  }

  /**
   * Actualiza un método de pago en backend.
   */
  private actualizarMetodoPago(metodo: PaymentMethodConfig): Observable<PaymentMethodBackendResponse> {
    return this.http.put<PaymentMethodBackendResponse>(
      `${environment.apiUrl}/configuracion/metodos_pago_config-update/${encodeURIComponent(metodo.key)}`,
      this.construirPayloadMetodoBackend(metodo, false)
    );
  }

  /**
   * Construye el payload de banco para backend.
   */
  private construirPayloadBancoBackend(
    banco: PaymentMethodBank,
    includeCode: boolean
  ): PaymentMethodBankApiItem | PaymentMethodBankBackendUpdateRequest {
    const payload = {
      nombre: banco.name.trim(),
      scope: banco.scope,
      activo: banco.active !== false
    };

    if (includeCode) {
      return {
        codigo: banco.code.trim().toUpperCase(),
        ...payload
      };
    }

    return payload;
  }

  /**
   * Construye el payload de método para backend.
   */
  private construirPayloadMetodoBackend(
    metodo: PaymentMethodConfig,
    includeKey: boolean
  ): PaymentMethodConfig | PaymentMethodBackendUpdateRequest {
    const payload = {
      label: metodo.label.trim(),
      description: metodo.description.trim(),
      enabled: !!metodo.enabled,
      currency: this.normalizeMethodCurrency(metodo.currency),
      requiresReceiverAccount: !!metodo.requiresReceiverAccount,
      isCustom: !!metodo.isCustom,
      accounts: metodo.accounts.map((cuenta) => ({
        ...cuenta,
        bank: cuenta.bank.trim(),
        bankCode: cuenta.bankCode.trim().toUpperCase(),
        ownerName: cuenta.ownerName.trim(),
        ownerId: cuenta.ownerId.trim(),
        phone: cuenta.phone.trim(),
        email: cuenta.email?.trim().toLowerCase() || '',
        walletAddress: cuenta.walletAddress?.trim() || '',
        accountDescription: cuenta.accountDescription.trim()
      }))
    };

    if (includeKey) {
      return {
        key: metodo.key,
        ...payload
      };
    }

    return payload;
  }

  /**
   * Determina si un banco cambió respecto al estado base.
   */
  private bancoCambio(actual: PaymentMethodBank, siguiente: PaymentMethodBank): boolean {
    return JSON.stringify({
      name: actual.name.trim(),
      scope: actual.scope,
      active: actual.active !== false
    }) !== JSON.stringify({
      name: siguiente.name.trim(),
      scope: siguiente.scope,
      active: siguiente.active !== false
    });
  }

  /**
   * Determina si un método cambió respecto al estado base.
   */
  private metodoCambio(actual: PaymentMethodConfig, siguiente: PaymentMethodConfig): boolean {
    return JSON.stringify(this.normalizarMetodoParaComparacion(actual)) !== JSON.stringify(this.normalizarMetodoParaComparacion(siguiente));
  }

  /**
   * Normaliza un método para comparaciones profundas.
   */
  private normalizarMetodoParaComparacion(metodo: PaymentMethodConfig): unknown {
    return {
      key: metodo.key,
      label: metodo.label.trim(),
      description: metodo.description.trim(),
      enabled: !!metodo.enabled,
      currency: this.normalizeMethodCurrency(metodo.currency),
      requiresReceiverAccount: !!metodo.requiresReceiverAccount,
      isCustom: !!metodo.isCustom,
      accounts: metodo.accounts.map((cuenta) => ({
        bank: cuenta.bank.trim(),
        bankCode: cuenta.bankCode.trim().toUpperCase(),
        ownerName: cuenta.ownerName.trim(),
        ownerId: cuenta.ownerId.trim(),
        phone: cuenta.phone.trim(),
        email: cuenta.email?.trim().toLowerCase() || '',
        walletAddress: cuenta.walletAddress?.trim() || '',
        accountDescription: cuenta.accountDescription.trim()
      }))
    };
  }

  /**
   * Normaliza la estructura de métodos de pago antes de persistirla
   */
  private normalizePaymentMethodsSettings(settings: PaymentMethodsSettings): PaymentMethodsSettings {
    const bankCatalogSource = Array.isArray(settings?.bankCatalog) && settings.bankCatalog.length
      ? settings.bankCatalog
      : this.defaultPaymentMethodBanks;
    const bankCatalog = this.normalizePaymentMethodBanks(bankCatalogSource);

    const methodSource = Array.isArray(settings?.methods)
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
   * Normaliza el catálogo de bancos respetando el origen recibido.
   */
  private normalizePaymentMethodBanks(bankCatalog: PaymentMethodBank[] | undefined): PaymentMethodBank[] {
    const mergedBanks = new Map<string, PaymentMethodBank>();

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
    const configAnterior = this.getConfig();
    const nuevoConfig: SystemConfig = {
      ...configAnterior,
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
          this.saveConfig(configAnterior);
        }
      })
    );
  }

  private notificarCambioMoneda(nuevaMoneda: string): void {
    // El config$ ya se actualiza automáticamente, pero podemos emitir un evento específico si es necesario
  }

    normalizarMonedaId(moneda?: string): 'dolar' | 'euro' | 'bolivar' {
      const valor = (moneda || 'USD').toString().trim().toLowerCase();

      if (['usd', 'dolar', 'dólar', '$'].includes(valor)) {
        return 'dolar';
      }

      if (['eur', 'euro', '€'].includes(valor)) {
        return 'euro';
      }

      return 'bolivar';
    }

  /**
   * Convierte un monto entre monedas
   */
  convertirMonto(monto: number, monedaOrigen: string, monedaDestino?: string): number {
      const origenNormalizado = this.normalizarMonedaId(monedaOrigen);
      const destinoNormalizado = this.normalizarMonedaId(monedaDestino || this.getMonedaPrincipal());

      if (origenNormalizado === destinoNormalizado) {
        return Number(monto);
    }

    try {
        const tasaOrigen = this.getTasaPorId(origenNormalizado);
        const tasaDestino = this.getTasaPorId(destinoNormalizado);
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
    return this.normalizarMonedaId(moneda);
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
    const monedaNormalizada = this.normalizarMonedaId(id);

    switch (monedaNormalizada) {
      case 'dolar':
        return tasasActuales.usd;
      case 'euro':
        return tasasActuales.eur;
      case 'bolivar':
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