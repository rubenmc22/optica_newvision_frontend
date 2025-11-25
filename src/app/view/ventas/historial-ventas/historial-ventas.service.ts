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
   * @param pagina Página actual
   * @param porPagina Items por página
   * @param filtros Filtros opcionales
   */
  obtenerHistorialVentas(
    pagina: number = 1,
    porPagina: number = 10,
    filtros?: any
  ): Observable<any> {
    let params = new HttpParams()
      .set('page', pagina.toString())
      .set('per_page', porPagina.toString());

    // Agregar filtros si existen
    if (filtros) {
      if (filtros.busquedaGeneral) {
        params = params.set('busqueda', filtros.busquedaGeneral);
      }
      if (filtros.asesor) {
        params = params.set('asesor_id', filtros.asesor);
      }
      if (filtros.especialista) {
        params = params.set('especialista_id', filtros.especialista);
      }
      if (filtros.estado) {
        params = params.set('estado', filtros.estado);
      }
      if (filtros.fechaDesde) {
        params = params.set('fecha_desde', filtros.fechaDesde);
      }
      if (filtros.fechaHasta) {
        params = params.set('fecha_hasta', filtros.fechaHasta);
      }
    }

    // CORRECCIÓN: Usar la ruta correcta sin duplicar /api
    return this.http.get(`${this.apiUrl}/ventas-get`, { params });
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