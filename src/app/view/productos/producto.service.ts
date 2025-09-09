import { Injectable } from '@angular/core';
import { Producto, ProductoDto } from './producto.model';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError, map } from 'rxjs';
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
    return this.http.get<{ productos: ProductoDto[] }>(`${environment.apiUrl}/producto-get`).pipe(
      map(res => res.productos.map(dto => this.mapProductoDtoToProducto(dto)))
    );
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



  /**=============================================================================
   * Utilities 
   ==============================================================================*/
  private mapProductoDtoToProducto(dto: ProductoDto): Producto {
    return {
      id: dto.id.toString(),
      sede: dto.sede_id,
      nombre: dto.nombre,
      codigo: dto.codigo,
      marca: dto.marca,
      color: dto.color,
      material: dto.material,
      moneda: this.normalizarMoneda(dto.moneda),
      stock: dto.stock,
      categoria: dto.categoria,
      proveedor: dto.proveedor,
      precio: dto.precio,
      activo: dto.activo,
      descripcion: dto.descripcion,
      imagenUrl: dto.imagen_url?.startsWith('/public/')
        ? `${environment.baseUrl}${dto.imagen_url}`
        : 'assets/avatar-placeholder.avif',

      fechaIngreso: dto.created_at?.split('T')[0] ?? ''
    };
  }

  private normalizarMoneda(moneda: string | null | undefined): 'usd' | 'eur' | 'ves' {
    const m = moneda?.trim().toLowerCase();
    switch (m) {
      case 'dolar':
      case 'usd':
        return 'usd';
      case 'euro':
      case 'eur':
        return 'eur';
      case 'ves':
      case 'bolivar':
        return 'ves';
      default:
        return 'ves'; // fallback seguro
    }
  }



}
