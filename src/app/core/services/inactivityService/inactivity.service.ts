import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './../auth/auth.service';
import { SwalService } from './../swal/swal.service';
import { Subject, Subscription, timer, fromEvent } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class InactivityService implements OnDestroy {
    private timeoutMinutes =180; // Tiempo de inactividad en minutos 
    private countdown!: Subscription;
    private destroy$ = new Subject<void>();

    constructor(
        private authService: AuthService,
        private router: Router,
        private swalService: SwalService
    ) { }

    startWatching(): void {
        this.resetTimer();

        // Escucha eventos que reinicien el temporizador
        const events = ['mousemove', 'keydown', 'click'];
        events.forEach((event) => {
            fromEvent(document, event).pipe(takeUntil(this.destroy$)).subscribe(() => this.resetTimer());
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
        //   console.log('Inactividad detectada. Mostrando alerta...');
        this.swalService.showInactivityWarning(
            'Inactividad detectada',
            '¿Deseas continuar con tu sesión?'
        ).then((keepAlive) => {
            if (keepAlive) {
                this.resetTimer(); // Reinicia el temporizador si el usuario responde
            } else {
                this.forceLogout(); // Cierra sesión automáticamente
            }
        });
    }

    private forceLogout(): void {
        this.authService.logout();
        this.router.navigate(['/login'], {
            queryParams: { timeout: 'inactivity' },
            replaceUrl: true
        });

        // Limpiar residuos visuales persistentes
        localStorage.removeItem('selectedMenuLabel');
        localStorage.removeItem('selectedSubmenuLabel');
        // Mensaje de confirmación de cierre
        this.swalService.showInfo(
            'Sesión cerrada',
            'Tu sesión ha expirado debido a inactividad. Por favor, inicia sesión nuevamente.'
        );
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.countdown?.unsubscribe();
    }
}
