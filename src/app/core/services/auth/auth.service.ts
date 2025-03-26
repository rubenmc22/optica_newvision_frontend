import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { SwalService } from '../swal/swal.service';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../environment';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

interface User {
  email: string;
  cedula: string;
  nombre?: string;
  [key: string]: any; // Para propiedades adicionales
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'authToken';
  private readonly USER_KEY = 'userData';
  private storage: Storage = sessionStorage; // Por defecto sessionStorage

  constructor(
    private router: Router,
    private swalService: SwalService,
    private http: HttpClient
  ) { }

  /**
   * Configura el tipo de almacenamiento a usar
   * @param useSessionStorage true para sessionStorage, false para localStorage
   */
  setStorageType(useSessionStorage: boolean): void {
    this.storage = useSessionStorage ? sessionStorage : localStorage;
    console.log(`Almacenamiento configurado a: ${useSessionStorage ? 'sessionStorage' : 'localStorage'}`);
  }

  /**
   * Limpia toda la información de autenticación
   */
  clearAuth(): void {
    this.storage.removeItem(this.TOKEN_KEY);
    this.storage.removeItem(this.USER_KEY);
    console.log('Datos de autenticación limpiados');
  }

  /**
   * Obtiene los datos del usuario actual
   */
  get currentUserValue(): User | null {
    const userData = this.storage.getItem(this.USER_KEY);
    if (!userData) {
      console.warn('No se encontraron datos de usuario en el almacenamiento');
      return null;
    }

    try {
      const user = JSON.parse(userData) as User;
      if (!user.email) {
        console.error('El objeto de usuario no contiene email:', user);
      }
      return user;
    } catch (error) {
      console.error('Error al parsear datos de usuario:', error);
      return null;
    }
  }

  /**
   * Obtiene el usuario actual (alias de currentUserValue)
   */
  getCurrentUser(): User | null {
    return this.currentUserValue;
  }

  /**
   * Obtiene el email del usuario actual
   */
  getCurrentUserEmail(): string | null {
    const user = this.currentUserValue;
    if (!user) {
      console.warn('Intento de obtener email sin usuario autenticado');
      return null;
    }
    return user.email;
  }

  /**
   * Actualiza los datos del usuario en el almacenamiento
   * @param userData Datos del usuario a actualizar
   */
  updateUserData(userData: User): void {
    if (!userData || !userData.email) {
      console.error('Datos de usuario inválidos para actualización:', userData);
      return;
    }

    this.storage.setItem(this.USER_KEY, JSON.stringify(userData));
    console.log('Datos de usuario actualizados:', userData);
  }

  /**
   * Proceso de login
   * @param cedula Número de cédula
   * @param password Contraseña
   */
  login(cedula: string, password: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/login`, { cedula, password }).pipe(
      tap((data: any) => {
        if (!data.user?.correo) {
          throw new Error('El servidor no devolvió un correo de usuario');
        }

        const internalUser: User = {
          ...data.user,
          email: data.user.correo
        };

        this.setAuth(data.token, internalUser);
        this.swalService.showSuccess('¡Éxito!', 'Bienvenido, ha iniciado sesión correctamente');
      }),
      catchError((error: HttpErrorResponse) => {
        const errorMsg = error.error?.message || 'Error en el inicio de sesión';
        console.log('ERROR', errorMsg);
        this.swalService.showError('Error', errorMsg);
        return throwError(() => error);
      })
    );
  }

  // auth.service.ts

  sendPasswordChangeOtp(email: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/account/change-password--send-otp`, { email });
  }

  verifyPasswordChangeOtp(otp: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/account/change-password--verify-otp`, { otp });
  }

  changePassword(email: string, newPassword: string, otp: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/account/change-password--change-password`, {
      email,
      newPassword,
      otp
    });
  }

  /**
   * Establece los datos de autenticación
   * @param token Token JWT
   * @param user Datos del usuario
   */
  private setAuth(token: string, user: User): void {
    if (!token || !user?.email) {
      console.error('Datos inválidos para setAuth:', { token, user });
      throw new Error('Datos de autenticación inválidos');
    }

    this.storage.setItem(this.TOKEN_KEY, token);
    this.storage.setItem(this.USER_KEY, JSON.stringify(user));
    console.log('Autenticación establecida para usuario:', user.email);
  }

  /**
   * Obtiene el token almacenado
   */
  getToken(): string | null {
    // console.warn('Dentro de getToken');
    const token = this.storage.getItem(this.TOKEN_KEY);
    if (!token) {
      console.warn('No se encontró token en el almacenamiento');
    }
    return token;
  }

  /**
   * Verifica si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isExpired = payload.exp <= Date.now() / 1000;

      if (isExpired) {
        console.warn('Token JWT expirado');
        this.clearAuth();
      }

      return !isExpired;
    } catch (error) {
      console.error('Error al verificar token:', error);
      return false;
    }
  }

  /**
   * Cierra la sesión y redirige al login
   */
  logout(): void {
    console.log('Cerrando sesión para usuario:', this.currentUserValue?.email);
    this.clearAuth();
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}