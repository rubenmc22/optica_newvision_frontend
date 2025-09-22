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
    montoInicial?: number;
    numeroCuotas?: number;
    montoAbonado?: number;
    metodosDePago: MetodoPago[];
}

export interface ProductoVentaDto {
    id: string;
    nombre: string;
    precio: number;
    cantidad: number;
    moneda: string;
    aplicaIva: boolean; // ✅ nueva propiedad
}


export interface MetodoPago {
    tipo: string;
    monto: number;
}

export interface ProductoVenta {
    id: string;
    nombre: string;
    precioConIva: number;
    aplicaIva: boolean;
    cantidad?: number;
    moneda: string;
}



