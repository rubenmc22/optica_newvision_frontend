// atletas.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators'; // Importa el operador map
import { environment } from '../../../../environments/environment';
import { Atleta, ApiResponse } from '../../../Interfaces/models-interface';


@Injectable({
  providedIn: 'root'
})

export class EmpleadosService {
  private apiUrl = `${environment.apiUrl}/usuarios/get`;

  constructor(private http: HttpClient) { }
  /**
   * Obtiene todos los atletas sin filtros (para filtrar en frontend)
   */
  /*getAllEmpleados(): Observable<Atleta[]> {
    return this.http.get<ApiResponse>(this.apiUrl).pipe(
      map(response => {
        if (!response || !Array.isArray(response.atletas)) {
          throw new Error('Formato de respuesta inválido');
        }
        //console.log('response', response);
        return response.atletas.map(atleta => ({
          ...atleta
        }));
      }),
      catchError(error => {
        console.error('Error al obtener atletas:', error);
        return of([]);
      })
    );
  }*/

  addEmployee(employee: any): Observable<any> {
    return this.http.post(`${environment.apiUrl}/employees`, employee).pipe(
      catchError(error => {
        console.error('Error al agregar empleado:', error);
        return throwError(() => new Error('Error al agregar empleado'));
      })
    );
  }

  getRoles(): Observable<string[]> {
    return this.http.get<{ roles: { id: string, nombre: string }[] }>(`${environment.apiUrl}/roles/get`).pipe(
      map(response => response.roles.map(role => role.nombre)), // ✅ Extrae solo los nombres
      catchError(error => {
        console.error('Error al obtener roles:', error);
        return of([]);
      })
    );
  }


  getCargos(): Observable<string[]> {
    return this.http.get<{ cargos: { id: string, nombre: string }[] }>(`${environment.apiUrl}/cargos/get`).pipe(
      map(response => response.cargos.map(cargo => cargo.nombre)), // ✅ Extrae solo nombres
      catchError(error => {
        console.error('Error al obtener cargos:', error);
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
  eliminarEmpleados(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any) {
    console.error('Ocurrió un error:', error);
    return throwError(() => new Error('Error al procesar la solicitud'));
  }

}