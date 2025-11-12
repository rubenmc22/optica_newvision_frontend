import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  constructor(private snackBar: MatSnackBar) { }

  showMessage(message: string): void {
    this.snackBar.open('✅ Tasas actualizadas correctamente desde BCV', 'Cerrar', {
      duration: 1000000,
      panelClass: ['snackbar-success', 'custom-snackbar', 'snackbar-with-margin'],
      verticalPosition: 'top', // Cambiar a 'bottom'
      horizontalPosition: 'center' // Centrar horizontalmente
    });
  }
}
