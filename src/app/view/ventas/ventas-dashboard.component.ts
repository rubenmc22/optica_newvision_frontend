import { Component, Output, EventEmitter, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { Producto, ProductoDto, MonedaVisual } from '../productos/producto.model';
import { ProductoService } from '../productos/producto.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TasaCambiariaService } from '../../core/services/tasaCambiaria/tasaCambiaria.service';
import { Tasa } from '../../Interfaces/models-interface';
import { SwalService } from '../../core/services/swal/swal.service';
import { of, forkJoin, map, Subscription, interval } from 'rxjs';
import { take, catchError } from 'rxjs/operators';
import { LoaderService } from './../../shared/loader/loader.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/services/auth/auth.service';
import { UserStateService, SedeInfo } from '../../core/services/userState/user-state-service';
import { HttpErrorResponse } from '@angular/common/http';
import { PacientesService } from '../../core/services/pacientes/pacientes.service';
import { HistoriaMedicaService } from '../../core/services/historias-medicas/historias-medicas.service';
import { HistoriaMedica } from './../historias-medicas/historias_medicas-interface';

@Component({
    selector: 'app-ventas-dashboard',
    standalone: false,
    templateUrl: './ventas-dashboard.component.html',
    styleUrl: './ventas-dashboard.component.scss'
})
export class VentasDashboardComponent implements OnInit, OnDestroy {
    vista: 'generacion-de-ventas' | 'presupuestos' | 'historial-de-ventas' | 'cierre-de-caja' = 'generacion-de-ventas';

    totalVentas = 0;
    totalPresupuestos = 0;
    totalHistorialVentas = 0;
    totalCierres = 0;
    @Output() onCerrar = new EventEmitter<void>();

    // ESTADO DEL COMPONENTE
    productos: Producto[] = [];
    modoModal: 'agregar' | 'editar' | 'ver' = 'agregar';
    cargando: boolean = false;
    productosFiltradosPorSede: Producto[] = [];
    sedesDisponibles: SedeInfo[] = [];
    tareasPendientes = 0;
    dataIsReady = false;
    venta: {
        pacienteId?: string;
        moneda?: string;
        productos: ProductoDto[];
        formaPago?: string;
        observaciones?: string;
    } = {
            productos: []
        };
    pacientes: any[] = [];
    historiaMedica: any = null;

    // FILTROS
    sedeActiva: string = '';
    sedeFiltro: string = this.sedeActiva;
    sedeInfo: SedeInfo | null = null;
    sedesCargadas: boolean = false;

    // TASAS DE CAMBIO
    moneda: MonedaVisual[] = [];
    tasaDolar = 0;
    tasaEuro = 0;

    // AUTO-REFRESH
    private autoRefreshSubscription!: Subscription;
    private readonly AUTO_REFRESH_INTERVAL = 300000; // 5 minutos

    constructor(
        private productoService: ProductoService,
        private tasaCambiariaService: TasaCambiariaService,
        private swalService: SwalService,
        private userStateService: UserStateService,
        private snackBar: MatSnackBar,
        private authService: AuthService,
        private cdr: ChangeDetectorRef,
        private loader: LoaderService,
        private pacientesService: PacientesService,
        private historiaService: HistoriaMedicaService,
        private route: ActivatedRoute,
        private router: Router
    ) { }

    // =========== LIFECYCLE HOOKS ===========
    ngOnInit(): void {
        this.inicializarVista();

        // Cargar sedes antes que cualquier otra cosa
        this.cargarSedesUnaVez().then(() => {
            // Inicializar el resto
            this.cargarDatosIniciales();

            // Suscribirse a los cambios de sedes
            this.userStateService.sedes$.subscribe(sedes => {
                this.sedesDisponibles = sedes;
            });

            // Suscribirse a los cambios de sede actual
            this.userStateService.sedeActual$.subscribe(sede => {
                this.sedeInfo = sede;
            });

            // Iniciar auto-refresh después de cargar datos iniciales
            this.iniciarAutoRefresh();
        });
    }

    ngOnDestroy(): void {
        // Limpiar suscripción de auto-refresh
        if (this.autoRefreshSubscription) {
            this.autoRefreshSubscription.unsubscribe();
        }
    }

    // =========== AUTO-REFRESH SIMPLIFICADO ===========
    private iniciarAutoRefresh(): void {
        // Actualizar sedes automáticamente cada 5 minutos
        this.autoRefreshSubscription = interval(this.AUTO_REFRESH_INTERVAL).subscribe(() => {
            this.actualizarSedesAuto();
        });
    }

    private actualizarSedesAuto(): void {
        this.authService.getSedes().subscribe({
            next: (response: any) => {
                if (response.message === 'ok' && response.sedes) {
                    const nuevasSedes = response.sedes;
                    this.userStateService.setSedes(nuevasSedes);
                }
            },
            error: (error) => {
                console.warn('⚠️ Error en auto-refresh de sedes:', error);
            }
        });
    }

    // =========== MÉTODO: CARGAR SEDES ===========
    private async cargarSedesUnaVez(): Promise<void> {
        return new Promise((resolve, reject) => {

            this.authService.getSedes().subscribe({
                next: (response: any) => {
                    if (response.message === 'ok' && response.sedes) {
                        const sedes = response.sedes;
                        this.userStateService.setSedes(sedes);
                        resolve();
                    } else {
                        reject(new Error('Respuesta inválida del servidor'));
                    }
                },
                error: (error) => {
                    console.error('❌ Error al cargar sedes:', error);

                    // Intentar usar datos del localStorage como fallback
                    const sedesCache = localStorage.getItem('sedesCache');
                    if (sedesCache) {
                        try {
                            const sedes = JSON.parse(sedesCache);
                            this.userStateService.setSedes(sedes);
                            resolve();
                            return;
                        } catch (e) {
                            console.error('Error al parsear caché de sedes:', e);
                        }
                    }

                    reject(error);
                }
            });
        });
    }

    // =========== NOTIFICAR A COMPONENTES HIJOS ===========
    private notificarSedesDisponibles(): void {
        // Puedes emitir un evento o simplemente confiar en que UserStateService
        // ya tiene los datos y los componentes hijos se suscribirán
    }

    cambiarVista(v: typeof this.vista): void {
        this.vista = v;
        this.actualizarEstadoVista(v);
        this.cdr.detectChanges();
    }


    esVistaActiva(vista: string): boolean {
        return this.vista === vista;
    }

    private cargarDatosIniciales(): void {
        this.iniciarCarga();
        this.tareaIniciada();
        this.obtenerTasasCambio();

        this.cargarProductosYSedes();
    }

    // =========== GESTIÓN DE VISTA Y URL ===========
    private inicializarVista(): void {
        this.route.queryParams.subscribe(params => {
            const vistaDesdeUrl = params['vista'];

            if (vistaDesdeUrl && this.esVistaValida(vistaDesdeUrl)) {
                this.vista = vistaDesdeUrl as typeof this.vista;
            } else {
                this.vista = 'generacion-de-ventas';
                this.actualizarUrlSinNavegacion('generacion-de-ventas');
            }

            this.cdr.detectChanges();
        });
    }

    private actualizarEstadoVista(vista: 'generacion-de-ventas' | 'presupuestos' | 'historial-de-ventas' | 'cierre-de-caja'): void {
        this.vista = vista;
        this.actualizarUrlSinNavegacion(vista);
    }

    private actualizarUrlSinNavegacion(vista: string): void {
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { vista: vista },
            queryParamsHandling: 'merge',
            replaceUrl: true
        });
    }

    private esVistaValida(vista: string): boolean {
        return ['generacion-de-ventas', 'presupuestos', 'historial-de-ventas', 'cierre-de-caja'].includes(vista);
    }

    // =========== MÉTODO MODIFICADO PARA CARGAR PRODUCTOS Y SEDES ===========
    private cargarProductosYSedes(): void {
        this.iniciarCarga();
        this.tareaIniciada();

        forkJoin({
            //  productos: this.productoService.getProductos().pipe(take(1)),
            user: this.userStateService.currentUser$.pipe(
                take(1),
                catchError(error => {
                    console.error('Error al cargar usuario:', error);
                    this.snackBar.open('⚠️ Error al cargar su información de usuario.', 'Cerrar', {
                        duration: 5000,
                        panelClass: ['snackbar-error']
                    });
                    return of(null);
                })
            )
        }).subscribe(({ user }) => {
            // Las sedes ya están cargadas en UserStateService
            const sedesCargadas = this.userStateService.getSedes();

            this.sedesDisponibles = sedesCargadas
                .map(s => ({
                    ...s,
                    key: s.key?.trim().toLowerCase() || '',
                    nombre: s.nombre?.trim() || ''
                }))
                .sort((a, b) =>
                    a.nombre.replace(/^sede\s+/i, '').localeCompare(
                        b.nombre.replace(/^sede\s+/i, ''),
                        'es',
                        { sensitivity: 'base' }
                    )
                );

            const sedeUsuario = (user?.sede ?? '').trim().toLowerCase();
            const sedeValida = this.sedesDisponibles.some(s => s.key === sedeUsuario);

            this.sedeActiva = sedeValida ? sedeUsuario : '';
            this.sedeFiltro = this.sedeActiva;

            // Obtener la información completa de la sede actual
            if (this.sedeActiva) {
                this.sedeInfo = this.userStateService.getSedePorKey(this.sedeActiva);
            }

            this.tareaFinalizada();
        });
    }

    // =========== GETTER PARA COMPONENTES HIJOS ===========
    get estanSedesCargadas(): boolean {
        return this.sedesCargadas;
    }

    cargarPacientes(): void {
        this.dataIsReady = false;
        this.loader.show();
        this.pacientesService.getPacientes().subscribe({
            next: (data) => {
                this.pacientes = Array.isArray(data.pacientes)
                    ? data.pacientes.map((p: any) => {
                        const info = p.informacionPersonal;
                        const historia = p.historiaClinica;

                        return {
                            id: p.id,
                            key: p.key,
                            fechaRegistro: this.formatearFecha(p.created_at),
                            sede: p.sedeId?.toLowerCase() ?? 'sin-sede',
                            redesSociales: p.redesSociales || [],

                            informacionPersonal: {
                                esMenorSinCedula: info.esMenorSinCedula ?? false,
                                nombreCompleto: info.nombreCompleto,
                                cedula: info.cedula,
                                telefono: info.telefono,
                                email: info.email,
                                fechaNacimiento: info.fechaNacimiento,
                                edad: this.calcularEdad(info.fechaNacimiento),
                                ocupacion: info.ocupacion,
                                genero: info.genero === 'm' ? 'Masculino' : info.genero === 'f' ? 'Femenino' : 'Otro',
                                direccion: info.direccion
                            },

                            historiaClinica: {
                                usuarioLentes: historia.usuarioLentes ?? null,
                                tipoCristalActual: historia.tipoCristalActual ?? '',
                                ultimaGraduacion: historia.ultimaGraduacion ?? '',
                                fotofobia: historia.fotofobia ?? null,
                                traumatismoOcular: historia.traumatismoOcular ?? null,
                                traumatismoOcularDescripcion: historia.traumatismoOcularDescripcion ?? '',
                                usoDispositivo: historia.usoDispositivo,
                                tiempoUsoEstimado: historia.tiempoUsoEstimado ?? '',
                                cirugiaOcular: historia.cirugiaOcular ?? null,
                                cirugiaOcularDescripcion: historia.cirugiaOcularDescripcion ?? '',
                                alergicoA: historia.alergicoA ?? null,
                                antecedentesPersonales: historia.antecedentesPersonales ?? [],
                                antecedentesFamiliares: historia.antecedentesFamiliares ?? [],
                                patologias: historia.patologias ?? [],
                                patologiaOcular: historia.patologiaOcular ?? []
                            }
                        };

                    })
                    : [];
                this.actualizarPacientesPorSede();
                setTimeout(() => {
                    this.dataIsReady = true;
                    this.loader.hide();
                }, 100);
            },
            error: (err: HttpErrorResponse) => {
                this.pacientes = [];
                this.dataIsReady = false;
                this.loader.hide();
                if (err.status === 404) {
                    this.swalService.showWarning(
                        'Sin registros',
                        'No se encontraron pacientes en el sistema'
                    );
                    return;
                }
            }
        });
    }

    cargarHistoriaMedicaCompleta(): void {
        const paciente = this.pacientes.find(p => p.id === this.venta.pacienteId);
        const pacienteKey = paciente?.key?.trim();

        if (!pacienteKey) {
            this.historiaMedica = null;
            return;
        }

        this.loader.show();
        this.historiaService.getHistoriasPorPaciente(pacienteKey).pipe(take(1)).subscribe({
            next: (historias: HistoriaMedica[]) => {
                const historiaOrdenada = historias.sort((a, b) => {
                    const fechaA = new Date(a.auditoria?.fechaCreacion || '').getTime();
                    const fechaB = new Date(b.auditoria?.fechaCreacion || '').getTime();

                    if (fechaA !== fechaB) return fechaB - fechaA;

                    const extraerSecuencia = (nHistoria: string): number => {
                        const partes = nHistoria?.split('-');
                        return partes?.length === 3 ? parseInt(partes[2], 10) : 0;
                    };

                    return extraerSecuencia(b.nHistoria) - extraerSecuencia(a.nHistoria);
                });

                this.historiaMedica = historiaOrdenada[0] ?? null;
                this.loader.hide();
            },
            error: (error: HttpErrorResponse) => {
                console.error('Error al cargar historia médica:', error);
                this.historiaMedica = null;
                this.loader.hide();
                this.snackBar.open(`⚠️ No se pudo cargar la historia médica del paciente.`, 'Cerrar', {
                    duration: 3000,
                    panelClass: ['snackbar-warning']
                });
            }
        });
    }

    get esSoloLectura(): boolean {
        return this.modoModal === 'ver';
    }

    get pacientesFiltradosPorSede(): any[] {
        return this.pacientes.filter(p => p.sede === this.sedeActiva);
    }

    // =========== MÉTODO PARA OBTENER ENCABEZADO DE RECIBO ===========
    getEncabezadoRecibo(): string {
        if (this.sedeInfo) {
            return `
                <div class="empresa-nombre">${this.sedeInfo.nombre_optica}</div>
                <div class="empresa-info">${this.sedeInfo.direccion} | Tel: ${this.sedeInfo.telefono}</div>
                <div class="empresa-info">RIF: ${this.sedeInfo.rif} | ${this.sedeInfo.email}</div>
            `;
        }

        // Fallback si no hay información de sede
        return `
            <div class="empresa-nombre">NEW VISION LENS</div>
            <div class="empresa-info">C.C. Candelaria, Local PB-04, Guarenas | Tel: 0212-365-39-42</div>
            <div class="empresa-info">RIF: J-123456789 | newvisionlens2020@gmail.com</div>
        `;
    }

    formatearFecha(fechaIso: string): string {
        if (!fechaIso || typeof fechaIso !== 'string') return 'Fecha inválida';
        if (fechaIso.includes('/') && !fechaIso.includes('T')) return fechaIso;
        const fechaLimpiada = fechaIso.split('T')[0];
        const [anio, mes, dia] = fechaLimpiada.split('-');
        return `${dia}/${mes}/${anio}`;
    }

    calcularEdad(fechaNac: string): number | '--' {
        if (!fechaNac) return '--';
        const nacimiento = new Date(fechaNac);
        if (isNaN(nacimiento.getTime())) return '--';
        const hoy = new Date();
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        const mes = hoy.getMonth() - nacimiento.getMonth();
        if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
            edad--;
        }
        return edad >= 0 ? edad : '--';
    }

    private obtenerTasasCambio(): void {
        this.tasaCambiariaService.getTasaActual().subscribe({
            next: (res: { tasas: Tasa[] }) => {
                const monedasVisuales: MonedaVisual[] = res.tasas.map(t => ({
                    id: t.id?.toLowerCase() ?? '',
                    alias: t.id === 'dolar' ? 'USD' : t.id === 'euro' ? 'EUR' : 'Bs',
                    simbolo: t.simbolo?.trim() ?? '',
                    nombre: t.nombre?.trim() ?? '',
                    valor: t.valor ?? 0
                }));

                this.tasaDolar = monedasVisuales.find(m => m.id === 'dolar')?.valor ?? 0;
                this.tasaEuro = monedasVisuales.find(m => m.id === 'euro')?.valor ?? 0;
                this.moneda = monedasVisuales;
            },
            error: () => {
                this.tasaDolar = 0;
                this.tasaEuro = 0;
                this.moneda = [
                    { id: 'dolar', alias: 'USD', simbolo: '$', nombre: 'Dólar', valor: 0 },
                    { id: 'euro', alias: 'EUR', simbolo: '€', nombre: 'Euro', valor: 0 },
                    { id: 'bolivar', alias: 'Bs', simbolo: 'Bs', nombre: 'Bolívar', valor: 1 }
                ];
            }
        });
    }

    private iniciarCarga(): void {
        this.tareasPendientes = 0;
        this.loader.show();
    }

    private tareaIniciada(): void {
        this.tareasPendientes++;
        this.dataIsReady = false;
    }

    private tareaFinalizada(): void {
        this.tareasPendientes--;
        if (this.tareasPendientes <= 0) {
            setTimeout(() => this.loader.hide(), 300);
            this.dataIsReady = true;
        }
    }

    abrirModal(modo: 'agregar' | 'editar' | 'ver', producto?: Producto): void {
        setTimeout(() => {
            this.cdr.detectChanges?.();
        });
        document.body.classList.add('modal-open');
    }

    cerrarModal(): void {
        this.cargando = false;
        document.body.classList.remove('modal-open');
    }

    private normalizarMoneda(moneda: string): string {
        switch (moneda?.toLowerCase()) {
            case 'usd': return 'dolar';
            case 'eur': return 'euro';
            case 'ves': return 'bolivar';
            default: return moneda?.toLowerCase() ?? 'bolivar';
        }
    }

    esMonedaBolivar(moneda: string): boolean {
        return this.normalizarMoneda(moneda) === 'bolivar';
    }

    getPrecioBs(producto: Producto): number {
        const monedaId = this.normalizarMoneda(producto.moneda);
        const tasa = this.moneda.find(m => m.id === monedaId)?.valor ?? 1;
        return producto.precio * tasa;
    }

    getSimboloMoneda(monedaId: string): string {
        const id = this.normalizarMoneda(monedaId);
        return this.moneda.find(m => m.id === id)?.simbolo ?? '';
    }

    actualizarPacientesPorSede(): void {
        const sedeId = this.sedeFiltro?.trim().toLowerCase();
        this.productosFiltradosPorSede = !sedeId
            ? [...this.productos]
            : this.productos.filter(p => p.sede === sedeId);
    }

    obtenerSedeDesdePaciente(productos: Producto): string {
        return productos?.sede?.toLowerCase() || '';
    }
}