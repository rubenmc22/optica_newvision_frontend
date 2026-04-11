export type ReceiptViewMode = 'preview' | 'print' | 'pdf';

type ReceiptContactInfo = {
  nombre?: string;
  direccion?: string;
  telefono?: string;
  rif?: string;
  email?: string;
};

type ReceiptRenderOptions = {
  datos: any;
  vista?: ReceiptViewMode;
  tituloRecibo: string;
  mensajeFinal: string;
  formatearMoneda: (monto: number | null | undefined, moneda?: string) => string;
  formatearTipoPago: (tipo: string) => string;
  obtenerNombreNivelCashea: (nivel: string) => string;
  contacto?: ReceiptContactInfo;
};

function tomarTextoRecibo(...valores: any[]): string {
  for (const valor of valores) {
    const texto = String(valor ?? '').trim();
    if (texto) {
      return texto;
    }
  }

  return '';
}

function escaparHTML(valor: any): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatearFechaMetodo(fecha: any): string {
  if (!fecha) return '';
  const fechaObj = new Date(fecha);
  if (Number.isNaN(fechaObj.getTime())) return '';

  return fechaObj.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function normalizarMonedaRecibo(moneda: any): string {
  switch (String(moneda ?? '').trim().toLowerCase()) {
    case 'usd':
    case '$':
    case 'dolar':
      return 'dolar';
    case 'eur':
    case 'euro':
    case '€':
      return 'euro';
    case 'ves':
    case 'bs':
    case 'bs.':
    case 'bolivar':
      return 'bolivar';
    default:
      return String(moneda ?? '').trim().toLowerCase();
  }
}

function obtenerMonedaOriginalMetodo(metodo: any, monedaVenta?: string): string {
  return normalizarMonedaRecibo(
    metodo?.moneda
    ?? metodo?.moneda_id
    ?? metodo?.monedaOriginal
    ?? monedaVenta
  ) || 'dolar';
}

function obtenerMontoVisibleMetodo(metodo: any): number {
  const valor = metodo?.monto
    ?? metodo?.montoOriginal
    ?? metodo?.monto_en_moneda_original
    ?? metodo?.montoEnMonedaOriginal
    ?? metodo?.monto_en_moneda_de_venta
    ?? metodo?.montoEnSistema
    ?? metodo?.montoEnMonedaSistema
    ?? metodo?.montoEnMonedaVenta;
  const monto = Number(valor ?? 0);
  return Number.isFinite(monto) ? monto : 0;
}

function obtenerMonedaVisibleMetodo(metodo: any, monedaVenta?: string): string {
  return obtenerMonedaOriginalMetodo(metodo, monedaVenta);
}

function obtenerMontoBolivarMetodo(metodo: any): number | null {
  const valor = metodo?.montoEnBolivar ?? metodo?.monto_en_bolivar ?? metodo?.montoEnBolivares;
  const monto = Number(valor);
  return Number.isFinite(monto) ? monto : null;
}

function debeMostrarReferenciaBolivarMetodo(metodo: any, monedaVenta?: string): boolean {
  const monedaOriginal = obtenerMonedaOriginalMetodo(metodo, monedaVenta);
  return monedaOriginal !== 'bolivar' && obtenerMontoBolivarMetodo(metodo) !== null;
}

export function generateUnifiedReceiptHTML(options: ReceiptRenderOptions): string {
  const {
    datos,
    vista = 'preview',
    tituloRecibo,
    mensajeFinal,
    formatearMoneda,
    formatearTipoPago,
    obtenerNombreNivelCashea,
    contacto
  } = options;

  const esVistaPrevia = vista === 'preview';
  const esExportacion = vista === 'print' || vista === 'pdf';
  const formaPago = datos?.configuracion?.formaPago || 'contado';
  const metodosPago = Array.isArray(datos?.metodosPago) ? datos.metodosPago : [];
  const totalVenta = Number(datos?.totales?.total || 0);
  const totalPagado = Number(datos?.totales?.totalPagado || 0);
  const deudaPendiente = formaPago === 'cashea'
    ? Number(datos?.cashea?.deudaPendiente || Math.max(0, totalVenta - totalPagado))
    : formaPago === 'abono'
      ? Number(datos?.abono?.deudaPendiente || Math.max(0, totalVenta - totalPagado))
      : Number(Math.max(0, totalVenta - totalPagado));
  const porcentajePagado = totalVenta > 0
    ? Math.max(0, Math.min(100, Math.round((totalPagado / totalVenta) * 100)))
    : 0;
  const cuotasPendientesCashea = formaPago === 'cashea' && datos?.cashea
    ? Math.max(0, Number(datos.cashea.cantidadCuotas || 0) - Number(datos.cashea.cuotasAdelantadas || 0))
    : 0;

  const contactoSede = datos?.sede || {};
  const contactoOptica = {
    nombre: tomarTextoRecibo(contacto?.nombre, contactoSede?.nombre, contactoSede?.nombre_optica, 'NEW VISION LENS'),
    direccion: tomarTextoRecibo(contacto?.direccion, contactoSede?.direccion, 'C.C. Candelaria, Local PB-04, Guarenas'),
    telefono: tomarTextoRecibo(contacto?.telefono, contactoSede?.telefono, '0212-365-39-42'),
    rif: tomarTextoRecibo(contacto?.rif, contactoSede?.rif, 'J-123456789'),
    email: tomarTextoRecibo(contacto?.email, contactoSede?.email, 'newvisionlens2020@gmail.com')
  };

  const configModoPago = (() => {
    switch (formaPago) {
      case 'abono':
        return {
          badge: 'Abono parcial',
          theme: 'theme-abono',
          resumenTitulo: 'Control de abonos',
          resumenTexto: 'Saldo parcial pendiente.',
          estado: deudaPendiente > 0 ? 'Saldo abierto' : 'Liquidado'
        };
      case 'cashea':
        return {
          badge: 'Plan Cashea',
          theme: 'theme-cashea',
          resumenTitulo: 'Resumen del plan',
          resumenTexto: 'Plan activo con cuotas pendientes.',
          estado: deudaPendiente > 0 ? 'Plan activo' : 'Plan solvente'
        };
      case 'de_contado-pendiente':
        return {
          badge: 'Contado pendiente',
          theme: 'theme-pendiente',
          resumenTitulo: 'Venta por cobrar',
          resumenTexto: 'Venta registrada sin pago inicial.',
          estado: deudaPendiente > 0 ? 'Por cobrar' : 'Liquidado'
        };
      default:
        return {
          badge: 'Contado',
          theme: 'theme-contado',
          resumenTitulo: 'Pago completado',
          resumenTexto: 'Pago completo confirmado.',
          estado: 'Liquidado'
        };
    }
  })();

  const crearMetricaHTML = (label: string, valor: string, caption = '', tone = 'neutral') => `
      <div class="metric-card ${tone}">
        <span class="metric-label">${escaparHTML(label)}</span>
        <strong class="metric-value">${valor}</strong>
        ${caption ? `<small class="metric-caption">${escaparHTML(caption)}</small>` : ''}
      </div>
    `;

  const generarMetodosPagoHTML = () => {
    if (!metodosPago.length) {
      return '';
    }

    return `
        <div class="section-card subtle-card compact-card page-break-avoid">
          <div class="section-head compact">
            <div>
              <span class="section-kicker">Cobro</span>
              <h3 class="section-title">Metodos registrados</h3>
            </div>
          </div>
          <div class="payment-list compact-list">
            ${metodosPago.map((metodo: any, index: number) => {
              const montoVisible = obtenerMontoVisibleMetodo(metodo);
              const monedaVisible = obtenerMonedaVisibleMetodo(metodo, datos?.configuracion?.moneda);
              const referenciaBolivar = debeMostrarReferenciaBolivarMetodo(metodo, datos?.configuracion?.moneda)
                ? formatearMoneda(obtenerMontoBolivarMetodo(metodo), 'bolivar')
                : '';
              const detalles = [
                metodo.referencia ? `Ref. ${escaparHTML(metodo.referencia)}` : '',
                metodo.banco || metodo.bancoEmisor ? escaparHTML(metodo.banco || metodo.bancoEmisor) : '',
                metodo.bancoReceptor ? `Receptor: ${escaparHTML(metodo.bancoReceptor)}` : '',
                metodo.notaPago ? escaparHTML(metodo.notaPago) : '',
                formatearFechaMetodo(metodo.fechaRegistro)
              ].filter(Boolean);

              return `
                <div class="payment-item">
                  <div class="payment-topline">
                    <div class="payment-main">
                      <span class="payment-pill">${escaparHTML(formatearTipoPago(metodo.tipo))}</span>
                      <strong class="payment-amount">${formatearMoneda(montoVisible, monedaVisible)}</strong>
                    </div>
                    <span class="payment-index">#${index + 1}</span>
                  </div>
                  ${referenciaBolivar ? `<div class="payment-secondary">Equiv.: ${referenciaBolivar}</div>` : ''}
                  ${detalles.length > 0 ? `<div class="payment-meta">${detalles.join(' <span class="meta-dot">&#8226;</span> ')}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
  };

  const generarContadoHTML = () => formaPago === 'contado' ? generarMetodosPagoHTML() : '';

  const generarContadoPendienteHTML = () => {
    if (formaPago !== 'de_contado-pendiente') return '';

    return `
        <div class="section-card payment-overview ${configModoPago.theme} compact-card page-break-avoid">
          <div class="section-head">
            <div>
              <span class="section-kicker">Resumen de cobro</span>
              <h3 class="section-title">${configModoPago.resumenTitulo}</h3>
              <p class="section-copy">${configModoPago.resumenTexto}</p>
            </div>
            <span class="mode-badge ${configModoPago.theme}">${configModoPago.badge}</span>
          </div>
          <div class="metric-grid metric-grid-3 compact-metrics">
            ${crearMetricaHTML('Total', formatearMoneda(totalVenta, datos?.configuracion?.moneda), '', 'info')}
            ${crearMetricaHTML('Pagado', formatearMoneda(totalPagado, datos?.configuracion?.moneda), '', 'neutral')}
            ${crearMetricaHTML('Deuda', formatearMoneda(deudaPendiente, datos?.configuracion?.moneda), '', 'warning')}
          </div>
        </div>

        ${generarMetodosPagoHTML()}
      `;
  };

  const generarCasheaHTML = () => {
    if (formaPago !== 'cashea' || !datos?.cashea) return '';

    return `
        <div class="section-card payment-overview ${configModoPago.theme} compact-card page-break-avoid">
          <div class="section-head">
            <div>
              <span class="section-kicker">Resumen de pago</span>
              <h3 class="section-title">${configModoPago.resumenTitulo}</h3>
              <p class="section-copy">${configModoPago.resumenTexto}</p>
            </div>
            <span class="mode-badge ${configModoPago.theme}">${configModoPago.badge}</span>
          </div>
          <div class="metric-grid metric-grid-4">
            ${crearMetricaHTML('Nivel', escaparHTML(obtenerNombreNivelCashea(datos.cashea.nivel)), '', 'info')}
            ${crearMetricaHTML('Pagado ahora', formatearMoneda(totalPagado, datos?.configuracion?.moneda), '', 'success')}
            ${crearMetricaHTML('Cuotas pendientes', String(cuotasPendientesCashea), `${formatearMoneda(datos.cashea.montoPorCuota, datos?.configuracion?.moneda)} c/u`, 'neutral')}
            ${crearMetricaHTML('Deuda', formatearMoneda(deudaPendiente, datos?.configuracion?.moneda), '', 'warning')}
          </div>
          <div class="plan-inline-grid compact-inline-grid">
            <div class="plan-inline-item">
              <span class="plan-inline-label">Pago inicial</span>
              <strong class="plan-inline-value">${formatearMoneda(datos.cashea.inicial, datos?.configuracion?.moneda)}</strong>
            </div>
            <div class="plan-inline-item">
              <span class="plan-inline-label">Cuotas adelantadas</span>
              <strong class="plan-inline-value">${Number(datos.cashea.cuotasAdelantadas || 0)} por ${formatearMoneda(datos.cashea.montoAdelantado || 0, datos?.configuracion?.moneda)}</strong>
            </div>
            <div class="plan-inline-item">
              <span class="plan-inline-label">Estado del plan</span>
              <strong class="plan-inline-value">${escaparHTML(configModoPago.estado)}</strong>
            </div>
          </div>
        </div>

        ${generarMetodosPagoHTML()}
      `;
  };

  const generarHistorialAbonos = () => {
    const abonos = Array.isArray(datos?.abono?.abonos) && datos.abono.abonos.length > 0
      ? datos.abono.abonos.map((abono: any, index: number) => ({
        numeroPago: abono.numero || index + 1,
        fechaFormateada: abono.fecha || `${datos?.fecha || ''} ${datos?.hora || ''}`.trim(),
        montoAbonado: Number(abono.monto || 0),
        metodosDetalle: metodosPago.map((metodo: any) => ({
          tipo: metodo.tipo,
          monto: metodo.monto,
          montoEnSistema: metodo.montoEnSistema ?? metodo.montoEnMonedaSistema ?? metodo.monto_en_moneda_de_venta,
          montoEnBolivar: metodo.montoEnBolivar ?? metodo.monto_en_bolivar ?? metodo.montoEnBolivares,
          moneda: metodo.moneda,
          monedaSistema: metodo.monedaSistema,
          referencia: metodo.referencia,
          banco: metodo.banco || metodo.bancoEmisor
        }))
      }))
      : totalPagado > 0
        ? [{
          numeroPago: 1,
          fechaFormateada: `${datos?.fecha || ''} ${datos?.hora || ''}`.trim(),
          montoAbonado: totalPagado,
          metodosDetalle: metodosPago.map((metodo: any) => ({
            tipo: metodo.tipo,
            monto: metodo.monto,
            montoEnSistema: metodo.montoEnSistema ?? metodo.montoEnMonedaSistema ?? metodo.monto_en_moneda_de_venta,
            montoEnBolivar: metodo.montoEnBolivar ?? metodo.monto_en_bolivar ?? metodo.montoEnBolivares,
            moneda: metodo.moneda,
            monedaSistema: metodo.monedaSistema,
            referencia: metodo.referencia,
            banco: metodo.banco || metodo.bancoEmisor
          }))
        }]
        : [];

    if (!abonos.length) {
      return '<div class="empty-note">Aun no hay abonos registrados para esta venta.</div>';
    }

    const totalAbonado = abonos.reduce((acumulado: number, abono: any) => acumulado + Number(abono.montoAbonado || 0), 0);

    return `
            <div class="history-table-wrap">
              <table class="history-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Fecha</th>
                    <th>Metodos utilizados</th>
                    <th class="text-end">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  ${abonos.map((abono: any) => `
                    <tr>
                      <td><span class="history-badge">${escaparHTML(abono.numeroPago)}</span></td>
                      <td>${escaparHTML(abono.fechaFormateada)}</td>
                      <td>
                        <div class="history-methods">
                          ${Array.isArray(abono.metodosDetalle) ? abono.metodosDetalle.map((metodo: any) => {
      const montoVisible = obtenerMontoVisibleMetodo(metodo);
      const monedaVisible = obtenerMonedaVisibleMetodo(metodo, datos?.configuracion?.moneda);
      const referenciaBolivar = debeMostrarReferenciaBolivarMetodo(metodo, datos?.configuracion?.moneda)
        ? `Equiv.: ${formatearMoneda(obtenerMontoBolivarMetodo(metodo), 'bolivar')}`
        : '';
      const metodoDetalle = [
        escaparHTML(formatearTipoPago(metodo.tipo)),
        formatearMoneda(montoVisible, monedaVisible),
        referenciaBolivar,
        metodo.referencia ? `Ref. ${escaparHTML(metodo.referencia)}` : '',
        metodo.banco ? escaparHTML(metodo.banco) : ''
      ].filter(Boolean).join(' <span class="meta-dot">&#8226;</span> ');

      return `<div class="history-method-item">${metodoDetalle ? `<small>${metodoDetalle}</small>` : ''}</div>`;
    }).join('') : ''}
                        </div>
                      </td>
                      <td class="text-end fw-strong">${formatearMoneda(abono.montoAbonado, datos?.configuracion?.moneda)}</td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3">Total abonado</td>
                    <td class="text-end">${formatearMoneda(totalAbonado, datos?.configuracion?.moneda)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
    `;
  };

  const generarAbonoHTML = () => {
    if (formaPago !== 'abono' || !datos?.abono) return '';

    return `
        <div class="section-card payment-overview ${configModoPago.theme} compact-card page-break-avoid">
          <div class="section-head">
            <div>
              <span class="section-kicker">Resumen de pago</span>
              <h3 class="section-title">${configModoPago.resumenTitulo}</h3>
              <p class="section-copy">${configModoPago.resumenTexto}</p>
            </div>
            <span class="mode-badge ${configModoPago.theme}">${configModoPago.badge}</span>
          </div>
          <div class="metric-grid-abono compact-metrics">
            ${crearMetricaHTML('Total', formatearMoneda(totalVenta, datos?.configuracion?.moneda), '', 'info')}
            ${crearMetricaHTML('Abonado', formatearMoneda(totalPagado, datos?.configuracion?.moneda), '', 'success')}
            ${crearMetricaHTML('Deuda', formatearMoneda(deudaPendiente, datos?.configuracion?.moneda), '', 'warning')}
            <div class="metric-card progress-wide neutral">
              <div class="progress-card-head">
                <span class="metric-label">Progreso</span>
                <strong class="metric-value">${Number(datos.abono.porcentajePagado || porcentajePagado)}%</strong>
              </div>
              <div class="progress-shell compact-progress-shell">
                <div class="progress-track">
                  <span class="progress-fill" style="width: ${Math.max(0, Math.min(100, Number(datos.abono.porcentajePagado || porcentajePagado)))}%;"></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="section-card subtle-card compact-card page-break-avoid">
          <div class="section-head compact">
            <div>
              <span class="section-kicker">Seguimiento</span>
              <h3 class="section-title">Historial de abonos</h3>
            </div>
          </div>
          ${generarHistorialAbonos()}
        </div>
      `;
  };

  const seccionResumenHTML = formaPago === 'contado' ? generarContadoHTML()
    : formaPago === 'de_contado-pendiente' ? generarContadoPendienteHTML()
      : formaPago === 'cashea' ? generarCasheaHTML()
        : formaPago === 'abono' ? generarAbonoHTML()
          : generarMetodosPagoHTML();

  const mostrarTotalAPagar = formaPago === 'abono' || formaPago === 'cashea';
  const textoTotalAPagar = formaPago === 'abono' ? 'TOTAL A PAGAR' : formaPago === 'cashea' ? 'TOTAL DEL PLAN' : 'TOTAL';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recibo - ${escaparHTML(datos?.numeroVenta)}</title>
    <style>
        @page { margin: 12mm; size: A4; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scrollbar-gutter: stable; scrollbar-width: thin; scrollbar-color: #7eaed2 #eef4f8; }
        body {
          font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
          color: #17324d;
          background: ${esVistaPrevia ? 'transparent' : esExportacion ? '#ffffff' : '#eef3f8'};
          padding: ${esVistaPrevia || esExportacion ? '0' : '16px'};
          scrollbar-width: thin;
          scrollbar-color: #7eaed2 #eef4f8;
        }
        body::-webkit-scrollbar { width: 10px; }
        body::-webkit-scrollbar-track { background: linear-gradient(180deg, #f4f8fb 0%, #ecf2f7 100%); border-radius: 999px; }
        body::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #9fc3de 0%, #4e83ae 100%); border-radius: 999px; border: 2px solid #eef4f8; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35); }
        body::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #8bb5d5 0%, #3f729c 100%); }
        .recibo-page { width: 100%; max-width: 820px; margin: 0 auto; }
        .recibo-container { width: 100%; background: ${esVistaPrevia ? 'transparent' : '#ffffff'}; border-radius: ${esVistaPrevia || esExportacion ? '0' : '24px'}; padding: ${esVistaPrevia || esExportacion ? '0' : '18px'}; box-shadow: ${esVistaPrevia || esExportacion ? 'none' : '0 18px 44px rgba(21, 45, 73, 0.12)'}; border: ${esVistaPrevia || esExportacion ? 'none' : '1px solid #dde7f1'}; }
        .recibo-header { background: linear-gradient(135deg, #163c63 0%, #275f8d 55%, #6bb0d8 100%); border-radius: 20px; padding: 16px 18px; color: #ffffff; display: grid; grid-template-columns: 1.7fr 1fr; gap: 14px; align-items: end; margin-bottom: 12px; }
        .brand-kicker { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.84; margin-bottom: 8px; }
        .empresa-nombre { font-size: 22px; font-weight: 800; letter-spacing: 0.04em; margin-bottom: 4px; }
        .empresa-tagline { font-size: 11px; opacity: 0.92; max-width: 420px; }
        .header-aside { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
        .header-badge { display: inline-flex; align-items: center; justify-content: center; padding: 8px 14px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.22); backdrop-filter: blur(6px); }
        .receipt-number-block { width: 100%; max-width: 220px; background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 16px; padding: 10px 12px; text-align: right; }
        .receipt-number-label { display: block; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.75; margin-bottom: 4px; }
        .receipt-number-value { display: block; font-size: 19px; font-weight: 800; }
        .empresa-info { font-size: 11px; color: rgba(255,255,255,0.88); line-height: 1.35; }
        .header-contact { display: flex; justify-content: space-between; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
        .meta-grid,.client-grid,.metric-grid,.totals-layout { display: grid; gap: 10px; }
        .meta-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 10px; }
        .client-grid { grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); }
        .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .metric-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .metric-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .metric-grid-abono { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .meta-card,.metric-card,.client-item,.plan-inline-item { background: #f8fbfd; border: 1px solid #dbe7f0; border-radius: 14px; padding: 10px 12px; position: relative; overflow: hidden; isolation: isolate; }
        .meta-card::before,.metric-card::before,.client-item::before,.plan-inline-item::before,.payment-item::before,.totals-breakdown::before,.section-card::before,.history-table-wrap::before { content: ''; position: absolute; inset: 1px; border-radius: inherit; background: linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(246,250,253,0.78) 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.85); z-index: 0; }
        .meta-card > *, .metric-card > *, .client-item > *, .plan-inline-item > *, .payment-item > *, .totals-breakdown > *, .section-card > *, .history-table-wrap > * { position: relative; z-index: 1; }
        .meta-card.compact-pair,.client-item.compact-pair { padding: 9px 12px; }
        .meta-pair { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: stretch; gap: 10px; }
        .meta-pair-item { min-width: 0; display: flex; flex-direction: column; justify-content: center; min-height: 46px; }
        .meta-pair-divider { width: 1px; align-self: stretch; background: linear-gradient(180deg, rgba(210,223,235,0) 0%, rgba(210,223,235,0.95) 22%, rgba(210,223,235,0.95) 78%, rgba(210,223,235,0) 100%); }
        .meta-label,.client-label,.metric-label,.plan-inline-label { display:block; font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#66809a; margin-bottom:4px; }
        .meta-value,.client-value,.metric-value,.plan-inline-value { display:block; font-size:13px; font-weight:700; color:#17324d; line-height:1.25; }
        .metric-value { font-size: 16px; }
        .metric-caption { display:block; margin-top:2px; font-size:10px; color:#6f8598; line-height:1.3; }
        .metric-card.success { background: linear-gradient(135deg, #f5fbf7 0%, #eaf8ee 100%); border-color: #cfe9d8; }
        .metric-card.warning { background: linear-gradient(135deg, #fff9ee 0%, #fff3d9 100%); border-color: #f1deb1; }
        .metric-card.info { background: linear-gradient(135deg, #f4f9ff 0%, #e9f2fb 100%); border-color: #cfe1f2; }
        .section-card { background:#ffffff; border:1px solid #dde7f1; border-radius:18px; padding:12px 14px; margin-bottom:9px; position:relative; overflow:hidden; isolation:isolate; box-shadow:0 10px 22px rgba(18, 37, 58, 0.04); }
        .compact-card { padding: 11px 13px; }
        .subtle-card { background: #fbfdff; }
        .payment-overview.theme-contado { background: linear-gradient(135deg, #f5fbf7 0%, #f9fcff 100%); }
        .payment-overview.theme-abono { background: linear-gradient(135deg, #fffbf3 0%, #fffdf8 100%); }
        .payment-overview.theme-cashea { background: linear-gradient(135deg, #f4fcff 0%, #fbfeff 100%); }
        .payment-overview.theme-pendiente { background: linear-gradient(135deg, #fff6f2 0%, #fffdfb 100%); }
        .section-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:8px; }
        .section-kicker { display:inline-block; font-size:10px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:#6b86a0; margin-bottom:4px; }
        .section-title { font-size:15px; line-height:1.2; font-weight:800; color:#17324d; }
        .section-copy { margin-top:4px; color:#69829a; font-size:10px; line-height:1.35; max-width:520px; }
        .mode-badge { flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; min-width:124px; padding:7px 11px; border-radius:999px; font-size:10px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; border:1px solid transparent; }
        .mode-badge.theme-contado { background:#e9f7ef; color:#19704a; border-color:#cbe8d7; }
        .mode-badge.theme-abono { background:#fff4d9; color:#8f6500; border-color:#f1dc9b; }
        .mode-badge.theme-cashea { background:#dcf7ff; color:#0f6f8c; border-color:#bfe7f2; }
        .mode-badge.theme-pendiente { background:#ffe8e0; color:#9a4a28; border-color:#f0cbbd; }
        .tabla-productos,.history-table { width:100%; border-collapse:collapse; font-size:11px; }
        .tabla-productos th,.history-table th { padding:9px 8px; text-align:left; font-size:9px; letter-spacing:0.12em; text-transform:uppercase; color:#69829a; border-bottom:1px solid #d8e3ed; }
        .tabla-productos td,.history-table td { border-bottom:1px solid #edf2f7; padding:8px 8px; vertical-align:middle; font-size:11px; }
        .product-name { font-weight:700; color:#17324d; }
        .service-tag,.payment-pill,.history-badge { display:inline-flex; align-items:center; justify-content:center; padding:3px 7px; border-radius:999px; font-size:9px; font-weight:700; letter-spacing:0.04em; }
        .service-tag { background:#eaf3fb; color:#205b84; margin-left:6px; }
        .payment-pill,.history-badge { background:#edf4fb; color:#22567d; }
        .text-center{text-align:center;} .text-end{text-align:right;} .fw-strong{font-weight:800;}
        .payment-list { display:grid; gap:8px; } .compact-list { gap:6px; }
        .payment-item { padding:9px 11px; border:1px solid #dde7f1; border-radius:14px; background:#ffffff; position:relative; overflow:hidden; isolation:isolate; }
        .payment-topline,.payment-main { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
        .payment-main { justify-content:flex-start; }
        .payment-amount { font-size:13px; font-weight:800; color:#17324d; }
        .payment-secondary { margin-top:4px; font-size:10px; font-weight:700; color:#567795; }
        .payment-index { font-size:9px; color:#7b91a6; font-weight:700; letter-spacing:0.08em; }
        .payment-meta,.history-method-item small,.empty-note { color:#70869b; font-size:10px; line-height:1.35; }
        .payment-meta { margin-top:5px; } .meta-dot { display:inline-block; margin:0 6px; color:#a2b3c3; }
        .plan-inline-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px; margin-top:8px; }
        .progress-shell { margin-top:8px; } .progress-track { height:6px; background:#e8eef5; border-radius:999px; overflow:hidden; }
        .progress-fill { display:block; height:100%; border-radius:999px; background:linear-gradient(90deg, #2a77b6 0%, #58c296 100%); }
        .history-methods { display:grid; gap:4px; } .history-table-wrap { overflow:hidden; border-radius:14px; border:1px solid #dde7f1; position:relative; isolation:isolate; }
        .history-table thead,.tabla-productos thead { background:#f8fbfd; }
        .history-table tfoot td { background:#edf6f0; font-weight:800; color:#19704a; border-top:1px solid #d6e9dd; }
        .totals-layout { grid-template-columns:minmax(0, 1fr) 220px; align-items:stretch; }
        .totals-breakdown { border:1px solid #dde7f1; border-radius:14px; padding:7px 11px; background:#fbfdff; position:relative; overflow:hidden; isolation:isolate; }
        .total-row { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:7px 0; border-bottom:1px solid #edf2f7; font-size:12px; color:#5c748a; }
        .total-row:last-child { border-bottom:none; } .total-row strong { color:#17324d; font-size:12px; } .total-row.danger strong { color:#b55454; }
        .highlight-card { border-radius:16px; padding:12px 14px; border:1px solid #dce6f1; background:linear-gradient(135deg, #173c63 0%, #2d658f 55%, #75afd0 100%); color:#ffffff; min-height:88px; }
        .highlight-card .metric-label,.highlight-card .metric-caption { color:rgba(255,255,255,0.8); }
        .highlight-card .metric-value { color:#ffffff; font-size:22px; }
        .note-card { background:linear-gradient(135deg, #fff7df 0%, #fffdf4 100%); border:1px solid #f0dfaa; color:#7a6221; }
        .footer-band { display:flex; justify-content:space-between; gap:12px; padding-top:4px; margin-top:6px; font-size:10px; color:#6a8095; }
        .message-card { margin-top:8px; border-radius:14px; padding:10px 12px; background:linear-gradient(135deg, #edf6ff 0%, #f7fbff 100%); border:1px solid #d7e7f6; color:#224e72; font-size:11px; font-weight:600; }
        .page-break-avoid { page-break-inside: avoid; break-inside: avoid; }
        .metric-card.progress-wide { grid-column: 1 / -1; padding: 9px 12px; }
        .progress-card-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
        @media (max-width: 768px) {
          body { padding: 10px; }
          .recibo-page { max-width: none; }
          .recibo-container { border-radius:18px; padding:12px; }
          .recibo-header,.plan-inline-grid,.totals-layout { grid-template-columns:1fr; }
          .header-aside { align-items:flex-start; }
          .receipt-number-block { text-align:left; max-width:none; }
          .section-head { flex-direction:column; }
          .metric-grid-3 { grid-template-columns:repeat(3, minmax(0, 1fr)); }
          .metric-grid-4 { grid-template-columns:repeat(4, minmax(0, 1fr)); }
          .metric-grid-abono { grid-template-columns:repeat(3, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .meta-grid,.client-grid { grid-template-columns:1fr; }
          .meta-pair { grid-template-columns:1fr; gap:8px; }
          .meta-pair-divider { display:none; }
        }
        @media (max-width: 560px) {
          .metric-grid-3,.metric-grid-4,.metric-grid-abono { grid-template-columns:1fr; }
        }
        @media print {
          body { background:#ffffff; padding:0; margin:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
          .recibo-page { max-width:none; margin:0; }
          .recibo-container { border:none; box-shadow:none; padding:0; border-radius:0; }
        }
    </style>
</head>
<body>
  <div class="recibo-page">
    <div class="recibo-container page-break-avoid">
      <div class="recibo-header page-break-avoid">
        <div>
          <span class="brand-kicker">${escaparHTML(contactoOptica.nombre)}</span>
          <div class="empresa-nombre">${escaparHTML(tituloRecibo)}</div>
          <div class="empresa-tagline">Comprobante de venta y pago.</div>
          <div class="header-contact">
            <div class="empresa-info">${escaparHTML(contactoOptica.direccion)}</div>
            <div class="empresa-info">Tel: ${escaparHTML(contactoOptica.telefono)}</div>
            <div class="empresa-info">RIF: ${escaparHTML(contactoOptica.rif)}</div>
            <div class="empresa-info">${escaparHTML(contactoOptica.email)}</div>
          </div>
        </div>
        <div class="header-aside">
          <span class="header-badge">${escaparHTML(configModoPago.badge)}</span>
          <div class="receipt-number-block">
            <span class="receipt-number-label">Numero de recibo</span>
            <span class="receipt-number-value">${escaparHTML(datos?.numeroVenta)}</span>
          </div>
        </div>
      </div>

      <div class="meta-grid page-break-avoid">
        <div class="meta-card compact-pair">
          <div class="meta-pair">
            <div class="meta-pair-item"><span class="meta-label">Fecha</span><span class="meta-value">${escaparHTML(datos?.fecha)}</span></div>
            <span class="meta-pair-divider"></span>
            <div class="meta-pair-item"><span class="meta-label">Hora</span><span class="meta-value">${escaparHTML(datos?.hora)}</span></div>
          </div>
        </div>
        <div class="meta-card compact-pair">
          <div class="meta-pair">
            <div class="meta-pair-item"><span class="meta-label">Asesor</span><span class="meta-value">${escaparHTML(datos?.vendedor)}</span></div>
            <span class="meta-pair-divider"></span>
            <div class="meta-pair-item"><span class="meta-label">Estado</span><span class="meta-value">${escaparHTML(configModoPago.estado)}</span></div>
          </div>
        </div>
      </div>

      <div class="section-card page-break-avoid">
        <div class="section-head compact"><div><span class="section-kicker">Cliente</span><h3 class="section-title">Datos del comprador</h3></div></div>
        <div class="client-grid">
          <div class="client-item"><span class="client-label">Nombre</span><span class="client-value">${escaparHTML(datos?.cliente?.nombre)}</span></div>
          <div class="client-item compact-pair">
            <div class="meta-pair">
              <div class="meta-pair-item"><span class="client-label">Cedula</span><span class="client-value">${escaparHTML(datos?.cliente?.cedula)}</span></div>
              <span class="meta-pair-divider"></span>
              <div class="meta-pair-item"><span class="client-label">Telefono</span><span class="client-value">${escaparHTML(datos?.cliente?.telefono)}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div class="section-card page-break-avoid">
        <div class="section-head compact"><div><span class="section-kicker">Detalle de venta</span><h3 class="section-title">Productos y servicios</h3></div></div>
        <table class="tabla-productos">
          <thead>
            <tr>
              <th width="6%" class="text-center">#</th>
              <th width="52%">Descripcion</th>
              <th width="10%" class="text-center">Cant</th>
              <th width="16%" class="text-end">P. Unitario</th>
              <th width="16%" class="text-end">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${Array.isArray(datos?.productos) && datos.productos.length > 0 ? datos.productos.map((producto: any, index: number) => {
    const precioUnitario = producto.precio_unitario_sin_iva ?? producto.precioUnitario ?? producto.precio ?? 0;
    const subtotal = producto.subtotal ?? producto.total ?? 0;
    return `
                <tr>
                  <td class="text-center">${index + 1}</td>
                  <td><span class="product-name">${escaparHTML(producto.nombre)}</span>${producto.esServicio || producto.esConsulta ? '<span class="service-tag">SERVICIO</span>' : ''}</td>
                  <td class="text-center">${producto.cantidad || 1}</td>
                  <td class="text-end">${formatearMoneda(precioUnitario, producto.moneda || datos?.configuracion?.moneda)}</td>
                  <td class="text-end">${formatearMoneda(subtotal, producto.moneda || datos?.configuracion?.moneda)}</td>
                </tr>
              `;
  }).join('') : '<tr><td colspan="5" class="text-center text-muted">No hay productos registrados</td></tr>'}
          </tbody>
        </table>
      </div>

      ${seccionResumenHTML}

      <div class="section-card page-break-avoid">
        <div class="section-head compact"><div><span class="section-kicker">Cierre financiero</span><h3 class="section-title">Totales de la operacion</h3></div></div>
        <div class="totals-layout">
          <div class="totals-breakdown">
            <div class="total-row"><span>Subtotal</span><strong>${formatearMoneda(datos?.totales?.subtotal, datos?.configuracion?.moneda)}</strong></div>
            <div class="total-row danger"><span>Descuento</span><strong>- ${formatearMoneda(datos?.totales?.descuento || 0, datos?.configuracion?.moneda)}</strong></div>
            <div class="total-row"><span>IVA</span><strong>${formatearMoneda(datos?.totales?.iva, datos?.configuracion?.moneda)}</strong></div>
            ${mostrarTotalAPagar ? `<div class="total-row"><span>${escaparHTML(textoTotalAPagar)}</span><strong>${formatearMoneda(datos?.totales?.total, datos?.configuracion?.moneda)}</strong></div>` : ''}
          </div>
          <div class="totals-highlight">
            <div class="highlight-card">
              <span class="metric-label">Total final</span>
              <strong class="metric-value">${formatearMoneda(totalVenta, datos?.configuracion?.moneda)}</strong>
              <small class="metric-caption">${escaparHTML(deudaPendiente > 0 ? 'Saldo pendiente por cobrar.' : 'Pago conciliado.')}</small>
            </div>
          </div>
        </div>
      </div>

      ${datos?.configuracion?.observaciones ? `<div class="section-card note-card compact-card page-break-avoid"><div class="section-head compact"><div><span class="section-kicker">Observacion</span><h3 class="section-title">Nota</h3></div></div><div style="font-size: 12px; line-height: 1.5;">${escaparHTML(datos.configuracion.observaciones)}</div></div>` : ''}

      <div class="footer-band page-break-avoid">
        <div>Pasados 30 dias no nos hacemos responsables de trabajos no retirados.</div>
        <div>${new Date().getFullYear()} © New Vision Lens</div>
      </div>

      <div class="message-card page-break-avoid">${escaparHTML(mensajeFinal)}</div>
    </div>
  </div>
</body>
</html>
  `;
}