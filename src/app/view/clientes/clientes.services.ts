import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, map } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ClienteService {
    private baseUrl = `${environment.apiUrl}`;

    constructor(private http: HttpClient) { }

    /**
     * Buscar cliente por cédula o RIF
     */
    buscarPorCedula(cedula: string): Observable<any> {
        const params = new HttpParams().set('cedula', cedula);

        return this.http.get(`${this.baseUrl}/clientes-get`, { params }).pipe(
            catchError(error => {
                console.error('❌ Error buscando cliente:', error);
                if (error.error) {
                    console.error('❌ Error del servidor:', error.error);
                }
                return throwError(() => error);
            })
        );
    }

  
    /**
     * Crear un nuevo cliente
     */
    crearCliente(datosCliente: any): Observable<any> {
        return this.http.post(this.baseUrl, datosCliente);
    }

    /**
     * Actualizar cliente existente
     */
    actualizarCliente(id: string, datosCliente: any): Observable<any> {
        return this.http.put(`${this.baseUrl}/${id}`, datosCliente);
    }
}