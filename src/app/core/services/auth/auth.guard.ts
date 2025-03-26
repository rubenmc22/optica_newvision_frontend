import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Limpiar antes de redirigir
  authService.clearAuth();
  router.navigate(['/login'], { 
    replaceUrl: true,
    queryParams: { redirect: state.url }
  });
  return false;
};