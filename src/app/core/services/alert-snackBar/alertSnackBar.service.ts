import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  constructor(private snackBar: MatSnackBar) {}

  showMessage(message: string): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 3000, // Dura 3 segundos
      horizontalPosition: 'center', // Centrado horizontalmente
      verticalPosition: 'top', // Mostrado en la parte superior
    });
  }
}
