import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, FormControl } from '@angular/forms';
import { PacientesService } from '../../core/services/pacientes/pacientes.service';
import { SwalService } from '../../core/services/swal/swal.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as bootstrap from 'bootstrap';
import { ModalService } from '../../core/services/modal/modal.service';
import { Paciente } from './paciente-interface';
import { Observable, of, forkJoin } from 'rxjs';
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
  intervalosHora: string[] = [
    'Menos de 1 hora',
    '1 a 3 horas',
    '3 a 6 horas',
    'Más de 6 horas'
  ];
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
    private snackBar: MatSnackBar,
    private authService: AuthService,
    private loader: LoaderService
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
    this.inicializarDatosIniciales();

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
        if (c.hasError('pattern')) return 'Formato de RIF inválido. Use J- seguido de 7-9 números';
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
                // Añadir esta propiedad para ordenar
                fechaRegistroRaw: p.created_at, // 👈 IMPORTANTE: mantener formato ISO para ordenar
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
            // 👇 ORDENAR por fecha de registro (más reciente primero)
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

  actualizarPacientesPorSede(): void {
    const sedeId = this.sedeFiltro?.trim().toLowerCase();

    // Primero filtrar por sede
    let pacientesFiltrados = sedeId && sedeId !== 'todas'
      ? this.pacientes.filter(p => p.sede === sedeId)
      : [...this.pacientes];

    // Luego aplicar filtro de texto si existe
    const filtroText = this.filtro?.trim().toLowerCase();
    if (filtroText) {
      pacientesFiltrados = pacientesFiltrados.filter(p => {
        const nombre = p.informacionPersonal?.nombreCompleto?.toLowerCase() || '';
        const cedula = p.informacionPersonal?.cedula?.toLowerCase() || '';

        return nombre.includes(filtroText) || cedula.includes(filtroText);
      });
    }

    //Mantener el orden por fecha (más reciente primero)
    pacientesFiltrados.sort((a, b) => {
      // Si hay orden personalizado aplicado por los títulos de la tabla
      if (this.ordenActual !== 'fechaRegistro') {
        // Dejar que el ordenamiento personalizado funcione
        return 0;
      }
      // Orden por defecto: más reciente primero
      return new Date(b.fechaRegistroRaw || '').getTime() - new Date(a.fechaRegistroRaw || '').getTime();
    });

    this.pacientesFiltradosPorSede = pacientesFiltrados;
    this.paginaActual = 1;
    this.calcularPaginacion();
  }


  aplicarFiltroTexto(): void {
    this.actualizarPacientesPorSede();

    this.paginaActual = 1;
    this.calcularPaginacion();
  }


  // Corrección del método de ordenamiento
  ordenarPor(campo: string): void {
    if (this.ordenActual === campo) {
      this.ordenAscendente = !this.ordenAscendente;
    } else {
      this.ordenActual = campo;
      this.ordenAscendente = true; // Cambia esto a true para que sea ascendente inicialmente
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

    // Procesar uso de dispositivos electrónicos
    const usoDispositivoValue = formValues.usoDispositivo === 'Sí'
      ? `Sí, ${formValues.intervaloUso}`
      : 'No';

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
    } = formValues;

    const nuevoPaciente = {
      informacionPersonal: {
        esMenorSinCedula: formValues.esMenorSinCedula,
        nombreCompleto,
        cedula,
        telefono,
        email: formValues.email?.trim() || null,
        fechaNacimiento,
        ocupacion,
        genero: mapGenero,
        direccion
      },
      redesSociales: this.redesSociales.value,
      //Información de empresa 
      informacionEmpresa: formValues.referidoEmpresa ? {
        referidoEmpresa: true,
        empresaNombre: formValues.empresaNombre,
        empresaRif: formValues.empresaRif,
        empresaTelefono: formValues.empresaTelefono,
        empresaDireccion: formValues.empresaDireccion
      } : null,

      historiaClinica: {
        usuarioLentes,
        fotofobia,
        usoDispositivo: usoDispositivoValue,
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

    this.pacientesService.createPaciente(nuevoPaciente).subscribe({
      next: (response) => {
        this.cargando = false;
        this.pacientes.push(response);
        this.cerrarModal('modalAgregarPaciente');
        this.swalService.showSuccess('¡Registro exitoso!', 'Paciente registrado correctamente.');
        this.cargarPacientes();
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
        patologias: pacienteFormValue.patologias || [],
        patologiaOcular: pacienteFormValue.patologiaOcular || []
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

        const transformado = {
          ...paciente,
          key: keyPaciente,
          informacionPersonal: {
            ...paciente.informacionPersonal,
            genero: paciente.informacionPersonal.genero === 'm' ? 'Masculino' :
              paciente.informacionPersonal.genero === 'f' ? 'Femenino' : 'Otro',
            edad: this.calcularEdad(paciente.informacionPersonal.fechaNacimiento)
          },
          fechaRegistro: this.formatearFecha(paciente.updated_at),
          redesSociales: paciente.redesSociales || [],
          sede: paciente.sede || this.sedeActiva,
          historiaClinica: {
            ...paciente.historiaClinica,
            usoDispositivo: usoDispositivoDisplay
          }
        };

        const index = this.pacientes.findIndex(p => p.key === paciente.key);
        if (index !== -1) {
          this.pacientes[index] = transformado;
        } else {
          this.pacientes.push(transformado);
        }

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
      fechaNacimiento: this.formatearFecha(info.fechaNacimiento),
      edad: this.calcularEdad(info.fechaNacimiento),
      ocupacion: info.ocupacion ?? noEspecificadoTexto,
      genero: info.genero || '--',
      direccion: info.direccion ?? noEspecificadoTexto,
      sede: paciente.sede,
      fechaRegistro: paciente.fechaRegistro
        ? this.formatearFecha(paciente.fechaRegistro)
        : '',

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
}