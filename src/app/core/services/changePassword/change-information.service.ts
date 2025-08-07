import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { SwalService } from '../swal/swal.service';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { User, Rol, AuthData, AuthResponse, Cargo } from '../../../Interfaces/models-interface';
import { Sede } from './../../../view/login/login-interface';
import { UserProfile, ApiUser } from '../../../view/my-account/my-account-interface';
import { of } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class ChangeInformationService {
  private userProfile = new BehaviorSubject<any>(null);
  currentUserProfile = this.userProfile.asObservable();

  constructor(
    private router: Router,
    private swalService: SwalService,
    private authService: AuthService,
    private http: HttpClient
  ) { }

  // Editar perfil de usuario
  editUser(userData: Partial<User>): Observable<AuthResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    return this.http.post<AuthResponse>(
      `${environment.apiUrl}/account/edit-profile`,
      userData,
      { headers }
    ).pipe(
      map(response => {
        const isFullResponse = (res: any): res is AuthResponse => res.user !== undefined && res.token !== undefined;

        if (isFullResponse(response)) {
          const authData: AuthData = {
            token: response.token || this.authService.getToken() || '',
            user: { ...response.user, email: response.user.correo },
            rol: response.rol || this.authService.currentUserValue?.rol as Rol,
            cargo: response.cargo || this.authService.currentUserValue?.cargo as Cargo,
            sede: response.sede || this.authService.currentUserValue?.sede as Sede // 👈 aquí está la solución
          };
          this.authService.setAuth(authData);
        }

        return response;
      }),
      catchError(error => {
        console.error('Error in editUser:', error);
        return throwError(() => error);
      })
    );
  }

  getUsuarioPorCedula(cedula: string): Observable<ApiUser | null> {
    return this.http.get<{ message: string; usuarios: ApiUser[] }>(`${environment.apiUrl}/get-usuarios/${cedula}`).pipe(
      map(response => {
        if (!response || !Array.isArray(response.usuarios) || response.usuarios.length === 0) {
          return null;
        }
        return response.usuarios[0];
      }),
      catchError(error => {
        console.error('Error al obtener usuario por cédula:', error);
        return of(null);
      })
    );
  }


  // Enviar OTP para cambio de contraseña única
  sendUniquePasswordOtp(email: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/account/send-unique-password-otp`, { email }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error al enviar OTP para contraseña única:', error);
        return throwError(() => error);
      })
    );
  }

  // Guardar la contraseña única tras la validación del OTP
  changeUniquePassword(email: string, uniquePassword: string, otp: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/account/change-unique-password`, {
      email,
      uniquePassword,
      otp
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error al cambiar la contraseña única:', error);
        return throwError(() => error);
      })
    );
  }

  // Carga de imagen de perfil
  uploadProfileImage(formData: FormData): Observable<{ message: string, image_url: string }> {
    return this.http.post<{ message: string, image_url: string }>(
      `${environment.apiUrl}/account/upload-profile-image`,
      formData
    );
  }

  // Métodos para cambio de contraseña de acceso
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
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error al cambiar la contraseña:', error);
        return throwError(() => error);
      })
    );
  }
}
