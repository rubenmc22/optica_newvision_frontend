import { Component, OnInit } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { OrdenesTrabajoService } from './gestion-ordenes-trabajo.service';
import { OrdenTrabajo, OrdenesTrabajoResponse, EstadoOrden } from './gestion-ordenes-trabajo.model';

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
  ordenSeleccionada: any = null;

  constructor(
    private ordenesTrabajoService: OrdenesTrabajoService
    //private userStateService: UserStateService
  ) { }

  ngOnInit() {
    this.cargarOrdenesDesdeAPI();
    this.calcularEstadisticas();
    this.verificarAutoArchivo();
  }


  /**
  * Cargar órdenes desde el API
  */
  cargarOrdenesDesdeAPI(): void {
    this.cargandoOrdenes = true;
    this.errorCargaOrdenes = '';

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
   * Determinar prioridad basada en días restantes
   */
  /*  private determinarPrioridad(orden: OrdenTrabajo): string {
      if (!orden.fechaEntregaEstimada) return 'media';
      
      const hoy = new Date();
      const fechaEntrega = new Date(orden.fechaEntregaEstimada);
      const diasRestantes = Math.ceil((fechaEntrega.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diasRestantes < 2) return 'alta';
      if (diasRestantes < 5) return 'media';
      return 'baja';
    }*/

  /**
   * Calcular días restantes para entrega
   */
  /* private calcularDiasRestantes(fechaEntregaEstimada: string | null): number {
     if (!fechaEntregaEstimada) return 7; // Valor por defecto
     
     const hoy = new Date();
     const fechaEntrega = new Date(fechaEntregaEstimada);
     return Math.ceil((fechaEntrega.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
   }*/

  /**
   * Extraer formulación de la historia médica
   */
  private extraerFormulacion(orden: OrdenTrabajo): any {
    const historia = orden.cliente.historia_medica;
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
 * Método para actualizar el estado de una orden en el API
 */
  /**
 * Método para actualizar el estado de una orden en el API
 */
  actualizarEstadoOrdenAPI(orden: OrdenTrabajo, nuevoEstado: string): void {
    // Verificar que el estado sea válido
    const nuevoEstadoValido = this.asegurarEstadoOrden(nuevoEstado);

    // Si necesitas enviar datos adicionales como fechas
    let datosAdicionales = {};

    // Opcional: Agregar fechas según el estado si el API lo soporta
    switch (nuevoEstadoValido) {
      case 'proceso_laboratorio':
        datosAdicionales = {
          fechaInicioProceso: new Date().toISOString(),
          progreso: 10
        };
        break;
      case 'listo_laboratorio':
        datosAdicionales = {
          fechaTerminacion: new Date().toISOString(),
          progreso: 100
        };
        break;
      case 'pendiente_retiro':
        datosAdicionales = {
          fechaRecepcionTienda: new Date().toISOString(),
          progreso: 100
        };
        break;
      case 'entregado':
        datosAdicionales = {
          fechaEntrega: new Date().toISOString(),
          progreso: 100
        };
        break;
    }

    // Usar la nueva API con orden_numero
    this.ordenesTrabajoService.cambiarEstadoOrden(orden.ordenId, nuevoEstadoValido).subscribe({
      next: (response) => {
        console.log('Estado actualizado:', response.message);

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
   * Actualizar fechas según estado
   */
  actualizarFechasPorEstado(orden: OrdenTrabajo, nuevoEstado: string) {
    const hoy = new Date().toISOString();

    switch (nuevoEstado) {
      case 'proceso_laboratorio':
        orden.fechaInicioProceso = hoy;
        orden.progreso = 10;
        break;

      case 'listo_laboratorio':
        // Podrías agregar fechaTerminacion si el API lo soporta
        orden.progreso = 100;
        break;

      case 'pendiente_retiro':
        // Podrías agregar fechaRecepcionTienda si el API lo soporta
        orden.progreso = 100;
        break;

      case 'entregado':
        // Podrías agregar fechaEntrega si el API lo soporta
        orden.progreso = 100;
        break;
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
        console.log('Orden archivada:', response.message);

        // Actualizar localmente
        orden.archivado = true;
        orden.fechaArchivado = new Date().toISOString();
        orden.motivoArchivo = motivo;

        // Mover de entregadas a archivadas
        this.ordenesEntregadas = this.ordenesEntregadas.filter(o => o.id !== orden.id);
        this.ordenesArchivadas.push(orden);

        console.log(`📁 ${automatico ? 'Auto-archivada' : 'Archivada'}:`, orden.ordenId);

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
          console.log('Orden desarchivada:', response.message);

          // Actualizar localmente
          orden.archivado = false;
          orden.fechaArchivado = null;
          orden.motivoArchivo = null;

          // Mover de archivadas a entregadas
          this.ordenesArchivadas = this.ordenesArchivadas.filter(o => o.id !== orden.id);
          this.ordenesEntregadas.push(orden);

          // Actualizar filtro si está abierto
          this.filtrarArchivadas();
          alert(`Orden ${orden.ordenId} restaurada correctamente.`);
        },
        error: (error) => {
          console.error('Error al restaurar orden:', error);
          alert('Error al restaurar la orden. Intente nuevamente.');
        }
      });
    }
  }

  //Método para ver todas las órdenes de un estado
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


  /*- calcularDias() {
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
   }*/

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

    const mensajes: { [key: string]: string } = {
      'en_tienda': '¿Mover todas las órdenes de "En Tienda" a "En Laboratorio"?',
      'proceso_laboratorio': '¿Marcar todas las órdenes como "Listo en Laboratorio"?',
      'listo_laboratorio': '¿Enviar todas las órdenes a "Pendiente por Retirar"?',
      'pendiente_retiro': '¿Marcar todas las órdenes como "Entregadas"?'
    };

    if (confirm(mensajes[estadoActualValido] || `¿Mover todas las órdenes a ${this.getEstadoTexto(nuevoEstadoValido)}?`)) {
      // Usar la nueva API para cambiar todas las órdenes
      this.ordenesTrabajoService.cambiarEstadoTodasOrdenes(estadoActualValido, nuevoEstadoValido).subscribe({
        next: (response) => {
          console.log('Estado cambiado para todas las órdenes:', response.message);

          // Actualizar localmente
          ordenes.forEach(orden => {
            orden.estado = nuevoEstadoValido;
            orden.progreso = this.calcularProgresoPorEstado(nuevoEstadoValido);

            // Actualizar fechas localmente según el estado
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
          });

          // Recargar desde API para asegurar consistencia
          this.cargarOrdenesDesdeAPI();
          alert(`✅ ${ordenes.length} órdenes movidas a ${this.getEstadoTexto(nuevoEstadoValido)}`);
        },
        error: (error) => {
          console.error('Error al cambiar estado de todas las órdenes:', error);
          alert('Error al cambiar el estado de las órdenes');
        }
      });
    }
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

  //Calcular días de duración
  calcularDiasDuracion(orden: any): number {
    if (!orden.fechaCreacion || !orden.fechaEntrega) return 0;
    const diff = Math.ceil(
      (orden.fechaEntrega.getTime() - orden.fechaCreacion.getTime()) / (1000 * 60 * 60 * 24)
    );
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
            console.log('Progreso actualizado:', response.message);

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
      console.log('📱 Notificación enviada:', mensaje);
      alert('✅ Notificación enviada al cliente.');
    }
  }

  // Generar factura
  generarFactura(orden: any) {
    console.log('🧾 Generando factura para:', orden.codigo);
    alert(`Factura generada para orden ${orden.codigo}`);
  }

  // Verificar auto-archivado
  verificarAutoArchivo() {
    const hoy = new Date();
    const ordenesParaArchivar = this.ordenesEntregadas.filter(orden => {
      // Usa 'archivado' en lugar de 'archivada'
      if (orden.archivado || !orden.fechaEntrega) return false;

      const diasDesdeEntrega = Math.ceil(
        (hoy.getTime() - new Date(orden.fechaEntrega).getTime()) / (1000 * 60 * 60 * 24)
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

  //Configurar días para auto-archivar
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

  //iltrar archivadas
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










  // Agrega estas propiedades al componente
  filtroModal: string = '';
  filtroPrioridadModal: string = '';
  ordenModal: string = 'fechaCreacion_desc';
  ordenesModalFiltradas: any[] = [];
  paginaActual: number = 0;
  tamanoPagina: number = 20; // Órdenes por página

  // Método para filtrar órdenes en el modal
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
            orden.codigo.toLowerCase().includes(busqueda) ||
            orden.clienteNombre.toLowerCase().includes(busqueda) ||
            orden.productoNombre.toLowerCase().includes(busqueda) ||
            orden.ventaId.toLowerCase().includes(busqueda) ||
            orden.tecnicoAsignado?.toLowerCase().includes(busqueda) ||
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

  // Método para ordenar órdenes
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
      if (valorA instanceof Date) valorA = valorA.getTime();
      if (valorB instanceof Date) valorB = valorB.getTime();

      // Orden ascendente/descendente
      if (direccion === 'desc') {
        return valorB > valorA ? 1 : valorB < valorA ? -1 : 0;
      } else {
        return valorA > valorB ? 1 : valorA < valorB ? -1 : 0;
      }
    });
  }

  // Método para resaltar texto coincidente
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

  // Verificar si una orden tiene coincidencia
  tieneCoincidencia(orden: any): boolean {
    if (!this.filtroModal) return false;

    const busqueda = this.filtroModal.toLowerCase();
    return [
      orden.codigo.toLowerCase(),
      orden.clienteNombre.toLowerCase(),
      orden.productoNombre.toLowerCase(),
      orden.ventaId.toLowerCase(),
      orden.tecnicoAsignado?.toLowerCase() || ''
    ].some(texto => texto.includes(busqueda));
  }

  // Establecer filtro de prioridad
  setFiltroPrioridadModal(prioridad: string) {
    this.filtroPrioridadModal = prioridad;
    this.filtrarOrdenesModal();
  }

  // Limpiar todos los filtros
  limpiarFiltroModal() {
    this.filtroModal = '';
    this.filtroPrioridadModal = '';
    this.filtrarOrdenesModal();
  }

  // Método para mover orden rápidamente (mover al siguiente estado)
  moverOrdenRapido(orden: any) {
    const siguienteEstado = this.getNextEstado(this.estadoModalActual);
    if (siguienteEstado && confirm(`¿Mover orden ${orden.codigo} a ${this.getEstadoTexto(siguienteEstado)}?`)) {
      this.cambiarEstado(orden, siguienteEstado);

      // Remover del array de órdenes filtradas
      this.ordenesModalFiltradas = this.ordenesModalFiltradas.filter(o => o.id !== orden.id);

      // Actualizar contador
      alert(`Orden ${orden.codigo} movida a ${this.getEstadoTexto(siguienteEstado)}`);
    }
  }

  // Método actualizado para abrir el modal
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
  }

  // Método actualizado para cerrar el modal
  cerrarModalOrdenes() {
    this.mostrarModalOrdenes = false;
    this.ordenesModal = [];
    this.ordenesModalFiltradas = [];
    this.tituloModalOrdenes = '';
    this.estadoModalActual = '';
    this.filtroModal = '';
    this.filtroPrioridadModal = '';
    this.paginaActual = 0;
  }

  // Propiedades calculadas para paginación
  get inicioPaginacion(): number {
    return this.paginaActual * this.tamanoPagina;
  }

  get finPaginacion(): number {
    return Math.min((this.paginaActual + 1) * this.tamanoPagina, this.ordenesModalFiltradas.length);
  }

  get totalPaginas(): number {
    return Math.ceil(this.ordenesModalFiltradas.length / this.tamanoPagina);
  }

  // Métodos de paginación
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

  // Obtener órdenes paginadas para mostrar
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

  // Método para ver detalle de venta (puedes implementarlo según necesites)
  verDetalleVenta(ventaId: string) {
    console.log('Ver detalle de venta:', ventaId);
    alert(`Funcionalidad para ver venta ${ventaId} en desarrollo`);
  }

  trackByProductoId(index: number, producto: any): any {
    // Usar el ID del producto, código o índice
    return producto?.id || producto?.datos?.id || producto?.datos?.codigo || index;
  }

  // En tu componente, agrega estos métodos

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

      // Calcular días restantes
      if (orden.fechaEntregaEstimada) {
        const fechaEntrega = new Date(orden.fechaEntregaEstimada);
        orden.diasRestantes = Math.ceil((fechaEntrega.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Calcular días en espera para órdenes pendientes
      if (orden.estado === 'pendiente_retiro' && orden.fechaRecepcionTienda) {
        const fechaRecepcion = new Date(orden.fechaRecepcionTienda);
        orden.diasEnEspera = Math.ceil((hoy.getTime() - fechaRecepcion.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Determinar prioridad
      if (orden.diasRestantes !== undefined) {
        if (orden.diasRestantes < 2) orden.prioridad = 'alta';
        else if (orden.diasRestantes < 5) orden.prioridad = 'media';
        else orden.prioridad = 'baja';
      }
    });
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
 * Calcular progreso según estado
 */
  private calcularProgresoPorEstado(estado: string): number {
    const progresos = {
      'en_tienda': 0,
      'proceso_laboratorio': 30,
      'listo_laboratorio': 70,
      'pendiente_retiro': 90,
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
}