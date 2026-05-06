import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import { Presupuesto } from './presupuesto.interfaz';
import { environment } from 'src/environments/environment';
import { ErrorHandlerService } from './../../../core/services/errorHandlerService';

export interface PresupuestoCorreoResultado {
  enviado: boolean;
  motivo?: string;
  detalle?: string | null;
  destinatarios?: string[];
  messageId?: string | null;
  documentoPdf?: {
    modulo: string;
    renderer: string;
    publicUrl: string;
    publicPrintUrl: string;
  } | null;
}

export interface CrearPresupuestoResponse {
  presupuesto: Presupuesto;
  correo?: PresupuestoCorreoResultado;
}

export interface EnviarCorreoPresupuestoResponse {
  presupuesto: Presupuesto;
  correo?: PresupuestoCorreoResultado;
}

@Injectable({
  providedIn: 'root'
})
export class PresupuestoService {
  private readonly apiUrl = `${environment.apiUrl}`;
  private readonly REQUEST_TIMEOUT = 8000;

  constructor(
    private http: HttpClient,
    private errorHandler: ErrorHandlerService
  ) { }

  getPresupuestos(): Observable<Presupuesto[]> {
    return this.http.get<{ presupuestos?: Presupuesto[] }>(`${this.apiUrl}/presupuestos-get`).pipe(
      timeout(this.REQUEST_TIMEOUT),
      map((response) => Array.isArray(response?.presupuestos) ? response.presupuestos : []),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

  getPresupuesto(id: number): Observable<Presupuesto> {
    return this.http.get<{ presupuesto: Presupuesto }>(`${this.apiUrl}/presupuestos-get/${id}`).pipe(
      timeout(this.REQUEST_TIMEOUT),
      map((response) => response.presupuesto),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

  obtenerPresupuestoPublico(token: string): Observable<Presupuesto> {
    return this.http.get<{ presupuesto: Presupuesto }>(`${this.apiUrl}/presupuestos/publico`, {
      params: { token: String(token || '').trim() }
    }).pipe(
      timeout(this.REQUEST_TIMEOUT),
      map((response) => response.presupuesto),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

  crearPresupuesto(presupuesto: unknown): Observable<CrearPresupuestoResponse> {
    return this.http.post<CrearPresupuestoResponse>(`${this.apiUrl}/presupuestos-add`, presupuesto).pipe(
      timeout(this.REQUEST_TIMEOUT),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

  enviarCorreoPresupuesto(id: number, payload: unknown): Observable<EnviarCorreoPresupuestoResponse> {
    return this.http.post<EnviarCorreoPresupuestoResponse>(`${this.apiUrl}/presupuestos-enviar-correo/${id}`, payload).pipe(
      timeout(this.REQUEST_TIMEOUT),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

  actualizarPresupuesto(id: number, presupuesto: unknown): Observable<Presupuesto> {
    return this.http.put<{ presupuesto: Presupuesto }>(`${this.apiUrl}/presupuestos-update/${id}`, presupuesto).pipe(
      timeout(this.REQUEST_TIMEOUT),
      map((response) => response.presupuesto),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

  eliminarPresupuesto(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/presupuestos-delete/${id}`).pipe(
      timeout(this.REQUEST_TIMEOUT),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

  renovarPresupuesto(id: number, dias: number = 7): Observable<Presupuesto> {
    return this.http.put<{ presupuesto: Presupuesto }>(`${this.apiUrl}/presupuestos-renovar/${id}`, { dias }).pipe(
      timeout(this.REQUEST_TIMEOUT),
      map((response) => response.presupuesto),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

  autoArchivarPresupuestos(dias: number): Observable<{ archivados: number; dias: number }> {
    return this.http.post<{ archivados: number; dias: number }>(`${this.apiUrl}/presupuestos-auto-archivar`, { dias }).pipe(
      timeout(this.REQUEST_TIMEOUT),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }
}