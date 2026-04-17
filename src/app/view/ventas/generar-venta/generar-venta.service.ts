import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { HistorialTasa, Tasa } from '../../../Interfaces/models-interface';

export interface VentaResponse {
  exito: boolean;
  mensaje: string;
  numeroVenta?: string;
  ventaId?: string;
  datos?: any;
}

export interface CostosConsulta {
  totalConsulta: string;
  costoMedico: string;
  costoOptica: string;
}

@Injectable({
  providedIn: 'root'
})
export class GenerarVentaService {


  private baseUrl = `${environment.apiUrl}`;
  private ventaCreadaSubject = new Subject<any>();
  public ventaCreada$ = this.ventaCreadaSubject.asObservable();

  constructor(private http: HttpClient) { }

  private formatearFechaYYYYMMDD(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getTasas(): Observable<{ message: string; tasas: Tasa[] }> {
    return this.http.get<{ message: string; tasas: Tasa[] }>(
      `${this.baseUrl}/tasas/`
    );
  }

  /**
   * Crear una nueva venta
   */
  crearVenta(datosVenta: any): Observable<VentaResponse> {
    return this.http.post<VentaResponse>(`${this.baseUrl}/ventas-add`, datosVenta);
  }

  notificarVentaCreada(payload: any): void {
    this.ventaCreadaSubject.next(payload);
  }

  obtenerEstadoCaja(fecha: Date, sede: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/cierre-caja/resumen`, {
      params: {
        fecha: this.formatearFechaYYYYMMDD(fecha),
        sede
      }
    });
  }

  getCostosConsulta(historiaId: string): Observable<CostosConsulta> {
    return this.http.get<CostosConsulta>(`${this.baseUrl}/configuracion/costoConsultas`);
  }
}