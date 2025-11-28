export interface VentaDto {
    pacienteId?: string;
    moneda: string;
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
    formaPagoDetalle?: FormaPagoDetalle; // Agregar esta propiedad opcional

}

// En tu archivo de interfaces (venta-interfaz.ts o similar)
export interface FormaPagoDetalle {
    tipo: string;
    montoTotal?: number;
    totalPagado?: number;
    nivel?: string;
    montoInicial?: number;
    cantidadCuotas?: string;
    montoPorCuota?: number;
    cuotasAdelantadas?: number;
    montoAdelantado?: number;
    totalPagadoAhora?: number;
    deudaPendiente?: number;
    montoAbonado?: number;
    porcentajePagado?: number;
    cuotas?: any[];
}

export interface ProductoVentaDto {
    id: string;
    nombre: string;
    codigo: string;
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
    referencia?: string;
    bancoCodigo?: string;
    bancoNombre?: string;
    banco?: string;
    bancoObject?: { codigo: string; nombre: string }; 
     moneda?: string;
}

export interface DatosRecibo {
    numeroVenta: string;
    fecha: string;
    hora: string;
    sede: {
        nombre: string;
        direccion: string;
        telefono: string;
        email: string;
        rif: string;
    };
    cliente: {
        nombre: string;
        cedula: string;
        telefono: string;
        direccion: string;
    };
    productos: Array<{
        codigo: string;
        nombre: string;
        cantidad: number;
        precioUnitario: number;
        descuento: number;
        subtotal: number;
        aplicaIva: boolean;
    }>;
    metodosPago: Array<{
        tipo: string;
        monto: number;
        referencia?: string;
        banco?: string;
        moneda: string;
    }>;
    totales: {
        subtotal: number;
        descuento: number;
        iva: number;
        total: number;
        totalPagado: number;
    };
    vendedor: string;
    observaciones?: string;
}

export interface ProductoVenta {
    id: string;
    nombre: string;
    codigo: string;
    precio: number;
    precioConIva: number;
    aplicaIva: boolean;
    cantidad?: number;
    moneda: string;
    stock?: number;
}

export interface ProductoVentaCalculado {
    id: string;
    nombre: string;
    codigo: string;
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