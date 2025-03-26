import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('Interceptando request a:', req.url); // Debug 1

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
    console.log('[Interceptor] Ruta pública, omitiendo token:', req.url);
    return next(req);
  }

  const token = authService.getToken();
  console.log('Token obtenido:', token); // Debug 2
  
  if (!token) {
    console.error('[Interceptor] No hay token disponible para ruta protegida:', req.url);
    authService.logout();
    router.navigate(['/login'], { 
      queryParams: { sessionExpired: true },
      replaceUrl: true
    });
    return throwError(() => new Error('Authentication required'));
  }

  // Clonar la solicitud con el token
  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  console.log('[Interceptor] Token añadido a la solicitud:', req.url);
  
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