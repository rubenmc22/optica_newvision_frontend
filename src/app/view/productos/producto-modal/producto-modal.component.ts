import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Producto } from '../producto.model';

@Component({
  selector: 'app-producto-modal',
  standalone: false,
  templateUrl: './producto-modal.component.html',
  styleUrls: ['./producto-modal.component.scss']
})
export class ProductoModalComponent {
  @Input() modo: 'agregar' | 'editar' | 'ver' = 'agregar';
  @Input() producto: Producto = this.inicializarProducto();
  @Output() onGuardar = new EventEmitter<Producto>();
  @Output() onCerrar = new EventEmitter<void>();

  inicializarProducto(): Producto {
    return {
      id: crypto.randomUUID(),
      nombre: '',
      tipo: 'montura',
      marca: '',
      codigo: '',
      color: '',
      material: '',
      moneda: 'usd',
      stock: 0,
      precio: 0,
      activo: true,
      descripcion: '',
      imagenUrl: '',
      fechaIngreso: new Date().toISOString().split('T')[0]
    };
  }

  guardar() {
    this.onGuardar.emit(this.producto);
  }

  cerrar() {
    this.onCerrar.emit();
  }
}
