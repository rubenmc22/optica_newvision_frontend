export interface VentaDto {
    pacienteId?: string;
    moneda: 'bs' | 'usd' | 'eur';
    formaPago: string;
    productos: ProductoVentaDto[];
    impuesto: number;
    descuento?: number;
    observaciones?: string;
    sede?: string;
    total?: number;
}

export interface ProductoVentaDto {
    id: string;
    nombre: string;
    precio: number;
    moneda: string;
    cantidad: number;
}

