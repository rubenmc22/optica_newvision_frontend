import { Injectable } from '@angular/core';
import { Modal } from 'bootstrap';

@Injectable({
  providedIn: 'root' // Hace que el servicio esté disponible en toda la aplicación
})

export class ModalService {
  constructor() { }

  openGlobalModal(title: string, message: string, confirmText: string, cancelText: string): void {
    const modalElement = document.getElementById('globalModal');
    if (modalElement) {
      // Pasar valores dinámicamente al modal
      modalElement.querySelector('.modal-title')!.textContent = title;
      modalElement.querySelector('.modal-body')!.textContent = message;
      modalElement.querySelector('.btn-confirm')!.textContent = confirmText;
      modalElement.querySelector('.btn-cancel')!.textContent = cancelText;

      new Modal(modalElement).show();
    }
  }

  closeGlobalModal(): void {
    const modalElement = document.getElementById('globalModal');
    if (modalElement) {
      const modalInstance = Modal.getInstance(modalElement);
      modalInstance?.hide();
    }
  }

}