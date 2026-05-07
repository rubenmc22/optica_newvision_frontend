import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { DragDropModule } from '@angular/cdk/drag-drop';

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
import { ProductosEtiquetasComponent } from './productos/productos-etiquetas/productos-etiquetas.component';
import { GenerarVentaComponent } from './ventas/generar-venta/generar-venta.component';
import { GenerarVentaPageComponent } from './ventas/generar-venta/page/generar-venta-page.component';
import { GenerarVentaHeaderComponent } from './ventas/generar-venta/components/generar-venta-header/generar-venta-header.component';
import { GenerarVentaOrigenBannerComponent } from './ventas/generar-venta/components/generar-venta-origen-banner/generar-venta-origen-banner.component';
import { GenerarVentaTipoSelectorComponent } from './ventas/generar-venta/components/generar-venta-tipo-selector/generar-venta-tipo-selector.component';
import { VentasDashboardComponent } from './ventas/ventas-dashboard.component';
import { VentasShellComponent } from './ventas/ventas-shell.component';
import { HistorialVentasComponent } from './ventas/historial-ventas/historial-ventas.component';
import { HistorialHeaderComponent } from './ventas/historial-ventas/components/historial-header/historial-header.component';
import { HistorialStatsGridComponent } from './ventas/historial-ventas/components/historial-stats-grid/historial-stats-grid.component';
import { HistorialVentasPageComponent } from './ventas/historial-ventas/page/historial-ventas-page.component';
import { CierreCajaComponent } from './ventas/cierre-caja/cierre-caja.component';
import { CierreHeaderComponent } from './ventas/cierre-caja/components/cierre-header/cierre-header.component';
import { CierreKpiGridComponent } from './ventas/cierre-caja/components/cierre-kpi-grid/cierre-kpi-grid.component';
import { CierreCajaPageComponent } from './ventas/cierre-caja/page/cierre-caja-page.component';
import { SafeUrlPipe } from './ventas/generar-venta/safe-url.pipe';
import { LoaderComponent } from './../shared/loader/loader.component';
import { SystemConfigComponent } from './system-config/system-config.component';
import { clientesComponent } from './clientes/clientes.component';
import { GestionOrdenesTrabajoComponent } from './gestion-ordenes-trabajo/gestion-ordenes-trabajo.component';
import { DetalleOrdenComponent } from './gestion-ordenes-trabajo/detalle-orden/detalle-orden.component';
import { PresupuestoComponent } from './ventas/presupuesto/presupuesto.component';
import { PresupuestoHeaderComponent } from './ventas/presupuesto/components/presupuesto-header/presupuesto-header.component';
import { PresupuestoFooterComponent } from './ventas/presupuesto/components/presupuesto-footer/presupuesto-footer.component';
import { PresupuestoStatsComponent } from './ventas/presupuesto/components/presupuesto-stats/presupuesto-stats.component';
import { PresupuestoTabsComponent } from './ventas/presupuesto/components/presupuesto-tabs/presupuesto-tabs.component';
import { PresupuestoPageComponent } from './ventas/presupuesto/page/presupuesto-page.component';
import { RendimientoComercialComponent } from './ventas/rendimiento-comercial/rendimiento-comercial.component';
import { RendimientoComercialPageComponent } from './ventas/rendimiento-comercial/page/rendimiento-comercial-page.component';





// Módulos y servicios
import { MaterialModule } from '../material.module';
import { appRoutes } from '../app.routes';
import { authInterceptor } from '../core/interceptors/auth.interceptor';
import { ClickOutsideDirective } from '../directives/click-outside.directive';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { RefOptionAutocompleteComponent } from '../shared/ref-option-autocomplete/ref-option-autocomplete.component';

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
    RefOptionAutocompleteComponent,
    GraficoComparativaSedesComponent,
    GraficoTotalSedeComponent,
    GraficoPacientesPorMesComponent,
    ProductosListComponent,
    ProductosEtiquetasComponent,
    LoaderComponent,
    GenerarVentaComponent,
    GenerarVentaPageComponent,
    GenerarVentaHeaderComponent,
    GenerarVentaOrigenBannerComponent,
    GenerarVentaTipoSelectorComponent,
    HistorialVentasComponent,
    HistorialHeaderComponent,
    HistorialStatsGridComponent,
    HistorialVentasPageComponent,
    VentasDashboardComponent,
    VentasShellComponent,
    PresupuestoComponent,
    PresupuestoHeaderComponent,
    PresupuestoFooterComponent,
    PresupuestoStatsComponent,
    PresupuestoTabsComponent,
    PresupuestoPageComponent,
    CierreHeaderComponent,
    CierreKpiGridComponent,
    CierreCajaComponent,
    CierreCajaPageComponent,
    RendimientoComercialComponent,
    RendimientoComercialPageComponent,
    clientesComponent,
    SystemConfigComponent,
    GestionOrdenesTrabajoComponent,
    DetalleOrdenComponent
  ],
  imports: [
    CommonModule,
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
    DragDropModule,

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