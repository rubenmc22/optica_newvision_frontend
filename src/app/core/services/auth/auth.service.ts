import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { SwalService } from '../swal/swal.service';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { User, Rol, AuthData, AuthResponse, Cargo } from '../../../Interfaces/models-interface';
import { Sede } from './../../../view/login/login-interface';
import { UserStateService } from './../userState/user-state-service';


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
    private http: HttpClient,
    private userState: UserStateService
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
  getCurrentCargo(): Cargo | null {
    return this.currentUserValue?.cargo || null;
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

  login(cedula: string, password: string, sede: string): Observable<AuthData> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, { cedula, password, sede }).pipe(
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
          rol: data.rol,
          cargo: data.cargo,
          sede: data.sede 
        };

        return authData;
      }),
      tap((authData: AuthData) => {
        this.setAuth(authData);
        //console.log('authData', authData);
      }),
      catchError((error: HttpErrorResponse) => {
        const errorMsg = error.error?.message || 'Error en el inicio de sesión';
        console.error('Error en login:', errorMsg);
        this.swalService.showError('Error', errorMsg);
        return throwError(() => error);
      })
    );
  }

  getSedes(): Observable<{ sedes: Sede[] }> {
    return this.http.get<{ sedes: Sede[] }>(`${environment.apiUrl}/sedes-get`);
  }


  hasAcceptedTyC(): boolean {
    return this.currentUserValue?.user?.tyc_aceptado === 1;
  }
  private getNormalizedTycValue(): boolean {
    const tycValue = this.currentUserValue?.user?.tyc_aceptado;

    if (tycValue === undefined || tycValue === null) {
      return false;
    }

    return typeof tycValue === 'number'
      ? tycValue === 1
      : tycValue;
  }

  // Nuevo método para actualizar la aceptación de TyC
  acceptTermsAndConditions(): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/accept-tyc`, { acceptedTerms: true }).pipe(
      tap(() => {
        const currentData = this.currentUserValue;
        if (currentData) {
          const updatedData = {
            ...currentData,
            user: {
              ...currentData.user,
              tyc_aceptado: 1
            }
          };
          this.setAuth(updatedData);
        }
      })
    );
  }

  refreshUserInfo(): Observable<User> {
    return this.http.get<User>(`${environment.apiUrl}/auth/user-info`).pipe(
      tap(user => {
        const currentData = this.currentUserValue;
        if (currentData) {
          this.setAuth({
            ...currentData,
            user: {
              ...currentData.user,
              ...user
            }
          });
        }
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

  // Solo añadiremos este nuevo método
  refreshUserData(updatedData: Partial<User>): void {
    const currentAuthData = this.currentUserValue;
    if (!currentAuthData) return;

    const updatedUser = { ...currentAuthData.user, ...updatedData };
    const newAuthData = { ...currentAuthData, user: updatedUser };

    this.storage.setItem(this.AUTH_DATA_KEY, JSON.stringify(newAuthData));
    this.currentUserSubject.next(newAuthData);
    this.userState.updateUser(updatedData);
  }

  updateProfileImage(imageUrl: string): void {
    this.refreshUserData({ ruta_imagen: imageUrl });
  }

}