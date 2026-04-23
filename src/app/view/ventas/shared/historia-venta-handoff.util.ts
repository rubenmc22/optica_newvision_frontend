export const HISTORIA_VENTA_HANDOFF_STORAGE_KEY = 'historiaVentaHandoff';

export interface HistoriaVentaHandoff {
  origen: 'historia-medica';
  pacienteKey: string;
  pacienteId?: string;
  historiaId: string;
  historiaNumero?: string;
  tipoVenta: 'solo_consulta' | 'consulta_productos';
  autoAgregarRecomendaciones: boolean;
}