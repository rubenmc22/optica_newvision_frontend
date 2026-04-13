import { Component, OnDestroy, OnInit, HostListener } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { OrdenesTrabajoService } from './gestion-ordenes-trabajo.service';
import { OrdenTrabajo, OrdenesTrabajoResponse, EstadoOrden, OrdenTrabajoDatosConsulta, OrdenTrabajoEspecialista } from './gestion-ordenes-trabajo.model';
import { LoaderService } from './../../shared/loader/loader.service';
import { SwalService } from '../../core/services/swal/swal.service';
import * as XLSX from 'xlsx';

// Constantes
import {
  TIPOS_CRISTALES,
  TIPOS_LENTES_CONTACTO,
  MATERIALES,
  TRATAMIENTOS_ADITIVOS
} from 'src/app/shared/constants/historias-medicas';

@Component({
  selector: 'app-gestion-ordenes-trabajo',
  standalone: false,
  templateUrl: './gestion-ordenes-trabajo.component.html',
  styleUrls: ['./gestion-ordenes-trabajo.component.scss']
})

export class GestionOrdenesTrabajoComponent implements OnInit, OnDestroy {
  private readonly AUTO_ARCHIVO_STORAGE_KEY = 'gestion_ordenes_auto_archivo_dias';

  // Filtros
  filtroBusqueda: string = '';
  filtroEstado: string = '';

  // Variables para el nuevo sistema
  maxOrdenesPorColumna: number = 2;
  mostrarArchivo: boolean = false;
  tabActiva: string = 'entregados';
  mostrarModalAutoArchivado: boolean = false;
  filtroArchivo: string = '';
  ordenesFiltradasArchivadas: any[] = [];
  diasParaAutoArchivo: number = 30;
  mostrarModalOrdenes: boolean = false;
  ordenesModal: any[] = [];
  tituloModalOrdenes: string = '';
  estadoModalActual: string = '';
  tabActivaDetalle: string = 'formulacion'; // Puede ser 'formulacion', 'producto' o 'indicaciones'


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

  // Modal para configurar fecha de entrega
  mostrarModalConfigurarFecha: boolean = false;
  ordenParaConfigurarFecha: OrdenTrabajo | null = null;
  diasParaFechaEntrega: number = 7; // Valor por defecto
  fechaCalculada: Date | null = null;

  // Variables para el modal de auto-archivado
  mostrarModalArchivo: boolean = false;
  diasArchivoSeleccionados: number = 30;
  diasArchivoActual: number = 30;
  configValida: boolean = true;
  mensajeErrorArchivo: string = '';

  // Agrega estas propiedades al componente
  filtroModal: string = '';
  filtroPrioridadModal: string = '';
  ordenModal: string = 'fechaCreacion_desc';
  ordenesModalFiltradas: any[] = [];
  paginaActual: number = 0;
  tamanoPagina: number = 20; // Órdenes por página

  // Variables para el modal de progreso
  mostrarModalProgreso: boolean = false;
  ordenSeleccionada: OrdenTrabajo | null = null;
  progresoActual: number = 0;
  minProgreso: number = 0;
  maxProgreso: number = 100;
  progresoValido: boolean = false;
  mensajeError: string = '';

  constructor(
    private ordenesTrabajoService: OrdenesTrabajoService,
    private loader: LoaderService,
    private swalService: SwalService,
    //private userStateService: UserStateService
  ) { }

  ngOnInit() {
    this.cargarConfiguracionAutoArchivadoLocal();
    this.cargarOrdenesDesdeAPI('');
    this.calcularEstadisticas();
    this.inicializarTooltips();
    this.loader.hide();
  }

  ngOnDestroy() {
    this.desbloquearScroll();
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
          this.filtrarArchivadas();
          this.verificarAutoArchivo();
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
  /**
 * Drag & Drop con validación de fecha estimada
 */
  /**
  * Drag & Drop con validación de fecha estimada
  */
  drop(event: CdkDragDrop<OrdenTrabajo[]>, nuevoEstado: string) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const ordenMovida = event.previousContainer.data[event.previousIndex];

      // VALIDACIÓN: Verificar si se está moviendo de en_tienda a laboratorio sin fecha
      const estadoOrigen = this.obtenerEstadoPorColumna(event.previousContainer);
      const estadoDestino = this.obtenerEstadoPorColumna(event.container);

      if (estadoOrigen === 'en_tienda' && estadoDestino === 'proceso_laboratorio' &&
        !ordenMovida.fechaEntregaEstimada) {
        this.mostrarAdvertenciaFechaEntrega(ordenMovida);
        return; // Cancelar el movimiento
      }

      // Si pasa la validación, continuar con el movimiento normal
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
   * Cambiar estado de una orden con validación
   */
  cambiarEstado(orden: OrdenTrabajo, nuevoEstado: string) {
    // VALIDACIÓN: Verificar si se está moviendo de en_tienda a laboratorio sin fecha
    if (orden.estado === 'en_tienda' && nuevoEstado === 'proceso_laboratorio' &&
      !orden.fechaEntregaEstimada) {
      this.mostrarAdvertenciaFechaEntrega(orden);
      return; // Cancelar el cambio
    }

    if (nuevoEstado === 'entregado') {
      if (!confirm(`¿Confirmar entrega de la orden ${orden.ordenId} a ${this.getClienteNombre(orden)}?`)) {
        return;
      }
    }

    this.actualizarEstadoOrdenAPI(orden, nuevoEstado);
  }

  /**
   * Mover todos los pedidos de una columna con validación
   */
  moverTodos(ordenes: OrdenTrabajo[], estadoActual: string, nuevoEstado: string) {
    if (ordenes.length === 0) return;

    // VALIDACIÓN: Verificar si hay órdenes sin fecha al mover de en_tienda a laboratorio
    if (estadoActual === 'en_tienda' && nuevoEstado === 'proceso_laboratorio') {
      const ordenesSinFecha = ordenes.filter(orden => !orden.fechaEntregaEstimada);

      if (ordenesSinFecha.length > 0) {
        this.mostrarAdvertenciaFechaEntregaMultiples(ordenesSinFecha);
        return; // Cancelar el movimiento
      }
    }

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

  /**
   * Obtener estado según el contenedor
   */
  private obtenerEstadoPorColumna(container: any): string {
    if (container.data === this.ordenesEnTienda) return 'en_tienda';
    if (container.data === this.ordenesEnProceso) return 'proceso_laboratorio';
    if (container.data === this.ordenesListasLaboratorio) return 'listo_laboratorio';
    if (container.data === this.ordenesPendienteRetiro) return 'pendiente_retiro';
    if (container.data === this.ordenesEntregadas) return 'entregado';
    return '';
  }

  /**
   * Mostrar advertencia cuando falta fecha de entrega
   */
  private mostrarAdvertenciaFechaEntrega(orden: OrdenTrabajo): void {
    const contenidoHTML = `
    <div style="text-align: center; padding: 0.5rem 0;">
      <p style="margin-bottom: 0.75rem;">La orden <code>${orden.ordenId}</code> no tiene fecha estimada de entrega.</p>
      
      <div class="alert" style="margin: 0.75rem 0;">
        <i class="bi bi-exclamation-triangle"></i>
        <strong>Requisito:</strong> Para mover de "En Tienda" a "Laboratorio", debe configurar primero una fecha estimada.
      </div>
      
      <p class="question">¿Desea configurar la fecha ahora?</p>
    </div>
  `;

    this.swalService.showConfirm(
      '📅 Fecha requerida',
      contenidoHTML,
      'Configurar fecha',
      'Cancelar'
    ).then((result) => {
      if (result.isConfirmed) {
        this.configurarFechaEntrega(orden);
      }
    });
  }

  /**
   * Mostrar advertencia para múltiples órdenes sin fecha
   */
  private mostrarAdvertenciaFechaEntregaMultiples(ordenesSinFecha: OrdenTrabajo[]): void {
    const cantidad = ordenesSinFecha.length;
    const codigos = ordenesSinFecha.map(o =>
      `<div style="
    display: flex;
    justify-content: center;
    margin: 4px 0;
  ">
    <code style="
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      padding: 8px 16px;
      color: #e74c3c;
      font-family: monospace;
      font-size: 14px;
      min-width: 200px;
      text-align: center;
    ">${o.ordenId}</code>
  </div>`
    ).join('');

    const contenidoHTML = `
    <div style="text-align: center; padding: 0.5rem 0;">
      <p style="margin-bottom: 0.75rem;"><strong>${cantidad} ${cantidad === 1 ? 'orden' : 'órdenes'}</strong> sin fecha estimada:</p>
      
      ${codigos}
      
      <div class="alert" style="margin: 0.75rem 0;">
        <i class="bi bi-exclamation-triangle"></i>
        <strong>Requisito:</strong> Para mover de "En Tienda" a "Laboratorio", debe configurar fechas estimadas primero.
      </div>
      
      <p class="question">¿Desea configurar las fechas ahora?</p>
    </div>
  `;

    this.swalService.showConfirm(
      '📅 Fechas requeridas',
      contenidoHTML,
      'Configurar fechas',
      'Cancelar'
    ).then((result) => {
      if (result.isConfirmed && ordenesSinFecha.length > 0) {
        this.configurarFechaEntrega(ordenesSinFecha[0]);
      }
    });
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
        this.filtrarArchivadas();
        this.calcularEstadisticas();

        if (!automatico) {
          this.swalService.showSuccess('Orden archivada', `La orden ${orden.ordenId} fue archivada correctamente.`);
        }
      },
      error: (error) => {
        console.error('Error al archivar orden:', error);
        this.swalService.showError('Error al archivar', 'No se pudo archivar la orden. Intente nuevamente.');
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
          this.calcularEstadisticas();
          //this.cerrarModalArchivo();
          this.swalService.showSuccess('Orden restaurada', `La orden ${orden.ordenId} fue restaurada correctamente.`);
        },
        error: (error) => {
          console.error('Error al restaurar orden:', error);
          this.swalService.showError('Error al restaurar', 'No se pudo restaurar la orden. Intente nuevamente.');
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
    if (!this.todasLasOrdenes.length) {
      this.swalService.showInfo('Sin datos', 'No hay órdenes para exportar en este momento.');
      return;
    }

    const libro = XLSX.utils.book_new();
    const detalleCompleto = this.todasLasOrdenes.map(orden => this.mapearOrdenParaReporte(orden));

    const resumen = [
      { Indicador: 'En Tienda', Cantidad: this.estadisticas.enTienda },
      { Indicador: 'En Laboratorio', Cantidad: this.estadisticas.enProceso },
      { Indicador: 'Listo en Laboratorio', Cantidad: this.estadisticas.listoLaboratorio },
      { Indicador: 'Pendiente Retiro', Cantidad: this.estadisticas.pendienteRetiro },
      { Indicador: 'Entregadas', Cantidad: this.ordenesEntregadas.length },
      { Indicador: 'Archivadas', Cantidad: this.ordenesArchivadas.length },
      { Indicador: 'Total general', Cantidad: this.todasLasOrdenes.length },
      { Indicador: 'Días auto-archivado', Cantidad: this.diasParaAutoArchivo }
    ];

    const operativas = this.todasLasOrdenes
      .filter(orden => !orden.archivado)
      .map(orden => this.mapearOrdenParaReporte(orden));

    const archivadas = this.ordenesArchivadas.map(orden => this.mapearOrdenParaReporte(orden));

    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(detalleCompleto), 'Detalle');
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(operativas), 'Operativas');
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(archivadas), 'Archivadas');
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(resumen), 'Resumen');

    const fecha = this.formatearFechaReporte(new Date());
    XLSX.writeFile(libro, `reporte_ordenes_trabajo_${fecha}.xlsx`);
    this.swalService.showSuccess('Reporte exportado', 'El archivo Excel se descargó correctamente.');
  }

  generarReporte() {
    if (!this.todasLasOrdenes.length) {
      this.swalService.showInfo('Sin datos', 'No hay órdenes para imprimir en este momento.');
      return;
    }

    const ventana = window.open('', '_blank', 'width=1280,height=900');
    if (!ventana) {
      this.swalService.showError('Ventana bloqueada', 'El navegador bloqueó la ventana de impresión. Permite popups e inténtalo nuevamente.');
      return;
    }

    const fecha = new Date();
    const resumen = this.obtenerResumenHtmlReporte();
    const tablaActivas = this.generarTablaHtmlReporte(this.todasLasOrdenes.filter(orden => !orden.archivado), 'Órdenes operativas');
    const tablaArchivadas = this.generarTablaHtmlReporte(this.ordenesArchivadas, 'Órdenes archivadas');

    ventana.document.write(`
      <html>
        <head>
          <title>Reporte de órdenes de trabajo</title>
          <style>
            body { font-family: Arial, sans-serif; color: #1f2937; margin: 24px; }
            .header { margin-bottom: 24px; border-bottom: 2px solid #dbeafe; padding-bottom: 16px; }
            .header h1 { margin: 0; font-size: 26px; color: #0f172a; }
            .header p { margin: 6px 0 0; color: #64748b; }
            .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 20px 0 28px; }
            .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 14px; background: #f8fafc; }
            .card strong { display: block; font-size: 22px; color: #0f172a; }
            .card span { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
            h2 { margin: 28px 0 12px; color: #1e293b; font-size: 18px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; font-size: 12px; vertical-align: top; }
            th { background: #eff6ff; color: #1e3a8a; }
            .muted { color: #64748b; }
            .empty { padding: 12px; border: 1px dashed #cbd5e1; border-radius: 12px; color: #64748b; background: #f8fafc; }
            @media print { body { margin: 12px; } .summary { grid-template-columns: repeat(4, 1fr); } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Reporte de Órdenes de Trabajo</h1>
            <p>Generado el ${fecha.toLocaleDateString('es-VE')} a las ${fecha.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          ${resumen}
          ${tablaActivas}
          ${tablaArchivadas}
        </body>
      </html>
    `);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => {
      ventana.print();
    }, 350);
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
    if (!this.ordenSeleccionada) {
      this.swalService.showInfo('Sin orden seleccionada', 'Abre primero una orden para imprimir su detalle.');
      return;
    }

    const ventana = window.open('', '_blank', 'width=980,height=780');
    if (!ventana) {
      this.swalService.showError('Ventana bloqueada', 'El navegador bloqueó la ventana de impresión.');
      return;
    }

    const orden = this.ordenSeleccionada;
    ventana.document.write(`
      <html>
        <head>
          <title>${orden.ordenId}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
            h1 { margin: 0 0 12px; color: #0f172a; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
            .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; }
            .label { color: #64748b; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
            .value { color: #1f2937; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <h1>Orden ${orden.ordenId}</h1>
          <div class="grid">
            <div class="card">
              <div class="label">Cliente</div>
              <div class="value">${this.getClienteNombre(orden)}</div>
              <div class="label">Teléfono</div>
              <div class="value">${this.getClienteTelefono(orden) || 'No disponible'}</div>
            </div>
            <div class="card">
              <div class="label">Estado</div>
              <div class="value">${this.getEstadoTexto(orden.estado)}</div>
              <div class="label">Entrega estimada</div>
              <div class="value">${this.getFechaEntregaFormateada(orden)}</div>
            </div>
          </div>
        </body>
      </html>
    `);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => ventana.print(), 250);
  }

  /**
   * Método para ver detalle de venta
   */
  verDetalleVenta(ventaId: string) {
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

  getDatosConsultaOrden(orden: OrdenTrabajo | null): OrdenTrabajoDatosConsulta | null {
    return orden?.cliente?.historia_medica?.datosConsulta || null;
  }

  esFormulaExternaOrden(orden: OrdenTrabajo | null): boolean {
    if (!orden) return false;

    return this.getDatosConsultaOrden(orden)?.formulaExterna === true || orden.cliente?.historia_medica?.formula_externa === true;
  }

  getEspecialistaOrden(orden: OrdenTrabajo | null): OrdenTrabajoEspecialista | null {
    if (!orden) return null;

    return this.getDatosConsultaOrden(orden)?.especialista || orden.especialista || null;
  }

  tieneEspecialistaAsignado(orden: OrdenTrabajo | null): boolean {
    const especialista = this.getEspecialistaOrden(orden);
    return !!(especialista?.nombre || especialista?.cedula || especialista?.externo?.nombre);
  }

  getEspecialistaCargo(especialista: OrdenTrabajoEspecialista | null | undefined): string {
    if (!especialista) return 'No asignado';

    const tipo = (especialista.tipo || '').toUpperCase();
    if (tipo === 'EXTERNO') {
      return 'Especialista externo';
    }

    return especialista.cargo || especialista.tipo || 'Especialista';
  }

  getNombreEspecialistaOrden(orden: OrdenTrabajo | null): string {
    const especialista = this.getEspecialistaOrden(orden);
    return especialista?.nombre || especialista?.externo?.nombre || 'No especificado';
  }

  getEspecialistaDetalleItems(orden: OrdenTrabajo | null): string[] {
    const especialista = this.getEspecialistaOrden(orden);
    if (!especialista) return [];

    const items: string[] = [];
    const cargo = this.getEspecialistaCargo(especialista);
    if (cargo && cargo !== 'No asignado') {
      items.push(cargo);
    }

    if (especialista.cedula) {
      items.push(`C.I. ${especialista.cedula}`);
    }

    if (especialista.externo?.lugarConsultorio) {
      items.push(especialista.externo.lugarConsultorio);
    }

    return items;
  }

  getLugarEspecialistaOrden(orden: OrdenTrabajo | null): string {
    const especialista = this.getEspecialistaOrden(orden);
    return especialista?.externo?.lugarConsultorio || '';
  }

  getMedicoOrigenOrden(orden: OrdenTrabajo | null): { tipo: string | null; nombre: string | null; lugarConsultorio: string | null } | null {
    const datosConsulta = this.getDatosConsultaOrden(orden);
    if (datosConsulta?.formulaOriginal?.medicoOrigen) {
      return datosConsulta.formulaOriginal.medicoOrigen;
    }

    const historia = orden?.cliente?.historia_medica;
    if (historia?.formula_original_tipo || historia?.formula_original_nombre || historia?.formula_original_lugar) {
      return {
        tipo: historia.formula_original_tipo || null,
        nombre: historia.formula_original_nombre || null,
        lugarConsultorio: historia.formula_original_lugar || null,
      };
    }

    return null;
  }

  tieneMedicoOrigenOrden(orden: OrdenTrabajo | null): boolean {
    const medicoOrigen = this.getMedicoOrigenOrden(orden);
    return !!(medicoOrigen?.nombre || medicoOrigen?.lugarConsultorio);
  }

  getMedicoOrigenDetalle(orden: OrdenTrabajo | null): string {
    const medicoOrigen = this.getMedicoOrigenOrden(orden);
    if (!medicoOrigen) return '';

    return [medicoOrigen.tipo, medicoOrigen.lugarConsultorio].filter(Boolean).join(' · ');
  }

  getDescripcionHistoriaOrden(orden: OrdenTrabajo | null): string {
    const recomendaciones = orden?.cliente?.historia_medica?.recomendaciones;
    if (!Array.isArray(recomendaciones)) {
      return '';
    }

    return recomendaciones
      .map((recomendacion: any) => typeof recomendacion?.observaciones === 'string' ? recomendacion.observaciones.trim() : '')
      .filter(Boolean)
      .join(' · ');
  }

  tieneDescripcionHistoriaOrden(orden: OrdenTrabajo | null): boolean {
    return this.getDescripcionHistoriaOrden(orden).length > 0;
  }

  getTipoFormulaOrden(orden: OrdenTrabajo | null): string {
    return this.esFormulaExternaOrden(orden) ? 'Fórmula externa' : 'Fórmula interna';
  }

  getAsesorDetalleItems(orden: OrdenTrabajo | null): string[] {
    const asesor = orden?.asesor;
    if (!asesor) return [];

    return [asesor.cargo || null, asesor.cedula ? `C.I. ${asesor.cedula}` : null].filter((item): item is string => !!item);
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

    // 4. Preparar request como requiere el API
    const requestBody = {
      orden_numero: orden.ordenId,
      fecha_entrega_estimada: fechaAPI  // "2026-01-18"
    };

    // 5. Llamar al servicio API
    this.ordenesTrabajoService.actualizarFechaEntregaEstimada(orden.ordenId, fechaAPI)
      .subscribe({
        next: (response) => {
          const fechaGuardar = new Date(Date.UTC(
            año,
            parseInt(mes) - 1, // Mes es 0-indexed
            parseInt(dia),
            12, 0, 0, 0
          ));

          orden.fechaEntregaEstimada = fechaGuardar.toISOString();

          // 7. Recalcular días restantes
          this.recalcularDiasRestantes(orden);

          // 8. Mostrar éxito
          this.swalService.showSuccessHTML(
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
   * Cerrar modal de fecha de entrega
   */
  public cerrarModalFechaEntrega() {
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
    document.body.classList.add('modal-open');
    document.body.classList.add('body-no-scroll');
    // Alternativa para mayor compatibilidad
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  // Método para desbloquear scroll
  desbloquearScroll() {
    document.body.classList.remove('modal-open');
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

  // Método para abrir el modal de progreso
  abrirModalProgreso(orden: OrdenTrabajo) {
    this.ordenSeleccionada = orden;
    this.progresoActual = orden.progreso || 0;

    // Definir rangos según el estado
    switch (orden.estado) {
      case 'en_tienda':
        this.minProgreso = 0;
        this.maxProgreso = 0;
        break;
      case 'proceso_laboratorio':
        this.minProgreso = 30;
        this.maxProgreso = 80;
        break;
      case 'listo_laboratorio':
        this.minProgreso = 90;
        this.maxProgreso = 90;
        break;
      case 'pendiente_retiro':
      case 'entregado':
        this.minProgreso = 100;
        this.maxProgreso = 100;
        break;
      default:
        this.minProgreso = 0;
        this.maxProgreso = 100;
    }

    this.validarProgreso();
    this.mostrarModalProgreso = true;
  }

  // Método para cerrar el modal
  cerrarModalProgreso() {
    this.mostrarModalProgreso = false;
    this.ordenSeleccionada = null;
    this.progresoActual = 0;
    this.mensajeError = '';
  }

  // Método para validar el progreso
  validarProgreso() {
    if (this.progresoActual < this.minProgreso || this.progresoActual > this.maxProgreso) {
      this.mensajeError = `El progreso debe estar entre ${this.minProgreso}% y ${this.maxProgreso}% para este estado`;
      this.progresoValido = false;
    } else if (isNaN(this.progresoActual)) {
      this.mensajeError = 'Por favor ingrese un número válido';
      this.progresoValido = false;
    } else {
      this.mensajeError = '';
      this.progresoValido = true;
    }
  }

  // Método para actualizar valor del slider
  actualizarValorProgreso(event: any) {
    this.progresoActual = parseInt(event.target.value);
    this.validarProgreso();
  }

  // Método para obtener ticks del slider
  getTicks(): number[] {
    const ticks = [];
    const step = (this.maxProgreso - this.minProgreso) / 4;
    for (let i = this.minProgreso; i <= this.maxProgreso; i += step) {
      ticks.push(i);
    }
    return ticks;
  }

  // Método para guardar el progreso
  guardarProgreso() {
    if (!this.ordenSeleccionada || !this.progresoValido) return;

    // Actualizar progreso en el API
    this.ordenesTrabajoService.actualizarProgresoOrden(
      this.ordenSeleccionada.codigo,
      this.progresoActual
    ).subscribe({
      next: (response) => {
        // Actualizar localmente
        this.ordenSeleccionada!.progreso = this.progresoActual;

        // Si el progreso es el máximo permitido y está en laboratorio, sugerir cambio de estado
        if (this.progresoActual === this.maxProgreso &&
          this.ordenSeleccionada!.estado === 'proceso_laboratorio') {
          this.sugerirCambioEstado();
        } else {
          this.cerrarModalProgreso();
          this.mostrarNotificacion('Progreso actualizado correctamente', 'success');
        }
      },
      error: (error) => {
        console.error('Error al actualizar progreso:', error);
        this.mensajeError = 'Error al actualizar el progreso. Intente nuevamente.';
        this.mostrarNotificacion('Error al actualizar el progreso', 'error');
      }
    });
  }

  // Método para sugerir cambio de estado cuando se llega al 80%
  sugerirCambioEstado() {
    const confirmar = confirm(`¿Desea cambiar el estado de la orden a "Listo en Laboratorio"?`);

    if (confirmar && this.ordenSeleccionada) {
      this.cambiarEstado(this.ordenSeleccionada, 'listo_laboratorio');
      this.cerrarModalProgreso();
      this.mostrarNotificacion('Estado cambiado a Listo en Laboratorio', 'success');
    } else {
      this.cerrarModalProgreso();
      this.mostrarNotificacion('Progreso actualizado a 80%', 'success');
    }
  }

  // Método auxiliar para mostrar notificaciones
  mostrarNotificacion(mensaje: string, tipo: 'success' | 'error' | 'info') {
    if (tipo === 'success') {
      this.swalService.showSuccess('Operación completada', mensaje);
      return;
    }

    if (tipo === 'error') {
      this.swalService.showError('Ocurrió un problema', mensaje);
      return;
    }

    this.swalService.showInfo('Información', mensaje);
  }

  // Método para abrir el modal
  abrirModalArchivo() {
    // Usar el valor actual de diasParaAutoArchivo
    this.diasArchivoActual = this.diasParaAutoArchivo || 30;
    this.diasArchivoSeleccionados = this.diasArchivoActual;
    this.mostrarModalAutoArchivado = true;
  }

  // Método para cerrar el modal
  /* cerrarModalArchivo() {
     if (this.diasArchivoSeleccionados !== this.diasArchivoActual) {
       const confirmar = confirm('¿Desea descartar los cambios?');
       if (!confirmar) return;
     }
     this.mostrarModalAutoArchivado = false;
     this.mensajeError = '';
   }*/

  // Método para abrir modal de configuración de auto-archivado
  abrirModalConfigArchivo() {
    // Usar el valor actual de diasParaAutoArchivo
    this.diasArchivoActual = this.diasParaAutoArchivo || 30;
    this.diasArchivoSeleccionados = this.diasArchivoActual;
    this.mostrarModalAutoArchivado = true;
    this.bloquearScroll();
  }

  // Método para abrir modal de ver órdenes archivadas
  abrirModalArchivadas() {
    this.filtrarArchivadas(); // Asegurarse de que el filtro esté aplicado
    this.mostrarModalArchivo = true;
    this.bloquearScroll();
  }

  // Método para cerrar modal de ver órdenes archivadas
  cerrarModalArchivo() {
    this.mostrarModalArchivo = false;
    this.mostrarModalAutoArchivado = false;
    this.desbloquearScroll();
  }

  // Método para validar días
  validarDias() {
    const dias = this.diasArchivoSeleccionados;

    if (dias < 1 || dias > 365) {
      this.mensajeError = 'Los días deben estar entre 1 y 365';
      this.configValida = false;
    } else if (isNaN(dias)) {
      this.mensajeError = 'Por favor ingrese un número válido';
      this.configValida = false;
    } else {
      this.mensajeError = '';
      this.configValida = true;
    }
  }

  // Métodos para ajustar días
  incrementarDias() {
    if (this.diasArchivoSeleccionados < 365) {
      this.diasArchivoSeleccionados++;
      this.validarDias();
    }
  }

  decrementarDias() {
    if (this.diasArchivoSeleccionados > 1) {
      this.diasArchivoSeleccionados--;
      this.validarDias();
    }
  }

  // Variable para controlar el estado de guardado
  //  guardandoConfiguracion: boolean = false;

  // Método para guardar configuración con loader
  guardarConfiguracion() {
    if (!this.configValida) return;

    const dias = this.diasArchivoSeleccionados;

    // Mostrar loader con mensaje inicial
    this.loader.showWithMessage('⚙️ Actualizando configuración...');
    //  this.guardandoConfiguracion = true;

    // Llamar al API
    this.ordenesTrabajoService.actualizarDiasArchivo(dias).subscribe({
      next: (response) => {
        // Actualizar mensaje del loader
        this.loader.updateMessage('✅ Configuración guardada');

        // Pequeña pausa para mostrar el mensaje de éxito
        setTimeout(() => {
          // Ocultar loader
          this.loader.hide();

          // Actualizar localmente
          this.diasArchivoActual = dias;
          this.diasParaAutoArchivo = dias;
          this.persistirConfiguracionAutoArchivadoLocal(dias);
          this.verificarAutoArchivo();

          // Cerrar modal
          this.mostrarModalAutoArchivado = false;
          // this.guardandoConfiguracion = false;

          // Mostrar notificación de éxito (opcional)
          this.mostrarNotificacion(`Configuración guardada: ${dias} días para auto-archivado`, 'success');
        }, 1000);
      },
      error: (error) => {
        // Ocultar loader
        this.loader.hide();
        //  this.guardandoConfiguracion = false;

        console.error('Error al guardar configuración:', error);

        // Mostrar error específico si está disponible
        if (error.error && error.error.message) {
          this.mensajeError = `Error: ${error.error.message}`;
        } else if (error.status === 0) {
          this.mensajeError = 'Error de conexión. Verifique su internet.';
        } else {
          this.mensajeError = 'Error al guardar la configuración. Intente nuevamente.';
        }

        // Mostrar notificación de error (opcional)
        this.mostrarNotificacion('Error al guardar configuración', 'error');
      }
    });
  }

  private cargarConfiguracionAutoArchivadoLocal(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const diasGuardados = localStorage.getItem(this.AUTO_ARCHIVO_STORAGE_KEY);
      if (!diasGuardados) return;

      const dias = Number(diasGuardados);
      if (!Number.isNaN(dias) && dias >= 1 && dias <= 365) {
        this.diasParaAutoArchivo = dias;
        this.diasArchivoActual = dias;
        this.diasArchivoSeleccionados = dias;
      }
    } catch (error) {
      console.warn('No se pudo cargar la configuración local de auto-archivado', error);
    }
  }

  private persistirConfiguracionAutoArchivadoLocal(dias: number): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(this.AUTO_ARCHIVO_STORAGE_KEY, String(dias));
    } catch (error) {
      console.warn('No se pudo guardar la configuración local de auto-archivado', error);
    }
  }

  private mapearOrdenParaReporte(orden: OrdenTrabajo): Record<string, string | number> {
    return {
      'Orden': orden.ordenId,
      'Venta': orden.numero_venta || '',
      'Recibo': orden.numero_recibo || '',
      'Sede': orden.sede || '',
      'Historia médica': orden.cliente?.historia_medica?.numero || '',
      'Cliente': this.getClienteNombre(orden),
      'Cédula paciente': this.getClienteCedula(orden),
      'Teléfono': this.getClienteTelefono(orden) || '',
      'Correo': this.getClienteEmail(orden),
      'Tipo cliente': orden.cliente?.tipo || '',
      'Producto(s)': this.getProductoNombre(orden),
      'Detalle productos': this.getDetalleProductosReporte(orden),
      'Especialista': this.getResumenEspecialistaReporte(orden),
      'Asesor': this.getResumenAsesorReporte(orden),
      'Tipo fórmula': this.getTipoFormulaOrden(orden),
      'Médico origen': this.getResumenMedicoOrigenReporte(orden),
      'Cristal recomendado': this.getCristalRecomendadoReporte(orden),
      'Material recomendado': this.getMaterialRecomendadoReporte(orden),
      'Observaciones formulación': this.getObservacionesFormulacion(orden) || '',
      'Estado': this.getEstadoTexto(orden.estado),
      'Progreso': `${this.getProgresoParaMostrar(orden)}%`,
      'Fecha creación': this.formatearFechaHoraReporte(orden.fechaCreacion),
      'Fecha inicio proceso': this.formatearFechaHoraReporte(orden.fechaInicioProceso),
      'Entrega estimada': orden.fechaEntregaEstimada ? this.getFechaEntregaFormateada(orden) : 'Sin fecha',
      'Fecha entrega': this.formatearFechaHoraReporte(orden.fechaEntrega || null),
      'Archivada': orden.archivado ? 'Sí' : 'No',
      'Motivo archivo': orden.motivoArchivo || '',
      'Observaciones orden': orden.observaciones || ''
    };
  }

  private formatearFechaReporte(fecha: Date): string {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  }

  private formatearFechaHoraReporte(fecha: string | null | undefined): string {
    if (!fecha) return '';

    const parsed = new Date(fecha);
    if (Number.isNaN(parsed.getTime())) return '';

    return parsed.toLocaleString('es-VE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private obtenerResumenHtmlReporte(): string {
    const tarjetas = [
      { label: 'En tienda', value: this.estadisticas.enTienda },
      { label: 'En laboratorio', value: this.estadisticas.enProceso },
      { label: 'Listas', value: this.estadisticas.listoLaboratorio },
      { label: 'Pendientes retiro', value: this.estadisticas.pendienteRetiro },
      { label: 'Entregadas', value: this.ordenesEntregadas.length },
      { label: 'Archivadas', value: this.ordenesArchivadas.length },
      { label: 'Total', value: this.todasLasOrdenes.length },
      { label: 'Auto-archivo', value: `${this.diasParaAutoArchivo} días` }
    ];

    return `<div class="summary">${tarjetas.map(item => `<div class="card"><span>${item.label}</span><strong>${item.value}</strong></div>`).join('')}</div>`;
  }

  private generarTablaHtmlReporte(ordenes: OrdenTrabajo[], titulo: string): string {
    if (!ordenes.length) {
      return `<h2>${titulo}</h2><div class="empty">No hay registros para mostrar.</div>`;
    }

    const filas = ordenes.map(orden => `
      <tr>
        <td>${orden.ordenId}</td>
        <td>
          <strong>${this.getClienteNombre(orden)}</strong><br>
          <span class="muted">${this.getClienteCedula(orden) || 'Sin cédula'}</span>
        </td>
        <td>
          ${this.getClienteTelefono(orden) || 'Sin teléfono'}<br>
          <span class="muted">${this.getClienteEmail(orden) || 'Sin correo'}</span>
        </td>
        <td>${this.getDetalleProductosReporte(orden)}</td>
        <td>
          ${this.getTipoFormulaOrden(orden)}<br>
          <span class="muted">${this.getResumenEspecialistaReporte(orden) || 'Sin especialista'}</span>
          ${this.getResumenMedicoOrigenReporte(orden) ? `<br><span class="muted">Origen: ${this.getResumenMedicoOrigenReporte(orden)}</span>` : ''}
        </td>
        <td>${this.getEstadoTexto(orden.estado)}</td>
        <td>${this.getProgresoParaMostrar(orden)}%</td>
        <td>
          Creación: ${this.formatearFechaHoraReporte(orden.fechaCreacion) || 'Sin fecha'}<br>
          Entrega: ${orden.fechaEntregaEstimada ? this.getFechaEntregaFormateada(orden) : 'Sin fecha'}
        </td>
        <td>${orden.archivado ? (orden.motivoArchivo || 'Archivada') : 'Activa'}</td>
      </tr>
    `).join('');

    return `
      <h2>${titulo}</h2>
      <table>
        <thead>
          <tr>
            <th>Orden</th>
            <th>Paciente</th>
            <th>Contacto</th>
            <th>Producto(s)</th>
            <th>Resumen clínico</th>
            <th>Estado</th>
            <th>Progreso</th>
            <th>Fechas</th>
            <th>Observación</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    `;
  }

  private getClienteCedula(orden: OrdenTrabajo): string {
    return orden.cliente?.informacion?.cedula || '';
  }

  private getClienteEmail(orden: OrdenTrabajo): string {
    return orden.cliente?.informacion?.email || '';
  }

  private getDetalleProductosReporte(orden: OrdenTrabajo): string {
    if (!Array.isArray(orden.productos) || !orden.productos.length) {
      return 'Sin productos';
    }

    return orden.productos.map(producto => {
      const partes = [producto.nombre, producto.codigo, producto.marca, producto.modelo].filter(Boolean);
      return partes.join(' · ');
    }).join(' | ');
  }

  private getResumenEspecialistaReporte(orden: OrdenTrabajo): string {
    const nombre = this.getNombreEspecialistaOrden(orden);
    const detalles = this.getEspecialistaDetalleItems(orden).join(' · ');

    if (!nombre || nombre === 'No especificado') {
      return '';
    }

    return [nombre, detalles].filter(Boolean).join(' · ');
  }

  private getResumenAsesorReporte(orden: OrdenTrabajo): string {
    if (!orden.asesor?.nombre) {
      return '';
    }

    return [orden.asesor.nombre, ...this.getAsesorDetalleItems(orden)].filter(Boolean).join(' · ');
  }

  private getResumenMedicoOrigenReporte(orden: OrdenTrabajo): string {
    const medicoOrigen = this.getMedicoOrigenOrden(orden);
    if (!medicoOrigen) {
      return '';
    }

    return [medicoOrigen.nombre, medicoOrigen.tipo, medicoOrigen.lugarConsultorio].filter(Boolean).join(' · ');
  }

  private getCristalRecomendadoReporte(orden: OrdenTrabajo): string {
    const recomendacion = orden.cliente?.historia_medica?.recomendaciones?.[0];
    return recomendacion?.cristal ? this.getTipoCristalRecomendado(recomendacion.cristal) : '';
  }

  private getMaterialRecomendadoReporte(orden: OrdenTrabajo): string {
    const recomendacion = orden.cliente?.historia_medica?.recomendaciones?.[0];
    return recomendacion?.material ? this.getMaterialesRecomendados(recomendacion.material) : '';
  }

  // Agrega este método al componente para manejar mejor el responsive
  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.ajustarModalResponsive();
  }

  private ajustarModalResponsive() {
    if (this.mostrarModalDetalle) {
      // Ajustar tamaño del modal según viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (viewportWidth < 768) {
        // En móviles, asegurar que el modal ocupe casi toda la pantalla
        document.querySelector('.modal-detalle-orden')?.classList.add('modal-mobile-full');
      } else {
        document.querySelector('.modal-detalle-orden')?.classList.remove('modal-mobile-full');
      }

      // Para zoom extremo
      if (viewportWidth < 600 || viewportHeight < 500) {
        document.querySelector('.modal-detalle-orden')?.classList.add('modal-zoom-extremo');
      } else {
        document.querySelector('.modal-detalle-orden')?.classList.remove('modal-zoom-extremo');
      }
    }
  }

  // También ajusta el método cerrarModalDetalle
  cerrarModalDetalle() {
    this.mostrarModalDetalle = false;
    this.ordenSeleccionada = null;
    this.desbloquearScroll();

    // Limpiar clases responsive
    document.querySelector('.modal-detalle-orden')?.classList.remove('modal-mobile-full', 'modal-zoom-extremo');
  }

  getInfoMontura(producto: any): string {
    const parts = [];

    if (producto?.codigo_montura) parts.push(`Cod: ${producto.codigo_montura}`);
    if (producto?.nombre_montura) parts.push(producto.nombre_montura);
    if (producto?.marca_montura) parts.push(producto.marca_montura);
    if (producto?.modelo_montura) parts.push(producto.modelo_montura);

    return parts.length > 0 ? parts.join(' - ') : 'Montura estándar';
  }

  getFormulacionCompleta(orden: OrdenTrabajo): any {
    const refraccionFinal = orden.cliente?.historia_medica?.examen_ocular_refraccion_final;

    if (!refraccionFinal) {
      return null;
    }

    return {
      esf_od: refraccionFinal.esf_od || '--',
      cil_od: refraccionFinal.cil_od || '--',
      eje_od: refraccionFinal.eje_od || '--',
      add_od: refraccionFinal.add_od || '--',
      alt_od: refraccionFinal.alt_od || '--',
      dp_od: refraccionFinal.dp_od || '--',

      esf_oi: refraccionFinal.esf_oi || '--',
      cil_oi: refraccionFinal.cil_oi || '--',
      eje_oi: refraccionFinal.eje_oi || '--',
      add_oi: refraccionFinal.add_oi || '--',
      alt_oi: refraccionFinal.alt_oi || '--',
      dp_oi: refraccionFinal.dp_oi || '--'
    };
  }

  getObservacionesFormulacion(orden: OrdenTrabajo): string {
    const recomendaciones = orden.cliente?.historia_medica?.recomendaciones?.[0];
    return recomendaciones?.observaciones || '';
  }

  get observacionesFormulacion(): string {
    if (!this.ordenSeleccionada) return '';
    return this.getObservacionesFormulacion(this.ordenSeleccionada);
  }

  tieneFormulaCompleta(orden: OrdenTrabajo | null): boolean {
    if (!orden || !orden.cliente?.historia_medica?.examen_ocular_refraccion_final) {
      return false;
    }

    const refraccion = orden.cliente.historia_medica.examen_ocular_refraccion_final;

    const odTieneDatos = refraccion.esf_od && refraccion.esf_od !== '' && refraccion.esf_od !== '--';
    const oiTieneDatos = refraccion.esf_oi && refraccion.esf_oi !== '' && refraccion.esf_oi !== '--';

    return odTieneDatos || oiTieneDatos;
  }

  esLenteContactoRecomendacion(rec: any): boolean {
    if (!rec || !rec.cristal) return false;

    let cristalValue = '';

    if (typeof rec.cristal === 'string') {
      cristalValue = rec.cristal;
    } else if (rec.cristal?.value) {
      cristalValue = rec.cristal.value;
    } else if (rec.cristal?.label) {
      cristalValue = rec.cristal.label;
    }

    const esLentesContacto = TIPOS_CRISTALES.some(tc =>
      (tc.value === cristalValue || tc.label === cristalValue) &&
      tc.value === 'LENTES_CONTACTO'
    );

    return esLentesContacto || (rec.tipoLentesContacto && rec.tipoLentesContacto !== '');
  }

  getTipoCristalRecomendado(cristal: any): string {
    if (!cristal) return 'No especificado';

    let valorBuscar = '';

    // Extraer el valor a buscar
    if (typeof cristal === 'string') {
      valorBuscar = cristal;
    } else if (cristal?.value) {
      valorBuscar = cristal.value;
    } else if (cristal?.label) {
      valorBuscar = cristal.label;
    }

    // Buscar en TIPOS_CRISTALES
    const encontrado = TIPOS_CRISTALES.find(tc =>
      tc.value === valorBuscar || tc.label === valorBuscar
    );

    return encontrado?.label || valorBuscar || 'No especificado';
  }

  getMaterialesRecomendados(material: any): string {
    if (!material) return 'No especificado';

    const materialesArray = Array.isArray(material) ? material : [material];

    if (materialesArray.length === 0) return 'No especificado';

    return materialesArray.map(m => {
      // Buscar en MATERIALES
      const encontrado = MATERIALES.find(mat => mat.value === m || mat.label === m);
      return encontrado?.label || m;
    }).join(', ');
  }


  getTipoLenteContactoLabel(valor: string | undefined | null): string {
    if (!valor || valor === '') return 'No especificado';

    // Buscar en TIPOS_LENTES_CONTACTO
    const encontrado = TIPOS_LENTES_CONTACTO.find(tlc =>
      tlc.value === valor || tlc.label === valor
    );

    return encontrado?.label || valor;
  }

  formatAditivos(aditivos: string[] | string | undefined | null): string {
    if (!aditivos) return '';

    const aditivosArray = Array.isArray(aditivos) ? aditivos : [aditivos];

    if (aditivosArray.length === 0) return '';

    return aditivosArray
      .map(aditivo => {
        // Buscar en TRATAMIENTOS_ADITIVOS
        const encontrado = TRATAMIENTOS_ADITIVOS.find(ta =>
          ta.value === aditivo || ta.label === aditivo
        );
        return encontrado?.label || aditivo;
      })
      .join(', ');
  }

  getMaterialLente(producto: any): string {
    const historia = this.ordenSeleccionada?.cliente?.historia_medica;
    const recomendaciones = historia?.recomendaciones?.[0];

    if (recomendaciones?.material?.length > 0) {
      return this.getMaterialesRecomendados(recomendaciones.material);
    }

    return 'Material estándar';
  }

  /**
   * Obtiene el tipo de cristal (para compatibilidad con métodos existentes)
   */
  getTipoCristal(producto: any): string {
    const historia = this.ordenSeleccionada?.cliente?.historia_medica;
    const recomendaciones = historia?.recomendaciones?.[0];

    if (recomendaciones?.cristal) {
      return this.getTipoCristalRecomendado(recomendaciones.cristal);
    }

    return 'Cristal estándar';
  }

}