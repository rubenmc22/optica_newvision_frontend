import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-historial-header',
  standalone: false,
  templateUrl: './historial-header.component.html',
  styleUrls: ['./historial-header.component.scss']
})
export class HistorialHeaderComponent {
  @Input() resumenCargando: boolean = false;
  @Input() estadisticasCargando: boolean = false;

  @Output() openResumen = new EventEmitter<void>();
  @Output() refreshStats = new EventEmitter<void>();
}