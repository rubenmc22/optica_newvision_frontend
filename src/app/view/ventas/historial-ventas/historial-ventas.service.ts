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
   * Obtiene el historial de ventas con paginación y filtros
   */
  obtenerHistorialVentas(pagina: number = 1, itemsPorPagina: number = 25, filtros: any = {}): Observable<any> {
    let params = new HttpParams()
      .set('pagina', pagina.toString())
      .set('itemsPorPagina', itemsPorPagina.toString());

    // Agregar filtros si existen
    if (filtros.busquedaGeneral) {
      params = params.set('busqueda', filtros.busquedaGeneral);
    }
    if (filtros.estado) {
      params = params.set('estado', filtros.estado);
    }
    if (filtros.formaPago) {
      params = params.set('formaPago', filtros.formaPago);
    }
    if (filtros.asesor) {
      params = params.set('asesor', filtros.asesor);
    }
    if (filtros.especialista) {
      params = params.set('especialista', filtros.especialista);
    }
    if (filtros.fechaDesde) {
      params = params.set('fechaDesde', filtros.fechaDesde);
    }
    if (filtros.fechaHasta) {
      params = params.set('fechaHasta', filtros.fechaHasta);
    }

    console.log('Params', params);
    return this.http.get(`${this.apiUrl}/ventas-get`, { params });
  }

  /**
   * Obtiene estadísticas generales del sistema (para las tarjetas de resumen)
   */
  obtenerEstadisticasVentas(filtros: any = {}): Observable<any> {
    let params = new HttpParams();

    // Agregar filtros si existen
    if (filtros.busquedaGeneral) {
      params = params.set('busqueda', filtros.busquedaGeneral);
    }
    if (filtros.estado) {
      params = params.set('estado', filtros.estado);
    }
    // ... otros filtros

    return this.http.get(`${this.apiUrl}/ventas-estadisticas`, { params });
  }

  // Los demás métodos permanecen igual...
  anularVenta(ventaKey: string, motivo: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/ventas-anular/${ventaKey}`, {
      motivo_cancelacion: motivo
    });
  }

  realizarAbono(ventaKey: string, datosAbono: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/ventas-abonar/${ventaKey}`, datosAbono);
  }

  obtenerDetalleVenta(ventaKey: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/ventas-get/${ventaKey}`);
  }
}