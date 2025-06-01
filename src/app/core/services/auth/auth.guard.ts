import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { Observable, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators'; // Importa los operadores necesarios

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 1. Verificar autenticación primero
  if (!authService.isAuthenticated()) {
    authService.clearAuth();
    return router.createUrlTree(['/login'], {
      queryParams: { redirect: state.url }
    });
  }

  // 2. Obtener valor ACTUAL de tyc_aceptado (no cached)
  const tycAceptado = authService.currentUserValue?.user?.tyc_aceptado;

  // 3. Si está intentando acceder a /accept-tyc, PERMITIR siempre
  if (state.url.includes('/accept-tyc')) {
    return true;
  }

  // 4. Bloquear acceso si no ha aceptado TyC (0 o undefined)
  if (tycAceptado !== 1) {
    // Forzar recarga de datos del usuario desde el backend
    return authService.refreshUserInfo().pipe(
      switchMap(() => {
        const refreshedTyc = authService.currentUserValue?.user?.tyc_aceptado;
        return refreshedTyc === 1
          ? of(true)
          : of(router.createUrlTree(['/accept-tyc'], {
            queryParams: { redirect: state.url }
          }));
      }),
      catchError(() => of(router.createUrlTree(['/login'])))
    );
  }

  return true;
};