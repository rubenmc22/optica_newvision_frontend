import { Component, Input, OnInit, OnChanges, SimpleChanges, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import {
  ChartOptions,
  ChartTypeRegistry,
  ChartData,
  Chart
} from 'chart.js';

@Component({
  selector: 'app-grafico-pacientes-por-mes',
  standalone: false,
  templateUrl: './grafico-pacientes-por-mes.component.html',
  styleUrls: ['./grafico-pacientes-por-mes.component.scss']
})
export class GraficoPacientesPorMesComponent implements OnInit, OnChanges, OnDestroy {
  @Input() data: any = {};
  @Input() sedeActual: string = '';

  // Propiedades para controlar visibilidad
  mostrarPacientes: boolean = false;
  mostrarHistorias: boolean = false;

  // Tipos de gráfico con ciclo
  chartPacientesType: keyof ChartTypeRegistry = 'doughnut';
  chartHistoriasType: keyof ChartTypeRegistry = 'doughnut';
  private tiposGrafico: (keyof ChartTypeRegistry)[] = ['doughnut', 'bar', 'line', 'pie'];
  refrescarGraficos: boolean = false;

  // Stats para mostrar
  totalPacientes: number = 0;
  totalHistorias: number = 0;
  promedioPacientes: number = 0;
  promedioHistorias: number = 0;
  crecimientoPacientes: number = 0;
  crecimientoHistorias: number = 0;

  // Propiedades para el carrusel
  graficoActual: number = 0;
  autoPlayActivo: boolean = false;
  private autoPlayInterval: any;

  graficos = [
    { nombre: 'Pacientes', icono: 'fas fa-users' },
    { nombre: 'Historias Médicas', icono: 'fas fa-file-medical' }
  ];

  modulosFuturos = [
    {
      nombre: 'Módulo de Ventas',
      icono: 'fas fa-shopping-cart',
      descripcion: 'Seguimiento de ventas y transacciones'
    },
    {
      nombre: 'Órdenes de Venta',
      icono: 'fas fa-clipboard-list',
      descripcion: 'Gestión de órdenes y pedidos'
    }
  ];

  // Paleta de colores moderna
  private coloresModernos = [
    '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6',
    '#1abc9c', '#34495e', '#e67e22', '#27ae60', '#8e44ad',
    '#16a085', '#2980b9'
  ];

  private coloresHover = [
    '#2980b9', '#27ae60', '#c0392b', '#d35400', '#8e44ad',
    '#149174', '#2c3e50', '#d35400', '#219653', '#7d3c98',
    '#138a72', '#2471a3'
  ];

  chartPacientesData: ChartData<'doughnut', number[], unknown> = {
    labels: [],
    datasets: [
      {
        label: 'Pacientes',
        data: [],
        backgroundColor: this.coloresModernos,
        hoverBackgroundColor: this.coloresHover,
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverBorderWidth: 3
      }
    ]
  };

  chartHistoriasData: ChartData<'doughnut', number[], unknown> = {
    labels: [],
    datasets: [
      {
        label: 'Historias Médicas',
        data: [],
        backgroundColor: this.coloresModernos,
        hoverBackgroundColor: this.coloresHover,
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverBorderWidth: 3
      }
    ]
  };

  ngOnInit(): void {
    this.actualizarGraficos();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['sedeActual']) {
      this.actualizarGraficos();
    }
  }

  ngOnDestroy(): void {
    this.detenerAutoPlay();
  }

  /**
   * MÉTODOS DEL CARRUSEL
   */
  siguienteGrafico(): void {
    const totalGraficos = this.graficos.length + this.modulosFuturos.length;
    if (this.graficoActual < totalGraficos - 1) {
      this.graficoActual++;
    } else {
      this.graficoActual = 0;
    }
  }

  anteriorGrafico(): void {
    const totalGraficos = this.graficos.length + this.modulosFuturos.length;
    if (this.graficoActual > 0) {
      this.graficoActual--;
    } else {
      this.graficoActual = totalGraficos - 1;
    }
  }

  irAgrafico(index: number): void {
    const totalGraficos = this.graficos.length + this.modulosFuturos.length;
    if (index >= 0 && index < totalGraficos) {
      this.graficoActual = index;
    }
  }

  toggleAutoPlay(): void {
    this.autoPlayActivo = !this.autoPlayActivo;

    if (this.autoPlayActivo) {
      this.iniciarAutoPlay();
    } else {
      this.detenerAutoPlay();
    }
  }

  private iniciarAutoPlay(): void {
    this.autoPlayInterval = setInterval(() => {
      this.siguienteGrafico();
    }, 5000);
  }

  private detenerAutoPlay(): void {
    if (this.autoPlayInterval) {
      clearInterval(this.autoPlayInterval);
      this.autoPlayInterval = null;
    }
  }

  activarModulo(modulo: any): void {
    //console.log(`Activando módulo: ${modulo.nombre}`);
    alert(`Módulo ${modulo.nombre} será activado próximamente`);
  }

  /**
   * MÉTODOS DE GRÁFICOS - CORREGIDOS
   */
  cambiarTipoGrafico(tipo: 'pacientes' | 'historias'): void {
    //console.log(`Cambiando tipo de gráfico: ${tipo}`);

    // Activar flag de refresh
    this.refrescarGraficos = true;

    if (tipo === 'pacientes') {
      const currentIndex = this.tiposGrafico.indexOf(this.chartPacientesType);
      const nextIndex = (currentIndex + 1) % this.tiposGrafico.length;
      this.chartPacientesType = this.tiposGrafico[nextIndex];
      //  console.log(`Nuevo tipo para pacientes: ${this.chartPacientesType}`);
    } else {
      const currentIndex = this.tiposGrafico.indexOf(this.chartHistoriasType);
      const nextIndex = (currentIndex + 1) % this.tiposGrafico.length;
      this.chartHistoriasType = this.tiposGrafico[nextIndex];
      //  console.log(`Nuevo tipo para historias: ${this.chartHistoriasType}`);
    }

    // Forzar recreación del gráfico
    setTimeout(() => {
      this.refrescarGraficos = false;
    }, 50);
  }

  getChartOptions(): ChartOptions {
    const isBarChart = this.chartPacientesType === 'bar' || this.chartHistoriasType === 'bar';
    const isLineChart = this.chartPacientesType === 'line' || this.chartHistoriasType === 'line';

    // Opciones base sin animaciones problemáticas
    const baseOptions: any = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#6c757d',
            font: {
              size: 11,
              family: "'Inter', sans-serif"
            },
            boxWidth: 12,
            padding: 15,
            usePointStyle: true
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
              const value = context.parsed;
              return `${label}: ${value}`;
            }
          }
        }
      }
    };

    // Configuraciones específicas por tipo de gráfico
    if (isBarChart || isLineChart) {
      baseOptions.scales = {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#6c757d'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        },
        x: {
          ticks: {
            color: '#6c757d'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        }
      };
    } else {
      // Para gráficos circulares (doughnut, pie)
      baseOptions.cutout = '60%';
    }

    return baseOptions;
  }

  exportarGrafico(tipo: string): void {
    //  console.log(`Exportando gráfico: ${tipo}`);
    alert(`Funcionalidad de exportar ${tipo} en desarrollo`);
  }

  maximizarGrafico(tipo: string): void {
    //  console.log(`Maximizando gráfico: ${tipo}`);
    alert(`Vista ampliada de ${tipo} en desarrollo`);
  }

  /**
   * ACTUALIZACIÓN DE GRÁFICOS CON TODOS LOS MESES (INCLUSO CON 0)
   */
  private actualizarGraficos(): void {
    //  console.log('📊 Datos mensuales recibidos:', this.data);

    try {
      const { labels, pacientes, historias } = this.procesarDatosMensuales();

      // Actualizar datos de gráficos
      this.chartPacientesData = {
        ...this.chartPacientesData,
        labels: labels,
        datasets: [{
          ...this.chartPacientesData.datasets[0],
          data: pacientes
        }]
      };

      this.chartHistoriasData = {
        ...this.chartHistoriasData,
        labels: labels,
        datasets: [{
          ...this.chartHistoriasData.datasets[0],
          data: historias
        }]
      };

      // Siempre mostrar los gráficos si hay meses en el rango
      this.mostrarPacientes = labels.length > 0;
      this.mostrarHistorias = labels.length > 0;

      // Calcular stats
      this.calcularStats(pacientes, historias);

      /* console.log('✅ Gráficos mensuales actualizados:', {
         labels,
         pacientes,
         historias,
         mostrarPacientes: this.mostrarPacientes,
         mostrarHistorias: this.mostrarHistorias
       });*/
    } catch (error) {
      console.error('❌ Error procesando datos mensuales:', error);
      this.mostrarGraficosVacios();
    }
  }

  /**
   * PROCESAMIENTO DE DATOS QUE INCLUYE TODOS LOS MESES
   */
  private procesarDatosMensuales(): { labels: string[], pacientes: number[], historias: number[] } {
    // Obtener el rango completo de meses
    const { fechaInicio, fechaFin } = this.obtenerRangoFechas();
    const todosLosMeses = this.generarRangoMeses(fechaInicio, fechaFin);

    // Procesar datos existentes
    const datosExistentes = this.obtenerDatosExistentes();

    // Combinar: para cada mes en el rango, usar datos existentes o 0
    const labels = todosLosMeses.map(fecha => this.formatearFechaMes(fecha));
    const pacientes = todosLosMeses.map(fecha => {
      const mesKey = this.obtenerKeyMes(fecha);
      return datosExistentes[mesKey]?.pacientes || 0;
    });
    const historias = todosLosMeses.map(fecha => {
      const mesKey = this.obtenerKeyMes(fecha);
      return datosExistentes[mesKey]?.historias || 0;
    });

    return { labels, pacientes, historias };
  }

  /**
   * OBTIENE EL RANGO DE FECHAS DESDE EL PRIMER REGISTRO HASTA HOY
   */
  private obtenerRangoFechas(): { fechaInicio: Date, fechaFin: Date } {
    let fechaInicio: Date;

    // Intentar obtener la fecha del primer registro de los datos
    const primerRegistro = this.obtenerFechaPrimerRegistro();

    if (primerRegistro) {
      fechaInicio = new Date(primerRegistro);
      // Ir al primer día del mes del primer registro
      fechaInicio.setDate(1);
    } else {
      // Si no hay datos, usar los últimos 6 meses por defecto
      fechaInicio = new Date();
      fechaInicio.setMonth(fechaInicio.getMonth() - 6);
      fechaInicio.setDate(1);
    }

    // Fecha fin: mes actual
    const fechaFin = new Date();
    fechaFin.setDate(1); // Primer día del mes actual

    /* console.log('📅 Rango de fechas:', {
       fechaInicio: fechaInicio.toISOString().split('T')[0],
       fechaFin: fechaFin.toISOString().split('T')[0]
     });*/

    return { fechaInicio, fechaFin };
  }

  /**
   * OBTIENE LA FECHA DEL PRIMER REGISTRO DE LOS DATOS
   */
  private obtenerFechaPrimerRegistro(): Date | null {
    if (!this.data) return null;

    let fechas: Date[] = [];

    if (Array.isArray(this.data)) {
      fechas = this.data
        .map(item => this.obtenerFechaMes(item.mes || item.nombre || item.fecha))
        .filter(fecha => fecha !== null) as Date[];
    } else if (typeof this.data === 'object') {
      const meses = Object.keys(this.data);
      fechas = meses
        .map(mes => this.obtenerFechaMes(mes))
        .filter(fecha => fecha !== null) as Date[];
    }

    if (fechas.length === 0) return null;

    // Encontrar la fecha más antigua
    const fechaMasAntigua = fechas.reduce((min, fecha) => fecha < min ? fecha : min);
    return fechaMasAntigua;
  }

  /**
   * OBTIENE LOS DATOS EXISTENTES ORGANIZADOS POR MES
   */
  private obtenerDatosExistentes(): Record<string, { pacientes: number, historias: number }> {
    const datos: Record<string, { pacientes: number, historias: number }> = {};

    if (Array.isArray(this.data)) {
      this.data.forEach(item => {
        const fecha = this.obtenerFechaMes(item.mes || item.nombre || item.fecha);
        if (fecha) {
          const key = this.obtenerKeyMes(fecha);
          datos[key] = {
            pacientes: item.pacientes || item.cantidad || item.totalPacientes || 0,
            historias: item.historias || item.totalHistorias || 0
          };
        }
      });
    } else if (typeof this.data === 'object') {
      Object.keys(this.data).forEach(mes => {
        const fecha = this.obtenerFechaMes(mes);
        if (fecha) {
          const key = this.obtenerKeyMes(fecha);
          datos[key] = {
            pacientes: this.data[mes].pacientes || this.data[mes].cantidad || this.data[mes].totalPacientes || 0,
            historias: this.data[mes].historias || this.data[mes].totalHistorias || 0
          };
        }
      });
    }

    return datos;
  }

  /**
   * GENERA RANGO DE MESES ENTRE DOS FECHAS
   */
  private generarRangoMeses(fechaInicio: Date, fechaFin: Date): Date[] {
    const meses: Date[] = [];
    const fechaActual = new Date(fechaInicio);

    while (fechaActual <= fechaFin) {
      meses.push(new Date(fechaActual));
      fechaActual.setMonth(fechaActual.getMonth() + 1);
    }

    //  console.log(`📊 Generados ${meses.length} meses en el rango`);
    return meses;
  }

  /**
   * OBTIENE LA FECHA A PARTIR DE UN STRING DE MES
   */
  private obtenerFechaMes(mesString: string): Date | null {
    if (!mesString) return null;

    const hoy = new Date();

    // Formato "Enero 2024"
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];

    const lowerMes = mesString.toLowerCase().trim();

    // Buscar nombre del mes en español
    for (let i = 0; i < meses.length; i++) {
      if (lowerMes.includes(meses[i])) {
        const añoMatch = mesString.match(/\d{4}/);
        const año = añoMatch ? parseInt(añoMatch[0]) : hoy.getFullYear();
        return new Date(año, i, 1);
      }
    }

    // Formato numérico "1" a "12"
    const mesNumero = parseInt(mesString);
    if (!isNaN(mesNumero) && mesNumero >= 1 && mesNumero <= 12) {
      return new Date(hoy.getFullYear(), mesNumero - 1, 1);
    }

    // Formato "YYYY-MM" o similar
    const fechaParsed = new Date(mesString);
    if (!isNaN(fechaParsed.getTime())) {
      fechaParsed.setDate(1);
      return fechaParsed;
    }

    console.warn(`⚠️ No se pudo parsear la fecha: ${mesString}`);
    return null;
  }

  /**
   * OBTIENE KEY ÚNICO PARA UN MES (YYYY-MM)
   */
  private obtenerKeyMes(fecha: Date): string {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    return `${año}-${mes}`;
  }

  /**
   * FORMATEA FECHA A "Mes Año"
   */
  private formatearFechaMes(fecha: Date): string {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
  }

  /**
   * MÉTODOS AUXILIARES
   */
  private calcularStats(pacientes: number[], historias: number[]): void {
    this.totalPacientes = pacientes.reduce((sum, val) => sum + val, 0);
    this.totalHistorias = historias.reduce((sum, val) => sum + val, 0);

    this.promedioPacientes = Math.round(this.totalPacientes / Math.max(pacientes.length, 1));
    this.promedioHistorias = Math.round(this.totalHistorias / Math.max(historias.length, 1));

    // Calcular crecimiento (último mes vs penúltimo mes)
    if (pacientes.length >= 2) {
      const ultimo = pacientes[pacientes.length - 1];
      const penultimo = pacientes[pacientes.length - 2];
      this.crecimientoPacientes = penultimo > 0 ? Math.round(((ultimo - penultimo) / penultimo) * 100) : (ultimo > 0 ? 100 : 0);
    } else {
      this.crecimientoPacientes = 0;
    }

    if (historias.length >= 2) {
      const ultimo = historias[historias.length - 1];
      const penultimo = historias[historias.length - 2];
      this.crecimientoHistorias = penultimo > 0 ? Math.round(((ultimo - penultimo) / penultimo) * 100) : (ultimo > 0 ? 100 : 0);
    } else {
      this.crecimientoHistorias = 0;
    }
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

    // Reset stats
    this.totalPacientes = 0;
    this.totalHistorias = 0;
    this.promedioPacientes = 0;
    this.promedioHistorias = 0;
    this.crecimientoPacientes = 0;
    this.crecimientoHistorias = 0;
  }

  // Helper para Math.abs en template
  get Math(): Math {
    return Math;
  }

  get totalGraficos(): number {
    return this.graficos.length + this.modulosFuturos.length;
  }

  esModuloFuturo(): boolean {
    return this.graficoActual >= this.graficos.length;
  }

  get moduloFuturoActual(): any {
    const index = this.graficoActual - this.graficos.length;
    return index >= 0 ? this.modulosFuturos[index] : null;
  }
}