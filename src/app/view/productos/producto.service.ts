import { Injectable } from '@angular/core';
import { Producto } from './producto.model';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ErrorHandlerService } from './../../core/services/errorHandlerService'; 


@Injectable({ providedIn: 'root' })
export class ProductoService {
  private productos: Producto[] = [];
 private readonly REQUEST_TIMEOUT = 8000; // 8 segundos

  constructor(
    private http: HttpClient,
    private errorHandler: ErrorHandlerService
  ) { }

  getProductos(): Observable<Producto[]> {
    // Si usas dummy data por ahora:
    return of([...this.productos]);

    // Y el día que tengas API:
    // return this.http.get<Producto[]>(`${environment.apiUrl}/productos`);
  }


  getProductosPorPagina(pagina: number, limite: number): Observable<Producto[]> {
    return this.http.get<Producto[]>(`/api/productos?page=${pagina}&limit=${limite}`);
  }

  agregarProducto(producto: Producto): Observable<Producto> {
    return this.http.post<Producto>(`${environment.apiUrl}/productos`, producto);

  }

  editarProducto(producto: Producto): Observable<Producto> {
    return this.http.put<Producto>(`${environment.apiUrl}/productos/${producto.id}`, producto);
  }

  obtenerPorId(id: string): Producto | undefined {
    return this.productos.find(p => p.id === id);
  }

  eliminarProducto(id: string) {
    this.productos = this.productos.filter(p => p.id !== id);
  }

}
