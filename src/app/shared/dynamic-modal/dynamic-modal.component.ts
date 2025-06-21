import { Component, Input, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import * as bootstrap from 'bootstrap';

@Component({
  selector: 'app-dynamic-modal',
  standalone: false,
  templateUrl: './dynamic-modal.component.html',
  styleUrls: ['./dynamic-modal.component.scss']
})
export class DynamicModalComponent implements OnInit, OnChanges {
  @Input() modalTitle = '';
  @Input() modalFields: any[] = [];
  @Input() showRequiredMessage: boolean = true; // ✅ Ahora podemos activar/desactivar el mensaje
  @Input() onSubmit?: (data: any) => void; // ✅ Ahora puede ser opcional
  @Input() mostrarRedesSociales: boolean = false; // ✅ Se recibe desde el componente padre


  modalForm!: FormGroup;

  constructor(private fb: FormBuilder, private http: HttpClient) { }

  ngOnInit(): void {
    this.createForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['modalFields'] && changes['modalFields'].currentValue) {
      this.createForm(); // ✅ Reconstruye el formulario cuando cambian los campos
    }
  }

  createForm(): void {
    const group: any = {};

    this.modalFields.forEach(field => {
      group[field.name] = field.validation ? [null, field.validation] : [null, Validators.required];
    });

    this.modalForm = this.fb.group(group);
  }

  openModal(): void {
    const modalElement = document.getElementById('dynamicModal');
    if (modalElement) {
      new bootstrap.Modal(modalElement).show();
    }
  }

  closeModal(): void {
    const modalElement = document.getElementById('dynamicModal');
    if (modalElement) {
      const modalInstance = bootstrap.Modal.getInstance(modalElement);
      modalInstance?.hide();
    }
  }

  confirm(): void {
    if (this.modalForm.valid) {
      if (this.onSubmit) {
        this.onSubmit(this.modalForm.value); // ✅ Envía los datos al padre
      }
   //   this.closeModal();
    } else {
      Object.values(this.modalForm.controls).forEach(control => control.markAsTouched());
    }
  }

  addChip(event: any, fieldName: string): void {
    if (event instanceof KeyboardEvent && event.key === 'Enter') { // ✅ Verifica que sea un `KeyboardEvent`
      event.preventDefault(); // ✅ Evita que el formulario se envíe accidentalmente
      const input = event.target as HTMLInputElement;
      const value = input.value.trim();

      if (value) {
        const control = this.modalForm.get(fieldName);
        control?.setValue([...control.value || [], value]);
        input.value = ''; // ✅ Limpia el input tras agregar la red social
      }
    }
  }

  removeChip(fieldName: string, chip: string): void {
    const control = this.modalForm.get(fieldName);
    control?.setValue(control.value.filter((item: string) => item !== chip));
  }

  socialOptions = ['Facebook', 'Twitter', 'Instagram', 'LinkedIn', 'TikTok'];

  addSocial(platform: string, username: string): void {
    if (platform && username.trim()) {
      const control = this.modalForm.get('redesSociales');
      control?.setValue([...control.value || [], { platform, username }]);
    }
  }

  removeSocial(social: any): void {
    const control = this.modalForm.get('redesSociales');
    control?.setValue(control.value.filter((item: any) => item.platform !== social.platform));
  }

  getSocialIcon(platform: string): string {
    const icons: { [key: string]: string } = {
      Facebook: 'facebook',
      Twitter: 'twitter',
      Instagram: 'camera_alt',
      LinkedIn: 'work',
      TikTok: 'music_note'
    };
    return icons[platform] || 'person';
  }



}
