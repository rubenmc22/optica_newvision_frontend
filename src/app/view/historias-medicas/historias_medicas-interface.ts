import { Paciente } from '../pacientes/paciente-interface';

// Interfaz base para historia médica
export interface HistoriaMedicaBase {
  id: string;
  nHistoria?: string;
  fecha?: string;
  horaEvaluacion?: string;
  pacienteId: string;
}

// Interfaz para datos de consulta
export interface DatosConsulta {
  motivo: string | string[];
  otroMotivo?: string;
  medico: string;
  asesor?: string;
  cedulaAsesor?: string;
}

export interface RespuestaCreacionHistoria {
  message: string;
  historial_medico: HistoriaMedica;
}



export interface Medico {
  id: number;
  nombre: string;
  cedula: string;
  // otros campos...
}

// Interfaz para antecedentes
export interface Antecedentes {
  tipoCristalActual?: string;
  ultimaGraduacion?: string;
  usuarioLentes?: boolean;
  fotofobia?: boolean;
  alergicoA?: string;
  cirugiaOcular?: boolean;
  cirugiaOcularDescripcion?: string;
  traumatismoOcular?: boolean;
  usaDispositivosElectronicos?: boolean;
  tiempoUsoEstimado?: string;
  antecedentesPersonales?: string[];
  antecedentesFamiliares?: string[];
  patologias?: string[];
  patologiaOcular?: string[];
}

// Interfaz para examen ocular
export interface ExamenOcular {
  lensometria: {
    esf_od: string;
    cil_od: string;
    eje_od: string;
    add_od: string;
    av_lejos_od: string;
    av_cerca_od: string;
    av_lejos_bi: string;
    av_bi: string;
    esf_oi: string;
    cil_oi: string;
    eje_oi: string;
    add_oi: string;
    av_lejos_oi: string;
    av_cerca_oi: string;
    av_cerca_bi: string;
  };
  refraccion: {
    esf_od: string;
    cil_od: string;
    eje_od: string;
    add_od: string;
    avccl_od: string;
    avccc_od: string;
    avccl_bi: string;
    avccc_bi: string;
    esf_oi: string;
    cil_oi: string;
    eje_oi: string;
    add_oi: string;
    avccl_oi: string;
    avccc_oi: string;
  };
  refraccionFinal: {
    esf_od: string;
    cil_od: string;
    eje_od: string;
    add_od: string;
    alt_od: string;
    dp_od: string;
    esf_oi: string;
    cil_oi: string;
    eje_oi: string;
    add_oi: string;
    alt_oi: string;
    dp_oi: string;
  };
  avsc_avae_otros: {
    avsc_od: string;
    avae_od: string;
    otros_od?: string;
    avsc_oi: string;
    avae_oi: string;
    otros_oi?: string;
    avsc_bi: string;
  };
}

// Interfaz para diagnóstico y tratamiento
export interface DiagnosticoTratamiento {
  diagnostico?: string;
  tratamiento?: string;
}

export interface HistorialResponse {
  message: string;
  historiales_medicos: HistoriaMedica[];
}


// Interfaz para recomendaciones
export interface Recomendaciones {
  cristal: TipoCristal | TipoCristal[];
  material: TipoMaterial | TipoMaterial[];
  montura: string;
  cristalSugerido?: string;
  observaciones?: string;
}

// Interfaz para conformidad
export interface Conformidad {
  notaConformidad: string;
  firmaPaciente?: string;
  firmaMedico?: string;
  firmaAsesor?: string;
}

// Interfaz para auditoría
export interface Auditoria {
  fechaCreacion: Date | string;
  fechaActualizacion?: Date | string;
  creadoPor: string;
  actualizadoPor?: string;
}

// Interfaz principal organizada por secciones
export interface HistoriaMedica {
  id: string;
  nHistoria: string;
  fecha: string;
  horaEvaluacion: string;
  pacienteId: string;

  datosConsulta: DatosConsulta;
  antecedentes: Antecedentes;
  examenOcular: ExamenOcular;
  diagnosticoTratamiento: DiagnosticoTratamiento;
  recomendaciones: Recomendaciones[];
  conformidad: Conformidad;
  auditoria: Auditoria;
}

// Interfaz para vista completa
export interface HistoriaMedicaCompleta {
  historia: HistoriaMedica;
  paciente: Paciente;
}

// Tipos específicos
export type TipoGenero = '' | 'Masculino' | 'Femenino' | 'Otro';
export type TipoCristal =
  | 'VISIÓN SENCILLA (CR-39)'
  | 'AR Básico'
  | 'AR Blue Filter'
  | 'Fotocromático'
  | 'Polarizado'
  | 'Coloración'
  | 'Bifocal'
  | 'Progresivo (CR39 First)'
  | 'Progresivo (Digital)';

export type TipoMaterial =
  | 'CR39'
  | 'AR_VERDE'
  | 'AR_BLUE_BLOCK'
  | 'FOTOCROMATICO_CR39'
  | 'FOTOCROMATICO_AR'
  | 'FOTOCROMATICO_BLUE_BLOCK'
  | 'POLICARBONATO'
  | 'HI_INDEX_156'
  | 'HI_INDEX_167'
  | 'HI_INDEX_174'
  | 'TRANSICION_PLUS'
  | 'FOTOSENSIBLE'
  | 'POLICARBONATO_BLUE_BLOCK'
  | 'OTRO';

// Utilidad para select
export interface OpcionSelect {
  value: string | number;
  label: string;
}
