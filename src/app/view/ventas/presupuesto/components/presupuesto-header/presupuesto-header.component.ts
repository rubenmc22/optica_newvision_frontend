import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-presupuesto-header',
  standalone: false,
  templateUrl: './presupuesto-header.component.html',
  styleUrl: './presupuesto-header.component.scss'
})
export class PresupuestoHeaderComponent {
  @Input() filtroBusqueda = '';
  @Input() filtroEstado = '';
  @Input() hayFiltrosActivos = false;
  @Input() textoResultadosFiltrados = '';

  @Output() filtroBusquedaChange = new EventEmitter<string>();
  @Output() filtroEstadoChange = new EventEmitter<string>();
  @Output() filtrar = new EventEmitter<void>();
  @Output() limpiarBusqueda = new EventEmitter<void>();
  @Output() limpiarFiltros = new EventEmitter<void>();
  @Output() limpiarFiltroEstado = new EventEmitter<void>();
  @Output() nuevoPresupuesto = new EventEmitter<void>();
}