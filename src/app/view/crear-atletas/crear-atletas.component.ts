import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { GeneralFunctionsService } from '../../core/services/general-functions/general-functions.service';
import { SwalService } from '../../core/services/swal/swal.service'; // Servicio de SweetAlert2
import { Router } from '@angular/router'; // Router para navegación
import { AuthService } from '../../core/services/auth/auth.service'; // Servicio de autenticación
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-crear-atletas',
  standalone: false,
  templateUrl: './crear-atletas.component.html',
  styleUrls: ['./crear-atletas.component.scss']
})
export class CrearAtletasComponent implements OnInit {
  crearAtletaForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private router: Router, // Inyecta el Router para la navegación
    private location: Location,
    private generalFunctions: GeneralFunctionsService, // Inyecta el servicio
    private swalService: SwalService, // Servicio de SweetAlert2
    private authService: AuthService // Servicio de autenticación
  ) {
    this.crearAtletaForm = this.fb.group({
      nombre: [
        '',
        [Validators.required, Validators.pattern('^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]*$')] // Solo caracteres alfabéticos
      ],
      cedula: [
        '',
        [Validators.pattern('^[0-9]{1,8}$')] // Cédula opcional: numérica, máximo 8 dígitos
      ],
      telefono: [
        '',
        [Validators.pattern('^[0-9]{1,12}$')] // Teléfono opcional: numérico, máximo 12 caracteres
      ],
      email: [
        '',
        [Validators.pattern('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$')] // Correo opcional: válido
      ],
      athleteDob: ['', Validators.required], // Fecha de nacimiento obligatoria
      genero: [
        '',
        [Validators.required] // Género obligatorio (Hombre o Mujer)
      ],
    });
  }

  ngOnInit() {
    // Verificar si la sesión es válida
    if (!this.authService.isAuthenticated()) {
      console.error('La sesión no es válida o ha expirado.');
      this.swalService.showError('Sesión expirada', 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.')
        .then(() => {
          this.router.navigate(['/login']); // Redirigir al inicio de sesión
        });
      return; // Detener el flujo en caso de sesión inválida
    }

    console.log('Formulario inicializado:', this.crearAtletaForm.value);
  }

  isInvalidField(fieldName: string): boolean {
    return this.generalFunctions.isInvalidField(this.crearAtletaForm, fieldName);
  }

  onSubmit() {
    if (this.crearAtletaForm.valid) {
      let formData = { ...this.crearAtletaForm.value };

      // Transformar datos antes del envío
      formData.genero = formData.genero === 'Mujer' ? 'F' : 'M';
      console.log('Datos del formulario antes del envío:', formData);

      // Obtener el token desde sessionStorage
      const token = sessionStorage.getItem('authToken');
      console.log('token:', formData);
      if (!token) {
        console.error('No se encontró un token de autorización.');

        // Mostrar mensaje de sesión expirada y redirigir al login
        this.swalService.showError('Error de sesión', 'La sesión ha expirado. Por favor, inicia sesión nuevamente.');
        this.router.navigate(['/login']); // Redirigir al inicio de sesión
        return; // Detener el flujo si no hay token
      }

      // Enviar datos al servidor
      fetch(`${environment.apiUrl}/atletas/register`, { // URL del backend
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Encabezado de autorización
        },
        body: JSON.stringify(formData)
      })
        .then(response => {
          if (!response.ok) {
            return response.json().then(err => {
              throw new Error(err.message || `Error en la solicitud: ${response.statusText}`);
            });

          }
          return response.json();
        })
        .then(data => {
          console.log('Respuesta del servidor:', data);

          // Mostrar mensaje de éxito y redirigir al dashboard
          this.swalService.showSuccess('¡Registro exitoso!', 'Se ha registrado al Atleta correctamente.')
            .then(() => {
              this.router.navigate(['/dashboard']); // Redirigir al dashboard
            });
          this.crearAtletaForm.reset(); // Limpia el formulario
        })
        .catch(error => {
          console.error('Hubo un problema con la solicitud:', error);
          this.swalService.showError(
            'Error en el registro',
            error.message || 'Hubo un problema al registrar. Por favor, inténtalo nuevamente.'
          );
        });
    } else {
      console.error('Formulario inválido');
      this.swalService.showWarning(
        'Formulario inválido',
        'Por favor, completa todos los campos obligatorios correctamente.'
      );
    }
  }

  goBack() {
    this.location.back();
  }
}
