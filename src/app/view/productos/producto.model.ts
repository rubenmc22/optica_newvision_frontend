export interface Producto {
  id: string;
  nombre: string;
  codigo: string;
  tipo: 'montura' | 'lente' | 'liquido' | 'estuche' | 'accesorio'; // puedes extender con más tipos
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
