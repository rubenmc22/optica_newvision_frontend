import { Injectable } from '@angular/core';
import { Modal } from 'bootstrap';

@Injectable({
  providedIn: 'root' // Hace que el servicio esté disponible en toda la aplicación
})

export class ModalService {
  constructor() { }

  openGlobalModal(title: string, message: string, confirmText: string, cancelText: string): Promise<boolean> {
    return new Promise((resolve) => {
      const modalElement = document.getElementById('globalModal');
      if (modalElement) {
        modalElement.querySelector('.modal-title')!.textContent = title;
        modalElement.querySelector('.modal-body')!.textContent = message;
        modalElement.querySelector('.btn-confirm')!.textContent = confirmText;
        modalElement.querySelector('.btn-cancel')!.textContent = cancelText;

        const modalInstance = new Modal(modalElement);
        modalInstance.show();

        modalElement.querySelector('.btn-confirm')?.addEventListener('click', () => {
          resolve(true);
          modalInstance.hide();
        });

        modalElement.querySelector('.btn-cancel')?.addEventListener('click', () => {
          resolve(false);
          modalInstance.hide();
        });
      } else {
        resolve(false); // Si el modal no existe, retornar falso por defecto
      }
    });
  }

  openDetailsModal(employee: any): void {
    const modalElement = document.getElementById('viewUserModal');
    if (modalElement) {
        modalElement.querySelector('.modal-title')!.textContent = 'Detalles del Usuario';
        modalElement.querySelector('.modal-body')!.innerHTML = `
            <p><strong>Cédula:</strong> ${employee.cedula}</p>
            <p><strong>Nombre:</strong> ${employee.nombre}</p>
            <p><strong>Cargo:</strong> ${employee.cargoNombre}</p>
            <p><strong>Rol:</strong> ${employee.rolNombre}</p>
            <p><strong>Email:</strong> ${employee.email}</p>
            <p><strong>Estado:</strong> ${employee.estado ? 'Activo' : 'Inhabilitado'}</p>
        `;

        const modalInstance = new Modal(modalElement);
        modalInstance.show();
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