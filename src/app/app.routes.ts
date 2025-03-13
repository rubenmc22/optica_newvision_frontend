import { UserRegisterComponent } from './user-register/user-register.component';
import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';

//import { HomeComponent } from './home/home.component';
//import { AboutComponent } from './about/about.component';

export const routes: Routes = [
    { path: '', component: LoginComponent },
    { path: 'register', component: UserRegisterComponent },
    { path: 'forgot-password', component: ForgotPasswordComponent },
    { path: '**', redirectTo: '' }
];