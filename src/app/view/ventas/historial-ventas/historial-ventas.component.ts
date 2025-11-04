import { Component, OnInit, HostListener } from '@angular/core';

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
  ventasOriginales: any[] = [];
  totalVentas: number = 0;
  presetActivo: string = '';

  // Filtros optimizados
  filtros = {
    busquedaGeneral: '',
    asesor: '',
    especialista: '',
    fechaDesde: '',
    fechaHasta: '',
    estado: ''
  };

  // Nuevas propiedades para el datepicker
  showDatepicker: boolean = false;
  fechaUnica: string = '';


  // Para validación de fechas
  maxDate: string = '';
  minDate: string = '2020-01-01'

  // Ordenamiento
  ordenamiento = {
    campo: 'fecha',
    ascendente: false
  };

  // Paginación
  paginaActual = 1;
  itemsPorPagina = 10;
  totalPaginas: number = 1;

  ngOnInit() {
    this.cargarDatosIniciales();
    this.setMaxDate();
  }

  private setMaxDate(): void {
    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, '0');
    const day = String(hoy.getDate()).padStart(2, '0');
    this.maxDate = `${year}-${month}-${day}`;

    console.log('Fecha máxima configurada:', this.maxDate);
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

  // Métodos para el datepicker moderno
  toggleDatepicker(): void {
    this.showDatepicker = !this.showDatepicker;
  }

  closeDatepicker(): void {
    this.showDatepicker = false;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.showDatepicker) {
      this.closeDatepicker();
    }
  }

  aplicarFechas(): void {
    this.closeDatepicker();
    this.filtrarVentas(); // Filtro automático
  }

  setRangoPreset(tipo: string): void {
    const hoy = new Date();
    let fechaDesde = new Date();
    let fechaHasta = new Date();

    // Establecer el preset activo
    this.presetActivo = tipo;

    switch (tipo) {
      case 'hoy':
        this.filtros.fechaDesde = hoy.toISOString().split('T')[0];
        this.filtros.fechaHasta = hoy.toISOString().split('T')[0];
        break;

      case 'ayer':
        fechaDesde.setDate(hoy.getDate() - 1);
        this.filtros.fechaDesde = fechaDesde.toISOString().split('T')[0];
        this.filtros.fechaHasta = fechaDesde.toISOString().split('T')[0];
        break;

      case 'semana':
        const diaSemana = hoy.getDay();
        const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;

        fechaDesde = new Date(hoy);
        fechaDesde.setDate(hoy.getDate() + diffLunes);

        fechaHasta = new Date(fechaDesde);
        fechaHasta.setDate(fechaDesde.getDate() + 6);

        this.filtros.fechaDesde = fechaDesde.toISOString().split('T')[0];
        this.filtros.fechaHasta = fechaHasta.toISOString().split('T')[0];
        break;

      case 'semana_pasada':
        const diaSemanaActual = hoy.getDay();
        const diffLunesPasado = diaSemanaActual === 0 ? -13 : -6 - diaSemanaActual;

        fechaDesde = new Date(hoy);
        fechaDesde.setDate(hoy.getDate() + diffLunesPasado);

        fechaHasta = new Date(fechaDesde);
        fechaHasta.setDate(fechaDesde.getDate() + 6);

        this.filtros.fechaDesde = fechaDesde.toISOString().split('T')[0];
        this.filtros.fechaHasta = fechaHasta.toISOString().split('T')[0];
        break;

      case 'mes':
        fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        fechaHasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

        this.filtros.fechaDesde = fechaDesde.toISOString().split('T')[0];
        this.filtros.fechaHasta = fechaHasta.toISOString().split('T')[0];
        break;

      case 'mes_pasado':
        fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        fechaHasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);

        this.filtros.fechaDesde = fechaDesde.toISOString().split('T')[0];
        this.filtros.fechaHasta = fechaHasta.toISOString().split('T')[0];
        break;

      case 'trimestre':
        const trimestreActual = Math.floor(hoy.getMonth() / 3);
        const mesInicioTrimestre = trimestreActual * 3;
        const mesFinTrimestre = mesInicioTrimestre + 2;

        fechaDesde = new Date(hoy.getFullYear(), mesInicioTrimestre, 1);
        fechaHasta = new Date(hoy.getFullYear(), mesFinTrimestre + 1, 0);

        this.filtros.fechaDesde = fechaDesde.toISOString().split('T')[0];
        this.filtros.fechaHasta = fechaHasta.toISOString().split('T')[0];
        break;
    }

    this.fechaUnica = '';
    this.filtrarVentas();
  }

  limpiarFechas(): void {
    this.filtros.fechaDesde = '';
    this.filtros.fechaHasta = '';
    this.fechaUnica = '';
    this.presetActivo = '';
    this.filtrarVentas();
  }

  onRangoChange(): void {
    this.presetActivo = '';
  }

  onFechaUnicaChange(): void {
    this.presetActivo = '';

    if (this.fechaUnica) {
      // Validar que la fecha no sea futura (comparación directa de strings YYYY-MM-DD)
      const hoy = new Date().toISOString().split('T')[0];

      if (this.fechaUnica > hoy) {
        // Si es fecha futura, resetear
        this.fechaUnica = '';
        this.filtros.fechaDesde = '';
        this.filtros.fechaHasta = '';
        alert('No puedes seleccionar fechas futuras');
        return;
      }

      // Si la fecha es válida, establecer el rango
      this.filtros.fechaDesde = this.fechaUnica;
      this.filtros.fechaHasta = this.fechaUnica;

      // Filtrar automáticamente
      this.filtrarVentas();
    } else {
      // Si se limpia la fecha única, limpiar también los filtros
      this.filtros.fechaDesde = '';
      this.filtros.fechaHasta = '';
      this.filtrarVentas();
    }
  }

  getFechaDisplay(): string {
    if (this.fechaUnica) {
      return this.formatFechaLocal(this.fechaUnica);
    } else if (this.filtros.fechaDesde && this.filtros.fechaHasta) {
      if (this.filtros.fechaDesde === this.filtros.fechaHasta) {
        return this.formatFechaLocal(this.filtros.fechaDesde);
      } else {
        return `${this.formatFechaLocal(this.filtros.fechaDesde)} - ${this.formatFechaLocal(this.filtros.fechaHasta)}`;
      }
    } else {
      return 'Seleccionar fecha';
    }
  }
  private formatFechaLocal(fechaString: string): string {
    if (!fechaString) return '';

    const [year, month, day] = fechaString.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  cargarVentas() {
    // Ejemplo de datos temporales con acentos y caracteres especiales
    this.ventasOriginales = [
      {
        id: 1,
        numeroControl: '001',
        paciente: {
          nombre: 'Juan Pérez Martínez',
          cedula: '12345678'
        },
        fecha: new Date(),
        estado: 'completada',
        montoTotal: 100,
        asesor: { id: 1, nombre: 'Ana García' },
        especialista: { id: 1, nombre: 'Dr. Pérez' },
        servicios: [{ nombre: 'Consulta' }],
        metodosPago: [
          { tipo: 'efectivo', monto: 100, conversionBs: 200 }
        ],
        mostrarDetalle: false
      },
      {
        id: 2,
        numeroControl: '002',
        paciente: {
          nombre: 'María López Gutiérrez',
          cedula: '87654321'
        },
        fecha: new Date(),
        estado: 'cancelada',
        montoTotal: 150,
        asesor: { id: 2, nombre: 'Carlos López' },
        especialista: { id: 2, nombre: 'Dra. Martínez' },
        servicios: [{ nombre: 'Examen' }],
        metodosPago: [
          { tipo: 'debito', monto: 150, conversionBs: 300 }
        ],
        mostrarDetalle: false
      },
      {
        id: 3,
        numeroControl: '003',
        paciente: {
          nombre: 'José Ramírez Niño',
          cedula: '11223344'
        },
        fecha: new Date(),
        estado: 'completada',
        montoTotal: 200,
        asesor: { id: 3, nombre: 'María Rodríguez' },
        especialista: { id: 3, nombre: 'Dr. González' },
        servicios: [{ nombre: 'Cirugía' }],
        metodosPago: [
          { tipo: 'credito', monto: 200, conversionBs: 400 }
        ],
        mostrarDetalle: false
      }
    ];

    this.ventasFiltradas = [...this.ventasOriginales];
    this.totalVentas = this.ventasFiltradas.length;
    this.totalPaginas = Math.ceil(this.totalVentas / this.itemsPorPagina);
  }

  // Filtrado automático cuando cambian los inputs
  onFiltroChange(): void {
    this.filtrarVentas();
  }

  // Función para normalizar texto (eliminar acentos y convertir a minúsculas)
  private normalizarTexto(texto: string): string {
    if (!texto) return '';

    return texto
      .toLowerCase()
      .normalize('NFD') // Descompone los caracteres acentuados
      .replace(/[\u0300-\u036f]/g, ''); // Elimina los diacríticos
  }

  private filtrarVentas(): void {
    this.ventasFiltradas = this.ventasOriginales.filter(venta => {
      // Filtro de búsqueda general (paciente, cédula, número de control)
      const coincideBusqueda = !this.filtros.busquedaGeneral ||
        this.normalizarTexto(venta.paciente?.nombre).includes(this.normalizarTexto(this.filtros.busquedaGeneral)) ||
        venta.paciente?.cedula?.includes(this.filtros.busquedaGeneral) ||
        venta.numeroControl?.toString().includes(this.filtros.busquedaGeneral);

      // Filtro de asesor
      const coincideAsesor = !this.filtros.asesor || venta.asesor?.id == this.filtros.asesor;

      // Filtro de especialista
      const coincideEspecialista = !this.filtros.especialista || venta.especialista?.id == this.filtros.especialista;

      // Filtro de estado
      const coincideEstado = !this.filtros.estado || venta.estado === this.filtros.estado;

      // Filtro de fechas
      let coincideFechas = true;
      if (this.filtros.fechaDesde || this.filtros.fechaHasta) {
        const fechaVenta = new Date(venta.fecha);
        const desde = this.filtros.fechaDesde ? new Date(this.filtros.fechaDesde) : null;
        const hasta = this.filtros.fechaHasta ? new Date(this.filtros.fechaHasta) : null;

        if (desde && fechaVenta < desde) coincideFechas = false;
        if (hasta && fechaVenta > hasta) coincideFechas = false;
      }

      return coincideBusqueda && coincideAsesor && coincideEspecialista &&
        coincideEstado && coincideFechas;
    });

    this.totalVentas = this.ventasFiltradas.length;
    this.totalPaginas = Math.ceil(this.totalVentas / this.itemsPorPagina);
    this.paginaActual = 1; // Resetear a primera página al filtrar
  }

  // Agrega estos métodos a tu componente existente

  // Método para cambiar items por página
  cambiarItemsPorPagina(): void {
    this.paginaActual = 1; // Volver a la primera página
    this.totalPaginas = Math.ceil(this.totalVentas / this.itemsPorPagina);
    // Si estás cargando datos paginados del backend, aquí harías la llamada
  }

  // Método mejorado para obtener rango de páginas (más inteligente)
  getRangoPaginas(): number[] {
    this.totalPaginas = Math.ceil(this.totalVentas / this.itemsPorPagina);

    // Si hay pocas páginas, mostrar todas
    if (this.totalPaginas <= 7) {
      return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
    }

    // Lógica para páginas largas (mostrar primera, última y alrededor de la actual)
    const paginas: number[] = [];
    const paginaInicio = Math.max(2, this.paginaActual - 1);
    const paginaFin = Math.min(this.totalPaginas - 1, this.paginaActual + 1);

    // Siempre primera página
    paginas.push(1);

    // Agregar puntos suspensivos si es necesario
    if (paginaInicio > 2) {
      paginas.push(-1); // -1 representa "..."
    }

    // Agregar páginas alrededor de la actual
    for (let i = paginaInicio; i <= paginaFin; i++) {
      paginas.push(i);
    }

    // Agregar puntos suspensivos si es necesario
    if (paginaFin < this.totalPaginas - 1) {
      paginas.push(-1); // -1 representa "..."
    }

    // Siempre última página
    if (this.totalPaginas > 1) {
      paginas.push(this.totalPaginas);
    }

    return paginas;
  }

  // Método para obtener el texto de la página
  getPaginaTexto(pagina: number): string {
    return pagina === -1 ? '...' : pagina.toString();
  }

  // Método para verificar si es puntos suspensivos
  esPuntosSuspensivos(pagina: number): boolean {
    return pagina === -1;
  }

  limpiarFiltros() {
    this.filtros = {
      busquedaGeneral: '',
      asesor: '',
      especialista: '',
      fechaDesde: '',
      fechaHasta: '',
      estado: ''
    };
    this.fechaUnica = '';
    this.filtrarVentas();
  }

  cambiarOrden() {
    this.ordenamiento.ascendente = !this.ordenamiento.ascendente;
    // Lógica para reordenar las ventas
    this.ventasFiltradas.sort((a, b) => {
      const factor = this.ordenamiento.ascendente ? 1 : -1;

      switch (this.ordenamiento.campo) {
        case 'fecha':
          return (new Date(a.fecha).getTime() - new Date(b.fecha).getTime()) * factor;
        case 'numeroControl':
          return (a.numeroControl - b.numeroControl) * factor;
        case 'montoTotal':
          return (a.montoTotal - b.montoTotal) * factor;
        case 'paciente':
          return a.paciente.nombre.localeCompare(b.paciente.nombre) * factor;
        default:
          return 0;
      }
    });
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
  }

  verDetalleCompleto(venta: any) {
    console.log('Ver detalle completo:', venta);
    // Lógica para mostrar detalle completo
  }

  cancelarVenta(venta: any) {
    console.log('Cancelar venta:', venta);
    if (confirm('¿Está seguro de que desea cancelar esta venta?')) {
      venta.estado = 'cancelada';
    }
  }

  generarInforme() {
    console.log('Generar informe con filtros:', this.filtros);
    // Lógica para generar informe
  }

  // Método auxiliar para formatear el nombre (opcional)
  getNombreFormateado(nombreCompleto: string): string {
    if (!nombreCompleto) return '';

    // Divide el nombre completo en partes
    const partes = nombreCompleto.split(' ');

    // Toma el primer nombre y el último apellido
    if (partes.length >= 2) {
      const primerNombre = partes[0];
      const ultimoApellido = partes[partes.length - 1];
      return `${primerNombre} ${ultimoApellido}`;
    }

    return nombreCompleto;
  }

  cambiarPagina(pagina: number) {
    const totalPaginas = this.getRangoPaginas().length;
    if (pagina >= 1 && pagina <= totalPaginas) {
      this.paginaActual = pagina;
    }
  }

  // Método auxiliar para obtener el texto del estado
  getEstadoTexto(estado: string): string {
    const estados = {
      'completada': '✅ Completada',
      'cancelada': '❌ Cancelada'
    };
    return estados[estado] || estado;
  }

  // Método auxiliar para obtener la clase CSS del estado
  getEstadoClase(estado: string): string {
    const clases = {
      'completada': 'bg-success',
      'cancelada': 'bg-danger'
    };
    return clases[estado] || 'bg-secondary';
  }
}