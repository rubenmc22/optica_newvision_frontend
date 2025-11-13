import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private minLoadingTime = 1000;
  private loadingStartTime = 0;
  private isCurrentlyLoading = false;

  show() {
    this.loadingStartTime = Date.now();
    this.isCurrentlyLoading = true;
    this.lockScroll();
    this.loadingSubject.next(true);
  }

  hide() {
    if (!this.isCurrentlyLoading) return;

    const elapsedTime = Date.now() - this.loadingStartTime;
    const remainingTime = this.minLoadingTime - elapsedTime;

    if (remainingTime > 0) {
      setTimeout(() => {
        this.isCurrentlyLoading = false;
        this.unlockScroll();
        this.loadingSubject.next(false);
      }, remainingTime);
    } else {
      this.isCurrentlyLoading = false;
      this.unlockScroll();
      this.loadingSubject.next(false);
    }
  }

  forceHide() {
    this.isCurrentlyLoading = false;
    this.unlockScroll();
    this.loadingSubject.next(false);
  }

  isLoading(): boolean {
    return this.isCurrentlyLoading;
  }

  // ==================== MÉTODOS PARA BLOQUEAR SCROLL ====================
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