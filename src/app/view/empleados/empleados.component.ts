import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as bootstrap from 'bootstrap';
import { Empleado } from '../../Interfaces/models-interface';
import { MatSnackBar } from '@angular/material/snack-bar';

// Servicios
import { ModalService } from './../../core/services/modal/modal.service';
import { EmpleadosService } from './../../core/services/empleados/empleados.service';
import { SwalService } from '../../core/services/swal/swal.service';
import { LoaderService } from './../../shared/loader/loader.service';

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
  // ==================== VARIABLES DEL COMPONENTE ====================
  selectedEmployee!: any;
  employees: any[] = [];
  filteredEmployees: any[] = [];
  roles: { id: string, nombre: string }[] = [];
  positions: { id: string, nombre: string }[] = [];

  // Variables para ordenamiento
  ordenActual: string = 'nombre';
  ordenAscendente: boolean = true;

  // Formulario interno
  empleadoForm: FormGroup;
  isLoadingForm: boolean = false;

  // Filtros y búsqueda
  searchQuery: string = '';
  selectedPosition: string | null = null;
  selectedRole: string | null = null;

  // Estado y UI
  isLoading = true;

  constructor(
    private fb: FormBuilder,
    private modalService: ModalService,
    private empleadosService: EmpleadosService,
    private swalService: SwalService,
    private snackBar: MatSnackBar,
    private loader: LoaderService

  ) {
    // Inicialización del formulario interno
    this.empleadoForm = this.createEmpleadoForm();
  }

  // ==================== CICLO DE VIDA ====================
  ngOnInit(): void {
    this.loadInitialData();
  }

  private loadInitialData(): void {
    this.loader.show();

    const loadPromises = [
      this.loadEmployees(),
      this.loadRolesAndPositions()
    ];

    Promise.allSettled(loadPromises).then((results) => {
      //console.log('Carga inicial completada', results);
      // FALTA ESTA LÍNEA CRÍTICA:
      this.loader.hide(); // ← AÑADIR ESTA LÍNEA
    }).catch((error) => {
      console.error('Error en carga inicial:', error);
      this.loader.forceHide();
    });
  }

  // ==================== FORMULARIO INTERNO ====================
  private createEmpleadoForm(): FormGroup {
    return this.fb.group({
      nombre: ['', [
        Validators.required,
        Validators.pattern(/^[A-Za-zÁÉÍÓÚáéíóúñÑ\s]+$/),
        Validators.maxLength(100)
      ]],
      cedula: ['', [
        Validators.required,
        Validators.pattern(/^\d{6,9}$/),
        Validators.minLength(6),
        Validators.maxLength(9)
      ]],
      email: ['', [
        Validators.required,
        Validators.email,
        Validators.maxLength(100)
      ]],
      telefono: ['', [
        Validators.pattern(/^[\d\s+\-()]+$/),
        Validators.maxLength(13)
      ]],
      cargoId: ['', Validators.required],
      rolId: ['', Validators.required]
    });
  }

  openDynamicModal(): void {
    this.empleadoForm.reset();
    this.isLoadingForm = false;

    if (this.positions.length === 0 || this.roles.length === 0) {
      this.loadRolesAndPositions();
      setTimeout(() => {
        if (this.positions.length > 0 && this.roles.length > 0) {
          this.openModal();
        } else {
          this.swalService.showError('Error', 'No se pudieron cargar los datos necesarios.');
        }
      }, 1000);
    } else {
      this.openModal();
    }
  }

  private openModal(): void {
    const modalElement = document.getElementById('agregarEmpleadoModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  cerrarModalAgregar(): void {
    const modalElement = document.getElementById('agregarEmpleadoModal');
    if (modalElement) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      modal?.hide();
    }
    this.empleadoForm.reset();
  }

  onSubmitEmpleado(): void {
    if (this.empleadoForm.invalid) {
      this.markFormGroupTouched(this.empleadoForm);
      return;
    }

    this.isLoadingForm = true;
    const formData = this.empleadoForm.value;

    const payload = {
      rolId: formData.rolId,
      cargoId: formData.cargoId,
      cedula: formData.cedula.toString(),
      nombre: formData.nombre.trim(),
      email: formData.email,
      phone: formData.telefono || ''
    };

    this.empleadosService.addEmployees(payload).subscribe({
      next: () => {
        this.isLoadingForm = false;
        this.cerrarModalAgregar();

        this.loadEmployees();

        this.swalService.showSuccess('¡Éxito!', 'Empleado agregado correctamente.');
      },
      error: (err) => {
        this.isLoadingForm = false;
        const msg = err.message?.trim() || '';

        if (msg === 'El numero de cedula ya esta registrado.') {
          this.empleadoForm.get('cedula')?.setErrors({ 'duplicated': true });
          this.swalService.showError('Error', 'La cédula ya está registrada en el sistema.');
        } else {
          this.swalService.showError('Error', 'No se pudo agregar el empleado. Por favor, intenta nuevamente.');
        }

        console.error('Error al agregar empleado:', err);
      }
    });
  }

  // ==================== HELPERS DE VALIDACIÓN ====================
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else {
        control?.markAsTouched();
      }
    });
  }

  showError(controlName: string): boolean {
    const control = this.empleadoForm.get(controlName);
    return control ? (control.invalid && control.touched) : false;
  }

  getErrorMsg(controlName: string): string {
    const control = this.empleadoForm.get(controlName);
    if (!control || !control.errors) return '';

    const errors = control.errors;

    if (errors['required']) return 'Este campo es requerido';
    if (errors['email']) return 'Correo electrónico inválido';
    if (errors['pattern']) {
      switch (controlName) {
        case 'nombre': return 'Solo se permiten letras y espacios';
        case 'cedula': return 'Debe contener solo números (6-9 dígitos)';
        case 'telefono': return 'Formato de teléfono inválido';
        default: return 'Formato inválido';
      }
    }
    if (errors['minlength']) return `Mínimo ${errors['minlength'].requiredLength} caracteres`;
    if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    if (errors['duplicated']) return 'Esta cédula ya está registrada';

    return 'Campo inválido';
  }

  // ==================== MÉTODOS ADICIONALES PARA EL FORMULARIO ====================
  getFormProgress(): number {
    const totalFields = this.getTotalFields();
    const completedFields = this.getCompletedFields();
    return totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
  }

  getTotalFields(): number {
    return Object.keys(this.empleadoForm.controls).filter(key => {
      const control = this.empleadoForm.get(key);
      return control?.validator?.(control) ? true : false;
    }).length;
  }

  getCompletedFields(): number {
    return Object.keys(this.empleadoForm.controls).filter(key => {
      const control = this.empleadoForm.get(key);
      const hasValidator = control?.validator?.(control);
      return hasValidator && control?.valid && control?.value;
    }).length;
  }

  resetForm(): void {
    this.empleadoForm.reset();
    // Marcar como untouched para limpiar errores
    this.empleadoForm.markAsUntouched();
  }

  // ==================== MÉTODOS DE ORDENAMIENTO ====================
  ordenarPor(columna: string): void {
    if (this.ordenActual === columna) {
      this.ordenAscendente = !this.ordenAscendente;

    } else {
      this.ordenActual = columna;
      this.ordenAscendente = true;
    }

    this.filteredEmployees.sort((a, b) => {
      let valorA = a[columna];
      let valorB = b[columna];

      if (valorA == null) valorA = '';
      if (valorB == null) valorB = '';

      if (typeof valorA === 'string') valorA = valorA.toLowerCase();
      if (typeof valorB === 'string') valorB = valorB.toLowerCase();

      let resultado = 0;

      if (valorA < valorB) {
        resultado = -1;
      } else if (valorA > valorB) {
        resultado = 1;
      }

      return this.ordenAscendente ? resultado : -resultado;
    });
  }

  // ==================== MÉTODOS DE CARGA DE DATOS ====================
  private loadEmployees(): void {
    this.isLoading = true;
    this.empleadosService.getAllEmpleados().subscribe((empleados: Empleado[]) => {
   //   console.log('Empleados', empleados);
      this.employees = empleados;
      this.filteredEmployees = [...this.employees];
      this.isLoading = false;
    }, error => {
      console.error('Error al cargar empleados:', error);
      this.isLoading = false;
    });
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

  // ==================== MÉTODOS DE MODALES ====================
  openViewModal(employee: any): void {
    const rawDate = employee.fechaNacimiento;

    let date: Date | null = null;

    if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      const [year, month, day] = rawDate.split('-').map(Number);
      date = new Date(year, month - 1, day);
    } else {
      date = new Date(rawDate);
    }

    if (date && !isNaN(date.getTime())) {
      const dayStr = String(date.getDate()).padStart(2, '0');
      const monthStr = String(date.getMonth() + 1).padStart(2, '0');
      const yearStr = date.getFullYear();
      employee.fechaNacimiento = `${dayStr}/${monthStr}/${yearStr}`;
    }

    this.selectedEmployee = employee;

    const modalElement = document.getElementById('userDetailsModal');
    if (modalElement) {
      const modalInstance = new bootstrap.Modal(modalElement);
      modalInstance.show();
    }
  }

  private cerrarModal(id: string): void {
    const el = document.getElementById(id);
    if (el) bootstrap.Modal.getInstance(el)?.hide();
  }

  // ==================== MÉTODOS DE CRUD EMPLEADOS ====================

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

  toggleEdit(index: number): void {
    this.employees.forEach(emp => emp.editing = false);
    this.employees[index].editing = true;
    this.employees[index].originalValues = { ...this.employees[index] };
  }

  onCargoChange(employee: any, cargoId: string): void {
    employee.cargoId = cargoId;
    const selected = this.positions.find(pos => pos.id === cargoId);
    if (selected) {
      employee.cargoNombre = selected.nombre;
    }
    employee.modified = true;
    this.validateField(employee, 'cargo');
  }

  onRolChange(employee: any, rolId: string): void {
    employee.rolId = rolId;
    const selected = this.roles.find(rol => rol.id === rolId);
    if (selected) {
      employee.rolNombre = selected.nombre;
    }
    employee.modified = true;
    this.validateField(employee, 'rol');
  }

  updateEmployee(index: number): void {
    const emp = this.employees[index];
    const errors = this.validateEmployeeChanges(emp);

    if (errors.length > 0) {
      this.snackBar.open(errors.join(' '), 'Cerrar', {
        duration: 5000,
        panelClass: ['info-snackbar']
      });
      return;
    }

    const updatedEmployee = this.buildEmployeePayload(emp);

    this.empleadosService.actualizarEmpleado(updatedEmployee).subscribe({
      next: () => {
        emp.editing = false;
        this.swalService.showSuccess('¡Actualización exitosa!', 'Se ha modificado el usuario correctamente.');
        this.filterEmployees();
      },
      error: (error) => {
        console.error('Error al actualizar empleado:', error);
        this.swalService.showError('Error!', 'Hubo un problema al intentar actualizar el usuario.');
      }
    });
  }

  private buildEmployeePayload(emp: any): any {
    return {
      rolId: emp.rolId,
      cargoId: emp.cargoId,
      cedula: emp.cedula,
      nombre: emp.nombre,
      email: emp.email ?? '',
    };
  }

  private validateEmployeeChanges(emp: any): string[] {
    const errors: string[] = [];

    const hasChanged = (field: keyof typeof emp) => emp[field] !== emp.originalValues[field];

    if (hasChanged('cedula')) {
      const doc = emp.cedula?.toString() ?? '';
      if (doc.length < 6 || doc.length > 9) {
        errors.push('La cédula debe tener entre 6 y 9 dígitos.');
      }
    }

    if (hasChanged('nombre') && (!emp.nombre || emp.nombre.trim().length === 0)) {
      errors.push('El nombre es requerido.');
    }

    if (hasChanged('cargoId') && !emp.cargoId) {
      errors.push('Debe seleccionar un cargo.');
    }

    if (hasChanged('rolId') && !emp.rolId) {
      errors.push('Debe seleccionar un rol.');
    }

    return errors;
  }

  cancelEdit(index: number): void {
    if (this.employees[index].originalValues) {
      Object.assign(this.employees[index], this.employees[index].originalValues);
    }
    this.employees[index].editing = false;
    delete this.employees[index].originalValues;
  }

  // ==================== MÉTODOS DE FILTRADO ====================
  filterEmployees(): void {
    this.filteredEmployees = this.employees.filter(emp => {
      const matchesSearch = !this.searchQuery ||
        emp.nombre.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        emp.cedula.toString().includes(this.searchQuery);

      const matchesPosition = !this.selectedPosition || emp.cargoId === this.selectedPosition;
      const matchesRole = !this.selectedRole || emp.rolId === this.selectedRole;

      return matchesSearch && matchesPosition && matchesRole;
    });
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.filterEmployees();
  }

  // ==================== MÉTODOS DE VALIDACIÓN ====================
  validateField(employee: any, field: string): void {
    if (!employee.errors) {
      employee.errors = {};
    }

    employee.modified = true;

    switch (field) {
      case 'cedula':
        employee.errors.cedula = !employee.cedula || employee.cedula.toString().length < 6 || employee.cedula.toString().length > 9
          ? 'La cédula debe tener entre 6 y 9 dígitos'
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

    employee.hasErrors = Object.values(employee.errors).some(error => error !== '');
  }

  validateNumber(event: any): boolean {
    const charCode = (event.which) ? event.which : event.keyCode;
    return !(charCode > 31 && (charCode < 48 || charCode > 57));
  }

  // ==================== MÉTODOS DE ESTADO ====================
  toggleStatus(employee: Empleado): void {
    const originalStatus = employee.estatus;
    employee.loading = true;

    this.empleadosService.actualizarEstado(employee.cedula, originalStatus).subscribe({
      next: () => {
        employee.loading = false;
      },
      error: () => {
        console.error(`Error al actualizar estado del usuario ${employee.nombre}`);
        employee.estatus = !originalStatus;
        employee.loading = false;
      }
    });
  }

  // ==================== MÉTODOS DE UI/HELPERS ====================
  badgeClass(role: string): string {
    switch (role) {
      case 'Administrador': return 'badge-admin';
      case 'Gerente': return 'badge-gerente';
      case 'Asesor Optico': return 'badge-asesor';
      case 'Médico': return 'badge-medico';
      default: return 'badge-default';
    }
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && img.tagName === 'IMG') {
      img.src = 'assets/default-photo.png';
      console.warn(`Error al cargar la imagen para: ${this.selectedEmployee?.nombre ?? 'Usuario desconocido'}`);
    }
  }

  getProfileImage(): string {
    if (this.selectedEmployee?.avatarUrl && this.selectedEmployee.avatarUrl.trim() !== '') {
      return this.selectedEmployee.avatarUrl;
    }
    return 'assets/default-photo.png';
  }

  trackByEmployeeId(index: number, emp: Empleado): string {
    return emp.cedula;
  }

  onFieldChange(employee: Empleado, field: keyof Empleado): void {
    employee.modified = true;
    this.validateField(employee, field as string);
  }

  onSelectChange(employee: any, field: 'cargoNombre' | 'rolNombre'): void {
    employee.modified = true;
    this.validateField(employee, field === 'cargoNombre' ? 'cargo' : 'rol');
  }
}