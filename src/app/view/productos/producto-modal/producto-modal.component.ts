import { Component, Input, Output, EventEmitter, OnInit, ElementRef, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Producto } from '../producto.model';
import { Tooltip } from 'bootstrap';

@Component({
  selector: 'app-producto-modal',
  standalone: false,
  templateUrl: './producto-modal.component.html',
  styleUrls: ['./producto-modal.component.scss']
})
export class ProductoModalComponent implements OnInit {
  @ViewChild('modalProducto') modalProductoRef!: ElementRef;

  @Input() producto: any = {};
  @ViewChild('formProducto') formProducto!: NgForm;
  @Input() esSoloLectura: boolean = false;
  @Input() titulo: string = '';
  @Input() modo: 'agregar' | 'editar' | 'ver' = 'agregar'; // ✅ para definir el contexto

  @Output() onGuardar = new EventEmitter<Producto>();
  @Output() onCerrar = new EventEmitter<void>();

  avatarPreview: string | null = null;
  modalEntry: string[] = ['agregar', 'editar', 'ver'];
  productoOriginal: any;

  user: any = {
    ruta_imagen: '', // Puedes inicializarlo con la ruta real si ya existe
  };

  ngOnInit(): void {
    // Bloquea el scroll del fondo mientras el modal está activo
    document.body.style.overflow = 'hidden';

    // Inicializa producto si no se pasó como @Input
    if (!this.producto) {
      this.producto = this.inicializarProducto();
      this.productoOriginal = null; // En modo "nuevo", no hay original
    } else {
      // En modo "editar", guarda copia para comparar cambios
      this.productoOriginal = { ...this.producto };
    }

    // Activa tooltips Bootstrap
    const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.forEach(el => new Tooltip(el));
  }

  ngOnDestroy(): void {
    // Restaura el scroll al cerrar el modal
    document.body.style.overflow = 'auto';
  }

  guardarProducto(): void {
    if (this.formularioValido()) {
      this.onGuardar.emit(this.producto);
      this.onCerrar.emit();
    }
  }

  formularioValido(): boolean {
    const camposObligatorios = [
      'codigo', 'activo', 'marca', 'categoria',
      'material', 'proveedor', 'stock', 'precio', 'moneda'
    ];

    return camposObligatorios.every(campo => {
      const valor = this.producto?.[campo];

      if (typeof valor === 'boolean') return true;
      if (typeof valor === 'number') return !isNaN(valor);
      return valor !== undefined && valor !== null && `${valor}`.trim().length > 0;
    });

  }


  formularioModificado(): boolean {
    if (!this.productoOriginal || !this.producto) return false;
    return JSON.stringify(this.productoOriginal) !== JSON.stringify(this.producto);
  }

  getProfileImage(): string {
    return this.avatarPreview || this.user.ruta_imagen || 'assets/avatar-placeholder.avif';
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/avatar-placeholder.avif';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files[0]) {
      const file = input.files[0];

      const reader = new FileReader();
      reader.onload = () => {
        this.avatarPreview = reader.result as string;
        // Si estás cargando el archivo al backend, aquí podrías disparar la carga
      };
      reader.readAsDataURL(file);
    }
  }

  inicializarProducto(): Producto {
    return {
      id: crypto.randomUUID(),
      nombre: '',
      tipo: 'montura',
      categoria: '',
      proveedor: '',
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

  cerrar(): void {
    this.onCerrar.emit();
  }

  cargarImagen(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.producto.imagenUrl = reader.result as string;
    };
    reader.readAsDataURL(file);
  }
}
