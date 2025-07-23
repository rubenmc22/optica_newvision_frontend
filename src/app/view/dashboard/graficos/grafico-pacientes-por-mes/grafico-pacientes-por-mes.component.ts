import { Component, Input, OnInit } from '@angular/core';
import {
  ChartConfiguration,
  ChartOptions,
  ChartType,
  ChartData
} from 'chart.js';

@Component({
  selector: 'app-grafico-pacientes-por-mes',
  standalone: false,
  templateUrl: './grafico-pacientes-por-mes.component.html',
  styleUrls: ['./grafico-pacientes-por-mes.component.scss']
})
export class GraficoPacientesPorMesComponent implements OnInit {
  @Input() data: Record<string, { pacientes: number; ventas: number; ordenes: number }> = {};


  chartType: 'doughnut' = 'doughnut';

  chartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [
      {
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

  chartOptions: ChartOptions<'doughnut'> = {
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

  ngOnInit(): void {
    this.chartData.labels = Object.keys(this.data);
    this.chartData.datasets[0].data = Object.values(this.data).map(d => d.pacientes);
  }
}
