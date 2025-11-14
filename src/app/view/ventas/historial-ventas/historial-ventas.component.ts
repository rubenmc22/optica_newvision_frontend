import { Component, OnInit, HostListener, ViewChild, TemplateRef } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
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
  @ViewChild('editarVentaModal') editarVentaModal!: TemplateRef<any>;

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

  // Nuevas propiedades para edición de ventas
  editarVentaForm!: FormGroup;
  monedaActual: string = 'USD';

  constructor(
    private modalService: NgbModal,
    private swalService: SwalService,
    private historialVentaService: HistorialVentaService,
    private fb: FormBuilder
  ) { }

  ngOnInit() {
    this.cargarDatosIniciales();
    this.setMaxDate();

    // Suscribirse a cambios en el monto abonado
    this.editarVentaForm.get('montoAbonado')?.valueChanges.subscribe(() => {
      // Forzar actualización de la UI
    });

    // Suscribirse a cambios en los métodos de pago
    this.metodosPagoArray.valueChanges.subscribe(() => {
      // Forzar actualización de la UI
    });
  }

  private setMaxDate(): void {
    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, '0');
    const day = String(hoy.getDate()).padStart(2, '0');
    this.maxDate = `${year}-${month}-${day}`;
    console.log('Fecha máxima configurada:', this.maxDate);
  }

  // Getter para el FormArray de métodos de pago
  get metodosPagoArray(): FormArray {
    return this.editarVentaForm.get('metodosPago') as FormArray;
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
  onEscapeKey(event: any): void {
    if (this.showDatepicker) {
      this.closeDatepicker();
    }
  }

  aplicarFechas(): void {
    this.closeDatepicker();
    this.filtrarVentas();
  }

  setRangoPreset(tipo: string): void {
    const hoy = new Date();
    let fechaDesde = new Date();
    let fechaHasta = new Date();

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
      const hoy = new Date().toISOString().split('T')[0];

      if (this.fechaUnica > hoy) {
        this.fechaUnica = '';
        this.filtros.fechaDesde = '';
        this.filtros.fechaHasta = '';
        alert('No puedes seleccionar fechas futuras');
        return;
      }

      this.filtros.fechaDesde = this.fechaUnica;
      this.filtros.fechaHasta = this.fechaUnica;
      this.filtrarVentas();
    } else {
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
    this.ventasOriginales = [
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
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private filtrarVentas(): void {
    this.ventasFiltradas = this.ventasOriginales.filter(venta => {
      const coincideBusqueda = !this.filtros.busquedaGeneral ||
        this.normalizarTexto(venta.paciente?.nombre).includes(this.normalizarTexto(this.filtros.busquedaGeneral)) ||
        venta.paciente?.cedula?.includes(this.filtros.busquedaGeneral) ||
        venta.numeroControl?.toString().includes(this.filtros.busquedaGeneral);

      const coincideAsesor = !this.filtros.asesor || venta.asesor?.id == this.filtros.asesor;

      const coincideEspecialista = !this.filtros.especialista || venta.especialista?.id == this.filtros.especialista;

      const coincideEstado = !this.filtros.estado || venta.estado === this.filtros.estado;

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
    this.paginaActual = 1;
  }

  // Método para cambiar items por página
  cambiarItemsPorPagina(): void {
    this.paginaActual = 1;
    this.totalPaginas = Math.ceil(this.totalVentas / this.itemsPorPagina);
  }

  // Método mejorado para obtener rango de páginas (más inteligente)
  getRangoPaginas(): number[] {
    this.totalPaginas = Math.ceil(this.totalVentas / this.itemsPorPagina);

    if (this.totalPaginas <= 7) {
      return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
    }

    const paginas: number[] = [];
    const paginaInicio = Math.max(2, this.paginaActual - 1);
    const paginaFin = Math.min(this.totalPaginas - 1, this.paginaActual + 1);

    paginas.push(1);

    if (paginaInicio > 2) {
      paginas.push(-1);
    }

    for (let i = paginaInicio; i <= paginaFin; i++) {
      paginas.push(i);
    }

    if (paginaFin < this.totalPaginas - 1) {
      paginas.push(-1);
    }

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
  }

  generarInforme() {
    console.log('Generar informe con filtros:', this.filtros);
  }

  // Método auxiliar para formatear el nombre (opcional)
  getNombreFormateado(nombreCompleto: string): string {
    if (!nombreCompleto) return '';

    const partes = nombreCompleto.split(' ');

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

    this.modalService.open(this.cancelarVentaModal, {
      centered: true,
      backdrop: 'static',
      keyboard: false
    });
  }

  confirmarCancelacion(modal: any) {
    if (!this.motivoCancelacion?.trim()) {
      this.swalService.showWarning('Advertencia', 'Por favor ingrese el motivo de la cancelación.');
      return;
    }

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

    this.historialVentaService.cancelarVenta(this.selectedVenta.id, this.motivoCancelacion).subscribe({
      next: (response) => {
        if (response.success) {
          this.swalService.showSuccess('Éxito', response.message);

          this.selectedVenta.estado = 'cancelada';
          this.selectedVenta.motivo_cancelacion = this.motivoCancelacion;
          this.selectedVenta.fecha_cancelacion = response.data.fecha_cancelacion;

          console.log('Venta cancelada exitosamente:', this.selectedVenta);
        } else {
          this.swalService.showError('Error', response.message);
        }

        this.selectedVenta = null;
        this.motivoCancelacion = '';
      },
      error: (error) => {
        console.error('Error en la solicitud de cancelación:', error);
        this.swalService.showError('Error', 'No se pudo completar la solicitud. Verifique su conexión.');

        this.selectedVenta = null;
        this.motivoCancelacion = '';
      }
    });
  }

  // Método alternativo si no tienes servicio
  private procesarCancelacionLocal() {
    setTimeout(() => {
      this.swalService.showSuccess('Éxito', 'Venta cancelada correctamente.');

      this.selectedVenta.estado = 'cancelada';
      this.selectedVenta.motivo_cancelacion = this.motivoCancelacion;
      this.selectedVenta.fecha_cancelacion = new Date().toISOString();

      this.selectedVenta = null;
      this.motivoCancelacion = '';
    }, 1000);
  }

  verDetalleCompleto(venta: any) {
    console.log('Ver detalle completo:', venta);

    this.selectedVenta = venta;

    this.modalService.open(this.detalleVentaModal, {
      centered: true,
      size: 'lg',
      backdrop: true,
      keyboard: true
    });
  }

  formatNumeroVenta(id: number): string {
    if (!id) return '#000';
    return `#${id.toString().padStart(3, '0')}`;
  }

  getTotalPagadoVenta(venta: any): number {
    if (!venta.metodosPago || !venta.metodosPago.length) return 0;

    return venta.metodosPago.reduce((total: number, pago: any) => {
      return total + (pago.monto || 0);
    }, 0);
  }

  // ========== MÉTODOS PARA EDICIÓN DE VENTAS ==========

  // Método para determinar si mostrar el botón de edición
  mostrarBotonEditar(venta: any): boolean {
    if (!venta || venta.estado === 'cancelada') {
      return false;
    }

    const esAbonoConDeuda = venta.formaPago === 'abono' &&
      venta.montoAbonado < venta.total;

    return esAbonoConDeuda;
  }

  // Método para editar venta
  editarVenta(venta: any): void {
    this.selectedVenta = venta;

    // Usar el método corregido
    this.reinicializarFormularioConDeuda();

    this.modalService.open(this.editarVentaModal, {
      centered: true,
      size: 'lg',
      backdrop: 'static'
    });
  }

  // CORRECCIÓN: Reinicializar el formulario con la deuda actual
  reinicializarFormularioConDeuda() {
    const montoDeuda = this.calcularMontoDeuda();

    console.log('Reinicializando formulario con deuda:', montoDeuda); // DEBUG

    // Si el formulario ya existe, actualiza el valor
    if (this.editarVentaForm) {
      this.editarVentaForm.patchValue({
        montoAbonado: montoDeuda,
        observaciones: this.selectedVenta.observaciones || ''
      });

      // Limpiar métodos de pago anteriores
      this.metodosPagoArray.clear();

      // Agregar métodos de pago existentes si los hay
      if (this.selectedVenta.metodosPago && this.selectedVenta.metodosPago.length > 0) {
        this.selectedVenta.metodosPago.forEach((metodo: any) => {
          this.agregarMetodoPagoExistente(metodo);
        });
      } else {
        // Agregar un método vacío por defecto
        this.agregarMetodoPago();
      }
    } else {
      // Si no existe, crear el formulario
      this.inicializarFormulario();
    }

    // Actualizar validadores
    this.editarVentaForm.get('montoAbonado')?.setValidators([
      Validators.required,
      Validators.min(0),
      Validators.max(this.selectedVenta.total)
    ]);
    this.editarVentaForm.get('montoAbonado')?.updateValueAndValidity();
  }

  // CORRECCIÓN: Calcular monto de deuda correctamente
  calcularMontoDeuda(): number {
    if (!this.selectedVenta) return 0;

    const total = this.selectedVenta.total || 0;
    const abonado = this.selectedVenta.montoAbonado || 0;
    const deuda = total - abonado;

    return Math.max(0, deuda);
  }

  validarMontoMaximo(value: number) {
    if (value === null || value === undefined) return;

    const montoDeuda = this.calcularMontoDeuda();

    if (value > montoDeuda) {
      console.log('Ajustando monto automáticamente de', value, 'a', montoDeuda);

      this.editarVentaForm.patchValue({
        montoAbonado: montoDeuda
      }, { emitEvent: false });
    }
  }

  private agregarMetodoPagoExistente(metodo: any): void {
    const metodoGroup = this.fb.group({
      tipo: [metodo.tipo || '', Validators.required],
      monto: [metodo.monto || 0, [Validators.required]]
    });
    this.metodosPagoArray.push(metodoGroup);
  }

  removerMetodoPago(index: number): void {
    this.metodosPagoArray.removeAt(index);
  }

  calcularTotalMetodosPago(): number {
    return this.metodosPagoArray.controls.reduce((total, control) => {
      return total + (control.get('monto')?.value || 0);
    }, 0);
  }

  mostrarResumenCambio(): boolean {
    const montoAbonado = this.editarVentaForm.get('montoAbonado')?.value;
    return montoAbonado !== null && montoAbonado !== undefined && montoAbonado !== this.selectedVenta?.montoAbonado;
  }

  guardarEdicionVenta(modal: any): void {
    if (this.editarVentaForm.invalid) {
      this.marcarControlesComoSucios(this.editarVentaForm);
      this.swalService.showWarning('Advertencia', 'Por favor complete todos los campos requeridos correctamente.');
      return;
    }

    const formValue = this.editarVentaForm.value;
    const totalMetodosPago = this.calcularTotalMetodosPago();

    if (Math.abs(totalMetodosPago - formValue.montoAbonado) > 0.01) {
      // Usar toLocaleString en lugar del pipe currency
      const totalMetodosStr = totalMetodosPago.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
      const montoAbonadoStr = formValue.montoAbonado.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

      this.swalService.showWarning('Advertencia',
        `La suma de los métodos de pago (${totalMetodosStr}) no coincide con el monto abonado (${montoAbonadoStr}).`);
      return;
    }

    // Formatear los valores para el mensaje de confirmación
    const nuevoMontoStr = formValue.montoAbonado.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
    const nuevoSaldoStr = (this.selectedVenta.total - formValue.montoAbonado).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

    this.swalService.showConfirm(
      'Confirmar Edición',
      `¿Está seguro de actualizar el abono de esta venta?<br>
     <strong>Nuevo monto abonado:</strong> ${nuevoMontoStr}<br>
     <strong>Nuevo saldo pendiente:</strong> ${nuevoSaldoStr}`,
      'Sí, Guardar Cambios',
      'Revisar'
    ).then((result) => {
      if (result.isConfirmed) {
        this.procesarEdicionVenta(modal, formValue);
      }
    });
  }

  private procesarEdicionVenta(modal: any, formData: any): void {
    const datosActualizados = {
      id: this.selectedVenta.id,
      montoAbonado: formData.montoAbonado,
      observaciones: formData.observaciones,
      metodosPago: formData.metodosPago,
      fechaActualizacion: new Date().toISOString()
    };

    /*  this.historialVentaService.actualizarVentaAbono(datosActualizados).subscribe({
        next: (response) => {
          if (response.success) {
            this.swalService.showSuccess('Éxito', 'Venta actualizada correctamente.');
  
            this.actualizarVentaLocal(response.data);
  
            modal.close();
  
            this.generarNuevoRecibo(response.data);
          } else {
            this.swalService.showError('Error', response.message);
          }
        },
        error: (error) => {
          console.error('Error al actualizar venta:', error);
          this.swalService.showError('Error', 'No se pudo actualizar la venta. Verifique su conexión.');
        }
      });*/
  }

  private actualizarVentaLocal(ventaActualizada: any): void {
    const index = this.ventasOriginales.findIndex(v => v.id === ventaActualizada.id);
    if (index !== -1) {
      this.ventasOriginales[index] = { ...this.ventasOriginales[index], ...ventaActualizada };
    }

    const indexFiltrado = this.ventasFiltradas.findIndex(v => v.id === ventaActualizada.id);
    if (indexFiltrado !== -1) {
      this.ventasFiltradas[indexFiltrado] = { ...this.ventasFiltradas[indexFiltrado], ...ventaActualizada };
    }
  }

  private generarNuevoRecibo(venta: any): void {
    console.log('Generando nuevo recibo para venta:', venta);
  }

  private marcarControlesComoSucios(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      if (control instanceof FormGroup) {
        this.marcarControlesComoSucios(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach((arrayControl: AbstractControl) => {
          if (arrayControl instanceof FormGroup) {
            this.marcarControlesComoSucios(arrayControl);
          } else {
            arrayControl.markAsTouched();
          }
        });
      } else {
        control?.markAsTouched();
      }
    });
  }

  getMontoRestanteParaMetodo(index: number): number {
    const montoAbonado = this.editarVentaForm.get('montoAbonado')?.value || 0;
    const totalOtrosMetodos = this.metodosPagoArray.controls.reduce((total, control, i) => {
      if (i !== index) {
        return total + (control.get('monto')?.value || 0);
      }
      return total;
    }, 0);

    return Math.max(0, montoAbonado - totalOtrosMetodos);
  }

  getMontoMaximo(): number {
    return this.calcularMontoDeuda();
  }

  calcularDiferenciaMetodos(): number {
    const totalMetodos = this.calcularTotalMetodosPago();
    const montoAbonado = this.editarVentaForm?.get('montoAbonado')?.value || 0;
    const montoDeuda = this.calcularMontoDeuda();

    const totalRequerido = montoDeuda + montoAbonado;

    return Math.abs(totalMetodos - totalRequerido);
  }

  validarPagoCompleto(): boolean {
    const totalMetodos = this.calcularTotalMetodosPago();
    const montoAbonado = this.editarVentaForm?.get('montoAbonado')?.value || 0;
    const montoDeuda = this.calcularMontoDeuda();
    const totalRequerido = montoDeuda + montoAbonado;

    return Math.abs(totalMetodos - totalRequerido) < 0.01;
  }

  calcularPorcentajeAbonado(): number {
    if (!this.selectedVenta || !this.selectedVenta.total) return 0;

    const montoAbonadoAnterior = this.selectedVenta.montoAbonado || 0;
    const nuevoMontoAbonado = this.editarVentaForm?.get('montoAbonado')?.value || 0;

    const totalAbonado = montoAbonadoAnterior + nuevoMontoAbonado;

    let porcentaje = (totalAbonado / this.selectedVenta.total) * 100;

    porcentaje = Math.min(porcentaje, 100);

    return Math.round(porcentaje);
  }

  getMontosProgreso(): string {
    if (!this.selectedVenta) return '$0.00 / $0.00';

    const montoAbonadoAnterior = this.selectedVenta.montoAbonado || 0;
    const nuevoMontoAbonado = this.editarVentaForm?.get('montoAbonado')?.value || 0;
    const totalAbonado = montoAbonadoAnterior + nuevoMontoAbonado;

    return `${this.formatearMoneda(totalAbonado)} / ${this.formatearMoneda(this.selectedVenta.total)}`;
  }

  onMontoAbonadoChange() {
    setTimeout(() => {
      this.calcularPorcentajeAbonado();
    });
  }

  abrirModalEdicion(venta: any) {
    this.selectedVenta = venta;
    this.reinicializarFormularioConDeuda();
  }

  inicializarFormulario() {
    const montoDeuda = this.calcularMontoDeuda();

    this.editarVentaForm = this.fb.group({
      montoAbonado: [montoDeuda, [
        Validators.required,
        Validators.min(0),
        Validators.max(this.selectedVenta?.total || 0)
      ]],
      metodosPago: this.fb.array([]),
      observaciones: ['']
    });

    this.agregarMetodoPago();

    this.editarVentaForm.get('montoAbonado')?.valueChanges.subscribe(value => {
      this.validarMontoMaximo(value);
    });

    this.metodosPagoArray.valueChanges.subscribe(() => {
    });
  }

  getMontoMaximoPermitido(): number {
    return this.calcularMontoDeuda();
  }

  // CORRECCIÓN: Determinar moneda según tipo de pago
  actualizarMonedaPorMetodoPago(tipoPago: string) {
    switch (tipoPago) {
      case 'efectivo':
        // Efectivo puede ser USD o EUR - mantener la actual o usar USD por defecto
        if (this.monedaActual !== 'USD' && this.monedaActual !== 'EUR') {
          this.monedaActual = 'USD';
        }
        break;
      case 'pagomovil':
      case 'transferencia':
      case 'debito':
      case 'credito':
        this.monedaActual = 'Bs';
        break;
      case 'zelle':
        this.monedaActual = 'USD';
        break;
      default:
        // Mantener moneda actual si no se reconoce el tipo
        break;
    }
  }

  // CORRECCIÓN: Obtener símbolo de moneda
  getSimboloMoneda(): string {
    switch (this.monedaActual) {
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'Bs': return 'Bs';
      default: return '$';
    }
  }

  // CORRECCIÓN: Formatear moneda dinámicamente
  formatearMoneda(monto: number): string {
    if (monto === null || monto === undefined) return this.getSimboloMoneda() + '0.00';

    switch (this.monedaActual) {
      case 'USD':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(monto);

      case 'EUR':
        return new Intl.NumberFormat('de-DE', {
          style: 'currency',
          currency: 'EUR',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(monto);

      case 'Bs':
        // Para Bolívares, usar formato personalizado
        return `Bs ${monto.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;

      default:
        return '$' + monto.toFixed(2);
    }
  }

  // CORRECCIÓN: Para usar en pipes de Angular
  getMonedaParaPipe(): string {
    switch (this.monedaActual) {
      case 'USD': return 'USD';
      case 'EUR': return 'EUR';
      case 'Bs': return ' Bs'; // Los pipes de Angular no tienen BS, usar USD como base
      default: return 'USD';
    }
  }

  // CORRECCIÓN: Convertir montos si es necesario (para cálculos internos)
  convertirMontoSiEsNecesario(monto: number): number {
    // Aquí puedes implementar la lógica de conversión de divisas
    // Por ahora devolvemos el mismo monto
    return monto;
  }

  // CORRECCIÓN: Cuando se agrega un nuevo método de pago
  agregarMetodoPago(): void {
    const metodoGroup = this.fb.group({
      tipo: ['', Validators.required],
      monto: [0, [Validators.required]]
    });

    this.metodosPagoArray.push(metodoGroup);

    // Suscribirse a cambios del tipo de pago
    const index = this.metodosPagoArray.length - 1;
    metodoGroup.get('tipo')?.valueChanges.subscribe(tipo => {
      this.onMetodoPagoChange(index);
    });
  }

  // Función para verificar si hay algún método de pago en efectivo seleccionado
  hayMetodoEfectivoSeleccionado(): boolean {
    if (!this.metodosPagoArray || this.metodosPagoArray.length === 0) {
      return false;
    }

    // Verificar si algún método de pago es efectivo
    const hayEfectivo = this.metodosPagoArray.controls.some(control =>
      control.get('tipo')?.value === 'efectivo'
    );

    // Solo mostrar si hay efectivo Y la moneda actual es USD o EUR
    return hayEfectivo && (this.monedaActual === 'USD' || this.monedaActual === 'EUR');
  }

  // También actualiza la función onMetodoPagoChange para manejar mejor los cambios
  onMetodoPagoChange(index: number) {
    const metodoControl = this.metodosPagoArray.at(index);
    const tipoPago = metodoControl?.get('tipo')?.value;

    switch (tipoPago) {
      case 'efectivo':
        // Mantener USD/EUR actual, no cambiar automáticamente
        if (this.monedaActual !== 'USD' && this.monedaActual !== 'EUR') {
          this.monedaActual = 'USD'; // Default a USD si no está en USD/EUR
        }
        break;
      case 'pagomovil':
      case 'transferencia':
      case 'debito':
      case 'credito':
        this.monedaActual = 'BS';
        break;
      case 'zelle':
        this.monedaActual = 'USD';
        break;
      default:
        // Si se deselecciona un método, mantener moneda actual
        break;
    }
  }
}


