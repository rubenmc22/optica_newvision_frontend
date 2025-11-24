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

  private minLoadingTime = 1000;
  private loadingStartTime = 0;
  private isCurrentlyLoading = false;

  // Método para mostrar loader con mensaje
  showWithMessage(message: string = 'Cargando...') {
    this.messageSubject.next(message);
    this.loadingStartTime = Date.now();
    this.isCurrentlyLoading = true;
    this.lockScroll();
    
    setTimeout(() => {
      this.loadingSubject.next(true);
    });
  }

  // Método para actualizar mensaje sin cambiar estado
  updateMessage(message: string) {
    this.messageSubject.next(message);
  }

  show() {
    this.showWithMessage('Cargando...');
  }

  hide() {
    if (!this.isCurrentlyLoading) return;

    const elapsedTime = Date.now() - this.loadingStartTime;
    const remainingTime = this.minLoadingTime - elapsedTime;

    if (remainingTime > 0) {
      setTimeout(() => {
        this.isCurrentlyLoading = false;
        this.unlockScroll();
        
        setTimeout(() => {
          this.loadingSubject.next(false);
          this.messageSubject.next('Cargando...');
        });
      }, remainingTime);
    } else {
      this.isCurrentlyLoading = false;
      this.unlockScroll();
      
      setTimeout(() => {
        this.loadingSubject.next(false);
        this.messageSubject.next('Cargando...');
      });
    }
  }

  forceHide() {
    this.isCurrentlyLoading = false;
    this.unlockScroll();
    
    setTimeout(() => {
      this.loadingSubject.next(false);
      this.messageSubject.next('Cargando...');
    });
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