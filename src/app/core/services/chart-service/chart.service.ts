// chart.service.ts - VERSIÓN COMPLETA CON TODOS LOS MÉTODOS
import { Injectable } from '@angular/core';
import { Chart } from 'chart.js';

@Injectable({
    providedIn: 'root'
})
export class ChartService {
    private charts: Map<string, Chart> = new Map();

    // Datos de prueba (privados)
    private datosDePrueba = {
        ventasPorDia: {
            labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
            datos: [1200, 1900, 1500, 2200, 1800, 2500, 2000]
        },
        comparativaMensual: {
            labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
            datosActual: [12500, 14200, 13800, 16500, 15800, 17200],
            datosAnterior: [11800, 13000, 12500, 15200, 14500, 16000]
        },
        distribucionFormaPago: {
            labels: ['Contado', 'Abono', 'Cashea', 'Crédito'],
            datos: [7500, 3000, 1500, 500]
        },
        tendenciaDeuda: {
            labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
            deudaCashea: [2800, 2600, 2500, 2400],
            deudaAbonos: [1400, 1300, 1250, 1200],
            deudaContado: [400, 350, 320, 300]
        },
        ventasPorAsesor: {
            labels: ['Juan Pérez', 'María López', 'Carlos Rojas', 'Ana Martínez'],
            datos: [8500, 6200, 4800, 3200]
        }
    };

    constructor() {
        Chart.register();
    }

    // ========== MÉTODOS PARA CREAR GRÁFICOS ==========

    /**
     * Crear gráfico de Ventas por Día
     */
    crearGraficoVentasPorDia(canvasId: string, simboloMoneda: string = '$'): Chart | null {
        this.destruirGraficoPorId(canvasId);

        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        try {
            const chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: this.datosDePrueba.ventasPorDia.labels,
                    datasets: [{
                        label: 'Ventas Diarias',
                        data: this.datosDePrueba.ventasPorDia.datos,
                        backgroundColor: 'rgba(67, 97, 238, 0.8)',
                        borderColor: 'rgba(67, 97, 238, 1)',
                        borderWidth: 2,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context: any) => `Ventas: ${simboloMoneda}${context.parsed.y.toLocaleString()}`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(0, 0, 0, 0.08)' },
                            ticks: {
                                color: '#666',
                                padding: 10,
                                font: { size: 11 },
                                callback: (value: any) => {
                                    const num = Number(value);
                                    if (num >= 1000000) return `${simboloMoneda}${(num / 1000000).toFixed(1)}M`;
                                    if (num >= 1000) return `${simboloMoneda}${(num / 1000).toFixed(1)}K`;
                                    return `${simboloMoneda}${num}`;
                                }
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: '#555',
                                padding: 10
                            }
                        }
                    }
                }
            });

            this.charts.set(canvasId, chart);
            return chart;
        } catch (error) {
            console.error(`Error al crear gráfico ${canvasId}:`, error);
            return null;
        }
    }

    /**
     * Crear gráfico de Comparativa Mensual
     */
    crearGraficoComparativaMensual(canvasId: string, simboloMoneda: string = '$'): Chart | null {
        this.destruirGraficoPorId(canvasId);

        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        try {
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: this.datosDePrueba.comparativaMensual.labels,
                    datasets: [
                        {
                            label: 'Mes Actual',
                            data: this.datosDePrueba.comparativaMensual.datosActual,
                            borderColor: 'rgba(6, 214, 160, 1)',
                            backgroundColor: 'rgba(6, 214, 160, 0.1)',
                            borderWidth: 3,
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: 'Mes Anterior',
                            data: this.datosDePrueba.comparativaMensual.datosAnterior,
                            borderColor: 'rgba(108, 117, 125, 0.7)',
                            backgroundColor: 'rgba(108, 117, 125, 0.05)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            tension: 0.4,
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { color: '#555', padding: 15 }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context: any) => `${context.dataset.label}: ${simboloMoneda}${context.parsed.y.toLocaleString()}`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(0, 0, 0, 0.06)' },
                            ticks: {
                                color: '#666',
                                padding: 10,
                                font: { size: 11 },
                                callback: (value: any) => {
                                    const num = Number(value);
                                    if (num >= 1000000) return `${simboloMoneda}${(num / 1000000).toFixed(1)}M`;
                                    if (num >= 1000) return `${simboloMoneda}${(num / 1000).toFixed(1)}K`;
                                    return `${simboloMoneda}${num}`;
                                }
                            }
                        },
                        x: {
                            grid: { color: 'rgba(0, 0, 0, 0.04)' },
                            ticks: {
                                color: '#555',
                                padding: 10,
                                font: { size: 12 }
                            }
                        }
                    }
                }
            });

            this.charts.set(canvasId, chart);
            return chart;
        } catch (error) {
            console.error(`Error al crear gráfico ${canvasId}:`, error);
            return null;
        }
    }

    /**
     * Crear gráfico de Distribución de Pagos
     */
    crearGraficoDistribucionPago(canvasId: string): Chart | null {
        this.destruirGraficoPorId(canvasId);

        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        try {
            const chart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: this.datosDePrueba.distribucionFormaPago.labels,
                    datasets: [{
                        data: this.datosDePrueba.distribucionFormaPago.datos,
                        backgroundColor: [
                            'rgba(13, 110, 253, 0.8)',
                            'rgba(25, 135, 84, 0.8)',
                            'rgba(13, 202, 240, 0.8)',
                            'rgba(108, 117, 125, 0.8)'
                        ],
                        borderColor: [
                            'rgba(13, 110, 253, 1)',
                            'rgba(25, 135, 84, 1)',
                            'rgba(13, 202, 240, 1)',
                            'rgba(108, 117, 125, 1)'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context: any) => {
                                    const label = context.label || '';
                                    const value = context.parsed;
                                    const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                                    const percentage = Math.round((value / total) * 100);
                                    return `${label}: ${percentage}% ($${value.toLocaleString()})`;
                                }
                            }
                        }
                    },
                    cutout: '65%'
                }
            });

            this.charts.set(canvasId, chart);
            return chart;
        } catch (error) {
            console.error(`Error al crear gráfico ${canvasId}:`, error);
            return null;
        }
    }

    /**
     * Crear gráfico de Tendencia de Deuda
     */
    crearGraficoTendenciaDeuda(canvasId: string, simboloMoneda: string = '$'): Chart | null {
        this.destruirGraficoPorId(canvasId);

        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        try {
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: this.datosDePrueba.tendenciaDeuda.labels,
                    datasets: [
                        {
                            label: 'Deuda Cashea',
                            data: this.datosDePrueba.tendenciaDeuda.deudaCashea,
                            borderColor: '#0dcaf0',
                            backgroundColor: 'rgba(13, 202, 240, 0.1)',
                            borderWidth: 3,
                            tension: 0.3,
                            fill: true
                        },
                        {
                            label: 'Deuda Abonos',
                            data: this.datosDePrueba.tendenciaDeuda.deudaAbonos,
                            borderColor: '#ffc107',
                            backgroundColor: 'rgba(255, 193, 7, 0.08)',
                            borderWidth: 3,
                            tension: 0.3,
                            fill: true
                        },
                        {
                            label: 'Deuda Contado',
                            data: this.datosDePrueba.tendenciaDeuda.deudaContado,
                            borderColor: '#dc3545',
                            backgroundColor: 'rgba(220, 53, 69, 0.08)',
                            borderWidth: 3,
                            tension: 0.3,
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { color: '#555', padding: 12 }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context: any) => `${context.dataset.label}: ${simboloMoneda}${context.parsed.y.toLocaleString()}`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(0, 0, 0, 0.06)' },
                            ticks: {
                                color: '#666',
                                padding: 10,
                                font: { size: 11 },
                                callback: (value: any) => {
                                    const num = Number(value);
                                    if (num >= 1000000) return `${simboloMoneda}${(num / 1000000).toFixed(1)}M`;
                                    if (num >= 1000) return `${simboloMoneda}${(num / 1000).toFixed(1)}K`;
                                    return `${simboloMoneda}${num}`;
                                }
                            }
                        },
                        x: {
                            grid: { color: 'rgba(0, 0, 0, 0.04)' },
                            ticks: {
                                color: '#555',
                                padding: 10,
                                font: { size: 12 }
                            }
                        }
                    }
                }
            });

            this.charts.set(canvasId, chart);
            return chart;
        } catch (error) {
            console.error(`Error al crear gráfico ${canvasId}:`, error);
            return null;
        }
    }

    /**
     * Crear gráfico de Ventas por Asesor
     */
    crearGraficoVentasPorAsesor(canvasId: string, simboloMoneda: string = '$'): Chart | null {
        this.destruirGraficoPorId(canvasId);

        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        try {
            const chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: this.datosDePrueba.ventasPorAsesor.labels,
                    datasets: [{
                        label: 'Ventas por Asesor',
                        data: this.datosDePrueba.ventasPorAsesor.datos,
                        backgroundColor: [
                            'rgba(67, 97, 238, 0.8)',
                            'rgba(25, 135, 84, 0.8)',
                            'rgba(13, 202, 240, 0.8)',
                            'rgba(255, 193, 7, 0.8)'
                        ],
                        borderColor: [
                            'rgba(67, 97, 238, 1)',
                            'rgba(25, 135, 84, 1)',
                            'rgba(13, 202, 240, 1)',
                            'rgba(255, 193, 7, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context: any) => `Ventas: ${simboloMoneda}${context.parsed.x.toLocaleString()}`
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            grid: { color: 'rgba(0, 0, 0, 0.06)' },
                            ticks: {
                                color: '#666',
                                padding: 10,
                                font: { size: 11 },
                                callback: (value: any) => {
                                    const num = Number(value);
                                    if (num >= 1000000) return `${simboloMoneda}${(num / 1000000).toFixed(1)}M`;
                                    if (num >= 1000) return `${simboloMoneda}${(num / 1000).toFixed(1)}K`;
                                    return `${simboloMoneda}${num}`;
                                }
                            }
                        },
                        y: {
                            grid: { display: false },
                            ticks: {
                                color: '#555',
                                padding: 8
                            }
                        }
                    }
                }
            });

            this.charts.set(canvasId, chart);
            return chart;
        } catch (error) {
            console.error(`Error al crear gráfico ${canvasId}:`, error);
            return null;
        }
    }

    // ========== MÉTODOS PARA MANEJAR DATOS ==========

    /**
     * Actualizar datos de prueba
     */
    actualizarDatosDePrueba(nuevosDatos: any): void {
        // Fusionar los nuevos datos con los existentes
        this.datosDePrueba = {
            ...this.datosDePrueba,
            ...nuevosDatos
        };

        // También actualizar los gráficos existentes si están visibles
        this.actualizarGraficosConNuevosDatos(nuevosDatos);
    }

    /**
     * Actualizar datos específicos de un tipo de gráfico
     */
    actualizarDatosDePruebaPorTipo(tipo: string, nuevosDatos: any): void {
        if (this.datosDePrueba[tipo as keyof typeof this.datosDePrueba]) {
            (this.datosDePrueba[tipo as keyof typeof this.datosDePrueba] as any) = {
                ...(this.datosDePrueba[tipo as keyof typeof this.datosDePrueba] as any),
                ...nuevosDatos
            };

            // Actualizar el gráfico correspondiente si existe
            this.actualizarGraficoPorTipo(tipo);
        }
    }

    /**
     * Obtener datos de prueba
     */
    obtenerDatosDePrueba(): any {
        return { ...this.datosDePrueba };
    }

    // ========== MÉTODOS PARA ACTUALIZAR GRÁFICOS ==========

    /**
     * Actualizar todos los gráficos con nuevos datos
     */
    private actualizarGraficosConNuevosDatos(nuevosDatos: any): void {
        Object.keys(nuevosDatos).forEach(tipo => {
            this.actualizarGraficoPorTipo(tipo);
        });
    }

    /**
     * Actualizar un gráfico específico por tipo
     */
    private actualizarGraficoPorTipo(tipo: string): void {
        let canvasId = '';
        let simboloMoneda = '$';

        switch (tipo) {
            case 'ventasPorDia':
                canvasId = 'ventasPorDiaChart';
                break;
            case 'comparativaMensual':
                canvasId = 'comparativaMensualChart';
                break;
            case 'distribucionFormaPago':
                canvasId = 'distribucionPagoChart';
                break;
            case 'tendenciaDeuda':
                canvasId = 'tendenciaDeudaChart';
                break;
            case 'ventasPorAsesor':
                canvasId = 'ventasPorAsesorChart';
                break;
        }

        if (canvasId) {
            // Destruir y recrear el gráfico con los nuevos datos
            const chart = this.charts.get(canvasId);
            if (chart) {
                chart.destroy();
                this.charts.delete(canvasId);
            }

            // Recrear el gráfico
            switch (tipo) {
                case 'ventasPorDia':
                    this.crearGraficoVentasPorDia(canvasId, simboloMoneda);
                    break;
                case 'comparativaMensual':
                    this.crearGraficoComparativaMensual(canvasId, simboloMoneda);
                    break;
                case 'distribucionFormaPago':
                    this.crearGraficoDistribucionPago(canvasId);
                    break;
                case 'tendenciaDeuda':
                    this.crearGraficoTendenciaDeuda(canvasId, simboloMoneda);
                    break;
                case 'ventasPorAsesor':
                    this.crearGraficoVentasPorAsesor(canvasId, simboloMoneda);
                    break;
            }
        }
    }

    /**
     * Actualizar un gráfico específico directamente
     */
    actualizarGrafico(canvasId: string, nuevosDatos: any): boolean {
        const chart = this.charts.get(canvasId);
        if (!chart) return false;

        try {
            if (nuevosDatos.labels) {
                chart.data.labels = nuevosDatos.labels;
            }

            if (nuevosDatos.datasets) {
                chart.data.datasets = nuevosDatos.datasets;
            }

            if (nuevosDatos.data) {
                chart.data.datasets.forEach((dataset: any, index: number) => {
                    if (nuevosDatos.data[index] !== undefined) {
                        dataset.data = nuevosDatos.data[index];
                    }
                });
            }

            chart.update();
            return true;
        } catch (error) {
            console.error(`Error al actualizar gráfico ${canvasId}:`, error);
            return false;
        }
    }

    // ========== MÉTODOS PARA CREAR TODOS LOS GRÁFICOS ==========

    /**
     * Crear todos los gráficos del resumen financiero
     */
    crearTodosLosGraficos(simboloMoneda: string = '$'): void {
        setTimeout(() => this.crearGraficoVentasPorDia('ventasPorDiaChart', simboloMoneda), 50);
        setTimeout(() => this.crearGraficoComparativaMensual('comparativaMensualChart', simboloMoneda), 150);
        setTimeout(() => this.crearGraficoDistribucionPago('distribucionPagoChart'), 250);
        setTimeout(() => this.crearGraficoTendenciaDeuda('tendenciaDeudaChart', simboloMoneda), 350);
        setTimeout(() => this.crearGraficoVentasPorAsesor('ventasPorAsesorChart', simboloMoneda), 450);
    }

    // ========== MÉTODOS PARA DESTRUIR GRÁFICOS ==========

    /**
     * Destruir un gráfico específico por ID
     */
    destruirGraficoPorId(canvasId: string): void {
        const chart = this.charts.get(canvasId);
        if (chart) {
            try {
                chart.destroy();
                this.charts.delete(canvasId);
            } catch (error) {
                console.warn(`Error al destruir gráfico ${canvasId}:`, error);
            }
        }
    }

    /**
     * Destruir todos los gráficos
     */
    destruirTodosLosGraficos(): void {
        this.charts.forEach((chart, canvasId) => {
            try {
                chart.destroy();
            } catch (error) {
                console.warn(`Error al destruir gráfico ${canvasId}:`, error);
            }
        });
        this.charts.clear();
    }

    /**
     * Método auxiliar para destruir un objeto Chart directamente
     */
    destruirGrafico(chart: Chart): void {
        try {
            chart.destroy();
        } catch (error) {
            console.warn('Error al destruir gráfico:', error);
        }
    }

    // ========== MÉTODOS DE UTILIDAD ==========

    /**
     * Verificar si un gráfico existe
     */
    existeGrafico(canvasId: string): boolean {
        return this.charts.has(canvasId);
    }

    /**
     * Obtener un gráfico por ID
     */
    obtenerGrafico(canvasId: string): Chart | undefined {
        return this.charts.get(canvasId);
    }

    /**
     * Obtener todos los gráficos
     */
    obtenerTodosLosGraficos(): Map<string, Chart> {
        return new Map(this.charts);
    }

    /**
     * Actualizar la comparativa mensual con diferentes períodos
     */
    actualizarComparativaPorPeriodo(periodo: string): void {
        let nuevosDatos: any;

        switch (periodo) {
            case 'mes':
                nuevosDatos = {
                    comparativaMensual: {
                        labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
                        datosActual: [12500, 14200, 13800, 16500, 15800, 17200],
                        datosAnterior: [11800, 13000, 12500, 15200, 14500, 16000]
                    }
                };
                break;
            case 'trimestre':
                nuevosDatos = {
                    comparativaMensual: {
                        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
                        datosActual: [40500, 49500, 52000, 58000],
                        datosAnterior: [38000, 46500, 49000, 55000]
                    }
                };
                break;
            case 'anio':
                nuevosDatos = {
                    comparativaMensual: {
                        labels: ['2021', '2022', '2023', '2024'],
                        datosActual: [185000, 210000, 240000, 200000],
                        datosAnterior: [165000, 190000, 220000, 180000]
                    }
                };
                break;
            default:
                return;
        }

        this.actualizarDatosDePrueba(nuevosDatos);
    }
}