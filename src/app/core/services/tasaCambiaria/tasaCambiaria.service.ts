// atletas.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators'; // Importa el operador map
import { environment } from '../../../../environments/environment';
import { HistorialTasa} from '../../../Interfaces/models-interface';

@Injectable({
  providedIn: 'root'
})

export class TasaCambiariaService {

  constructor(private http: HttpClient) { }


  getTasaActual(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/tasas/`);
  }

  getTasaActual_id(id: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/tasas/${id}`);
  }

  getTasaAutomaticaBCV(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/get-tasa-bcv/`);
  }

  updateTasaManual(id: string, valor: number, metodo: string, fecha: string): Observable<any> {
    return this.http.put(`${environment.apiUrl}/tasas-update/${id}`, { valor, metodo, fecha });
  }

  updateTasaBCV(): Observable<any> {
    return this.http.put(`${environment.apiUrl}/tasas-update-with-bcv/`, {});
  }

  activarRastreoAutoamticoBCV(id: string, rastrear_auto: boolean): Observable<any> {
    return this.http.put(`${environment.apiUrl}/tasas-rastreo-automatico/${id}`, { rastrear_auto });
  }

getHistorialTasas(id: string): Observable<{ message: string; historial: HistorialTasa[] }> {
  const url = `${environment.apiUrl}/tasas-history/${id}`;
  return this.http.get<{ message: string; historial: HistorialTasa[] }>(url);
}


}


