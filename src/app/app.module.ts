import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms'; 
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
import { PostloginTemplateComponent } from './postlogin-template/postlogin-template.component'; 
import { MyAccountComponent } from './my-account/my-account.component';
import { PersonalInformationComponent } from './personal-information/personal-information.component'; 
import { VerAtletasComponent } from './ver-atletas/ver-atletas.component'; 
import { CrearAtletasComponent } from './crear-atletas/crear-atletas.component'; 


@NgModule({
  declarations: [
    AppComponent,
    UserRegisterComponent,
    LoginComponent,
    ForgotPasswordComponent,
    SidebarComponent,
    DashboardComponent,
    MyAccountComponent,
    PersonalInformationComponent,
    VerAtletasComponent,
    CrearAtletasComponent,
    PostloginTemplateComponent // Declara el componente de layout post-login
  ],
  imports: [
    BrowserModule,
    ReactiveFormsModule,
    MaterialModule,
    FormsModule,
    RouterModule.forRoot(appRoutes )
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
