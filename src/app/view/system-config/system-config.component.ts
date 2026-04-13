import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { SystemConfigService } from './system-config.service';
import {
  MonedaBaseResponse,
  NotificationEmailChannel,
  NotificationEmailSettings,
  NotificationEmailUpsertRequest,
  PaymentMethodAccount,
  PaymentMethodBank,
  PaymentMethodBankScope,
  PaymentMethodConfig,
  PaymentMethodCurrency,
  PaymentMethodsSettings,
  PaymentMethodsUpsertRequest,
  SystemConfig
} from './system-config.interface';
import { SwalService } from '../../core/services/swal/swal.service';

function correosDebenSerDistintos(control: AbstractControl): ValidationErrors | null {
  const correoPrincipal = control.get('correoPrincipal')?.value?.trim().toLowerCase();
  const correoSecundario = control.get('correoSecundario')?.value?.trim().toLowerCase();

  if (!correoPrincipal || !correoSecundario) {
    return null;
  }

  return correoPrincipal === correoSecundario ? { correosDuplicados: true } : null;
}

type GeneralSectionKey = 'monedaPrincipal' | 'metodosPago' | 'correos';

@Component({
  selector: 'app-system-config',
  standalone: false,
  templateUrl: './system-config.component.html',
  styleUrls: ['./system-config.component.scss']
})

export class SystemConfigComponent implements OnInit {
  config: SystemConfig;
  isLoading = false;
  isNotificationsLoading = false;
  isSavingNotifications = false;
  isPaymentMethodsLoading = false;
  isSavingPaymentMethods = false;
  activeTab: 'general' | 'avanzada' = 'general';
  correosConfig: NotificationEmailSettings | null = null;
  tieneCorreosPersistidos = false;
  metodosPagoConfig: PaymentMethodsSettings | null = null;
  metodosPagoDraft: PaymentMethodsSettings | null = null;
  tieneMetodosPagoPersistidos = false;
  metodoPagoExpandido: string | null = null;
  mostrarModalNuevoMetodo = false;
  mostrarModalNuevoBanco = false;
  modalBancoScope: PaymentMethodBankScope = 'national';
  tasasActuales = { usd: 0, eur: 0 };
  notificationForm!: FormGroup;
  seccionesGeneralesExpandidas = {
    monedaPrincipal: false,
    correos: false,
    metodosPago: false
  };
  seccionesBancosExpandidas: Record<PaymentMethodBankScope, boolean> = {
    national: false,
    international: false
  };
  nuevoMetodoPago = {
    label: '',
    description: '',
    currency: 'VES' as PaymentMethodCurrency,
    requiresReceiverAccount: false
  };
  nuevoBancoCatalogo = {
    code: '',
    name: '',
    scope: 'national' as PaymentMethodBankScope
  };
  
  monedas = [
    { codigo: 'USD', nombre: 'Dólar Americano', simbolo: '$' },
    { codigo: 'EUR', nombre: 'Euro', simbolo: '€' },
    { codigo: 'VES', nombre: 'Bolívar', simbolo: 'Bs.' }
  ];

  constructor(
    private configService: SystemConfigService,
    private swalService: SwalService,
    private formBuilder: FormBuilder
  ) {
    this.config = this.configService.getConfig();
    this.notificationForm = this.formBuilder.group(
      {
        habilitado: [true],
        correoPrincipal: ['', [Validators.required, Validators.email]],
        correoSecundario: ['', [Validators.required, Validators.email]],
        correoSeleccionado: ['principal' as NotificationEmailChannel, Validators.required]
      },
      { validators: correosDebenSerDistintos }
    );

    this.configurarValidadoresNotificaciones(true);
  }

  ngOnInit(): void {
    // Suscribirse a cambios en la configuración
    this.configService.config$.subscribe(config => {
      this.config = config;
    });

    // Suscribirse a cambios en las tasas
    this.configService.getTasasActuales().subscribe(tasas => {
      this.tasasActuales = tasas;
    });

    // Cargar configuración desde el backend al iniciar
    this.configService.obtenerConfigDesdeBackend();
    this.cargarCorreosNotificacion();
    this.cargarMetodosPagoConfigurables();

    this.notificationForm.get('habilitado')?.valueChanges.subscribe(habilitado => {
      this.configurarValidadoresNotificaciones(!!habilitado);
    });
  }

  seleccionarTab(tab: 'general' | 'avanzada'): void {
    if (tab === 'avanzada') {
      return;
    }

    this.activeTab = tab;
  }

  alternarSeccionGeneral(seccion: GeneralSectionKey): void {
    this.seccionesGeneralesExpandidas[seccion] = !this.seccionesGeneralesExpandidas[seccion];
  }

  estaSeccionGeneralExpandida(seccion: GeneralSectionKey): boolean {
    return this.seccionesGeneralesExpandidas[seccion];
  }

  cargarCorreosNotificacion(): void {
    this.isNotificationsLoading = true;
    this.tieneCorreosPersistidos = this.configService.tieneCorreosNotificacionPersistidos();

    this.configService.obtenerCorreosNotificacion().subscribe({
      next: ({ correos }) => {
        this.correosConfig = correos;
        this.aplicarCorreosEnFormulario(correos);
        this.isNotificationsLoading = false;
      },
      error: (error) => {
        console.error('Error cargando correos de notificación:', error);
        this.isNotificationsLoading = false;
        this.swalService.showWarning(
          'Correos no disponibles',
          'No se pudieron cargar los correos de notificación en este momento.'
        );
      }
    });
  }

  guardarCorreosNotificacion(): void {
    if (this.notificationForm.invalid) {
      this.notificationForm.markAllAsTouched();
      this.swalService.showWarning(
        'Formulario incompleto',
        'Debes ingresar dos correos válidos y seleccionar cuál será el canal activo.'
      );
      return;
    }

    const payload = this.construirPayloadCorreos();
    const request$ = this.tieneCorreosPersistidos
      ? this.configService.actualizarCorreosNotificacion(payload)
      : this.configService.guardarCorreosNotificacion(payload);

    this.isSavingNotifications = true;

    request$.subscribe({
      next: ({ correos }) => {
        this.isSavingNotifications = false;
        this.tieneCorreosPersistidos = true;
        this.correosConfig = correos;
        this.aplicarCorreosEnFormulario(correos);

        this.swalService.showSuccess(
          'Correos actualizados',
          correos.habilitado
            ? `El ${this.getEtiquetaCanal(correos.correoSeleccionado).toLowerCase()} quedó activo para las notificaciones del sistema.`
            : 'Las notificaciones por correo quedaron desactivadas.'
        );
      },
      error: (error) => {
        console.error('Error guardando correos de notificación:', error);
        this.isSavingNotifications = false;
        this.swalService.showError(
          'No se pudo guardar',
          'Ocurrió un problema al intentar guardar la configuración de correos.'
        );
      }
    });
  }

  descartarCambiosCorreos(): void {
    if (!this.correosConfig) {
      return;
    }

    this.aplicarCorreosEnFormulario(this.correosConfig);
  }

  seleccionarCanalActivo(canal: NotificationEmailChannel): void {
    this.notificationForm.patchValue({ correoSeleccionado: canal });
  }

  esCorreoInvalido(controlName: 'correoPrincipal' | 'correoSecundario'): boolean {
    const control = this.notificationForm.get(controlName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  getHayCorreosDuplicados(): boolean {
    return !!this.notificationForm.errors?.['correosDuplicados'] &&
      (this.notificationForm.touched || this.notificationForm.dirty);
  }

  getCorreoActivoPreview(): string {
    if (!this.notificationForm.get('habilitado')?.value) {
      return 'Notificaciones desactivadas';
    }

    const correoSeleccionado = this.notificationForm.get('correoSeleccionado')?.value as NotificationEmailChannel;
    return correoSeleccionado === 'secundario'
      ? (this.notificationForm.get('correoSecundario')?.value || '')
      : (this.notificationForm.get('correoPrincipal')?.value || '');
  }

  getEstadoNotificaciones(): string {
    return this.notificationForm.get('habilitado')?.value
      ? 'Notificaciones activas'
      : 'Notificaciones desactivadas';
  }

  getEtiquetaCanal(canal: NotificationEmailChannel): string {
    return canal === 'secundario' ? 'Correo secundario' : 'Correo principal';
  }

  getTextoBotonCorreos(): string {
    return this.tieneCorreosPersistidos ? 'Actualizar correos' : 'Guardar correos';
  }

  cargarMetodosPagoConfigurables(): void {
    this.isPaymentMethodsLoading = true;
    this.tieneMetodosPagoPersistidos = this.configService.tieneMetodosPagoPersistidos();

    this.configService.obtenerMetodosPagoConfigurables().subscribe({
      next: ({ paymentMethods, persisted }) => {
        this.metodosPagoConfig = this.clonarMetodosPago(paymentMethods);
        this.metodosPagoDraft = this.clonarMetodosPago(paymentMethods);
        this.tieneMetodosPagoPersistidos = persisted ?? this.tieneMetodosPagoPersistidos;
        this.reiniciarExpansionMetodosPago();
        this.isPaymentMethodsLoading = false;
      },
      error: (error) => {
        console.error('Error cargando métodos de pago:', error);
        this.isPaymentMethodsLoading = false;
        this.swalService.showWarning(
          'Métodos no disponibles',
          'No se pudo cargar la configuración de métodos de pago en este momento.'
        );
      }
    });
  }

  guardarMetodosPagoConfigurables(): void {
    if (!this.esConfiguracionMetodosPagoValida()) {
      this.swalService.showWarning(
        'Configuración incompleta',
        'Revisa los métodos habilitados y completa las cuentas receptoras obligatorias antes de guardar.'
      );
      return;
    }

    const payload = this.construirPayloadMetodosPago();
    const request$ = this.tieneMetodosPagoPersistidos
      ? this.configService.actualizarMetodosPagoConfigurables(payload)
      : this.configService.guardarMetodosPagoConfigurables(payload);

    this.isSavingPaymentMethods = true;

    request$.subscribe({
      next: ({ paymentMethods }) => {
        this.isSavingPaymentMethods = false;
        this.tieneMetodosPagoPersistidos = true;
        this.metodosPagoConfig = this.clonarMetodosPago(paymentMethods);
        this.metodosPagoDraft = this.clonarMetodosPago(paymentMethods);
        this.reiniciarExpansionMetodosPago();

        this.swalService.showSuccess(
          'Métodos actualizados',
          'La configuración de métodos de pago quedó lista y centralizada desde este panel.'
        );
      },
      error: (error) => {
        console.error('Error guardando métodos de pago:', error);
        this.isSavingPaymentMethods = false;
        this.swalService.showError(
          'No se pudo guardar',
          'Ocurrió un problema al intentar guardar la configuración de métodos de pago.'
        );
      }
    });
  }

  descartarCambiosMetodosPago(): void {
    if (!this.metodosPagoConfig) {
      return;
    }

    this.metodosPagoDraft = this.clonarMetodosPago(this.metodosPagoConfig);
    this.reiniciarExpansionMetodosPago();
  }

  alternarExpansionMetodo(metodoKey: string): void {
    this.metodoPagoExpandido = this.metodoPagoExpandido === metodoKey ? null : metodoKey;
  }

  alternarDisponibilidadMetodo(metodo: PaymentMethodConfig, habilitado: boolean): void {
    metodo.enabled = !!habilitado;

    if (metodo.enabled && metodo.requiresReceiverAccount && metodo.accounts.length === 0) {
      metodo.accounts.push(this.crearCuentaReceptoraVacia());
      this.metodoPagoExpandido = metodo.key;
    }
  }

  agregarCuentaReceptora(metodoKey: string): void {
    const metodo = this.obtenerMetodoPagoDraft(metodoKey);
    if (!metodo) {
      return;
    }

    metodo.accounts.push(this.crearCuentaReceptoraVacia());
    this.metodoPagoExpandido = metodoKey;
  }

  eliminarCuentaReceptora(metodoKey: string, cuentaId: string): void {
    const metodo = this.obtenerMetodoPagoDraft(metodoKey);
    if (!metodo) {
      return;
    }

    metodo.accounts = metodo.accounts.filter(cuenta => cuenta.id !== cuentaId);
  }

  actualizarBancoCuenta(metodoKey: string, cuentaId: string, bankCode: string): void {
    const metodo = this.obtenerMetodoPagoDraft(metodoKey);
    const cuenta = metodo?.accounts.find(item => item.id === cuentaId);
    const banco = this.metodosPagoDraft?.bankCatalog.find(item => item.code === bankCode);

    if (!cuenta) {
      return;
    }

    if (!banco) {
      cuenta.bankCode = '';
      cuenta.bank = '';
      return;
    }

    cuenta.bankCode = banco.code;
    cuenta.bank = banco.name;
  }

  agregarNuevoMetodoPago(): void {
    if (!this.metodosPagoDraft) {
      return;
    }

    const label = this.nuevoMetodoPago.label.trim();
    const description = this.nuevoMetodoPago.description.trim();

    if (!label || !description) {
      this.swalService.showWarning(
        'Datos incompletos',
        'Debes indicar el nombre visible y la descripción del nuevo método antes de agregarlo.'
      );
      return;
    }

    const key = this.generarClaveMetodo(label);
    const nuevoMetodo: PaymentMethodConfig = {
      key,
      label,
      description,
      enabled: false,
      currency: this.nuevoMetodoPago.currency,
      requiresReceiverAccount: this.nuevoMetodoPago.requiresReceiverAccount,
      isCustom: true,
      accounts: this.nuevoMetodoPago.requiresReceiverAccount ? [this.crearCuentaReceptoraVacia()] : []
    };

    this.metodosPagoDraft.methods = [...this.metodosPagoDraft.methods, nuevoMetodo];
    this.metodoPagoExpandido = key;
    this.reiniciarFormularioNuevoMetodo();
  }

  abrirModalNuevoMetodo(): void {
    this.reiniciarFormularioNuevoMetodo();
    this.mostrarModalNuevoMetodo = true;
  }

  cerrarModalNuevoMetodo(): void {
    this.mostrarModalNuevoMetodo = false;
    this.reiniciarFormularioNuevoMetodo();
  }

  confirmarNuevoMetodo(): void {
    const totalPrevio = this.metodosPagoDraft?.methods.length || 0;
    this.agregarNuevoMetodoPago();

    if ((this.metodosPagoDraft?.methods.length || 0) > totalPrevio) {
      this.cerrarModalNuevoMetodo();
    }
  }

  agregarBancoCatalogo(): boolean {
    if (!this.metodosPagoDraft) {
      return false;
    }

    const code = this.nuevoBancoCatalogo.code.trim().toUpperCase();
    const name = this.nuevoBancoCatalogo.name.trim();

    if (!code || !name) {
      this.swalService.showWarning(
        'Datos incompletos',
        'Debes indicar el código y el nombre del banco antes de agregarlo al catálogo.'
      );
      return false;
    }

    const claveNuevoBanco = this.getClaveAgrupacionBanco({
      code,
      name,
      scope: this.nuevoBancoCatalogo.scope,
      active: true
    });
    const duplicado = this.metodosPagoDraft.bankCatalog.some(banco =>
      banco.code === code || this.getClaveAgrupacionBanco(banco) === claveNuevoBanco
    );
    if (duplicado) {
      this.swalService.showWarning(
        'Banco duplicado',
        'Ya existe un banco registrado con ese código o con ese mismo nombre en el catálogo.'
      );
      return false;
    }

    this.metodosPagoDraft.bankCatalog = [
      ...this.metodosPagoDraft.bankCatalog,
      {
        code,
        name,
        scope: this.nuevoBancoCatalogo.scope,
        active: true
      }
    ].sort((actual, siguiente) => actual.name.localeCompare(siguiente.name));

    this.reiniciarFormularioNuevoBanco();
    return true;
  }

  abrirModalNuevoBanco(scope: PaymentMethodBankScope): void {
    this.modalBancoScope = scope;
    this.nuevoBancoCatalogo = {
      code: '',
      name: '',
      scope
    };
    this.mostrarModalNuevoBanco = true;
  }

  cerrarModalNuevoBanco(): void {
    this.mostrarModalNuevoBanco = false;
    this.reiniciarFormularioNuevoBanco();
  }

  alternarExpansionBanco(scope: PaymentMethodBankScope): void {
    this.seccionesBancosExpandidas[scope] = !this.seccionesBancosExpandidas[scope];
  }

  estaSeccionBancoExpandida(scope: PaymentMethodBankScope): boolean {
    return this.seccionesBancosExpandidas[scope];
  }

  confirmarNuevoBanco(): void {
    if (this.agregarBancoCatalogo()) {
      this.cerrarModalNuevoBanco();
    }
  }

  alternarEstadoBancoCatalogo(code: string): void {
    if (!this.metodosPagoDraft) {
      return;
    }

    const banco = this.metodosPagoDraft.bankCatalog.find(item => item.code === code);
    if (!banco) {
      return;
    }

    const siguienteEstado = !this.esBancoActivo(banco);
    const claveGrupo = this.getClaveAgrupacionBanco(banco);

    this.metodosPagoDraft.bankCatalog.forEach(item => {
      if (this.getClaveAgrupacionBanco(item) === claveGrupo) {
        item.active = siguienteEstado;
      }
    });
  }

  getBancosConfigurables(metodo?: PaymentMethodConfig, _cuenta?: PaymentMethodAccount): PaymentMethodBank[] {
    if (!this.metodosPagoDraft) {
      return [];
    }

    if (!metodo) {
      return this.metodosPagoDraft.bankCatalog.filter(banco => this.esBancoActivo(banco));
    }

    if (this.esMetodoBinance(metodo)) {
      return [];
    }

    const bancosActivos = this.usaBancosInternacionales(metodo)
      ? this.getBancosPorAlcance('international', false)
      : this.getBancosPorAlcance('national', false);

    return this.deduplicarBancosPorNombre(bancosActivos);
  }

  getBancosPorAlcance(scope: PaymentMethodBankScope, incluirInactivos = true): PaymentMethodBank[] {
    return (this.metodosPagoDraft?.bankCatalog || []).filter(banco =>
      banco.scope === scope && (incluirInactivos || this.esBancoActivo(banco))
    );
  }

  getCantidadBancosPorAlcance(scope: PaymentMethodBankScope): number {
    return this.getBancosPorAlcance(scope).length;
  }

  getCantidadBancosActivosPorAlcance(scope: PaymentMethodBankScope): number {
    return this.getBancosPorAlcance(scope, false).length;
  }

  getCantidadBancosInactivosPorAlcance(scope: PaymentMethodBankScope): number {
    return this.getCantidadBancosPorAlcance(scope) - this.getCantidadBancosActivosPorAlcance(scope);
  }

  getTituloModalBanco(): string {
    return this.modalBancoScope === 'international' ? 'Agregar banco internacional' : 'Agregar banco nacional';
  }

  esBancoActivo(banco: PaymentMethodBank): boolean {
    return banco.active !== false;
  }

  esBancoCuentaInactivo(cuenta: PaymentMethodAccount): boolean {
    if (!cuenta.bankCode || !this.metodosPagoDraft) {
      return false;
    }

    const banco = this.metodosPagoDraft.bankCatalog.find(item => item.code === cuenta.bankCode);
    return !!banco && !this.esBancoActivo(banco);
  }

  bancoEstaEnUso(code: string): boolean {
    return !!this.metodosPagoDraft?.methods.some(metodo => metodo.accounts.some(cuenta => cuenta.bankCode === code));
  }

  getCantidadMetodosActivos(): number {
    return this.metodosPagoDraft?.methods.filter(metodo => metodo.enabled).length || 0;
  }

  getCantidadMetodosConCuentas(): number {
    return this.metodosPagoDraft?.methods.filter(metodo => metodo.requiresReceiverAccount).length || 0;
  }

  getCantidadCuentasConfiguradas(): number {
    return this.metodosPagoDraft?.methods.reduce((total, metodo) => total + metodo.accounts.length, 0) || 0;
  }

  getTextoBotonMetodosPago(): string {
    return this.tieneMetodosPagoPersistidos ? 'Actualizar métodos' : 'Guardar métodos';
  }

  getResumenMetodoPago(metodo: PaymentMethodConfig): string {
    if (!metodo.requiresReceiverAccount) {
      return 'No requiere cuentas receptoras.';
    }

    if (!metodo.accounts.length) {
      return 'Sin cuentas receptoras configuradas.';
    }

    const cuentaTexto = metodo.accounts.length === 1 ? 'cuenta receptora' : 'cuentas receptoras';
    return `${metodo.accounts.length} ${cuentaTexto} configuradas.`;
  }

  formatearMonedaMetodo(moneda: PaymentMethodCurrency): string {
    switch (moneda) {
      case 'EUR':
        return 'Opera en EUR';
      case 'USD':
        return 'Opera en USD';
      case 'CRYPTO':
        return 'Opera en Cripto';
      case 'USDT':
        return 'Opera en USDT';
      case 'BTC':
        return 'Opera en BTC';
      case 'ETH':
        return 'Opera en ETH';
      case 'MULTI':
        return 'VES, USD y EUR';
      default:
        return 'Opera en VES';
    }
  }

  requiereEmailCuenta(metodo: PaymentMethodConfig): boolean {
    return metodo.key === 'zelle';
  }

  requiereBancoCuenta(metodo: PaymentMethodConfig): boolean {
    return !this.esMetodoBinance(metodo);
  }

  usaBancosInternacionales(metodo: PaymentMethodConfig): boolean {
    return metodo.currency === 'USD' || metodo.currency === 'EUR';
  }

  requiereTitularCuenta(metodo: PaymentMethodConfig): boolean {
    return !this.esMetodoPuntoVenta(metodo);
  }

  requiereDocumentoCuenta(metodo: PaymentMethodConfig): boolean {
    return !this.esMetodoPuntoVenta(metodo) && !this.esMetodoBinance(metodo);
  }

  requiereTelefonoCuenta(metodo: PaymentMethodConfig): boolean {
    return !this.esMetodoPuntoVenta(metodo) && !this.esMetodoBinance(metodo);
  }

  requiereWalletCuenta(metodo: PaymentMethodConfig): boolean {
    return this.esMetodoBinance(metodo);
  }

  getOpcionesMonedaOperativa(): PaymentMethodCurrency[] {
    return ['VES', 'USD', 'EUR', 'MULTI', 'CRYPTO', 'USDT', 'BTC', 'ETH'];
  }

  metodoPagoTieneErrores(metodo: PaymentMethodConfig): boolean {
    return !this.metodoPagoEsValido(metodo);
  }

  puedeGuardarMetodosPago(): boolean {
    return !!this.metodosPagoDraft &&
      this.esConfiguracionMetodosPagoValida() &&
      this.hayCambiosMetodosPago() &&
      !this.isSavingPaymentMethods;
  }

  puedeDescartarCambiosMetodosPago(): boolean {
    return this.hayCambiosMetodosPago() && !this.isSavingPaymentMethods;
  }

  trackByMetodo(_: number, metodo: PaymentMethodConfig): string {
    return metodo.key;
  }

  trackByCuenta(_: number, cuenta: PaymentMethodAccount): string {
    return cuenta.id;
  }

  puedeGuardarCorreos(): boolean {
    return this.notificationForm.valid && this.notificationForm.dirty && !this.isSavingNotifications;
  }

  puedeDescartarCambiosCorreos(): boolean {
    return this.notificationForm.dirty && !this.isSavingNotifications;
  }

  private aplicarCorreosEnFormulario(correos: NotificationEmailSettings): void {
    this.notificationForm.reset({
      habilitado: correos.habilitado,
      correoPrincipal: correos.correoPrincipal,
      correoSecundario: correos.correoSecundario,
      correoSeleccionado: correos.correoSeleccionado
    }, { emitEvent: false });
    this.configurarValidadoresNotificaciones(correos.habilitado);
    this.notificationForm.markAsPristine();
    this.notificationForm.markAsUntouched();
  }

  private obtenerMetodoPagoDraft(metodoKey: string): PaymentMethodConfig | undefined {
    return this.metodosPagoDraft?.methods.find(metodo => metodo.key === metodoKey);
  }

  private crearCuentaReceptoraVacia(): PaymentMethodAccount {
    return {
      id: this.generarIdLocal('account'),
      bank: '',
      bankCode: '',
      ownerName: '',
      ownerId: '',
      phone: '',
      email: '',
      walletAddress: '',
      accountDescription: ''
    };
  }

  private esMetodoPuntoVenta(metodo: PaymentMethodConfig): boolean {
    return metodo.key === 'punto_de_venta';
  }

  private esMetodoBinance(metodo: PaymentMethodConfig): boolean {
    return metodo.key === 'binance';
  }

  private construirPayloadMetodosPago(): PaymentMethodsUpsertRequest {
    return {
      bankCatalog: this.clonarMetodosPago(this.metodosPagoDraft?.bankCatalog || []),
      methods: this.clonarMetodosPago(this.metodosPagoDraft?.methods || [])
    };
  }

  private clonarMetodosPago<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private deduplicarBancosPorNombre(bancos: PaymentMethodBank[]): PaymentMethodBank[] {
    const bancosUnicos = new Map<string, PaymentMethodBank>();

    bancos.forEach(banco => {
      const clave = this.getClaveAgrupacionBanco(banco);
      if (!bancosUnicos.has(clave)) {
        bancosUnicos.set(clave, banco);
      }
    });

    return Array.from(bancosUnicos.values());
  }

  private getClaveAgrupacionBanco(banco: PaymentMethodBank): string {
    return `${banco.scope}_${banco.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()}`;
  }

  private reiniciarFormularioNuevoMetodo(): void {
    this.nuevoMetodoPago = {
      label: '',
      description: '',
      currency: 'VES',
      requiresReceiverAccount: false
    };
  }

  private reiniciarFormularioNuevoBanco(): void {
    this.nuevoBancoCatalogo = {
      code: '',
      name: '',
      scope: this.modalBancoScope
    };
  }

  private reiniciarExpansionMetodosPago(): void {
    this.metodoPagoExpandido = null;
  }

  private esConfiguracionMetodosPagoValida(): boolean {
    return !!this.metodosPagoDraft?.methods.every(metodo => this.metodoPagoEsValido(metodo));
  }

  private metodoPagoEsValido(metodo: PaymentMethodConfig): boolean {
    const tieneBaseValida = !!metodo.label.trim() && !!metodo.description.trim();
    if (!tieneBaseValida) {
      return false;
    }

    if (!metodo.enabled || !metodo.requiresReceiverAccount) {
      return true;
    }

    return metodo.accounts.length > 0 && metodo.accounts.every(cuenta => this.cuentaReceptoraEsValida(metodo, cuenta));
  }

  private cuentaReceptoraEsValida(metodo: PaymentMethodConfig, cuenta: PaymentMethodAccount): boolean {
    if (this.esMetodoPuntoVenta(metodo)) {
      return !!cuenta.bank.trim() &&
        !!cuenta.bankCode.trim() &&
        !this.esBancoCuentaInactivo(cuenta) &&
        !!cuenta.accountDescription.trim();
    }

    if (this.esMetodoBinance(metodo)) {
      return !!cuenta.ownerName.trim() && !!cuenta.walletAddress?.trim() && !!cuenta.accountDescription.trim();
    }

    const tieneBase = !!cuenta.bank.trim() &&
      !!cuenta.bankCode.trim() &&
      !this.esBancoCuentaInactivo(cuenta) &&
      !!cuenta.ownerName.trim() &&
      !!cuenta.ownerId.trim() &&
      !!cuenta.phone.trim() &&
      !!cuenta.accountDescription.trim();

    if (!tieneBase) {
      return false;
    }

    if (!this.requiereEmailCuenta(metodo)) {
      return true;
    }

    return !!cuenta.email?.trim();
  }

  private hayCambiosMetodosPago(): boolean {
    if (!this.metodosPagoConfig || !this.metodosPagoDraft) {
      return false;
    }

    return !this.sonIgualesMetodosPago(this.metodosPagoConfig, this.metodosPagoDraft);
  }

  private sonIgualesMetodosPago(actual: PaymentMethodsSettings, draft: PaymentMethodsSettings): boolean {
    return JSON.stringify(this.normalizarSnapshotMetodosPago(actual)) === JSON.stringify(this.normalizarSnapshotMetodosPago(draft));
  }

  private normalizarSnapshotMetodosPago(settings: PaymentMethodsSettings): unknown {
    return {
      bankCatalog: settings.bankCatalog.map(banco => ({
        code: banco.code.trim(),
        name: banco.name.trim(),
        scope: banco.scope,
        active: this.esBancoActivo(banco)
      })),
      methods: settings.methods.map(metodo => ({
        key: metodo.key,
        label: metodo.label.trim(),
        description: metodo.description.trim(),
        enabled: !!metodo.enabled,
        currency: metodo.currency,
        requiresReceiverAccount: !!metodo.requiresReceiverAccount,
        isCustom: !!metodo.isCustom,
        accounts: metodo.accounts.map(cuenta => ({
          bank: cuenta.bank.trim(),
          bankCode: cuenta.bankCode.trim(),
          ownerName: cuenta.ownerName.trim(),
          ownerId: cuenta.ownerId.trim(),
          phone: cuenta.phone.trim(),
          email: cuenta.email?.trim().toLowerCase() || '',
          walletAddress: cuenta.walletAddress?.trim() || '',
          accountDescription: cuenta.accountDescription.trim()
        }))
      }))
    };
  }

  private generarClaveMetodo(label: string): string {
    const base = label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'metodo_personalizado';

    let key = base;
    let indice = 2;

    while (this.metodosPagoDraft?.methods.some(metodo => metodo.key === key)) {
      key = `${base}_${indice}`;
      indice += 1;
    }

    return key;
  }

  private generarIdLocal(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private configurarValidadoresNotificaciones(habilitado: boolean): void {
    const correoPrincipal = this.notificationForm.get('correoPrincipal');
    const correoSecundario = this.notificationForm.get('correoSecundario');
    const correoSeleccionado = this.notificationForm.get('correoSeleccionado');

    if (habilitado) {
      correoPrincipal?.setValidators([Validators.required, Validators.email]);
      correoSecundario?.setValidators([Validators.required, Validators.email]);
      correoSeleccionado?.setValidators([Validators.required]);
      this.notificationForm.setValidators(correosDebenSerDistintos);
    } else {
      correoPrincipal?.clearValidators();
      correoSecundario?.clearValidators();
      correoSeleccionado?.clearValidators();
      this.notificationForm.clearValidators();
    }

    correoPrincipal?.updateValueAndValidity({ emitEvent: false });
    correoSecundario?.updateValueAndValidity({ emitEvent: false });
    correoSeleccionado?.updateValueAndValidity({ emitEvent: false });
    this.notificationForm.updateValueAndValidity({ emitEvent: false });
  }

  private construirPayloadCorreos(): NotificationEmailUpsertRequest {
    const formValue = this.notificationForm.getRawValue();

    return {
      habilitado: !!formValue.habilitado,
      correoPrincipal: formValue.correoPrincipal?.trim() || '',
      correoSecundario: formValue.correoSecundario?.trim() || '',
      correoSeleccionado: formValue.correoSeleccionado || 'principal'
    };
  }

  /**
   * Cambia la moneda principal del sistema
   */
  seleccionarMoneda(codigoMoneda: string): void {
    this.isLoading = true;
    
    const monedaValida = this.validarMoneda(codigoMoneda);
    
    if (monedaValida) {
      this.configService.cambiarMonedaPrincipal(monedaValida).subscribe({
        next: (response: MonedaBaseResponse) => {
          this.isLoading = false;
          this.swalService.showSuccess(
            'Moneda Actualizada',
            `La moneda principal del sistema ahora es: ${monedaValida}`
          );
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Error guardando configuración en backend:', error);
          this.swalService.showError(
            'Error',
            'No se pudo guardar la configuración en el servidor. Los cambios se aplicaron localmente.'
          );
        }
      });
    } else {
      this.isLoading = false;
    }
  }

  /**
   * Valida que la moneda sea una de las permitidas
   */
  private validarMoneda(moneda: string): 'USD' | 'EUR' | 'VES' | null {
    const monedasValidas = ['USD', 'EUR', 'VES'];
    return monedasValidas.includes(moneda) ? moneda as 'USD' | 'EUR' | 'VES' : null;
  }

  /**
   * Obtiene el valor actual de una tasa
   */
  getValorTasa(codigoMoneda: string): number {
    switch (codigoMoneda) {
      case 'USD': return this.tasasActuales.usd;
      case 'EUR': return this.tasasActuales.eur;
      case 'VES': return 1;
      default: return 0;
    }
  }

  /**
   * Formatea el valor de la tasa para mostrar
   */
  formatTasa(valor: number): string {
    return valor.toFixed(2);
  }

  /**
   * Reinicia la configuración a los valores por defecto
   */
  resetConfig(): void {
    this.swalService.showConfirm(
      'Restablecer Configuración',
      '¿Estás seguro de que quieres restablecer toda la configuración a los valores por defecto?',
      'Sí, Restablecer',
      'Cancelar'
    ).then(result => {
      if (result.isConfirmed) {
        this.configService.resetConfig();
        this.swalService.showSuccess(
          'Configuración Restablecida',
          'La configuración se ha restablecido correctamente'
        );
      }
    });
  }

  /**
   * Obtiene el nombre de la moneda por su código
   */
  getNombreMoneda(codigo: string): string {
    const moneda = this.monedas.find(m => m.codigo === codigo);
    return moneda ? moneda.nombre : codigo;
  }

  /**
   * Formatea la fecha de última actualización
   */
  formatFecha(fechaISO: string): string {
    return new Date(fechaISO).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}