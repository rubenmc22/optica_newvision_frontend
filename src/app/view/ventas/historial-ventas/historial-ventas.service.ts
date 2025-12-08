import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, map, Observable, tap, throwError } from 'rxjs';
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

// Modifica temporalmente el método anularVenta para más detalle
anularVenta(ventaKey: string, motivo: string): Observable<any> {
    const url = `${this.apiUrl}/ventas-anular/${ventaKey}`;
    
    console.log('🔍 DEBUG - URL:', url);
    console.log('🔍 DEBUG - Motivo:', motivo);
    
    const body = {
        motivo_cancelacion: motivo
    };
    
    console.log('🔍 DEBUG - Body:', JSON.stringify(body));
    
    return this.http.put<any>(url, body, {
        observe: 'response' // Esto nos da toda la respuesta HTTP
    }).pipe(
        tap(response => {
            console.log('✅ Respuesta completa:', {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                body: response.body
            });
        }),
        map(response => response.body), // Extraer solo el body para compatibilidad
        catchError(error => {
            console.error('❌ Error HTTP completo:', {
                name: error.name,
                message: error.message,
                status: error.status,
                statusText: error.statusText,
                error: error.error,
                url: error.url,
                headers: error.headers
            });
            
            // Mostrar el error específico del backend si existe
            if (error.error) {
                console.error('❌ Error del backend:', error.error);
            }
            
            return throwError(() => error);
        })
    );
}

  realizarAbono(ventaKey: string, datosAbono: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/ventas-abonar/${ventaKey}`, datosAbono);
  }

  obtenerDetalleVenta(ventaKey: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/ventas-get/${ventaKey}`);
  }
}