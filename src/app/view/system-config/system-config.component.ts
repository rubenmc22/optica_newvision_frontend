import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { SystemConfigService } from './system-config.service';
import {
  MonedaBaseResponse,
  NotificationEmailChannel,
  NotificationEmailSettings,
  NotificationEmailUpsertRequest,
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
  activeTab: 'moneda' | 'general' | 'avanzada' = 'moneda';
  correosConfig: NotificationEmailSettings | null = null;
  tieneCorreosPersistidos = false;
  tasasActuales = { usd: 0, eur: 0 };
  notificationForm!: FormGroup;
  
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

    this.notificationForm.get('habilitado')?.valueChanges.subscribe(habilitado => {
      this.configurarValidadoresNotificaciones(!!habilitado);
    });
  }

  seleccionarTab(tab: 'moneda' | 'general' | 'avanzada'): void {
    if (tab === 'avanzada') {
      return;
    }

    this.activeTab = tab;
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