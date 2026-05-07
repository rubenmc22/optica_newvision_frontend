import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-generar-venta-header',
  standalone: false,
  templateUrl: './generar-venta-header.component.html',
  styleUrl: './generar-venta-header.component.scss'
})
export class GenerarVentaHeaderComponent {
  @Input() cajaDisponibleParaVentas = true;
  @Input() mensajeBloqueoCaja = '';
  @Output() revalidarCaja = new EventEmitter<void>();
}