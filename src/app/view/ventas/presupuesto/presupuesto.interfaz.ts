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
    iva: number;
    total: number;
    observaciones: string;
    estado: string;
    diasRestantes?: number;
    estadoColor?: string;
}

export interface Cliente {
    id?: number;
    cedula: string;
    nombre: string;
    telefono: string;
    email: string;
    direccion?: string;
    tipoPersona: 'natural' | 'juridica';
}

export interface ProductoPresupuesto {
    id?: number;
    descripcion: string;
    codigo: string;
    precio: number;
    cantidad: number;
    descuento: number;
    total: number;
}