import { Component, OnInit } from '@angular/core';
import { SystemConfigService } from './system-config.service';
import { SystemConfig, MonedaBaseResponse } from './system-config.interface';
import { SwalService } from '../../core/services/swal/swal.service';
import { TasaCambiariaService } from '../../core/services/tasaCambiaria/tasaCambiaria.service';

@Component({
  selector: 'app-system-config',
  standalone: false,
  templateUrl: './system-config.component.html',
  styleUrls: ['./system-config.component.scss']
})

export class SystemConfigComponent implements OnInit {
  config: SystemConfig;
  isLoading = false;
  tasasActuales = { usd: 0, eur: 0 };
  
  monedas = [
    { codigo: 'USD', nombre: 'Dólar Americano', simbolo: '$' },
    { codigo: 'EUR', nombre: 'Euro', simbolo: '€' },
    { codigo: 'VES', nombre: 'Bolívar', simbolo: 'Bs.' }
  ];

  constructor(
    private configService: SystemConfigService,
    private tasaCambiariaService: TasaCambiariaService,
    private swalService: SwalService
  ) {
    this.config = this.configService.getConfig();
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