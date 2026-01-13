import { Component, OnInit } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { OrdenesTrabajoService } from './gestion-ordenes-trabajo.service';
import { OrdenTrabajo, OrdenesTrabajoResponse, EstadoOrden } from './gestion-ordenes-trabajo.model';
import { LoaderService } from './../../shared/loader/loader.service';
import { SwalService } from '../../core/services/swal/swal.service';

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
  filtroArchivo: string = '';
  ordenesFiltradasArchivadas: any[] = [];
  diasParaAutoArchivo: number = 30;
  mostrarModalOrdenes: boolean = false;
  ordenesModal: any[] = [];
  tituloModalOrdenes: string = '';
  estadoModalActual: string = '';

  // Datos de ejemplo
  todasLasOrdenes: OrdenTrabajo[] = [];

  // Agregar estas propiedades
  cargandoOrdenes: boolean = false;
  errorCargaOrdenes: string = '';

  // Arrays para cada columna
  ordenesEnTienda: OrdenTrabajo[] = [];
  ordenesEnProceso: OrdenTrabajo[] = [];
  ordenesListasLaboratorio: OrdenTrabajo[] = [];
  ordenesPendienteRetiro: OrdenTrabajo[] = [];
  ordenesEntregadas: OrdenTrabajo[] = [];
  ordenesArchivadas: OrdenTrabajo[] = [];

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
  ordenSeleccionada: OrdenTrabajo | null = null;

  // Modal para configurar fecha de entrega
  mostrarModalConfigurarFecha: boolean = false;
  ordenParaConfigurarFecha: OrdenTrabajo | null = null;
  diasParaFechaEntrega: number = 7; // Valor por defecto
  fechaCalculada: Date | null = null;

  // Agrega estas propiedades al componente
  filtroModal: string = '';
  filtroPrioridadModal: string = '';
  ordenModal: string = 'fechaCreacion_desc';
  ordenesModalFiltradas: any[] = [];
  paginaActual: number = 0;
  tamanoPagina: number = 20; // Órdenes por página

  constructor(
    private ordenesTrabajoService: OrdenesTrabajoService,
    private loader: LoaderService,
    private swalService: SwalService,
    //private userStateService: UserStateService
  ) { }

  ngOnInit() {
    this.cargarOrdenesDesdeAPI('');
    this.calcularEstadisticas();
    this.verificarAutoArchivo();
    this.inicializarTooltips();
    this.loader.hide();
  }

  /**
   * Cargar órdenes desde el API
   */
  cargarOrdenesDesdeAPI(flowType): void {
    this.cargandoOrdenes = true;
    this.errorCargaOrdenes = '';

    if (flowType != 'refresh') this.loader.show();


    this.ordenesTrabajoService.getOrdenesTrabajo().subscribe({
      next: (response) => {
        this.cargandoOrdenes = false;
        if (response.message === 'ok' && response.ordenes_trabajo) {
          this.todasLasOrdenes = response.ordenes_trabajo;

          // Calcular campos dinámicos
          this.calcularCamposDinamicos();

          // Cargar en columnas
          this.cargarOrdenes();
          this.calcularEstadisticas();
          this.loader.hide();
        } else {
          this.errorCargaOrdenes = 'No se pudieron cargar las órdenes';
          console.error('Error en respuesta del API:', response);
        }
      },
      error: (error) => {
        this.cargandoOrdenes = false;
        this.errorCargaOrdenes = 'Error al conectar con el servidor';
        console.error('Error al cargar órdenes:', error);
      }
    });
  }

  /**
   * Cargar órdenes en columnas según estado
   */
  cargarOrdenes() {
    this.ordenesEnTienda = this.todasLasOrdenes.filter(o =>
      !o.archivado && o.estado === 'en_tienda'
    );
    this.ordenesEnProceso = this.todasLasOrdenes.filter(o =>
      !o.archivado && o.estado === 'proceso_laboratorio'
    );
    this.ordenesListasLaboratorio = this.todasLasOrdenes.filter(o =>
      !o.archivado && o.estado === 'listo_laboratorio'
    );
    this.ordenesPendienteRetiro = this.todasLasOrdenes.filter(o =>
      !o.archivado && o.estado === 'pendiente_retiro'
    );
    this.ordenesEntregadas = this.todasLasOrdenes.filter(o =>
      !o.archivado && o.estado === 'entregado'
    );
    this.ordenesArchivadas = this.todasLasOrdenes.filter(o =>
      o.archivado === true
    );
  }

  /**
   * Calcular todos los campos dinámicos
   */
  calcularCamposDinamicos(): void {
    const hoy = new Date();

    this.todasLasOrdenes.forEach(orden => {
      // Alias para compatibilidad con template
      orden.codigo = orden.ordenId;
      orden.clienteNombre = orden.cliente?.informacion?.nombreCompleto || '';
      orden.clienteTelefono = orden.cliente?.informacion?.telefono || '';
      orden.productoNombre = this.getProductoNombre(orden);

      // Asegurar que todas las órdenes tengan progreso
      if (orden.progreso === undefined || orden.progreso === null) {
        orden.progreso = this.calcularProgresoPorEstado(orden.estado);
      }

      // Recalcular días restantes
      this.recalcularDiasRestantes(orden);

      // Calcular días en espera para órdenes pendientes
      if (orden.estado === 'pendiente_retiro' && orden.fechaRecepcionTienda) {
        const fechaRecepcion = new Date(orden.fechaRecepcionTienda);
        orden.diasEnEspera = Math.ceil((hoy.getTime() - fechaRecepcion.getTime()) / (1000 * 60 * 60 * 24));
      }
    });
  }

  /**
   * Recalcular días restantes para una orden
   */
  recalcularDiasRestantes(orden: OrdenTrabajo) {
    if (!orden.fechaEntregaEstimada) {
      orden.diasRestantes = undefined;
      return;
    }

    try {
      // Parsear fecha ISO del backend
      const fechaEntregaUTC = new Date(orden.fechaEntregaEstimada);

      // Verificar que la fecha sea válida
      if (isNaN(fechaEntregaUTC.getTime())) {
        console.error('Fecha inválida:', orden.fechaEntregaEstimada);
        orden.diasRestantes = undefined;
        return;
      }

      // Fecha actual en UTC (para consistencia)
      const hoyUTC = new Date();
      const hoyMediodiaUTC = new Date(Date.UTC(
        hoyUTC.getUTCFullYear(),
        hoyUTC.getUTCMonth(),
        hoyUTC.getUTCDate(),
        12, 0, 0, 0
      ));

      // Fecha de entrega a mediodía UTC
      const fechaEntregaMediodiaUTC = new Date(Date.UTC(
        fechaEntregaUTC.getUTCFullYear(),
        fechaEntregaUTC.getUTCMonth(),
        fechaEntregaUTC.getUTCDate(),
        12, 0, 0, 0
      ));

      // Calcular diferencia en días
      const diferenciaMs = fechaEntregaMediodiaUTC.getTime() - hoyMediodiaUTC.getTime();
      const diasRestantes = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24));

      orden.diasRestantes = Math.max(0, diasRestantes);

      // Actualizar prioridad
      if (diasRestantes < 2) {
        orden.prioridad = 'alta';
      } else if (diasRestantes < 5) {
        orden.prioridad = 'media';
      } else {
        orden.prioridad = 'baja';
      }

      console.log('DEBUG - Recalcular días:', {
        fechaOriginal: orden.fechaEntregaEstimada,
        fechaEntregaUTC: fechaEntregaUTC.toISOString(),
        fechaEntregaLocal: fechaEntregaUTC.toLocaleDateString('es-VE'),
        hoyMediodiaUTC: hoyMediodiaUTC.toISOString(),
        diasRestantes: orden.diasRestantes,
        prioridad: orden.prioridad
      });

    } catch (error) {
      console.error('Error al recalcular días:', error);
      orden.diasRestantes = undefined;
    }
  }

  /**
   * Método para actualizar el estado de una orden en el API
   */
  actualizarEstadoOrdenAPI(orden: OrdenTrabajo, nuevoEstado: string): void {
    // Verificar que el estado sea válido
    const nuevoEstadoValido = this.asegurarEstadoOrden(nuevoEstado);

    // Usar la nueva API con orden_numero
    this.ordenesTrabajoService.cambiarEstadoOrden(orden.ordenId, nuevoEstadoValido).subscribe({
      next: (response) => {
        // Actualizar localmente
        orden.estado = nuevoEstadoValido;
        orden.progreso = this.calcularProgresoPorEstado(nuevoEstadoValido);

        // Actualizar fechas localmente
        switch (nuevoEstadoValido) {
          case 'proceso_laboratorio':
            orden.fechaInicioProceso = new Date().toISOString();
            break;
          case 'listo_laboratorio':
            orden.fechaTerminacion = new Date().toISOString();
            break;
          case 'pendiente_retiro':
            orden.fechaRecepcionTienda = new Date().toISOString();
            break;
          case 'entregado':
            orden.fechaEntrega = new Date().toISOString();
            break;
        }

        // Recargar la vista
        this.cargarOrdenes();
        this.calcularEstadisticas();
      },
      error: (error) => {
        console.error('Error al actualizar estado:', error);
        alert('Error al actualizar el estado de la orden');
      }
    });
  }

  /**
   * Drag & Drop
   */
  drop(event: CdkDragDrop<OrdenTrabajo[]>, nuevoEstado: string) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const ordenMovida = event.previousContainer.data[event.previousIndex];

      // Actualizar en el API usando el nuevo servicio
      this.actualizarEstadoOrdenAPI(ordenMovida, nuevoEstado);

      // Mover entre arrays localmente
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );

      this.calcularEstadisticas();
    }
  }

  /**
   * Cambiar estado de una orden
   */
  cambiarEstado(orden: OrdenTrabajo, nuevoEstado: string) {
    if (nuevoEstado === 'entregado') {
      if (!confirm(`¿Confirmar entrega de la orden ${orden.ordenId} a ${this.getClienteNombre(orden)}?`)) {
        return;
      }
    }

    this.actualizarEstadoOrdenAPI(orden, nuevoEstado);
  }

  /**
   * Archivar una orden
   */
  archivarOrden(orden: OrdenTrabajo, automatico: boolean = false): void {
    if (!automatico && !confirm(`¿Archivar la orden ${orden.ordenId}?`)) {
      return;
    }

    const motivo = automatico ? 'Auto-archivado por tiempo' : 'Archivado manual';

    // Usar la nueva API de archivado
    this.ordenesTrabajoService.archivarOrden(orden.ordenId).subscribe({
      next: (response) => {
        // Actualizar localmente
        orden.archivado = true;
        orden.fechaArchivado = new Date().toISOString();
        orden.motivoArchivo = motivo;

        // Mover de entregadas a archivadas
        this.ordenesEntregadas = this.ordenesEntregadas.filter(o => o.id !== orden.id);
        this.ordenesArchivadas.push(orden);

        if (!automatico) {
          alert(`Orden ${orden.ordenId} archivada correctamente.`);
        }
      },
      error: (error) => {
        console.error('Error al archivar orden:', error);
        alert('Error al archivar la orden. Intente nuevamente.');
      }
    });
  }

  /**
   * Restaurar orden desde archivo
   */
  restaurarOrden(orden: OrdenTrabajo) {
    if (confirm(`¿Restaurar la orden ${orden.ordenId} a "Entregados"?`)) {
      // Usar la nueva API de desarchivado
      this.ordenesTrabajoService.desarchivarOrden(orden.ordenId).subscribe({
        next: (response) => {
          // Actualizar localmente
          orden.archivado = false;
          orden.fechaArchivado = null;
          orden.motivoArchivo = null;


          // Mover de archivadas a entregadas
          this.ordenesArchivadas = this.ordenesArchivadas.filter(o => o.id !== orden.id);
          this.ordenesEntregadas.push(orden);

          // Actualizar filtro si está abierto
          this.filtrarArchivadas();
          //this.cerrarModalArchivo();
          alert(`Orden ${orden.ordenId} restaurada correctamente.`);
        },
        error: (error) => {
          console.error('Error al restaurar orden:', error);
          alert('Error al restaurar la orden. Intente nuevamente.');
        }
      });
    }
  }

  /**
   * Método para ver todas las órdenes de un estado
   */
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
      ordenesFiltradas = ordenesFiltradas.filter(orden => {
        // Buscar en campos del API
        const codigo = orden.ordenId?.toLowerCase() || '';
        const clienteNombre = orden.cliente?.informacion?.nombreCompleto?.toLowerCase() || '';
        const productoNombre = orden.productos?.map(p => p.nombre?.toLowerCase() || '').join(', ') || '';
        const ventaId = orden.ventaId?.toLowerCase() || '';

        return codigo.includes(busqueda) ||
          clienteNombre.includes(busqueda) ||
          productoNombre.includes(busqueda) ||
          ventaId.includes(busqueda);
      });
    }

    if (this.filtroEstado) {
      ordenesFiltradas = ordenesFiltradas.filter(orden => orden.estado === this.filtroEstado);
    }

    // Filtrar por columnas excluyendo archivadas
    this.ordenesEnTienda = ordenesFiltradas.filter(o =>
      !o.archivado && o.estado === 'en_tienda'
    );
    this.ordenesEnProceso = ordenesFiltradas.filter(o =>
      !o.archivado && o.estado === 'proceso_laboratorio'
    );
    this.ordenesListasLaboratorio = ordenesFiltradas.filter(o =>
      !o.archivado && o.estado === 'listo_laboratorio'
    );
    this.ordenesPendienteRetiro = ordenesFiltradas.filter(o =>
      !o.archivado && o.estado === 'pendiente_retiro'
    );
    this.ordenesEntregadas = ordenesFiltradas.filter(o =>
      !o.archivado && o.estado === 'entregado'
    );

    this.calcularEstadisticas();
  }

  getPrioridad(orden: OrdenTrabajo): string {
    const diasRestantes = (orden as any).diasRestantes;
    if (diasRestantes < 2) return 'alta';
    if (diasRestantes < 5) return 'media';
    return 'baja';
  }

  /**
   * Mover todos los pedidos de una columna
   */
  moverTodos(ordenes: OrdenTrabajo[], estadoActual: string, nuevoEstado: string) {
    if (ordenes.length === 0) return;

    // Convertir los strings a EstadoOrden con verificación
    const estadoActualValido = this.asegurarEstadoOrden(estadoActual);
    const nuevoEstadoValido = this.asegurarEstadoOrden(nuevoEstado);

    // Obtener títulos y mensajes usando funciones auxiliares
    const titulo = this.getMensajeTitulo(ordenes.length, estadoActualValido);
    const textoBoton = this.getTextoAccion(ordenes.length);
    const htmlContent = this.getMensajeConfirmacion(ordenes.length, estadoActualValido, nuevoEstadoValido);

    // Usar el servicio Swal para mostrar confirmación
    this.swalService.showConfirm(titulo, htmlContent, textoBoton, 'Cancelar')
      .then((result) => {
        if (result.isConfirmed) {
          this.procesarMovimientoTodasOrdenes(ordenes, estadoActualValido, nuevoEstadoValido);
        }
      });
  }

  private getMensajeTitulo(cantidad: number, estado: EstadoOrden): string {
    const esSingular = cantidad === 1;

    const titulos: { [key: string]: { singular: string, plural: string } } = {
      'en_tienda': {
        singular: 'Mover orden a Laboratorio',
        plural: 'Mover órdenes a Laboratorio'
      },
      'proceso_laboratorio': {
        singular: 'Marcar como lista',
        plural: 'Marcar como listas'
      },
      'listo_laboratorio': {
        singular: 'Enviar orden a Tienda',
        plural: 'Enviar órdenes a Tienda'
      },
      'pendiente_retiro': {
        singular: 'Marcar como entregada',
        plural: 'Marcar como entregadas'
      }
    };

    const titulo = titulos[estado] || {
      singular: 'Cambiar estado',
      plural: 'Cambiar estados'
    };

    return esSingular ? titulo.singular : titulo.plural;
  }

  private getTextoAccion(cantidad: number): string {
    return cantidad === 1 ? 'Mover orden' : 'Mover todas';
  }

  private getTextoOrden(cantidad: number): string {
    return cantidad === 1 ? '1 orden' : `${cantidad} órdenes`;
  }

  private getMensajeConfirmacion(cantidad: number, estadoActual: EstadoOrden, nuevoEstado: EstadoOrden): string {
    const esSingular = cantidad === 1;
    const textoOrden = this.getTextoOrden(cantidad);

    const mensajes: {
      [key: string]: {
        icono: string,
        color: string,
        textoPrincipal: (orden: string) => string,
        textoDetalle: (singular: boolean) => string
      }
    } = {
      'en_tienda': {
        icono: 'bi-arrow-right-circle',
        color: '#1976d2',
        textoPrincipal: (orden: string) =>
          `¿Mover ${orden} de "En Tienda" a "En Laboratorio"?`,
        textoDetalle: (singular: boolean) =>
          singular ?
            'Esta orden será movida al laboratorio para su procesamiento.' :
            'Estas órdenes serán movidas al laboratorio para su procesamiento.'
      },
      'proceso_laboratorio': {
        icono: 'bi-check-circle',
        color: '#f57c00',
        textoPrincipal: (orden: string) =>
          esSingular ?
            `¿Marcar ${orden} como "Lista en Laboratorio"?` :
            `¿Marcar ${orden} como "Listas en Laboratorio"?`,
        textoDetalle: (singular: boolean) =>
          singular ?
            'Esta orden será marcada como terminada en el laboratorio.' :
            'Estas órdenes serán marcadas como terminadas en el laboratorio.'
      },
      'listo_laboratorio': {
        icono: 'bi-truck',
        color: '#388e3c',
        textoPrincipal: (orden: string) =>
          `¿Enviar ${orden} a "Pendiente por Retirar"?`,
        textoDetalle: (singular: boolean) =>
          singular ?
            'Esta orden será transferida a la tienda para su entrega.' :
            'Estas órdenes serán transferidas a la tienda para su entrega.'
      },
      'pendiente_retiro': {
        icono: 'bi-box-seam',
        color: '#ffa000',
        textoPrincipal: (orden: string) =>
          esSingular ?
            `¿Marcar ${orden} como "Entregada"?` :
            `¿Marcar ${orden} como "Entregadas"?`,
        textoDetalle: (singular: boolean) =>
          singular ?
            'Esta orden será marcada como entregada al cliente.' :
            'Estas órdenes serán marcadas como entregadas al cliente.'
      }
    };

    const mensaje = mensajes[estadoActual] || {
      icono: 'bi-arrow-right',
      color: '#6c757d',
      textoPrincipal: (orden: string) =>
        `¿Mover ${orden} a <strong>${this.getEstadoTexto(nuevoEstado)}</strong>?`,
      textoDetalle: (singular: boolean) =>
        `De: ${this.getEstadoTexto(estadoActual)}<br>A: ${this.getEstadoTexto(nuevoEstado)}`
    };

    return `
    <div class="confirm-content">
      <div class="confirm-icon">
        <i class="bi ${mensaje.icono}" style="color: ${mensaje.color}; font-size: 2rem;"></i>
      </div>
      <div class="confirm-message">
        <p>${mensaje.textoPrincipal(textoOrden)}</p>
        <p class="confirm-detail">
          ${mensaje.textoDetalle(esSingular)}
        </p>
      </div>
    </div>
  `;
  }

  private procesarMovimientoTodasOrdenes(ordenes: OrdenTrabajo[], estadoActual: EstadoOrden, nuevoEstado: EstadoOrden) {
    const esSingular = ordenes.length === 1;

    // Mostrar loading con mensaje apropiado
    const mensajeLoading = esSingular ? 'Moviendo orden...' : `Moviendo ${ordenes.length} órdenes...`;
    this.swalService.showLoadingAlert(mensajeLoading);



    // Convertir strings a EstadoOrden (si es necesario)
    const estadoActualConvertido = this.asegurarEstadoOrden(estadoActual as string);
    const nuevoEstadoConvertido = this.asegurarEstadoOrden(nuevoEstado as string);

    // Usar la nueva API para cambiar todas las órdenes
    this.ordenesTrabajoService.cambiarEstadoTodasOrdenes(estadoActualConvertido, nuevoEstadoConvertido).subscribe({
      next: (response) => {
        this.actualizarOrdenesLocalmente(ordenes, nuevoEstadoConvertido);
        setTimeout(() => {
          this.swalService.closeLoading();
        }, 200);

        this.cargarOrdenesDesdeAPI('refresh');
      },
      error: (error) => {
        console.error('Error al cambiar estado de todas las órdenes:', error);
        this.swalService.closeLoading();
        this.mostrarMensajeError();
      }
    });
  }

  private actualizarOrdenesLocalmente(ordenes: OrdenTrabajo[], nuevoEstado: EstadoOrden) {
    ordenes.forEach(orden => {
      orden.estado = nuevoEstado;
      orden.progreso = this.calcularProgresoPorEstado(nuevoEstado);

      // Actualizar fechas localmente según el estado
      switch (nuevoEstado) {
        case 'proceso_laboratorio':
          orden.fechaInicioProceso = new Date().toISOString();
          break;
        case 'listo_laboratorio':
          orden.fechaTerminacion = new Date().toISOString();
          break;
        case 'pendiente_retiro':
          orden.fechaRecepcionTienda = new Date().toISOString();
          break;
        case 'entregado':
          orden.fechaEntrega = new Date().toISOString();
          break;
      }
    });
  }

  private mostrarMensajeError() {
    this.swalService.showError(
      'Error',
      'No se pudieron cambiar los estados de las órdenes. Por favor, intente nuevamente.'
    );
  }

  /**
   * Asegurar que un string sea un EstadoOrden válido
   */
  private asegurarEstadoOrden(estado: string): EstadoOrden {
    const estadosValidos: EstadoOrden[] = [
      'en_tienda',
      'proceso_laboratorio',
      'listo_laboratorio',
      'pendiente_retiro',
      'entregado'
    ];

    if (estadosValidos.includes(estado as EstadoOrden)) {
      return estado as EstadoOrden;
    }

    // Si no es válido, retornar un estado por defecto
    console.warn(`Estado inválido recibido: ${estado}, usando "en_tienda" por defecto`);
    return 'en_tienda';
  }

  /**
   * Verificar si un string es un estado válido (type guard)
   */
  private esEstadoValido(estado: string): estado is EstadoOrden {
    const estadosValidos: EstadoOrden[] = [
      'en_tienda',
      'proceso_laboratorio',
      'listo_laboratorio',
      'pendiente_retiro',
      'entregado'
    ];
    return estadosValidos.includes(estado as EstadoOrden);
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

  /**
   * Calcular días de duración
   */
  calcularDiasDuracion(orden: OrdenTrabajo): number {
    if (!orden.fechaCreacion || !orden.fechaEntrega) return 0;

    const inicio = new Date(orden.fechaCreacion);
    const fin = new Date(orden.fechaEntrega);
    const diff = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
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

  /**
   * Actualizar progreso de una orden
   */
  actualizarProgreso(orden: OrdenTrabajo) {
    const nuevoProgreso = prompt(
      `Ingrese el nuevo progreso para ${orden.ordenId} (0-100):`,
      orden.progreso?.toString() || '0'
    );

    if (nuevoProgreso !== null) {
      const progreso = parseInt(nuevoProgreso);
      if (!isNaN(progreso) && progreso >= 0 && progreso <= 100) {
        // Actualizar en el API
        this.ordenesTrabajoService.actualizarProgresoOrden(orden.ordenId, progreso).subscribe({
          next: (response) => {
            // Actualizar localmente
            orden.progreso = progreso;

            // Si el progreso es 100, cambiar a estado listo (opcional)
            if (progreso === 100 && orden.estado === 'proceso_laboratorio') {
              this.cambiarEstado(orden, 'listo_laboratorio');
            }
          },
          error: (error) => {
            console.error('Error al actualizar progreso:', error);
            alert('Error al actualizar el progreso');
          }
        });
      } else {
        alert('Por favor ingrese un número válido entre 0 y 100');
      }
    }
  }

  notificarCliente(orden: any) {
    const mensaje = `Estimado(a) ${orden.clienteNombre}, su orden ${orden.codigo} está lista para ser retirada. ¡Esperamos por usted!`;

    if (confirm(`¿Enviar notificación a ${orden.clienteNombre}?\n\n${mensaje}`)) {
      alert('✅ Notificación enviada al cliente.');
    }
  }

  /**
   * Generar factura
   */
  generarFactura(orden: any) {
    alert(`Factura generada para orden ${orden.codigo}`);
  }

  /**
   * Verificar auto-archivado
   */
  verificarAutoArchivo() {
    const hoy = new Date();
    const ordenesParaArchivar = this.ordenesEntregadas.filter(orden => {
      // Usa 'archivado' y verificar que fechaEntrega sea string
      if (orden.archivado || !orden.fechaEntrega || typeof orden.fechaEntrega !== 'string') return false;

      // Convertir string a Date para el cálculo
      const fechaEntregaDate = new Date(orden.fechaEntrega);

      const diasDesdeEntrega = Math.ceil(
        (hoy.getTime() - fechaEntregaDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      return diasDesdeEntrega >= this.diasParaAutoArchivo;
    });

    ordenesParaArchivar.forEach(orden => {
      this.archivarOrden(orden, true);
    });

    if (ordenesParaArchivar.length > 0) {
    }
  }

  /**
   * Configurar días para auto-archivar
   */
  /**
 * Configurar días para auto-archivar órdenes entregadas
 */
  configurarDiasAutoArchivo() {
    // Obtener el contenido HTML usando función auxiliar
    const htmlContent = this.getMensajeConfiguracionArchivo();

    // Usar el servicio Swal para mostrar la configuración
    this.swalService.showConfirm(
      'Configurar Auto-Archivo',
      htmlContent,
      'Guardar configuración',
      'Cancelar'
    ).then((result) => {
      if (result.isConfirmed) {
        this.procesarConfiguracionArchivo();
      }
    });
  }

  /**
   * Obtener mensaje de configuración de auto-archivo
   */
  private getMensajeConfiguracionArchivo(): string {
    return `
    <div class="archivo-config-content">
      <div class="config-icon">
        <i class="bi bi-calendar2-week" style="color: #7b1fa2; font-size: 2rem;"></i>
      </div>
      <div class="config-message">
        <p>Configurar días para auto-archivar órdenes entregadas</p>
        <p class="config-detail">
          Las órdenes entregadas se archivarán automáticamente después de este número de días.
        </p>
      </div>
      <div class="config-input-container">
        <label for="diasArchivo" class="config-label">Días para auto-archivado:</label>
        <input 
          type="number" 
          id="diasArchivo" 
          class="form-control config-input" 
          min="1" 
          max="365" 
          value="${this.diasParaAutoArchivo}"
          placeholder="Ejemplo: 30"
        />
        <small class="input-hint">Mínimo: 1 día | Máximo: 365 días</small>
      </div>
    </div>
  `;
  }

  /**
   * Procesar la configuración de auto-archivo
   */
  private procesarConfiguracionArchivo() {
    // Obtener el valor del input
    const input = document.getElementById('diasArchivo') as HTMLInputElement;
    const valor = input?.value;

    if (!valor || valor.trim() === '') {
      this.mostrarErrorValidacion('Por favor, ingrese un número de días');
      return;
    }

    const numDias = parseInt(valor);

    if (isNaN(numDias)) {
      this.mostrarErrorValidacion('Debe ingresar un número válido');
      return;
    }

    if (numDias < 1) {
      this.mostrarErrorValidacion('El número debe ser mayor a 0');
      return;
    }

    if (numDias > 365) {
      this.mostrarErrorValidacion('El número no puede ser mayor a 365 días');
      return;
    }

    // Guardar la configuración
    this.guardarConfiguracionArchivo(numDias);
  }

  /**
   * Mostrar error de validación
   */
  private mostrarErrorValidacion(mensaje: string) {
    this.swalService.showError(
      'Error de validación',
      mensaje
    );
  }

  /**
   * Guardar configuración y mostrar éxito
   */
  private guardarConfiguracionArchivo(numDias: number) {
    this.diasParaAutoArchivo = numDias;

    // Mostrar confirmación de éxito
    const esSingular = numDias === 1;

    // Aplicar inmediatamente
    this.verificarAutoArchivo();
  }

  /**
   * Abrir modal de archivo
   */
  abrirModalArchivo() {
    this.mostrarModalArchivo = true;
    this.filtrarArchivadas();
    this.bloquearScroll();
  }

  cerrarModalArchivo() {
    this.mostrarModalArchivo = false;
    this.desbloquearScroll();

  }

  /**
   * Filtrar archivadas
   */
  filtrarArchivadas() {
    if (!this.filtroArchivo) {
      this.ordenesFiltradasArchivadas = [...this.ordenesArchivadas];
      return;
    }

    const busqueda = this.filtroArchivo.toLowerCase();
    this.ordenesFiltradasArchivadas = this.ordenesArchivadas.filter(orden =>
      orden.ordenId.toLowerCase().includes(busqueda) ||
      this.getClienteNombre(orden).toLowerCase().includes(busqueda) ||
      this.getProductoNombre(orden).toLowerCase().includes(busqueda) ||
      (orden.motivoArchivo || '').toLowerCase().includes(busqueda)
    );
  }

  /**
   * Modal
   */
  verDetalleOrden(orden: OrdenTrabajo) {
    this.ordenSeleccionada = orden;
    this.mostrarModalDetalle = true;
    this.bloquearScroll();
  }

  cerrarModalDetalle() {
    this.mostrarModalDetalle = false;
    this.ordenSeleccionada = null;
    this.desbloquearScroll();
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
    this.cargarOrdenesDesdeAPI('');
    this.calcularEstadisticas();
  }

  exportarReporte() {
    console.log('📊 Exportando reporte...');
    alert('🚀 Funcionalidad de exportación en desarrollo');
  }

  generarReporte() {
    console.log('🖨️ Generando reporte PDF...');
    alert('🚀 Funcionalidad de reporte PDF en desarrollo');
  }

  /**
   * Método para obtener siguiente estado
   */
  getNextEstado(estadoActual: string): string {
    const flujo: { [key: string]: string } = {
      'en_tienda': 'proceso_laboratorio',
      'proceso_laboratorio': 'listo_laboratorio',
      'listo_laboratorio': 'pendiente_retiro',
      'pendiente_retiro': 'entregado'
    };

    return flujo[estadoActual] || estadoActual;
  }

  /**
   * Método para filtrar órdenes en el modal
   */
  filtrarOrdenesModal() {
    if (!this.filtroModal && !this.filtroPrioridadModal) {
      this.ordenesModalFiltradas = [...this.ordenesModal];
    } else {
      this.ordenesModalFiltradas = this.ordenesModal.filter(orden => {
        // Filtrar por texto de búsqueda
        let coincideTexto = true;
        if (this.filtroModal) {
          const busqueda = this.filtroModal.toLowerCase();
          coincideTexto =
            orden.ordenId.toLowerCase().includes(busqueda) ||
            this.getClienteNombre(orden).toLowerCase().includes(busqueda) ||
            this.getProductoNombre(orden).toLowerCase().includes(busqueda) ||
            orden.ventaId.toLowerCase().includes(busqueda) ||
            false;
        }

        // Filtrar por prioridad
        let coincidePrioridad = true;
        if (this.filtroPrioridadModal) {
          coincidePrioridad = orden.prioridad === this.filtroPrioridadModal;
        }

        return coincideTexto && coincidePrioridad;
      });
    }

    // Ordenar los resultados
    this.ordenarOrdenesModal();

    // Reiniciar paginación
    this.paginaActual = 0;
  }

  /**
   * Método para ordenar órdenes
   */
  ordenarOrdenesModal() {
    const [campo, direccion] = this.ordenModal.split('_');

    this.ordenesModalFiltradas.sort((a, b) => {
      let valorA = a[campo];
      let valorB = b[campo];

      // Manejar prioridades especiales
      if (campo === 'prioridad') {
        const ordenPrioridad = { 'alta': 3, 'media': 2, 'baja': 1 };
        valorA = ordenPrioridad[a.prioridad] || 0;
        valorB = ordenPrioridad[b.prioridad] || 0;
      }

      // Manejar fechas
      if (campo === 'fechaCreacion' || campo === 'fechaEntregaEstimada') {
        if (valorA) valorA = new Date(valorA).getTime();
        if (valorB) valorB = new Date(valorB).getTime();
      }

      // Orden ascendente/descendente
      if (direccion === 'desc') {
        return valorB > valorA ? 1 : valorB < valorA ? -1 : 0;
      } else {
        return valorA > valorB ? 1 : valorA < valorB ? -1 : 0;
      }
    });
  }

  /**
   * Método para resaltar texto coincidente
   */
  resaltarTexto(texto: string, busqueda: string): string {
    if (!busqueda || !texto) return texto;

    const busquedaLower = busqueda.toLowerCase();
    const textoLower = texto.toLowerCase();
    const indice = textoLower.indexOf(busquedaLower);

    if (indice === -1) return texto;

    const antes = texto.substring(0, indice);
    const coincidencia = texto.substring(indice, indice + busqueda.length);
    const despues = texto.substring(indice + busqueda.length);

    return `${antes}<span class="highlight">${coincidencia}</span>${despues}`;
  }

  /**
   * Verificar si una orden tiene coincidencia
   */
  tieneCoincidencia(orden: any): boolean {
    if (!this.filtroModal) return false;

    const busqueda = this.filtroModal.toLowerCase();
    return [
      orden.ordenId.toLowerCase(),
      this.getClienteNombre(orden).toLowerCase(),
      this.getProductoNombre(orden).toLowerCase(),
      orden.ventaId.toLowerCase()
    ].some(texto => texto.includes(busqueda));
  }

  /**
   * Establecer filtro de prioridad
   */
  setFiltroPrioridadModal(prioridad: string) {
    this.filtroPrioridadModal = prioridad;
    this.filtrarOrdenesModal();
  }

  /**
   * Limpiar todos los filtros
   */
  limpiarFiltroModal() {
    this.filtroModal = '';
    this.filtroPrioridadModal = '';
    this.filtrarOrdenesModal();
  }

  /**
   * Método para mover orden rápidamente (mover al siguiente estado)
   */
  moverOrdenRapido(orden: any) {
    const siguienteEstado = this.getNextEstado(this.estadoModalActual);
    if (siguienteEstado && confirm(`¿Mover orden ${orden.ordenId} a ${this.getEstadoTexto(siguienteEstado)}?`)) {
      this.cambiarEstado(orden, siguienteEstado);

      // Remover del array de órdenes filtradas
      this.ordenesModalFiltradas = this.ordenesModalFiltradas.filter(o => o.id !== orden.id);

      // Actualizar contador
      alert(`Orden ${orden.ordenId} movida a ${this.getEstadoTexto(siguienteEstado)}`);
    }
  }

  /**
   * Método actualizado para abrir el modal
   */
  verOrdenesEnModal(ordenes: any[], titulo: string, estado: string) {
    this.ordenesModal = [...ordenes];
    this.tituloModalOrdenes = titulo;
    this.estadoModalActual = estado;

    // Reiniciar filtros
    this.filtroModal = '';
    this.filtroPrioridadModal = '';
    this.ordenModal = 'fechaCreacion_desc';

    // Filtrar y mostrar
    this.filtrarOrdenesModal();
    this.mostrarModalOrdenes = true;
    this.bloquearScroll();
  }

  /**
   * Método actualizado para cerrar el modal
   */
  cerrarModalOrdenes() {
    this.mostrarModalOrdenes = false;
    this.ordenesModal = [];
    this.ordenesModalFiltradas = [];
    this.tituloModalOrdenes = '';
    this.estadoModalActual = '';
    this.filtroModal = '';
    this.filtroPrioridadModal = '';
    this.paginaActual = 0;
    this.desbloquearScroll();
  }

  /**
   * Propiedades calculadas para paginación
   */
  get inicioPaginacion(): number {
    return this.paginaActual * this.tamanoPagina;
  }

  get finPaginacion(): number {
    return Math.min((this.paginaActual + 1) * this.tamanoPagina, this.ordenesModalFiltradas.length);
  }

  get totalPaginas(): number {
    return Math.ceil(this.ordenesModalFiltradas.length / this.tamanoPagina);
  }

  /**
   * Métodos de paginación
   */
  paginaAnterior() {
    if (this.paginaActual > 0) {
      this.paginaActual--;
    }
  }

  paginaSiguiente() {
    if (this.paginaActual < this.totalPaginas - 1) {
      this.paginaActual++;
    }
  }

  /**
   * Obtener órdenes paginadas para mostrar
   */
  get ordenesModalPagina(): any[] {
    return this.ordenesModalFiltradas.slice(this.inicioPaginacion, this.finPaginacion);
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'en_tienda': return 'estado-en-tienda';
      case 'proceso_laboratorio': return 'estado-proceso';
      case 'listo_laboratorio': return 'estado-listo';
      case 'pendiente_retiro': return 'estado-pendiente';
      case 'entregado': return 'estado-entregado';
      default: return 'estado-en-tienda';
    }
  }

  getEstadoTexto(estado: EstadoOrden | string): string {
    const estados: Record<EstadoOrden, string> = {
      'en_tienda': 'En Tienda',
      'proceso_laboratorio': 'En Laboratorio',
      'listo_laboratorio': 'Listo en Lab',
      'pendiente_retiro': 'Pendiente Retiro',
      'entregado': 'Entregado'
    };

    if (this.esEstadoValido(estado)) {
      return estados[estado];
    }

    return estado;
  }

  isFechaVencida(fecha: string): boolean {
    if (!fecha) return false;
    return new Date(fecha) < new Date();
  }

  editarOrden() {
    // Navegar a edición o abrir modal de edición
  }

  imprimirOrden() {
    // Lógica para imprimir
  }

  /**
   * Método para ver detalle de venta
   */
  verDetalleVenta(ventaId: string) {
    console.log('Ver detalle de venta:', ventaId);
    alert(`Funcionalidad para ver venta ${ventaId} en desarrollo`);
  }

  trackByProductoId(index: number, producto: any): any {
    // Usar el ID del producto, código o índice
    return producto?.id || producto?.datos?.id || producto?.datos?.codigo || index;
  }

  /**
   * Obtener productos para mostrar
   */
  getProductosParaMostrar(orden: OrdenTrabajo): any[] {
    return orden.productos?.map(producto => ({
      cantidad: 1,
      datos: {
        id: producto.id,
        nombre: producto.nombre,
        marca: producto.marca,
        codigo: producto.codigo,
        modelo: producto.modelo,
        precio: producto.precio
      }
    })) || [];
  }

  /**
   * Obtener formulación de la historia médica
   */
  getFormulacion(orden: OrdenTrabajo): any {
    const historia = orden.cliente?.historia_medica;
    const refraccion = historia?.examen_ocular_refraccion_final;
    const recomendaciones = historia?.recomendaciones?.[0];

    return {
      material: recomendaciones?.material?.[0] || 'CRISTALES-SERVILENTES-',
      tipoVision: recomendaciones?.cristal?.label || 'Monofocal visión sencilla',
      esferaOD: refraccion?.esf_od || '',
      esferaOI: refraccion?.esf_oi || '',
      cilindroOD: refraccion?.cil_od || '',
      cilindroOI: refraccion?.cil_oi || '',
      ejeOD: refraccion?.eje_od || '',
      ejeOI: refraccion?.eje_oi || '',
      adicion: refraccion?.add_od || refraccion?.add_oi || '',
      observaciones: recomendaciones?.observaciones || ''
    };
  }

  /**
   * Calcular progreso según estado
   */
  private calcularProgresoPorEstado(estado: string): number {
    const progresos = {
      'en_tienda': 0,
      'proceso_laboratorio': 30,
      'listo_laboratorio': 70,
      'pendiente_retiro': 100,
      'entregado': 100
    };
    return progresos[estado] || 0;
  }

  /**
   * Calcular días desde una fecha (para uso en template)
   */
  calcularDiasDesde(fechaString: string | null): number {
    if (!fechaString) return 0;
    const fecha = new Date(fechaString);
    const hoy = new Date();
    const diff = Math.ceil((hoy.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  /**
   * Obtener nombre del cliente
   */
  getClienteNombre(orden: OrdenTrabajo): string {
    return orden.cliente?.informacion?.nombreCompleto || orden.clienteNombre || 'Sin nombre';
  }

  /**
   * Obtener teléfono del cliente
   */
  getClienteTelefono(orden: OrdenTrabajo): string {
    return orden.cliente?.informacion?.telefono || orden.clienteTelefono || '';
  }

  /**
   * Obtener nombre del producto
   */
  getProductoNombre(orden: OrdenTrabajo): string {
    if (orden.productos && orden.productos.length > 0) {
      return orden.productos.map(p => p.nombre).join(', ');
    }
    return orden.productoNombre || 'Sin producto';
  }

  /**
   * Obtener progreso para mostrar (asegura que siempre haya un valor)
   */
  getProgresoParaMostrar(orden: OrdenTrabajo): number {
    // Si la orden tiene progreso definido, usarlo
    if (orden.progreso !== undefined && orden.progreso !== null) {
      return orden.progreso;
    }

    // Si no tiene progreso, calcular según estado
    return this.calcularProgresoPorEstado(orden.estado);
  }

  /**
 * Formatear fecha de entrega para mostrar
 */
  getFechaEntregaFormateada(orden: OrdenTrabajo): string {
    if (!orden.fechaEntregaEstimada) {
      return 'Sin fecha asignada';
    }

    try {
      // Parsear fecha del backend (UTC)
      const fechaUTC = new Date(orden.fechaEntregaEstimada);

      // Obtener día, mes y año en UTC
      const diaUTC = fechaUTC.getUTCDate();
      const mesUTC = fechaUTC.getUTCMonth() + 1; 
      const añoUTC = fechaUTC.getUTCFullYear();

      // Calcular días restantes usando el método existente
      const diasRestantes = orden.diasRestantes !== undefined ? orden.diasRestantes : 0;

      // Formatear: DD/MM (Xd)
      return `${diaUTC.toString().padStart(2, '0')}/${mesUTC.toString().padStart(2, '0')} (${diasRestantes}d)`;

    } catch (error) {
      console.error('Error al formatear fecha:', error);
      return 'Fecha inválida';
    }
  }

  getEspecialistaCargo(especialista: { id: number; cedula: string; nombre: string; } | null): string {
    return especialista ? 'Optometrista' : 'No asignado';
  }

  confirmarFechaEntrega(orden: OrdenTrabajo): void {
    if (!orden || !this.diasParaFechaEntrega || this.diasParaFechaEntrega < 1) {
      this.swalService.showWarning('Datos incompletos', 'Por favor ingrese una cantidad válida de días');
      return;
    }

    // 1. Obtener fecha actual LOCAL (Venezuela)
    const hoy = new Date();

    // 2. Calcular fecha de entrega en Venezuela
    // Usar Date.UTC para evitar problemas de zona horaria
    const fechaEntregaUTC = new Date(Date.UTC(
      hoy.getUTCFullYear(),
      hoy.getUTCMonth(),
      hoy.getUTCDate() + this.diasParaFechaEntrega
    ));

    // 3. Formatear para API (YYYY-MM-DD) usando UTC
    const año = fechaEntregaUTC.getUTCFullYear();
    const mes = String(fechaEntregaUTC.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(fechaEntregaUTC.getUTCDate()).padStart(2, '0');

    const fechaAPI = `${año}-${mes}-${dia}`;

    console.log('DEBUG - Confirmar fecha:', {
      hoyLocal: hoy.toLocaleDateString('es-VE'),
      hoyUTC: hoy.toISOString(),
      diasAgregados: this.diasParaFechaEntrega,
      fechaCalculadaUTC: fechaEntregaUTC.toISOString(),
      fechaCalculadaLocal: new Date(fechaEntregaUTC).toLocaleDateString('es-VE'),
      fechaAPI: fechaAPI
    });

    // 4. Preparar request como requiere el API
    const requestBody = {
      orden_numero: orden.ordenId,
      fecha_entrega_estimada: fechaAPI  // "2026-01-18"
    };

    console.log('DEBUG - Request al API:', requestBody);

    // 5. Llamar al servicio API
    this.ordenesTrabajoService.actualizarFechaEntregaEstimada(orden.ordenId, fechaAPI)
      .subscribe({
        next: (response) => {
          console.log('DEBUG - Respuesta del API:', response);

          // 6. Almacenar la fecha en formato ISO para uso interno
          // Crear fecha con hora específica (mediodía UTC) para consistencia
          const fechaGuardar = new Date(Date.UTC(
            año,
            parseInt(mes) - 1, // Mes es 0-indexed
            parseInt(dia),
            12, 0, 0, 0
          ));

          orden.fechaEntregaEstimada = fechaGuardar.toISOString();
          console.log('DEBUG - Fecha guardada:', orden.fechaEntregaEstimada);

          // 7. Recalcular días restantes
          this.recalcularDiasRestantes(orden);

          // 8. Mostrar éxito
          this.swalService.showSuccess(
            '✅ Fecha configurada',
            `Orden: <strong>${orden.ordenId}</strong><br>
          Fecha estimada: <strong>${new Date(fechaEntregaUTC).toLocaleDateString('es-VE', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</strong><br>
          Días hasta entrega: <strong>${this.diasParaFechaEntrega}</strong>`
          );

          this.cerrarModalFechaEntrega();
        },
        error: (error) => {
          console.error('Error al actualizar fecha de entrega:', error);
          this.swalService.showError('❌ Error', 'No se pudo configurar la fecha de entrega');
        }
      });
  }

  configurarFechaEntrega(orden: OrdenTrabajo, event?: Event) {
    if (event) {
      event.stopPropagation();
    }

    this.ordenParaConfigurarFecha = orden;

    // Calcular días actuales si existe fecha
    if (orden.fechaEntregaEstimada) {
      try {
        // Parsear fecha ISO del backend
        const fechaEntregaUTC = new Date(orden.fechaEntregaEstimada);

        if (!isNaN(fechaEntregaUTC.getTime())) {
          // Fecha actual en UTC
          const hoyUTC = new Date();
          const hoyMediodiaUTC = new Date(Date.UTC(
            hoyUTC.getUTCFullYear(),
            hoyUTC.getUTCMonth(),
            hoyUTC.getUTCDate(),
            12, 0, 0, 0
          ));

          // Fecha de entrega a mediodía UTC
          const fechaEntregaMediodiaUTC = new Date(Date.UTC(
            fechaEntregaUTC.getUTCFullYear(),
            fechaEntregaUTC.getUTCMonth(),
            fechaEntregaUTC.getUTCDate(),
            12, 0, 0, 0
          ));

          // Calcular diferencia en días
          const diferenciaMs = fechaEntregaMediodiaUTC.getTime() - hoyMediodiaUTC.getTime();
          const diferenciaDias = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24));

          this.diasParaFechaEntrega = Math.max(1, diferenciaDias);

          console.log('DEBUG - Cargar fecha existente:', {
            fechaBackend: orden.fechaEntregaEstimada,
            fechaEntregaUTC: fechaEntregaUTC.toISOString(),
            fechaLocal: fechaEntregaUTC.toLocaleDateString('es-VE'),
            diferenciaDias: this.diasParaFechaEntrega
          });
        } else {
          this.diasParaFechaEntrega = 7;
        }
      } catch (error) {
        console.error('Error al parsear fecha existente:', error);
        this.diasParaFechaEntrega = 7;
      }
    } else {
      this.diasParaFechaEntrega = 7;
    }

    this.actualizarFechaCalculada();
    this.mostrarModalConfigurarFecha = true;
    this.bloquearScroll();
  }

  /**
   * Formatear fecha en formato corto para tarjetas
   */
  formatearFechaCorta(fecha: Date): string {
    return fecha.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  /**
   * Método mejorado para cancelar configuración de fecha
   */
  cancelarConfigurarFecha() {
    // Preguntar confirmación solo si hay cambios
    if (this.diasParaFechaEntrega !== 7 || this.ordenParaConfigurarFecha?.fechaEntregaEstimada) {
      this.swalService.showConfirm(
        'Cancelar cambios',
        '¿Está seguro de cancelar la configuración de fecha? Los cambios no guardados se perderán.',
        'Sí, cancelar',
        'Continuar editando'
      ).then((result) => {
        if (result.isConfirmed) {
          this.cerrarModalFechaEntrega();
        }
      });
    } else {
      this.cerrarModalFechaEntrega();
    }
  }

  /**
   * Cerrar modal de fecha de entrega
   */
  private cerrarModalFechaEntrega() {
    this.mostrarModalConfigurarFecha = false;
    this.ordenParaConfigurarFecha = null;
    this.fechaCalculada = null;
    this.diasParaFechaEntrega = 7;
    this.desbloquearScroll();
  }

  /**
   * Método actualizado para actualizar fecha calculada
   */
  actualizarFechaCalculada() {
    if (this.diasParaFechaEntrega && this.diasParaFechaEntrega > 0) {
      const hoy = new Date();

      // Calcular usando UTC para consistencia
      const fechaCalculadaUTC = new Date(Date.UTC(
        hoy.getUTCFullYear(),
        hoy.getUTCMonth(),
        hoy.getUTCDate() + this.diasParaFechaEntrega,
        12, 0, 0, 0
      ));

      // Convertir a fecha local para mostrar
      this.fechaCalculada = new Date(fechaCalculadaUTC);

      console.log('DEBUG - Fecha calculada:', {
        dias: this.diasParaFechaEntrega,
        fechaCalculadaUTC: fechaCalculadaUTC.toISOString(),
        fechaCalculadaLocal: this.fechaCalculada.toLocaleDateString('es-VE')
      });
    } else {
      this.fechaCalculada = null;
    }
  }

  /**
   * Calcular fecha de entrega (método utilitario)
   */
  calcularFechaEntrega(): Date | null {
    if (!this.diasParaFechaEntrega || this.diasParaFechaEntrega < 1) {
      return null;
    }

    const hoy = new Date();
    const fechaEntrega = new Date(hoy);
    fechaEntrega.setDate(hoy.getDate() + this.diasParaFechaEntrega);
    return fechaEntrega;
  }

  // Método para bloquear scroll
  bloquearScroll() {
    document.body.classList.add('body-no-scroll');
    // Alternativa para mayor compatibilidad
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  // Método para desbloquear scroll
  desbloquearScroll() {
    document.body.classList.remove('body-no-scroll');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  /**
     * Inicializar seguimiento del mouse para tooltips
     */
  inicializarTooltips() {
    // Seguir posición del mouse para tooltips dinámicos
    document.addEventListener('mousemove', (e) => {
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    });

    // Tooltips estáticos para elementos específicos
    this.configurarTooltipsEstaticos();
  }

  /**
   * Configurar tooltips estáticos para elementos específicos
   */
  configurarTooltipsEstaticos() {
    // Esperar a que el DOM esté listo
    setTimeout(() => {
      const tooltipElements = document.querySelectorAll('[data-tooltip]');

      tooltipElements.forEach(element => {
        // Para botones dentro de minicards
        if (element.closest('.delivery-minicard')) {
          element.addEventListener('mouseenter', (e) => {
            this.posicionarTooltipEnElemento(e.target as HTMLElement);
          });
        }

        // Para botones con texto específico
        const tooltipText = element.getAttribute('data-tooltip');
        if (tooltipText?.includes('Archivar')) {
          element.classList.add('tooltip-archivar');
        }
        if (tooltipText?.includes('factura')) {
          element.classList.add('tooltip-factura');
        }
      });
    }, 500);
  }

  /**
   * Posicionar tooltip relativo al elemento
   */
  posicionarTooltipEnElemento(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const tooltip = element.querySelector('.tooltip-custom') as HTMLElement;

    if (tooltip) {
      // Posicionar arriba del elemento
      tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
      tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2)}px`;
    }
  }

}