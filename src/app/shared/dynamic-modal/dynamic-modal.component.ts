import { Component, Input, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as bootstrap from 'bootstrap';

@Component({
  selector: 'app-dynamic-modal',
  standalone: false,
  templateUrl: './dynamic-modal.component.html',
  styleUrls: ['./dynamic-modal.component.scss']
})
export class DynamicModalComponent implements OnInit, OnChanges {
  @Input() modalTitle = '';
  @Input() modalFields: any[] = [];
  @Input() showRequiredMessage: boolean = true; // ✅ Ahora podemos activar/desactivar el mensaje

  modalForm!: FormGroup;

  constructor(private fb: FormBuilder) { }

  ngOnInit(): void {
    this.createForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['modalFields'] && changes['modalFields'].currentValue) {
      this.createForm(); // ✅ Reconstruye el formulario cuando cambian los campos
    }
  }

  createForm(): void {
    const group: any = {};

    this.modalFields.forEach(field => {
      group[field.name] = field.validation ? [null, field.validation] : [null, Validators.required];
    });

    this.modalForm = this.fb.group(group);
  }

  openModal(): void {
    const modalElement = document.getElementById('dynamicModal');
    if (modalElement) {
      new bootstrap.Modal(modalElement).show();
    }
  }

  closeModal(): void {
    const modalElement = document.getElementById('dynamicModal');
    if (modalElement) {
      const modalInstance = bootstrap.Modal.getInstance(modalElement);
      modalInstance?.hide();
    }
  }

  confirm(): void {
    if (this.modalForm.valid) {
      console.log('Datos guardados:', this.modalForm.value);
      this.closeModal();
    } else {
      Object.values(this.modalForm.controls).forEach(control => control.markAsTouched());
    }
  }
}
