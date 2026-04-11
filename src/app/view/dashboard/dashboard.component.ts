import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthData, Rol } from '../../Interfaces/models-interface';
import { PacientesService } from '../../core/services/pacientes/pacientes.service';
import { HistoriaMedicaService } from '../../core/services/historias-medicas/historias-medicas.service';
import { PacienteGrafico } from './../pacientes/paciente-interface';
import { DatosPorSede } from './dashboard-interface';
import { catchError, forkJoin, of, timer } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { LoaderService } from '../../shared/loader/loader.service';
import { Router, NavigationStart } from '@angular/router';
import { filter } from 'rxjs/operators';
import { HistorialVentaService } from '../ventas/historial-ventas/historial-ventas.service';
import { OrdenesTrabajoService } from '../gestion-ordenes-trabajo/gestion-ordenes-trabajo.service';
import { OrdenTrabajo } from '../gestion-ordenes-trabajo/gestion-ordenes-trabajo.model';


@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  rolUsuario: Rol | null = null;
  sedeActual: string = '';
  isLoading: boolean = false;
  private fromLogin: boolean = false;
  private loaderTimeout: any;

  // Métricas operativas
  totalPacientes: number = 0;
  totalHistorias: number = 0;
  ventasHoy: number = 0;
  ventasMes: number = 0;
  ventasPendientesMes: number = 0;
  montoVentasMes: number = 0;
  pacientesHoy: number = 0;
  pacientesNuevosMes: number = 0;
  historiasHoy: number = 0;
  historiasMesActual: number = 0;
  ordenesPorPasarLaboratorio: number = 0;
  ordenesEnLaboratorio: number = 0;
  ordenesListasLaboratorio: number = 0;
  ordenesPendienteRetiro: number = 0;
  ordenesCreadasHoy: number = 0;
  totalOrdenesActivas: number = 0;

  pacientes: PacienteGrafico[] = [];
  private pacientesApi: any[] = [];
  private historiasApi: any[] = [];
  private ventasApi: any[] = [];
  private ordenesApi: OrdenTrabajo[] = [];

  //Datos para comparativa por sede
  datosComparativa: Record<string, DatosPorSede> | null = null;

  //Distribución mensual por sede actual
  datosLocales: {
    total: number;
    porMes: Record<string, { pacientes: number; ventas: number; ordenes: number; historias: number }>;
  } | null = null;

  // Métricas adicionales
  crecimientoPacientes: number = 0;
  crecimientoHistorias: number = 0;
  fechaActual: Date = new Date();

  // Timers para actualización automática
  private actualizacionTimer: any;

  constructor(
    private pacientesService: PacientesService,
    private historiasService: HistoriaMedicaService,
    private historialVentaService: HistorialVentaService,
    private ordenesTrabajoService: OrdenesTrabajoService,
    private loader: LoaderService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.detectarNavegacionDesdeLogin();
    this.initializePantalla();
    this.iniciarActualizacionAutomatica();
  }

  ngOnDestroy(): void {
    this.detenerActualizacionAutomatica();

    if (this.loaderTimeout) {
      clearTimeout(this.loaderTimeout);
    }
  }

  private detectarNavegacionDesdeLogin(): void {
    // Verificar si hay una marca en sessionStorage
    this.fromLogin = sessionStorage.getItem('fromLogin') === 'true';

    // Limpiar la marca inmediatamente después de usarla
    if (this.fromLogin) {
      sessionStorage.removeItem('fromLogin');
    }

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationStart)
      )
      .subscribe((event: NavigationStart) => {
        // Si la navegación es desde el login, no mostrar loader
        if (event.navigationTrigger === 'imperative' &&
          event.restoredState === null &&
          this.esPrimeraCarga()) {
          this.fromLogin = true;
          console.log('🔍 fromLogin por navegación:', this.fromLogin);
        }
      });
  }

  /**
   * Verifica si es la primera carga del dashboard
   */
  private esPrimeraCarga(): boolean {
    return !sessionStorage.getItem('dashboardLoaded');
  }

  /**
   * Marcar que el dashboard ya fue cargado
   */
  private marcarComoCargado(): void {
    sessionStorage.setItem('dashboardLoaded', 'true');
  }

  private initializePantalla(): void {
    const sessionUser = sessionStorage.getItem('authData');
    if (sessionUser) {
      const auth = JSON.parse(sessionUser) as AuthData;
      this.rolUsuario = auth.rol ?? null;
      this.sedeActual = this.normalizarSede(auth.sede?.key ?? 'sin-sede');
    }

    this.cargarDashboard();
  }

  cargarDashboard(): void {
    this.isLoading = true;

    this.loader.hide();
    if (!this.fromLogin) {
      // Mostrar loader solo después de 100ms (para cargas lentas)
      const loaderTimer = timer(100).subscribe(() => {
        if (this.isLoading) {
          this.loader.show();
        }
      });

      this.obtenerCargaDashboard().pipe(
        finalize(() => {
          loaderTimer.unsubscribe();
          this.isLoading = false;
          this.loader.hide();
        })
      ).subscribe({
        next: (response) => {
          this.procesarDatos(response);
        },
        error: (err) => {
          console.error('Error al cargar datos:', err);
          this.pacientes = [];
          this.totalHistorias = 0;
          this.loader.forceHide();
        }
      });
    } else {
      this.obtenerCargaDashboard().pipe(
        finalize(() => {
          this.isLoading = false;
          this.marcarComoCargado();
          this.fromLogin = false;

        })
      ).subscribe({
        next: (response) => {
          this.procesarDatos(response);
        },
        error: (err) => {
          console.error('Error al cargar datos:', err);
          this.pacientes = [];
          this.totalHistorias = 0;
          this.fromLogin = false; // Resetear incluso en error
        }
      });
    }
  }

  private obtenerCargaDashboard() {
    const hoy = new Date();
    const filtrosHoy = this.crearFiltroDia(hoy);
    const filtrosMes = this.crearFiltroMes(hoy);
    const filtrosUltimosMeses = this.crearFiltroUltimosMeses(hoy, 11);

    return forkJoin({
      pacientes: this.pacientesService.getPacientes().pipe(
        catchError(error => {
          console.error('Error cargando pacientes del dashboard:', error);
          return of({ pacientes: [] });
        })
      ),
      historias: this.historiasService.getHistoriasMedicasAll().pipe(
        catchError(error => {
          console.error('Error cargando historias del dashboard:', error);
          return of({ historiales_medicos: [] });
        })
      ),
      ventasHoy: this.historialVentaService.obtenerEstadisticasVentas(filtrosHoy).pipe(
        catchError(error => {
          console.error('Error cargando ventas del dia:', error);
          return of(this.crearEstadisticasVentasVacias());
        })
      ),
      ventasMes: this.historialVentaService.obtenerEstadisticasVentas(filtrosMes).pipe(
        catchError(error => {
          console.error('Error cargando ventas del mes:', error);
          return of(this.crearEstadisticasVentasVacias());
        })
      ),
      ventasHistorico: this.historialVentaService.obtenerVentasPaginadas(1, 1000, filtrosUltimosMeses).pipe(
        catchError(error => {
          console.error('Error cargando historico de ventas para dashboard:', error);
          return of({ ventas: [], pagination: { total: 0, page: 1, pages: 1, per_page: 1000 } });
        })
      ),
      ordenes: this.ordenesTrabajoService.getOrdenesTrabajo().pipe(
        catchError(error => {
          console.error('Error cargando ordenes del dashboard:', error);
          return of({ message: 'error', ordenes_trabajo: [] });
        })
      )
    });
  }

  private procesarDatos(response: any): void {
    const { pacientes, historias, ventasHoy, ventasMes, ventasHistorico, ordenes } = response;

    this.pacientesApi = Array.isArray(pacientes?.pacientes) ? pacientes.pacientes : [];
    this.historiasApi = Array.isArray(historias?.historiales_medicos) ? historias.historiales_medicos : [];
    this.ventasApi = Array.isArray(ventasHistorico?.ventas) ? ventasHistorico.ventas : [];
    this.ordenesApi = Array.isArray(ordenes?.ordenes_trabajo) ? ordenes.ordenes_trabajo : [];

    this.ventasHoy = this.obtenerNumeroSeguro(ventasHoy?.ventas);
    this.ventasMes = this.obtenerNumeroSeguro(ventasMes?.ventas);
    this.ventasPendientesMes = this.obtenerNumeroSeguro(ventasMes?.pendientes);
    this.montoVentasMes = this.obtenerNumeroSeguro(ventasMes?.montoTotalGeneral);

    this.pacientes = Array.isArray(pacientes.pacientes)
      ? pacientes.pacientes.map((p: any): PacienteGrafico => ({
        key: p.key,
        nombre: p.informacionPersonal?.nombreCompleto,
        cedula: p.informacionPersonal?.cedula,
        sede: this.normalizarSede(p.sedeId ?? 'sin-sede'),
        created_at: p.created_at
      }))
      : [];

    const pacientesSede = this.pacientesApi.filter((p: any) => this.normalizarSede(p?.sedeId ?? 'sin-sede') === this.sedeActual);
    const historiasSede = this.historiasApi.filter((h: any) => this.normalizarSede(h?.sedeId ?? 'sin-sede') === this.sedeActual);
    const ordenesSede = this.ordenesApi.filter((orden: OrdenTrabajo) => this.normalizarSede(orden?.sede ?? this.sedeActual) === this.sedeActual);
    const ventasSede = this.ventasApi.filter((venta: any) => {
      const sedeVenta = this.normalizarSede(venta?.sede ?? this.sedeActual);
      return sedeVenta === this.sedeActual;
    });

    this.totalPacientes = pacientesSede.length;
    this.totalHistorias = historiasSede.length;

    this.cargarDatosGraficos(pacientesSede, historiasSede, ventasSede, ordenesSede);
    this.calcularMetricasOperativas(pacientesSede, historiasSede, ordenesSede);
  }

  cargarDatosGraficos(pacientesSede: any[], historiasSede: any[], ventasSede: any[], ordenesSede: OrdenTrabajo[]): void {
    const agrupadoPorSede: Record<string, DatosPorSede> = {};

    // Contar pacientes por sede
    for (const p of this.pacientes) {
      const sede = this.normalizarSede(p.sede);
      if (!agrupadoPorSede[sede]) {
        agrupadoPorSede[sede] = {
          pacientes: 0,
          historias: 0,
          consultasPendientes: 0,
          historiasFacturadas: 0
        };
      }
      agrupadoPorSede[sede].pacientes += 1;
    }

    // Contar historias por sede
    for (const h of this.historiasApi) {
      const sede = this.normalizarSede(h.sedeId ?? 'sin-sede');
      if (!agrupadoPorSede[sede]) {
        agrupadoPorSede[sede] = {
          pacientes: 0,
          historias: 0,
          consultasPendientes: 0,
          historiasFacturadas: 0
        };
      }
      agrupadoPorSede[sede].historias += 1;
      if (h?.pagoPendiente) {
        agrupadoPorSede[sede].consultasPendientes += 1;
      }
      if (h?.ventaKey) {
        agrupadoPorSede[sede].historiasFacturadas += 1;
      }
    }

    const key = this.rolUsuario?.key ?? '';
    if (['admin', 'gerente'].includes(key)) {
      this.datosComparativa = agrupadoPorSede;
    }

    const porMes: Record<string, { pacientes: number; ventas: number; ordenes: number; historias: number }> = {};

    for (const historia of historiasSede) {
      this.incrementarConteoMensual(porMes, historia?.auditoria?.fechaCreacion ?? historia?.created_at, 'historias');
    }

    for (const paciente of pacientesSede) {
      this.incrementarConteoMensual(porMes, paciente?.created_at, 'pacientes');
    }

    for (const venta of ventasSede) {
      this.incrementarConteoMensual(porMes, this.obtenerFechaVenta(venta), 'ventas');
    }

    for (const orden of ordenesSede) {
      this.incrementarConteoMensual(porMes, orden?.fechaCreacion, 'ordenes');
    }

    this.datosLocales = {
      total: pacientesSede.length + historiasSede.length + ventasSede.length + ordenesSede.length,
      porMes
    };

    // Calcular crecimientos
    this.calcularCrecimientos(porMes);
  }

  /**
   * Calcula las métricas de crecimiento
   */
  private calcularCrecimientos(porMes: Record<string, any>): void {
    const meses = Object.keys(porMes);
    if (meses.length >= 2) {
      const mesActual = meses[meses.length - 1];
      const mesAnterior = meses[meses.length - 2];

      // Crecimiento de pacientes
      const pacientesActual = porMes[mesActual]?.pacientes || 0;
      const pacientesAnterior = porMes[mesAnterior]?.pacientes || 0;
      this.crecimientoPacientes = this.calcularPorcentajeCrecimiento(pacientesActual, pacientesAnterior);

      // Crecimiento de historias
      const historiasActual = porMes[mesActual]?.historias || 0;
      const historiasAnterior = porMes[mesAnterior]?.historias || 0;
      this.crecimientoHistorias = this.calcularPorcentajeCrecimiento(historiasActual, historiasAnterior);

    } else {
      this.crecimientoPacientes = 0;
      this.crecimientoHistorias = 0;
    }
  }

  /**
   * Calcula el porcentaje de crecimiento entre dos valores
   */
  private calcularPorcentajeCrecimiento(actual: number, anterior: number): number {
    if (anterior === 0) return actual > 0 ? 100 : 0;
    return Math.round(((actual - anterior) / anterior) * 100);
  }

  /**
   * Calcula métricas adicionales para el dashboard
   */
  private calcularMetricasOperativas(pacientesSede: any[], historiasSede: any[], ordenesSede: OrdenTrabajo[]): void {
    const hoy = new Date();

    this.pacientesHoy = pacientesSede.filter((p: any) => this.esMismoDia(p?.created_at, hoy)).length;
    this.pacientesNuevosMes = pacientesSede.filter((p: any) => this.esMismoMes(p?.created_at, hoy)).length;
    this.historiasHoy = historiasSede.filter((h: any) => this.esMismoDia(h?.auditoria?.fechaCreacion ?? h?.created_at, hoy)).length;
    this.historiasMesActual = historiasSede.filter((h: any) => this.esMismoMes(h?.auditoria?.fechaCreacion ?? h?.created_at, hoy)).length;

    const ordenesActivas = ordenesSede.filter((orden: OrdenTrabajo) => !orden?.archivado && orden?.estado !== 'entregado');
    this.totalOrdenesActivas = ordenesActivas.length;
    this.ordenesPorPasarLaboratorio = ordenesActivas.filter((orden: OrdenTrabajo) => orden?.estado === 'en_tienda').length;
    this.ordenesEnLaboratorio = ordenesActivas.filter((orden: OrdenTrabajo) => orden?.estado === 'proceso_laboratorio').length;
    this.ordenesListasLaboratorio = ordenesActivas.filter((orden: OrdenTrabajo) => orden?.estado === 'listo_laboratorio').length;
    this.ordenesPendienteRetiro = ordenesActivas.filter((orden: OrdenTrabajo) => orden?.estado === 'pendiente_retiro').length;
    this.ordenesCreadasHoy = ordenesSede.filter((orden: OrdenTrabajo) => this.esMismoDia(orden?.fechaCreacion, hoy)).length;
  }

  private esMismoMes(fecha: string | null | undefined, referencia: Date): boolean {
    if (!fecha) return false;

    const fechaEvaluada = new Date(fecha);
    if (Number.isNaN(fechaEvaluada.getTime())) return false;

    return fechaEvaluada.getFullYear() === referencia.getFullYear()
      && fechaEvaluada.getMonth() === referencia.getMonth();
  }

  private esMismoDia(fecha: string | null | undefined, referencia: Date): boolean {
    if (!fecha) return false;

    const fechaEvaluada = new Date(fecha);
    if (Number.isNaN(fechaEvaluada.getTime())) return false;

    return fechaEvaluada.getFullYear() === referencia.getFullYear()
      && fechaEvaluada.getMonth() === referencia.getMonth()
      && fechaEvaluada.getDate() === referencia.getDate();
  }

  private incrementarConteoMensual(
    porMes: Record<string, { pacientes: number; ventas: number; ordenes: number; historias: number }>,
    fechaRaw: string | null | undefined,
    key: 'pacientes' | 'historias' | 'ventas' | 'ordenes'
  ): void {
    if (!fechaRaw) return;

    const fecha = new Date(fechaRaw);
    if (Number.isNaN(fecha.getTime())) return;

    const mes = fecha.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!porMes[mes]) {
      porMes[mes] = {
        pacientes: 0,
        ventas: 0,
        ordenes: 0,
        historias: 0
      };
    }

    porMes[mes][key] += 1;
  }

  private crearFiltroDia(fecha: Date): any {
    const fechaFormateada = this.formatDate(fecha);
    return {
      fechaDesde: fechaFormateada,
      fechaHasta: fechaFormateada
    };
  }

  private crearFiltroMes(fecha: Date): any {
    return {
      fechaDesde: this.formatDate(new Date(fecha.getFullYear(), fecha.getMonth(), 1)),
      fechaHasta: this.formatDate(fecha)
    };
  }

  private crearFiltroUltimosMeses(fecha: Date, mesesAtras: number): any {
    return {
      fechaDesde: this.formatDate(new Date(fecha.getFullYear(), fecha.getMonth() - mesesAtras, 1)),
      fechaHasta: this.formatDate(fecha)
    };
  }

  private formatDate(fecha: Date): string {
    return fecha.toISOString().split('T')[0];
  }

  private crearEstadisticasVentasVacias(): any {
    return {
      message: 'ok',
      ventas: 0,
      pendientes: 0,
      completadas: 0,
      canceladas: 0,
      montoTotalGeneral: 0
    };
  }

  private obtenerNumeroSeguro(valor: unknown): number {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
  }

  private obtenerFechaVenta(venta: any): string | null {
    return venta?.fecha ?? venta?.auditoria?.fechaCreacion ?? venta?.created_at ?? null;
  }

  private normalizarSede(sede: string | null | undefined): string {
    return (sede ?? 'sin-sede').toString().trim().toLowerCase();
  }

  /**
   * Inicia la actualización automática de la hora
   */
  private iniciarActualizacionAutomatica(): void {
    this.actualizacionTimer = setInterval(() => {
      this.fechaActual = new Date();
    }, 60000); // Actualizar cada minuto
  }

  /**
   * Detiene la actualización automática
   */
  private detenerActualizacionAutomatica(): void {
    if (this.actualizacionTimer) {
      clearInterval(this.actualizacionTimer);
    }
  }

  /**
   * Exporta un gráfico (función placeholder)
   */
  exportarGrafico(tipo: string): void {
    // console.log(`Exportando gráfico: ${tipo}`);
    // Implementación futura para exportar gráficos
    alert(`Funcionalidad de exportar ${tipo} en desarrollo`);
  }

  /**
   * Maximiza un gráfico (función placeholder)
   */
  maximizarGrafico(tipo: string): void {
    // console.log(`Maximizando gráfico: ${tipo}`);
    // Implementación futura para vista ampliada
    alert(`Vista ampliada de ${tipo} en desarrollo`);
  }

  /**
   * Navegación para acciones rápidas
   */
  irAPacientes(): void {
    this.router.navigate(['/pacientes']);
  }

  nuevoPaciente(): void {
    this.router.navigate(['/pacientes']).then(() => {
      setTimeout(() => this.pacientesService.solicitarAbrirModalNuevoPaciente(), 200);
    });
  }

  nuevaHistoria(): void {
    this.router.navigate(['/pacientes-historias']);
  }

  irAVentas(): void {
    this.router.navigate(['/ventas'], { queryParams: { vista: 'generacion-de-ventas' } });
  }

  irAHistorialVentas(): void {
    this.router.navigate(['/ventas'], { queryParams: { vista: 'historial-de-ventas' } });
  }

  irAOrdenes(): void {
    this.router.navigate(['/ordenes-de-trabajo']);
  }

  irAInventario(): void {
    this.router.navigate(['/productos-inventario']);
  }

  irATasa(): void {
    this.router.navigate(['/Tipo-de-cambio']);
  }

  /**
   * Función auxiliar para Math.abs en template
   */
  get Math(): Math {
    return Math;
  }

  /**
   * Recarga manual de datos
   */
  recargarDatos(): void {
    this.cargarDashboard();
  }

  /**
   * Verifica si hay datos para mostrar
   */
  get hayDatos(): boolean {
    return (this.datosLocales?.total ?? 0) > 0
      || this.ventasHoy > 0
      || this.ventasMes > 0
      || this.totalOrdenesActivas > 0;
  }

  /**
   * Obtiene el texto del último update
   */
  get textoUltimoUpdate(): string {
    const ahora = new Date();
    const diffMs = ahora.getTime() - this.fechaActual.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Actualizado hace instantes';
    if (diffMins === 1) return 'Actualizado hace 1 minuto';
    if (diffMins < 60) return `Actualizado hace ${diffMins} minutos`;

    const diffHours = Math.floor(diffMins / 60);
    return `Actualizado hace ${diffHours} h`;
  }

  get puedeVerComparativa(): boolean {
    const key = this.rolUsuario?.key ?? '';
    return ['admin', 'gerente'].includes(key) && !!this.datosComparativa;
  }

  get nombreSedeVisible(): string {
    const sede = (this.sedeActual || 'tu sede').replace(/_/g, ' ');
    return sede.replace(/\b\w/g, char => char.toUpperCase());
  }
}