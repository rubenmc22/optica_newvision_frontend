import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { GeneralFunctionsService } from '../services/general-functions/general-functions.service';

@Component({
  selector: 'app-crear-atletas',
  standalone: false,
  templateUrl: './crear-atletas.component.html',
  styleUrls: ['./crear-atletas.component.scss']
})
export class CrearAtletasComponent implements OnInit {
  crearAtletaForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private location: Location,
    private generalFunctions: GeneralFunctionsService // Inyecta el servicio
  ) {
    this.crearAtletaForm = this.fb.group({
      nombre: [
        '',
        [Validators.required, Validators.pattern('^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]*$')] // Solo caracteres alfabéticos
      ],
      cedula: [
        '',
        [Validators.required, Validators.pattern('^[0-9]{1,8}$')] // Cédula numérica, máximo 8 dígitos
      ],
      telefono: [
        '',
        [Validators.required, Validators.pattern('^[0-9]{1,12}$')] // Teléfono numérico, máximo 12 caracteres
      ],
      email: [
        '',
        [Validators.required, Validators.pattern('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$')] //Correo electrónico válido
      ],
      athleteDob: ['', Validators.required], // Fecha de nacimiento obligatoria
      genero: [
        '',
        [Validators.required] // Género obligatorio (Hombre o Mujer)
      ],
    });
  }

  ngOnInit() {
    // Verifica que el formulario esté correctamente inicializado
    console.log('Formulario inicializado:', this.crearAtletaForm.value);
  }

  // Verifica si un campo tiene errores o está vacío
  isInvalidField(fieldName: string): boolean {
    return this.generalFunctions.isInvalidField(this.crearAtletaForm, fieldName);
  }

  // Envía el formulario al servidor o lo procesa
  onSubmit() {
    if (this.crearAtletaForm.valid) {
      console.log('Formulario válido:', this.crearAtletaForm.value);
      // Lógica adicional para enviar los datos
      this.crearAtletaForm.reset(); // Limpia el formulario después del envío
    } else {
      console.error('Formulario inválido');
    }
  }

  // Navega hacia atrás en la vista
  goBack() {
    this.location.back();
  }
}
