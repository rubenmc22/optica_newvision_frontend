// cierre-caja.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { CierreDiario, Transaccion, TasasCambio } from './cierre-caja.interfaz';

@Injectable({
    providedIn: 'root'
})
export class CierreCajaService {
    private apiUrl = environment.apiUrl;
    private usarDummy: boolean = (environment as any)?.cierreCajaUsarDummy ?? false;
    private cierres: Map<string, CierreDiario> = new Map();
    private ventas: any[] = [];
    private readonly tasasDummyBase = {
        dolar: 476.4342,
        euro: 550.8954,
        bolivar: 1
    };

    constructor(private http: HttpClient) {
        this.inicializarDatosDummy();
    }

    setUsarDummy(valor: boolean): void {
        this.usarDummy = valor;
    }

    estaUsandoDummy(): boolean {
        return this.usarDummy;
    }

    private formatearFechaYYYYMMDD(fecha: Date): string {
        const year = fecha.getFullYear();
        const month = String(fecha.getMonth() + 1).padStart(2, '0');
        const day = String(fecha.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private crearFechaOperativaLocal(fechaInput: any): Date {
        if (fechaInput instanceof Date && !Number.isNaN(fechaInput.getTime())) {
            return new Date(fechaInput.getFullYear(), fechaInput.getMonth(), fechaInput.getDate(), 12, 0, 0, 0);
        }

        const texto = String(fechaInput || '').trim();
        const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
        }

        const fecha = new Date(fechaInput);
        if (!Number.isNaN(fecha.getTime())) {
            return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0, 0);
        }

        return new Date();
    }

    private redondear(valor: number, decimales: number = 2): number {
        if (!Number.isFinite(valor)) {
            return 0;
        }

        return Number(valor.toFixed(decimales));
    }

    private normalizarMoneda(moneda?: string): 'dolar' | 'euro' | 'bolivar' {
        const valor = (moneda || 'USD').toString().trim().toLowerCase();

        if (['usd', 'dolar', 'dólar', '$'].includes(valor)) {
            return 'dolar';
        }

        if (['eur', 'euro', '€'].includes(valor)) {
            return 'euro';
        }

        return 'bolivar';
    }

    private obtenerCodigoMoneda(moneda?: string): 'USD' | 'EUR' | 'VES' {
        const monedaNormalizada = this.normalizarMoneda(moneda);

        if (monedaNormalizada === 'dolar') {
            return 'USD';
        }

        if (monedaNormalizada === 'euro') {
            return 'EUR';
        }

        return 'VES';
    }

    private obtenerClaveMonedaTasa(item?: any): 'dolar' | 'euro' | 'bolivar' {
        return this.normalizarMoneda(item?.moneda ?? item?.id ?? item?.moneda_id);
    }

    private normalizarClaveDestino(valor: string): string {
        return (valor || 'destino')
            .toString()
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '') || 'destino';
    }

    private obtenerCodigoBancoDemo(banco?: string | null): string {
        const nombre = (banco || '').trim().toLowerCase();
        const mapa: Record<string, string> = {
            'banco de venezuela': '0102',
            'banesco': '0134',
            'provincial': '0108',
            'banco provincial': '0108',
            'bnc': '0191',
            'bancaribe': '0114',
            'bank of america': 'BOFA',
            'chase': 'CHASE',
            'wells fargo': 'WF'
        };

        return mapa[nombre] || this.normalizarClaveDestino(nombre).toUpperCase();
    }

    private obtenerDestinoReceptorAgrupado(metodo: any, tipo: string, moneda: string): any {
        const bancoBase = tipo === 'punto'
            ? (metodo?.bancoNombre || metodo?.banco || 'Otro')
            : (metodo?.bancoReceptorNombre || metodo?.bancoReceptor || metodo?.bancoNombre || metodo?.banco || (tipo === 'zelle' ? 'Cuenta Zelle principal' : 'Destino sin identificar'));
        const bancoCodigoBase = tipo === 'punto'
            ? (metodo?.bancoCodigo || this.obtenerCodigoBancoDemo(bancoBase))
            : (metodo?.bancoReceptorCodigo || metodo?.bancoCodigo || this.obtenerCodigoBancoDemo(bancoBase));
        const cuentaAlias = metodo?.cuentaReceptoraAlias || metodo?.cuentaReceptoraEmail || metodo?.cuentaReceptoraUltimos4 || null;
        const cuentaId = metodo?.cuentaReceptoraId || null;
        const destinoLabel = cuentaAlias && cuentaAlias !== bancoBase
            ? `${bancoBase} · ${cuentaAlias}`
            : bancoBase;
        const destinoKey = this.normalizarClaveDestino(`${bancoCodigoBase}_${cuentaId || cuentaAlias || bancoBase}_${moneda}`);

        return {
            banco: bancoBase,
            bancoCodigo: bancoCodigoBase,
            destinoKey,
            destinoLabel,
            cuentaAlias,
            cuentaId,
            monedaOriginal: moneda
        };
    }

    private obtenerTasasReferenciaBolivar(): { dolar: number; euro: number; bolivar: number } {
        const tasasDesdeVentas = this.obtenerTasasReferenciaDesdeVentas();

        if (tasasDesdeVentas) {
            return tasasDesdeVentas;
        }

        return { ...this.tasasDummyBase };
    }

    private obtenerTasasReferenciaDesdeVentas(): { dolar: number; euro: number; bolivar: number } | null {
        for (const venta of this.ventas) {
            const tasasHistoricas = Array.isArray(venta?.formaPagoDetalle?.tasasActuales)
                ? venta.formaPagoDetalle.tasasActuales
                : [];

            const tasaDolar = Number(
                tasasHistoricas.find((item: any) => this.obtenerClaveMonedaTasa(item) === 'dolar')?.tasa ??
                tasasHistoricas.find((item: any) => this.obtenerClaveMonedaTasa(item) === 'dolar')?.valor ??
                0
            );
            const tasaEuro = Number(
                tasasHistoricas.find((item: any) => this.obtenerClaveMonedaTasa(item) === 'euro')?.tasa ??
                tasasHistoricas.find((item: any) => this.obtenerClaveMonedaTasa(item) === 'euro')?.valor ??
                0
            );

            if (tasaDolar > 0 && tasaEuro > 0) {
                return {
                    dolar: tasaDolar,
                    euro: tasaEuro,
                    bolivar: 1
                };
            }
        }

        return null;
    }

    private construirTasasHistoricasDesdeReferencia(
        tasasReferencia: { dolar: number; euro: number; bolivar: number }
    ): Array<{ moneda: string; tasa: number; valor: number }> {
        return [
            { moneda: 'dolar', tasa: tasasReferencia.dolar, valor: tasasReferencia.dolar },
            { moneda: 'euro', tasa: tasasReferencia.euro, valor: tasasReferencia.euro },
            { moneda: 'bolivar', tasa: tasasReferencia.bolivar, valor: tasasReferencia.bolivar }
        ];
    }

    private construirTasasCambio(monedaPrincipal: string): TasasCambio {
        const tasasReferencia = this.obtenerTasasReferenciaBolivar();
        const tasaDolar = Number(tasasReferencia.dolar || 0);
        const tasaEuro = Number(tasasReferencia.euro || 0);

        if (monedaPrincipal === 'EUR') {
            return {
                dolar: tasaDolar > 0 && tasaEuro > 0 ? tasaDolar / tasaEuro : 1,
                euro: 1,
                bolivar: tasaEuro > 0 ? 1 / tasaEuro : 1
            };
        }

        if (monedaPrincipal === 'VES') {
            return {
                dolar: tasaDolar > 0 ? tasaDolar : 1,
                euro: tasaEuro > 0 ? tasaEuro : 1,
                bolivar: 1
            };
        }

        return {
            dolar: 1,
            euro: tasaDolar > 0 && tasaEuro > 0 ? tasaEuro / tasaDolar : 1,
            bolivar: tasaDolar > 0 ? 1 / tasaDolar : 1
        };
    }

    private generarTasasHistoricas(fecha: Date, numeroVenta: string): Array<{ moneda: string; tasa: number; valor: number }> {
        const tasasReferencia = this.obtenerTasasReferenciaBolivar();
        const semilla = `${numeroVenta}-${fecha.toISOString()}`
            .split('')
            .reduce((acumulado, caracter, indice) => acumulado + (caracter.charCodeAt(0) * (indice + 1)), 0);

        const variacionUsd = ((semilla % 17) - 8) * 0.0045;
        const variacionEuro = (((Math.floor(semilla / 7)) % 13) - 6) * 0.0035;

        const tasaUsdBase = Number(tasasReferencia.dolar || 1);
        const tasaEuroBase = Number(tasasReferencia.euro || 1);
        const tasaUsd = this.redondear(tasaUsdBase * (1 + variacionUsd), 4);
        const tasaEuro = this.redondear(tasaEuroBase * (1 + variacionEuro), 4);

        return [
            { moneda: 'dolar', tasa: tasaUsd, valor: tasaUsd },
            { moneda: 'euro', tasa: tasaEuro, valor: tasaEuro },
            { moneda: 'bolivar', tasa: 1, valor: 1 }
        ];
    }

    private obtenerMapaTasasHistoricas(tasasHistoricas?: Array<{ moneda: string; tasa: number; valor?: number }>): Record<string, number> {
        const tasasBase = this.obtenerTasasReferenciaBolivar();
        const tasas: Record<string, number> = {
            dolar: tasasBase.dolar,
            euro: tasasBase.euro,
            bolivar: tasasBase.bolivar
        };

        (tasasHistoricas || []).forEach((item) => {
            const moneda = this.obtenerClaveMonedaTasa(item);
            const tasa = Number(item?.tasa ?? item?.valor ?? 0);

            if (Number.isFinite(tasa) && tasa > 0) {
                tasas[moneda] = tasa;
            }
        });

        return tasas;
    }

    private convertirMontoHistorico(
        monto: number,
        monedaOrigen: string,
        monedaDestino: string,
        tasasHistoricas?: Array<{ moneda: string; tasa: number; valor?: number }>
    ): number {
        const montoSeguro = Number(monto || 0);
        const origen = this.normalizarMoneda(monedaOrigen);
        const destino = this.normalizarMoneda(monedaDestino);

        if (!montoSeguro) {
            return 0;
        }

        if (origen === destino) {
            return this.redondear(montoSeguro);
        }

        const tasas = this.obtenerMapaTasasHistoricas(tasasHistoricas);
        const montoEnBolivar = origen === 'bolivar'
            ? montoSeguro
            : montoSeguro * (tasas[origen] || 1);

        if (destino === 'bolivar') {
            return this.redondear(montoEnBolivar);
        }

        return this.redondear(montoEnBolivar / (tasas[destino] || 1));
    }

    private extraerTasasHistoricasDesdeMetodos(metodos: any[] = []): Array<{ moneda: string; tasa: number; valor: number }> {
        const mapa = new Map<string, number>();
        const tasasBase = this.obtenerTasasReferenciaBolivar();

        metodos.forEach((metodo: any) => {
            const moneda = this.normalizarMoneda(metodo?.moneda || metodo?.moneda_id);
            const tasa = Number(metodo?.tasaUsada ?? metodo?.tasaUasada ?? metodo?.tasa_usada ?? 0);

            if (Number.isFinite(tasa) && tasa > 0) {
                mapa.set(moneda, tasa);
            }
        });

        if (!mapa.has('dolar')) {
            mapa.set('dolar', tasasBase.dolar);
        }

        if (!mapa.has('euro')) {
            mapa.set('euro', tasasBase.euro);
        }

        if (!mapa.has('bolivar')) {
            mapa.set('bolivar', 1);
        }

        return Array.from(mapa.entries()).map(([moneda, tasa]) => ({ moneda, tasa, valor: tasa }));
    }

    private normalizarMetodoPagoApi(
        metodo: any,
        monedaVenta: string,
        tasasHistoricas: Array<{ moneda: string; tasa: number; valor?: number }>
    ): any {
        const monedaMetodo = this.obtenerCodigoMoneda(metodo?.moneda || metodo?.moneda_id || monedaVenta);
        const montoOriginal = Number(metodo?.monto || metodo?.montoAbonado || 0);
        const tasaUsada = Number(
            metodo?.tasaUsada ??
            metodo?.tasaUasada ??
            metodo?.tasa_usada ??
            this.obtenerMapaTasasHistoricas(tasasHistoricas)[this.normalizarMoneda(monedaMetodo)]
        );

        return {
            tipo: metodo?.tipo || 'efectivo',
            monto: montoOriginal,
            moneda: monedaMetodo,
            referencia: metodo?.referencia || null,
            bancoCodigo: metodo?.bancoCodigo || null,
            bancoNombre: metodo?.bancoNombre || null,
            bancoReceptorCodigo: metodo?.bancoReceptorCodigo || null,
            bancoReceptorNombre: metodo?.bancoReceptorNombre || null,
            bancoReceptor: metodo?.bancoReceptor || null,
            cuentaReceptoraId: metodo?.cuentaReceptoraId || null,
            cuentaReceptoraAlias: metodo?.cuentaReceptoraAlias || null,
            cuentaReceptoraUltimos4: metodo?.cuentaReceptoraUltimos4 || null,
            cuentaReceptoraEmail: metodo?.cuentaReceptoraEmail || null,
            notaPago: metodo?.notaPago || null,
            tasaUsada: Number.isFinite(tasaUsada) && tasaUsada > 0 ? tasaUsada : undefined,
            montoEnMonedaVenta: Number(
                metodo?.montoEnMonedaVenta ??
                metodo?.monto_en_moneda_de_venta ??
                this.convertirMontoHistorico(montoOriginal, monedaMetodo, monedaVenta, tasasHistoricas)
            ),
            montoEnBolivar: Number(
                metodo?.montoEnBolivar ??
                metodo?.monto_en_bolivar ??
                metodo?.montoEnBolivares ??
                this.convertirMontoHistorico(montoOriginal, monedaMetodo, 'VES', tasasHistoricas)
            ),
            montoEnMonedaSistema: Number(
                metodo?.montoEnMonedaSistema ??
                this.convertirMontoHistorico(montoOriginal, monedaMetodo, 'USD', tasasHistoricas)
            )
        };
    }

    private extraerMetodosPagoDeRespuestaApi(ventaApi: any, monedaVenta: string, tasasHistoricas: Array<{ moneda: string; tasa: number; valor?: number }>): any[] {
        if (Array.isArray(ventaApi?.metodosDePago) && ventaApi.metodosDePago.length) {
            return ventaApi.metodosDePago.map((metodo: any) => this.normalizarMetodoPagoApi(metodo, monedaVenta, tasasHistoricas));
        }

        if (Array.isArray(ventaApi?.metodosPago) && ventaApi.metodosPago.length) {
            return ventaApi.metodosPago.flatMap((grupo: any) => {
                if (Array.isArray(grupo?.metodosPago) && grupo.metodosPago.length) {
                    return grupo.metodosPago.map((metodo: any) => this.normalizarMetodoPagoApi(metodo, monedaVenta, tasasHistoricas));
                }

                return [];
            });
        }

        return [];
    }

    private adaptarVentaApi(entrada: any): any {
        const ventaBase = entrada?.venta || entrada || {};
        const totales = entrada?.totales || {};
        const formaPagoDetalleFuente = [
            entrada?.formaPagoDetalle,
            ventaBase?.formaPagoDetalle,
            typeof entrada?.formaPago === 'object' ? entrada.formaPago : null,
            typeof ventaBase?.formaPago === 'object' ? ventaBase.formaPago : null
        ].find((item) => item && typeof item === 'object') || {};
        const formaPagoDetalle = { ...formaPagoDetalleFuente };
        const monedaVenta = this.obtenerCodigoMoneda(ventaBase?.moneda || entrada?.moneda || 'USD');
        const metodosFuente = Array.isArray(entrada?.metodosDePago) || Array.isArray(entrada?.metodosPago)
            ? entrada
            : ventaBase;
        const tasasHistoricas = Array.isArray(formaPagoDetalle?.tasasActuales) && formaPagoDetalle.tasasActuales.length
            ? formaPagoDetalle.tasasActuales
            : this.extraerTasasHistoricasDesdeMetodos(
                Array.isArray(metodosFuente?.metodosDePago)
                    ? metodosFuente.metodosDePago
                    : Array.isArray(metodosFuente?.metodosPago)
                        ? metodosFuente.metodosPago.flatMap((grupo: any) => grupo?.metodosPago || [])
                        : []
            );
        const metodosDePago = this.extraerMetodosPagoDeRespuestaApi(metodosFuente, monedaVenta, tasasHistoricas);
        const abonosNormalizados = Array.isArray(formaPagoDetalleFuente?.abonos)
                ? formaPagoDetalleFuente.abonos.map((abono: any) => {
                    const tasasHistoricasAbono = Array.isArray(abono?.tasasActuales) && abono.tasasActuales.length
                        ? abono.tasasActuales
                        : this.extraerTasasHistoricasDesdeMetodos(Array.isArray(abono?.metodosDePago) ? abono.metodosDePago : []);

                    const tasasNormalizadasAbono = tasasHistoricasAbono.length ? tasasHistoricasAbono : tasasHistoricas;

                    return {
                        ...abono,
                        fecha: abono?.fecha || entrada?.fecha || ventaBase?.fecha,
                        numero: Number(abono?.numero || 0),
                        montoAbonado: Number(abono?.montoAbonado ?? abono?.monto ?? 0),
                        deudaPendiente: Number(abono?.deudaPendiente ?? abono?.deuda ?? 0),
                        observaciones: abono?.observaciones || '',
                        tasasActuales: tasasNormalizadasAbono,
                        metodosDePago: Array.isArray(abono?.metodosDePago)
                            ? abono.metodosDePago.map((metodo: any) => this.normalizarMetodoPagoApi(metodo, monedaVenta, tasasNormalizadasAbono))
                            : []
                    };
                })
            : [];
        const total = Number(
            totales?.total ??
            entrada?.total ??
            ventaBase?.total ??
            formaPagoDetalle?.montoTotal ??
            0
        );
        const totalPagado = Number(
            totales?.totalPagado ??
            formaPagoDetalle?.totalPagado ??
            formaPagoDetalle?.totalPagadoAhora ??
            entrada?.total_pagado ??
            ventaBase?.total_pagado ??
            0
        );
        const deudaPendiente = Number(
            formaPagoDetalle?.deudaPendiente ??
            formaPagoDetalle?.deuda ??
            Math.max(0, total - totalPagado)
        );
        const clienteInfo = entrada?.cliente?.informacion || entrada?.cliente || ventaBase?.cliente?.informacion || ventaBase?.cliente || {};
        const productos = Array.isArray(entrada?.productos)
            ? entrada.productos.map((producto: any) => ({
                nombre: producto?.datos?.nombre || producto?.nombre || 'Producto',
                cantidad: Number(producto?.cantidad || 1),
                precio: Number(producto?.precio ?? producto?.precio_unitario ?? producto?.precio_unitario_sin_iva ?? producto?.total ?? 0),
                precioUnitario: Number(producto?.precio ?? producto?.precio_unitario ?? producto?.precio_unitario_sin_iva ?? producto?.total ?? 0),
                aplicaIva: Boolean(producto?.aplicaIva ?? producto?.tiene_iva),
                moneda: this.obtenerCodigoMoneda(producto?.moneda || monedaVenta)
            }))
            : [];

        return {
            key: ventaBase?.key || entrada?.key,
            numero_venta: ventaBase?.numero_venta || entrada?.numero_venta,
            fecha: ventaBase?.fecha || entrada?.fecha || entrada?.auditoria?.fechaCreacion || ventaBase?.auditoria?.fechaCreacion,
            tipoVenta: entrada?.tipoVenta || ventaBase?.tipoVenta || entrada?.consulta?.tipoVentaConsulta || 'solo_productos',
            moneda: monedaVenta,
            sede: entrada?.sede || ventaBase?.sede || 'guatire',
            total_pagado: totalPagado,
            total: total,
            estatus_pago: entrada?.estatus_pago || ventaBase?.estatus_pago || (deudaPendiente > 0 ? 'pendiente' : 'completado'),
            estado: ventaBase?.estatus_venta || entrada?.estado || entrada?.estatus_venta || 'completada',
            formaPago: typeof ventaBase?.formaPago === 'string'
                ? ventaBase.formaPago
                : (formaPagoDetalle?.tipo || entrada?.formaPago || 'contado'),
            metodosDePago,
            cliente: {
                informacion: {
                    nombreCompleto: clienteInfo?.nombreCompleto || clienteInfo?.nombre || 'Cliente',
                    cedula: clienteInfo?.cedula || '',
                    telefono: clienteInfo?.telefono || '',
                    email: clienteInfo?.email || ''
                }
            },
            asesor: {
                nombre: entrada?.asesor?.nombre || ventaBase?.asesor?.nombre || entrada?.auditoria?.usuarioCreacion?.nombre || ventaBase?.auditoria?.usuarioCreacion?.nombre || 'Usuario'
            },
            auditoria: {
                usuarioCreacion: {
                    nombre: entrada?.auditoria?.usuarioCreacion?.nombre || ventaBase?.auditoria?.usuarioCreacion?.nombre || 'Usuario'
                },
                fechaCreacion: entrada?.auditoria?.fechaCreacion || ventaBase?.auditoria?.fechaCreacion || ventaBase?.fecha || entrada?.fecha
            },
            formaPagoDetalle: {
                ...formaPagoDetalle,
                abonos: abonosNormalizados,
                tipo: formaPagoDetalle?.tipo || ventaBase?.formaPago || 'contado',
                montoTotal: Number(formaPagoDetalle?.montoTotal ?? total),
                totalPagado: totalPagado,
                deuda: deudaPendiente,
                deudaPendiente: deudaPendiente,
                tasasActuales: tasasHistoricas
            },
            productos,
            consulta: entrada?.consulta || ventaBase?.consulta || null,
            generarOrdenTrabajo: Boolean(entrada?.ordenTrabajo ?? entrada?.generarOrdenTrabajo ?? ventaBase?.generarOrdenTrabajo)
        };
    }

    private normalizarTransaccionManualApi(transaccion: any): Transaccion {
        const moneda = this.obtenerCodigoMoneda(transaccion?.moneda || 'USD');

        return {
            id: transaccion?.id || `TRX-${Date.now()}`,
            tipo: transaccion?.tipo || 'ingreso',
            descripcion: transaccion?.descripcion || 'Transacción manual',
            monto: Number(transaccion?.montoSistema ?? transaccion?.monto ?? 0),
            montoSistema: Number(transaccion?.montoSistema ?? transaccion?.monto ?? 0),
            montoOriginal: Number(transaccion?.monto ?? transaccion?.montoSistema ?? 0),
            fecha: transaccion?.fecha ? new Date(transaccion.fecha) : new Date(),
            metodoPago: transaccion?.metodoPago || 'efectivo',
            moneda,
            monedaOriginal: moneda,
            usuario: transaccion?.usuario || 'Usuario',
            estado: transaccion?.estado || 'confirmado',
            categoria: transaccion?.categoria || 'ajuste',
            observaciones: transaccion?.observaciones || '',
            comprobante: transaccion?.comprobante || '',
            detalleMetodosPago: [
                {
                    tipo: transaccion?.metodoPago || 'efectivo',
                    monto: Number(transaccion?.monto ?? transaccion?.montoSistema ?? 0),
                    moneda,
                    montoEnMonedaSistema: Number(transaccion?.montoSistema ?? transaccion?.monto ?? 0)
                }
            ]
        };
    }

    private normalizarCierreApi(cierre: any): CierreDiario {
        const monedaPrincipal = this.obtenerCodigoMoneda(cierre?.monedaPrincipal || cierre?.moneda || 'USD');
        const transaccionesHistoricas = Array.isArray(cierre?.transacciones)
            ? cierre.transacciones
            : Array.isArray(cierre?.transaccionesManuales)
                ? cierre.transaccionesManuales
                : [];

        return {
            ...cierre,
            fecha: this.crearFechaOperativaLocal(cierre?.fecha),
            fechaApertura: cierre?.fechaApertura ? new Date(cierre.fechaApertura) : new Date(),
            fechaCierre: cierre?.fechaCierre ? new Date(cierre.fechaCierre) : undefined,
            fechaRevision: cierre?.fechaRevision ? new Date(cierre.fechaRevision) : undefined,
            monedaPrincipal,
            efectivoInicial: Number(cierre?.efectivoInicial || 0),
            ventasEfectivo: Number(cierre?.ventasEfectivo || 0),
            ventasTarjeta: Number(cierre?.ventasTarjeta || 0),
            ventasTransferencia: Number(cierre?.ventasTransferencia || 0),
            ventasDebito: Number(cierre?.ventasDebito || 0),
            ventasCredito: Number(cierre?.ventasCredito || 0),
            ventasPagomovil: Number(cierre?.ventasPagomovil || 0),
            ventasZelle: Number(cierre?.ventasZelle || 0),
            otrosIngresos: Number(cierre?.otrosIngresos || 0),
            egresos: Number(cierre?.egresos || 0),
            efectivoFinalTeorico: Number(cierre?.efectivoFinalTeorico || 0),
            efectivoFinalReal: Number(cierre?.efectivoFinalReal || 0),
            diferencia: Number(cierre?.diferencia || 0),
            estadoConciliacion: String(cierre?.estadoConciliacion || cierre?.detalleCierreReal?.estadoConciliacion || '').trim(),
            motivoAnulacion: cierre?.motivoAnulacion || '',
            transacciones: transaccionesHistoricas.map((transaccion: any) => this.normalizarTransaccionManualApi(transaccion)),
            tasasCambio: cierre?.tasasCambio || this.construirTasasCambio(monedaPrincipal),
            ventasPorTipo: cierre?.ventasPorTipo || {
                soloConsulta: { cantidad: 0, total: 0, montoMedico: 0, montoOptica: 0 },
                consultaProductos: { cantidad: 0, total: 0, montoMedico: 0, montoProductos: 0 },
                soloProductos: { cantidad: 0, total: 0 }
            },
            metodosPago: cierre?.metodosPago || {
                efectivo: { total: 0, porMoneda: { dolar: 0, euro: 0, bolivar: 0 }, cantidad: 0 },
                punto: { total: 0, porBanco: [], cantidad: 0 },
                pagomovil: { total: 0, cantidad: 0, porBanco: [] },
                transferencia: { total: 0, cantidad: 0, porBanco: [] },
                zelle: { total: 0, cantidad: 0, porBanco: [] }
            },
            formasPago: cierre?.formasPago || {
                contado: { cantidad: 0, total: 0 },
                abono: { cantidad: 0, total: 0, montoAbonado: 0, deudaPendiente: 0 },
                cashea: { cantidad: 0, total: 0, montoInicial: 0, deudaPendiente: 0, cuotasPendientes: 0 },
                deContadoPendiente: { cantidad: 0, total: 0, deudaPendiente: 0 }
            },
            ventasPendientes: Array.isArray(cierre?.ventasPendientes)
                ? cierre.ventasPendientes.map((venta: any) => ({
                    ...venta,
                    total: Number(venta?.total || 0),
                    deuda: Number(venta?.deuda || 0),
                    fecha: venta?.fecha ? new Date(venta.fecha) : new Date()
                }))
                : [],
            totales: {
                ingresos: Number(cierre?.totales?.ingresos || 0),
                egresos: Number(cierre?.totales?.egresos || 0),
                neto: Number(cierre?.totales?.neto || 0),
                ventasContado: Number(cierre?.totales?.ventasContado || 0),
                ventasCredito: Number(cierre?.totales?.ventasCredito || 0),
                ventasPendientes: Number(cierre?.totales?.ventasPendientes || 0)
            },
            detalleCierreReal: cierre?.detalleCierreReal || undefined,
            metodosPagoDetallados: Array.isArray(cierre?.metodosPagoDetallados) ? cierre.metodosPagoDetallados : []
        } as CierreDiario;
    }

    private normalizarResumenBackend(resumen: any): any {
        const ventasApi = Array.isArray(resumen?.ventas) ? resumen.ventas : [];
        const ventas = ventasApi.map((venta: any) => this.adaptarVentaApi(venta));
        const abonosDelDia = Array.isArray(resumen?.abonosDelDia)
            ? resumen.abonosDelDia.map((abono: any) => this.normalizarAbonoDelDiaApi(abono))
            : [];
        const cierreExistente = resumen?.cierreExistente ? this.normalizarCierreApi(resumen.cierreExistente) : null;
        const transaccionesManuales = Array.isArray(resumen?.transaccionesManuales)
            ? resumen.transaccionesManuales.map((transaccion: any) => this.normalizarTransaccionManualApi(transaccion))
            : [];

        return {
            ...resumen,
            ventas,
            abonosDelDia,
            cierreExistente,
            transaccionesManuales,
            estadisticas: {
                totalVentas: ventas.reduce((sum: number, venta: any) => sum + Number(venta?.total || 0), 0),
                cantidadVentas: ventas.length,
                ...(resumen?.estadisticas || {})
            }
        };
    }

    private normalizarAbonoDelDiaApi(abono: any): any {
        const moneda = this.obtenerCodigoMoneda(abono?.moneda || 'USD');
        const tasasHistoricas = Array.isArray(abono?.tasasActuales) && abono.tasasActuales.length
            ? abono.tasasActuales
            : this.extraerTasasHistoricasDesdeMetodos(Array.isArray(abono?.metodosDePago) ? abono.metodosDePago : []);

        return {
            id: abono?.id || `ABONO-${abono?.ventaKey || Date.now()}`,
            ventaKey: abono?.ventaKey || null,
            numeroVenta: abono?.numeroVenta || null,
            fecha: abono?.fecha ? new Date(abono.fecha) : new Date(),
            montoAbonado: Number(abono?.montoAbonado || 0),
            deudaPendiente: Number(abono?.deudaPendiente || 0),
            observaciones: abono?.observaciones || '',
            moneda,
            totalVenta: Number(abono?.totalVenta || 0),
            formaPago: abono?.formaPago || 'abono',
            sede: abono?.sede || 'guatire',
            tipoVenta: abono?.tipoVenta || 'solo_productos',
            tasasHistoricas,
            metodosDePago: Array.isArray(abono?.metodosDePago)
                ? abono.metodosDePago.map((metodo: any) => this.normalizarMetodoPagoApi(metodo, moneda, tasasHistoricas))
                : [],
            cliente: {
                informacion: {
                    nombreCompleto: abono?.cliente?.nombreCompleto || abono?.cliente?.nombre || 'Cliente',
                    cedula: abono?.cliente?.cedula || '',
                    telefono: abono?.cliente?.telefono || '',
                    email: abono?.cliente?.email || ''
                }
            },
            asesor: typeof abono?.asesor?.nombre === 'string'
                ? { nombre: abono.asesor.nombre }
                : { nombre: abono?.asesor?.nombre || abono?.asesor || abono?.usuario || 'Usuario' },
            usuario: abono?.usuario || abono?.asesor?.nombre || abono?.asesor || 'Usuario'
        };
    }

    private normalizarHistorialBackend(cierres: any): CierreDiario[] {
        const lista = Array.isArray(cierres)
            ? cierres
            : Array.isArray(cierres?.cierres)
                ? cierres.cierres
                : [];

        return lista.map((cierre: any) => this.normalizarCierreApi(cierre));
    }

    private inicializarDatosDummy(): void {
        const hoy = new Date();
        const ayer = new Date(hoy);
        ayer.setDate(hoy.getDate() - 1);
        const anteayer = new Date(hoy);
        anteayer.setDate(hoy.getDate() - 2);

        // Generar ventas para todos los días
        this.generarVentasDiaCompleto(hoy, 'Día Actual');
        this.generarVentasDiaCompleto(ayer, 'Día Anterior');
        this.generarVentasDiaCompleto(anteayer, 'Hace 2 Días');

        // Crear cierres SOLO para días pasados
        this.crearCierreDummy(ayer);
        this.crearCierreDummy(anteayer);
    }

    private generarVentasDiaCompleto(fecha: Date, nombreDia: string): void {
        const horaBase = new Date(fecha);

        // VENTAS EN EFECTIVO USD - Estas deben sumar un monto razonable
        // 1. Venta SOLO CONSULTA - Efectivo USD: 100 USD
        this.crearVentaCompleta(horaBase, 'V-001', 'solo_consulta', 'contado', 'efectivo', 'Carlos Rodríguez', '12345678', 100, 100, 'USD', { medico: 70, optica: 30 });

        // 2. Venta SOLO PRODUCTOS - Efectivo USD: 150 USD
        this.crearVentaCompleta(horaBase, 'V-003', 'solo_productos', 'contado', 'efectivo', 'Juan Gómez', '11223344', 150, 150, 'USD');

        // 3. Venta SOLO CONSULTA - Efectivo USD: 80 USD
        this.crearVentaCompleta(horaBase, 'V-008', 'solo_consulta', 'contado', 'efectivo', 'Pedro Sánchez', '55667788', 80, 80, 'USD', { medico: 56, optica: 24 });

        // 4. Venta SOLO PRODUCTOS - Efectivo USD: 120 USD
        this.crearVentaCompleta(horaBase, 'V-009', 'solo_productos', 'contado', 'efectivo', 'Mónica López', '99887733', 120, 120, 'USD');

        // TOTAL VENTAS EFECTIVO USD = 100 + 150 + 80 + 120 = 450 USD

        // VENTAS EN EFECTIVO VES (se convertirán a USD automáticamente)
        // 5. Venta SOLO CONSULTA - Efectivo VES: 47406 Bs = 100 USD
        this.crearVentaCompleta(horaBase, 'V-010', 'solo_consulta', 'contado', 'efectivo', 'Ana Gómez', '11223445', 47406, 47406, 'VES', { medico: 33184, optica: 14222 });

        // TOTAL VENTAS EFECTIVO VES = 47406 Bs = 100 USD

        // TOTAL GENERAL VENTAS EFECTIVO = 450 USD + 100 USD = 550 USD

        // VENTAS EN EFECTIVO EUR (se convertirán a USD automáticamente)
        // 6. Venta SOLO CONSULTA - Efectivo EUR: 100 EUR = 114.47 USD
        this.crearVentaCompleta(horaBase, 'V-011', 'solo_consulta', 'contado', 'efectivo', 'Marco Pérez', '33445566', 100, 100, 'EUR', { medico: 70, optica: 30 });

        // TOTAL VENTAS EFECTIVO = 450 + 100 + 114.47 = 664.47 USD

        // OTROS MÉTODOS DE PAGO (No afectan el efectivo teórico)
        // Pago Móvil (VES)
        this.crearVentaCompleta(horaBase, 'V-002', 'solo_consulta', 'contado', 'pagomovil', 'María Pérez', '87654321', 47406, 47406, 'VES', { medico: 29629, optica: 17777 }, 'Banco de Venezuela', 'REF-001');

        // Transferencia (VES)
        this.crearVentaCompleta(horaBase, 'V-004', 'solo_productos', 'contado', 'transferencia', 'Ana Martínez', '99887766', 85331, 85331, 'VES', null, 'Banesco', 'TRF-001');

        // Punto de Venta (VES) - BNC
        this.crearVentaCompleta(horaBase, 'V-005', 'consulta_productos', 'contado', 'punto', 'Luis Fernández', '55443322', 213327, 213327, 'VES', { medico: 18962, productos: 194365 }, 'BNC');

        // Punto de Venta (VES) - Provincial
        this.crearVentaCompleta(horaBase, 'V-006', 'consulta_productos', 'contado', 'punto', 'Laura Díaz', '44455566', 151699, 151699, 'VES', { medico: 18962, productos: 132737 }, 'Provincial');

        // Zelle (USD)
        this.crearVentaCompleta(horaBase, 'V-007', 'solo_productos', 'contado', 'zelle', 'Valentina Torres', '22233344', 200, 200, 'USD', undefined, 'Bank of America');
    }

    private crearVentaCompleta(
        fechaBase: Date,
        numeroVenta: string,
        tipoVenta: string,
        formaPago: string,
        metodoPago: string,
        nombreCliente: string,
        cedulaCliente: string,
        total: number,
        pagado: number,
        moneda: string = 'USD',
        desglose?: { medico?: number, optica?: number, productos?: number },
        banco?: string | null,
        referencia?: string | null,
        montoInicial?: number,
        cuotasAdelantadas?: number,
        metodosMultiples?: any[]
    ): void {
        const hora = new Date(fechaBase);
        const horaOffset = Math.floor(Math.random() * 10) + 8;
        hora.setHours(horaOffset, Math.floor(Math.random() * 60), 0);

        const tasasActuales = this.generarTasasHistoricas(hora, numeroVenta);
        const monedaVenta = this.obtenerCodigoMoneda(moneda);

        let metodosDePago: any[] = [];

        if (metodosMultiples) {
            metodosDePago = metodosMultiples.map((metodo: any) => {
                const monedaMetodo = this.obtenerCodigoMoneda(metodo?.moneda || monedaVenta);
                const montoMetodo = Number(metodo?.monto || 0);

                return {
                    ...metodo,
                    moneda: monedaMetodo,
                    monto: montoMetodo,
                    tasaUsada: this.obtenerMapaTasasHistoricas(tasasActuales)[this.normalizarMoneda(monedaMetodo)],
                    montoEnBolivar: this.convertirMontoHistorico(montoMetodo, monedaMetodo, 'VES', tasasActuales),
                    montoEnMonedaVenta: this.convertirMontoHistorico(montoMetodo, monedaMetodo, monedaVenta, tasasActuales),
                    montoEnMonedaSistema: this.convertirMontoHistorico(montoMetodo, monedaMetodo, 'USD', tasasActuales)
                };
            });
        } else if (metodoPago !== 'pendiente') {
            const monedaMetodo = this.obtenerCodigoMoneda(moneda);
            const mapaTasas = this.obtenerMapaTasasHistoricas(tasasActuales);
            const metodo: any = {
                tipo: metodoPago,
                monto: pagado,
                moneda: monedaMetodo,
                tasaUsada: mapaTasas[this.normalizarMoneda(monedaMetodo)],
                montoEnBolivar: this.convertirMontoHistorico(pagado, monedaMetodo, 'VES', tasasActuales),
                montoEnMonedaVenta: this.convertirMontoHistorico(pagado, monedaMetodo, monedaVenta, tasasActuales),
                montoEnMonedaSistema: this.convertirMontoHistorico(pagado, monedaMetodo, 'USD', tasasActuales)
            };

            if (banco && metodoPago === 'punto') {
                metodo.bancoNombre = banco;
                metodo.bancoCodigo = this.obtenerCodigoBancoDemo(banco);
            }

            if (banco && (metodoPago === 'transferencia' || metodoPago === 'pagomovil' || metodoPago === 'zelle')) {
                metodo.bancoReceptorNombre = banco;
                metodo.bancoReceptorCodigo = this.obtenerCodigoBancoDemo(banco);
                metodo.bancoReceptor = banco;
            }
            if (referencia && (metodoPago === 'transferencia' || metodoPago === 'pagomovil')) {
                metodo.referencia = referencia;
            }

            metodosDePago = [metodo];
        }

        let formaPagoDetalle: any = { tipo: formaPago, montoTotal: total };
        formaPagoDetalle.tasasActuales = tasasActuales;
        formaPagoDetalle.totalPagado = pagado;
        formaPagoDetalle.deuda = Math.max(0, total - pagado);

        if (formaPago === 'contado') {
            formaPagoDetalle.totalPagado = pagado;
        } else if (formaPago === 'abono') {
            formaPagoDetalle.montoAbonado = pagado;
            formaPagoDetalle.deudaPendiente = total - pagado;
            formaPagoDetalle.porcentajePagado = (pagado / total) * 100;
        } else if (formaPago === 'cashea') {
            const inicial = montoInicial || pagado;
            const restante = total - inicial;
            const montoPorCuota = restante / 3;
            formaPagoDetalle.nivel = 'nivel3';
            formaPagoDetalle.montoInicial = inicial;
            formaPagoDetalle.cantidadCuotas = '3';
            formaPagoDetalle.montoPorCuota = montoPorCuota;
            formaPagoDetalle.cuotasAdelantadas = cuotasAdelantadas || 0;
            formaPagoDetalle.montoAdelantado = (cuotasAdelantadas || 0) * montoPorCuota;
            formaPagoDetalle.totalPagadoAhora = inicial + ((cuotasAdelantadas || 0) * montoPorCuota);
            formaPagoDetalle.deudaPendiente = restante - ((cuotasAdelantadas || 0) * montoPorCuota);
        } else if (formaPago === 'de_contado-pendiente') {
            formaPagoDetalle.deudaPendiente = total;
        }

        let consulta = null;
        if (tipoVenta !== 'solo_productos') {
            consulta = {
                pagoMedico: desglose?.medico || (tipoVenta === 'solo_consulta' ? total * 0.7 : 40),
                pagoOptica: desglose?.optica || (tipoVenta === 'solo_consulta' ? total * 0.3 : 0)
            };
        }

        this.ventas.push({
            key: `VENTA-${numeroVenta}-${fechaBase.getTime()}-${Math.random()}`,
            numero_venta: numeroVenta,
            fecha: hora.toISOString(),
            tipoVenta: tipoVenta,
            moneda: monedaVenta,
            sede: 'guatire',
            total_pagado: pagado,
            total: total,
            estatus_pago: formaPago === 'de_contado-pendiente' ? 'pendiente' : 'completado',
            estado: 'completada',
            formaPago: formaPago,
            metodosDePago: metodosDePago,
            cliente: {
                informacion: {
                    nombreCompleto: nombreCliente,
                    cedula: cedulaCliente
                }
            },
            asesor: { nombre: 'Asesor Demo' },
            auditoria: {
                usuarioCreacion: { nombre: 'Usuario Demo' },
                fechaCreacion: hora.toISOString()
            },
            formaPagoDetalle: formaPagoDetalle,
            productos: tipoVenta !== 'solo_consulta' ? [{ nombre: 'Producto Demo', cantidad: 1, precio: total - (desglose?.medico || 0) }] : [],
            consulta: consulta,
            generarOrdenTrabajo: formaPago !== 'abono' && formaPago !== 'de_contado-pendiente'
        });
    }

    private crearCierreDummy(fecha: Date): void {
        const fechaStr = this.formatearFechaYYYYMMDD(fecha);
        const sedeKey = 'guatire';
        const id = `CIERRE-${fechaStr}-${sedeKey}`;

        const ventasDelDia = this.ventas.filter(v => {
            const fechaVenta = new Date(v.fecha);
            return fechaVenta.toDateString() === fecha.toDateString();
        });

        // Calcular estadísticas
        const ventasPorTipo = this.calcularVentasPorTipo(ventasDelDia);
        const metodosPago = this.calcularMetodosPagoCompleto(ventasDelDia);
        const formasPago = this.calcularFormasPago(ventasDelDia);
        const ventasPendientes = this.calcularVentasPendientes(ventasDelDia);
        const totales = this.calcularTotales(ventasDelDia);
        const tasasReferencia = this.obtenerTasasReferenciaDesdeVentas() || this.obtenerTasasReferenciaBolivar();
        const tasasHistoricasBase = this.construirTasasHistoricasDesdeReferencia(tasasReferencia);

        const efectivoInicialUSD = this.redondear(
            this.convertirMontoHistorico(100, 'USD', 'USD', tasasHistoricasBase) +
            this.convertirMontoHistorico(200, 'EUR', 'USD', tasasHistoricasBase) +
            this.convertirMontoHistorico(1000, 'VES', 'USD', tasasHistoricasBase)
        );

        const cierre: CierreDiario = {
            id: id,
            fecha: fecha,
            efectivoInicial: efectivoInicialUSD,
            efectivoInicialDetalle: {
                USD: 100,
                EUR: 200,
                Bs: 1000
            },
            ventasEfectivo: metodosPago.efectivo.total,
            ventasTarjeta: metodosPago.punto.total,
            ventasTransferencia: metodosPago.transferencia.total,
            ventasDebito: 0,
            ventasCredito: 0,
            ventasPagomovil: metodosPago.pagomovil.total,
            ventasZelle: metodosPago.zelle.total,
            otrosIngresos: 0,
            egresos: 0,
            efectivoFinalTeorico: efectivoInicialUSD + metodosPago.efectivo.total,
            efectivoFinalReal: 0,
            diferencia: 0,
            observaciones: '',
            estado: fecha.toDateString() === new Date().toDateString() ? 'abierto' : 'cerrado',
            usuarioApertura: 'Usuario Demo',
            usuarioCierre: fecha.toDateString() === new Date().toDateString() ? '' : 'Usuario Demo',
            fechaApertura: new Date(fecha.setHours(8, 0, 0, 0)),
            fechaCierre: fecha.toDateString() === new Date().toDateString() ? undefined : new Date(fecha.setHours(19, 0, 0, 0)),
            transacciones: this.convertirVentasATransacciones(ventasDelDia),
            notasCierre: '',
            archivosAdjuntos: [],
            sede: sedeKey,
            monedaPrincipal: 'USD',
            tasasCambio: this.construirTasasCambio('USD'),
            metodosPagoDetallados: [],
            ventasPorTipo: ventasPorTipo,
            metodosPago: metodosPago,
            formasPago: formasPago,
            ventasPendientes: ventasPendientes,
            totales: totales
        };

        cierre.diferencia = (cierre.efectivoFinalReal || 0) - cierre.efectivoFinalTeorico;

        this.cierres.set(id, cierre);
    }

    private calcularMetodosPagoCompleto(ventas: any[]): any {
        const metodos = {
            efectivo: { total: 0, porMoneda: { dolar: 0, euro: 0, bolivar: 0 }, cantidad: 0 },
            punto: { total: 0, porBanco: [] as any[], cantidad: 0 },
            pagomovil: { total: 0, cantidad: 0, porBanco: [] as any[] },
            transferencia: { total: 0, cantidad: 0, porBanco: [] as any[] },
            zelle: { total: 0, cantidad: 0, porBanco: [] as any[] }
        };

        ventas.forEach(v => {
            const tasasHistoricas = v?.formaPagoDetalle?.tasasActuales || v?.formaPago?.tasasActuales || [];
            if (v.metodosDePago && v.metodosDePago.length > 0) {
                v.metodosDePago.forEach((m: any) => {
                    const monto = Number(m.monto || v.total_pagado || v.total || 0);
                    const moneda = this.obtenerCodigoMoneda(m.moneda || v.moneda || 'USD');
                    const montoEnUSD = this.convertirMontoHistorico(monto, moneda, 'USD', tasasHistoricas);

                    if (m.tipo === 'efectivo') {
                        metodos.efectivo.total += montoEnUSD;
                        metodos.efectivo.cantidad++;
                        if (moneda === 'USD') metodos.efectivo.porMoneda.dolar += monto;
                        else if (moneda === 'EUR') metodos.efectivo.porMoneda.euro += monto;
                        else metodos.efectivo.porMoneda.bolivar += monto;
                    }
                    else if (m.tipo === 'punto') {
                        metodos.punto.total += montoEnUSD;
                        metodos.punto.cantidad++;
                        const destino = this.obtenerDestinoReceptorAgrupado(m, 'punto', moneda);
                        let bancoExistente = metodos.punto.porBanco.find(b => b.destinoKey === destino.destinoKey);
                        if (!bancoExistente) {
                            bancoExistente = { ...destino, total: 0, totalOriginal: 0, cantidad: 0 };
                            metodos.punto.porBanco.push(bancoExistente);
                        }
                        bancoExistente.total += montoEnUSD;
                        bancoExistente.totalOriginal += monto;
                        bancoExistente.cantidad++;
                    }
                    else if (m.tipo === 'pagomovil') {
                        metodos.pagomovil.total += montoEnUSD;
                        metodos.pagomovil.cantidad++;
                        const destino = this.obtenerDestinoReceptorAgrupado(m, 'pagomovil', moneda);
                        let bancoExistente = metodos.pagomovil.porBanco.find(b => b.destinoKey === destino.destinoKey);
                        if (!bancoExistente) {
                            bancoExistente = { ...destino, total: 0, totalOriginal: 0, cantidad: 0 };
                            metodos.pagomovil.porBanco.push(bancoExistente);
                        }
                        bancoExistente.total += montoEnUSD;
                        bancoExistente.totalOriginal += monto;
                        bancoExistente.cantidad++;
                    }
                    else if (m.tipo === 'transferencia') {
                        metodos.transferencia.total += montoEnUSD;
                        metodos.transferencia.cantidad++;
                        const destino = this.obtenerDestinoReceptorAgrupado(m, 'transferencia', moneda);
                        let bancoExistente = metodos.transferencia.porBanco.find(b => b.destinoKey === destino.destinoKey);
                        if (!bancoExistente) {
                            bancoExistente = { ...destino, total: 0, totalOriginal: 0, cantidad: 0 };
                            metodos.transferencia.porBanco.push(bancoExistente);
                        }
                        bancoExistente.total += montoEnUSD;
                        bancoExistente.totalOriginal += monto;
                        bancoExistente.cantidad++;
                    }
                    else if (m.tipo === 'zelle') {
                        metodos.zelle.total += montoEnUSD;
                        metodos.zelle.cantidad++;
                        const destino = this.obtenerDestinoReceptorAgrupado(m, 'zelle', moneda);
                        let bancoExistente = metodos.zelle.porBanco.find(b => b.destinoKey === destino.destinoKey);
                        if (!bancoExistente) {
                            bancoExistente = { ...destino, total: 0, totalOriginal: 0, cantidad: 0 };
                            metodos.zelle.porBanco.push(bancoExistente);
                        }
                        bancoExistente.total += montoEnUSD;
                        bancoExistente.totalOriginal += monto;
                        bancoExistente.cantidad++;
                    }
                });
            }
        });

        return metodos;
    }
    
    private calcularVentasPorTipo(ventas: any[]): any {
        const resultado = {
            soloConsulta: { cantidad: 0, total: 0, montoMedico: 0, montoOptica: 0 },
            consultaProductos: { cantidad: 0, total: 0, montoMedico: 0, montoProductos: 0 },
            soloProductos: { cantidad: 0, total: 0 }
        };

        ventas.forEach(v => {
            const monedaVenta = v.moneda || 'USD';
            const tasasHistoricas = v?.formaPagoDetalle?.tasasActuales || v?.formaPago?.tasasActuales || [];
            const totalSistema = this.convertirMontoHistorico(v.total || 0, monedaVenta, 'USD', tasasHistoricas);
            const montoMedicoSistema = this.convertirMontoHistorico(v.consulta?.pagoMedico || 0, monedaVenta, 'USD', tasasHistoricas);
            const montoOpticaSistema = this.convertirMontoHistorico(v.consulta?.pagoOptica || 0, monedaVenta, 'USD', tasasHistoricas);
            const totalProductosSistema = this.convertirMontoHistorico(
                v.productos?.reduce((sum: number, p: any) => sum + ((p.precio || 0) * (p.cantidad || 1)), 0) || 0,
                monedaVenta,
                'USD',
                tasasHistoricas
            );

            if (v.tipoVenta === 'solo_consulta') {
                resultado.soloConsulta.cantidad++;
                resultado.soloConsulta.total += totalSistema;
                resultado.soloConsulta.montoMedico += montoMedicoSistema;
                resultado.soloConsulta.montoOptica += montoOpticaSistema;
            } else if (v.tipoVenta === 'consulta_productos') {
                resultado.consultaProductos.cantidad++;
                resultado.consultaProductos.total += totalSistema;
                resultado.consultaProductos.montoMedico += montoMedicoSistema;
                resultado.consultaProductos.montoProductos += totalProductosSistema;
            } else if (v.tipoVenta === 'solo_productos') {
                resultado.soloProductos.cantidad++;
                resultado.soloProductos.total += totalSistema;
            }
        });

        return resultado;
    }

    private calcularFormasPago(ventas: any[]): any {
        const formas = {
            contado: { cantidad: 0, total: 0 },
            abono: { cantidad: 0, total: 0, montoAbonado: 0, deudaPendiente: 0 },
            cashea: { cantidad: 0, total: 0, montoInicial: 0, deudaPendiente: 0, cuotasPendientes: 0 },
            deContadoPendiente: { cantidad: 0, total: 0, deudaPendiente: 0 }
        };

        ventas.forEach(v => {
            const fp = v.formaPago;
            const monedaVenta = v.moneda || 'USD';
            const tasasHistoricas = v?.formaPagoDetalle?.tasasActuales || v?.formaPago?.tasasActuales || [];
            const total = this.convertirMontoHistorico(v.total || 0, monedaVenta, 'USD', tasasHistoricas);
            const pagado = this.convertirMontoHistorico(v.total_pagado || 0, monedaVenta, 'USD', tasasHistoricas);
            const deuda = this.convertirMontoHistorico((v.total || 0) - (v.total_pagado || 0), monedaVenta, 'USD', tasasHistoricas);

            if (fp === 'contado') {
                formas.contado.cantidad++;
                formas.contado.total += pagado;
            } else if (fp === 'abono') {
                formas.abono.cantidad++;
                formas.abono.total += total;
                formas.abono.montoAbonado += pagado;
                formas.abono.deudaPendiente += deuda;
            } else if (fp === 'cashea') {
                formas.cashea.cantidad++;
                formas.cashea.total += total;
                formas.cashea.montoInicial += this.convertirMontoHistorico(v.formaPagoDetalle?.montoInicial || (v.total_pagado || 0), monedaVenta, 'USD', tasasHistoricas);
                formas.cashea.deudaPendiente += this.convertirMontoHistorico(v.formaPagoDetalle?.deudaPendiente || ((v.total || 0) - (v.total_pagado || 0)), monedaVenta, 'USD', tasasHistoricas);
                formas.cashea.cuotasPendientes += 3 - (v.formaPagoDetalle?.cuotasAdelantadas || 0);
            } else if (fp === 'de_contado-pendiente') {
                formas.deContadoPendiente.cantidad++;
                formas.deContadoPendiente.total += total;
                formas.deContadoPendiente.deudaPendiente += deuda || total;
            }
        });

        return formas;
    }

    private calcularVentasPendientes(ventas: any[]): any[] {
        return ventas
            .filter(v => v.formaPago === 'de_contado-pendiente' ||
                (v.formaPago === 'abono' && v.total > (v.total_pagado || 0)) ||
                (v.formaPago === 'cashea' && v.total > (v.total_pagado || 0)))
            .map(v => {
                const monedaVenta = v.moneda || 'USD';
                const tasasHistoricas = v?.formaPagoDetalle?.tasasActuales || v?.formaPago?.tasasActuales || [];

                return ({
                numeroVenta: v.numero_venta,
                cliente: v.cliente?.informacion?.nombreCompleto || 'Cliente',
                total: this.convertirMontoHistorico(v.total || 0, monedaVenta, 'USD', tasasHistoricas),
                formaPago: v.formaPago === 'de_contado-pendiente' ? 'Pendiente' :
                    (v.formaPago === 'abono' ? 'Abono' : 'Cashea'),
                deuda: this.convertirMontoHistorico((v.total || 0) - (v.total_pagado || 0), monedaVenta, 'USD', tasasHistoricas),
                fecha: new Date(v.fecha)
                });
            });
    }

    private calcularTotales(ventas: any[]): any {
        const ingresos = ventas.reduce((sum, v) => {
            const tasasHistoricas = v?.formaPagoDetalle?.tasasActuales || v?.formaPago?.tasasActuales || [];
            return sum + this.convertirMontoHistorico(v.total_pagado || v.total || 0, v.moneda || 'USD', 'USD', tasasHistoricas);
        }, 0);
        const pendientes = ventas.filter(v => v.formaPago === 'de_contado-pendiente').reduce((sum, v) => {
            const tasasHistoricas = v?.formaPagoDetalle?.tasasActuales || v?.formaPago?.tasasActuales || [];
            return sum + this.convertirMontoHistorico(v.total || 0, v.moneda || 'USD', 'USD', tasasHistoricas);
        }, 0);
        const credito = ventas.filter(v => v.formaPago === 'abono' || v.formaPago === 'cashea')
            .reduce((sum, v) => {
                const tasasHistoricas = v?.formaPagoDetalle?.tasasActuales || v?.formaPago?.tasasActuales || [];
                return sum + this.convertirMontoHistorico((v.total || 0) - (v.total_pagado || 0), v.moneda || 'USD', 'USD', tasasHistoricas);
            }, 0);

        return {
            ingresos: ingresos,
            egresos: 0,
            neto: ingresos,
            ventasContado: ventas.filter(v => v.formaPago === 'contado').reduce((sum, v) => {
                const tasasHistoricas = v?.formaPagoDetalle?.tasasActuales || v?.formaPago?.tasasActuales || [];
                return sum + this.convertirMontoHistorico(v.total_pagado || v.total || 0, v.moneda || 'USD', 'USD', tasasHistoricas);
            }, 0),
            ventasCredito: credito,
            ventasPendientes: pendientes
        };
    }

    private convertirVentasATransacciones(ventas: any[]): Transaccion[] {
        return ventas.map(v => ({
            id: v.key,
            tipo: 'venta',
            descripcion: `Venta #${v.numero_venta} - ${v.cliente?.informacion?.nombreCompleto || 'Cliente'}`,
            monto: v.total_pagado || v.total,
            montoOriginal: v.total_pagado || v.total,
            montoTotal: v.total,
            montoPagado: v.total_pagado || 0,
            deudaPendiente: Math.max(0, (v.total || 0) - (v.total_pagado || 0)),
            fecha: new Date(v.fecha),
            metodoPago: v.metodosDePago?.length ? v.metodosDePago[0].tipo : 'pendiente',
            moneda: v.moneda,
            monedaOriginal: v.moneda,
            tasasHistoricas: v?.formaPagoDetalle?.tasasActuales || v?.formaPago?.tasasActuales || [],
            usuario: v.asesor?.nombre || 'Usuario',
            estado: 'confirmado',
            categoria: 'venta',
            numeroVenta: v.numero_venta,
            cliente: {
                nombre: v.cliente?.informacion?.nombreCompleto || 'Cliente',
                cedula: v.cliente?.informacion?.cedula || ''
            },
            formaPago: v.formaPago,
            detalleMetodosPago: v.metodosDePago,
            productos: v.productos,
            asesor: v.asesor?.nombre,
            ordenTrabajoGenerada: v.generarOrdenTrabajo,
            tipoVenta: v.tipoVenta,
            consulta: v.consulta
        }));
    }

    obtenerResumenDiario(fecha: Date, sede: string): Observable<any> {
        if (this.usarDummy) {
            const fechaStr = this.formatearFechaYYYYMMDD(fecha);
            const idCierre = `CIERRE-${fechaStr}-${sede}`;

            const ventasDelDia = this.ventas.filter(v => {
                const fechaVenta = new Date(v.fecha);
                return fechaVenta.toDateString() === fecha.toDateString();
            });

            const esHoy = fecha.toDateString() === new Date().toDateString();
            const cierreExistente = esHoy ? null : (this.cierres.get(idCierre) || null);

            return of({
                ventas: ventasDelDia,
                cierreExistente: cierreExistente,
                estadisticas: {
                    totalVentas: ventasDelDia.reduce((sum, v) => sum + v.total, 0),
                    cantidadVentas: ventasDelDia.length
                }
            }).pipe(delay(500));
        }
        return this.http.get(`${this.apiUrl}/cierre-caja/resumen`, {
            params: {
                fecha: this.formatearFechaYYYYMMDD(fecha),
                sede: sede
            }
        }).pipe(
            map((response: any) => this.normalizarResumenBackend(response))
        );
    }

    abrirCaja(payload: {
        fecha: Date;
        sede: string;
        efectivoInicial: {
            totalSistema: number;
            detalle: {
                Bs: number;
                USD: number;
                EUR: number;
            };
        };
        tasasCambio: TasasCambio;
        observaciones?: string;
    }): Observable<any> {
        if (this.usarDummy) {
            return of({ message: 'ok' }).pipe(delay(500));
        }

        return this.http.post(`${this.apiUrl}/cierre-caja/apertura`, {
            ...payload,
            fecha: this.formatearFechaYYYYMMDD(payload.fecha)
        });
    }

    crearTransaccionManual(cierreId: string, payload: Partial<Transaccion>): Observable<any> {
        if (this.usarDummy) {
            return of({ message: 'ok' }).pipe(delay(300));
        }

        return this.http.post(`${this.apiUrl}/cierre-caja/transacciones-manuales`, {
            cierreId,
            fecha: payload.fecha instanceof Date ? payload.fecha.toISOString() : payload.fecha,
            tipo: payload.tipo,
            descripcion: payload.descripcion,
            monto: Number(payload.montoOriginal ?? payload.monto ?? 0),
            moneda: payload.monedaOriginal || payload.moneda || 'USD',
            montoSistema: Number(payload.montoSistema ?? payload.monto ?? 0),
            metodoPago: payload.metodoPago,
            categoria: payload.categoria,
            observaciones: payload.observaciones,
            comprobante: payload.comprobante
        });
    }

    actualizarTransaccionManual(transaccionId: string, payload: Partial<Transaccion>): Observable<any> {
        if (this.usarDummy) {
            return of({ message: 'ok' }).pipe(delay(300));
        }

        return this.http.put(`${this.apiUrl}/cierre-caja/transacciones-manuales/${transaccionId}`, {
            descripcion: payload.descripcion,
            monto: Number(payload.montoOriginal ?? payload.monto ?? 0),
            moneda: payload.monedaOriginal || payload.moneda || 'USD',
            montoSistema: Number(payload.montoSistema ?? payload.monto ?? 0),
            metodoPago: payload.metodoPago,
            categoria: payload.categoria,
            observaciones: payload.observaciones,
            comprobante: payload.comprobante
        });
    }

    cerrarCaja(payload: any): Observable<any> {
        if (this.usarDummy) {
            this.cierres.set(payload.cierreId, payload);
            return of({ message: 'ok', cierre: payload }).pipe(delay(500));
        }

        return this.http.post(`${this.apiUrl}/cierre-caja/cerrar`, payload);
    }

    guardarCierre(cierre: CierreDiario): Observable<any> {
        if (this.usarDummy) {
            this.cierres.set(cierre.id, cierre);
            return of({ message: 'ok', cierre: cierre }).pipe(delay(500));
        }
        return throwError(() => new Error('El backend no expone un guardado parcial del cierre. Usa el cierre final para persistir la conciliación.'));
    }

    obtenerHistorialCierres(fechaInicio: Date, fechaFin: Date, sede: string): Observable<CierreDiario[]> {
        if (this.usarDummy) {
            const cierresFiltrados: CierreDiario[] = [];
            this.cierres.forEach(cierre => {
                if (cierre.sede === sede && cierre.fecha >= fechaInicio && cierre.fecha <= fechaFin) {
                    cierresFiltrados.push(cierre);
                }
            });
            return of(cierresFiltrados).pipe(delay(500));
        }
        return this.http.get<CierreDiario[]>(`${this.apiUrl}/cierre-caja/historial`, {
            params: {
                fechaInicio: this.formatearFechaYYYYMMDD(fechaInicio),
                fechaFin: this.formatearFechaYYYYMMDD(fechaFin),
                sede: sede
            }
        }).pipe(
            map((response: any) => this.normalizarHistorialBackend(response))
        );
    }

    anularCierre(id: string, motivo: string): Observable<any> {
        if (this.usarDummy) {
            const cierre = this.cierres.get(id);
            if (cierre) {
                cierre.estado = 'revisado';
                cierre.observaciones = motivo;
                this.cierres.set(id, cierre);
                return of({ message: 'ok', cierre: cierre }).pipe(delay(500));
            }
            return throwError(() => new Error('Cierre no encontrado'));
        }
        return this.http.post(`${this.apiUrl}/cierre-caja/anular/${id}`, { motivo });
    }

    obtenerTasasCambio(): Observable<TasasCambio> {
        if (this.usarDummy) {
            return of(this.construirTasasCambio('USD')).pipe(delay(300));
        }
        return this.http.get<TasasCambio>(`${this.apiUrl}/tasas-cambio`);
    }
}