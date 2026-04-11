import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';

@Component({
  selector: 'app-grafico-comparativa-sedes',
  standalone: false,
  templateUrl: './grafico-comparativa-sedes.component.html',
  styleUrls: ['./grafico-comparativa-sedes.component.scss']
})
export class GraficoComparativaSedesComponent implements OnInit, OnChanges {

  @Input() data: any = {};

  // Configuración del gráfico
  chartType: any = 'bar';
  chartData: ChartData<'bar'> = { labels: [], datasets: [] };
  mostrarGrafico: boolean = false;

  // Filtros y configuraciones
  metricaSeleccionada: string = 'todas';
  esHorizontal: boolean = false;

  // Estadísticas rápidas
  estadisticasRapidas: any[] = [];

  // Paleta de colores moderna
  private colores = {
    pacientes: '#3498db',
    historias: '#2ecc71',
    pendientes: '#f39c12',
    facturadas: '#e74c3c',
    sedes: '#9b59b6'
  };

  // Opciones base del gráfico
  private get baseOptions(): ChartOptions<'bar'> {
    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: this.esHorizontal ? 'y' : 'x', // Configuración horizontal/vertical
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#6c757d',
            font: {
              family: "'Inter', sans-serif",
              size: 12
            },
            padding: 15,
            usePointStyle: true,
            boxWidth: 8
          }
        },
        tooltip: {
          backgroundColor: 'rgba(44, 62, 80, 0.95)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: '#3498db',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: (context: any) => {
              const label = context.dataset.label || '';
              let value: number;

              // Manejar diferentes tipos de datos de Chart.js
              if (typeof context.parsed === 'object') {
                // Para gráficos de barras
                value = this.esHorizontal ? context.parsed.x : context.parsed.y;
              } else {
                // Para otros tipos de gráficos
                value = context.parsed ?? 0;
              }

              return `${label}: ${this.formatearNumero(value)}`;
            },
            title: (context: any) => {
              return `Sede: ${context[0].label}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            color: '#6c757d',
            font: {
              family: "'Inter', sans-serif"
            },
            callback: this.esHorizontal ? undefined : (value: any) => {
              const numValue = typeof value === 'number' ? value : Number(value);
              return this.formatearNumero(numValue);
            }
          },
          title: {
            display: true,
            text: this.esHorizontal ? 'Cantidad' : 'Sedes',
            color: '#6c757d',
            font: {
              family: "'Inter', sans-serif",
              size: 12
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            color: '#6c757d',
            font: {
              family: "'Inter', sans-serif"
            },
            callback: this.esHorizontal ? undefined : (value: any) => {
              const numValue = typeof value === 'number' ? value : Number(value);
              return this.formatearNumero(numValue);
            }
          },
          title: {
            display: true,
            text: this.esHorizontal ? 'Sedes' : 'Cantidad',
            color: '#6c757d',
            font: {
              family: "'Inter', sans-serif",
              size: 12
            }
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    };
  }

  get chartOptions(): ChartOptions<'bar'> {
    return this.baseOptions;
  }

  ngOnInit(): void {
    this.actualizarGrafico();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this.actualizarGrafico();
    }
  }

  actualizarGrafico(): void {
    //console.log('📊 Datos recibidos en comparativa-sedes:', this.data);

    this.mostrarGrafico = this.tieneDatos();

    if (!this.mostrarGrafico) {
      console.warn('No hay datos para mostrar en el gráfico de comparativa');
      this.mostrarGraficoVacio();
      return;
    }

    try {
      const { labels, datasets } = this.procesarDatos();
      this.chartData.labels = labels;
      this.chartData.datasets = datasets;

      // Actualizar estadísticas rápidas
      this.actualizarEstadisticasRapidas();

   //   console.log('✅ Gráfico de comparativa actualizado:', this.chartData);
    } catch (error) {
      console.error('❌ Error procesando datos de comparativa:', error);
      this.mostrarGraficoVacio();
    }
  }

  private procesarDatos(): { labels: string[], datasets: any[] } {
    if (Array.isArray(this.data)) {
      return this.procesarArraySedes(this.data);
    }

    if (typeof this.data === 'object' && !Array.isArray(this.data)) {
      return this.procesarObjetoSedes(this.data);
    }

    throw new Error('Estructura de datos no reconocida');
  }

  private procesarArraySedes(sedesArray: any[]): { labels: string[], datasets: any[] } {
    const labels = sedesArray.map(sede =>
      sede.nombre || sede.sede || sede.id || 'Sede Sin Nombre'
    );

    const datasets = [];

    // Pacientes
    if (this.metricaSeleccionada === 'todas' || this.metricaSeleccionada === 'pacientes') {
      datasets.push({
        label: 'Pacientes',
        data: sedesArray.map(s => s.pacientes || s.totalPacientes || 0),
        backgroundColor: this.colores.pacientes,
        borderColor: this.colores.pacientes,
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.7
      });
    }

    // Historias Médicas
    if (this.metricaSeleccionada === 'todas' || this.metricaSeleccionada === 'historias') {
      datasets.push({
        label: 'Historias Médicas',
        data: sedesArray.map(s => s.historias || s.totalHistorias || 0),
        backgroundColor: this.colores.historias,
        borderColor: this.colores.historias,
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.7
      });
    }

    // Consultas pendientes
    if (this.metricaSeleccionada === 'todas' || this.metricaSeleccionada === 'pendientes') {
      datasets.push({
        label: 'Pendientes de cobro',
        data: sedesArray.map(s => s.consultasPendientes || s.totalPendientes || 0),
        backgroundColor: this.colores.pendientes,
        borderColor: this.colores.pendientes,
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.7
      });
    }

    // Historias facturadas
    if (this.metricaSeleccionada === 'todas' || this.metricaSeleccionada === 'facturadas') {
      datasets.push({
        label: 'Historias con venta',
        data: sedesArray.map(s => s.historiasFacturadas || s.totalFacturadas || 0),
        backgroundColor: this.colores.facturadas,
        borderColor: this.colores.facturadas,
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.7
      });
    }

    return { labels, datasets };
  }

  private procesarObjetoSedes(sedesObj: Record<string, any>): { labels: string[], datasets: any[] } {
    const sedes = Object.keys(sedesObj);
    const labels = sedes.map(sede => this.formatearNombreSede(sede));

    const datasets = [];

    // Pacientes
    if (this.metricaSeleccionada === 'todas' || this.metricaSeleccionada === 'pacientes') {
      datasets.push({
        label: 'Pacientes',
        data: sedes.map(sede => sedesObj[sede].pacientes || sedesObj[sede].totalPacientes || 0),
        backgroundColor: this.colores.pacientes,
        borderColor: this.colores.pacientes,
        borderWidth: 1,
        borderRadius: 4
      });
    }

    // Historias Médicas
    if (this.metricaSeleccionada === 'todas' || this.metricaSeleccionada === 'historias') {
      datasets.push({
        label: 'Historias Médicas',
        data: sedes.map(sede => sedesObj[sede].historias || sedesObj[sede].totalHistorias || 0),
        backgroundColor: this.colores.historias,
        borderColor: this.colores.historias,
        borderWidth: 1,
        borderRadius: 4
      });
    }

    // Consultas pendientes
    if (this.metricaSeleccionada === 'todas' || this.metricaSeleccionada === 'pendientes') {
      datasets.push({
        label: 'Pendientes de cobro',
        data: sedes.map(sede => sedesObj[sede].consultasPendientes || sedesObj[sede].totalPendientes || 0),
        backgroundColor: this.colores.pendientes,
        borderColor: this.colores.pendientes,
        borderWidth: 1,
        borderRadius: 4
      });
    }

    // Historias facturadas
    if (this.metricaSeleccionada === 'todas' || this.metricaSeleccionada === 'facturadas') {
      datasets.push({
        label: 'Historias con venta',
        data: sedes.map(sede => sedesObj[sede].historiasFacturadas || sedesObj[sede].totalFacturadas || 0),
        backgroundColor: this.colores.facturadas,
        borderColor: this.colores.facturadas,
        borderWidth: 1,
        borderRadius: 4
      });
    }

    return { labels, datasets };
  }

  private actualizarEstadisticasRapidas(): void {
    if (!this.data) return;

    let totalPacientes = 0;
    let totalHistorias = 0;
    let totalPendientes = 0;
    let totalFacturadas = 0;

    if (Array.isArray(this.data)) {
      totalPacientes = this.data.reduce((sum, sede) => sum + (sede.pacientes || sede.totalPacientes || 0), 0);
      totalHistorias = this.data.reduce((sum, sede) => sum + (sede.historias || sede.totalHistorias || 0), 0);
      totalPendientes = this.data.reduce((sum, sede) => sum + (sede.consultasPendientes || sede.totalPendientes || 0), 0);
      totalFacturadas = this.data.reduce((sum, sede) => sum + (sede.historiasFacturadas || sede.totalFacturadas || 0), 0);
    } else if (typeof this.data === 'object') {
      const sedes = Object.keys(this.data);
      totalPacientes = sedes.reduce((sum, sede) => sum + (this.data[sede].pacientes || this.data[sede].totalPacientes || 0), 0);
      totalHistorias = sedes.reduce((sum, sede) => sum + (this.data[sede].historias || this.data[sede].totalHistorias || 0), 0);
      totalPendientes = sedes.reduce((sum, sede) => sum + (this.data[sede].consultasPendientes || this.data[sede].totalPendientes || 0), 0);
      totalFacturadas = sedes.reduce((sum, sede) => sum + (this.data[sede].historiasFacturadas || this.data[sede].totalFacturadas || 0), 0);
    }

    this.estadisticasRapidas = [
      {
        icono: 'fas fa-users',
        label: 'Total Pacientes',
        valor: this.formatearNumero(totalPacientes),
        color: this.colores.pacientes
      },
      {
        icono: 'fas fa-file-medical',
        label: 'Total Historias',
        valor: this.formatearNumero(totalHistorias),
        color: this.colores.historias
      },
      {
        icono: 'fas fa-wallet',
        label: 'Pendientes de cobro',
        valor: this.formatearNumero(totalPendientes),
        color: this.colores.pendientes
      },
      {
        icono: 'fas fa-receipt',
        label: 'Historias con venta',
        valor: this.formatearNumero(totalFacturadas),
        color: this.colores.facturadas
      }
    ];
  }

  // Métodos auxiliares
  private formatearNombreSede(nombre: string): string {
    return nombre.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private formatearNumero(numero: number): string {
    if (numero >= 1000000) {
      return (numero / 1000000).toFixed(1) + 'M';
    } else if (numero >= 1000) {
      return (numero / 1000).toFixed(1) + 'K';
    }
    return numero.toString();
  }

  private tieneDatos(): boolean {
    if (!this.data) return false;
    if (Array.isArray(this.data)) return this.data.length > 0;
    if (typeof this.data === 'object') return Object.keys(this.data).length > 0;
    return false;
  }

  private mostrarGraficoVacio(): void {
    this.chartData = {
      labels: ['Sin datos disponibles'],
      datasets: [{
        label: 'Datos',
        data: [0],
        backgroundColor: '#6c757d'
      }]
    };
    this.estadisticasRapidas = [];
  }

  // Métodos públicos para las acciones
  exportarGrafico(): void {
  //  console.log('Exportando gráfico de comparativa');
    alert('Funcionalidad de exportación en desarrollo');
  }

  cambiarVista(): void {
    // Alternar entre vista vertical y horizontal
    this.esHorizontal = !this.esHorizontal;
    this.actualizarGrafico();
  }

  cambiarTipoGrafico(tipo: string): void {
    if (tipo === 'line') {
      this.chartType = 'line';
    } else {
      this.chartType = 'bar';
    }
    this.actualizarGrafico();
  }

  maximizarGrafico(): void {
    //console.log('Maximizando gráfico de comparativa');
    alert('Vista ampliada en desarrollo');
  }
}