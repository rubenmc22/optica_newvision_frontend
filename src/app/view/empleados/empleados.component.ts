import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalService } from './../../core/services/modal/modal.service';
import { DynamicModalComponent } from './../../shared/dynamic-modal/dynamic-modal.component';
import * as bootstrap from 'bootstrap';

@Component({
  selector: 'app-empleados',
  standalone: false,
  templateUrl: './empleados.component.html',
  styleUrls: ['./empleados.component.scss']
})
export class EmpleadosComponent implements OnInit {
  @ViewChild(DynamicModalComponent) dynamicModal!: DynamicModalComponent; // ✅ Correcta referencia al componente hijo

  employees: any[] = [
    { name: 'SOPORTE', document: '16204710', position: 'Administrador', role: 'Administrador', phone: '', registeredSince: '', address: '', email: '' },
    { name: 'ANTONETT', document: '20209691', position: 'Supervisor', role: 'Editor', phone: '04242788311', registeredSince: '2023-01-15', address: '', email: 'antonett@example.com' }
  ];

  positions: string[] = ['Administrador', 'Gerente', 'Oftalmologo', 'Optometrista', 'Asesor Optico 2', 'Asesor Optico 1'];
  roles: string[] = ['Administrador', 'Gerente', 'Asesor Optico'];

  employeeForm: FormGroup;
  modalFields: any[] = []; // ✅ Nueva propiedad para definir los campos dinámicos del modal

  constructor(
    private fb: FormBuilder,
    private modalService: ModalService
  ) {
    this.employeeForm = this.fb.group({
      name: ['', Validators.required],
      document: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
      position: ['', Validators.required],
      role: ['', Validators.required]
    });
  }

  ngOnInit(): void { }

  saveEmployee(): void {
    if (this.employeeForm.valid) {
      this.employees.push({ ...this.employeeForm.value });
      // this.modalService.closeModal('dynamicModal'); // Usando `ModalService`
    } else {
      this.markFormGroupTouched(this.employeeForm);
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => control.markAsTouched());
  }

  deleteEmployee(index: number): void {
    this.modalService.openGlobalModal(
      'Eliminar Empleado',
      '¿Seguro que deseas eliminar este usuario?',
      'Eliminar',
      'Cancelar'
    );
  }

  viewEmployeeInfo(index: number): void {
    /*this.modalService.openGlobalModal(
      'Eliminar Empleado',
      '¿Seguro que deseas eliminar este usuario?',
      'Eliminar',
      'Cancelar'
    );*/
  }

  updateEmployee(index: number): void {
    /*this.modalService.openGlobalModal(
      'Eliminar Empleado',
      '¿Seguro que deseas eliminar este usuario?',
      'Eliminar',
      'Cancelar'
    );*/
  }

  openConfirmModal(title: string, message: string, confirmText: string, cancelText: string): void {
    this.modalService.openGlobalModal(title, message, confirmText, cancelText);
  }

  openDynamicModal(): void {
    this.dynamicModal.modalTitle = 'Agregar Nuevo Empleado'; // ✅ Ahora controlamos el título desde EmpleadosComponent
    this.dynamicModal.showRequiredMessage = true; // ✅ Controlamos si se muestra el mensaje informativo
    this.modalFields = [
      {
        name: 'name',
        label: 'Nombre Completo',
        type: 'text',
        required: true,
        cols: 6, // ✅ Se ocupa la mitad de la fila
        errorMessage: 'Solo se permiten letras',
        validation: [Validators.required, Validators.pattern(/^[A-Za-zÁÉÍÓÚáéíóúñÑ\s]+$/)]
      },
      {
        name: 'cedula',
        label: 'Documento de Identidad',
        type: 'number',
        required: true,
        cols: 6, // ✅ Se ocupa la mitad de la fila
        errorMessage: 'Debe ser numérico entre 6 y 9 dígitos',
        validation: [Validators.required, Validators.pattern(/^\d{6,9}$/)]
      },
      { name: 'position', label: 'Cargo', type: 'select', options: this.positions, required: true, cols: 6, errorMessage: 'Cargo requerido' },
      { name: 'role', label: 'Rol en Sistema', type: 'select', options: this.roles, required: true, cols: 6, errorMessage: 'Rol requerido' }
    ];
    this.dynamicModal.openModal();
  }




  closeDynamicModal(): void {
    const modalElement = document.getElementById('dynamicModal');
    if (modalElement) {
      const modalInstance = bootstrap.Modal.getInstance(modalElement);
      modalInstance?.hide();
    }
  }


}
