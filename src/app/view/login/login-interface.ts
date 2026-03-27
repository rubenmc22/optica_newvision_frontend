// Para el login (solo lo necesario para autenticación)
export interface SedeLogin {
  key: string;
  nombre: string;
}

// Para la información completa de la sede (después del login)
export interface SedeCompleta extends SedeLogin {
  nombre_optica?: string;
  rif?: string;
  direccion: string;
  direccion_fiscal?: string | null;
  telefono: string;
  email: string;
}

// Mantén Sede como alias de SedeCompleta para compatibilidad
export type Sede = SedeCompleta;