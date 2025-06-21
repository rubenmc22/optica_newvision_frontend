import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Lista de endpoints públicos que no requieren token
  const PUBLIC_ENDPOINTS = [
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/public/',
    '/assets/'
  ];

  // Verifica si la solicitud es a un endpoint público
  const isPublicRequest = PUBLIC_ENDPOINTS.some(endpoint =>
    req.url.includes(endpoint)
  );

  if (isPublicRequest) {
    return next(req);
  }

  const token = authService.getToken();

  if (!token) {
    authService.logout();
    router.navigate(['/login'], {
      queryParams: { sessionExpired: true },
      replaceUrl: true
    });
    return throwError(() => new Error('Authentication required'));
  }

  // Clonar la solicitud con el token
  let authReq = req.clone();

  // Solo añadir Content-Type para JSON, no para FormData
  if (!(req.body instanceof FormData)) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: req.body // ✅ Asegura que `req.body` se conserve
    });
  } else {
    // Para FormData, solo añadir el token
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('[Interceptor] Error en la solicitud:', error);

      if (error.status === 401) {
        authService.logout();
        router.navigate(['/login'], {
          replaceUrl: true,
          queryParams: { sessionExpired: true }
        });
      }

      return throwError(() => error);
    })
  );
};