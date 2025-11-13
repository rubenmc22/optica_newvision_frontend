import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();
  
  private minLoadingTime = 1000; // 3 segundos mínimo
  private loadingStartTime = 0;
  private isCurrentlyLoading = false;

  show() {
    this.loadingStartTime = Date.now();
    this.isCurrentlyLoading = true;
    this.loadingSubject.next(true);
  }

  hide() {
    if (!this.isCurrentlyLoading) return;

    const elapsedTime = Date.now() - this.loadingStartTime;
    const remainingTime = this.minLoadingTime - elapsedTime;

    if (remainingTime > 0) {
      // Si no ha pasado el tiempo mínimo, esperar el resto
      setTimeout(() => {
        this.isCurrentlyLoading = false;
        this.loadingSubject.next(false);
      }, remainingTime);
    } else {
      // Si ya pasó el tiempo mínimo, ocultar inmediatamente
      this.isCurrentlyLoading = false;
      this.loadingSubject.next(false);
    }
  }

  // Método para forzar el cierre inmediato (en caso de errores)
  forceHide() {
    this.isCurrentlyLoading = false;
    this.loadingSubject.next(false);
  }

  // Método para verificar si está cargando
  isLoading(): boolean {
    return this.isCurrentlyLoading;
  }
}