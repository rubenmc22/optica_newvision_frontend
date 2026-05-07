import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-cierre-header',
  standalone: false,
  templateUrl: './cierre-header.component.html',
  styleUrls: ['./cierre-header.component.scss']
})
export class CierreHeaderComponent {
  @Input() cierreActual: any = null;
  @Input() cargandoDatos: boolean = false;
  @Input() fechaSeleccionada: Date = new Date();
  @Input() puedeAvanzarFecha: boolean = true;
  @Input() esDiaActual: boolean = false;
  @Input() puedeIniciarCaja: boolean = true;
  @Input() mensajeNoDisponibleParaIniciarCaja: string = '';
  @Input() bloqueoCierrePendienteAnterior: boolean = false;
  @Input() mensajeBloqueoCierrePendienteAnterior: string = '';
  @Input() cierrePendienteVisual: boolean = false;
  @Input() estadoClass: string = '';
  @Input() estadoIconClass: string = '';
  @Input() estadoTexto: string = '';
  @Input() referenciaFechaTexto: string = '';

  @Output() previousDay = new EventEmitter<void>();
  @Output() nextDay = new EventEmitter<void>();
  @Output() pickDate = new EventEmitter<void>();
  @Output() openStart = new EventEmitter<void>();
  @Output() openClose = new EventEmitter<void>();
  @Output() openHistory = new EventEmitter<void>();
}