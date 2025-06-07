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
import { GeneralFunctions } from '../../general-functions/general-functions';

interface UserProfile {
  nombre: string;
  cedula: string;
  cargo: string;
  correo: string;
  fecha_nacimiento: string | null;
  telefono: string;
  avatarUrl?: string | null;
  rol: string;
  ruta_imagen?: string | null;
}

interface ApiUser {
  id?: string;
  cedula?: string;
  cargo?: string;
  correo?: string;
  nombre?: string;
  telefono?: string;
  fecha_nacimiento?: string | null;
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
  otpError: string = '';
  isVerifyingOtp: boolean = false;
  mostrarErrorTelefono = false; // Definir la propiedad en la clase
  currentRol: { key: string; name: string } | null = null; //Obtener Rol sesion
  currentCargo: { key: string; name: string } | null = null; //Obtener Cargo sesion
  showPassword: boolean = false; // Nueva propiedad para controlar visibilidad
  showConfirmPassword = false;

  user: UserProfile = {
    nombre: '',
    cedula: '',
    correo: '',
    cargo: '',
    fecha_nacimiento: '',
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

  cargosDisponibles = [
    { key: 'asesor_optico_1', name: 'Asesor Óptico 1' },
    { key: 'asesor_optico_2', name: 'Asesor Óptico 2' },
    { key: 'gerente', name: 'Gerente' },
    { key: 'administrador', name: 'Administrador' },
    { key: 'optometrista', name: 'Optometrista' },
    { key: 'oftalmologo', name: 'Oftalmólogo' }
  ];

  userCargoSeleccionado = this.cargosDisponibles[0].key; // Para seleccionar un valor por defecto

  constructor(
    private router: Router,
    private swalService: SwalService,
    private authService: AuthService,
    private changeInformationService: ChangeInformationService,
    private sharedUserService: SharedUserService,
    private snackBar: MatSnackBar,
    private cdRef: ChangeDetectorRef,
    private generalFunctions: GeneralFunctions
  ) {

  }

  ngOnInit(): void {
    this.setupFieldChangeListeners();
    this.currentRol = this.authService.getCurrentRol() || { key: '', name: '' }; // Obtener el rol sesion
    this.currentCargo = this.authService.getCurrentCargo() || { key: '', name: '' }; // Obtener el cargo sesion
    this.loadUserData();
  }



  private loadUserData(): void {
    try {
      const currentUser: ApiUser = this.authService.getCurrentUser() || {};

      this.user = {
        nombre: currentUser.nombre?.trim() || '',
        cedula: currentUser.cedula?.trim() || '',
        cargo: this.currentCargo?.key ?? '',
        correo: currentUser.correo?.trim() || currentUser.email?.trim() || '',
        telefono: currentUser.telefono?.trim() || '',
        fecha_nacimiento: currentUser.fecha_nacimiento || null,
        avatarUrl: null,
        ruta_imagen: currentUser.ruta_imagen || null,
        rol: this.currentRol?.key ?? ''
      };

      this.originalUser = { ...this.user };
      this.sharedUserService.updateUserProfile(this.user);

      // Aquí asignamos el valor de `userCargoSeleccionado` basado en el backend
      this.userCargoSeleccionado = this.currentCargo?.key || '';
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
      cargo: '',
      cedula: '',
      correo: '',
      telefono: '',
      fecha_nacimiento: '',
      avatarUrl: null,
      rol: ''
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
      this.user.cedula !== this.originalUser.cedula ||
      this.user.cargo !== this.originalUser.cargo ||
      this.user.correo !== this.originalUser.correo ||
      this.user.fecha_nacimiento !== this.originalUser.fecha_nacimiento ||
      this.user.telefono !== this.originalUser.telefono ||
      this.selectedFile !== null;
  }

  validarTelefono(): void {
    this.user.telefono = this.generalFunctions.validarSoloNumeros(this.user.telefono); // Limpia caracteres no numéricos
    this.mostrarErrorTelefono = !this.generalFunctions.isValidPhone(this.user.telefono);
  }

  isPersonalInfoValid(): boolean {
    const nombreValido = !!this.user.nombre && /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(this.user.nombre);
    const correoValido = this.generalFunctions.isValidEmail(this.user.correo);
    const telefonoValido = this.generalFunctions.isValidPhone(this.user.telefono);

    return nombreValido && correoValido && telefonoValido;
  }

  toggleShowPassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleShowConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
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

      // Actualiza el nombre en el AuthService y SharedUserService
      console.log('this.user', this.user);
      this.authService.refreshUserData({ nombre: this.user.nombre });
      this.sharedUserService.updateUserProfile(this.user);

      this.selectedFile = null;
      this.isFormEdited = false;
      this.originalUser = { ...this.user };
      console.log('originalUser', this.originalUser);

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
    console.log('this.user 2:', this.user);
    const userData = {
      nombre: this.user.nombre,
      cedula: this.user.cedula,
      correo: this.user.correo,
      telefono: this.user.telefono,
      avatarUrl: this.user.avatarUrl,
      cargo: this.user.cargo,
      fecha_nacimiento: this.user.fecha_nacimiento,
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