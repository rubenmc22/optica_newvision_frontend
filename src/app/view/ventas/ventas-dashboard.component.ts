import { Component, Output, EventEmitter, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { AuthService } from '../../core/services/auth/auth.service';
import { UserStateService } from '../../core/services/userState/user-state-service';
import { SedeCompleta } from '../../view/login/login-interface';
import { GenerarVentaComponent } from './generar-venta/generar-venta.component';
import { PresupuestoComponent } from './presupuesto/presupuesto.component';
import { HistorialVentasComponent } from './historial-ventas/historial-ventas.component';
import { CierreCajaComponent } from './cierre-caja/cierre-caja.component';

type VistaVentas = 'generacion-de-ventas' | 'presupuestos' | 'historial-de-ventas' | 'cierre-de-caja';

@Component({
    selector: 'app-ventas-dashboard',
    standalone: false,
    templateUrl: './ventas-dashboard.component.html',
    styleUrl: './ventas-dashboard.component.scss'
})
export class VentasDashboardComponent implements OnInit, OnDestroy {
    vista: VistaVentas = 'generacion-de-ventas';
    readonly generarVentaComponent = GenerarVentaComponent;
    readonly presupuestoComponent = PresupuestoComponent;
    readonly historialVentasComponent = HistorialVentasComponent;
    readonly cierreCajaComponent = CierreCajaComponent;
    vistasInstanciadas: Record<VistaVentas, boolean> = {
        'generacion-de-ventas': true,
        'presupuestos': false,
        'historial-de-ventas': false,
        'cierre-de-caja': false
    };

    totalVentas: number | null = null;
    totalPresupuestos: number | null = null;
    totalHistorialVentas: number | null = null;
    totalCierres: number | null = null;

    @Output() onCerrar = new EventEmitter<void>();

    private autoRefreshSubscription!: Subscription;
    private readonly AUTO_REFRESH_INTERVAL = 300000;

    constructor(
        private userStateService: UserStateService,
        private authService: AuthService,
        private cdr: ChangeDetectorRef,
        private route: ActivatedRoute,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.inicializarVista();

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

    cambiarVista(vista: VistaVentas): void {
        this.vista = vista;
        this.marcarVistaInstanciada(vista);
        this.actualizarEstadoVista(vista);
        this.cdr.detectChanges();
    }

    esVistaActiva(vista: string): boolean {
        return this.vista === vista;
    }

    estaVistaInstanciada(vista: VistaVentas): boolean {
        return this.vistasInstanciadas[vista];
    }

    private inicializarVista(): void {
        this.route.queryParams.subscribe(params => {
            const vistaDesdeUrl = params['vista'];

            if (vistaDesdeUrl && this.esVistaValida(vistaDesdeUrl)) {
                this.vista = vistaDesdeUrl as VistaVentas;
            } else {
                this.vista = 'generacion-de-ventas';
                this.actualizarUrlSinNavegacion('generacion-de-ventas');
            }

            this.marcarVistaInstanciada(this.vista);
            this.cdr.detectChanges();
        });
    }

    private actualizarEstadoVista(vista: VistaVentas): void {
        this.vista = vista;
        this.actualizarUrlSinNavegacion(vista);
    }

    private actualizarUrlSinNavegacion(vista: VistaVentas): void {
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { vista },
            queryParamsHandling: 'merge',
            replaceUrl: true
        });
    }

    private esVistaValida(vista: string): vista is VistaVentas {
        return ['generacion-de-ventas', 'presupuestos', 'historial-de-ventas', 'cierre-de-caja'].includes(vista);
    }

    private marcarVistaInstanciada(vista: VistaVentas): void {
        this.vistasInstanciadas[vista] = true;
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
