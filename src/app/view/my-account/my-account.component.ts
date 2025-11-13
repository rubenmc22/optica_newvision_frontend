import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { SwalService } from '../../core/services/swal/swal.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { ChangeInformationService } from '../../core/services/changePassword/change-information.service';
import { SharedUserService } from '../../core/services/sharedUser/shared-user.service';
import { UserProfile, ApiUser } from './my-account-interface';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { lastValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';
import * as bootstrap from 'bootstrap';
import { GeneralFunctions } from '../../general-functions/general-functions';
import { LoaderService } from '../../shared/loader/loader.service';


@Component({
  selector: 'app-my-account',
  standalone: false,
  templateUrl: './my-account.component.html',
  styleUrls: ['./my-account.component.scss']
})

export class MyAccountComponent implements OnInit {
  // ============================================================
  // Propiedades generales del componente
  // ============================================================
  activeTab: string = 'personalInfo';
  isFormEdited = false;
  currentRol: { key: string; name: string } | null = null;
  currentCargo: { key: string; name: string } | null = null;
  userCargoSeleccionado: string = '';
  otpFlow: 'password' | 'uniquePassword' = 'password';

  // ============================================================
  // Propiedades relacionadas con la edición de perfil
  // ============================================================
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
  avatarPreview: string | ArrayBuffer | null = null;
  selectedFile: File | null = null;
  isSavingProfile = false;
  mostrarErrorTelefono = false;
  maxDate: string = '';
  isFechaFutura: boolean = false;

  // ============================================================
  // Propiedades relacionadas con cambio de contraseña de acceso
  // ============================================================
  contrasena = '';
  confirmarContrasena = '';
  passwordValid = false;
  passwordsMatch = false;
  formValid = false;
  showPassword = false;
  showConfirmPassword = false;
  isSendingOtp = false;
  isChangingPassword = false;
  isVerifyingOtp = false;
  otpError: string = '';

  // ============================================================
  // Propiedades relacionadas con contraseña única
  // ============================================================
  uniquePassword = '';
  showUniquePassword = false;
  uniquePasswordValid = false;
  existingUniquePassword = false;

  // ============================================================
  // Nuevas propiedades requeridas para el template
  // ============================================================
  successMessage: string = '';
  resendCooldown: number = 0;
  otpCodeArray: string[] = new Array(6).fill(''); // Array para campos individuales
  otpCode: string = ''; // Mantener string para compatibilidad con métodos existentes

  constructor(
    private router: Router,
    private swalService: SwalService,
    private authService: AuthService,
    private changeInformationService: ChangeInformationService,
    private sharedUserService: SharedUserService,
    private snackBar: MatSnackBar,
    private cdRef: ChangeDetectorRef,
    private generalFunctions: GeneralFunctions,
    private loader: LoaderService
  ) { }

  // ============================================================
  // Métodos del ciclo de vida de Angular
  // ============================================================
  ngOnInit(): void {
    this.setupFieldChangeListeners();
    this.currentRol = this.authService.getCurrentRol() || { key: '', name: '' };
    this.currentCargo = this.authService.getCurrentCargo() || { key: '', name: '' };
    this.loadUserData();
    this.setMaxDate();
  }

  ngAfterViewInit(): void {
    // Forzar detección de cambios después de que la vista se renderice
    setTimeout(() => {
      this.cdRef.detectChanges();
    }, 1000);
  }

  // ============================================================
  // Métodos generales y de utilidad
  // ============================================================
  private loadUserData(): void {
    this.loader.show(); // Mostrar loader al cargar datos

    const cedula = this.authService.getCurrentUser()?.cedula?.trim();
    console.log('cedula', cedula);
    if (!cedula) {
      console.warn('No se encontró cédula en la sesión');
      this.user = this.getDefaultUserProfile();
      this.loader.hide(); // Ocultar loader si hay error
      return;
    }

    this.changeInformationService.getUsuarioPorCedula(cedula).subscribe({
      next: (usuario) => {
        if (!usuario) {
          console.warn('No se encontró usuario en la API');
          this.user = this.getDefaultUserProfile();
          return;
        }

        this.user = {
          nombre: usuario.nombre?.trim() || '',
          cedula: usuario.cedula?.trim() || '',
          cargo: usuario.cargo?.id || '',
          correo: usuario.correo?.trim() || '',
          telefono: usuario.telefono?.trim() || '',
          fecha_nacimiento: usuario.fecha_nacimiento || null,
          avatarUrl: usuario.avatar_url || null,
          ruta_imagen: usuario.ruta_imagen || null,
          rol: usuario.rol?.id || ''
        };

        this.originalUser = { ...this.user };
        this.sharedUserService.updateUserProfile(this.user);
        this.userCargoSeleccionado = usuario.cargo?.id || '';
      },
      error: (error) => {
        console.error('Error cargando datos del usuario:', error);
        this.loader.forceHide(); // Forzar ocultar loader en error
      },
      complete: () => {
        this.loader.hide(); // Ocultar loader al completar
      }
    });
  }


  get tooltipMessage(): string {
    const isDisabled = !this.isFormEdited || !this.isPersonalInfoValid();
    const message = isDisabled
      ? 'Complete todos los campos requeridos para habilitar el guardado'
      : '';

    console.log('=== TOOLTIP DEBUG ===');
    console.log('isDisabled:', isDisabled);
    console.log('isFormEdited:', this.isFormEdited);
    console.log('isPersonalInfoValid():', this.isPersonalInfoValid());
    console.log('Tooltip message:', message);
    console.log('=== END DEBUG ===');

    return message;
  }

  isPersonalInfoValid(): boolean {
    const nombreValido = !!this.user.nombre?.trim() &&
      /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(this.user.nombre);
    const correoValido = this.generalFunctions.isValidEmail(this.user.correo);
    const telefonoValido = this.generalFunctions.isValidPhone(this.user.telefono);
    const fechaValida = !!this.user.fecha_nacimiento && !this.isFechaFutura;

    return nombreValido && correoValido && telefonoValido && fechaValida;
  }

  private setMaxDate(): void {
    const today = new Date();
    this.maxDate = today.toISOString().split('T')[0];
  }

  validateFechaNacimiento(): void {
    if (!this.user.fecha_nacimiento) {
      this.isFechaFutura = false;
      return;
    }

    const selectedDate = new Date(this.user.fecha_nacimiento);
    const today = new Date();

    // Resetear la hora para comparar solo fechas
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    this.isFechaFutura = selectedDate > today;

    if (this.isFechaFutura) {
      this.detectChanges();
    }
  }

  onFechaNacimientoChange(): void {
    this.validateFechaNacimiento();
    this.detectChanges();
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

    console.log('=== DEBUG CHANGES ===');
    console.log('isFormEdited:', this.isFormEdited);
    console.log('Original nombre:', this.originalUser.nombre);
    console.log('Current nombre:', this.user.nombre);
    console.log('Are different:', this.user.nombre !== this.originalUser.nombre);
    console.log('=== END CHANGES ===');
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

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/default-photo.png';
    console.warn('Error al cargar la imagen', this.user.ruta_imagen);
  }

  eliminarFoto(): void {
    this.swalService.showConfirm(
      'Eliminar foto de perfil',
      '¿Estás seguro de que deseas eliminar tu foto de perfil?',
      'Eliminar',
      'Cancelar'
    ).then((result) => {
      if (result.isConfirmed) {
        this.eliminarFotoDelServidor();
      }
    });
  }

  private eliminarFotoDelServidor(): void {
    this.isSavingProfile = true;

    /* this.changeInformationService.deleteProfileImage().subscribe({
         next: (response) => {
             // Resetear la imagen en el frontend
             this.user.ruta_imagen = '';
             this.user.avatarUrl = null;
             this.avatarPreview = null;
             this.selectedFile = null;
             
             // Actualizar en el servicio de autenticación
             this.authService.updateProfileImage('');
             this.sharedUserService.updateUserProfile(this.user);
             
             // Actualizar el estado del formulario
             this.detectChanges();
             this.cdRef.detectChanges();
             
             this.isSavingProfile = false;
             this.swalService.showSuccess('Éxito', 'Foto de perfil eliminada correctamente');
         },
         error: (error) => {
             console.error('Error eliminando foto:', error);
             this.isSavingProfile = false;
             this.swalService.showError('Error', 'No se pudo eliminar la foto de perfil');
         }
     });*/
  }

  validateNumberInput(event: KeyboardEvent): boolean {
    const charCode = event.key.charCodeAt(0);
    const isNumber = charCode >= 48 && charCode <= 57;
    const isControlKey = [8, 9, 13, 37, 39, 46].includes(event.keyCode);

    return isNumber || isControlKey;
  }

  openModal(modalId: string): void {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
      new bootstrap.Modal(modalElement).show();
    }
  }

  // ============================================================
  // Métodos para la edición de perfil
  // ============================================================
  validarTelefono(): void {
    this.user.telefono = this.generalFunctions.validarSoloNumeros(this.user.telefono);
    this.mostrarErrorTelefono = !this.generalFunctions.isValidPhone(this.user.telefono);
  }

  getValidationStatus(): { campo: string, valido: boolean, mensaje: string }[] {
    return [
      {
        campo: 'Nombre',
        valido: !!this.user.nombre?.trim() &&
          /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(this.user.nombre),
        mensaje: 'Debe contener solo letras y espacios'
      },
      {
        campo: 'Correo',
        valido: this.generalFunctions.isValidEmail(this.user.correo),
        mensaje: 'Debe ser un correo válido'
      },
      {
        campo: 'Teléfono',
        valido: this.generalFunctions.isValidPhone(this.user.telefono),
        mensaje: 'Debe tener 11 dígitos'
      },
      {
        campo: 'Fecha de Nacimiento',
        valido: !!this.user.fecha_nacimiento,
        mensaje: 'Debe seleccionar una fecha'
      }
    ];
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

      this.authService.refreshUserData({ nombre: this.user.nombre });
      this.sharedUserService.updateUserProfile(this.user);

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

    console.log('=== DEBUG UPLOAD IMAGE ===');
    console.log('FormData field name:', 'profileImage');
    console.log('File object:', file);

    // Verificar contenido del FormData
    console.log('FormData contents:');
    for (let pair of (formData as any).entries()) {
      console.log('Key:', pair[0], 'Value:', pair[1]);
    }
    console.log('=== END DEBUG ===');

    try {
      const response = await lastValueFrom(
        this.changeInformationService.uploadProfileImage(formData)
      );

      if (!response?.image_url) {
        throw new Error('No se recibió URL de imagen');
      }

      this.user.ruta_imagen = response.image_url;
      this.user.avatarUrl = response.image_url;
      this.authService.updateProfileImage(response.image_url);
      this.cdRef.detectChanges();
      this.sharedUserService.updateUserProfile(this.user);

      return response.image_url;
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      console.error('Error completo:', error);
      if (error.error) {
        console.error('Error response:', error.error);
      }
      throw error;
    }
  }

  private async sendUserData(): Promise<void> {
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

  // ============================================================
  // Métodos para cambio de contraseña de acceso
  // ============================================================
  toggleShowPassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleShowConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
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

    this.snackBar.open('Se enviará un código OTP para confirmar el cambio.', 'Cerrar', {
      duration: 5000,
      panelClass: ['info-snackbar']
    });

    this.otpFlow = 'password';
    this.isSendingOtp = true;

    // Resetear campos OTP
    this.resetOtpFields();
    this.otpError = '';

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

  // ============================================================
  // Métodos para fortaleza de contraseña
  // ============================================================

  getPasswordStrengthClass(): string {
    if (!this.contrasena) return '';

    const strength = this.calculatePasswordStrength(this.contrasena);

    switch (strength) {
      case 'weak': return 'weak';
      case 'medium': return 'medium';
      case 'strong': return 'strong';
      default: return '';
    }
  }

  getPasswordStrengthText(): string {
    if (!this.contrasena) return '';

    const strength = this.calculatePasswordStrength(this.contrasena);

    switch (strength) {
      case 'weak': return 'Débil';
      case 'medium': return 'Media';
      case 'strong': return 'Fuerte';
      default: return '';
    }
  }

  private calculatePasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
    if (password.length < 8) return 'weak';

    let score = 0;

    // Longitud mínima
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;

    // Diversidad de caracteres
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 3) return 'weak';
    if (score <= 5) return 'medium';
    return 'strong';
  }

  // ============================================================
  // Métodos para OTP con campos individuales
  // ============================================================

  /**
   * Maneja la entrada en campos OTP individuales
   */
  onOtpInput(index: number, event: any): void {
    const input = event.target;
    const value = input.value;

    // Solo permitir números
    if (!/^\d?$/.test(value)) {
      input.value = '';
      this.otpCodeArray[index] = '';
      this.updateFullOtpCode();
      return;
    }

    this.otpCodeArray[index] = value;
    this.updateFullOtpCode();

    // Auto-enfocar siguiente campo
    if (value && index < 5) {
      const nextInput = document.querySelectorAll('.otp-field')[index + 1] as HTMLInputElement;
      if (nextInput) nextInput.focus();
    }
  }

  /**
   * Maneja teclas en campos OTP
   */
  onOtpKeyDown(index: number, event: KeyboardEvent): void {
    // Manejar tecla backspace
    if (event.key === 'Backspace') {
      if (!this.otpCodeArray[index] && index > 0) {
        // Si el campo actual está vacío, retroceder al anterior
        const prevInput = document.querySelectorAll('.otp-field')[index - 1] as HTMLInputElement;
        if (prevInput) {
          prevInput.focus();
          prevInput.select();
        }
      } else {
        // Limpiar campo actual
        this.otpCodeArray[index] = '';
        this.updateFullOtpCode();
      }
    }

    // Manejar teclas de flecha
    if (event.key === 'ArrowLeft' && index > 0) {
      const prevInput = document.querySelectorAll('.otp-field')[index - 1] as HTMLInputElement;
      if (prevInput) prevInput.focus();
      event.preventDefault();
    }

    if (event.key === 'ArrowRight' && index < 5) {
      const nextInput = document.querySelectorAll('.otp-field')[index + 1] as HTMLInputElement;
      if (nextInput) nextInput.focus();
      event.preventDefault();
    }
  }

  /**
   * Actualiza el código OTP completo concatenando los campos individuales
   */
  private updateFullOtpCode(): void {
    this.otpCode = this.otpCodeArray.join('');
    this.cdRef.detectChanges();
  }

  /**
   * Verifica si todos los campos OTP están completos
   */
  isOtpComplete(): boolean {
    return this.otpCodeArray.every(char => char !== '');
  }

  /**
   * Reenvía el código OTP
   */
  resendOtp(): void {
    if (this.resendCooldown > 0) return;

    this.isSendingOtp = true;
    this.resendCooldown = 60; // 60 segundos de cooldown

    // Resetear campos OTP
    this.otpCodeArray = new Array(6).fill('');
    this.otpCode = '';
    this.otpError = '';

    // Enviar OTP
    this.changeInformationService.sendPasswordChangeOtp(this.user.correo).pipe(
      finalize(() => this.isSendingOtp = false)
    ).subscribe({
      next: (response) => {
        if (response.message === 'ok') {
          this.snackBar.open('Código OTP reenviado', 'Cerrar', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });

          // Iniciar cuenta regresiva
          const countdown = setInterval(() => {
            this.resendCooldown--;
            if (this.resendCooldown <= 0) {
              clearInterval(countdown);
            }
            this.cdRef.detectChanges();
          }, 1000);
        }
      },
      error: (error: HttpErrorResponse) => {
        const errorMsg = error.error?.message || 'No se pudo reenviar el OTP';
        this.swalService.showError('Error', errorMsg);
        this.resendCooldown = 0;
      }
    });
  }

  /**
   * Muestra modal de éxito
   */
  showSuccessModal(message: string): void {
    this.successMessage = message;
    this.openModal('successModal');
  }

  /**
   * Actualizado para usar otpCode (string) que se sincroniza con otpCodeArray
   */
  verifyOtp(flow: 'password' | 'uniquePassword'): void {
    this.otpError = '';

    if (!this.otpCode || this.otpCode.length !== 6 || !/^\d+$/.test(this.otpCode)) {
      this.otpError = 'Ingrese un código OTP válido de 6 dígitos numéricos';
      this.resetOtpFields();
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

          if (this.otpFlow === 'password') {
            this.confirmPasswordChange();
          } else if (this.otpFlow === 'uniquePassword') {
            this.saveUniquePasswordToDatabase();
          }
        } else {
          this.otpError = 'Código OTP incorrecto. Intente nuevamente.';
          this.resetOtpFields();
        }
      },
      error: (error) => {
        this.otpError = error.error?.message || 'Error al verificar el OTP';
        this.resetOtpFields();
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

  /**
   * Método auxiliar para resetear campos OTP
   */
  private resetOtpFields(): void {
    this.otpCodeArray = new Array(6).fill('');
    this.otpCode = '';
    this.cdRef.detectChanges();
  }

  /**
   * Actualizado para resetear ambos formatos de OTP
   */
  private resetPasswordFields(): void {
    this.contrasena = '';
    this.confirmarContrasena = '';
    this.resetOtpFields();
    this.passwordValid = false;
    this.passwordsMatch = false;
    this.formValid = false;
  }

  // ============================================================
  // Métodos para cambio de contraseña única
  // ============================================================
  toggleShowUniquePassword(): void {
    this.showUniquePassword = !this.showUniquePassword;
  }

  validateUniquePassword(): void {
    const regex = /^[a-zA-Z0-9!@#$%^&*()-_+=]{6,20}$/;
    this.uniquePasswordValid = regex.test(this.uniquePassword);
  }

  initiateUniquePasswordChange(): void {
    if (!this.uniquePasswordValid) {
      return;
    }

    this.otpFlow = 'uniquePassword';
    this.openModal('uniquePasswordModal');
  }

  confirmUniquePasswordChangeRequest(): void {
    this.snackBar.open('Se enviará un código OTP para confirmar el cambio.', 'Cerrar', {
      duration: 5000,
      panelClass: ['info-snackbar']
    });

    // Resetear campos OTP
    this.resetOtpFields();
    this.otpError = '';

    this.isVerifyingOtp = true;
    this.changeInformationService.sendPasswordChangeOtp(this.user.correo).pipe(
      finalize(() => this.isVerifyingOtp = false)
    ).subscribe({
      next: () => {
        this.openModal('otpModal');
      },
      error: (error: HttpErrorResponse) => {
        this.swalService.showError('Error', error.error?.message || 'No se pudo enviar el OTP.');
      }
    });
  }

  /**
   * Actualizado para usar otpCode (string)
   */
  saveUniquePasswordToDatabase(): void {
    this.changeInformationService.changeUniquePassword(this.user.correo, this.uniquePassword, this.otpCode).pipe(
      finalize(() => this.isChangingPassword = false)
    ).subscribe({
      next: () => {
        this.showSuccessModal('Contraseña única guardada correctamente.');
        this.uniquePassword = '';
        this.existingUniquePassword = true;
        this.resetOtpFields();
      },
      error: (error: HttpErrorResponse) => {
        const errorMsg = error.error?.message || 'Error al cambiar la contraseña única';
        this.swalService.showError('Error', errorMsg);
      }
    });
  }
}