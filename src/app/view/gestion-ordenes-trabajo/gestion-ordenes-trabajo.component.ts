import { Component, OnInit } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-gestion-ordenes-trabajo',
  standalone: false,
  templateUrl: './gestion-ordenes-trabajo.component.html',
  styleUrls: ['./gestion-ordenes-trabajo.component.scss']
})
export class GestionOrdenesTrabajoComponent implements OnInit {
  // Filtros
  filtroBusqueda: string = '';
  filtroEstado: string = '';

  // Variables para el nuevo sistema
  maxOrdenesPorColumna: number = 2;
  mostrarArchivo: boolean = false;
  tabActiva: string = 'entregados';
  mostrarModalArchivo: boolean = false;
  ordenesArchivadas: any[] = [];
  filtroArchivo: string = '';
  ordenesFiltradasArchivadas: any[] = [];
  diasParaAutoArchivo: number = 30;
  mostrarModalOrdenes: boolean = false;
  ordenesModal: any[] = [];
  tituloModalOrdenes: string = '';
  estadoModalActual: string = '';

  // Datos de ejemplo
  todasLasOrdenes: any[] = [
    {
      id: 1,
      codigo: 'OT-2024-001',
      clienteNombre: 'María González',
      clienteTelefono: '0412-1234567',
      productoNombre: 'Lente progresivo Essilor',
      estado: 'en_tienda',
      prioridad: 'alta',
      fechaCreacion: new Date('2024-01-15'),
      fechaEntregaEstimada: new Date('2024-01-25'),
      diasRestantes: 5,
      progreso: 0,
      tecnicoAsignado: '',
      fechaInicioProceso: null,
      fechaTerminacion: null,
      fechaRecepcionTienda: null,
      fechaEntrega: null,
      diasEnEspera: 0,
      ventaId: 'V-000001',
      entregadoPor: '',
      archivada: false,
      formulacion: {
        esferaOD: '+1.50',
        esferaOI: '+1.75',
        cilindroOD: '-0.50',
        cilindroOI: '-0.75',
        ejeOD: '90',
        ejeOI: '85',
        adicion: '+2.00'
      }
    },
    {
      id: 2,
      codigo: 'OT-2024-002',
      clienteNombre: 'Carlos Rodríguez Pérez del Valle',
      clienteTelefono: '0414-9876543',
      productoNombre: 'Lente fotocromático Transitions XTRActive',
      estado: 'proceso_laboratorio',
      prioridad: 'media',
      fechaCreacion: new Date('2024-01-10'),
      fechaEntregaEstimada: new Date('2024-01-20'),
      diasRestantes: 3,
      progreso: 60,
      tecnicoAsignado: 'Juan Pérez Martínez',
      fechaInicioProceso: new Date('2024-01-12'),
      fechaTerminacion: null,
      fechaRecepcionTienda: null,
      fechaEntrega: null,
      diasEnEspera: 0,
      ventaId: 'V-000002',
      entregadoPor: '',
      archivada: false
    },
    {
      id: 3,
      codigo: 'OT-2024-003',
      clienteNombre: 'Ana Martínez',
      clienteTelefono: '0416-5558888',
      productoNombre: 'Lente antireflejo Crizal',
      estado: 'listo_laboratorio',
      prioridad: 'baja',
      fechaCreacion: new Date('2024-01-05'),
      fechaEntregaEstimada: new Date('2024-01-15'),
      diasRestantes: 0,
      progreso: 100,
      tecnicoAsignado: 'Pedro Sánchez',
      fechaInicioProceso: new Date('2024-01-07'),
      fechaTerminacion: new Date('2024-01-12'),
      fechaRecepcionTienda: null,
      fechaEntrega: null,
      diasEnEspera: 0,
      ventaId: 'V-000003',
      entregadoPor: '',
      archivada: false
    },
    {
      id: 4,
      codigo: 'OT-2024-004',
      clienteNombre: 'Luis Fernández',
      clienteTelefono: '0424-3337777',
      productoNombre: 'Armazón Ray-Ban + Lentes',
      estado: 'pendiente_retiro',
      prioridad: 'media',
      fechaCreacion: new Date('2024-01-03'),
      fechaEntregaEstimada: new Date('2024-01-10'),
      diasRestantes: -2,
      progreso: 100,
      tecnicoAsignado: 'María Gómez',
      fechaInicioProceso: new Date('2024-01-04'),
      fechaTerminacion: new Date('2024-01-08'),
      fechaRecepcionTienda: new Date('2024-01-09'),
      fechaEntrega: null,
      diasEnEspera: 4,
      ventaId: 'V-000004',
      entregadoPor: '',
      archivada: false
    },
    {
      id: 5,
      codigo: 'OT-2024-005',
      clienteNombre: 'Ana Rodríguez',
      clienteTelefono: '0424-5556677',
      productoNombre: 'Lente Blue Light Filter',
      estado: 'entregado',
      prioridad: 'media',
      fechaCreacion: new Date('2024-01-05'),
      fechaEntregaEstimada: new Date('2024-01-15'),
      diasRestantes: 0,
      progreso: 100,
      tecnicoAsignado: 'Luis Gómez',
      fechaInicioProceso: new Date('2024-01-07'),
      fechaTerminacion: new Date('2024-01-10'),
      fechaRecepcionTienda: new Date('2024-01-11'),
      fechaEntrega: new Date('2024-01-12'),
      diasEnEspera: 1,
      ventaId: 'V-000005',
      entregadoPor: 'María Pérez',
      archivada: false,
      fechaArchivado: null,
      motivoArchivo: null
    },
    {
      id: 6,
      codigo: 'OT-2024-006',
      clienteNombre: 'Roberto Vargas',
      clienteTelefono: '0412-9998888',
      productoNombre: 'Lente fotosensible',
      estado: 'en_tienda',
      prioridad: 'alta',
      fechaCreacion: new Date('2024-01-18'),
      fechaEntregaEstimada: new Date('2024-01-28'),
      diasRestantes: 8,
      progreso: 0,
      tecnicoAsignado: '',
      fechaInicioProceso: null,
      fechaTerminacion: null,
      fechaRecepcionTienda: null,
      fechaEntrega: null,
      diasEnEspera: 0,
      ventaId: 'V-000006',
      entregadoPor: '',
      archivada: false
    },
    {
      id: 7,
      codigo: 'OT-2024-007',
      clienteNombre: 'Carmen Silva',
      clienteTelefono: '0426-7775555',
      productoNombre: 'Lente bifocal',
      estado: 'proceso_laboratorio',
      prioridad: 'media',
      fechaCreacion: new Date('2024-01-16'),
      fechaEntregaEstimada: new Date('2024-01-26'),
      diasRestantes: 6,
      progreso: 40,
      tecnicoAsignado: 'Carlos Ruiz',
      fechaInicioProceso: new Date('2024-01-17'),
      fechaTerminacion: null,
      fechaRecepcionTienda: null,
      fechaEntrega: null,
      diasEnEspera: 0,
      ventaId: 'V-000007',
      entregadoPor: '',
      archivada: false
    }
  ];

  // Arrays para cada columna
  ordenesEnTienda: any[] = [];
  ordenesEnProceso: any[] = [];
  ordenesListasLaboratorio: any[] = [];
  ordenesPendienteRetiro: any[] = [];
  ordenesEntregadas: any[] = [];

  // Estadísticas
  estadisticas = {
    enTienda: 0,
    enProceso: 0,
    listoLaboratorio: 0,
    pendienteRetiro: 0,
    total: 0
  };

  // Modal
  mostrarModalDetalle: boolean = false;
  ordenSeleccionada: any = null;

  ngOnInit() {
    this.cargarOrdenes();
    this.calcularEstadisticas();

    // Verificar auto-archivo cada 24 horas (simulado para demo)
    // En producción, usaría setInterval o un servicio
    this.verificarAutoArchivo();
  }

  // 🔥 NUEVO: Método para ver órdenes en modal
  verOrdenesEnModal(ordenes: any[], titulo: string, estado: string) {
    this.ordenesModal = [...ordenes];
    this.tituloModalOrdenes = titulo;
    this.estadoModalActual = estado;
    this.mostrarModalOrdenes = true;
  }

  // 🔥 NUEVO: Método para cerrar modal de órdenes
  cerrarModalOrdenes() {
    this.mostrarModalOrdenes = false;
    this.ordenesModal = [];
    this.tituloModalOrdenes = '';
    this.estadoModalActual = '';
  }

  // 🔥 NUEVO: Método para ver todas las órdenes de un estado
  verTodasOrdenes(estado: string) {
    const ordenes = this.getOrdenesPorEstado(estado);
    const titulo = `Todas las órdenes - ${this.getEstadoTexto(estado)}`;
    this.verOrdenesEnModal(ordenes, titulo, estado);
  }

  truncarTexto(texto: string, maxCaracteres: number): string {
    if (!texto) return '';

    if (texto.length <= maxCaracteres) {
      return texto;
    }

    const textoTruncado = texto.substr(0, maxCaracteres);
    const ultimoEspacio = textoTruncado.lastIndexOf(' ');

    if (ultimoEspacio > maxCaracteres * 0.7) {
      return textoTruncado.substr(0, ultimoEspacio) + '...';
    }

    return textoTruncado + '...';
  }

  cargarOrdenes() {
    this.ordenesEnTienda = this.todasLasOrdenes.filter(o => o.estado === 'en_tienda');
    this.ordenesEnProceso = this.todasLasOrdenes.filter(o => o.estado === 'proceso_laboratorio');
    this.ordenesListasLaboratorio = this.todasLasOrdenes.filter(o => o.estado === 'listo_laboratorio');
    this.ordenesPendienteRetiro = this.todasLasOrdenes.filter(o => o.estado === 'pendiente_retiro');
    this.ordenesEntregadas = this.todasLasOrdenes.filter(o => o.estado === 'entregado');

    this.calcularDias();
  }

  calcularDias() {
    const hoy = new Date();

    this.todasLasOrdenes.forEach(orden => {
      if (orden.fechaEntregaEstimada) {
        const diff = Math.ceil((orden.fechaEntregaEstimada.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        orden.diasRestantes = diff;
      }

      if (orden.estado === 'pendiente_retiro' && orden.fechaRecepcionTienda) {
        const diff = Math.ceil((hoy.getTime() - orden.fechaRecepcionTienda.getTime()) / (1000 * 60 * 60 * 24));
        orden.diasEnEspera = diff;
      }
    });
  }

  calcularEstadisticas() {
    this.estadisticas.enTienda = this.ordenesEnTienda.length;
    this.estadisticas.enProceso = this.ordenesEnProceso.length;
    this.estadisticas.listoLaboratorio = this.ordenesListasLaboratorio.length;
    this.estadisticas.pendienteRetiro = this.ordenesPendienteRetiro.length;
    this.estadisticas.total = this.todasLasOrdenes.length;
  }

  aplicarFiltros() {
    let ordenesFiltradas = [...this.todasLasOrdenes];

    if (this.filtroBusqueda) {
      const busqueda = this.filtroBusqueda.toLowerCase();
      ordenesFiltradas = ordenesFiltradas.filter(orden =>
        orden.codigo.toLowerCase().includes(busqueda) ||
        orden.clienteNombre.toLowerCase().includes(busqueda) ||
        orden.productoNombre.toLowerCase().includes(busqueda) ||
        orden.ventaId.toLowerCase().includes(busqueda)
      );
    }

    if (this.filtroEstado) {
      ordenesFiltradas = ordenesFiltradas.filter(orden => orden.estado === this.filtroEstado);
    }

    this.ordenesEnTienda = ordenesFiltradas.filter(o => o.estado === 'en_tienda');
    this.ordenesEnProceso = ordenesFiltradas.filter(o => o.estado === 'proceso_laboratorio');
    this.ordenesListasLaboratorio = ordenesFiltradas.filter(o => o.estado === 'listo_laboratorio');
    this.ordenesPendienteRetiro = ordenesFiltradas.filter(o => o.estado === 'pendiente_retiro');
    this.ordenesEntregadas = ordenesFiltradas.filter(o => o.estado === 'entregado');

    this.calcularEstadisticas();
  }

  // 🔥 NUEVO: Mover todos los pedidos de una columna
  moverTodos(ordenes: any[], estadoActual: string, nuevoEstado: string) {
    if (ordenes.length === 0) return;

    const mensajes: { [key: string]: string } = {
      'en_tienda': '¿Mover todas las órdenes de "En Tienda" a "En Laboratorio"?',
      'proceso_laboratorio': '¿Marcar todas las órdenes como "Listo en Laboratorio"?',
      'listo_laboratorio': '¿Enviar todas las órdenes a "Pendiente por Retirar"?',
      'pendiente_retiro': '¿Marcar todas las órdenes como "Entregadas"?'
    };

    if (confirm(mensajes[estadoActual] || `¿Mover todas las órdenes a ${this.getEstadoTexto(nuevoEstado)}?`)) {
      const ordenesACopiar = [...ordenes];

      ordenesACopiar.forEach(orden => {
        this.cambiarEstado(orden, nuevoEstado);
      });

      alert(`✅ ${ordenes.length} órdenes movidas a ${this.getEstadoTexto(nuevoEstado)}`);
    }
  }

  // Drag & Drop
  drop(event: CdkDragDrop<any[]>, nuevoEstado: string) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );

      const ordenMovida = event.container.data[event.currentIndex];
      ordenMovida.estado = nuevoEstado;
      this.actualizarFechasPorEstado(ordenMovida, nuevoEstado, ordenMovida.estado);

      this.calcularEstadisticas();
    }
  }

  actualizarFechasPorEstado(orden: any, nuevoEstado: string, estadoAnterior?: string) {
    const hoy = new Date();

    switch (nuevoEstado) {
      case 'proceso_laboratorio':
        orden.fechaInicioProceso = hoy;
        orden.progreso = 10;
        break;

      case 'listo_laboratorio':
        orden.fechaTerminacion = hoy;
        orden.progreso = 100;
        break;

      case 'pendiente_retiro':
        orden.fechaRecepcionTienda = hoy;
        orden.diasEnEspera = 0;
        break;

      case 'entregado':
        orden.fechaEntrega = hoy;
        orden.entregadoPor = 'Usuario Actual';
        break;
    }
  }

  getEstadoTexto(estado: string): string {
    const estados: { [key: string]: string } = {
      'en_tienda': 'En Tienda',
      'proceso_laboratorio': 'En Laboratorio',
      'listo_laboratorio': 'Listo en Laboratorio',
      'pendiente_retiro': 'Pendiente por Retirar',
      'entregado': 'Entregado'
    };

    return estados[estado] || estado;
  }

  getOrdenesPorEstado(estado: string): any[] {
    switch (estado) {
      case 'en_tienda': return this.ordenesEnTienda;
      case 'proceso_laboratorio': return this.ordenesEnProceso;
      case 'listo_laboratorio': return this.ordenesListasLaboratorio;
      case 'pendiente_retiro': return this.ordenesPendienteRetiro;
      case 'entregado': return this.ordenesEntregadas;
      default: return [];
    }
  }

  getPrioridadTexto(prioridad: string): string {
    switch (prioridad) {
      case 'alta': return 'Alta';
      case 'media': return 'Media';
      case 'baja': return 'Baja';
      default: return 'Normal';
    }
  }

  calcularDiasDesde(fecha: Date): number {
    if (!fecha) return 0;
    const hoy = new Date();
    const diff = Math.ceil((hoy.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  // 🔥 NUEVO: Calcular días de duración
  calcularDiasDuracion(orden: any): number {
    if (!orden.fechaCreacion || !orden.fechaEntrega) return 0;
    const diff = Math.ceil(
      (orden.fechaEntrega.getTime() - orden.fechaCreacion.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff;
  }

  cambiarEstado(orden: any, nuevoEstado: string) {
    if (nuevoEstado === 'entregado') {
      if (!confirm(`¿Confirmar entrega de la orden ${orden.codigo} a ${orden.clienteNombre}?`)) {
        return;
      }
    }

    this.removerDeColumnaActual(orden);

    const estadoAnterior = orden.estado;
    orden.estado = nuevoEstado;
    this.actualizarFechasPorEstado(orden, nuevoEstado, estadoAnterior);

    if (nuevoEstado !== 'entregado') {
      this.agregarAColumna(orden, nuevoEstado);
    } else {
      orden.fechaEntrega = new Date();
      orden.entregadoPor = 'Usuario Actual';
      console.log(`📦 Orden ${orden.codigo} marcada como entregada`);

      // Añadir a entregadas
      this.ordenesEntregadas.push(orden);
    }

    this.calcularEstadisticas();
  }

  removerDeColumnaActual(orden: any) {
    switch (orden.estado) {
      case 'en_tienda':
        this.ordenesEnTienda = this.ordenesEnTienda.filter(o => o.id !== orden.id);
        break;
      case 'proceso_laboratorio':
        this.ordenesEnProceso = this.ordenesEnProceso.filter(o => o.id !== orden.id);
        break;
      case 'listo_laboratorio':
        this.ordenesListasLaboratorio = this.ordenesListasLaboratorio.filter(o => o.id !== orden.id);
        break;
      case 'pendiente_retiro':
        this.ordenesPendienteRetiro = this.ordenesPendienteRetiro.filter(o => o.id !== orden.id);
        break;
      case 'entregado':
        this.ordenesEntregadas = this.ordenesEntregadas.filter(o => o.id !== orden.id);
        break;
    }
  }

  agregarAColumna(orden: any, estado: string) {
    switch (estado) {
      case 'en_tienda':
        this.ordenesEnTienda.push(orden);
        break;
      case 'proceso_laboratorio':
        this.ordenesEnProceso.push(orden);
        break;
      case 'listo_laboratorio':
        this.ordenesListasLaboratorio.push(orden);
        break;
      case 'pendiente_retiro':
        this.ordenesPendienteRetiro.push(orden);
        break;
      case 'entregado':
        this.ordenesEntregadas.push(orden);
        break;
    }
  }

  actualizarProgreso(orden: any) {
    const nuevoProgreso = prompt(`Ingrese el nuevo progreso para ${orden.codigo} (0-100):`, orden.progreso.toString());

    if (nuevoProgreso !== null) {
      const progreso = parseInt(nuevoProgreso);
      if (!isNaN(progreso) && progreso >= 0 && progreso <= 100) {
        orden.progreso = progreso;

        if (progreso === 100) {
          this.cambiarEstado(orden, 'listo_laboratorio');
        }
      }
    }
  }

  // 🔥 NUEVO: Método actualizado para entregas individuales
  marcarComoEntregado(orden: any) {
    this.cambiarEstado(orden, 'entregado');
  }

  notificarCliente(orden: any) {
    const mensaje = `Estimado(a) ${orden.clienteNombre}, su orden ${orden.codigo} está lista para ser retirada. ¡Esperamos por usted!`;

    if (confirm(`¿Enviar notificación a ${orden.clienteNombre}?\n\n${mensaje}`)) {
      console.log('📱 Notificación enviada:', mensaje);
      alert('✅ Notificación enviada al cliente.');
    }
  }

  // 🔥 NUEVO: Generar factura
  generarFactura(orden: any) {
    console.log('🧾 Generando factura para:', orden.codigo);
    alert(`Factura generada para orden ${orden.codigo}`);
  }

  // 🔥 NUEVO: Archivar orden
  archivarOrden(orden: any, automatico: boolean = false) {
    if (!automatico && !confirm(`¿Archivar la orden ${orden.codigo}?`)) {
      return;
    }

    orden.fechaArchivado = new Date();
    orden.archivada = true;
    orden.motivoArchivo = automatico ? 'Auto-archivado por tiempo' : 'Archivado manual';

    // Remover de entregadas
    this.ordenesEntregadas = this.ordenesEntregadas.filter(o => o.id !== orden.id);

    // Agregar a archivadas
    this.ordenesArchivadas.push(orden);

    console.log(`📁 ${automatico ? 'Auto-archivada' : 'Archivada'}:`, orden.codigo);

    if (!automatico) {
      alert(`Orden ${orden.codigo} archivada correctamente.`);
    }
  }

  // 🔥 NUEVO: Verificar auto-archivado
  verificarAutoArchivo() {
    const hoy = new Date();
    const ordenesParaArchivar = this.ordenesEntregadas.filter(orden => {
      if (orden.archivada || !orden.fechaEntrega) return false;

      const diasDesdeEntrega = Math.ceil(
        (hoy.getTime() - orden.fechaEntrega.getTime()) / (1000 * 60 * 60 * 24)
      );

      return diasDesdeEntrega >= this.diasParaAutoArchivo;
    });

    ordenesParaArchivar.forEach(orden => {
      this.archivarOrden(orden, true);
    });

    if (ordenesParaArchivar.length > 0) {
      console.log(`🔄 ${ordenesParaArchivar.length} órdenes auto-archivadas`);
    }
  }

  // 🔥 NUEVO: Configurar días para auto-archivar
  configurarDiasAutoArchivo() {
    const dias = prompt(
      'Configurar días para auto-archivar órdenes entregadas:',
      this.diasParaAutoArchivo.toString()
    );

    if (dias !== null) {
      const numDias = parseInt(dias);
      if (!isNaN(numDias) && numDias > 0) {
        this.diasParaAutoArchivo = numDias;
        alert(`Auto-archivo configurado a ${numDias} días después de entrega.`);

        // Aplicar inmediatamente
        this.verificarAutoArchivo();
      }
    }
  }

  // 🔥 NUEVO: Abrir modal de archivo
  abrirModalArchivo() {
    this.mostrarModalArchivo = true;
    this.filtrarArchivadas();
  }

  // 🔥 NUEVO: Filtrar archivadas
  filtrarArchivadas() {
    if (!this.filtroArchivo) {
      this.ordenesFiltradasArchivadas = [...this.ordenesArchivadas];
      return;
    }

    const busqueda = this.filtroArchivo.toLowerCase();
    this.ordenesFiltradasArchivadas = this.ordenesArchivadas.filter(orden =>
      orden.codigo.toLowerCase().includes(busqueda) ||
      orden.clienteNombre.toLowerCase().includes(busqueda) ||
      orden.productoNombre.toLowerCase().includes(busqueda) ||
      orden.motivoArchivo?.toLowerCase().includes(busqueda)
    );
  }

  // 🔥 NUEVO: Restaurar orden desde archivo
  restaurarOrden(orden: any) {
    if (confirm(`¿Restaurar la orden ${orden.codigo} a "Entregados"?`)) {
      orden.archivada = false;
      orden.fechaArchivado = null;
      orden.motivoArchivo = null;

      this.ordenesArchivadas = this.ordenesArchivadas.filter(o => o.id !== orden.id);
      this.ordenesEntregadas.push(orden);

      this.filtrarArchivadas();
      alert(`Orden ${orden.codigo} restaurada correctamente.`);
    }
  }

  // Modal
  verDetalleOrden(orden: any) {
    this.ordenSeleccionada = orden;
    this.mostrarModalDetalle = true;
  }

  cerrarModalDetalle() {
    this.mostrarModalDetalle = false;
    this.ordenSeleccionada = null;
  }

  onEstadoCambiado(ordenActualizada: any) {
    const index = this.todasLasOrdenes.findIndex(o => o.id === ordenActualizada.id);
    if (index !== -1) {
      this.todasLasOrdenes[index] = ordenActualizada;
    }

    this.cargarOrdenes();
    this.calcularEstadisticas();
    this.cerrarModalDetalle();
  }

  recargarOrdenes() {
    this.cargarOrdenes();
    this.calcularEstadisticas();
    console.log('🔄 Órdenes recargadas');
  }

  exportarReporte() {
    console.log('📊 Exportando reporte...');
    alert('🚀 Funcionalidad de exportación en desarrollo');
  }

  generarReporte() {
    console.log('🖨️ Generando reporte PDF...');
    alert('🚀 Funcionalidad de reporte PDF en desarrollo');
  }

  // 🔥 NUEVO: Método para obtener siguiente estado
  getNextEstado(estadoActual: string): string {
    const flujo: { [key: string]: string } = {
      'en_tienda': 'proceso_laboratorio',
      'proceso_laboratorio': 'listo_laboratorio',
      'listo_laboratorio': 'pendiente_retiro',
      'pendiente_retiro': 'entregado'
    };

    return flujo[estadoActual] || estadoActual;
  }
}