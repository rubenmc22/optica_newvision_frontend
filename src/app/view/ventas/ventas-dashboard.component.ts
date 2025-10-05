import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { Producto, ProductoDto, MonedaVisual } from '../productos/producto.model';
import { ProductoService } from '../productos/producto.service';
import { Sede } from '../../view/login/login-interface';

import { TasaCambiariaService } from '../../core/services/tasaCambiaria/tasaCambiaria.service';
import { Tasa } from '../../Interfaces/models-interface';
import { SwalService } from '../../core/services/swal/swal.service';
import { Observable, of, forkJoin, map } from 'rxjs';
import { switchMap, take, catchError } from 'rxjs/operators';
import { LoaderService } from './../../shared/loader/loader.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/services/auth/auth.service';
import { UserStateService } from '../../core/services/userState/user-state-service';
import { HttpErrorResponse } from '@angular/common/http';
import { PacientesService } from '../../core/services/pacientes/pacientes.service';
import { HistoriaMedicaService } from '../../core/services/historias-medicas/historias-medicas.service';
import { HistoriaMedica, Recomendaciones, TipoMaterial, Antecedentes, ExamenOcular, Medico, DatosConsulta } from './../historias-medicas/historias_medicas-interface';


@Component({
    selector: 'app-ventas-dashboard',
    standalone: false,
    templateUrl: './ventas-dashboard.component.html',
    styleUrl: './ventas-dashboard.component.scss'
})
export class VentasDashboardComponent {
    vista: 'venta' | 'presupuesto' | 'historial' | 'caja' = 'venta';

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
    sedesDisponibles: Sede[] = [];
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
    pacientes: any[] = []; // Puedes tipar con PacienteDto si lo tienes
    historiaMedica: any = null; // Puedes tipar con HistoriaMedicaDto

    // FILTROS
    sedeActiva: string = '';
    sedeFiltro: string = this.sedeActiva;

    // TASAS DE CAMBIO
    moneda: MonedaVisual[] = [];
    tasaDolar = 0;
    tasaEuro = 0;

    constructor(
        private productoService: ProductoService,
        private tasaCambiariaService: TasaCambiariaService,
        //    private fb: FormBuilder,
        private swalService: SwalService,
        private userStateService: UserStateService,
        private snackBar: MatSnackBar,
        private authService: AuthService,
        private cdr: ChangeDetectorRef,
        private loader: LoaderService,
        private pacientesService: PacientesService,
        private historiaService: HistoriaMedicaService
    ) { }

    // =========== LIFECYCLE HOOKS ===========
    ngOnInit(): void {
        this.cargarDatosIniciales();
    }

    cambiarVista(v: typeof this.vista): void {
        this.vista = v;
    }

    private cargarDatosIniciales(): void {
        this.iniciarCarga();
        this.tareaIniciada();
        this.obtenerTasasCambio();
        this.cargarProductosYSedes(); // delega la lógica
    }

    // =========== GESTIÓN DE DATOS ===========
    private cargarProductosYSedes(): void {
        this.iniciarCarga();
        this.tareaIniciada();

        forkJoin({
            productos: this.productoService.getProductos().pipe(
                take(1)
            ),
            sedes: this.authService.getSedes().pipe(
                take(1),
                catchError(error => {
                    console.error('Error al cargar sedes:', error);
                    this.snackBar.open('⚠️ No se pudieron cargar las sedes disponibles.', 'Cerrar', {
                        duration: 5000,
                        panelClass: ['snackbar-warning']
                    });
                    return of({ sedes: [] });
                })
            ),
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
        }).subscribe(({ productos, sedes, user }) => {
          //  this.productos = productos;

            this.sedesDisponibles = (sedes.sedes ?? [])
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

            this.tareaFinalizada();
        });
    }

    cargarPacientes(): void {
        this.dataIsReady = false;
        this.loader.show(); // activa el loader
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
                }, 100); // Delay visual para evitar parpadeo
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

    formatearFecha(fechaIso: string): string {
        if (!fechaIso || typeof fechaIso !== 'string') return 'Fecha inválida';

        // Evita formatear si ya está en formato DD/MM/YYYY
        if (fechaIso.includes('/') && !fechaIso.includes('T')) return fechaIso;

        const fechaLimpiada = fechaIso.split('T')[0]; // elimina hora si está presente
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

                // Guardar tasas específicas si las necesitas
                this.tasaDolar = monedasVisuales.find(m => m.id === 'dolar')?.valor ?? 0;
                this.tasaEuro = monedasVisuales.find(m => m.id === 'euro')?.valor ?? 0;

                // Guardar lista completa para el ng-select
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
            setTimeout(() => this.loader.hide(), 300); // Delay visual
            this.dataIsReady = true;
        }
    }

    // =========== GESTIÓN DE MODAL ===========
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
        //  this.limpiarDatos();
        const sedeId = this.sedeFiltro?.trim().toLowerCase();
        this.productosFiltradosPorSede = !sedeId
            ? [...this.productos]
            : this.productos.filter(p => p.sede === sedeId);
    }

    obtenerSedeDesdePaciente(productos: Producto): string {
        return productos?.sede?.toLowerCase() || '';
    }

}
