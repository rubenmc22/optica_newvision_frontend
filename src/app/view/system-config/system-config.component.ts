import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { SystemConfigService } from './system-config.service';
import {
  NotificationEmailDeliveryMode,
  NotificationEmailDestination,
  MonedaBaseResponse,
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

function configuracionDestinoCorreosValida(control: AbstractControl): ValidationErrors | null {
  const correoSecundario = `${control.get('correoSecundario')?.value || ''}`.trim();
  const modoEntrega = control.get('modoEntrega')?.value as NotificationEmailDeliveryMode | null;
  const destinoIndividual = control.get('destinoIndividual')?.value as NotificationEmailDestination | null;

  if (modoEntrega === 'simultaneo' && !correoSecundario) {
    return { requiereCorreoSecundario: true };
  }

  if (modoEntrega === 'individual' && destinoIndividual === 'secundario' && !correoSecundario) {
    return { requiereCorreoSecundario: true };
  }

  return null;
}

type GeneralSectionKey = 'monedaPrincipal' | 'metodosPago' | 'correos';
type PaymentConfigNoticeTone = 'saving' | 'success';

@Component({
  selector: 'app-system-config',
  standalone: false,
  templateUrl: './system-config.component.html',
  styleUrls: ['./system-config.component.scss']
})

export class SystemConfigComponent implements OnInit, OnDestroy {
  config: SystemConfig;
  isLoading = false;
  isNotificationsLoading = false;
  isSavingNotifications = false;
  isPaymentMethodsLoading = false;
  isSavingPaymentMethods = false;
  isSavingBankCatalog = false;
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
  paymentConfigNotice: { tone: PaymentConfigNoticeTone; message: string } | null = null;
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
  private operacionesMetodosPendientes = 0;
  private operacionesBancosPendientes = 0;
  private paymentConfigNoticeTimeoutId: number | null = null;
  private readonly methodAutosaveDebounceMs = 700;
  private readonly methodSaveTimers = new Map<string, number>();
  private readonly methodSaveInFlight = new Set<string>();
  private readonly methodSaveQueued = new Set<string>();
  
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
        correoPrincipal: ['', [Validators.required, Validators.email]],
        correoSecundario: ['', [Validators.email]],
        modoEntrega: ['individual' as NotificationEmailDeliveryMode],
        destinoIndividual: ['principal' as NotificationEmailDestination]
      },
      { validators: [correosDebenSerDistintos, configuracionDestinoCorreosValida] }
    );

    this.configurarValidadoresNotificaciones();
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
  }

  ngOnDestroy(): void {
    this.limpiarAvisosYTemporizadoresPago();
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
    this.tieneCorreosPersistidos = false;

    this.configService.obtenerCorreosNotificacion().subscribe({
      next: ({ correos }) => {
        this.correosConfig = correos;
        this.tieneCorreosPersistidos = this.hayCorreosConfigurados(correos);
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
        'Debes ingresar un correo principal válido. El secundario es opcional, pero si lo indicas también debe ser válido y diferente.'
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
          this.getMensajeExitoCorreos(correos)
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

  esCorreoInvalido(controlName: 'correoPrincipal' | 'correoSecundario'): boolean {
    const control = this.notificationForm.get(controlName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  getHayCorreosDuplicados(): boolean {
    return !!this.notificationForm.errors?.['correosDuplicados'] &&
      (this.notificationForm.touched || this.notificationForm.dirty);
  }

  getEstadoCorreos(): string {
    const cantidad = this.getCantidadCorreosConfigurados();

    if (cantidad === 0) {
      return 'Sin correos configurados';
    }

    return cantidad === 1 ? 'Un correo configurado' : 'Dos correos configurados';
  }

  getTextoEnvioSimultaneo(): string {
    const modoEntrega = this.getModoEntregaActual();

    if (modoEntrega === 'simultaneo') {
      return 'Ambos correos al mismo tiempo';
    }

    return this.notificationForm.get('destinoIndividual')?.value === 'secundario'
      ? 'Solo correo secundario'
      : 'Solo correo principal';
  }

  getResumenCorreoSeleccionado(): string {
    const correoPrincipal = `${this.notificationForm.get('correoPrincipal')?.value || ''}`.trim();
    const correoSecundario = `${this.notificationForm.get('correoSecundario')?.value || ''}`.trim();

    if (this.getModoEntregaActual() === 'simultaneo') {
      return correoSecundario ? 'Ambos correos' : correoPrincipal || 'Sin definir';
    }

    if (this.getDestinoIndividualActual() === 'secundario') {
      return correoSecundario || 'Sin definir';
    }

    return correoPrincipal || 'Sin definir';
  }

  getTextoBotonCorreos(): string {
    return this.tieneCorreosPersistidos ? 'Actualizar correos' : 'Guardar correos';
  }

  getPuedeUsarCorreoSecundario(): boolean {
    return !!`${this.notificationForm.get('correoSecundario')?.value || ''}`.trim();
  }

  getModoEntregaActual(): NotificationEmailDeliveryMode {
    return (this.notificationForm.get('modoEntrega')?.value as NotificationEmailDeliveryMode) || 'individual';
  }

  getDestinoIndividualActual(): NotificationEmailDestination {
    return (this.notificationForm.get('destinoIndividual')?.value as NotificationEmailDestination) || 'principal';
  }

  getEnvioSimultaneoActivo(): boolean {
    return this.getModoEntregaActual() === 'simultaneo';
  }

  seleccionarDestinoIndividual(destino: NotificationEmailDestination): void {
    if (destino === 'secundario' && !this.getPuedeUsarCorreoSecundario()) {
      return;
    }

    this.notificationForm.patchValue({
      modoEntrega: 'individual',
      destinoIndividual: destino
    });
    this.notificationForm.markAsDirty();
    this.notificationForm.markAsTouched();
  }

  alternarEnvioSimultaneo(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const activo = !!input?.checked;

    if (activo && !this.getPuedeUsarCorreoSecundario()) {
      this.notificationForm.patchValue({ modoEntrega: 'individual' }, { emitEvent: false });
      return;
    }

    this.notificationForm.patchValue({
      modoEntrega: activo ? 'simultaneo' : 'individual'
    });
    this.notificationForm.markAsDirty();
    this.notificationForm.markAsTouched();
  }

  manejarTecladoSeleccionDestino(event: KeyboardEvent, destino: NotificationEmailDestination): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.seleccionarDestinoIndividual(destino);
  }

  getHayConfiguracionDestinoInvalida(): boolean {
    return !!this.notificationForm.errors?.['requiereCorreoSecundario'] &&
      (this.notificationForm.touched || this.notificationForm.dirty);
  }

  getTextoAyudaEnvioSimultaneo(): string {
    return this.getPuedeUsarCorreoSecundario()
      ? 'Los avisos se enviarán en paralelo al principal y al secundario.'
      : 'Agrega un correo secundario para habilitar el envío simultáneo.';
  }

  getTextoEstadoCardCorreo(destino: NotificationEmailDestination): string {
    if (destino === 'secundario' && !this.getPuedeUsarCorreoSecundario()) {
      return 'Completa este correo para poder seleccionarlo.';
    }

    if (this.getModoEntregaActual() === 'simultaneo') {
      return '';
    }

    return this.getDestinoIndividualActual() === destino
      ? 'Seleccionado para el envío individual.'
      : '';
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

    this.guardarMetodoPagoEnBackend(metodo.key);
  }

  agregarCuentaReceptora(metodoKey: string): void {
    const metodo = this.obtenerMetodoPagoDraft(metodoKey);
    if (!metodo) {
      return;
    }

    metodo.accounts.push(this.crearCuentaReceptoraVacia());
    this.metodoPagoExpandido = metodoKey;
    this.guardarMetodoPagoEnBackend(metodoKey);
  }

  eliminarCuentaReceptora(metodoKey: string, cuentaId: string): void {
    const metodo = this.obtenerMetodoPagoDraft(metodoKey);
    if (!metodo) {
      return;
    }

    metodo.accounts = metodo.accounts.filter(cuenta => cuenta.id !== cuentaId);
    this.guardarMetodoPagoEnBackend(metodoKey);
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
      this.guardarMetodoPagoEnBackend(metodoKey);
      return;
    }

    cuenta.bankCode = banco.code;
    cuenta.bank = banco.name;
    this.guardarMetodoPagoEnBackend(metodoKey);
  }

  persistirMetodoPago(metodoKey: string): void {
    this.guardarMetodoPagoEnBackend(metodoKey);
  }

  private construirNuevoMetodoPago(): PaymentMethodConfig | null {
    if (!this.metodosPagoDraft) {
      return null;
    }

    const label = this.nuevoMetodoPago.label.trim();
    const description = this.nuevoMetodoPago.description.trim();

    if (!label || !description) {
      this.swalService.showWarning(
        'Datos incompletos',
        'Debes indicar el nombre visible y la descripción del nuevo método antes de agregarlo.'
      );
      return null;
    }

    const key = this.generarClaveMetodo(label);
    return {
      key,
      label,
      description,
      enabled: false,
      currency: this.nuevoMetodoPago.currency,
      requiresReceiverAccount: this.nuevoMetodoPago.requiresReceiverAccount,
      isCustom: true,
      accounts: this.nuevoMetodoPago.requiresReceiverAccount ? [this.crearCuentaReceptoraVacia()] : []
    };
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
    const nuevoMetodo = this.construirNuevoMetodoPago();
    if (!nuevoMetodo) {
      return;
    }

    this.iniciarGuardadoMetodosPago();

    this.configService.crearMetodoPagoCatalogo(nuevoMetodo).subscribe({
      next: ({ metodo, ultimaActualizacion }) => {
        this.actualizarMetodoPersistidoEnEstado(metodo, ultimaActualizacion);
        this.tieneMetodosPagoPersistidos = true;
        this.metodoPagoExpandido = metodo.key;
        this.finalizarGuardadoMetodosPago();
        this.cerrarModalNuevoMetodo();
        this.mostrarAvisoConfiguracionPago(`Método ${metodo.label} agregado correctamente.`, 'success');
      },
      error: (error) => {
        console.error('Error guardando método de pago:', error);
        this.finalizarGuardadoMetodosPago();
        this.swalService.showError(
          'No se pudo guardar',
          'Ocurrió un problema al intentar registrar el método de pago.'
        );
      }
    });
  }

  private construirNuevoBancoCatalogo(): PaymentMethodBank | null {
    if (!this.metodosPagoDraft) {
      return null;
    }

    const code = this.nuevoBancoCatalogo.code.trim().toUpperCase();
    const name = this.nuevoBancoCatalogo.name.trim();

    if (!code || !name) {
      this.swalService.showWarning(
        'Datos incompletos',
        'Debes indicar el código y el nombre del banco antes de agregarlo al catálogo.'
      );
      return null;
    }

    const nuevoBanco: PaymentMethodBank = {
      code,
      name,
      scope: this.nuevoBancoCatalogo.scope,
      active: true
    };
    const claveNuevoBanco = this.getClaveAgrupacionBanco(nuevoBanco);
    const duplicado = this.metodosPagoDraft.bankCatalog.some(banco =>
      banco.code === code || this.getClaveAgrupacionBanco(banco) === claveNuevoBanco
    );
    if (duplicado) {
      this.swalService.showWarning(
        'Banco duplicado',
        'Ya existe un banco registrado con ese código o con ese mismo nombre en el catálogo.'
      );
      return null;
    }

    return nuevoBanco;
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
    const nuevoBanco = this.construirNuevoBancoCatalogo();
    if (!nuevoBanco || !this.metodosPagoConfig || !this.metodosPagoDraft) {
      return;
    }

    this.iniciarGuardadoBancos();

    this.configService.crearBancoCatalogo(nuevoBanco).subscribe({
      next: (bancoPersistido) => {
        const updatedAt = new Date().toISOString();

        this.metodosPagoConfig = {
          ...this.metodosPagoConfig,
          bankCatalog: this.ordenarCatalogoBancos([...this.metodosPagoConfig.bankCatalog, bancoPersistido]),
          ultimaActualizacion: updatedAt
        };

        this.metodosPagoDraft = {
          ...this.metodosPagoDraft,
          bankCatalog: this.ordenarCatalogoBancos([...this.metodosPagoDraft.bankCatalog, bancoPersistido])
        };

        this.tieneMetodosPagoPersistidos = true;
        this.finalizarGuardadoBancos();
        this.cerrarModalNuevoBanco();
        this.mostrarAvisoConfiguracionPago(`Banco ${bancoPersistido.name} agregado al catálogo.`, 'success');
      },
      error: (error) => {
        console.error('Error guardando banco receptor:', error);
        this.finalizarGuardadoBancos();
        this.swalService.showError(
          'No se pudo guardar',
          'Ocurrió un problema al intentar registrar el banco en el catálogo.'
        );
      }
    });
  }

  alternarEstadoBancoCatalogo(code: string): void {
    if (!this.metodosPagoDraft || !this.metodosPagoConfig) {
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

    const bancosActualizados = this.metodosPagoDraft.bankCatalog
      .filter(item => this.getClaveAgrupacionBanco(item) === claveGrupo)
      .filter(item => this.bancoTieneCambios(item));

    if (!bancosActualizados.length) {
      return;
    }

    const codigos = bancosActualizados.map(item => item.code);
    const mensajeExitoBanco = `${banco.name} ${siguienteEstado ? 'activado' : 'desactivado'} en el catálogo.`;
    this.iniciarGuardadoBancos();

    forkJoin(bancosActualizados.map(item => this.configService.actualizarBancoCatalogo(item))).subscribe({
      next: (bancosPersistidos) => {
        this.actualizarBancosPersistidosEnEstado(bancosPersistidos);
        this.finalizarGuardadoBancos();
        this.mostrarAvisoConfiguracionPago(mensajeExitoBanco, 'success');
      },
      error: (error) => {
        console.error('Error actualizando estado del banco:', error);
        this.restaurarBancosEnDraft(codigos);
        this.finalizarGuardadoBancos();
        this.swalService.showError(
          'No se pudo actualizar',
          'Ocurrió un problema al intentar actualizar el estado del banco en el servidor.'
        );
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

  private iniciarGuardadoMetodosPago(): void {
    if (this.operacionesMetodosPendientes === 0) {
      this.mostrarAvisoConfiguracionPago('Guardando cambios...', 'saving', 0);
    }

    this.operacionesMetodosPendientes += 1;
    this.isSavingPaymentMethods = true;
  }

  private finalizarGuardadoMetodosPago(): void {
    this.operacionesMetodosPendientes = Math.max(0, this.operacionesMetodosPendientes - 1);
    this.isSavingPaymentMethods = this.operacionesMetodosPendientes > 0;

    if (!this.isSavingPaymentMethods && this.paymentConfigNotice?.tone === 'saving') {
      this.paymentConfigNotice = null;
    }
  }

  private iniciarGuardadoBancos(): void {
    if (this.operacionesBancosPendientes === 0 && !this.isSavingPaymentMethods) {
      this.mostrarAvisoConfiguracionPago('Guardando cambios...', 'saving', 0);
    }

    this.operacionesBancosPendientes += 1;
    this.isSavingBankCatalog = true;
  }

  private finalizarGuardadoBancos(): void {
    this.operacionesBancosPendientes = Math.max(0, this.operacionesBancosPendientes - 1);
    this.isSavingBankCatalog = this.operacionesBancosPendientes > 0;

    if (!this.isSavingBankCatalog && !this.isSavingPaymentMethods && this.paymentConfigNotice?.tone === 'saving') {
      this.paymentConfigNotice = null;
    }
  }

  puedeGuardarCorreos(): boolean {
    return this.notificationForm.valid && this.notificationForm.dirty && !this.isSavingNotifications;
  }

  puedeDescartarCambiosCorreos(): boolean {
    return this.notificationForm.dirty && !this.isSavingNotifications;
  }

  private aplicarCorreosEnFormulario(correos: NotificationEmailSettings): void {
    this.notificationForm.reset({
      correoPrincipal: correos.correoPrincipal,
      correoSecundario: correos.correoSecundario,
      modoEntrega: correos.destinoEnvio === 'ambos' ? 'simultaneo' : 'individual',
      destinoIndividual: correos.destinoEnvio === 'secundario' ? 'secundario' : 'principal'
    }, { emitEvent: false });
    this.configurarValidadoresNotificaciones();
    this.notificationForm.markAsPristine();
    this.notificationForm.markAsUntouched();
  }

  private obtenerMetodoPagoDraft(metodoKey: string): PaymentMethodConfig | undefined {
    return this.metodosPagoDraft?.methods.find(metodo => metodo.key === metodoKey);
  }

  private obtenerMetodoPagoPersistido(metodoKey: string): PaymentMethodConfig | undefined {
    return this.metodosPagoConfig?.methods.find(metodo => metodo.key === metodoKey);
  }

  private guardarMetodoPagoEnBackend(metodoKey: string): void {
    this.programarGuardadoMetodoPago(metodoKey);
  }

  private programarGuardadoMetodoPago(metodoKey: string): void {
    const metodoDraft = this.obtenerMetodoPagoDraft(metodoKey);
    if (!metodoDraft) {
      return;
    }

    if (!this.metodoTieneCambios(metodoDraft)) {
      this.cancelarGuardadoMetodoProgramado(metodoKey);
      return;
    }

    if (this.methodSaveInFlight.has(metodoKey)) {
      this.methodSaveQueued.add(metodoKey);
      return;
    }

    this.cancelarGuardadoMetodoProgramado(metodoKey);
    const timeoutId = window.setTimeout(() => {
      this.methodSaveTimers.delete(metodoKey);
      this.ejecutarGuardadoMetodoPago(metodoKey);
    }, this.methodAutosaveDebounceMs);

    this.methodSaveTimers.set(metodoKey, timeoutId);
  }

  private ejecutarGuardadoMetodoPago(metodoKey: string): void {
    const metodoDraft = this.obtenerMetodoPagoDraft(metodoKey);
    if (!metodoDraft || !this.metodoTieneCambios(metodoDraft) || this.methodSaveInFlight.has(metodoKey)) {
      return;
    }

    const metodoParaGuardar = this.clonarMetodosPago(metodoDraft);
    const snapshotEnviado = JSON.stringify(this.normalizarMetodoSnapshot(metodoParaGuardar));
    const metodoPersistido = this.obtenerMetodoPagoPersistido(metodoKey);
    const request$ = metodoPersistido
      ? this.configService.actualizarMetodoPagoCatalogo(metodoParaGuardar)
      : this.configService.crearMetodoPagoCatalogo(metodoParaGuardar);

    this.methodSaveInFlight.add(metodoKey);
    this.iniciarGuardadoMetodosPago();

    request$.subscribe({
      next: ({ metodo, ultimaActualizacion }) => {
        const draftActual = this.obtenerMetodoPagoDraft(metodoKey);
        const draftCoincideConEnvio = !!draftActual &&
          JSON.stringify(this.normalizarMetodoSnapshot(draftActual)) === snapshotEnviado;

        this.actualizarMetodoPersistidoEnEstado(metodo, ultimaActualizacion, draftCoincideConEnvio);
        this.tieneMetodosPagoPersistidos = true;
        this.methodSaveInFlight.delete(metodoKey);
        this.finalizarGuardadoMetodosPago();

        if (this.debeReprogramarGuardadoMetodo(metodoKey)) {
          this.programarGuardadoMetodoPago(metodoKey);
          return;
        }

        this.mostrarAvisoConfiguracionPago(`Cambios guardados en ${metodo.label}.`, 'success');
      },
      error: (error) => {
        console.error('Error persistiendo método de pago:', error);
        const draftActual = this.obtenerMetodoPagoDraft(metodoKey);
        const draftCoincideConEnvio = !!draftActual &&
          JSON.stringify(this.normalizarMetodoSnapshot(draftActual)) === snapshotEnviado;

        if (draftCoincideConEnvio) {
          this.restaurarMetodoEnDraft(metodoKey);
        }

        this.methodSaveInFlight.delete(metodoKey);
        this.finalizarGuardadoMetodosPago();
        this.swalService.showError(
          'No se pudo guardar',
          'Ocurrió un problema al sincronizar el método de pago con el servidor.'
        );
      }
    });
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

  private metodoTieneCambios(metodo: PaymentMethodConfig): boolean {
    const metodoPersistido = this.obtenerMetodoPagoPersistido(metodo.key);
    if (!metodoPersistido) {
      return true;
    }

    return JSON.stringify(this.normalizarMetodoSnapshot(metodoPersistido)) !== JSON.stringify(this.normalizarMetodoSnapshot(metodo));
  }

  private bancoTieneCambios(banco: PaymentMethodBank): boolean {
    const bancoPersistido = this.metodosPagoConfig?.bankCatalog.find(item => item.code === banco.code);
    if (!bancoPersistido) {
      return true;
    }

    return JSON.stringify(this.normalizarBancoSnapshot(bancoPersistido)) !== JSON.stringify(this.normalizarBancoSnapshot(banco));
  }

  private normalizarSnapshotMetodosPago(settings: PaymentMethodsSettings): unknown {
    return {
      bankCatalog: settings.bankCatalog.map(banco => this.normalizarBancoSnapshot(banco)),
      methods: settings.methods.map(metodo => this.normalizarMetodoSnapshot(metodo))
    };
  }

  private normalizarBancoSnapshot(banco: PaymentMethodBank): unknown {
    return {
      code: banco.code.trim(),
      name: banco.name.trim(),
      scope: banco.scope,
      active: this.esBancoActivo(banco)
    };
  }

  private normalizarMetodoSnapshot(metodo: PaymentMethodConfig): unknown {
    return {
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
    };
  }

  private actualizarMetodoPersistidoEnEstado(
    metodo: PaymentMethodConfig,
    ultimaActualizacion?: string,
    sincronizarDraft: boolean = true
  ): void {
    const updatedAt = ultimaActualizacion || new Date().toISOString();
    const metodoPersistido = this.clonarMetodosPago(metodo);

    if (this.metodosPagoConfig) {
      this.metodosPagoConfig = {
        ...this.metodosPagoConfig,
        methods: this.reemplazarMetodoEnColeccion(this.metodosPagoConfig.methods, metodoPersistido),
        ultimaActualizacion: updatedAt
      };
    }

    if (this.metodosPagoDraft && sincronizarDraft) {
      this.metodosPagoDraft = {
        ...this.metodosPagoDraft,
        methods: this.reemplazarMetodoEnColeccion(this.metodosPagoDraft.methods, metodoPersistido),
        ultimaActualizacion: updatedAt
      };
    }
  }

  private actualizarBancosPersistidosEnEstado(bancos: PaymentMethodBank[]): void {
    const updatedAt = new Date().toISOString();

    if (this.metodosPagoConfig) {
      let bankCatalog = [...this.metodosPagoConfig.bankCatalog];
      bancos.forEach((banco) => {
        bankCatalog = this.reemplazarBancoEnColeccion(bankCatalog, banco);
      });

      this.metodosPagoConfig = {
        ...this.metodosPagoConfig,
        bankCatalog: this.ordenarCatalogoBancos(bankCatalog),
        ultimaActualizacion: updatedAt
      };
    }

    if (this.metodosPagoDraft) {
      let bankCatalog = [...this.metodosPagoDraft.bankCatalog];
      bancos.forEach((banco) => {
        bankCatalog = this.reemplazarBancoEnColeccion(bankCatalog, banco);
      });

      this.metodosPagoDraft = {
        ...this.metodosPagoDraft,
        bankCatalog: this.ordenarCatalogoBancos(bankCatalog),
        ultimaActualizacion: updatedAt
      };
    }
  }

  private restaurarMetodoEnDraft(metodoKey: string): void {
    const metodoPersistido = this.obtenerMetodoPagoPersistido(metodoKey);
    if (!metodoPersistido || !this.metodosPagoDraft) {
      return;
    }

    this.metodosPagoDraft = {
      ...this.metodosPagoDraft,
      methods: this.reemplazarMetodoEnColeccion(this.metodosPagoDraft.methods, metodoPersistido)
    };
  }

  private restaurarBancosEnDraft(codigos: string[]): void {
    if (!this.metodosPagoConfig || !this.metodosPagoDraft) {
      return;
    }

    let bankCatalog = [...this.metodosPagoDraft.bankCatalog];
    this.metodosPagoConfig.bankCatalog
      .filter((banco) => codigos.includes(banco.code))
      .forEach((bancoPersistido) => {
        bankCatalog = this.reemplazarBancoEnColeccion(bankCatalog, bancoPersistido);
      });

    this.metodosPagoDraft = {
      ...this.metodosPagoDraft,
      bankCatalog: this.ordenarCatalogoBancos(bankCatalog)
    };
  }

  private reemplazarMetodoEnColeccion(methods: PaymentMethodConfig[], metodo: PaymentMethodConfig): PaymentMethodConfig[] {
    const metodoClonado = this.clonarMetodosPago(metodo);
    const existe = methods.some((item) => item.key === metodo.key);

    if (!existe) {
      return [...methods, metodoClonado];
    }

    return methods.map((item) => item.key === metodo.key ? metodoClonado : item);
  }

  private reemplazarBancoEnColeccion(bankCatalog: PaymentMethodBank[], banco: PaymentMethodBank): PaymentMethodBank[] {
    const bancoClonado = this.clonarMetodosPago(banco);
    const existe = bankCatalog.some((item) => item.code === banco.code);

    if (!existe) {
      return [...bankCatalog, bancoClonado];
    }

    return bankCatalog.map((item) => item.code === banco.code ? bancoClonado : item);
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

  private ordenarCatalogoBancos(bankCatalog: PaymentMethodBank[]): PaymentMethodBank[] {
    return [...bankCatalog].sort((actual, siguiente) => actual.name.localeCompare(siguiente.name));
  }

  private mostrarAvisoConfiguracionPago(
    message: string,
    tone: PaymentConfigNoticeTone = 'success',
    autoHideMs: number = 2400
  ): void {
    this.limpiarTemporizadorAvisoConfiguracionPago();
    this.paymentConfigNotice = { tone, message };

    if (tone === 'success' && autoHideMs > 0) {
      this.paymentConfigNoticeTimeoutId = window.setTimeout(() => {
        this.paymentConfigNotice = null;
        this.paymentConfigNoticeTimeoutId = null;
      }, autoHideMs);
    }
  }

  private limpiarTemporizadorAvisoConfiguracionPago(): void {
    if (this.paymentConfigNoticeTimeoutId === null) {
      return;
    }

    clearTimeout(this.paymentConfigNoticeTimeoutId);
    this.paymentConfigNoticeTimeoutId = null;
  }

  private cancelarGuardadoMetodoProgramado(metodoKey: string): void {
    const timeoutId = this.methodSaveTimers.get(metodoKey);
    if (timeoutId === undefined) {
      return;
    }

    clearTimeout(timeoutId);
    this.methodSaveTimers.delete(metodoKey);
  }

  private debeReprogramarGuardadoMetodo(metodoKey: string): boolean {
    const habiaCambiosEnCola = this.methodSaveQueued.delete(metodoKey);
    const metodoDraft = this.obtenerMetodoPagoDraft(metodoKey);

    return habiaCambiosEnCola || (!!metodoDraft && this.metodoTieneCambios(metodoDraft));
  }

  private limpiarAvisosYTemporizadoresPago(): void {
    this.limpiarTemporizadorAvisoConfiguracionPago();
    this.methodSaveTimers.forEach((timeoutId) => clearTimeout(timeoutId));
    this.methodSaveTimers.clear();
    this.methodSaveQueued.clear();
    this.methodSaveInFlight.clear();
  }

  private configurarValidadoresNotificaciones(): void {
    const correoPrincipal = this.notificationForm.get('correoPrincipal');
    const correoSecundario = this.notificationForm.get('correoSecundario');
    correoPrincipal?.setValidators([Validators.required, Validators.email]);
    correoSecundario?.setValidators([Validators.email]);
    this.notificationForm.setValidators([correosDebenSerDistintos, configuracionDestinoCorreosValida]);

    correoPrincipal?.updateValueAndValidity({ emitEvent: false });
    correoSecundario?.updateValueAndValidity({ emitEvent: false });
    this.notificationForm.updateValueAndValidity({ emitEvent: false });
  }

  private construirPayloadCorreos(): NotificationEmailUpsertRequest {
    const formValue = this.notificationForm.getRawValue();
    const destino = formValue.modoEntrega === 'simultaneo'
      ? 'ambos'
      : formValue.destinoIndividual === 'secundario'
        ? 'secundario'
        : 'principal';

    return {
      correo_notificacion_1: formValue.correoPrincipal?.trim() || '',
      correo_notificacion_2: formValue.correoSecundario?.trim() || '',
      correo_notificacion_destino: destino
    };
  }

  private getCantidadCorreosConfigurados(): number {
    return [
      this.notificationForm.get('correoPrincipal')?.value,
      this.notificationForm.get('correoSecundario')?.value
    ].filter((correo) => `${correo || ''}`.trim()).length;
  }

  private hayCorreosConfigurados(correos: NotificationEmailSettings): boolean {
    return !!(`${correos.correoPrincipal || ''}`.trim() || `${correos.correoSecundario || ''}`.trim());
  }

  private getMensajeExitoCorreos(correos: NotificationEmailSettings): string {
    if (correos.destinoEnvio === 'ambos') {
      return 'Se actualizaron los correos de notificación. Los avisos quedarán saliendo al principal y al secundario al mismo tiempo.';
    }

    if (correos.destinoEnvio === 'secundario') {
      return 'Se actualizaron los correos de notificación. El envío individual quedó apuntando al correo secundario.';
    }

    return 'Se actualizaron los correos de notificación. El envío individual quedó apuntando al correo principal.';
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