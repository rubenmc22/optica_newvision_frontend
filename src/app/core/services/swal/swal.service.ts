import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root' // Hace que el servicio esté disponible en toda la aplicación
})
export class SwalService {
  constructor() { }

  /**
   * Muestra una alerta de éxito.
   * @param title Título de la alerta.
   * @param text Mensaje de la alerta.
   */
  showSuccess(title: string, text: string): Promise<any> {
    return Swal.fire({
      icon: 'success', // Ícono de éxito
      title: title, // Título de la alerta
      text: text, // Mensaje de la alerta
      confirmButtonText: 'Aceptar', // Texto del botón de confirmación
      timer: 3000, // Cierra automáticamente la alerta después de 3 segundos
      timerProgressBar: true, // Muestra una barra de progreso
      customClass: {
        popup: 'custom-popup-class',
        title: 'custom-title-class',
        htmlContainer: 'custom-content-class',
        confirmButton: 'custom-confirm-button-class'
      },
      buttonsStyling: false, // Desactiva los estilos por defecto de los botones
      showClass: {
        popup: 'animate__animated animate__fadeInDown' // Animación de entrada
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp' // Animación de salida
      }
    });
  }

  /**
   * Muestra una alerta de error.
   * @param title Título de la alerta.
   * @param text Mensaje de la alerta.
   */
  showError(title: string, text: string): Promise<any> {
    return Swal.fire({
      icon: 'error', // Ícono de error
      title: title, // Título de la alerta
      text: text, // Mensaje de la alerta
      confirmButtonText: 'Aceptar', // Texto del botón de confirmación
      timer: 3000, // Cierra automáticamente la alerta después de 3 segundos
      customClass: {
        popup: 'custom-popup-class',
        title: 'custom-title-class',
        htmlContainer: 'custom-content-class', // Usa htmlContainer en lugar de content
        confirmButton: 'custom-confirm-button-class'
      },
      buttonsStyling: false, // Desactiva los estilos por defecto de los botones
      showClass: {
        popup: 'animate__animated animate__shakeX' // Animación de entrada
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp' // Animación de salida
      }
    });
  }

  /**
   * Muestra una alerta de advertencia.
   * @param title Título de la alerta.
   * @param text Mensaje de la alerta.
   */
  showWarning(title: string, text: string): Promise<any> {
   return Swal.fire({
      icon: 'warning', // Ícono de advertencia
      title: title, // Título de la alerta
      text: text, // Mensaje de la alerta
      confirmButtonText: 'Aceptar', // Texto del botón de confirmación
      timer: 3000, // Cierra automáticamente la alerta después de 3 segundos
      customClass: {
        popup: 'custom-popup-class',
        title: 'custom-title-class',
        htmlContainer: 'custom-content-class', // Usa htmlContainer en lugar de content
        confirmButton: 'custom-confirm-button-class'
      },
      buttonsStyling: false, // Desactiva los estilos por defecto de los botones
      showClass: {
        popup: 'animate__animated animate__wobble' // Animación de entrada
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp' // Animación de salida
      }
    });
  }

  /**
   * Muestra una alerta de confirmación.
   * @param title Título de la alerta.
   * @param text Mensaje de la alerta.
   * @returns Una promesa que resuelve `true` si el usuario confirma, o `false` si cancela.
   */
  showConfirm(title: string, text: string): Promise<boolean> {
    return Swal.fire({
      icon: 'question', // Ícono de pregunta
      title: title, // Título de la alerta
      text: text, // Mensaje de la alerta
      showCancelButton: true, // Muestra un botón de cancelar
      confirmButtonText: 'Sí', // Texto del botón de confirmación
      cancelButtonText: 'No', // Texto del botón de cancelación
      customClass: {
        popup: 'custom-popup-class',
        title: 'custom-title-class',
        htmlContainer: 'custom-content-class', // Usa htmlContainer en lugar de content
        confirmButton: 'custom-confirm-button-class',
        cancelButton: 'custom-cancel-button-class'
      },
      buttonsStyling: false, // Desactiva los estilos por defecto de los botones
      showClass: {
        popup: 'animate__animated animate__fadeInDown' // Animación de entrada
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp' // Animación de salida
      }
    }).then((result) => {
      return result.isConfirmed; // Devuelve `true` si el usuario confirma, o `false` si cancela
    });
  }
}