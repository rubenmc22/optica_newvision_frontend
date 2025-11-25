import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class HistorialVentaService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  /**
   * Obtiene el historial de ventas
  */
  obtenerHistorialVentas(): Observable<any> {
    return this.http.get(`${this.apiUrl}/ventas-get`);
  }
  /**
   * Anula una venta
   * @param ventaKey Key de la venta a anular
   * @param motivo Motivo de la anulación
   */
  anularVenta(ventaKey: string, motivo: string): Observable<any> {
    // CORRECCIÓN: Usar la ruta correcta sin duplicar /api
    return this.http.post(`${this.apiUrl}/ventas-anular/${ventaKey}`, {
      motivo_cancelacion: motivo
    });
  }

  /**
   * Realiza un abono a una venta
   * @param ventaKey Key de la venta
   * @param datosAbono Datos del abono
   */
  realizarAbono(ventaKey: string, datosAbono: any): Observable<any> {
    // CORRECCIÓN: Usar la ruta correcta sin duplicar /api
    return this.http.post(`${this.apiUrl}/ventas-abonar/${ventaKey}`, datosAbono);
  }

  /**
   * Obtiene el detalle completo de una venta
   * @param ventaKey Key de la venta
   */
  obtenerDetalleVenta(ventaKey: string): Observable<any> {
    // CORRECCIÓN: Usar la ruta correcta sin duplicar /api
    return this.http.get(`${this.apiUrl}/ventas-get/${ventaKey}`);
  }
}