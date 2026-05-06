import { OpcionPresupuesto, Presupuesto } from './presupuesto.interfaz';

export interface PresupuestoReporteDatosSede {
  nombreOptica: string;
  rif: string;
  direccion: string;
  telefono: string;
  email: string;
  iniciales: string;
}

export interface PresupuestoReporteOpciones {
  datosSede?: Partial<PresupuestoReporteDatosSede> | null;
  monedaSistema?: string;
  simboloMonedaSistema?: string;
  nombreAsesor?: string | null;
  fechaGeneracion?: Date;
  resolverReferenciaBs?: (monto: number, moneda: string) => number;
  mostrarReferenciaBs?: boolean;
  autoPrint?: boolean;
  autoCloseAfterPrint?: boolean;
}

function escapeHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizarCodigoMoneda(moneda: string | null | undefined): 'USD' | 'EUR' | 'VES' {
  const monedaNormalizada = String(moneda || '').trim().toLowerCase();

  if (['usd', 'dolar', '$'].includes(monedaNormalizada)) {
    return 'USD';
  }

  if (['eur', 'euro', '€'].includes(monedaNormalizada)) {
    return 'EUR';
  }

  return 'VES';
}

function obtenerSimboloMoneda(moneda: string, monedaSistema: string, simboloMonedaSistema?: string): string {
  const codigoMoneda = normalizarCodigoMoneda(moneda);

  if (codigoMoneda === normalizarCodigoMoneda(monedaSistema) && String(simboloMonedaSistema || '').trim()) {
    return String(simboloMonedaSistema || '').trim();
  }

  switch (codigoMoneda) {
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    default:
      return 'Bs.';
  }
}

function formatMoneda(valor: number | null | undefined, moneda: string, monedaSistema: string, simboloMonedaSistema?: string): string {
  const monto = Number(valor || 0);
  const simbolo = obtenerSimboloMoneda(moneda, monedaSistema, simboloMonedaSistema);
  const valorFormateado = new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.abs(monto));

  return `${monto < 0 ? '-' : ''}${simbolo} ${valorFormateado}`;
}

function getEstadoTexto(estadoColor: string | null | undefined): string {
  const estados: Record<string, string> = {
    vigente: 'Vigente',
    proximo: 'Próximo a vencer',
    hoy: 'Vence hoy',
    vencido: 'Vencido',
    convertido: 'Convertido',
    archivado: 'Archivado',
    anulado: 'Anulado'
  };

  return estados[String(estadoColor || '').trim()] || 'Vigente';
}

function obtenerObservacionesSinFormulaParaImpresion(observaciones: unknown): string {
  return String(observaciones || '')
    .replace(/\s*\|\s*FORMULA_(?:EXTERNA|INTERNA)\s*\|\s*OD\([^|]+\)\s*\|\s*OI\([^|]+\)\s*$/i, '')
    .replace(/^FORMULA_(?:EXTERNA|INTERNA)\s*\|\s*OD\([^|]+\)\s*\|\s*OI\([^|]+\)\s*$/i, '')
    .trim();
}

function esLineaConsulta(producto: any): boolean {
  const tipoItem = String(producto?.tipoItem || '').trim().toLowerCase();
  const codigo = String(producto?.codigo || '').trim().toUpperCase();
  const categoria = String(producto?.categoria || producto?.producto?.categoria || '').trim().toLowerCase();

  return Boolean(
    producto?.esConsulta === true
    || tipoItem === 'servicio_consulta'
    || codigo === 'CONSULTA-MEDICA'
    || categoria === 'consulta'
  );
}

function obtenerNombreVisibleProducto(producto: any): string {
  return String(producto?.nombre || producto?.descripcion || producto?.producto?.nombre || 'Producto').trim() || 'Producto';
}

function asegurarOpcionesPresupuesto(presupuesto: Presupuesto): OpcionPresupuesto[] {
  const opciones = Array.isArray(presupuesto?.opciones) ? presupuesto.opciones : [];

  if (opciones.length) {
    return opciones;
  }

  return [{
    id: String(presupuesto?.opcionPrincipalId || 'opcion-1'),
    nombre: 'Opción 1',
    productos: Array.isArray(presupuesto?.productos) ? presupuesto.productos : [],
    subtotal: Number(presupuesto?.subtotal || 0),
    descuentoTotal: Number(presupuesto?.descuentoTotal || 0),
    iva: Number(presupuesto?.iva || 0),
    total: Number(presupuesto?.total || 0),
    observaciones: null as any,
    esPrincipal: true
  }];
}

function obtenerOpcionPresupuesto(presupuesto: Presupuesto, opcionId?: string | null): OpcionPresupuesto | null {
  const opciones = asegurarOpcionesPresupuesto(presupuesto);
  return opciones.find((opcion) => opcion.id === opcionId)
    || opciones.find((opcion) => opcion.esPrincipal)
    || opciones[0]
    || null;
}

function getEtiquetaIva(presupuesto: Presupuesto): string {
  return `IVA (${Number(presupuesto?.ivaPorcentaje || 0)}%)`;
}

function obtenerInicialesMarca(nombre: string): string {
  const palabras = String(nombre || '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
  if (!palabras.length) {
    return 'NV';
  }
  return palabras.map((palabra) => palabra.charAt(0).toUpperCase()).join('');
}

function construirDatosSede(presupuesto: Presupuesto, opciones: PresupuestoReporteOpciones): PresupuestoReporteDatosSede {
  const sede = presupuesto?.sede as any;
  const nombreOptica = String(opciones?.datosSede?.nombreOptica || sede?.nombreOptica || sede?.nombre || 'New Vision Lens 2020').trim();
  const rif = String(opciones?.datosSede?.rif || sede?.rif || '').trim();
  const direccion = String(opciones?.datosSede?.direccion || sede?.direccion || 'Dirección no disponible').trim() || 'Dirección no disponible';
  const telefono = String(opciones?.datosSede?.telefono || sede?.telefono || 'Sin teléfono').trim() || 'Sin teléfono';
  const email = String(opciones?.datosSede?.email || sede?.email || 'Sin correo').trim() || 'Sin correo';

  return {
    nombreOptica,
    rif,
    direccion,
    telefono,
    email,
    iniciales: String(opciones?.datosSede?.iniciales || obtenerInicialesMarca(nombreOptica)).trim() || 'NV'
  };
}

function construirFilaImpresionPresupuesto(producto: any, index: number, presupuesto: Presupuesto, opciones: PresupuestoReporteOpciones): string {
  const esConsulta = esLineaConsulta(producto);
  const descripcion = escapeHtml(esConsulta ? 'Consulta medica' : obtenerNombreVisibleProducto(producto));
  const codigo = escapeHtml(producto?.codigo || '-');
  const codigoHtml = esConsulta ? '<span class="codigo-servicio">Servicio</span>' : codigo;
  const descuento = Number(producto?.descuento ?? producto?.descuentoPorcentaje ?? 0);
  const descuentoHtml = esConsulta ? 'No aplica' : (descuento > 0 ? `${descuento}%` : '-');
  const monedaProducto = String(producto?.moneda || presupuesto?.moneda || opciones?.monedaSistema || 'USD');

  return `
    <tr class="${esConsulta ? 'fila-consulta' : ''}">
        <td>${index + 1}</td>
        <td class="descripcion">${descripcion}</td>
        <td>${codigoHtml}</td>
        <td class="precio">${formatMoneda(Number(producto?.precio ?? producto?.precioUnitario ?? 0), monedaProducto, opciones?.monedaSistema || presupuesto?.moneda || 'USD', opciones?.simboloMonedaSistema)}</td>
        <td>${Number(producto?.cantidad || 1)}</td>
        <td>${descuentoHtml}</td>
        <td class="total">${formatMoneda(Number(producto?.total || 0), monedaProducto, opciones?.monedaSistema || presupuesto?.moneda || 'USD', opciones?.simboloMonedaSistema)}</td>
    </tr>
  `;
}

function construirTarjetaResumenImpresionOpcionPresupuesto(opcion: OpcionPresupuesto, index: number, opcionPrincipalId: string | null | undefined, presupuesto: Presupuesto, opciones: PresupuestoReporteOpciones): string {
  const productos = Array.isArray(opcion?.productos) ? opcion.productos : [];
  const productosSinConsulta = productos.filter((producto: any) => !esLineaConsulta(producto));
  const lineasConsulta = productos.filter((producto: any) => esLineaConsulta(producto));
  const esPrincipal = opcion?.id === opcionPrincipalId;
  const subtotal = Number(opcion?.subtotal || 0);
  const iva = Number(opcion?.iva || 0);

  return `
    <div class="opcion-resumen-card ${esPrincipal ? 'opcion-resumen-card--principal' : ''}">
        <div class="opcion-resumen-card__header">
            <span class="opcion-resumen-card__title">${escapeHtml(opcion?.nombre || `Opción ${index + 1}`)}</span>
            ${esPrincipal ? '<span class="opcion-badge">Principal</span>' : ''}
        </div>
        <div class="opcion-resumen-card__meta">
            ${productosSinConsulta.length} producto(s)${lineasConsulta.length > 0 ? ` + ${lineasConsulta.length} servicio(s)` : ''}
        </div>
        <div class="opcion-resumen-card__meta">Subtotal: ${formatMoneda(subtotal, presupuesto?.moneda || opciones?.monedaSistema || 'USD', opciones?.monedaSistema || presupuesto?.moneda || 'USD', opciones?.simboloMonedaSistema)}</div>
        <div class="opcion-resumen-card__meta">${getEtiquetaIva(presupuesto)}: ${formatMoneda(iva, presupuesto?.moneda || opciones?.monedaSistema || 'USD', opciones?.monedaSistema || presupuesto?.moneda || 'USD', opciones?.simboloMonedaSistema)}</div>
        <div class="opcion-resumen-card__total">${formatMoneda(Number(opcion?.total || 0), presupuesto?.moneda || opciones?.monedaSistema || 'USD', opciones?.monedaSistema || presupuesto?.moneda || 'USD', opciones?.simboloMonedaSistema)}</div>
    </div>
  `;
}

function construirSeccionImpresionOpcionPresupuesto(opcion: OpcionPresupuesto, index: number, opcionPrincipalId: string | null | undefined, totalOpciones: number, presupuesto: Presupuesto, opcionesRender: PresupuestoReporteOpciones): string {
  const productos = Array.isArray(opcion?.productos) ? opcion.productos : [];
  const productosSinConsulta = productos.filter((producto: any) => !esLineaConsulta(producto));
  const lineasConsulta = productos.filter((producto: any) => esLineaConsulta(producto));
  const totalConsulta = lineasConsulta.reduce((sum: number, producto: any) => sum + Number(producto?.total || 0), 0);
  const totalProductos = productosSinConsulta.reduce((sum: number, producto: any) => sum + Number(producto?.total || 0), 0);
  const descuentoTotal = Number(opcion?.descuentoTotal || 0);
  const subtotal = Number(opcion?.subtotal || 0);
  const subtotalNeto = subtotal - descuentoTotal;
  const porcentajeDescuento = subtotal > 0 ? Math.round((descuentoTotal / subtotal) * 10000) / 100 : 0;
  const total = Number(opcion?.total || 0);
  const referenciaBsTotal = opcionesRender?.mostrarReferenciaBs && typeof opcionesRender?.resolverReferenciaBs === 'function'
    ? formatMoneda(opcionesRender.resolverReferenciaBs(total, presupuesto?.moneda || opcionesRender?.monedaSistema || 'USD'), 'VES', opcionesRender?.monedaSistema || presupuesto?.moneda || 'USD', opcionesRender?.simboloMonedaSistema)
    : '';
  const filasProductosHtml = productos.map((producto: any, productoIndex: number) => construirFilaImpresionPresupuesto(producto, productoIndex, presupuesto, opcionesRender)).join('');
  const esPrincipal = opcion?.id === opcionPrincipalId;
  const mostrarTotalesDetallados = totalOpciones <= 1;
  const observaciones = obtenerObservacionesSinFormulaParaImpresion(opcion?.observaciones);
  const mostrarCabecera = totalOpciones > 1 || !!observaciones || !!opcion?.nombre;
  const tituloOpcion = totalOpciones > 1 ? escapeHtml(opcion?.nombre || `Opción ${index + 1}`) : 'Detalle del presupuesto';
  const subtitulo = `${productos.length} ítem(s) cotizados${observaciones ? ` • ${escapeHtml(observaciones)}` : ''}`;

  return `
    <div class="opcion-seccion">
        ${mostrarCabecera ? `<div class="opcion-seccion__header">
            <div>
                <div class="opcion-seccion__titulo">${tituloOpcion}</div>
                <div class="opcion-seccion__subtitulo">${subtitulo}</div>
            </div>
            ${esPrincipal ? '<span class="opcion-badge">Principal</span>' : ''}
        </div>` : ''}

        <table class="tabla-compacta">
            <thead>
                <tr>
                    <th>#</th>
                    <th>DESCRIPCIÓN</th>
                    <th>CÓDIGO</th>
                    <th>PRECIO UNIT.</th>
                    <th>CANT.</th>
                    <th>DTO %</th>
                    <th>TOTAL</th>
                </tr>
            </thead>
            <tbody>
              ${filasProductosHtml}
            </tbody>
        </table>

          <div class="resumen-compacto resumen-compacto--opcion ${mostrarTotalesDetallados ? '' : 'resumen-compacto--solo-info'}">
            ${mostrarTotalesDetallados ? `<div class="totales-compactos">
              <div class="total-line"><span class="total-label">Subtotal:</span><span class="total-valor">${formatMoneda(subtotal, presupuesto?.moneda || opcionesRender?.monedaSistema || 'USD', opcionesRender?.monedaSistema || presupuesto?.moneda || 'USD', opcionesRender?.simboloMonedaSistema)}</span></div>
              ${descuentoTotal > 0 ? `
              <div class="total-line"><span class="total-label">Descuento (${porcentajeDescuento}%):</span><span class="total-valor">- ${formatMoneda(descuentoTotal, presupuesto?.moneda || opcionesRender?.monedaSistema || 'USD', opcionesRender?.monedaSistema || presupuesto?.moneda || 'USD', opcionesRender?.simboloMonedaSistema)}</span></div>
              <div class="total-line"><span class="total-label">Subtotal Neto:</span><span class="total-valor">${formatMoneda(subtotalNeto, presupuesto?.moneda || opcionesRender?.monedaSistema || 'USD', opcionesRender?.monedaSistema || presupuesto?.moneda || 'USD', opcionesRender?.simboloMonedaSistema)}</span></div>
              ` : ''}
              <div class="total-line"><span class="total-label">${getEtiquetaIva(presupuesto)}:</span><span class="total-valor">${formatMoneda(Number(opcion?.iva || 0), presupuesto?.moneda || opcionesRender?.monedaSistema || 'USD', opcionesRender?.monedaSistema || presupuesto?.moneda || 'USD', opcionesRender?.simboloMonedaSistema)}</span></div>
              <div class="total-final total-line"><span class="total-label">TOTAL:</span><span class="total-valor">${formatMoneda(total, presupuesto?.moneda || opcionesRender?.monedaSistema || 'USD', opcionesRender?.monedaSistema || presupuesto?.moneda || 'USD', opcionesRender?.simboloMonedaSistema)}</span></div>
              ${referenciaBsTotal ? `<div class="total-line"><span class="total-label">REFERENCIA:</span><span class="total-valor">${referenciaBsTotal}</span></div>` : ''}
              ${referenciaBsTotal ? `<div class="print-note print-note--currency">La referencia en bolívares es informativa. El monto definitivo se calcula según la tasa vigente al momento de la compra.</div>` : ''}
            </div>` : ''}
            <div class="info-lateral">
                <h4>RESUMEN</h4>
                <div class="info-item"><strong>Productos:</strong> ${productosSinConsulta.length}</div>
                ${lineasConsulta.length > 0 ? `<div class="info-item info-item--consulta"><strong>Servicio:</strong> ${lineasConsulta.length} consulta${lineasConsulta.length > 1 ? 's' : ''}<br><strong>Monto:</strong> ${formatMoneda(totalConsulta, presupuesto?.moneda || opcionesRender?.monedaSistema || 'USD', opcionesRender?.monedaSistema || presupuesto?.moneda || 'USD', opcionesRender?.simboloMonedaSistema)}</div>` : ''}
                <div class="info-item"><strong>Total productos:</strong> ${formatMoneda(totalProductos, presupuesto?.moneda || opcionesRender?.monedaSistema || 'USD', opcionesRender?.monedaSistema || presupuesto?.moneda || 'USD', opcionesRender?.simboloMonedaSistema)}</div>
            </div>
        </div>
    </div>
  `;
}

export function getPresupuestoReportStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; line-height: 1.3; color: #1f2937; background: #f8fafc; }
    .presupuesto-container { width: 100%; max-width: 205mm; margin: 0 auto; background: #ffffff; border: 1px solid #dbe4f0; border-radius: 10px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08); padding: 10px 12px; }
    .header-compact { display: grid; grid-template-columns: 1fr auto; gap: 15px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #1f4e79; }
    .empresa-nombre-compact { font-size: 16px; font-weight: 700; color: #1f4e79; margin-bottom: 2px; }
    .empresa-datos-compact { font-size: 9px; color: #666; line-height: 1.3; }
    .logo-mini { width: 60px; height: 60px; background: linear-gradient(135deg, #1f4e79, #2f6ea3); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: bold; font-size: 20px; }
    .titulo-principal { text-align: center; margin: 10px 0 15px 0; padding: 8px; background: linear-gradient(135deg, #1f4e79, #2f6ea3); color: white; border-radius: 6px; }
    .titulo-principal h1 { font-size: 16px; font-weight: 700; }
    .metadata-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
    .metadata-card { background: #f8fbff; border: 1px solid #d9e8f7; border-radius: 8px; padding: 6px 8px; text-align: center; }
    .metadata-label { font-size: 8px; color: #6c757d; font-weight: 600; text-transform: uppercase; margin-bottom: 2px; display: block; }
    .metadata-valor { font-size: 10px; font-weight: 600; color: #1f4e79; }
    .estado-badge { display: inline-block; padding: 2px 6px; border-radius: 10px; font-size: 8px; font-weight: 600; }
    .estado-vigente { background: #d4edda; color: #155724; }
    .estado-proximo { background: #fff3cd; color: #856404; }
    .estado-hoy { background: #cce5ff; color: #004085; }
    .estado-vencido { background: #f8d7da; color: #721c24; }
    .cliente-compact { background: #f8f9fa; border-radius: 6px; padding: 10px; margin-bottom: 12px; border: 1px solid #dee2e6; }
    .cliente-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #dee2e6; }
    .cliente-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; font-size: 10px; }
    .cliente-item { display: flex; align-items: flex-start; }
    .cliente-label { font-weight: 600; color: #495057; min-width: 70px; margin-right: 5px; }
    .cliente-valor { color: #212529; flex: 1; }
    .comparativo-section { margin-bottom: 12px; }
    .comparativo-section h3 { font-size: 10px; color: #1f4e79; margin-bottom: 6px; }
    .opciones-comparativo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
    .opcion-resumen-card { background: #f8fbff; border: 1px solid #d9e8f7; border-radius: 8px; padding: 8px; }
    .opcion-resumen-card--principal { background: #ebf4ff; border-color: #1f4e79; }
    .opcion-resumen-card__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
    .opcion-resumen-card__title { font-size: 10px; font-weight: 700; color: #1f4e79; }
    .opcion-resumen-card__meta { font-size: 8px; color: #64748b; }
    .opcion-resumen-card__total { margin-top: 6px; text-align: right; font-size: 11px; font-weight: 700; color: #0f172a; }
    .opcion-badge { display: inline-flex; align-items: center; padding: 2px 6px; border-radius: 999px; background: #1f4e79; color: #fff; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
    .opcion-seccion { background: #ffffff; border: 1px solid #dbe4f0; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
    .opcion-seccion__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
    .opcion-seccion__titulo { font-size: 12px; font-weight: 700; color: #1f4e79; }
    .opcion-seccion__subtitulo { font-size: 9px; color: #64748b; margin-top: 2px; }
    .resumen-compacto--opcion { margin-bottom: 0; }
    .tabla-compacta { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9px; }
    .tabla-compacta thead { background: #1f4e79; color: white; }
    .tabla-compacta th { padding: 6px 4px; font-weight: 600; text-align: center; font-size: 9px; }
    .tabla-compacta td { padding: 5px 4px; text-align: center; border-bottom: 1px solid #e9ecef; vertical-align: middle; }
    .tabla-compacta tbody tr:nth-child(even) { background-color: #f8f9fa; }
    .tabla-compacta .descripcion { text-align: left; font-size: 9.5px; max-width: 120px; }
    .tabla-compacta .precio, .tabla-compacta .total { text-align: center; min-width: 60px; font-weight: 600; }
    .tabla-compacta tbody tr.fila-consulta { background: linear-gradient(90deg, #eff6ff, #f8fbff) !important; }
    .tabla-compacta tbody tr.fila-consulta td { border-bottom: 1px solid #bfdbfe; }
    .codigo-servicio { color: #1d4ed8; font-weight: 700; }
    .resumen-compacto { display: grid; grid-template-columns: 2fr 1fr; gap: 15px; margin-bottom: 12px; }
    .resumen-compacto--solo-info { grid-template-columns: 1fr; }
    .totales-compactos { background: #f8f9fa; border-radius: 6px; padding: 10px; border: 1px solid #dee2e6; }
    .total-line { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
    .total-line:not(:last-child) { border-bottom: 1px dashed #dee2e6; }
    .total-label { font-size: 10px; color: #495057; }
    .total-valor { font-weight: 600; font-size: 10px; }
    .total-final { background: #ebf4ff; border-radius: 4px; padding: 6px 8px; margin-top: 6px; border-left: 3px solid #1f4e79; }
    .total-final .total-label, .total-final .total-valor { color: #1f4e79; font-weight: 700; }
    .print-note--currency { margin-top: 6px; font-size: 8px; color: #64748b; line-height: 1.4; }
    .info-lateral { background: #fff9db; border: 1px solid #ffeaa7; border-radius: 6px; padding: 10px; }
    .info-lateral h4 { font-size: 10px; color: #856404; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #ffeaa7; }
    .info-item { font-size: 9px; margin-bottom: 4px; }
    .info-item--consulta { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 6px; color: #1e3a8a; }
    .obs-section { background: #f1f5f9; border-radius: 6px; padding: 8px; border: 1px solid #dee2e6; margin-bottom: 10px; }
    .obs-section h4 { font-size: 10px; color: #1f4e79; margin-bottom: 6px; }
    .obs-content { font-size: 9px; color: #495057; line-height: 1.3; }
    .resumen-impresion-simple { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
    .resumen-impresion-simple__item { background: #f8fbff; border: 1px solid #d9e8f7; border-radius: 8px; padding: 8px; }
    .resumen-impresion-simple__label { display: block; font-size: 8px; font-weight: 700; color: #6c757d; text-transform: uppercase; margin-bottom: 4px; }
    .resumen-impresion-simple__value { font-size: 10px; font-weight: 700; color: #1f4e79; }
    .footer-compacto { text-align: center; font-size: 8px; color: #4b5563; padding: 8px; border-top: 1px solid #dbe2ea; background: #f8fbff; border-radius: 8px; line-height: 1.35; }
    .footer-brand { font-size: 9px; font-weight: 700; color: #1f4e79; margin-bottom: 3px; }
    @media print { @page { margin: 10mm 8mm; size: A4 portrait; } body { background: #fff; padding: 0; } }
  `;
}

export function buildPresupuestoReportMarkup(presupuesto: Presupuesto, opciones: PresupuestoReporteOpciones = {}): string {
  const presupuestoImpresion = JSON.parse(JSON.stringify(presupuesto || {})) as Presupuesto;
  const datosSede = construirDatosSede(presupuestoImpresion, opciones);
  const nombreAsesor = String(opciones?.nombreAsesor || presupuestoImpresion?.vendedor || 'N/A').trim() || 'N/A';
  const opcionesImpresion = asegurarOpcionesPresupuesto(presupuestoImpresion);
  const opcionPrincipal = obtenerOpcionPresupuesto(presupuestoImpresion, presupuestoImpresion?.opcionPrincipalId);
  const tieneMultiplesOpciones = opcionesImpresion.length > 1;
  const tituloPresupuestoImpresion = [
    String(presupuestoImpresion?.codigo || '').trim(),
    String(presupuestoImpresion?.cliente?.nombreCompleto || '').trim()
  ].filter(Boolean).join(' - ');
  const resumenOpcionesHtml = tieneMultiplesOpciones
    ? opcionesImpresion.map((opcion, index) => construirTarjetaResumenImpresionOpcionPresupuesto(opcion, index, presupuestoImpresion?.opcionPrincipalId, presupuestoImpresion, opciones)).join('')
    : '';
  const seccionesOpcionesHtml = opcionesImpresion.map((opcion, index) => construirSeccionImpresionOpcionPresupuesto(opcion, index, presupuestoImpresion?.opcionPrincipalId, opcionesImpresion.length, presupuestoImpresion, opciones)).join('');
  const fechaActual = opciones?.fechaGeneracion || new Date();
  const fechaEmision = fechaActual.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaEmision = fechaActual.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const fechaVencimiento = new Date(presupuestoImpresion.fechaVencimiento).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const estadoTexto = getEstadoTexto(presupuestoImpresion.estadoColor);
  const diasRestantes = Number(presupuestoImpresion?.diasRestantes || 0);
  const diasInfo = diasRestantes >= 0 ? `${diasRestantes} días restantes` : `Vencido hace ${Math.abs(diasRestantes)} días`;
  const observacionesImpresion = obtenerObservacionesSinFormulaParaImpresion(presupuestoImpresion?.observaciones);
  const contactoSede = [
    datosSede.telefono && datosSede.telefono !== 'Sin teléfono' ? `Tel: ${escapeHtml(datosSede.telefono)}` : '',
    datosSede.email && datosSede.email !== 'Sin correo' ? `Email: ${escapeHtml(datosSede.email)}` : ''
  ].filter(Boolean).join(' | ');
  const direccionSede = datosSede.direccion && datosSede.direccion !== 'Dirección no disponible' ? escapeHtml(datosSede.direccion) : '';

  return `
    <div class="presupuesto-container">
        <div class="header-compact">
            <div>
                <div class="empresa-nombre-compact">${escapeHtml(datosSede.nombreOptica)}</div>
                <div class="empresa-datos-compact">
                    ${datosSede.rif ? `RIF: ${escapeHtml(datosSede.rif)}<br>` : ''}
                    ${escapeHtml(datosSede.direccion)}<br>
                    ${escapeHtml(datosSede.telefono)} | ${escapeHtml(datosSede.email)}
                </div>
            </div>
            <div class="logo-mini">${escapeHtml(datosSede.iniciales)}</div>
        </div>

        <div class="titulo-principal">
          <h1>${escapeHtml(tituloPresupuestoImpresion || String(presupuestoImpresion.codigo || ''))}</h1>
        </div>

        <div class="metadata-grid">
            <div class="metadata-card">
                <span class="metadata-label">EMISIÓN</span>
                <span class="metadata-valor">${fechaEmision} ${horaEmision}</span>
            </div>
            <div class="metadata-card">
                <span class="metadata-label">VENCIMIENTO</span>
                <span class="metadata-valor">${fechaVencimiento}</span>
            </div>
            <div class="metadata-card">
                <span class="metadata-label">VENDEDOR</span>
                <span class="metadata-valor">${escapeHtml(nombreAsesor)}</span>
            </div>
            <div class="metadata-card">
                <span class="metadata-label">ESTADO</span>
              <span class="metadata-valor"><span class="estado-badge estado-${escapeHtml(String(presupuestoImpresion.estadoColor || 'vigente'))}">${escapeHtml(estadoTexto)}</span></span>
            </div>
        </div>

        <div class="cliente-compact">
            <div class="cliente-header">
                <h3>CLIENTE</h3>
                <div style="font-size: 9px; color: #6c757d;">${escapeHtml(diasInfo)}</div>
            </div>
            <div class="cliente-grid">
              <div class="cliente-item"><span class="cliente-label">Nombre:</span><span class="cliente-valor">${escapeHtml(presupuestoImpresion.cliente.nombreCompleto || '')}</span></div>
              <div class="cliente-item"><span class="cliente-label">${presupuestoImpresion.cliente.tipoPersona === 'juridica' ? 'RIF:' : 'Cédula:'}</span><span class="cliente-valor">${escapeHtml(presupuestoImpresion.cliente.cedula || '')}</span></div>
              <div class="cliente-item"><span class="cliente-label">Teléfono:</span><span class="cliente-valor">${escapeHtml(presupuestoImpresion.cliente.telefono || 'N/A')}</span></div>
              <div class="cliente-item"><span class="cliente-label">Email:</span><span class="cliente-valor">${escapeHtml(presupuestoImpresion.cliente.email || 'N/A')}</span></div>
            </div>
        </div>

        <div class="resumen-impresion-simple">
            <div class="resumen-impresion-simple__item">
                <span class="resumen-impresion-simple__label">Vendedor</span>
                <span class="resumen-impresion-simple__value">${escapeHtml(nombreAsesor)}</span>
            </div>
            <div class="resumen-impresion-simple__item">
                <span class="resumen-impresion-simple__label">Validez</span>
                <span class="resumen-impresion-simple__value">${Number(presupuestoImpresion.diasVencimiento || 7)} días</span>
            </div>
            <div class="resumen-impresion-simple__item">
                <span class="resumen-impresion-simple__label">Opciones</span>
                <span class="resumen-impresion-simple__value">${opcionesImpresion.length}</span>
            </div>
            <div class="resumen-impresion-simple__item">
                <span class="resumen-impresion-simple__label">Opción principal</span>
                <span class="resumen-impresion-simple__value">${escapeHtml(opcionPrincipal?.nombre || 'N/A')}</span>
            </div>
        </div>

          ${tieneMultiplesOpciones ? `<div class="comparativo-section">
            <h3>Opciones para comparar</h3>
            <div class="opciones-comparativo-grid">
              ${resumenOpcionesHtml}
            </div>
          </div>` : ''}

          ${seccionesOpcionesHtml}

        <div class="obs-section">
            <h4>OBSERVACIONES</h4>
          <div class="obs-content">${escapeHtml(observacionesImpresion || 'Sin observaciones adicionales.')}</div>
        </div>

        <div class="footer-compacto">
            <div class="footer-brand">${escapeHtml(datosSede.nombreOptica)}</div>
            ${contactoSede ? `<div>${contactoSede}</div>` : ''}
            ${direccionSede ? `<div>${direccionSede}</div>` : ''}
        </div>
    </div>
  `;
}

export function buildPresupuestoReportDocument(presupuesto: Presupuesto, opciones: PresupuestoReporteOpciones = {}): string {
  const titulo = escapeHtml(String(presupuesto?.codigo || 'Presupuesto'));
  const autoPrintScript = opciones?.autoPrint
    ? `
      <script>
        window.onload = function() {
          document.title = ${JSON.stringify(String(presupuesto?.codigo || 'Presupuesto'))};
          setTimeout(function() { window.print(); }, 300);
        };
        ${opciones?.autoCloseAfterPrint ? `window.onafterprint = function() { setTimeout(function() { window.close(); }, 800); };` : ''}
      </script>
    `
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${titulo}</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
      <style>${getPresupuestoReportStyles()}</style>
    </head>
    <body>
      ${buildPresupuestoReportMarkup(presupuesto, opciones)}
      ${autoPrintScript}
    </body>
    </html>
  `;
}