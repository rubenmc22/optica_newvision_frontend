import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, FormControl } from '@angular/forms';
import { PacientesService } from '../../core/services/pacientes/pacientes.service';
import { SwalService } from '../../core/services/swal/swal.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as bootstrap from 'bootstrap';
import { ModalService } from '../../core/services/modal/modal.service';
import { Paciente } from './paciente-interface';
import { UserStateService } from '../../core/services/userState/user-state-service';
import { C } from 'node_modules/@angular/cdk/portal-directives.d-a65be59b';
import {
  AbstractControl,
  ValidatorFn,
  ValidationErrors
} from '@angular/forms';


@Component({
  selector: 'app-pacientes',
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
  sedeActiva: string = '';
  sedeFiltro: string = this.sedeActiva;
  filtro: string = '';
  ordenActual: string = 'informacionPersonal.nombreCompleto';
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
    private userStateService: UserStateService,
  ) {
    this.formPaciente = this.fb.group({
      // 👤 Datos personales
      nombreCompleto: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/),
          Validators.maxLength(100)
        ]
      ],
      cedula: [
        '',
        [
          Validators.required,
          Validators.pattern(/^\d+$/),
          Validators.minLength(6),
          Validators.maxLength(9)
        ]
      ],
      telefono: [
        '',
        [
          Validators.required,
          Validators.pattern(/^\d+$/),
          Validators.minLength(11),
          Validators.maxLength(13)
        ]
      ],
      email: [
        '',
        [
          Validators.required,
          Validators.email,
          Validators.maxLength(100)
        ]
      ],
      fechaNacimiento: ['', Validators.required],
      ocupacion: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/),
          Validators.maxLength(60)
        ]
      ],
      genero: ['', Validators.required],
      direccion: [
        '',
        [
          Validators.required,
          Validators.maxLength(150)
        ]
      ],
      redesSociales: this.fb.array([]),

      // 🩺 Campos clínicos
      usuarioLentes: ['', Validators.required],
      fotofobia: ['', Validators.required],
      traumatismoOcular: ['', Validators.required],
      traumatismoOcularDescripcion: [''],
      cirugiaOcular: ['', Validators.required],
      cirugiaOcularDescripcion: [''],
      alergicoA: [''],
      antecedentesPersonales: [[]],
      antecedentesFamiliares: [[]],
      patologias: [[]],
      patologiaOcular: [[]]
    }, {
      validators: [
        this.requiereDescripcionCondicional('traumatismoOcular', 'traumatismoOcularDescripcion'),
        this.requiereDescripcionCondicional('cirugiaOcular', 'cirugiaOcularDescripcion')
      ]
    });


  }

  ngOnInit(): void {
    this.inicializarSedeDesdeUsuario();

    // Aplicar validaciones condicionales reactivas
    this.aplicarValidacionCondicional('traumatismoOcular', 'traumatismoOcularDescripcion', this.formPaciente);
    this.aplicarValidacionCondicional('cirugiaOcular', 'cirugiaOcularDescripcion', this.formPaciente);
  }



  getErrorMsg(campo: string): string {
    const c = this.formPaciente.get(campo);
    if (!c || !c.errors) return '';

    if (c.hasError('required')) return 'Este campo es requerido';

    // Específicos por campo
    switch (campo) {
      case 'nombreCompleto':
        if (c.hasError('pattern')) return 'Solo se permiten letras y espacios';
        if (c.hasError('maxlength')) return 'Máximo 100 caracteres';
        break;

      case 'cedula':
        if (c.hasError('pattern')) return 'Formato de cédula inválido';
        if (c.hasError('minlength')) return 'Cédula demasiado corta';
        if (c.hasError('maxlength')) return 'Cédula demasiado larga';
        break;

      case 'telefono':
        if (c.hasError('pattern')) return 'Formato de teléfono inválido';
        if (c.hasError('minlength')) return 'Teléfono incompleto';
        if (c.hasError('maxlength')) return 'Número demasiado largo';
        break;

      case 'email':
        if (c.hasError('email')) return 'Ingrese un email válido';
        break;

      case 'ocupacion':
        if (c.hasError('pattern')) return 'Solo se permiten letras y espacios';
        if (c.hasError('maxlength')) return 'Máximo 60 caracteres';
        break;

      case 'direccion':
        if (c.hasError('maxlength')) return 'Máximo 150 caracteres';
        break;

      case 'traumatismoOcularDescripcion':
      case 'cirugiaOcularDescripcion':
        if (c.hasError('required')) return 'Por favor, describa este antecedente';
        break;

    }

    return '';
  }




  private aplicarValidacionCondicional(
    campoDecisor: string,
    campoDescripcion: string,
    grupo: FormGroup
  ): void {
    const campo = grupo.get(campoDecisor);
    const descripcion = grupo.get(campoDescripcion);

    campo?.valueChanges.subscribe(valor => {
      const esObligatorio = valor === 'Sí' || valor === 'si' || valor === true;

      if (esObligatorio) {
        descripcion?.setValidators([Validators.required]);
      } else {
        descripcion?.clearValidators();
        descripcion?.setValue('');
      }

      descripcion?.updateValueAndValidity();
    });
  }

  requiereDescripcionCondicional(condicion: string, campoDescripcion: string): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const estado = group.get(condicion)?.value;
      const descripcion = group.get(campoDescripcion)?.value;

      const esObligatorio = estado === 'si' || estado === 'Sí' || estado === true;
      const estaVacio = !descripcion?.toString().trim();

      if (esObligatorio && estaVacio) {
        return { [`${campoDescripcion}Obligatoria`]: true };
      }

      return null;
    };
  }

  private inicializarSedeDesdeUsuario(): void {
    const authData = sessionStorage.getItem('authData');

    if (authData) {
      try {
        const parsedData = JSON.parse(authData);
        const sedeKey = parsedData?.sede?.key ?? 'guatire';

        this.sedeActiva = sedeKey;
        this.sedeFiltro = sedeKey;
        console.log('Sede desde sesión:', sedeKey);

        this.cargarPacientes();
      } catch (error) {
        console.error('Error al parsear authData de sesión:', error);
        this.sedeActiva = 'guatire';
        this.sedeFiltro = 'guatire';
        this.cargarPacientes();
      }
    } else {
      // Fallback por si no hay sesión
      this.sedeActiva = 'guatire';
      this.sedeFiltro = 'guatire';
      this.cargarPacientes();
    }
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
            key: p.key ?? '',
            sede: p.key?.split('-')[0] ?? 'sin-sede',
            fechaRegistro: this.formatearFecha(p.created_at),

            informacionPersonal: {
              nombreCompleto: p.informacionPersonal?.nombreCompleto ?? '',
              cedula: p.informacionPersonal?.cedula ?? '',
              telefono: p.informacionPersonal?.telefono ?? '',
              email: p.informacionPersonal?.email ?? '',
              fechaNacimiento: p.informacionPersonal?.fechaNacimiento ?? '',
              ocupacion: p.informacionPersonal?.ocupacion ?? '',
              genero:
                p.informacionPersonal?.genero === 'm'
                  ? 'Masculino'
                  : p.informacionPersonal?.genero === 'f'
                    ? 'Femenino'
                    : 'Otro',
              direccion: p.informacionPersonal?.direccion ?? '',
              edad: this.calcularEdad(p.informacionPersonal?.fechaNacimiento)
            },

            redesSociales: p.redesSociales ?? [],
            historiaClinica: p.historiaClinica ?? {}
          }))
          : [];

        console.log('Pacientes cargados:', this.pacientes);
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
        paciente.informacionPersonal.nombreCompleto.toLowerCase().includes(filtroText) ||
        paciente.informacionPersonal.cedula.includes(filtroText);

      return mostrar && coincideTexto;
    });
  }

  getValorOrden(obj: any, path: string): any {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  ordenarPor(campo: string): void {
    if (this.ordenActual === campo) {
      this.ordenAscendente = !this.ordenAscendente;
    } else {
      this.ordenActual = campo;
      this.ordenAscendente = true;
    }

    this.pacientes.sort((a, b) => {
      const valorA = this.getValorOrden(a, campo) ?? '';
      const valorB = this.getValorOrden(b, campo) ?? '';

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

  calcularEdad(fechaNac: string): number | '--' {
    if (!fechaNac) return '--';

    const nacimiento = new Date(fechaNac);
    if (isNaN(nacimiento.getTime())) return '--';

    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();

    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }

    return edad >= 0 ? edad : '--';
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
        const msg = error.error?.message ?? '';

        if (msg.includes('Ya esta registrada la cedula')) {
          // 🔍 Extraemos los valores entre comillas simples
          const coincidencias = [...msg.matchAll(/'([^']+)'/g)];

          const cedula = coincidencias?.[0]?.[1] ?? 'Cédula desconocida';
          const sedeRaw = coincidencias?.[1]?.[1] ?? 'Sede desconocida';
          const sede = sedeRaw.replace(/^Sede\s+/i, '').trim(); // ✨ elimina el prefijo 'Sede '

          // 🧾 Armamos el HTML del mensaje personalizado
          const mensajeHTML = `
              <br>
              <div class="swal-custom-content ">
                <h5 class="text-danger mb-2">
                  <i class="fas fa-id-card me-2"></i> Cédula ya registrada
                </h5>

                <ul class="list-unstyled mb-3">
                  <li><strong>Cédula:</strong> ${cedula}</li>
                  <li><strong>Sede:</strong> ${sede}</li>
                </ul><br>

                <div class="text-muted small">
                  <i class="fas fa-info-circle me-1"></i> Cada cédula debe ser única por sede. Revisa los datos ingresados.
                </div>
              </div>
          `;
          this.swalService.showWarning('', mensajeHTML, true);
          return;
        }

        this.swalService.showError('Error', 'No se ha podido registrar al paciente');
      }

    });
  }

  editarPaciente(paciente: any): void {
    this.modoEdicion = true;
    this.pacienteEditando = paciente;
    //console.log('editarPaciente - paciente', paciente);

    this.formOriginal = {
      nombreCompleto: paciente.informacionPersonal?.nombreCompleto,
      cedula: paciente.informacionPersonal?.cedula,
      telefono: paciente.informacionPersonal?.telefono,
      email: paciente.informacionPersonal?.email,
      fechaNacimiento: paciente.informacionPersonal?.fechaNacimiento,
      ocupacion: paciente.informacionPersonal?.ocupacion,
      genero: paciente.informacionPersonal?.genero,
      direccion: paciente.informacionPersonal?.direccion,
      usuarioLentes: paciente.historiaClinica?.usuarioLentes ?? '',
      fotofobia: paciente.historiaClinica?.fotofobia ?? '',
      traumatismoOcular: paciente.historiaClinica?.traumatismoOcular ?? '',
      traumatismoOcularDescripcion: paciente.historiaClinica?.traumatismoOcularDescripcion ?? '',
      cirugiaOcular: paciente.historiaClinica?.cirugiaOcular ?? '',
      cirugiaOcularDescripcion: paciente.historiaClinica?.cirugiaOcularDescripcion ?? '',
      alergicoA: paciente.historiaClinica?.alergicoA ?? '',
      antecedentesPersonales: paciente.historiaClinica?.antecedentesPersonales ?? [],
      antecedentesFamiliares: paciente.historiaClinica?.antecedentesFamiliares ?? [],
      patologias: paciente.historiaClinica?.patologias ?? [],
      patologiaOcular: paciente.historiaClinica?.patologiaOcular ?? [],
      redesSociales: paciente.redesSociales ?? []
    };

    this.formPaciente.patchValue(this.formOriginal);

    // Redes sociales
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
    console.log('pacienteFormValue', pacienteFormValue);

    const mapGenero = pacienteFormValue.genero === 'Masculino'
      ? 'm'
      : pacienteFormValue.genero === 'Femenino'
        ? 'f'
        : 'otro';

    const datosActualizados = {
      key: `${this.sedeActiva}-${pacienteFormValue.cedula}`,
      informacionPersonal: {
        nombreCompleto: pacienteFormValue.nombreCompleto,
        cedula: pacienteFormValue.cedula,
        telefono: pacienteFormValue.telefono || null,
        email: pacienteFormValue.email || null,
        fechaNacimiento: pacienteFormValue.fechaNacimiento,
        ocupacion: pacienteFormValue.ocupacion || null,
        genero: mapGenero,
        direccion: pacienteFormValue.direccion || null
      },
      redesSociales: this.redesSociales.controls.map(control => ({
        platform: control.get('platform')?.value,
        username: control.get('username')?.value
      })),
      historiaClinica: {
        usuarioLentes: pacienteFormValue.usuarioLentes || null,
        fotofobia: pacienteFormValue.fotofobia || null,
        traumatismoOcular: pacienteFormValue.traumatismoOcular || null,
        traumatismoOcularDescripcion: pacienteFormValue.traumatismoOcularDescripcion || null,
        cirugiaOcular: pacienteFormValue.cirugiaOcular || null,
        cirugiaOcularDescripcion: pacienteFormValue.cirugiaOcularDescripcion || null,
        alergicoA: pacienteFormValue.alergicoA || null,
        antecedentesPersonales: pacienteFormValue.antecedentesPersonales || [],
        antecedentesFamiliares: pacienteFormValue.antecedentesFamiliares || [],
        patologias: pacienteFormValue.patologias || [],
        patologiaOcular: pacienteFormValue.patologiaOcular || []
      }
    };

    console.log('Enviando al backend:', datosActualizados);

    const keyPaciente = `${this.sedeActiva}-${datosActualizados.informacionPersonal.cedula}`;

    this.pacientesService.updatePaciente(keyPaciente, datosActualizados).subscribe({
      next: (response) => {
        const paciente = response.paciente;

        const transformado = {
          ...paciente,
          key: keyPaciente, // clave generada correctamente
          informacionPersonal: {
            ...paciente.informacionPersonal,
            genero: paciente.informacionPersonal.genero === 'm' ? 'Masculino' :
              paciente.informacionPersonal.genero === 'f' ? 'Femenino' : 'Otro',
            edad: this.calcularEdad(paciente.informacionPersonal.fechaNacimiento)
          },
          fechaRegistro: this.formatearFecha(paciente.updated_at),
          redesSociales: paciente.redesSociales || [],
          sede: paciente.sede || this.sedeActiva
        };


        const index = this.pacientes.findIndex(p => p.key === paciente.key);
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
    const paciente = this.pacientes.find(p => p.key === id);
    if (!paciente) return;

    const sedeId = this.sedeActiva;
    const clavePaciente = `${sedeId}-${paciente.informacionPersonal.cedula}`;

    this.modalService.openGlobalModal(
      'Eliminar Paciente',
      `¿Está seguro que desea eliminar al paciente ${paciente.informacionPersonal.nombreCompleto}?`,
      'Eliminar',
      'Cancelar'
    ).then((confirmed: boolean) => {
      if (confirmed) {
        this.pacientesService.deletePaciente(clavePaciente).subscribe({
          next: () => {
            this.pacientes = this.pacientes.filter(p => p.key !== id);
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
    this.redesEditables = this.redesSociales.controls.map(() => false);

    const modalElement = document.getElementById('modalAgregarPaciente');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }


  abrirModalVisualizacionPaciente(paciente: Paciente): void {
    console.log('paciente', paciente);

    const info = paciente?.informacionPersonal ?? {};
    const redes = paciente?.redesSociales ?? [];
    const historia = paciente?.historiaClinica ?? {};

    const noEspecificadoTexto = 'No';
    const noEspecificadoArray = [noEspecificadoTexto];
    console.log('info', info);
    const pacienteTransformado = {
      id: paciente.key ?? '',
      nombreCompleto: info.nombreCompleto ?? noEspecificadoTexto,
      cedula: info.cedula ?? noEspecificadoTexto,
      telefono: info.telefono ?? noEspecificadoTexto,
      email: info.email ?? noEspecificadoTexto,
      fechaNacimiento: this.formatearFecha(info.fechaNacimiento),
      edad: this.calcularEdad(info.fechaNacimiento),
      ocupacion: info.ocupacion ?? noEspecificadoTexto,
      genero: info.genero || '--',
      direccion: info.direccion ?? noEspecificadoTexto,
      sede: paciente.key?.split('-')[0] ?? 'sin-sede',
      fechaRegistro: paciente.fechaRegistro
        ? this.formatearFecha(paciente.fechaRegistro)
        : '',

      redesSociales: redes.map((red: any) => ({
        platform: red.platform ?? 'Plataforma desconocida',
        username: red.username ?? noEspecificadoTexto,
        editable: false
      })),

      historiaClinica: {
        usuarioLentes: historia.usuarioLentes ?? noEspecificadoTexto,
        fotofobia: historia.fotofobia ?? noEspecificadoTexto,
        traumatismoOcular: historia.traumatismoOcular ?? noEspecificadoTexto,
        traumatismoOcularDescripcion: historia.traumatismoOcularDescripcion?.trim() || noEspecificadoTexto,
        cirugiaOcular: historia.cirugiaOcular ?? noEspecificadoTexto,
        cirugiaOcularDescripcion: historia.cirugiaOcularDescripcion?.trim() || noEspecificadoTexto,
        alergicoA: historia.alergicoA?.trim() || noEspecificadoTexto,
        antecedentesPersonales: Array.isArray(historia.antecedentesPersonales) && historia.antecedentesPersonales.length > 0
          ? historia.antecedentesPersonales
          : noEspecificadoArray,
        antecedentesFamiliares: Array.isArray(historia.antecedentesFamiliares) && historia.antecedentesFamiliares.length > 0
          ? historia.antecedentesFamiliares
          : noEspecificadoArray,
        patologias: Array.isArray(historia.patologias) && historia.patologias.length > 0
          ? historia.patologias
          : noEspecificadoArray,
        patologiaOcular: Array.isArray(historia.patologiaOcular) && historia.patologiaOcular.length > 0
          ? historia.patologiaOcular
          : noEspecificadoArray
      }
    };

    this.pacienteSeleccionado = pacienteTransformado;

    const modalElement = document.getElementById('verPacienteModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }

    console.log('pacienteTransformado', pacienteTransformado);
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

  crearPacienteVacio(): Paciente {
    return {
      key: '',
      fechaRegistro: '',
      sede: this.sedeActiva,

      informacionPersonal: {
        nombreCompleto: '',
        cedula: '',
        telefono: '',
        email: '',
        edad: 0,
        fechaNacimiento: '',
        ocupacion: '',
        genero: '',
        direccion: ''
      },

      redesSociales: [],

      historiaClinica: {
        usuarioLentes: null,
        fotofobia: null,
        traumatismoOcular: null,
        traumatismoOcularDescripcion: null,
        cirugiaOcular: null,
        cirugiaOcularDescripcion: null,
        alergicoA: null,
        antecedentesPersonales: [],
        antecedentesFamiliares: [],
        patologias: [],
        patologiaOcular: []
      }
    };
  }

  resetearFormulario(): void {
    this.formPaciente.reset({
      informacionPersonal: {
        nombreCompleto: '',
        cedula: '',
        telefono: '',
        email: '',
        fechaNacimiento: '',
        ocupacion: '',
        genero: '',
        direccion: ''
      },

      redesSociales: [],

      historiaClinica: {
        usuarioLentes: '',
        fotofobia: '',
        traumatismoOcular: '',
        traumatismoOcularDescripcion: '',
        cirugiaOcular: '',
        cirugiaOcularDescripcion: '',
        alergicoA: '',
        antecedentesPersonales: [],
        antecedentesFamiliares: [],
        patologias: [],
        patologiaOcular: []
      },

      sede: this.sedeActiva,
      fechaRegistro: ''
    });

    // Si estás usando FormArrays para redes sociales
    this.redesSociales.clear();

    // Resto de variables auxiliares
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
    alert(`${tipo.toUpperCase()
      }: ${mensaje} `);
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