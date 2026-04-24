
// ============================================================
// Interfaces para tipado de datos
// ============================================================
export interface UserProfile {
  nombre: string;
  cedula: string;
  cargo: string;
  correo: string;
  fecha_nacimiento: string | null;
  telefono: string;
  avatarUrl?: string | null;
  rol: string;
  ruta_imagen?: string | null;
}

export interface ApiUser {
  id: number;
  cedula: string;
  nombre: string;
  correo: string;
  telefono: string;
  fecha_nacimiento: string | null;
  ruta_imagen: string | null;
  avatar_url: string | null;
  rol: {
    id: string;
    nombre: string;
  };
  cargo: {
    id: string;
    nombre: string;
  };
}
