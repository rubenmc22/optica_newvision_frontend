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
      ordenId: 'OT-2024-001',
      codigo: 'OT-2024-001',
      cliente: {
        ultima_historia_medica: {},
        tipo: "paciente",
        informacion: {
          tipoPersona: "natural",
          nombreCompleto: "María González",
          cedula: "12345678",
          telefono: "0412-1234567",
          email: "maria.gonzalez@email.com"
        }
      },
      clienteNombre: 'María González',
      clienteTelefono: '0412-1234567',
      productoNombre: 'Lente progresivo Essilor',
      productos: [
        {
          cantidad: 1,
          datos: {
            id: 1,
            nombre: "Lente progresivo Essilor",
            marca: "Essilor",
            color: null,
            codigo: "PR-000001",
            material: "Policarbonato",
            categoria: "Lentes Ópticos",
            modelo: "Varilux X"
          }
        }
      ],
      estado: 'en_tienda',
      prioridad: 'alta',
      fechaCreacion: new Date('2024-01-15T10:30:00'),
      fechaEntregaEstimada: new Date('2024-01-25T18:00:00'),
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
        adicion: '+2.00',
        observaciones: "Lente fotosensible"
      },
      especialista: {
        id: 3,
        nombre: "Dr. Carlos Mendoza",
        cargo: "Optometrista"
      },
      asesor: {
        id: 5,
        cedula: "24367965",
        nombre: "Ruben Dario Martinez Castro"
      },
      observaciones: "Cliente prefiere tonalidad azul en los antirreflejos"
    },
    {
      id: 2,
      ordenId: 'OT-2024-002',
      codigo: 'OT-2024-002',
      cliente: {
        ultima_historia_medica: {},
        tipo: "paciente",
        informacion: {
          tipoPersona: "natural",
          nombreCompleto: "Carlos Rodríguez Pérez del Valle",
          cedula: "87654321",
          telefono: "0414-9876543",
          email: "carlos.rodriguez@email.com"
        }
      },
      clienteNombre: 'Carlos Rodríguez Pérez del Valle',
      clienteTelefono: '0414-9876543',
      productoNombre: 'Lente fotocromático Transitions XTRActive',
      productos: [
        {
          cantidad: 2,
          datos: {
            id: 27,
            nombre: "Lente fotocromático Transitions XTRActive",
            marca: "Transitions",
            color: null,
            codigo: "PR-000027",
            material: "Plástico",
            categoria: "Lentes Ópticos",
            modelo: "XTRActive"
          }
        }
      ],
      estado: 'proceso_laboratorio',
      prioridad: 'media',
      fechaCreacion: new Date('2024-01-10T09:15:00'),
      fechaEntregaEstimada: new Date('2024-01-20T17:00:00'),
      diasRestantes: 3,
      progreso: 60,
      tecnicoAsignado: 'Juan Pérez Martínez',
      fechaInicioProceso: new Date('2024-01-12T14:20:00'),
      fechaTerminacion: null,
      fechaRecepcionTienda: null,
      fechaEntrega: null,
      diasEnEspera: 0,
      ventaId: 'V-000002',
      entregadoPor: '',
      archivada: false,
      formulacion: {
        esferaOD: '-2.25',
        esferaOI: '-2.00',
        cilindroOD: '-0.75',
        cilindroOI: '-0.50',
        ejeOD: '180',
        ejeOI: '175',
        adicion: '+1.50'
      },
      especialista: {
        id: 4,
        nombre: "Dra. Ana López",
        cargo: "Optometrista Senior"
      },
      asesor: {
        id: 2,
        cedula: "19876543",
        nombre: "Laura Fernández"
      },
      observaciones: ""
    },
    {
      id: 3,
      ordenId: 'OT-2024-003',
      codigo: 'OT-2024-003',
      cliente: {
        ultima_historia_medica: {},
        tipo: "paciente",
        informacion: {
          tipoPersona: "natural",
          nombreCompleto: "Ana Martínez",
          cedula: "11223344",
          telefono: "0416-5558888",
          email: "ana.martinez@email.com"
        }
      },
      clienteNombre: 'Ana Martínez',
      clienteTelefono: '0416-5558888',
      productoNombre: 'Lente antireflejo Crizal',
      productos: [
        {
          cantidad: 1,
          datos: {
            id: 15,
            nombre: "Lente antireflejo Crizal",
            marca: "Essilor",
            color: null,
            codigo: "PR-000015",
            material: "Policarbonato",
            categoria: "Lentes Ópticos",
            modelo: "Crizal Prevencia"
          }
        }
      ],
      estado: 'listo_laboratorio',
      prioridad: 'baja',
      fechaCreacion: new Date('2024-01-05T11:45:00'),
      fechaEntregaEstimada: new Date('2024-01-15T16:30:00'),
      diasRestantes: 0,
      progreso: 100,
      tecnicoAsignado: 'Pedro Sánchez',
      fechaInicioProceso: new Date('2024-01-07T10:00:00'),
      fechaTerminacion: new Date('2024-01-12T15:20:00'),
      fechaRecepcionTienda: null,
      fechaEntrega: null,
      diasEnEspera: 0,
      ventaId: 'V-000003',
      entregadoPor: '',
      archivada: false,
      formulacion: {
        esferaOD: '+0.75',
        esferaOI: '+1.00',
        cilindroOD: null,
        cilindroOI: null,
        ejeOD: null,
        ejeOI: null,
        adicion: '+1.75'
      },
      especialista: {
        id: 3,
        nombre: "Dr. Carlos Mendoza",
        cargo: "Optometrista"
      },
      asesor: {
        id: 1,
        cedula: "12345678",
        nombre: "José Ramírez"
      },
      observaciones: "Incluir limpieza especial con paño de microfibra"
    },
    {
      id: 4,
      ordenId: 'OT-2024-004',
      codigo: 'OT-2024-004',
      cliente: {
        ultima_historia_medica: {},
        tipo: "paciente",
        informacion: {
          tipoPersona: "natural",
          nombreCompleto: "Luis Fernández",
          cedula: "55667788",
          telefono: "0424-3337777",
          email: "luis.fernandez@email.com"
        }
      },
      clienteNombre: 'Luis Fernández',
      clienteTelefono: '0424-3337777',
      productoNombre: 'Armazón Ray-Ban + Lentes',
      productos: [
        {
          cantidad: 1,
          datos: {
            id: 42,
            nombre: "Armazón Ray-Ban",
            marca: "Ray-Ban",
            color: "Negro",
            codigo: "PR-000042",
            material: "Acetato",
            categoria: "Armazones",
            modelo: "Wayfarer"
          }
        },
        {
          cantidad: 1,
          datos: {
            id: 15,
            nombre: "Lente antireflejo",
            marca: "Essilor",
            color: null,
            codigo: "PR-000015",
            material: "Policarbonato",
            categoria: "Lentes Ópticos",
            modelo: "Crizal"
          }
        }
      ],
      estado: 'pendiente_retiro',
      prioridad: 'media',
      fechaCreacion: new Date('2024-01-03T14:20:00'),
      fechaEntregaEstimada: new Date('2024-01-10T12:00:00'),
      diasRestantes: -2,
      progreso: 100,
      tecnicoAsignado: 'María Gómez',
      fechaInicioProceso: new Date('2024-01-04T09:30:00'),
      fechaTerminacion: new Date('2024-01-08T16:45:00'),
      fechaRecepcionTienda: new Date('2024-01-09T11:20:00'),
      fechaEntrega: null,
      diasEnEspera: 4,
      ventaId: 'V-000004',
      entregadoPor: '',
      archivada: false,
      formulacion: {
        esferaOD: '-3.25',
        esferaOI: '-3.50',
        cilindroOD: '-1.25',
        cilindroOI: '-1.00',
        ejeOD: '10',
        ejeOI: '5',
        adicion: null
      },
      especialista: {
        id: 2,
        nombre: "Dr. Miguel Torres",
        cargo: "Optometrista"
      },
      asesor: {
        id: 3,
        cedula: "33445566",
        nombre: "Carmen Rojas"
      },
      observaciones: "Cliente solicita armazón ajustado, puente más amplio"
    },
    {
      id: 5,
      ordenId: 'OT-2024-005',
      codigo: 'OT-2024-005',
      cliente: {
        ultima_historia_medica: {},
        tipo: "paciente",
        informacion: {
          tipoPersona: "natural",
          nombreCompleto: "Ana Rodríguez",
          cedula: "99887766",
          telefono: "0424-5556677",
          email: "ana.rodriguez@email.com"
        }
      },
      clienteNombre: 'Ana Rodríguez',
      clienteTelefono: '0424-5556677',
      productoNombre: 'Lente Blue Light Filter',
      productos: [
        {
          cantidad: 1,
          datos: {
            id: 38,
            nombre: "Lente Blue Light Filter",
            marca: "Essilor",
            color: null,
            codigo: "PR-000038",
            material: "Policarbonato",
            categoria: "Lentes Ópticos",
            modelo: "Eyezen"
          }
        }
      ],
      estado: 'entregado',
      prioridad: 'media',
      fechaCreacion: new Date('2024-01-05T13:10:00'),
      fechaEntregaEstimada: new Date('2024-01-15T17:00:00'),
      diasRestantes: 0,
      progreso: 100,
      tecnicoAsignado: 'Luis Gómez',
      fechaInicioProceso: new Date('2024-01-07T10:45:00'),
      fechaTerminacion: new Date('2024-01-10T15:30:00'),
      fechaRecepcionTienda: new Date('2024-01-11T11:15:00'),
      fechaEntrega: new Date('2024-01-12T16:20:00'),
      diasEnEspera: 1,
      ventaId: 'V-000005',
      entregadoPor: 'María Pérez',
      archivada: false,
      fechaArchivado: null,
      motivoArchivo: null,
      formulacion: {
        esferaOD: '+0.50',
        esferaOI: '+0.75',
        cilindroOD: '-0.25',
        cilindroOI: '-0.25',
        ejeOD: '90',
        ejeOI: '90',
        adicion: '+1.25'
      },
      especialista: {
        id: 1,
        nombre: "Dr. Roberto Silva",
        cargo: "Optometrista Jefe"
      },
      asesor: {
        id: 4,
        cedula: "44556677",
        nombre: "Pedro Castillo"
      },
      observaciones: "Cliente muy satisfecho con el resultado"
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

  // Archivar orden
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

  // Verificar auto-archivado
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

  getEstadoTexto(estado: string): string {
    const estados = {
      'en_tienda': 'En Tienda',
      'proceso_laboratorio': 'En Laboratorio',
      'listo_laboratorio': 'Listo en Lab',
      'pendiente_retiro': 'Pendiente Retiro',
      'entregado': 'Entregado'
    };
    return estados[estado] || estado;
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
}