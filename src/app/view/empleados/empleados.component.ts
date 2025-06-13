import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import * as bootstrap from 'bootstrap';

// Servicios
import { ModalService } from './../../core/services/modal/modal.service';
import { EmpleadosService } from './../../core/services/empleados/empleados.service';

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

  positions: string[] = [];
  roles: string[] = [];
  employees: any[] = [];
  filteredEmployees: any[] = [];

  employeeForm: FormGroup;
  modalFields: any[] = [];
  searchQuery: string = '';
  selectedPosition: string | null = null;
  selectedRole: string | null = null;

  constructor(
    private fb: FormBuilder,
    private modalService: ModalService,
    private empleadosService: EmpleadosService
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

  private loadRolesAndPositions(): void {
    this.empleadosService.getRoles().subscribe(roles => {
      this.roles = roles;
    });

    this.empleadosService.getCargos().subscribe(positions => {
      this.positions = positions;
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
    /* this.empleadosService.getAllEmpleados().subscribe((data: any[]) => {
       this.employees = data;
       this.filterEmployees();
     });*/
  }

  /** Agregar un nuevo empleado */
  addEmployee(employee: any): void {
    this.empleadosService.addEmployee(employee).subscribe((newEmployee: any) => {
      this.employees.push(newEmployee);
      this.filterEmployees();
    });
  }

  /** Eliminar empleado con confirmación */
  deleteEmployee(index: number): void {
    const employeeId = this.employees[index].document; // Suponiendo que document es el identificador único

    this.modalService.openGlobalModal(
      'Eliminar Empleado',
      '¿Seguro que deseas eliminar este usuario?',
      'Eliminar',
      'Cancelar'
    ).then((confirmed: boolean) => {
      if (confirmed) {
        this.empleadosService.eliminarEmpleados(employeeId).subscribe(() => {
          this.employees.splice(index, 1);
          this.filterEmployees();
        });
      }
    });
  }

  /** Filtros para búsqueda y selección de empleados */
  filterEmployees(): void {
    this.filteredEmployees = this.employees.filter(emp => {
      const matchesSearch = !this.searchQuery ||
        emp.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        emp.document.toString().includes(this.searchQuery);
      const matchesPosition = !this.selectedPosition || emp.position === this.selectedPosition;
      const matchesRole = !this.selectedRole || emp.role === this.selectedRole;

      return matchesSearch && matchesPosition && matchesRole;
    });
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
    this.modalFields = [
      {
        name: 'name', label: 'Nombre Completo', type: 'text', required: true, cols: 6,
        errorMessage: 'Solo se permiten letras', validation: [Validators.required, Validators.pattern(/^[A-Za-zÁÉÍÓÚáéíóúñÑ\s]+$/)]
      },
      {
        name: 'cedula', label: 'Documento de Identidad', type: 'number', required: true, cols: 6,
        errorMessage: 'Debe ser numérico entre 6 y 9 dígitos', validation: [Validators.required, Validators.pattern(/^\d{6,9}$/)]
      },
      { name: 'position', label: 'Cargo', type: 'select', options: this.positions, required: true, cols: 6, errorMessage: 'Cargo requerido' },
      { name: 'role', label: 'Rol en Sistema', type: 'select', options: this.roles, required: true, cols: 6, errorMessage: 'Rol requerido' }
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

  /** Guardar cambios en empleado */
  saveEmployeeChanges(index: number): void {
    const emp = this.employees[index];

    if (!emp.document || emp.document.toString().length < 8 || emp.document.toString().length > 9) {
      alert('La cédula debe tener entre 8 y 9 dígitos');
      return;
    }
    if (!emp.name || emp.name.trim().length === 0) {
      alert('El nombre es requerido');
      return;
    }
    if (!emp.position || !emp.role) {
      alert('Debe seleccionar tanto el cargo como el rol');
      return;
    }

    emp.editing = false;
    delete emp.originalValues;
    alert('Usuario modificado correctamente');
    this.filterEmployees();
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
}
