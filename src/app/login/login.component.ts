import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SwalService } from '../core/services/swal/swal.service';
import { GeneralFunctionsService } from '../core/services/general-functions/general-functions.service';
import { AuthService } from '../core/services/auth/auth.service';
import { finalize } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  loading = false; // Variable para controlar el estado de carga

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private swalService: SwalService,
    private generalFunctions: GeneralFunctionsService,
    private authService: AuthService
  ) {
    this.loginForm = this.fb.group({
      cedula: [
        '',
        [Validators.required, Validators.pattern('^[0-9]{1,8}$')]
      ],
      password: [
        '',
        [Validators.required, Validators.minLength(6)]
      ]
    });
  }

  ngOnInit(): void {
    this.authService.clearAuth();
  }

  isInvalidField(fieldName: string): boolean {
    return this.generalFunctions.isInvalidField(this.loginForm, fieldName);
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true; // Activar estado de carga

    this.authService.login(
      this.loginForm.value.cedula,
      this.loginForm.value.password
    ).pipe(
      finalize(() => this.loading = false) // Desactivar carga al finalizar
    ).subscribe({
      next: () => {
        this.router.navigate(['/dashboard'], { replaceUrl: true });
      },
      error: (err: HttpErrorResponse) => {
        const message = err.error?.message === 'Credenciales inválidas.'
          ? 'Estimado usuario, las credenciales ingresadas son inválidas.'
          : err.error?.message || 'Error durante el login';

        this.swalService.showError('Error', message);
      }
    });
  }
}