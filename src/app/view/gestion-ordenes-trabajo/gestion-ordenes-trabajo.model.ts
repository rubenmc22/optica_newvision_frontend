export interface OrdenTrabajoEspecialista {
    id: number | null;
    cedula: string | null;
    nombre: string | null;
    tipo?: string | null;
    cargo?: string | null;
    externo?: {
        nombre: string | null;
        lugarConsultorio: string | null;
    } | null;
}

export interface OrdenTrabajoDatosConsulta {
    motivo?: string[];
    otroMotivo?: string | null;
    tipoCristalActual?: string | null;
    tipoLentesContacto?: string | null;
    fechaUltimaGraduacion?: string | null;
    formulaExterna?: boolean;
    pagoPendiente?: boolean | null;
    especialista?: OrdenTrabajoEspecialista | null;
    formulaOriginal?: {
        medicoOrigen: {
            tipo: string | null;
            nombre: string | null;
            lugarConsultorio: string | null;
        }
    } | null;
}

export interface OrdenTrabajoHistoriaMedica {
    id: number;
    numero: string;
    fecha: string;
    otro_motivo_consulta?: string;
    tipo_cristal_actual?: string;
    tipo_lentes_contacto?: string;
    ultima_graduacion?: string;
    diagnostico?: string;
    tratamiento?: string;
    conformidad_nota?: string;
    motivo_consulta?: string[];
    formula_externa?: boolean;
    especialista_tipo?: string | null;
    especialista_cedula?: string | null;
    especialista_externo_nombre?: string | null;
    especialista_externo_lugar?: string | null;
    formula_original_tipo?: string | null;
    formula_original_nombre?: string | null;
    formula_original_lugar?: string | null;
    examen_ocular_lensometria?: any;
    examen_ocular_refraccion?: any;
    examen_ocular_refraccion_final?: any;
    examen_ocular_avsc_avae_otros?: any;
    recomendaciones?: any[];
    datosConsulta?: OrdenTrabajoDatosConsulta | null;
}

export interface OrdenTrabajo {
    id: number;
    ordenId: string;
    ventaId: string;
    numero_venta: string;
    numero_recibo: string;
    sede: string;

    // Propiedades del cliente
    cliente: {
        historia_medica: OrdenTrabajoHistoriaMedica | null;
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
    especialista: OrdenTrabajoEspecialista | null;
    asesor: {
        id: number;
        cedula: string | null;
        nombre: string | null;
        cargo?: string | null;
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