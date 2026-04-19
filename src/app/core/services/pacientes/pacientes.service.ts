import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, Subject } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ErrorHandlerService } from '../../services/errorHandlerService';
import { Empresa } from './../../../view/pacientes/paciente-interface';


@Injectable({
  providedIn: 'root'
})
export class PacientesService {

  private readonly REQUEST_TIMEOUT = 8000; // 8 segundos

  private abrirModalNuevoPacienteSource = new Subject<void>();
  abrirModalNuevoPaciente$ = this.abrirModalNuevoPacienteSource.asObservable();

  constructor(
    private http: HttpClient,
    private errorHandler: ErrorHandlerService
  ) { }

  solicitarAbrirModalNuevoPaciente(): void {
    this.abrirModalNuevoPacienteSource.next();
  }

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

  // Método para buscar empresa por RIF con sede específica
  buscarEmpresaPorRif(rif: string, sede: string): Observable<any> {
    // Validar parámetros
    if (!rif || !sede) {
      return of({
        message: 'error',
        empresas: null,
        error: 'RIF y sede son requeridos'
      });
    }

    // Formatear el RIF antes de enviar
    const rifNormalizado = this.formatearRifParaAPI(rif);
    const sedeNormalizada = sede.trim().toLowerCase();

    // Parámetros para GET según la documentación de Postman
    const params = {
      rif: rifNormalizado,
      sede: sedeNormalizada
    };

    return this.http.get<any>(`${environment.apiUrl}/empresas-get`, { params }).pipe(
      timeout(this.REQUEST_TIMEOUT),
      map(response => {
        // Verificar si la respuesta es válida según tu API
        // Tu API retorna: { "message": "ok", "empresas": [...] }
        if (response && response.message === 'ok' &&
          response.empresas && Array.isArray(response.empresas)) {

          if (response.empresas.length > 0) {
            return response; // ← Retornar exactamente como la API responde
          } else {
            return {
              message: 'not_found',
              empresas: [],
              encontrada: false,
              error: 'No se encontraron empresas con ese RIF'
            };
          }

        } else {
          console.warn('⚠️ Respuesta de API no tiene el formato esperado:', response);
          return {
            message: 'error',
            empresas: [],
            encontrada: false,
            error: 'Formato de respuesta inválido de la API'
          };
        }
      }),
      catchError(error => {
        console.error('❌ Error buscando empresa por RIF:', error);

        // Si es error 404, retornar empresa no encontrada
        if (error.status === 404) {
          return of({
            message: 'not_found',
            empresas: [],
            encontrada: false,
            error: 'Empresa no encontrada en el sistema'
          });
        }

        // Para otros errores
        let errorMessage = 'Error al conectar con el servidor';
        if (error.status === 400) {
          errorMessage = 'Parámetros inválidos para la búsqueda';
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }

        return of({
          message: 'error',
          empresas: [],
          encontrada: false,
          error: errorMessage
        });
      })
    );
  }

  // Mantener los métodos auxiliares sin cambios:
  private formatearRifParaAPI(rif: string): string {
    if (!rif) return '';

    // Convertir a mayúsculas y quitar espacios
    let rifFormateado = rif.trim().toUpperCase();

    // Quitar caracteres no válidos
    rifFormateado = rifFormateado.replace(/[^JG0-9-]/g, '');

    // Asegurar formato: letra + guión + números
    if (!rifFormateado.includes('-') && rifFormateado.length > 1) {
      rifFormateado = rifFormateado.charAt(0) + '-' + rifFormateado.slice(1);
    }

    return rifFormateado;
  }

}
