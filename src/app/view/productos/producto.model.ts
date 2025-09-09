export interface Producto {
  id: string;
  sede: string;
  nombre: string;
  codigo: string;
  marca?: string;
  color?: string;
  material?: string;
  moneda: string;
  stock: number;
  categoria: string;
  proveedor: string;
  precio: number;
  activo: boolean;
  descripcion?: string;
  imagenUrl?: string;
  fechaIngreso: string;
}

export interface ProductoDto {
  id: number;
  sede_id: string;
  nombre: string;
  codigo: string;
  marca?: string;
  color?: string;
  material?: string;
  moneda: string;
  stock: number;
  categoria: string;
  proveedor: string;
  precio: number;
  activo: boolean;
  descripcion?: string;
  imagen_url?: string;
  created_at: string;
}

