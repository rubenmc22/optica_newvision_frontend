import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgChartsModule } from 'ng2-charts';
import { GraficoComparativaSedesComponent } from './dashboard/graficos/grafico-comparativa-sedes/grafico-comparativa-sedes.component';
import { GraficoTotalSedeComponent } from './dashboard/graficos/grafico-total-sede/grafico-total-sede.component';
import { GraficoPacientesPorMesComponent } from './dashboard/graficos/grafico-pacientes-por-mes/grafico-pacientes-por-mes.component';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

// Componentes
import { AppComponent } from '../app.component';
import { UserRegisterComponent } from './user-register/user-register.component';
import { LoginComponent } from './login/login.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { PostloginTemplateComponent } from './postlogin-template/postlogin-template.component';
import { MyAccountComponent } from './my-account/my-account.component';
import { EmpleadosComponent } from './empleados/empleados.component';
import { AcceptTycComponent } from './accept-tyc-component/accept-tyc-component.component';
import { DynamicModalComponent } from './../shared/dynamic-modal/dynamic-modal.component';
import { TasaComponent } from './tasa-cambiaria/tasa.component';
import { VerPacientesComponent } from './pacientes/pacientes.component';
import { HistoriasMedicasComponent } from './historias-medicas/historias-medicas.component';
import { ProductosListComponent } from './productos/productos-list/productos-list.component';
import { GenerarVentaComponent } from './ventas/generar-venta/generar-venta.component';
import { VentasDashboardComponent } from './ventas/ventas-dashboard.component';
import { HistorialVentasComponent } from './ventas/historial-ventas/historial-ventas.component';
import { PresupuestoComponent } from './ventas/presupuesto/presupuesto.component';
import { CierreCajaComponent } from './ventas/cierre-caja/cierre-caja.component';
import { SafeUrlPipe } from './ventas/generar-venta/safe-url.pipe';
import { LoaderComponent } from './../shared/loader/loader.component';
import { SystemConfigComponent } from './system-config/system-config.component';



// Módulos y servicios
import { MaterialModule } from '../material.module';
import { appRoutes } from '../app.routes';
import { authInterceptor } from '../core/interceptors/auth.interceptor';
import { ClickOutsideDirective } from '../directives/click-outside.directive';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';

@NgModule({
  declarations: [
    AppComponent,
    UserRegisterComponent,
    LoginComponent,
    ForgotPasswordComponent,
    SidebarComponent,
    DashboardComponent,
    PostloginTemplateComponent,
    MyAccountComponent,
    EmpleadosComponent,
    AcceptTycComponent,
    DynamicModalComponent,
    TasaComponent,
    VerPacientesComponent,
    HistoriasMedicasComponent,
    ClickOutsideDirective,
    GraficoComparativaSedesComponent,
    GraficoTotalSedeComponent,
    GraficoPacientesPorMesComponent,
    ProductosListComponent,
    LoaderComponent,
    GenerarVentaComponent,
    HistorialVentasComponent,
    VentasDashboardComponent,
    PresupuestoComponent,
    CierreCajaComponent,

    SystemConfigComponent
  ],
  imports: [
    NgChartsModule,
    NgSelectModule,
    BrowserModule,
    ReactiveFormsModule,
    MaterialModule,
    FormsModule,
    ScrollingModule,
    BrowserAnimationsModule,
    NgbTooltipModule,
    NgxSkeletonLoaderModule,
    SafeUrlPipe,
    NgbDropdownModule,

    RouterModule.forRoot(appRoutes, {
      onSameUrlNavigation: 'reload',
      bindToComponentInputs: true
    })
  ],
  exports: [
    DynamicModalComponent

  ],
  providers: [
    provideHttpClient(
      withInterceptors([authInterceptor])
    )
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule { }