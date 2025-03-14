import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UserRegisterComponent } from './user-register/user-register.component';
import { LoginComponent } from './login/login.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { PostloginTemplateComponent } from './postlogin-template/postlogin-template.component';

const appRoutes: Routes = [  // Cambiamos el nombre a appRoutes
    { path: '', component: LoginComponent },
    { path: 'register', component: UserRegisterComponent },
    { path: 'forgot-password', component: ForgotPasswordComponent },
    {
        path: '',
        component: PostloginTemplateComponent,
        children: [
            { path: 'dashboard', component: DashboardComponent }
        ]
    },
    { path: '**', redirectTo: '' }
];

// Exportamos appRoutes para que pueda ser usado en otros módulos
export { appRoutes };