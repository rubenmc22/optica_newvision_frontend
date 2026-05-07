import { Component, EventEmitter, Input, Output } from '@angular/core';

type TipoVenta = 'solo_consulta' | 'consulta_productos' | 'solo_productos';

@Component({
  selector: 'app-generar-venta-tipo-selector',
  standalone: false,
  templateUrl: './generar-venta-tipo-selector.component.html',
  styleUrl: './generar-venta-tipo-selector.component.scss'
})
export class GenerarVentaTipoSelectorComponent {
  @Input() tipoVenta: TipoVenta = 'solo_consulta';
  @Input() hasPaciente = false;
  @Output() tipoVentaChange = new EventEmitter<TipoVenta>();

  seleccionar(tipo: TipoVenta): void {
    this.tipoVentaChange.emit(tipo);
  }
}