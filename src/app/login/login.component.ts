import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms'; // Importa FormBuilder y Validators
import { Router } from '@angular/router'; // Importa el Router para la navegación
import { SwalService } from '../core/services/swal/swal.service'; // Importa el servicio de SweetAlert2
import { GeneralFunctionsService } from '../core/services/general-functions/general-functions.service';
import { AuthService } from '../core/services/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginForm: FormGroup; // Define el formulario reactivo

  constructor(
    private fb: FormBuilder, // Inyecta FormBuilder para crear el formulario
    private router: Router, // Inyecta el Router para la navegación
    private swalService: SwalService, // Inyecta el servicio de SweetAlert2
    private generalFunctions: GeneralFunctionsService, // Inyecta el servicio
    private authService: AuthService // Inyecta el servicio
  ) {
    // Inicializa el formulario con validaciones
    this.loginForm = this.fb.group({
      cedula: [
        '',
        [Validators.required, Validators.pattern('^[0-9]{1,8}$')] // Cédula numérica, máximo 8 dígitos
      ],
      password: [
        '',
        [Validators.required, Validators.minLength(6)] // Contraseña con mínimo 6 caracteres
      ]
    });
  }

  // Verifica si un campo tiene errores
  isInvalidField(fieldName: string): boolean {
    return this.generalFunctions.isInvalidField(this.loginForm, fieldName);
  }

  ngOnInit(): void {
    // Limpiar autenticación siempre al cargar el login
    this.authService.clearAuth();
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.authService.login(this.loginForm.value.cedula, this.loginForm.value.password)
      .then(() => {
        this.router.navigateByUrl('/dashboard', { replaceUrl: true });
      })
      .catch(error => {
        this.swalService.showError('Error', error.message);
      });
  }

}