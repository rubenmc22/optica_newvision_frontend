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
}


export interface MonedaVisual {
  id: string;         // ID real del backend (dolar, euro, bolivar)
  alias: string;      // Alias visual (USD, EUR, Bs)
  simbolo: string;    // $, €, Bs
  nombre: string;     // Nombre completo
  valor: number;      // Tasa de cambio
}

