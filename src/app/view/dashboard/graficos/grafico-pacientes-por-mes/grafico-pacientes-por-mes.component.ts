import { Component, Input, OnInit } from '@angular/core';
import {
  ChartConfiguration,
  ChartOptions,
  ChartTypeRegistry,
  ChartData
} from 'chart.js';

@Component({
  selector: 'app-grafico-pacientes-por-mes',
  standalone: false,
  templateUrl: './grafico-pacientes-por-mes.component.html',
  styleUrls: ['./grafico-pacientes-por-mes.component.scss']
})
export class GraficoPacientesPorMesComponent implements OnInit {
  @Input() data: Record<string, { pacientes: number; historias: number }> = {};

  // ✅ Usa keyof ChartTypeRegistry para evitar error de tipo
  chartPacientesType: keyof ChartTypeRegistry = 'doughnut';
  chartHistoriasType: keyof ChartTypeRegistry = 'doughnut';

  chartPacientesData: ChartData<'doughnut', number[], unknown> = {
    labels: [],
    datasets: [
      {
        label: 'Pacientes',
        data: [],
        backgroundColor: [
          '#0d6efd', '#20c997', '#ffc107',
          '#dc3545', '#6f42c1', '#6610f2',
          '#198754', '#fd7e14', '#0dcaf0'
        ],
        hoverBackgroundColor: [
          '#0b5ed7', '#198754', '#e0a800',
          '#bb2d3b', '#5c3799', '#520dc2',
          '#157347', '#e56f00', '#0bbbe2'
        ]
      }
    ]
  };

  chartPacientesOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    animation: {
      animateScale: true,
      animateRotate: true
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#6c757d',
          boxWidth: 12
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.label}: ${ctx.parsed} pacientes`
        }
      }
    }
  };

  chartHistoriasData: ChartData<'doughnut', number[], unknown> = {
    labels: [],
    datasets: [
      {
        label: 'Historias Médicas',
        data: [],
       backgroundColor: [
          '#0d6efd', '#20c997', '#ffc107',
          '#dc3545', '#6f42c1', '#6610f2',
          '#198754', '#fd7e14', '#0dcaf0'
        ],
        hoverBackgroundColor: [
          '#0b5ed7', '#198754', '#e0a800',
          '#bb2d3b', '#5c3799', '#520dc2',
          '#157347', '#e56f00', '#0bbbe2'
        ]
      }
    ]
  };

  chartHistoriasOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    animation: {
      animateScale: true,
      animateRotate: true
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#6c757d',
          boxWidth: 12
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.label}: ${ctx.parsed} historias médicas`
        }
      }
    }
  };

  ngOnInit(): void {
    const meses = Object.keys(this.data);

    this.chartPacientesData.labels = meses;
    this.chartPacientesData.datasets[0].data = meses.map(m => this.data[m].pacientes);

    this.chartHistoriasData.labels = meses;
    this.chartHistoriasData.datasets[0].data = meses.map(m => this.data[m].historias);
  }
}
