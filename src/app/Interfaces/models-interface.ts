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
  estado: boolean; // ✅ Ahora es un booleano
}



export interface ApiResponse {
  message: string;
  empleados: Empleado[];
}

export interface TycCheck {
  hasAcceptedTyC: boolean | number;
}

