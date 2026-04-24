import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';

type VistaMovimiento = 'todas' | 'pacientes' | 'historias' | 'ventas' | 'ordenes';
type TipoGrafico = 'line' | 'bar';

interface DatasetMensual {
  key: Exclude<VistaMovimiento, 'todas'>;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  softColor: string;
  values: number[];
}

interface ResumenMovimiento {
  label: string;
  value: number;
  detail: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-grafico-pacientes-por-mes',
  standalone: false,
  template: `
    <div class="movement-board">
      <div class="movement-board__topbar">
        <div class="movement-board__heading">
          <span class="movement-board__eyebrow">Pulso mensual</span>
          <h4 class="movement-board__title">Operación mensual</h4>
          <p class="movement-board__subtitle">
            {{ periodoDescripcion }}
            <span *ngIf="mesPicoLabel">· pico en {{ mesPicoLabel }} con {{ mesPicoValor }} movimientos</span>
          </p>
        </div>

        <button type="button" class="movement-board__toggle" (click)="alternarTipoGrafico()">
          <i class="fas" [class.fa-chart-bar]="chartType === 'line'" [class.fa-chart-line]="chartType === 'bar'"></i>
          {{ chartType === 'line' ? 'Ver barras' : 'Ver líneas' }}
        </button>
      </div>

      <div class="movement-board__filters">
        <button
          type="button"
          class="movement-filter"
          *ngFor="let filtro of filtrosVista"
          [class.movement-filter--active]="vistaActual === filtro.key"
          (click)="seleccionarVista(filtro.key)">
          <i [class]="filtro.icon"></i>
          <span>{{ filtro.label }}</span>
        </button>
      </div>

      <div *ngIf="mostrarGrafico" class="movement-board__canvas-shell">
        <div class="movement-board__canvas">
          <canvas baseChart [type]="chartType" [data]="chartData" [options]="chartOptions"></canvas>
        </div>
      </div>

      <div *ngIf="!mostrarGrafico" class="movement-board__empty">
        <div class="movement-board__empty-icon">
          <i class="fas fa-chart-line"></i>
        </div>
        <h4>Sin datos suficientes</h4>
        <p>Cuando exista movimiento mensual en la sede, aquí verás pacientes, historias, ventas y órdenes.</p>
      </div>

      <div *ngIf="resumenTarjetas.length" class="movement-board__summary-grid">
        <article class="movement-metric" *ngFor="let item of resumenTarjetas" [style.--metric-color]="item.color">
          <div class="movement-metric__icon">
            <i [class]="item.icon"></i>
          </div>
          <div class="movement-metric__content">
            <span class="movement-metric__label">{{ item.label }}</span>
            <strong class="movement-metric__value">{{ item.value | number:'1.0-0' }}</strong>
            <small class="movement-metric__detail">{{ item.detail }}</small>
          </div>
        </article>
      </div>
    </div>
  `,
  styleUrls: ['./grafico-pacientes-por-mes.component.scss']
})
export class GraficoPacientesPorMesComponent implements OnInit, OnChanges {
  @Input() data: any = {};
  @Input() sedeActual: string = '';

  chartType: TipoGrafico = 'line';
  vistaActual: VistaMovimiento = 'todas';
  mostrarGrafico: boolean = false;
  chartData: ChartData<'line' | 'bar'> = { labels: [], datasets: [] };
  resumenTarjetas: ResumenMovimiento[] = [];
  periodoDescripcion: string = '';
  mesPicoLabel: string = '';
  mesPicoValor: number = 0;

  readonly filtrosVista: Array<{ key: VistaMovimiento; label: string; icon: string }> = [
    { key: 'todas', label: 'Vista general', icon: 'fas fa-layer-group' },
    { key: 'pacientes', label: 'Pacientes', icon: 'fas fa-users' },
    { key: 'historias', label: 'Historias', icon: 'fas fa-file-medical' },
    { key: 'ventas', label: 'Ventas', icon: 'fas fa-cash-register' },
    { key: 'ordenes', label: 'Órdenes', icon: 'fas fa-clipboard-list' }
  ];

  ngOnInit(): void {
    this.construirVisualizacion();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['sedeActual']) {
      this.construirVisualizacion();
    }
  }

  get chartOptions(): ChartOptions<'line' | 'bar'> {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const isLine = this.chartType === 'line';

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      animation: false,
      plugins: {
        legend: {
          position: isMobile ? 'bottom' : 'top',
          align: 'start',
          labels: {
            usePointStyle: true,
            boxWidth: isMobile ? 8 : 10,
            padding: isMobile ? 12 : 18,
            color: '#55707d',
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
              const value = Number(context.parsed?.y ?? context.parsed ?? 0);
              return `${label}: ${value}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#6b7f8c',
            autoSkip: true,
            maxRotation: 0,
            minRotation: 0,
            font: {
              family: "'Inter', sans-serif",
              size: isMobile ? 10 : 11,
              weight: 600
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(20, 56, 72, 0.08)'
          },
          ticks: {
            precision: 0,
            color: '#6b7f8c',
            font: {
              family: "'Inter', sans-serif",
              size: isMobile ? 10 : 11
            }
          }
        }
      },
      elements: {
        line: {
          tension: 0.34,
          borderWidth: isMobile ? 2 : 3,
          fill: false
        },
        point: {
          radius: isLine ? (isMobile ? 2 : 3) : 0,
          hoverRadius: isMobile ? 4 : 5,
          borderWidth: 0
        },
        bar: {
          borderRadius: 10,
          borderSkipped: false
        }
      }
    };
  }

  seleccionarVista(vista: VistaMovimiento): void {
    if (this.vistaActual === vista) return;
    this.vistaActual = vista;
    this.construirVisualizacion();
  }

  alternarTipoGrafico(): void {
    this.chartType = this.chartType === 'line' ? 'bar' : 'line';
    this.construirVisualizacion();
  }

  private construirVisualizacion(): void {
    try {
      const { labels, datasets } = this.procesarDatosMensuales();
      this.mostrarGrafico = labels.length > 0 && datasets.some(dataset => dataset.values.some(value => value > 0));

      if (!this.mostrarGrafico) {
        this.chartData = { labels: [], datasets: [] };
        this.resumenTarjetas = [];
        this.periodoDescripcion = 'Sin actividad suficiente en el periodo';
        this.mesPicoLabel = '';
        this.mesPicoValor = 0;
        return;
      }

      const visibles = this.vistaActual === 'todas'
        ? datasets
        : datasets.filter(dataset => dataset.key === this.vistaActual);

      this.chartData = {
        labels,
        datasets: visibles.map(dataset => ({
          label: dataset.label,
          data: dataset.values,
          borderColor: dataset.color,
          backgroundColor: this.chartType === 'line' ? dataset.softColor : dataset.color,
          pointBackgroundColor: dataset.color,
          pointHoverBackgroundColor: dataset.color,
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2,
          borderWidth: this.chartType === 'line' ? 3 : 1,
          borderRadius: this.chartType === 'bar' ? 10 : 0,
          maxBarThickness: 26
        }))
      };

      this.actualizarResumen(labels, datasets);
    } catch (error) {
      console.error('Error construyendo grafico mensual del dashboard:', error);
      this.chartData = { labels: [], datasets: [] };
      this.resumenTarjetas = [];
      this.mostrarGrafico = false;
    }
  }

  private procesarDatosMensuales(): { labels: string[]; datasets: DatasetMensual[] } {
    const { fechaInicio, fechaFin } = this.obtenerRangoFechas();
    const meses = this.generarRangoMeses(fechaInicio, fechaFin);
    const datosExistentes = this.obtenerDatosExistentes();

    const labels = meses.map(fecha => this.formatearFechaMes(fecha));

    const definiciones: Omit<DatasetMensual, 'values'>[] = [
      {
        key: 'pacientes',
        label: 'Pacientes',
        shortLabel: 'Pacientes',
        icon: 'fas fa-users',
        color: '#118ab2',
        softColor: 'rgba(17, 138, 178, 0.18)'
      },
      {
        key: 'historias',
        label: 'Historias médicas',
        shortLabel: 'Historias',
        icon: 'fas fa-file-medical',
        color: '#06a77d',
        softColor: 'rgba(6, 167, 125, 0.18)'
      },
      {
        key: 'ventas',
        label: 'Ventas',
        shortLabel: 'Ventas',
        icon: 'fas fa-cash-register',
        color: '#f59e0b',
        softColor: 'rgba(245, 158, 11, 0.18)'
      },
      {
        key: 'ordenes',
        label: 'Órdenes de trabajo',
        shortLabel: 'Órdenes',
        icon: 'fas fa-clipboard-list',
        color: '#7c3aed',
        softColor: 'rgba(124, 58, 237, 0.18)'
      }
    ];

    const datasets = definiciones.map(definicion => ({
      ...definicion,
      values: meses.map(fecha => {
        const key = this.obtenerKeyMes(fecha);
        return datosExistentes[key]?.[definicion.key] || 0;
      })
    }));

    return { labels, datasets };
  }

  private actualizarResumen(labels: string[], datasets: DatasetMensual[]): void {
    const totalPorMes = labels.map((_, index) =>
      datasets.reduce((acc, dataset) => acc + (dataset.values[index] || 0), 0)
    );

    const indicePico = totalPorMes.reduce((maxIndex, currentValue, index, values) =>
      currentValue > values[maxIndex] ? index : maxIndex, 0);

    this.mesPicoLabel = labels[indicePico] || '';
    this.mesPicoValor = totalPorMes[indicePico] || 0;

    const primerMes = labels[0] || '';
    const ultimoMes = labels[labels.length - 1] || '';
    this.periodoDescripcion = primerMes && ultimoMes
      ? `${primerMes} a ${ultimoMes}`
      : 'Periodo actual';

    this.resumenTarjetas = datasets.map(dataset => {
      const total = dataset.values.reduce((sum, value) => sum + value, 0);
      const promedio = Math.round(total / Math.max(dataset.values.length, 1));
      const ultimo = dataset.values[dataset.values.length - 1] || 0;

      return {
        label: dataset.shortLabel,
        value: total,
        detail: `Ultimo mes: ${ultimo} · Promedio: ${promedio}`,
        icon: dataset.icon,
        color: dataset.color
      };
    });
  }

  private obtenerDatosExistentes(): Record<string, { pacientes: number; historias: number; ventas: number; ordenes: number }> {
    const datos: Record<string, { pacientes: number; historias: number; ventas: number; ordenes: number }> = {};

    if (Array.isArray(this.data)) {
      this.data.forEach(item => {
        const fecha = this.obtenerFechaMes(item.mes || item.nombre || item.fecha);
        if (!fecha) return;

        const key = this.obtenerKeyMes(fecha);
        datos[key] = {
          pacientes: Number(item.pacientes || item.cantidad || item.totalPacientes || 0),
          historias: Number(item.historias || item.totalHistorias || 0),
          ventas: Number(item.ventas || item.totalVentas || 0),
          ordenes: Number(item.ordenes || item.totalOrdenes || 0)
        };
      });
    } else if (this.data && typeof this.data === 'object') {
      Object.keys(this.data).forEach(mes => {
        const fecha = this.obtenerFechaMes(mes);
        if (!fecha) return;

        const key = this.obtenerKeyMes(fecha);
        datos[key] = {
          pacientes: Number(this.data[mes]?.pacientes || this.data[mes]?.cantidad || this.data[mes]?.totalPacientes || 0),
          historias: Number(this.data[mes]?.historias || this.data[mes]?.totalHistorias || 0),
          ventas: Number(this.data[mes]?.ventas || this.data[mes]?.totalVentas || 0),
          ordenes: Number(this.data[mes]?.ordenes || this.data[mes]?.totalOrdenes || 0)
        };
      });
    }

    return datos;
  }

  private obtenerRangoFechas(): { fechaInicio: Date; fechaFin: Date } {
    const primerRegistro = this.obtenerFechaPrimerRegistro();
    const fechaInicio = primerRegistro ? new Date(primerRegistro) : new Date();
    fechaInicio.setDate(1);

    if (!primerRegistro) {
      fechaInicio.setMonth(fechaInicio.getMonth() - 5);
    }

    const fechaFin = new Date();
    fechaFin.setDate(1);
    return { fechaInicio, fechaFin };
  }

  private obtenerFechaPrimerRegistro(): Date | null {
    if (!this.data) return null;

    const fechas = Array.isArray(this.data)
      ? this.data
          .map(item => this.obtenerFechaMes(item.mes || item.nombre || item.fecha))
          .filter((fecha): fecha is Date => !!fecha)
      : Object.keys(this.data)
          .map(mes => this.obtenerFechaMes(mes))
          .filter((fecha): fecha is Date => !!fecha);

    if (!fechas.length) return null;
    return fechas.reduce((anterior, actual) => actual < anterior ? actual : anterior);
  }

  private generarRangoMeses(fechaInicio: Date, fechaFin: Date): Date[] {
    const meses: Date[] = [];
    const cursor = new Date(fechaInicio);

    while (cursor <= fechaFin) {
      meses.push(new Date(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return meses;
  }

  private obtenerFechaMes(mesString: string): Date | null {
    if (!mesString) return null;

    const hoy = new Date();
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];

    const lowerMes = mesString.toLowerCase().trim();

    for (let i = 0; i < meses.length; i++) {
      if (lowerMes.includes(meses[i])) {
        const añoMatch = mesString.match(/\d{4}/);
        const año = añoMatch ? parseInt(añoMatch[0], 10) : hoy.getFullYear();
        return new Date(año, i, 1);
      }
    }

    const mesNumero = parseInt(mesString, 10);
    if (!Number.isNaN(mesNumero) && mesNumero >= 1 && mesNumero <= 12) {
      return new Date(hoy.getFullYear(), mesNumero - 1, 1);
    }

    const fechaParsed = new Date(mesString);
    if (Number.isNaN(fechaParsed.getTime())) return null;

    fechaParsed.setDate(1);
    return fechaParsed;
  }

  private obtenerKeyMes(fecha: Date): string {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    return `${año}-${mes}`;
  }

  private formatearFechaMes(fecha: Date): string {
    const meses = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
    ];

    return `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
  }
}
