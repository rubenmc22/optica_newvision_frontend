import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, FormControl } from '@angular/forms';
import { PacientesService } from '../../core/services/pacientes/pacientes.service';
import { SwalService } from '../../core/services/swal/swal.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as bootstrap from 'bootstrap';
import { ModalService } from '../../core/services/modal/modal.service';
import { Paciente } from './paciente-interface';
import { C } from 'node_modules/@angular/cdk/portal-directives.d-a65be59b';

@Component({
  selector: 'app-ver-pacientes',
  standalone: false,
  templateUrl: './pacientes.component.html',
  styleUrls: ['./pacientes.component.scss']
})

export class VerPacientesComponent implements OnInit {
  // Propiedades del componente
  formPaciente: FormGroup;
  pacientes: Paciente[] = [];
  pacienteSeleccionado: any = null;
  pacienteEditando: any = null;
  pacienteFormulario: Paciente = this.crearPacienteVacio();
  formOriginal: any = {};

  // Estado y configuración
  modoEdicion: boolean = false;
  sedeActiva: 'guatire' | 'guarenas' = 'guarenas'; //Aca colocar las sede escogida en el login del sistema
  sedeFiltro: string = this.sedeActiva;
  filtro: string = '';
  ordenActual: keyof Paciente = 'nombreCompleto';
  ordenAscendente: boolean = true;

  // Redes sociales
  listaRedes: string[] = ['Facebook', 'Twitter', 'Instagram', 'LinkedIn', 'TikTok'];
  nuevaRed: string = '';
  nuevoUsuario: string = '';
  usuarioInputHabilitado: boolean = false;
  redesEditables: boolean[] = [];

  //Perfil clinico
  opcionesBooleanasSimple: string[] = ['Sí', 'No'];
  opcionesGenero: string[] = [
    'Masculino',
    'Femenino',
  ];
  opcionesAntecedentesPersonales: string[] = [
    'Diabetes',
    'Hipertensión',
    'Migraña',
    'Fotosensibilidad',
    'Traumatismo ocular',
    'Queratocono'
  ];

  opcionesAntecedentesFamiliares: string[] = [
    'Diabetes',
    'Hipertensión arterial',
    'Glaucoma',
    'Degeneración macular',
    'Queratocono',
    'Retinopatía diabética'
  ];

  opcionesPatologiaOcular: string[] = [
    'Uveítis',
    'Catarata',
    'Queratitis',
    'Desprendimiento de retina',
    'Glaucoma',
    'Queratocono',
    'Ojo seco'
  ];

  opcionesPatologias: string[] = [
    'Diabetes',
    'Hipertensión',
    'Miopía',
    'Astigmatismo',
    'Alergia ocular',
    'Artritis',
    'Cefalea'
  ];


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
      redesSociales: this.fb.array([]),

      // Campos de perfil clínico
      usuarioLentes: [''],
      fotofobia: [''],
      traumatismoOcular: [''],
      traumatismoOcularDescripcion: [''],
      cirugiaOcular: [''],
      cirugiaOcularDescripcion: [''],
      alergicoA: [''],
      antecedentesPersonales: [[]],
      antecedentesFamiliares: [[]],
      patologias: [[]],
      patologiaOcular: [[]]
    });
  }

  ngOnInit(): void {
    this.cargarPacientes();
    this.cdRef.detectChanges();
  }

  // Métodos de acceso
  get redesSociales(): FormArray {
    return this.formPaciente.get('redesSociales') as FormArray;
  }

  formatearFecha(fechaIso: string): string {
    if (!fechaIso || typeof fechaIso !== 'string') return 'Fecha inválida';

    // Evita formatear si ya está en formato DD/MM/YYYY
    if (fechaIso.includes('/') && !fechaIso.includes('T')) return fechaIso;

    const fechaLimpiada = fechaIso.split('T')[0]; // elimina hora si está presente
    const [anio, mes, dia] = fechaLimpiada.split('-');
    return `${dia}/${mes}/${anio}`;
  }

  // Métodos de carga de datos
  cargarPacientes(): void {
    this.pacientesService.getPacientes().subscribe({
      next: (data) => {
        this.pacientes = Array.isArray(data.pacientes)
          ? data.pacientes.map((p: any) => ({
            id: p.key, // ✅ usa el mismo ID que luego usamos para reemplazar
            nombreCompleto: p.nombre,
            cedula: p.cedula,
            telefono: p.telefono,
            email: p.email,
            fechaNacimiento: p.fecha_nacimiento,
            edad: this.calcularEdad(p.fecha_nacimiento),
            ocupacion: p.ocupacion,
            genero: p.genero === 'm' ? 'Masculino' : p.genero === 'f' ? 'Femenino' : 'Otro',
            direccion: p.direccion,
            sede: p.sede?.id ?? 'sin-sede',
            fechaRegistro: this.formatearFecha(p.created_at),
            redesSociales: p.redes_sociales || []
          }))
          : [];
      },
      error: (error) => {
        console.error('Error al cargar pacientes:', error);
        this.swalService.showError('Error', 'No se han podido cargar los pacientes');
        this.pacientes = [];
      }
    });
  }

  // Métodos de filtrado y ordenación
  pacientesFiltrados(): Paciente[] {
    // Si no es un array, retornar array vacío
    if (!Array.isArray(this.pacientes)) {
      console.warn('this.pacientes no es un array:', this.pacientes);
      return [];
    }

    const filtroText = this.filtro.trim().toLowerCase();
    //console.log('Pacientes:', this.pacientes);

    return this.pacientes.filter(paciente => {
      const esSedeActiva = paciente.sede === this.sedeActiva;
      const esOtraSede = paciente.sede !== this.sedeActiva;

      let mostrar = false;
      if (this.sedeFiltro === this.sedeActiva) {
        mostrar = esSedeActiva;
      } else if (this.sedeFiltro === 'otra') {
        mostrar = esOtraSede;
      } else {
        mostrar = true;
      }

      //  console.log('PACIENTE', paciente);
      const coincideTexto =
        paciente.nombreCompleto.toLowerCase().includes(filtroText) ||
        paciente.cedula.includes(filtroText);

      return mostrar && coincideTexto;
    });
  }

  ordenarPor(campo: keyof Paciente): void {
    if (this.ordenActual === campo) {
      this.ordenAscendente = !this.ordenAscendente;
    } else {
      this.ordenActual = campo;
      this.ordenAscendente = true;
    }

    this.pacientes.sort((a, b) => {
      const valorA = a[campo] ?? '';
      const valorB = b[campo] ?? '';

      if (typeof valorA === 'string' && typeof valorB === 'string') {
        return this.ordenAscendente
          ? valorA.localeCompare(valorB)
          : valorB.localeCompare(valorA);
      }

      if (typeof valorA === 'number' && typeof valorB === 'number') {
        return this.ordenAscendente ? valorA - valorB : valorB - valorA;
      }

      return 0;
    });
  }

  calcularEdad(fechaNac: string): number {
    const nacimiento = new Date(fechaNac);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad;
  }

  crearPaciente(): void {
    if (this.formPaciente.invalid) {
      this.marcarCamposComoTouched();
      return;
    }

    const mapGenero = this.formPaciente.value.genero === 'Masculino'
      ? 'm'
      : this.formPaciente.value.genero === 'Femenino'
        ? 'f'
        : 'otro';

    const {
      nombreCompleto,
      cedula,
      telefono,
      email,
      fechaNacimiento,
      ocupacion,
      genero,
      direccion,
      redesSociales,
      usuarioLentes,
      fotofobia,
      traumatismoOcular,
      traumatismoOcularDescripcion,
      cirugiaOcular,
      cirugiaOcularDescripcion,
      alergicoA,
      antecedentesPersonales,
      antecedentesFamiliares,
      patologias,
      patologiaOcular
    } = this.formPaciente.value;

    const nuevoPaciente = {
      informacionPersonal: {
        nombreCompleto,
        cedula,
        telefono,
        email,
        fechaNacimiento,
        ocupacion,
        genero: mapGenero,
        direccion
      },
      redesSociales: this.redesSociales.value,
      historiaClinica: {
        usuarioLentes,
        fotofobia,
        traumatismoOcular,
        traumatismoOcularDescripcion,
        cirugiaOcular,
        cirugiaOcularDescripcion,
        alergicoA,
        antecedentesPersonales,
        antecedentesFamiliares,
        patologias,
        patologiaOcular
      }
    };

    console.log('PACIENTE ', nuevoPaciente);

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

    this.formOriginal = JSON.parse(JSON.stringify({
      nombreCompleto: paciente.nombreCompleto,
      cedula: paciente.cedula,
      telefono: paciente.telefono,
      email: paciente.email,
      fechaNacimiento: paciente.fecha_nacimiento,
      ocupacion: paciente.ocupacion,
      genero: paciente.genero,
      direccion: paciente.direccion,
      redesSociales: paciente.redesSociales || []
    }));

    this.formPaciente.patchValue({
      nombreCompleto: paciente.nombreCompleto,
      cedula: paciente.cedula,
      telefono: paciente.telefono,
      email: paciente.email,
      fechaNacimiento: paciente.fecha_nacimiento,
      ocupacion: paciente.ocupacion,
      genero: paciente.genero,
      direccion: paciente.direccion
    });

    this.redesSociales.clear();
    if (paciente.redesSociales) {
      paciente.redesSociales.forEach((red: any) => {
        this.redesSociales.push(this.fb.group({
          platform: [red.platform],
          username: [red.username]
        }));
      });
    }

    this.abrirModalEditarPaciente(paciente);
  }

  actualizarPaciente(): void {
    if (!this.formularioModificado()) {
      return;
    }

    const pacienteFormValue = this.formPaciente.value;
    const mapGenero = pacienteFormValue.genero === 'Masculino'
      ? 'm'
      : pacienteFormValue.genero === 'Femenino'
        ? 'f'
        : 'otro';

    const datosActualizados = {
      nombreCompleto: pacienteFormValue.nombreCompleto,
      cedula: pacienteFormValue.cedula,
      telefono: pacienteFormValue.telefono || null,
      email: pacienteFormValue.email || null,
      fechaNacimiento: pacienteFormValue.fechaNacimiento,
      ocupacion: pacienteFormValue.ocupacion || null,
      genero: mapGenero,
      direccion: pacienteFormValue.direccion || null,
      redesSociales: this.redesSociales.controls.map(control => ({
        platform: control.get('platform')?.value,
        username: control.get('username')?.value
      }))
    };

    console.log('Enviando al backend:', datosActualizados);

    const clavePaciente = `${this.sedeActiva}-${datosActualizados.cedula}`;

    this.pacientesService.updatePaciente(clavePaciente, datosActualizados).subscribe({
      next: (response) => {
        const paciente = response.paciente;

        const transformado = {
          ...paciente,
          id: paciente.key,
          nombreCompleto: paciente.nombre,
          genero: paciente.genero === 'm' ? 'Masculino' : paciente.genero === 'f' ? 'Femenino' : 'Otro',
          sede: paciente.sede_id,
          fechaRegistro: this.formatearFecha(paciente.updated_at),
          fechaNacimiento: paciente.fecha_nacimiento, // ✅ deja formato ISO
          edad: this.calcularEdad(paciente.fecha_nacimiento), // ✅ calcula edad
          redesSociales: paciente.redes_sociales || []
        };


        const index = this.pacientes.findIndex(p => p.id === paciente.key);
        if (index !== -1) {
          this.pacientes[index] = transformado;
        } else {
          this.pacientes.push(transformado); // fallback si no lo encuentra
        }

        this.pacientes = [...this.pacientes];
        this.pacienteSeleccionado = transformado;
        this.cdRef.detectChanges();
        this.cerrarModal('modalAgregarPaciente');
        this.swalService.showSuccess('¡Actualización exitosa!', 'El Paciente se ha actualizado correctamente.');
      },
      error: (error) => {
        console.error('Error al actualizar paciente:', error);
        this.swalService.showError('Error', 'No se ha podido actualizar al paciente');
      }
    });
  }

  eliminarPaciente(id: string): void {
    const paciente = this.pacientes.find(p => p.id === id);
    if (!paciente) return;

    const sedeId = 'guatire'; // O usa this.sedeActiva si ya lo tienes dinámico
    const clavePaciente = `${sedeId}-${paciente.cedula}`;

    this.modalService.openGlobalModal(
      'Eliminar Paciente',
      `¿Está seguro que desea eliminar al paciente ${paciente.nombreCompleto}?`,
      'Eliminar',
      'Cancelar'
    ).then((confirmed: boolean) => {
      if (confirmed) {
        this.pacientesService.deletePaciente(clavePaciente).subscribe({
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
      this.redesEditables.push(false); // ✅ sincroniza la lógica editable
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

  toggleEdicionUsername(index: number): void {
    this.redesEditables[index] = !this.redesEditables[index];

    if (!this.redesEditables[index]) {
      // Si se cerró edición, marca como touched y dirty para validar
      const control = this.redesSociales.at(index).get('username');
      control?.markAsTouched();
      control?.markAsDirty();
    }
  }


  // Métodos para modales
  abrirModalAgregarPaciente(): void {
    this.modoEdicion = false;
    this.formPaciente.reset(this.crearPacienteVacio());

    const modalElement = document.getElementById('modalAgregarPaciente');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  abrirModalEditarPaciente(paciente: Paciente): void {
    this.modoEdicion = true;
    this.pacienteEditando = paciente;
    this.formPaciente.patchValue(paciente);
    this.redesEditables = this.redesSociales.controls.map(() => false);


    const modalElement = document.getElementById('modalAgregarPaciente');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  abrirModalVisualizacionPaciente(paciente: Paciente): void {
    console.log('abrirModalVisualizacionPaciente', paciente);

    const pacienteTransformado = {
      ...paciente,
      fechaNacimiento: this.formatearFecha(paciente.fechaNacimiento || paciente.fechaNacimiento),
      fechaRegistro: this.formatearFecha(paciente.fechaRegistro || paciente.fechaRegistro),
      redesSociales: paciente.redesSociales || paciente.redesSociales || [],

    };

    this.pacienteSeleccionado = pacienteTransformado;

    /*this.redesSocialesEditables = pacienteTransformado.redesSociales.map((red: { platform: string; username: string }) => ({
      platform: red.platform,
      username: red.username,
      editable: false
    }));*/

    console.log('pacienteTransformado', pacienteTransformado);
    //  this.pacienteSeleccionado = paciente;

    const modalElement = document.getElementById('verPacienteModal');
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

  cerrarModalVisualizacion(): void {
    this.pacienteSeleccionado = null;
    this.cerrarModal('verPacienteModal');
  }

  // Métodos de utilidad
  crearPacienteVacio(): Paciente {
    return {
      id: '',
      nombreCompleto: '',
      cedula: '',
      telefono: '',
      email: '',
      fechaNacimiento: '',
      edad: 0,
      ocupacion: '',
      genero: '',
      direccion: '',
      fechaRegistro: '',
      redesSociales: [],
      sede: this.sedeActiva
    };
  }

  resetearFormulario(): void {
    this.formPaciente.reset({
      nombreCompleto: '',
      cedula: '',
      telefono: '',
      email: '',
      fechaNacimiento: '',
      ocupacion: '',
      genero: '', // ← esto fuerza "Seleccionar"
      direccion: '',
      redesSociales: []
    });

    this.redesSociales.clear();
    this.modoEdicion = false;
    this.pacienteEditando = null;
    this.formOriginal = {};
    this.nuevaRed = '';
    this.nuevoUsuario = '';
    this.usuarioInputHabilitado = false;
  }

  formularioModificado(): boolean {
    if (!this.modoEdicion) return true;

    const formActual = this.formPaciente.value;

    const camposModificados = Object.keys(this.formOriginal).some(key => {
      if (key === 'redesSociales') return false;

      const valorActual = key === 'fechaNacimiento'
        ? this.normalizarFechaParaComparar(formActual[key])
        : formActual[key];

      const valorOriginal = key === 'fechaNacimiento'
        ? this.normalizarFechaParaComparar(this.formOriginal[key])
        : this.formOriginal[key];

      console.log('valorActual', valorActual);
      console.log('valorOriginal', valorOriginal);
      return valorActual !== valorOriginal;
    });

    const redesModificadas = !this.arraysIguales(
      this.redesSociales.value,
      this.formOriginal.redesSociales
    );

    return camposModificados || redesModificadas;
  }


  normalizarFechaParaComparar(fecha: string): string {
    if (!fecha || typeof fecha !== 'string') return '';
    if (fecha.includes('/')) {
      const [dia, mes, anio] = fecha.split('/');
      return `${anio}-${mes}-${dia}`; // convierte a ISO para comparación
    }
    return fecha; // ya es ISO
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
    alert(`${tipo.toUpperCase()}: ${mensaje}`);
  }

  // Navegación
  verHistorias(idPaciente: string): void {
    sessionStorage.setItem('pacientesListState', JSON.stringify({
      scrollPosition: window.scrollY,
      filtroActual: this.filtro
    }));

    this.router.navigate(['/pacientes-historias', idPaciente]);
  }

  generarLinkRedSocial(platform: string, username: string): string {
    switch (platform.toLowerCase()) {
      case 'facebook':
        return `https://facebook.com/${username.replace('@', '')}`;
      case 'instagram':
        return `https://instagram.com/${username.replace('@', '')}`;
      default:
        return '#';
    }
  }


}