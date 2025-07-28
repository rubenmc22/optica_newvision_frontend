export interface Producto {
  id: string;
  nombre: string;
  codigo: string;
  tipo: 'montura' | 'lente' | 'liquido' | 'accesorio'; // puedes extender con más tipos
  marca?: string;
  color?: string;
  material?: string;
  moneda: string;
  stock: number;
  precio: number;
  activo: boolean;
  descripcion?: string;
  imagenUrl?: string;
  fechaIngreso: string; // formato YYYY-MM-DD
}
