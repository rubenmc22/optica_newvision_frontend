import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { FiltrosVentas } from '../../venta-interfaz';
import { HistorialVentaService } from '../historial-ventas.service';

export interface HistorialVentasStatsView {
  totalVentas: number;
  ventasCompletadas: number;
  ventasPendientes: number;
  ventasCanceladas: number;
  montoCompletadas: number;
  montoPendientes: number;
  montoCanceladas: number;
  montoTotalGeneral: number;
}

export interface HistorialVentasPageData {
  ventas: any[];
  totalItems: number;
  totalPaginas: number;
}

@Injectable({
  providedIn: 'root'
})
export class HistorialVentasFacadeService {
  constructor(private historialVentaService: HistorialVentaService) {}

  crearFiltrosVacios(): FiltrosVentas {
    return {
      busquedaGeneral: '',
      estado: '',
      formaPago: '',
      asesor: '',
      especialista: '',
      fechaDesde: null,
      fechaHasta: null,
      tipoVenta: ''
    };
  }

  crearEstadisticasVacias(): HistorialVentasStatsView {
    return {
      totalVentas: 0,
      ventasCompletadas: 0,
      ventasPendientes: 0,
      ventasCanceladas: 0,
      montoCompletadas: 0,
      montoPendientes: 0,
      montoCanceladas: 0,
      montoTotalGeneral: 0
    };
  }

  hayFiltrosActivos(filtros: FiltrosVentas): boolean {
    return Boolean(
      filtros.busquedaGeneral
      || filtros.asesor
      || filtros.especialista
      || filtros.estado
      || filtros.formaPago
      || filtros.fechaDesde
      || filtros.fechaHasta
    );
  }

  cargarVentasPagina(
    pagina: number,
    itemsPorPagina: number,
    filtros: FiltrosVentas,
    adaptarVenta: (ventaApi: any) => any,
  ): Observable<HistorialVentasPageData> {
    return this.historialVentaService.obtenerVentasPaginadas(
      pagina,
      itemsPorPagina,
      { ...filtros }
    ).pipe(
      map((response: any) => {
        if (response && response.message === 'ok' && Array.isArray(response.ventas)) {
          return {
            ventas: response.ventas.map((ventaApi: any) => adaptarVenta(ventaApi)),
            totalItems: response.pagination?.total || 0,
            totalPaginas: response.pagination?.pages || 1
          };
        }

        return {
          ventas: [],
          totalItems: 0,
          totalPaginas: 1
        };
      })
    );
  }

  cargarEstadisticas(filtros: FiltrosVentas): Observable<HistorialVentasStatsView> {
    return this.historialVentaService.obtenerEstadisticasVentas(filtros).pipe(
      map((response: any) => {
        if (response?.message === 'ok') {
          return {
            totalVentas: response.ventas || 0,
            ventasCompletadas: response.completadas || 0,
            ventasPendientes: response.pendientes || 0,
            ventasCanceladas: response.canceladas || 0,
            montoCompletadas: response.montoCompletadas || 0,
            montoPendientes: response.montoPendientes || 0,
            montoCanceladas: response.montoCanceladas || 0,
            montoTotalGeneral: response.montoTotalGeneral || 0
          };
        }

        return this.crearEstadisticasVacias();
      })
    );
  }
}