export interface VentaDto {
    pacienteId?: string;
    moneda: 'bolivar' | 'dolar' | 'euro';
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
    codigo: string; // ✅ AGREGADO
    precio: number;
    cantidad: number;
    stock: number;
    moneda: string;
    precioConIva: number;
    aplicaIva: boolean;
}

export interface MetodoPago {
    tipo: string;
    monto: number;
    valorTemporal?: string;
}

export interface ProductoVenta {
    id: string;
    nombre: string;
    codigo: string; // ✅ AGREGADO
    precio: number;
    precioConIva: number;
    aplicaIva: boolean;
    cantidad?: number;
    moneda: string;
    stock?: number; // ✅ AGREGADO (opcional para consistencia)
}

export interface ProductoVentaCalculado {
    id: string;
    nombre: string;
    codigo: string; // ✅ AGREGADO
    precio: number;
    cantidad: number;
    moneda: string;
    subtotal: number;
    iva: number;
    total: number;
    precioConvertido: number;
    aplicaIva: boolean;
    stock: number;
}

export interface CuotaCashea {
    id: number;
    fecha: string;
    monto: number;
    pagada: boolean;
    seleccionada: boolean;
    habilitada: boolean;
}