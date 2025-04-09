import { NgModule, inject } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UserRegisterComponent } from './view/user-register/user-register.component';
import { LoginComponent } from './view/login/login.component';
import { ForgotPasswordComponent } from './view/forgot-password/forgot-password.component';
import { DashboardComponent } from './view/dashboard/dashboard.component';
import { MyAccountComponent } from './view/my-account/my-account.component';
import { PostloginTemplateComponent } from './view/postlogin-template/postlogin-template.component';
import { FichaTecnicaComponent } from './view/ficha-tecnica/ficha-tecnica.component';
import { VerAtletasComponent } from './view/ver-atletas/ver-atletas.component';
import { CrearAtletasComponent } from './view/crear-atletas/crear-atletas.component';
import { authGuard } from './core/services/auth/auth.guard';
import { AuthService } from './core/services/auth/auth.service';
import { AcceptTycComponent } from './view/accept-tyc-component/accept-tyc-component.component';

// Función para limpiar sesión al acceder a rutas públicas
const clearAuthSession = () => {
  const authService = inject(AuthService);
  authService.clearAuth();
  return true;
};

export const appRoutes: Routes = [
  // Rutas públicas (con limpieza de sesión)
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [clearAuthSession],
    title: 'Inicio de sesión'
  },
  {
    path: 'register',
    component: UserRegisterComponent,
    canActivate: [clearAuthSession],
    title: 'Registro de usuario'
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent,
    canActivate: [clearAuthSession],
    title: 'Recuperar contraseña'
  },

  // Redirección de ruta raíz
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Área protegida
  {
    path: '',
    component: PostloginTemplateComponent,
    canActivate: [authGuard], // Protección global para rutas hijas
    children: [
      { 
        path: 'accept-tyc', 
        component: AcceptTycComponent,
        title: 'Aceptar Términos y Condiciones'
      },
      { path: 'dashboard', component: DashboardComponent, title: 'Dashboard' },
      { path: 'my-account', component: MyAccountComponent, title: 'Mi cuenta' },
      { path: 'ficha-tecnica', component: FichaTecnicaComponent, title: 'Ficha técnica' },
      { path: 'ver-atletas', component: VerAtletasComponent, title: 'Ver atletas' },
      { path: 'crear-atletas', component: CrearAtletasComponent, title: 'Crear atleta' },

      // Redirección dentro del área protegida
      { path: '', redirectTo: 'dashboard', pathMatch: 'prefix' }
    ]
  },

  // Ruta comodín (404)
  { path: '**', redirectTo: 'login', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(appRoutes, {
    onSameUrlNavigation: 'reload',
    bindToComponentInputs: true, // Habilita binding de parámetros a inputs
    scrollPositionRestoration: 'top', // Mejor experiencia de navegación
    anchorScrolling: 'enabled' // Permite scroll a anclas
  })],
  exports: [RouterModule]
})
export class AppRoutingModule { }