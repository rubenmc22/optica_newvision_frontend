import { Injectable } from '@angular/core';

export interface PresupuestoEstadisticasView {
  totalVigentes: number;
  totalVencidos: number;
  proximosAVencer: number;
  totalValor: number;
}

export interface PresupuestoListadoViewState {
  vigentes: any[];
  vencidos: any[];
  combinados: any[];
  estadisticas: PresupuestoEstadisticasView;
}

interface ConstruirListadoParams {
  presupuestosVigentes: any[];
  presupuestosVencidos: any[];
  filtroBusqueda: string;
  filtroEstado: string;
  normalizarCodigoParaBusqueda: (codigo: string) => string;
  normalizarBusqueda: (busqueda: string) => string;
  coincideCodigoParcial: (codigo: string, busqueda: string) => boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PresupuestoFacadeService {
  construirListadoState(params: ConstruirListadoParams): PresupuestoListadoViewState {
    const presupuestosVigentes = Array.isArray(params.presupuestosVigentes) ? params.presupuestosVigentes : [];
    const presupuestosVencidos = Array.isArray(params.presupuestosVencidos) ? params.presupuestosVencidos : [];
    const busqueda = params.filtroBusqueda ? params.filtroBusqueda.toLowerCase().trim() : '';

    const vigentes = this.filtrarColeccion(presupuestosVigentes, params.filtroEstado, busqueda, params);
    const vencidos = this.filtrarColeccion(presupuestosVencidos, params.filtroEstado, busqueda, params);
    const combinados = [...vigentes, ...vencidos];

    return {
      vigentes,
      vencidos,
      combinados,
      estadisticas: this.calcularEstadisticas(vigentes, vencidos)
    };
  }

  private filtrarColeccion(
    presupuestos: any[],
    filtroEstado: string,
    busqueda: string,
    params: ConstruirListadoParams
  ): any[] {
    return presupuestos.filter((presupuesto) => {
      const pasaFiltroEstado = !filtroEstado || presupuesto.estadoColor === filtroEstado;

      if (!busqueda) {
        return pasaFiltroEstado;
      }

      const codigoNormalizado = params.normalizarCodigoParaBusqueda(presupuesto.codigo || '');
      const busquedaNormalizada = params.normalizarBusqueda(busqueda);
      const camposBusqueda = [
        codigoNormalizado,
        presupuesto.cliente?.nombreCompleto?.toLowerCase() || '',
        presupuesto.cliente?.cedula?.toLowerCase() || '',
        presupuesto.cliente?.nombre?.toLowerCase() || '',
        presupuesto.cliente?.apellido?.toLowerCase() || '',
        presupuesto.vendedor?.toLowerCase() || ''
      ].join(' ');

      const pasaFiltroBusqueda = camposBusqueda.includes(busquedaNormalizada)
        || codigoNormalizado.includes(busquedaNormalizada)
        || params.coincideCodigoParcial(presupuesto.codigo, busqueda);

      return pasaFiltroEstado && pasaFiltroBusqueda;
    });
  }

  private calcularEstadisticas(vigentes: any[], vencidos: any[]): PresupuestoEstadisticasView {
    const totalVigentes = vigentes.length;
    const totalVencidos = vencidos.length;
    const totalValorVigentes = vigentes.reduce((sum, presupuesto) => sum + (presupuesto.total || 0), 0);
    const totalValorVencidos = vencidos.reduce((sum, presupuesto) => sum + (presupuesto.total || 0), 0);

    return {
      totalVigentes,
      totalVencidos,
      proximosAVencer: vigentes.filter((presupuesto) => presupuesto.diasRestantes <= 3).length,
      totalValor: totalValorVigentes + totalValorVencidos
    };
  }
}