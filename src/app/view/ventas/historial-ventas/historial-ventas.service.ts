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
   * Obtiene estadísticas con los mismos filtros aplicados
   */
  obtenerEstadisticasVentas(filtros: any = {}): Observable<any> {
    let params = new HttpParams();

    // Agregar filtros solo si tienen valor
    Object.keys(filtros).forEach(key => {
      const valor = filtros[key];

      if (valor !== null && valor !== undefined && valor !== '') {
        // Para fechas, asegurar formato correcto
        if (key === 'fechaDesde' || key === 'fechaHasta') {
          const fecha = new Date(valor);
          if (!isNaN(fecha.getTime())) {
            params = params.set(key, fecha.toISOString().split('T')[0]);
          }
        } else {
          params = params.set(key, valor.toString());
        }
      }
    });

    return this.http.get(`${this.apiUrl}/ventas-get-total`, { params });
  }

  // Modifica temporalmente el método anularVenta para más detalle
  anularVenta(ventaKey: string, motivo: string): Observable<any> {
    const url = `${this.apiUrl}/ventas-anular/${ventaKey}`;

    const body = {
      motivo_cancelacion: motivo
    };

    return this.http.put<any>(url, body, {
      observe: 'response' // Esto nos da toda la respuesta HTTP
    }).pipe(
      tap(response => {
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
    return this.http.put(`${this.apiUrl}/ventas-abonar/${ventaKey}`, datosAbono);
  }

  obtenerDetalleVenta(ventaKey: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/ventas-get/${ventaKey}`);
  }

  obtenerVentasPaginadas(
    pagina: number = 1,
    itemsPorPagina: number = 25,
    filtros: any = {}
  ): Observable<any> {
    let params = new HttpParams()
      .set('pagina', pagina.toString())
      .set('itemsPorPagina', itemsPorPagina.toString());

    // IMPORTANTE: No filtrar, enviar TODOS los parámetros que vienen
    Object.keys(filtros).forEach(key => {
      const valor = filtros[key];

      // Enviar todos los valores que no sean null/undefined
      if (valor !== null && valor !== undefined) {
        // Para búsqueda general, enviar el texto original
        if (key === 'busquedaGeneral') {
          params = params.set('busquedaGeneral', valor.toString());
        }
        // Para campos numéricos, enviar siempre
        else if (['busquedaNumerica', 'ultimosDigitos', 'tipoBusqueda', 'valorNormalizado'].includes(key)) {
          if (valor && valor.toString().trim() !== '') {
            params = params.set(key, valor.toString());
          }
        }
        // Para otros filtros normales
        else if (valor.toString().trim() !== '') {
          params = params.set(key, valor.toString());
        }
      }
    });

    return this.http.get(`${this.apiUrl}/ventas-get`, { params });
  }

  obtenerHistorialVentas(
    pagina: number = 1,
    itemsPorPagina: number = 25,
    filtros: any = {}
  ): Observable<any> {
    // Puedes mantener este método como alias para compatibilidad
    return this.obtenerVentasPaginadas(pagina, itemsPorPagina, filtros);
  }

  // En HistorialVentaService
  obtenerEstadisticasConteo(filtros: any = {}): Observable<any> {
    let params = new HttpParams();

    // Solo enviar parámetros que realmente tiene valor
    Object.keys(filtros).forEach(key => {
      const valor = filtros[key];

      // Validar que no sea null, undefined, o string vacío
      if (valor !== null && valor !== undefined && valor !== '') {
        // Para fechas, convertir a formato YYYY-MM-DD
        if (key === 'fechaDesde' || key === 'fechaHasta') {
          try {
            const fecha = new Date(valor);
            if (!isNaN(fecha.getTime())) {
              params = params.set(key, fecha.toISOString().split('T')[0]);
            }
          } catch (e) {
            console.warn(`Error al procesar fecha ${key}:`, valor);
          }
        } else {
          params = params.set(key, valor.toString());
        }
      }
    });

    return this.http.get(`${this.apiUrl}/ventas-get-total`, { params });
  }

  obtenerVentasParaCalculoMontos(filtros: any = {}): Observable<any> {
    let params = new HttpParams();

    // Enviar SOLO los parámetros esenciales para montos
    Object.keys(filtros).forEach(key => {
      const valor = filtros[key];

      // Para cálculo de montos, solo necesitamos algunos filtros
      if (valor !== null && valor !== undefined && valor !== '') {
        // Solo enviar filtros que afecten montos significativamente
        if (key === 'fechaDesde' || key === 'fechaHasta' || key === 'estado') {
          if (key === 'fechaDesde' || key === 'fechaHasta') {
            try {
              const fecha = new Date(valor);
              if (!isNaN(fecha.getTime())) {
                params = params.set(key, fecha.toISOString().split('T')[0]);
              }
            } catch (e) {
              console.warn(`Error al procesar fecha ${key}:`, valor);
            }
          } else {
            params = params.set(key, valor.toString());
          }
        }
      }
    });

    // Limitar a una cantidad razonable para cálculo
    params = params.set('itemsPorPagina', '100');

    return this.http.get(`${this.apiUrl}/ventas-get`, { params });
  }

  obtenerEstadisticasFinancieras(filtros: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/estadisticas-financieras`, filtros);
  }
}
