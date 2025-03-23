import { Component } from '@angular/core';
import * as bootstrap from 'bootstrap';
import { SwalService } from '../services/swal/swal.service'; // Importa el servicio de SweetAlert2
import { GeneralFunctionsService } from '../services/general-functions/general-functions.service';
import { Router } from '@angular/router'; // Importa el Router para la navegación

@Component({
  selector: 'app-my-account',
  standalone: false,
  templateUrl: './my-account.component.html',
  styleUrls: ['./my-account.component.scss']
})
export class MyAccountComponent {
  // Datos originales del usuario (para detección de cambios)
  originalUser = {
    nombreCompleto: 'Ruben',
    fechaNacimiento: '10/11/1995',
    cedula: '12345678',
    correo: 'rubemm18@gmail.com',
    telefono: '584123920817',
    genero: 'Hombre',
    avatarUrl: null as string | null // Asegura que avatarUrl sea de tipo string | null
  };

  // Datos actuales del usuario (editables)
  user = { ...this.originalUser, contrasena: '' };

  // Confirmar Contraseña y OTP
  confirmarContrasena = '';
  otpCode = '';

  // Indicadores de validación
  nombreValido = true;
  correoValido = true;
  telefonoValido = true;
  passwordsMatch = false;
  passwordValid = false;
  formValid = false; // Habilitado si las contraseñas son válidas
  isFormEdited = false; // Botón habilitado si se detectan cambios

  // Pestaña activa
  activeTab: string = 'personalInfo';

  // URL de la imagen del avatar
  avatarUrl: string | null = null;

  constructor(
    private swalService: SwalService, // Inyecta el servicio de SweetAlert2
    private generalFunctions: GeneralFunctionsService, // Inyecta el servicio
    private router: Router // Inyecta el Router para la navegación
  ) { }

  // Métodos relacionados con pestañas
  switchTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'password') {
      this.resetPasswordFields();
    }
  }

  // Detecta si algún campo fue editado
  detectChanges(): void {
    this.isFormEdited =
      this.user.nombreCompleto !== this.originalUser.nombreCompleto ||
      this.user.correo !== this.originalUser.correo ||
      this.user.fechaNacimiento !== this.originalUser.fechaNacimiento ||
      this.user.telefono !== this.originalUser.telefono ||
      this.user.genero !== this.originalUser.genero ||
      this.avatarUrl !== this.originalUser.avatarUrl; // Considera la imagen cargada
  }

  // Validaciones individuales
  validateNombre(): void {
    const regex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/; // Solo letras y espacios
    this.nombreValido = regex.test(this.user.nombreCompleto.trim());
  }

  validateCorreo(): void {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Formato de email válido
    this.correoValido = regex.test(this.user.correo.trim());
  }

  validateTelefono(): void {
    const regex = /^[0-9]{12}$/; // Solo números de 12 dígitos
    this.telefonoValido = regex.test(this.user.telefono.trim());
  }

  // Validaciones generales del formulario de información personal
  isPersonalInfoValid(): boolean {
    this.validateNombre();
    this.validateCorreo();
    this.validateTelefono();
    return this.nombreValido && this.correoValido && this.telefonoValido;
  }

  // Validar contraseñas
  validatePasswords(): void {
    this.passwordValid =
      typeof this.user.contrasena === 'string' &&
      this.user.contrasena.length >= 8; // Longitud mínima de 8 caracteres
    this.passwordsMatch =
      this.user.contrasena === this.confirmarContrasena; // Coincidencia
    this.formValid = this.passwordValid && this.passwordsMatch; // Ambos deben ser válidos
  }

  // Restablecer campos de contraseña
  resetPasswordFields(): void {
    this.user.contrasena = '';
    this.confirmarContrasena = '';
    this.passwordsMatch = false;
    this.passwordValid = false;
    this.formValid = false;
  }

  // Abrir un modal dinámico
  openModal(modalId: string): void {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  // Guardar información personal
  savePersonalInfo(): void {
    if (this.isPersonalInfoValid() && this.isFormEdited) {
      fetch('https://api.example.com/personal-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreCompleto: this.user.nombreCompleto,
          correo: this.user.correo,
          telefono: this.user.telefono,
          genero: this.user.genero,
          fechaNacimiento: this.user.fechaNacimiento,
          avatarUrl: this.avatarUrl // Incluye la imagen en la solicitud
        })
      })
        .then(response => response.json())
        .then(data => {
          console.log('Información personal guardada:', data);
          this.swalService.showSuccess('¡Modificación de Datos!', 'Información personal guardada.')
            .then(() => {
              this.router.navigate(['/dashboard']); // Redirigir al dashboard
            });
          this.originalUser = { ...this.user, avatarUrl: this.avatarUrl }; // Actualiza los valores originales
          this.isFormEdited = false; // Reinicia el estado de edición
        })
        .catch(error => {
          console.error('Error al guardar información personal:', error);
          // alert('Hubo un error al guardar la información.');
          this.swalService.showError('¡Modificación de Datos!', 'Hubo un error al guardar la información.');
        });
    } else {
      // alert('Por favor, corrige los errores o realiza algún cambio antes de continuar.');
      this.swalService.showWarning('Formulario inválido', 'Por favor, corrige los errores o realiza algún cambio antes de continuar.');
    }
  }

  // Verificar OTP y guardar nueva contraseña
  verifyOtp(): void {
    if (this.otpCode.length === 6) {
      fetch('https://api.example.com/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.user.correo,
          newPassword: this.user.contrasena,
          otp: this.otpCode
        })
      })
        .then(response => response.json())
        .then(data => {
          console.log('Contraseña cambiada:', data);
          alert('Contraseña actualizada exitosamente.');
          this.resetPasswordFields(); // Limpia los campos de contraseña
        })
        .catch(error => {
          console.error('Error al cambiar la contraseña:', error);
          alert('Hubo un error al actualizar la contraseña.');
        });
    } else {
      alert('Por favor, ingresa un código OTP válido.');
    }
  }

  // Método para manejar la selección de archivos (carga de imagen)
  onFileSelected(event: any): void {
    const file = event.target.files[0]; // Obtiene el archivo seleccionado
    if (file) {
      const reader = new FileReader(); // Crea un FileReader para leer el archivo
      reader.onload = (e: any) => {
        this.avatarUrl = e.target.result; // Asigna la URL de la imagen al avatarUrl
        this.detectChanges(); // Detecta cambios después de cargar la imagen
      };
      reader.readAsDataURL(file); // Lee el archivo como una URL de datos
    }
  }
}