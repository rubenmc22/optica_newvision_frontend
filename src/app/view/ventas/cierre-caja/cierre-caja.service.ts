import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map, switchMap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CierreDiario, Transaccion } from './cierre-caja.interfaz';

@Injectable({
    providedIn: 'root'
})
export class CierreCajaService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) { }

    // Obtener ventas por fecha y sede
    obtenerVentasPorFechaYSede(fechaInicio: Date, fechaFin: Date, sede: string): Observable<any[]> {
        let params = new HttpParams()
            .set('fechaDesde', fechaInicio.toISOString().split('T')[0])
            .set('fechaHasta', fechaFin.toISOString().split('T')[0])
            .set('sede', sede)
            .set('estado', 'completada') // Solo ventas completadas
            .set('itemsPorPagina', '1000'); // Límite alto para obtener todas

        return this.http.get<any[]>(`${this.apiUrl}/ventas-get`, { params }).pipe(
            map((response: any) => {
                // La API puede devolver { ventas: [], total: X } o directamente el array
                return response.ventas || response || [];
            })
        );
    }

    // Obtener estadísticas financieras para el día
    obtenerEstadisticasDia(fecha: Date, sede: string): Observable<any> {
        const filtros = {
            fechaDesde: fecha.toISOString().split('T')[0],
            fechaHasta: fecha.toISOString().split('T')[0],
            sede: sede
        };

        return this.http.post<any>(`${this.apiUrl}/estadisticas-financieras`, filtros);
    }

    // Guardar cierre de caja
    guardarCierre(cierre: CierreDiario): Observable<any> {
        return this.http.post(`${this.apiUrl}/cierre-caja`, cierre);
    }

    // Obtener cierre existente
    obtenerCierrePorFechaYSede(fecha: Date, sede: string): Observable<CierreDiario | null> {
        const params = new HttpParams()
            .set('fecha', fecha.toISOString().split('T')[0])
            .set('sede', sede);

        return this.http.get<any>(`${this.apiUrl}/cierre-caja`, { params }).pipe(
            map(response => {
                // Si no hay cierre, devolver null
                if (!response || response.error) {
                    return null;
                }
                return response as CierreDiario;
            })
        );
    }

    // Obtener todos los cierres de una sede
    obtenerCierresPorSede(sede: string, pagina: number = 1, itemsPorPagina: number = 50): Observable<any> {
        const params = new HttpParams()
            .set('sede', sede)
            .set('pagina', pagina.toString())
            .set('itemsPorPagina', itemsPorPagina.toString());

        return this.http.get(`${this.apiUrl}/cierre-caja-list`, { params });
    }

    // Actualizar cierre existente
    actualizarCierre(cierreId: string, cierre: Partial<CierreDiario>): Observable<any> {
        return this.http.put(`${this.apiUrl}/cierre-caja/${cierreId}`, cierre);
    }

    // Eliminar cierre (solo administradores)
    eliminarCierre(cierreId: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/cierre-caja/${cierreId}`);
    }

    // Obtener resumen del día (combinación de ventas y estadísticas)
    obtenerResumenDiario(fecha: Date, sede: string): Observable<any> {
        const fechaInicio = new Date(fecha);
        fechaInicio.setHours(0, 0, 0, 0);

        const fechaFin = new Date(fecha);
        fechaFin.setHours(23, 59, 59, 999);

        return forkJoin({
            ventas: this.obtenerVentasPorFechaYSede(fechaInicio, fechaFin, sede),
            estadisticas: this.obtenerEstadisticasDia(fecha, sede),
            cierreExistente: this.obtenerCierrePorFechaYSede(fecha, sede)
        }).pipe(
            map(({ ventas, estadisticas, cierreExistente }) => {
                return {
                    ventas,
                    estadisticas,
                    cierreExistente,
                    fecha,
                    sede
                };
            })
        );
    }

    // Exportar reporte de cierre
    exportarReporteCierre(cierreId: string, formato: string = 'pdf'): Observable<any> {
        const params = new HttpParams().set('formato', formato);
        return this.http.get(`${this.apiUrl}/cierre-caja/export/${cierreId}`, {
            params,
            responseType: 'blob'
        });
    }

    // Conciliar cierre
    conciliarCierre(cierreId: string, datosConciliacion: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/cierre-caja/conciliar/${cierreId}`, datosConciliacion);
    }
}