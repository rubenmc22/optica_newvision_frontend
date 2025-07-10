// atletas.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators'; // Importa el operador map
import { environment } from '../../../../environments/environment';
//import { Empleado, ApiResponse } from '../../../Interfaces/models-interface';

@Injectable({
  providedIn: 'root'
})

export class PacientesService {

  constructor(private http: HttpClient) { }

  getPacientes(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/paciente-get/`);
  }

  createPaciente(paciente: any): Observable<any> {
    return this.http.post(`${environment.apiUrl}/paciente-add`, paciente);
  }

  updatePaciente(clavePaciente: string, payload: any): Observable<any> {
    // console.log('RDMC Dentro de id', id);
    console.log('RDMC Dentro de paciente', payload);
    return this.http.put(`${environment.apiUrl}/paciente-update/${clavePaciente}`, payload);

  }

  deletePaciente(clavePaciente: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/paciente-delete/${clavePaciente}`);
  }



  // Para detalle completo (usado en historias médicas)
  getPaciente(id: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/pacientes/${id}`).pipe(
      map(paciente => ({
        ...paciente,
        historiasCount: paciente.historias?.length || 0,
        ultimaConsulta: paciente.historias
          ? this.getFechaMasReciente(paciente.historias)
          : null
        // otros campos extendidos
      }))
    );
  }

  // Métodos auxiliares con implementación completa
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
      .filter(fecha => fecha); // Filtra fechas vacías o inválidas

    if (fechas.length === 0) return '';

    return fechas.reduce((latest, fecha) =>
      fecha > latest ? fecha : latest, fechas[0]);
  }

  // En tu pacientes.service.ts
  getHistoriasPaciente(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/pacientes/${id}/historias`);
  }

}


