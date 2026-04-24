import { Component, HostListener, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';

type MetricaComparativa = 'todas' | 'pacientes' | 'historias' | 'pendientes' | 'facturadas';
type TipoComparativa = 'bar' | 'line';

interface SedeComparativa {
  key: string;
  label: string;
  pacientes: number;
  historias: number;
  consultasPendientes: number;
  historiasFacturadas: number;
}

interface DatasetComparativa {
  key: Exclude<MetricaComparativa, 'todas'>;
  label: string;
  color: string;
  softColor: string;
  values: number[];
}

interface ResumenSede {
  label: string;
  total: number;
  pacientes: number;
  historias: number;
  pendientes: number;
  facturadas: number;
}

@Component({
  selector: 'app-grafico-comparativa-sedes',
  standalone: false,
  templateUrl: './grafico-comparativa-sedes.component.html',
  styleUrls: ['./grafico-comparativa-sedes.component.scss']
})
export class GraficoComparativaSedesComponent implements OnInit, OnChanges {
  @Input() data: any = {};

  chartType: TipoComparativa = 'bar';
  metricaSeleccionada: MetricaComparativa = 'todas';
  mostrarGrafico = false;
  chartData: ChartData<'bar' | 'line'> = { labels: [], datasets: [] };
  resumenSedes: ResumenSede[] = [];
  sedesVisibles: string[] = [];

  readonly filtrosVista: Array<{ key: MetricaComparativa; label: string; icon: string }> = [
    { key: 'todas', label: 'Vista general', icon: 'fas fa-layer-group' },
    { key: 'pacientes', label: 'Pacientes', icon: 'fas fa-users' },
    { key: 'historias', label: 'Historias', icon: 'fas fa-file-medical' },
    { key: 'pendientes', label: 'Pendientes', icon: 'fas fa-wallet' },
    { key: 'facturadas', label: 'Con venta', icon: 'fas fa-receipt' }
  ];

  ngOnInit(): void {
    this.actualizarGrafico();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this.actualizarGrafico();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.mostrarGrafico) {
      this.actualizarGrafico();
    }
  }

  get chartOptions(): ChartOptions<'bar' | 'line'> {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const esHorizontal = isMobile;

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      indexAxis: esHorizontal ? 'y' : 'x',
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          position: isMobile ? 'bottom' : 'top',
          align: 'start',
          labels: {
            color: '#55707d',
            usePointStyle: true,
            boxWidth: isMobile ? 8 : 10,
            padding: isMobile ? 10 : 16,
            font: {
              family: "'Inter', sans-serif",
              size: isMobile ? 10 : 12,
              weight: 600
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(14, 35, 48, 0.96)',
          titleColor: '#ffffff',
          bodyColor: '#f2f7f9',
          borderColor: 'rgba(106, 173, 201, 0.35)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 12,
          callbacks: {
            label: (context: any) => {
              const label = context.dataset.label || '';
              const rawValue = typeof context.parsed === 'object'
                ? Number(esHorizontal ? context.parsed.x : context.parsed.y)
                : Number(context.parsed ?? 0);
              return `${label}: ${rawValue}`;
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: {
            color: 'rgba(20, 56, 72, 0.08)'
          },
          ticks: {
            precision: 0,
            color: '#6b7f8c',
            autoSkip: true,
            maxRotation: 0,
            minRotation: 0,
            font: {
              family: "'Inter', sans-serif",
              size: isMobile ? 10 : 11
            }
          }
        },
        y: {
          grid: {
            display: !esHorizontal,
            color: 'rgba(20, 56, 72, 0.06)'
          },
          ticks: {
            color: '#6b7f8c',
            autoSkip: false,
            font: {
              family: "'Inter', sans-serif",
              size: isMobile ? 10 : 11,
              weight: 600
            }
          }
        }
      },
      elements: {
        line: {
          tension: 0.28,
          borderWidth: isMobile ? 2 : 3,
          fill: false
        },
        point: {
          radius: this.chartType === 'line' ? (isMobile ? 3 : 4) : 0,
          hoverRadius: isMobile ? 5 : 6,
          borderWidth: 0
        },
        bar: {
          borderRadius: 12,
          borderSkipped: false
        }
      }
    };
  }

  seleccionarVista(vista: MetricaComparativa): void {
    if (this.metricaSeleccionada === vista) return;
    this.metricaSeleccionada = vista;
    this.actualizarGrafico();
  }

  alternarTipoGrafico(): void {
    this.chartType = this.chartType === 'bar' ? 'line' : 'bar';
    this.actualizarGrafico();
  }

  private actualizarGrafico(): void {
    const sedes = this.obtenerSedesComparativas();
    this.mostrarGrafico = sedes.length > 0;

    if (!this.mostrarGrafico) {
      this.chartData = { labels: [], datasets: [] };
      this.resumenSedes = [];
      this.sedesVisibles = [];
      return;
    }

    const datasets = this.construirDatasets(sedes);
    const visibles = this.metricaSeleccionada === 'todas'
      ? datasets
      : datasets.filter(dataset => dataset.key === this.metricaSeleccionada);

    this.sedesVisibles = sedes.map(sede => sede.label);
    this.chartData = {
      labels: this.sedesVisibles,
      datasets: visibles.map(dataset => ({
        label: dataset.label,
        data: dataset.values,
        borderColor: dataset.color,
        backgroundColor: this.chartType === 'line' ? dataset.softColor : dataset.color,
        pointBackgroundColor: dataset.color,
        pointHoverBackgroundColor: dataset.color,
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2,
        borderWidth: this.chartType === 'line' ? 3 : 1
      }))
    };

    this.resumenSedes = sedes.map(sede => ({
      label: sede.label,
      total: sede.pacientes + sede.historias + sede.consultasPendientes + sede.historiasFacturadas,
      pacientes: sede.pacientes,
      historias: sede.historias,
      pendientes: sede.consultasPendientes,
      facturadas: sede.historiasFacturadas
    }));
  }

  private construirDatasets(sedes: SedeComparativa[]): DatasetComparativa[] {
    const definiciones: Omit<DatasetComparativa, 'values'>[] = [
      {
        key: 'pacientes',
        label: 'Pacientes',
        color: '#118ab2',
        softColor: 'rgba(17, 138, 178, 0.18)'
      },
      {
        key: 'historias',
        label: 'Historias',
        color: '#06a77d',
        softColor: 'rgba(6, 167, 125, 0.18)'
      },
      {
        key: 'pendientes',
        label: 'Pendientes',
        color: '#f59e0b',
        softColor: 'rgba(245, 158, 11, 0.18)'
      },
      {
        key: 'facturadas',
        label: 'Con venta',
        color: '#7c3aed',
        softColor: 'rgba(124, 58, 237, 0.18)'
      }
    ];

    return definiciones.map(definicion => ({
      ...definicion,
      values: sedes.map(sede => {
        if (definicion.key === 'pacientes') return sede.pacientes;
        if (definicion.key === 'historias') return sede.historias;
        if (definicion.key === 'pendientes') return sede.consultasPendientes;
        return sede.historiasFacturadas;
      })
    }));
  }

  private obtenerSedesComparativas(): SedeComparativa[] {
    if (!this.data) return [];

    const origen = Array.isArray(this.data)
      ? this.data
      : Object.keys(this.data).map(key => ({ key, ...this.data[key] }));

    return origen
      .map((sede: any) => ({
        key: (sede.key || sede.sede || sede.nombre || '').toString().trim().toLowerCase(),
        label: this.formatearNombreSede((sede.key || sede.sede || sede.nombre || '').toString()),
        pacientes: Number(sede.pacientes || sede.totalPacientes || 0),
        historias: Number(sede.historias || sede.totalHistorias || 0),
        consultasPendientes: Number(sede.consultasPendientes || sede.totalPendientes || 0),
        historiasFacturadas: Number(sede.historiasFacturadas || sede.totalFacturadas || 0)
      }))
      .filter(sede => !!sede.key && sede.key !== 'sin-sede')
      .slice(0, 2);
  }

  private formatearNombreSede(nombre: string): string {
    return nombre.replace(/_/g, ' ').replace(/\b\w/g, letra => letra.toUpperCase()).trim();
  }
}
