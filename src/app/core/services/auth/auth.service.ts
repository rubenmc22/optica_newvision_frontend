import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { SwalService } from '../swal/swal.service';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from '../environment';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { User, Rol, AuthData, AuthResponse } from '../../../Interfaces/models-interface';


@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'authToken';
  private readonly AUTH_DATA_KEY = 'authData';
  private storage: Storage = sessionStorage;
  private currentUserSubject = new BehaviorSubject<AuthData | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private router: Router,
    private swalService: SwalService,
    private http: HttpClient
  ) {
    // Initialize with stored data
    const storedData = this.storage.getItem(this.AUTH_DATA_KEY);
    if (storedData) {
      this.currentUserSubject.next(JSON.parse(storedData));
    }
  }

  setStorageType(useSessionStorage: boolean): void {
    this.storage = useSessionStorage ? sessionStorage : localStorage;
  }

  clearAuth(): void {
    this.storage.removeItem(this.TOKEN_KEY);
    this.storage.removeItem(this.AUTH_DATA_KEY);
    this.currentUserSubject.next(null);
  }

  get currentUserValue(): AuthData | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    return this.storage.getItem(this.TOKEN_KEY);
  }

  getCurrentUser(): User | null {
    return this.currentUserValue?.user || null;
  }

  getCurrentUserEmail(): string | null {
    return this.currentUserValue?.user.email || null;
  }

  getCurrentRol(): Rol | null {
    return this.currentUserValue?.rol || null;
  }

  updateUserData(updatedUser: Partial<User>): void {
    const currentData = this.currentUserValue;
    if (!currentData) return;

    const newData = {
      ...currentData,
      user: {
        ...currentData.user,
        ...updatedUser
      }
    };

    this.storage.setItem(this.AUTH_DATA_KEY, JSON.stringify(newData));
    this.currentUserSubject.next(newData);
  }

  login(cedula: string, password: string): Observable<AuthData> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, { cedula, password }).pipe(
      map((data: AuthResponse) => {
        if (!data.user?.correo) {
          throw new Error('El servidor no devolvió un correo de usuario');
        }

        const authData: AuthData = {
          token: data.token,
          user: {
            ...data.user,
            email: data.user.correo
          },
          rol: data.rol
        };

        return authData;
      }),
      tap((authData: AuthData) => {
        this.setAuth(authData);
        this.swalService.showSuccess('¡Éxito!', 'Bienvenido, ha iniciado sesión correctamente');
      }),
      catchError((error: HttpErrorResponse) => {
        const errorMsg = error.error?.message || 'Error en el inicio de sesión';
        console.error('Error en login:', errorMsg);
        this.swalService.showError('Error', errorMsg);
        return throwError(() => error);
      })
    );
  }

  public setAuth(authData: AuthData): void {
    this.storage.setItem(this.TOKEN_KEY, authData.token);
    this.storage.setItem(this.AUTH_DATA_KEY, JSON.stringify(authData));
    this.currentUserSubject.next(authData);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isExpired = payload.exp <= Date.now() / 1000;

      if (isExpired) {
        this.clearAuth();
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error al verificar token:', error);
      return false;
    }
  }

  logout(): void {
    this.clearAuth();
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  // Métodos para gestión de avatar y perfil
  uploadAvatar(formData: FormData): Observable<any> {
    return this.http.post(`${environment.apiUrl}/upload-avatar`, formData);
  }

}