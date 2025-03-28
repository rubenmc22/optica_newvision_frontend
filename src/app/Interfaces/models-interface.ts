//Modelos cambio de contrase;a

export interface User {
    id: string;
    cedula: string;
    correo: string;
    nombre: string;
    telefono: string;
    email: string;
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
  }