import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, FormControl } from '@angular/forms';
import { PacientesService } from '../../core/services/pacientes/pacientes.service';
import { SwalService } from '../../core/services/swal/swal.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as bootstrap from 'bootstrap';
import { ModalService } from '../../core/services/modal/modal.service';
import { Paciente } from './paciente-interface';
import { Observable, of, forkJoin, lastValueFrom } from 'rxjs';
import { take, catchError } from 'rxjs/operators';
import { Sede } from '../../view/login/login-interface';
import { AuthService } from '../../core/services/auth/auth.service';
import { UserStateService } from '../../core/services/userState/user-state-service';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  ValidatorFn,
  ValidationErrors
} from '@angular/forms';
import { LoaderService } from './../../shared/loader/loader.service';
import { trigger, transition, style, animate } from '@angular/animations';

// Constantes
import {
  OPCIONES_REF,
  OPCIONES_AV,
  OPCIONES_ANTECEDENTES_PERSONALES,
  OPCIONES_ANTECEDENTES_FAMILIARES,
  MOTIVOS_CONSULTA,
  TIPOS_CRISTALES,
  MATERIALES,
  TRATAMIENTOS_ADITIVOS,
  INTERVALOS_HORA
} from 'src/app/shared/constants/historias-medicas';


@Component({
  selector: 'app-pacientes',
  standalone: false,
  templateUrl: './pacientes.component.html',
  styleUrls: ['./pacientes.component.scss'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, height: 0, overflow: 'hidden' }),
        animate('300ms ease-in-out', style({ opacity: 1, height: '*' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in-out', style({ opacity: 0, height: 0, overflow: 'hidden' }))
      ])
    ])
  ]
})

export class VerPacientesComponent implements OnInit {
  // Propiedades del componente
  formPaciente: FormGroup;
  pacientes: Paciente[] = [];
  pacienteSeleccionado: any = null;
  pacienteEditando: any = null;
  pacienteFormulario: Paciente = this.crearPacienteVacio();
  formOriginal: any = {};
  sedesDisponibles: Sede[] = [];
  pacientesFiltradosPorSede: Paciente[] = [];

  opcionesAntecedentesPersonalesNgSelect: any[] = [];
  opcionesAntecedentesFamiliaresNgSelect: any[] = [];

  //Seccion empresas
  empresaEncontrada: boolean = false;
  validandoEmpresa: boolean = false;
  validacionEmpresaIntentada: boolean = false;
  datosEmpresa: any = null;
  rifAnterior: string = '';
  filtroReferido: string = 'todos'; // 'todos', 'con-empresa', 'sin-empresa'


  // Estado y configuración
  modoEdicion: boolean = false;
  cargando: boolean = false;
  sedeActiva: string = '';
  sedeFiltro: string = this.sedeActiva;
  filtro: string = '';
  ordenActual: string = 'informacionPersonal.nombreCompleto';
  ordenAscendente: boolean = true;
  esMenorSinCedula: boolean = false;
  dataIsReady = false;

  // Propiedades para paginación
  paginaActual: number = 1;
  registrosPorPagina: number = 10;
  totalPaginas: number = 0;
  totalRegistros: number = 0;
  inicioPagina: number = 0;
  finPagina: number = 0;
  pacientesPaginados: any[] = [];

  // Redes sociales
  listaRedes: string[] = ['Facebook', 'Twitter', 'Instagram', 'LinkedIn', 'TikTok'];
  nuevaRed: string = '';
  nuevoUsuario: string = '';
  usuarioInputHabilitado: boolean = false;
  redesEditables: boolean[] = [];

  //Perfil clinico
  usoDispositivo: string | null = null;
  intervaloSeleccionado: string | null = null;
  intervalosHora = INTERVALOS_HORA;
  opcionesBooleanasSimple: string[] = ['Sí', 'No'];
  opcionesGenero: string[] = [
    'Masculino',
    'Femenino',
  ];
  opcionesAntecedentesPersonales = OPCIONES_ANTECEDENTES_PERSONALES;

  opcionesAntecedentesFamiliares = OPCIONES_ANTECEDENTES_FAMILIARES;
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

  patologias: [[]];

  constructor(
    private fb: FormBuilder,
    private pacientesService: PacientesService,
    private router: Router,
    private cdRef: ChangeDetectorRef,
    private modalService: ModalService,
    private swalService: SwalService,
    private userStateService: UserStateService,
    private snackBar: MatSnackBar,
    private authService: AuthService,
    private loader: LoaderService,
  ) {
    this.formPaciente = this.fb.group({
      // 👤 Datos personales
      esMenorSinCedula: [false],
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
          // Validators.required,
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

      // 🏢 Información de empresa (NUEVO)
      referidoEmpresa: [false],
      empresaNombre: [''],
      empresaRif: ['', [Validators.pattern(/^[JjVGgEe]-?\d{7,9}$/)]],
      empresaTelefono: [''],
      empresaDireccion: [''],

      // 🩺 Campos clínicos
      usuarioLentes: ['', Validators.required],
      fotofobia: ['', Validators.required],
      usoDispositivo: [null, Validators.required],
      intervaloUso: [null], // solo se valida si el primero es "Sí"
      traumatismoOcular: ['', Validators.required],
      traumatismoOcularDescripcion: [''],
      cirugiaOcular: ['', Validators.required],
      cirugiaOcularDescripcion: [''],
      alergicoA: [''],
      antecedentesPersonales: [[]],
      antecedentesFamiliares: [[]],
      patologias: [''],
    }, {
      validators: [
        this.requiereDescripcionCondicional('traumatismoOcular', 'traumatismoOcularDescripcion'),
        this.requiereDescripcionCondicional('cirugiaOcular', 'cirugiaOcularDescripcion')
      ]
    });
  }

  ngOnInit(): void {
    this.inicializarDatosIniciales();

    this.opcionesAntecedentesPersonalesNgSelect = this.convertirOpcionesNgSelect(
      OPCIONES_ANTECEDENTES_PERSONALES
    );

    this.opcionesAntecedentesFamiliaresNgSelect = this.convertirOpcionesNgSelect(
      OPCIONES_ANTECEDENTES_FAMILIARES
    );

    // Aplicar validaciones condicionales reactivas
    this.aplicarValidacionCondicional('traumatismoOcular', 'traumatismoOcularDescripcion', this.formPaciente);
    this.aplicarValidacionCondicional('cirugiaOcular', 'cirugiaOcularDescripcion', this.formPaciente);
    this.configurarValidacionCondicional();
    this.calcularPaginacion();
    this.configurarValidacionCondicionalEmpresa();

    //Establecer orden por defecto por fecha de registro (más reciente primero)
    this.ordenActual = 'fechaRegistro';
    this.ordenAscendente = false;
  }

  private convertirOpcionesNgSelect(opciones: string[]): any[] {
    return opciones.map(opcion => ({
      value: opcion,
      label: opcion
    }));
  }

  private configurarValidacionCondicionalEmpresa(): void {
    const empresaControl = this.formPaciente.get('referidoEmpresa');

    empresaControl?.valueChanges.subscribe(esReferido => {
      const empresaNombre = this.formPaciente.get('empresaNombre');
      const empresaRif = this.formPaciente.get('empresaRif');
      const empresaTelefono = this.formPaciente.get('empresaTelefono');

      if (esReferido) {
        // Si es referido de empresa, hacer obligatorios los campos
        empresaNombre?.setValidators([Validators.required, Validators.maxLength(100)]);
        empresaRif?.setValidators([Validators.required, Validators.pattern(/^[JjVGgEe]-?\d{7,9}$/)]);
        empresaTelefono?.setValidators([Validators.required]);
      } else {
        // Si no es referido, limpiar validadores y valores
        empresaNombre?.clearValidators();
        empresaRif?.clearValidators();
        empresaTelefono?.clearValidators();

        // Limpiar valores
        empresaNombre?.setValue('');
        empresaRif?.setValue('');
        empresaTelefono?.setValue('');
        this.formPaciente.get('empresaDireccion')?.setValue('');
      }

      // Actualizar validación
      empresaNombre?.updateValueAndValidity();
      empresaRif?.updateValueAndValidity();
      empresaTelefono?.updateValueAndValidity();
    });
  }


  private configurarValidacionCondicional(): void {
    const usoDispositivoControl = this.formPaciente.get('usoDispositivo');
    const intervaloControl = this.formPaciente.get('intervaloUso');

    usoDispositivoControl?.valueChanges.subscribe(valor => {
      if (valor === 'Sí') {
        intervaloControl?.setValidators([Validators.required]);
        intervaloControl?.markAsTouched(); // Marcar como touched para que muestre error inmediatamente
      } else {
        intervaloControl?.clearValidators();
        intervaloControl?.setValue(null);
        intervaloControl?.markAsUntouched(); // Limpiar el estado touched si no es requerido
      }
      intervaloControl?.updateValueAndValidity();
      this.formPaciente.updateValueAndValidity(); // Actualizar validación del formulario completo
    });
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

      case 'empresaNombre':
        if (c.hasError('maxlength')) return 'Máximo 100 caracteres';
        break;

      case 'empresaRif':
        if (c.hasError('pattern')) {
          return 'Formato de RIF inválido. Para empresas use J- seguido de 8-9 números o G- seguido de 8 números';
        }
        break;

      case 'empresaTelefono':
        if (c.hasError('pattern')) return 'Formato de teléfono inválido';
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

  private inicializarDatosIniciales(): void {
    forkJoin({
      user: this.userStateService.currentUser$.pipe(
        take(1),
        catchError(error => {
          console.error('Error al cargar usuario:', error);
          this.snackBar.open(
            '⚠️ Error al cargar su información de usuario. Por favor, intente nuevamente.',
            'Cerrar',
            { duration: 5000, panelClass: ['snackbar-error'] }
          );
          return of(null);
        })
      ),
      sedes: this.authService.getSedes().pipe(
        take(1),
        catchError(error => {
          console.error('Error al cargar sedes:', error);
          this.snackBar.open(
            '⚠️ No se pudieron cargar las sedes disponibles. Mostrando opciones limitadas.',
            'Cerrar',
            { duration: 5000, panelClass: ['snackbar-warning'] }
          );
          return of({ sedes: [] });
        })
      )
    }).subscribe(({ user, sedes }) => {
      // 🔹 Poblar lista de sedes
      this.sedesDisponibles = (sedes.sedes ?? [])
        .map(s => ({
          ...s,
          key: s.key?.trim().toLowerCase() || '',
          nombre: s.nombre?.trim() || ''
        }))
        .sort((a, b) =>
          a.nombre.replace(/^sede\s+/i, '').localeCompare(
            b.nombre.replace(/^sede\s+/i, ''),
            'es',
            { sensitivity: 'base' }
          )
        );

      const sedeUsuario = (user?.sede ?? '').trim().toLowerCase();
      const sedeValida = this.sedesDisponibles.some(s => s.key === sedeUsuario);
      this.sedeActiva = sedeValida ? sedeUsuario : '';
      this.sedeFiltro = sedeValida ? sedeUsuario : '';

      this.cargarPacientes();
    });
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
    this.dataIsReady = false;
    this.loader.show();
    this.pacientesService.getPacientes().subscribe({
      next: (data) => {
        this.pacientes = Array.isArray(data.pacientes)
          ? data.pacientes
            .map((p: any) => {
              const info = p.informacionPersonal;
              const historia = p.historiaClinica;
              const empresa = p.informacionEmpresa;

              return {
                id: p.id,
                key: p.key,
                fechaRegistro: this.formatearFecha(p.created_at),
                fechaRegistroRaw: p.created_at,
                fechaActualizacion: this.formatearFecha(p.updated_at),
                fechaActualizacionRaw: p.updated_at,
                sede: p.sedeId?.toLowerCase() ?? 'sin-sede',
                redesSociales: p.redesSociales || [],

                informacionEmpresa: empresa ? {
                  referidoEmpresa: empresa.referidoEmpresa || false,
                  empresaNombre: empresa.empresaNombre || '',
                  empresaRif: empresa.empresaRif || '',
                  empresaTelefono: empresa.empresaTelefono || '',
                  empresaDireccion: empresa.empresaDireccion || ''
                } : null,

                informacionPersonal: {
                  esMenorSinCedula: info.esMenorSinCedula ?? false,
                  nombreCompleto: info.nombreCompleto,
                  cedula: info.cedula,
                  telefono: info.telefono,
                  email: info.email,
                  fechaNacimiento: info.fechaNacimiento,
                  edad: this.calcularEdad(info.fechaNacimiento),
                  ocupacion: info.ocupacion,
                  genero: info.genero === 'm' ? 'Masculino' : info.genero === 'f' ? 'Femenino' : 'Otro',
                  direccion: info.direccion
                },

                historiaClinica: {
                  usuarioLentes: historia.usuarioLentes ?? null,
                  tipoCristalActual: historia.tipoCristalActual ?? '',
                  ultimaGraduacion: historia.ultimaGraduacion ?? '',
                  fotofobia: historia.fotofobia ?? null,
                  traumatismoOcular: historia.traumatismoOcular ?? null,
                  traumatismoOcularDescripcion: historia.traumatismoOcularDescripcion ?? '',
                  usoDispositivo: historia.usoDispositivo,
                  tiempoUsoEstimado: historia.tiempoUsoEstimado ?? '',
                  cirugiaOcular: historia.cirugiaOcular ?? null,
                  cirugiaOcularDescripcion: historia.cirugiaOcularDescripcion ?? '',
                  alergicoA: historia.alergicoA ?? null,
                  antecedentesPersonales: historia.antecedentesPersonales ?? [],
                  antecedentesFamiliares: historia.antecedentesFamiliares ?? [],
                  patologias: historia.patologias ?? [],
                  patologiaOcular: historia.patologiaOcular ?? []
                }
              };
            })
            .sort((a, b) => new Date(b.fechaRegistroRaw).getTime() - new Date(a.fechaRegistroRaw).getTime())
          : [];

        this.actualizarPacientesPorSede();
        setTimeout(() => {
          this.dataIsReady = true;
          this.loader.hide();
        }, 100);
      },
      error: (err: HttpErrorResponse) => {
        this.pacientes = [];
        this.dataIsReady = false;
        this.loader.hide();
        if (err.status === 404) {
          this.swalService.showWarning(
            'Sin registros',
            'No se encontraron pacientes en el sistema'
          );
          return;
        }
      }
    });

    this.paginaActual = 1;
    this.calcularPaginacion();
  }

  // Corrección del método de ordenamiento
  ordenarPor(campo: string): void {
    if (this.ordenActual === campo) {
      this.ordenAscendente = !this.ordenAscendente;
    } else {
      this.ordenActual = campo;
      this.ordenAscendente = true;
    }

    // Ordenar el array correcto
    this.pacientesFiltradosPorSede.sort((a, b) => {
      if (campo === 'fechaRegistro') {
        // Ordenar por fecha usando fechaRegistroRaw (formato ISO)
        const fechaA = a.fechaRegistroRaw ? new Date(a.fechaRegistroRaw).getTime() : 0;
        const fechaB = b.fechaRegistroRaw ? new Date(b.fechaRegistroRaw).getTime() : 0;

        // Por defecto: más reciente primero (orden descendente)
        return this.ordenAscendente ? fechaA - fechaB : fechaB - fechaA;
      }

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

    this.calcularPaginacion();
  }

  // Método auxiliar para mostrar errores
  showError(fieldName: string): boolean {
    const field = this.formPaciente.get(fieldName);
    return field ? (field.invalid && (field.touched || field.dirty)) : false;
  }

  // Método auxiliar para obtener valores de ordenamiento
  getValorOrden(paciente: any, campo: string): any {
    switch (campo) {
      case 'nombreCompleto':
        return paciente.informacionPersonal?.nombreCompleto?.toLowerCase() || '';
      case 'cedula':
        return paciente.informacionPersonal?.cedula || '';
      case 'edad':
        return parseInt(paciente.informacionPersonal?.edad) || 0;
      case 'genero':
        return paciente.informacionPersonal?.genero?.toLowerCase() || '';
      case 'fechaRegistro':
        return new Date(paciente.fechaRegistro);
      default:
        return '';
    }
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

    this.cargando = true;
    const mapGenero = this.formPaciente.value.genero === 'Masculino'
      ? 'm'
      : this.formPaciente.value.genero === 'Femenino'
        ? 'f'
        : 'otro';

    // Obtener valores del formulario
    const formValues = this.formPaciente.value;

    console.log('formValues', formValues);

    // Procesar uso de dispositivos electrónicos
    const usoDispositivoValue = formValues.usoDispositivo === 'Sí'
      ? `Sí, ${formValues.intervaloUso}`
      : 'No';

    const nuevoPaciente = {
      informacionPersonal: {
        esMenorSinCedula: formValues.esMenorSinCedula,
        nombreCompleto: formValues.nombreCompleto,
        cedula: formValues.cedula,
        telefono: formValues.telefono,
        email: formValues.email?.trim() || null,
        fechaNacimiento: formValues.fechaNacimiento,
        ocupacion: formValues.ocupacion,
        genero: mapGenero,
        direccion: formValues.direccion
      },
      redesSociales: this.redesSociales.value,
      informacionEmpresa: formValues.referidoEmpresa ? {
        referidoEmpresa: true,
        empresaNombre: formValues.empresaNombre,
        empresaRif: formValues.empresaRif,
        empresaTelefono: formValues.empresaTelefono,
        empresaDireccion: formValues.empresaDireccion
      } : null,
      historiaClinica: {
        usuarioLentes: formValues.usuarioLentes,
        fotofobia: formValues.fotofobia,
        usoDispositivo: usoDispositivoValue,
        traumatismoOcular: formValues.traumatismoOcular,
        traumatismoOcularDescripcion: formValues.traumatismoOcularDescripcion,
        cirugiaOcular: formValues.cirugiaOcular,
        cirugiaOcularDescripcion: formValues.cirugiaOcularDescripcion,
        alergicoA: formValues.alergicoA,
        antecedentesPersonales: formValues.antecedentesPersonales,
        antecedentesFamiliares: formValues.antecedentesFamiliares,
        patologias: formValues.patologias
      }
    };

    console.log('nuevoPaciente', nuevoPaciente);

    this.pacientesService.createPaciente(nuevoPaciente).subscribe({
      next: (response) => {
        this.cargando = false;

        console.log('response', response);

        const pacienteData = response.paciente;

        // Transformar la respuesta del paciente
        const pacienteTransformado = {
          ...pacienteData,
          key: pacienteData.key || pacienteData.id,
          fechaRegistro: this.formatearFecha(pacienteData.created_at),
          fechaRegistroRaw: pacienteData.created_at,
          fechaActualizacion: this.formatearFecha(pacienteData.updated_at),
          fechaActualizacionRaw: pacienteData.updated_at,
          sede: pacienteData.sedeId || this.sedeActiva,
          informacionPersonal: {
            ...pacienteData.informacionPersonal,
            edad: this.calcularEdad(pacienteData.informacionPersonal.fechaNacimiento),
            genero: pacienteData.informacionPersonal.genero === 'm' ? 'Masculino' :
              pacienteData.informacionPersonal.genero === 'f' ? 'Femenino' : 'Otro'
          }
        };

        console.log('pacienteTransformado', pacienteTransformado);

        // Encontrar la posición correcta para insertar (orden descendente por fecha de creación)
        const fechaCreacion = new Date(pacienteTransformado.fechaRegistroRaw).getTime();
        let posicionInsercion = 0;

        for (let i = 0; i < this.pacientes.length; i++) {
          const fechaExistente = new Date(this.pacientes[i].fechaRegistroRaw).getTime();
          if (fechaCreacion > fechaExistente) {
            posicionInsercion = i;
            break;
          } else {
            posicionInsercion = i + 1;
          }
        }

        // Insertar en la posición correcta
        this.pacientes.splice(posicionInsercion, 0, pacienteTransformado);

        this.cerrarModal('modalAgregarPaciente');
        this.swalService.showSuccess('¡Registro exitoso!', 'Paciente registrado correctamente.');

        // Actualizar la vista
        this.actualizarPacientesPorSede();
        this.cdRef.detectChanges();
      },
      error: (error) => {
        this.cargando = false;
        const msg = error.error?.message ?? '';

        // Caso específico: cédula duplicada
        if (msg.includes('Ya esta registrada la cedula')) {
          const coincidencias = [...msg.matchAll(/'([^']+)'/g)];
          const cedula = coincidencias?.[0]?.[1] ?? 'Cédula desconocida';
          const sedeRaw = coincidencias?.[1]?.[1] ?? 'Sede desconocida';
          const sede = sedeRaw.replace(/^Sede\s+/i, '').trim();

          const mensajeHTML = `
          <br>
          <div class="swal-custom-content">
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

        console.error('Error al crear paciente:', error);
        this.swalService.showError('Error', 'No se pudo registrar el paciente. Intente nuevamente.');
      }
    });
  }

  editarPaciente(paciente: any): void {
    this.modoEdicion = true;
    this.pacienteEditando = paciente;

    // Procesar el valor de usoDispositivo que puede venir combinado
    const usoDispositivoCompleto = paciente.historiaClinica?.usoDispositivo ?? '';
    let usoDispositivoValue = 'No';
    let intervaloUsoValue = null;

    if (usoDispositivoCompleto.startsWith('Sí')) {
      usoDispositivoValue = 'Sí';
      // Extraer el intervalo después de la coma
      const partes = usoDispositivoCompleto.split(',');
      if (partes.length > 1) {
        intervaloUsoValue = partes[1].trim();
      }
    }

    this.formOriginal = {
      esMenorSinCedula: paciente.informacionPersonal?.esMenorSinCedula ?? false,
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
      usoDispositivo: usoDispositivoValue,
      intervaloUso: intervaloUsoValue,
      traumatismoOcular: paciente.historiaClinica?.traumatismoOcular ?? '',
      traumatismoOcularDescripcion: paciente.historiaClinica?.traumatismoOcularDescripcion ?? '',
      cirugiaOcular: paciente.historiaClinica?.cirugiaOcular ?? '',
      cirugiaOcularDescripcion: paciente.historiaClinica?.cirugiaOcularDescripcion ?? '',
      alergicoA: paciente.historiaClinica?.alergicoA ?? '',
      antecedentesPersonales: paciente.historiaClinica?.antecedentesPersonales ?? [],
      antecedentesFamiliares: paciente.historiaClinica?.antecedentesFamiliares ?? [],
      patologias: paciente.historiaClinica?.patologias ?? [],
      patologiaOcular: paciente.historiaClinica?.patologiaOcular ?? [],
      redesSociales: paciente.redesSociales ?? [],
      referidoEmpresa: paciente.informacionEmpresa?.referidoEmpresa || false,
      empresaNombre: paciente.informacionEmpresa?.empresaNombre || '',
      empresaRif: paciente.informacionEmpresa?.empresaRif || '',
      empresaTelefono: paciente.informacionEmpresa?.empresaTelefono || '',
      empresaDireccion: paciente.informacionEmpresa?.empresaDireccion || ''
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

    this.empresaEncontrada = false;
    this.validandoEmpresa = false;
    this.validacionEmpresaIntentada = false;
    this.datosEmpresa = null;
    this.rifAnterior = paciente.informacionEmpresa?.empresaRif || '';

    this.abrirModalEditarPaciente(paciente);
  }

  actualizarPaciente(): void {
    if (!this.formularioModificado()) {
      return;
    }

    this.cargando = true;
    const pacienteFormValue = this.formPaciente.value;

    // Procesar uso de dispositivos electrónicos
    const usoDispositivoValue = pacienteFormValue.usoDispositivo === 'Sí'
      ? `Sí, ${pacienteFormValue.intervaloUso}`
      : 'No';

    const mapGenero = pacienteFormValue.genero === 'Masculino'
      ? 'm'
      : pacienteFormValue.genero === 'Femenino'
        ? 'f'
        : 'otro';

    const datosActualizados = {
      informacionPersonal: {
        nombreCompleto: pacienteFormValue.nombreCompleto,
        cedula: pacienteFormValue.cedula,
        telefono: pacienteFormValue.telefono || null,
        email: pacienteFormValue.email || null,
        fechaNacimiento: pacienteFormValue.fechaNacimiento,
        ocupacion: pacienteFormValue.ocupacion || null,
        genero: mapGenero,
        direccion: pacienteFormValue.direccion || null,
        esMenorSinCedula: pacienteFormValue.esMenorSinCedula || false
      },
      redesSociales: this.redesSociales.controls.map(control => ({
        platform: control.get('platform')?.value,
        username: control.get('username')?.value
      })),
      informacionEmpresa: this.formPaciente.value.referidoEmpresa ? {
        referidoEmpresa: true,
        empresaNombre: this.formPaciente.value.empresaNombre,
        empresaRif: this.formPaciente.value.empresaRif,
        empresaTelefono: this.formPaciente.value.empresaTelefono,
        empresaDireccion: this.formPaciente.value.empresaDireccion
      } : null,

      historiaClinica: {
        usuarioLentes: pacienteFormValue.usuarioLentes || null,
        fotofobia: pacienteFormValue.fotofobia || null,
        usoDispositivo: usoDispositivoValue,
        traumatismoOcular: pacienteFormValue.traumatismoOcular || null,
        traumatismoOcularDescripcion: pacienteFormValue.traumatismoOcularDescripcion || null,
        cirugiaOcular: pacienteFormValue.cirugiaOcular || null,
        cirugiaOcularDescripcion: pacienteFormValue.cirugiaOcularDescripcion || null,
        alergicoA: pacienteFormValue.alergicoA || null,
        antecedentesPersonales: pacienteFormValue.antecedentesPersonales || [],
        antecedentesFamiliares: pacienteFormValue.antecedentesFamiliares || [],
        patologias: pacienteFormValue.patologias || ''
      }
    };

    const keyPaciente = this.pacienteEditando.key;

    this.pacientesService.updatePaciente(keyPaciente, datosActualizados).subscribe({
      next: (response) => {
        const paciente = response.paciente;
        this.cargando = false;

        // Procesar el usoDispositivo para la visualización
        const usoDispositivoCompleto = paciente.historiaClinica?.usoDispositivo ?? '';
        let usoDispositivoDisplay = 'No';
        if (usoDispositivoCompleto.startsWith('Sí')) {
          usoDispositivoDisplay = usoDispositivoCompleto;
        }

        // Encontrar el paciente original para mantener sus fechas
        const pacienteOriginal = this.pacientes.find(p => p.key === keyPaciente);

        const transformado = {
          ...paciente,
          key: keyPaciente,
          // ✅ MANTENER la fecha de registro ORIGINAL del paciente (NO usar updated_at)
          fechaRegistro: pacienteOriginal ? pacienteOriginal.fechaRegistro : this.formatearFecha(paciente.created_at),
          fechaRegistroRaw: pacienteOriginal ? pacienteOriginal.fechaRegistroRaw : paciente.created_at,
          // ✅ Guardar fecha de actualización por separado para mostrarla en el modal
          fechaActualizacion: this.formatearFecha(paciente.updated_at),
          fechaActualizacionRaw: paciente.updated_at,
          informacionPersonal: {
            ...paciente.informacionPersonal,
            genero: paciente.informacionPersonal.genero === 'm' ? 'Masculino' :
              paciente.informacionPersonal.genero === 'f' ? 'Femenino' : 'Otro',
            edad: this.calcularEdad(paciente.informacionPersonal.fechaNacimiento)
          },
          redesSociales: paciente.redesSociales || [],
          sede: paciente.sede || this.sedeActiva,
          historiaClinica: {
            ...paciente.historiaClinica,
            usoDispositivo: usoDispositivoDisplay
          }
        };

        // ✅ Actualizar el paciente en la misma posición (NO reordenar)
        const index = this.pacientes.findIndex(p => p.key === keyPaciente);
        if (index !== -1) {
          this.pacientes[index] = transformado;
        }

        // ✅ NO reordenar la lista después de actualizar
        // El paciente mantiene su posición basada en la fecha de creación original

        this.pacientes = [...this.pacientes];
        this.actualizarPacientesPorSede();
        this.pacienteSeleccionado = transformado;
        this.cdRef.detectChanges();
        this.cerrarModal('modalAgregarPaciente');
        this.swalService.showSuccess('¡Actualización exitosa!', 'El Paciente se ha actualizado correctamente.');
      },
      complete: () => {
        this.cargando = false;
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

  getSocialIconClass(platform: string | null | undefined): string {
    if (!platform || typeof platform !== 'string') {
      return 'bi bi-share'; // ícono genérico
    }

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

    //Reset completo del formulario
    this.formPaciente.reset(this.crearPacienteVacio());

    const redesFormArray = this.formPaciente.get('redesSociales') as FormArray;
    this.limpiarFormArray(redesFormArray);

    // Resetear estado de empresa
    this.empresaEncontrada = false;
    this.validandoEmpresa = false;
    this.validacionEmpresaIntentada = false;
    this.datosEmpresa = null;
    this.rifAnterior = '';

    this.nuevaRed = '';
    this.nuevoUsuario = '';
    this.usuarioInputHabilitado = false;

    // 🧼 Mostrar modal limpio
    const modalElement = document.getElementById('modalAgregarPaciente');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();

      // ✅ Esperar al render completo antes de reiniciar scroll
      setTimeout(() => {
        const scrollableContent = modalElement.querySelector('.card-body');
        if (scrollableContent) {
          scrollableContent.scrollTop = 0;
        }
      }, 300);
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

      // ✅ Esperar al render completo antes de reiniciar scroll
      setTimeout(() => {
        const scrollableContent = modalElement.querySelector('.card-body');
        if (scrollableContent) {
          scrollableContent.scrollTop = 0;
        }
      }, 300); // tiempo suficiente para que el DOM se estabilice
    }
  }

  abrirModalVisualizacionPaciente(paciente: Paciente): void {
    const info = paciente.informacionPersonal;
    const redes = paciente?.redesSociales ?? [];
    const historia = paciente?.historiaClinica ?? {};

    console.log('info', info);
    console.log('historia', historia);

    // Manejar el caso cuando informacionEmpresa es null
    const empresa = paciente?.informacionEmpresa;

    const noEspecificadoTexto = 'No';
    const noEspecificadoArray = [noEspecificadoTexto];

    const pacienteTransformado = {
      key: paciente.key ?? '',
      esMenorSinCedula: info.esMenorSinCedula ?? false,
      nombreCompleto: info.nombreCompleto ?? noEspecificadoTexto,
      cedula: info.cedula ?? noEspecificadoTexto,
      telefono: info.telefono ?? noEspecificadoTexto,
      email: info.email ?? noEspecificadoTexto,
      fechaNacimiento: info.fechaNacimiento ? this.formatearFecha(info.fechaNacimiento) : '',
      edad: this.calcularEdad(info.fechaNacimiento),
      ocupacion: info.ocupacion ?? noEspecificadoTexto,
      genero: info.genero || '--',
      direccion: info.direccion ?? noEspecificadoTexto,
      sede: paciente.sede,
      fechaRegistro: paciente.fechaRegistro
        ? this.formatearFecha(paciente.fechaRegistro)
        : '',
      // ✅ AGREGAR fecha de actualización
      fechaActualizacion: paciente.fechaActualizacion
        ? this.formatearFecha(paciente.fechaActualizacion)
        : this.formatearFecha(paciente.fechaRegistro), // Si no hay fechaActualizacion, usa fechaRegistro

      redesSociales: redes.map((red: any) => ({
        platform: red.platform ?? 'Plataforma desconocida',
        username: red.username ?? noEspecificadoTexto,
        editable: false
      })),

      // Información de empresa - Verificar que empresa no sea null
      informacionEmpresa: empresa && empresa.referidoEmpresa ? {
        referidoEmpresa: true,
        empresaNombre: empresa.empresaNombre || 'No especificado',
        empresaRif: empresa.empresaRif || 'No especificado',
        empresaTelefono: empresa.empresaTelefono || 'No especificado',
        empresaDireccion: empresa.empresaDireccion || 'No especificado'
      } : null,

      historiaClinica: {
        usuarioLentes: historia.usuarioLentes ?? noEspecificadoTexto,
        fotofobia: historia.fotofobia ?? noEspecificadoTexto,
        usoDispositivo: historia.usoDispositivo?.trim() || noEspecificadoTexto,
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
        patologias: historia.patologias || '',
      }
    };

    this.pacienteSeleccionado = pacienteTransformado;
    console.log('Paciente seleccionado:', pacienteTransformado); // Para debug

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

      // ✅ Esperar al render completo antes de reiniciar scroll
      setTimeout(() => {
        const scrollableContent = modalElement.querySelector('.card-body');
        if (scrollableContent) {
          scrollableContent.scrollTop = 0;
        }
      }, 300);
    }

    this.resetearFormulario();
  }

  cerrarModalVisualizacion(): void {
    this.pacienteSeleccionado = null;
    this.cerrarModal('verPacienteModal');
  }

  crearPacienteVacio(): Paciente {
    return {
      id: '',
      key: '',
      fechaRegistro: '',
      sede: this.sedeActiva,

      informacionPersonal: {
        esMenorSinCedula: false,
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

      informacionEmpresa: null,

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
      nombreCompleto: '',
      cedula: '',
      telefono: '',
      email: '',
      fechaNacimiento: '',
      ocupacion: '',
      genero: '',
      direccion: '',
      usuarioLentes: '',
      fotofobia: '',
      usoDispositivo: null,
      intervaloUso: null,
      traumatismoOcular: '',
      traumatismoOcularDescripcion: '',
      cirugiaOcular: '',
      cirugiaOcularDescripcion: '',
      alergicoA: '',
      antecedentesPersonales: [],
      antecedentesFamiliares: [],
      patologias: [],
      patologiaOcular: [],
      sede: this.sedeActiva,
      fechaRegistro: ''
    });

    // ✅ Limpieza correcta del FormArray redesSociales
    const redesFormArray = this.formPaciente.get('redesSociales') as FormArray;
    this.limpiarFormArray(redesFormArray);

    // Variables auxiliares
    this.modoEdicion = false;
    this.pacienteEditando = null;
    this.formOriginal = {};
    this.nuevaRed = '';
    this.nuevoUsuario = '';
    this.usuarioInputHabilitado = false;
  }

  limpiarFormArray(formArray: FormArray): void {
    while (formArray.length !== 0) {
      formArray.removeAt(0);
    }
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
  verHistorias(paciente: any): void {
    const cedula = paciente.informacionPersonal.cedula || 'sin-cedula';
    const nombreSlug = this.slugify(paciente.informacionPersonal.nombreCompleto);
    const slug = `${paciente.id}-${cedula}-${nombreSlug}`;

    sessionStorage.setItem('pacientesListState', JSON.stringify({
      scrollPosition: window.scrollY,
      filtroActual: this.filtro,
      desdePacientes: true
    }));

    sessionStorage.setItem('pacienteKey', paciente.key);

    this.router.navigate(['/pacientes-historias', slug]);
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '');
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

  // Método para cambiar la cantidad de registros por página
  cambiarRegistrosPorPagina() {
    this.paginaActual = 1;
    this.calcularPaginacion();
  }

  // Método para ir a una página específica
  irAPagina(pagina: number) {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
      this.calcularPaginacion();
    }
  }

  calcularPaginacion() {
    this.totalRegistros = this.pacientesFiltradosPorSede.length;
    this.totalPaginas = Math.ceil(this.totalRegistros / this.registrosPorPagina);

    // Asegurar que la página actual sea válida
    if (this.paginaActual > this.totalPaginas) {
      this.paginaActual = this.totalPaginas || 1;
    }

    this.inicioPagina = (this.paginaActual - 1) * this.registrosPorPagina + 1;
    this.finPagina = Math.min(this.paginaActual * this.registrosPorPagina, this.totalRegistros);

    // Obtener los pacientes para la página actual
    this.pacientesPaginados = this.pacientesFiltradosPorSede.slice(
      (this.paginaActual - 1) * this.registrosPorPagina,
      this.paginaActual * this.registrosPorPagina
    );
  }

  // Métodos en el componente
  onReferidoEmpresaChange(event: any): void {
    const isChecked = event.target.checked;
    if (!isChecked) {
      // Limpiar campos cuando se desactiva
      this.limpiarCamposEmpresa();
    }
  }

  onRifBlur(): void {
    const rifControl = this.formPaciente.get('empresaRif');
    const rif = rifControl?.value?.trim();

    if (!rif) {
      return;
    }

    // Formatear el RIF (convertir a mayúsculas y asegurar guión)
    const rifFormateado = this.formatearRif(rif);
    rifControl?.setValue(rifFormateado, { emitEvent: false });

    // Validar formato básico del RIF (solo empresas)
    if (!this.validarRif(rifFormateado)) {
      this.mostrarErrorRif();
      return;
    }

    this.validarEmpresaPorRif();
  }

  mostrarErrorRif(): void {
    const rifControl = this.formPaciente.get('empresaRif');
    if (rifControl && rifControl.value) {
      const estado = this.getEstadoCampoRif();
      if (!estado.valido) {
        this.snackBar.open(estado.mensaje, 'Cerrar', {
          duration: 4000,
          panelClass: ['snackbar-warning']
        });
      }
    }
  }

  onKeyPressRif(event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    const valorActual = input.value;
    const tecla = event.key;

    // Permitir teclas de control
    if (['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(tecla)) {
      return;
    }

    // Si está vacío, solo permitir J, G, j, g
    if (valorActual.length === 0) {
      if (!/[JGjg]/.test(tecla)) {
        event.preventDefault();
        this.snackBar.open('Primer carácter debe ser J (jurídica) o G (gobierno)', 'Cerrar', {
          duration: 2000,
          panelClass: ['snackbar-warning']
        });
      }
      return;
    }

    const rifNormalizado = valorActual.toUpperCase();
    const letra = rifNormalizado.charAt(0);

    // Después de la letra, permitir guión
    if (valorActual.length === 1 && tecla === '-') {
      return; // Permitir guión después de la letra
    }

    // Contar dígitos actuales
    const numerosActuales = rifNormalizado.replace(/[^0-9]/g, '');
    const cantidadDigitos = numerosActuales.length;

    // Si la tecla es un dígito, verificar límites
    if (/\d/.test(tecla)) {
      if (letra === 'J') {
        // J- máximo 9 dígitos
        if (cantidadDigitos >= 9) {
          event.preventDefault();
          this.snackBar.open('RIF J- no puede tener más de 9 dígitos', 'Cerrar', {
            duration: 2000,
            panelClass: ['snackbar-warning']
          });
          return;
        }
      } else if (letra === 'G') {
        // G- máximo 8 dígitos
        if (cantidadDigitos >= 8) {
          event.preventDefault();
          this.snackBar.open('RIF G- no puede tener más de 8 dígitos', 'Cerrar', {
            duration: 2000,
            panelClass: ['snackbar-warning']
          });
          return;
        }
      }
    }

    // Después de J o G, solo permitir números o guión
    if (['J', 'G'].includes(letra)) {
      // Si ya tiene guión, solo números
      if (rifNormalizado.includes('-')) {
        if (!/\d/.test(tecla)) {
          event.preventDefault();
        }
      } else {
        // Si no tiene guión, permitir números o guión
        if (!/\d|-/.test(tecla)) {
          event.preventDefault();
        }
      }
    }
  }

  onRifChange(): void {
    const rifControl = this.formPaciente.get('empresaRif');
    const rif = rifControl?.value;

    if (!rif) {
      this.empresaEncontrada = false;
      this.validacionEmpresaIntentada = false;
      this.datosEmpresa = null;
      return;
    }

    // Formatear mientras se escribe (solo para visualización)
    if (rif.length > 0) {
      const rifFormateado = this.formatearRifMientrasEscribe(rif);
      if (rifFormateado !== rif) {
        rifControl?.setValue(rifFormateado, { emitEvent: false });
      }
    }

    // Validar en tiempo real mientras se escribe
    const validacion = this.validarRifEnTiempoReal(rif);

    // Mostrar conteo de dígitos
    const numeros = rif.replace(/[^0-9]/g, '');
    const letra = rif.charAt(0).toUpperCase();

    if (letra === 'J' && numeros.length > 9) {
      console.warn(`⚠️ RIF J- tiene ${numeros.length} dígitos (máximo 9)`);
    } else if (letra === 'G' && numeros.length > 8) {
      console.warn(`⚠️ RIF G- tiene ${numeros.length} dígitos (máximo 8)`);
    }

    // Solo resetear los estados cuando el usuario cambia el RIF
    this.empresaEncontrada = false;
    this.validacionEmpresaIntentada = false;
    this.datosEmpresa = null;

    // Quitar estilo de autocompletado si existía
    this.limpiarEstiloAutocompletado();
  }

  /**
   * Formatea el RIF mientras se escribe (solo para visualización)
   */
  formatearRifMientrasEscribe(rif: string): string {
    if (!rif) return '';

    let rifFormateado = rif.toUpperCase();

    // Si empieza con J o G y tiene al menos 2 caracteres
    if (/^[JG]/i.test(rifFormateado) && rifFormateado.length >= 2) {
      // Si el segundo carácter no es guión y no es un número, agregar guión
      if (rifFormateado.charAt(1) !== '-' && !/\d/.test(rifFormateado.charAt(1))) {
        rifFormateado = rifFormateado.charAt(0) + '-' + rifFormateado.slice(1);
      }
    }

    return rifFormateado;
  }

  private limpiarEstiloAutocompletado(): void {
    // Remover la clase de autocompletado de los campos
    const nombreInput = document.querySelector('[data-nombre-input]');
    const telefonoInput = document.querySelector('[data-telefono-input]');
    const direccionInput = document.querySelector('[data-direccion-input]');

    nombreInput?.classList.remove('campo-autocompletado');
    telefonoInput?.classList.remove('campo-autocompletado');
    direccionInput?.classList.remove('campo-autocompletado');
  }

  forzarValidacionEmpresa(): void {
    const rifControl = this.formPaciente.get('empresaRif');
    const rif = rifControl?.value?.trim();

    if (!rif) {
      this.snackBar.open('Ingrese un RIF para validar', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    // Formatear el RIF primero
    const rifFormateado = this.formatearRif(rif);
    rifControl?.setValue(rifFormateado, { emitEvent: false });

    // Validar que sea RIF de empresa (solo J o G)
    if (!this.validarRif(rifFormateado)) {
      this.snackBar.open('Formato de RIF inválido. Para empresas: J- seguido de 8-9 números o G- seguido de 8 números', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    this.validarEmpresaPorRif();
  }

  validarRif(rif: string): boolean {
    if (!rif) return false;

    // Normalizar el RIF (convertir a mayúsculas y limpiar espacios)
    const rifNormalizado = rif.trim().toUpperCase();

    // Patrones aceptados:
    // J-12345678 (10 caracteres total: J + - + 8 dígitos)
    // J-123456789 (11 caracteres total: J + - + 9 dígitos)
    // G-12345678 (10 caracteres total: G + - + 8 dígitos)
    const rifRegex = /^[JG]{1}-?\d{8,9}$/i;

    // Validar formato básico
    if (!rifRegex.test(rifNormalizado)) {
      return false;
    }

    // Extraer letra y números
    const letra = rifNormalizado.charAt(0).toUpperCase();
    const numeros = rifNormalizado.replace(/[^0-9]/g, '');

    // Validar longitud exacta según tipo
    if (letra === 'J') {
      // Persona jurídica: J- + 8 o 9 dígitos
      // NO 10 dígitos - eso sería inválido
      const esValido = numeros.length === 8 || numeros.length === 9;
      if (!esValido) {
      }
      return esValido;
    } else if (letra === 'G') {
      // Gobierno: G- + 8 dígitos exactamente
      const esValido = numeros.length === 8;
      if (!esValido) {
      }
      return esValido;
    }

    return false;
  }

  /**
   * Obtiene la longitud máxima permitida para un RIF según su tipo
   */
  getMaxLengthRif(rif: string): number {
    if (!rif) return 11; // Longitud máxima por defecto (J-123456789)

    const rifNormalizado = rif.trim().toUpperCase();
    const letra = rifNormalizado.charAt(0).toUpperCase();

    if (letra === 'G') {
      return 10; // G-12345678 = 1 (G) + 1 (-) + 8 (dígitos) = 10 caracteres
    } else if (letra === 'J') {
      return 11; // J-123456789 = 1 (J) + 1 (-) + 9 (dígitos) = 11 caracteres (máximo)
    } else {
      return 11; // Por defecto
    }
  }

  /**
   * Valida el RIF mientras se escribe (para mostrar errores en tiempo real)
   */
  validarRifEnTiempoReal(rif: string): { valido: boolean, mensaje: string } {
    if (!rif || rif.length < 2) {
      return { valido: true, mensaje: '' };
    }

    const rifNormalizado = rif.trim().toUpperCase();
    const letra = rifNormalizado.charAt(0).toUpperCase();

    // Validar letra inicial
    if (!['J', 'G'].includes(letra)) {
      return {
        valido: false,
        mensaje: 'Primer carácter debe ser J (jurídica) o G (gobierno)'
      };
    }

    const tieneGuion = rifNormalizado.includes('-');
    const numeros = rifNormalizado.replace(/[^0-9]/g, '');
    const longitudNumeros = numeros.length;

    // Validar límite de dígitos según tipo
    if (letra === 'J') {
      // J- máximo 9 dígitos
      if (longitudNumeros > 9) {
        return {
          valido: false,
          mensaje: 'RIF J- no puede tener más de 9 dígitos'
        };
      }
    } else if (letra === 'G') {
      // G- exactamente 8 dígitos (pero mientras escribe, máximo 8)
      if (longitudNumeros > 8) {
        return {
          valido: false,
          mensaje: 'RIF G- no puede tener más de 8 dígitos'
        };
      }
    }

    // Validar formato mientras se escribe
    if (tieneGuion) {
      // Con guión: verificar que el guión esté en posición 1
      if (rifNormalizado.charAt(1) !== '-') {
        return {
          valido: false,
          mensaje: 'El guión debe ir inmediatamente después de la letra'
        };
      }
    }

    // Validar que solo haya números después de la letra (y guión si existe)
    const parteNumerica = rifNormalizado.slice(tieneGuion ? 2 : 1);
    if (!/^\d*$/.test(parteNumerica)) {
      return {
        valido: false,
        mensaje: 'Solo se permiten números después de la letra'
      };
    }

    return { valido: true, mensaje: '' };
  }

  /**
 * Formatea un RIF para que tenga el formato estándar: J-123456789
 */
  formatearRif(rif: string): string {
    if (!rif) return '';

    // Convertir a mayúsculas y quitar espacios
    let rifFormateado = rif.trim().toUpperCase();

    // Quitar caracteres no válidos
    rifFormateado = rifFormateado.replace(/[^JG0-9-]/g, '');

    // Si no tiene guión y tiene más de un carácter, agregarlo
    if (!rifFormateado.includes('-') && rifFormateado.length > 1) {
      const letra = rifFormateado.charAt(0);
      const numeros = rifFormateado.slice(1);
      rifFormateado = `${letra}-${numeros}`;
    }

    return rifFormateado;
  }

  getClaseBotonValidarEmpresa(): string {
    let clase = 'btn-validar-compact';

    if (this.validandoEmpresa) {
      clase += ' btn-validando';
    } else if (this.empresaEncontrada) {
      clase += ' btn-encontrado';
    } else if (this.validacionEmpresaIntentada && !this.empresaEncontrada && this.formPaciente.get('empresaRif')?.value) {
      clase += ' btn-no-encontrado';
    }

    return clase;
  }

  getTooltipBotonValidarEmpresa(): string {
    if (this.validandoEmpresa) {
      return 'Buscando empresa...';
    } else if (this.empresaEncontrada) {
      return 'Empresa encontrada - Click para re-validar';
    } else if (this.validacionEmpresaIntentada && !this.empresaEncontrada) {
      return 'Empresa no encontrada - Complete los datos manualmente';
    } else if (!this.formPaciente.get('empresaRif')?.value) {
      return 'Ingrese un RIF para buscar';
    } else if (!this.validarRif(this.formPaciente.get('empresaRif')?.value)) {
      return 'RIF inválido - Corrija el formato';
    } else {
      return 'Buscar empresa en base de datos';
    }
  }

  async validarEmpresaPorRif(): Promise<void> {
    const rifControl = this.formPaciente.get('empresaRif');
    const rif = rifControl?.value?.trim();

    // Formatear el RIF antes de enviar
    const rifFormateado = this.formatearRif(rif);
    rifControl?.setValue(rifFormateado, { emitEvent: false });

    // Obtener la sede activa del paciente
    let sede = '';

    if (this.modoEdicion && this.pacienteEditando) {
      sede = this.pacienteEditando.sede || this.sedeActiva;
    } else {
      sede = this.sedeActiva;
    }

    // Validaciones básicas
    if (!rifFormateado) {
      this.snackBar.open('Ingrese un RIF para validar', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    // Validar que sea RIF de empresa (solo J o G)
    if (!this.validarRif(rifFormateado)) {
      const estado = this.getEstadoCampoRif();
      this.snackBar.open(estado.mensaje || 'RIF inválido', 'Cerrar', {
        duration: 4000,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    // Validar que haya una sede
    if (!sede) {
      this.snackBar.open('No se ha definido una sede para la búsqueda', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    // Guardar el RIF actual
    const rifActual = rifFormateado;

    // Iniciar validación
    this.validandoEmpresa = true;
    this.empresaEncontrada = false;
    this.validacionEmpresaIntentada = false;

    try {
      // Llamar al servicio para buscar empresa por RIF usando lastValueFrom
      const respuesta = await lastValueFrom(
        this.pacientesService.buscarEmpresaPorRif(rifFormateado, sede)
          .pipe(
            catchError(error => {
              console.error('Error buscando empresa:', error);
              return of({
                empresas: null,
                encontrada: false,
                error: error.message || 'Error en la búsqueda'
              });
            })
          )
      );

      this.validacionEmpresaIntentada = true;

      // Verificar si se encontró al menos una empresa en el array
      if (respuesta?.empresas && Array.isArray(respuesta.empresas) && respuesta.empresas.length > 0) {
        const empresaEncontrada = respuesta.empresas[0];

        if (this.empresaTieneDatosValidos(empresaEncontrada)) {
          this.empresaEncontrada = true;
          this.datosEmpresa = empresaEncontrada;
          this.autocompletarDatosEmpresa(empresaEncontrada);

          this.snackBar.open('✅ Empresa encontrada - Datos autocompletados', 'Cerrar', {
            duration: 3000,
            panelClass: ['snackbar-success']
          });
        } else {
          this.empresaEncontrada = false;
          this.datosEmpresa = null;
          this.limpiarCamposEmpresa();
          rifControl?.setValue(rifActual);

          this.snackBar.open('⚠️ Empresa encontrada pero sin datos completos', 'Cerrar', {
            duration: 4000,
            panelClass: ['snackbar-info']
          });
        }
      } else {
        this.empresaEncontrada = false;
        this.datosEmpresa = null;
        this.limpiarCamposEmpresa();
        rifControl?.setValue(rifActual);

        const mensaje = respuesta?.error
          ? `⚠️ ${respuesta.error}`
          : '⚠️ Empresa no encontrada. Complete los datos manualmente.';

        this.snackBar.open(mensaje, 'Cerrar', {
          duration: 4000,
          panelClass: ['snackbar-info']
        });
      }

    } catch (error: any) {
      console.error('Error en validación de empresa:', error);

      this.validacionEmpresaIntentada = true;
      this.empresaEncontrada = false;
      this.datosEmpresa = null;

      this.limpiarCamposEmpresa();
      rifControl?.setValue(rifActual);

      let mensajeError = 'Error al validar empresa. Verifique su conexión.';

      if (error.message) {
        mensajeError = error.message;
      }

      this.snackBar.open(`❌ ${mensajeError}`, 'Cerrar', {
        duration: 4000,
        panelClass: ['snackbar-warning']
      });

    } finally {
      this.validandoEmpresa = false;
      this.cdRef.detectChanges();
    }
  }

  /**
   * Verifica si la empresa tiene datos válidos para autocompletar
   */
  private empresaTieneDatosValidos(empresa: any): boolean {
    if (!empresa) return false;

    const tieneNombre = empresa.nombre ||
      empresa.razon_social ||
      empresa.nombre_comercial ||
      empresa.empresaNombre;

    return !!tieneNombre;
  }

  private autocompletarDatosEmpresa(empresa: any): void {
    if (!this.empresaTieneDatosValidos(empresa)) {
      console.warn('La empresa no tiene datos válidos para autocompletar:', empresa);
      return;
    }

    // Mapeo según la estructura real de tu API
    const datosParaAutocompletar: any = {
      empresaNombre: empresa.nombre || // ← Esta es la propiedad en tu JSON
        empresa.razon_social ||
        empresa.nombre_comercial ||
        empresa.empresaNombre,
      empresaTelefono: empresa.telefono ||
        empresa.empresaTelefono,
      empresaDireccion: empresa.direccion ||
        empresa.empresaDireccion
    };

    // Solo autocompletar campos que realmente tienen datos
    Object.keys(datosParaAutocompletar).forEach(key => {
      if (!datosParaAutocompletar[key]) {
        delete datosParaAutocompletar[key];
      }
    });

    // Verificar que haya al menos un campo para autocompletar
    if (Object.keys(datosParaAutocompletar).length > 0) {
      this.formPaciente.patchValue(datosParaAutocompletar, { emitEvent: false });

      // Forzar detección de cambios
      this.cdRef.detectChanges();

    } else {
      console.warn('No hay datos válidos para autocompletar');
      this.snackBar.open('⚠️ Empresa encontrada pero sin datos completos', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-warning']
      });
    }
  }

  private limpiarCamposEmpresa(): void {
    this.formPaciente.patchValue({
      empresaNombre: '',
      empresaTelefono: '',
      empresaDireccion: ''
    }, { emitEvent: false });

  }

  // Métodos para estados de validación
  getEstadoCampoRif(): { valido: boolean, mensaje: string } {
    const rif = this.formPaciente.get('empresaRif')?.value;

    if (!rif) {
      return { valido: true, mensaje: '' };
    }

    const rifFormateado = this.formatearRif(rif);

    if (!this.validarRif(rifFormateado)) {
      // Dar mensajes más específicos según el error
      const rifNormalizado = rifFormateado.toUpperCase();
      const letra = rifNormalizado.charAt(0);
      const numeros = rifNormalizado.replace(/[^0-9]/g, '');

      if (!['J', 'G'].includes(letra)) {
        return {
          valido: false,
          mensaje: 'Letra inválida. Para empresas use J (jurídica) o G (gobierno)'
        };
      }

      if (numeros.length === 0) {
        return {
          valido: false,
          mensaje: 'Ingrese los números del RIF'
        };
      }

      if (letra === 'J' && (numeros.length < 8 || numeros.length > 9)) {
        return {
          valido: false,
          mensaje: 'RIF J- debe tener 8 o 9 dígitos'
        };
      }

      if (letra === 'G' && numeros.length !== 8) {
        return {
          valido: false,
          mensaje: 'RIF G- debe tener exactamente 8 dígitos'
        };
      }

      return {
        valido: false,
        mensaje: 'Formato de RIF inválido. Ejemplos: J-12345678, G-87654321'
      };
    }

    return { valido: true, mensaje: '' };
  }

  getEstadoCampoNombreEmpresa(): { valido: boolean, mensaje: string } {
    const nombre = this.formPaciente.get('empresaNombre')?.value;

    if (!nombre) {
      return { valido: true, mensaje: '' };
    }

    if (nombre.length < 2) {
      return { valido: false, mensaje: 'El nombre debe tener al menos 2 caracteres' };
    }

    return { valido: true, mensaje: '' };
  }

  getEstadoCampoTelefonoEmpresa(): { valido: boolean, mensaje: string } {
    const telefono = this.formPaciente.get('empresaTelefono')?.value;

    if (!telefono) {
      return { valido: true, mensaje: '' };
    }

    // Validación básica de teléfono
    const telefonoRegex = /^[\d\s\+\-\(\)]{7,15}$/;
    if (!telefonoRegex.test(telefono)) {
      return { valido: false, mensaje: 'Formato de teléfono inválido' };
    }

    return { valido: true, mensaje: '' };
  }

  // Métodos de cambio para validación en tiempo real
  onNombreEmpresaChange(): void {
    // Puedes agregar lógica adicional si es necesario
  }

  onTelefonoEmpresaBlur(): void {
    // Validar teléfono al perder foco
    const telefono = this.formPaciente.get('empresaTelefono')?.value;
    if (telefono && !this.getEstadoCampoTelefonoEmpresa().valido) {
      this.snackBar.open('Formato de teléfono inválido', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-warning']
      });
    }
  }

  // En el HTML, actualiza la sección de info-validacion para mostrar detalles:
  getDetallesEmpresa(): string {
    if (!this.datosEmpresa) return '';

    const detalles = [];

    if (this.datosEmpresa.razon_social || this.datosEmpresa.nombre_comercial) {
      detalles.push(`<strong>Razón Social:</strong> ${this.datosEmpresa.razon_social || this.datosEmpresa.nombre_comercial}`);
    }
    if (this.datosEmpresa.telefono) {
      detalles.push(`<strong>Teléfono:</strong> ${this.datosEmpresa.telefono}`);
    }
    if (this.datosEmpresa.direccion) {
      detalles.push(`<strong>Dirección:</strong> ${this.datosEmpresa.direccion}`);
    }
    if (this.datosEmpresa.email) {
      detalles.push(`<strong>Email:</strong> ${this.datosEmpresa.email}`);
    }

    return detalles.join('<br>');
  }


  // Agrega este método para acortar nombres de empresa
  getEmpresaNombreCorto(nombreCompleto: string): string {
    if (!nombreCompleto) return 'Empresa';

    // Si el nombre es muy corto, devolverlo completo
    if (nombreCompleto.length <= 12) return nombreCompleto;

    // Tomar las primeras palabras o crear un acrónimo
    const palabras = nombreCompleto.split(' ');

    if (palabras.length === 1) {
      // Si es una sola palabra, truncar
      return nombreCompleto.substring(0, 10) + '...';
    }

    // Para 2 palabras, mostrar ambas truncadas si son largas
    if (palabras.length === 2) {
      const primera = palabras[0].substring(0, 6);
      const segunda = palabras[1].substring(0, 4);
      return `${primera} ${segunda}...`;
    }

    // Para 3 o más palabras, mostrar iniciales
    if (palabras.length >= 3) {
      const iniciales = palabras
        .slice(0, 3)
        .map(p => p.charAt(0).toUpperCase())
        .join('');
      return iniciales;
    }

    // Por defecto, truncar
    return nombreCompleto.substring(0, 10) + '...';
  }

  // Método para contar pacientes referidos por empresa
  get contadorReferidos(): number {
    return this.pacientesFiltradosPorSede.filter(
      p => p.informacionEmpresa?.referidoEmpresa
    ).length;
  }

  aplicarFiltroTexto(): void {
    let pacientesFiltrados = [...this.pacientes];

    // Primero aplicar filtro de texto
    if (this.filtro.trim()) {
      const texto = this.filtro.toLowerCase().trim();
      pacientesFiltrados = pacientesFiltrados.filter(paciente =>
        paciente.informacionPersonal.nombreCompleto.toLowerCase().includes(texto) ||
        paciente.informacionPersonal.cedula.toLowerCase().includes(texto) ||
        paciente.informacionPersonal.telefono.toLowerCase().includes(texto) ||
        (paciente.informacionEmpresa?.empresaNombre?.toLowerCase().includes(texto) || false)
      );
    }

    // Luego aplicar filtro por empresa referida
    if (this.filtroReferido === 'con-empresa') {
      pacientesFiltrados = pacientesFiltrados.filter(p => p.informacionEmpresa?.referidoEmpresa);
    } else if (this.filtroReferido === 'sin-empresa') {
      pacientesFiltrados = pacientesFiltrados.filter(p => !p.informacionEmpresa?.referidoEmpresa);
    }

    // Aplicar filtro por sede
    const sedeId = this.sedeFiltro?.trim().toLowerCase();
    if (sedeId && sedeId !== 'todas') {
      pacientesFiltrados = pacientesFiltrados.filter(p => p.sede === sedeId);
    }

    // Aplicar ordenamiento por defecto (fecha más reciente primero) cuando no hay otro orden
    // Solo si el usuario no ha hecho clic en otro encabezado de ordenamiento
    if (this.ordenActual === 'fechaRegistro') {
      // Ordenar por fecha descendente (más reciente primero)
      pacientesFiltrados.sort((a, b) => {
        const fechaA = a.fechaRegistroRaw ? new Date(a.fechaRegistroRaw).getTime() : 0;
        const fechaB = b.fechaRegistroRaw ? new Date(b.fechaRegistroRaw).getTime() : 0;
        return fechaB - fechaA; // Orden descendente
      });
    } else if (this.ordenActual) {
      // Si hay otro ordenamiento activo, aplicar ese
      pacientesFiltrados.sort((a, b) => {
        const valorA = this.getValorOrden(a, this.ordenActual) ?? '';
        const valorB = this.getValorOrden(b, this.ordenActual) ?? '';

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
    } else {
      // Si no hay ordenamiento específico, usar el predeterminado (fecha más reciente primero)
      pacientesFiltrados.sort((a, b) => {
        const fechaA = a.fechaRegistroRaw ? new Date(a.fechaRegistroRaw).getTime() : 0;
        const fechaB = b.fechaRegistroRaw ? new Date(b.fechaRegistroRaw).getTime() : 0;
        return fechaB - fechaA;
      });
    }

    this.pacientesFiltradosPorSede = pacientesFiltrados;
    this.paginaActual = 1;
    this.calcularPaginacion();
  }

  // También actualiza el método actualizarPacientesPorSede() si lo sigues usando
  actualizarPacientesPorSede(): void {
    // Llama al método unificado de filtrado
    this.aplicarFiltroTexto();
  }

  // En tu componente (pacientes.component.ts), agrega este método:
  // Método adicional para la opción de tags
  formatearPatologiasArray(patologias: string): string[] {
    if (!patologias) return [];

    return patologias.split(',').map(item => {
      const itemLimpio = item.trim();
      if (itemLimpio.length === 0) return '';
      return itemLimpio.charAt(0).toUpperCase() + itemLimpio.slice(1).toLowerCase();
    }).filter(item => item !== '');
  }


}