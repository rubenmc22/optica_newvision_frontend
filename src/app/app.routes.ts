import { NgModule, inject } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UserRegisterComponent } from './view/user-register/user-register.component';
import { LoginComponent } from './view/login/login.component';
import { ForgotPasswordComponent } from './view/forgot-password/forgot-password.component';
import { DashboardComponent } from './view/dashboard/dashboard.component';
import { MyAccountComponent } from './view/my-account/my-account.component';
import { PostloginTemplateComponent } from './view/postlogin-template/postlogin-template.component';
import { EmpleadosComponent } from './view/empleados/empleados.component';
import { CrearAtletasComponent } from './view/crear-atletas/crear-atletas.component';
import { authGuard } from './core/services/auth/auth.guard';
import { AuthService } from './core/services/auth/auth.service';
import { AcceptTycComponent } from './view/accept-tyc-component/accept-tyc-component.component';
import { Title } from '@angular/platform-browser';
import { TasaComponent } from './view/tasa-cambiaria/tasa.component';
import { VerPacientesComponent } from './view/pacientes/ver-pacientes/ver-pacientes.component';
import { HistoriasMedicasComponent } from './view/pacientes/historias-medicas/historias-medicas.component';

// Nombre de la óptica (constante global)
const OPTICA_NAME = 'Óptica New Vision';

// Función para limpiar sesión al acceder a rutas públicas
const clearAuthSession = () => {
  const authService = inject(AuthService);
  authService.clearAuth();
  return true;
};

// Función para generar el título completo
const getFullTitle = (pageTitle: string) => `${OPTICA_NAME} - ${pageTitle}`;

export const appRoutes: Routes = [
  // Rutas públicas (con limpieza de sesión)
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [clearAuthSession],
    title: getFullTitle('Inicio de sesión')
  },
  {
    path: 'register',
    component: UserRegisterComponent,
    canActivate: [clearAuthSession],
    title: getFullTitle('Registro de usuario')
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent,
    canActivate: [clearAuthSession],
    title: getFullTitle('Recuperar contraseña')
  },

  // Redirección de ruta raíz
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Área protegida
  {
    path: '',
    component: PostloginTemplateComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'accept-tyc',
        component: AcceptTycComponent,
        title: getFullTitle('Aceptar Términos y Condiciones')
      },
      {
        path: 'dashboard',
        component: DashboardComponent,
        title: getFullTitle('Dashboard')
      },
      {
        path: 'my-account',
        component: MyAccountComponent,
        title: getFullTitle('Mi cuenta')
      },
      {
        path: 'usuarios-empleados',
        component: EmpleadosComponent,
        title: getFullTitle('Empleados')
      },
      {
        path: 'Tipo-de-cambio',
        component: TasaComponent,
        title: getFullTitle('Tipo-de-cambio')
      },
      {
        path: 'pacientes',
        component: VerPacientesComponent,
        title: getFullTitle('pacientes')
      },
      {
        path: 'pacientes-historias',
        component: HistoriasMedicasComponent,
        title: getFullTitle('historias-medicas')
      },
      {
        path: 'pacientes-historias/:id',
        component: HistoriasMedicasComponent,
        title: getFullTitle('historias-medicas')
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'prefix' }
    ]
  },

  // Ruta comodín (404)
  { path: '**', redirectTo: 'login', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(appRoutes, {
    onSameUrlNavigation: 'reload',
    bindToComponentInputs: true,
    scrollPositionRestoration: 'top',
    anchorScrolling: 'enabled'
  })],
  exports: [RouterModule]
})
export class AppRoutingModule {
  constructor(private titleService: Title) {
    // Configura el título por defecto
    this.titleService.setTitle(OPTICA_NAME);
  }
}