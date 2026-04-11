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