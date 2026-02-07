export interface Transaccion {
  id: string;
  tipo: 'venta' | 'ingreso' | 'egreso' | 'ajuste';
  descripcion: string;
  monto: number;
  fecha: Date;
  // Permitir string en general para más flexibilidad
  metodoPago: string; // Cambiado de tipo específico a string
  usuario: string;
  estado: 'confirmado' | 'pendiente' | 'anulado' | 'en_proceso';
  categoria: string;
  observaciones?: string;
  comprobante?: string;
  // Nuevas propiedades según el flujo de ventas
  numeroVenta?: string;
  cliente?: {
    nombre: string;
    cedula: string;
    telefono?: string;
    email?: string;
  };
  formaPago?: 'contado' | 'abono' | 'cashea' | 'de_contado-pendiente';
  detalleMetodosPago?: Array<{
    tipo: string;
    monto: number;
    referencia?: string;
    banco?: string;
    moneda: string;
  }>;
  productos?: Array<{
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    aplicaIva: boolean;
    moneda: string;
  }>;
  asesor?: string;
  ordenTrabajoGenerada?: boolean;
  sede?: string;
}

// cierre-caja.interfaz.ts
export interface CierreDiario {
  id: string;
  fecha: Date;
  efectivoInicial: number;

  // Ventas por método de pago
  ventasEfectivo: number;
  ventasTarjeta: number;
  ventasTransferencia: number;
  ventasDebito: number;
  ventasCredito: number;
  ventasPagomovil: number;
  ventasZelle: number;

  // Otros ingresos y egresos
  otrosIngresos: number;
  egresos: number;

  // Cálculos
  efectivoFinalTeorico: number;
  efectivoFinalReal: number;
  diferencia: number;

  // Información del cierre
  observaciones: string;
  estado: 'abierto' | 'cerrado' | 'revisado' | 'conciliado';
  usuarioApertura: string;
  usuarioCierre: string;
  fechaApertura: Date;
  fechaCierre?: Date;
  transacciones: Transaccion[];
  notasCierre: string;
  archivosAdjuntos: string[];

  // Nuevas propiedades según el sistema de ventas
  sede: string;
  monedaPrincipal: string;

  tasasCambio: TasasCambio;  // Usar el tipo definido

  metodosPagoDetallados: Array<{
    metodo: string;
    total: number;
    cantidad: number;
    desgloseMoneda?: Array<{
      moneda: string;
      total: number;
    }>;
  }>;
}

export interface ResumenMetodoPago {
  metodo: string;
  total: number;
  porcentaje: number;
  cantidad: number;
  color: string;
  desgloseMoneda?: Array<{
    moneda: string;
    total: number;
  }>;
}

// types/tasas-cambio.type.ts (opcional)
export type TasasCambio = {
  dolar: number;
  euro: number;
  bolivar: number;
} & {
  [key: string]: number | undefined; // Otras propiedades opcionales
};