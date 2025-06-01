// atletas.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError  } from 'rxjs';
import { map, catchError } from 'rxjs/operators'; // Importa el operador map
import { environment } from '../../../../environments/environment';
import { Atleta, ApiResponse } from '../../../Interfaces/models-interface';


@Injectable({
  providedIn: 'root'
})

export class AtletasService {
  private apiUrl = `${environment.apiUrl}/atletas/get`;

  constructor(private http: HttpClient) { }
  /**
   * Obtiene todos los atletas sin filtros (para filtrar en frontend)
   */
  getAllAtletas(): Observable<Atleta[]> {
    return this.http.get<ApiResponse>(this.apiUrl).pipe(
      map(response => {
        if (!response || !Array.isArray(response.atletas)) {
          throw new Error('Formato de respuesta inválido');
        }
        //console.log('response', response);
        return response.atletas.map(atleta => ({
          ...atleta,
          edad: this.calcularEdad(atleta.fecha_nacimiento),
          generoTexto: atleta.genero === 'M' ? 'Masculino' : 'Femenino'
        }));
      }),
      catchError(error => {
        console.error('Error al obtener atletas:', error);
        return of([]);
      })
    );
  }

  private calcularEdad(fechaNacimiento: string): number {
    const nacimiento = new Date(fechaNacimiento);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();

    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }

    return edad;
  }

  /**
   * Elimina un atleta por su ID
   * @param id ID del atleta a eliminar
   */
  eliminarAtleta(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/atletas/delete/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any) {
    console.error('Ocurrió un error:', error);
    return throwError(() => new Error('Error al procesar la solicitud'));
  }

}