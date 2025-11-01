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
  @Input() data: any = {};

  // ✅ Propiedades para controlar visibilidad
  mostrarPacientes: boolean = false;
  mostrarHistorias: boolean = false;

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
    
    // ✅ Verificar si hay datos de forma segura
    const tieneDatos = this.tieneDatos();
    
    if (!tieneDatos) {
      console.warn('No hay datos mensuales para mostrar');
      this.mostrarGraficosVacios();
      return;
    }

    try {
      const { labels, pacientes, historias } = this.procesarDatosMensuales();
      
      // ✅ Actualizar datos y controlar visibilidad
      this.chartPacientesData.labels = labels;
      this.chartPacientesData.datasets[0].data = pacientes;
      this.mostrarPacientes = pacientes.some(p => p > 0);
      
      this.chartHistoriasData.labels = labels;
      this.chartHistoriasData.datasets[0].data = historias;
      this.mostrarHistorias = historias.some(h => h > 0);
      
      console.log('✅ Gráficos mensuales actualizados:', {
        labels,
        pacientes,
        historias,
        mostrarPacientes: this.mostrarPacientes,
        mostrarHistorias: this.mostrarHistorias
      });
    } catch (error) {
      console.error('❌ Error procesando datos mensuales:', error);
      this.mostrarGraficosVacios();
    }
  }

  // ✅ Método seguro para verificar datos
  private tieneDatos(): boolean {
    if (!this.data) return false;
    
    if (Array.isArray(this.data)) {
      return this.data.length > 0 && this.data.some(item => 
        (item.pacientes && item.pacientes > 0) || 
        (item.historias && item.historias > 0)
      );
    }
    
    if (typeof this.data === 'object') {
      const keys = Object.keys(this.data);
      return keys.length > 0 && keys.some(key => 
        (this.data[key].pacientes && this.data[key].pacientes > 0) || 
        (this.data[key].historias && this.data[key].historias > 0)
      );
    }
    
    return false;
  }

  private procesarDatosMensuales(): { labels: string[], pacientes: number[], historias: number[] } {
    if (Array.isArray(this.data)) {
      return this.procesarArrayMeses(this.data);
    }
    
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
    if (mes.length > 3 && isNaN(Number(mes))) {
      return mes;
    }
    
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
    this.chartPacientesData = {
      labels: [],
      datasets: []
    };
    
    this.chartHistoriasData = {
      labels: [],
      datasets: []
    };
    
    this.mostrarPacientes = false;
    this.mostrarHistorias = false;
  }
}