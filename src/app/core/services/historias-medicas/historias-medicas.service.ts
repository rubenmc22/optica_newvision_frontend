// atletas.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators'; // Importa el operador map
import { environment } from '../../../../environments/environment';
import { HistoriaMedica, HistoriaMedicaCompleta, Conformidad, HistorialResponse, RespuestaCreacionHistoria } from './../../../view/historias-medicas/historias_medicas-interface';


@Injectable({
  providedIn: 'root'
})

export class HistoriaMedicaService {

  constructor(private http: HttpClient) { }


  // En tu pacientes.service.ts
  getHistoriasPaciente(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/pacientes/${id}/historias`);
  }

  getHistoriasMedicasAll(): Observable<{ message: string; historiales_medicos: any[] }> {
  return this.http.get<{ message: string; historiales_medicos: any[] }>(`${environment.apiUrl}/historial-medico-all`);
}



  // En historia-medica.service.ts
  getHistoriasPorPaciente(pacienteKey: string): Observable<HistoriaMedica[]> {
    const url = `${environment.apiUrl}/historial-medico-paciente/${pacienteKey}`;
    return this.http.get<HistorialResponse>(url).pipe(
      map(response => response.historiales_medicos),
      catchError(error => {
        console.error('Error al obtener historias del paciente:', error);
        return of([]);
      })
    );
  }

  createHistoria(historia: HistoriaMedica): Observable<RespuestaCreacionHistoria> {
    return this.http.post<RespuestaCreacionHistoria>(`${environment.apiUrl}/historial-medico-add`, historia);
  }


  updateHistoria(nHistoria: string, historia: HistoriaMedica): Observable<HistoriaMedica> {
    return this.http.put<HistoriaMedica>(`${environment.apiUrl}/historial-medico-update/${nHistoria}`, historia);
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



}


