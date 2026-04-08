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
    private usarDummy: boolean = true;
    private cierres: Map<string, CierreDiario> = new Map();
    private ventas: any[] = [];

    // Tasas de cambio reales
    private readonly TASA_USD_A_VES = 474.0598;  // 1 USD = 474.06 Bs
    private readonly TASA_EUR_A_VES = 542.6382; // 1 EUR = 542.64 Bs
    private readonly TASA_EUR_A_USD = 1.1447;   // 1 EUR = 1.1447 USD

    constructor(private http: HttpClient) {
        this.inicializarDatosDummy();
    }

    private formatearFechaYYYYMMDD(fecha: Date): string {
        const year = fecha.getFullYear();
        const month = String(fecha.getMonth() + 1).padStart(2, '0');
        const day = String(fecha.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
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
        this.crearVentaCompleta(horaBase, 'V-007', 'solo_productos', 'contado', 'zelle', 'Valentina Torres', '22233344', 200, 200, 'USD');
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

        let metodosDePago: any[] = [];

        if (metodosMultiples) {
            metodosDePago = metodosMultiples;
        } else if (metodoPago !== 'pendiente') {
            const metodo: any = {
                tipo: metodoPago,
                monto: pagado,
                moneda: moneda.toLowerCase()
            };

            if (banco && (metodoPago === 'punto' || metodoPago === 'transferencia' || metodoPago === 'pagomovil')) {
                metodo.bancoNombre = banco;
                metodo.bancoCodigo = banco === 'BNC' ? '0114' : banco === 'Provincial' ? '0108' : '0102';
            }
            if (referencia && (metodoPago === 'transferencia' || metodoPago === 'pagomovil')) {
                metodo.referencia = referencia;
            }

            metodosDePago = [metodo];
        }

        let formaPagoDetalle: any = { tipo: formaPago, montoTotal: total };

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
            moneda: moneda,
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

        // Efectivo inicial en USD (100 USD + 200 EUR convertidos + 1000 Bs convertidos)
        const efectivoInicialUSD = 100 + (200 * this.TASA_EUR_A_USD) + (1000 / this.TASA_USD_A_VES);
        // = 100 + 228.94 + 2.11 = 331.05 USD

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
            tasasCambio: { dolar: 1, euro: this.TASA_EUR_A_USD, bolivar: 1 / this.TASA_USD_A_VES },
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
            zelle: { total: 0, cantidad: 0 },
            mixto: { total: 0, cantidad: 0 }
        };

        ventas.forEach(v => {
            if (v.metodosDePago && v.metodosDePago.length > 0) {
                v.metodosDePago.forEach((m: any) => {
                    let monto = m.monto || v.total_pagado || v.total;
                    const moneda = m.moneda || v.moneda || 'USD';

                    // Convertir a USD para almacenar en el total
                    let montoEnUSD = monto;
                    if (moneda === 'VES') {
                        montoEnUSD = monto / this.TASA_USD_A_VES;
                    } else if (moneda === 'EUR') {
                        montoEnUSD = monto / this.TASA_EUR_A_USD;
                    }

                    if (m.tipo === 'efectivo') {
                        metodos.efectivo.total += montoEnUSD;
                        metodos.efectivo.cantidad++;
                        if (moneda === 'USD') metodos.efectivo.porMoneda.dolar += monto;
                        else if (moneda === 'EUR') metodos.efectivo.porMoneda.euro += monto;
                        else if (moneda === 'VES') metodos.efectivo.porMoneda.bolivar += monto;

                        console.log(`Venta efectivo: ${monto} ${moneda} = ${montoEnUSD} USD`);
                    }
                    else if (m.tipo === 'punto') {
                        const montoEnUSD = monto / this.TASA_USD_A_VES;
                        metodos.punto.total += montoEnUSD;
                        metodos.punto.cantidad++;
                        const banco = m.bancoNombre || 'Otro';
                        let bancoExistente = metodos.punto.porBanco.find(b => b.banco === banco);
                        if (!bancoExistente) {
                            bancoExistente = { banco, bancoCodigo: m.bancoCodigo || '', total: 0, cantidad: 0 };
                            metodos.punto.porBanco.push(bancoExistente);
                        }
                        bancoExistente.total += monto;
                        bancoExistente.cantidad++;
                    }
                    else if (m.tipo === 'pagomovil') {
                        const montoEnUSD = monto / this.TASA_USD_A_VES;
                        metodos.pagomovil.total += montoEnUSD;
                        metodos.pagomovil.cantidad++;
                        if (m.bancoNombre) {
                            let bancoExistente = metodos.pagomovil.porBanco.find(b => b.banco === m.bancoNombre);
                            if (!bancoExistente) {
                                bancoExistente = { banco: m.bancoNombre, bancoCodigo: m.bancoCodigo || '', total: 0, cantidad: 0 };
                                metodos.pagomovil.porBanco.push(bancoExistente);
                            }
                            bancoExistente.total += monto;
                            bancoExistente.cantidad++;
                        }
                    }
                    else if (m.tipo === 'transferencia') {
                        const montoEnUSD = monto / this.TASA_USD_A_VES;
                        metodos.transferencia.total += montoEnUSD;
                        metodos.transferencia.cantidad++;
                        if (m.bancoNombre) {
                            let bancoExistente = metodos.transferencia.porBanco.find(b => b.banco === m.bancoNombre);
                            if (!bancoExistente) {
                                bancoExistente = { banco: m.bancoNombre, bancoCodigo: m.bancoCodigo || '', total: 0, cantidad: 0 };
                                metodos.transferencia.porBanco.push(bancoExistente);
                            }
                            bancoExistente.total += monto;
                            bancoExistente.cantidad++;
                        }
                    }
                    else if (m.tipo === 'zelle') {
                        metodos.zelle.total += monto;
                        metodos.zelle.cantidad++;
                    }
                });
            }
        });

        console.log('Total ventas efectivo en USD:', metodos.efectivo.total);

        return metodos;
    }
    
    private calcularVentasPorTipo(ventas: any[]): any {
        const resultado = {
            soloConsulta: { cantidad: 0, total: 0, montoMedico: 0, montoOptica: 0 },
            consultaProductos: { cantidad: 0, total: 0, montoMedico: 0, montoProductos: 0 },
            soloProductos: { cantidad: 0, total: 0 }
        };

        ventas.forEach(v => {
            if (v.tipoVenta === 'solo_consulta') {
                resultado.soloConsulta.cantidad++;
                resultado.soloConsulta.total += v.total;
                resultado.soloConsulta.montoMedico += v.consulta?.pagoMedico || 0;
                resultado.soloConsulta.montoOptica += v.consulta?.pagoOptica || 0;
            } else if (v.tipoVenta === 'consulta_productos') {
                resultado.consultaProductos.cantidad++;
                resultado.consultaProductos.total += v.total;
                resultado.consultaProductos.montoMedico += v.consulta?.pagoMedico || 0;
                const totalProductos = v.productos?.reduce((sum: number, p: any) => sum + (p.precio * p.cantidad), 0) || 0;
                resultado.consultaProductos.montoProductos += totalProductos;
            } else if (v.tipoVenta === 'solo_productos') {
                resultado.soloProductos.cantidad++;
                resultado.soloProductos.total += v.total;
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
            const total = v.total;
            const pagado = v.total_pagado || 0;

            if (fp === 'contado') {
                formas.contado.cantidad++;
                formas.contado.total += pagado;
            } else if (fp === 'abono') {
                formas.abono.cantidad++;
                formas.abono.total += total;
                formas.abono.montoAbonado += pagado;
                formas.abono.deudaPendiente += total - pagado;
            } else if (fp === 'cashea') {
                formas.cashea.cantidad++;
                formas.cashea.total += total;
                formas.cashea.montoInicial += v.formaPagoDetalle?.montoInicial || pagado;
                formas.cashea.deudaPendiente += v.formaPagoDetalle?.deudaPendiente || (total - pagado);
                formas.cashea.cuotasPendientes += 3 - (v.formaPagoDetalle?.cuotasAdelantadas || 0);
            } else if (fp === 'de_contado-pendiente') {
                formas.deContadoPendiente.cantidad++;
                formas.deContadoPendiente.total += total;
                formas.deContadoPendiente.deudaPendiente += total;
            }
        });

        return formas;
    }

    private calcularVentasPendientes(ventas: any[]): any[] {
        return ventas
            .filter(v => v.formaPago === 'de_contado-pendiente' ||
                (v.formaPago === 'abono' && v.total > (v.total_pagado || 0)) ||
                (v.formaPago === 'cashea' && v.total > (v.total_pagado || 0)))
            .map(v => ({
                numeroVenta: v.numero_venta,
                cliente: v.cliente?.informacion?.nombreCompleto || 'Cliente',
                total: v.total,
                formaPago: v.formaPago === 'de_contado-pendiente' ? 'Pendiente' :
                    (v.formaPago === 'abono' ? 'Abono' : 'Cashea'),
                deuda: v.total - (v.total_pagado || 0),
                fecha: new Date(v.fecha)
            }));
    }

    private calcularTotales(ventas: any[]): any {
        const ingresos = ventas.reduce((sum, v) => sum + (v.total_pagado || v.total), 0);
        const pendientes = ventas.filter(v => v.formaPago === 'de_contado-pendiente').reduce((sum, v) => sum + v.total, 0);
        const credito = ventas.filter(v => v.formaPago === 'abono' || v.formaPago === 'cashea')
            .reduce((sum, v) => sum + (v.total - (v.total_pagado || 0)), 0);

        return {
            ingresos: ingresos,
            egresos: 0,
            neto: ingresos,
            ventasContado: ventas.filter(v => v.formaPago === 'contado').reduce((sum, v) => sum + (v.total_pagado || v.total), 0),
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
            fecha: new Date(v.fecha),
            metodoPago: v.metodosDePago?.length === 1 ? v.metodosDePago[0].tipo : 'mixto',
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
            ordenTrabajoGenerada: v.generarOrdenTrabajo
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
                fecha: fecha.toISOString().split('T')[0],
                sede: sede
            }
        });
    }

    guardarCierre(cierre: CierreDiario): Observable<any> {
        if (this.usarDummy) {
            this.cierres.set(cierre.id, cierre);
            return of({ message: 'ok', cierre: cierre }).pipe(delay(500));
        }
        return this.http.post(`${this.apiUrl}/cierre-caja`, cierre);
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
                fechaInicio: fechaInicio.toISOString().split('T')[0],
                fechaFin: fechaFin.toISOString().split('T')[0],
                sede: sede
            }
        });
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
            return of({
                dolar: 1,
                euro: this.TASA_EUR_A_USD,
                bolivar: 1 / this.TASA_USD_A_VES
            }).pipe(delay(300));
        }
        return this.http.get<TasasCambio>(`${this.apiUrl}/tasas-cambio`);
    }
}