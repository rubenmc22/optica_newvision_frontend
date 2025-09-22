import { Injectable } from '@angular/core';
import { Producto, ProductoDto } from './producto.model';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout, catchError, map } from 'rxjs';
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

  /** =======================
   * Obtener todos los productos
   ======================== */
  getProductos(): Observable<Producto[]> {
    return this.http.get<{ productos: ProductoDto[] }>(`${environment.apiUrl}/producto-get`).pipe(
      timeout(this.REQUEST_TIMEOUT),
      map(res => res.productos.map(dto => this.mapProductoDtoToProducto(dto))),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

  /** =======================
   * Obtener productos paginados (sin error handler aún)
   ======================== */
  getProductosPorPagina(pagina: number, limite: number): Observable<Producto[]> {
    return this.http.get<Producto[]>(`/api/productos?page=${pagina}&limit=${limite}`);
  }

  /** =======================
   * Agregar producto
   ======================== */
  agregarProductoFormData(data: FormData): Observable<any> {
    return this.http.post(`${environment.apiUrl}/producto-add`, data).pipe(
      timeout(this.REQUEST_TIMEOUT),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

  /** =======================
   * Editar producto
   ======================== */
  editarProducto(data: FormData, id: string): Observable<any> {
    return this.http.put(`${environment.apiUrl}/producto-update/${id}`, data).pipe(
      timeout(this.REQUEST_TIMEOUT),
      catchError(error => this.errorHandler.handleHttpError(error))
    );
  }

  /** =======================
   * Obtener producto por ID (local)
   ======================== */
  obtenerPorId(id: string): Producto | undefined {
    return this.productos.find(p => p.id === id);
  }

  /** =======================
   * Eliminar producto (local)
   ======================== */
  eliminarProducto(id: string): void {
    this.productos = this.productos.filter(p => p.id !== id);
  }

  /** =======================
   * Utilidades
   ======================== */
  private mapProductoDtoToProducto(dto: ProductoDto): Producto {
    return {
      id: dto.id.toString(),
      sede: dto.sede_id,
      nombre: dto.nombre,
      codigo: dto.codigo,
      marca: dto.marca,
      modelo: dto.modelo,
      color: dto.color,
      material: dto.material,
      moneda: this.normalizarMoneda(dto.moneda),
      stock: dto.stock,
      categoria: dto.categoria,
      proveedor: dto.proveedor,
      aplicaIva: dto.aplicaIva,                          
      precioConIva: dto.precioConIva ?? undefined,      
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
