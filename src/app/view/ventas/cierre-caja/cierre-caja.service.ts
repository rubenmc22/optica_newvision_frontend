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
    private usarDummy: boolean = true; // Cambiar a false cuando el backend esté listo
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

    private inicializarDatosDummy(): void {
        // Generar ventas para los últimos 30 días
        const hoy = new Date();

        for (let i = 0; i < 30; i++) {
            const fecha = new Date(hoy);
            fecha.setDate(hoy.getDate() - i);
            this.generarVentasDia(fecha);
        }
    }

    private generarVentasDia(fecha: Date): void {
        const dia = fecha.getDate();
        const mes = fecha.getMonth() + 1;

        // Generar entre 3 y 10 ventas por día
        const numVentas = Math.floor(Math.random() * 8) + 3;

        for (let i = 0; i < numVentas; i++) {
            const hora = Math.floor(Math.random() * 12) + 8; // 8am a 8pm
            const minuto = Math.floor(Math.random() * 60);
            const fechaVenta = new Date(fecha);
            fechaVenta.setHours(hora, minuto, 0);

            const tiposVenta = ['solo_consulta', 'consulta_productos', 'solo_productos'];
            const formasPago = ['contado', 'abono', 'cashea', 'de_contado-pendiente'];
            const metodosPago = ['efectivo', 'punto', 'transferencia', 'pagomovil', 'zelle'];

            const tipoVenta = tiposVenta[Math.floor(Math.random() * tiposVenta.length)];
            const formaPago = formasPago[Math.floor(Math.random() * formasPago.length)];
            const metodoPrincipal = metodosPago[Math.floor(Math.random() * metodosPago.length)];

            let total = 0;
            let montoPagado = 0;

            // Calcular total según tipo de venta
            if (tipoVenta === 'solo_consulta') {
                total = Math.floor(Math.random() * 100) + 30;
            } else if (tipoVenta === 'solo_productos') {
                total = Math.floor(Math.random() * 500) + 50;
            } else {
                total = Math.floor(Math.random() * 600) + 80;
            }

            // Calcular monto pagado según forma de pago
            if (formaPago === 'contado') {
                montoPagado = total;
            } else if (formaPago === 'abono') {
                montoPagado = Math.floor(total * 0.5);
            } else if (formaPago === 'cashea') {
                montoPagado = Math.floor(total * 0.4);
            } else {
                montoPagado = 0;
            }

            // Crear métodos de pago
            let metodosDePago: any[] = [];
            if (formaPago === 'contado' && montoPagado > 0) {
                metodosDePago = [{ tipo: metodoPrincipal, monto: montoPagado, moneda: 'dolar' }];
            } else if (formaPago === 'abono' && montoPagado > 0) {
                metodosDePago = [{ tipo: 'efectivo', monto: montoPagado, moneda: 'dolar' }];
            } else if (formaPago === 'cashea' && montoPagado > 0) {
                metodosDePago = [{ tipo: 'efectivo', monto: montoPagado, moneda: 'dolar' }];
            }

            // Crear detalle de forma de pago
            let formaPagoDetalle: any = { tipo: formaPago, montoTotal: total };
            if (formaPago === 'contado') {
                formaPagoDetalle.totalPagado = montoPagado;
            } else if (formaPago === 'abono') {
                formaPagoDetalle.montoAbonado = montoPagado;
                formaPagoDetalle.deudaPendiente = total - montoPagado;
                formaPagoDetalle.porcentajePagado = (montoPagado / total) * 100;
            } else if (formaPago === 'cashea') {
                const inicial = montoPagado;
                const restante = total - inicial;
                const montoPorCuota = restante / 3;
                formaPagoDetalle.nivel = 'nivel3';
                formaPagoDetalle.montoInicial = inicial;
                formaPagoDetalle.cantidadCuotas = '3';
                formaPagoDetalle.montoPorCuota = montoPorCuota;
                formaPagoDetalle.deudaPendiente = restante;
            } else if (formaPago === 'de_contado-pendiente') {
                formaPagoDetalle.deudaPendiente = total;
            }

            this.ventas.push({
                key: `VENTA-${i}-${fecha.getTime()}`,
                numero_venta: `V-${String(dia).padStart(2, '0')}${String(mes).padStart(2, '0')}${String(i + 100).slice(-3)}`,
                fecha: fechaVenta.toISOString(),
                tipoVenta: tipoVenta,
                moneda: 'dolar',
                sede: 'guatire',
                total_pagado: montoPagado,
                total: total,
                estatus_pago: formaPago === 'de_contado-pendiente' ? 'pendiente' : 'completado',
                estado: 'completada',
                formaPago: formaPago,
                metodosDePago: metodosDePago,
                cliente: {
                    informacion: {
                        nombreCompleto: `Cliente ${i + 1}`,
                        cedula: String(Math.floor(Math.random() * 10000000))
                    }
                },
                asesor: { nombre: 'Asesor Demo' },
                auditoria: {
                    usuarioCreacion: { nombre: 'Usuario Demo' },
                    fechaCreacion: fechaVenta.toISOString()
                },
                formaPagoDetalle: formaPagoDetalle,
                productos: [{ nombre: 'Producto Demo', cantidad: 1, precio: total * 0.8 }],
                generarOrdenTrabajo: formaPago !== 'abono' && formaPago !== 'de_contado-pendiente'
            });
        }

        // Crear cierre para este día
        this.crearCierreDummy(fecha);
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

    // Métodos de cálculo auxiliares
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
                resultado.soloConsulta.montoMedico += v.total * 0.7;
                resultado.soloConsulta.montoOptica += v.total * 0.3;
            } else if (v.tipoVenta === 'consulta_productos') {
                resultado.consultaProductos.cantidad++;
                resultado.consultaProductos.total += v.total;
                resultado.consultaProductos.montoMedico += v.total * 0.4;
                resultado.consultaProductos.montoProductos += v.total * 0.6;
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
                v.metodosDePago.forEach((m: any) => {
                    const tipo = m.tipo;
                    const monto = m.monto || v.total_pagado || v.total;

                    if (tipo === 'efectivo') {
                        metodos.efectivo.total += monto;
                        metodos.efectivo.cantidad++;
                        metodos.efectivo.porMoneda.dolar += monto;
                    } else if (tipo === 'punto') {
                        metodos.punto.total += monto;
                        metodos.punto.cantidad++;
                        metodos.punto.porBanco.push({
                            banco: 'Banco ' + String.fromCharCode(65 + Math.floor(Math.random() * 5)),
                            bancoCodigo: '01' + Math.floor(Math.random() * 20),
                            total: monto,
                            cantidad: 1
                        });
                    } else if (tipo === 'pagomovil') {
                        metodos.pagomovil.total += monto;
                        metodos.pagomovil.cantidad++;
                    } else if (tipo === 'transferencia') {
                        metodos.transferencia.total += monto;
                        metodos.transferencia.cantidad++;
                    } else if (tipo === 'zelle') {
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
                formas.cashea.montoInicial += pagado;
                formas.cashea.deudaPendiente += total - pagado;
                formas.cashea.cuotasPendientes += 3;
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
                (v.formaPago === 'abono' && v.total > (v.total_pagado || 0)))
            .map(v => ({
                numeroVenta: v.numero_venta,
                cliente: v.cliente?.informacion?.nombreCompleto || 'Cliente',
                total: v.total,
                formaPago: v.formaPago === 'de_contado-pendiente' ? 'Pendiente' : 'Abono',
                deuda: v.total - (v.total_pagado || 0),
                fecha: new Date(v.fecha)
            }));
    }

    private calcularTotales(ventas: any[]): any {
        const ingresos = ventas.reduce((sum, v) => sum + (v.total_pagado || v.total), 0);
        return {
            ingresos: ingresos,
            egresos: 0,
            neto: ingresos,
            ventasContado: ingresos,
            ventasCredito: 0,
            ventasPendientes: ventas.filter(v => v.formaPago === 'de_contado-pendiente').reduce((sum, v) => sum + v.total, 0)
        };
    }

    private convertirVentasATransacciones(ventas: any[]): Transaccion[] {
        return ventas.map(v => ({
            id: v.key,
            tipo: 'venta',
            descripcion: `Venta #${v.numero_venta}`,
            monto: v.total_pagado || v.total,
            fecha: new Date(v.fecha),
            metodoPago: v.metodosDePago?.[0]?.tipo || 'efectivo',
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

    // Métodos públicos del servicio
    obtenerResumenDiario(fecha: Date, sede: string): Observable<any> {
        if (this.usarDummy) {
            const fechaStr = this.formatearFechaYYYYMMDD(fecha);
            const idCierre = `CIERRE-${fechaStr}-${sede}`;

            const ventasDelDia = this.ventas.filter(v => {
                const fechaVenta = new Date(v.fecha);
                return fechaVenta.toDateString() === fecha.toDateString();
            });

            return of({
                ventas: ventasDelDia,
                cierreExistente: this.cierres.get(idCierre) || null,
                estadisticas: {
                    totalVentas: ventasDelDia.reduce((sum, v) => sum + v.total, 0),
                    totalEfectivo: ventasDelDia.filter(v => v.metodosDePago?.[0]?.tipo === 'efectivo').reduce((sum, v) => sum + (v.total_pagado || v.total), 0),
                    totalTarjeta: 0,
                    totalTransferencia: 0,
                    cantidadVentas: ventasDelDia.length
                }
            }).pipe(delay(500));
        }

        // Versión real (cuando el backend esté listo)
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