import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { Location } from '@angular/common';
import { Router } from '@angular/router'; // Importa el Router
import { SwalService } from '../core/services/swal/swal.service'; // Importa el servicio de SweetAlert2
import { GeneralFunctionsService } from '../core/services/general-functions/general-functions.service';

@Component({
  selector: 'app-user-register',
  standalone: false,
  templateUrl: './user-register.component.html',
  styleUrls: ['./user-register.component.scss']
})
export class UserRegisterComponent implements OnInit {
  registerForm: FormGroup;

  // Propiedades para los controles dinámicos
  nameControl: FormControl;
  idControl: FormControl;
  phoneControl: FormControl;
  emailControl: FormControl;

  constructor(
    private fb: FormBuilder,
    private location: Location,
    private router: Router, // Inyecta el Router
    private swalService: SwalService, // Inyecta el servicio de SweetAlert2
    private generalFunctions: GeneralFunctionsService // Inyecta el servicio
  ) {
    // Inicialización del formulario sin validaciones requeridas inicialmente
    this.registerForm = this.fb.group({
      isMinor: [false], // Determina si es representante
      representativeName: ['', []], // Nombre del representante
      representativeId: ['', []], // Cédula del representante
      representativePhone: ['', []], // Teléfono del representante
      representativeEmail: ['', []], // Correo del representante
      athleteName: ['', []], // Nombre del atleta
      athleteId: ['', []], // Cédula del atleta
      athletePhone: ['', []], // Teléfono del atleta
      athleteEmail: ['', []], // Correo del atleta
      athleteDob: ['', []], // Fecha de nacimiento del atleta
      genero: ['', []], // Género del atleta
      password: [
        '',
        [Validators.required, Validators.pattern('^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d@$!%*?&]{8,}$')] // Contraseña válida
      ],
      confirmPassword: ['', Validators.required] // Confirmación de contraseña
    }, { validator: this.passwordMatchValidator });

    // Inicializar los controles dinámicos
    this.nameControl = this.registerForm.get('athleteName') as FormControl;
    this.idControl = this.registerForm.get('athleteId') as FormControl;
    this.phoneControl = this.registerForm.get('athletePhone') as FormControl;
    this.emailControl = this.registerForm.get('athleteEmail') as FormControl;
  }

  ngOnInit() {
    // Escucha los cambios en el estado de isMinor para activar las validaciones correctas
    this.registerForm.get('isMinor')?.valueChanges.subscribe(isMinor => {
      if (isMinor) {
        this.applyRepresentativeValidations();
        this.updateDynamicControls('representativeName', 'representativeId', 'representativePhone', 'representativeEmail');
      } else {
        this.applyAthleteValidations();
        this.updateDynamicControls('athleteName', 'athleteId', 'athletePhone', 'athleteEmail');
      }
    });

    // Aplica las validaciones iniciales
    this.applyAthleteValidations(); // Por defecto, consideramos que no es representante al cargar
  }

  // Actualiza los controles dinámicos
  private updateDynamicControls(nameField: string, idField: string, phoneField: string, emailField: string) {
    this.nameControl = this.registerForm.get(nameField) as FormControl;
    this.idControl = this.registerForm.get(idField) as FormControl;
    this.phoneControl = this.registerForm.get(phoneField) as FormControl;
    this.emailControl = this.registerForm.get(emailField) as FormControl;
  }

  // Aplica validaciones para representante
  private applyRepresentativeValidations() {
    // Limpiar validadores de atleta
    this.clearValidators('athleteName', 'athleteId', 'athletePhone', 'athleteEmail', 'athleteDob', 'genero');

    // Aplicar validaciones para representante
    this.setValidators('representativeName', [Validators.required, Validators.pattern('^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]*$')]);
    this.setValidators('representativeId', [Validators.required, Validators.pattern('^[0-9]{1,8}$')]);
    this.setValidators('representativePhone', [Validators.required, Validators.pattern('^[0-9]{1,12}$')]);
    this.setValidators('representativeEmail', [
      Validators.required,
      Validators.pattern('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$')
    ]);

    // Reiniciar el estado de los campos del representante
    this.markFieldsAsPristineAndUntouched('representativeName', 'representativeId', 'representativePhone', 'representativeEmail');

    // Actualizar el formulario
    this.registerForm.updateValueAndValidity();
  }

  // Aplica validaciones para atleta
  private applyAthleteValidations() {
    // Limpiar validadores de representante
    this.clearValidators('representativeName', 'representativeId', 'representativePhone', 'representativeEmail');

    // Aplicar validaciones para atleta
    this.setValidators('athleteName', [Validators.required, Validators.pattern('^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]*$')]);
    this.setValidators('athleteId', [Validators.required, Validators.pattern('^[0-9]{1,8}$')]);
    this.setValidators('athletePhone', [Validators.required, Validators.pattern('^[0-9]{1,12}$')]);
    this.setValidators('athleteEmail', [
      Validators.required,
      Validators.pattern('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$')
    ]);
    this.setValidators('athleteDob', [Validators.required]);
    this.setValidators('genero', [Validators.required]);

    // Reiniciar el estado de los campos del atleta
    this.markFieldsAsPristineAndUntouched('athleteName', 'athleteId', 'athletePhone', 'athleteEmail', 'athleteDob', 'genero');

    // Actualizar el formulario
    this.registerForm.updateValueAndValidity();
  }

  // Configura validadores para un campo específico
  private setValidators(fieldName: string, validators: any[]) {
    const control = this.registerForm.get(fieldName);
    if (control) {
      control.setValidators(validators);
      control.updateValueAndValidity();
    }
  }

  // Limpia validadores de los campos especificados
  private clearValidators(...fieldNames: string[]) {
    fieldNames.forEach(fieldName => {
      const control = this.registerForm.get(fieldName);
      if (control) {
        control.clearValidators();
        control.updateValueAndValidity();
      }
    });
  }

  // Reinicia el estado de los campos (pristine y untouched)
  private markFieldsAsPristineAndUntouched(...fieldNames: string[]) {
    fieldNames.forEach(fieldName => {
      const control = this.registerForm.get(fieldName);
      if (control) {
        control.markAsPristine();
        control.markAsUntouched();
      }
    });
  }

  // Validación personalizada para contraseñas coincidentes
  passwordMatchValidator(form: FormGroup): null | { passwordsMismatch: true } {
    const password = form.get('password')?.value || '';
    const confirmPassword = form.get('confirmPassword')?.value || '';
    return password === confirmPassword ? null : { passwordsMismatch: true };
  }

  // Verifica si un campo tiene errores
  isInvalidField(fieldName: string): boolean {
    return this.generalFunctions.isInvalidField(this.registerForm, fieldName);
  }
  // Enviar el formulario
  onSubmit() {
    if (this.registerForm.valid) {
      const formData = { ...this.registerForm.value };
      const isMinor = formData.isMinor;

      // Convertir género a los valores esperados por el backend
      if (formData.genero === 'Mujer') {
        formData.genero = 'F';
      } else if (formData.genero === 'Hombre') {
        formData.genero = 'M';
      }

      // Determinar la URL del endpoint según el tipo de usuario
      const endpointUrl = isMinor
        ? "http://localhost:3200/api/auth/register-representative"
        : "http://localhost:3200/api/auth/register-athlete";

      // Ajustar el objeto formData antes del envío
      if (isMinor) {
        formData.athleteName = '';
        formData.athleteId = '';
        formData.athletePhone = '';
        formData.athleteEmail = '';
        formData.athleteDob = '';
        formData.genero = '';
      } else {
        formData.representativeName = '';
        formData.representativeId = '';
        formData.representativePhone = '';
        formData.representativeEmail = '';
      }

     
      console.log('Datos del formulario antes del envío:', JSON.stringify(formData));

      fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })
        .then(response => {
          if (!response.ok) {
            return response.json().then(err => {
              throw new Error(err.message || `Error en la solicitud: ${response.statusText}`);
            });
          }
          return response.json();
        })
        .then(data => {
          console.log('Respuesta del servidor:', data);
          this.swalService.showSuccess('¡Registro exitoso!', 'El registro se ha completado correctamente.')
            .then(() => {
              this.router.navigate(['/login']);
            });
          this.registerForm.reset();
        })
        .catch(error => {
          console.error('Hubo un problema con la solicitud:', error);
          this.swalService.showError(
            'Error en el registro',
            error.message || 'Hubo un problema al registrar. Por favor, inténtalo nuevamente.'
          );
        });
    } else {
      console.error('Formulario inválido');
      this.swalService.showWarning(
        'Formulario inválido',
        'Por favor, completa todos los campos obligatorios correctamente.'
      );
      // Marcar todos los campos como touched para mostrar errores
      Object.values(this.registerForm.controls).forEach(control => {
        control.markAsTouched();
      });
    }
  }

  // Regresar a la vista anterior
  goBack() {
    this.location.back();
  }
}