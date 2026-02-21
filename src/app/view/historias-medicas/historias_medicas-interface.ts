import { Paciente } from '../pacientes/paciente-interface';
import {
  OPCIONES_REF,
  OPCIONES_AV,
  OPCIONES_ANTECEDENTES_PERSONALES,
  OPCIONES_ANTECEDENTES_FAMILIARES,
  MOTIVOS_CONSULTA,
  TIPOS_CRISTALES,
  TIPOS_LENTES_CONTACTO,
  MATERIALES,
  TRATAMIENTOS_ADITIVOS
} from 'src/app/shared/constants/historias-medicas';

// Interfaz base para historia médica
export interface HistoriaMedicaBase {
  id: string;
  nHistoria?: string;
  fecha?: string;
  horaEvaluacion?: string;
  pacienteId: string;
}

export interface DatosConsulta {
  motivo: string[];
  otroMotivo?: string;

  medico: {
    nombre: string;
    cedula: string;
    cargo: string;
  };

  nombre_asesor?: string;
  cedula_asesor?: string;
  cedulaAsesor?: string;
  tipoCristalActual?: string;
  tipoLentesContacto?: string;
  fechaUltimaGraduacion?: string;

  facturacion?: {
    tipoProfesional: 'oftalmologo' | 'optometrista';
    realizoCompraLentes: boolean;
    montoTotal: number;
    pagoOptica: number;
    pagoMedico: number;
    metodoPago?: string;
    fechaPago?: string;
    estadoPago?: 'pendiente' | 'pagado' | 'anulado';
  };
}

// En historias_medicas-interface.ts
export interface FacturacionConsulta {
  tipoProfesional: 'oftalmologo' | 'optometrista';
  realizoCompraLentes: boolean;
  montoBase: number;
  montoTotal: number;
  pagoOptica: number;
  pagoMedico: number;
}

export interface Auditoria {
  fechaCreacion: Date | string;
  fechaActualizacion?: Date | string;
  creadoPor: {
    nombre: string;
    cedula: string;
    cargo: string;
  };
  actualizadoPor?: {
    nombre: string;
    cedula: string;
    cargo: string;
  };
}

export interface RespuestaCreacionHistoria {
  message: string;
  historial_medico: HistoriaMedica;
}

export interface Medico {
  id: number;
  nombre: string;
  cedula: string;
  cargoId: string;
  cargoNombre?: string;
  email?: string;
  telefono?: string;
  rolId?: string;
  rolNombre?: string;
  estatus?: boolean;
  fechaNacimiento?: string;
  avatarUrl?: string;
  created_at?: string;
  updated_at?: string;
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
  usoDispositivo?: string;
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
    avae_od: string;
    otros_od?: string;
    avae_oi: string;
    otros_oi?: string;
    avsc_lejos_od?: string;
    avsc_cerca_od?: string;
    avsc_lejos_oi?: string;
    avsc_cerca_oi?: string;
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
  cristal: typeof TIPOS_CRISTALES[0] | null;
  material: TipoMaterial | TipoMaterial[];
  tipoLentesContacto?: string;
  montura: string;
  cristalSugerido?: string;
  observaciones?: string;

  medidaHorizontal?: string;
  medidaVertical?: string;
  medidaDiagonal?: string;
  medidaPuente?: string;
  materialPersonalizado?: string;
}

// Interfaz para conformidad
export interface Conformidad {
  notaConformidad: string;
  firmaPaciente?: string;
  firmaMedico?: string;
  firmaAsesor?: string;
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
