import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { SwalService } from '../../core/services/swal/swal.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { ChangeInformationService } from '../../core/services/changePassword/change-information.service';
import { SharedUserService } from '../../core/services/sharedUser/shared-user.service';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { lastValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';
import * as bootstrap from 'bootstrap';

interface UserProfile {
  nombre: string;
  correo: string;
  fechaNacimiento: string | null;
  telefono: string;
  avatarUrl?: string | null;
  rol?: string;
  ruta_imagen?: string | null;
}

interface ApiUser {
  id?: string;
  cedula?: string;
  correo?: string;
  nombre?: string;
  telefono?: string;
  email?: string;
  rol?: string;
  ruta_imagen?: string | null;
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
    rol: '',
    ruta_imagen: ''
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
  isChangingPassword = false;
  isSavingProfile = false;

  // Avatar
  avatarPreview: string | ArrayBuffer | null = null;
  selectedFile: File | null = null;

  constructor(
    private router: Router,
    private swalService: SwalService,
    private authService: AuthService,
    private changeInformationService: ChangeInformationService,
    private sharedUserService: SharedUserService,
    private snackBar: MatSnackBar,
    private cdRef: ChangeDetectorRef,
  ) {
    this.loadUserData();
  }

  ngOnInit(): void {
    this.setupFieldChangeListeners();
    this.verificarRol();
  }

  private verificarRol(): void {
    const currentRol = this.authService.getCurrentRol();
    this.esAtleta = currentRol?.key === 'atleta';

    if (!this.esAtleta) {
      this.user.fechaNacimiento = '';
      this.originalUser.fechaNacimiento = '';
    }
    this.cdRef.detectChanges();
  }

  private loadUserData(): void {
    try {
      const currentUser: ApiUser = this.authService.getCurrentUser() || {};

      this.user = {
        nombre: currentUser.nombre?.trim() || '',
        correo: currentUser.correo?.trim() || currentUser.email?.trim() || '',
        telefono: currentUser.telefono?.trim() || '',
        fechaNacimiento: '',
        avatarUrl: null,
        ruta_imagen: currentUser.ruta_imagen || null
      };

      this.originalUser = { ...this.user };
      this.sharedUserService.updateUserProfile(this.user);
    } catch (error) {
      console.error('Error loading user data:', error);
      this.user = this.getDefaultUserProfile();
      this.originalUser = { ...this.user };
    }
  }

  getProfileImage(): string {
    if (this.avatarPreview) {
      return this.avatarPreview as string;
    }

    if (this.user.ruta_imagen) {
      if (this.user.ruta_imagen.startsWith('http')) {
        return this.user.ruta_imagen;
      }

      if (this.user.ruta_imagen.startsWith('/public')) {
        return `${environment.baseUrl}${this.user.ruta_imagen}`;
      }

      return `${environment.baseUrl}/public/profile-images/${this.user.ruta_imagen}`;
    }

    return 'assets/default-photo.png';
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
            this.cdRef.detectChanges();
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
      /^[0-9]{10,12}$/.test(this.user.telefono);

    if (this.esAtleta) {
      return isValid && !!this.user.fechaNacimiento;
    }
    return isValid;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files?.length) {
      const file = input.files[0];

      if (!file.type.startsWith('image/')) {
        this.swalService.showError('Error', 'Solo se permiten imágenes');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.swalService.showError('Error', 'La imagen es demasiado grande (máx. 5MB)');
        return;
      }

      this.selectedFile = file;
      const reader = new FileReader();

      reader.onload = (e) => {
        this.avatarPreview = e.target?.result as string;
        this.detectChanges();
        this.cdRef.detectChanges();
      };

      reader.onerror = () => {
        this.swalService.showError('Error', 'Error al leer el archivo');
      };

      reader.readAsDataURL(file);
    }
  }

  async savePersonalInfo(): Promise<void> {
    if (!this.isPersonalInfoValid()) {
      return;
    }

    this.isSavingProfile = true;

    try {
      if (this.selectedFile) {
        this.user.avatarUrl = await this.uploadImage(this.selectedFile);
      }

      await this.sendUserData();

      this.selectedFile = null;
      this.isFormEdited = false;
      this.originalUser = { ...this.user };

      this.swalService.showSuccess('Éxito', 'Perfil actualizado correctamente');
    } catch (error) {
      console.error('Error guardando información:', error);

      let errorMessage = 'Error al guardar los cambios';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      this.swalService.showError('Error', errorMessage);
    } finally {
      this.isSavingProfile = false;
    }
  }

  private async uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('profileImage', file);
  
    try {
      const response = await lastValueFrom(
        this.changeInformationService.uploadProfileImage(formData)
      );
  
      if (!response?.image_url) {
        throw new Error('No se recibió URL de imagen');
      }
  
      // Actualiza en todos los servicios y estados
      this.user.ruta_imagen = response.image_url;
      this.user.avatarUrl = response.image_url;
      
      // Actualiza en AuthService y UserStateService
      this.authService.updateProfileImage(response.image_url);
      
      this.cdRef.detectChanges();
      this.sharedUserService.updateUserProfile(this.user);
      
      return response.image_url;
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      throw error;
    }
  }

  private async sendUserData(): Promise<void> {
    const userData = {
      nombre: this.user.nombre,
      correo: this.user.correo,
      telefono: this.user.telefono,
      avatarUrl: this.user.avatarUrl,
      ...(this.esAtleta && this.user.fechaNacimiento && {
        fechaNacimiento: this.user.fechaNacimiento
      })
    };

    try {
      const response = await this.changeInformationService.editUser(userData).toPromise();

      if (!response || response.message !== 'ok') {
        throw new Error(response?.message || 'Respuesta inesperada del servidor');
      }
    } catch (error) {
      console.error('Error actualizando datos:', error);
      throw error;
    }
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/default-photo.png';
    console.warn('Error al cargar la imagen', this.user.ruta_imagen);
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

  validateNumberInput(event: KeyboardEvent): boolean {
    const charCode = event.key.charCodeAt(0);
    const isNumber = charCode >= 48 && charCode <= 57;
    const isControlKey = [8, 9, 13, 37, 39, 46].includes(event.keyCode);

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

    this.changeInformationService.sendPasswordChangeOtp(userEmail).pipe(
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

  verifyOtp(): void {
    this.otpError = '';

    if (!this.otpCode || this.otpCode.length !== 6 || !/^\d+$/.test(this.otpCode)) {
      this.otpError = 'Ingrese un código OTP válido de 6 dígitos numéricos';
      this.otpCode = '';
      return;
    }

    this.isVerifyingOtp = true;

    this.changeInformationService.verifyPasswordChangeOtp(this.otpCode).pipe(
      finalize(() => this.isVerifyingOtp = false)
    ).subscribe({
      next: (response) => {
        if (response.message) {
          const modalElement = document.getElementById('otpModal');
          if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal?.hide();
          }

          this.confirmPasswordChange();
        } else {
          this.otpError = 'Código OTP incorrecto. Intente nuevamente.';
          this.otpCode = '';
        }
      },
      error: (error) => {
        this.otpError = error.error?.message || 'Error al verificar el OTP';
        this.otpCode = '';
      }
    });
  }

  confirmPasswordChange(): void {
    this.isChangingPassword = true;

    this.changeInformationService.changePassword(
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