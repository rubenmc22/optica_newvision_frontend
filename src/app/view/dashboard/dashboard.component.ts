import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthData, Rol } from '../../Interfaces/models-interface';
import { PacientesService } from '../../core/services/pacientes/pacientes.service';
import { HistoriaMedicaService } from '../../core/services/historias-medicas/historias-medicas.service';
import { PacienteGrafico } from './../pacientes/paciente-interface';
import { DatosPorSede } from './dashboard-interface';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { LoaderService } from '../../shared/loader/loader.service';

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

  // Métricas generales
  totalHistorias: number = 0;
  totalVentas: number = 0;
  ordenesPendientes: number = 0;

  pacientes: PacienteGrafico[] = [];

  // 📊 Datos para comparativa por sede
  datosComparativa: Record<string, DatosPorSede> | null = null;

  // 📅 Distribución mensual por sede actual
  datosLocales: {
    total: number;
    porMes: Record<string, { pacientes: number; ventas: number; ordenes: number; historias: number }>;
  } | null = null;

  // Nuevas métricas para el dashboard mejorado
  crecimientoPacientes: number = 0;
  crecimientoHistorias: number = 0;
  crecimientoVentas: number = 0;
  promedioEdad: number = 0;
  porcentajeMujeres: number = 0;
  porcentajeHombres: number = 0;
  fechaActual: Date = new Date();

  // Timers para actualización automática
  private actualizacionTimer: any;

  constructor(
    private pacientesService: PacientesService,
    private historiasService: HistoriaMedicaService,
    private loader: LoaderService
  ) { }

  ngOnInit(): void {
    this.initializePantalla();
    this.iniciarActualizacionAutomatica();
  }

  ngOnDestroy(): void {
    this.detenerActualizacionAutomatica();
  }

  private initializePantalla(): void {
    const sessionUser = sessionStorage.getItem('authData');
    if (sessionUser) {
      const auth = JSON.parse(sessionUser) as AuthData;
      this.rolUsuario = auth.rol ?? null;
      this.sedeActual = auth.sede?.key ?? 'sin-sede';
    }

    this.cargarPacientesYHistorias();
  }

  cargarPacientesYHistorias(): void {
    this.isLoading = true;
    this.loader.show(); // Mostrar loader

    forkJoin({
      pacientes: this.pacientesService.getPacientes(),
      historias: this.historiasService.getHistoriasMedicasAll()
    }).pipe(
      finalize(() => {
        this.isLoading = false;
        this.loader.hide(); // Ocultar loader al finalizar
      })
    ).subscribe({
      next: ({ pacientes, historias }) => {
        this.pacientes = Array.isArray(pacientes.pacientes)
          ? pacientes.pacientes.map((p: any): PacienteGrafico => ({
            key: p.key,
            nombre: p.informacionPersonal?.nombreCompleto,
            cedula: p.informacionPersonal?.cedula,
            sede: p.sedeId ?? 'sin-sede',
            created_at: p.created_at
          }))
          : [];

        const historiasFiltradas = Array.isArray(historias.historiales_medicos)
          ? historias.historiales_medicos
          : [];

        // CORRECCIÓN: Usar el mismo criterio que en cargarDatosGraficos
        this.totalHistorias = historiasFiltradas.filter(h => h.sedeId === this.sedeActual).length;

        this.cargarDatosGraficos(historiasFiltradas);
        this.calcularMetricasAdicionales();
      },
      error: (err) => {
        console.error('Error al cargar datos:', err);
        this.pacientes = [];
        this.totalHistorias = 0;
        this.loader.forceHide(); // Forzar ocultar loader en error
      }
    });
  }


  cargarDatosGraficos(historias: any[]): void {
    const agrupadoPorSede: Record<string, { pacientes: number; ventas: number; ordenes: number; historias: number }> = {};

    // Contar pacientes por sede
    for (const p of this.pacientes) {
      const sede = p.sede;
      if (!agrupadoPorSede[sede]) {
        agrupadoPorSede[sede] = {
          pacientes: 0,
          ventas: Math.floor(Math.random() * 30),
          ordenes: Math.floor(Math.random() * 10),
          historias: 0
        };
      }
      agrupadoPorSede[sede].pacientes += 1;
    }

    // Contar historias por sede
    for (const h of historias) {
      const sede = h.sedeId ?? 'sin-sede';
      if (!agrupadoPorSede[sede]) {
        agrupadoPorSede[sede] = {
          pacientes: 0,
          ventas: Math.floor(Math.random() * 30),
          ordenes: Math.floor(Math.random() * 10),
          historias: 0
        };
      }
      agrupadoPorSede[sede].historias += 1;
    }

    const key = this.rolUsuario?.key ?? '';
    if (['admin', 'gerente'].includes(key)) {
      this.datosComparativa = agrupadoPorSede;
    }

    // 📅 Agrupación mensual por sede actual
    const historiasSede = historias.filter(h => h.sedeId === this.sedeActual);
    const pacientesSede = this.pacientes.filter(p => p.sede === this.sedeActual);

    const porMes: Record<string, { pacientes: number; ventas: number; ordenes: number; historias: number }> = {};

    // Contar historias por mes
    for (const h of historiasSede) {
      const fecha = new Date(h.auditoria?.fechaCreacion ?? h.created_at);
      const mes = fecha.toLocaleString('default', { month: 'long', year: 'numeric' });

      if (!porMes[mes]) {
        porMes[mes] = {
          pacientes: 0,
          ventas: 0,
          ordenes: 0,
          historias: 0
        };
      }
      porMes[mes].historias += 1;
    }

    // Contar pacientes por mes
    for (const p of pacientesSede) {
      const fecha = new Date(p.created_at);
      const mes = fecha.toLocaleString('default', { month: 'long', year: 'numeric' });

      if (!porMes[mes]) {
        porMes[mes] = {
          pacientes: 0,
          ventas: Math.floor(Math.random() * 15),
          ordenes: Math.floor(Math.random() * 5),
          historias: 0
        };
      }
      porMes[mes].pacientes += 1;
    }

    // Calcular total de ventas y órdenes para la sede actual
    this.totalVentas = Object.values(porMes).reduce((sum, mes) => sum + mes.ventas, 0);
    this.ordenesPendientes = Object.values(porMes).reduce((sum, mes) => sum + mes.ordenes, 0);

    this.datosLocales = {
      total: pacientesSede.length,
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

      // Crecimiento de ventas
      const ventasActual = porMes[mesActual]?.ventas || 0;
      const ventasAnterior = porMes[mesAnterior]?.ventas || 0;
      this.crecimientoVentas = this.calcularPorcentajeCrecimiento(ventasActual, ventasAnterior);
    } else {
      // Valores por defecto si no hay suficientes datos
      this.crecimientoPacientes = 12;
      this.crecimientoHistorias = 8;
      this.crecimientoVentas = -3;
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
  private calcularMetricasAdicionales(): void {
    const pacientesSede = this.pacientes.filter(p => p.sede === this.sedeActual);

    // Simular datos demográficos (en una implementación real vendrían del backend)
    this.promedioEdad = 42; // Valor simulado
    this.porcentajeMujeres = 58; // Valor simulado
    this.porcentajeHombres = 42; // Valor simulado
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
    // Navegar a la página de pacientes
    // console.log('Navegando a pacientes');
  }

  nuevoPaciente(): void {
    // Navegar a crear nuevo paciente
    //  console.log('Creando nuevo paciente');
  }

  nuevaHistoria(): void {
    // Navegar a crear nueva historia
    //   console.log('Creando nueva historia médica');
  }

  agendarCita(): void {
    // Navegar a agendar cita
    //   console.log('Agendando cita');
  }

  verReportes(): void {
    // Navegar a reportes
    // console.log('Viendo reportes');
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
    this.cargarPacientesYHistorias();
  }

  /**
   * Obtiene la clase CSS para el trend basado en el valor
   */
  getTrendClass(valor: number, tipo: string = 'default'): string {
    if (tipo === 'ventas') {
      return valor >= 0 ? 'trend-positive' : 'trend-negative';
    } else if (tipo === 'ordenes') {
      return valor <= 5 ? 'trend-positive' : 'trend-negative';
    }
    return valor >= 0 ? 'trend-positive' : 'trend-negative';
  }

  /**
   * Obtiene el icono para el trend basado en el valor
   */
  getTrendIcon(valor: number, tipo: string = 'default'): string {
    if (tipo === 'ordenes') {
      return valor <= 5 ? 'fa-check' : 'fa-exclamation';
    }
    return valor >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
  }

  /**
   * Verifica si hay datos para mostrar
   */
  get hayDatos(): boolean {
    return (this.datosLocales?.total > 0) || (this.totalHistorias > 0);
  }

  /**
   * Obtiene el texto del último update
   */
  get textoUltimoUpdate(): string {
    const ahora = new Date();
    const diffMs = ahora.getTime() - this.fechaActual.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins === 1) return 'Hace 1 min';
    if (diffMins < 60) return `Hace ${diffMins} min`;

    const diffHours = Math.floor(diffMins / 60);
    return `Hace ${diffHours} h`;
  }

  get puedeVerComparativa(): boolean {
    const key = this.rolUsuario?.key ?? '';
    return ['admin', 'gerente'].includes(key) && !!this.datosComparativa;
  }
}