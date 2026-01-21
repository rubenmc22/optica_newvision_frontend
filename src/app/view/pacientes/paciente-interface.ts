export interface RedSocial {
  platform: string;
  username: string;
}

export interface PacientesListState {
  scrollPosition: number;
  filtroActual: string;
  desdePacientes: boolean;
}


export interface Paciente {
  // Datos personales
  id: string,
  key: string;
  fechaRegistro?: string;
  fechaRegistroRaw?: string;
  informacionPersonal: {
    nombreCompleto: string;
    cedula: string;
    telefono: string;
    email: string;
    edad: number | string;
    fechaNacimiento: string;
    ocupacion: string;
    genero: string;
    direccion: string;
    esMenorSinCedula: boolean;
  };

  //Sede
  sede: string;

  redesSociales?: { platform: string; username: string }[];

  informacionEmpresa?: {
    referidoEmpresa: boolean;
    empresaNombre: string;
    empresaRif: string;
    empresaTelefono: string;
    empresaDireccion: string;
    empresaCorreo?: string;
  } | null;

  historiaClinica?: {
    usuarioLentes?: string | null;
    tipoCristalActual?: string;
    ultimaGraduacion?: string;
    fotofobia?: string | null;
    traumatismoOcular?: string | null;
    traumatismoOcularDescripcion?: string | null;
    usoDispositivo?: string;
    cirugiaOcular?: string | null;
    cirugiaOcularDescripcion?: string | null;
    alergicoA?: string | null;
    antecedentesPersonales?: string[] | null;
    antecedentesFamiliares?: string[] | null;
    patologias?: string[] | null;
    patologiaOcular?: string[] | null;
  };
}

export interface PacienteGrafico {
  key: string;
  nombre: string;
  cedula: string;
  sede: string;
  created_at: string;
}

export interface Empresa {
  id?: number;
  rif: string;
  razon_social?: string;
  nombre_comercial?: string;
  telefono?: string;
  direccion?: string;
  email?: string;
}
