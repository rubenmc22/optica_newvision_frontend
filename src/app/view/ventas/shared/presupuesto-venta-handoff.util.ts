export type VentaItemTipo = 'inventariable' | 'base_formulado' | 'addon_tecnico' | 'desconocido' | 'servicio_consulta';

export type EstadoValidacionClinicaDraft = 'no_requerida' | 'pendiente' | 'revision_manual' | 'aprobada';

export interface PresupuestoVentaLineaDraft {
    lineaKey: string;
    id?: string | number;
    codigo?: string;
    descripcion: string;
    categoria?: string;
    material?: string;
    cantidad: number;
    precioUnitario: number;
    descuento?: number;
    totalLinea?: number;
    tipoItem?: VentaItemTipo;
    esConsulta?: boolean;
    requiereFormula?: boolean;
    requierePaciente?: boolean;
    requiereHistoriaMedica?: boolean;
    permiteFormulaExterna?: boolean;
    requiereItemPadre?: boolean;
    requiereProcesoTecnico?: boolean;
    origenClasificacion?: 'catalogo' | 'inferido';
    esClasificacionConfiable?: boolean;
    configuracionTecnica?: any;
}

export interface PresupuestoVentaDraft {
    origen: {
        id?: number;
        codigo: string;
        fechaVencimiento?: string;
        total?: number;
    };
    tipoVenta?: 'solo_productos' | 'consulta_productos' | 'solo_consulta';
    estadoValidacionClinica?: EstadoValidacionClinicaDraft;
    requiereSoporteClinico?: boolean;
    historia?: {
        id?: string | number;
        numero?: string;
        pacienteKey?: string;
        pacienteId?: string | number;
        especialistaTipo?: 'OFTALMOLOGO' | 'OPTOMETRISTA' | 'EXTERNO' | string;
    };
    cliente: {
        tipoPersona: 'natural' | 'juridica';
        nombreCompleto: string;
        cedula: string;
        telefono?: string;
        email?: string;
        pacienteKey?: string;
        pacienteId?: string | number;
    };
    observaciones?: string;
    productos: PresupuestoVentaLineaDraft[];
}

export const PRESUPUESTO_VENTA_STORAGE_KEY = 'presupuesto-venta-draft';