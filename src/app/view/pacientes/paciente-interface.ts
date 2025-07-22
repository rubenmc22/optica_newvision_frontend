export interface RedSocial {
  platform: string;
  username: string;
}

export interface Paciente {
     // Datos personales
  id: string;
  nombreCompleto: string;
  cedula: string;
  telefono: string;
  email: string;
  fechaNacimiento: string;
  edad: number;
  ocupacion: string;
  genero: '' | 'Masculino' | 'Femenino' | 'Otro';
  direccion: string;
  fechaRegistro: string;
  redesSociales: RedSocial[];

  //Sede
   sede: string;

   // Historia clínica
  usuarioLentes?: boolean;
  tipoCristalActual?: string;
  ultimaGraduacion?: string;
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