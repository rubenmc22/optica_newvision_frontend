import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import {
  ChartConfiguration,
  ChartData,
  ChartOptions
} from 'chart.js';
import { DatosPorSede  } from './../../dashboard-interface';

@Component({
  selector: 'app-grafico-comparativa-sedes',
  standalone: false,
  templateUrl: './grafico-comparativa-sedes.component.html',
  styleUrls: ['./grafico-comparativa-sedes.component.scss']
})
export class GraficoComparativaSedesComponent implements OnInit, OnChanges {
  @Input() data: any = {}; // Más flexible

  chartType: 'bar' = 'bar';
  chartData: ChartData<'bar'> = { labels: [], datasets: [] };
  chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    animation: { duration: 1000, easing: 'easeOutBounce' },
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
        labels: { color: '#6c757d', boxWidth: 12 }
      }
    },
    scales: {
      x: {
        stacked: false,
        title: { display: true, text: 'Sede' }
      },
      y: {
        stacked: false,
        beginAtZero: true,
        title: { display: true, text: 'Cantidad' }
      }
    }
  };

  ngOnInit(): void {
    this.actualizarGrafico();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this.actualizarGrafico();
    }
  }

  private actualizarGrafico(): void {
    console.log('📊 Datos recibidos:', this.data);
    
    if (!this.data || Object.keys(this.data).length === 0) {
      console.warn('No hay datos para mostrar en el gráfico');
      this.mostrarGraficoVacio();
      return;
    }

    try {
      // Intentar diferentes estructuras de datos
      const { labels, datasets } = this.procesarDatos();
      
      this.chartData.labels = labels;
      this.chartData.datasets = datasets;
      
      console.log('✅ Gráfico actualizado:', this.chartData);
    } catch (error) {
      console.error('❌ Error procesando datos:', error);
      this.mostrarGraficoVacio();
    }
  }

  private procesarDatos(): { labels: string[], datasets: any[] } {
    // Si es un array de sedes
    if (Array.isArray(this.data)) {
      return this.procesarArraySedes(this.data);
    }
    
    // Si es un objeto con sedes como propiedades
    if (typeof this.data === 'object' && !Array.isArray(this.data)) {
      return this.procesarObjetoSedes(this.data);
    }

    throw new Error('Estructura de datos no reconocida');
  }

  private procesarArraySedes(sedesArray: any[]): { labels: string[], datasets: any[] } {
    const labels = sedesArray.map(sede => sede.nombre || sede.sede || 'Sin nombre');
    
    return {
      labels,
      datasets: [
        {
          label: 'Pacientes',
          data: sedesArray.map(s => s.pacientes || s.totalPacientes || 0),
          backgroundColor: '#14a4bc'
        },
        {
          label: 'Historias',
          data: sedesArray.map(s => s.historias || s.totalHistorias || 0),
          backgroundColor: '#2ca444'
        },
        {
          label: 'Ventas',
          data: sedesArray.map(s => s.ventas || s.totalVentas || 0),
          backgroundColor: '#fcc404'
        },
        {
          label: 'Órdenes pendientes',
          data: sedesArray.map(s => s.ordenes || s.ordenesPendientes || 0),
          backgroundColor: '#dc3545'
        }
      ]
    };
  }

  private procesarObjetoSedes(sedesObj: Record<string, any>): { labels: string[], datasets: any[] } {
    const sedes = Object.keys(sedesObj);
    const labels = sedes;
    
    return {
      labels,
      datasets: [
        {
          label: 'Pacientes',
          data: sedes.map(sede => sedesObj[sede].pacientes || sedesObj[sede].totalPacientes || 0),
          backgroundColor: '#14a4bc'
        },
        {
          label: 'Historias',
          data: sedes.map(sede => sedesObj[sede].historias || sedesObj[sede].totalHistorias || 0),
          backgroundColor: '#2ca444'
        },
        {
          label: 'Ventas',
          data: sedes.map(sede => sedesObj[sede].ventas || sedesObj[sede].totalVentas || 0),
          backgroundColor: '#fcc404'
        },
        {
          label: 'Órdenes pendientes',
          data: sedes.map(sede => sedesObj[sede].ordenes || sedesObj[sede].ordenesPendientes || 0),
          backgroundColor: '#dc3545'
        }
      ]
    };
  }

  private mostrarGraficoVacio(): void {
    this.chartData = {
      labels: ['Sin datos'],
      datasets: [
        {
          label: 'Pacientes',
          data: [0],
          backgroundColor: '#14a4bc'
        },
        {
          label: 'Historias',
          data: [0],
          backgroundColor: '#2ca444'
        },
        {
          label: 'Ventas',
          data: [0],
          backgroundColor: '#fcc404'
        },
        {
          label: 'Órdenes pendientes',
          data: [0],
          backgroundColor: '#dc3545'
        }
      ]
    };
  }
}