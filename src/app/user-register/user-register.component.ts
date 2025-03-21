import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Location } from '@angular/common';

@Component({
  selector: 'app-user-register',
  standalone: false,
  templateUrl: './user-register.component.html',
  styleUrls: ['./user-register.component.scss']
})
export class UserRegisterComponent implements OnInit {
  registerForm: FormGroup;

  constructor(private fb: FormBuilder, private location: Location) {
    // Creación del formulario con validaciones iniciales
    this.registerForm = this.fb.group({
      isMinor: [false], // Determina si es representante
      representativeName: ['', [Validators.pattern('^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]*$')]], // Nombre del representante
      representativeId: ['', [Validators.pattern('^[0-9]{1,8}$')]], // Cédula del representante
      representativePhone: ['', [Validators.pattern('^[0-9]{1,12}$')]], // Teléfono del representante
      representativeEmail: ['', [Validators.pattern('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$')]], // Correo del representante
      athleteName: ['', [Validators.required, Validators.pattern('^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]*$')]], // Nombre del atleta
      athleteId: ['', [Validators.required, Validators.pattern('^[0-9]{1,8}$')]], // Cédula del atleta
      athletePhone: ['', [Validators.required, Validators.pattern('^[0-9]{1,12}$')]], // Teléfono del atleta
      athleteEmail: ['', [Validators.required, Validators.pattern('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$')]], // Correo del atleta
      athleteDob: ['', Validators.required], // Fecha de nacimiento del atleta
      genero: ['', Validators.required], // Género del atleta
      password: [
        '',
        [Validators.required, Validators.pattern('^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d@$!%*?&]{8,}$')] // Contraseña válida
      ],
      confirmPassword: ['', Validators.required], // Confirmación de contraseña
    }, { validator: this.passwordMatchValidator });
  }

  ngOnInit() {
    // Escucha los cambios en el estado de isMinor (si es representante o atleta)
    this.registerForm.get('isMinor')?.valueChanges.subscribe(isMinor => {
      if (isMinor) {
        // Validaciones para representante
        this.setValidators(['representativeName', 'representativeId', 'representativePhone', 'representativeEmail'], Validators.required);
        this.clearValidators('athleteName', 'athleteId', 'athletePhone', 'athleteEmail', 'athleteDob', 'genero');
      } else {
        // Validaciones para atleta
        this.setValidators(['athleteName', 'athleteId', 'athletePhone', 'athleteEmail', 'athleteDob', 'genero'], Validators.required);
        this.clearValidators('representativeName', 'representativeId', 'representativePhone', 'representativeEmail');
      }
    });
  }

  // Método para configurar validadores dinámicamente
  setValidators(fields: string[], validator: any) {
    fields.forEach(field => {
      this.registerForm.get(field)?.setValidators(validator);
      this.registerForm.get(field)?.updateValueAndValidity();
    });
  }

  // Método para limpiar los validadores de campos
  clearValidators(...fields: string[]) {
    fields.forEach(field => {
      this.registerForm.get(field)?.clearValidators();
      this.registerForm.get(field)?.updateValueAndValidity();
    });
  }

  // Validación personalizada para confirmar que las contraseñas coincidan
  passwordMatchValidator(form: FormGroup): null | { passwordsMismatch: true } {
    const password = form.get('password')?.value || '';
    const confirmPassword = form.get('confirmPassword')?.value || '';
    return password === confirmPassword ? null : { passwordsMismatch: true };
  }

  // Verifica si un campo tiene errores
  isInvalidField(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!field && field.invalid && field.dirty && field.value !== ''; // No muestra error si está vacío
  }

  // Enviar el formulario
  onSubmit() {
    if (this.registerForm.valid) {
      console.log('Formulario válido:', this.registerForm.value);
      // Lógica para procesar los datos, como enviarlos al servidor
      this.registerForm.reset(); // Limpia el formulario después de enviarlo
    } else {
      console.error('Formulario inválido');
    }
  }

  // Regresar a la vista anterior
  goBack() {
    this.location.back();
  }
}
