import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as bootstrap from 'bootstrap';

declare var $: any;

@Component({
  selector: 'app-historias-medicas',
  standalone: false,
  templateUrl: './historias-medicas.component.html',
  styleUrl: './historias-medicas.component.scss'
})
export class HistoriasMedicasComponent implements OnInit {
  busqueda: string = '';
  pacientes: any[] = [];
  pacientesFiltrados: any[] = [];
  pacienteSeleccionado: any = null;
  historiaSeleccionada: any = null;
  pacienteIdSeleccionado: string | null = null;
  historial: any[] = [];
  cargando: boolean = false;
  ultimaHistoriaFecha: string | null = null;
  historiasMock: Record<string, any[]> = {};
  mostrarElementos = false;
  mostrarSinHistorial = false;
  notaConformidad: string = '';
  modoEdicion: boolean = false;

  // Formulario reactivo
  historiaForm: FormGroup;

  // Opciones para los select
  opcionesAntecedentes: string[] = [
    'Diabetes', 'Hipertensión', 'Migraña', 'Fotosensibilidad',
    'Traumatismo ocular', 'Queratocono', 'Glaucoma', 'Retinopatía diabética'
  ];

  constructor(private fb: FormBuilder) {
    this.historiaForm = this.fb.group({
      // Datos del paciente
      pacienteId: ['', Validators.required],
      medico: ['', Validators.required],
      motivo: ['', Validators.required],
      fecha: [new Date().toISOString().split('T')[0]],
      horaEvaluacion: [''],

      // Antecedentes
      usuarioLentes: [false],
      tipoCristalActual: [''],
      ultimaGraduacion: [''],
      fotofobia: [false],
      antecedentesPersonales: [[]],
      antecedentesFamiliares: [[]],

      // Lensometría
      len_esf_od: [''],
      len_cil_od: [''],
      len_eje_od: [''],
      len_add_od: [''],
      len_av_lejos_od: [''],
      len_av_cerca_od: [''],
      len_esf_oi: [''],
      len_cil_oi: [''],
      len_eje_oi: [''],
      len_add_oi: [''],
      len_av_lejos_oi: [''],
      len_av_cerca_oi: [''],

      // Refracción
      ref_esf_od: [''],
      ref_cil_od: [''],
      ref_eje_od: [''],
      ref_add_od: [''],
      ref_avccl_od: [''],
      ref_avccc_od: [''],
      ref_esf_oi: [''],
      ref_cil_oi: [''],
      ref_eje_oi: [''],
      ref_add_oi: [''],
      ref_avccl_oi: [''],
      ref_avccc_oi: [''],

      // Diagnóstico y tratamiento
      diagnostico: [''],
      tratamiento: [''],

      // Recomendaciones
      cristal: [''],
      material: [''],
      montura: [''],
      observaciones: [''],

      // Nota de conformidad
      conforme: [false],
      asesor: ['']
    });
  }

  pacientesMock = [
    {
      id: 'p1',
      nombreCompleto: 'Carlos González',
      cedula: '24567890',
      fechaNacimiento: '1985-03-21',
      telefono: '0414-1234567',
      ocupacion: 'Ingeniero Civil',
      direccion: 'Av. Libertador, Caracas'
    },
    {
      id: 'p2',
      nombreCompleto: 'Ana Rivas',
      cedula: '26543210',
      fechaNacimiento: '1990-07-11',
      telefono: '0424-9876543',
      ocupacion: 'Contadora Pública',
      direccion: 'Calle 12, Maracaibo'
    },
    {
      id: 'p3',
      nombreCompleto: 'Luis Cabrera',
      cedula: '23884567',
      fechaNacimiento: '1982-11-03',
      telefono: '0412-5557890',
      ocupacion: 'Diseñador Gráfico',
      direccion: 'Residencias El Parque, Valencia'
    },
    {
      id: 'p4',
      nombreCompleto: 'María Torres',
      cedula: '24321189',
      fechaNacimiento: '1978-09-30',
      telefono: '0416-4443322',
      ocupacion: 'Docente',
      direccion: 'Sector La Trinidad, Guatire'
    },
    {
      id: 'p5',
      nombreCompleto: 'José Fernández',
      cedula: '21678901',
      fechaNacimiento: '1965-01-17',
      telefono: '0416-1230987',
      ocupacion: 'Carpintero',
      direccion: 'Av. Bolívar, Barquisimeto'
    },
    {
      id: 'p6',
      nombreCompleto: 'Valentina Méndez',
      cedula: '28765432',
      fechaNacimiento: '2002-05-23',
      telefono: '0426-5674321',
      ocupacion: 'Estudiante',
      direccion: 'Urbanización El Prado, Mérida'
    },
    {
      id: 'p7',
      nombreCompleto: 'Esteban Reyes',
      cedula: '23456789',
      fechaNacimiento: '1993-12-12',
      telefono: '0412-7778888',
      ocupacion: 'Chef',
      direccion: 'Zona Industrial, Cumaná'
    },
    {
      id: 'p8',
      nombreCompleto: 'Andrea Salas',
      cedula: '25896314',
      fechaNacimiento: '1988-06-01',
      telefono: '0424-3332211',
      ocupacion: 'Administradora',
      direccion: 'Calle Comercio, Punto Fijo'
    },
    {
      id: 'p9',
      nombreCompleto: 'Diego Ramírez',
      cedula: '26234567',
      fechaNacimiento: '1975-04-19',
      telefono: '0414-8899000',
      ocupacion: 'Abogado',
      direccion: 'Conjunto Residencial Altamira, Caracas'
    },
    {
      id: 'p10',
      nombreCompleto: 'Lucía Blanco',
      cedula: '24987654',
      fechaNacimiento: '1995-10-02',
      telefono: '0426-9988776',
      ocupacion: 'Nutricionista',
      direccion: 'Urbanización La Loma, San Cristóbal'
    }
  ];

  ngOnInit(): void {
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

    this.pacientes = this.pacientesMock;
    this.pacientesFiltrados = [...this.pacientes];
  }

  generarHistorias(cantidad: number): any[] {
    const motivosConsulta = [
      'Molestia ocular', 'Fatiga visual', 'Consulta rutinaria', 'Actualizar fórmula',
      'Sensibilidad lumínica', 'Dolor de cabeza', 'Evaluación prequirúrgica',
      'Control post-operatorio', 'Dificultad visual lejos', 'Dificultad visual cerca'
    ];

    const antecedentesPersonales = [
      'Diabetes', 'Hipertensión', 'Migraña', 'Fotosensibilidad',
      'Traumatismo ocular', 'Queratocono'
    ];

    const antecedentesFamiliares = [
      'Diabetes', 'Hipertensión arterial', 'Glaucoma',
      'Degeneración macular', 'Queratocono', 'Retinopatía diabética'
    ];

    const patologiasOculares = [
      'Uveítis', 'Catarata', 'Queratitis', 'Desprendimiento de retina',
      'Glaucoma', 'Queratocono', 'Ojo seco'
    ];

    const tiposCristales = [
      'Visión sencilla (CR-39)', 'AR Básico', 'AR Blue Filter',
      'Fotocromático', 'Polarizado', 'Coloración',
      'Bifocal', 'Progresivo (CR39 First)', 'Progresivo (Digital)'
    ];

    this.notaConformidad = 'PACIENTE CONFORME CON LA EXPLICACIÓN REALIZADA POR EL ASESOR SOBRE LAS VENTAJAS Y DESVENTAJAS DE LOS DIFERENTES TIPOS DE CRISTALES Y MATERIAL DE MONTURA. NO SE ACEPTARÁN MODIFICACIONES LUEGO DE HABER RECIBIDO LA INFORMACIÓN Y FIRMADA LA HISTORIA POR EL PACIENTE.';

    return Array.from({ length: cantidad }, (_, i) => ({
      id: `h${i + 1}`,
      fecha: `2025-07-${String(i + 1).padStart(2, '0')}`,
      horaEvaluacion: `${8 + (i % 9)}:${(i % 2 === 0 ? '00' : '30')}`,
      motivo: motivosConsulta[i % motivosConsulta.length],
      medico: `Dr. Simulado #${i + 1}`,
      od: '20/25',
      oi: '20/30',

      // Refracción
      ref_esf_od: '-1.25',
      ref_cil_od: '-0.50',
      ref_eje_od: '180',
      ref_add_od: '+1.25',
      ref_avcc_od: '20/20',
      ref_avccl_od: '20/25',
      ref_avccl_oi: '20/30',
      ref_avccl_bi: '20/20',
      ref_avccc_od: 'J1',
      ref_avccc_oi: 'J1',
      ref_avccc_bi: 'J1+',
      ref_esf_oi: '-0.75',
      ref_cil_oi: '-0.25',
      ref_eje_oi: '175',
      ref_add_oi: '+1.25',
      ref_avcc_oi: '20/20',

      // Refracción final
      ref_final_esf_od: '-1.25',
      ref_final_cil_od: '-0.50',
      ref_final_eje_od: '180',
      ref_final_add_od: '+1.25',
      ref_final_alt_od: '18',
      ref_final_dp_od: '30',
      ref_final_esf_oi: '-0.75',
      ref_final_cil_oi: '-0.25',
      ref_final_eje_oi: '175',
      ref_final_add_oi: '+1.25',
      ref_final_alt_oi: '18',
      ref_final_dp_oi: '30',

      // Lensometría
      len_av_lejos_od: '20/25',
      len_av_lejos_oi: '20/30',
      len_av_lejos_bi: i % 2 === 0 ? '20/20' : '20/25',
      len_av_cerca_od: 'J1',
      len_av_cerca_oi: 'J1',
      len_av_cerca_bi: i % 3 === 0 ? 'J1+' : 'J2',
      lenesf_od: '-1.25',
      len_cil_od: '-0.50',
      len_eje_od: '180',
      len_add_od: '+1.25',
      len_esf_oi: '-0.75',
      len_cil_oi: '-0.25',
      len_eje_oi: '175',
      len_add_oi: '+1.25',

      // AVSC - AVAE - OTROS
      avsc_od: '20/25',
      avsc_oi: '20/30',
      avsc_bi: '20/20',
      avae_od: '20/25',
      avae_oi: '20/30',
      otros_od: 'Sin hallazgos',
      otros_oi: 'Leve hiperemia',

      // Diagnóstico
      diagnostico: 'Miopía con astigmatismo',
      tratamiento: 'Lentes recetados',
      cristal: 'Antirreflejo básico',
      material: 'Policarbonato',
      montura: 'Rectangular metálica',
      cristalSugerido: 'Standard Blue',
      observaciones: 'Paciente estable',
      n_historia: '00012345',

      // Historia clínica
      motivoConsulta: motivosConsulta[i % motivosConsulta.length],
      patologias: antecedentesPersonales.slice(0, (i % 5) + 6),
      usaDispositivosElectronicos: i % 2 === 0,
      tiempoUsoEstimado: `${2 + (i % 4)} horas diarias`,
      fotofobia: i % 2 === 0,
      alergico: i % 3 === 0,
      traumatismoOcular: i % 4 === 0,
      cirugiaOcular: i % 5 === 0,
      antecedentesFamiliares: i % 2 === 0 ? antecedentesFamiliares.slice(0, (i % 3) + 1) : [],
      patologiaOcular: i % 3 === 0 ? patologiasOculares.slice(0, (i % 2) + 1) : [],

      // Uso actual de lentes
      usuarioLentes: i % 2 === 0,
      ultimaGraduacion: i % 2 === 0 ? `202${i % 3}-0${(i % 9) + 1}-15` : '',
      tipoCristalActual: tiposCristales[i % tiposCristales.length]
    }));
  }

  @ViewChild('selectorPaciente') selectorPaciente!: ElementRef;

  filtrarPaciente = (term: string, item: any) => {
    const texto = term.toLowerCase();
    return item.nombreCompleto.toLowerCase().includes(texto) || item.cedula.toLowerCase().includes(texto);
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

  verDetalle(historia: any): void {
    this.historiaSeleccionada = historia;

    setTimeout(() => {
      const detalle = document.getElementById('detalleExamen');
      if (detalle) {
        detalle.scrollTop = 0;
      }
    }, 100);
  }

  compararPacientes = (a: any, b: any): boolean => {
    return a && b ? a.id === b.id : a === b;
  };

  guardarHistoria(): void {
    if (this.historiaForm.invalid) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    const historiaData = this.historiaForm.value;

    if (this.modoEdicion) {
      console.log('Actualizando historia:', historiaData);
    } else {
      console.log('Creando nueva historia:', historiaData);

      const pacienteId = this.historiaForm.get('pacienteId')?.value?.id;
      if (pacienteId) {
        if (!this.historiasMock[pacienteId]) {
          this.historiasMock[pacienteId] = [];
        }

        const nuevaHistoria = {
          ...historiaData,
          id: `h${this.historiasMock[pacienteId].length + 1}`,
          fecha: historiaData.fecha || new Date().toISOString().split('T')[0]
        };

        this.historiasMock[pacienteId].unshift(nuevaHistoria);
        this.seleccionarPacientePorId(pacienteId);
      }
    }

    $('#historiaModal').modal('hide');
    this.historiaForm.reset();
  }

  editarHistoria(historia: any): void {
    this.modoEdicion = true;
    this.historiaForm.patchValue(historia);
    $('#historiaModal').modal('show');
  }

  nuevaHistoria(): void {
    this.modoEdicion = false;
    this.historiaForm.reset({
      fecha: new Date().toISOString().split('T')[0],
      pacienteId: this.pacienteSeleccionado
    });

    const modalElement = document.getElementById('historiaModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  calcularEdad(fechaNacimiento: string): number {
    const nacimiento = new Date(fechaNacimiento);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
    return edad;
  }
}