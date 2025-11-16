import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class HistorialVentaService {

  constructor() { }

  /**
   * Simula la cancelación de una venta
   * @param ventaId ID de la venta a cancelar
   * @param motivo Motivo de la cancelación
   * @returns Observable con la respuesta simulada
   */
  cancelarVenta(ventaId: number, motivo: string): Observable<any> {
    //console.log('Cancelando venta:', { ventaId, motivo });

    // Simular una respuesta exitosa del API
    const respuestaSimulada = {
      success: true,
      message: 'Venta cancelada exitosamente',
      data: {
        id: ventaId,
        estado: 'cancelada',
        motivo_cancelacion: motivo,
        fecha_cancelacion: new Date().toISOString()
      }
    };

    // Simular delay de red (1-2 segundos)
    const delayTime = Math.random() * 1000 + 1000;

    return of(respuestaSimulada).pipe(
      delay(delayTime)
    );
  }

  /**
   * Versión alternativa que simula un error (para testing)
   */
  cancelarVentaConError(ventaId: number, motivo: string): Observable<any> {
    //console.log('Cancelando venta (simulando error):', { ventaId, motivo });

    // Simular un error del API
    const errorSimulado = {
      success: false,
      message: 'Error: No se pudo cancelar la venta. La venta ya ha sido procesada.',
      error: 'VENTA_YA_PROCESADA'
    };

    // Simular delay de red
    const delayTime = Math.random() * 1000 + 1000;

    return of(errorSimulado).pipe(
      delay(delayTime)
    );
  }

  /**
   * Método para probar diferentes escenarios
   */
  cancelarVentaConEscenario(ventaId: number, motivo: string, escenario: 'exito' | 'error' = 'exito'): Observable<any> {
    if (escenario === 'error') {
      return this.cancelarVentaConError(ventaId, motivo);
    }
    return this.cancelarVenta(ventaId, motivo);
  }
}