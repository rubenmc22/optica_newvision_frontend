import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root' // Hace que el servicio esté disponible en toda la aplicación
})

export class GeneralFunctions {

    constructor() { }

    /**
     * Valida si un campo de un formulario es inválido y ha sido tocado.
     * @param formGroup El formulario reactivo.
     * @param fieldName El nombre del campo.
     * @returns `true` si el campo es inválido y ha sido tocado, `false` en caso contrario.
     */
    isInvalidField(formGroup: any, fieldName: string): boolean {
        const field = formGroup.get(fieldName);
        return !!field && field.invalid && field.dirty && field.value !== ''; // No muestra error si está vacío
    }

    /**
     * Formatea una fecha en el formato `YYYY-MM-DD`.
     * @param date La fecha a formatear.
     * @returns La fecha formateada como cadena.
     */
    formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Valida si una cadena es un correo electrónico válido.
     * @param email La cadena a validar.
     * @returns `true` si es un correo válido, `false` en caso contrario.
     */
    isValidEmail(email: string): boolean {
        
        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailPattern.test(email);
    }

   /* static isValidEmail(control: AbstractControl): { [key: string]: boolean } | null {
        if (!control.value) {
          return { required: true };
        }
        
        // Validación de formato básico
        const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!regex.test(control.value)) {
          return { invalidEmail: true };
        }
        
        return null;
      }*/

    /**
     * Muestra un mensaje de error genérico.
     * @param message El mensaje de error.
     */
    showError(message: string): void {
        console.error(message);
        // Aquí podrías integrar SweetAlert2 o cualquier otra librería de notificaciones
    }
}