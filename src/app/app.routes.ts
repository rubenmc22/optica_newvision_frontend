import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UserRegisterComponent } from './user-register/user-register.component';
import { LoginComponent } from './login/login.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { MyAccountComponent } from './my-account/my-account.component';
import { PostloginTemplateComponent } from './postlogin-template/postlogin-template.component';
import { FichaTecnicaComponent } from './ficha-tecnica/ficha-tecnica.component';
import { VerAtletasComponent } from './ver-atletas/ver-atletas.component';
import { CrearAtletasComponent } from './crear-atletas/crear-atletas.component';

const appRoutes: Routes = [  // Cambiamos el nombre a appRoutes
    { path: '', component: LoginComponent },
    { path: 'register', component: UserRegisterComponent },
    { path: 'forgot-password', component: ForgotPasswordComponent },
    {
        path: '',
        component: PostloginTemplateComponent,
        children: [
            { path: 'dashboard', component: DashboardComponent },
            { path: 'my-account', component: MyAccountComponent },
            { path: 'ficha-tecnica', component: FichaTecnicaComponent }, 
            { path: 'ver-atletas', component: VerAtletasComponent }, 
            { path: 'crear-atletas', component: CrearAtletasComponent }, // Nueva ruta
        ]
    },
    { path: '**', redirectTo: '' }
];

// Exportamos appRoutes para que pueda ser usado en otros módulos
export { appRoutes };