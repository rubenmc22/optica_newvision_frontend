import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as bootstrap from 'bootstrap';
import { Empleado } from '../../Interfaces/models-interface';
import { MatSnackBar } from '@angular/material/snack-bar';

// Servicios
import { ModalService } from './../../core/services/modal/modal.service';
import { EmpleadosService } from './../../core/services/empleados/empleados.service';
import { SwalService } from '../../core/services/swal/swal.service';

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
  @ViewChild(DynamicModalComponent, { static: false }) dynamicModal!: DynamicModalComponent;

  // Datos de empleados y listas
  selectedEmployee!: any;
  employees: any[] = [];
  filteredEmployees: any[] = [];
  roles: { id: string, nombre: string }[] = [];
  positions: { id: string, nombre: string }[] = [];

  // Variables para ordenamiento
  ordenActual: string = 'nombre';
  ordenAscendente: boolean = true;

  // Formularios y controles
  employeeForm: FormGroup;
  modalFields: any[] = [];

  // Filtros y búsqueda
  searchQuery: string = '';
  selectedPosition: string | null = null;
  selectedRole: string | null = null;

  // Estado y UI
  avatarPreview: string | ArrayBuffer | null = null;
  mostrarRedesSociales: boolean = false;
  isLoading = true;

  constructor(
    private fb: FormBuilder,
    private modalService: ModalService,
    private empleadosService: EmpleadosService,
    private swalService: SwalService,
    private snackBar: MatSnackBar,
  ) {
    // Inicialización del formulario
    this.employeeForm = this.fb.group({
      name: ['', Validators.required],
      document: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
      position: ['', Validators.required],
      role: ['', Validators.required]
    });
  }

  // ==================== CICLO DE VIDA ====================
  ngOnInit(): void {
    this.loadEmployees();
    this.loadRolesAndPositions();
  }

  // ==================== MÉTODOS DE ORDENAMIENTO ====================
  /**
   * Ordena los empleados por una columna específica
   * @param columna Columna por la cual ordenar
   */
  ordenarPor(columna: string): void {
    if (this.ordenActual === columna) {
      // Si ya está ordenado por esta columna, invertir el orden
      this.ordenAscendente = !this.ordenAscendente;
    } else {
      // Si es una nueva columna, ordenar ascendente por defecto
      this.ordenActual = columna;
      this.ordenAscendente = true;
    }

    this.filteredEmployees.sort((a, b) => {
      let valorA = a[columna];
      let valorB = b[columna];

      // Manejar valores nulos o undefined
      if (valorA == null) valorA = '';
      if (valorB == null) valorB = '';

      // Convertir a minúsculas para ordenamiento case-insensitive si son strings
      if (typeof valorA === 'string') valorA = valorA.toLowerCase();
      if (typeof valorB === 'string') valorB = valorB.toLowerCase();

      let resultado = 0;

      if (valorA < valorB) {
        resultado = -1;
      } else if (valorA > valorB) {
        resultado = 1;
      }

      // Invertir el resultado si el orden es descendente
      return this.ordenAscendente ? resultado : -resultado;
    });
  }

  // ==================== MÉTODOS DE CARGA DE DATOS ====================
  /**
   * Carga la lista de empleados desde el servicio
   */
  private loadEmployees(): void {
    this.isLoading = true;
    this.empleadosService.getAllEmpleados().subscribe((empleados: Empleado[]) => {
      console.log('Empleados', empleados);
      this.employees = empleados;
      this.filteredEmployees = [...this.employees];
      this.isLoading = false;
    }, error => {
      console.error('Error al cargar empleados:', error);
      this.isLoading = false;
    });
  }

  /**
   * Carga los roles y cargos disponibles desde el servicio
   */
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
  /**
   * Abre el modal para ver detalles de un empleado
   * @param employee Empleado a mostrar en el modal
   */
  openViewModal(employee: any): void {
    const rawDate = employee.fechaNacimiento;

    // Evita el parseo UTC usando componentes separados
    let date: Date | null = null;

    if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      const [year, month, day] = rawDate.split('-').map(Number);
      date = new Date(year, month - 1, day); // Local time
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

  /**
   * Abre el modal dinámico para agregar un nuevo empleado
   */
  openDynamicModal(): void {
    this.dynamicModal.modalTitle = 'Agregar Nuevo Empleado';
    this.dynamicModal.showRequiredMessage = true;
    this.dynamicModal.onSubmit = this.addEmployee.bind(this);
    this.mostrarRedesSociales = false;

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
        name: 'email', label: 'Correo Electrónico', type: 'email', required: true, cols: 6,
        errorMessage: 'Correo inválido', validation: [Validators.required, Validators.email]
      },
      {
        name: 'position', label: 'Cargo', type: 'select',
        options: this.positions.map(pos => ({ value: pos.id, label: pos.nombre })),
        required: true, cols: 3, errorMessage: 'Cargo requerido'
      },
      {
        name: 'role', label: 'Rol en Sistema', type: 'select',
        options: this.roles.map(rol => ({ value: rol.id, label: rol.nombre })),
        required: true, cols: 3, errorMessage: 'Rol requerido'
      }
    ];

    this.dynamicModal.openModal();
  }

  /**
   * Cierra un modal dado su ID
   * @param id ID del modal a cerrar
   */
  private cerrarModal(id: string): void {
    const el = document.getElementById(id);
    if (el) bootstrap.Modal.getInstance(el)?.hide();
  }

  onSelectChange(employee: any, field: 'cargoNombre' | 'rolNombre'): void {
    employee.modified = true;
    this.validateField(employee, field === 'cargoNombre' ? 'cargo' : 'rol');
  }

  // ==================== MÉTODOS DE CRUD EMPLEADOS ====================
  /**
   * Agrega un nuevo empleado
   * @param employee Datos del empleado a agregar
   */
  addEmployee(employee: any): void {
    const payload = {
      rolId: employee.role,
      cargoId: employee.position,
      cedula: employee.cedula.toString(),
      nombre: employee.name,
      email: employee.email || '',
      phone: employee.phone || ''
    };
    this.isLoading = true;

    this.empleadosService.addEmployees(payload).subscribe({
      next: () => {
        this.empleadosService.getAllEmpleados().subscribe((empleados) => {
          this.employees = [...empleados];
          this.filterEmployees();
        });
        this.isLoading = false;

        this.cerrarModal('dynamicModal');
        this.swalService.showSuccess('¡Registro exitoso!', 'Usuario registrado correctamente.');
      },
      error: (err) => {
        this.isLoading = false;
        const msg = err.message?.trim() || '';

        if (msg === 'El numero de cedula ya esta registrado.') {
          this.swalService.showError('Cédula ya registrada', 'Por favor, ingresa una diferente.');
        } else {
          this.cerrarModal('dynamicModal');
          this.swalService.showError('Error inesperado', msg || 'Hubo un problema al registrar el usuario.');
        }

        console.error('Error al agregar empleado:', err);
      }
    });
  }

  /**
   * Elimina un empleado con confirmación
   * @param index Índice del empleado a eliminar
   */
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

  /**
   * Activa el modo edición para un empleado
   * @param index Índice del empleado a editar
   */
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
  }

  onRolChange(employee: any, rolId: string): void {
    employee.rolId = rolId;
    const selected = this.roles.find(rol => rol.id === rolId);
    if (selected) {
      employee.rolNombre = selected.nombre;
    }
    employee.modified = true;
  }

  /**
   * Guarda los cambios de un empleado editado
   * @param index Índice del empleado editado
   */
  updateEmployee(index: number): void {
    const emp = this.employees[index];
    console.log('RDMC emp', emp);
    const errors = this.validateEmployeeChanges(emp);

    if (errors.length > 0) {
      this.snackBar.open(errors.join(' '), 'Cerrar', {
        duration: 5000,
        panelClass: ['info-snackbar']
      });
      return;
    }

    const updatedEmployee = this.buildEmployeePayload(emp);

    console.log('RDMC updatedEmployee', updatedEmployee);

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

  private formatDate(date: string | Date): string {
    const d = new Date(date);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  }

  private validateEmployeeChanges(emp: any): string[] {
    const errors: string[] = [];

    const hasChanged = (field: keyof typeof emp) => emp[field] !== emp.originalValues[field];

    if (hasChanged('document')) {
      const doc = emp.document?.toString() ?? '';
      if (doc.length < 8 || doc.length > 9) {
        errors.push('La cédula debe tener entre 8 y 9 dígitos.');
      }
    }

    if (hasChanged('name') && (!emp.name || emp.name.trim().length === 0)) {
      errors.push('El nombre es requerido.');
    }

    if (hasChanged('position') && !emp.position) {
      errors.push('Debe seleccionar un cargo.');
    }

    if (hasChanged('role') && !emp.role) {
      errors.push('Debe seleccionar un rol.');
    }

    return errors;
  }

  /**
   * Cancela la edición de un empleado
   * @param index Índice del empleado en edición
   */
  cancelEdit(index: number): void {
    if (this.employees[index].originalValues) {
      Object.assign(this.employees[index], this.employees[index].originalValues);
    }
    this.employees[index].editing = false;
    delete this.employees[index].originalValues;
  }

  // ==================== MÉTODOS DE FILTRADO ====================
  /**
   * Filtra los empleados según los criterios de búsqueda
   */
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

  /**
   * Limpia la barra de búsqueda
   */
  clearSearch(): void {
    this.searchQuery = '';
    this.filterEmployees();
  }

  // ==================== MÉTODOS DE VALIDACIÓN ====================
  /**
   * Valida un campo específico de un empleado
   * @param employee Empleado a validar
   * @param field Campo a validar
   */
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

  /**
   * Valida que solo se ingresen números en un campo
   * @param event Evento del teclado
   * @returns True si es un número, false si no
   */
  validateNumber(event: any): boolean {
    const charCode = (event.which) ? event.which : event.keyCode;
    return !(charCode > 31 && (charCode < 48 || charCode > 57));
  }

  // ==================== MÉTODOS DE ESTADO ====================
  /**
   * Cambia el estado de un empleado (activo/inactivo)
   * @param employee Empleado a modificar
   */
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
  /**
   * Obtiene la clase CSS para el badge según el rol
   * @param role Rol del empleado
   * @returns Clase CSS correspondiente
   */
  badgeClass(role: string): string {
    switch (role) {
      case 'Administrador': return 'badge-admin';
      case 'Gerente': return 'badge-gerente';
      case 'Asesor Optico': return 'badge-asesor';
      case 'Médico': return 'badge-medico';
      default: return 'badge-default';
    }
  }

  /**
   * Maneja errores al cargar imágenes de perfil
   * @param event Evento de error
   */
  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && img.tagName === 'IMG') {
      img.src = 'assets/default-photo.png';
      console.warn(`Error al cargar la imagen para: ${this.selectedEmployee?.nombre ?? 'Usuario desconocido'}`);
    }
  }

  /**
   * Obtiene la URL de la imagen de perfil
   * @returns URL de la imagen o la imagen por defecto
   */
  getProfileImage(): string {
    if (this.selectedEmployee?.avatarUrl && this.selectedEmployee.avatarUrl.trim() !== '') {
      return this.selectedEmployee.avatarUrl;
    }
    return 'assets/default-photo.png';
  }

  trackByEmployeeId(index: number, emp: Empleado): string {
    return emp.id;
  }

  onFieldChange(employee: Empleado, field: keyof Empleado): void {
    employee.modified = true;
    this.validateField(employee, field);
  }
}