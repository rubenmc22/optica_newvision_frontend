import { Component } from '@angular/core';
import * as bootstrap from 'bootstrap';
import { SwalService } from '../core/services/swal/swal.service';
import { GeneralFunctionsService } from '../core/services/general-functions/general-functions.service';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth/auth.service';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-my-account',
  standalone: false,
  templateUrl: './my-account.component.html',
  styleUrls: ['./my-account.component.scss']
})
export class MyAccountComponent {
  // Datos originales del usuario
  originalUser = {
    nombreCompleto: 'Ruben',
    fechaNacimiento: '10/11/1995',
    cedula: '12345678',
    correo: 'rubemm18@gmail.com',
    telefono: '584123920817',
    genero: 'Hombre',
    avatarUrl: null as string | null
  };

  // Datos actuales del usuario
  user = { ...this.originalUser, contrasena: '' };
  confirmarContrasena = '';
  otpCode = '';

  // Indicadores de validación
  nombreValido = true;
  correoValido = true;
  telefonoValido = true;
  passwordsMatch = false;
  passwordValid = false;
  formValid = false;
  isFormEdited = false;

  // Pestaña activa
  activeTab: string = 'personalInfo';

  // URL de la imagen del avatar
  avatarUrl: string | null = null;

  // Estados para el flujo OTP
  isSendingOtp = false;
  isVerifyingOtp = false;
  isChangingPassword = false;
  otpVerified = false;
  currentStep: 'sendOtp' | 'verifyOtp' | 'changePassword' = 'sendOtp';

  constructor(
    private swalService: SwalService,
    private generalFunctions: GeneralFunctionsService,
    private router: Router,
    private authService: AuthService,
    private snackBar: MatSnackBar,
  ) { }

  // Métodos de navegación
  switchTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'password') {
      this.resetPasswordFields();
    }
  }

  // Métodos de detección de cambios
  detectChanges(): void {
    this.isFormEdited =
      this.user.nombreCompleto !== this.originalUser.nombreCompleto ||
      this.user.correo !== this.originalUser.correo ||
      this.user.fechaNacimiento !== this.originalUser.fechaNacimiento ||
      this.user.telefono !== this.originalUser.telefono ||
      this.user.genero !== this.originalUser.genero ||
      this.avatarUrl !== this.originalUser.avatarUrl;
  }

  // Métodos de validación
  validateNombre(): void {
    const regex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    this.nombreValido = regex.test(this.user.nombreCompleto.trim());
  }

  validateCorreo(): void {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.correoValido = regex.test(this.user.correo.trim());
  }

  validateTelefono(): void {
    const regex = /^[0-9]{12}$/;
    this.telefonoValido = regex.test(this.user.telefono.trim());
  }

  isPersonalInfoValid(): boolean {
    this.validateNombre();
    this.validateCorreo();
    this.validateTelefono();
    return this.nombreValido && this.correoValido && this.telefonoValido;
  }

  validatePasswords(): void {
    this.passwordValid =
      typeof this.user.contrasena === 'string' &&
      this.user.contrasena.length >= 8;
    this.passwordsMatch =
      this.user.contrasena === this.confirmarContrasena;
    this.formValid = this.passwordValid && this.passwordsMatch;
  }

  // Métodos de reset
  resetPasswordFields(): void {
    this.user.contrasena = '';
    this.confirmarContrasena = '';
    this.passwordsMatch = false;
    this.passwordValid = false;
    this.formValid = false;
    this.otpCode = '';
    this.otpVerified = false;
    this.currentStep = 'sendOtp';
  }

  // Métodos de UI
  openModal(modalId: string): void {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);

      // Evento que se dispara cuando el modal se muestra completamente
      /*   modalElement.addEventListener('shown.bs.modal', () => {
           if (modalId === 'otpModal') {
             this.initiatePasswordChange();
           }
         });*/

      modal.show();
    }
  }

  // Métodos para manejo de archivos
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.avatarUrl = e.target.result;
        this.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  // Métodos para información personal
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
          avatarUrl: this.avatarUrl
        })
      })
        .then(response => response.json())
        .then(data => {
          console.log('Información personal guardada:', data);
          this.swalService.showSuccess('¡Modificación de Datos!', 'Información personal guardada.')
            .then(() => {
              this.router.navigate(['/dashboard']);
            });
          this.originalUser = { ...this.user, avatarUrl: this.avatarUrl };
          this.isFormEdited = false;
        })
        .catch(error => {
          console.error('Error al guardar información personal:', error);
          this.swalService.showError('¡Modificación de Datos!', 'Hubo un error al guardar la información.');
        });
    } else {
      this.swalService.showWarning('Formulario inválido', 'Por favor, corrige los errores o realiza algún cambio antes de continuar.');
    }
  }

  // Método actualizado para enviar OTP
  initiatePasswordChange(): void {
    this.validatePasswords();

    if (!this.formValid) {
      this.swalService.showWarning('Validación', 'Por favor complete correctamente los campos de contraseña');
      return;
    }

    const userEmail = this.authService.getCurrentUser()?.email;
    if (!userEmail) {
      this.swalService.showError('Error', 'No se pudo obtener la información del usuario');
      return;
    }

    this.isSendingOtp = true;

    this.authService.sendPasswordChangeOtp(userEmail).subscribe({
      next: (response: any) => {
        this.isSendingOtp = false;
        console.log('Respuesta del servidor:', response);

        // Verificación más robusta de la respuesta
        if (response && response.message === 'ok') {
          //   this.swalService.showSuccess('Éxito', `Se ha enviado un código OTP a ${userEmail}`);
          this.snackBar.open(`Estimado usuario, se ha enviado un código OTP a ${userEmail}`, 'Cerrar', {
            duration: 5000
          });
          this.openModal('otpModal');
          this.currentStep = 'verifyOtp';
        } else {
          // Manejo de respuestas inesperadas del servidor
          const errorMsg = 'La respuesta del servidor no fue la esperada';
          this.swalService.showError('Error', errorMsg);
          console.warn('Respuesta inesperada:', response);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.isSendingOtp = false;
        console.error('Error en la petición:', error);

        // Manejo detallado de errores HTTP
        let errorMessage = 'No se pudo enviar el OTP. Intenta nuevamente.';

        if (error.status === 0) {
          errorMessage = 'Error de conexión. Verifica tu internet.';
        } else if (error.status === 404) {
          errorMessage = 'El servicio no está disponible.';
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }

        this.swalService.showError('Error', errorMessage);
      }
    });
  }

  verifyOtp(): void {
    if (!this.otpCode || this.otpCode.length !== 6) {
      this.swalService.showWarning('Validación', 'Por favor ingrese un código OTP válido de 6 dígitos');
      return;
    }

    this.isVerifyingOtp = true;

    this.authService.verifyPasswordChangeOtp(this.otpCode).subscribe({
      next: (data) => {
        this.isVerifyingOtp = false;
        if (data && data.message === 'ok') {
          this.otpVerified = true;
          this.currentStep = 'changePassword';
          //this.swalService.showSuccess('Éxito', 'Código OTP verificado correctamente');
          this.confirmPasswordChange();
        } else {
          this.swalService.showError('Error', 'Código OTP inválido');
        }
      },
      error: (error) => {
        this.isVerifyingOtp = false;
        this.swalService.showError('Error', 'Error al verificar el OTP');
        console.error('Error verifying OTP:', error);
      }
    });
  }

  // En my-account.component.ts
  confirmPasswordChange(): void {
    if (!this.otpVerified) {
      this.swalService.showWarning('Validación', 'Debes verificar el OTP primero');
      return;
    }

    const userEmail = this.authService.getCurrentUser()?.email;
    if (!userEmail) {
      this.swalService.showError('Error', 'No se pudo obtener el email del usuario');
      return;
    }

    if (!this.user.contrasena || this.user.contrasena.length < 8) {
      this.swalService.showWarning('Validación', 'La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (this.user.contrasena !== this.confirmarContrasena) {
      this.swalService.showWarning('Validación', 'Las contraseñas no coinciden');
      return;
    }

    this.isChangingPassword = true;

    this.authService.changePassword(
      userEmail,
      this.user.contrasena,
      this.otpCode
    ).pipe(
      finalize(() => this.isChangingPassword = false)
    ).subscribe({
      next: (response: any) => {
        if (response.message) {
          // Usamos then() en lugar de await
          this.swalService.showSuccess('Éxito', 'Contraseña cambiada correctamente')
            .then(() => {
              this.resetPasswordFields();
              this.router.navigate(['/dashboard'], { replaceUrl: true });
            });
        } else {
          this.swalService.showError('Error', 'Error al cambiar la contraseña');
        }
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error cambiando contraseña:', error);

        if (error.status === 401) {
          this.swalService.showError('Error', 'Tu sesión ha expirado')
            .then(() => {
              this.authService.logout();
              this.router.navigate(['/login']);
            });
        } else {
          const errorMsg = error.error?.message || 'Error al cambiar la contraseña';
          this.swalService.showError('Error', errorMsg);
        }
      }
    });
  }


}