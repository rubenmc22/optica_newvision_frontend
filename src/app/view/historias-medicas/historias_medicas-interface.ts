import { Paciente } from '../pacientes/paciente-interface'; // Ajusta la ruta segú

// Interfaz base para historia médica
export interface HistoriaMedicaBase {
  id: string;
  nHistoria: string;
  fecha: string;
  horaEvaluacion: string;
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
  // Lensometría
  len_esf_od: string;
  len_cil_od: string;
  len_eje_od: string;
  len_add_od: string;
  len_av_lejos_od: string;
  len_av_cerca_od: string;
  len_av_lejos_bi: string;
  len_av_bi: string;
  len_esf_oi: string;
  len_cil_oi: string;
  len_eje_oi: string;
  len_add_oi: string;
  len_av_lejos_oi: string;
  len_av_cerca_oi: string;
  len_av_cerca_bi: string;

  // Refracción
  ref_esf_od: string;
  ref_cil_od: string;
  ref_eje_od: string;
  ref_add_od: string;
  ref_avccl_od: string;
  ref_avccc_od: string;
  ref_avccl_bi: string;
  ref_avccc_bi: string;
  ref_esf_oi: string;
  ref_cil_oi: string;
  ref_eje_oi: string;
  ref_add_oi: string;
  ref_avccl_oi: string;
  ref_avccc_oi: string;

  // Refracción Final
  ref_final_esf_od: string;
  ref_final_cil_od: string;
  ref_final_eje_od: string;
  ref_final_add_od: string;
  ref_final_alt_od: string;
  ref_final_dp_od: string;
  ref_final_esf_oi: string;
  ref_final_cil_oi: string;
  ref_final_eje_oi: string;
  ref_final_add_oi: string;
  ref_final_alt_oi: string;
  ref_final_dp_oi: string;

  // AVSC - AVAE - OTROS
  avsc_od: string;
  avae_od: string;
  otros_od?: string;
  avsc_oi: string;
  avae_oi: string;
  otros_oi?: string;
  avsc_bi: string;
}

// Interfaz para diagnóstico y tratamiento
export interface DiagnosticoTratamiento {
  diagnostico?: string;
  tratamiento?: string;
}

// Interfaz para recomendaciones
export interface Recomendaciones {
  cristal: TipoCristal | TipoCristal[];
  material: TipoMaterial;
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
  fechaCreacion: Date;
  fechaActualizacion?: Date;
  creadoPor: string;
  actualizadoPor?: string;
}

// Interfaz principal que extiende todas las parciales
export interface HistoriaMedica extends
  HistoriaMedicaBase,
  DatosConsulta,
  Antecedentes,
  ExamenOcular,
  DiagnosticoTratamiento,
  Recomendaciones,
  Conformidad,
  Auditoria { }

// Interfaz para vista completa
export interface HistoriaMedicaCompleta {
  historia: HistoriaMedica;
  paciente: Paciente;
}

// Tipos específicos
export type TipoGenero = '' | 'Masculino' | 'Femenino' | 'Otro';
export type TipoCristal = 'VISIÓN SENCILLA (CR-39)' | 'AR Básico' | 'AR Blue Filter' |
  'Fotocromático' | 'Polarizado' | 'Coloración' | 'Bifocal' |
  'Progresivo (CR39 First)' | 'Progresivo (Digital)';
export type TipoMaterial = 'CR-39' | 'Policarbonato' | 'Trivex' | 'Alto Índice' | 'Vidrio Mineral';