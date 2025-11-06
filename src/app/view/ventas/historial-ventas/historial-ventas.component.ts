import { Component, OnInit, HostListener, ViewChild, TemplateRef } from '@angular/core';
import { SwalService } from '../../../core/services/swal/swal.service';
import { HistorialVentaService } from './../historial-ventas/historial-ventas.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';


@Component({
  selector: 'app-historial-ventas',
  standalone: false,
  templateUrl: './historial-ventas.component.html',
  styleUrls: ['./historial-ventas.component.scss']
})
export class HistorialVentasComponent implements OnInit {

  @ViewChild('cancelarVentaModal') cancelarVentaModal!: TemplateRef<any>;
  @ViewChild('detalleVentaModal') detalleVentaModal!: TemplateRef<any>;
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

  // Propiedades para el modal confirmacion cancelar venta
  selectedVenta: any = null;
  motivoCancelacion: string = '';

  constructor(
    private modalService: NgbModal,
    private swalService: SwalService, // Si tienes servicio de alertas
    private historialVentaService: HistorialVentaService // Tu servicio de ventas
  ) { }

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
    // Data dummy adaptada a la estructura del template
    this.ventasOriginales = [
      // Venta 1: Pago de contado con formulación clínica
      {
        id: 1,
        numeroControl: '001',
        paciente: {
          nombre: 'María González',
          cedula: '12345678'
        },
        fecha: new Date('2024-01-15T10:30:00'),
        estado: 'completada',
        montoTotal: 90,
        asesor: { id: 1, nombre: 'Ana García' },
        especialista: { id: 1, nombre: 'Dr. Pérez' },
        servicios: [{ nombre: 'Consulta oftalmológica' }],
        metodosPago: [
          {
            tipo: 'efectivo',
            monto: 90,
            conversionBs: 19635.3
          }
        ],
        mostrarDetalle: false,
        // Información adicional para el modal de detalle
        sede: 'guatire',
        moneda: 'dolar',
        formaPago: 'contado',
        descuento: 10,
        observaciones: 'Cliente satisfecho con la atención',
        asesorNombre: 'Ana García',
        productos: [
          {
            id: "17",
            nombre: "Lentes de contacto mensuales",
            codigo: "PR-000017",
            precio: 50,
            precioConIva: 50,
            cantidad: 2,
            aplicaIva: false,
            iva: 0,
            subtotal: 100,
            total: 100
          }
        ],
        subtotal: 100,
        totalIva: 0,
        totalDescuento: 10,
        total: 90,
        pagoCompleto: true,
        financiado: false,
        historiaMedica: {
          formulacion: {
            od: {
              esf: "+1.25",
              cil: "-0.50",
              eje: 180,
              add: "+1.75",
              alt: "24.5",
              dp: "62"
            },
            oi: {
              esf: "+1.00",
              cil: "-0.75",
              eje: 170,
              add: "+1.75",
              alt: "24.5",
              dp: "62"
            }
          },
          recomendaciones: {
            montura: "Metalica delgada",
            material: "AR_AZUL",
            cristal: "Progresivo digital"
          }
        }
      },

      // Venta 2: Cashea con cuotas adelantadas
      {
        id: 2,
        numeroControl: '002',
        paciente: {
          nombre: 'Carlos Rodríguez',
          cedula: '87654321'
        },
        fecha: new Date('2024-01-16T14:20:00'),
        estado: 'completada',
        montoTotal: 190,
        asesor: { id: 2, nombre: 'Carlos López' },
        especialista: { id: 2, nombre: 'Dra. Martínez' },
        servicios: [{ nombre: 'Examen visual completo' }],
        metodosPago: [
          {
            tipo: 'debito',
            monto: 76,
            conversionBs: 16580.92
          }
        ],
        mostrarDetalle: false,
        // Información adicional para el modal de detalle
        sede: 'guatire',
        moneda: 'dolar',
        formaPago: 'cashea',
        descuento: 5,
        observaciones: '',
        asesorNombre: 'Carlos López',
        productos: [
          {
            id: "18",
            nombre: "Armazón de diseño italiano",
            codigo: "PR-000018",
            precio: 120,
            precioConIva: 120,
            cantidad: 1,
            aplicaIva: false,
            iva: 0,
            subtotal: 120,
            total: 120
          },
          {
            id: "19",
            nombre: "Lentes fotocromáticos",
            codigo: "PR-000019",
            precio: 80,
            precioConIva: 80,
            cantidad: 1,
            aplicaIva: false,
            iva: 0,
            subtotal: 80,
            total: 80
          }
        ],
        subtotal: 200,
        totalIva: 0,
        totalDescuento: 10,
        total: 190,
        pagoCompleto: false,
        financiado: true,
        nivelCashea: "nivel3",
        montoInicial: 76,
        cantidadCuotas: 6,
        montoPorCuota: 19,
        cuotasAdelantadas: [
          {
            numero: 1,
            monto: 19,
            fechaVencimiento: "2024-02-16T00:00:00.000Z"
          },
          {
            numero: 2,
            monto: 19,
            fechaVencimiento: "2024-03-16T00:00:00.000Z"
          }
        ],
        totalAdelantado: 38,
        historiaMedica: {
          formulacion: {
            od: {
              esf: "-2.25",
              cil: "-1.25",
              eje: 10,
              add: "0.00",
              alt: "25.0",
              dp: "64"
            },
            oi: {
              esf: "-2.00",
              cil: "-1.00",
              eje: 170,
              add: "0.00",
              alt: "25.0",
              dp: "64"
            }
          },
          recomendaciones: {
            montura: "Plástico resistente",
            material: "FOTOCROMATICO",
            cristal: "Visión sencilla digital"
          }
        }
      },

      // Venta 3: Abono parcial sin formulación
      {
        id: 3,
        numeroControl: '003',
        paciente: {
          nombre: 'Laura Martínez',
          cedula: '11223344'
        },
        fecha: new Date('2024-01-17T11:15:00'),
        estado: 'completada',
        montoTotal: 34.68,
        asesor: { id: 3, nombre: 'María Rodríguez' },
        especialista: { id: 3, nombre: 'Dr. González' },
        servicios: [{ nombre: 'Venta de accesorios' }],
        metodosPago: [
          {
            tipo: 'efectivo',
            monto: 20,
            conversionBs: 20
          }
        ],
        mostrarDetalle: false,
        // Información adicional para el modal de detalle
        sede: 'guatire',
        moneda: 'bolivar',
        formaPago: 'abono',
        descuento: 0,
        observaciones: 'Cliente pagará el resto la próxima semana',
        asesorNombre: 'María Rodríguez',
        productos: [
          {
            id: "20",
            nombre: "Estuche para lentes",
            codigo: "PR-000020",
            precio: 15,
            precioConIva: 15,
            cantidad: 1,
            aplicaIva: true,
            iva: 2.4,
            subtotal: 15,
            total: 17.4
          },
          {
            id: "21",
            nombre: "Líquido limpiador",
            codigo: "PR-000021",
            precio: 8,
            precioConIva: 9.28,
            cantidad: 2,
            aplicaIva: true,
            iva: 1.28,
            subtotal: 16,
            total: 18.56
          }
        ],
        subtotal: 31,
        totalIva: 3.68,
        totalDescuento: 0,
        total: 34.68,
        montoAbonado: 20,
        pagoCompleto: false,
        financiado: false
      },

      // Venta 4: Cancelada
      {
        id: 4,
        numeroControl: '004',
        paciente: {
          nombre: 'Pedro López',
          cedula: '55667788'
        },
        fecha: new Date('2024-01-18T16:45:00'),
        estado: 'cancelada',
        montoTotal: 65,
        asesor: { id: 1, nombre: 'Ana García' },
        especialista: { id: 1, nombre: 'Dr. Pérez' },
        servicios: [{ nombre: 'Lentes de sol' }],
        metodosPago: [],
        mostrarDetalle: false,
        // Información adicional para el modal de detalle
        sede: 'guatire',
        moneda: 'dolar',
        formaPago: 'contado',
        descuento: 0,
        observaciones: '',
        asesorNombre: 'Ana García',
        productos: [
          {
            id: "22",
            nombre: "Lentes de sol polarizados",
            codigo: "PR-000022",
            precio: 65,
            precioConIva: 65,
            cantidad: 1,
            aplicaIva: false,
            iva: 0,
            subtotal: 65,
            total: 65
          }
        ],
        subtotal: 65,
        totalIva: 0,
        totalDescuento: 0,
        total: 65,
        pagoCompleto: false,
        financiado: false,
        motivo_cancelacion: 'Cliente cambió de opinión',
        fecha_cancelacion: new Date('2024-01-18T17:00:00')
      },

      // Venta 5: Cashea nivel 1
      {
        id: 5,
        numeroControl: '005',
        paciente: {
          nombre: 'Ana Silva',
          cedula: '99887766'
        },
        fecha: new Date('2024-01-19T09:30:00'),
        estado: 'completada',
        montoTotal: 127.5,
        asesor: { id: 2, nombre: 'Carlos López' },
        especialista: { id: 2, nombre: 'Dra. Martínez' },
        servicios: [{ nombre: 'Lentes de contacto anuales' }],
        metodosPago: [
          {
            tipo: 'credito',
            monto: 76.5,
            conversionBs: 16689.255
          }
        ],
        mostrarDetalle: false,
        // Información adicional para el modal de detalle
        sede: 'guatire',
        moneda: 'dolar',
        formaPago: 'cashea',
        descuento: 15,
        observaciones: 'Cliente preferió pagar más cuotas',
        asesorNombre: 'Carlos López',
        productos: [
          {
            id: "23",
            nombre: "Lentes de contacto anuales",
            codigo: "PR-000023",
            precio: 150,
            precioConIva: 150,
            cantidad: 1,
            aplicaIva: false,
            iva: 0,
            subtotal: 150,
            total: 150
          }
        ],
        subtotal: 150,
        totalIva: 0,
        totalDescuento: 22.5,
        total: 127.5,
        pagoCompleto: false,
        financiado: true,
        nivelCashea: "nivel1",
        montoInicial: 76.5,
        cantidadCuotas: 3,
        montoPorCuota: 17,
        cuotasAdelantadas: [
          {
            numero: 1,
            monto: 17,
            fechaVencimiento: "2024-02-19T00:00:00.000Z"
          }
        ],
        totalAdelantado: 17,
        historiaMedica: {
          formulacion: {
            od: {
              esf: "+0.75",
              cil: "-0.25",
              eje: 90,
              add: "+2.00",
              alt: "23.5",
              dp: "60"
            },
            oi: {
              esf: "+0.50",
              cil: "-0.50",
              eje: 85,
              add: "+2.00",
              alt: "23.5",
              dp: "60"
            }
          },
          recomendaciones: {
            montura: "Titanio ultraligero",
            material: "BLUE_CUT",
            cristal: "Progresivo premium"
          }
        }
      },

      // Venta 6: Pago mixto
      {
        id: 6,
        numeroControl: '006',
        paciente: {
          nombre: 'Roberto Hernández',
          cedula: '33445566'
        },
        fecha: new Date('2024-01-20T13:00:00'),
        estado: 'completada',
        montoTotal: 102.12,
        asesor: { id: 3, nombre: 'María Rodríguez' },
        especialista: { id: 3, nombre: 'Dr. González' },
        servicios: [{ nombre: 'Lentes para computadora' }],
        metodosPago: [
          {
            tipo: 'efectivo',
            monto: 50,
            conversionBs: 10908.5
          },
          {
            tipo: 'debito',
            monto: 52.12,
            conversionBs: 11368.98
          }
        ],
        mostrarDetalle: false,
        // Información adicional para el modal de detalle
        sede: 'guatire',
        moneda: 'dolar',
        formaPago: 'contado',
        descuento: 8,
        observaciones: 'Cliente usó dos métodos de pago',
        asesorNombre: 'María Rodríguez',
        productos: [
          {
            id: "24",
            nombre: "Lentes para computadora",
            codigo: "PR-000024",
            precio: 75,
            precioConIva: 75,
            cantidad: 1,
            aplicaIva: false,
            iva: 0,
            subtotal: 75,
            total: 75
          },
          {
            id: "25",
            nombre: "Toallitas limpiadoras",
            codigo: "PR-000025",
            precio: 12,
            precioConIva: 12,
            cantidad: 3,
            aplicaIva: false,
            iva: 0,
            subtotal: 36,
            total: 36
          }
        ],
        subtotal: 111,
        totalIva: 0,
        totalDescuento: 8.88,
        total: 102.12,
        pagoCompleto: true,
        financiado: false,
        historiaMedica: {
          formulacion: {
            od: {
              esf: "-1.50",
              cil: "-0.75",
              eje: 20,
              add: "0.00",
              alt: "26.0",
              dp: "66"
            },
            oi: {
              esf: "-1.25",
              cil: "-0.50",
              eje: 160,
              add: "0.00",
              alt: "26.0",
              dp: "66"
            }
          },
          recomendaciones: {
            montura: "Acetato moderno",
            material: "AR_VERDE",
            cristal: "Blue light filter"
          }
        }
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

  cancelarVenta(venta: any) {
    console.log('Cancelar venta:', venta);

    this.selectedVenta = venta;
    this.motivoCancelacion = '';

    // Abrir modal de confirmación
    this.modalService.open(this.cancelarVentaModal, {
      centered: true,
      backdrop: 'static',
      keyboard: false
    });
  }

  confirmarCancelacion(modal: any) {
    // Validar que se ingrese un motivo
    if (!this.motivoCancelacion?.trim()) {
      this.swalService.showWarning('Advertencia', 'Por favor ingrese el motivo de la cancelación.');
      return;
    }

    // Cerrar modal
    modal.close();

    this.swalService.showConfirm(
      'Confirmar Acción',
      `¿Está completamente seguro de cancelar la venta #${this.selectedVenta.id}? Esta acción no se puede deshacer.`,
      'Sí, Cancelar Venta',
      'Revisar'
    ).then((result) => {
      if (result.isConfirmed) {
        this.procesarCancelacion();
      } else {
        this.cancelarVenta(this.selectedVenta);
      }
    });
  }

  private procesarCancelacion() {
    console.log('Procesando cancelación de venta:', this.selectedVenta.id);

    // Usar el servicio simulado
    this.historialVentaService.cancelarVenta(this.selectedVenta.id, this.motivoCancelacion).subscribe({
      next: (response) => {
        if (response.success) {
          this.swalService.showSuccess('Éxito', response.message);

          // Actualizar el estado localmente
          this.selectedVenta.estado = 'cancelada';
          this.selectedVenta.motivo_cancelacion = this.motivoCancelacion;
          this.selectedVenta.fecha_cancelacion = response.data.fecha_cancelacion;

          console.log('Venta cancelada exitosamente:', this.selectedVenta);
        } else {
          // Manejar respuesta con error del servicio simulado
          this.swalService.showError('Error', response.message);
        }

        // Resetear variables
        this.selectedVenta = null;
        this.motivoCancelacion = '';
      },
      error: (error) => {
        console.error('Error en la solicitud de cancelación:', error);
        this.swalService.showError('Error', 'No se pudo completar la solicitud. Verifique su conexión.');

        // Resetear variables incluso en error
        this.selectedVenta = null;
        this.motivoCancelacion = '';
      }
    });
  }

  // Método alternativo si no tienes servicio
  private procesarCancelacionLocal() {
    // Simular procesamiento
    setTimeout(() => {
      this.swalService.showSuccess('Éxito', 'Venta cancelada correctamente.');

      // Actualizar estado localmente
      this.selectedVenta.estado = 'cancelada';
      this.selectedVenta.motivo_cancelacion = this.motivoCancelacion;
      this.selectedVenta.fecha_cancelacion = new Date().toISOString();

      // Resetear variables
      this.selectedVenta = null;
      this.motivoCancelacion = '';
    }, 1000);
  }

  verDetalleCompleto(venta: any) {
    console.log('Ver detalle completo:', venta);

    this.selectedVenta = venta;

    // Abrir modal de detalle completo
    this.modalService.open(this.detalleVentaModal, {
      centered: true,
      size: 'lg', // Modal grande para mostrar toda la información
      backdrop: true,
      keyboard: true
    });
  }

  // Asegúrate de tener este método para formatear números de venta
  formatNumeroVenta(id: number): string {
    if (!id) return '#000';
    return `#${id.toString().padStart(3, '0')}`;
  }

  // En tu componente HistorialVentasComponent, agrega este método:
  getTotalPagadoVenta(venta: any): number {
    if (!venta.metodosPago || !venta.metodosPago.length) return 0;

    return venta.metodosPago.reduce((total: number, pago: any) => {
      return total + (pago.monto || 0);
    }, 0);
  }

}
