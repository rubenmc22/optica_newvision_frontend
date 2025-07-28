import { Injectable } from '@angular/core';
import { Producto } from './producto.model';

@Injectable({ providedIn: 'root' })
export class ProductoService {
  private productos: Producto[] = [];

  getProductos(): Producto[] {
    return [...this.productos]; // devuelve copia para no mutar directamente
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
