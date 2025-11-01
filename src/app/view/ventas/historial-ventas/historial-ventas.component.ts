import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-historial-ventas',
  standalone: false,
  templateUrl: './historial-ventas.component.html',
  styleUrls: ['./historial-ventas.component.scss']
})
export class HistorialVentasComponent implements OnInit {
  // Propiedades para los filtros
  asesores: any[] = [];
  especialistas: any[] = [];
  ventasFiltradas: any[] = [];
  totalVentas: number = 0;

  // Filtros
  filtros = {
    numeroControl: '',
    paciente: '',
    asesor: '',
    especialista: '',
    fechaDesde: '',
    fechaHasta: '',
    estado: '',
    montoMinimo: null
  };

  // Ordenamiento
  ordenamiento = {
    campo: 'fecha',
    ascendente: false
  };

  // Paginación
  paginaActual = 1;
  itemsPorPagina = 10;
  totalPaginas: number = 1; // ← Agregar esta propiedad

  ngOnInit() {
    this.cargarDatosIniciales();
  }

  cargarDatosIniciales() {
    // Cargar lista de asesores (ejemplo)
    this.asesores = [
      { id: 1, nombre: 'Ana García' },
      { id: 2, nombre: 'Carlos López' },
      { id: 3, nombre: 'María Rodríguez' }
    ];

    // Cargar lista de especialistas (ejemplo)
    this.especialistas = [
      { id: 1, nombre: 'Dr. Pérez' },
      { id: 2, nombre: 'Dra. Martínez' },
      { id: 3, nombre: 'Dr. González' }
    ];

    // Aquí cargarías las ventas desde tu servicio
    this.cargarVentas();
  }

  cargarVentas() {
    // Ejemplo de datos temporales
    this.ventasFiltradas = [
      {
        id: 1,
        numeroControl: '001',
        paciente: { nombre: 'Juan Pérez' },
        fecha: new Date(),
        estado: 'completada',
        montoTotal: 100,
        asesor: { nombre: 'Ana García' },
        especialista: { nombre: 'Dr. Pérez' },
        servicios: [{ nombre: 'Consulta' }],
        metodosPago: [
          { tipo: 'efectivo', monto: 100, conversionBs: 200 }
        ],
        mostrarDetalle: false
      },
      {
        id: 2,
        numeroControl: '002',
        paciente: { nombre: 'María López' },
        fecha: new Date(),
        estado: 'pendiente',
        montoTotal: 150,
        asesor: { nombre: 'Carlos López' },
        especialista: { nombre: 'Dra. Martínez' },
        servicios: [{ nombre: 'Examen' }],
        metodosPago: [
          { tipo: 'debito', monto: 150, conversionBs: 300 }
        ],
        mostrarDetalle: false
      }
    ];
    this.totalVentas = this.ventasFiltradas.length;
    this.totalPaginas = Math.ceil(this.totalVentas / this.itemsPorPagina);
  }

  // Métodos existentes
  aplicarFiltros() {
    console.log('Aplicando filtros:', this.filtros);
    // Tu lógica de filtrado aquí
  }

  limpiarFiltros() {
    this.filtros = {
      numeroControl: '',
      paciente: '',
      asesor: '',
      especialista: '',
      fechaDesde: '',
      fechaHasta: '',
      estado: '',
      montoMinimo: null
    };
  }

  cambiarOrden() {
    this.ordenamiento.ascendente = !this.ordenamiento.ascendente;
    // Lógica para reordenar las ventas
  }

  toggleDetalleVenta(ventaId: number) {
    const venta = this.ventasFiltradas.find(v => v.id === ventaId);
    if (venta) {
      venta.mostrarDetalle = !venta.mostrarDetalle;
    }
  }

  verRecibo(venta: any) {
    console.log('Ver recibo:', venta);
    // Lógica para mostrar recibo
    // Ejemplo: this.modalService.openRecibo(venta);
  }

  // ← Agregar este método que falta
  verDetalleCompleto(venta: any) {
    console.log('Ver detalle completo:', venta);
    // Lógica para mostrar detalle completo en modal o nueva página
    // Ejemplo: this.router.navigate(['/ventas/detalle', venta.id]);
  }

  cancelarVenta(venta: any) {
    console.log('Cancelar venta:', venta);
    // Lógica para cancelar venta
    if (confirm('¿Está seguro de que desea cancelar esta venta?')) {
      // Lógica de cancelación
      venta.estado = 'cancelada';
    }
  }

  generarInforme() {
    console.log('Generar informe con filtros:', this.filtros);
    // Lógica para generar informe
    // Ejemplo: this.informeService.generarInformeVentas(this.filtros);
  }

  getRangoPaginas(): number[] {
    this.totalPaginas = Math.ceil(this.totalVentas / this.itemsPorPagina);
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  cambiarPagina(pagina: number) {
    const totalPaginas = this.getRangoPaginas().length;
    if (pagina >= 1 && pagina <= totalPaginas) {
      this.paginaActual = pagina;
      // Lógica para cargar datos de la página
      console.log('Cambiando a página:', pagina);
    }
  }
}