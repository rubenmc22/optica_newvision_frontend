import { Component, OnInit, HostListener, ViewChild, TemplateRef } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { SwalService } from '../../../core/services/swal/swal.service';
import { HistorialVentaService } from './../historial-ventas/historial-ventas.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Tasa } from '../../../Interfaces/models-interface';
import { GenerarVentaService } from './../generar-venta/generar-venta.service';
import { take } from 'rxjs/operators';




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
  monedaEfectivo: string = 'USD'; // Solo para el selector de moneda en efectivo en el modal

  //Propiedades para tasas de cambio
  tasasPorId: { [key: string]: number } = {};
  tasasDisponibles: any[] = [];
  monedasDisponibles: any[] = [];

  // Mapeos de monedas
  private readonly idMap: Record<string, string> = {
    usd: 'dolar',
    ves: 'bolivar',
    bs: 'bolivar',
    eur: 'euro',
    $: 'dolar',
    '€': 'euro'
  };

  constructor(
    private modalService: NgbModal,
    private swalService: SwalService,
    private historialVentaService: HistorialVentaService,
    private fb: FormBuilder,
    private generarVentaService: GenerarVentaService,
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
    //console.log('Fecha máxima configurada:', this.maxDate);
  }

  // Getter para el FormArray de métodos de pago
  get metodosPagoArray(): FormArray {
    return this.editarVentaForm.get('metodosPago') as FormArray;
  }

  private cargarDatosIniciales(): void {
    // Cargar lista de asesores 
    this.asesores = [
      { id: 1, nombre: 'Ana García' },
      { id: 2, nombre: 'Carlos López' },
      { id: 3, nombre: 'María Rodríguez' }
    ];

    // Cargar lista de especialistas 
    this.especialistas = [
      { id: 1, nombre: 'Dr. Pérez' },
      { id: 2, nombre: 'Dra. Martínez' },
      { id: 3, nombre: 'Dr. González' }
    ];

    // Cargar tasas de cambio desde el servicio
    this.generarVentaService.getTasas().pipe(take(1)).subscribe({
      next: (tasasResponse) => {
        const tasas = tasasResponse.tasas ?? [];
        this.tasasDisponibles = tasas;
        this.monedasDisponibles = tasas;

        // CORRECCIÓN: Mapear correctamente las tasas
        this.tasasPorId = {
          'dolar': tasas.find(t => t.id === 'dolar')?.valor || 36.5,
          'euro': tasas.find(t => t.id === 'euro')?.valor || 39.2,
          'bolivar': 1
        };

        // console.log('Tasas de cambio cargadas:', this.tasasPorId);
        this.cargarVentas();
      },
      error: (error) => {
        console.error('Error al cargar tasas de cambio:', error);
        // Valores por defecto
        this.tasasPorId = {
          'dolar': 36.5,
          'euro': 39.2,
          'bolivar': 1
        };
        this.cargarVentas();
      }
    });
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

  getMonedaVenta(): string {
    return this.selectedVenta?.moneda || 'dolar';
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
        estadoPago: 'completado', // ✅ NUEVO: Estado del pago
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
        estadoPago: 'parcial', // ✅ NUEVO: Estado del pago
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
        estadoPago: 'parcial', // ✅ NUEVO: Estado del pago
        montoTotal: 52500.32,
        asesor: { id: 3, nombre: 'María Rodríguez' },
        especialista: { id: 3, nombre: 'Dr. González' },
        servicios: [{ nombre: 'Venta de accesorios' }],
        metodosPago: [
          {
            tipo: 'efectivo',
            monto: 30000,
            conversionBs: 30000
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
            precio: 26000,
            precioConIva: 30000,
            cantidad: 1,
            aplicaIva: true,
            iva: 4000,
            subtotal: 26000,
            total: 30000
          },
          {
            id: "21",
            nombre: "Líquido limpiador",
            codigo: "PR-000021",
            precio: 10000,
            precioConIva: 11200,
            cantidad: 2,
            aplicaIva: true,
            iva: 1200,
            subtotal: 20000,
            total: 22500.32
          }
        ],
        subtotal: 46000,
        totalIva: 5200,
        totalDescuento: 0,
        total: 52500.32,
        montoAbonado: 30000,
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
        estadoPago: 'cancelado', // ✅ NUEVO: Estado del pago
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
        estadoPago: 'parcial', // ✅ NUEVO: Estado del pago
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
        estadoPago: 'completado', // ✅ NUEVO: Estado del pago
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
      },
      // ✅ NUEVAS VENTAS ADICIONALES CON DIFERENTES MONEDAS
      {
        id: 7,
        numeroControl: '007',
        paciente: {
          nombre: 'Elena Castillo',
          cedula: '44556677'
        },
        fecha: new Date('2024-01-21T10:00:00'),
        estado: 'completada',
        estadoPago: 'parcial', // Abono en Euros
        montoTotal: 85,
        asesor: { id: 1, nombre: 'Ana García' },
        especialista: { id: 1, nombre: 'Dr. Pérez' },
        servicios: [{ nombre: 'Lentes progresivos' }],
        metodosPago: [
          {
            tipo: 'efectivo',
            monto: 40,
            conversionBs: 1568 // 40 EUR * 39.2
          }
        ],
        mostrarDetalle: false,
        sede: 'guatire',
        moneda: 'euro',
        formaPago: 'abono',
        descuento: 0,
        observaciones: 'Cliente pagará el resto en 15 días',
        asesorNombre: 'Ana García',
        productos: [
          {
            id: "26",
            nombre: "Lentes progresivos premium",
            codigo: "PR-000026",
            precio: 85,
            precioConIva: 85,
            cantidad: 1,
            aplicaIva: false,
            iva: 0,
            subtotal: 85,
            total: 85
          }
        ],
        subtotal: 85,
        totalIva: 0,
        totalDescuento: 0,
        total: 85,
        montoAbonado: 40,
        pagoCompleto: false,
        financiado: false
      },
      {
        id: 8,
        numeroControl: '008',
        paciente: {
          nombre: 'Miguel Ángel Rojas',
          cedula: '88990011'
        },
        fecha: new Date('2024-01-22T14:30:00'),
        estado: 'completada',
        estadoPago: 'parcial', // Abono en Dólares
        montoTotal: 200,
        asesor: { id: 2, nombre: 'Carlos López' },
        especialista: { id: 2, nombre: 'Dra. Martínez' },
        servicios: [{ nombre: 'Armazón + Cristales' }],
        metodosPago: [
          {
            tipo: 'transferencia',
            monto: 100,
            conversionBs: 3650 // 100 USD * 36.5
          }
        ],
        mostrarDetalle: false,
        sede: 'guatire',
        moneda: 'dolar',
        formaPago: 'abono',
        descuento: 0,
        observaciones: 'Saldo pendiente por transferir',
        asesorNombre: 'Carlos López',
        productos: [
          {
            id: "27",
            nombre: "Armazón de titanio",
            codigo: "PR-000027",
            precio: 120,
            precioConIva: 120,
            cantidad: 1,
            aplicaIva: false,
            iva: 0,
            subtotal: 120,
            total: 120
          },
          {
            id: "28",
            nombre: "Cristales anti-reflejo",
            codigo: "PR-000028",
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
        totalDescuento: 0,
        total: 200,
        montoAbonado: 100,
        pagoCompleto: false,
        financiado: false
      },
      {
        id: 9,
        numeroControl: '009',
        paciente: {
          nombre: 'Sofía Mendoza',
          cedula: '22334455'
        },
        fecha: new Date('2024-01-23T11:45:00'),
        estado: 'completada',
        estadoPago: 'completado', // Pago completo en Bolívares
        montoTotal: 75000,
        asesor: { id: 3, nombre: 'María Rodríguez' },
        especialista: { id: 3, nombre: 'Dr. González' },
        servicios: [{ nombre: 'Consulta + Lentes de contacto' }],
        metodosPago: [
          {
            tipo: 'pagomovil',
            monto: 75000,
            conversionBs: 75000
          }
        ],
        mostrarDetalle: false,
        sede: 'guatire',
        moneda: 'bolivar',
        formaPago: 'contado',
        descuento: 5,
        observaciones: 'Pago completo vía Pago Móvil',
        asesorNombre: 'María Rodríguez',
        productos: [
          {
            id: "29",
            nombre: "Consulta especializada",
            codigo: "PR-000029",
            precio: 25000,
            precioConIva: 25000,
            cantidad: 1,
            aplicaIva: false,
            iva: 0,
            subtotal: 25000,
            total: 25000
          },
          {
            id: "30",
            nombre: "Lentes de contacto trimestrales",
            codigo: "PR-000030",
            precio: 50000,
            precioConIva: 50000,
            cantidad: 1,
            aplicaIva: false,
            iva: 0,
            subtotal: 50000,
            total: 50000
          }
        ],
        subtotal: 75000,
        totalIva: 0,
        totalDescuento: 3750,
        total: 71250,
        pagoCompleto: true,
        financiado: false
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
    // console.log('Ver recibo:', venta);
  }

  generarInforme() {
    //console.log('Generar informe con filtros:', this.filtros);
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
    //console.log('Cancelar venta:', venta);

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
    // console.log('Procesando cancelación de venta:', this.selectedVenta.id);

    this.historialVentaService.cancelarVenta(this.selectedVenta.id, this.motivoCancelacion).subscribe({
      next: (response) => {
        if (response.success) {
          this.swalService.showSuccess('Éxito', response.message);

          this.selectedVenta.estado = 'cancelada';
          this.selectedVenta.motivo_cancelacion = this.motivoCancelacion;
          this.selectedVenta.fecha_cancelacion = response.data.fecha_cancelacion;

          //  console.log('Venta cancelada exitosamente:', this.selectedVenta);
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
    //   console.log('Ver detalle completo:', venta);

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

  editarVenta(venta: any): void {
    this.selectedVenta = venta;

    this.reinicializarFormularioConDeuda();

    this.modalService.open(this.editarVentaModal, {
      centered: true,
      size: 'lg',
      backdrop: 'static'
    });
  }

  removerMetodoPago(index: number): void {
    this.metodosPagoArray.removeAt(index);

    setTimeout(() => {
      this.metodosPagoArray.controls.forEach((control, i) => {
        this.validarMontoMetodoPago(i);
      });
    });
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

    // Primero forzar validación de todos los métodos
    this.metodosPagoArray.controls.forEach((control, index) => {
      this.validarMontoMetodoPago(index);
    });

    if (this.editarVentaForm.invalid) {
      this.marcarControlesComoSucios(this.editarVentaForm);
      this.swalService.showWarning('Advertencia', 'Por favor complete todos los campos requeridos correctamente.');
      return;
    }

    const formValue = this.editarVentaForm.value;
    const totalMetodosPago = this.calcularTotalMetodosPago();

    if (Math.abs(totalMetodosPago - formValue.montoAbonado) > 0.01) {

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
    //   console.log('Generando nuevo recibo para venta:', venta);
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

  getMontoMaximo(): number {
    return this.calcularMontoDeuda();
  }

  onMontoAbonadoChange() {
    setTimeout(() => {
      this.calcularPorcentajeAbonado();
      this.ajustarMontosMetodosPago();
    });
  }

  ajustarMontosMetodosPago(): void {
    this.metodosPagoArray.controls.forEach((control, index) => {
      this.validarMontoMetodoPago(index);
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

  agregarMetodoPago(): void {
    const metodoGroup = this.fb.group({
      tipo: ['', Validators.required],
      monto: [0, [Validators.required, Validators.min(0)]]
    });

    this.metodosPagoArray.push(metodoGroup);

    // Suscribirse a cambios del monto
    const index = this.metodosPagoArray.length - 1;
    metodoGroup.get('monto')?.valueChanges.subscribe(value => {
      if (value !== null && value !== undefined) {
        this.validarMontoMetodoPago(index);
      }
    });

    metodoGroup.get('tipo')?.valueChanges.subscribe(tipo => {
      this.onMetodoPagoChange(index);
    });
  }

  private agregarMetodoPagoExistente(metodo: any): void {
    const metodoGroup = this.fb.group({
      tipo: [metodo.tipo || '', Validators.required],
      monto: [metodo.monto || 0, [Validators.required, Validators.min(0)]]
    });

    const index = this.metodosPagoArray.length;
    this.metodosPagoArray.push(metodoGroup);

    metodoGroup.get('monto')?.valueChanges.subscribe(value => {
      if (value !== null && value !== undefined) {
        this.validarMontoMetodoPago(index);
      }
    });
  }

  getSimboloMonedaVenta(): string {
    const moneda = this.getMonedaVenta();
    switch (moneda) {
      case 'dolar': return '$';
      case 'euro': return '€';
      case 'bolivar': return 'Bs. ';
      default: return '$';
    }
  }

  getSimboloMonedaParaVenta(venta: any): string {
    const moneda = venta?.moneda || 'dolar';
    switch (moneda) {
      case 'dolar': return '$';
      case 'euro': return '€';
      case 'bolivar': return 'Bs.';
      default: return '$';
    }
  }

  getMonedaParaPipeVenta(): string {
    const moneda = this.getMonedaVenta();
    switch (moneda) {
      case 'dolar': return 'USD';
      case 'euro': return 'EUR';
      case 'bolivar': return 'Bs';
      default: return 'USD';
    }
  }

  calcularMontoDeuda(): number {
    if (!this.selectedVenta) return 0;

    const total = this.selectedVenta.total || 0;
    const abonado = this.selectedVenta.montoAbonado || 0;
    const deuda = total - abonado;

    return Math.max(0, deuda);
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

  // CORRECCIÓN: Obtener monto máximo permitido en moneda de venta
  getMontoMaximoPermitido(): number {
    return this.calcularMontoDeuda();
  }

  reinicializarFormularioConDeuda() {
    const montoDeuda = this.calcularMontoDeuda();

    // console.log('Reinicializando formulario con deuda:', montoDeuda, 'Moneda:', this.getMonedaVenta());

    if (this.editarVentaForm) {
      this.editarVentaForm.patchValue({
        montoAbonado: montoDeuda,
        observaciones: this.selectedVenta.observaciones || ''
      });

      this.metodosPagoArray.clear();

      if (this.selectedVenta.metodosPago && this.selectedVenta.metodosPago.length > 0) {
        this.selectedVenta.metodosPago.forEach((metodo: any) => {
          this.agregarMetodoPagoExistente(metodo);
        });
      } else {
        this.agregarMetodoPago();
      }
    } else {
      this.inicializarFormulario();
    }

    this.editarVentaForm.get('montoAbonado')?.setValidators([
      Validators.required,
      Validators.min(0),
      Validators.max(this.selectedVenta.total)
    ]);
    this.editarVentaForm.get('montoAbonado')?.updateValueAndValidity();
  }

  validarMontoMaximo(value: number) {
    if (value === null || value === undefined) return;

    const montoDeuda = this.calcularMontoDeuda();

    if (value > montoDeuda) {
      // console.log('Ajustando monto automáticamente de', value, 'a', montoDeuda);

      this.editarVentaForm.patchValue({
        montoAbonado: montoDeuda
      }, { emitEvent: false });
    }
  }

  // CORRECCIÓN: Obtener montos de progreso en moneda de venta
  getMontosProgreso(): string {
    if (!this.selectedVenta) return '$0.00 / $0.00';

    const montoAbonadoAnterior = this.selectedVenta.montoAbonado || 0;
    const nuevoMontoAbonado = this.editarVentaForm?.get('montoAbonado')?.value || 0;
    const totalAbonado = montoAbonadoAnterior + nuevoMontoAbonado;

    const simbolo = this.getSimboloMonedaVenta();
    return `${simbolo}${totalAbonado.toFixed(2)} / ${simbolo}${this.selectedVenta.total.toFixed(2)}`;
  }










  getSimboloMonedaMetodo(tipoPago: string): string {
    switch (tipoPago) {
      case 'efectivo':
        // Para efectivo, usar la moneda seleccionada en el selector
        return this.getSimboloMonedaEfectivo();
      case 'pagomovil':
      case 'transferencia':
      case 'debito':
      case 'credito':
        return 'Bs. '; // Siempre bolívares para métodos locales
      case 'zelle':
        return '$'; // Siempre dólares para Zelle
      default:
        return this.getSimboloMonedaVenta();
    }
  }

  // CORRECCIÓN: Obtener símbolo para efectivo basado en selector
  getSimboloMonedaEfectivo(): string {
    switch (this.monedaEfectivo) {
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'Bs': return 'Bs. ';
      default: return '$';
    }
  }

  // CORRECCIÓN: Obtener moneda para método específico
  getMonedaParaMetodo(index: number): string {
    const metodoControl = this.metodosPagoArray.at(index);
    const tipoPago = metodoControl?.get('tipo')?.value;

    switch (tipoPago) {
      case 'efectivo':
        return this.monedaEfectivo.toLowerCase() === 'bs' ? 'bolivar' :
          this.monedaEfectivo.toLowerCase() === 'eur' ? 'euro' : 'dolar';
      case 'pagomovil':
      case 'transferencia':
      case 'debito':
      case 'credito':
        return 'bolivar';
      case 'zelle':
        return 'dolar';
      default:
        return this.getMonedaVenta();
    }
  }

  // CORRECCIÓN: Función de conversión corregida
  convertirMonto(monto: number, origen: string, destino: string): number {
    if (origen === destino) return this.redondear(monto);

    const tasas = {
      bolivar: 1,
      dolar: this.tasasPorId['dolar'] ?? 0,
      euro: this.tasasPorId['euro'] ?? 0
    };

    let montoEnBs: number;

    switch (origen) {
      case 'dolar':
        montoEnBs = monto * tasas.dolar;
        break;
      case 'euro':
        montoEnBs = monto * tasas.euro;
        break;
      case 'bolivar':
        montoEnBs = monto;
        break;
      default:
        montoEnBs = monto;
    }

    // Luego convertir de bolívares a la moneda destino
    let resultado: number;

    switch (destino) {
      case 'dolar':
        resultado = montoEnBs / tasas.dolar;
        break;
      case 'euro':
        resultado = montoEnBs / tasas.euro;
        break;
      case 'bolivar':
        resultado = montoEnBs;
        break;
      default:
        resultado = montoEnBs;
    }

    return this.redondear(resultado);
  }

  // CORRECCIÓN: Obtener monto máximo en la moneda del método
  getMontoMaximoParaMetodo(index: number): number {
    const montoAbonado = this.editarVentaForm.get('montoAbonado')?.value || 0;
    const monedaVenta = this.getMonedaVenta();
    const monedaMetodo = this.getMonedaParaMetodo(index);

    // Convertir el monto abonado (en moneda de venta) a la moneda del método
    let montoMaximoEnMonedaMetodo = this.convertirMonto(montoAbonado, monedaVenta, monedaMetodo);

    // Restar los otros métodos de pago ya ingresados
    const otrosMetodosEnMonedaMetodo = this.metodosPagoArray.controls.reduce((total, control, i) => {
      if (i !== index) {
        const montoOtro = control.get('monto')?.value || 0;
        const monedaOtro = this.getMonedaParaMetodo(i);
        // Convertir el monto del otro método a la moneda del método actual
        const montoConvertido = this.convertirMonto(montoOtro, monedaOtro, monedaMetodo);
        return total + montoConvertido;
      }
      return total;
    }, 0);

    montoMaximoEnMonedaMetodo = Math.max(0, montoMaximoEnMonedaMetodo - otrosMetodosEnMonedaMetodo);

    return this.redondear(montoMaximoEnMonedaMetodo);
  }

  // CORRECCIÓN: Validar monto del método de pago
  validarMontoMetodoPago(index: number): void {
    const metodoControl = this.metodosPagoArray.at(index);
    const montoIngresado = metodoControl?.get('monto')?.value || 0;
    const montoMaximo = this.getMontoMaximoParaMetodo(index);

    // console.log(`Validando método ${index}: Ingresado=${montoIngresado}, Máximo=${montoMaximo}, Moneda=${this.getMonedaParaMetodo(index)}`);

    if (montoIngresado > montoMaximo) {
      //console.log(`Ajustando monto del método ${index} de ${montoIngresado} a ${montoMaximo}`);

      metodoControl.patchValue({
        monto: montoMaximo
      }, { emitEvent: false });
    }
  }

  obtenerTasaConversion(monedaOrigen: string, monedaDestino: string): number {
    if (monedaOrigen === monedaDestino) return 1;

    const tasas = {
      bolivar: 1,
      dolar: this.tasasPorId['dolar'] ?? 0,
      euro: this.tasasPorId['euro'] ?? 0
    };

    const tasaOrigen = tasas[monedaOrigen as keyof typeof tasas] || 1;
    const tasaDestino = tasas[monedaDestino as keyof typeof tasas] || 1;

    return tasaOrigen / tasaDestino;
  }

  // CORRECCIÓN: Calcular total de métodos de pago en moneda de venta
  calcularTotalMetodosPagoEnMonedaVenta(): number {
    let total = 0;

    this.metodosPagoArray.controls.forEach((control, index) => {
      const monto = control.get('monto')?.value || 0;
      const monedaMetodo = this.getMonedaParaMetodo(index);
      const monedaVenta = this.getMonedaVenta();

      const montoEnMonedaVenta = this.convertirMonto(monto, monedaMetodo, monedaVenta);
      total += montoEnMonedaVenta;
    });

    return total;
  }

  // CORRECCIÓN: Calcular conversión para método específico
  getConversionParaMetodo(index: number): number {
    const metodoControl = this.metodosPagoArray.at(index);
    const monto = metodoControl?.get('monto')?.value || 0;
    const monedaMetodo = this.getMonedaParaMetodo(index);
    const monedaVenta = this.getMonedaVenta();

    return this.convertirMonto(monto, monedaMetodo, monedaVenta);
  }

  mostrarConversionParaMetodo(index: number): boolean {
    const monedaMetodo = this.getMonedaParaMetodo(index);
    const monedaVenta = this.getMonedaVenta();
    return monedaMetodo !== monedaVenta;
  }

  mostrarConversionBs(): boolean {
    return this.getMonedaVenta() !== 'bolivar';
  }

  getConversionBs(monto: number): number {
    const monedaVenta = this.getMonedaVenta();

    if (monedaVenta === 'bolivar') {
      return monto;
    }

    const tasa = this.tasasPorId[monedaVenta] || 1;
    return this.redondear(monto * tasa);
  }

  obtenerEquivalenteBs(monto: number): number {
    const moneda = this.getMonedaVenta();
    const tasa = this.tasasPorId?.[moneda] ?? 1;
    return moneda === 'bolivar' ? monto : monto * tasa;
  }

  // CORRECCIÓN: Redondear números
  private redondear(valor: number, decimales: number = 2): number {
    return Math.round(valor * Math.pow(10, decimales)) / Math.pow(10, decimales);
  }

  // CORRECCIÓN: Al cambiar método de pago
  onMetodoPagoChange(index: number) {
    const metodoControl = this.metodosPagoArray.at(index);
    const tipoPago = metodoControl?.get('tipo')?.value;

    //console.log(`Método ${index} cambiado a: ${tipoPago}, Símbolo: ${this.getSimboloParaMetodo(index)}`);

    // Resetear monto si el tipo de pago cambia
    metodoControl.patchValue({
      monto: 0
    });
  }

  // CORRECCIÓN: Calcular diferencia en moneda de venta
  calcularDiferenciaMetodos(): number {
    const totalMetodosEnMonedaVenta = this.calcularTotalMetodosPagoEnMonedaVenta();
    const montoAbonado = this.editarVentaForm?.get('montoAbonado')?.value || 0;

    return Math.abs(totalMetodosEnMonedaVenta - montoAbonado);
  }

  // CORRECCIÓN: Validar pago completo en moneda de venta
  validarPagoCompleto(): boolean {
    const totalMetodosEnMonedaVenta = this.calcularTotalMetodosPagoEnMonedaVenta();
    const montoAbonado = this.editarVentaForm?.get('montoAbonado')?.value || 0;

    return Math.abs(totalMetodosEnMonedaVenta - montoAbonado) < 0.01;
  }

  // CORRECCIÓN: Obtener símbolo para método específico
  getSimboloParaMetodo(index: number): string {
    const metodoControl = this.metodosPagoArray.at(index);
    const tipoPago = metodoControl?.get('tipo')?.value;
    return this.getSimboloMonedaMetodo(tipoPago);
  }

  // CORRECCIÓN: Verificar si hay efectivo para mostrar selector
  hayMetodoEfectivoSeleccionado(): boolean {
    if (!this.metodosPagoArray || this.metodosPagoArray.length === 0) {
      return false;
    }

    return this.metodosPagoArray.controls.some(control =>
      control.get('tipo')?.value === 'efectivo'
    );
  }

  getMontoRestanteParaMetodo(index: number): number {
    const montoAbonado = this.editarVentaForm.get('montoAbonado')?.value || 0;
    const monedaVenta = this.getMonedaVenta();

    // Calcular total de otros métodos convertidos a moneda de venta
    const totalOtrosMetodos = this.metodosPagoArray.controls.reduce((total, control, i) => {
      if (i !== index) {
        const monto = control.get('monto')?.value || 0;
        const monedaMetodo = this.getMonedaParaMetodo(i);
        const montoEnMonedaVenta = this.convertirMonto(monto, monedaMetodo, monedaVenta);
        return total + montoEnMonedaVenta;
      }
      return total;
    }, 0);

    const restanteEnMonedaVenta = Math.max(0, montoAbonado - totalOtrosMetodos);

    // Convertir a la moneda del método específico
    const monedaMetodo = this.getMonedaParaMetodo(index);
    return this.convertirMonto(restanteEnMonedaVenta, monedaVenta, monedaMetodo);
  }

  // Método para calcular la deuda restante después del nuevo abono
  calcularDeudaRestante(): number {
    if (!this.selectedVenta) return 0;

    const totalVenta = this.selectedVenta.total || 0;
    const montoAbonadoAnterior = this.selectedVenta.montoAbonado || 0;
    const nuevoAbono = this.editarVentaForm?.get('montoAbonado')?.value || 0;

    const deudaRestante = totalVenta - (montoAbonadoAnterior + nuevoAbono);

    return Math.max(0, deudaRestante);
  }

  getDeudaPendiente(venta: any): number {
    if (!venta) return 0;

    if (venta.formaPago === 'contado' && venta.pagoCompleto) {
      return 0; // Pago completado
    }

    if (venta.formaPago === 'abono') {
      const total = venta.total || 0;
      const abonado = venta.montoAbonado || 0;
      return Math.max(0, total - abonado);
    }

    if (venta.formaPago === 'cashea' && venta.financiado) {
      const total = venta.total || 0;
      const adelantado = venta.totalAdelantado || 0;
      return Math.max(0, total - adelantado);
    }

    return 0;
  }

  // Método para obtener el estatus de pago
  getEstatusPago(venta: any): string {
    if (venta.estado === 'cancelada') {
      return 'Cancelado';
    }

    const deuda = this.getDeudaPendiente(venta);

    if (deuda === 0) {
      return 'Pago completado';
    } else {
      return 'Pendiente por pago';
    }
  }


  // Método para obtener la clase CSS del estatus de pago (actualizado)
  getEstatusPagoClase(venta: any): string {
    const estatus = venta.estadoPago || this.getEstatusPago(venta);

    switch (estatus) {
      case 'completado':
      case 'Pago completado':
        return 'estatus-completado';
      case 'parcial':
      case 'Pendiente por pago':
        return 'estatus-pendiente';
      case 'cancelado':
      case 'Cancelado':
        return 'estatus-cancelado';
      default: return 'estatus-pendiente';
    }
  }

}


