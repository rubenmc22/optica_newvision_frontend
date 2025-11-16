export interface Producto {
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
}


export interface MonedaVisual {
  id: string;
  alias: string;
  simbolo: string;
  nombre: string;
  valor: number;
}

