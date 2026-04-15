export type ProductoTipoItem = 'inventariable' | 'base_formulado' | 'addon_tecnico' | 'desconocido';

export type ProductoOrigenClasificacion = 'catalogo' | 'inferido' | 'manual';

export type ProductoEstadoOperativo = 'listo_comercial' | 'listo_clinico' | 'dependencia_tecnica' | 'requiere_revision';

export interface ProductoClasificacion {
  tipoItem?: ProductoTipoItem;
  requiereFormula?: boolean;
  requierePaciente?: boolean;
  requiereHistoriaMedica?: boolean;
  permiteFormulaExterna?: boolean;
  requiereItemPadre?: boolean;
  requiereProcesoTecnico?: boolean;
  origenClasificacion?: ProductoOrigenClasificacion;
  esClasificacionConfiable?: boolean;
  clasificacionManual?: boolean;
  estadoOperativo?: ProductoEstadoOperativo;
}

export interface Producto extends ProductoClasificacion {
  id: string;
  sede: string;
  nombre: string;
  codigo: string;
  marca: string;
  modelo?: string;
  color?: string;
  material?: string;
  moneda: string;
  stock: number;
  categoria: string;
  proveedor: string;
  aplicaIva: boolean;
  precioConIva?: number;
  precio: number;
  activo: boolean;
  descripcion?: string;
  imagenUrl?: string;
  fechaIngreso: string;
  precioOriginal?: number;
  monedaOriginal?: string;
  tasaConversion?: number;
  fechaConversion?: string;
}

export interface ProductoDto {
  id: number;
  sede_id: string;
  nombre: string;
  codigo: string;
  marca: string;
  modelo?: string;
  color?: string;
  material?: string;
  moneda: string;
  stock: number;
  categoria: string;
  proveedor: string;
  aplicaIva: boolean;
  precioConIva?: number;
  precio: number;
  activo: boolean;
  descripcion?: string;
  imagen_url?: string;
  created_at: string;
  precioOriginal?: number;
  monedaOriginal?: string;
  tasaConversion?: number;
  fechaConversion?: string;
  tipo_item?: ProductoTipoItem;
  requiere_formula?: boolean | number | string;
  requiere_paciente?: boolean | number | string;
  requiere_historia_medica?: boolean | number | string;
  permite_formula_externa?: boolean | number | string;
  requiere_item_padre?: boolean | number | string;
  requiere_proceso_tecnico?: boolean | number | string;
  origen_clasificacion?: ProductoOrigenClasificacion;
  es_clasificacion_confiable?: boolean | number | string;
  clasificacion_manual?: boolean | number | string;
}


export interface MonedaVisual {
  id: string;
  alias: string;
  simbolo: string;
  nombre: string;
  valor: number;
}

