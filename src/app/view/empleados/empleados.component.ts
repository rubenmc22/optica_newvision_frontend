import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import * as bootstrap from 'bootstrap';
import { Empleado, ApiResponse } from '../../Interfaces/models-interface';
import { MatSnackBar } from '@angular/material/snack-bar';


// Servicios
import { ModalService } from './../../core/services/modal/modal.service';
import { EmpleadosService } from './../../core/services/empleados/empleados.service';
import { SwalService } from '../../core/services/swal/swal.service'; // Servicio de SweetAlert2
import { environment } from '../../../environments/environment';

// Componentes
import { DynamicModalComponent } from './../../shared/dynamic-modal/dynamic-modal.component';

@Component({
  selector: 'app-empleados',
  standalone: false,
  templateUrl: './empleados.component.html',
  styleUrls: ['./empleados.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class EmpleadosComponent implements OnInit {
  @ViewChild(DynamicModalComponent, { static: false }) dynamicModal!: DynamicModalComponent;

  selectedEmployee!: any; // ✅ Ahora `selectedEmployee` está definido


  roles: { id: string, nombre: string }[] = [];
  positions: { id: string, nombre: string }[] = [];
  employees: any[] = [];
  filteredEmployees: any[] = [];

  employeeForm: FormGroup;
  modalFields: any[] = [];
  searchQuery: string = '';
  selectedPosition: string | null = null;
  selectedRole: string | null = null;
  avatarPreview: string | ArrayBuffer | null = null;

  constructor(
    private fb: FormBuilder,
    private modalService: ModalService,
    private empleadosService: EmpleadosService,
    private swalService: SwalService,
    private snackBar: MatSnackBar,
  ) {
    this.employeeForm = this.fb.group({
      name: ['', Validators.required],
      document: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
      position: ['', Validators.required],
      role: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadEmployees();
    this.loadRolesAndPositions();
  }

  openViewModal(employee: any): void {
    this.selectedEmployee = employee;
    console.log('Dentro de openViewModal:', employee); // ✅ Verificar estructura en consola
    // ✅ Asegura que el modal se abre correctamente con Bootstrap
    const modalElement = document.getElementById('userDetailsModal');
    if (modalElement) {
      const modalInstance = new bootstrap.Modal(modalElement);
      modalInstance.show();
    }
  }

  private loadRolesAndPositions(): void {
    this.empleadosService.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
      },
      error: (err) => {
        console.error('Error al cargar roles:', err);
        this.swalService.showError('Error', 'No se pudieron cargar los roles');
      }
    });

    this.empleadosService.getCargos().subscribe({
      next: (positions) => {
        this.positions = positions;
      },
      error: (err) => {
        console.error('Error al cargar cargos:', err);
        this.swalService.showError('Error', 'No se pudieron cargar los cargos');
      }
    });

  }

  badgeClass(role: string): string {
    switch (role) {
      case 'Administrador': return 'bg-success';
      case 'Gerente': return 'bg-primary';
      case 'Asesor Optico': return 'bg-info';
      default: return 'bg-secondary';
    }
  }

  /** Cargar empleados desde la API */
  private loadEmployees(): void {
    this.empleadosService.getAllEmpleados().subscribe((empleados: Empleado[]) => {
      console.log('RDMC empleados cargados:', empleados); // ✅ Verificar estructura en consola

      this.employees = empleados; // ✅ Asignación directa sin map()
      this.filteredEmployees = [...this.employees]; // ✅ Filtrado inicial correcto
    });
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;

    // ✅ Verifica que el elemento es una imagen antes de modificarlo
    if (img && img.tagName === 'IMG') {
      img.src = 'assets/default-photo.png';

      // ✅ Registrar en consola el usuario afectado
      console.warn(`Error al cargar la imagen para: ${this.selectedEmployee?.nombre ?? 'Usuario desconocido'}`);
    }
  }


  getProfileImage(): string {
    if (this.selectedEmployee?.avatarUrl && this.selectedEmployee.avatarUrl.trim() !== '') {
      return this.selectedEmployee.avatarUrl;
    }

    return 'assets/default-photo.png'; // ✅ Imagen por defecto si no hay ruta
  }


  /** Agregar un nuevo empleado */
  addEmployee(employee: any): void {
    console.log("RDMC employee", employee);
    const formattedEmployee = {
      rolId: employee.role,
      cargoId: employee.position,
      cedula: employee.cedula.toString(),
      nombre: employee.name,
      email: employee.email || '', // ✅ Agregar si la API lo requiere
      phone: employee.phone || '' // ✅ Agregar si la API lo requiere
      //  fechaRegistro: new Date().toISOString().split('T')[0] // Fecha en formato correcto
    };

    this.empleadosService.addEmployees(formattedEmployee).subscribe({
      next: (newEmployee: any) => {
        console.log('Empleado agregado correctamente:', newEmployee);
        this.employees.push(newEmployee);
        this.filterEmployees();
        this.swalService.showSuccess('¡Registro exitoso!', 'Se ha registrado al Usuario correctamente.');
      },
      error: (err) => {
        this.swalService.showError('Error!', 'Hubo un problema al intentar registrar el usuario.');
        console.error('Error al agregar empleado:', err);
      }
    });
  }

  /** Eliminar empleado con confirmación */
  deleteEmployee(index: number): void {
    const employeeId = this.employees[index].cedula;

    this.modalService.openGlobalModal(
      'Eliminar Empleado',
      '¿Seguro que deseas eliminar este usuario?',
      'Eliminar',
      'Cancelar'
    ).then((confirmed: boolean) => {
      if (confirmed) {
        this.empleadosService.eliminarEmpleados(employeeId).subscribe(() => {
          this.employees.splice(index, 1);
          this.snackBar.open('El usuario se ha eliminado correctamente.', 'Cerrar', {
            duration: 5000,
            verticalPosition: 'top',
            panelClass: ['success-snackbar']
          });
          this.filterEmployees();
        });
      }
    });
  }

  /** Filtros para búsqueda y selección de empleados */
  filterEmployees(): void {
    this.filteredEmployees = this.employees.filter(emp => {
      const matchesSearch = !this.searchQuery ||
        emp.nombre.toLowerCase().includes(this.searchQuery.toLowerCase()) || // ✅ Cambiado `name` por `nombre`
        emp.cedula.toString().includes(this.searchQuery); // ✅ Cambiado `document` por `cedula`

      const matchesPosition = !this.selectedPosition || emp.cargoId === this.selectedPosition; // ✅ `position` → `cargoId`
      const matchesRole = !this.selectedRole || emp.rolId === this.selectedRole; // ✅ `role` → `rolId`

      return matchesSearch && matchesPosition && matchesRole;
    });

    console.log('Resultados filtrados:', this.filteredEmployees); // ✅ Verifica que haya datos filtrados
  }


  /** Limpia la barra de búsqueda */
  clearSearch(): void {
    this.searchQuery = '';
    this.filterEmployees();
  }

  /** Abrir modal dinámico */
  openDynamicModal(): void {
    this.dynamicModal.modalTitle = 'Agregar Nuevo Empleado';
    this.dynamicModal.showRequiredMessage = true;
    this.dynamicModal.onSubmit = this.addEmployee.bind(this);

    this.modalFields = [
      {
        name: 'name', label: 'Nombre Completo', type: 'text', required: true, cols: 6,
        errorMessage: 'Solo se permiten letras', validation: [Validators.required, Validators.pattern(/^[A-Za-zÁÉÍÓÚáéíóúñÑ\s]+$/)]
      },
      {
        name: 'cedula', label: 'Documento de Identidad', type: 'number', required: true, cols: 6,
        errorMessage: 'Debe ser numérico entre 6 y 9 dígitos', validation: [Validators.required, Validators.pattern(/^\d{6,9}$/)]
      },
      {
        name: 'position', label: 'Cargo', type: 'select',
        options: this.positions.map(pos => ({ value: pos.id, label: pos.nombre })), // ✅ Guarda ID, muestra nombre
        required: true, cols: 6, errorMessage: 'Cargo requerido'
      },
      {
        name: 'role', label: 'Rol en Sistema', type: 'select',
        options: this.roles.map(rol => ({ value: rol.id, label: rol.nombre })), // ✅ Guarda ID, muestra nombre
        required: true, cols: 6, errorMessage: 'Rol requerido'
      }
    ];

    this.dynamicModal.openModal();
  }

  /** Cerrar modal dinámico */
  closeDynamicModal(): void {
    const modalElement = document.getElementById('dynamicModal');
    if (modalElement) {
      const modalInstance = bootstrap.Modal.getInstance(modalElement);
      modalInstance?.hide();
    }
  }

  /** Modo edición de empleado */
  toggleEdit(index: number): void {
    this.employees.forEach(emp => emp.editing = false);
    this.employees[index].editing = true;
    this.employees[index].originalValues = { ...this.employees[index] };
  }

  saveEmployeeChanges(index: number): void {
    const emp = this.employees[index];
    let errors: string[] = [];

    console.log('emp', emp);

    // Validar cédula solo si ha cambiado
    if (emp.document !== emp.originalValues.document) {
      if (!emp.document || emp.document.toString().length < 8 || emp.document.toString().length > 9) {
        errors.push('La cédula debe tener entre 8 y 9 dígitos.');
      }
    }

    // Validar nombre solo si ha cambiado
    if (emp.name !== emp.originalValues.name) {
      if (!emp.name || emp.name.trim().length === 0) {
        errors.push('El nombre es requerido.');
      }
    }

    // Validar cargo solo si ha cambiado
    if (emp.position !== emp.originalValues.position) {
      if (!emp.position) {
        errors.push('Debe seleccionar un cargo.');
      }
    }

    // Validar rol solo si ha cambiado
    if (emp.role !== emp.originalValues.role) {
      if (!emp.role) {
        errors.push('Debe seleccionar un rol.');
      }
    }

    // Si hay errores, mostrar todas las alertas juntas y detener el proceso
    if (errors.length > 0) {
      this.snackBar.open(errors.join(' '), 'Cerrar', {
        duration: 5000,
        panelClass: ['info-snackbar']
      });
      return;
    }

    // Enviar la actualización al backend
    const updatedEmployee = { ...emp }; // Copia del objeto sin originalValues
    delete updatedEmployee.originalValues;
    delete updatedEmployee.editing;

    this.empleadosService.actualizarEmpleado(updatedEmployee).subscribe(() => {
      emp.editing = false;
      this.swalService.showSuccess('¡Actualización exitosa!', 'Se ha modificado el usuario correctamente.');
      this.filterEmployees();
    }, error => {
      console.error('Error al actualizar empleado:', error);
      this.swalService.showError('Error!', 'Hubo un problema al intentar actualizar el usuario.');
    });
  }


  /** Cancelar edición de empleado */
  cancelEdit(index: number): void {
    if (this.employees[index].originalValues) {
      Object.assign(this.employees[index], this.employees[index].originalValues);
    }
    this.employees[index].editing = false;
    delete this.employees[index].originalValues;
  }

  /** Validación para números */
  validateNumber(event: any): boolean {
    const charCode = (event.which) ? event.which : event.keyCode;
    return !(charCode > 31 && (charCode < 48 || charCode > 57));
  }

  toggleStatus(employee: Empleado): void {
    const newStatus = !employee.estado; // ✅ Invierte el estado actual

    this.empleadosService.actualizarEstado(employee.id, newStatus).subscribe(() => {
      employee.estado = newStatus; // ✅ Actualiza el estado localmente
      console.log(`Usuario ${employee.nombre} ahora está ${newStatus ? 'Activo' : 'Inhabilitado'}`);
    });
  }

  validateField(employee: any, field: string): void {
    if (!employee.errors) {
      employee.errors = {};
    }

    // Marcar el empleado como modificado
    employee.modified = true;

    switch (field) {
      case 'cedula':
        employee.errors.cedula = !employee.cedula || employee.cedula.toString().length < 8 || employee.cedula.toString().length > 9
          ? 'La cédula debe tener entre 8 y 9 dígitos'
          : '';
        break;
      case 'nombre':
        employee.errors.nombre = !employee.nombre || employee.nombre.trim().length === 0
          ? 'El nombre es requerido'
          : '';
        break;
      case 'cargo':
        employee.errors.cargo = !employee.cargoNombre ? 'Debe seleccionar un cargo' : '';
        break;
      case 'rol':
        employee.errors.rol = !employee.rolNombre ? 'Debe seleccionar un rol' : '';
        break;
    }

    // Si hay errores, el usuario no podrá guardar cambios
    employee.hasErrors = Object.values(employee.errors).some(error => error !== '');
  }



}
