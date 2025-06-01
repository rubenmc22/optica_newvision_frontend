import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';
import { SweetAlertResult } from 'sweetalert2';

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
      timer: 30000000, // Cierra automáticamente la alerta después de 3 segundos
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

  showInactivityWarning(
    title: string,
    text: string,
    timerDuration: number = 60000 // 1 minuto por defecto
  ): Promise<boolean> {
    return new Promise((resolve) => {
      let timerInterval: number;
      let confirmed = false;
  
      Swal.fire({
        title: title,
        html: `<p class="custom-content-class">
                 ${text}<br><br>
                 <strong id="countdown">${timerDuration / 1000}</strong> segundos restantes
               </p>`,
        iconHtml: '<i class="bi bi-exclamation-triangle-fill  text-warning"></i>', // Usando un icono personalizado acorde
        showCancelButton: true,
        confirmButtonText: 'Mantener sesión',
        cancelButtonText: 'Cerrar sesión',
        customClass: {
          popup: 'custom-popup-class', // Fondo consistente
          title: 'custom-title-class', // Título ajustado
          confirmButton: 'custom-confirm-button-class', // Botón confirmar
          cancelButton: 'custom-cancel-button-class' // Botón cancelar
        },
        allowOutsideClick: false,
        timer: timerDuration,
        timerProgressBar: true,
        didOpen: () => {
          const timer = Swal.getPopup()?.querySelector('#countdown');
          timerInterval = window.setInterval(() => {
            const remaining = Swal.getTimerLeft() as number;
            if (timer) {
              timer.textContent = `${Math.round(remaining / 1000)}`;
            }
          }, 1000);
        },
        willClose: () => {
          clearInterval(timerInterval);
        }
      }).then((result) => {
        if (result.isConfirmed) {
          confirmed = true;
          resolve(true); // Usuario eligió mantener sesión
        } else if (result.isDismissed && result.dismiss === Swal.DismissReason.cancel) {
          confirmed = true;
          resolve(false); // Usuario eligió cerrar sesión
        }
  
        // Si se cierra por timer
        if (!confirmed && Swal.isVisible()) {
          Swal.fire({
            title: 'Sesión cerrada',
            html: '<p class="custom-content-class">Has sido desconectado por inactividad</p>',
            icon: 'info',
            customClass: {
              popup: 'custom-popup-class', // Fondo consistente
              title: 'custom-title-class' // Título acorde
            },
            timer: 3000,
            showConfirmButton: false
          });
          resolve(false);
        }
      });
    });
  }
  

  /**
   * Muestra una alerta de confirmación.
   * @param title Título de la alerta.
   * @param text Mensaje de la alerta.
   * @returns Una promesa que resuelve `true` si el usuario confirma, o `false` si cancela.
   */
  showConfirm(title: string, htmlContent: string, confirmButtonText: string, cancelButtonText: string): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'question', // Ícono de pregunta
      title: title, // Título de la alerta
      html: htmlContent, // Cambiado a 'html' para aceptar contenido HTML
      showCancelButton: true, // Muestra un botón de cancelar
      confirmButtonText: confirmButtonText, // Texto del botón de confirmación
      cancelButtonText: cancelButtonText, // Texto del botón de cancelación
      customClass: {
        popup: 'custom-popup-class',
        title: 'custom-title-class',
        htmlContainer: 'custom-content-class',
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
    });
  }


  showInfo(title: string, text: string): Promise<any> {
    return Swal.fire({
      icon: 'info',
      title: title,
      html: text, // Usamos html para permitir formato
      confirmButtonText: 'Aceptar',
      customClass: {
        popup: 'custom-popup-class',
        title: 'custom-title-class',
        htmlContainer: 'custom-content-class',
        confirmButton: 'custom-confirm-button-class'
      },
      buttonsStyling: false,
      showClass: {
        popup: 'animate__animated animate__fadeInDown'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp'
      }
    });
  }

  // Método para abrir un indicar de carga (showLoading)
  showLoadingAlert(): void {
    Swal.fire({
      title: 'Procesando...',
      allowOutsideClick: false, // Evita que el usuario cierre la alerta al hacer clic fuera de ella
      didOpen: () => {
        Swal.showLoading(); // Activa el indicador de carga
      }
    });
  }

  showApolloLoading() {
    Swal.fire({
      html: `
        <div class="apollo-loading-container">
          <img src="assets/android-chrome-512x512.png" 
               class="apollo-loading-logo">
          <div class="apollo-loading-bar"></div>
        </div>
      `,
      showConfirmButton: false,
      allowOutsideClick: false,
      background: 'transparent',
      backdrop: 'rgba(0,0,0,0.85)',
      width: 'auto',
      padding: '0',
      showClass: {
        popup: 'animate__animated animate__fadeIn'
      },
      customClass: {
        popup: 'transparent-popup' // Clase adicional para controlar el popup
      }
    });
  }

  // Método para cerrar cualquier alerta activa
  closeLoading(): void {
    Swal.close(); // SweetAlert2 proporciona este método para cerrar alertas activas
  }
}