import { Component, Input, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
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
   @Input() onSubmit!: (data: any) => void; // ✅ Nueva función de salida

  modalForm!: FormGroup;

  constructor(private fb: FormBuilder, private http: HttpClient) { }

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
      console.log('RDMC Dentro de this.modalForm.valid', this.modalForm.valid);
      if (this.onSubmit) {
        this.onSubmit(this.modalForm.value); // ✅ Envía los datos al padre
      }
      this.closeModal();
    } else {
      Object.values(this.modalForm.controls).forEach(control => control.markAsTouched());
    }
  }
}
