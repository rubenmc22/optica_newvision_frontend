import { Injectable } from '@angular/core';
import {
  Producto,
  ProductoAccesorioConfig,
  ProductoCristalConfig,
  ProductoDto,
  ProductoEstucheConfig,
  ProductoLenteContactoConfig,
  ProductoLiquidoConfig,
  ProductoMonturaConfig
} from './producto.model';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout, catchError, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ErrorHandlerService } from './../../core/services/errorHandlerService';
import { normalizarClasificacionProducto } from './producto-classification.catalog';
import { parseDescripcionProductoCristal } from './producto-cristal-config.util';

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
  getProductos(): Observable<{ iva: number; productos: Producto[] }> {
    return this.http.get<{ iva: number; productos: ProductoDto[] }>(`${environment.apiUrl}/producto-get`).pipe(
      timeout(this.REQUEST_TIMEOUT),
      map(res => ({
        iva: res.iva ?? 16,
        productos: res.productos.map(dto => this.mapProductoDtoToProducto(dto))
      })),
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
    const descripcionCristal = parseDescripcionProductoCristal(dto.descripcion);
    const categoriaNormalizada = this.normalizarCategoria(dto.categoria);
    const descripcionVisible = descripcionCristal.descripcionUsuario || String(dto.descripcion ?? '').trim();
    const cristalConfig = categoriaNormalizada === 'cristales'
      ? this.mapCristalConfig(dto, descripcionCristal.crystalConfig)
      : undefined;
    const monturaConfig = categoriaNormalizada === 'monturas'
      ? this.mapMonturaConfig(dto)
      : undefined;
    const lenteContactoConfig = categoriaNormalizada === 'lentes de contacto'
      ? this.mapLenteContactoConfig(dto)
      : undefined;
    const liquidoConfig = categoriaNormalizada === 'liquidos'
      ? this.mapLiquidoConfig(dto)
      : undefined;
    const estucheConfig = categoriaNormalizada === 'estuches'
      ? this.mapEstucheConfig(dto)
      : undefined;
    const accesorioConfig = categoriaNormalizada === 'accesorios'
      ? this.mapAccesorioConfig(dto)
      : undefined;
    const camposCategoria = this.mapCamposCategoria(dto, {
      cristalConfig,
      monturaConfig,
      lenteContactoConfig,
      liquidoConfig,
      estucheConfig,
      accesorioConfig
    });

    const productoBase: Producto = {
      id: dto.id.toString(),
      sede: dto.sede_id,
      nombre: dto.nombre,
      codigo: dto.codigo,
      marca: camposCategoria.marca,
      modelo: camposCategoria.modelo,
      color: camposCategoria.color,
      material: camposCategoria.material,
      moneda: this.normalizarMoneda(dto.moneda),
      stock: dto.stock,
      categoria: dto.categoria,
      proveedor: camposCategoria.proveedor,
      aplicaIva: dto.aplicaIva,
      precioConIva: dto.precioConIva ?? undefined,
      precio: dto.precio,
      activo: dto.activo,
      descripcion: descripcionVisible,
      cristalConfig,
      monturaConfig,
      lenteContactoConfig,
      liquidoConfig,
      estucheConfig,
      accesorioConfig,
      precioOriginal: dto.precioOriginal,
      monedaOriginal: dto.monedaOriginal,
      tasaConversion: dto.tasaConversion,
      fechaConversion: dto.fechaConversion,
      tipoItem: dto.tipo_item,
      requiereFormula: this.normalizarBoolean(dto.requiere_formula),
      requierePaciente: this.normalizarBoolean(dto.requiere_paciente),
      requiereHistoriaMedica: this.normalizarBoolean(dto.requiere_historia_medica),
      permiteFormulaExterna: this.normalizarBoolean(dto.permite_formula_externa),
      requiereItemPadre: this.normalizarBoolean(dto.requiere_item_padre),
      requiereProcesoTecnico: this.normalizarBoolean(dto.requiere_proceso_tecnico),
      origenClasificacion: dto.origen_clasificacion,
      esClasificacionConfiable: this.normalizarBoolean(dto.es_clasificacion_confiable),
      clasificacionManual: this.normalizarBoolean(dto.clasificacion_manual),
      imagenUrl: dto.imagen_url?.startsWith('/public/')
        ? `${environment.baseUrl}${dto.imagen_url}`
        : 'assets/avatar-placeholder.avif',
      fechaIngreso: dto.created_at?.split('T')[0] ?? ''
    };

    return {
      ...productoBase,
      ...normalizarClasificacionProducto(productoBase)
    };
  }

  private normalizarBoolean(valor: unknown): boolean | undefined {
    if (valor === null || valor === undefined || valor === '') {
      return undefined;
    }

    if (typeof valor === 'boolean') {
      return valor;
    }

    if (typeof valor === 'number') {
      return valor === 1;
    }

    const texto = String(valor).trim().toLowerCase();
    if (['true', '1', 'si', 'sí', 'yes'].includes(texto)) {
      return true;
    }

    if (['false', '0', 'no'].includes(texto)) {
      return false;
    }

    return undefined;
  }

  private normalizarMoneda(moneda: string | null | undefined): 'usd' | 'eur' | 'bs' {
    const m = moneda?.trim().toLowerCase();
    switch (m) {
      case 'dolar':
      case 'usd':
        return 'usd';
      case 'euro':
      case 'eur':
        return 'eur';
      case 'bs':
      case 'bolivar':
        return 'bs';
      default:
        return 'bs'; // fallback seguro
    }
  }

  private normalizarCategoria(categoria: string | null | undefined): string {
    return String(categoria ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private mapCristalConfig(dto: ProductoDto, legacyConfig?: ProductoCristalConfig): ProductoCristalConfig {
    return {
      ...parseDescripcionProductoCristal(dto.descripcion).crystalConfig,
      ...legacyConfig,
      ...dto.cristalConfig,
      tipoCristal: dto.cristalConfig?.tipoCristal ?? dto.modelo ?? '',
      presentacion: dto.cristalConfig?.presentacion ?? dto.marca ?? '',
      material: dto.cristalConfig?.material ?? dto.material ?? '',
      proveedor: dto.cristalConfig?.proveedor ?? dto.proveedor ?? ''
    };
  }

  private mapMonturaConfig(dto: ProductoDto): ProductoMonturaConfig {
    return {
      marca: dto.monturaConfig?.marca ?? dto.marca ?? '',
      modelo: dto.monturaConfig?.modelo ?? dto.modelo ?? '',
      color: dto.monturaConfig?.color ?? dto.color ?? '',
      material: dto.monturaConfig?.material ?? dto.material ?? '',
      proveedor: dto.monturaConfig?.proveedor ?? dto.proveedor ?? ''
    };
  }

  private mapLenteContactoConfig(dto: ProductoDto): ProductoLenteContactoConfig {
    return {
      marca: dto.lenteContactoConfig?.marca ?? dto.marca ?? '',
      tipoLenteContacto: dto.lenteContactoConfig?.tipoLenteContacto ?? dto.modelo ?? '',
      color: dto.lenteContactoConfig?.color ?? dto.color ?? '',
      proveedor: dto.lenteContactoConfig?.proveedor ?? dto.proveedor ?? ''
    };
  }

  private mapLiquidoConfig(dto: ProductoDto): ProductoLiquidoConfig {
    return {
      marca: dto.liquidoConfig?.marca ?? dto.marca ?? '',
      modelo: dto.liquidoConfig?.modelo ?? dto.modelo ?? '',
      proveedor: dto.liquidoConfig?.proveedor ?? dto.proveedor ?? ''
    };
  }

  private mapEstucheConfig(dto: ProductoDto): ProductoEstucheConfig {
    return {
      marca: dto.estucheConfig?.marca ?? dto.marca ?? '',
      modelo: dto.estucheConfig?.modelo ?? dto.modelo ?? '',
      material: dto.estucheConfig?.material ?? dto.material ?? '',
      proveedor: dto.estucheConfig?.proveedor ?? dto.proveedor ?? ''
    };
  }

  private mapAccesorioConfig(dto: ProductoDto): ProductoAccesorioConfig {
    return {
      marca: dto.accesorioConfig?.marca ?? dto.marca ?? '',
      modelo: dto.accesorioConfig?.modelo ?? dto.modelo ?? '',
      color: dto.accesorioConfig?.color ?? dto.color ?? '',
      material: dto.accesorioConfig?.material ?? dto.material ?? '',
      proveedor: dto.accesorioConfig?.proveedor ?? dto.proveedor ?? ''
    };
  }

  private mapCamposCategoria(
    dto: ProductoDto,
    configs: {
      cristalConfig?: ProductoCristalConfig;
      monturaConfig?: ProductoMonturaConfig;
      lenteContactoConfig?: ProductoLenteContactoConfig;
      liquidoConfig?: ProductoLiquidoConfig;
      estucheConfig?: ProductoEstucheConfig;
      accesorioConfig?: ProductoAccesorioConfig;
    }
  ): Pick<Producto, 'marca' | 'modelo' | 'color' | 'material' | 'proveedor'> {
    switch (this.normalizarCategoria(dto.categoria)) {
      case 'cristales':
        return {
          marca: configs.cristalConfig?.presentacion ?? dto.marca ?? '',
          modelo: configs.cristalConfig?.tipoCristal ?? dto.modelo ?? '',
          color: dto.color ?? '',
          material: configs.cristalConfig?.material ?? dto.material ?? '',
          proveedor: configs.cristalConfig?.proveedor ?? dto.proveedor ?? ''
        };
      case 'monturas':
        return {
          marca: configs.monturaConfig?.marca ?? dto.marca ?? '',
          modelo: configs.monturaConfig?.modelo ?? dto.modelo ?? '',
          color: configs.monturaConfig?.color ?? dto.color ?? '',
          material: configs.monturaConfig?.material ?? dto.material ?? '',
          proveedor: configs.monturaConfig?.proveedor ?? dto.proveedor ?? ''
        };
      case 'lentes de contacto':
        return {
          marca: configs.lenteContactoConfig?.marca ?? dto.marca ?? '',
          modelo: configs.lenteContactoConfig?.tipoLenteContacto ?? dto.modelo ?? '',
          color: configs.lenteContactoConfig?.color ?? dto.color ?? '',
          material: dto.material ?? '',
          proveedor: configs.lenteContactoConfig?.proveedor ?? dto.proveedor ?? ''
        };
      case 'liquidos':
        return {
          marca: configs.liquidoConfig?.marca ?? dto.marca ?? '',
          modelo: configs.liquidoConfig?.modelo ?? dto.modelo ?? '',
          color: dto.color ?? '',
          material: dto.material ?? '',
          proveedor: configs.liquidoConfig?.proveedor ?? dto.proveedor ?? ''
        };
      case 'estuches':
        return {
          marca: configs.estucheConfig?.marca ?? dto.marca ?? '',
          modelo: configs.estucheConfig?.modelo ?? dto.modelo ?? '',
          color: dto.color ?? '',
          material: configs.estucheConfig?.material ?? dto.material ?? '',
          proveedor: configs.estucheConfig?.proveedor ?? dto.proveedor ?? ''
        };
      case 'accesorios':
        return {
          marca: configs.accesorioConfig?.marca ?? dto.marca ?? '',
          modelo: configs.accesorioConfig?.modelo ?? dto.modelo ?? '',
          color: configs.accesorioConfig?.color ?? dto.color ?? '',
          material: configs.accesorioConfig?.material ?? dto.material ?? '',
          proveedor: configs.accesorioConfig?.proveedor ?? dto.proveedor ?? ''
        };
      default:
        return {
          marca: dto.marca ?? '',
          modelo: dto.modelo ?? '',
          color: dto.color ?? '',
          material: dto.material ?? '',
          proveedor: dto.proveedor ?? ''
        };
    }
  }
}
