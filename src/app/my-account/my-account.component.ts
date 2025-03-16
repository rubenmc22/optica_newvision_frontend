import { Component } from '@angular/core';

@Component({
  selector: 'app-my-account',
  standalone: false,
  templateUrl: './my-account.component.html',
  styleUrls: ['./my-account.component.scss']
})
export class MyAccountComponent {
  user = {
    nombreCompleto: 'Juan Pérez',
    fechaNacimiento: '1995-11-10',
    edad: 29,
    cedula: '12345678',
    correo: 'juan.perez@example.com',
    contrasena: '',
    photo: ''
  };

  confirmarContrasena = '';
  passwordsMatch = true;

  // Controladores para mostrar/ocultar contraseñas
  showPassword = false;
  showConfirmPassword = false; // Propiedad añadida para el campo de confirmación

  edit: { [key: string]: boolean } = {
    nombreCompleto: false,
    correo: false,
    contrasena: false
  };

  toggleEdit(field: string, state: boolean): void {
    if (field in this.edit) {
      this.edit[field] = state;
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword; // Alterna visibilidad de la confirmación
  }

  validatePasswords(): void {
    this.passwordsMatch = this.user.contrasena === this.confirmarContrasena;
  }

  saveUserInfo(): void {
    if (this.passwordsMatch) {
      console.log('Datos guardados:', this.user);
      alert('Cambios guardados exitosamente.');
    } else {
      alert('Las contraseñas no coinciden. Por favor verifica los campos.');
    }
  }

  // Método para disparar el selector de archivos
  triggerFileSelector(): void {
    const fileInput = document.getElementById('photoInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  // Método para manejar el archivo seleccionado
  onPhotoSelected(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    if (fileInput?.files && fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        this.user.photo = reader.result as string; // Convierte la imagen en base64
      };
      reader.readAsDataURL(fileInput.files[0]);
    }
  }
}
