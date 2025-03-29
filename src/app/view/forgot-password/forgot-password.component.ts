import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { SwalService } from '../../core/services/swal/swal.service'; // Importa el servicio de SweetAlert2

@Component({
  selector: 'app-forgot-password',
  standalone: false,
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent implements OnInit {
  forgotPasswordForm: FormGroup;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private location: Location,
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private router: Router,
    private swalService: SwalService
  ) {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit() { }

  onSubmit() {
    if (this.forgotPasswordForm.valid) {
      this.isLoading = true;
      const email = this.forgotPasswordForm.value.email;

      this.http.post(`${environment.apiUrl}/auth/forgot-password`, { email })
        .subscribe({
          next: (response) => {
            this.isLoading = false;
            /* this.snackBar.open('Se ha enviado un correo con instrucciones para restablecer tu contraseña', 'Cerrar', {
               duration: 5000
             });*/
            this.swalService.showSuccess('¡Éxito!', 'Se ha enviado un correo con instrucciones para restablecer tu contraseña')
              .then(() => {
                this.router.navigate(['/login']); // Redirigir al inicio de sesión
              });

          },
          error: (error) => {
            this.isLoading = false;

            const errorMessage = error.error?.message
              ? error.error.message === 'El correo no esta registrado.'
                ? 'No existe una cuenta asociada a este correo electrónico'
                : error.error.message
              : error.status === 404
                ? 'No existe una cuenta asociada a este correo electrónico'
                : 'Ocurrió un error al procesar tu solicitud';

            this.swalService.showError('Error', errorMessage);
          }
        });
    } else {
      this.forgotPasswordForm.markAllAsTouched();
    }
  }

  goBack() {
    this.location.back();
  }
}