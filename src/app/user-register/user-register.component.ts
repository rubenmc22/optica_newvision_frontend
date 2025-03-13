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
    this.registerForm = this.fb.group({
      isMinor: [false],
      representativeName: [''],
      representativeId: [''],
      representativeEmail: [''],
      password: ['', Validators.required],
      confirmPassword: ['', Validators.required],
      athleteName: ['', Validators.required],
      athleteId: [''],
      athleteEmail: [''],
      athleteDob: ['', Validators.required], // Campo de Fecha de Nacimiento
      athleteAge: ['', Validators.required]  // Campo de Edad
    });
  }

  ngOnInit() {
    this.registerForm.get('isMinor')?.valueChanges.subscribe(isMinor => {
      if (isMinor) {
        this.setValidators(['representativeName', 'representativeId', 'representativeEmail'], Validators.required);
        this.clearValidators('athleteId', 'athleteEmail');
      } else {
        this.setValidators(['athleteId', 'athleteEmail'], Validators.required);
        this.clearValidators('representativeName', 'representativeId', 'representativeEmail');
      }
    });
  }

  setValidators(fields: string[], validator: any) {
    fields.forEach(field => {
      this.registerForm.get(field)?.setValidators(validator);
      this.registerForm.get(field)?.updateValueAndValidity();
    });
  }

  clearValidators(...fields: string[]) {
    fields.forEach(field => {
      this.registerForm.get(field)?.clearValidators();
      this.registerForm.get(field)?.updateValueAndValidity();
    });
  }

  onSubmit() {
    if (this.registerForm.valid) {
      console.log(this.registerForm.value);
    }
  }

  goBack() {
    this.location.back();
  }
}
