import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms'; // Importa FormBuilder y Validators
import { Router } from '@angular/router'; // Importa el Router para la navegación
import { SwalService } from '../services/swal/swal.service'; // Importa el servicio de SweetAlert2
import { GeneralFunctionsService } from '../services/general-functions/general-functions.service';

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
    private generalFunctions: GeneralFunctionsService // Inyecta el servicio
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

  // Enviar el formulario de inicio de sesión
  onSubmit() {
    if (this.loginForm.valid) {
      const formData = this.loginForm.value; // Obtiene los valores del formulario

      console.log('Datos del formulario antes del envío:', JSON.stringify(formData));
      const endpointUrl = "http://tu-backend-endpoint.com/login"; // URL del endpoint de login

      fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData) // Envía los datos del formulario
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Error en la solicitud: ${response.statusText}`);
          }
          return response.json();
        })
        .then(data => {
          console.log('Respuesta del servidor:', data);
          // Mostrar alerta de éxito y redirigir al dashboard
          this.swalService.showSuccess('¡Inicio de sesión exitoso!', 'Bienvenido de nuevo.')
            .then(() => {
              this.router.navigate(['/dashboard']); // Redirigir al dashboard
            });
        })
        .catch(error => {
          console.error('Hubo un problema con la solicitud:', error);
          // Mostrar alerta de error
          this.swalService.showError('Error en el inicio de sesión', 'Cédula o contraseña incorrectos. Por favor, inténtalo nuevamente.');
        });
    } else {
      console.error('Formulario inválido');
      // Mostrar alerta de formulario inválido
      this.swalService.showWarning('Formulario inválido', 'Por favor, completa todos los campos correctamente antes de enviar.');
    }
  }
}