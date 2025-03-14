import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';
import { UserRegisterComponent } from './user-register/user-register.component';
import { LoginComponent } from './login/login.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { MaterialModule } from './material.module';
import { appRoutes  } from './app.routes';
import { SidebarComponent } from './sidebar/sidebar.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { PostloginTemplateComponent } from './postlogin-template/postlogin-template.component'; // Importa el componente de layout post-login

@NgModule({
  declarations: [
    AppComponent,
    UserRegisterComponent,
    LoginComponent,
    ForgotPasswordComponent,
    SidebarComponent,
    DashboardComponent,
    PostloginTemplateComponent // Declara el componente de layout post-login
  ],
  imports: [
    BrowserModule,
    ReactiveFormsModule,
    MaterialModule,
    RouterModule.forRoot(appRoutes )
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
