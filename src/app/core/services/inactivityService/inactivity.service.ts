import { Injectable, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from './../auth/auth.service';
import { SwalService } from './../swal/swal.service';
import { Subject, Subscription, timer, fromEvent } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class InactivityService implements OnDestroy {
    private timeoutMinutes = 180; // 3 horas
    private countdown?: Subscription;
    private destroy$ = new Subject<void>();
    private isBrowser: boolean;
    private isWatching = false;

    constructor(
        private authService: AuthService,
        private router: Router,
        private swalService: SwalService,
        @Inject(PLATFORM_ID) platformId: Object
    ) {
        this.isBrowser = isPlatformBrowser(platformId);
    }

    startWatching(): void {
        if (!this.isBrowser || this.isWatching) {
            return;
        }
        
        this.isWatching = true;
        console.log('🕐 Inactivity service started');
        this.resetTimer();

        // Escucha eventos que reinicien el temporizador
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        events.forEach((event) => {
            fromEvent(document, event).pipe(
                takeUntil(this.destroy$)
            ).subscribe(() => this.resetTimer());
        });
    }

    private resetTimer(): void {
        // Cancelar temporizador activo, si existe
        if (this.countdown) {
            this.countdown.unsubscribe();
        }

        // Iniciar un nuevo temporizador
        this.countdown = timer(this.timeoutMinutes * 60 * 1000)
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => this.handleInactivity());
    }

    private handleInactivity(): void {
        if (!this.isBrowser) return;
        
        // Verificar si el usuario está autenticado antes de mostrar la alerta
        if (!this.authService.isAuthenticated()) {
            console.log('Usuario ya no está autenticado, saltando advertencia');
            return;
        }

        this.swalService.showInactivityWarning(
            'Inactividad detectada',
            '¿Deseas continuar con tu sesión?'
        ).then((keepAlive) => {
            if (keepAlive) {
                this.resetTimer();
            } else {
                this.forceLogout();
            }
        }).catch((error) => {
            console.error('Error mostrando advertencia de inactividad:', error);
            this.forceLogout();
        });
    }

    private forceLogout(): void {
        
        // Detener el servicio primero
        this.stopWatching();
        
        // Limpiar almacenamiento
        if (this.isBrowser) {
            localStorage.removeItem('selectedMenuLabel');
            localStorage.removeItem('selectedSubmenuLabel');
            localStorage.removeItem('token');
            sessionStorage.clear();
        }
        
        // Cerrar sesión y navegar
        this.authService.logout();
        this.router.navigate(['/login'], {
            queryParams: { reason: 'inactivity' },
            replaceUrl: true
        }).then(() => {
            this.swalService.showInfo(
                'Sesión cerrada',
                'Tu sesión ha expirado debido a inactividad. Por favor, inicia sesión nuevamente.'
            );
        });
    }

    stopWatching(): void {
        this.isWatching = false;
        this.destroy$.next();
        this.countdown?.unsubscribe();
    }

    ngOnDestroy(): void {
        this.stopWatching();
        this.destroy$.complete();
    }
}