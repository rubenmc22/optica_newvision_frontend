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
   * Obtiene el historial de ventas con paginación y filtros desde el backend
   */
  obtenerHistorialVentas(
    pagina: number = 1,
    itemsPorPagina: number = 25,
    filtros: any = {}
  ): Observable<any> {
    let params = new HttpParams()
      .set('pagina', pagina.toString())
      .set('itemsPorPagina', itemsPorPagina.toString());

    // Agregar TODOS los filtros al backend
    Object.keys(filtros).forEach(key => {
      if (filtros[key] !== null && filtros[key] !== undefined && filtros[key] !== '') {
        params = params.set(key, filtros[key].toString());
      }
    });

    console.log('🔍 Enviando filtros al backend:', filtros);
    console.log('📦 Parámetros HTTP:', params.toString());

    return this.http.get(`${this.apiUrl}/ventas-get`, { params });
  }

  /**
   * Obtiene estadísticas con los mismos filtros aplicados
   */
  obtenerEstadisticasVentas(filtros: any = {}): Observable<any> {
    let params = new HttpParams();

    // Agregar los mismos filtros para estadísticas
    Object.keys(filtros).forEach(key => {
      if (filtros[key] !== null && filtros[key] !== undefined && filtros[key] !== '') {
        params = params.set(key, filtros[key].toString());
      }
    });

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