import { NgModule, inject } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UserRegisterComponent } from './view/user-register/user-register.component';
import { LoginComponent } from './view/login/login.component';
import { ForgotPasswordComponent } from './view/forgot-password/forgot-password.component';
import { DashboardComponent } from './view/dashboard/dashboard.component';
import { MyAccountComponent } from './view/my-account/my-account.component';
import { PostloginTemplateComponent } from './view/postlogin-template/postlogin-template.component';
import { EmpleadosComponent } from './view/empleados/empleados.component';
import { authGuard } from './core/services/auth/auth.guard';
import { AuthService } from './core/services/auth/auth.service';
import { AcceptTycComponent } from './view/accept-tyc-component/accept-tyc-component.component';
import { Title } from '@angular/platform-browser';
import { TasaComponent } from './view/tasa-cambiaria/tasa.component';
import { VerPacientesComponent } from './view/pacientes/pacientes.component';
import { HistoriasMedicasComponent } from './view/historias-medicas/historias-medicas.component';
import { ProductosListComponent } from './view/productos/productos-list/productos-list.component';
import { ProductosEtiquetasComponent } from './view/productos/productos-etiquetas/productos-etiquetas.component';
import { VentasDashboardComponent } from './view/ventas/ventas-dashboard.component';
import { VentasShellComponent } from './view/ventas/ventas-shell.component';
import { RendimientoComercialComponent } from './view/ventas/rendimiento-comercial/rendimiento-comercial.component';
import { GenerarVentaComponent } from './view/ventas/generar-venta/generar-venta.component';
import { PresupuestoComponent } from './view/ventas/presupuesto/presupuesto.component';
import { HistorialVentasComponent } from './view/ventas/historial-ventas/historial-ventas.component';
import { CierreCajaComponent } from './view/ventas/cierre-caja/cierre-caja.component';
import { GenerarVentaPageComponent } from './view/ventas/generar-venta/page/generar-venta-page.component';
import { PresupuestoPageComponent } from './view/ventas/presupuesto/page/presupuesto-page.component';
import { HistorialVentasPageComponent } from './view/ventas/historial-ventas/page/historial-ventas-page.component';
import { CierreCajaPageComponent } from './view/ventas/cierre-caja/page/cierre-caja-page.component';
import { RendimientoComercialPageComponent } from './view/ventas/rendimiento-comercial/page/rendimiento-comercial-page.component';
import { SystemConfigComponent } from './view/system-config/system-config.component';
import { GestionOrdenesTrabajoComponent } from './view/gestion-ordenes-trabajo/gestion-ordenes-trabajo.component';
import { CierreCajaPdfPublicComponent } from './view/ventas/cierre-caja/cierre-caja-pdf-public.component';
import { PresupuestoPdfPublicComponent } from './view/ventas/presupuesto/presupuesto-pdf-public.component';

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
    path: 'PDF/cierre-caja',
    component: CierreCajaPdfPublicComponent,
    title: getFullTitle('PDF cierre de caja')
  },
  {
    path: 'PDF/presupuesto',
    component: PresupuestoPdfPublicComponent,
    title: getFullTitle('PDF presupuesto')
  },
  {
    path: 'pdf/cierre-caja',
    redirectTo: 'PDF/cierre-caja',
    pathMatch: 'full'
  },
  {
    path: 'pdf/presupuesto',
    redirectTo: 'PDF/presupuesto',
    pathMatch: 'full'
  },
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
        path: 'empleados',
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
        children: [
          { path: ':id', component: HistoriasMedicasComponent }
        ]
      },
      {
        path: 'productos-inventario',
        component: ProductosListComponent,
        title: getFullTitle('Catálogo de productos')
      },
      {
        path: 'productos-inventario/etiquetas',
        component: ProductosEtiquetasComponent,
        title: getFullTitle('Etiquetas de productos')
      },
      {
        path: 'ventas',
        component: VentasShellComponent,
        title: getFullTitle('Ventas'),
        children: [
          {
            path: '',
            redirectTo: 'generar',
            pathMatch: 'full'
          },
          {
            path: 'resumen',
            redirectTo: 'generar',
            pathMatch: 'full'
          },
          {
            path: 'generar',
            component: GenerarVentaPageComponent,
            title: getFullTitle('Generar Venta')
          },
          {
            path: 'presupuestos',
            component: PresupuestoPageComponent,
            title: getFullTitle('Presupuestos')
          },
          {
            path: 'presupuestos/nuevo',
            component: PresupuestoPageComponent,
            title: getFullTitle('Nuevo Presupuesto')
          },
          {
            path: 'presupuestos/:id',
            component: PresupuestoPageComponent,
            title: getFullTitle('Detalle de Presupuesto')
          },
          {
            path: 'historial',
            component: HistorialVentasPageComponent,
            title: getFullTitle('Historial de Ventas')
          },
          {
            path: 'cierres',
            component: CierreCajaPageComponent,
            title: getFullTitle('Cierre de Caja')
          },
          {
            path: 'cierres/:fecha',
            component: CierreCajaPageComponent,
            title: getFullTitle('Cierre de Caja')
          },
          {
            path: 'rendimiento',
            component: RendimientoComercialPageComponent,
            title: getFullTitle('Rendimiento Comercial')
          }
        ]
      },
      {
        path: 'ventas/rendimiento-comercial',
        redirectTo: 'ventas/rendimiento',
        pathMatch: 'full'
      },
      {
        path: 'configuracion-sistema',
        component: SystemConfigComponent,
        title: getFullTitle('Configuración del sistema')
      },
         {
        path: 'ordenes-de-trabajo',
        component: GestionOrdenesTrabajoComponent,
        title: getFullTitle('Ordenes de Trabajo')
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