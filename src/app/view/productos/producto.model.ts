export interface Producto {
  id: string;
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
  fechaIngreso: string; // formato YYYY-MM-DD
}
