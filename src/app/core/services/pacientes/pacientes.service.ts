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
    return this.http.get(environment.apiUrl);
  }

  createPaciente(paciente: any): Observable<any> {
    return this.http.post(environment.apiUrl, paciente);
  }

  updatePaciente(id: string, paciente: any): Observable<any> {
    return this.http.put(`${environment.apiUrl}/${id}`, paciente);
  }

  deletePaciente(id: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/${id}`);
  }
}


