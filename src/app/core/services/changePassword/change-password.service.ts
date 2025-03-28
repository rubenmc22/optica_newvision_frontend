import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { SwalService } from '../swal/swal.service';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from '../environment';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { AuthService } from '../../services/auth/auth.service';
import { User, Rol, AuthData, AuthResponse } from '../../../Interfaces/models-interface';




@Injectable({
  providedIn: 'root'
})
export class ChangePasswordService {

  constructor(
    private router: Router,
    private swalService: SwalService,
    private authService: AuthService,
    private http: HttpClient
  ) { }



  // Cambiar el return type y manejar ambos casos
  editUser(userData: Partial<User>): Observable<AuthResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    return this.http.post<AuthResponse>(
      `${environment.apiUrl}/account/edit-profile`,
      userData,
      { headers }
    ).pipe(
      map(response => {
        // Type guard para verificar si es la respuesta completa
        const isFullResponse = (res: any): res is AuthResponse => {
          return res.user !== undefined && res.token !== undefined;
        };

        if (isFullResponse(response)) {
          const authData: AuthData = {
            token: response.token || this.authService.getToken() || '',
            user: {
              ...response.user,
              email: response.user.correo
            },
            rol: response.rol || this.authService.currentUserValue?.rol as Rol
          };
          this.authService.setAuth(authData);
        }

        return response; // Devuelve la respuesta original
      }),
      catchError(error => {
        console.error('Error in editUser:', error);
        return throwError(() => error);
      })
    );
  }

  // Métodos para cambio de contraseña
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
}
