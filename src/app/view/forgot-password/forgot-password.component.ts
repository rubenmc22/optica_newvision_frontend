import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { SwalService } from '../../core/services/swal/swal.service';
import { GeneralFunctions } from '../../general-functions/general-functions';

@Component({
  selector: 'app-forgot-password',
  standalone: false,
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent implements OnInit {
  forgotPasswordForm: FormGroup;
  isLoading = false;
  infoExpanded = false;

  constructor(
    private fb: FormBuilder,
    private location: Location,
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private router: Router,
    private swalService: SwalService,
    private generalFunctions: GeneralFunctions,
  ) {
    this.forgotPasswordForm = this.fb.group({
      email: [
        '',
        [
          Validators.required,
          Validators.pattern('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$')
        ]
      ]
    });

    this.forgotPasswordForm.get('email')?.valueChanges.subscribe(() => {
      this.forgotPasswordForm.get('email')?.markAsTouched();
    });
  }


  isInvalidField(field: string): boolean {
    const control = this.forgotPasswordForm.get(field);
    return control ? control.invalid && control.value !== '' : false;
  }

  ngOnInit() { }

  get email() {
    return this.forgotPasswordForm.get('email');
  }

  toggleInfo() {
  this.infoExpanded = !this.infoExpanded;
}

  onSubmit() {
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }
  
    this.isLoading = true;
    const { email } = this.forgotPasswordForm.value;
  
    this.http.post(`${environment.apiUrl}/auth/forgot-password`, { email })
      .subscribe({
        next: () => this.handleSuccess(),
        error: (error) => this.handleError(error)
      });
  }
  
  private handleSuccess() {
    this.isLoading = false;
    this.swalService.showSuccess(
      '¡Éxito!', 
      'Se ha enviado un correo con instrucciones para restablecer tu contraseña'
    ).then(() => {
      this.router.navigate(['/login']);
    });
  }
  
  private handleError(error: any) {
    this.isLoading = false;
    const errorMessage = this.getErrorMessage(error);
    this.swalService.showError('Error', errorMessage);
  }
  
  private getErrorMessage(error: any): string {
    if (error.error?.message) {
      return error.error.message === 'El correo no esta registrado.' 
        ? 'No existe una cuenta asociada a este correo electrónico'
        : error.error.message;
    }
    
    return error.status === 404
      ? 'No existe una cuenta asociada a este correo electrónico'
      : 'Ocurrió un error al procesar tu solicitud';
  }

  goBack() {
    this.location.back();
  }
}