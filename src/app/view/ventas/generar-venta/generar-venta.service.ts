import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { HistorialTasa, Tasa } from '../../../Interfaces/models-interface';

export interface VentaResponse {
  exito: boolean;
  mensaje: string;
  numeroVenta?: string;
  ventaId?: string;
  datos?: any;
}

@Injectable({
  providedIn: 'root'
})
export class GenerarVentaService {

  private baseUrl = `${environment.apiUrl}`;

  constructor(private http: HttpClient) { }

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
}