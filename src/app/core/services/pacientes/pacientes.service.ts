import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ErrorHandlerService } from '../../services/errorHandlerService';
import { Empresa } from './../../../view/pacientes/paciente-interface';


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

  // Método para buscar empresa por RIF con sede específica
  buscarEmpresaPorRif(rif: string, sede: string): Observable<any> {
    // Validar parámetros
    if (!rif || !sede) {
      return of({ empresa: null, encontrada: false, error: 'RIF y sede son requeridos' });
    }

    // Formatear el RIF antes de enviar
    const rifNormalizado = this.formatearRifParaAPI(rif);
    const sedeNormalizada = sede.trim().toLowerCase();

    console.log(`Buscando empresa - RIF: ${rifNormalizado}, Sede: ${sedeNormalizada}`);

    // Parámetros según la documentación de Postman
    const params = {
      rif: rifNormalizado,
      sede: sedeNormalizada
    };

    return this.http.get<any>(`${environment.apiUrl}/empresas-get`, { params }).pipe(
      timeout(this.REQUEST_TIMEOUT),
      map(response => {
        console.log('Respuesta completa de API empresas:', response);

        // Verificar si la respuesta es válida
        const empresaValida = this.validarRespuestaEmpresa(response);

        if (empresaValida) {
          return {
            empresa: this.normalizarDatosEmpresa(response),
            encontrada: true
          };
        } else {
          return {
            empresa: null,
            encontrada: false,
            error: 'La empresa no existe en el sistema'
          };
        }
      }),
      catchError(error => {
        console.error('Error buscando empresa por RIF:', error);

        // Si es error 404, retornar empresa no encontrada
        if (error.status === 404) {
          return of({
            empresa: null,
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
          empresa: null,
          encontrada: false,
          error: errorMessage
        });
      })
    );
  }

  /**
   * Formatea el RIF para la API (asegura formato correcto)
   */
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

  /**
   * Valida si la respuesta de la API contiene datos reales de empresa
   */
  private validarRespuestaEmpresa(respuesta: any): boolean {
    // Si la respuesta es null o undefined
    if (!respuesta) {
      return false;
    }

    // Si es un array vacío
    if (Array.isArray(respuesta) && respuesta.length === 0) {
      return false;
    }

    // Si es un objeto vacío
    if (typeof respuesta === 'object' && Object.keys(respuesta).length === 0) {
      return false;
    }

    // Verificar campos mínimos que debe tener una empresa
    const empresa = Array.isArray(respuesta) ? respuesta[0] : respuesta;

    // Debe tener al menos un identificador o nombre
    const tieneIdentificador = empresa.id || empresa.rif || empresa.codigo;
    const tieneNombre = empresa.razon_social || empresa.nombre_comercial || empresa.nombre;

    return !!(tieneIdentificador && tieneNombre);
  }

  /**
   * Normaliza los datos de la empresa para consistencia
   */
  private normalizarDatosEmpresa(empresa: any): any {
    const empresaData = Array.isArray(empresa) ? empresa[0] : empresa;

    return {
      // Información básica
      id: empresaData.id,
      rif: empresaData.rif,
      codigo: empresaData.codigo,

      // Nombres (todas las posibles variaciones)
      razon_social: empresaData.razon_social,
      nombre_comercial: empresaData.nombre_comercial,
      nombre: empresaData.nombre,

      // Contacto
      telefono: empresaData.telefono,
      email: empresaData.email,
      direccion: empresaData.direccion,

      // Otros datos que puedan existir
      ...empresaData
    };
  }

  // Método para normalizar RIF
  private normalizarRif(rif: string): string {
    if (!rif) return '';

    // Remover espacios, convertir a mayúsculas
    let rifNormalizado = rif.trim().toUpperCase();

    // Asegurar que tenga el guión si no lo tiene
    if (!rifNormalizado.includes('-') && rifNormalizado.length > 1) {
      rifNormalizado = rifNormalizado.charAt(0) + '-' + rifNormalizado.slice(1);
    }

    // Remover caracteres especiales adicionales
    rifNormalizado = rifNormalizado.replace(/[^JGVE0-9-]/g, '');

    return rifNormalizado;
  }
}
