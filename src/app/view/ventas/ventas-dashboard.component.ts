import { Component, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { AuthService } from '../../core/services/auth/auth.service';
import { UserStateService } from '../../core/services/userState/user-state-service';
import { SedeCompleta } from '../../view/login/login-interface';

interface VentasResumenItem {
    titulo: string;
    descripcion: string;
    route: string;
    icono: string;
    accentClass: string;
    total: number | null;
}

@Component({
    selector: 'app-ventas-dashboard',
    standalone: false,
    templateUrl: './ventas-dashboard.component.html',
    styleUrl: './ventas-dashboard.component.scss'
})
export class VentasDashboardComponent implements OnInit, OnDestroy {
    totalVentas: number | null = null;
    totalPresupuestos: number | null = null;
    totalHistorialVentas: number | null = null;
    totalCierres: number | null = null;

    private autoRefreshSubscription!: Subscription;
    private readonly AUTO_REFRESH_INTERVAL = 300000;

    constructor(
        private userStateService: UserStateService,
        private authService: AuthService,
        private cdr: ChangeDetectorRef,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.cargarSedesUnaVez().then(() => {
            this.iniciarAutoRefresh();
        }).catch(error => {
            console.error('❌ Error al inicializar sedes del módulo de ventas:', error);
        });
    }

    ngOnDestroy(): void {
        if (this.autoRefreshSubscription) {
            this.autoRefreshSubscription.unsubscribe();
        }
    }

    get resumenItems(): VentasResumenItem[] {
        return [
            {
                titulo: 'Nueva venta',
                descripcion: 'Acceso inmediato al flujo operativo de cobro y registro.',
                route: '/ventas/generar',
                icono: 'fas fa-cash-register',
                accentClass: 'card-venta',
                total: this.totalVentas
            },
            {
                titulo: 'Presupuestos',
                descripcion: 'Cotizaciones activas, seguimiento y conversión a venta.',
                route: '/ventas/presupuestos',
                icono: 'fas fa-file-invoice-dollar',
                accentClass: 'card-presupuesto',
                total: this.totalPresupuestos
            },
            {
                titulo: 'Historial',
                descripcion: 'Consulta ventas registradas, pagos y trazabilidad.',
                route: '/ventas/historial',
                icono: 'fas fa-history',
                accentClass: 'card-historial',
                total: this.totalHistorialVentas
            },
            {
                titulo: 'Cierre de caja',
                descripcion: 'Revisión diaria, conciliación y control operativo.',
                route: '/ventas/cierres',
                icono: 'fas fa-lock',
                accentClass: 'card-caja',
                total: this.totalCierres
            }
        ];
    }

    abrirRuta(route: string): void {
        this.router.navigate([route]);
    }

    private iniciarAutoRefresh(): void {
        this.autoRefreshSubscription = interval(this.AUTO_REFRESH_INTERVAL).subscribe(() => {
            this.actualizarSedesAuto();
        });
    }

    private actualizarSedesAuto(): void {
        this.authService.getSedes().subscribe({
            next: (response: any) => {
                if (response.message === 'ok' && response.sedes) {
                    this.userStateService.setSedes(response.sedes);
                }
            },
            error: (error) => {
                console.warn('⚠️ Error en auto-refresh de sedes:', error);
            }
        });
    }

    private async cargarSedesUnaVez(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.authService.getSedes().subscribe({
                next: (response: { message: string; sedes: SedeCompleta[] }) => {
                    if (response.message === 'ok' && response.sedes && response.sedes.length > 0) {
                        this.userStateService.setSedes(response.sedes);
                        resolve();
                        return;
                    }

                    reject(new Error('Respuesta inválida del servidor'));
                },
                error: (error) => {
                    console.error('❌ Error al cargar sedes:', error);

                    const sedesCache = localStorage.getItem('sedesCache');
                    if (sedesCache) {
                        try {
                            const sedes = JSON.parse(sedesCache);
                            if (Array.isArray(sedes) && sedes.length > 0) {
                                this.userStateService.setSedes(sedes);
                                resolve();
                                return;
                            }
                        } catch (parseError) {
                            console.error('Error al parsear caché de sedes:', parseError);
                        }
                    }

                    reject(error);
                }
            });
        });
    }
}
