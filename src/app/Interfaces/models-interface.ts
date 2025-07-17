//Modelos cambio de contrase;a


export interface Cargo {
  _id: string;
  key: string;
  name: string;
}

export interface User {
  id?: string;
  cedula?: string;
  correo?: string;
  nombre?: string;
  telefono?: string;
  email?: string;
  rol?: string;
  //cargo?: string;
  ruta_imagen?: string | null;
  tyc_aceptado?: boolean | number;
}

export interface Rol {
  _id: string;
  key: string;
  name: string;
}


export interface AuthData {
  token: string;
  user: User;
  rol: Rol;
  cargo: Cargo;
  message?: string; // Mensaje adicional, opcional
}

export interface AuthResponse {
  message: string;
  token: string;
  user: {
    id: string;
    cedula: string;
    correo: string;
    nombre: string;
    telefono: string;
  };
  rol: {
    _id: string;
    key: string;
    name: string;
  };
  cargo: {
    _id: string;
    key: string;
    name: string;
  };
}

export interface Empleado {
  id: string;
  cedula: string;
  nombre: string;
  email?: string;
  telefono?: string;
  rolId: string;
  cargoId: string;
  rolNombre: string;
  cargoNombre: string;
  estatus: boolean; // ✅ Ahora es un booleano
  loading?: boolean;
  fechaNacimiento: string;
  avatarUrl?: string; // 👈 Añadido para imagen de perfil
  editing: false;
  modified: false;
  hasErrors: false;
  errors: {};
  originalValues: null;
}

export interface ApiResponse {
  message: string;
  empleados: Empleado[];
}

export interface TycCheck {
  hasAcceptedTyC: boolean | number;
}

export interface Tasa {
  id: string;
  valor: number;
  updated_at: string;
  simbolo?: string;
  nombre?: string;
  metodo?: string;
  rastreo_bcv?: boolean;
}

export interface HistorialTasa {
  id: number;
  valor_nuevo: number;
  tipo_cambio: string;
  updated_at: string;
  usuario: {
    cedula: string;
    nombre: string;
  };
}

export interface RedSocial {
  platform: string;
  username: string;
}

export interface Paciente {
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
  sede: 'guatire' | 'guarenas';
}

// Tipos específicos para opciones predefinidas
export type TipoSede = 'guatire' | 'guarenas';



