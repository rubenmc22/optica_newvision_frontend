export interface PresupuestoVentaDraft {
    origen: {
        id?: number;
        codigo: string;
        fechaVencimiento?: string;
        total?: number;
    };
    cliente: {
        tipoPersona: 'natural' | 'juridica';
        nombreCompleto: string;
        cedula: string;
        telefono?: string;
        email?: string;
    };
    observaciones?: string;
    productos: Array<{
        id?: string | number;
        codigo?: string;
        descripcion: string;
        cantidad: number;
        precioUnitario: number;
        descuento?: number;
        totalLinea?: number;
    }>;
}

export const PRESUPUESTO_VENTA_STORAGE_KEY = 'presupuesto-venta-draft';