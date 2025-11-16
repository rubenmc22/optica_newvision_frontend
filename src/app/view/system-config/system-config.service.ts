import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { SystemConfig, Tasa, SystemConfigResponse, MonedaBaseRequest, MonedaBaseResponse } from './system-config.interface';
import { environment } from '../../../environments/environment';
import { TasaCambiariaService } from './../../core/services/tasaCambiaria/tasaCambiaria.service';



@Injectable({
  providedIn: 'root'
})

export class SystemConfigService {
  private readonly CONFIG_KEY = 'opticlass_system_config';

  // Configuración por defecto
  private defaultConfig: SystemConfig = {
    monedaPrincipal: 'USD',
    simboloMoneda: '$',
    decimales: 2,
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
   * Guarda la configuración en localStorage y notifica a los observadores
   */
  private saveConfig(config: SystemConfig): void {
    localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
    this.configSubject.next(config);
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

    console.log(`🔄 Cambiando moneda del sistema a: ${nuevaMoneda}`);

    // Guardar localmente inmediatamente
    this.saveConfig(nuevoConfig);

    // Guardar en el backend
    return this.actualizarMonedaBaseBackend(nuevaMoneda).pipe(
      tap({
        next: (response) => {
          console.log('✅ Moneda guardada en backend:', response);
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
    console.log(`📢 Moneda del sistema cambiada a: ${nuevaMoneda}`);
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

      console.log(`💰 Conversión: ${monto} ${monedaOrigen} → ${monedaDestino}`);
      console.log(`💰 Tasas: ${monedaOrigen}=${tasaOrigen}Bs, ${monedaDestino}=${tasaDestino}Bs`);

      const montoEnBs = monto * tasaOrigen;
      const resultado = montoEnBs / tasaDestino;

      console.log(`💰 Resultado: ${resultado.toFixed(2)} ${monedaDestino}`);

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
        console.log('Respuesta del backend:', response);

        if (response && response.moneda_base) {
          const monedaPrincipal = this.convertirMonedaDesdeBackend(response.moneda_base);
          console.log('Moneda convertida:', monedaPrincipal);

          const nuevoConfig: SystemConfig = {
            ...this.getConfig(),
            monedaPrincipal: monedaPrincipal,
            simboloMoneda: this.obtenerSimboloMoneda(monedaPrincipal),
            ultimaActualizacion: new Date().toISOString()
          };

          this.saveConfig(nuevoConfig);
          console.log('Configuración actualizada desde backend:', nuevoConfig);
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
        return 1; // Bolívar es la base
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