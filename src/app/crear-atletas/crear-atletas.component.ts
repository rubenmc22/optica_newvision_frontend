import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Location } from '@angular/common';

@Component({
  selector: 'app-crear-atletas',
  standalone: false,
  templateUrl: './crear-atletas.component.html',
  styleUrls: ['./crear-atletas.component.scss']
})
export class CrearAtletasComponent implements OnInit {
  crearAtletaForm: FormGroup;

  constructor(private fb: FormBuilder, private location: Location) {
    this.crearAtletaForm = this.fb.group({
      isMinor: [false], // Switch para menor o mayor de edad
      representativeName: [''], // Nombre del representante
      representativeId: [''], // Cédula del representante
      representativeEmail: [''], // Correo del representante
      password: ['', Validators.required], // Contraseña
      confirmPassword: ['', Validators.required], // Confirmación de contraseña
      athleteName: ['', Validators.required], // Nombre del atleta
      athleteId: [''], // Cédula del atleta
      athleteEmail: [''], // Correo del atleta
      athleteDob: ['', Validators.required], // Fecha de Nacimiento
      athleteAge: ['', [Validators.required, Validators.min(10)]], // Edad
      genero: ['', Validators.required], // Género
      deporte: ['', Validators.required] // Deporte
    });
  }

  ngOnInit() {
    // Escucha los cambios en el estado de isMinor (menor o mayor de edad)
    this.crearAtletaForm.get('isMinor')?.valueChanges.subscribe(isMinor => {
      if (isMinor) {
        // Si es menor de edad, activa los validadores del representante y desactiva los del atleta
        this.setValidators(['representativeName', 'representativeId', 'representativeEmail'], Validators.required);
        this.clearValidators('athleteId', 'athleteEmail');
      } else {
        // Si es mayor de edad, activa los validadores del atleta y desactiva los del representante
        this.setValidators(['athleteId', 'athleteEmail'], Validators.required);
        this.clearValidators('representativeName', 'representativeId', 'representativeEmail');
      }
    });
  }

  // Método para configurar los validadores dinámicamente
  setValidators(fields: string[], validator: any) {
    fields.forEach(field => {
      this.crearAtletaForm.get(field)?.setValidators(validator);
      this.crearAtletaForm.get(field)?.updateValueAndValidity();
    });
  }

  // Método para limpiar los validadores dinámicamente
  clearValidators(...fields: string[]) {
    fields.forEach(field => {
      this.crearAtletaForm.get(field)?.clearValidators();
      this.crearAtletaForm.get(field)?.updateValueAndValidity();
    });
  }

  // Maneja la acción del formulario al enviarse
  onSubmit() {
    if (this.crearAtletaForm.valid) {
      console.log('Formulario válido:', this.crearAtletaForm.value);
      // Lógica adicional, como enviar los datos al servidor
      this.crearAtletaForm.reset(); // Limpia el formulario después de enviarlo
    } else {
      console.error('Formulario inválido');
    }
  }

  // Navegar hacia atrás
  goBack() {
    this.location.back();
  }
}
