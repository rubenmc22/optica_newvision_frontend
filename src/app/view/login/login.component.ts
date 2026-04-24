import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SwalService } from '../../core/services/swal/swal.service';
import { GeneralFunctions } from '../../general-functions/general-functions';
import { AuthService } from '../../core/services/auth/auth.service';
import { UserStateService } from '../../core/services/userState/user-state-service';
import { finalize } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { LoaderService } from './../../shared/loader/loader.service';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  isLoading: boolean = false;
  showPassword: boolean = false;
  sedes: any[] = [];


  constructor(
    private fb: FormBuilder,
    private router: Router,
    private swalService: SwalService,
    private generalFunctions: GeneralFunctions,
    private authService: AuthService,
    public loader: LoaderService,
    private userStateService: UserStateService,
  ) {
    this.loginForm = this.fb.group({
      sede: ['', Validators.required],
      cedula: [
        '',
        [Validators.required, Validators.pattern('^[0-9]{1,8}$')]
      ],
      password: [
        '',
        [Validators.required, Validators.minLength(6)]
      ],
      rememberMe: [false]
    });

  }

  ngOnInit(): void {
    this.authService.clearAuth();
    this.loadSavedCredentials();
    this.obtenerSedes();
  }

  private loadSavedCredentials(): void {
    const savedCedula = localStorage.getItem('cedula');
    const savedPassword = localStorage.getItem('password');
    const savedSede = localStorage.getItem('sedeRecordada'); // 👈 nueva línea

    if (savedCedula && savedPassword) {
      this.loginForm.patchValue({
        cedula: savedCedula,
        password: savedPassword,
        sede: savedSede ?? '', // 👈 establecer la sede recordada
        rememberMe: true
      });
    }
  }


  isInvalidField(fieldName: string): boolean {
    return this.generalFunctions.isInvalidField(this.loginForm, fieldName);
  }

  obtenerSedes(): void {
    this.authService.getSedes().subscribe({
      next: (response) => {
        this.sedes = response.sedes;
      },
      error: (err) => {
        console.error('Error cargando sedes:', err);
      }
    });
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const { cedula, password, sede, rememberMe } = this.loginForm.value;

    try {
      // 🔥 FLUJO COMPLETO CON MÚLTIPLES ESTADOS
      this.loader.showWithMessage('🔍 Validando datos...');

      await this.delay(300);
      this.loader.updateMessage('🔐 Conectando de forma segura...');

      await this.delay(300);
      this.loader.updateMessage('👤 Verificando credenciales...');

      this.authService.login(cedula, password, sede).pipe(
        finalize(() => {
          this.isLoading = false;
        })
      ).subscribe({
        next: async (authData) => {
          this.loader.updateMessage('✅ ¡Acceso autorizado!');
          await this.delay(500);

          this.loader.updateMessage('🚀 Redirigiendo al dashboard...');

          // Guardar credenciales
          if (rememberMe) {
            localStorage.setItem('cedula', cedula);
            localStorage.setItem('password', password);
            localStorage.setItem('sedeRecordada', sede);
          } else {
            localStorage.removeItem('cedula');
            localStorage.removeItem('password');
            localStorage.removeItem('sedeRecordada');
          }

          this.userStateService.setUserFromAuth(authData);
          //Marcar que la navegación viene del login
          sessionStorage.setItem('fromLogin', 'true');

          await this.delay(800);
          this.loader.hide();

          this.router.navigate(['/dashboard'], { replaceUrl: true });
          localStorage.removeItem('selectedMenuLabel');
          localStorage.removeItem('selectedSubmenuLabel');
        },
        error: async (err: HttpErrorResponse) => {
          // 🔥 ERROR - TRANSICIÓN CLARA
          const message = err.error?.message === 'Credenciales inválidas.'
            ? '❌ Estimado usuario, las credenciales ingresadas son inválidas.'
            : '❌ ' + (err.error?.message || 'Error durante el login');

          this.loader.updateMessage(message);
          await this.delay(1500);
          this.loader.hide();
          // this.swalService.showError('Error', message);
        }
      });

    } catch (error) {
      this.isLoading = false;
      this.loader.hide();
    }
  }

  // 🔧 MÉTODO AUXILIAR PARA DELAYS
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  /* private showTermsAndContinue(authData: AuthData) {
     const termsText = `
       <div style="text-align: left; max-height: 60vh; overflow-y: auto; padding: 0 10px;">
         <h4 style="color: #ffc107; margin-bottom: 15px;">TÉRMINOS Y CONDICIONES DE APOLLO GROUP</h4>
         
         <p style="margin-bottom: 10px;">
           Al registrarse en nuestra plataforma deportiva, cada miembro acepta:
         </p>
         
         <ul style="padding-left: 20px; margin-bottom: 15px;">
           <li>Cumplir con las disposiciones establecidas para su correcto uso</li>
           <li>Proporcionar información veraz y actualizada</li>
           <li>Autorizar el tratamiento de sus datos personales exclusivamente para fines relacionados con la operación y el desarrollo de la plataforma o actividad deportiva</li>
         </ul>
         
         <p>
           Garantizando así una experiencia organizada, segura y beneficiosa para toda la comunidad deportiva.
         </p>
       </div>
     `;
 
     this.swalService.showConfirm(
       'Términos y Condiciones',
       termsText,
       'Aceptar TyC',
       'Cancelar'
     ).then((result) => {
       if (result.isConfirmed) {
         this.isLoading = true;
         this.authService.acceptTermsAndConditions().subscribe({
           next: () => {
             const isFirstAcceptance = !authData.user?.tyc_aceptado;
 
             if (isFirstAcceptance) {
               // Mensaje combinado usando text (no podemos usar html)
               const messageLines = [
                 '¡Bienvenido!',
                 'Has aceptado los términos y condiciones correctamente',
                 '',
                 'Redirigiendo a tu dashboard...'
               ];
 
               this.swalService.showSuccess(
                 'Aceptación exitosa',
                 messageLines.join('\n') // Usamos saltos de línea para formato
               ).then(() => {
                 setTimeout(() => {
                   this.router.navigate(['/dashboard'], { replaceUrl: true });
                 }, 1000);
               });
 
             } else {
               // Mensaje normal para logins posteriores
               this.swalService.showSuccess(
                 '¡Éxito!',
                 'Bienvenido de nuevo, has iniciado sesión correctamente'
               );
               this.router.navigate(['/dashboard'], { replaceUrl: true });
             }
           },
           error: (err) => {
             this.swalService.showError('Error', 'No se pudo registrar la aceptación de los términos');
             this.authService.logout();
           },
           complete: () => {
             this.isLoading = false;
           }
         });
       } else {
         this.authService.logout();
         this.swalService.showInfo(
           'Acción requerida',
           'Debes aceptar los términos y condiciones para acceder a la plataforma'
         );
       }
     });
   }*/

  toggleShowPassword(): void {
    this.showPassword = !this.showPassword;
  }


}