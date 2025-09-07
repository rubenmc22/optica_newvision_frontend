import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ErrorHandlerService } from '../../services/errorHandlerService'; 

@Injectable({
  providedIn: 'root'
})
export class PacientesService {

  private readonly REQUEST_TIMEOUT = 8000; // 8 segundos

  constructor(
    private http: HttpClient,
    private errorHandler: ErrorHandlerService
  ) { }

  getPacientes(): Observable<{ pacientes: any[] }> {
    return this.http
      .get<{ pacientes: any[] }>(`${environment.apiUrl}/paciente-get/`)
      .pipe(
        timeout(this.REQUEST_TIMEOUT),
        catchError(error => this.errorHandler.handleHttpError(error))
      );
  }


  createPaciente(paciente: any): Observable<any> {
    return this.http.post(`${environment.apiUrl}/paciente-add`, paciente).pipe(
      timeout(this.REQUEST_TIMEOUT),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

  updatePaciente(clavePaciente: string, payload: any): Observable<any> {
    return this.http.put(`${environment.apiUrl}/paciente-update/${clavePaciente}`, payload).pipe(
      timeout(this.REQUEST_TIMEOUT),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

  deletePaciente(clavePaciente: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/paciente-delete/${clavePaciente}`).pipe(
      timeout(this.REQUEST_TIMEOUT),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

  getPaciente(id: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/pacientes/${id}`).pipe(
      map(paciente => ({
        ...paciente,
        historiasCount: paciente.historias?.length || 0,
        ultimaConsulta: paciente.historias
          ? this.getFechaMasReciente(paciente.historias)
          : null
      })),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

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
    const fechas = historias.map(h => h.fecha).filter(Boolean);
    if (fechas.length === 0) return '';
    return fechas.reduce((latest, fecha) => fecha > latest ? fecha : latest, fechas[0]);
  }

  getHistoriasPaciente(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/pacientes/${id}/historias`).pipe(
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }
}
