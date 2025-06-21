// atletas.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators'; // Importa el operador map
import { environment } from '../../../../environments/environment';
import { Empleado, ApiResponse } from '../../../Interfaces/models-interface';

@Injectable({
  providedIn: 'root'
})

export class EmpleadosService {
  private apiUrl = `${environment.apiUrl}/get-usuarios`;

  constructor(private http: HttpClient) { }
  /**
   * Obtiene todos los atletas sin filtros (para filtrar en frontend)
   */
  getAllEmpleados(): Observable<Empleado[]> {
    return this.http.get<{ message: string; usuarios: any[] }>(`${this.apiUrl}`).pipe(
      map(response => {
        if (!response || !Array.isArray(response.usuarios)) {
          throw new Error('Formato de respuesta inválido');
        }

        return response.usuarios.map(usuario => this.mapUsuarioToEmpleado(usuario));
      }),
      catchError(error => {
        console.error('Error al obtener empleados:', error);
        return of([]);
      })
    );
  }

  // empleados.service.ts

  mapUsuarioToEmpleado(usuario: any): Empleado {
    return {
      id: usuario.id,
      cedula: usuario.cedula,
      nombre: usuario.nombre,
      email: usuario.correo ?? 'Sin dato',
      telefono: usuario.telefono ?? 'Sin dato',
      fechaNacimiento: usuario.fecha_nacimiento ?? 'Sin dato',
      avatarUrl: usuario.avatar_url?.trim()
        ? usuario.avatar_url
        : usuario.ruta_imagen
          ? `${environment.baseUrl}${usuario.ruta_imagen}`
          : 'assets/default-photo.png',
      rolId: usuario.rol?.id ?? '',
      rolNombre: usuario.rol?.nombre ?? 'Sin rol',
      cargoId: usuario.cargo?.id ?? '',
      cargoNombre: usuario.cargo?.nombre ?? 'Sin cargo',
      estatus: Boolean(usuario.activo),
      editing: false,
      modified: false,
      hasErrors: false,
      errors: {},
      loading: false,
      originalValues: null
    };
  }

  addEmployees(employee: any): Observable<any> {
    return this.http.post(`${environment.apiUrl}/add-usuarios`, employee).pipe(
      catchError(error => {
        console.error('Error al agregar empleado:', error);

        const backendMessage =
          error?.error?.message || 'Error desconocido al agregar empleado';

        return throwError(() => new Error(backendMessage));
      })

    );
  }

  getRoles(): Observable<{ id: string, nombre: string }[]> {
    return this.http.get<{ roles: { id: string, nombre: string }[] }>(`${environment.apiUrl}/roles-get`).pipe(
      map(response => response.roles.map(role => ({ id: role.id, nombre: role.nombre }))), // ✅ Normaliza los datos
      catchError(error => {
        console.error('Error al obtener roles:', error);
        return of([]);
      })
    );
  }

  getCargos(): Observable<{ id: string, nombre: string }[]> {
    return this.http.get<{ cargos: { id: string, nombre: string }[] }>(`${environment.apiUrl}/cargos-get`).pipe(
      map(response => response.cargos.map(pos => ({ id: pos.id, nombre: pos.nombre }))), // ✅ Normaliza los datos
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
    return this.http.delete<void>(`${environment.apiUrl}/delete-usuarios/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any) {
    console.error('Ocurrió un error:', error);
    return throwError(() => new Error('Error al procesar la solicitud'));
  }

  actualizarEstado(id: string, estatus: boolean): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/activar-usuarios/${id}`, { estatus }).pipe(
      catchError(this.handleError)
    );
  }

  actualizarEmpleado(employee: Empleado): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/update-usuarios/${employee.cedula}`, employee).pipe(
      catchError(this.handleError)
    );
  }



}