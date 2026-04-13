import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription, finalize } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { HistorialVentaService } from '../historial-ventas/historial-ventas.service';
import { SystemConfigService } from '../../system-config/system-config.service';
import { LoaderService } from '../../../shared/loader/loader.service';

interface SerieResumen {
  label: string;
  ventas: number;
  facturado: number;
  cobrado: number;
  pendiente: number;
}

interface RankingAsesor {
  asesorId: number;
  asesorNombre: string;
  ventas: number;
  facturado: number;
  cobrado: number;
  pendiente: number;
}

interface ResumenComercial {
  montoTotal: number;
  totalAbonos: number;
  deudaPendiente: number;
  seriesDiaria: SerieResumen[];
  seriesMensual: SerieResumen[];
  rankingAsesores: RankingAsesor[];
}

type PresetPeriodo = 'hoy' | '7d' | '30d' | 'mes-actual';

@Component({
  selector: 'app-rendimiento-comercial',
  standalone: false,
  templateUrl: './rendimiento-comercial.component.html',
  styleUrls: ['./rendimiento-comercial.component.scss']
})
export class RendimientoComercialComponent implements OnInit, OnDestroy {
  @ViewChild('rankingChart') rankingChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('participacionChart') participacionChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('tendenciaChart') tendenciaChartRef?: ElementRef<HTMLCanvasElement>;

  filtros = {
    fechaDesde: '',
    fechaHasta: ''
  };

  presetActivo: PresetPeriodo = 'mes-actual';
  loading = false;
  errorMessage = '';
  monedaSistema = 'USD';
  simboloMoneda = '$';
  currentYear = new Date().getFullYear();

  private configSubscription?: Subscription;
  private resumenSubscription?: Subscription;
  private loaderDelaySubscription?: Subscription;
  private chartInstances: Record<string, Chart> = {};

  resumenData: ResumenComercial = this.obtenerResumenVacio();

  constructor(
    private historialVentaService: HistorialVentaService,
    private systemConfigService: SystemConfigService,
    private cdr: ChangeDetectorRef,
    private loader: LoaderService
  ) {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.sincronizarMonedaSistema();
    this.aplicarPreset('mes-actual');
  }

  ngOnDestroy(): void {
    this.configSubscription?.unsubscribe();
    this.resumenSubscription?.unsubscribe();
    this.loaderDelaySubscription?.unsubscribe();
    this.destruirGraficos();
  }

  get rankingAsesores(): Array<RankingAsesor & { posicion: number; participacion: number; ticketPromedio: number }> {
    const totalFacturado = this.totalFacturado;

    return this.resumenData.rankingAsesores.map((item, index) => ({
      ...item,
      posicion: index + 1,
      participacion: totalFacturado > 0 ? (item.facturado / totalFacturado) * 100 : 0,
      ticketPromedio: item.ventas > 0 ? item.facturado / item.ventas : 0
    }));
  }

  get topAsesores(): Array<RankingAsesor & { posicion: number; participacion: number; ticketPromedio: number }> {
    return this.rankingAsesores.slice(0, 5);
  }

  get mejorAsesor(): (RankingAsesor & { posicion: number; participacion: number; ticketPromedio: number }) | null {
    return this.rankingAsesores[0] ?? null;
  }

  get totalFacturado(): number {
    return Number(this.resumenData.montoTotal) || 0;
  }

  get totalCobrado(): number {
    return Number(this.resumenData.totalAbonos) || 0;
  }

  get deudaPendiente(): number {
    return Number(this.resumenData.deudaPendiente) || 0;
  }

  get vendedoresActivos(): number {
    return this.rankingAsesores.filter(item => item.ventas > 0).length;
  }

  get totalVentas(): number {
    return this.rankingAsesores.reduce((acc, item) => acc + item.ventas, 0);
  }

  get efectividadCobro(): number {
    return this.totalFacturado > 0 ? (this.totalCobrado / this.totalFacturado) * 100 : 0;
  }

  get promedioFacturacionPorVendedor(): number {
    return this.vendedoresActivos > 0 ? this.totalFacturado / this.vendedoresActivos : 0;
  }

  get etiquetaReconocimiento(): string {
    return this.presetActivo === 'mes-actual' ? 'Vendedor del mes' : 'Vendedor destacado';
  }

  get tendenciaPeriodo(): string {
    const serie = this.obtenerSeriePrincipal();

    if (serie.length < 2) {
      return 'Aún no hay suficientes puntos para calcular tendencia.';
    }

    const ultimo = serie[serie.length - 1]?.facturado || 0;
    const anterior = serie[serie.length - 2]?.facturado || 0;

    if (anterior <= 0 && ultimo <= 0) {
      return 'Sin movimiento comercial reciente.';
    }

    if (anterior <= 0) {
      return 'El periodo actual abrió con facturación nueva.';
    }

    const variacion = ((ultimo - anterior) / anterior) * 100;
    const verbo = variacion >= 0 ? 'subió' : 'bajó';

    return `La facturación ${verbo} ${Math.abs(variacion).toFixed(1)}% frente al corte anterior.`;
  }

  aplicarPreset(preset: PresetPeriodo): void {
    this.presetActivo = preset;

    const hoy = new Date();
    const fechaHasta = this.formatearFechaInput(hoy);
    const fechaDesdeBase = new Date(hoy);

    if (preset === 'hoy') {
      this.filtros.fechaDesde = fechaHasta;
      this.filtros.fechaHasta = fechaHasta;
    } else if (preset === '7d') {
      fechaDesdeBase.setDate(hoy.getDate() - 6);
      this.filtros.fechaDesde = this.formatearFechaInput(fechaDesdeBase);
      this.filtros.fechaHasta = fechaHasta;
    } else if (preset === '30d') {
      fechaDesdeBase.setDate(hoy.getDate() - 29);
      this.filtros.fechaDesde = this.formatearFechaInput(fechaDesdeBase);
      this.filtros.fechaHasta = fechaHasta;
    } else {
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      this.filtros.fechaDesde = this.formatearFechaInput(inicioMes);
      this.filtros.fechaHasta = fechaHasta;
    }

    this.cargarResumen();
  }

  aplicarFiltros(): void {
    this.presetActivo = 'mes-actual';
    this.cargarResumen();
  }

  limpiarFiltros(): void {
    this.aplicarPreset('mes-actual');
  }

  obtenerParticipacionTexto(valor: number): string {
    return `${valor.toFixed(1)}% del total facturado`;
  }

  trackByAsesor(_: number, item: RankingAsesor & { posicion: number }): number {
    return item.asesorId || item.posicion;
  }

  private sincronizarMonedaSistema(): void {
    this.monedaSistema = this.systemConfigService.getMonedaPrincipal();
    this.simboloMoneda = this.systemConfigService.getSimboloMonedaPrincipal();

    this.configSubscription = this.systemConfigService.config$.subscribe(config => {
      this.monedaSistema = config?.monedaPrincipal || this.monedaSistema;
      this.simboloMoneda = config?.simboloMoneda || this.simboloMoneda;
      this.programarRenderGraficos();
    });
  }

  private cargarResumen(): void {
    this.loading = true;
    this.errorMessage = '';

    this.resumenSubscription?.unsubscribe();
    this.loaderDelaySubscription?.unsubscribe();
    this.loader.showWithMessage('Cargando rendimiento comercial...');

    this.resumenSubscription = this.historialVentaService.obtenerEstadisticasFinancieras(this.construirPayloadFiltros())
      .pipe(
        finalize(() => {
          this.loading = false;
          this.loader.hide();
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          this.resumenData = this.normalizarResumenData(response?.data ?? response);
          this.programarRenderGraficos();
        },
        error: (error) => {
          console.error('Error al cargar rendimiento comercial:', error);
          this.errorMessage = 'No se pudo cargar el rendimiento comercial con los filtros seleccionados.';
          this.resumenData = this.obtenerResumenVacio();
          this.destruirGraficos();
        }
      });
  }

  private construirPayloadFiltros(): Record<string, string> {
    const payload: Record<string, string> = {};

    if (this.filtros.fechaDesde) {
      payload['fechaDesde'] = this.filtros.fechaDesde;
    }

    if (this.filtros.fechaHasta) {
      payload['fechaHasta'] = this.filtros.fechaHasta;
    }

    return payload;
  }

  private programarRenderGraficos(): void {
    setTimeout(() => {
      this.renderizarGraficos();
      this.cdr.detectChanges();
    });
  }

  private renderizarGraficos(): void {
    this.destruirGraficos();

    if (!this.rankingAsesores.length) {
      return;
    }

    this.crearGraficoRanking();
    this.crearGraficoParticipacion();
    this.crearGraficoTendencia();
  }

  private crearGraficoRanking(): void {
    const contexto = this.rankingChartRef?.nativeElement.getContext('2d');
    const top = this.topAsesores;

    if (!contexto || !top.length) {
      return;
    }

    this.chartInstances['ranking'] = new Chart(contexto, {
      type: 'bar',
      data: {
        labels: top.map(item => item.asesorNombre),
        datasets: [
          {
            label: 'Facturado',
            data: top.map(item => item.facturado),
            backgroundColor: ['#0f766e', '#0f9e8b', '#14b8a6', '#2dd4bf', '#5eead4'],
            borderRadius: 14,
            maxBarThickness: 42
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context: any) => this.formatearMoneda(Number(context.parsed.y) || 0)
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value: string | number) => this.formatearMoneda(Number(value) || 0)
            }
          }
        }
      }
    });
  }

  private crearGraficoParticipacion(): void {
    const contexto = this.participacionChartRef?.nativeElement.getContext('2d');
    const top = this.topAsesores;

    if (!contexto || !top.length) {
      return;
    }

    const otros = this.rankingAsesores.slice(5).reduce((acc, item) => acc + item.facturado, 0);
    const labels = top.map(item => item.asesorNombre);
    const data = top.map(item => item.facturado);

    if (otros > 0) {
      labels.push('Otros');
      data.push(otros);
    }

    this.chartInstances['participacion'] = new Chart(contexto, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: ['#0f766e', '#1d4ed8', '#ea580c', '#7c3aed', '#ca8a04', '#94a3b8'],
            borderColor: '#ffffff',
            borderWidth: 3,
            hoverOffset: 10
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (context: any) => `${context.label}: ${this.formatearMoneda(Number(context.parsed) || 0)}`
            }
          }
        },
        cutout: '58%'
      }
    });
  }

  private crearGraficoTendencia(): void {
    const contexto = this.tendenciaChartRef?.nativeElement.getContext('2d');
    const serie = this.obtenerSeriePrincipal();

    if (!contexto || !serie.length) {
      return;
    }

    this.chartInstances['tendencia'] = new Chart(contexto, {
      type: 'line',
      data: {
        labels: serie.map(item => item.label),
        datasets: [
          {
            label: 'Facturado',
            data: serie.map(item => item.facturado),
            borderColor: '#1d4ed8',
            backgroundColor: 'rgba(29, 78, 216, 0.12)',
            fill: true,
            tension: 0.35
          },
          {
            label: 'Cobrado',
            data: serie.map(item => item.cobrado),
            borderColor: '#0f766e',
            backgroundColor: 'rgba(15, 118, 110, 0.08)',
            fill: false,
            tension: 0.35
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (context: any) => `${context.dataset.label}: ${this.formatearMoneda(Number(context.parsed.y) || 0)}`
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value: string | number) => this.formatearMoneda(Number(value) || 0)
            }
          }
        }
      }
    });
  }

  private obtenerSeriePrincipal(): SerieResumen[] {
    if (this.resumenData.seriesDiaria.length) {
      return this.resumenData.seriesDiaria.slice(-10);
    }

    return this.resumenData.seriesMensual.slice(-6);
  }

  private destruirGraficos(): void {
    Object.values(this.chartInstances).forEach(chart => chart.destroy());
    this.chartInstances = {};
  }

  private normalizarResumenData(data: any): ResumenComercial {
    return {
      montoTotal: Number(data?.montoTotal) || 0,
      totalAbonos: Number(data?.totalAbonos) || 0,
      deudaPendiente: Number(data?.deudaPendiente) || 0,
      seriesDiaria: Array.isArray(data?.seriesDiaria) ? data.seriesDiaria.map((item: any) => ({
        label: item?.label || item?.fecha || '',
        ventas: Number(item?.ventas) || 0,
        facturado: Number(item?.facturado) || 0,
        cobrado: Number(item?.cobrado) || 0,
        pendiente: Number(item?.pendiente) || 0
      })) : [],
      seriesMensual: Array.isArray(data?.seriesMensual) ? data.seriesMensual.map((item: any) => ({
        label: item?.label || item?.periodo || '',
        ventas: Number(item?.ventas) || 0,
        facturado: Number(item?.facturado) || 0,
        cobrado: Number(item?.cobrado) || 0,
        pendiente: Number(item?.pendiente) || 0
      })) : [],
      rankingAsesores: Array.isArray(data?.rankingAsesores) ? data.rankingAsesores.map((item: any) => ({
        asesorId: Number(item?.asesorId) || 0,
        asesorNombre: item?.asesorNombre || 'Sin asesor',
        ventas: Number(item?.ventas) || 0,
        facturado: Number(item?.facturado) || 0,
        cobrado: Number(item?.cobrado) || 0,
        pendiente: Number(item?.pendiente) || 0
      })).sort((a: RankingAsesor, b: RankingAsesor) => b.facturado - a.facturado) : []
    };
  }

  private obtenerResumenVacio(): ResumenComercial {
    return {
      montoTotal: 0,
      totalAbonos: 0,
      deudaPendiente: 0,
      seriesDiaria: [],
      seriesMensual: [],
      rankingAsesores: []
    };
  }

  private formatearFechaInput(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = `${fecha.getMonth() + 1}`.padStart(2, '0');
    const dia = `${fecha.getDate()}`.padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  formatearMoneda(valor: number): string {
    try {
      return new Intl.NumberFormat(this.monedaSistema === 'VES' ? 'es-VE' : 'en-US', {
        style: 'currency',
        currency: this.monedaSistema,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(Number(valor) || 0);
    } catch {
      return `${this.simboloMoneda}${(Number(valor) || 0).toFixed(2)}`;
    }
  }
}