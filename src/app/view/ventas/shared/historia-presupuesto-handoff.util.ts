export const HISTORIA_PRESUPUESTO_HANDOFF_STORAGE_KEY = 'historiaPresupuestoHandoff';
export const PRESUPUESTO_HISTORIA_RETURN_STORAGE_KEY = 'presupuestoHistoriaReturn';

export interface HistoriaPresupuestoProductoDraft {
  id: string;
  productoId: string;
  nombre: string;
  codigo: string;
  descripcion: string;
  precio: number;
  precioUnitario: number;
  precioOriginal: number;
  cantidad: number;
  descuento: number;
  descuentoPorcentaje: number;
  total: number;
  moneda?: string;
  monedaOriginal?: string;
  tasaConversion?: number;
  aplicaIva?: boolean;
  categoria?: string;
  cristalConfig?: any;
}

export interface HistoriaPresupuestoOpcionDraft {
  id: string;
  nombre: string;
  observaciones?: string;
  esPrincipal?: boolean;
  productos: HistoriaPresupuestoProductoDraft[];
}

export interface HistoriaPresupuestoHandoff {
  origen: 'historia-medica';
  historiaId: string;
  historiaNumero?: string;
  especialistaTipo?: string;
  pacienteKey: string;
  pacienteId?: string;
  pacienteCedula?: string;
  cliente: {
    tipoPersona: 'natural' | 'juridica';
    cedula: string;
    nombreCompleto: string;
    telefono?: string;
    email?: string;
    direccion?: string;
    pacienteKey?: string;
    pacienteId?: string;
  };
  formulaExterna?: {
    activa: boolean;
    refraccionFinal: {
      od: { esfera: string | null; cilindro: string | null; eje: string | null; adicion?: string | null; alt?: string | null; dp?: string | null; };
      oi: { esfera: string | null; cilindro: string | null; eje: string | null; adicion?: string | null; alt?: string | null; dp?: string | null; };
    };
  };
  observaciones?: string;
  opciones: HistoriaPresupuestoOpcionDraft[];
  opcionPrincipalId?: string;
}

export interface PresupuestoHistoriaReturnDraft {
  origen: 'presupuesto';
  historiaId: string;
  historiaNumero?: string;
  pacienteKey: string;
  pacienteId?: string;
  pacienteCedula?: string;
  presupuestoCodigo?: string;
}