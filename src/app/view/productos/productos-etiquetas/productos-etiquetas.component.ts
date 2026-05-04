import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';
import { UserStateService } from '../../../core/services/userState/user-state-service';
import { ProductoService } from '../producto.service';
import { Producto, ProductoTipoItem } from '../producto.model';
import { ProductoConversionService } from '../productos-list/producto-conversion.service';
import {
  ProductLabelFieldConfig,
  ProductLabelFieldKey,
  ProductLabelSettings,
  PRODUCT_LABEL_DEFAULT_SETTINGS,
  PRODUCT_LABEL_STORAGE_KEY,
  normalizeProductLabelSettings
} from './productos-etiquetas.config';
import { SystemConfigService } from '../../system-config/system-config.service';
import { normalizarClasificacionProducto } from '../producto-classification.catalog';

@Component({
  selector: 'app-productos-etiquetas',
  standalone: false,
  templateUrl: './productos-etiquetas.component.html',
  styleUrls: ['./productos-etiquetas.component.scss']
})
export class ProductosEtiquetasComponent implements OnInit, OnDestroy {
  private readonly categoriasBase = ['Monturas', 'Cristales', 'Lentes de contacto', 'Líquidos', 'Estuches', 'Accesorios'];
  private ultimaConfiguracionGuardada: ProductLabelSettings;
  productos: Producto[] = [];
  dataIsReady = false;
  sedeActiva = '';
  sedeActivaLabel = '';
  filtroBusqueda = '';
  categoriaSeleccionada = '';
  soloActivos = true;
  cantidadMasiva: number | null = null;
  previewCollapsed = true;
  configuracion: ProductLabelSettings;
  cantidades: Record<string, number> = {};
  private readonly seleccionados = new Set<string>();

  constructor(
    private productoService: ProductoService,
    private userStateService: UserStateService,
    private productoConversionService: ProductoConversionService,
    private systemConfigService: SystemConfigService,
    private snackBar: MatSnackBar
  ) {
    this.configuracion = this.cargarConfiguracionLocal();
    this.ultimaConfiguracionGuardada = this.clonarConfiguracion(this.configuracion);
    this.cantidadMasiva = this.configuracion.cantidadMasivaDefault;
  }

  ngOnInit(): void {
    this.toggleMobileShellFooter(true);
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    this.toggleMobileShellFooter(false);
  }

  get productosFiltrados(): Producto[] {
    const texto = this.filtroBusqueda.trim().toLowerCase();
    const categoriaActiva = this.categoriaSeleccionada.trim().toLowerCase();

    return this.productos.filter((producto) => {
      const nombre = this.getNombreProductoDisplay(producto).toLowerCase();
      const codigo = String(producto.codigo ?? '').toLowerCase();
      const categoria = String(producto.categoria ?? '').toLowerCase();
      const marca = String(producto.marca ?? '').toLowerCase();
      const modelo = String(producto.modelo ?? '').toLowerCase();
      const coincideTexto = !texto || [nombre, codigo, categoria, marca, modelo].some((valor) => valor.includes(texto));
      const coincideCategoria = !categoriaActiva || categoria === categoriaActiva;
      const coincideEstado = !this.soloActivos || producto.activo !== false;
      return coincideTexto && coincideCategoria && coincideEstado;
    });
  }

  get categoriasDisponibles(): string[] {
    return [...new Set([
      ...this.categoriasBase,
      ...this.productos
        .map((producto) => String(producto.categoria ?? '').trim())
        .filter(Boolean)
    ])]
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }

  get cantidadSeleccionada(): number {
    return this.itemsImpresion.length;
  }

  get totalProductosSeleccionados(): number {
    return this.productos.filter((producto) => this.seleccionados.has(producto.id)).length;
  }

  get totalProductosFiltrados(): number {
    return this.productosFiltrados.length;
  }

  get camposActivos(): ProductLabelFieldConfig[] {
    return this.configuracion.fields
      .filter((field) => field.enabled)
      .sort((a, b) => a.order - b.order);
  }

  get etiquetaCompacta(): boolean {
    return this.camposActivos.length >= 4 || this.configuracion.labelWidthMm <= 50 || this.configuracion.labelHeightMm <= 28;
  }

  get todosLosFiltradosSeleccionados(): boolean {
    return this.productosFiltrados.length > 0 && this.productosFiltrados.every((producto) => this.seleccionados.has(producto.id));
  }

  get itemsImpresion(): Array<{ producto: Producto; copia: number }> {
    return this.productosFiltrados
      .filter((producto) => this.isSelected(producto.id))
      .flatMap((producto) => {
        const cantidad = this.getCantidadVisible(producto);
        return Array.from({ length: cantidad }, (_, index) => ({ producto, copia: index + 1 }));
      });
  }

  get productoVistaPrevia(): Producto | null {
    return this.productosFiltrados.find((producto) => this.isSelected(producto.id)) ?? null;
  }

  togglePreviewCollapsed(): void {
    this.previewCollapsed = !this.previewCollapsed;
  }

  cargarDatos(): void {
    this.dataIsReady = false;

    forkJoin({
      productosResponse: this.productoService.getProductos().pipe(take(1)),
      user: this.userStateService.currentUser$.pipe(
        take(1),
        catchError(() => of(null))
      )
    }).subscribe({
      next: ({ productosResponse, user }) => {
        this.sedeActiva = String(user?.sede ?? '').trim().toLowerCase();
        this.sedeActivaLabel = this.formatearNombreSede(String(user?.sedeNombre ?? user?.sede ?? '').trim());
        this.productos = this.productoConversionService
          .convertirListaProductosAmonedaSistema(productosResponse.productos ?? [])
          .filter((producto) => this.debeMostrarProducto(producto))
          .filter((producto) => !this.sedeActiva || String(producto.sede ?? '').trim().toLowerCase() === this.sedeActiva);
        this.dataIsReady = true;
      },
      error: () => {
        this.snackBar.open('No se pudieron cargar los productos para etiquetas.', 'Cerrar', {
          duration: 4500,
          panelClass: ['snackbar-error']
        });
      }
    });
  }

  isSelected(productoId: string): boolean {
    return this.seleccionados.has(productoId);
  }

  hasCampo(key: ProductLabelFieldKey): boolean {
    return this.camposActivos.some((field) => field.key === key);
  }

  seleccionarCategoria(categoria: string): void {
    this.categoriaSeleccionada = categoria;
  }

  toggleProducto(producto: Producto, checked: boolean): void {
    const productoId = producto.id;

    if (checked) {
      this.seleccionados.add(productoId);
      this.cantidades[productoId] = this.getCantidadInicialProducto(producto);
      return;
    }

    this.seleccionados.delete(productoId);
    delete this.cantidades[productoId];
  }

  toggleSeleccionFiltrados(): void {
    if (this.todosLosFiltradosSeleccionados) {
      this.productosFiltrados.forEach((producto) => {
        this.seleccionados.delete(producto.id);
        delete this.cantidades[producto.id];
      });
      return;
    }

    this.productosFiltrados.forEach((producto) => {
      this.seleccionados.add(producto.id);
      this.cantidades[producto.id] = this.getCantidadInicialProducto(producto);
    });
  }

  limpiarSeleccion(): void {
    this.seleccionados.clear();
    this.cantidades = {};
  }

  limpiarFiltros(): void {
    this.filtroBusqueda = '';
    this.categoriaSeleccionada = '';
    this.soloActivos = true;
  }

  aplicarCantidadMasiva(value: number | string | null): void {
    const cantidad = this.normalizarCantidadMasiva(value);
    this.cantidadMasiva = cantidad;

    if (cantidad === null) {
      this.restablecerCantidadesSeleccionadasPorStock();
      return;
    }

    this.seleccionados.forEach((productoId) => {
      this.cantidades[productoId] = cantidad;
    });
  }

  ajustarCantidadMasiva(delta: number): void {
    const base = this.cantidadMasiva ?? 1;
    this.aplicarCantidadMasiva(base + delta);
  }

  ajustarCantidadProducto(producto: Producto, delta: number): void {
    const cantidadActual = this.isSelected(producto.id)
      ? this.getCantidad(producto.id)
      : this.getCantidadSugerida(producto);

    this.seleccionados.add(producto.id);
    this.cantidades[producto.id] = this.normalizarCantidad(cantidadActual + delta);
  }

  actualizarCantidad(producto: Producto, value: string): void {
    this.seleccionados.add(producto.id);
    this.cantidades[producto.id] = this.normalizarCantidad(Number(value));
  }

  getCantidad(productoId: string): number {
    return this.cantidades[productoId] ?? 1;
  }

  getCantidadVisible(producto: Producto): number {
    return this.isSelected(producto.id)
      ? this.getCantidad(producto.id)
      : this.getCantidadSugerida(producto);
  }

  guardarConfiguracion(): void {
    if (!this.camposActivos.length) {
      this.snackBar.open('Activa al menos un campo para imprimir etiquetas.', 'Cerrar', {
        duration: 3500,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    this.configuracion = {
      ...normalizeProductLabelSettings(this.configuracion),
      cantidadMasivaDefault: this.cantidadMasiva,
      updatedAt: new Date().toISOString()
    };
    this.persistirConfiguracionLocal();
    this.ultimaConfiguracionGuardada = this.clonarConfiguracion(this.configuracion);
    this.snackBar.open('Configuración de etiquetas guardada.', 'Cerrar', {
      duration: 2500,
      panelClass: ['snackbar-success']
    });
  }

  restablecerConfiguracion(): void {
    this.configuracion = this.clonarConfiguracion(this.ultimaConfiguracionGuardada);
    this.cantidadMasiva = this.configuracion.cantidadMasivaDefault;

    if (this.cantidadMasiva === null) {
      this.restablecerCantidadesSeleccionadasPorStock();
      return;
    }

    this.seleccionados.forEach((productoId) => {
      this.cantidades[productoId] = this.cantidadMasiva as number;
    });
  }

  toggleCampo(campo: ProductLabelFieldConfig): void {
    campo.enabled = !campo.enabled;
  }

  moverCampo(campo: ProductLabelFieldConfig, direction: -1 | 1): void {
    const fields = [...this.configuracion.fields].sort((a, b) => a.order - b.order);
    const index = fields.findIndex((item) => item.key === campo.key);
    const targetIndex = index + direction;

    if (index < 0 || targetIndex < 0 || targetIndex >= fields.length) {
      return;
    }

    [fields[index], fields[targetIndex]] = [fields[targetIndex], fields[index]];
    this.configuracion = {
      ...this.configuracion,
      fields: fields.map((field, order) => ({ ...field, order }))
    };
  }

  obtenerValorCampo(producto: Producto, field: ProductLabelFieldKey): string {
    switch (field) {
      case 'codigo':
        return String(producto.codigo ?? '').trim();
      case 'nombre':
        return this.getNombreProductoDisplay(producto);
      case 'precio':
        return this.formatearPrecio(producto);
      case 'marca':
        return String(producto.marca ?? '').trim();
      default:
        return '';
    }
  }

  getMarcaEtiqueta(producto: Producto): string {
    return this.hasCampo('marca') ? this.obtenerValorCampo(producto, 'marca') : '';
  }

  getNombreEtiquetaPrincipal(producto: Producto): string {
    return this.getNombreEtiquetaLineas(producto)[0];
  }

  getNombreEtiquetaSecundario(producto: Producto): string {
    return this.getNombreEtiquetaLineas(producto)[1];
  }

  imprimirEtiquetas(): void {
    if (!this.itemsImpresion.length) {
      this.snackBar.open('Selecciona al menos una etiqueta para imprimir.', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    if (!this.camposActivos.length) {
      this.snackBar.open('Activa al menos un campo para imprimir etiquetas.', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    const popup = window.open('', '_blank', 'width=1200,height=900');
    if (!popup) {
      this.snackBar.open('El navegador bloqueó la ventana de impresión.', 'Cerrar', {
        duration: 3500,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    popup.document.write(this.buildPrintDocument(this.itemsImpresion));
    popup.document.close();
    popup.focus();
    popup.print();
  }

  trackByProducto(_: number, producto: Producto): string {
    return producto.id;
  }

  private debeMostrarProducto(producto: Producto): boolean {
    const tipoItem = this.getTipoItemProducto(producto);
    return tipoItem === 'inventariable' || tipoItem === 'base_formulado';
  }

  private getTipoItemProducto(producto: Partial<Producto> | null | undefined): ProductoTipoItem {
    if (!producto) {
      return 'desconocido';
    }

    return producto.tipoItem ?? normalizarClasificacionProducto(producto).tipoItem;
  }

  getNombreProductoDisplay(producto: Partial<Producto> | null | undefined): string {
    const nombre = String(producto?.nombre ?? '').trim();
    if (nombre) {
      return nombre;
    }

    return [producto?.marca, producto?.modelo, producto?.categoria]
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
      .join(' | ');
  }

  getPrecioParaMostrar(producto: Producto): number {
    return producto.aplicaIva ? (producto.precioConIva || producto.precio) : producto.precio;
  }

  formatearPrecio(producto: Producto): string {
    const simbolo = this.systemConfigService.getSimboloMonedaPrincipal();
    const valor = this.getPrecioParaMostrar(producto);
    return `${simbolo} ${valor.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  getNombreSede(sedeKey: string | undefined): string {
    return this.sedeActivaLabel || this.formatearNombreSede(sedeKey);
  }

  private cargarConfiguracionLocal(): ProductLabelSettings {
    if (typeof localStorage === 'undefined') {
      return normalizeProductLabelSettings(PRODUCT_LABEL_DEFAULT_SETTINGS);
    }

    try {
      const raw = localStorage.getItem(PRODUCT_LABEL_STORAGE_KEY);
      return raw
        ? normalizeProductLabelSettings(JSON.parse(raw) as ProductLabelSettings)
        : normalizeProductLabelSettings(PRODUCT_LABEL_DEFAULT_SETTINGS);
    } catch {
      return normalizeProductLabelSettings(PRODUCT_LABEL_DEFAULT_SETTINGS);
    }
  }

  private persistirConfiguracionLocal(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(PRODUCT_LABEL_STORAGE_KEY, JSON.stringify(this.configuracion));
  }

  private formatearNombreSede(value: string | undefined): string {
    const sede = String(value ?? '').trim();
    if (!sede) {
      return '';
    }

    return sede.replace(/^sede\s+/i, '').trim() || sede;
  }

  private getCantidadSugerida(producto: Producto): number {
    return this.normalizarCantidad(Number(producto.stock));
  }

  private normalizarCantidad(value: number): number {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
  }

  private normalizarCantidadMasiva(value: number | string | null): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return Math.floor(parsed);
  }

  private getCantidadInicialProducto(producto: Producto): number {
    return this.cantidadMasiva ?? this.getCantidadSugerida(producto);
  }

  private restablecerCantidadesSeleccionadasPorStock(): void {
    this.seleccionados.forEach((productoId) => {
      const producto = this.productos.find((item) => item.id === productoId);
      if (!producto) {
        delete this.cantidades[productoId];
        return;
      }

      this.cantidades[productoId] = this.getCantidadSugerida(producto);
    });
  }

  private clonarConfiguracion(configuracion: ProductLabelSettings): ProductLabelSettings {
    return normalizeProductLabelSettings({
      ...configuracion,
      fields: configuracion.fields.map((field) => ({ ...field }))
    });
  }


  private getNombreEtiquetaLineas(producto: Producto): [string, string] {
    if (!this.hasCampo('nombre')) {
      return ['', ''];
    }

    const nombre = this.obtenerValorCampo(producto, 'nombre');
    if (!nombre) {
      return ['', ''];
    }

    const maxChars = this.getMaxNombreCharsPorLinea();
    if (nombre.length <= maxChars) {
      return [nombre, ''];
    }

    const splitIndex = this.getIndiceCorteNombre(nombre, maxChars);
    return [
      nombre.slice(0, splitIndex).trim(),
      nombre.slice(splitIndex).trim()
    ];
  }

  private getMaxNombreCharsPorLinea(): number {
    const base = Math.floor(this.configuracion.labelWidthMm / 2.7);
    const densidad = Math.max(0, this.camposActivos.length - 2) * 3;
    const alturaAjuste = this.configuracion.labelHeightMm <= 28 ? 2 : 0;
    return Math.max(12, base - densidad - alturaAjuste);
  }

  private getIndiceCorteNombre(nombre: string, maxChars: number): number {
    const ultimoEspacioAntes = nombre.lastIndexOf(' ', maxChars);
    if (ultimoEspacioAntes > Math.floor(maxChars * 0.55)) {
      return ultimoEspacioAntes;
    }

    const primerEspacioDespues = nombre.indexOf(' ', maxChars);
    if (primerEspacioDespues > -1 && primerEspacioDespues < maxChars + 10) {
      return primerEspacioDespues;
    }

    return maxChars;
  }

  private getEscalaTipograficaEtiqueta(): number {
    const escalaAncho = Math.max(0.82, Math.min(1.18, this.configuracion.labelWidthMm / 63));
    const escalaAlto = Math.max(0.88, Math.min(1.15, this.configuracion.labelHeightMm / 34));
    const penalizacionCampos = this.camposActivos.length >= 4 ? 0.84 : this.camposActivos.length === 3 ? 0.92 : 1;
    return Number((escalaAncho * escalaAlto * penalizacionCampos).toFixed(2));
  }

  private buildPrintDocument(items: Array<{ producto: Producto; copia: number }>): string {
    const escalaTipografica = this.getEscalaTipograficaEtiqueta();
    const tamCodigo = (11 * escalaTipografica).toFixed(2);
    const tamPrecio = (12 * escalaTipografica).toFixed(2);
    const tamNombre = (10 * escalaTipografica).toFixed(2);
    const tamNombreExtra = (9 * escalaTipografica).toFixed(2);
    const tamMarca = (8 * escalaTipografica).toFixed(2);
    const resumenCategorias = items.reduce((acc, { producto }) => {
      const categoria = String(producto.categoria ?? '').trim() || 'Sin categoria';
      acc.set(categoria, (acc.get(categoria) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());

    const resumenHtml = Array.from(resumenCategorias.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'es', { sensitivity: 'base' }))
      .map(([categoria, total]) => `
        <li class="summary-item">
          <span class="summary-category">${this.escapeHtml(categoria)}</span>
          <strong class="summary-total">${total} ${total === 1 ? 'etiqueta' : 'etiquetas'}</strong>
        </li>
      `)
      .join('');

    const etiquetas = items.map(({ producto }) => {
      const codigo = this.hasCampo('codigo') ? this.escapeHtml(this.obtenerValorCampo(producto, 'codigo')) : '';
      const precio = this.hasCampo('precio') ? this.escapeHtml(this.obtenerValorCampo(producto, 'precio')) : '';
      const nombrePrincipal = this.escapeHtml(this.getNombreEtiquetaPrincipal(producto));
      const nombreSecundario = this.escapeHtml(this.getNombreEtiquetaSecundario(producto));
      const marca = this.escapeHtml(this.getMarcaEtiqueta(producto));

      return `
      <div class="label-wrap">
        <article class="label-card">
          <span class="cut-guide cut-guide--top-left" aria-hidden="true"></span>
          <span class="cut-guide cut-guide--top-right" aria-hidden="true"></span>
          <span class="cut-guide cut-guide--bottom-left" aria-hidden="true"></span>
          <span class="cut-guide cut-guide--bottom-right" aria-hidden="true"></span>
          <div class="label-primary" ${!codigo && !precio ? 'style="display:none;"' : ''}>
            ${codigo ? `<strong class="label-code">${codigo}</strong>` : ''}
            ${precio ? `<strong class="label-price">${precio}</strong>` : ''}
          </div>
          ${nombrePrincipal ? `<div class="label-name">${nombrePrincipal}</div>` : ''}
          ${nombreSecundario ? `<div class="label-name label-name--continuation">${nombreSecundario}</div>` : ''}
          ${marca ? `<div class="label-secondary">${marca}</div>` : ''}
        </article>
      </div>
    `;
    }).join('');

    return `<!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Etiquetas de productos</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 8mm; font-family: 'Segoe UI', sans-serif; background: #fff; color: #10233b; }
            .labels-grid {
              display: grid;
              grid-template-columns: repeat(${this.configuracion.columns}, ${this.configuracion.labelWidthMm + 4}mm);
              gap: 2.5mm;
              justify-content: start;
            }
            .label-wrap {
              width: ${this.configuracion.labelWidthMm + 4}mm;
              padding: 2mm;
              break-inside: avoid;
            }
            .label-card {
              position: relative;
              width: ${this.configuracion.labelWidthMm}mm;
              min-height: ${this.configuracion.labelHeightMm}mm;
              padding: 2.2mm 2.8mm;
              border: ${this.configuracion.showBorder ? '1px solid #1d3656' : '0'};
              border-radius: 2.2mm;
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 0.9mm;
              overflow: hidden;
              background: #fff;
            }
            .cut-guide {
              position: absolute;
              width: 4mm;
              height: 4mm;
              pointer-events: none;
            }
            .cut-guide::before,
            .cut-guide::after {
              content: '';
              position: absolute;
              background: #8ea0b4;
            }
            .cut-guide::before {
              width: 4mm;
              height: 0.18mm;
            }
            .cut-guide::after {
              width: 0.18mm;
              height: 4mm;
            }
            .cut-guide--top-left { top: -2mm; left: -2mm; }
            .cut-guide--top-right { top: -2mm; right: -2mm; }
            .cut-guide--bottom-left { bottom: -2mm; left: -2mm; }
            .cut-guide--bottom-right { bottom: -2mm; right: -2mm; }
            .cut-guide--top-right::before,
            .cut-guide--bottom-right::before { right: 0; }
            .cut-guide--bottom-left::after,
            .cut-guide--bottom-right::after { bottom: 0; }
            .label-primary {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 2.4mm;
              margin-bottom: 0.4mm;
            }
            .label-code {
              flex: 1 1 auto;
              min-width: 0;
              font-size: ${tamCodigo}px;
              line-height: 1.05;
              letter-spacing: 0.04em;
              font-weight: 800;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .label-price {
              font-size: ${tamPrecio}px;
              line-height: 1.05;
              font-weight: 800;
              flex-shrink: 0;
              text-align: right;
            }
            .label-name {
              font-size: ${tamNombre}px;
              line-height: 1.1;
              font-weight: 700;
              color: #10233b;
              white-space: normal;
              overflow-wrap: anywhere;
              word-break: break-word;
            }
            .label-name--continuation {
              margin-top: -0.2mm;
              font-size: ${tamNombreExtra}px;
            }
            .label-secondary {
              font-size: ${tamMarca}px;
              line-height: 1.15;
              color: #566a82;
              white-space: normal;
              overflow-wrap: anywhere;
              word-break: break-word;
            }
            .print-summary {
              margin-top: 8mm;
              padding-top: 4mm;
              border-top: 0.3mm solid #c8d2dc;
              break-inside: avoid;
            }
            .print-summary h3 {
              margin: 0 0 3mm;
              font-size: 14px;
              letter-spacing: 0.01em;
            }
            .summary-meta {
              margin: 0 0 3mm;
              font-size: 10px;
              color: #566a82;
            }
            .summary-list {
              list-style: none;
              margin: 0;
              padding: 0;
              display: grid;
              gap: 2mm;
            }
            .summary-item {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 4mm;
              padding-bottom: 1.6mm;
              border-bottom: 0.2mm dashed #d4dde6;
            }
            .summary-category {
              font-size: 11px;
              font-weight: 600;
            }
            .summary-total {
              font-size: 11px;
            }
            @media print {
              body { padding: 5mm; }
              .cut-guide::before,
              .cut-guide::after {
                background: #7d8ea3;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <section class="labels-grid">${etiquetas}</section>
          <section class="print-summary">
            <h3>Total de etiquetas por categoria</h3>
            <p class="summary-meta">Total general: ${items.length} ${items.length === 1 ? 'etiqueta' : 'etiquetas'} impresas</p>
            <ul class="summary-list">${resumenHtml}</ul>
          </section>
        </body>
      </html>`;
  }

  private escapeHtml(value: string): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private toggleMobileShellFooter(active: boolean): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.body.classList.toggle('labels-hide-mobile-shell-footer', active);
  }
}