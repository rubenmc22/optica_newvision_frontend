import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Presupuesto, Cliente } from './presupuesto.interfaz';



@Injectable({
  providedIn: 'root'
})
export class PresupuestoService {
  private apiUrl = 'api/presupuestos'; // URL de tu API
  private clientesUrl = 'api/clientes';

  constructor(private http: HttpClient) { }

  // Obtener todos los presupuestos
  getPresupuestos(): Observable<Presupuesto[]> {
    return this.http.get<Presupuesto[]>(this.apiUrl);
  }

  // Obtener presupuesto por ID
  getPresupuesto(id: number): Observable<Presupuesto> {
    return this.http.get<Presupuesto>(`${this.apiUrl}/${id}`);
  }

  // Crear nuevo presupuesto
  crearPresupuesto(presupuesto: Presupuesto): Observable<Presupuesto> {
    return this.http.post<Presupuesto>(this.apiUrl, presupuesto);
  }

  // Actualizar presupuesto
  actualizarPresupuesto(id: number, presupuesto: Presupuesto): Observable<Presupuesto> {
    return this.http.put<Presupuesto>(`${this.apiUrl}/${id}`, presupuesto);
  }

  // Eliminar presupuesto
  eliminarPresupuesto(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  // Buscar cliente por cédula
  buscarClientePorCedula(cedula: string): Observable<Cliente | null> {
    return this.http.get<Cliente[]>(`${this.clientesUrl}?cedula=${cedula}`).pipe(
      map(clientes => clientes.length > 0 ? clientes[0] : null),
      catchError(() => of(null))
    );
  }

  // Crear cliente
  crearCliente(cliente: Cliente): Observable<Cliente> {
    return this.http.post<Cliente>(this.clientesUrl, cliente);
  }

  // Auto-archivar presupuestos vencidos
  autoArchivarPresupuestos(): Observable<any> {
    return this.http.post(`${this.apiUrl}/auto-archivar`, {});
  }

  // Convertir presupuesto a venta
  convertirAVenta(presupuestoId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${presupuestoId}/convertir-venta`, {});
  }

  // Renovar presupuesto
  renovarPresupuesto(id: number, dias: number = 7): Observable<Presupuesto> {
    return this.http.put<Presupuesto>(`${this.apiUrl}/${id}/renovar`, { dias });
  }

  // Obtener productos disponibles
  getProductos(): Observable<any[]> {
    return this.http.get<any[]>('api/productos');
  }
}