import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PacientesService } from '../../../core/services/pacientes/pacientes.service';

// Componentes
import { DynamicModalComponent } from './../../../shared/dynamic-modal/dynamic-modal.component';

// Servicios
import { ModalService } from './../../../core/services/modal/modal.service';
import { EmpleadosService } from './../../../core/services/empleados/empleados.service';
import { SwalService } from '../../../core/services/swal/swal.service'; // Servicio de SweetAlert2
import { environment } from '../../../../environments/environment';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-ver-pacientes',
  standalone: false,
  templateUrl: './ver-pacientes.component.html',
  styleUrls: ['./ver-pacientes.component.scss']
})

export class VerPacientesComponent implements OnInit {
  @ViewChild(DynamicModalComponent, { static: false }) dynamicModal!: DynamicModalComponent;


  pacientes: any[] = [];
  filtro: string = '';
  modalActivo: boolean = false;
  modoEdicion: boolean = false;
  paciente: any = {};
  modalFields: any[] = [];
  mostrarRedesSociales: boolean = false; 

  constructor(
    private pacientesService: PacientesService,
    private modalService: ModalService,
    private swalService: SwalService,
    private snackBar: MatSnackBar,
  ) { }

  ngOnInit(): void {
    this.cargarPacientes();
  }

  cargarPacientes(): void {
    this.pacientes = [
      { id: '1', nombreCompleto: 'Juan Pérez', cedula: '12345678', edad: 45, fechaRegistro: '2023-05-14' },
      { id: '2', nombreCompleto: 'María López', cedula: '87654321', edad: 32, fechaRegistro: '2023-04-20' },
      { id: '3', nombreCompleto: 'Carlos Rodríguez', cedula: '45678912', edad: 29, fechaRegistro: '2023-06-01' },
      { id: '4', nombreCompleto: 'Ana Fernández', cedula: '78912345', edad: 50, fechaRegistro: '2023-07-10' }
    ];
  }



  /* cargarPacientes(): void { 
     this.pacientesService.getPacientes().subscribe(response => {
       this.pacientes = response;
     });
   }*/

  pacientesFiltrados(): any[] {
    return this.pacientes.filter(p =>
      p.nombreCompleto.toLowerCase().includes(this.filtro.toLowerCase())
    );
  }

  abrirFormulario(editar = false, paciente = null): void {
    this.modoEdicion = editar;
    this.paciente = paciente || { nombre: '', edad: '' };
    this.modalActivo = true;
  }

  cerrarModal(): void {
    this.modalActivo = false;
  }

  /*  guardarPaciente(): void {
      if (this.modoEdicion) {
        this.pacientesService.updatePaciente(this.paciente.id, this.paciente).subscribe(() => {
          this.cargarPacientes();
        });
      } else {
        this.pacientesService.createPaciente(this.paciente).subscribe(() => {
          this.cargarPacientes();
        });
      }
      this.cerrarModal();
    }*/

  eliminarPaciente(id: string): void {
    this.pacientesService.deletePaciente(id).subscribe(() => {
      this.pacientes = this.pacientes.filter(p => p.id !== id);
    });
  }

  verHistorias(id: string): void {
    console.log(`📖 Ver historias médicas del paciente con ID: ${id}`);
  }

  editarPaciente(id: string): void {
    console.log(`✏ Editar información del paciente con ID: ${id}`);
    const pacienteSeleccionado = this.pacientes.find(p => p.id === id);
    this.abrirFormulario(true, pacienteSeleccionado);
  }

  calcularEdad(): void {
    if (this.paciente.fechaNacimiento) {
      const nacimiento = new Date(this.paciente.fechaNacimiento);
      const hoy = new Date();
      const edad = hoy.getFullYear() - nacimiento.getFullYear();

      if (
        hoy.getMonth() < nacimiento.getMonth() ||
        (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())
      ) {
        this.paciente.edad = edad - 1;
      } else {
        this.paciente.edad = edad;
      }
    }
  }

  guardarPaciente(formValues: any): void {
    if (!this.modoEdicion) {
      formValues.fechaRegistro = new Date().toISOString().split('T')[0]; // ✅ Fecha automática
    }

    if (this.modoEdicion) {
      this.pacientesService.updatePaciente(this.paciente.id, formValues).subscribe(() => {
        this.cargarPacientes();
      });
    } else {
      this.pacientesService.createPaciente(formValues).subscribe(() => {
        this.cargarPacientes();
      });
    }

    this.dynamicModal.closeModal(); // ✅ Cierra el modal tras la acción
  }

  addPaciente(formValues: any): void {
    if (!this.modoEdicion) {
      formValues.fechaRegistro = new Date().toISOString().split('T')[0]; // ✅ Fecha automática
    }

    if (this.modoEdicion) {
      this.pacientesService.updatePaciente(this.paciente.id, formValues).subscribe(() => {
        this.cargarPacientes();
      });
    } else {
      this.pacientesService.createPaciente(formValues).subscribe(() => {
        this.cargarPacientes();
      });
    }

    this.dynamicModal.closeModal(); // ✅ Cierra el modal tras la acción
  }

 openDynamicModal(): void {
  this.dynamicModal.modalTitle = this.modoEdicion ? '✏ Editar Paciente' : '➕ Agregar Nuevo Paciente';
  this.dynamicModal.showRequiredMessage = true;
  this.dynamicModal.onSubmit = this.addPaciente.bind(this);
  this.mostrarRedesSociales = true; // ✅ Actívalo solo si quieres mostrar el bloque

  this.modalFields = [
    { name: 'nombreCompleto', label: 'Nombre Completo', type: 'text', required: true, cols: 6 },
    { name: 'cedula', label: 'Cédula', type: 'number', required: true, cols: 6 },
    { name: 'telefono', label: 'Teléfono', type: 'text', required: true, cols: 6 },
    { name: 'email', label: 'Correo Electrónico', type: 'email', required: true, cols: 6 },
    { name: 'fechaNacimiento', label: 'Fecha de Nacimiento', type: 'date', required: true, cols: 6 },
    { name: 'sexo', label: 'Sexo', type: 'select', options: [{ value: 'Masculino' }, { value: 'Femenino' }], required: true, cols: 6 },
    { name: 'direccion', label: 'Dirección', type: 'textarea', required: true, cols: 12 }
  ];

  if (this.mostrarRedesSociales) {
    this.modalFields.push({ name: 'redesSociales', label: 'Redes Sociales', type: 'chips', required: false, cols: 12 });
  }

  this.dynamicModal.openModal();
}




}
