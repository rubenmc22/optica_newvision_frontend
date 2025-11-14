import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';
import { SweetAlertResult, SweetAlertOptions } from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class SwalService {
  
  constructor() { }

  /**
   * Muestra una alerta de éxito moderna
   */
  showSuccess(title: string, text: string, timer: number = 3000): Promise<any> {
    return Swal.fire({
      icon: 'success',
      title: title,
      text: text,
      confirmButtonText: 'Aceptar',
      timer: timer,
      timerProgressBar: true,
      customClass: {
        popup: 'swal-modern-popup success-popup',
        title: 'swal-modern-title',
        htmlContainer: 'swal-modern-content',
        confirmButton: 'swal-modern-confirm success-btn',
        closeButton: 'swal-modern-close',
        timerProgressBar: 'swal-modern-progress-bar'
      },
      buttonsStyling: false,
      showClass: {
        popup: 'animate__animated animate__fadeInDown animate__faster'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp animate__faster'
      }
    });
  }

  /**
   * Muestra una alerta de error moderna
   */
  showError(title: string, text: string, timer: number = 5000): Promise<any> {
    return Swal.fire({
      icon: 'error',
      title: title,
      text: text,
      confirmButtonText: 'Aceptar',
      timer: timer,
      timerProgressBar: true,
      customClass: {
        popup: 'swal-modern-popup error-popup',
        title: 'swal-modern-title',
        htmlContainer: 'swal-modern-content',
        confirmButton: 'swal-modern-confirm error-btn',
        closeButton: 'swal-modern-close',
        timerProgressBar: 'swal-modern-progress-bar'
      },
      buttonsStyling: false,
      showClass: {
        popup: 'animate__animated animate__shakeX'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp animate__faster'
      }
    });
  }

  /**
   * Muestra una alerta de advertencia moderna
   */
  showWarning(title: string, content: string, isHtml: boolean = false, timer: number = 4000): Promise<any> {
    const config: SweetAlertOptions = {
      icon: 'warning',
      title: title,
      confirmButtonText: 'Aceptar',
      timer: timer,
      timerProgressBar: true,
      customClass: {
        popup: 'swal-modern-popup warning-popup',
        title: 'swal-modern-title',
        htmlContainer: 'swal-modern-content',
        confirmButton: 'swal-modern-confirm warning-btn',
        closeButton: 'swal-modern-close',
        timerProgressBar: 'swal-modern-progress-bar'
      },
      buttonsStyling: false,
      showClass: {
        popup: 'animate__animated animate__wobble'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp animate__faster'
      }
    };

    if (isHtml) {
      config.html = content;
    } else {
      config.text = content;
    }

    return Swal.fire(config);
  }

  /**
   * Muestra una alerta de información moderna
   */
  showInfo(title: string, text: string): Promise<any> {
    return Swal.fire({
      icon: 'info',
      title: title,
      html: text,
      confirmButtonText: 'Aceptar',
      customClass: {
        popup: 'swal-modern-popup info-popup',
        title: 'swal-modern-title',
        htmlContainer: 'swal-modern-content',
        confirmButton: 'swal-modern-confirm info-btn',
        closeButton: 'swal-modern-close'
      },
      buttonsStyling: false,
      showClass: {
        popup: 'animate__animated animate__fadeInDown animate__faster'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp animate__faster'
      }
    });
  }

  /**
   * Muestra una alerta de confirmación moderna
   */
  showConfirm(
    title: string, 
    htmlContent: string, 
    confirmButtonText: string = 'Confirmar', 
    cancelButtonText: string = 'Cancelar'
  ): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'question',
      title: title,
      html: htmlContent,
      showCancelButton: true,
      confirmButtonText: confirmButtonText,
      cancelButtonText: cancelButtonText,
      customClass: {
        popup: 'swal-modern-popup confirm-popup',
        title: 'swal-modern-title',
        htmlContainer: 'swal-modern-content',
        confirmButton: 'swal-modern-confirm primary-btn',
        cancelButton: 'swal-modern-cancel',
        closeButton: 'swal-modern-close'
      },
      buttonsStyling: false,
      showClass: {
        popup: 'animate__animated animate__fadeInDown animate__faster'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp animate__faster'
      }
    });
  }

  /**
   * Alerta de inactividad moderna
   */
  showInactivityWarning(
    title: string,
    text: string,
    timerDuration: number = 60000 
  ): Promise<boolean> {
    return new Promise((resolve) => {
      let timerInterval: number;
      let confirmed = false;

      Swal.fire({
        title: title,
        html: `
          <div class="inactivity-content">
            <div class="inactivity-icon">
              <i class="bi bi-clock-history"></i>
            </div>
            <div class="inactivity-text">
              ${text}
            </div>
            <div class="countdown-container">
              <strong id="countdown" class="countdown-number">${timerDuration / 1000}</strong>
              <span class="countdown-label">segundos restantes</span>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Mantener sesión',
        cancelButtonText: 'Cerrar sesión',
        customClass: {
          popup: 'swal-modern-popup inactivity-popup',
          title: 'swal-modern-title',
          htmlContainer: 'swal-modern-content',
          confirmButton: 'swal-modern-confirm success-btn',
          cancelButton: 'swal-modern-cancel',
          closeButton: 'swal-modern-close',
          timerProgressBar: 'swal-modern-progress-bar'
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
          resolve(true);
        } else if (result.isDismissed && result.dismiss === Swal.DismissReason.cancel) {
          confirmed = true;
          resolve(false);
        }

        if (!confirmed && Swal.isVisible()) {
          this.showSessionClosed();
          resolve(false);
        }
      });
    });
  }

  /**
   * Alerta de sesión cerrada
   */
  private showSessionClosed(): void {
    Swal.fire({
      title: 'Sesión cerrada',
      html: '<div class="session-closed-content">Has sido desconectado por inactividad</div>',
      icon: 'info',
      timer: 3000,
      showConfirmButton: false,
      customClass: {
        popup: 'swal-modern-popup info-popup',
        title: 'swal-modern-title',
        htmlContainer: 'swal-modern-content',
        timerProgressBar: 'swal-modern-progress-bar'
      }
    });
  }

  /**
   * Loading moderno con diseño Apollo mejorado
   */
  showApolloLoading(): void {
    Swal.fire({
      html: `
        <div class="apollo-loading-container">
          <div class="apollo-loading-card">
            <img src="assets/android-chrome-512x512.png" 
                 class="apollo-loading-logo">
            <div class="apollo-loading-text">Cargando...</div>
            <div class="apollo-loading-bar-container">
              <div class="apollo-loading-bar"></div>
            </div>
          </div>
        </div>
      `,
      showConfirmButton: false,
      allowOutsideClick: false,
      background: 'rgba(0,0,0,0.85)',
      width: 'auto',
      padding: '0',
      showClass: {
        popup: 'animate__animated animate__fadeIn'
      },
      customClass: {
        popup: 'apollo-loading-popup'
      }
    });
  }

  /**
   * Loading básico moderno
   */
  showLoadingAlert(title: string = 'Procesando...'): void {
    Swal.fire({
      title: title,
      allowOutsideClick: false,
      customClass: {
        popup: 'swal-modern-popup loading-popup',
        title: 'swal-modern-title',
        htmlContainer: 'swal-modern-content'
      },
      didOpen: () => {
        Swal.showLoading();
      }
    });
  }

  /**
   * Cierra cualquier alerta activa
   */
  closeLoading(): void {
    Swal.close();
  }
}