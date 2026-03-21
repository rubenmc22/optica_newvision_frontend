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

    constructor(private http: HttpClient) {
        this.inicializarDatosDummy();
    }

    private formatearFechaYYYYMMDD(fecha: Date): string {
        const year = fecha.getFullYear();
        const month = String(fecha.getMonth() + 1).padStart(2, '0');
        const day = String(fecha.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // En cierre-caja.service.ts - Asegúrate de que NO se crea cierre para hoy
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
        // NO crear cierre para el día actual
        this.crearCierreDummy(ayer);
        this.crearCierreDummy(anteayer);
        // this.crearCierreDummy(hoy); ← COMENTADO
    }

    private generarVentasDiaCompleto(fecha: Date, nombreDia: string): void {
        const horaBase = new Date(fecha);

        // 1. Venta SOLO CONSULTA - Contado en Efectivo
        this.crearVentaCompleta(horaBase, 'V-001', 'solo_consulta', 'contado', 'efectivo', 'Carlos Rodríguez', '12345678', 60, 60, { medico: 40, optica: 20 });

        // 2. Venta SOLO CONSULTA - Pago Móvil
        this.crearVentaCompleta(horaBase, 'V-002', 'solo_consulta', 'contado', 'pagomovil', 'María Pérez', '87654321', 80, 80, { medico: 50, optica: 30 }, 'Banco de Venezuela', 'REF-001');

        // 3. Venta SOLO PRODUCTOS - Contado en Efectivo
        this.crearVentaCompleta(horaBase, 'V-003', 'solo_productos', 'contado', 'efectivo', 'Juan Gómez', '11223344', 250, 250);

        // 4. Venta SOLO PRODUCTOS - Transferencia Bancaria
        this.crearVentaCompleta(horaBase, 'V-004', 'solo_productos', 'contado', 'transferencia', 'Ana Martínez', '99887766', 180, 180, null, 'Banesco', 'TRF-001');

        // 5. Venta CONSULTA + PRODUCTOS - Punto de Venta (BNC)
        this.crearVentaCompleta(horaBase, 'V-005', 'consulta_productos', 'contado', 'punto', 'Luis Fernández', '55443322', 450, 450, { medico: 40, productos: 410 }, 'BNC');

        // 6. Venta CONSULTA + PRODUCTOS - Punto de Venta (Provincial)
        this.crearVentaCompleta(horaBase, 'V-006', 'consulta_productos', 'contado', 'punto', 'Laura Díaz', '44455566', 320, 320, { medico: 40, productos: 280 }, 'Provincial');

        // 7. Venta con ABONO - Efectivo
        this.crearVentaCompleta(horaBase, 'V-007', 'consulta_productos', 'abono', 'efectivo', 'Roberto Castro', '77788899', 500, 200, { medico: 40, productos: 460 }, null, null, 200);

        // 8. Venta con CASHEA - Efectivo
        this.crearVentaCompleta(horaBase, 'V-008', 'consulta_productos', 'cashea', 'efectivo', 'Sofía López', '33344455', 600, 240, { medico: 40, productos: 560 }, null, null, 240, 2);

        // 9. Venta con PAGO PENDIENTE
        this.crearVentaCompleta(horaBase, 'V-009', 'consulta_productos', 'de_contado-pendiente', 'pendiente', 'Diego Ramírez', '99900011', 350, 0, { medico: 40, productos: 310 });

        // 10. Venta con ZELLE
        this.crearVentaCompleta(horaBase, 'V-010', 'solo_productos', 'contado', 'zelle', 'Valentina Torres', '22233344', 420, 420);

        // 11. Venta con PAGO MIXTO (Efectivo + Transferencia)
        this.crearVentaCompleta(horaBase, 'V-011', 'consulta_productos', 'contado', 'mixto', 'Andrés Mendoza', '55566677', 380, 380, { medico: 40, productos: 340 }, null, null, 380, 0, [
            { tipo: 'efectivo', monto: 200, moneda: 'dolar' },
            { tipo: 'transferencia', monto: 180, moneda: 'dolar', banco: 'Mercantil', referencia: 'MIX-001' }
        ]);
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
                moneda: metodoPago === 'transferencia' || metodoPago === 'pagomovil' ? 'bolivar' : 'dolar'
            };

            if (banco && (metodoPago === 'punto' || metodoPago === 'transferencia' || metodoPago === 'pagomovil')) {
                metodo.bancoNombre = banco;
                metodo.bancoCodigo = banco === 'BNC' ? '0114' : banco === 'Provincial' ? '0108' : '0102';
            }
            if (referencia && (metodoPago === 'transferencia' || metodoPago === 'pagomovil')) {
                metodo.referencia = referencia;
            }
            if (metodoPago === 'punto') {
                metodo.bancoPunto = banco === 'BNC' ? 'bnc' : 'provincial';
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
            moneda: 'dolar',
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

        const efectivoInicial = Math.floor(Math.random() * 500) + 100;
        const ventasEfectivo = metodosPago.efectivo.total;
        const efectivoFinalTeorico = efectivoInicial + ventasEfectivo;

        const cierre: CierreDiario = {
            id: id,
            fecha: fecha,
            efectivoInicial: efectivoInicial,
            ventasEfectivo: ventasEfectivo,
            ventasTarjeta: metodosPago.punto.total,
            ventasTransferencia: metodosPago.transferencia.total,
            ventasDebito: 0,
            ventasCredito: 0,
            ventasPagomovil: metodosPago.pagomovil.total,
            ventasZelle: metodosPago.zelle.total,
            otrosIngresos: 0,
            egresos: 0,
            efectivoFinalTeorico: efectivoFinalTeorico,
            efectivoFinalReal: efectivoFinalTeorico + (Math.random() * 20 - 10),
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
            tasasCambio: { dolar: 1, euro: 1.05, bolivar: 60.5 },
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

    // Métodos auxiliares de cálculo (mantener los que ya tenías)
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
                if (v.metodosDePago.length > 1) {
                    metodos.mixto.total += v.total_pagado || v.total;
                    metodos.mixto.cantidad++;
                }

                v.metodosDePago.forEach((m: any) => {
                    const monto = m.monto || v.total_pagado || v.total;

                    if (m.tipo === 'efectivo') {
                        metodos.efectivo.total += monto;
                        metodos.efectivo.cantidad++;
                        metodos.efectivo.porMoneda.dolar += monto;
                    } else if (m.tipo === 'punto') {
                        metodos.punto.total += monto;
                        metodos.punto.cantidad++;
                        const banco = m.bancoNombre || 'Otro';
                        let bancoExistente = metodos.punto.porBanco.find(b => b.banco === banco);
                        if (!bancoExistente) {
                            bancoExistente = { banco, bancoCodigo: m.bancoCodigo || '', total: 0, cantidad: 0 };
                            metodos.punto.porBanco.push(bancoExistente);
                        }
                        bancoExistente.total += monto;
                        bancoExistente.cantidad++;
                    } else if (m.tipo === 'pagomovil') {
                        metodos.pagomovil.total += monto;
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
                    } else if (m.tipo === 'transferencia') {
                        metodos.transferencia.total += monto;
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
                    } else if (m.tipo === 'zelle') {
                        metodos.zelle.total += monto;
                        metodos.zelle.cantidad++;
                    }
                });
            }
        });

        return metodos;
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

            console.log('📅 Fecha consultada:', fecha);
            console.log('¿Es hoy?', esHoy);
            console.log('Cierre existente en mapa:', this.cierres.get(idCierre));

            // Para hoy, NO devolver cierre existente
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
            return of({ dolar: 1, euro: 1.05, bolivar: 60.5 }).pipe(delay(300));
        }
        return this.http.get<TasasCambio>(`${this.apiUrl}/tasas-cambio`);
    }
}