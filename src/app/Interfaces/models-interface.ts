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

export interface Atleta {
  _id: string;
  user_id: string;
  nombre: string;
  fecha_nacimiento: string;
  genero: 'M' | 'F';
  cedula?: string; // Opcional porque puede venir de representante
  altura?: number | null;
  peso?: number | null;
  nacionalidad?: string | null;
  deporte?: string | null; // Añadimos deporte como opcional
  posicion?: string | null; // Añadimos posición como opcional
  createdAt: string;
  updatedAt: string;
  __v: number;
  edad: number;
  generoTexto: string;
}

export interface ApiResponse {
  message: string;
  atletas: Atleta[];
}

export interface TycCheck {
  hasAcceptedTyC: boolean | number;
}

