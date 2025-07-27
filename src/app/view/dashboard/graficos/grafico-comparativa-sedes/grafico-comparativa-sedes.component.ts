import { Component, Input, OnInit } from '@angular/core';
import {
  ChartConfiguration,
  ChartData,
  ChartOptions
} from 'chart.js';

@Component({
  selector: 'app-grafico-comparativa-sedes',
  standalone: false,
  templateUrl: './grafico-comparativa-sedes.component.html',
  styleUrls: ['./grafico-comparativa-sedes.component.scss']
})
export class GraficoComparativaSedesComponent implements OnInit {
  @Input() data: Record<string, { pacientes: number; ventas: number; ordenes: number }> = {};

  chartType: 'bar' = 'bar';

  chartData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };

  chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    animation: {
      duration: 1000,
      easing: 'easeOutBounce'
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const valor = typeof ctx.parsed === 'object' ? ctx.parsed.y ?? ctx.parsed : ctx.parsed;
            return `${ctx.dataset.label}: ${valor}`;
          }
        }
      },
      legend: {
        position: 'bottom',
        labels: {
          color: '#6c757d',
          boxWidth: 12
        }
      }
    },
    scales: {
      x: {
        stacked: false,
        title: {
          display: true,
          text: 'Sede'
        }
      },
      y: {
        stacked: false,
        beginAtZero: true,
        title: {
          display: true,
          text: 'Cantidad'
        }
      }
    }
  };

  ngOnInit(): void {
    const sedes = Object.keys(this.data);
    const pacientes = sedes.map(s => this.data[s].pacientes);
    const ventas = sedes.map(s => this.data[s].ventas);
    const ordenes = sedes.map(s => this.data[s].ordenes);

    this.chartData.labels = sedes;
    this.chartData.datasets = [
      {
        label: 'Pacientes',
        data: Object.values(this.data).map(d => d.pacientes),
        backgroundColor: '#14a4bc '
      },
      {
        label: 'Historias',
        data: Object.values(this.data).map(d => d.pacientes),
        backgroundColor: '#2ca444 '
      },
      {
        label: 'Ventas',
        data: Object.values(this.data).map(d => d.ventas),
        backgroundColor: '#fcc404'
      },
      {
        label: 'Órdenes pendientes',
        data: Object.values(this.data).map(d => d.ordenes),
        backgroundColor: '#dc3545'
      }
    ];
  }
}
