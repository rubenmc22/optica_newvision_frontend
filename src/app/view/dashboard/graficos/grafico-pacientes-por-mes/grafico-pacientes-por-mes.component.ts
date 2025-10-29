import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import {
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
export class GraficoPacientesPorMesComponent implements OnInit, OnChanges {
  @Input() data: any = {}; // Más flexible para diferentes estructuras

  chartPacientesType: keyof ChartTypeRegistry = 'doughnut';
  chartHistoriasType: keyof ChartTypeRegistry = 'doughnut';

  chartPacientesData: ChartData<'doughnut', number[], unknown> = {
    labels: [],
    datasets: [
      {
        label: 'Pacientes',
        data: [],
        backgroundColor: [
          '#0d6efd', '#20c997', '#ffc107', '#dc3545', '#6f42c1', 
          '#6610f2', '#198754', '#fd7e14', '#0dcaf0', '#e83e8c', 
          '#6c757d', '#17a2b8'
        ],
        hoverBackgroundColor: [
          '#0b5ed7', '#198754', '#e0a800', '#bb2d3b', '#5c3799',
          '#520dc2', '#157347', '#e56f00', '#0bbbe2', '#d91a72',
          '#5a6268', '#138496'
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
          boxWidth: 12,
          padding: 15
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
          '#0d6efd', '#20c997', '#ffc107', '#dc3545', '#6f42c1', 
          '#6610f2', '#198754', '#fd7e14', '#0dcaf0', '#e83e8c', 
          '#6c757d', '#17a2b8'
        ],
        hoverBackgroundColor: [
          '#0b5ed7', '#198754', '#e0a800', '#bb2d3b', '#5c3799',
          '#520dc2', '#157347', '#e56f00', '#0bbbe2', '#d91a72',
          '#5a6268', '#138496'
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
          boxWidth: 12,
          padding: 15
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
    this.actualizarGraficos();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this.actualizarGraficos();
    }
  }

  private actualizarGraficos(): void {
    console.log('📊 Datos mensuales recibidos:', this.data);
    
    if (!this.data || Object.keys(this.data).length === 0) {
      console.warn('No hay datos mensuales para mostrar');
      this.mostrarGraficosVacios();
      return;
    }

    try {
      const { labels, pacientes, historias } = this.procesarDatosMensuales();
      
      this.chartPacientesData.labels = labels;
      this.chartPacientesData.datasets[0].data = pacientes;
      
      this.chartHistoriasData.labels = labels;
      this.chartHistoriasData.datasets[0].data = historias;
      
      console.log('✅ Gráficos mensuales actualizados:', {
        labels,
        pacientes,
        historias
      });
    } catch (error) {
      console.error('❌ Error procesando datos mensuales:', error);
      this.mostrarGraficosVacios();
    }
  }

  private procesarDatosMensuales(): { labels: string[], pacientes: number[], historias: number[] } {
    // Si es un array de meses
    if (Array.isArray(this.data)) {
      return this.procesarArrayMeses(this.data);
    }
    
    // Si es un objeto con meses como propiedades
    if (typeof this.data === 'object' && !Array.isArray(this.data)) {
      return this.procesarObjetoMeses(this.data);
    }

    throw new Error('Estructura de datos mensuales no reconocida');
  }

  private procesarArrayMeses(mesesArray: any[]): { labels: string[], pacientes: number[], historias: number[] } {
    const labels = mesesArray.map(mes => 
      mes.mes || mes.nombre || mes.fecha || 'Mes desconocido'
    );
    
    const pacientes = mesesArray.map(mes => 
      mes.pacientes || mes.cantidad || mes.totalPacientes || 0
    );
    
    const historias = mesesArray.map(mes => 
      mes.historias || mes.totalHistorias || 0
    );

    return { labels, pacientes, historias };
  }

  private procesarObjetoMeses(mesesObj: Record<string, any>): { labels: string[], pacientes: number[], historias: number[] } {
    const meses = Object.keys(mesesObj);
    const labels = meses.map(mes => this.formatearNombreMes(mes));
    
    const pacientes = meses.map(mes => 
      mesesObj[mes].pacientes || mesesObj[mes].cantidad || mesesObj[mes].totalPacientes || 0
    );
    
    const historias = meses.map(mes => 
      mesesObj[mes].historias || mesesObj[mes].totalHistorias || 0
    );

    return { labels, pacientes, historias };
  }

  private formatearNombreMes(mes: string): string {
    // Si el mes ya está formateado, dejarlo como está
    if (mes.length > 3 && isNaN(Number(mes))) {
      return mes;
    }
    
    // Si es un número, convertirlo a nombre del mes
    const mesNumero = parseInt(mes);
    if (!isNaN(mesNumero) && mesNumero >= 1 && mesNumero <= 12) {
      const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      return meses[mesNumero - 1];
    }
    
    return mes;
  }

  private mostrarGraficosVacios(): void {
    const mensaje = ['Sin datos'];
    
    this.chartPacientesData = {
      labels: mensaje,
      datasets: [
        {
          label: 'Pacientes',
          data: [1], // Un valor para que se muestre el gráfico
          backgroundColor: ['#6c757d'],
          hoverBackgroundColor: ['#5a6268']
        }
      ]
    };

    this.chartHistoriasData = {
      labels: mensaje,
      datasets: [
        {
          label: 'Historias Médicas',
          data: [1],
          backgroundColor: ['#6c757d'],
          hoverBackgroundColor: ['#5a6268']
        }
      ]
    };
  }
}