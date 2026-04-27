export interface Presupuesto {
    id?: number;
    codigo: string;
    cliente: Cliente;
    fechaCreacion: Date;
    fechaVencimiento: Date;
    diasVencimiento: number;
    vendedor: string;
    productos: ProductoPresupuesto[];
    subtotal: number;
    descuentoTotal?: number;
    ivaPorcentaje?: number;
    iva: number;
    total: number;
    observaciones: string;
    formulaExterna?: FormulaExternaPresupuesto;
    opciones?: OpcionPresupuesto[];
    opcionPrincipalId?: string | null;
    estado: string;
    diasRestantes?: number;
    estadoColor?: string;
}

export interface OpcionPresupuesto {
    id: string;
    nombre: string;
    productos: ProductoPresupuesto[];
    subtotal: number;
    descuentoTotal?: number;
    iva: number;
    total: number;
    observaciones?: string;
    esPrincipal?: boolean;
}

export interface FormulaExternaPresupuesto {
    activa: boolean;
    refraccionFinal: {
        od: FormulaExternaOjoPresupuesto;
        oi: FormulaExternaOjoPresupuesto;
    };
}

export interface FormulaExternaOjoPresupuesto {
    esfera: string;
    cilindro: string;
    eje: string;
    adicion?: string;
    alt?: string;
    dp?: string;
}

export interface Cliente {
    id?: number;
    cedula: string;
    nombre?: string;
    nombreCompleto?: string;
    telefono: string;
    email: string;
    direccion?: string;
    razonSocial?: string;
    tipoPersona: 'natural' | 'juridica';
}

export interface ProductoPresupuesto {
    id?: number;
    descripcion: string;
    codigo: string;
    precio: number;
    precioOriginal?: number;
    cantidad: number;
    descuento: number;
    total: number;
    moneda?: string;
    monedaOriginal?: string;
    tasaConversion?: number;
}