export interface CierreCajaReporteValor {
  label: string;
  value: unknown;
  format?: 'currency' | 'text';
  clase?: string;
}

export interface CierreCajaReporteSeccionMetodo {
  tipo: string;
  titulo: string;
  total: number;
  mostrarConciliacion?: boolean;
  filas: Array<{
    destino: string;
    detalle?: string | null;
    referencia?: string | null;
    montoOriginal?: string | null;
    sistema: number;
    real: number | null;
    diferencia: number | null;
    operaciones: number;
  }>;
}

export interface CierreCajaReporteDocumento {
  sede: string;
  direccion?: string;
  fecha: string;
  fechaArchivo?: string;
  generadoEn: string;
  estado: string;
  monedaSistema: string;
  mostrarConciliacion: boolean;
  notaFinal: string;
  kpis: CierreCajaReporteValor[];
  resumenOperativo: CierreCajaReporteValor[];
  conciliacion: CierreCajaReporteValor[];
  efectivoPorMoneda: Array<{
    moneda: string;
    inicial: number;
    esperado: number;
    real: number;
  }>;
  formasPago: Array<{
    forma: string;
    total: number;
    deudaPendiente: number;
    cantidad: number;
  }>;
  metodos: CierreCajaReporteSeccionMetodo[];
  totalMetodos: number;
  notaMetodos?: string;
  transacciones: Array<{
    hora: string;
    descripcion: string;
    tipo: string;
    metodo: string;
    monto: number;
    montoTexto?: string;
    usuario: string;
    numeroVenta?: string;
    cliente?: string;
  }>;
}

function escapeHtml(value: unknown): string {
  return (value ?? '')
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function getCurrencySymbol(moneda: unknown): string {
  const valor = String(moneda || '').trim().toUpperCase();
  if (valor === 'EUR') {
    return '€';
  }
  if (valor === 'VES' || valor === 'BS') {
    return 'Bs.';
  }
  return '$';
}

function formatCurrencyWithUnit(value: number, moneda: unknown): string {
  return `${getCurrencySymbol(moneda)} ${formatCurrency(Number(value || 0))}`;
}

function formatearValorReporte(item: CierreCajaReporteValor, monedaSistema: string, incluirMoneda: boolean = true): string {
  if (item?.format === 'currency') {
    return incluirMoneda
      ? formatCurrencyWithUnit(Number(item?.value || 0), monedaSistema)
      : formatCurrency(Number(item?.value || 0));
  }

  return escapeHtml(item?.value ?? '');
}

function generarBloqueMetodoReporte(seccion: CierreCajaReporteSeccionMetodo, mostrarConciliacion: boolean, monedaSistema: string): string {
  return `
    <section class="section-block">
      <div class="section-title-row">
        <h3>${escapeHtml(seccion.titulo)}</h3>
        <span class="section-total">${formatCurrencyWithUnit(seccion.total, monedaSistema)}</span>
      </div>
      <div class="table-wrap table-wrap--wide">
      <table>
        <thead>
          <tr>
            <th>Banco receptor / destino</th>
            <th>Monto original</th>
            <th>Sistema</th>
            ${mostrarConciliacion ? '<th>Real</th><th>Diferencia</th>' : ''}
            <th>Ops</th>
          </tr>
        </thead>
        <tbody>
          ${seccion.filas.map((fila) => `
            <tr>
              <td>
                <strong>${escapeHtml(fila.destino)}</strong>
                ${fila.detalle ? `<div class="muted">${escapeHtml(fila.detalle)}</div>` : ''}
                ${fila.referencia ? `<div class="muted">${escapeHtml(fila.referencia)}</div>` : ''}
              </td>
              <td>${escapeHtml(fila.montoOriginal || 'N/A')}</td>
              <td>${formatCurrencyWithUnit(fila.sistema, monedaSistema)}</td>
              ${mostrarConciliacion ? `<td>${fila.real !== null ? formatCurrencyWithUnit(fila.real, monedaSistema) : 'N/A'}</td>` : ''}
              ${mostrarConciliacion ? `<td class="${(fila.diferencia || 0) > 0 ? 'positive' : (fila.diferencia || 0) < 0 ? 'negative' : ''}">${fila.real !== null && fila.diferencia !== null ? formatCurrencyWithUnit(fila.diferencia, monedaSistema) : 'N/A'}</td>` : ''}
              <td>${fila.operaciones}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      </div>
    </section>
  `;
}

export function getCierreCajaReportStyles(): string {
  return `
    :root { color-scheme: light; }
    html, body { margin: 0; padding: 0; background: #ffffff; }
    .report-root, .report-root * { box-sizing: border-box; }
    .report-root { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px; color: #1f2937; background: #ffffff; }
    .report-root h1, .report-root h2, .report-root h3, .report-root p { margin: 0; }
    .report-root .header {
      background: linear-gradient(135deg, #eff6ff 0%, #ecfeff 100%);
      color: #0f172a;
      padding: 22px 24px;
      border-radius: 16px;
      margin-bottom: 18px;
      border: 1px solid #bfdbfe;
      border-left: 8px solid #0f4c81;
      box-shadow: 0 12px 28px rgba(15, 76, 129, 0.08);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .report-root .header-top { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .report-root .header-title { font-size: 28px; font-weight: 800; margin-bottom: 8px; color: #0f4c81; letter-spacing: -0.02em; }
    .report-root .header-meta { font-size: 13px; color: #475569; line-height: 1.65; }
    .report-root .badge {
      display: inline-block;
      background: #0f4c81;
      color: #ffffff;
      border: 1px solid #0b3b63;
      padding: 7px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
      box-shadow: 0 6px 16px rgba(15, 76, 129, 0.18);
    }
    .report-root .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 18px 0; }
    .report-root .kpi-card { background: #f8fafc; border: 1px solid #e5e7eb; padding: 14px; border-radius: 12px; }
    .report-root .kpi-label { display: block; color: #64748b; font-size: 12px; margin-bottom: 6px; }
    .report-root .kpi-value { font-size: 22px; font-weight: 700; color: #0f172a; }
    .report-root .layout-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 16px; margin-bottom: 18px; }
    .report-root .panel { border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px; background: #fff; }
    .report-root .panel h2 { font-size: 16px; margin-bottom: 14px; color: #0f172a; }
    .report-root .summary-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .report-root .summary-item { display: grid; gap: 0.3rem; padding: 0.75rem 0.8rem; border: 1px solid #e5e7eb; border-radius: 12px; background: #f8fafc; }
    .report-root .summary-label { color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .report-root .summary-value { font-weight: 700; text-align: left; color: #0f172a; line-height: 1.35; }
    .report-root .section-block { margin-bottom: 18px; }
    .report-root .two-col + .section-block { margin-top: 14px; }
    .report-root .section-title-row { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 10px; }
    .report-root .section-title-row h3 { font-size: 15px; color: #0f172a; }
    .report-root .section-total { font-size: 13px; font-weight: 700; color: #0f4c81; }
    .report-root .table-wrap { width: 100%; overflow-x: auto; overflow-y: visible; -webkit-overflow-scrolling: touch; margin-bottom: 14px; }
    .report-root .table-wrap table { width: 100%; border-collapse: collapse; margin-bottom: 0; table-layout: auto; min-width: 100%; }
    .report-root .table-wrap--wide table { min-width: 720px; }
    .report-root .table-wrap--medium table { min-width: 560px; }
    .report-root th, .report-root td { border: 1px solid #e5e7eb; padding: 9px 10px; text-align: left; vertical-align: top; font-size: 12px; word-break: normal; overflow-wrap: break-word; white-space: normal; }
    .report-root th { background: #f8fafc; color: #334155; font-weight: 700; }
    .report-root thead { display: table-header-group; }
    .report-root tr { break-inside: avoid; page-break-inside: avoid; }
    .report-root .muted { color: #64748b; font-size: 11px; margin-top: 3px; }
    .report-root .positive { color: #047857; font-weight: 700; }
    .report-root .negative { color: #b91c1c; font-weight: 700; }
    .report-root .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .report-root .note-box { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; font-size: 12px; color: #475569; }
    .report-root .footer-note {
      margin-top: 28px;
      padding-top: 14px;
      border-top: 1px solid #e5e7eb;
      color: #64748b;
      font-size: 11px;
      text-align: center;
      line-height: 1.7;
    }
    @media (max-width: 768px) {
      .report-root { padding: 14px; }
      .report-root .header { padding: 18px; border-radius: 16px; }
      .report-root .header-top,
      .report-root .section-title-row { flex-direction: column; align-items: flex-start; }
      .report-root .header-title { font-size: 22px; }
      .report-root .header-meta { font-size: 12px; }
      .report-root .badge { align-self: flex-start; }
      .report-root .kpi-grid,
      .report-root .layout-grid,
      .report-root .two-col { grid-template-columns: 1fr; }
      .report-root .panel,
      .report-root .kpi-card { padding: 14px; }
      .report-root .summary-list { grid-template-columns: 1fr; }
      .report-root .table-wrap { margin-inline: -2px; padding: 0 2px 4px; }
      .report-root .table-wrap--wide table { min-width: 680px; }
      .report-root .table-wrap--medium table { min-width: 480px; }
      .report-root th,
      .report-root td { font-size: 11px; padding: 8px; }
    }
    @media (max-width: 480px) {
      .report-root { padding: 12px; }
      .report-root .header { padding: 16px; }
      .report-root .header-title { font-size: 20px; }
      .report-root .kpi-value { font-size: 18px; }
      .report-root .panel h2,
      .report-root .section-title-row h3 { font-size: 14px; }
      .report-root .table-wrap--wide table { min-width: 620px; }
      .report-root .table-wrap--medium table { min-width: 440px; }
    }
    @media print {
      body { margin: 12px; }
      .report-root { padding: 0; }
      .report-root .panel, .report-root .kpi-card, .report-root .header, .report-root table, .report-root tr { break-inside: avoid; page-break-inside: avoid; }
      .report-root .kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 8px; }
      .report-root .layout-grid { grid-template-columns: 1fr 1fr !important; gap: 12px; }
      .report-root .summary-list { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 8px; }
      .report-root .panel,
      .report-root .kpi-card { padding: 12px; }
      .report-root .kpi-label,
      .report-root .summary-label { font-size: 10px; }
      .report-root .kpi-value { font-size: 18px; }
      .report-root .summary-item { padding: 0.65rem 0.7rem; }
      .report-root .table-wrap { overflow: visible; }
      .report-root .table-wrap table { min-width: 100% !important; }
    }
  `;
}

export function buildCierreCajaReportMarkup(reporte: CierreCajaReporteDocumento): string {
  return `
    <div class="report-root">
      <div class="header">
        <div class="header-top">
          <div>
            <div class="header-title">Cierre de Caja Diario</div>
            <div class="header-meta">
              ${escapeHtml(`Sede: ${reporte.direccion || reporte.sede || 'Óptica'}`)}<br>
              Fecha: ${escapeHtml(reporte.fecha)}<br>
              Generado: ${escapeHtml(reporte.generadoEn)}
            </div>
          </div>
          <span class="badge">${escapeHtml(reporte.estado)}</span>
        </div>
      </div>

      <div class="kpi-grid">
        ${reporte.kpis.map((kpi) => `
          <div class="kpi-card">
            <div class="kpi-label">${escapeHtml(kpi.label)}</div>
            <div class="kpi-value ${escapeHtml(kpi.clase || '')}">${formatearValorReporte(kpi, reporte.monedaSistema)}</div>
          </div>
        `).join('')}
      </div>

      <div class="layout-grid">
        <div class="panel">
          <h2>Resumen operativo</h2>
          <div class="summary-list">
            ${reporte.resumenOperativo.map((item) => `
              <div class="summary-item">
                <span class="summary-label">${escapeHtml(item.label)}</span>
                <span class="summary-value ${escapeHtml(item.clase || '')}">${formatearValorReporte(item, reporte.monedaSistema)}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="panel">
          <h2>Conciliación del cierre</h2>
          <div class="summary-list">
            ${reporte.conciliacion.map((item) => `
              <div class="summary-item">
                <span class="summary-label">${escapeHtml(item.label)}</span>
                <span class="summary-value ${escapeHtml(item.clase || '')}">${formatearValorReporte(item, reporte.monedaSistema)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="two-col">
        <div class="panel">
          <h2>Caja fisica por moneda</h2>
          <div class="table-wrap table-wrap--medium">
          <table>
            <thead>
              <tr>
                <th>Moneda</th>
                <th>Inicial de caja</th>
                <th>Esperado final</th>
                ${reporte.mostrarConciliacion ? '<th>Real contado</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${reporte.efectivoPorMoneda.map((fila) => `
                <tr>
                  <td>${escapeHtml(fila.moneda)}</td>
                  <td>${formatCurrencyWithUnit(fila.inicial, fila.moneda)}</td>
                  <td>${formatCurrencyWithUnit(fila.esperado, fila.moneda)}</td>
                  ${reporte.mostrarConciliacion ? `<td>${formatCurrencyWithUnit(fila.real, fila.moneda)}</td>` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
          </div>
        </div>
        <div class="panel">
          <h2>Formas de pago</h2>
          <div class="table-wrap table-wrap--medium">
          <table>
            <thead>
              <tr>
                <th>Forma</th>
                <th>Total</th>
                <th>Deuda pendiente</th>
                <th>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              ${reporte.formasPago.map((fila) => `
                <tr>
                  <td>${escapeHtml(fila.forma)}</td>
                  <td>${formatCurrencyWithUnit(fila.total, reporte.monedaSistema)}</td>
                  <td>${formatCurrencyWithUnit(fila.deudaPendiente, reporte.monedaSistema)}</td>
                  <td>${fila.cantidad}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      ${reporte.metodos.length
        ? reporte.metodos.map((seccion) => generarBloqueMetodoReporte(seccion, seccion.mostrarConciliacion ?? reporte.mostrarConciliacion, reporte.monedaSistema)).join('')
        : ''}

      ${reporte.metodos.length ? `
        <section class="section-block">
          <div class="section-title-row">
            <h3>Suma neta por metodos del dia</h3>
            <span class="section-total">${formatCurrencyWithUnit(Number(reporte.totalMetodos || 0), reporte.monedaSistema)}</span>
          </div>
          <div class="note-box">
            <strong>${formatCurrencyWithUnit(Number(reporte.totalMetodos || 0), reporte.monedaSistema)}</strong><br>
            ${escapeHtml(reporte.notaMetodos || 'Incluye efectivo cobrado del dia y metodos electronicos. No incluye efectivo inicial de apertura.')}
          </div>
        </section>
      ` : ''}

      <section class="section-block">
        <div class="section-title-row">
          <h3>Transacciones del día</h3>
          <span class="section-total">${reporte.transacciones.length} registros</span>
        </div>
        <div class="table-wrap table-wrap--wide">
        <table>
          <thead>
            <tr>
              <th>Hora</th>
              <th>Descripción</th>
              <th>Tipo</th>
              <th>Método</th>
              <th>Monto</th>
              <th>Usuario</th>
            </tr>
          </thead>
          <tbody>
            ${reporte.transacciones.length ? reporte.transacciones.map((fila) => `
              <tr>
                <td>${escapeHtml(fila.hora)}</td>
                <td>
                  <strong>${escapeHtml(fila.descripcion)}</strong>
                </td>
                <td>${escapeHtml(fila.tipo)}</td>
                <td>${escapeHtml(fila.metodo)}</td>
                <td>${escapeHtml(fila.montoTexto || `${formatCurrency(fila.monto)} ${reporte.monedaSistema}`)}</td>
                <td>${escapeHtml(fila.usuario)}</td>
              </tr>
            `).join('') : `<tr><td colspan="6" class="muted">No hay transacciones registradas para este cierre.</td></tr>`}
          </tbody>
        </table>
        </div>
      </section>

      <div class="footer-note">
        <div>&copy; 2025 Óptica New Vision Lens 2020</div>
        <div>Operación centralizada para ${escapeHtml(reporte.sede || 'general')}</div>
        <div>v1.0</div>
      </div>
    </div>
  `;
}

export function buildCierreCajaReportDocument(reporte: CierreCajaReporteDocumento): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cierre de Caja - ${escapeHtml(reporte.fecha)}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
      <style>${getCierreCajaReportStyles()}</style>
    </head>
    <body>
      ${buildCierreCajaReportMarkup(reporte)}
    </body>
    </html>
  `;
}

export interface CierreCajaPublicTokenPayload {
  sede: string;
  fecha: string;
}

function normalizarMonedaReporte(moneda: unknown): 'USD' | 'EUR' | 'VES' {
  const valor = String(moneda || '').trim().toUpperCase();
  if (valor === 'EUR') {
    return 'EUR';
  }
  if (valor === 'VES' || valor === 'BS') {
    return 'VES';
  }
  return 'USD';
}

function normalizarClaveMoneda(moneda: unknown): 'dolar' | 'euro' | 'bolivar' {
  const valor = String(moneda || '').trim().toLowerCase();
  if (['eur', 'euro', '€'].includes(valor)) {
    return 'euro';
  }
  if (['ves', 'bs', 'bolivar', 'bolivar', 'bolivares'].includes(valor)) {
    return 'bolivar';
  }
  return 'dolar';
}

function formatearFechaDocumento(fecha: unknown): string {
  const valor = String(fecha || '').trim();
  const match = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return valor;
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatearFechaHoraDocumento(fecha: unknown): string {
  const date = new Date(String(fecha || ''));
  if (Number.isNaN(date.getTime())) {
    return String(fecha || '');
  }

  return new Intl.DateTimeFormat('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatearHoraDocumento(fecha: unknown): string {
  const date = new Date(String(fecha || ''));
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('es-VE', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatearEstadoDocumento(estado: unknown): string {
  const valor = String(estado || '').trim().toLowerCase();
  if (valor === 'cerrado') {
    return 'Caja cerrada';
  }
  if (valor === 'revisado') {
    return 'Cierre revisado';
  }
  if (valor === 'abierto') {
    return 'Caja abierta';
  }
  return valor || 'Cierre de caja';
}

function convertirMontoASistema(monto: unknown, moneda: unknown, monedaSistema: 'USD' | 'EUR' | 'VES', tasasCambio: any): number {
  const valor = Number(monto || 0);
  if (!Number.isFinite(valor)) {
    return 0;
  }

  const clave = normalizarClaveMoneda(moneda);
  const mapa = {
    dolar: 'USD',
    euro: 'EUR',
    bolivar: 'VES'
  } as const;

  if (mapa[clave] === monedaSistema) {
    return valor;
  }

  const tasa = Number(tasasCambio?.[clave] || 0);
  return tasa > 0 ? valor * tasa : valor;
}

function obtenerDescripcionCuenta(cuenta: any): string {
  return String(
    cuenta?.descripcionCuenta
    || cuenta?.accountDescription
    || cuenta?.alias
    || cuenta?.bancoNombre
    || cuenta?.bank
    || ''
  ).trim();
}

function construirDestinoMetodo(metodo: any): { key: string; label: string; detalle: string | null; referencia: string | null; montoOriginal: string | null } {
  const cuenta = metodo?.cuentaReceptora || {};
  const bancoCodigo = String(cuenta?.bancoCodigo || metodo?.bancoReceptorCodigo || metodo?.bancoCodigo || 'sin-banco').trim();
  const bancoNombre = String(cuenta?.bancoNombre || metodo?.bancoReceptorNombre || metodo?.bancoNombre || metodo?.banco || 'Destino').trim();
  const descripcion = obtenerDescripcionCuenta(cuenta);
  const moneda = String(metodo?.moneda || 'USD').trim().toLowerCase();
  const keyBase = `${bancoCodigo}_${descripcion || bancoNombre}_${moneda}`.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const titular = String(cuenta?.titular || cuenta?.ownerName || '').trim();
  const referencia = String(metodo?.referencia || '').trim() || null;
  const label = descripcion ? `${bancoNombre} (${descripcion})` : bancoNombre;
  const detalle = [titular, String(cuenta?.telefono || cuenta?.phone || '').trim()].filter(Boolean).join(' · ') || null;
  const montoOriginal = `${formatCurrency(Number(metodo?.monto || 0))} ${String(metodo?.moneda || '').trim().toUpperCase() || 'USD'}`;

  return {
    key: keyBase || 'destino',
    label,
    detalle,
    referencia,
    montoOriginal
  };
}

function formatearTipoMetodoPago(tipo: unknown): string {
  const valor = String(tipo || '').trim().toLowerCase();
  const etiquetas: Record<string, string> = {
    efectivo: 'Efectivo',
    punto: 'Punto de venta',
    pagomovil: 'Pago movil',
    transferencia: 'Transferencia',
    zelle: 'Zelle'
  };

  return etiquetas[valor] || (valor ? valor.charAt(0).toUpperCase() + valor.slice(1) : 'Sin metodo');
}

function formatearTipoTransaccionDocumento(tipo: unknown): string {
  const valor = String(tipo || '').trim().toLowerCase();
  if (valor === 'venta') {
    return 'Venta';
  }
  if (valor === 'ingreso') {
    return 'Ingreso';
  }
  if (valor === 'egreso') {
    return 'Egreso';
  }
  return valor ? valor.charAt(0).toUpperCase() + valor.slice(1) : 'Movimiento';
}

function buildResumenMetodoDocumento(resumen: any): string {
  const metodos = Array.isArray(resumen?.metodosDePago) ? resumen.metodosDePago : [];
  if (!metodos.length) {
    return String(resumen?.formaPago || 'Sin metodo');
  }

  return metodos.map((item: any) => formatearTipoMetodoPago(item?.tipo)).join(' / ');
}

function crearAnalisisMetodos() {
  return {
    efectivo: { total: 0, cantidad: 0, porMoneda: { USD: 0, EUR: 0, VES: 0 } },
    punto: new Map<string, any>(),
    transferencia: new Map<string, any>(),
    pagomovil: new Map<string, any>(),
    zelle: new Map<string, any>()
  };
}

function acumularMetodoElectronico(mapa: Map<string, any>, metodo: any, montoSistema: number): void {
  const destino = construirDestinoMetodo(metodo);
  const existente = mapa.get(destino.key) || {
    destino: destino.label,
    detalle: destino.detalle,
    referencia: destino.referencia,
    montoOriginal: destino.montoOriginal,
    sistema: 0,
    operaciones: 0,
    banco: String(metodo?.cuentaReceptora?.bancoNombre || metodo?.bancoNombre || metodo?.banco || '').trim() || null,
    bancoCodigo: String(metodo?.cuentaReceptora?.bancoCodigo || metodo?.bancoCodigo || '').trim() || null,
    destinoKey: destino.key,
    destinoLabel: destino.label,
    real: null,
    diferencia: null
  };

  existente.sistema += montoSistema;
  existente.operaciones += 1;
  existente.montoOriginal = destino.montoOriginal;
  existente.detalle = destino.detalle;
  existente.referencia = destino.referencia;
  mapa.set(destino.key, existente);
}

function obtenerTotalFormaPago(venta: any): number {
  return Number(venta?.total || 0);
}

function obtenerPagadoVenta(venta: any): number {
  const formaPagoDetalle = venta?.formaPagoDetalle || venta?.formaPago || {};
  return Number(formaPagoDetalle?.totalPagado ?? venta?.total_pagado ?? venta?.total ?? 0);
}

function obtenerDeudaVenta(venta: any): number {
  const formaPagoDetalle = venta?.formaPagoDetalle || venta?.formaPago || {};
  if (formaPagoDetalle?.deudaPendiente !== undefined) {
    return Number(formaPagoDetalle.deudaPendiente || 0);
  }

  return Math.max(0, obtenerTotalFormaPago(venta) - obtenerPagadoVenta(venta));
}

function aplicarConciliacionReal(seccion: any, detalleReal: any[] = []): any {
  const mapa = new Map((Array.isArray(detalleReal) ? detalleReal : []).map((item: any) => [String(item?.destinoKey || item?.destinoLabel || item?.bancoCodigo || item?.banco || '').trim(), item]));

  return {
    ...seccion,
    filas: seccion.filas.map((fila: any) => {
      const match = mapa.get(String(fila.destinoKey || fila.destinoLabel || fila.bancoCodigo || fila.banco || '').trim())
        || mapa.get(String(fila.destinoLabel || '').trim())
        || mapa.get(String(fila.bancoCodigo || '').trim());

      return {
        ...fila,
        real: match ? Number(match.montoReal || 0) : null,
        diferencia: match ? Number(match.diferencia || 0) : null
      };
    })
  };
}

export function encodeCierreCajaPublicToken(payload: CierreCajaPublicTokenPayload): string {
  const json = JSON.stringify({
    sede: String(payload?.sede || '').trim().toLowerCase(),
    fecha: String(payload?.fecha || '').trim()
  });

  const base64 = typeof btoa === 'function'
    ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, 'utf8').toString('base64');

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function buildCierreCajaReportFromResumen(resumen: any): CierreCajaReporteDocumento {
  const cierre = resumen?.cierreExistente;
  if (!cierre) {
    throw new Error('No existe un cierre disponible para generar el reporte.');
  }

  const monedaSistema = normalizarMonedaReporte(resumen?.monedaPrincipal || cierre?.monedaPrincipal);
  const tasasCambio = resumen?.tasasCambio || cierre?.tasasCambio || {};
  const ventas = Array.isArray(resumen?.ventas) ? resumen.ventas : [];
  const abonosDelDia = Array.isArray(resumen?.abonosDelDia) ? resumen.abonosDelDia : [];
  const transaccionesManuales = Array.isArray(resumen?.transaccionesManuales) ? resumen.transaccionesManuales : [];
  const analisisMetodos = crearAnalisisMetodos();
  const transacciones: CierreCajaReporteDocumento['transacciones'] = [];
  const formasPago = {
    contado: { forma: 'Contado', total: 0, deudaPendiente: 0, cantidad: 0 },
    abono: { forma: 'Abono', total: 0, deudaPendiente: 0, cantidad: 0 },
    cashea: { forma: 'Cashea', total: 0, deudaPendiente: 0, cantidad: 0 },
    de_contado_pendiente: { forma: 'De contado pendiente por pago', total: 0, deudaPendiente: 0, cantidad: 0 }
  };

  let totalVentas = 0;
  let totalPendiente = 0;
  let ventasPendientes = 0;

  const registrarMetodo = (metodo: any, signo: number = 1) => {
    const tipo = String(metodo?.tipo || '').trim().toLowerCase();
    const monedaMetodo = metodo?.moneda || monedaSistema;
    const montoSistema = convertirMontoASistema(Number(metodo?.monto || 0), monedaMetodo, monedaSistema, tasasCambio) * signo;

    if (tipo === 'efectivo') {
      analisisMetodos.efectivo.total += montoSistema;
      analisisMetodos.efectivo.cantidad += 1;
      const codigo = normalizarMonedaReporte(monedaMetodo);
      analisisMetodos.efectivo.porMoneda[codigo] += Number(metodo?.monto || 0) * signo;
      return;
    }

    if (tipo === 'punto' || tipo === 'transferencia' || tipo === 'pagomovil' || tipo === 'zelle') {
      acumularMetodoElectronico(analisisMetodos[tipo], metodo, montoSistema);
    }
  };

  ventas.forEach((venta: any) => {
    const totalVenta = obtenerTotalFormaPago(venta);
    const deudaVenta = obtenerDeudaVenta(venta);
    const totalPagado = obtenerPagadoVenta(venta);
    const formaPago = String(venta?.formaPago || '').trim().toLowerCase().replace(/-/g, '_') || 'contado';
    const cliente = venta?.cliente?.informacion?.nombreCompleto || venta?.cliente?.nombre || 'Cliente';
    const usuario = venta?.asesor?.nombre || venta?.auditoria?.usuarioCreacion?.nombre || 'Usuario';
    const metodosDePago = Array.isArray(venta?.metodosDePago) ? venta.metodosDePago : [];

    totalVentas += totalVenta;
    totalPendiente += deudaVenta;
    if (deudaVenta > 0.009) {
      ventasPendientes += 1;
    }

    if (formasPago[formaPago as keyof typeof formasPago]) {
      formasPago[formaPago as keyof typeof formasPago].total += totalVenta;
      formasPago[formaPago as keyof typeof formasPago].deudaPendiente += deudaVenta;
      formasPago[formaPago as keyof typeof formasPago].cantidad += 1;
    }

    metodosDePago.forEach((metodo: any) => registrarMetodo(metodo, 1));

    transacciones.push({
      hora: formatearHoraDocumento(venta?.fecha),
      descripcion: `Venta #${venta?.numero_venta || 'N/A'} - ${cliente}`,
      tipo: formatearTipoTransaccionDocumento('venta'),
      metodo: buildResumenMetodoDocumento(venta),
      monto: convertirMontoASistema(totalPagado, venta?.moneda || monedaSistema, monedaSistema, tasasCambio),
      montoTexto: formatCurrencyWithUnit(convertirMontoASistema(totalPagado, venta?.moneda || monedaSistema, monedaSistema, tasasCambio), monedaSistema),
      usuario,
      numeroVenta: venta?.numero_venta || '',
      cliente
    });
  });

  abonosDelDia.forEach((abono: any) => {
    const metodosDePago = Array.isArray(abono?.metodosDePago) ? abono.metodosDePago : [];
    metodosDePago.forEach((metodo: any) => registrarMetodo(metodo, 1));

    transacciones.push({
      hora: formatearHoraDocumento(abono?.fecha),
      descripcion: `Abono aplicado a venta #${abono?.numeroVenta || 'N/A'}`,
      tipo: formatearTipoTransaccionDocumento('venta'),
      metodo: metodosDePago.length ? metodosDePago.map((item: any) => formatearTipoMetodoPago(item?.tipo)).join(' / ') : 'Abono',
      monto: convertirMontoASistema(Number(abono?.montoAbonado || 0), abono?.moneda || monedaSistema, monedaSistema, tasasCambio),
      montoTexto: formatCurrencyWithUnit(convertirMontoASistema(Number(abono?.montoAbonado || 0), abono?.moneda || monedaSistema, monedaSistema, tasasCambio), monedaSistema),
      usuario: abono?.usuario || abono?.asesor?.nombre || 'Usuario',
      numeroVenta: abono?.numeroVenta || '',
      cliente: abono?.cliente?.nombreCompleto || abono?.cliente?.nombre || ''
    });
  });

  transaccionesManuales.forEach((transaccionManual: any) => {
    registrarMetodo({
      tipo: transaccionManual?.metodoPago,
      monto: transaccionManual?.monto,
      moneda: transaccionManual?.moneda,
      cuentaReceptora: {
        bancoCodigo: transaccionManual?.bancoCodigo,
        bancoNombre: transaccionManual?.banco,
        descripcionCuenta: transaccionManual?.observaciones
      }
    }, String(transaccionManual?.tipo || '').trim().toLowerCase() === 'egreso' ? -1 : 1);

    transacciones.push({
      hora: formatearHoraDocumento(transaccionManual?.fecha),
      descripcion: String(transaccionManual?.descripcion || 'Transaccion manual'),
      tipo: formatearTipoTransaccionDocumento(transaccionManual?.tipo),
      metodo: formatearTipoMetodoPago(transaccionManual?.metodoPago),
      monto: Number(transaccionManual?.montoSistema || 0),
      montoTexto: formatCurrencyWithUnit(Number(transaccionManual?.montoSistema || 0), monedaSistema),
      usuario: transaccionManual?.usuario || 'Usuario'
    });
  });

  transacciones.sort((a, b) => String(b.hora).localeCompare(String(a.hora)));

  const detalleReal = cierre?.detalleCierreReal || {};
  const metodos = [
    {
      tipo: 'efectivo',
      titulo: 'Efectivo por ventas',
      total: Number(analisisMetodos.efectivo.total || 0),
      mostrarConciliacion: false,
      filas: [{
        destino: 'Cobros en caja del dia',
        detalle: 'No incluye el efectivo inicial de apertura.',
        referencia: [
          analisisMetodos.efectivo.porMoneda.USD ? formatCurrencyWithUnit(analisisMetodos.efectivo.porMoneda.USD, 'USD') : null,
          analisisMetodos.efectivo.porMoneda.EUR ? formatCurrencyWithUnit(analisisMetodos.efectivo.porMoneda.EUR, 'EUR') : null,
          analisisMetodos.efectivo.porMoneda.VES ? formatCurrencyWithUnit(analisisMetodos.efectivo.porMoneda.VES, 'VES') : null
        ].filter(Boolean).join(' · ') || 'Sin movimiento en efectivo',
        montoOriginal: [
          analisisMetodos.efectivo.porMoneda.USD ? formatCurrencyWithUnit(analisisMetodos.efectivo.porMoneda.USD, 'USD') : null,
          analisisMetodos.efectivo.porMoneda.EUR ? formatCurrencyWithUnit(analisisMetodos.efectivo.porMoneda.EUR, 'EUR') : null,
          analisisMetodos.efectivo.porMoneda.VES ? formatCurrencyWithUnit(analisisMetodos.efectivo.porMoneda.VES, 'VES') : null
        ].filter(Boolean).join(' · ') || 'Sin movimiento en efectivo',
        sistema: Number(analisisMetodos.efectivo.total || 0),
        real: null,
        diferencia: null,
        operaciones: Number(analisisMetodos.efectivo.cantidad || 0)
      }]
    },
    aplicarConciliacionReal({
      tipo: 'punto',
      titulo: 'Punto de venta',
      total: Array.from(analisisMetodos.punto.values()).reduce((sum, item) => sum + Number(item.sistema || 0), 0),
      filas: Array.from(analisisMetodos.punto.values())
    }, detalleReal?.punto),
    aplicarConciliacionReal({
      tipo: 'transferencia',
      titulo: 'Transferencias',
      total: Array.from(analisisMetodos.transferencia.values()).reduce((sum, item) => sum + Number(item.sistema || 0), 0),
      filas: Array.from(analisisMetodos.transferencia.values())
    }, detalleReal?.transferencia),
    aplicarConciliacionReal({
      tipo: 'pagomovil',
      titulo: 'Pago movil',
      total: Array.from(analisisMetodos.pagomovil.values()).reduce((sum, item) => sum + Number(item.sistema || 0), 0),
      filas: Array.from(analisisMetodos.pagomovil.values())
    }, detalleReal?.pagomovil),
    aplicarConciliacionReal({
      tipo: 'zelle',
      titulo: 'Zelle',
      total: Array.from(analisisMetodos.zelle.values()).reduce((sum, item) => sum + Number(item.sistema || 0), 0),
      filas: Array.from(analisisMetodos.zelle.values())
    }, detalleReal?.zelle)
  ].filter((item) => Number(item?.total || 0) || item?.tipo === 'efectivo');

  const diferenciaPunto = Array.isArray(detalleReal?.punto) ? detalleReal.punto.reduce((sum: number, item: any) => sum + Number(item?.diferencia || 0), 0) : 0;
  const diferenciaTransferencia = Array.isArray(detalleReal?.transferencia) ? detalleReal.transferencia.reduce((sum: number, item: any) => sum + Number(item?.diferencia || 0), 0) : 0;
  const diferenciaPagoMovil = Array.isArray(detalleReal?.pagomovil) ? detalleReal.pagomovil.reduce((sum: number, item: any) => sum + Number(item?.diferencia || 0), 0) : 0;
  const diferenciaZelle = Array.isArray(detalleReal?.zelle) ? detalleReal.zelle.reduce((sum: number, item: any) => sum + Number(item?.diferencia || 0), 0) : 0;

  return {
    sede: String(cierre?.sede || resumen?.sede || '').trim() || 'general',
    direccion: String(cierre?.sede || resumen?.sede || '').trim() || 'general',
    fecha: formatearFechaDocumento(resumen?.fecha || cierre?.fecha),
    fechaArchivo: String(resumen?.fecha || cierre?.fecha || '').trim(),
    generadoEn: formatearFechaHoraDocumento(cierre?.fechaCierre || new Date().toISOString()),
    estado: formatearEstadoDocumento(cierre?.estado),
    monedaSistema,
    mostrarConciliacion: true,
    notaFinal: `Documento generado desde la vista publica del cierre de caja. Los montos del sistema estan expresados en ${getCurrencySymbol(monedaSistema)} (${monedaSistema}).`,
    kpis: [
      { label: 'Efectivo Inicial', value: Number(cierre?.efectivoInicial || 0), format: 'currency' },
      { label: 'Total Ventas', value: Number(totalVentas || resumen?.estadisticas?.totalVentas || 0), format: 'currency' },
      { label: 'Total Pendiente', value: Number(totalPendiente || 0), format: 'currency' },
      { label: 'Neto del Dia', value: Number(cierre?.totales?.neto || 0), format: 'currency' },
      { label: 'Diferencia Total', value: Number(cierre?.diferencia || 0), format: 'currency', clase: Number(cierre?.diferencia || 0) > 0 ? 'positive' : Number(cierre?.diferencia || 0) < 0 ? 'negative' : '' }
    ],
    resumenOperativo: [
      { label: 'Transacciones del dia', value: transacciones.length, format: 'text' },
      { label: 'Ventas pendientes', value: ventasPendientes, format: 'text' },
      { label: 'Egresos registrados', value: Number(cierre?.totales?.egresos || 0), format: 'currency' },
      { label: 'Cobrado e ingresos netos del dia', value: Number(cierre?.totales?.neto || 0), format: 'currency' },
      { label: 'Notas de cierre', value: String(cierre?.notasCierre || 'Sin observaciones'), format: 'text' }
    ],
    conciliacion: [
      { label: 'Efectivo teorico final', value: Number(cierre?.efectivoFinalTeorico || 0), format: 'currency' },
      { label: 'Efectivo real contado', value: Number(cierre?.efectivoFinalReal || 0), format: 'currency' },
      { label: 'Diferencia de efectivo', value: Number(cierre?.efectivoFinalReal || 0) - Number(cierre?.efectivoFinalTeorico || 0), format: 'currency', clase: Number(cierre?.efectivoFinalReal || 0) - Number(cierre?.efectivoFinalTeorico || 0) > 0 ? 'positive' : Number(cierre?.efectivoFinalReal || 0) - Number(cierre?.efectivoFinalTeorico || 0) < 0 ? 'negative' : '' },
      { label: 'Diferencia en punto de venta', value: diferenciaPunto, format: 'currency', clase: diferenciaPunto > 0 ? 'positive' : diferenciaPunto < 0 ? 'negative' : '' },
      { label: 'Diferencia en transferencias', value: diferenciaTransferencia, format: 'currency', clase: diferenciaTransferencia > 0 ? 'positive' : diferenciaTransferencia < 0 ? 'negative' : '' },
      { label: 'Diferencia en pago movil', value: diferenciaPagoMovil, format: 'currency', clase: diferenciaPagoMovil > 0 ? 'positive' : diferenciaPagoMovil < 0 ? 'negative' : '' },
      { label: 'Diferencia en Zelle', value: diferenciaZelle, format: 'currency', clase: diferenciaZelle > 0 ? 'positive' : diferenciaZelle < 0 ? 'negative' : '' },
      { label: 'Diferencia total conciliada', value: Number(cierre?.diferencia || 0), format: 'currency', clase: Number(cierre?.diferencia || 0) > 0 ? 'positive' : Number(cierre?.diferencia || 0) < 0 ? 'negative' : '' },
      { label: 'Usuario apertura', value: String(cierre?.usuarioApertura || 'N/A'), format: 'text' },
      { label: 'Usuario cierre', value: String(cierre?.usuarioCierre || 'N/A'), format: 'text' }
    ],
    efectivoPorMoneda: [
      { moneda: 'USD', inicial: Number(cierre?.efectivoInicialDetalle?.USD || 0), esperado: Number(cierre?.efectivoInicialDetalle?.USD || 0) + Number(analisisMetodos.efectivo.porMoneda.USD || 0), real: Number(detalleReal?.efectivo?.usd || 0) },
      { moneda: 'EUR', inicial: Number(cierre?.efectivoInicialDetalle?.EUR || 0), esperado: Number(cierre?.efectivoInicialDetalle?.EUR || 0) + Number(analisisMetodos.efectivo.porMoneda.EUR || 0), real: Number(detalleReal?.efectivo?.eur || 0) },
      { moneda: 'VES', inicial: Number(cierre?.efectivoInicialDetalle?.Bs || 0), esperado: Number(cierre?.efectivoInicialDetalle?.Bs || 0) + Number(analisisMetodos.efectivo.porMoneda.VES || 0), real: Number(detalleReal?.efectivo?.ves || 0) }
    ],
    formasPago: [
      formasPago.contado,
      formasPago.abono,
      formasPago.cashea,
      formasPago.de_contado_pendiente
    ],
    metodos,
    totalMetodos: metodos.reduce((sum, item) => sum + Number(item?.total || 0), 0),
    notaMetodos: 'Incluye efectivo cobrado del dia y metodos electronicos. No incluye efectivo inicial de apertura.',
    transacciones
  };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  const chunkSize = 32768;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  const base64 = typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(bytes).toString('base64');

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = typeof atob === 'function'
    ? atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function comprimirTexto(texto: string): Promise<Uint8Array> {
  const source = new TextEncoder().encode(texto);

  if (typeof CompressionStream !== 'function') {
    return source;
  }

  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  await writer.write(source);
  await writer.close();
  const buffer = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(buffer);
}

async function descomprimirTexto(bytes: Uint8Array, comprimido: boolean): Promise<string> {
  if (!comprimido || typeof DecompressionStream !== 'function') {
    return new TextDecoder().decode(bytes);
  }

  const stream = new DecompressionStream('gzip');
  const writer = stream.writable.getWriter();
  await writer.write(bytes);
  await writer.close();
  const buffer = await new Response(stream.readable).arrayBuffer();
  return new TextDecoder().decode(buffer);
}

export async function encodeCierreCajaReport(reporte: CierreCajaReporteDocumento): Promise<string> {
  const json = JSON.stringify(reporte);
  const compressed = await comprimirTexto(json);
  const usaCompresion = typeof CompressionStream === 'function';
  return `${usaCompresion ? 'gz' : 'b64'}:${bytesToBase64Url(compressed)}`;
}

export async function decodeCierreCajaReport(payload: string): Promise<CierreCajaReporteDocumento> {
  const [prefix, encoded] = String(payload || '').split(':', 2);
  if (!encoded || !prefix) {
    throw new Error('Payload de reporte inválido.');
  }

  const bytes = base64UrlToBytes(encoded);
  const json = await descomprimirTexto(bytes, prefix === 'gz');
  return JSON.parse(json) as CierreCajaReporteDocumento;
}