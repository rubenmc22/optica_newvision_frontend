import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrdenTrabajo, OrdenesTrabajoResponse, EstadoOrden } from './gestion-ordenes-trabajo.model';

@Injectable({
  providedIn: 'root'
})
export class OrdenesTrabajoService {
  private baseUrl = `${environment.apiUrl}`;

  constructor(private http: HttpClient) { }

  /**
   * Obtener todas las órdenes de trabajo
   */
  getOrdenesTrabajo(): Observable<OrdenesTrabajoResponse> {
    return this.http.get<OrdenesTrabajoResponse>(`${this.baseUrl}/orden-trabajo-get`);
  }

  /**
   * Cambiar estado de una orden 
   */
  cambiarEstadoOrden(ordenNumero: string, estado: EstadoOrden): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.baseUrl}/orden-trabajo-change-status`, {
      orden_numero: ordenNumero,
      estado: estado
    });
  }

  /**
   * Cambiar estado a todas las órdenes con un estado actual específico
   */
  cambiarEstadoTodasOrdenes(estadoActual: EstadoOrden, estadoNuevo: EstadoOrden): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.baseUrl}/orden-trabajo-change-status-all`, {
      estado_actual: estadoActual,
      estado_nuevo: estadoNuevo
    });
  }

  /**
   * Actualizar progreso de una orden
   */
  actualizarProgresoOrden(ordenNumero: string, progreso: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.baseUrl}/orden-trabajo-update-process`, {
      orden_numero: ordenNumero,
      progreso: progreso
    });
  }

  /**
   * Archivar una orden (nueva API)
   */
  archivarOrden(ordenNumero: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.baseUrl}/orden-trabajo-archive`, {
      orden_numero: ordenNumero
    });
  }

  /**
   * Desarchivar una orden (nueva API)
   */
  desarchivarOrden(ordenNumero: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.baseUrl}/orden-trabajo-unarchive`, {
      orden_numero: ordenNumero
    });
  }

  /**
   * Método para compatibilidad - actualizar estado con datos adicionales
   * Nota: Este método podría necesitar ajustarse según lo que el API soporte
   */
  actualizarEstadoOrdenCompleto(ordenNumero: string, estado: string, datos: any = {}): Observable<{ message: string }> {
    // Si el API requiere enviar todos los datos de una vez
    return this.http.put<{ message: string }>(`${this.baseUrl}/orden-trabajo-change-status`, {
      orden_numero: ordenNumero,
      estado: estado,
      ...datos // Datos adicionales como fechas si el API lo soporta
    });
  }

  // En ordenes-trabajo.service.ts
  /**
   * Actualizar fecha de entrega estimada de una orden
   */
  actualizarFechaEntregaEstimada(ordenNumero: string, fechaEntregaEstimada: string): Observable<{ message: string }> {
    // Validar que la fecha esté en formato YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaEntregaEstimada)) {
      console.error('Formato de fecha inválido:', fechaEntregaEstimada);
      throw new Error('Formato de fecha debe ser YYYY-MM-DD');
    }

    const requestBody = {
      orden_numero: ordenNumero,
      fecha_entrega_estimada: fechaEntregaEstimada
    };

    console.log('DEBUG - Service - Request al API:', requestBody);

    return this.http.put<{ message: string }>(
      `${this.baseUrl}/orden-trabajo-update-fecha-entrega-estimada`,
      requestBody
    );
  }

  /**
   * Formatear fecha a YYYY-MM-DD - Método auxiliar si es necesario
   */
  private formatearFechaYYYYMMDD(fechaString: string): string {
    // Si ya está en formato YYYY-MM-DD, retornar directamente
    if (/^\d{4}-\d{2}-\d{2}$/.test(fechaString)) {
      return fechaString;
    }

    // Parsear la fecha
    const fecha = new Date(fechaString);

    // Usar UTC para consistencia
    const year = fecha.getUTCFullYear();
    const month = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const day = String(fecha.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}