import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http'; // Cambio clave aquí

// Componentes
import { AppComponent } from '../app.component';
import { UserRegisterComponent } from './user-register/user-register.component';
import { LoginComponent } from './login/login.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { PostloginTemplateComponent } from './postlogin-template/postlogin-template.component';
import { MyAccountComponent } from './my-account/my-account.component';
import { FichaTecnicaComponent } from './ficha-tecnica/ficha-tecnica.component';
import { VerAtletasComponent } from './ver-atletas/ver-atletas.component';
import { CrearAtletasComponent } from './crear-atletas/crear-atletas.component';
import { AcceptTycComponent } from './accept-tyc-component/accept-tyc-component.component';

// Módulos y servicios
import { MaterialModule } from '../material.module';
import { appRoutes } from '../app.routes';
import { authInterceptor } from '../core/interceptors/auth.interceptor';

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
    FichaTecnicaComponent,
    VerAtletasComponent,
    CrearAtletasComponent,
    AcceptTycComponent
  ],
  imports: [
    BrowserModule,
    ReactiveFormsModule,
    MaterialModule,
    FormsModule,
    RouterModule.forRoot(appRoutes, {
      onSameUrlNavigation: 'reload',
      bindToComponentInputs: true // Nueva feature de Angular 16+
    })
  ],
  providers: [
    // Configuración moderna de HttpClient con interceptores funcionales
    provideHttpClient(
      withInterceptors([authInterceptor]) // Registro directo del interceptor
    )
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }