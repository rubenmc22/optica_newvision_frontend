import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Paciente } from '../pacientes/paciente-interface';
import { HistoriaMedica, HistoriaMedicaCompleta, Conformidad, Recomendaciones, TipoMaterial, Antecedentes, ExamenOcular } from './historias_medicas-interface';
import {
  OPCIONES_REF,
  OPCIONES_ANTECEDENTES,
  MOTIVOS_CONSULTA,
  TIPOS_CRISTALES
} from 'src/app/shared/constants/historias-medicas';
import { HistoriaMedicaService } from '../../core/services/historias-medicas/historias-medicas.service';

import * as bootstrap from 'bootstrap';
import { SwalService } from '../../core/services/swal/swal.service';
import { ModalService } from '../../core/services/modal/modal.service';

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
  mostrarMaterialPersonalizado: boolean[] = [];

  // Declaración sin inicialización directa
  historiaForm: FormGroup;

  opcionesRef = OPCIONES_REF;
  opcionesAntecedentes = OPCIONES_ANTECEDENTES;
  motivosConsulta = MOTIVOS_CONSULTA;
  tiposCristales = TIPOS_CRISTALES;

  readonly materialesValidos = new Set<TipoMaterial>([
    'CR39',
    'AR_VERDE',
    'AR_BLUE_BLOCK',
    'FOTOCROMATICO_CR39',
    'FOTOCROMATICO_AR',
    'FOTOCROMATICO_BLUE_BLOCK',
    'POLICARBONATO',
    'HI_INDEX_156',
    'HI_INDEX_167',
    'HI_INDEX_174',
    'TRANSICION_PLUS',
    'FOTOSENSIBLE',
    'POLICARBONATO_BLUE_BLOCK',
    'OTRO'
  ]);

  materiales: { value: string; label: string }[] = [
    { value: 'CR39', label: 'CR39' },
    { value: 'AR_VERDE', label: 'Antirreflejo verde' },
    { value: 'AR_BLUE_BLOCK', label: 'Antirreflejo Blue Block' },
    { value: 'FOTOCROMATICO_CR39', label: 'Fotocromático CR39' },
    { value: 'FOTOCROMATICO_AR', label: 'Fotocromático Antirreflejo' },
    { value: 'FOTOCROMATICO_BLUE_BLOCK', label: 'Fotocromático Blue Block' },
    { value: 'POLICARBONATO', label: 'Policarbonato' },
    { value: 'HI_INDEX_156', label: 'Hi Index 1.56' },
    { value: 'HI_INDEX_167', label: 'Hi Index 1.67' },
    { value: 'HI_INDEX_174', label: 'Hi Index 1.74' },
    { value: 'TRANSICION_PLUS', label: 'Transición Pluss' },
    { value: 'FOTOSENSIBLE', label: 'Fotosensible' },
    { value: 'POLICARBONATO_BLUE_BLOCK', label: 'Policarbonato Blue Block' },
    { value: 'OTRO', label: 'Otro (especificar)' }
  ];

  readonly materialLabels = new Map<TipoMaterial, string>(
    this.materiales.map(m => [m.value as TipoMaterial, m.label])
  );


  medicosTratantes = [
    'Dr. Carlos Pérez',
    'Dra. María González',
    'Dr. Luis Rodríguez',
    'Dra. Ana Fernández',
    'Dr. José Martínez'
  ];

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

  constructor(
    private fb: FormBuilder,
    private modalService: ModalService,
    private swalService: SwalService,
    private historiaService: HistoriaMedicaService
  ) {
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

  verificarMaterialOtro(index: number): void {
    const materialesSeleccionados = this.recomendaciones.at(index).get('material')?.value || [];
    this.mostrarMaterialPersonalizado[index] = materialesSeleccionados.includes('OTRO');
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
      recomendaciones: this.fb.array([this.crearRecomendacion()]),
      // cristal: ['', Validators.required],
      //  material: ['', Validators.required],
      // montura: ['', Validators.required],
      //observaciones: ['']
    });
  }

  iniciarFlujoHistoria(): void {
    if (this.historiaSeleccionada) {
      this.precargarHistoriaSeleccionada();
    } else {
      this.prepararNuevaHistoria();
    }

    $('#historiaModal').modal('show');
  }

  getMaterialLabel(materiales: TipoMaterial | TipoMaterial[]): string {
    if (!materiales) return 'No especificado';

    const array = Array.isArray(materiales) ? materiales : [materiales];
    return array.map(m => this.materialLabels.get(m) || m).join(', ');
  }

  private precargarHistoriaSeleccionada(): void {
    this.modoEdicion = true;
    this.historiaForm.reset();

    const h = this.historiaSeleccionada!;
    const dc = h.datosConsulta;
    const ant = h.antecedentes;
    const eo = h.examenOcular;
    const dt = h.diagnosticoTratamiento;

    this.historiaForm.patchValue({
      horaEvaluacion: h.horaEvaluacion,
      pacienteId: h.pacienteId,

      // Datos de consulta
      motivo: Array.isArray(dc.motivo) ? dc.motivo : [dc.motivo],
      otroMotivo: dc.otroMotivo,
      medico: dc.medico,
      asesor: dc.asesor,
      cedulaAsesor: dc.cedulaAsesor,

      // Antecedentes
      tipoCristalActual: ant.tipoCristalActual,
      ultimaGraduacion: ant.ultimaGraduacion,
      usuarioLentes: ant.usuarioLentes,
      fotofobia: ant.fotofobia,
      alergicoA: ant.alergicoA,
      cirugiaOcular: ant.cirugiaOcular,
      cirugiaOcularDescripcion: ant.cirugiaOcularDescripcion,
      traumatismoOcular: ant.traumatismoOcular,
      usaDispositivosElectronicos: ant.usaDispositivosElectronicos,
      tiempoUsoEstimado: ant.tiempoUsoEstimado,
      antecedentesPersonales: ant.antecedentesPersonales,
      antecedentesFamiliares: ant.antecedentesFamiliares,
      patologias: ant.patologias,
      patologiaOcular: ant.patologiaOcular,

      // Lensometría
      len_esf_od: eo.lensometria.esf_od,
      len_cil_od: eo.lensometria.cil_od,
      len_eje_od: eo.lensometria.eje_od,
      len_add_od: eo.lensometria.add_od,
      len_av_lejos_od: eo.lensometria.av_lejos_od,
      len_av_cerca_od: eo.lensometria.av_cerca_od,
      len_av_lejos_bi: eo.lensometria.av_lejos_bi,
      len_av_bi: eo.lensometria.av_bi,
      len_esf_oi: eo.lensometria.esf_oi,
      len_cil_oi: eo.lensometria.cil_oi,
      len_eje_oi: eo.lensometria.eje_oi,
      len_add_oi: eo.lensometria.add_oi,
      len_av_lejos_oi: eo.lensometria.av_lejos_oi,
      len_av_cerca_oi: eo.lensometria.av_cerca_oi,
      len_av_cerca_bi: eo.lensometria.av_cerca_bi,

      // Refracción
      ref_esf_od: eo.refraccion.esf_od,
      ref_cil_od: eo.refraccion.cil_od,
      ref_eje_od: eo.refraccion.eje_od,
      ref_add_od: eo.refraccion.add_od,
      ref_avccl_od: eo.refraccion.avccl_od,
      ref_avccc_od: eo.refraccion.avccc_od,
      ref_avccl_bi: eo.refraccion.avccl_bi,
      ref_avccc_bi: eo.refraccion.avccc_bi,
      ref_esf_oi: eo.refraccion.esf_oi,
      ref_cil_oi: eo.refraccion.cil_oi,
      ref_eje_oi: eo.refraccion.eje_oi,
      ref_add_oi: eo.refraccion.add_oi,
      ref_avccl_oi: eo.refraccion.avccl_oi,
      ref_avccc_oi: eo.refraccion.avccc_oi,

      // Refracción Final
      ref_final_esf_od: eo.refraccionFinal.esf_od,
      ref_final_cil_od: eo.refraccionFinal.cil_od,
      ref_final_eje_od: eo.refraccionFinal.eje_od,
      ref_final_add_od: eo.refraccionFinal.add_od,
      ref_final_alt_od: eo.refraccionFinal.alt_od,
      ref_final_dp_od: eo.refraccionFinal.dp_od,
      ref_final_esf_oi: eo.refraccionFinal.esf_oi,
      ref_final_cil_oi: eo.refraccionFinal.cil_oi,
      ref_final_eje_oi: eo.refraccionFinal.eje_oi,
      ref_final_add_oi: eo.refraccionFinal.add_oi,
      ref_final_alt_oi: eo.refraccionFinal.alt_oi,
      ref_final_dp_oi: eo.refraccionFinal.dp_oi,

      // AVSC / AVAE / OTROS
      avsc_od: eo.avsc_avae_otros.avsc_od,
      avae_od: eo.avsc_avae_otros.avae_od,
      otros_od: eo.avsc_avae_otros.otros_od,
      avsc_oi: eo.avsc_avae_otros.avsc_oi,
      avae_oi: eo.avsc_avae_otros.avae_oi,
      otros_oi: eo.avsc_avae_otros.otros_oi,
      avsc_bi: eo.avsc_avae_otros.avsc_bi,

      // Diagnóstico / Tratamiento
      diagnostico: dt.diagnostico,
      tratamiento: dt.tratamiento
    });

    this.recomendaciones.clear();
    h.recomendaciones.forEach(r => {
      const grupo = this.crearRecomendacion(r);
      this.recomendaciones.push(grupo);
    });

  }

  private prepararNuevaHistoria(): void {
    this.historiaForm.reset();
    this.modoEdicion = false;
    this.recomendaciones.clear(); // si usas FormArray
    this.agregarRecomendacion();  // agrega una recomendación vacía
  }

  private construirHistoriaMedica(): HistoriaMedica {
    const formValue = this.historiaForm.value;

    return {
      id: this.modoEdicion && this.historiaSeleccionada ? this.historiaSeleccionada.id : `h${Date.now()}`,
      nHistoria: this.modoEdicion && this.historiaSeleccionada ? this.historiaSeleccionada.nHistoria : `HIS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      fecha: new Date().toISOString(),
      horaEvaluacion: formValue.horaEvaluacion,
      pacienteId: formValue.pacienteId.id || formValue.pacienteId,

      datosConsulta: {
        motivo: formValue.motivo.includes('Otro') ? formValue.otroMotivo : formValue.motivo,
        otroMotivo: formValue.otroMotivo,
        medico: formValue.medico,
        asesor: formValue.asesor,
        cedulaAsesor: formValue.cedulaAsesor
      },

      antecedentes: this.mapAntecedentes(),

      examenOcular: this.mapExamenOcular(),

      diagnosticoTratamiento: {
        diagnostico: formValue.diagnostico ?? '',
        tratamiento: formValue.tratamiento ?? ''
      },

      recomendaciones: this.mapRecomendaciones(),

      conformidad: {
        notaConformidad: this.notaConformidad,
        firmaPaciente: '',
        firmaMedico: '',
        firmaAsesor: ''
      },

      auditoria: {
        fechaCreacion: new Date().toISOString(),
        creadoPor: 'usuario_actual',
        fechaActualizacion: this.modoEdicion ? new Date().toISOString() : undefined,
        actualizadoPor: this.modoEdicion ? 'usuario_actual' : undefined
      }
    };
  }

  private mapExamenOcular(): ExamenOcular {
    const f = this.historiaForm.value;

    return {
      lensometria: {
        esf_od: f.len_esf_od,
        cil_od: f.len_cil_od,
        eje_od: f.len_eje_od,
        add_od: f.len_add_od,
        av_lejos_od: f.len_av_lejos_od,
        av_cerca_od: f.len_av_cerca_od,
        av_lejos_bi: f.len_av_lejos_bi,
        av_bi: f.len_av_bi,
        esf_oi: f.len_esf_oi,
        cil_oi: f.len_cil_oi,
        eje_oi: f.len_eje_oi,
        add_oi: f.len_add_oi,
        av_lejos_oi: f.len_av_lejos_oi,
        av_cerca_oi: f.len_av_cerca_oi,
        av_cerca_bi: f.len_av_cerca_bi
      },
      refraccion: {
        esf_od: f.ref_esf_od,
        cil_od: f.ref_cil_od,
        eje_od: f.ref_eje_od,
        add_od: f.ref_add_od,
        avccl_od: f.ref_avccl_od,
        avccc_od: f.ref_avccc_od,
        avccl_bi: f.ref_avccl_bi,
        avccc_bi: f.ref_avccc_bi,
        esf_oi: f.ref_esf_oi,
        cil_oi: f.ref_cil_oi,
        eje_oi: f.ref_eje_oi,
        add_oi: f.ref_add_oi,
        avccl_oi: f.ref_avccl_oi,
        avccc_oi: f.ref_avccc_oi
      },
      refraccionFinal: {
        esf_od: f.ref_final_esf_od,
        cil_od: f.ref_final_cil_od,
        eje_od: f.ref_final_eje_od,
        add_od: f.ref_final_add_od,
        alt_od: f.ref_final_alt_od,
        dp_od: f.ref_final_dp_od,
        esf_oi: f.ref_final_esf_oi,
        cil_oi: f.ref_final_cil_oi,
        eje_oi: f.ref_final_eje_oi,
        add_oi: f.ref_final_add_oi,
        alt_oi: f.ref_final_alt_oi,
        dp_oi: f.ref_final_dp_oi
      },
      avsc_avae_otros: {
        avsc_od: f.avsc_od,
        avae_od: f.avae_od,
        otros_od: f.otros_od,
        avsc_oi: f.avsc_oi,
        avae_oi: f.avae_oi,
        otros_oi: f.otros_oi,
        avsc_bi: f.avsc_bi
      }
    };
  }

  private mapAntecedentes(): Antecedentes {
    const f = this.historiaForm.value;

    return {
      tipoCristalActual: f.tipoCristalActual,
      ultimaGraduacion: f.ultimaGraduacion,
      usuarioLentes: f.usuarioLentes ?? false,
      fotofobia: f.fotofobia ?? false,
      alergicoA: f.alergicoA ?? '',
      cirugiaOcular: f.cirugiaOcular ?? false,
      cirugiaOcularDescripcion: f.cirugiaOcularDescripcion ?? '',
      traumatismoOcular: f.traumatismoOcular ?? false,
      usaDispositivosElectronicos: f.usaDispositivosElectronicos ?? false,
      tiempoUsoEstimado: f.tiempoUsoEstimado ?? '',
      antecedentesPersonales: f.antecedentesPersonales ?? [],
      antecedentesFamiliares: f.antecedentesFamiliares ?? [],
      patologias: f.patologias ?? [],
      patologiaOcular: f.patologiaOcular ?? []
    };
  }

  private mapRecomendaciones(): Recomendaciones[] {
    return this.recomendaciones.controls.map(control => {
      const grupo = control as FormGroup;

      const materialesSeleccionados: string[] = grupo.get('material')?.value || [];
      const otrosMaterialesRaw: string = grupo.get('materialPersonalizado')?.value?.trim() || '';

      const otrosMateriales = otrosMaterialesRaw
        ? otrosMaterialesRaw.split(',').map(m => m.trim()).filter(m => m)
        : [];

      const materialesCombinados = [
        ...materialesSeleccionados.filter(m => m !== 'OTRO'),
        ...otrosMateriales
      ].filter(m => this.materialesValidos.has(m as TipoMaterial)) as TipoMaterial[];

      return {
        cristal: grupo.get('cristal')?.value || [],
        material: materialesCombinados,
        montura: grupo.get('montura')?.value || '',
        cristalSugerido: grupo.get('cristalSugerido')?.value || '',
        observaciones: grupo.get('observaciones')?.value || ''
      };
    });
  }

  private crearHistoria(historia: HistoriaMedica): void {
    this.historiaService.createHistoria(historia).subscribe({
      next: () => {
        this.swalService.showSuccess('¡Historia registrada!', 'La historia médica fue guardada correctamente.');
        this.seleccionarPacientePorId(historia.pacienteId);
      },
      error: (err) => {
        console.error('Error al guardar historia:', err);
        this.swalService.showError('Error', 'No se pudo guardar la historia médica.');
      }
    });
  }

  /* private actualizarHistoria(historia: HistoriaMedica): void {
     this.historiaService.updateHistoria(historia.id, historia).subscribe({
       next: () => {
         this.swalService.showSuccess('¡Historia actualizada!', 'Los cambios fueron guardados correctamente.');
         this.seleccionarPacientePorId(historia.pacienteId);
       },
       error: (err) => {
         console.error('Error al actualizar historia:', err);
         this.swalService.showError('Error', 'No se pudo actualizar la historia médica.');
       }
     });
   }*/


  cerrarModal(id: string): void {
    const modalElement = document.getElementById(id);

    if (modalElement) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      modal?.hide();
    }

    //   this.resetearFormulario();
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

  get recomendaciones(): FormArray {
    return this.historiaForm.get('recomendaciones') as FormArray;
  }

  crearRecomendacion(rec?: Recomendaciones): FormGroup {
    return this.fb.group({
      cristal: [rec?.cristal || ''],
      material: [rec?.material || []],
      materialPersonalizado: [''],
      montura: [rec?.montura || ''],
      cristalSugerido: [rec?.cristalSugerido || ''],
      observaciones: [rec?.observaciones || '']
    });
  }

  agregarRecomendacion(): void {
    this.recomendaciones.push(this.crearRecomendacion());
  }

  eliminarRecomendacion(index: number): void {
    this.recomendaciones.removeAt(index);
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

      datosConsulta: {
        motivo: this.motivosConsulta[i % this.motivosConsulta.length],
        otroMotivo: '',
        medico: `Dr. Simulado #${i + 1}`,
        asesor: 'Asesor Ejemplo',
        cedulaAsesor: 'V-12345678'
      },

      antecedentes: {
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
        patologias: [],
        patologiaOcular: ['Ojo seco']
      },

      examenOcular: {
        lensometria: {
          esf_od: '+1.00',
          cil_od: '-0.50',
          eje_od: '90',
          add_od: '+1.50',
          av_lejos_od: '20/20',
          av_cerca_od: 'J1',
          av_lejos_bi: '20/20',
          av_bi: '20/20',
          esf_oi: '+1.25',
          cil_oi: '-0.75',
          eje_oi: '90',
          add_oi: '+1.50',
          av_lejos_oi: '20/25',
          av_cerca_oi: 'J2',
          av_cerca_bi: '20/20'
        },
        refraccion: {
          esf_od: '+1.00',
          cil_od: '-0.50',
          eje_od: '90',
          add_od: '+1.50',
          avccl_od: '20/20',
          avccc_od: 'J1',
          avccl_bi: '20/20',
          avccc_bi: '20/20',
          esf_oi: '+1.25',
          cil_oi: '-0.75',
          eje_oi: '90',
          add_oi: '+1.50',
          avccl_oi: '20/25',
          avccc_oi: 'J2'
        },
        refraccionFinal: {
          esf_od: '+1.00',
          cil_od: '-0.50',
          eje_od: '90',
          add_od: '+1.50',
          alt_od: '2 mm',
          dp_od: '64 mm',
          esf_oi: '+1.25',
          cil_oi: '-0.75',
          eje_oi: '90',
          add_oi: '+1.50',
          alt_oi: '2 mm',
          dp_oi: '64 mm'
        },
        avsc_avae_otros: {
          avsc_od: '20/20',
          avae_od: 'J1',
          otros_od: 'Ninguna',
          avsc_oi: '20/25',
          avae_oi: 'J2',
          otros_oi: 'Ninguna',
          avsc_bi: '20/25'
        }
      },

      diagnosticoTratamiento: {
        diagnostico: 'Miopía leve',
        tratamiento: 'Uso de lentes correctivos'
      },

      recomendaciones: [
        {
          cristal: 'AR Blue Filter',
          material: ['POLICARBONATO', 'FOTOCROMATICO_BLUE_BLOCK'],
          montura: 'Metálica',
          cristalSugerido: 'AR Blue Filter',
          observaciones: 'Control anual recomendado'
        }
      ],

      conformidad: {
        notaConformidad: 'PACIENTE CONFORME CON LA EXPLICACIÓN...',
        firmaPaciente: '',
        firmaMedico: '',
        firmaAsesor: ''
      },

      auditoria: {
        fechaCreacion: new Date(),
        fechaActualizacion: undefined,
        creadoPor: 'system',
        actualizadoPor: undefined
      }
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
    return this.historiaSeleccionada?.antecedentes?.patologias ?? [];
  }

  get patologiaOcular(): string[] {
    return this.historiaSeleccionada?.antecedentes?.patologiaOcular ?? [];
  }



  /* editarHistoria(historia: HistoriaMedica): void {
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
   }*/

  /*  nuevaHistoria(): void {
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
    }*/

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