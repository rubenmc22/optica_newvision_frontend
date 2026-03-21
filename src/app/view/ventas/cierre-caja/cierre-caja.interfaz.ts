export interface Transaccion {
  id: string;
  tipo: 'venta' | 'ingreso' | 'egreso' | 'ajuste';
  descripcion: string;
  monto: number;
  fecha: Date;
  metodoPago: string;
  usuario: string;
  estado: 'confirmado' | 'pendiente' | 'anulado' | 'en_proceso';
  categoria: string;
  observaciones?: string;
  comprobante?: string;
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
    moneda: string;
    referencia?: string;
    banco?: string;           // ← Agregar banco
    bancoNombre?: string;     // ← Agregar bancoNombre
    bancoCodigo?: string;     // ← Agregar bancoCodigo
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
  tieneConsulta?: boolean;
  tieneProductos?: boolean;
}

export interface CierreDiario {
  id: string;
  fecha: Date;
  efectivoInicial: number;

  // Ventas por método de pago (original)
  ventasEfectivo: number;
  ventasTarjeta: number;
  ventasTransferencia: number;
  ventasDebito: number;
  ventasCredito: number;
  ventasPagomovil: number;
  ventasZelle: number;

  // NUEVAS PROPIEDADES
  ventasPorTipo: {
    soloConsulta: {
      cantidad: number;
      total: number;
      montoMedico: number;
      montoOptica: number;
    };
    consultaProductos: {
      cantidad: number;
      total: number;
      montoMedico: number;
      montoProductos: number;
    };
    soloProductos: {
      cantidad: number;
      total: number;
    };
  };

  metodosPago: {
    efectivo: {
      total: number;
      porMoneda: {
        dolar: number;
        euro: number;
        bolivar: number;
      };
      cantidad: number;
    };
    punto: {
      total: number;
      porBanco: Array<{
        banco: string;
        bancoCodigo: string;
        total: number;
        cantidad: number;
      }>;
      cantidad: number;
    };
    pagomovil: {
      total: number;
      cantidad: number;
      porBanco?: Array<{
        banco: string;
        bancoCodigo: string;
        total: number;
        cantidad: number;
      }>;
    };
    transferencia: {
      total: number;
      cantidad: number;
      porBanco?: Array<{
        banco: string;
        bancoCodigo: string;
        total: number;
        cantidad: number;
      }>;
    };
    zelle: {
      total: number;
      cantidad: number;
    };
    mixto: {
      total: number;
      cantidad: number;
    };
  };

  formasPago: {
    contado: {
      cantidad: number;
      total: number;
    };
    abono: {
      cantidad: number;
      total: number;
      montoAbonado: number;
      deudaPendiente: number;
    };
    cashea: {
      cantidad: number;
      total: number;
      montoInicial: number;
      deudaPendiente: number;
      cuotasPendientes: number;
    };
    deContadoPendiente: {
      cantidad: number;
      total: number;
      deudaPendiente: number;
    };
  };

  ventasPendientes: Array<{
    numeroVenta: string;
    cliente: string;
    total: number;
    formaPago: string;
    deuda: number;
    fecha: Date;
  }>;

  totales: {
    ingresos: number;
    egresos: number;
    neto: number;
    ventasContado: number;
    ventasCredito: number;
    ventasPendientes: number;
  };

  // Propiedades existentes
  otrosIngresos: number;
  egresos: number;
  efectivoFinalTeorico: number;
  efectivoFinalReal: number;
  diferencia: number;
  observaciones: string;
  estado: 'abierto' | 'cerrado' | 'revisado' | 'conciliado';
  usuarioApertura: string;
  usuarioCierre: string;
  fechaApertura: Date;
  fechaCierre?: Date;
  transacciones: Transaccion[];
  notasCierre: string;
  archivosAdjuntos: string[];
  sede: string;
  monedaPrincipal: string;
  tasasCambio: TasasCambio;
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