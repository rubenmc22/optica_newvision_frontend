// atletas.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators'; // Importa el operador map
import { environment } from '../../../../environments/environment';
import { HistoriaMedica, HistoriaMedicaCompleta, Conformidad } from './../../../view/historias-medicas/historias_medicas-interface';

@Injectable({
  providedIn: 'root'
})

export class HistoriaMedicaService {

  constructor(private http: HttpClient) { }


  // En tu pacientes.service.ts
  getHistoriasPaciente(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/pacientes/${id}/historias`);
  }

  createHistoria(historia: HistoriaMedica): Observable<HistoriaMedica> {
    return this.http.post<HistoriaMedica>(`${environment.apiUrl}/historias-medicas`, historia);
  }

   updateHistoria(historia: HistoriaMedica): Observable<HistoriaMedica> {
    return this.http.post<HistoriaMedica>(`${environment.apiUrl}/historias-medicas`, historia);
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


