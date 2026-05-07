import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-presupuesto-tabs',
  standalone: false,
  templateUrl: './presupuesto-tabs.component.html',
  styleUrls: ['./presupuesto-tabs.component.scss']
})
export class PresupuestoTabsComponent {
  @Input() tabActiva: 'vigentes' | 'vencidos' = 'vigentes';
  @Input() presupuestosVigentes: any[] = [];
  @Input() presupuestosVencidos: any[] = [];
  @Input() presupuestosFiltradosVigentes: any[] = [];
  @Input() presupuestosFiltradosVencidos: any[] = [];
  @Input() hayFiltrosActivos = false;
  @Input() filtroBusqueda = '';
  @Input() filtroEstado = '';
  @Input() tituloEstadoVacio = '';
  @Input() mensajeEstadoVacio = '';
  @Input() mostrarReferenciaBs = false;
  @Input() formatFechaFn!: (fecha: Date) => string;
  @Input() formatMonedaFn!: (valor: number | null | undefined, moneda?: string) => string;
  @Input() getEstadoTextoFn!: (estadoColor: string) => string;
  @Input() getTextoDiasRestantesFn!: (presupuesto: any) => string;
  @Input() obtenerReferenciaBsFn!: (monto: number | null | undefined, moneda?: string) => number;
  @Input() esVentaGeneradaFn!: (presupuesto: any) => boolean;
  @Input() puedeConvertirFn!: (presupuesto: any) => boolean;
  @Input() obtenerMotivoNoConversionFn!: (presupuesto: any) => string;

  @Output() tabChange = new EventEmitter<'vigentes' | 'vencidos'>();
  @Output() viewDetail = new EventEmitter<any>();
  @Output() print = new EventEmitter<any>();
  @Output() email = new EventEmitter<any>();
  @Output() whatsapp = new EventEmitter<any>();
  @Output() convert = new EventEmitter<any>();
  @Output() delete = new EventEmitter<any>();
  @Output() renew = new EventEmitter<any>();
  @Output() clearFilters = new EventEmitter<void>();
  @Output() clearBusqueda = new EventEmitter<void>();
  @Output() clearEstado = new EventEmitter<void>();
  @Output() createNew = new EventEmitter<void>();

  cambiarTab(tab: 'vigentes' | 'vencidos'): void {
    this.tabChange.emit(tab);
  }

  verDetallePresupuesto(presupuesto: any): void {
    this.viewDetail.emit(presupuesto);
  }

  imprimirPresupuesto(event: Event, presupuesto: any): void {
    event.stopPropagation();
    this.print.emit(presupuesto);
  }

  enviarPresupuestoPorCorreo(event: Event, presupuesto: any): void {
    event.stopPropagation();
    this.email.emit(presupuesto);
  }

  compartirPresupuestoPorWhatsApp(event: Event, presupuesto: any): void {
    event.stopPropagation();
    this.whatsapp.emit(presupuesto);
  }

  convertirAVenta(event: Event, presupuesto: any): void {
    event.stopPropagation();
    this.convert.emit(presupuesto);
  }

  confirmarEliminarPresupuesto(event: Event, presupuesto: any): void {
    event.stopPropagation();
    this.delete.emit(presupuesto);
  }

  renovarPresupuesto(event: Event, presupuesto: any): void {
    event.stopPropagation();
    this.renew.emit(presupuesto);
  }

  formatFecha(fecha: Date): string {
    return this.formatFechaFn ? this.formatFechaFn(fecha) : '';
  }

  formatMoneda(valor: number | null | undefined, moneda?: string): string {
    return this.formatMonedaFn ? this.formatMonedaFn(valor, moneda) : '';
  }

  getEstadoTexto(estadoColor: string): string {
    return this.getEstadoTextoFn ? this.getEstadoTextoFn(estadoColor) : '';
  }

  getTextoDiasRestantesParaPresupuesto(presupuesto: any): string {
    return this.getTextoDiasRestantesFn ? this.getTextoDiasRestantesFn(presupuesto) : '';
  }

  obtenerReferenciaBs(monto: number | null | undefined, moneda?: string): number {
    return this.obtenerReferenciaBsFn ? this.obtenerReferenciaBsFn(monto, moneda) : 0;
  }

  esVentaGenerada(presupuesto: any): boolean {
    return this.esVentaGeneradaFn ? this.esVentaGeneradaFn(presupuesto) : false;
  }

  puedeConvertirPresupuesto(presupuesto: any): boolean {
    return this.puedeConvertirFn ? this.puedeConvertirFn(presupuesto) : false;
  }

  obtenerMotivoNoConversion(presupuesto: any): string {
    return this.obtenerMotivoNoConversionFn ? this.obtenerMotivoNoConversionFn(presupuesto) : '';
  }
}