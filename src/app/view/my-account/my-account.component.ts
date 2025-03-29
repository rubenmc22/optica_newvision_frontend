import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SwalService } from '../../core/services/swal/swal.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { ChangePasswordService } from '../../core/services/changePassword/change-password.service';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as bootstrap from 'bootstrap';

interface UserProfile {
  nombre: string;
  correo: string;
  fechaNacimiento: string | null; // <-- Acepta string o null
  telefono: string;
  avatarUrl?: string | null;
  rol?: string; // <-- Añade esta línea
}

interface ApiUser {
  id?: string;       // Hacer opcional
  cedula?: string;   // Hacer opcional
  correo?: string;
  nombre?: string;
  telefono?: string;
  email?: string;
  rol?: string; // <-- Añade esta línea
}


@Component({
  selector: 'app-my-account',
  standalone: false,
  templateUrl: './my-account.component.html',
  styleUrls: ['./my-account.component.scss']
})

export class MyAccountComponent implements OnInit {

  esAtleta: boolean = false;
  otpError: string = '';
  isVerifyingOtp: boolean = false;

  user: UserProfile = {
    nombre: '',
    correo: '',
    fechaNacimiento: '',
    telefono: '',
    avatarUrl: null,
    rol: ''
  };

  originalUser: UserProfile = { ...this.user };
  activeTab: string = 'personalInfo';
  isFormEdited = false;

  // Password change
  contrasena = '';
  confirmarContrasena = '';
  otpCode = '';
  passwordValid = false;
  passwordsMatch = false;
  formValid = false;

  // Loading states
  isSendingOtp = false;
  // isVerifyingOtp = false;
  isChangingPassword = false;
  isSavingProfile = false;

  // Avatar
  avatarPreview: string | ArrayBuffer | null = null;
  selectedFile: File | null = null;

  constructor(
    private router: Router,
    private swalService: SwalService,
    private authService: AuthService,
    private changePasswordService: ChangePasswordService,
    private snackBar: MatSnackBar,
    private cdRef: ChangeDetectorRef,
  ) {
    // Initialize with current session data
    /* const currentUser = this.authService.getCurrentUser();
     this.user = this.mapToUserProfile(currentUser);
     this.originalUser = { ...this.user };*/
    this.loadUserData();
  }

  ngOnInit(): void {
    this.setupFieldChangeListeners();
    this.verificarRol();
  }

  private verificarRol(): void {
    const currentRol = this.authService.getCurrentRol();
    console.log('currentRol', currentRol);
    this.esAtleta = currentRol?.key === 'atleta';
    console.log('this.esAtleta', this.esAtleta);

    // Si no es atleta, limpiamos la fecha de nacimiento
    if (!this.esAtleta) {
      this.user.fechaNacimiento = '';
      this.originalUser.fechaNacimiento = '';
    }
    this.cdRef.detectChanges(); // Forza la detección de cambios
  }

  /**============ EDITAR INFORMACION PERSONAL ============*/
  private loadUserData(): void {
    try {
      const currentUser: ApiUser = this.authService.getCurrentUser() || {};

      this.user = {
        nombre: currentUser.nombre?.trim() || '',
        correo: currentUser.correo?.trim() || currentUser.email?.trim() || '',
        telefono: currentUser.telefono?.trim() || '',
        fechaNacimiento: '', // Valor por defecto
        avatarUrl: null
      };

      this.originalUser = { ...this.user };

    } catch (error) {
      console.error('Error loading user data:', error);
      this.user = this.getDefaultUserProfile();
      this.originalUser = { ...this.user };
    }
  }


  private getDefaultUserProfile(): UserProfile {
    return {
      nombre: '',
      correo: '',
      telefono: '',
      fechaNacimiento: '',
      avatarUrl: null
    };
  }


  private setupFieldChangeListeners(): void {
    setTimeout(() => {
      const form = document.getElementById('editPersonalInfo');
      if (form) {
        const inputs = form.querySelectorAll('input, select');

        inputs.forEach(input => {
          input.addEventListener('input', () => {
            this.detectChanges();
            this.cdRef.detectChanges(); // Necesitarás import ChangeDetectorRef
          });
          input.addEventListener('change', () => {
            this.detectChanges();
            this.cdRef.detectChanges();
          });
        });
      }
    });
  }

  switchTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'password') {
      this.resetPasswordFields();
    }
  }

  detectChanges(): void {
    this.isFormEdited =
      this.user.nombre !== this.originalUser.nombre ||
      this.user.correo !== this.originalUser.correo ||
      this.user.fechaNacimiento !== this.originalUser.fechaNacimiento ||
      this.user.telefono !== this.originalUser.telefono ||
      this.selectedFile !== null;
  }

  isPersonalInfoValid(): boolean {
    const isValid =
      !!this.user.nombre &&
      !!this.user.correo &&
      !!this.user.telefono &&
      /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(this.user.nombre) &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.user.correo) &&
      /^[0-9]{10,12}$/.test(this.user.telefono); // Ajusté a 10-12 dígitos

    // Solo validamos fecha si es atleta y el campo está visible
    if (this.esAtleta) {
      return isValid && !!this.user.fechaNacimiento;
    }
    return isValid;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files[0]) {
      this.selectedFile = input.files[0];
      const reader = new FileReader();

      reader.onload = (e: ProgressEvent<FileReader>) => {
        if (e.target?.result) {
          this.avatarPreview = e.target.result as string;
          this.detectChanges();
          this.cdRef.detectChanges(); // Necesitas importar ChangeDetectorRef
        }
      };

      reader.onerror = (error) => {
        console.error('Error reading file:', error);
        this.swalService.showError('Error', 'No se pudo cargar la imagen');
      };

      reader.readAsDataURL(this.selectedFile);
    }
  }


  savePersonalInfo(): void {
    if (!this.isPersonalInfoValid()) {
      return;
    }

    this.isSavingProfile = true;

    // Verificación segura del archivo seleccionado
    if (this.selectedFile instanceof File) {
      this.uploadImage(this.selectedFile).then((imageUrl) => {
        // Actualizar la URL del avatar antes de enviar los datos
        this.user.avatarUrl = imageUrl;
        this.sendUserData();
      }).catch((error) => {
        this.isSavingProfile = false;
        this.swalService.showError('Error', 'No se pudo subir la imagen');
        console.error('Error uploading image:', error);
      });
    } else {
      // Si no hay imagen, enviar directamente los datos
      this.sendUserData();
    }
  }

  private uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.authService.uploadAvatar(formData).toPromise()
      .then((response: any) => {
        if (!response?.imageUrl) {
          throw new Error('No image URL in response');
        }
        return response.imageUrl;
      });
  }

  private sendUserData(): void {
    const userData = {
      nombre: this.user.nombre,
      correo: this.user.correo,  // Opcional (puede ser null/undefined)
      telefono: this.user.telefono,
      avatarUrl: this.user.avatarUrl,
      ...(this.esAtleta && this.user.fechaNacimiento && {
        fechaNacimiento: this.user.fechaNacimiento
      })
    };

    console.log('Enviando datos:', userData);

    this.isSavingProfile = true;

    this.changePasswordService.editUser(userData).pipe(
      finalize(() => this.isSavingProfile = false)
    ).subscribe({
      next: (response) => {
        console.log('Respuesta completa:', response);

        // Verificación más flexible del éxito
        if (response && (response.message === 'ok')) {
          this.handleSuccess(response);
        } else {
          // Si llega aquí, la respuesta no tiene el formato esperado
          console.warn('Respuesta inesperada:', response);
          const customError = new HttpErrorResponse({
            error: { message: 'Estimado cliente, estamos presentando un error inesperado, intente nuevamente.' },
            status: 200,
            statusText: 'OK'
          });
          this.handleError(customError);
        }
      },
      error: (error) => {
        console.error('Error real en la petición:', error);
        this.handleError(error);
      }
    });
  }

  private handleSuccess(response: any): void {
    this.swalService.showSuccess('Éxito', 'Perfil actualizado correctamente. El cambio se vera reflado cuando inicie sesion nuevamente.')
      .then(() => {
        if (response.avatarUrl) {
          this.user.avatarUrl = response.avatarUrl;
          this.avatarPreview = response.avatarUrl;
        }
        this.router.navigate(['/dashboard'], { replaceUrl: true });
        this.originalUser = { ...this.user };
        this.isFormEdited = false;
        this.selectedFile = null;
      });
  }

  private handleError(error: HttpErrorResponse): void {
    const errorMsg = error.error?.message || 'Error al actualizar el perfil';
    this.swalService.showError('Error', errorMsg);
  }



  /**============ CAMBIO DE CONTRASENA ============*/
  validateNumberInput(event: KeyboardEvent): boolean {
    const charCode = event.key.charCodeAt(0);
    // Permitir solo números (0-9) y teclas de control
    const isNumber = charCode >= 48 && charCode <= 57;
    const isControlKey = [
      8,  // backspace
      9,  // tab
      13, // enter
      37, // left arrow
      39, // right arrow
      46  // delete
    ].includes(event.keyCode);

    return isNumber || isControlKey;
  }

  validatePasswords(): boolean {
    this.passwordValid = this.contrasena.length >= 8;
    this.passwordsMatch = this.contrasena === this.confirmarContrasena;
    this.formValid = this.passwordValid && this.passwordsMatch;
    return this.formValid;
  }

  initiatePasswordChange(): void {
    if (!this.validatePasswords()) {
      return;
    }

    this.isSendingOtp = true;
    const userEmail = this.user.correo;

    this.changePasswordService.sendPasswordChangeOtp(userEmail).pipe(
      finalize(() => this.isSendingOtp = false)
    ).subscribe({
      next: (response) => {
        if (response.message === 'ok') {
          this.snackBar.open(`Se ha enviado un código OTP a ${userEmail}`, 'Cerrar', {
            duration: 5000,
            verticalPosition: 'top',
            panelClass: ['success-snackbar']
          });
          this.openModal('otpModal');
        }
      },
      error: (error: HttpErrorResponse) => {
        const errorMsg = error.error?.message || 'No se pudo enviar el OTP';
        this.swalService.showError('Error', errorMsg);
      }
    });
  }


  // Función modificada verifyOtp
  verifyOtp(): void {
    this.otpError = '';

    // Validación básica
    if (!this.otpCode || this.otpCode.length !== 6 || !/^\d+$/.test(this.otpCode)) {
      this.otpError = 'Ingrese un código OTP válido de 6 dígitos numéricos';
      this.otpCode = ''; // Limpiar campo
      return;
    }

    this.isVerifyingOtp = true;

    this.changePasswordService.verifyPasswordChangeOtp(this.otpCode).pipe(
      finalize(() => this.isVerifyingOtp = false)
    ).subscribe({
      next: (response) => {
        if (response.message) {
          // Solo cerrar modal si es exitoso
          const modalElement = document.getElementById('otpModal');
          if (modalElement) {
              const modal = bootstrap.Modal.getInstance(modalElement);
              modal?.hide();
          }
        
          this.confirmPasswordChange();
        } else {
          this.otpError = 'Código OTP incorrecto. Intente nuevamente.';
          this.otpCode = ''; // Limpiar campo
        }
      },
      error: (error) => {
        this.otpError = error.error?.message || 'Error al verificar el OTP';
        this.otpCode = ''; // Limpiar campo
      }
    });
  }

  confirmPasswordChange(): void {
    this.isChangingPassword = true;

    this.changePasswordService.changePassword(
      this.user.correo,
      this.contrasena,
      this.otpCode
    ).pipe(
      finalize(() => this.isChangingPassword = false)
    ).subscribe({
      next: () => {
        this.swalService.showSuccess('Éxito', 'Contraseña cambiada correctamente')
          .then(() => {
            this.resetPasswordFields();
            this.router.navigate(['/dashboard'], { replaceUrl: true });
          });
      },
      error: (error: HttpErrorResponse) => {
        const errorMsg = error.error?.message || 'Error al cambiar la contraseña';
        if (error.status === 401) {
          this.authService.logout();
          this.router.navigate(['/login']);
        }
        this.swalService.showError('Error', errorMsg);
      }
    });
  }

  private resetPasswordFields(): void {
    this.contrasena = '';
    this.confirmarContrasena = '';
    this.otpCode = '';
    this.passwordValid = false;
    this.passwordsMatch = false;
    this.formValid = false;
  }

  openModal(modalId: string): void {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
      new bootstrap.Modal(modalElement).show();
    }
  }
}