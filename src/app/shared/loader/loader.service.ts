// loader.service.ts (versión extendida)
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private messageSubject = new BehaviorSubject<string>('Cargando...');
  
  public loading$ = this.loadingSubject.asObservable();
  public message$ = this.messageSubject.asObservable();

  private isCurrentlyLoading = false;
  private activeRequests = 0;

  // Método para mostrar loader con mensaje
  showWithMessage(message: string = 'Cargando...') {
    this.messageSubject.next(message);
    this.activeRequests++;

    if (this.isCurrentlyLoading) {
      return;
    }

    this.isCurrentlyLoading = true;
    this.lockScroll();
    this.loadingSubject.next(true);
  }

  // Método para actualizar mensaje sin cambiar estado
  updateMessage(message: string) {
    this.messageSubject.next(message);
  }

  show() {
    this.showWithMessage('Cargando...');
  }

  hide() {
    if (this.activeRequests > 0) {
      this.activeRequests--;
    }

    if (!this.isCurrentlyLoading || this.activeRequests > 0) {
      return;
    }

    this.isCurrentlyLoading = false;
    this.unlockScroll();
    this.loadingSubject.next(false);
    this.messageSubject.next('Cargando...');
  }

  forceHide() {
    this.activeRequests = 0;
    this.isCurrentlyLoading = false;
    this.unlockScroll();

    this.loadingSubject.next(false);
    this.messageSubject.next('Cargando...');
  }

  isLoading(): boolean {
    return this.isCurrentlyLoading;
  }

  // Métodos de scroll (mantener igual)
  private lockScroll(): void {
    const body = document.body;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    body.style.top = `-${scrollY}px`;
    body.style.position = 'fixed';
    body.style.width = '100%';
    body.style.overflowY = 'scroll';
  }

  private unlockScroll(): void {
    const body = document.body;
    const scrollY = parseInt(body.style.top || '0');
    body.style.position = '';
    body.style.top = '';
    body.style.width = '';
    body.style.overflowY = '';
    if (scrollY) {
      window.scrollTo(0, Math.abs(scrollY));
    }
  }

  public lockBodyScroll(): void {
    this.lockScroll();
  }

  public unlockBodyScroll(): void {
    this.unlockScroll();
  }
}