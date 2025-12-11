// detalle-orden.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-detalle-orden',
  standalone: false,
  templateUrl: './detalle-orden.component.html',
  styleUrls: ['./detalle-orden.component.scss']
})
export class DetalleOrdenComponent {
  @Input() orden: any;
  @Output() estadoCambiado = new EventEmitter<any>();

  // Método para obtener el texto del estado
  getEstadoTexto(estado: string): string {
    const estados: { [key: string]: string } = {
      'pendiente': 'Pendiente',
      'en_proceso': 'En Proceso',
      'completado': 'Completado',
      'cancelado': 'Cancelado',
      // Agrega más estados según necesites
    };

    return estados[estado] || estado;
  }

  // Método de ejemplo
  cambiarEstado(nuevoEstado: string) {
    this.orden.estado = nuevoEstado;
    this.estadoCambiado.emit(this.orden);
  }
}