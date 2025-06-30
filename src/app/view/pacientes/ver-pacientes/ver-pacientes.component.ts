import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, FormControl } from '@angular/forms';
import { PacientesService } from '../../../core/services/pacientes/pacientes.service';
import { SwalService } from '../../../core/services/swal/swal.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as bootstrap from 'bootstrap';
import { ModalService } from './../../../core/services/modal/modal.service';


@Component({
  selector: 'app-ver-pacientes',
  standalone: false,
  templateUrl: './ver-pacientes.component.html',
  styleUrls: ['./ver-pacientes.component.scss']
})

export class VerPacientesComponent implements OnInit {
  formPaciente: FormGroup;
  pacientes: any[] = [];
  filtro: string = '';
  modoEdicion: boolean = false;
  pacienteEditando: any = null;
  formOriginal: any = {};
  listaRedes: string[] = ['Facebook', 'Twitter', 'Instagram', 'LinkedIn', 'TikTok'];
  nuevaRed: string = '';
  nuevoUsuario: string = '';
  usuarioInputHabilitado: boolean = false;
  pacienteSeleccionado: any = null;

  constructor(
    private fb: FormBuilder,
    private pacientesService: PacientesService,
    private router: Router,
    private cdRef: ChangeDetectorRef,
    private modalService: ModalService,
    private swalService: SwalService,
  ) {
    this.formPaciente = this.fb.group({
      nombreCompleto: ['', Validators.required],
      cedula: ['', Validators.required],
      telefono: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      fechaNacimiento: ['', Validators.required],
      ocupacion: ['', Validators.required],
      genero: ['', Validators.required],
      direccion: ['', Validators.required],
      redesSociales: this.fb.array([])
    });
  }

  ngOnInit(): void {
    //   this.cargarPacientes();
    this.cargarPacientesMock();
    this.cdRef.detectChanges();
  }

  get redesSociales(): FormArray {
    return this.formPaciente.get('redesSociales') as FormArray;
  }

  cargarPacientes(): void {
    this.pacientesService.getPacientes().subscribe({
      next: (data) => {
        this.pacientes = data;
      },
      error: (error) => {
        console.error('Error al cargar pacientes:', error);
        this.swalService.showError('Error', ' No se han podido cargar los pacientes');
      }
    });
  }

  // Datos mock para pacientes
  cargarPacientesMock(): void {
    this.pacientes = [
      {
        id: '1',
        nombreCompleto: 'María González',
        cedula: '123456789',
        telefono: '3001234567',
        email: 'maria@example.com',
        fechaNacimiento: '1985-05-15',
        edad: 38,
        ocupacion: 'Ingeniera',
        genero: 'Femenino',
        direccion: 'Calle 123 #45-67',
        fechaRegistro: '2023-01-10',
        redesSociales: [
          { platform: 'Facebook', username: 'maria.gonzalez' },
          { platform: 'Instagram', username: '@maria.g' }
        ]
      },
      {
        id: '2',
        nombreCompleto: 'Carlos Pérez',
        cedula: '987654321',
        telefono: '3107654321',
        email: 'carlos@example.com',
        fechaNacimiento: '1990-11-22',
        edad: 33,
        ocupacion: 'Médico',
        genero: 'Masculino',
        direccion: 'Avenida 5 #12-34',
        fechaRegistro: '2023-02-15',
        redesSociales: [
          { platform: 'Twitter', username: '@carlos_p' },
          { platform: 'LinkedIn', username: 'carlos-perez' }
        ]
      },
      {
        id: '3',
        nombreCompleto: 'Ana Rodríguez',
        cedula: '456789123',
        telefono: '3204567890',
        email: 'ana@example.com',
        fechaNacimiento: '1978-08-30',
        edad: 45,
        ocupacion: 'Abogada',
        genero: 'Femenino',
        direccion: 'Carrera 7 #89-10',
        fechaRegistro: '2023-03-20',
        redesSociales: []
      }
    ];
  }

  pacientesFiltrados(): any[] {
    return this.pacientes.filter(paciente =>
      paciente.nombreCompleto.toLowerCase().includes(this.filtro.toLowerCase()) ||
      paciente.cedula.includes(this.filtro)
    );
  }

  crearPaciente(): void {
    if (this.formPaciente.invalid) {
      this.marcarCamposComoTouched();
      return;
    }

    const nuevoPaciente = {
      ...this.formPaciente.value,
      fechaRegistro: new Date().toISOString()
    };

    this.pacientesService.createPaciente(nuevoPaciente).subscribe({
      next: (response) => {
        this.pacientes.push(response);
        this.cerrarModal('modalAgregarPaciente');
        this.swalService.showSuccess('¡Registro exitoso!', 'Paciente registrado correctamente.');
        this.cargarPacientes();
      },
      error: (error) => {
        console.error('Error al crear paciente:', error);
        this.swalService.showError('Error', 'No se ha podido registrar al paciente');
      }
    });
  }

  editarPaciente(paciente: any): void {
    this.modoEdicion = true;
    this.pacienteEditando = paciente;

    // Guardar valores originales para comparación
    this.formOriginal = JSON.parse(JSON.stringify({
      nombreCompleto: paciente.nombreCompleto,
      cedula: paciente.cedula,
      telefono: paciente.telefono,
      email: paciente.email,
      fechaNacimiento: paciente.fechaNacimiento,
      ocupacion: paciente.ocupacion,
      genero: paciente.genero,
      direccion: paciente.direccion,
      redesSociales: paciente.redesSociales || []
    }));

    // Cargar datos en el formulario
    this.formPaciente.patchValue({
      nombreCompleto: paciente.nombreCompleto,
      cedula: paciente.cedula,
      telefono: paciente.telefono,
      email: paciente.email,
      fechaNacimiento: paciente.fechaNacimiento,
      ocupacion: paciente.ocupacion,
      genero: paciente.genero,
      direccion: paciente.direccion
    });

    // Cargar redes sociales
    this.redesSociales.clear();
    if (paciente.redesSociales) {
      paciente.redesSociales.forEach((red: any) => {
        this.redesSociales.push(this.fb.group({
          platform: [red.platform],
          username: [red.username]
        }));
      });
    }

    this.openModalAgregar('modalAgregarPaciente');
  }

  actualizarPaciente(): void {
    if (!this.formularioModificado()) {
      return;
    }

    const datosActualizados = {
      ...this.formPaciente.value,
      id: this.pacienteEditando.id
    };

    this.pacientesService.updatePaciente(this.pacienteEditando.id, datosActualizados).subscribe({
      next: (response) => {
        const index = this.pacientes.findIndex(p => p.id === this.pacienteEditando.id);
        if (index !== -1) {
          this.pacientes[index] = response;
        }
        this.cerrarModal('modalAgregarPaciente');
        this.swalService.showSuccess('¡Actualización exitosa!', 'El Paciente se ha actualizado correctamente.');
      },
      error: (error) => {
        console.error('Error al actualizar paciente:', error);
        this.swalService.showError('Error', 'No se ha podido actualizar al paciente');
      }
    });
  }

  guardarPaciente(): void {
    if (this.modoEdicion) {
      this.actualizarPaciente();
    } else {
      this.crearPaciente();
    }
  }

  // Métodos para redes sociales
  habilitarUsuario(): void {
    this.usuarioInputHabilitado = !!this.nuevaRed;
  }

  addRedSocial(platform: string, username: string): void {
    if (platform && username) {
      this.redesSociales.push(this.fb.group({
        platform: [platform],
        username: [username]
      }));
      this.nuevaRed = '';
      this.nuevoUsuario = '';
      this.usuarioInputHabilitado = false;
    }
  }

  removeRedSocial(index: number): void {
    this.redesSociales.removeAt(index);
  }

  getSocialIconClass(platform: string): string {
    switch (platform.toLowerCase()) {
      case 'facebook': return 'bi bi-facebook text-primary';
      case 'twitter': return 'bi bi-twitter text-info';
      case 'instagram': return 'bi bi-instagram text-danger';
      case 'linkedin': return 'bi bi-linkedin text-primary';
      case 'tiktok': return 'bi bi-tiktok';
      default: return 'bi bi-share';
    }
  }

  // Métodos para el modal
  openModalAgregar(id: string): void {
    const modalElement = document.getElementById(id);
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  cerrarModal(id: string): void {
    const modalElement = document.getElementById(id);

    if (modalElement) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      modal?.hide();
    }

    this.resetearFormulario();
  }
  resetearFormulario(): void {
    this.formPaciente.reset();
    this.redesSociales.clear();
    this.modoEdicion = false;
    this.pacienteEditando = null;
    this.formOriginal = {};
    this.nuevaRed = '';
    this.nuevoUsuario = '';
    this.usuarioInputHabilitado = false;
  }

  // Métodos de validación
  formularioModificado(): boolean {
    if (!this.modoEdicion) return true;

    // Verificar cambios en campos básicos
    const formActual = this.formPaciente.value;
    const camposModificados = Object.keys(this.formOriginal).some(
      key => key !== 'redesSociales' &&
        formActual[key] !== this.formOriginal[key]
    );

    // Verificar cambios en redes sociales
    const redesModificadas = !this.arraysIguales(
      this.redesSociales.value,
      this.formOriginal.redesSociales
    );

    return camposModificados || redesModificadas;
  }

  eliminarPaciente(id: string): void {
    const paciente = this.pacientes.find(p => p.id === id);
    if (!paciente) return;

    this.modalService.openGlobalModal(
      'Eliminar Paciente',
      `¿Está seguro que desea eliminar al paciente ${paciente.nombreCompleto}?`,
      'Eliminar',
      'Cancelar'
    ).then((confirmed: boolean) => {
      if (confirmed) {
        this.pacientesService.deletePaciente(id).subscribe({
          next: () => {
            this.pacientes = this.pacientes.filter(p => p.id !== id);
            this.swalService.showSuccess('¡Eliminación exitosa!', 'Se ha eliminado al paciente correctamente.');
          },
          error: (error) => {
            console.error('Error al eliminar paciente:', error);
            this.swalService.showError('Error', 'No se ha podido eliminar al paciente');
          }
        });
      }
    });
  }

  arraysIguales(a: any[], b: any[]): boolean {
    if (a?.length !== b?.length) return false;
    if (!a && !b) return true;

    const aSorted = [...a].sort((x, y) => x.platform.localeCompare(y.platform));
    const bSorted = [...b].sort((x, y) => x.platform.localeCompare(y.platform));

    return aSorted.every((val, index) =>
      val.platform === bSorted[index]?.platform &&
      val.username === bSorted[index]?.username
    );
  }

  marcarCamposComoTouched(): void {
    Object.values(this.formPaciente.controls).forEach(control => {
      control.markAsTouched();
    });
  }

  mostrarMensaje(mensaje: string, tipo: 'success' | 'error' | 'info'): void {
    // Implementa tu sistema de notificaciones aquí
    alert(`${tipo.toUpperCase()}: ${mensaje}`);
  }

  // ver-pacientes.component.ts
  verHistorias(idPaciente: string): void {
    // Guardar el estado actual (scroll, filtros, etc.)
    sessionStorage.setItem('pacientesListState', JSON.stringify({
      scrollPosition: window.scrollY,
      filtroActual: this.filtro
    }));

    // Navegar al módulo de historias
    this.router.navigate(['/pacientes/historias', idPaciente]);
  }

  // Método para abrir el modal de visualización
  verPaciente(paciente: any): void {
    this.pacienteSeleccionado = paciente;

    // Abrir el modal
    this.openModalAgregar('verPacienteModal');
  }

  // Método para cerrar el modal
  cerrarModalVisualizacion(): void {
    this.pacienteSeleccionado = null;

    this.cerrarModal('verPacienteModal');
  }

}