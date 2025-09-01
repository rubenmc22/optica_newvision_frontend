// atletas.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators'; // Importa el operador map
import { environment } from '../../../../environments/environment';
import { HistoriaMedica, HistoriaMedicaCompleta, Conformidad, HistorialResponse, RespuestaCreacionHistoria } from './../../../view/historias-medicas/historias_medicas-interface';
import { ErrorHandlerService } from '../../services/errorHandlerService';


@Injectable({
  providedIn: 'root'
})

export class HistoriaMedicaService {

  private readonly REQUEST_TIMEOUT = 10000; // opcional, mismo patrón que en pacientes

  constructor(
    private http: HttpClient,
    private errorHandler: ErrorHandlerService
  ) { }

  getHistoriasPaciente(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/pacientes/${id}/historias`).pipe(
      timeout(this.REQUEST_TIMEOUT),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

  getHistoriasMedicasAll(): Observable<{ message: string; historiales_medicos: any[] }> {
    return this.http.get<{ message: string; historiales_medicos: any[] }>(`${environment.apiUrl}/historial-medico-all`).pipe(
      timeout(this.REQUEST_TIMEOUT),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

  getHistoriasPorPaciente(pacienteKey: string): Observable<HistoriaMedica[]> {
    const url = `${environment.apiUrl}/historial-medico-paciente/${pacienteKey}`;
    return this.http.get<HistorialResponse>(url).pipe(
      timeout(this.REQUEST_TIMEOUT),
      map(response => response.historiales_medicos),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

  createHistoria(historia: HistoriaMedica): Observable<RespuestaCreacionHistoria> {
    return this.http.post<RespuestaCreacionHistoria>(`${environment.apiUrl}/historial-medico-add`, historia).pipe(
      timeout(this.REQUEST_TIMEOUT),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

  updateHistoria(nHistoria: string, historia: HistoriaMedica): Observable<HistoriaMedica> {
    return this.http.put<HistoriaMedica>(`${environment.apiUrl}/historial-medico-update/${nHistoria}`, historia).pipe(
      timeout(this.REQUEST_TIMEOUT),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

  // Métodos auxiliares
  public calcularEdad(fechaNacimiento: string): number {
    const fechaNac = new Date(fechaNacimiento);
    const hoy = new Date();
    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const mes = hoy.getMonth() - fechaNac.getMonth();

    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
      edad--;
    }
    return edad;
  }

  private getFechaMasReciente(historias: any[]): string {
    if (!historias || historias.length === 0) return '';

    const fechas = historias
      .map(h => h.fecha)
      .filter(fecha => fecha);

    if (fechas.length === 0) return '';

    return fechas.reduce((latest, fecha) =>
      fecha > latest ? fecha : latest, fechas[0]);
  }
}


