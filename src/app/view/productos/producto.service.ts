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
    const categoriaFuente = this.obtenerCategoriaDesdeDto(dto);
    const categoriaNormalizada = this.normalizarCategoria(categoriaFuente);
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
    const descripcionVisible = categoriaNormalizada === 'cristales'
      ? String(cristalConfig?.descripcion ?? descripcionCristal.descripcionUsuario ?? dto.descripcion ?? '').trim()
      : (descripcionCristal.descripcionUsuario || this.obtenerDescripcionDesdeConfig(dto, {
        monturaConfig,
        lenteContactoConfig,
        liquidoConfig,
        estucheConfig,
        accesorioConfig
      }) || String(dto.descripcion ?? '').trim());
    const nombreVisible = String(dto.nombre ?? '').trim() || this.construirNombreProductoDto(categoriaNormalizada, {
      cristalConfig,
      monturaConfig,
      lenteContactoConfig,
      liquidoConfig,
      estucheConfig,
      accesorioConfig
    });
    const categoriaVisible = String(categoriaFuente ?? '').trim();

    const productoBase: Producto = {
      id: dto.id.toString(),
      sede: dto.sede_id,
      nombre: nombreVisible,
      codigo: dto.codigo,
      marca: camposCategoria.marca,
      modelo: camposCategoria.modelo,
      color: camposCategoria.color,
      material: camposCategoria.material,
      moneda: this.normalizarMoneda(dto.moneda),
      stock: dto.stock,
      categoria: categoriaVisible,
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
    const dtoCristalConfig = dto.cristalConfig;
    const presentacionLegacy = dtoCristalConfig?.presentacion
      ?? legacyConfig?.presentacion
      ?? (!dtoCristalConfig ? dto.marca ?? '' : '');
    const marcaLegacy = dtoCristalConfig?.marca
      ?? legacyConfig?.marca
      ?? ((dto.marca ?? '') !== presentacionLegacy ? dto.marca ?? '' : '');

    return {
      ...parseDescripcionProductoCristal(dto.descripcion).crystalConfig,
      ...legacyConfig,
      ...dtoCristalConfig,
      categoria: dtoCristalConfig?.categoria ?? dto.categoria ?? 'Cristales',
      marca: marcaLegacy,
      tipoCristal: dtoCristalConfig?.tipoCristal ?? dtoCristalConfig?.modelo ?? dto.modelo ?? '',
      presentacion: presentacionLegacy,
      modelo: dtoCristalConfig?.modelo ?? dtoCristalConfig?.tipoCristal ?? dto.modelo ?? '',
      material: dtoCristalConfig?.material ?? dto.material ?? '',
      color: dtoCristalConfig?.color ?? dto.color ?? null,
      proveedor: dtoCristalConfig?.proveedor ?? dto.proveedor ?? '',
      costoLaboratorio: dto.costoLaboratorio ?? dtoCristalConfig?.costoLaboratorio ?? null,
      descripcion: dtoCristalConfig?.descripcion ?? dto.descripcion ?? ''
    };
  }

  private mapMonturaConfig(dto: ProductoDto): ProductoMonturaConfig {
    return {
      categoria: dto.monturaConfig?.categoria ?? dto.categoria ?? 'Monturas',
      marca: dto.monturaConfig?.marca ?? dto.marca ?? '',
      modelo: dto.monturaConfig?.modelo ?? dto.modelo ?? '',
      color: dto.monturaConfig?.color ?? dto.color ?? '',
      material: dto.monturaConfig?.material ?? dto.material ?? '',
      proveedor: dto.monturaConfig?.proveedor ?? dto.proveedor ?? '',
      descripcion: dto.monturaConfig?.descripcion ?? dto.descripcion ?? ''
    };
  }

  private mapLenteContactoConfig(dto: ProductoDto): ProductoLenteContactoConfig {
    return {
      categoria: dto.lenteContactoConfig?.categoria ?? dto.categoria ?? 'Lentes de contacto',
      marca: dto.lenteContactoConfig?.marca ?? dto.marca ?? '',
      tipoLenteContacto: dto.lenteContactoConfig?.tipoLenteContacto ?? dto.lenteContactoConfig?.modelo ?? dto.modelo ?? '',
      modelo: dto.lenteContactoConfig?.modelo ?? dto.lenteContactoConfig?.tipoLenteContacto ?? dto.modelo ?? '',
      color: dto.lenteContactoConfig?.color ?? dto.color ?? '',
      material: dto.lenteContactoConfig?.material ?? dto.material ?? null,
      proveedor: dto.lenteContactoConfig?.proveedor ?? dto.proveedor ?? '',
      rangoFormula: dto.lenteContactoConfig?.rangoFormula ?? '',
      descripcion: dto.lenteContactoConfig?.descripcion ?? dto.descripcion ?? ''
    };
  }

  private mapLiquidoConfig(dto: ProductoDto): ProductoLiquidoConfig {
    return {
      categoria: dto.liquidoConfig?.categoria ?? dto.categoria ?? 'Líquidos',
      marca: dto.liquidoConfig?.marca ?? dto.marca ?? '',
      modelo: dto.liquidoConfig?.modelo ?? dto.modelo ?? '',
      proveedor: dto.liquidoConfig?.proveedor ?? dto.proveedor ?? '',
      descripcion: dto.liquidoConfig?.descripcion ?? dto.descripcion ?? ''
    };
  }

  private mapEstucheConfig(dto: ProductoDto): ProductoEstucheConfig {
    return {
      categoria: dto.estucheConfig?.categoria ?? dto.categoria ?? 'Estuches',
      marca: dto.estucheConfig?.marca ?? dto.marca ?? '',
      modelo: dto.estucheConfig?.modelo ?? dto.modelo ?? '',
      material: dto.estucheConfig?.material ?? dto.material ?? '',
      proveedor: dto.estucheConfig?.proveedor ?? dto.proveedor ?? '',
      descripcion: dto.estucheConfig?.descripcion ?? dto.descripcion ?? ''
    };
  }

  private mapAccesorioConfig(dto: ProductoDto): ProductoAccesorioConfig {
    return {
      categoria: dto.accesorioConfig?.categoria ?? dto.categoria ?? 'Accesorios',
      marca: dto.accesorioConfig?.marca ?? dto.marca ?? '',
      modelo: dto.accesorioConfig?.modelo ?? dto.modelo ?? '',
      color: dto.accesorioConfig?.color ?? dto.color ?? '',
      material: dto.accesorioConfig?.material ?? dto.material ?? '',
      proveedor: dto.accesorioConfig?.proveedor ?? dto.proveedor ?? '',
      descripcion: dto.accesorioConfig?.descripcion ?? dto.descripcion ?? ''
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
    switch (this.normalizarCategoria(this.obtenerCategoriaDesdeDto(dto))) {
      case 'cristales':
        return {
          marca: configs.cristalConfig?.marca ?? dto.marca ?? '',
          modelo: configs.cristalConfig?.modelo ?? configs.cristalConfig?.tipoCristal ?? dto.modelo ?? '',
          color: (configs.cristalConfig?.color as string | null | undefined) ?? dto.color ?? '',
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
          modelo: configs.lenteContactoConfig?.modelo ?? configs.lenteContactoConfig?.tipoLenteContacto ?? dto.modelo ?? '',
          color: configs.lenteContactoConfig?.color ?? dto.color ?? '',
          material: (configs.lenteContactoConfig?.material as string | null | undefined) ?? dto.material ?? '',
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

  private construirNombreCristalDto(config?: ProductoCristalConfig): string {
    if (!config) {
      return '';
    }

    return [
      String(config.tipoCristal ?? config.modelo ?? '').trim(),
      String(config.presentacion ?? '').trim(),
      String(config.material ?? '').trim(),
      ...(Array.isArray(config.tratamientos) ? config.tratamientos.map(item => String(item ?? '').trim()) : []),
      String(config.rangoFormula ?? '').trim()
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  private obtenerCategoriaDesdeDto(dto: ProductoDto): string {
    return String(
      dto.categoria
      ?? dto.cristalConfig?.categoria
      ?? dto.monturaConfig?.categoria
      ?? dto.lenteContactoConfig?.categoria
      ?? dto.liquidoConfig?.categoria
      ?? dto.estucheConfig?.categoria
      ?? dto.accesorioConfig?.categoria
      ?? ''
    ).trim();
  }

  private obtenerDescripcionDesdeConfig(
    dto: ProductoDto,
    configs: {
      monturaConfig?: ProductoMonturaConfig;
      lenteContactoConfig?: ProductoLenteContactoConfig;
      liquidoConfig?: ProductoLiquidoConfig;
      estucheConfig?: ProductoEstucheConfig;
      accesorioConfig?: ProductoAccesorioConfig;
    }
  ): string {
    return String(
      configs.monturaConfig?.descripcion
      ?? configs.lenteContactoConfig?.descripcion
      ?? configs.liquidoConfig?.descripcion
      ?? configs.estucheConfig?.descripcion
      ?? configs.accesorioConfig?.descripcion
      ?? dto.descripcion
      ?? ''
    ).trim();
  }

  private construirNombreProductoDto(
    categoriaNormalizada: string,
    configs: {
      cristalConfig?: ProductoCristalConfig;
      monturaConfig?: ProductoMonturaConfig;
      lenteContactoConfig?: ProductoLenteContactoConfig;
      liquidoConfig?: ProductoLiquidoConfig;
      estucheConfig?: ProductoEstucheConfig;
      accesorioConfig?: ProductoAccesorioConfig;
    }
  ): string {
    switch (categoriaNormalizada) {
      case 'cristales':
        return this.construirNombreCristalDto(configs.cristalConfig);
      case 'monturas':
        return this.construirNombreNoCristalDto('Monturas', configs.monturaConfig?.marca, configs.monturaConfig?.modelo, configs.monturaConfig?.material);
      case 'lentes de contacto':
        return this.construirNombreNoCristalDto(
          'Lentes de contacto',
          configs.lenteContactoConfig?.marca,
          configs.lenteContactoConfig?.tipoLenteContacto ?? configs.lenteContactoConfig?.modelo,
          configs.lenteContactoConfig?.material
        );
      case 'liquidos':
        return this.construirNombreNoCristalDto('Líquidos', configs.liquidoConfig?.marca, configs.liquidoConfig?.modelo);
      case 'estuches':
        return this.construirNombreNoCristalDto('Estuches', configs.estucheConfig?.marca, configs.estucheConfig?.modelo, configs.estucheConfig?.material);
      case 'accesorios':
        return this.construirNombreNoCristalDto('Accesorios', configs.accesorioConfig?.marca, configs.accesorioConfig?.modelo, configs.accesorioConfig?.material);
      default:
        return '';
    }
  }

  private construirNombreNoCristalDto(categoria: string, ...partes: Array<string | null | undefined>): string {
    return [categoria, ...partes]
      .map(valor => String(valor ?? '').trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }
}
