// user-state.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { User, AuthData } from '../../../Interfaces/models-interface';

export interface SedeInfo {
  key: string;
  nombre: string;
  nombre_optica: string;
  rif: string;
  direccion: string;
  telefono: string;
  email: string;
  direccion_fiscal: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserStateService {
  private userSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.userSubject.asObservable();

  private sedesSubject = new BehaviorSubject<SedeInfo[]>([]);
  public sedes$ = this.sedesSubject.asObservable();

  private sedeActualSubject = new BehaviorSubject<SedeInfo | null>(null);
  public sedeActual$ = this.sedeActualSubject.asObservable();

  constructor() {
    this.loadInitialState();
  }

  private loadInitialState(): void {
    const userData = localStorage.getItem('currentUser');
    if (userData) {
      this.userSubject.next(JSON.parse(userData));
    }

    // Cargar sedes del localStorage si existen
    this.cargarSedesDesdeCache();
  }

  private cargarSedesDesdeCache(): void {
    const sedesData = localStorage.getItem('sedesCache');
    if (sedesData) {
      try {
        const sedes = JSON.parse(sedesData);
        // Asegurar que los RIFs estén limpios
        const sedesConRifLimpio = sedes.map((s: SedeInfo) => ({
          ...s,
          rif: this.limpiarRif(s.rif || '')
        }));

        this.sedesSubject.next(sedesConRifLimpio);

        // Intentar cargar la sede actual del usuario
        const user = this.userSubject.value;
        if (user?.sede) {
          const sedeActual = sedes.find((s: SedeInfo) => s.key === user.sede);
          if (sedeActual) {
            this.sedeActualSubject.next(sedeActual);
          }
        }
      } catch (error) {
        console.error('Error al parsear sedes del localStorage:', error);
      }
    }
  }

  updateUser(updatedData: Partial<User>): void {
    const currentUser = this.userSubject.value;
    if (currentUser) {
      const newUser = { ...currentUser, ...updatedData };
      localStorage.setItem('currentUser', JSON.stringify(newUser));
      this.userSubject.next(newUser);
    }
  }

  getCurrentUser(): User | null {
    return this.userSubject.value;
  }

  setUserFromAuth(authData: AuthData): void {
    const user: User = {
      ...authData.user,
      rol: authData.rol.name,
      cargo: authData.cargo.name,
      sede: authData.sede.key
    };

    // Guardar en localStorage para persistencia
    localStorage.setItem('currentUser', JSON.stringify(user));

    // Emitir al BehaviorSubject
    this.userSubject.next(user);
  }

  // ========== MÉTODOS PARA GESTIONAR SEDES ==========
  setSedes(sedes: SedeInfo[]): void {
    // Normalizar keys
    const sedesNormalizadas = sedes.map(s => ({
      ...s,
      key: s.key?.trim().toLowerCase() || '',
      nombre: s.nombre?.trim() || '',
      rif: this.limpiarRif(s.rif || '')
    }));

    // Guardar en localStorage para persistencia
    localStorage.setItem('sedesCache', JSON.stringify(sedesNormalizadas));

    // Actualizar BehaviorSubject
    this.sedesSubject.next(sedesNormalizadas);

    // Determinar sede actual basada en el usuario
    const userSedeKey = this.userSubject.value?.sede?.trim().toLowerCase();
    if (userSedeKey) {
      const sedeActual = sedesNormalizadas.find(s => s.key === userSedeKey);
      if (sedeActual) {
        this.sedeActualSubject.next(sedeActual);
      }
    }

    // Guardar timestamp
    localStorage.setItem('sedes_last_update', new Date().toISOString());
  }


  // Método para limpiar el RIF
  private limpiarRif(rif: string): string {
    if (!rif) return '';

    // Remover el prefijo "rif" (case insensitive)
    const rifLimpio = rif.replace(/^rif/i, '').trim();

    // Si después de limpiar está vacío, devolver el original
    return rifLimpio || rif;
  }


  /**
   * Obtiene la sede actual del usuario
   */
  getSedeActual(): SedeInfo | null {
    return this.sedeActualSubject.value;
  }

  /**
   * Obtiene todas las sedes
   */
  getSedes(): SedeInfo[] {
    return this.sedesSubject.value;
  }

  /**
   * Obtiene una sede específica por su key
   */
  getSedePorKey(key: string): SedeInfo | null {
    return this.sedesSubject.value.find(s => s.key === key) || null;
  }

  /**
   * Establece manualmente la sede actual (útil para testing)
   */
  setSedeActual(key: string): void {
    const sede = this.getSedePorKey(key);
    if (sede) {
      this.sedeActualSubject.next(sede);
    }
  }
}