import { Injectable } from '@angular/core';
import { Producto } from './producto.model';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ProductoService {
  private productos: Producto[] = [];

   constructor(private http: HttpClient) { }
   
  getProductos(): Producto[] {
    return [...this.productos]; // devuelve copia para no mutar directamente
  }

  getProductosPorPagina(pagina: number, limite: number): Observable<Producto[]> {
  return this.http.get<Producto[]>(`/api/productos?page=${pagina}&limit=${limite}`);
}

  agregarProducto(producto: Producto) {
    this.productos.push(producto);
  }

  editarProducto(producto: Producto) {
    const index = this.productos.findIndex(p => p.id === producto.id);
    if (index !== -1) {
      this.productos[index] = { ...producto };
    }
  }

  obtenerPorId(id: string): Producto | undefined {
    return this.productos.find(p => p.id === id);
  }

  eliminarProducto(id: string) {
    this.productos = this.productos.filter(p => p.id !== id);
  }

  desactivarProducto(id: string) {
    const index = this.productos.findIndex(p => p.id === id);
    if (index !== -1) {
      this.productos[index].activo = false;
    }
  }
}
