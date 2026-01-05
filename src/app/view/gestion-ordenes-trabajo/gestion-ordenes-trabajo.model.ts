export interface OrdenTrabajo {
    id: number;
    ordenId: string;
    ventaId: string;
    sede: string;

    // Propiedades del cliente
    cliente: {
        historia_medica: any;
        tipo: string;
        informacion: {
            tipoPersona: string;
            nombreCompleto: string;
            cedula: string;
            telefono: string;
            email: string;
        }
    };

    // Personal asignado
    especialista: {
        id: number;
        cedula: string;
        nombre: string;
    };
    asesor: {
        id: number;
        cedula: string;
        nombre: string;
    };

    // Productos
    productos: Array<{
        id: number;
        nombre: string;
        precio: number;
        marca: string;
        codigo: string;
        modelo: string;
        cantidad?: number;
    }>;

    // Estado y flujo
    estado: EstadoOrden;

    // Fechas del proceso
    fechaCreacion: string;
    fechaInicioProceso: string | null;
    fechaTerminacion: string | null;
    fechaRecepcionTienda: string | null;
    fechaEntrega: string | null;
    fechaEntregaEstimada: string | null;
    fechaArchivado: string | null;

    // Campos calculados
    progreso: number;
    observaciones: string | null;
    archivado: boolean;
    motivoArchivo?: string;

    // Campos adicionales para UI (pueden ser opcionales)
    diasRestantes?: number;
    diasEnEspera?: number;
    codigo?: string; // Alias para ordenId
    clienteNombre?: string;
    clienteTelefono?: string;
    productoNombre?: string;
    tecnicoAsignado?: string;
    entregadoPor?: string;
    prioridad?: string;
}

export interface OrdenesTrabajoResponse {
    message: string;
    ordenes_trabajo: OrdenTrabajo[];
}

export type EstadoOrden = 'en_tienda' | 'proceso_laboratorio' | 'listo_laboratorio' | 'pendiente_retiro' | 'entregado';