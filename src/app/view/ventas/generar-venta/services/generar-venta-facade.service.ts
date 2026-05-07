import { Injectable } from '@angular/core';
import { PresupuestoVentaDraft } from '../../shared/presupuesto-venta-handoff.util';
import { HistoriaVentaHandoff } from '../../shared/historia-venta-handoff.util';

export type TipoVentaGenerada = 'solo_consulta' | 'consulta_productos' | 'solo_productos';

@Injectable({
  providedIn: 'root'
})
export class GenerarVentaFacadeService {
  deriverTipoVentaDesdePresupuesto(draft: PresupuestoVentaDraft): TipoVentaGenerada {
    return draft.tipoVenta === 'consulta_productos' || draft.tipoVenta === 'solo_consulta'
      ? draft.tipoVenta
      : 'solo_productos';
  }

  construirClienteSinPaciente(draft: PresupuestoVentaDraft): any {
    return {
      tipoPersona: draft.cliente.tipoPersona === 'juridica' ? 'juridica' : 'natural',
      nombreCompleto: draft.cliente.nombreCompleto || '',
      cedula: draft.cliente.cedula || '',
      telefono: draft.cliente.telefono || '',
      email: draft.cliente.email || ''
    };
  }

  construirObservacionesOrigen(draft: PresupuestoVentaDraft): string {
    const observacionesOrigen = [`Presupuesto origen: ${draft.origen.codigo}`];

    if (draft.observaciones?.trim()) {
      observacionesOrigen.push(draft.observaciones.trim());
    }

    return observacionesOrigen.join(' | ');
  }

  separarLineasPresupuesto(draft: PresupuestoVentaDraft): {
    lineasConsulta: PresupuestoVentaDraft['productos'];
    lineasProducto: PresupuestoVentaDraft['productos'];
  } {
    const lineasConsulta = draft.productos.filter((linea) => this.esLineaConsultaDraft(linea));
    const lineasProducto = draft.productos.filter((linea) => !this.esLineaConsultaDraft(linea));

    return {
      lineasConsulta,
      lineasProducto
    };
  }

  calcularMontoConsultaDesdeLineas(lineasConsulta: PresupuestoVentaDraft['productos'], redondear: (valor: number) => number): number {
    const montoConsultaDraft = lineasConsulta.reduce((sum, linea) => {
      const totalLinea = Number(linea.totalLinea || 0);
      if (totalLinea > 0) {
        return sum + totalLinea;
      }

      const cantidad = Math.max(1, Number(linea.cantidad || 1));
      const precio = Number(linea.precioUnitario || 0);
      const descuento = Math.max(0, Number(linea.descuento || 0));
      const subtotal = precio * cantidad;
      return sum + (subtotal * (1 - (descuento / 100)));
    }, 0);

    return redondear(Math.max(0, montoConsultaDraft));
  }

  resolverPacienteHistoriaHandoff(handoff: HistoriaVentaHandoff, pacientes: any[]): any | null {
    return pacientes.find((item) =>
      String(item.key || '') === String(handoff.pacienteKey)
      || (handoff.pacienteId ? String(item.id || '') === String(handoff.pacienteId) : false)
    ) || null;
  }

  buscarPacienteParaDraftPresupuesto(draft: PresupuestoVentaDraft, pacientes: any[]): any | null {
    const pacienteKey = draft.historia?.pacienteKey || draft.cliente?.pacienteKey;
    const pacienteId = draft.historia?.pacienteId ?? draft.cliente?.pacienteId;
    const cedula = (draft.cliente?.cedula || '').trim().toLowerCase();

    return pacientes.find((item) => {
      const coincideKey = !!pacienteKey && String(item.key || '') === String(pacienteKey);
      const coincideId = pacienteId !== undefined && pacienteId !== null && String(item.id || '') === String(pacienteId);
      const cedulaPaciente = String(item.informacionPersonal?.cedula || '').trim().toLowerCase();
      const coincideCedula = !!cedula && cedulaPaciente === cedula;
      return coincideKey || coincideId || coincideCedula;
    }) || null;
  }

  private esLineaConsultaDraft(linea: PresupuestoVentaDraft['productos'][number]): boolean {
    return Boolean(
      linea.esConsulta
      || linea.tipoItem === 'servicio_consulta'
      || linea.categoria === 'consulta'
      || linea.configuracionTecnica?.esConsulta
    );
  }
}