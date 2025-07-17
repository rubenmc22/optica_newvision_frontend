import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Paciente } from '../pacientes/paciente-interface';
import { HistoriaMedica, HistoriaMedicaCompleta, Conformidad } from './historias_medicas-interface';
import * as bootstrap from 'bootstrap';

declare var $: any;

@Component({
  selector: 'app-historias-medicas',
  standalone: false,
  templateUrl: './historias-medicas.component.html',
  styleUrls: ['./historias-medicas.component.scss']
})
export class HistoriasMedicasComponent implements OnInit {
  // Estados del componente
  busqueda: string = '';
  cargando: boolean = false;
  mostrarElementos = false;
  mostrarSinHistorial = false;
  modoEdicion: boolean = false;
  mostrarInputOtroMotivo = false;
  maxDate: string;

  // Datos
  pacientes: Paciente[] = [];
  pacientesFiltrados: Paciente[] = [];
  pacienteSeleccionado: Paciente | null = null;
  historiaSeleccionada: HistoriaMedica | null = null;
  pacienteIdSeleccionado: string | null = null;
  historial: HistoriaMedica[] = [];
  historiasMock: Record<string, HistoriaMedica[]> = {};
  notaConformidad: string = 'PACIENTE CONFORME CON LA EXPLICACION  REALIZADA POR EL ASESOR SOBRE LAS VENTAJAS Y DESVENTAJAS DE LOS DIFERENTES TIPOS DE CRISTALES Y MATERIAL DE MONTURA, NO SE ACEPTARAN MODIFICACIONES LUEGO DE HABER RECIBIDO LA INFORMACION Y FIRMADA LA HISTORIA POR EL PACIENTE.';

  // Declaración sin inicialización directa
  historiaForm: FormGroup;

  // Opciones para formularios
  opcionesAntecedentes: string[] = [
    'Diabetes', 'Hipertensión', 'Migraña', 'Fotosensibilidad',
    'Traumatismo ocular', 'Queratocono', 'Glaucoma', 'Retinopatía diabética'
  ];

  motivosConsulta = [
    'Molestia ocular', 'Fatiga visual', 'Consulta rutinaria', 'Actualizar fórmula',
    'Sensibilidad lumínica', 'Dolor de cabeza', 'Evaluación prequirúrgica',
    'Control post-operatorio', 'Dificultad visual lejos', 'Dificultad visual cerca', 'Otro'
  ];

  tiposCristales = [
    'VISIÓN SENCILLA (CR-39)',
    'AR Básico',
    'AR Blue Filter',
    'Fotocromático',
    'Polarizado',
    'Coloración',
    'Bifocal',
    'Progresivo (CR39 First)',
    'Progresivo (Digital)'
  ];

  materiales = [
    { value: 'CR39', label: 'CR-39' },
    { value: 'POLICARBONATO', label: 'Policarbonato' },
    { value: 'TRIVEX', label: 'Trivex' },
    { value: 'ALTO_INDICE', label: 'Alto Índice' },
    { value: 'VIDRIO', label: 'Vidrio Mineral' }
  ];

  medicosTratantes = [
    'Dr. Carlos Pérez',
    'Dra. María González',
    'Dr. Luis Rodríguez',
    'Dra. Ana Fernández',
    'Dr. José Martínez'
  ];

  opcionesRef = {
    esf: [
      { value: '0.00', label: 'Plano (0.00)' },
      // Valores positivos
      { value: '+0.25', label: '+0.25' },
      { value: '+0.50', label: '+0.50' },
      { value: '+0.75', label: '+0.75' },
      { value: '+1.00', label: '+1.00' },
      { value: '+1.25', label: '+1.25' },
      { value: '+1.50', label: '+1.50' },
      { value: '+1.75', label: '+1.75' },
      { value: '+2.00', label: '+2.00' },
      { value: '+2.25', label: '+2.25' },
      { value: '+2.50', label: '+2.50' },
      { value: '+2.75', label: '+2.75' },
      { value: '+3.00', label: '+3.00' },
      { value: '+3.25', label: '+3.25' },
      { value: '+3.50', label: '+3.50' },
      { value: '+3.75', label: '+3.75' },
      { value: '+4.00', label: '+4.00' },
      // Valores negativos
      { value: '-0.25', label: '-0.25' },
      { value: '-0.50', label: '-0.50' },
      { value: '-0.75', label: '-0.75' },
      { value: '-1.00', label: '-1.00' },
      { value: '-1.25', label: '-1.25' },
      { value: '-1.50', label: '-1.50' },
      { value: '-1.75', label: '-1.75' },
      { value: '-2.00', label: '-2.00' },
      { value: '-2.25', label: '-2.25' },
      { value: '-2.50', label: '-2.50' },
      { value: '-2.75', label: '-2.75' },
      { value: '-3.00', label: '-3.00' },
      { value: '-3.25', label: '-3.25' },
      { value: '-3.50', label: '-3.50' },
      { value: '-3.75', label: '-3.75' },
      { value: '-4.00', label: '-4.00' },
      { value: '-4.25', label: '-4.25' },
      { value: '-4.50', label: '-4.50' },
      { value: '-4.75', label: '-4.75' },
      { value: '-5.00', label: '-5.00' },
      { value: '-5.25', label: '-5.25' },
      { value: '-5.50', label: '-5.50' },
      { value: '-5.75', label: '-5.75' },
      { value: '-6.00', label: '-6.00' }
    ],

    cil: [
      { value: '0.00', label: '0.00' },
      // Valores positivos
      { value: '+0.25', label: '+0.25' },
      { value: '+0.50', label: '+0.50' },
      { value: '+0.75', label: '+0.75' },
      { value: '+1.00', label: '+1.00' },
      { value: '+1.25', label: '+1.25' },
      { value: '+1.50', label: '+1.50' },
      { value: '+1.75', label: '+1.75' },
      { value: '+2.00', label: '+2.00' },
      { value: '+2.25', label: '+2.25' },
      { value: '+2.50', label: '+2.50' },
      { value: '+2.75', label: '+2.75' },
      { value: '+3.00', label: '+3.00' },
      { value: '+3.25', label: '+3.25' },
      { value: '+3.50', label: '+3.50' },
      { value: '+3.75', label: '+3.75' },
      { value: '+4.00', label: '+4.00' },
      { value: '+4.25', label: '+4.25' },
      { value: '+4.50', label: '+4.50' },
      { value: '+4.75', label: '+4.75' },
      { value: '+5.00', label: '+5.00' },
      { value: '+5.25', label: '+5.25' },
      { value: '+5.50', label: '+5.50' },
      { value: '+5.75', label: '+5.75' },
      { value: '+6.00', label: '+6.00' },
      // Valores negativos
      { value: '-0.25', label: '-0.25' },
      { value: '-0.50', label: '-0.50' },
      { value: '-0.75', label: '-0.75' },
      { value: '-1.00', label: '-1.00' },
      { value: '-1.25', label: '-1.25' },
      { value: '-1.50', label: '-1.50' },
      { value: '-1.75', label: '-1.75' },
      { value: '-2.00', label: '-2.00' },
      { value: '-2.25', label: '-2.25' },
      { value: '-2.50', label: '-2.50' },
      { value: '-2.75', label: '-2.75' },
      { value: '-3.00', label: '-3.00' },
      { value: '-3.25', label: '-3.25' },
      { value: '-3.50', label: '-3.50' },
      { value: '-3.75', label: '-3.75' },
      { value: '-4.00', label: '-4.00' },
      { value: '-4.25', label: '-4.25' },
      { value: '-4.50', label: '-4.50' },
      { value: '-4.75', label: '-4.75' },
      { value: '-5.00', label: '-5.00' },
      { value: '-5.25', label: '-5.25' },
      { value: '-5.50', label: '-5.50' },
      { value: '-5.75', label: '-5.75' },
      { value: '-6.00', label: '-6.00' }
    ],

    eje: [
      { value: 1, label: '1°' },
      { value: 2, label: '2°' },
      { value: 90, label: '90°' },
      { value: 180, label: '180°' }
    ],

    add: [
      { value: '0.00', label: 'N/A (0.00)' },
      { value: '+0.75', label: '+0.75' },
      { value: '+1.00', label: '+1.00' },
      { value: '+1.25', label: '+1.25' },
      { value: '+1.50', label: '+1.50' },
      { value: '+1.75', label: '+1.75' },
      { value: '+2.00', label: '+2.00' },
      { value: '+2.25', label: '+2.25' },
      { value: '+2.50', label: '+2.50' },
      { value: '+2.75', label: '+2.75' },
      { value: '+3.00', label: '+3.00' },
      { value: '+3.25', label: '+3.25' },
      { value: '+3.50', label: '+3.50' }
    ],

    avLejos: [
      { value: '20/20', label: '20/20 (Normal)' },
      { value: '20/25', label: '20/25' },
      { value: '20/30', label: '20/30' },
      { value: '20/40', label: '20/40' },
      { value: '20/50', label: '20/50' },
      { value: '20/60', label: '20/60' },
      { value: '20/70', label: '20/70' },
      { value: '20/80', label: '20/80' },
      { value: '20/100', label: '20/100' },
      { value: '20/200', label: '20/200' },
      { value: '20/400', label: '20/400' },
      { value: 'CF', label: 'CF (Conteo Dedos)' },
      { value: 'HM', label: 'HM (Movimiento Manos)' },
      { value: 'LP', label: 'LP (Percepción Luz)' },
      { value: 'NLP', label: 'NLP (No Percepción Luz)' }
    ],

    avCerca: [
      { value: 'J1', label: 'J1 (Excelente)' },
      { value: 'J2', label: 'J2' },
      { value: 'J3', label: 'J3' },
      { value: 'J4', label: 'J4' },
      { value: 'J5', label: 'J5' },
      { value: 'J6', label: 'J6' },
      { value: 'J7', label: 'J7' },
      { value: 'J8', label: 'J8' },
      { value: 'J9', label: 'J9' },
      { value: 'J10', label: 'J10' },
      { value: 'J11', label: 'J11' },
      { value: 'J12', label: 'J12' },
      { value: 'J14', label: 'J14' },
      { value: 'J16', label: 'J16' },
      { value: 'J18', label: 'J18' },
      { value: 'J20', label: 'J20' }
    ],

    avBinocular: [
      { value: '20/20', label: '20/20' },
      { value: '20/25', label: '20/25' },
      { value: '20/30', label: '20/30' },
      // ... otros valores binocular ...
    ],// Agregar estas nuevas opciones para ALT y DP si es necesario

    alt: [
      { value: '0', label: '0 mm' },
      { value: '1', label: '1 mm' },
      { value: '2', label: '2 mm' },
      { value: '3', label: '3 mm' },
      { value: '4', label: '4 mm' },
      { value: '5', label: '5 mm' }
      // ... agregar más valores según sea necesario
    ],

    dp: [
      { value: '60', label: '60 mm' },
      { value: '62', label: '62 mm' },
      { value: '64', label: '64 mm' },
      { value: '66', label: '66 mm' },
      { value: '68', label: '68 mm' },
      { value: '70', label: '70 mm' }
    ],

    // Nuevas opciones para AVSC y AVAE
    avsc: [
      { value: '20/20', label: '20/20' },
      { value: '20/25', label: '20/25' },
      { value: '20/30', label: '20/30' },
      { value: '20/40', label: '20/40' },
      { value: '20/50', label: '20/50' },
      { value: '20/60', label: '20/60' },
      { value: '20/70', label: '20/70' },
      { value: '20/80', label: '20/80' },
      { value: '20/100', label: '20/100' },
      { value: 'CF', label: 'CF (Conteo Dedos)' },
      { value: 'HM', label: 'HM (Movimiento Manos)' },
      { value: 'LP', label: 'LP (Percepción Luz)' }
    ],

    avae: [
      { value: 'J1', label: 'J1 (Excelente)' },
      { value: 'J2', label: 'J2' },
      { value: 'J3', label: 'J3' },
      { value: 'J4', label: 'J4' },
      { value: 'J5', label: 'J5' },
      { value: 'J6', label: 'J6' },
      { value: 'J7', label: 'J7' },
      { value: 'J8', label: 'J8' },
      { value: 'J9', label: 'J9' },
      { value: 'J10', label: 'J10' }
    ]
  };

  pacientesMock: Paciente[] = [
    {
      id: 'p1',
      nombreCompleto: 'Carlos González',
      cedula: '24567890',
      fechaNacimiento: '1985-03-21',
      telefono: '0414-1234567',
      ocupacion: 'Ingeniero Civil',
      direccion: 'Av. Libertador, Caracas',
      email: '',
      genero: 'Masculino',
      fechaRegistro: new Date().toISOString(),
      redesSociales: [],
      sede: 'guatire',
      edad: this.calcularEdad('1985-03-21') // Esto calculará 38 (en 2023)
    },
    // ... otros pacientes mock si los necesitas
  ];

  constructor(private fb: FormBuilder) {
    this.maxDate = new Date().toISOString().split('T')[0];
    this.historiaForm = this.fb.group({}); // Inicialización básica
    this.inicializarFormulario();
  }

  ngOnInit(): void {
    this.inicializarDatosMock();
    this.configurarSubscripciones();
    this.pacientes = this.pacientesMock;
    this.pacientesFiltrados = [...this.pacientes];
  }

  private inicializarFormulario(): void {
    this.historiaForm = this.fb.group({
      // Sección Paciente
      pacienteId: ['', Validators.required],
      medico: ['', Validators.required],
      motivo: ['', Validators.required],
      otroMotivo: [''],
      tipoCristalActual: [''],
      ultimaGraduacion: [''],

      // Lensometría
      len_esf_od: [''],
      len_cil_od: [''],
      len_eje_od: [''],
      len_add_od: [''],
      len_av_lejos_od: [''],
      len_av_cerca_od: [''],
      len_av_lejos_bi: [''],
      len_av_bi: [''],
      len_esf_oi: [''],
      len_cil_oi: [''],
      len_eje_oi: [''],
      len_add_oi: [''],
      len_av_lejos_oi: [''],
      len_av_cerca_oi: [''],
      len_av_cerca_bi: [''],

      // Refracción
      ref_esf_od: [''],
      ref_cil_od: [''],
      ref_eje_od: [''],
      ref_add_od: [''],
      ref_avccl_od: [''],
      ref_avccc_od: [''],
      ref_avccl_bi: [''],
      ref_avccc_bi: [''],
      ref_esf_oi: [''],
      ref_cil_oi: [''],
      ref_eje_oi: [''],
      ref_add_oi: [''],
      ref_avccl_oi: [''],
      ref_avccc_oi: [''],

      // Refracción Final
      ref_final_esf_od: [''],
      ref_final_cil_od: [''],
      ref_final_eje_od: [''],
      ref_final_add_od: [''],
      ref_final_alt_od: [''],
      ref_final_dp_od: [''],
      ref_final_esf_oi: [''],
      ref_final_cil_oi: [''],
      ref_final_eje_oi: [''],
      ref_final_add_oi: [''],
      ref_final_alt_oi: [''],
      ref_final_dp_oi: [''],

      // AVSC - AVAE - OTROS
      avsc_od: [''],
      avae_od: [''],
      otros_od: [''],
      avsc_oi: [''],
      avae_oi: [''],
      otros_oi: [''],

      // Diagnóstico y Tratamiento
      diagnostico: [''],
      tratamiento: [''],

      // Recomendaciones
      cristal: ['', Validators.required],
      material: ['', Validators.required],
      montura: ['', Validators.required],
      observaciones: ['']
    });
  }

  private inicializarDatosMock(): void {
    this.historiasMock = {
      'p1': this.generarHistorias(1),
      'p2': this.generarHistorias(5),
      'p3': [],
      'p4': this.generarHistorias(10),
      'p5': this.generarHistorias(3),
      'p6': this.generarHistorias(2),
      'p7': this.generarHistorias(3),
      'p8': this.generarHistorias(2),
      'p9': this.generarHistorias(3),
      'p10': this.generarHistorias(2)
    };
  }

  private configurarSubscripciones(): void {
    this.historiaForm.get('motivo')?.valueChanges.subscribe((motivos: string[] | null) => {
      const otroMotivoControl = this.historiaForm.get('otroMotivo');

      if (motivos && motivos.includes('Otro')) {
        otroMotivoControl?.setValidators([Validators.required]);
      } else {
        otroMotivoControl?.clearValidators();
        otroMotivoControl?.setValue('');
      }
      otroMotivoControl?.updateValueAndValidity();
    });
  }

  // Métodos públicos
  compareStrings(a: string, b: string): boolean {
    return a === b;
  }

  checkInvalidControls() {
    Object.keys(this.historiaForm.controls).forEach(key => {
      const control = this.historiaForm.get(key);
      if (control?.invalid) {
        console.log(`Campo inválido: ${key}`, {
          value: control.value,
          errors: control.errors
        });
      }
    });
  }

  onMotivoChange(selectedOptions: any[]) {
    this.mostrarInputOtroMotivo = selectedOptions.includes('Otro');
    const otroMotivoControl = this.historiaForm.get('otroMotivo');

    if (this.mostrarInputOtroMotivo) {
      otroMotivoControl?.setValidators([Validators.required]);
    } else {
      otroMotivoControl?.clearValidators();
      otroMotivoControl?.setValue('');
    }
    otroMotivoControl?.updateValueAndValidity();
  }

  generarHistorias(cantidad: number): HistoriaMedica[] {
    return Array.from({ length: cantidad }, (_, i) => ({
      id: `h${i + 1}`,
      nHistoria: `000${12345 + i}`,
      fecha: `2025-07-${String(i + 1).padStart(2, '0')}`,
      horaEvaluacion: `${8 + (i % 9)}:${(i % 2 === 0 ? '00' : '30')}`,
      pacienteId: `p${(i % 10) + 1}`,

      // Datos de consulta
      motivo: this.motivosConsulta[i % this.motivosConsulta.length],
      otroMotivo: '',
      medico: `Dr. Simulado #${i + 1}`,
      asesor: 'Asesor Ejemplo',
      cedulaAsesor: 'V-12345678',

      // Antecedentes
      tipoCristalActual: 'Visión sencilla (CR-39)',
      ultimaGraduacion: `2024-01-${String((i % 12) + 1).padStart(2, '0')}`,
      usuarioLentes: true,
      fotofobia: false,
      alergicoA: '',
      cirugiaOcular: false,
      cirugiaOcularDescripcion: '',
      traumatismoOcular: false,
      usaDispositivosElectronicos: true,
      tiempoUsoEstimado: '4-6 horas diarias',
      antecedentesPersonales: ['Hipertensión'],
      antecedentesFamiliares: ['Diabetes'],
      patologiaOcular: ['Ojo seco'],

      // Examen ocular (todos los campos)
      // Lensometría
      len_esf_od: '+1.00',
      len_cil_od: '-0.50',
      len_eje_od: '90',
      len_add_od: '+1.50',
      len_av_lejos_od: '20/20',
      len_av_cerca_od: 'J1',
      len_av_lejos_bi: '20/20',
      len_av_bi: '20/20',
      len_esf_oi: '+1.25',
      len_cil_oi: '-0.75',
      len_eje_oi: '90',
      len_add_oi: '+1.50',
      len_av_lejos_oi: '20/25',
      len_av_cerca_oi: 'J2',
      len_av_cerca_bi: '20/20',

      // Refracción
      ref_esf_od: '+1.00',
      ref_cil_od: '-0.50',
      ref_eje_od: '90',
      ref_add_od: '+1.50',
      ref_avccl_od: '20/20',
      ref_avccc_od: 'J1',
      ref_avccl_bi: '20/20',
      ref_avccc_bi: '20/20',
      ref_esf_oi: '+1.25',
      ref_cil_oi: '-0.75',
      ref_eje_oi: '90',
      ref_add_oi: '+1.50',
      ref_avccl_oi: '20/25',
      ref_avccc_oi: 'J2',

      // Refracción Final
      ref_final_esf_od: '+1.00',
      ref_final_cil_od: '-0.50',
      ref_final_eje_od: '90',
      ref_final_add_od: '+1.50',
      ref_final_alt_od: '2 mm',
      ref_final_dp_od: '64 mm',
      ref_final_esf_oi: '+1.25',
      ref_final_cil_oi: '-0.75',
      ref_final_eje_oi: '90',
      ref_final_add_oi: '+1.50',
      ref_final_alt_oi: '2 mm',
      ref_final_dp_oi: '64 mm',

      // AVSC - AVAE - OTROS
      avsc_od: '20/20',
      avae_od: 'J1',
      otros_od: 'Ninguna',
      avsc_oi: '20/25',
      avae_oi: 'J2',
      otros_oi: 'Ninguna',
      avsc_bi: '20/25',

      // Diagnóstico y tratamiento
      diagnostico: 'Miopía leve',
      tratamiento: 'Uso de lentes correctivos',

      // Recomendaciones
      cristal: 'AR Blue Filter',
      material: 'Policarbonato',
      montura: 'Metálica',
      cristalSugerido: 'AR Blue Filter',
      observaciones: 'Control anual recomendado',

      // Conformidad
      notaConformidad: 'PACIENTE CONFORME CON LA EXPLICACIÓN...',
      firmaPaciente: '',
      firmaMedico: '',
      firmaAsesor: '',

      // Auditoría
      fechaCreacion: new Date(),
      fechaActualizacion: undefined,
      creadoPor: 'system',
      actualizadoPor: undefined
    }));
  }

  @ViewChild('selectorPaciente') selectorPaciente!: ElementRef;

  filtrarPaciente = (term: string, item: Paciente): boolean => {
    const texto = term.toLowerCase();
    return item.nombreCompleto.toLowerCase().includes(texto) ||
      item.cedula.toLowerCase().includes(texto);
  };

  seleccionarPacientePorId(id: string | null): void {
    if (!id) return;

    const paciente = this.pacientes.find(p => p.id === id);
    if (!paciente) return;

    this.pacienteSeleccionado = paciente;
    this.historial = this.historiasMock[paciente.id] || [];
    this.historiaSeleccionada = this.historial[0] || null;

    this.mostrarSinHistorial = this.historial.length === 0;
    this.mostrarElementos = this.historial.length > 0;
  }

  verDetalle(historia: HistoriaMedica): void {
    this.historiaSeleccionada = historia;

    setTimeout(() => {
      const detalle = document.getElementById('detalleExamen');
      if (detalle) {
        detalle.scrollTop = 0;
      }
    }, 100);
  }

  compararPacientes = (a: Paciente, b: Paciente): boolean => {
    return a && b ? a.id === b.id : a === b;
  };

  get patologias(): string[] {
    return this.historiaSeleccionada?.patologias ?? [];
  }

  get patologiaOcular(): string[] {
    return this.historiaSeleccionada?.patologiaOcular ?? [];
  }

  guardarHistoria(): void {
    if (this.historiaForm.invalid) {
      this.checkInvalidControls();
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    const formValue = this.historiaForm.value;
    const historiaData: HistoriaMedica = {
      ...formValue,
      motivo: formValue.motivo.includes('Otro') ? formValue.otroMotivo : formValue.motivo,
      id: this.modoEdicion && this.historiaSeleccionada ? this.historiaSeleccionada.id : `h${new Date().getTime()}`,
      nHistoria: this.modoEdicion && this.historiaSeleccionada ? this.historiaSeleccionada.nHistoria : `HIS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      fecha: new Date().toISOString(),
      pacienteId: formValue.pacienteId.id || formValue.pacienteId,
      fechaCreacion: new Date(),
      creadoPor: 'usuario_actual' // Deberías reemplazar esto con el usuario real
    };

    if (this.modoEdicion) {
      console.log('Actualizando historia:', historiaData);
      // Lógica para actualizar
    } else {
      console.log('Creando nueva historia:', historiaData);
      const pacienteId = historiaData.pacienteId;

      if (pacienteId) {
        if (!this.historiasMock[pacienteId]) {
          this.historiasMock[pacienteId] = [];
        }

        this.historiasMock[pacienteId].unshift(historiaData);
        this.seleccionarPacientePorId(pacienteId);
      }
    }

    $('#historiaModal').modal('hide');
    this.historiaForm.reset();
    this.mostrarInputOtroMotivo = false;
    this.modoEdicion = false;
  }

  editarHistoria(historia: HistoriaMedica): void {
    this.modoEdicion = true;

    const motivo = Array.isArray(historia.motivo) ? historia.motivo : [historia.motivo];
    const esMotivoPersonalizado = motivo.some(m => !this.motivosConsulta.includes(m));

    this.historiaForm.patchValue({
      ...historia,
      motivo: esMotivoPersonalizado ? ['Otro'] : motivo,
      otroMotivo: esMotivoPersonalizado ? historia.motivo.toString() : '',
      pacienteId: this.pacientes.find(p => p.id === historia.pacienteId)
    });

    this.mostrarInputOtroMotivo = esMotivoPersonalizado;
    $('#historiaModal').modal('show');
  }

  nuevaHistoria(): void {
    this.modoEdicion = false;
    this.historiaForm.reset({
      fecha: new Date().toISOString().split('T')[0],
      pacienteId: this.pacienteSeleccionado
    });
    this.mostrarInputOtroMotivo = false;

    const modalElement = document.getElementById('historiaModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  calcularEdad(fechaNacimiento: string | undefined): number {
    if (!fechaNacimiento) return 0; // o algún valor por defecto

    const nacimiento = new Date(fechaNacimiento);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();

    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }

    return edad;
  }
}