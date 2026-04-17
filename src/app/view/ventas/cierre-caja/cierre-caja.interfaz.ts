export interface Transaccion {
  id: string;
  tipo: 'venta' | 'ingreso' | 'egreso' | 'ajuste';
  descripcion: string;
  monto: number;
  fecha: Date;
  metodoPago: string;
  moneda?: string;
  monedaOriginal?: string;
  montoOriginal?: number;
  montoTotal?: number;
  montoPagado?: number;
  deudaPendiente?: number;
  montoSistema?: number;
  tasasHistoricas?: Array<{
    moneda: string;
    tasa: number;
    valor?: number;
  }>;
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
    montoEnBolivar?: number;
    montoEnMonedaVenta?: number;
    montoEnMonedaSistema?: number;
    tasaUsada?: number;
    referencia?: string;
    banco?: string;
    bancoNombre?: string;
    bancoCodigo?: string;
    bancoReceptor?: string;
    bancoReceptorNombre?: string;
    bancoReceptorCodigo?: string;
    cuentaReceptoraId?: string;
    cuentaReceptoraAlias?: string;
    cuentaReceptoraUltimos4?: string;
    cuentaReceptoraEmail?: string;
    cuentaReceptoraTitular?: string;
    cuentaReceptoraDocumento?: string;
    cuentaReceptoraTelefono?: string;
    cuentaReceptoraDescripcion?: string;
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
  tipoVenta?: string;
  consulta?: {
    pagoMedico?: number;
    pagoOptica?: number;
    montoTotal?: number;
    moneda?: string;
  };
}

export interface CierreDiario {
  id: string;
  fecha: Date;
  descripcion?: string;
  efectivoInicial: number;

  efectivoInicialDetalle?: {
    Bs: number;
    USD: number;
    EUR: number;
  };

  // Ventas por método de pago 
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
        detalleCuenta?: string;
        referenciaCuenta?: string;
        cuentaTitular?: string;
        cuentaDocumento?: string;
        cuentaTelefono?: string;
        cuentaCorreo?: string;
      }>;
      cantidad: number;
    };
    pagomovil: {
      total: number;
      cantidad: number;
      porBanco: Array<{
        banco: string;
        bancoCodigo: string;
        total: number;
        cantidad: number;
        totalOriginal?: number;
        monedaOriginal?: string;
        destinoKey?: string;
        destinoLabel?: string;
        detalleCuenta?: string;
        referenciaCuenta?: string;
        cuentaTitular?: string;
        cuentaDocumento?: string;
        cuentaTelefono?: string;
        cuentaCorreo?: string;
      }>;
    };
    transferencia: {
      total: number;
      cantidad: number;
      porBanco: Array<{
        banco: string;
        bancoCodigo: string;
        total: number;
        cantidad: number;
        totalOriginal?: number;
        monedaOriginal?: string;
        destinoKey?: string;
        destinoLabel?: string;
        detalleCuenta?: string;
        referenciaCuenta?: string;
        cuentaTitular?: string;
        cuentaDocumento?: string;
        cuentaTelefono?: string;
        cuentaCorreo?: string;
      }>;
    };
    zelle: {
      total: number;
      cantidad: number;
      porBanco: Array<{
        banco: string;
        bancoCodigo: string;
        total: number;
        cantidad: number;
        totalOriginal?: number;
        monedaOriginal?: string;
        destinoKey?: string;
        destinoLabel?: string;
        detalleCuenta?: string;
        referenciaCuenta?: string;
        cuentaTitular?: string;
        cuentaDocumento?: string;
        cuentaTelefono?: string;
        cuentaCorreo?: string;
      }>;
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

  detalleCierreReal?: {
    efectivo: {
      usd: number;
      eur: number;
      ves: number;
    };
    punto: Array<{
      banco: string;
      bancoCodigo: string;
      montoReal: number;
      montoSistema: number;
      diferencia: number;
      cantidadReal?: number;
      cantidadSistema?: number;
    }>;
    transferencia:
      | Array<{
        banco: string;
        bancoCodigo?: string;
        destinoKey?: string;
        destinoLabel?: string;
        montoReal: number;
        montoSistema: number;
        diferencia: number;
      }>
      | {
        diferencia: number;
        justificacion?: string;
        porBanco: Array<{
          banco: string;
          diferencia: number;
          justificacion?: string;
        }>;
      };
    pagomovil:
      | Array<{
        banco: string;
        bancoCodigo?: string;
        destinoKey?: string;
        destinoLabel?: string;
        montoReal: number;
        montoSistema: number;
        diferencia: number;
      }>
      | {
        diferencia: number;
        justificacion?: string;
        porBanco: Array<{
          banco: string;
          diferencia: number;
          justificacion?: string;
        }>;
      };
    zelle:
      | number
      | Array<{
        banco: string;
        bancoCodigo?: string;
        destinoKey?: string;
        destinoLabel?: string;
        montoReal: number;
        montoSistema: number;
        diferencia: number;
      }>;
    notasCierre: string;
    fechaCierre: Date;
    usuarioCierre: string;
    diferenciaTotal: number;
    estadoConciliacion: 'conciliado' | 'pendiente' | 'diferencia';
  };

  /**
   * Detalle de los valores del SISTEMA para comparación
   * (lo que el sistema calculó automáticamente)
   */
  detalleCierreSistema?: {
    efectivo: {
      usd: number;
      eur: number;
      ves: number;
    };
    punto: Array<{
      banco: string;
      bancoCodigo: string;
      montoSistema: number;
      cantidad: number;
    }>;
    transferencia: Array<{
      banco: string;
      bancoCodigo: string;
      montoSistema: number;
      cantidad: number;
    }>;
    pagomovil: Array<{
      banco: string;
      bancoCodigo: string;
      montoSistema: number;
      cantidad: number;
    }>;
    zelle: number;
    totalVentas: number;
    totalEfectivo: number;
    totalOtrosMedios: number;
    fechaCalculo: Date;
  };

  resumenDiferencias?: {
    efectivo: {
      diferencia: number;
      justificacion?: string;
    };
    punto: {
      diferencia: number;
      justificacion?: string;
      porBanco: Array<{
        banco: string;
        diferencia: number;
        justificacion?: string;
      }>;
    };
    transferencia: {
      diferencia: number;
      justificacion?: string;
      porBanco?: Array<{  // Hacer opcional si no siempre se usa
        diferencia: number;
        justificacion?: string;
      }>;
    };
    pagomovil: {
      diferencia: number;
      justificacion?: string;
      porBanco?: Array<{  // Hacer opcional si no siempre se usa
        banco: string;
        diferencia: number;
        justificacion?: string;
      }>;
    };
    zelle: {
      diferencia: number;
      justificacion?: string;
    };
    total: number;
    requiereJustificacion: boolean;
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