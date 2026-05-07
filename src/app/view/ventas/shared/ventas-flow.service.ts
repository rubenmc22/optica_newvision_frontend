import { Injectable } from '@angular/core';
import { HistoriaVentaHandoff, HISTORIA_VENTA_HANDOFF_STORAGE_KEY } from './historia-venta-handoff.util';
import { PresupuestoVentaDraft, PRESUPUESTO_VENTA_STORAGE_KEY } from './presupuesto-venta-handoff.util';
import {
  HistoriaPresupuestoHandoff,
  HISTORIA_PRESUPUESTO_HANDOFF_STORAGE_KEY,
  PRESUPUESTO_HISTORIA_RETURN_STORAGE_KEY,
  PresupuestoHistoriaReturnDraft
} from './historia-presupuesto-handoff.util';

@Injectable({
  providedIn: 'root'
})
export class VentasFlowService {
  guardarHistoriaVentaHandoff(handoff: HistoriaVentaHandoff): void {
    this.guardarJson(HISTORIA_VENTA_HANDOFF_STORAGE_KEY, handoff);
  }

  leerHistoriaVentaHandoff(): HistoriaVentaHandoff | null {
    const handoff = this.leerJson<HistoriaVentaHandoff>(HISTORIA_VENTA_HANDOFF_STORAGE_KEY);

    if (!handoff?.pacienteKey || !handoff?.historiaId) {
      this.limpiarHistoriaVentaHandoff();
      return null;
    }

    if (handoff.tipoVenta !== 'consulta_productos' && handoff.tipoVenta !== 'solo_consulta') {
      this.limpiarHistoriaVentaHandoff();
      return null;
    }

    return handoff;
  }

  limpiarHistoriaVentaHandoff(): void {
    this.eliminar(HISTORIA_VENTA_HANDOFF_STORAGE_KEY);
  }

  guardarPresupuestoVentaDraft(draft: PresupuestoVentaDraft): void {
    this.guardarJson(PRESUPUESTO_VENTA_STORAGE_KEY, draft);
  }

  leerPresupuestoVentaDraft(): PresupuestoVentaDraft | null {
    const draft = this.leerJson<PresupuestoVentaDraft>(PRESUPUESTO_VENTA_STORAGE_KEY);

    if (!draft || !Array.isArray(draft.productos) || draft.productos.length === 0) {
      this.limpiarPresupuestoVentaDraft();
      return null;
    }

    return draft;
  }

  limpiarPresupuestoVentaDraft(): void {
    this.eliminar(PRESUPUESTO_VENTA_STORAGE_KEY);
  }

  guardarHistoriaPresupuestoHandoff(handoff: HistoriaPresupuestoHandoff): void {
    this.guardarJson(HISTORIA_PRESUPUESTO_HANDOFF_STORAGE_KEY, handoff);
  }

  leerHistoriaPresupuestoHandoff(): HistoriaPresupuestoHandoff | null {
    const handoff = this.leerJson<HistoriaPresupuestoHandoff>(HISTORIA_PRESUPUESTO_HANDOFF_STORAGE_KEY);

    if (!handoff?.pacienteKey || !handoff?.historiaId || !Array.isArray(handoff.opciones) || handoff.opciones.length === 0) {
      this.limpiarHistoriaPresupuestoHandoff();
      return null;
    }

    return handoff;
  }

  limpiarHistoriaPresupuestoHandoff(): void {
    this.eliminar(HISTORIA_PRESUPUESTO_HANDOFF_STORAGE_KEY);
  }

  guardarRetornoHistoriaDesdePresupuesto(retorno: PresupuestoHistoriaReturnDraft): void {
    this.guardarJson(PRESUPUESTO_HISTORIA_RETURN_STORAGE_KEY, retorno);
  }

  leerRetornoHistoriaDesdePresupuesto(): PresupuestoHistoriaReturnDraft | null {
    const retorno = this.leerJson<PresupuestoHistoriaReturnDraft>(PRESUPUESTO_HISTORIA_RETURN_STORAGE_KEY);

    if (!retorno?.pacienteKey || !retorno?.historiaId) {
      this.limpiarRetornoHistoriaDesdePresupuesto();
      return null;
    }

    return retorno;
  }

  limpiarRetornoHistoriaDesdePresupuesto(): void {
    this.eliminar(PRESUPUESTO_HISTORIA_RETURN_STORAGE_KEY);
  }

  private guardarJson<T>(key: string, payload: T): void {
    try {
      sessionStorage.setItem(key, JSON.stringify(payload));
    } catch (error) {
      console.error(`No se pudo guardar el flujo temporal ${key}:`, error);
    }
  }

  private leerJson<T>(key: string): T | null {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) {
        return null;
      }

      return JSON.parse(raw) as T;
    } catch {
      this.eliminar(key);
      return null;
    }
  }

  private eliminar(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.error(`No se pudo limpiar el flujo temporal ${key}:`, error);
    }
  }
}