import { Component, OnInit, ChangeDetectorRef, OnDestroy, ViewChild, HostListener } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Producto } from '../../productos/producto.model';
import { ProductoService } from '../../productos/producto.service';
import { SystemConfigService } from '../../system-config/system-config.service';
import { GenerarVentaService } from './generar-venta.service';
import { Tasa } from '../../../Interfaces/models-interface';
import { SwalService } from '../../../core/services/swal/swal.service';
import { forkJoin, map, Subject, Observable, of, lastValueFrom, debounceTime, distinctUntilChanged } from 'rxjs';
import { take } from 'rxjs/operators';
import { LoaderService } from './../../../shared/loader/loader.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserStateService } from '../../../core/services/userState/user-state-service';
import { Sede, SedeCompleta } from '../../../view/login/login-interface';
import { PacientesService } from '../../../core/services/pacientes/pacientes.service';
import { HistoriaMedicaService } from '../../../core/services/historias-medicas/historias-medicas.service';
import { Paciente } from '../../pacientes/paciente-interface';
import { HistoriaMedica } from './../../historias-medicas/historias_medicas-interface';
import { VentaDto, ProductoVentaCalculado, CuotaCashea, ItemCarrito, ProductoVentaDto, MetodoPago, FormaPagoDetalle } from '../venta-interfaz';
import { Empleado, User } from '../../../Interfaces/models-interface';
import { EmpleadosService } from './../../../core/services/empleados/empleados.service';
import { trigger, transition, style, animate } from '@angular/animations';
import * as bootstrap from 'bootstrap';
import { Subscription } from 'rxjs';
import { ProductoConversionService } from '../../productos/productos-list/producto-conversion.service';
import { ClienteService } from '../../clientes/clientes.services';
import { NgSelectComponent } from '@ng-select/ng-select';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateUnifiedReceiptHTML, ReceiptViewMode } from '../shared/receipt-html.util';
import {
    buildVentaPaymentCatalog,
    VentaBankOption,
    VentaPaymentMethodOption,
    VentaPaymentMethodValue,
    VentaReceiverAccountOption
} from '../shared/payment-catalog.util';
import { PRESUPUESTO_VENTA_STORAGE_KEY, PresupuestoVentaDraft } from '../shared/presupuesto-venta-handoff.util';

// Constantes
import {
    TIPOS_CRISTALES,
    TIPOS_LENTES_CONTACTO,
    MATERIALES,
} from 'src/app/shared/constants/historias-medicas';

// Tipos de historia
type TipoHistoria =
    | 'oftalmologo_pendiente'      // Oftalmólogo con pago pendiente (costo)
    | 'oftalmologo_pagado'          // Oftalmólogo ya pagado
    | 'optometrista'                 // Optometrista (gratis)
    | 'externa_sin_rectificar'       // Fórmula externa sin médico asociado
    | 'externa_rectificada_oftalmologo' // Fórmula externa + oftalmólogo (costo)
    | 'externa_rectificada_optometrista'; // Fórmula externa + optometrista (gratis)

type ProductoBusquedaOption = Producto & {
    disabled?: boolean;
    sedeNombre?: string;
    motivoBloqueo?: string;
    esOtraSede?: boolean;
    requiereTraslado?: boolean;
};


@Component({
    selector: 'app-generar-venta',
    standalone: false,
    templateUrl: './generar-venta.component.html',
    styleUrls: ['./generar-venta.component.scss'],
    animations: [
        trigger('fadeInOut', [
            transition(':enter', [
                style({ opacity: 0 }),
                animate('200ms ease-in', style({ opacity: 1 }))
            ]),
            transition(':leave', [
                animate('200ms ease-out', style({ opacity: 0 }))
            ])
        ])
    ]
})

export class GenerarVentaComponent implements OnInit, OnDestroy {
    private readonly FILTRO_TODAS_SEDES = 'todas';
    private readonly presupuestoVentaStorageKey = PRESUPUESTO_VENTA_STORAGE_KEY;
    private paymentCatalogSubscription?: Subscription;

    @ViewChild('productoSelect', { static: false }) productoSelect!: NgSelectComponent;
    @ViewChild('selectorPaciente', { static: false }) selectorPaciente!: NgSelectComponent;


    // === CONSTRUCTOR ===
    constructor(
        private productoService: ProductoService,
        private generarVentaService: GenerarVentaService,
        private swalService: SwalService,
        private userStateService: UserStateService,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef,
        private loader: LoaderService,
        private pacientesService: PacientesService,
        private historiaService: HistoriaMedicaService,
        private empleadosService: EmpleadosService,
        private systemConfigService: SystemConfigService,
        private productoConversionService: ProductoConversionService,
        private clienteService: ClienteService,
        private sanitizer: DomSanitizer
    ) {
    }


    // ============================================
    // PROPIEDADES ADICIONALES (agregar a las existentes)
    // ============================================

    // Tipo de venta 
    tipoVenta: 'solo_consulta' | 'consulta_productos' | 'solo_productos' = 'solo_consulta';
    presupuestoOrigenVenta: PresupuestoVentaDraft['origen'] | null = null;

    // Control de montos de consulta
    montoConsulta: number = 0;
    montoConsultaOriginal: number = 0;
    pagoMedico: number = 0;
    pagoOptica: number = 0;

    // Para saber si la consulta ya está en el carrito
    consultaEnCarrito: boolean = false;

    filtroHistoriasTexto: string = '';

    // Flag para controlar mensajes
    mostradoMensajeSoloConsulta: boolean = false;
    mostrandoBusqueda: boolean = false;

    paginaActual: number = 1;
    itemsPorPagina: number = 20;

    textoBusquedaHistoria: string = '';
    mostrarResultadosPacientes: boolean = false;
    dropdownAbierto: boolean = false;

    // Filtro de categoría
    filtroCategoria: 'todos' | 'lentes' | 'monturas' | 'accesorios' = 'todos';

    // Para la búsqueda de pacientes
    buscandoPaciente: boolean = false;

    // === PROPIEDADES ===
    monedaSistema: string = 'USD';
    simboloMonedaSistema: string = '$';
    private configSubscription!: Subscription;
    filterInput = new Subject<string>();
    textoBusquedaPaciente: string = '';
    intentoGenerar: boolean = false;

    dataIsReady = false;
    tareasPendientes = 0;
    sedeActiva: string = '';
    sedeFiltro: string = this.sedeActiva;
    currentUser: User | null = null;
    nivelCashea: 'nivel1' | 'nivel2' | 'nivel3' | 'nivel4' | 'nivel5' | 'nivel6' = 'nivel3';
    ivaPorcentaje = 0;
    valorTemporal: string = '';
    montoExcedido: boolean = false;
    maximoCuotasPermitidas = 6;
    cantidadCuotasCashea = 3;
    sedeInfo: SedeCompleta | null = null;

    productos: Producto[] = [];
    pacientes: any[] = [];
    todosLosPacientes: Paciente[] = [];
    pacientesFiltradosPorSede: Paciente[] = [];
    productosFiltradosPorSede: Producto[] = [];
    productosBusquedaDisponibles: ProductoBusquedaOption[] = [];
    empleadosDisponibles: Empleado[] = [];
    tasasDisponibles: Tasa[] = [];
    monedasDisponibles: Tasa[] = [];
    tasasPorId: Record<string, number> = {};

    pacienteSeleccionado: Paciente | null = null;
    productoSeleccionado: ProductoBusquedaOption | null = null;
    asesorSeleccionado: string | null = null;

    // === PROPIEDADES ADICIONALES PARA CLIENTE SIN PACIENTE ===
    clienteSinPaciente: any = {
        tipoPersona: 'natural',
        nombreCompleto: '',
        cedula: '',
        telefono: '',
        email: ''
    };

    // Objeto para almacenar datos de empresa referida
    clienteEmpresaReferida = {
        nombre: '',
        rif: '',
        telefono: '',
        email: '',
        direccion: ''
    };
    mostrarSelectorAsesor: boolean = false;

    // === PROPIEDADES ADICIONALES PARA ORDEN DE TRABAJO ===
    generarOrdenTrabajo: boolean = false;
    forzarOrdenTrabajo: boolean = false;
    porcentajeMinimoOrdenTrabajo: number = 50;

    // === PROPIEDADES PARA EMPRESA REFERIDA ===
    empresaReferidaInfo: any = null;
    clienteEsReferido: boolean = false;
    usarEmpresaEnVenta: boolean = false;
    mostrarInfoEmpresa: boolean = false;
    editandoManual: boolean = false;

    // === PROPIEDADES PARA ASESOR ===
    historiaMedica: HistoriaMedica | null = null;
    productosConDetalle: ProductoVentaCalculado[] = [];
    totalProductos: number = 0;
    cuotasCashea: CuotaCashea[] = [];
    valorInicialTemporal = '';

    // NUEVAS PROPIEDADES PARA HISTORIAS MÉDICAS
    historiasMedicas: any[] = []; // Lista de todas las historias del paciente
    historiaSeleccionadaId: string | null = null; // ID de la historia seleccionada
    historiaMedicaSeleccionada: HistoriaMedica | null = null; // Historia completa seleccionada

    // === PROPIEDADES ADICIONALES PARA GENERACIÓN DE VENTA ===
    generandoVenta: boolean = false;
    generandoRecibo: boolean = false;
    ventaGenerada: boolean = false;
    urlRecibo: string = '';
    errorGeneracion: string = '';
    mostrarDetalleDescuento: boolean = false;

    // === PROPIEDADES PARA CLIENTE API ===
    validandoCliente: boolean = false;
    clienteEncontrado: boolean = false;
    mensajeValidacionCliente: string = '';
    cedulaAnterior: string = '';
    validacionIntentada: boolean = false; // ← Nueva propiedad

    // === PROPIEDADES PARA CONTROL DE TAMAÑO DEL MODAL ===
    tamanoModalRecibo: 'xl' = 'xl';
    anchoPersonalizado: string = '1100px';
    altoPersonalizado: string = '700px';

    mostrarControlesPersonalizados: boolean = false;

    // Modal para mostrar el recibo
    mostrarModalRecibo: boolean = false;
    datosRecibo: any = null;
    previewReciboUrl: SafeResourceUrl | null = null;
    private previewReciboObjectUrl: string | null = null;
    private ventaReciboKey: string | null = null;
    currentYear: number = new Date().getFullYear();
    informacionVenta: any = null;
    // OBTENER INFORMACIÓN DE LA SEDE DESDE EL COMPONENTE

    venta: VentaDto & { productos: ItemCarrito[] } = {
        productos: [],
        moneda: 'dolar',
        formaPago: 'contado',
        descuento: 0,
        impuesto: 16,
        observaciones: '',
        montoInicial: 0,
        numeroCuotas: 0,
        montoAbonado: 0,
        metodosDePago: []
    };

    resumenCashea = {
        cantidad: 0,
        total: 0,
        totalBs: 0
    };

    private readonly idMap: Record<string, string> = {
        usd: 'dolar',
        ves: 'bolivar',
        bs: 'bolivar',
        eur: 'euro',
        $: 'dolar',
        '€': 'euro'
    };


    // === CICLO DE VIDA ===
    ngOnInit(): void {
        this.resetearCarga();
        this.registrarTarea();
        this.obtenerConfiguracionSistema();
        this.suscribirCambiosConfiguracion();
        this.cargarCatalogosPago();
        this.cargarDatosIniciales();

        // SUSCRIBIRSE A LA SEDE DESDE UserStateService (ya cargada por el dashboard)
        this.userStateService.sedeActual$.subscribe(sede => {
            this.sedeInfo = sede;

            // Actualizar filtros si es necesario
            if (this.sedeInfo) {
                this.sedeActiva = this.normalizarClaveSede(this.sedeInfo.key);
                this.sedeFiltro = this.sedeActiva;
                this.actualizarProductosFiltrados();
            }
        });

        window.addEventListener('focus', () => {
            //this.recargarPacientes();
        });
    }

    ngOnDestroy(): void {
        if (this.configSubscription) {
            this.configSubscription.unsubscribe();
        }

        if (this.paymentCatalogSubscription) {
            this.paymentCatalogSubscription.unsubscribe();
        }
    }

    // === MÉTODOS DE INICIALIZACIÓN ===
    private obtenerConfiguracionSistema(): void {
        this.monedaSistema = this.systemConfigService.getMonedaPrincipal();
        this.simboloMonedaSistema = this.systemConfigService.getSimboloMonedaPrincipal();
        this.venta.moneda = this.normalizarMonedaParaVenta(this.monedaSistema);
    }

    private suscribirCambiosConfiguracion(): void {
        this.configSubscription = this.systemConfigService.config$.subscribe(config => {
            this.monedaSistema = config.monedaPrincipal;
            this.simboloMonedaSistema = config.simboloMoneda;
            this.venta.moneda = this.normalizarMonedaParaVenta(this.monedaSistema);
            this.actualizarProductosConDetalle();
        });
    }

    private cargarCatalogosPago(): void {
        this.paymentCatalogSubscription = this.systemConfigService.obtenerMetodosPagoConfigurables().subscribe({
            next: ({ paymentMethods }) => this.aplicarCatalogosPago(paymentMethods),
            error: () => this.aplicarCatalogosPago(null)
        });
    }

    private aplicarCatalogosPago(paymentMethods: unknown): void {
        const catalogo = buildVentaPaymentCatalog(paymentMethods as any);
        this.tiposPago = catalogo.tiposPago;
        this.bancosDisponibles = catalogo.bancosNacionales;
        this.bancosUsaDisponibles = catalogo.bancosInternacionales;
        this.cuentasReceptorasPorMetodo = catalogo.cuentasReceptorasPorMetodo;
        this.sincronizarMetodosPagoConCatalogo();
        this.cdr.detectChanges();
    }

    private sincronizarMetodosPagoConCatalogo(): void {
        this.venta.metodosDePago.forEach((metodo) => {
            if (metodo.bancoCodigo) {
                const bancoPrincipal = this.getBancosDisponiblesPorMetodo(metodo.tipo).find((banco) => banco.codigo === metodo.bancoCodigo);
                if (bancoPrincipal) {
                    metodo.bancoObject = bancoPrincipal;
                    metodo.bancoNombre = bancoPrincipal.nombre;
                    metodo.banco = `${bancoPrincipal.codigo} - ${bancoPrincipal.nombre}`;
                }
            }

            if (metodo.bancoReceptorCodigo) {
                const cuentaReceptora = this.getCuentasReceptorasPorMetodo(metodo.tipo).find((cuenta) => {
                    if (metodo.bancoReceptorObject?.id) {
                        return cuenta.id === metodo.bancoReceptorObject.id;
                    }

                    if (metodo.bancoReceptor) {
                        return cuenta.displayText === metodo.bancoReceptor;
                    }

                    return cuenta.codigo === metodo.bancoReceptorCodigo;
                });

                if (cuentaReceptora) {
                    metodo.bancoReceptorObject = cuentaReceptora;
                    metodo.bancoReceptorNombre = cuentaReceptora.nombre;
                    metodo.bancoReceptor = cuentaReceptora.displayText;
                } else if (this.necesitaBancoReceptor(metodo.tipo)) {
                    metodo.bancoReceptorCodigo = '';
                    metodo.bancoReceptorNombre = '';
                    metodo.bancoReceptor = '';
                    metodo.bancoReceptorObject = null;
                }
            }
        });
    }

    private normalizarMonedaParaVenta(monedaSistema: string): string {
        const mapaMonedas: { [key: string]: string } = {
            'USD': 'dolar',
            'EUR': 'euro',
            'VES': 'bolivar',
            'BS': 'bolivar',
            '€': 'euro',
            '$': 'dolar'
        };

        // Si es un símbolo, convertirlo directamente
        if (monedaSistema === '$' || monedaSistema === 'USD') return 'dolar';
        if (monedaSistema === '€' || monedaSistema === 'EUR') return 'euro';
        if (monedaSistema === 'Bs' || monedaSistema === 'VES' || monedaSistema === 'BS') return 'bolivar';

        // Para nombres completos
        return mapaMonedas[monedaSistema.toUpperCase()] || 'dolar';
    }

    private cargarDatosIniciales(): void {
        forkJoin({
            productosResponse: this.productoService.getProductos().pipe(take(1)),
            pacientes: this.pacientesService.getPacientes().pipe(
                take(1),
                map(resp => resp.pacientes ?? [])
            ),
            usuario: this.userStateService.currentUser$.pipe(take(1)),
            tasasResponse: this.generarVentaService.getTasas().pipe(take(1)),
            asesores: this.empleadosService.getAllEmpleados().pipe(take(1))
        }).subscribe(({ productosResponse, pacientes, usuario, tasasResponse, asesores }) => {
            this.ivaPorcentaje = +(productosResponse.iva ?? 0);

            this.productos = this.productoConversionService.convertirListaProductosAmonedaSistema(
                productosResponse.productos ?? []
            );

            this.pacientes = pacientes;
            this.todosLosPacientes = pacientes;
            this.pacientesFiltradosPorSede = pacientes;

            this.currentUser = usuario;
            this.asesorSeleccionado = usuario?.id ?? null;
            this.empleadosDisponibles = asesores;
            this.sedeActiva = this.normalizarClaveSede(usuario?.sede);
            this.sedeFiltro = this.sedeActiva;
            this.actualizarProductosFiltrados();

            const tasas = tasasResponse.tasas ?? [];
            this.tasasDisponibles = tasas;
            this.monedasDisponibles = tasas;
            this.tasasPorId = Object.fromEntries(tasas.map(t => [t.id, t.valor]));

            this.actualizarProductosConDetalle();
            this.cargarPresupuestoPendienteSiExiste();
            this.completarTarea();
        });
    }

    private cargarPresupuestoPendienteSiExiste(): void {
        const draftRaw = sessionStorage.getItem(this.presupuestoVentaStorageKey);
        if (!draftRaw) {
            return;
        }

        let draft: PresupuestoVentaDraft | null = null;

        try {
            draft = JSON.parse(draftRaw) as PresupuestoVentaDraft;
        } catch {
            sessionStorage.removeItem(this.presupuestoVentaStorageKey);
            return;
        }

        if (!draft || !Array.isArray(draft.productos) || draft.productos.length === 0) {
            sessionStorage.removeItem(this.presupuestoVentaStorageKey);
            return;
        }

        this.aplicarPresupuestoComoVentaEditable(draft);
        sessionStorage.removeItem(this.presupuestoVentaStorageKey);
    }

    private aplicarPresupuestoComoVentaEditable(draft: PresupuestoVentaDraft): void {
        this.seleccionarTipoVenta('solo_productos');
        this.presupuestoOrigenVenta = draft.origen;

        this.clienteSinPaciente = {
            tipoPersona: draft.cliente.tipoPersona === 'juridica' ? 'juridica' : 'natural',
            nombreCompleto: draft.cliente.nombreCompleto || '',
            cedula: draft.cliente.cedula || '',
            telefono: draft.cliente.telefono || '',
            email: draft.cliente.email || ''
        };

        const observacionesOrigen = [`Presupuesto origen: ${draft.origen.codigo}`];
        if (draft.observaciones?.trim()) {
            observacionesOrigen.push(draft.observaciones.trim());
        }
        this.venta.observaciones = observacionesOrigen.join(' | ');

        let productosCargados = 0;
        let productosOmitidos = 0;

        draft.productos.forEach((productoDraft) => {
            const productoCatalogo = this.buscarProductoParaPresupuesto(productoDraft);

            if (!productoCatalogo) {
                productosOmitidos++;
                return;
            }

            this.agregarProductoAlCarrito(productoCatalogo);

            const itemVenta = this.venta.productos.find((item) => item.id === productoCatalogo.id) as ItemCarrito | undefined;
            if (!itemVenta) {
                productosOmitidos++;
                return;
            }

            const cantidad = Math.max(1, Number(productoDraft.cantidad || 1));
            const descuento = Math.max(0, Number(productoDraft.descuento || 0));
            const precioBase = Number(productoDraft.precioUnitario || 0);
            const precioConDescuento = this.redondear(precioBase * (1 - (descuento / 100)));
            const precioAplicado = precioConDescuento > 0 ? precioConDescuento : precioBase;

            itemVenta.cantidad = cantidad;
            itemVenta.precio = precioAplicado;
            itemVenta.precioConIva = itemVenta.aplicaIva
                ? this.redondear(precioAplicado * (1 + (this.ivaPorcentaje / 100)))
                : precioAplicado;
            itemVenta.descripcion = productoDraft.descripcion || itemVenta.descripcion;
            productosCargados++;
        });

        this.actualizarProductosConDetalle();
        this.cdr.detectChanges();

        if (productosCargados === 0) {
            this.presupuestoOrigenVenta = null;
            this.snackBar.open(`No se pudieron cargar los productos del presupuesto ${draft.origen.codigo} en ventas`, 'Cerrar', {
                duration: 5000,
                panelClass: ['snackbar-warning']
            });
            return;
        }

        const mensaje = productosOmitidos > 0
            ? `Presupuesto ${draft.origen.codigo} cargado con ${productosCargados} productos. ${productosOmitidos} no se encontraron en inventario.`
            : `Presupuesto ${draft.origen.codigo} cargado en ventas. Puedes ajustar cliente, productos y pago antes de guardar.`;

        this.snackBar.open(mensaje, 'Cerrar', {
            duration: 5000,
            panelClass: ['snackbar-info']
        });
    }

    private buscarProductoParaPresupuesto(productoDraft: PresupuestoVentaDraft['productos'][number]): Producto | undefined {
        return this.productos.find((producto) => {
            const coincideId = productoDraft.id !== undefined && String(producto.id) === String(productoDraft.id);
            const coincideCodigo = !!productoDraft.codigo && producto.codigo === productoDraft.codigo;
            return coincideId || coincideCodigo;
        });
    }

    private resetearCarga(): void {
        this.tareasPendientes = 0;
        this.dataIsReady = false;
        this.loader.show();
    }

    private registrarTarea(): void {
        this.tareasPendientes++;
        this.dataIsReady = false;
    }

    private completarTarea(): void {
        this.tareasPendientes--;
        if (this.tareasPendientes <= 0) {
            setTimeout(() => {
                this.loader.hide();
                this.dataIsReady = true;
            }, 300);
        }
    }

    onPacienteSeleccionado(pacienteSeleccionado: Paciente | null): void {
        // Solo aplicar si el tipo requiere paciente
        if (this.tipoVenta === 'solo_productos') return;

        this.registrarTarea();

        // Caso: se deseleccionó el paciente
        if (!pacienteSeleccionado) {
            this.limpiarSeleccionPaciente();
            this.mostrandoBusqueda = true;
            this.completarTarea();
            return;
        }

        // Caso: se seleccionó un paciente
        this.pacienteSeleccionado = pacienteSeleccionado;
        this.mostrandoBusqueda = false;

        // Cargar información de empresa referida si aplica
        this.cargarInfoEmpresaReferida(pacienteSeleccionado);

        // Limpiar historias previas
        this.historiasMedicas = [];
        this.historiaSeleccionadaId = null;
        this.historiaMedica = null;
        this.historiaMedicaSeleccionada = null;
        this.montoConsulta = 0;
        this.montoConsultaOriginal = 0;

        if (!pacienteSeleccionado?.key) {
            console.error('No se encontró la clave del paciente seleccionado.');
            this.completarTarea();
            return;
        }

        const pacienteKey = pacienteSeleccionado.key;

        this.historiaService.getHistoriasPorPaciente(pacienteKey).pipe(take(1)).subscribe({
            next: (historiales: any[]) => {
                if (!historiales || historiales.length === 0) {
                    // ... código existente ...
                    return;
                }

                const historiasOrdenadas = historiales.sort((a: any, b: any) =>
                    new Date(b.auditoria.fechaCreacion).getTime() -
                    new Date(a.auditoria.fechaCreacion).getTime()
                );

                this.historiasMedicas = historiasOrdenadas.map((historia: any, index: number) => {
                    const fecha = new Date(historia.auditoria.fechaCreacion);
                    const tieneFormula = this.tieneFormulaCompleta(historia);
                    const pagoPendiente = historia.datosConsulta?.pagoPendiente === true;

                    // 🔴 IMPORTANTE: Extraer correctamente la información del especialista
                    const especialista = historia.datosConsulta?.especialista;
                    let tipoProfesional = 'optometrista';
                    let nombreMedico = '';
                    let cargoMedico = '';

                    if (especialista) {
                        if (especialista.tipo === 'EXTERNO' && especialista.externo) {
                            tipoProfesional = 'externo';
                            nombreMedico = especialista.externo.nombre || '';
                            cargoMedico = especialista.externo.lugarConsultorio || 'Médico Externo';
                        } else if (especialista.tipo === 'OFTALMOLOGO') {
                            tipoProfesional = 'oftalmologo';
                            nombreMedico = especialista.nombre || '';
                            cargoMedico = especialista.cargo || 'Oftalmólogo';
                        } else if (especialista.tipo === 'OPTOMETRISTA') {
                            tipoProfesional = 'optometrista';
                            nombreMedico = especialista.nombre || '';
                            cargoMedico = especialista.cargo || 'Optometrista';
                        }
                    } else {
                        // Fallback para datos antiguos
                        tipoProfesional = historia.datosConsulta?.medico?.cargo === 'Oftalmólogo'
                            ? 'oftalmologo'
                            : 'optometrista';
                        nombreMedico = historia.datosConsulta?.medico?.nombre || '';
                        cargoMedico = historia.datosConsulta?.medico?.cargo || '';
                    }

                    return {
                        key: historia.id.toString(),
                        id: historia.id,
                        nHistoria: historia.nHistoria,
                        fechaFormateada: fecha.toLocaleDateString('es-VE', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        }),
                        fechaCreacion: historia.auditoria.fechaCreacion,
                        datosConsulta: {
                            motivo: historia.datosConsulta?.motivo,
                            medico: {  // Mantener para compatibilidad
                                nombre: nombreMedico,
                                cargo: cargoMedico
                            },
                            formulaExterna: historia.datosConsulta?.formulaExterna || false,
                            pagoPendiente: pagoPendiente,
                            especialista: especialista
                        },
                        auditoria: historia.auditoria,
                        esReciente: index === 0,
                        tieneFormula: tieneFormula,
                        tipoProfesional: tipoProfesional,
                        formulaExterna: historia.datosConsulta?.formulaExterna || false,
                        pagoPendiente: pagoPendiente,
                        formula: {
                            od: tieneFormula ?
                                `${historia.examenOcular?.refraccionFinal?.esf_od || '--'}/${historia.examenOcular?.refraccionFinal?.cil_od || '--'}` :
                                'Sin fórmula',
                            oi: tieneFormula ?
                                `${historia.examenOcular?.refraccionFinal?.esf_oi || '--'}/${historia.examenOcular?.refraccionFinal?.cil_oi || '--'}` :
                                'Sin fórmula'
                        },
                        motivo: historia.datosConsulta?.motivo?.[0] || 'Consulta',
                        data: historia
                    };
                });



                this.completarTarea();
            },
            error: (error) => {
                console.error('Error al cargar historias:', error);
                this.swalService.showError(
                    'Error al cargar historia',
                    'No se pudo obtener las historias médicas del paciente.'
                );
                this.completarTarea();
            }
        });
    }

    get historiasFiltradasParaConsulta(): any[] {
        if (!this.historiasMedicas || this.historiasMedicas.length === 0) {
            return [];
        }

        return this.historiasMedicas.filter(h =>
            h.tipoProfesional === 'oftalmologo' &&
            !h.formulaExterna
        );
    }

    get historiasParaConsultaProductos(): any[] {
        return this.historiasMedicas || [];
    }

    limpiarSeleccionPaciente(): void {
        // LIMPIAR DATOS DEL PACIENTE (ya existente)
        this.pacienteSeleccionado = null;
        this.historiasMedicas = [];
        this.historiaSeleccionadaId = null;
        this.historiaMedica = null;
        this.historiaMedicaSeleccionada = null;
        this.empresaReferidaInfo = null;
        this.generarOrdenTrabajo = false;
        this.forzarOrdenTrabajo = false;
        this.mostrandoBusqueda = true;
        this.textoBusquedaPaciente = '';
        this.mostrarResultadosPacientes = false;

        // LIMPIAR CARRITO COMPLETAMENTE
        this.limpiarCarritoCompleto();

        // RESETEAR TODO EL ESTADO DEL MODAL
        this.resetearEstadoModal();

        this.cdr.detectChanges();
    }

    private resetearEstadoModal(): void {
        // Resetear forma de pago a contado
        this.venta.formaPago = 'contado';

        // Resetear moneda
        this.venta.moneda = this.normalizarMonedaParaVenta(this.monedaSistema);

        // Limpiar métodos de pago
        this.venta.metodosDePago = [];

        // Resetear descuento
        this.venta.descuento = 0;

        // Resetear observaciones
        this.venta.observaciones = '';

        // Resetear abono
        this.venta.montoAbonado = 0;
        this.valorTemporal = '';
        this.montoExcedido = false;

        // Resetear cashea
        this.venta.montoInicial = 0;
        this.valorInicialTemporal = '';
        this.cuotasCashea = [];
        this.resumenCashea = { cantidad: 0, total: 0, totalBs: 0 };
        this.nivelCashea = 'nivel3';
        this.cantidadCuotasCashea = 3;

        // Actualizar cálculos
        this.actualizarProductosConDetalle();
    }

    getMaterialesRecomendados(material: any): string {
        if (!material) return '--';

        if (Array.isArray(material)) {
            if (material.length === 0) return '--';

            // Mapear los materiales a sus etiquetas
            return material.map(m => {
                // Buscar en la constante MATERIALES
                const encontrado = MATERIALES.find(mat => mat.value === m || mat.label === m);
                return encontrado?.label || m;
            }).join(', ');
        }

        // Si es un string
        const encontrado = MATERIALES.find(mat => mat.value === material || mat.label === material);
        return encontrado?.label || material;
    }

    getTipoCristalRecomendado(cristal: any): string {
        if (!cristal) return '--';

        // Si es string
        if (typeof cristal === 'string') {
            const encontrado = TIPOS_CRISTALES.find(c =>
                c.value === cristal || c.label === cristal
            );
            return encontrado?.label || cristal;
        }

        // Si es objeto con label
        if (cristal?.label) {
            return cristal.label;
        }

        return '--';
    }

    // Método para obtener el tipo de lente de contacto (ya existe pero podemos mejorarlo)
    getTipoLenteContactoLabel(valor: string | undefined | null): string {
        if (!valor || valor === '') return '--';

        const encontrado = TIPOS_LENTES_CONTACTO.find(t =>
            t.value === valor ||
            t.label === valor ||
            t.value?.toLowerCase() === valor?.toLowerCase() ||
            t.label?.toLowerCase() === valor?.toLowerCase()
        );

        return encontrado?.label || valor;
    }

    // Método para determinar si es una recomendación de lentes de contacto
    esLenteContactoRecomendacion(rec: any): boolean {
        if (!rec || !rec.cristal) return false;

        const cristalStr = typeof rec.cristal === 'string'
            ? rec.cristal
            : rec.cristal?.label || '';

        return cristalStr.toLowerCase().includes('contacto') ||
            (rec.tipoLentesContacto && rec.tipoLentesContacto !== '');
    }

    tieneFormulaCompleta(historia: any): boolean {
        try {
            if (!historia || typeof historia !== 'object') {
                return false;
            }

            // Intentar acceder a refraccionFinal de diferentes maneras
            const ref = historia?.examenOcular?.refraccionFinal ||
                historia?.data?.examenOcular?.refraccionFinal;

            if (!ref || typeof ref !== 'object') {
                return false;
            }

            // Verificar al menos un campo con valor en OD o OI
            const tieneValores =
                (ref.esf_od && ref.esf_od !== '') ||
                (ref.cil_od && ref.cil_od !== '') ||
                (ref.esf_oi && ref.esf_oi !== '') ||
                (ref.cil_oi && ref.cil_oi !== '');

            return tieneValores;

        } catch (error) {
            console.error('Error al verificar fórmula completa:', error);
            return false;
        }
    }

    filtrarPorNombreOCedula(term: string, item: Paciente): boolean {
        const nombre = item.informacionPersonal?.nombreCompleto?.toLowerCase() ?? '';
        const cedula = item.informacionPersonal?.cedula?.toLowerCase() ?? '';
        const normalizado = term.trim().toLowerCase();
        return nombre.includes(normalizado) || cedula.includes(normalizado);
    }

    actualizarFiltroTexto(event: { term: string; items: any[] }): void {
        const texto = event.term.trim().toLowerCase();
        this.pacientesFiltradosPorSede = this.todosLosPacientes.filter(p => {
            const nombre = p.informacionPersonal?.nombreCompleto?.toLowerCase() ?? '';
            const cedula = p.informacionPersonal?.cedula?.toLowerCase() ?? '';
            return nombre.includes(texto) || cedula.includes(texto);
        });
    }

    get materialesRecomendados(): string {
        const material = this.historiaMedica?.recomendaciones?.[0]?.material;
        if (Array.isArray(material)) {
            return material.join(', ');
        }
        return material ?? '';
    }

    async onProductoSeleccionadoChange(event: ProductoBusquedaOption | string | null): Promise<void> {
        if (event === null || event === undefined) {
            return;
        }

        const producto = typeof event === 'object' && event !== null
            ? event
            : this.productosFiltradosPorCategoria.find(p => p.id === event?.toString());

        if (!producto) {
            console.error('No se pudo resolver el producto seleccionado', event);
            return;
        }

        if (!this.esProductoSeleccionable(producto)) {
            this.productoSeleccionado = null;
            if (this.productoSelect) {
                this.productoSelect.clearModel();
            }

            this.swalService.showWarning(
                'Producto no disponible',
                this.getMotivoBloqueoProducto(producto) || 'Este producto no se puede seleccionar en esta venta.'
            );
            return;
        }

        const yaExiste = this.venta.productos.some(p => p.id === producto.id);
        if (this.esProductoOtraSede(producto) && !yaExiste) {
            const confirmacion = await this.swalService.showConfirm(
                'Solicitar traslado',
                `
                <p>El producto <strong>${producto.nombre}</strong> se encuentra en <strong>${this.obtenerNombreSedeProducto(producto.sede)}</strong>.</p>
                <p>Si continúas, se agregará como <strong>solicitud de traslado hacia ${this.nombreSedeActivaVisible}</strong>.</p>
                <p>La solicitud quedará registrada en la observación de la venta.</p>
                `,
                'Solicitar traslado',
                'Cancelar'
            );

            if (!confirmacion.isConfirmed) {
                this.productoSeleccionado = null;
                if (this.productoSelect) {
                    this.productoSelect.clearModel();
                }
                return;
            }
        }

        this.agregarProductoAlCarrito(producto);

        setTimeout(() => {
            this.cdr.detectChanges();
        }, 100);
    }


    agregarProductoAlCarrito(producto: any): void {

        if (!producto || !producto.id) {
            console.error('Producto inválido o sin ID:', producto);
            this.swalService.showWarning('Error', 'No se puede agregar un producto inválido al carrito.');
            return;
        }

        // Validar que no sea solo consulta (no se pueden agregar productos)
        if (this.tipoVenta === 'solo_consulta') {
            this.swalService.showWarning(
                'Operación no permitida',
                'En ventas solo de consulta no se pueden agregar productos.'
            );
            return;
        }

        const stockDisponible = producto.stock ?? 0;
        const precioBase = +(producto.precio ?? 0);
        const precioFinal = +(producto.precioConIva ?? 0);
        const monedaOriginal = this.idMap[producto.moneda?.toLowerCase()] ?? producto.moneda?.toLowerCase() ?? 'dolar';
        const aplicaIva = producto.aplicaIva ?? false;
        const metadataTraslado = this.construirMetadataTraslado(producto);

        if (stockDisponible <= 0) {
            this.swalService.showWarning('Sin stock', 'Este producto no tiene unidades disponibles.');
            return;
        }

        if (precioBase <= 0 || (aplicaIva && precioFinal <= 0)) {
            this.swalService.showWarning('Precio inválido', 'Este producto no tiene precio asignado.');
            return;
        }


        const yaExiste = this.venta.productos.find(p => p.id === producto.id) as ItemCarrito | undefined;

        if (yaExiste) {
            // Verificar que no sea una consulta (no debería, pero por seguridad)
            if (yaExiste.tipo === 'CONSULTA') {
                console.error('Error: Un producto no puede ser de tipo CONSULTA');
                return;
            }

            const nuevaCantidad = (yaExiste.cantidad ?? 1) + 1;

            if (nuevaCantidad > stockDisponible) {
                this.swalService.showWarning(
                    'Stock insuficiente',
                    `Solo hay ${stockDisponible} unidades disponibles.`
                );
                return;
            }

            yaExiste.cantidad = nuevaCantidad;
        }

        else {
            // Crear el item con la interfaz ItemCarrito
            const nuevoItem: ItemCarrito = {
                id: producto.id,
                nombre: producto.nombre,
                codigo: producto.codigo || 'N/A',
                precio: precioBase,
                precioConIva: precioFinal,
                moneda: monedaOriginal,
                cantidad: 1,
                aplicaIva: aplicaIva,
                stock: producto.stock ?? 0,
                sede: producto.sede,
                tipo: 'PRODUCTO',  // Importante: marcar como PRODUCTO
                descripcion: producto.descripcion || undefined,
                metadata: metadataTraslado
            };

            this.venta.productos.push(nuevoItem);

        }

        this.actualizarProductosConDetalle();

        // Limpiar selección del producto
        setTimeout(() => {
            this.productoSeleccionado = null;
            if (this.productoSelect) {
                this.productoSelect.clearModel();
            }
            this.cdr.detectChanges();
        }, 100);
    }

    eliminarProducto(id: string): void {
        const eliminado = this.venta.productos.find(p => p.id === id)?.nombre;
        this.venta.productos = this.venta.productos.filter(p => p.id !== id);
        this.actualizarProductosConDetalle();
    }

    filtrarProductoPorNombreOCodigo(term: string, item: Producto): boolean {
        const nombre = item.nombre?.toLowerCase() ?? '';
        const codigo = item.codigo?.toLowerCase() ?? '';
        const categoria = item.categoria?.toLowerCase() ?? '';
        const sede = this.obtenerNombreSedeProducto(item.sede).toLowerCase();
        const normalizado = term.trim().toLowerCase();
        return nombre.includes(normalizado)
            || codigo.includes(normalizado)
            || categoria.includes(normalizado)
            || sede.includes(normalizado);
    }

    compararProductoBusqueda = (productoActual: ProductoBusquedaOption | null, productoSeleccionado: ProductoBusquedaOption | null): boolean => {
        if (!productoActual && !productoSeleccionado) {
            return true;
        }

        if (!productoActual || !productoSeleccionado) {
            return false;
        }

        return productoActual.id === productoSeleccionado.id;
    };

    cambiarFiltroSedeProductos(sedeKey: string): void {
        const siguienteFiltro = this.normalizarClaveSede(sedeKey) || this.sedeActiva;
        if (!siguienteFiltro || siguienteFiltro === this.sedeFiltro) {
            return;
        }

        this.sedeFiltro = siguienteFiltro;
        this.productoSeleccionado = null;

        if (this.productoSelect) {
            this.productoSelect.clearModel();
        }

        this.actualizarProductosFiltrados();
        this.cdr.detectChanges();
    }

    private actualizarProductosFiltrados(): void {
        const sedeFiltro = this.normalizarClaveSede(this.sedeFiltro || this.sedeActiva);
        const productosActivos = this.productos
            .filter(p => p.activo === true)
            .map(p => this.normalizarProductoParaVenta(p));

        this.productosFiltradosPorSede = !sedeFiltro || sedeFiltro === this.FILTRO_TODAS_SEDES
            ? productosActivos
            : productosActivos.filter(p => this.normalizarClaveSede(p.sede) === sedeFiltro);

        this.productosBusquedaDisponibles = this.construirProductosBusquedaDisponibles(this.productosFiltradosPorSede);
    }

    private construirProductosBusquedaDisponibles(productosBase: Producto[]): ProductoBusquedaOption[] {
        const productosFiltrados = this.filtroCategoria === 'todos'
            ? productosBase
            : productosBase.filter(producto => {
                const nombre = (producto.nombre || '').toLowerCase();
                const categoria = (producto.categoria || '').toLowerCase();

                switch (this.filtroCategoria) {
                    case 'lentes':
                        return nombre.includes('lente') || categoria.includes('lente');
                    case 'monturas':
                        return nombre.includes('montura') || categoria.includes('montura');
                    case 'accesorios':
                        return nombre.includes('accesorio') || categoria.includes('accesorio');
                    default:
                        return true;
                }
            });

        return productosFiltrados.map(producto => ({
            ...producto,
            disabled: !this.esProductoSeleccionable(producto),
            sedeNombre: this.obtenerNombreSedeProducto(producto.sede),
            motivoBloqueo: this.getMotivoBloqueoProducto(producto),
            esOtraSede: this.normalizarClaveSede(producto.sede) !== this.sedeActiva,
            requiereTraslado: this.esProductoOtraSede(producto) && this.esProductoSeleccionable(producto)
        }));
    }

    private normalizarProductoParaVenta(producto: Producto): Producto {
        return {
            ...producto,
            sede: this.normalizarClaveSede(producto.sede),
            precio: +(producto.precio ?? 0),
            precioConIva: +(producto.precioConIva ?? 0),
            aplicaIva: producto.aplicaIva ?? false,
            moneda: producto.moneda?.toLowerCase() === 'ves' ? 'bolivar' : producto.moneda ?? 'dolar',
            stock: producto.stock ?? 0
        };
    }

    private normalizarClaveSede(sede: string | null | undefined): string {
        return (sede ?? '').toString().trim().toLowerCase();
    }

    private obtenerNombreSedeProducto(sedeKey: string | null | undefined): string {
        const sedeNormalizada = this.normalizarClaveSede(sedeKey);
        const sedeInfo = sedeNormalizada ? this.userStateService.getSedePorKey(sedeNormalizada) : null;
        const nombreBase = sedeInfo?.nombre || sedeNormalizada || 'Sede no definida';
        return nombreBase.replace(/^sede\s+/i, '').replace(/\b\w/g, char => char.toUpperCase());
    }

    esProductoSeleccionable(producto: Producto): boolean {
        return (producto.stock ?? 0) > 0;
    }

    getMotivoBloqueoProducto(producto: Producto): string {
        if ((producto.stock ?? 0) <= 0) {
            return 'Sin stock disponible';
        }

        return '';
    }

    esProductoOtraSede(producto: Pick<Producto, 'sede'> | ItemCarrito): boolean {
        const sedeProducto = this.normalizarClaveSede(producto.sede);
        return !!sedeProducto && sedeProducto !== this.sedeActiva;
    }

    getMensajeTrasladoProducto(producto: Pick<Producto, 'sede'> | ItemCarrito): string {
        return `Traslado desde ${this.obtenerNombreSedeProducto(producto.sede)} hacia ${this.nombreSedeActivaVisible}`;
    }

    private construirMetadataTraslado(producto: Producto): ItemCarrito['metadata'] | undefined {
        if (!this.esProductoOtraSede(producto)) {
            return undefined;
        }

        return {
            requiereTraslado: true,
            sedeOrigen: this.normalizarClaveSede(producto.sede),
            sedeDestino: this.sedeActiva
        };
    }

    get nombreSedeActivaVisible(): string {
        return this.obtenerNombreSedeProducto(this.sedeActiva) || 'Sede actual';
    }

    get estaBuscandoProductosEnTodasLasSedes(): boolean {
        return this.normalizarClaveSede(this.sedeFiltro) === this.FILTRO_TODAS_SEDES;
    }

    get mensajeSinProductosBusqueda(): string {
        return this.estaBuscandoProductosEnTodasLasSedes
            ? 'No se encontraron productos activos en ninguna sede.'
            : `No se encontraron productos activos en ${this.nombreSedeActivaVisible}.`;
    }

    get productosConTraslado(): ItemCarrito[] {
        return this.venta.productos.filter(producto => !!producto.metadata?.requiereTraslado);
    }

    get tieneProductosConTraslado(): boolean {
        return this.productosConTraslado.length > 0;
    }

    private construirLineaTraslado(producto: Pick<ItemCarrito, 'nombre' | 'codigo' | 'sede' | 'metadata'>): string {
        const sedeOrigen = producto.metadata?.sedeOrigen || this.normalizarClaveSede(producto.sede);
        const codigo = producto.codigo && producto.codigo !== 'N/A' ? ` (${producto.codigo})` : '';
        return `Solicitud de traslado: ${producto.nombre}${codigo} desde sede ${this.obtenerNombreSedeProducto(sedeOrigen)}.`;
    }

    private construirObservacionesVenta(): string | undefined {
        const observacionManual = this.venta.observaciones?.trim() || '';
        const notasTraslado = this.productosConTraslado.map(producto => this.construirLineaTraslado(producto));
        const observaciones = [observacionManual, ...notasTraslado].filter(Boolean);
        return observaciones.length ? observaciones.join('\n') : undefined;
    }

    private construirDescripcionProductoVenta(producto: ItemCarrito): string {
        const descripcionBase = producto.descripcion?.trim() || '';
        const descripcionTraslado = producto.metadata?.requiereTraslado
            ? this.construirLineaTraslado(producto)
            : '';
        return [descripcionBase, descripcionTraslado].filter(Boolean).join(' | ');
    }

    onCantidadChange(p: any, nuevaCantidad: number): void {
        const cantidad = Math.max(1, +nuevaCantidad);
        const productoOriginal = this.venta.productos.find(prod => prod.id === p.id);
        if (!productoOriginal) return;

        if (cantidad > (productoOriginal.stock ?? 0)) {
            this.swalService.showWarning('Stock insuficiente', `Solo hay ${productoOriginal.stock} unidades disponibles.`);
            productoOriginal.cantidad = productoOriginal.stock;
        } else {
            productoOriginal.cantidad = cantidad;
        }

        this.actualizarProductosConDetalle();
    }

    determinarSiAplicaIva(producto: Producto): boolean {
        return producto.categoria === 'Monturas' || producto.nombre.toLowerCase().includes('monturas');
    }

    trackByProducto(index: number, item: any): string {
        return item.id;
    }

    actualizarProductosConDetalle(): void {
        const monedaDestino = this.venta.moneda;
        const tasaDestino = this.tasasDisponibles.find(t => t.nombre.toLowerCase() === monedaDestino)?.valor ?? 1;

        this.productosConDetalle = this.venta.productos.map(p => {
            const cantidad = p.cantidad ?? 1;
            const aplicaIva = p.aplicaIva ?? false;
            const tasaOrigen = this.tasasDisponibles.find(t => t.nombre.toLowerCase() === p.moneda)?.valor ?? 1;

            // PRECIO SIN IVA
            const precioUnitarioSinIvaConvertido = +(p.precio * (tasaOrigen / tasaDestino)).toFixed(2);

            // SUBTOTAL SIN IVA
            const subtotalSinIva = +(precioUnitarioSinIvaConvertido * cantidad).toFixed(2);

            // CALCULAR IVA ORIGINAL
            const ivaOriginal = aplicaIva ?
                +(subtotalSinIva * (this.ivaPorcentaje / 100)).toFixed(2) : 0;

            // PRECIO CON IVA
            const precioUnitarioConIva = aplicaIva ?
                +(precioUnitarioSinIvaConvertido * (1 + (this.ivaPorcentaje / 100))).toFixed(2) :
                precioUnitarioSinIvaConvertido;


            const totalOriginal = subtotalSinIva + ivaOriginal;

            // Cálculos con descuento (si aplica)
            const proporcionProducto = this.calcularProporcionProducto({
                precioConvertido: precioUnitarioSinIvaConvertido,
                cantidad,
                aplicaIva
            });

            const descuentoProducto = this.calcularDescuento() * proporcionProducto;
            const baseConDescuento = Math.max(subtotalSinIva - descuentoProducto, 0);

            const ivaConDescuento = aplicaIva ?
                +(baseConDescuento * (this.ivaPorcentaje / 100)).toFixed(2) : 0;

            const totalConDescuento = baseConDescuento + ivaConDescuento;

            return {
                ...p,
                codigo: p.codigo,
                cantidad,
                precioConvertido: precioUnitarioSinIvaConvertido,
                precioConIva: precioUnitarioConIva,
                subtotal: subtotalSinIva,
                iva: ivaOriginal,
                total: totalOriginal,
                descuentoAsignado: descuentoProducto,
                baseConDescuento: baseConDescuento,
                ivaConDescuento: ivaConDescuento,
                totalConDescuento: totalConDescuento,
                stock: p.stock,
                aplicaIva: aplicaIva
            };
        });

        // Actualizar el total de productos (subtotal sin IVA)
        this.totalProductos = this.productosConDetalle.reduce((acc, producto) => {
            return acc + (producto.subtotal || 0);
        }, 0);

    }

    calcularTotalProductos(): number {
        if (!Array.isArray(this.productosConDetalle)) return 0;

        // Calcular subtotal con IVA: suma de (precio con IVA * cantidad)
        return this.productosConDetalle.reduce((acc, p) => {
            // Si el producto aplica IVA, usar precioConIva, sino usar precioConvertido
            const precioUnitarioConIva = p.aplicaIva ? (p.precioConIva || 0) : (p.precioConvertido || 0);
            const subtotalProducto = precioUnitarioConIva * (p.cantidad || 1);
            return acc + subtotalProducto;
        }, 0);
    }

    eliminarMetodo(index: number): void {
        this.venta.metodosDePago.splice(index, 1);
        this.actualizarEstadoOrdenTrabajo();
    }

    onMetodoPagoChange(index: number): void {
        const metodo = this.venta.metodosDePago[index];

        // Asegurar que la moneda esté sincronizada con el tipo
        if (metodo.tipo && !metodo.moneda) {
            metodo.moneda = this.getMonedaParaMetodo(metodo.tipo, metodo);
        }

        if (metodo.monto && metodo.monto > 0) {
            const monedaMetodo = metodo.moneda || this.getMonedaParaMetodo(metodo.tipo, metodo);
            metodo.valorTemporal = `${metodo.monto.toFixed(2)} ${this.obtenerSimboloMoneda(monedaMetodo)}`;
        } else {
            metodo.valorTemporal = '';
        }

        this.cdr.detectChanges();
    }

    formatearMontoMetodo(index: number): void {
        const metodo = this.venta.metodosDePago[index];

        // Usar la moneda del método si existe, sino calcularla
        const monedaMetodo = metodo.moneda || this.getMonedaParaMetodo(metodo.tipo, metodo);

        if (!metodo.tipo) {
            metodo.valorTemporal = '';
            metodo.monto = 0;
            return;
        }

        const limpio = metodo.valorTemporal?.replace(/[^\d.,]/g, '').trim();

        if (!limpio) {
            metodo.monto = 0;
            metodo.valorTemporal = '';
            //ACTUALIZAR ESTADO DE ORDEN AL LIMPIAR
            this.actualizarEstadoOrdenTrabajo();
            return;
        }

        // Convertir coma decimal a punto para cálculo
        const montoString = limpio.replace(',', '.');
        const monto = parseFloat(montoString);

        if (isNaN(monto)) {
            metodo.monto = 0;
            metodo.valorTemporal = '';
            //ACTUALIZAR ESTADO DE ORDEN SI ES INVÁLIDO
            this.actualizarEstadoOrdenTrabajo();
            return;
        }

        // Obtener el máximo disponible en la MONEDA DEL MÉTODO
        const maximoEnMonedaMetodo = this.getMontoRestanteParaMetodo(index);

        let montoFinal = Math.min(monto, maximoEnMonedaMetodo);

        // Usar el nuevo formato venezolano para TODOS los métodos
        metodo.monto = montoFinal;
        metodo.valorTemporal = this.formatearMoneda(montoFinal, monedaMetodo);

        // Mostrar advertencia si el usuario intentó exceder el máximo
        if (monto > maximoEnMonedaMetodo) {
        }

        this.cdr.detectChanges();

        //ACTUALIZAR ESTADO DE ORDEN DE TRABAJO CUANDO CAMBIA UN MÉTODO DE PAGO
        this.actualizarEstadoOrdenTrabajo();
    }

    formatearInicialCashea(): void {
        const limpio = this.valorInicialTemporal.replace(/[^\d.,]/g, '').trim();
        const minimo = this.calcularInicialCasheaPorNivel(this.montoTotal, this.nivelCashea);

        // Si está vacío, asignar mínimo automáticamente
        if (!limpio) {
            this.venta.montoInicial = minimo;
            this.valorInicialTemporal = this.formatearMoneda(minimo, this.venta.moneda);
            this.generarCuotasCashea();

            return;
        }

        const montoString = limpio.replace(',', '.');
        const monto = parseFloat(montoString);

        // Si no es un número válido, asignar mínimo
        if (isNaN(monto)) {
            this.venta.montoInicial = minimo;
            this.valorInicialTemporal = this.formatearMoneda(minimo, this.venta.moneda);
            this.generarCuotasCashea();
            return;
        }

        // Si el monto es menor al mínimo, asignar mínimo y mostrar mensaje
        if (monto < minimo) {
            this.venta.montoInicial = minimo;
            this.valorInicialTemporal = this.formatearMoneda(minimo, this.venta.moneda);
            this.generarCuotasCashea();

            return;
        }

        // Monto válido - formatear correctamente
        this.venta.montoInicial = monto;
        this.valorInicialTemporal = this.formatearMoneda(monto, this.venta.moneda);
        this.generarCuotasCashea();
    }

    formatearMonto(): void {
        const limpio = this.valorTemporal.replace(/[^\d.,]/g, '').trim();

        if (!limpio) {
            this.venta.montoAbonado = 0;
            this.valorTemporal = '';
            this.montoExcedido = false;
            this.cdr.detectChanges();
            //ACTUALIZAR ESTADO DE ORDEN AL LIMPIAR
            this.actualizarEstadoOrdenTrabajo();
            return;
        }

        // Convertir coma decimal a punto para cálculo
        const montoString = limpio.replace(',', '.');
        const monto = parseFloat(montoString);
        const adeudado = this.montoTotal;

        if (isNaN(monto)) {
            this.venta.montoAbonado = 0;
            this.valorTemporal = '';
            this.montoExcedido = false;
            this.cdr.detectChanges();
            //ACTUALIZAR ESTADO DE ORDEN SI ES INVÁLIDO
            this.actualizarEstadoOrdenTrabajo();
            return;
        }

        this.montoExcedido = monto > adeudado;

        if (this.montoExcedido) {
            this.valorTemporal = this.formatearMoneda(adeudado, this.venta.moneda);
            this.venta.montoAbonado = adeudado;
            this.cdr.detectChanges();
            //ACTUALIZAR ESTADO DE ORDEN SI EXCEDE
            this.actualizarEstadoOrdenTrabajo();
            return;
        }

        this.venta.montoAbonado = monto;
        this.valorTemporal = this.formatearMoneda(monto, this.venta.moneda);
        this.cdr.detectChanges();

        //ACTUALIZAR ESTADO DE ORDEN DE TRABAJO CUANDO CAMBIA EL MONTO ABONADO
        this.actualizarEstadoOrdenTrabajo();
    }

    validarMontoMetodo(index: number): void {
        const maximo = this.getMontoRestanteParaMetodo(index);
        const actual = this.venta.metodosDePago[index].monto ?? 0;

        if (actual > maximo) {
            this.venta.metodosDePago[index].monto = maximo;
        }
    }

    // === CÁLCULOS FINANCIEROS CORREGIDOS ===
    get totalPagadoPorMetodos(): number {
        let sumaExacta = 0;

        this.venta.metodosDePago.forEach(metodo => {
            const montoMetodo = metodo.monto ?? 0;
            const monedaMetodo = this.getMonedaParaMetodo(metodo.tipo, metodo);

            // Convertir cada monto a la moneda del sistema SIN REDONDEAR
            if (monedaMetodo !== this.venta.moneda) {
                const conversionExacta = this.convertirMontoExacto(montoMetodo, monedaMetodo, this.venta.moneda);
                sumaExacta += conversionExacta;
            } else {
                sumaExacta += montoMetodo;
            }
        });

        return this.redondear(sumaExacta);
    }

    get montoCubiertoPorMetodos(): number {
        switch (this.venta.formaPago) {
            case 'contado':
                return this.redondear(this.montoTotal);
            case 'abono':
                return this.redondear(this.venta.montoAbonado ?? 0);
            case 'cashea':
                const inicial = this.redondear(this.venta.montoInicial ?? 0);
                const cuotasAdelantadas = this.redondear(this.resumenCashea.total);
                return this.redondear(inicial + cuotasAdelantadas);
            default:
                return 0;
        }
    }

    // Método mejorado para conversión exacta
    private convertirMontoExacto(monto: number, origen: string, destino: string): number {
        if (origen === destino) {
            return monto;
        }

        const tasas = {
            bolivar: this.tasasPorId['bolivar'] ?? 1,
            dolar: this.tasasPorId['dolar'] ?? 1,
            euro: this.tasasPorId['euro'] ?? 1
        };

        // Convertir a bolívares primero SIN REDONDEAR
        let montoEnBs: number;
        if (origen === 'dolar') {
            montoEnBs = monto * tasas.dolar;
        } else if (origen === 'euro') {
            montoEnBs = monto * tasas.euro;
        } else {
            montoEnBs = monto;
        }

        // Luego convertir a destino SIN REDONDEAR
        let resultado: number;
        if (destino === 'dolar') {
            resultado = montoEnBs / tasas.dolar;
        } else if (destino === 'euro') {
            resultado = montoEnBs / tasas.euro;
        } else {
            resultado = montoEnBs;
        }

        return resultado;
    }

    // Método para obtener equivalente en Bs de manera consistente
    obtenerEquivalenteBs(monto: number): number {
        const moneda = this.venta.moneda;
        if (moneda === 'bolivar') {
            return this.redondear(monto);
        }
        // Usar la misma lógica de conversión exacta
        return this.redondear(this.convertirMontoExacto(monto, moneda, 'bolivar'));
    }

    // Método mejorado de redondeo
    redondear(valor: number, decimales: number = 2): number {
        // Usar el método estándar de JavaScript para evitar inconsistencias
        return Number(valor.toFixed(decimales));
    }

    get totalPagadoPorMetodosEnBs(): number {
        let sumaExacta = 0;

        this.venta.metodosDePago.forEach(metodo => {
            const montoMetodo = metodo.monto ?? 0;
            const monedaMetodo = this.getMonedaParaMetodo(metodo.tipo, metodo);

            // Convertir cada monto a bolívares SIN REDONDEAR
            if (monedaMetodo === 'dolar') {
                sumaExacta += montoMetodo * (this.tasasPorId['dolar'] ?? 1);
            } else if (monedaMetodo === 'euro') {
                sumaExacta += montoMetodo * (this.tasasPorId['euro'] ?? 1);
            } else {
                sumaExacta += montoMetodo;
            }
        });

        return this.redondear(sumaExacta);
    }

    get restantePorMetodos(): number {
        const pagado = this.totalPagadoPorMetodos;
        const requerido = this.montoCubiertoPorMetodos;

        // Usar comparación con tolerancia para decimales
        const diferencia = Math.abs(pagado - requerido);

        if (diferencia < 0.01) {
            return 0;
        }

        return Math.max(requerido - pagado, 0);
    }

    get desbalanceMetodos(): boolean {
        const pagado = this.totalPagadoPorMetodos;
        const requerido = this.montoCubiertoPorMetodos;
        const diferencia = pagado - requerido;

        // Considerar desbalance solo si la diferencia es significativa
        return diferencia > 0.01;
    }

    get progresoMetodos(): number {
        const pagado = this.totalPagadoPorMetodos;
        const requerido = this.montoCubiertoPorMetodos;

        if (requerido === 0) return 0;
        if (Math.abs(pagado - requerido) < 0.01) return 100;

        const porcentaje = (pagado / requerido) * 100;
        return Math.min(this.redondear(porcentaje), 100);
    }

    get progresoPago(): number {
        let pagado = 0;

        switch (this.venta.formaPago) {
            case 'cashea':
                const plan = this.calcularCasheaPlan(this.cantidadCuotasCashea);
                pagado = plan.inicial + plan.cuotasOrdenadas.reduce((total, cuota) => {
                    return cuota.pagada ? total + cuota.monto : total;
                }, 0);
                break;
            case 'abono':
                pagado = this.venta.montoAbonado ?? 0;
                break;
            case 'contado':
                pagado = this.totalPagadoPorMetodos;
                break;
            default:
                pagado = 0;
        }

        const requerido = this.montoRequeridoSegunFormaPago;
        if (requerido === 0) return 0;

        const diferencia = Math.abs(pagado - requerido);
        if (diferencia < 0.01) return 100;

        const porcentaje = (pagado / requerido) * 100;
        return Math.min(Math.round(porcentaje * 100) / 100, 100);
    }

    get montoRequeridoSegunFormaPago(): number {
        switch (this.venta.formaPago) {
            case 'contado':
                return this.montoTotal;
            case 'abono':
                return this.venta.montoAbonado ?? 0;
            case 'cashea':
                return this.venta.montoInicial ?? 0;
            default:
                return 0;
        }
    }

    get porcentajeAbonadoDelTotal(): number {
        const abonado = this.venta.montoAbonado ?? 0;
        const total = this.montoTotal;

        if (total === 0) return 0;

        const porcentaje = (abonado / total) * 100;
        return Math.min(Math.round(porcentaje * 100) / 100, 100);
    }

    // === MÉTODOS DE CONVERSIÓN ===
    convertirMonto(monto: number, origen: string, destino: string, redondearResultado: boolean = true): number {
        if (origen === destino) {
            return redondearResultado ? this.redondear(monto) : monto;
        }

        const tasas = {
            bolivar: this.tasasPorId['bolivar'] ?? 1,
            dolar: this.tasasPorId['dolar'] ?? 1,
            euro: this.tasasPorId['euro'] ?? 1
        };

        // Convertir a bolívares primero
        let montoEnBs: number;
        if (origen === 'dolar') {
            montoEnBs = monto * tasas.dolar;
        } else if (origen === 'euro') {
            montoEnBs = monto * tasas.euro;
        } else {
            montoEnBs = monto;
        }

        // Luego convertir a destino
        let resultado: number;
        if (destino === 'dolar') {
            resultado = montoEnBs / tasas.dolar;
        } else if (destino === 'euro') {
            resultado = montoEnBs / tasas.euro;
        } else {
            resultado = montoEnBs;
        }

        return redondearResultado ? this.redondear(resultado) : resultado;
    }

    private limpiarCamposAbono(): void {
        this.venta.montoAbonado = 0;
        this.valorTemporal = '';
        this.montoExcedido = false;

        // Si hay métodos de pago, también limpiarlos
        this.venta.metodosDePago = [];

        // Actualizar cálculos
        this.actualizarProductosConDetalle();
    }

    private limpiarCamposFormaPagoAnterior(): void {
        const formaPagoActual = this.venta.formaPago;

        switch (formaPagoActual) {
            case 'abono':
                this.venta.montoAbonado = 0;
                this.valorTemporal = '';
                this.montoExcedido = false;
                break;

            case 'cashea':
                this.venta.montoInicial = 0;
                this.valorInicialTemporal = '';
                this.cuotasCashea = [];
                this.resumenCashea = { cantidad: 0, total: 0, totalBs: 0 };
                break;

            case 'contado':
            case 'de_contado-pendiente':
                // No hay campos específicos para limpiar
                break;
        }

        // Siempre limpiar métodos de pago
        this.venta.metodosDePago = [];
    }

    onFormaPagoChange(valor: string): void {
        const formaPagoAnterior = this.venta.formaPago;
        this.limpiarCamposFormaPagoAnterior();

        // Validar según el tipo de venta
        if (this.tipoVenta === 'solo_consulta') {
            // Solo consulta: solo permite contado y cashea
            if (valor !== 'contado' && valor !== 'cashea') {
                this.swalService.showWarning(
                    'Forma de pago no válida',
                    'Para ventas solo de consulta, solo se permite pago de contado o Cashea.'
                );
                return;
            }
        }

        this.venta.formaPago = valor;

        // ... resto del código existente ...
    }
    // Nuevo método para resetear métodos de pago
    private resetearMetodosPago(): void {
        this.venta.metodosDePago = [];
    }

    actualizarEstadoOrdenTrabajo(): void {
        const tieneRequisitos = this.verificarRequisitosOrdenTrabajo();

        if (!tieneRequisitos) {
            this.generarOrdenTrabajo = false;
            this.forzarOrdenTrabajo = false;
            return;
        }

        const formaPago = this.venta.formaPago;
        const montoAbonado = this.venta.montoAbonado || 0;
        const porcentajeAbonado = this.montoTotal > 0 ? (montoAbonado / this.montoTotal) * 100 : 0;

        // Si ya está forzado, mantenerlo así
        if (this.forzarOrdenTrabajo) {
            this.generarOrdenTrabajo = true;
            return;
        }

        // Lógica normal solo si NO está forzado
        let estadoPorDefecto = false;

        switch (formaPago) {
            case 'contado':
            case 'cashea':
                estadoPorDefecto = true;
                break;
            case 'abono':
                estadoPorDefecto = porcentajeAbonado >= this.porcentajeMinimoOrdenTrabajo;
                break;
            case 'de_contado-pendiente':
            default:
                estadoPorDefecto = false;
        }

        this.generarOrdenTrabajo = estadoPorDefecto;
    }

    async toggleSwitchOrdenTrabajo(): Promise<void> {
        // 1. Verificar requisitos básicos
        const tieneRequisitos = this.verificarRequisitosOrdenTrabajo();

        if (!tieneRequisitos) {
            this.mostrarErrorRequisitosOrdenTrabajo();
            this.generarOrdenTrabajo = false;
            this.forzarOrdenTrabajo = false;
            return;
        }

        const formaPago = this.venta.formaPago;
        const montoTotal = this.montoTotal;
        const montoAbonado = this.venta.montoAbonado || 0;
        const porcentajeAbonado = montoTotal > 0 ? (montoAbonado / montoTotal) * 100 : 0;

        // 2. Determinar si cumple condiciones automáticas
        let cumpleCondicionesAutomaticas = false;

        switch (formaPago) {
            case 'contado':
            case 'cashea':
                cumpleCondicionesAutomaticas = true;
                break;
            case 'abono':
                cumpleCondicionesAutomaticas = porcentajeAbonado >= this.porcentajeMinimoOrdenTrabajo;
                break;
            case 'de_contado-pendiente':
                cumpleCondicionesAutomaticas = false;
                break;
            default:
                cumpleCondicionesAutomaticas = false;
        }

        // 3. Si está DESACTIVADO y el usuario lo quiere ACTIVAR
        if (!this.generarOrdenTrabajo) {
            // 3.1 Si cumple condiciones automáticas → activar normalmente
            if (cumpleCondicionesAutomaticas) {
                this.generarOrdenTrabajo = true;
                this.forzarOrdenTrabajo = false;

                return;
            }

            // 3.2 Si NO cumple condiciones → activar como forzado SIN MODAL
            this.generarOrdenTrabajo = true;
            this.forzarOrdenTrabajo = true;
            this.registrarForzadoOrdenTrabajo();

            // Mostrar snackbar informativo
            let mensaje = '';
            if (formaPago === 'abono') {
                mensaje = `Orden activada (${porcentajeAbonado.toFixed(1)}% abonado)`;
            } else if (formaPago === 'de_contado-pendiente') {
                mensaje = 'Orden activada con pago pendiente';
            } else {
                mensaje = 'Orden activada manualmente';
            }

        }
        else {
            this.generarOrdenTrabajo = false;
            this.forzarOrdenTrabajo = false;

        }
    }

    private verificarRequisitosOrdenTrabajo(): boolean {
        // 1. Paciente seleccionado
        const tienePaciente = !!this.pacienteSeleccionado;

        // 2. Historia médica seleccionada
        const tieneHistoria = !!this.historiaMedicaSeleccionada;

        // 3. Formulación completa (independientemente del estado de pago)
        const tieneFormula = tieneHistoria && this.tieneFormulaCompleta(this.historiaMedicaSeleccionada);

        return tienePaciente && tieneHistoria && tieneFormula;
    }

    private registrarForzadoOrdenTrabajo(): void {
        const formaPago = this.venta.formaPago;
        const montoAbonado = this.venta.montoAbonado || 0;
        const montoTotal = this.montoTotal;
        const porcentajeAbonado = montoTotal > 0 ? (montoAbonado / montoTotal) * 100 : 0;

        const datosForzado = {
            fecha: new Date().toISOString(),
            usuario: this.currentUser?.nombre || 'Desconocido',
            paciente: this.pacienteSeleccionado?.informacionPersonal?.nombreCompleto,
            cedula: this.pacienteSeleccionado?.informacionPersonal?.cedula,
            historia: this.historiaMedicaSeleccionada?.nHistoria,
            formaPago: formaPago,
            montoTotal: montoTotal,
            montoAbonado: montoAbonado,
            porcentajeAbonado: porcentajeAbonado,
            porcentajeMinimo: this.porcentajeMinimoOrdenTrabajo,
            razon: 'Forzado manualmente por usuario'
        };
    }


    // Método para forzar la orden de trabajo
    onForzarOrdenTrabajoChange(): void {
        // Primero verificar si cumple con los requisitos mínimos
        const tieneRequisitos = this.verificarRequisitosOrdenTrabajo();

        if (!tieneRequisitos && this.forzarOrdenTrabajo) {
            // Si no tiene requisitos y se intenta forzar, mostrar error y revertir
            this.forzarOrdenTrabajo = false;
            this.generarOrdenTrabajo = false;
            this.mostrarErrorRequisitosOrdenTrabajo();
            return;
        }

        if (this.forzarOrdenTrabajo) {
            // Mostrar confirmación para forzar
            this.swalService.showConfirm(
                'Forzar Orden de Trabajo',
                this.crearMensajeConfirmacionForzarOrden(),
                'Sí, forzar',
                'Cancelar'
            ).then((result) => {
                if (result.isConfirmed) {
                    this.generarOrdenTrabajo = true;
                    this.registrarForzadoOrdenTrabajo();
                } else {
                    this.forzarOrdenTrabajo = false;
                    this.generarOrdenTrabajo = false;
                    this.actualizarEstadoOrdenTrabajo();
                }
            });
        } else {
            // Volver a la lógica normal
            this.actualizarEstadoOrdenTrabajo();
        }
    }

    // Método para mostrar error cuando faltan requisitos
    private mostrarErrorRequisitosOrdenTrabajo(): void {
        let mensajeError = 'No se puede forzar la orden de trabajo porque faltan requisitos:<br><br>';
        let faltanRequisitos = [];

        if (!this.pacienteSeleccionado) {
            faltanRequisitos.push('• No hay paciente seleccionado');
        }

        if (!this.historiaMedicaSeleccionada) {
            faltanRequisitos.push('• No hay historia médica seleccionada');
        } else if (!this.tieneFormulaCompleta(this.historiaMedicaSeleccionada)) {
            faltanRequisitos.push('• La historia seleccionada no tiene fórmula óptica completa');
        }

        mensajeError += faltanRequisitos.join('<br>');
        mensajeError += '<br><br><strong>La orden de trabajo solo se puede generar con formulación óptica completa.</strong>';

        this.swalService.showError('Faltan requisitos', mensajeError);
    }

    // Crear mensaje de confirmación dinámico
    private crearMensajeConfirmacionForzarOrden(): string {
        const formaPago = this.venta.formaPago;
        const montoAbonado = this.venta.montoAbonado ?? 0;
        const montoTotal = this.montoTotal;
        const porcentajeAbonado = montoTotal > 0 ? (montoAbonado / montoTotal) * 100 : 0;

        let mensaje = '<div class="text-start">';

        if (formaPago === 'abono' && porcentajeAbonado < this.porcentajeMinimoOrdenTrabajo) {
            mensaje += `
            <p class="text-warning"><strong>⚠️ ATENCIÓN</strong></p>
            <p>Está forzando la orden de trabajo con solo el <strong>${porcentajeAbonado.toFixed(1)}%</strong> abonado 
            (mínimo requerido: ${this.porcentajeMinimoOrdenTrabajo}%).</p>
        `;
        } else if (formaPago === 'de_contado-pendiente') {
            mensaje += `
            <p class="text-danger"><strong>🚫 PAGO PENDIENTE</strong></p>
            <p>Está forzando la orden de trabajo sin pago previo.</p>
        `;
        }

        mensaje += `
        <p><strong>Esta acción se registra en el sistema y debe usarse solo para casos especiales:</strong></p>
        <ul>
            <li>Clientes fijos/recidivos</li>
            <li>Familiares de empleados</li>
            <li>Amigos del personal</li>
            <li>Acuerdos especiales autorizados</li>
        </ul>
        <p class="mt-3"><strong>¿Desea continuar?</strong></p>
    </div>`;

        return mensaje;
    }

    validarInicialCashea(): void {
        const totalConDescuento = this.montoTotal;
        const minimo = this.calcularInicialCasheaPorNivel(totalConDescuento, this.nivelCashea);
        if ((this.venta.montoInicial ?? 0) < minimo) {
            this.venta.montoInicial = minimo;
            this.snackBar.open(`La inicial no puede ser menor a ${minimo} ${this.obtenerSimboloMoneda(this.venta.moneda)} para ${this.nivelCashea}`, 'Cerrar', {
                duration: 3000
            });
        }
    }

    onDescuentoChange(): void {
        if (this.venta.descuento < 0) this.venta.descuento = 0;
        if (this.venta.descuento > 100) this.venta.descuento = 100;

        // Recalcular productos con los nuevos valores de descuento
        this.actualizarProductosConDetalle();

        if (this.venta.formaPago === 'cashea') {
            this.actualizarMontoInicialCashea();
            this.generarCuotasCashea();
        }

        // Forzar actualización de la vista
        this.cdr.detectChanges();
    }

    actualizarMontoInicialCashea(): void {
        const totalConDescuento = this.montoTotal;
        const nuevoMontoInicial = this.calcularInicialCasheaPorNivel(totalConDescuento, this.nivelCashea);

        this.venta.montoInicial = nuevoMontoInicial;
        this.valorInicialTemporal = this.formatearMoneda(nuevoMontoInicial, this.venta.moneda);
    }

    private controlarCuotasPorNivel(): void {
        const nivelesConCuotasExtendidas = ['nivel3', 'nivel4', 'nivel5', 'nivel6'];
        const nivelPermite6Cuotas = nivelesConCuotasExtendidas.includes(this.nivelCashea);

        if (!nivelPermite6Cuotas) {
            if (this.cantidadCuotasCashea !== 3) {
                this.cantidadCuotasCashea = 3;
            }
        }
    }

    get puedeCambiarMoneda(): boolean {
        return this.venta.formaPago !== 'cashea';
    }

    get casheaConfiguradoCorrectamente(): boolean {
        if (this.venta.formaPago !== 'cashea') return true;

        const inicialMinima = this.calcularInicialCasheaPorNivel(this.montoTotal, this.nivelCashea);
        const inicialActual = this.venta.montoInicial ?? 0;

        return inicialActual >= inicialMinima;
    }

    calcularCasheaPlan(numeroCuotas: number): {
        inicial: number;
        cuotasOrdenadas: CuotaCashea[];
    } {
        const total = this.montoTotal;
        let inicial = this.venta.montoInicial ?? this.calcularInicialCasheaPorNivel(total, this.nivelCashea);

        if (inicial > total) {
            inicial = total;
        }

        const restante = Math.max(total - inicial, 0);
        const montoPorCuota = numeroCuotas > 0 ? +(restante / numeroCuotas).toFixed(2) : 0;

        const hoy = new Date();
        const cuotasOrdenadas: CuotaCashea[] = [];

        for (let i = 1; i <= numeroCuotas; i++) {
            const fechaBase = new Date();
            const fechaCuota = new Date(fechaBase);
            fechaCuota.setDate(fechaBase.getDate() + i * 14);

            cuotasOrdenadas.push({
                id: i,
                fecha: fechaCuota.toLocaleDateString('es-VE', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                }),
                monto: montoPorCuota,
                pagada: false,
                seleccionada: false,
                habilitada: false
            });
        }

        return {
            inicial,
            cuotasOrdenadas
        };
    }

    get cantidadCuotas(): number {
        return this.calcularCasheaPlan(this.cantidadCuotasCashea).cuotasOrdenadas.length;
    }

    get montoPrimeraCuota(): number {
        return this.calcularCasheaPlan(this.cantidadCuotasCashea).cuotasOrdenadas[0]?.monto ?? 0;
    }

    obtenerNombreNivelCashea(nivel: string): string {
        const nombres: Record<string, string> = {
            nivel1: 'Nivel 1 (60%)',
            nivel2: 'Nivel 2 (50%)',
            nivel3: 'Nivel 3 (40%)',
            nivel4: 'Nivel 4 (40%)',
            nivel5: 'Nivel 5 (40%)',
            nivel6: 'Nivel 6 (40%)'
        };
        return nombres[nivel] ?? nivel;
    }

    nivelPermiteCuotasExtendidas(nivel: string): boolean {
        const nivelesPermitidos = ['nivel3', 'nivel4', 'nivel5', 'nivel6'];
        return nivelesPermitidos.includes(nivel);
    }

    calcularInicialCasheaPorNivel(total: number, nivel: string): number {
        const porcentajes: Record<string, number> = {
            nivel1: 0.60,
            nivel2: 0.50,
            nivel3: 0.40,
            nivel4: 0.40,
            nivel5: 0.40,
            nivel6: 0.40
        };
        return +(total * (porcentajes[nivel] ?? 0.40)).toFixed(2);
    }

    generarCuotasCashea(): void {
        if (this.venta.formaPago !== 'cashea') {
            return;
        }

        this.venta.moneda = 'dolar';
        const total = this.montoTotal;
        const minimo = this.calcularInicialCasheaPorNivel(total, this.nivelCashea);

        // Validación robusta del monto inicial
        if (!this.venta.montoInicial || this.venta.montoInicial < minimo || isNaN(this.venta.montoInicial)) {
            this.venta.montoInicial = minimo;
            if (document.activeElement?.tagName !== 'INPUT') {
                this.valorInicialTemporal = this.formatearMoneda(minimo, this.venta.moneda);
            }
        }

        if (this.venta.montoInicial > total) {
            this.venta.montoInicial = total;
            if (document.activeElement?.tagName !== 'INPUT') {
                this.valorInicialTemporal = this.formatearMoneda(total, this.venta.moneda);
            }
        }

        const plan = this.calcularCasheaPlan(this.cantidadCuotasCashea);

        //Verificar si el pago inicial cubre el total
        const deudaPendiente = total - this.venta.montoInicial;
        const noHayDeuda = deudaPendiente <= 0.01; // Tolerancia para decimales

        this.cuotasCashea = plan.cuotasOrdenadas.map((cuota, index) => ({
            ...cuota,
            habilitada: index === 0 && !noHayDeuda, // Solo habilitar si hay deuda pendiente
            monto: noHayDeuda ? 0 : cuota.monto, // Si no hay deuda, monto de cuota es 0
            pagada: noHayDeuda // Si no hay deuda, marcar como pagadas automáticamente
        }));

        // Si no hay deuda, limpiar cualquier selección previa
        if (noHayDeuda) {
            this.resumenCashea = { cantidad: 0, total: 0, totalBs: 0 };
        }

        this.actualizarResumenCashea();
        this.cdr.detectChanges();
    }

    toggleCuotaSeleccionada(index: number): void {
        const cuota = this.cuotasCashea[index];
        const estabaSeleccionada = cuota.seleccionada;

        cuota.seleccionada = !cuota.seleccionada;

        if (cuota.seleccionada) {
            cuota.pagada = true;
            if (index + 1 < this.cuotasCashea.length) {
                this.cuotasCashea[index + 1].habilitada = true;
            }
        } else {
            cuota.pagada = false;
            for (let i = index + 1; i < this.cuotasCashea.length; i++) {
                this.cuotasCashea[i].seleccionada = false;
                this.cuotasCashea[i].pagada = false;
                this.cuotasCashea[i].habilitada = false;
            }
        }

        this.actualizarResumenCashea();

        this.mostrarFeedbackCambioCuota(estabaSeleccionada, cuota);
    }

    private mostrarFeedbackCambioCuota(estabaSeleccionada: boolean, cuota: CuotaCashea): void {
        const accion = estabaSeleccionada ? 'eliminada' : 'agregada';
        const mensaje = `Cuota ${cuota.id} ${accion}. Monto requerido actualizado.`;

        this.snackBar.open(mensaje, 'Cerrar', {
            duration: 2000,
            panelClass: ['snackbar-info']
        });
    }

    // En el método que actualiza el resumen Cashea
    actualizarResumenCashea(): void {
        const seleccionadas = this.cuotasCashea.filter(c => c.seleccionada);
        const total = seleccionadas.reduce((sum, c) => sum + c.monto, 0);

        this.resumenCashea = {
            cantidad: seleccionadas.length,
            total,
            totalBs: this.redondear(this.obtenerEquivalenteBs(total))
        };

        // Forzar recálculo de validación
        this.cdr.detectChanges();
    }

    // En el método que maneja cambios en el nivel Cashea
    onNivelCasheaChange(): void {
        if (this.venta.formaPago === 'cashea') {
            this.venta.moneda = 'dolar';
            this.controlarCuotasPorNivel();
            this.actualizarMontoInicialCashea();
            this.generarCuotasCashea();

            if (this.venta.montoInicial && this.venta.montoInicial > 0) {
                this.valorInicialTemporal = this.formatearMoneda(this.venta.montoInicial, this.venta.moneda);
            }
        }
    }

    get casheaBalanceValido(): boolean {
        const plan = this.calcularCasheaPlan(this.cantidadCuotasCashea);
        const totalPagado = this.redondear(
            plan.inicial + plan.cuotasOrdenadas.reduce((total, cuota) => total + cuota.monto, 0)
        );
        return Math.abs(totalPagado - this.montoTotal) < 0.01;
    }

    get esPagoCompletoCashea(): boolean {
        if (this.venta.formaPago !== 'cashea') return false;

        const inicial = this.venta.montoInicial ?? 0;
        const totalCuotasAdelantadas = this.resumenCashea.total;
        const totalPagado = inicial + totalCuotasAdelantadas;

        return Math.abs(totalPagado - this.montoTotal) < 0.01;
    }

    get mensajeResumenCashea(): string {
        if (this.esPagoCompletoCashea) {
            return 'Pago completo - Sin cuotas pendientes';
        }

        const cuotasAdelantadas = this.resumenCashea.cantidad;
        const montoAdelantado = this.resumenCashea.total;

        return `Adelantando ${cuotasAdelantadas} cuota${cuotasAdelantadas > 1 ? 's' : ''} (${this.formatearMoneda(montoAdelantado, this.venta.moneda)})`;
    }

    // En el método que asigna el inicial por nivel
    asignarInicialPorNivel(): void {
        const totalConDescuento = this.montoTotal;
        const minimo = this.calcularInicialCasheaPorNivel(totalConDescuento, this.nivelCashea);
        this.venta.montoInicial = minimo;
        this.valorInicialTemporal = this.formatearMoneda(minimo, this.venta.moneda);

        this.controlarCuotasPorNivel();
        this.generarCuotasCashea(); // Asegurar que se generen las cuotas
    }

    redondearDosDecimales(valor: number): number {
        return Math.round(valor * 100) / 100;
    }

    truncarDosDecimales(valor: number): number {
        const partes = valor.toString().split('.');
        if (partes.length === 1) return valor;

        const decimales = partes[1].substring(0, 2);
        return parseFloat(`${partes[0]}.${decimales.padEnd(2, '0')}`);
    }

    obtenerSimboloMoneda(id: string): string {
        const normalizado = this.idMap[id?.toLowerCase()] ?? id?.toLowerCase();

        // Mapeo directo para símbolos
        if (normalizado === 'ves' || normalizado === 'bolivar' || normalizado === 'bs') {
            return 'Bs. ';
        }

        const moneda = this.tasasDisponibles.find(m => m.id === normalizado);
        return moneda?.simbolo ?? '';
    }

    private normalizarMonedaMetodo(moneda?: string): string {
        const monedaNormalizada = moneda?.toLowerCase();

        switch (monedaNormalizada) {
            case 'usd':
            case 'dolar':
                return 'dolar';
            case 'eur':
            case 'euro':
                return 'euro';
            case 'ves':
            case 'bs':
            case 'bolivar':
                return 'bolivar';
            default:
                return '';
        }
    }

    private getMonedaDefectoParaMetodo(tipoMetodo: string): string {
        const monedaConfigurada = this.tiposPago.find((tipo) => tipo.value === (tipoMetodo as VentaPaymentMethodValue))?.defaultMoneda;
        if (monedaConfigurada) {
            return monedaConfigurada;
        }

        const monedasPorMetodo: { [key: string]: string } = {
            'efectivo': 'dolar',
            'punto': 'bolivar',
            'zelle': 'dolar',
            'pagomovil': 'bolivar',
            'transferencia': 'bolivar'
        };

        return monedasPorMetodo[tipoMetodo] || 'dolar';
    }

    getMonedaParaMetodo(tipoMetodo: string, metodo?: MetodoPago): string {
        if (tipoMetodo === 'efectivo') {
            return this.normalizarMonedaMetodo(metodo?.moneda) || this.getMonedaDefectoParaMetodo(tipoMetodo);
        }

        return this.getMonedaDefectoParaMetodo(tipoMetodo);
    }

    esMetodoEnBolivares(tipoMetodo: string): boolean {
        if (tipoMetodo !== 'efectivo') {
            const monedaConfigurada = this.tiposPago.find((tipo) => tipo.value === (tipoMetodo as VentaPaymentMethodValue))?.defaultMoneda;
            if (monedaConfigurada) {
                return monedaConfigurada === 'bolivar';
            }
        }

        const metodosEnBs = ['debito', 'credito', 'pagomovil', 'transferencia'];
        return metodosEnBs.includes(tipoMetodo);
    }

    getMontoRestanteParaMetodo(index: number): number {
        // 1. DETERMINAR MONTO REQUERIDO SEGÚN FORMA DE PAGO
        let montoRequerido = 0;

        switch (this.venta.formaPago) {
            case 'contado':
                // De contado: debe pagar el TOTAL de la venta
                montoRequerido = this.totalPagar;
                break;

            case 'abono':
                // Abono: solo debe pagar el monto del abono
                montoRequerido = this.venta.montoAbonado || 0;
                break;

            case 'cashea':
                // Cashea: debe pagar la INICIAL (obligatorio) + cuotas adelantadas (opcional)
                const inicial = this.venta.montoInicial || 0;
                const cuotasAdelantadas = this.resumenCashea.total || 0;
                montoRequerido = inicial + cuotasAdelantadas;
                break;

            case 'de_contado-pendiente':
                // Pendiente por pago: NO requiere métodos de pago
                montoRequerido = 0;
                break;

            default:
                montoRequerido = this.totalPagar;
        }

        // 2. CALCULAR LO YA PAGADO POR OTROS MÉTODOS
        const otrosMontos = this.venta.metodosDePago
            .filter((_, i) => i !== index)
            .reduce((sum, metodo) => {
                const montoMetodo = metodo.monto ?? 0;
                const monedaMetodo = this.getMonedaParaMetodo(metodo.tipo, metodo);

                // Convertir cada monto a la moneda del sistema
                if (monedaMetodo !== this.venta.moneda) {
                    const conversionExacta = this.convertirMontoExacto(montoMetodo, monedaMetodo, this.venta.moneda);
                    return sum + conversionExacta;
                }
                return sum + montoMetodo;
            }, 0);

        // 3. CALCULAR RESTANTE
        // Si es pendiente, no hay restante
        if (this.venta.formaPago === 'de_contado-pendiente') {
            return 0;
        }

        // El restante es la diferencia entre lo requerido y lo ya pagado
        const restanteEnSistema = Math.max(montoRequerido - otrosMontos, 0);

        // 4. CONVERTIR A LA MONEDA DEL MÉTODO ACTUAL
        const metodoActual = this.venta.metodosDePago[index];
        const monedaMetodoActual = this.getMonedaParaMetodo(metodoActual.tipo, metodoActual);

        // Si está en la misma moneda, devolver directamente
        if (monedaMetodoActual === this.venta.moneda) {
            return this.redondear(restanteEnSistema);
        }

        // Convertir el restante a la moneda del método
        const restanteEnMonedaMetodo = this.convertirMontoExacto(restanteEnSistema, this.venta.moneda, monedaMetodoActual);

        return this.redondear(restanteEnMonedaMetodo);
    }

    onMontoInputChange(index: number, event: any): void {
        const metodo = this.venta.metodosDePago[index];
        const inputValue = event.target.value;

        // Extraer solo números y punto decimal
        const limpio = inputValue.replace(/[^\d.]/g, '');

        if (!limpio) {
            return;
        }

        const monto = parseFloat(limpio);

        if (isNaN(monto)) {
            return;
        }

        // Validación en tiempo real - prevenir que exceda el máximo
        const monedaMetodo = this.getMonedaParaMetodo(metodo.tipo, metodo);
        const maximoEnMonedaSistema = this.getMontoRestanteParaMetodo(index);
        const maximoEnMonedaMetodo = monedaMetodo === this.venta.moneda
            ? maximoEnMonedaSistema
            : this.convertirMontoExacto(maximoEnMonedaSistema, this.venta.moneda, monedaMetodo);

        // Si excede el máximo, mostrar indicación visual
        if (monto > maximoEnMonedaMetodo) {
            event.target.classList.add('input-excedido');
        } else {
            event.target.classList.remove('input-excedido');
        }
    }

    // === MÉTODOS DE UI ===
    getSimboloMonedaActual(): string {
        return this.simboloMonedaSistema;
    }

    esMonedaBolivar(moneda: string): boolean {
        if (!moneda) return false;
        const monedaNormalizada = moneda.toLowerCase();
        return monedaNormalizada === 'bolivar' || monedaNormalizada === 'ves' || monedaNormalizada === 'bs';
    }

    getPrecioParaMostrar(producto: any): number {
        return producto.precioConvertido || producto.precio || 0;
    }

    getPrecioEnBs(producto: any): number {
        return this.productoConversionService.getPrecioEnBs(producto);
    }

    getPlaceholderMonto(tipoMetodo: string, metodo?: MetodoPago): string {
        if (!tipoMetodo) return 'Ingrese un monto';

        if (this.esMetodoEnBolivares(tipoMetodo)) {
            return 'Monto en Bs';
        }

        const monedaMetodo = this.getMonedaParaMetodo(tipoMetodo, metodo);
        const simbolo = this.obtenerSimboloMoneda(monedaMetodo);
        return `Monto en ${simbolo}`;
    }

    // Método para manejar el foco en el campo banco
    onBancoFocus(index: number): void {
        const metodo = this.venta.metodosDePago[index];
        if (!metodo.banco) {
            setTimeout(() => {
                this.cdr.detectChanges();
            }, 0);
        }
    }

    // === MÉTODOS DE VENTA ===
    abrirModalResumen(): void {
        // Validar según el tipo de venta
        if (this.tipoVenta === 'solo_productos' || this.tipoVenta === 'consulta_productos') {
            // Para ventas con productos, verificar que haya productos
            if (this.venta.productos.length === 0 && !this.consultaEnCarrito) {
                this.swalService.showWarning('Sin items', 'Debes agregar items al carrito para continuar.');
                return;
            }
        }

        const hayFormulacion = !!this.historiaMedica?.examenOcular?.refraccionFinal;
        if (hayFormulacion && !this.pacienteSeleccionado) {
            this.swalService.showWarning('Paciente requerido', 'Debes seleccionar un paciente para aplicar la formulación.');
            return;
        }

        this.actualizarProductosConDetalle();

        const modalElement = document.getElementById('resumenVentaModal');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    }

    limpiarTodosLosSelects(): void {
        this.productoSeleccionado = null;
        this.pacienteSeleccionado = null;

        setTimeout(() => {
            if (this.productoSelect) {
                this.productoSelect.clearModel();
                this.productoSelect.close();

                if (this.productoSelect.searchInput) {
                    this.productoSelect.searchInput.nativeElement.value = '';
                    this.productoSelect.searchInput.nativeElement.dispatchEvent(new Event('input'));
                }
            }

            if (this.selectorPaciente) {
                this.selectorPaciente.clearModel();
                this.selectorPaciente.close();

                if (this.selectorPaciente.searchInput) {
                    this.selectorPaciente.searchInput.nativeElement.value = '';
                    this.selectorPaciente.searchInput.nativeElement.dispatchEvent(new Event('input'));
                }
            }

            // Forzar detección de cambios
            this.cdr.detectChanges();
        });
    }

    limpiarSelectProductos(): void {
        this.productoSeleccionado = null;

        setTimeout(() => {
            if (this.productoSelect) {
                this.productoSelect.close();
                this.productoSelect.clearModel();

                if (this.productoSelect.searchInput) {
                    this.productoSelect.searchInput.nativeElement.value = '';
                    this.productoSelect.searchInput.nativeElement.dispatchEvent(new Event('input'));
                }

                setTimeout(() => {
                    if (this.productoSelect) {
                        this.productoSelect.close();
                    }
                }, 50);
            }
            this.cdr.detectChanges();
        }, 100);
    }

    // === VALIDACIONES ===
    validarEntrada(event: KeyboardEvent): void {
        const tecla = event.key;
        const valorActual = this.valorInicialTemporal;

        // Permitir: números, coma, punto, teclas de control
        const permitido = /^[0-9.,]$|Backspace|Delete|Tab|Enter|Escape|ArrowLeft|ArrowRight|Home|End/;

        // Si ya hay una coma, no permitir otra coma
        if (tecla === ',' && valorActual.includes(',')) {
            event.preventDefault();
            return;
        }

        // Si ya hay un punto, no permitir otro punto
        if (tecla === '.' && valorActual.includes('.')) {
            event.preventDefault();
            return;
        }

        if (!permitido.test(tecla)) {
            event.preventDefault();
        }
    }

    limpiarCampoInicial(): void {
        const minimo = this.calcularInicialCasheaPorNivel(this.montoTotal, this.nivelCashea);
        this.venta.montoInicial = minimo;
        this.valorInicialTemporal = this.formatearMoneda(minimo, this.venta.moneda);
        this.generarCuotasCashea();
    }

    onMontoInicialChange(): void {
        if (this.venta.formaPago === 'cashea') {
            // Solo actualizar el modelo numérico sin formatear visualmente
            const limpio = this.valorInicialTemporal.replace(/[^\d.,]/g, '').trim();

            if (limpio) {
                const montoString = limpio.replace(',', '.');
                const monto = parseFloat(montoString);

                if (!isNaN(monto)) {
                    this.venta.montoInicial = monto;
                }
            } else {
                // Si está vacío, establecer como 0 temporalmente
                this.venta.montoInicial = 0;
            }

            this.generarCuotasCashea();
            this.actualizarResumenCashea();
        }
    }

    ngAfterViewInit(): void {
        const modalElement = document.getElementById('resumenVentaModal');
        if (modalElement) {
            modalElement.addEventListener('hidden.bs.modal', () => {
            });
        }

        // Watcher para cambios en bancoCodigo
        this.venta.metodosDePago.forEach((metodo, index) => {
            // Puedes usar un enfoque más robusto con Observables si es necesario
            const originalBancoCodigo = metodo.bancoCodigo;
            Object.defineProperty(metodo, 'bancoCodigo', {
                get: () => originalBancoCodigo,
                set: (value) => {
                    metodo.bancoCodigo = value;
                    this.actualizarBancoDesdeCodigo(index);
                }
            });
        });

        this.cdr.detectChanges();
    }

    /**
    * Resetea completamente el estado de la venta
    */
    resetearVentaCompleta(resetFormaPago: boolean = true): void {
        // ============================================
        // 0. RESTABLECER TIPO DE VENTA (opcional)
        // ============================================
        this.tipoVenta = 'solo_consulta'; // Valor por defecto
        this.presupuestoOrigenVenta = null;
        this.consultaEnCarrito = false;
        this.intentoGenerar = false;
        this.buscandoPaciente = false;
        this.textoBusquedaPaciente = '';
        this.filtroCategoria = 'todos';

        // ============================================
        // 1. LIMPIAR PRODUCTOS DEL CARRITO
        // ============================================
        this.venta.productos = [];

        // ============================================
        // 2. RESTABLECER PROPIEDADES BÁSICAS DE VENTA
        // ============================================
        this.venta.moneda = this.normalizarMonedaParaVenta(this.monedaSistema);
        this.venta.descuento = 0;
        this.venta.impuesto = 16;
        this.venta.observaciones = '';
        this.venta.montoInicial = 0;
        this.venta.numeroCuotas = 0;
        this.venta.montoAbonado = 0;
        this.venta.metodosDePago = [];

        if (resetFormaPago) {
            this.venta.formaPago = 'contado';
        }

        // ============================================
        // 3. LIMPIAR DATOS DE CONSULTA
        // ============================================
        this.montoConsulta = 0;
        this.montoConsultaOriginal = 0;
        this.pagoMedico = 0;
        this.pagoOptica = 0;

        // ============================================
        // 4. LIMPIAR PROPIEDADES ESPECÍFICAS DE CASHEA
        // ============================================
        this.nivelCashea = 'nivel3';
        this.cantidadCuotasCashea = 3;
        this.cuotasCashea = [];
        this.resumenCashea = { cantidad: 0, total: 0, totalBs: 0 };
        this.valorInicialTemporal = '';

        // ============================================
        // 5. LIMPIAR ABONO
        // ============================================
        this.valorTemporal = '';
        this.montoExcedido = false;

        // ============================================
        // 6. LIMPIAR SELECCIONES
        // ============================================
        this.pacienteSeleccionado = null;
        this.productoSeleccionado = null;
        this.asesorSeleccionado = this.currentUser?.id ?? null;

        this.historiaMedica = null;
        this.historiaMedicaSeleccionada = null;
        this.historiaSeleccionadaId = null;
        this.historiasMedicas = [];

        this.limpiarTodosLosSelects();

        // ============================================
        // 8. LIMPIAR CLIENTE SIN PACIENTE
        // ============================================
        this.clienteSinPaciente = {
            tipoPersona: 'natural',
            nombreCompleto: '',
            cedula: '',
            telefono: '',
            email: ''
        };

        // ============================================
        // 9. LIMPIAR VALIDACIÓN DE CLIENTE
        // ============================================
        this.validandoCliente = false;
        this.clienteEncontrado = false;
        this.mensajeValidacionCliente = '';
        this.cedulaAnterior = '';
        this.validacionIntentada = false;
        this.editandoManual = false;

        // ============================================
        // 10. LIMPIAR ESTADO DE EMPRESA REFERIDA
        // ============================================
        this.clienteEsReferido = false;
        this.mostrarInfoEmpresa = false;
        this.usarEmpresaEnVenta = false;
        this.empresaReferidaInfo = null;
        this.limpiarEmpresaReferidaCliente();

        // ============================================
        // 11. LIMPIAR ESTADO DE ORDEN DE TRABAJO
        // ============================================
        this.generarOrdenTrabajo = false;
        this.forzarOrdenTrabajo = false;
        this.mostrarSelectorAsesor = false;

        // ============================================
        // 12. ACTUALIZAR PRODUCTOS CON LA MONEDA CORRECTA
        // ============================================
        this.actualizarProductosConDetalle();

        // ============================================
        // 13. FORZAR DETECCIÓN DE CAMBIOS
        // ============================================
        this.cdr.detectChanges();
    }

    // === MÉTODOS ADICIONALES NECESARIOS ===
    get nombreCompletoAsesor(): string {
        return this.currentUser?.nombre ?? 'Sin nombre';
    }

    // === MÉTODOS PARA ASESOR ===
    getResumenAsesor(): string {
        if (!this.asesorSeleccionado) {
            return 'Sin asesor asignado';
        }

        const asesor = this.empleadosDisponibles.find(e => e.id == this.asesorSeleccionado);
        if (!asesor) {
            return 'Sin asesor asignado';
        }

        return `${asesor.nombre}` || 'Asesor';
    }

    getNombreAsesorSeleccionado(): string {
        if (!this.asesorSeleccionado) {
            return 'No asignado';
        }

        const asesor = this.empleadosDisponibles.find(e => e.id == this.asesorSeleccionado);
        return asesor ? asesor.nombre : 'No asignado';
    }

    getCargoAsesorSeleccionado(): string {
        if (!this.asesorSeleccionado) {
            return '';
        }

        const asesor = this.empleadosDisponibles.find(e => e.id == this.asesorSeleccionado);
        return asesor ? (asesor.cargoNombre || 'Asesor') : '';
    }

    onAsesorChange(): void {
        this.cdr.detectChanges();

        if (this.asesorSeleccionado) {
            const asesor = this.empleadosDisponibles.find(e => e.id == this.asesorSeleccionado);
        }
    }

    obtenerTasaActual(): number {
        if (this.venta.moneda === 'bolivar') {
            return 1;
        }
        const tasa = this.tasasPorId[this.venta.moneda] || 1;
        return tasa;
    }

    obtenerTasaBs(): number {
        return 1;
    }

    calcularMontoPorCuota(): number {
        const total = this.montoTotal;
        const restante = total - (this.venta.montoInicial ?? 0);
        const cuotas = this.cantidadCuotasCashea ?? 1;
        return cuotas > 0 ? +(restante / cuotas).toFixed(2) : 0;
    }

    // === MÉTODOS DE MONEDA EFECTIVO ===
    cambiarMonedaMetodo(index: number, nuevaMoneda: string): void {
        const metodo = this.venta.metodosDePago[index];

        if (!metodo) {
            return;
        }

        metodo.moneda = this.normalizarMonedaMetodo(nuevaMoneda) || this.getMonedaDefectoParaMetodo(metodo.tipo);

        if (metodo.monto && metodo.monto > 0) {
            metodo.valorTemporal = this.formatearMoneda(metodo.monto, metodo.moneda);
        }

        this.cdr.detectChanges();
    }

    onTipoMetodoChange(index: number): void {
        const metodo = this.venta.metodosDePago[index];

        metodo.moneda = this.getMonedaParaMetodo(metodo.tipo, metodo);
        metodo.monto = 0;
        metodo.valorTemporal = '';
        metodo.referencia = '';
        metodo.bancoCodigo = '';
        metodo.bancoNombre = '';
        metodo.banco = '';
        metodo.bancoObject = null;
        metodo.bancoReceptorCodigo = '';
        metodo.bancoReceptorNombre = '';
        metodo.bancoReceptor = '';
        metodo.bancoReceptorObject = null;
        metodo.notaPago = '';

        this.onMetodoPagoChange(index);
    }

    agregarMetodo(): void {
        this.venta.metodosDePago.push({
            tipo: '',
            monto: 0,
            valorTemporal: '',
            referencia: '',
            bancoCodigo: '',
            bancoNombre: '',
            banco: '',
            bancoObject: null,
            bancoReceptorCodigo: '',
            bancoReceptorNombre: '',
            bancoReceptor: '',
            bancoReceptorObject: null,
            moneda: '',
            notaPago: ''
        });

        this.actualizarEstadoOrdenTrabajo();
    }


    getInfoConversionMetodo(metodo: any): string {
        if (!metodo.monto || metodo.monto <= 0) return '';

        const monedaMetodo = this.getMonedaParaMetodo(metodo.tipo, metodo);
        const montoEnSistema = this.convertirMontoExacto(metodo.monto, monedaMetodo, this.venta.moneda);

        if (monedaMetodo === this.venta.moneda) {
            return '';
        }

        return `⇄${this.formatearMoneda(montoEnSistema, this.venta.moneda)}`;
    }

    calcularConversionBs(monto: number, tipoMetodo: string, metodo?: MetodoPago): number {
        if (!monto || monto <= 0) return 0;

        const monedaMetodo = this.getMonedaParaMetodo(tipoMetodo, metodo);

        // Si ya está en bolívares, retornar directamente
        if (monedaMetodo === 'bolivar') {
            return this.redondear(monto);
        }

        // Convertir desde la moneda del método a bolívares
        if (monedaMetodo === 'dolar') {
            return this.redondear(monto * (this.tasasPorId['dolar'] ?? 1));
        } else if (monedaMetodo === 'euro') {
            return this.redondear(monto * (this.tasasPorId['euro'] ?? 1));
        } else {
            return this.redondear(monto); // Ya está en bolívares
        }
    }

    // Agregar método para formatear la conversión en Bs
    getInfoConversionBs(metodo: any): string {
        if (!metodo.monto || metodo.monto <= 0) return '';

        const monedaMetodo = this.getMonedaParaMetodo(metodo.tipo, metodo);
        const montoEnBs = this.calcularConversionBs(metodo.monto, metodo.tipo, metodo);

        if (monedaMetodo === 'bolivar') {
            return ''; // No mostrar conversión si ya está en bolívares
        }

        return `⇄ ${this.formatearMoneda(montoEnBs, 'bolivar')}`;
    }

    getMontoRestanteParaMetodoEnBs(index: number): number {
        const maximoEnSistema = this.getMontoRestanteParaMetodo(index);

        if (this.venta.moneda === 'bolivar') {
            return maximoEnSistema;
        }

        return this.convertirMonto(maximoEnSistema, this.venta.moneda, 'bolivar');
    }

    // === MENSAJES Y TÍTULOS ===
    get mensajePagoCompleto(): string {
        switch (this.venta.formaPago) {
            case 'abono':
                return 'El pago está completo y alineado con el monto abonado.';
            case 'cashea':
                return 'El pago inicial está completo y alineado con el monto requerido.';
            case 'contado':
                return 'El pago está completo y alineado con el monto total.';
            default:
                return 'El pago está completo.';
        }
    }

    get tituloBarraMetodos(): string {
        return 'Progreso de los métodos de pago';
    }

    get tituloBarraPago(): string {
        switch (this.venta.formaPago) {
            case 'abono': return 'Progreso del abono registrado';
            case 'cashea': return 'Progreso del pago inicial';
            case 'contado': return 'Progreso del pago total';
            default: return 'Progreso del pago';
        }
    }

    private actualizarBancoDesdeCodigo(index: number): void {
        const metodo = this.venta.metodosDePago[index];

        if (metodo.bancoCodigo && metodo.bancoCodigo.trim() !== '') {
            const bancoSeleccionado = this.bancosDisponibles.find(b => b.codigo === metodo.bancoCodigo);
            if (bancoSeleccionado) {
                metodo.bancoNombre = bancoSeleccionado.nombre;
                metodo.banco = `${bancoSeleccionado.codigo} - ${bancoSeleccionado.nombre}`;
            } else {
                metodo.bancoNombre = '';
                metodo.banco = '';
            }
        } else {
            metodo.bancoNombre = '';
            metodo.banco = '';
        }
    }

    onBancoObjectChange(bancoObject: any, index: number): void {
        const metodo = this.venta.metodosDePago[index];

        if (!bancoObject) {
            metodo.bancoCodigo = '';
            metodo.bancoNombre = '';
            metodo.banco = '';
            metodo.bancoObject = null;
            this.cdr.detectChanges();
            return;
        }

        // Actualizar todas las propiedades
        metodo.bancoCodigo = bancoObject.codigo;
        metodo.bancoNombre = bancoObject.nombre;
        metodo.banco = `${bancoObject.codigo} - ${bancoObject.nombre}`;
        metodo.bancoObject = bancoObject;

        this.cdr.detectChanges();
    }

    // En tu componente, modifica las opciones disponibles
    tiposPago: VentaPaymentMethodOption[] = buildVentaPaymentCatalog().tiposPago;

    bancosDisponibles: VentaBankOption[] = buildVentaPaymentCatalog().bancosNacionales;

    bancosUsaDisponibles: VentaBankOption[] = buildVentaPaymentCatalog().bancosInternacionales;

    cuentasReceptorasPorMetodo: Record<VentaPaymentMethodValue, VentaReceiverAccountOption[]> = buildVentaPaymentCatalog().cuentasReceptorasPorMetodo;

    compararBanco = (a: any, b: any): boolean => {
        if (!a || !b) return a === b;
        return a.codigo === b.codigo;
    };

    compararCuentaReceptora = (a: any, b: any): boolean => {
        if (!a || !b) return a === b;
        return a.id === b.id;
    };

    getBancosDisponiblesPorMetodo(tipoMetodo: string): VentaBankOption[] {
        return tipoMetodo === 'zelle' ? this.bancosUsaDisponibles : this.bancosDisponibles;
    }

    getCuentasReceptorasPorMetodo(tipoMetodo: string): VentaReceiverAccountOption[] {
        const methodValue = tipoMetodo as VentaPaymentMethodValue;
        return this.cuentasReceptorasPorMetodo[methodValue] || [];
    }

    getEtiquetaBancoPrincipal(tipoMetodo: string): string {
        if (tipoMetodo === 'zelle') {
            return 'Banco en USA';
        }

        if (tipoMetodo === 'pagomovil' || tipoMetodo === 'transferencia') {
            return 'Banco emisor';
        }

        return 'Banco';
    }

    getPlaceholderBancoPrincipal(tipoMetodo: string): string {
        if (tipoMetodo === 'zelle') {
            return 'Buscar banco de USA...';
        }

        if (tipoMetodo === 'pagomovil' || tipoMetodo === 'transferencia') {
            return 'Buscar banco emisor...';
        }

        return 'Buscar banco por código o nombre...';
    }

    getPlaceholderCuentaReceptora(tipoMetodo: string): string {
        return this.getCuentasReceptorasPorMetodo(tipoMetodo).length > 0
            ? 'Selecciona una cuenta receptora...'
            : 'No hay cuentas receptoras configuradas';
    }

    private construirCuentaEmisoraPayload(metodo: any): any {
        if (!metodo || !this.necesitaBanco(metodo.tipo)) {
            return undefined;
        }

        const bancoCodigo = metodo.bancoCodigo?.trim();
        const bancoNombre = metodo.bancoNombre?.trim();

        if (!bancoCodigo && !bancoNombre) {
            return undefined;
        }

        return {
            bancoCodigo: bancoCodigo || undefined,
            bancoNombre: bancoNombre || undefined
        };
    }

    private construirCuentaReceptoraPayload(cuenta?: VentaReceiverAccountOption | null): any {
        if (!cuenta) {
            return undefined;
        }

        const payload = {
            bancoCodigo: cuenta.codigo || undefined,
            bancoNombre: cuenta.nombre || undefined,
            titular: cuenta.ownerName || undefined,
            cedulaRif: cuenta.ownerId || undefined,
            telefono: cuenta.phone || undefined,
            correo: cuenta.email || undefined,
            direccionWallet: cuenta.walletAddress || undefined,
            descripcionCuenta: cuenta.accountDescription || undefined
        };

        const payloadFiltrado = Object.fromEntries(
            Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== '')
        );

        return Object.keys(payloadFiltrado).length > 0 ? payloadFiltrado : undefined;
    }

    onBancoChange(banco: any, index: number): void {
        const metodo = this.venta.metodosDePago[index];

        if (!banco) {
            metodo.bancoCodigo = '';
            metodo.bancoNombre = '';
            metodo.banco = '';
            metodo.bancoObject = null;
            return;
        }

        metodo.bancoCodigo = banco.codigo;
        metodo.bancoNombre = banco.nombre;
        metodo.banco = `${banco.codigo} - ${banco.nombre}`;
        metodo.bancoObject = banco;
    }

    onBancoReceptorChange(cuenta: VentaReceiverAccountOption | null, index: number): void {
        const metodo = this.venta.metodosDePago[index];

        if (!cuenta) {
            metodo.bancoReceptorCodigo = '';
            metodo.bancoReceptorNombre = '';
            metodo.bancoReceptor = '';
            metodo.bancoReceptorObject = null;
            return;
        }

        metodo.bancoReceptorCodigo = cuenta.codigo;
        metodo.bancoReceptorNombre = cuenta.nombre;
        metodo.bancoReceptor = cuenta.displayText;
        metodo.bancoReceptorObject = cuenta;
    }


    // Métodos auxiliares para determinar qué campos mostrar
    necesitaReferencia(tipoMetodo: string): boolean {
        const metodosConReferencia = ['pagomovil', 'transferencia', 'zelle'];
        return metodosConReferencia.includes(tipoMetodo);
    }

    necesitaBanco(tipoMetodo: string): boolean {
        // Punto de venta tiene su propio selector de bancos
        if (tipoMetodo === 'punto') return false;

        const metodosConBanco = ['pagomovil', 'transferencia', 'zelle'];
        return metodosConBanco.includes(tipoMetodo);
    }

    necesitaBancoReceptor(tipoMetodo: string): boolean {
        return this.getCuentasReceptorasPorMetodo(tipoMetodo).length > 0;
    }

    mostrarNotaPago(tipoMetodo: string): boolean {
        return tipoMetodo === 'pagomovil' || tipoMetodo === 'transferencia';
    }

    private validarMetodosPago(): boolean {
        // Para forma de pago pendiente, no se requieren métodos
        if (this.venta.formaPago === 'de_contado-pendiente') {
            return true;
        }

        // Para otras formas, verificar métodos completos
        if (this.venta.metodosDePago.length === 0) {
            return false;
        }

        return this.venta.metodosDePago.every(metodo => this.metodoCompleto(metodo));
    }

    // Método para verificar si un método de pago específico está completo
    metodoCompleto(metodo: any): boolean {
        if (!metodo.tipo) return false;
        if (!metodo.monto || metodo.monto <= 0) return false;

        // Validar efectivo (solo monto)
        if (metodo.tipo === 'efectivo') {
            return true;
        }

        // Validar otros métodos (pagomovil, transferencia, zelle)
        if (this.necesitaBanco(metodo.tipo) && (!metodo.banco || !metodo.bancoObject)) {
            return false;
        }

        if (this.necesitaBancoReceptor(metodo.tipo) && (!metodo.bancoReceptor || !metodo.bancoReceptorObject)) {
            return false;
        }

        if (this.necesitaReferencia(metodo.tipo) && (!metodo.referencia || metodo.referencia.trim() === '')) {
            return false;
        }

        return true;
    }

    // Método para obtener el estado de validación de un método
    getEstadoValidacionMetodo(metodo: any): { valido: boolean; mensaje: string } {
        if (!metodo.tipo) {
            return { valido: false, mensaje: 'Selecciona tipo de pago' };
        }

        if (!metodo.monto || metodo.monto <= 0) {
            return { valido: false, mensaje: 'Ingresa un monto válido' };
        }

        if (this.necesitaBanco(metodo.tipo) && (!metodo.banco || !metodo.bancoObject)) {
            return { valido: false, mensaje: 'Selecciona un banco' };
        }

        if (this.necesitaBancoReceptor(metodo.tipo) && (!metodo.bancoReceptor || !metodo.bancoReceptorObject)) {
            return { valido: false, mensaje: 'Selecciona el banco receptor' };
        }

        if (this.necesitaReferencia(metodo.tipo) && (!metodo.referencia || metodo.referencia.trim() === '')) {
            return { valido: false, mensaje: 'Ingresa número de referencia' };
        }

        return { valido: true, mensaje: 'Método completo' };
    }

    get mensajeEstadoBoton(): string {
        // Validar items según tipo de venta
        if (this.tipoVenta === 'solo_productos' && this.venta.productos.length === 0) {
            return 'Agrega productos para continuar';
        }

        if (this.tipoVenta === 'solo_consulta' && !this.consultaEnCarrito) {
            return 'Agrega una consulta para continuar';
        }

        if (this.tipoVenta === 'consulta_productos' && !this.consultaEnCarrito && this.venta.productos.length === 0) {
            return 'Agrega consulta o productos para continuar';
        }

        // Validar métodos de pago
        if (this.venta.metodosDePago.length === 0 && this.venta.formaPago !== 'de_contado-pendiente') {
            return 'Agrega métodos de pago';
        }

        // Verificar métodos incompletos
        if (this.venta.formaPago !== 'de_contado-pendiente') {
            const metodosIncompletos = this.venta.metodosDePago.some(metodo => !this.metodoCompleto(metodo));
            if (metodosIncompletos) {
                return 'Completa todos los métodos de pago';
            }
        }

        // Validar montos según forma de pago
        const totalRequerido = this.totalPagar;
        const totalPagado = this.totalPagadoPorMetodos;
        const diferencia = totalRequerido - totalPagado;

        switch (this.venta.formaPago) {
            case 'contado':
                if (diferencia > 0.01) {
                    return `Faltan ${this.formatearMoneda(diferencia, this.venta.moneda)}`;
                }
                if (diferencia < -0.01) {
                    return 'Monto excedido';
                }
                return 'Listo para generar venta';

            case 'abono':
                if (this.venta.montoAbonado <= 0) {
                    return 'Ingresa un monto de abono';
                }
                if (Math.abs(this.venta.montoAbonado - totalPagado) > 0.01) {
                    return 'El abono no coincide con los métodos';
                }
                return 'Listo para generar venta';

            case 'cashea':
                const inicialMinima = this.calcularInicialCasheaPorNivel(totalRequerido, this.nivelCashea);
                if ((this.venta.montoInicial || 0) < inicialMinima) {
                    return `La inicial debe ser al menos ${this.formatearMoneda(inicialMinima, this.venta.moneda)}`;
                }
                return 'Listo para generar venta';

            case 'de_contado-pendiente':
                return 'Listo para generar venta (pago pendiente)';

            default:
                return 'Verifica los datos';
        }
    }

    // En tu componente TypeScript
    get totalPagadoCashea(): number {
        if (this.venta.formaPago !== 'cashea') return 0;

        const inicial = this.venta.montoInicial ?? 0;
        const cuotasAdelantadas = this.resumenCashea.total;

        return this.redondear(inicial + cuotasAdelantadas);
    }

    get totalPagadoCasheaBs(): number {
        return this.redondear(this.obtenerEquivalenteBs(this.totalPagadoCashea));
    }

    limpiarBusquedaPaciente(): void {
        this.textoBusquedaPaciente = '';
        this.mostrarResultadosPacientes = false;
        this.cdr.detectChanges();
    }

    prepararDatosParaAPI(): any {
        const fechaActual = new Date();
        const montoConsultaAplicado = this.obtenerMontoConsultaAplicado();

        // 1. PREPARAR PRODUCTOS
        const productosFisicos = this.venta.productos.filter(p => p.tipo !== 'CONSULTA');
        const productosData = productosFisicos.map(p => ({
            id: p.id,
            nombre: p.nombre,
            codigo: p.codigo || 'N/A',
            precio: p.precio || 0,
            precioConIva: p.precioConIva || 0,
            moneda: p.moneda || 'dolar',
            cantidad: p.cantidad || 1,
            aplicaIva: p.aplicaIva || false,
            stock: p.stock || 0,
            tipo: 'PRODUCTO',
            descripcion: this.construirDescripcionProductoVenta(p),
            sede: p.sede
        }));

        // 2. PREPARAR MÉTODOS DE PAGO
        const metodosPagoData = this.venta.metodosDePago.map(metodo => ({
            tipo: metodo.tipo,
            monto: metodo.monto || 0,
            referencia: metodo.referencia || undefined,
            cuentaEmisora: this.construirCuentaEmisoraPayload(metodo),
            cuentaReceptora: this.construirCuentaReceptoraPayload(
                metodo.bancoReceptorObject as VentaReceiverAccountOption | null
            ),
            moneda: metodo.moneda || this.getMonedaParaMetodo(metodo.tipo, metodo),
            notaPago: metodo.notaPago?.trim() || undefined
        }));

        // 3. CALCULAR TOTALES
        const subtotalProductos = productosFisicos.reduce((acc, p) => {
            return acc + ((p.precio || 0) * (p.cantidad || 1));
        }, 0);

        const descuentoMonto = this.venta.descuento ? (subtotalProductos * (this.venta.descuento / 100)) : 0;
        const subtotalConDescuento = subtotalProductos - descuentoMonto;

        let ivaCalculado = 0;
        productosFisicos.forEach(producto => {
            if (producto.aplicaIva) {
                const subtotalProducto = (producto.precio || 0) * (producto.cantidad || 1);
                const proporcionProducto = subtotalProducto / subtotalProductos;
                const baseProductoConDescuento = subtotalConDescuento * proporcionProducto;
                ivaCalculado += baseProductoConDescuento * (this.ivaPorcentaje / 100);
            }
        });

        const totalProductos = subtotalConDescuento + ivaCalculado;
        let totalFinal = totalProductos;

        if (montoConsultaAplicado > 0) {
            totalFinal += montoConsultaAplicado;
        }

        // 4. DETERMINAR TOTAL PAGADO
        let totalPagado = 0;
        switch (this.venta.formaPago) {
            case 'contado':
                totalPagado = this.totalPagadoPorMetodos;
                break;
            case 'abono':
                totalPagado = this.venta.montoAbonado || 0;
                break;
            case 'cashea':
                totalPagado = this.totalPagadoCashea;
                break;
            case 'de_contado-pendiente':
                totalPagado = 0;
                break;
            default:
                totalPagado = this.totalPagadoPorMetodos;
        }

        // 5. PREPARAR FORMA_PAGO_DETALLE
        let formaPagoDetalle: any = null;

        if (this.venta.formaPago === 'cashea') {
            formaPagoDetalle = {
                tipo: 'cashea',
                nivel: this.nivelCashea,
                montoTotal: totalFinal,
                montoInicial: this.venta.montoInicial || 0,
                cantidadCuotas: this.cantidadCuotasCashea.toString(),
                montoPorCuota: this.montoPrimeraCuota,
                cuotasAdelantadas: this.resumenCashea.cantidad,
                montoAdelantado: this.resumenCashea.total,
                totalPagadoAhora: this.totalPagadoCashea,
                deudaPendiente: this.getDeudaPendienteCashea(),
                cuotas: this.cuotasCashea.map(cuota => ({
                    numero: cuota.id,
                    fecha: cuota.fecha,
                    monto: cuota.monto,
                    pagada: cuota.pagada,
                    seleccionada: cuota.seleccionada
                }))
            };
        } else if (this.venta.formaPago === 'abono') {
            const deudaPendiente = Math.max(totalFinal - (this.venta.montoAbonado || 0), 0);
            const porcentajePagado = totalFinal > 0 ? ((this.venta.montoAbonado || 0) / totalFinal) * 100 : 0;

            formaPagoDetalle = {
                tipo: 'abono',
                montoAbonado: this.redondear(this.venta.montoAbonado || 0),
                deudaPendiente: this.redondear(deudaPendiente),
                porcentajePagado: this.redondear(porcentajePagado)
            };
        } else if (this.venta.formaPago === 'contado') {
            formaPagoDetalle = {
                tipo: 'contado',
                montoTotal: totalFinal,
                totalPagado: totalPagado
            };
        } else if (this.venta.formaPago === 'de_contado-pendiente') {
            formaPagoDetalle = {
                tipo: 'de_contado-pendiente',
                montoTotal: totalFinal,
                deudaPendiente: totalFinal
            };
        }

        // ============================================
        // 6. PREPARAR INFORMACIÓN DEL CLIENTE
        // ============================================
        let clienteData: any;

        if (this.tipoVenta === 'solo_productos') {
            if (this.clienteSinPaciente && this.clienteSinPaciente.nombreCompleto) {
                clienteData = {
                    tipoCliente: 'cliente_general',
                    tipoPersona: this.clienteSinPaciente.tipoPersona === 'juridica' ? 'juridico' : 'natural',
                    nombre: this.clienteSinPaciente.nombreCompleto,
                    cedula: this.clienteSinPaciente.cedula,
                    telefono: this.clienteSinPaciente.telefono,
                    email: this.clienteSinPaciente.email || undefined
                };

                if (this.usarEmpresaEnVenta && this.empresaReferidaInfo) {
                    clienteData.informacionEmpresa = {
                        referidoEmpresa: true,
                        empresaNombre: this.empresaReferidaInfo.nombre,
                        empresaRif: this.empresaReferidaInfo.rif,
                        empresaTelefono: this.empresaReferidaInfo.telefono,
                        empresaDireccion: this.empresaReferidaInfo.direccion,
                        empresaCorreo: this.empresaReferidaInfo.email
                    };
                }
            } else {
                clienteData = {
                    tipoCliente: 'cliente_general',
                    tipoPersona: 'natural',
                    nombre: 'CLIENTE GENERAL',
                    cedula: '',
                    telefono: ''
                };
            }
        } else {
            if (this.pacienteSeleccionado) {
                clienteData = {
                    id: this.pacienteSeleccionado.id,
                    tipoCliente: 'cliente_paciente',
                    tipoPersona: 'natural',
                    nombre: this.pacienteSeleccionado.informacionPersonal?.nombreCompleto,
                    cedula: this.pacienteSeleccionado.informacionPersonal?.cedula,
                    telefono: this.pacienteSeleccionado.informacionPersonal?.telefono,
                    email: this.pacienteSeleccionado.informacionPersonal?.email
                };

                if (this.usarEmpresaEnVenta && this.empresaReferidaInfo) {
                    clienteData.informacionEmpresa = {
                        referidoEmpresa: true,
                        empresaNombre: this.empresaReferidaInfo.nombre,
                        empresaRif: this.empresaReferidaInfo.rif,
                        empresaTelefono: this.empresaReferidaInfo.telefono,
                        empresaDireccion: this.empresaReferidaInfo.direccion,
                        empresaCorreo: this.empresaReferidaInfo.email
                    };
                }
            }
        }

        // ============================================
        // 7. PREPARAR INFORMACIÓN DEL ESPECIALISTA (SOLO CAMPOS NECESARIOS)
        // ============================================
        let especialistaData: any = null;
        let formulaOriginalData: any = null;

        if (this.historiaMedicaSeleccionada?.datosConsulta?.especialista) {
            const esp = this.historiaMedicaSeleccionada.datosConsulta.especialista;

            if (esp.tipo === 'EXTERNO' && esp.externo) {
                // Médico externo
                especialistaData = {
                    tipo: 'EXTERNO',
                    externo: {
                        nombre: esp.externo.nombre || '',
                        lugarConsultorio: esp.externo.lugarConsultorio || ''
                    }
                };
            } else if (esp.tipo !== 'EXTERNO') {
                // Médico interno (Oftalmólogo u Optometrista)
                especialistaData = {
                    tipo: esp.tipo,
                    cedula: esp.cedula,
                    nombre: esp.nombre,
                    cargo: esp.cargo
                };
            }

            // Si hay fórmula original (rectificación)
            if (this.historiaMedicaSeleccionada.datosConsulta.formulaOriginal) {
                const fo = this.historiaMedicaSeleccionada.datosConsulta.formulaOriginal;
                if (fo?.medicoOrigen) {
                    formulaOriginalData = {
                        esExterna: true,
                        medicoOrigen: {
                            tipo: 'EXTERNO',
                            nombre: fo.medicoOrigen.nombre || '',
                            lugarConsultorio: fo.medicoOrigen.lugarConsultorio || ''
                        }
                    };
                }
            }
        }

        // ============================================
        // 8. DETERMINAR ORDEN DE TRABAJO
        // ============================================
        let ordenTrabajo = false;

        if (this.tipoVenta === 'solo_consulta') {
            ordenTrabajo = false;
        } else {
            ordenTrabajo = this.generarOrdenTrabajo;
        }

        // ============================================
        // 9. CONSTRUIR OBJETO BASE
        // ============================================
        const ventaBase: any = {
            tipoVenta: this.tipoVenta,
            moneda: this.venta.moneda,
            sede: this.sedeActiva || undefined,
            total: this.redondear(totalFinal),
            descuento: this.venta.descuento || 0,
            impuesto: this.venta.impuesto || 16,
            observaciones: this.construirObservacionesVenta(),
            metodosDePago: metodosPagoData,
            cliente: clienteData,
            especialista: especialistaData,
            ordenTrabajo: ordenTrabajo,
            asesor: {
                id: this.asesorSeleccionado ? parseInt(this.asesorSeleccionado) :
                    (this.currentUser?.id ? parseInt(this.currentUser.id) : null)
            },
            auditoria: {
                usuarioCreacion: this.currentUser?.id ? parseInt(this.currentUser.id) : 0,
                fechaCreacion: fechaActual.toISOString()
            }
        };

        // Agregar formulaOriginal si existe
        if (formulaOriginalData) {
            ventaBase.formulaOriginal = formulaOriginalData;
        }

        // Agregar formaPagoDetalle si existe
        if (formaPagoDetalle) {
            ventaBase.formaPagoDetalle = formaPagoDetalle;
        }

        // ============================================
        // 10. AGREGAR PRODUCTOS SEGÚN TIPO DE VENTA
        // ============================================
        if (this.tipoVenta === 'solo_productos') {
            ventaBase.productos = productosData;
        } else if (this.tipoVenta === 'solo_consulta') {
            ventaBase.productos = [];

            if (this.consultaEnCarrito && this.historiaMedicaSeleccionada) {
                // Obtener tipo de especialista
                let tipoEspecialista = '';
                if (this.historiaMedicaSeleccionada.datosConsulta?.especialista) {
                    const esp = this.historiaMedicaSeleccionada.datosConsulta.especialista;
                    if (esp.tipo === 'EXTERNO') {
                        tipoEspecialista = 'Externo';
                    } else {
                        tipoEspecialista = esp.cargo || esp.tipo || '';
                    }
                }

                ventaBase.consulta = {
                    historiaId: this.historiaMedicaSeleccionada.id,
                    montoTotal: this.redondear(this.montoConsulta),
                    pagoMedico: this.redondear(this.pagoMedico),
                    pagoOptica: this.redondear(this.pagoOptica),
                    esFormulaExterna: this.historiaMedicaSeleccionada.datosConsulta?.formulaExterna || false,
                    tipoEspecialista: tipoEspecialista,
                    tipoVentaConsulta: this.tipoVenta,
                    montoOriginal: this.montoConsultaOriginal
                };
            }
        } else if (this.tipoVenta === 'consulta_productos') {
            ventaBase.productos = productosData;

            if (this.consultaEnCarrito && this.historiaMedicaSeleccionada) {
                // Obtener tipo de especialista
                let tipoEspecialista = '';
                if (this.historiaMedicaSeleccionada.datosConsulta?.especialista) {
                    const esp = this.historiaMedicaSeleccionada.datosConsulta.especialista;
                    if (esp.tipo === 'EXTERNO') {
                        tipoEspecialista = 'Externo';
                    } else {
                        tipoEspecialista = esp.cargo || esp.tipo || '';
                    }
                }

                ventaBase.consulta = {
                    historiaId: this.historiaMedicaSeleccionada.id,
                    montoTotal: this.redondear(this.pagoMedico),
                    pagoMedico: this.redondear(this.pagoMedico),
                    pagoOptica: 0,
                    esFormulaExterna: this.historiaMedicaSeleccionada.datosConsulta?.formulaExterna || false,
                    tipoEspecialista: tipoEspecialista,
                    tipoVentaConsulta: this.tipoVenta,
                    montoOriginal: this.montoConsultaOriginal
                };
            }
        }

        return ventaBase;
    }

    // Getter para el botón que ABRE el modal (validación básica)
    get puedeAbrirModal(): boolean {
        switch (this.tipoVenta) {
            case 'solo_productos':
                return this.venta.productos.length > 0;

            case 'solo_consulta':
                return !!this.pacienteSeleccionado &&
                    !!this.historiaMedicaSeleccionada &&
                    this.consultaEnCarrito;

            case 'consulta_productos':
                // Debe tener AMBOS: consulta Y productos
                const tieneProductos = this.venta.productos.length > 0;
                const tieneConsulta = this.consultaEnCarrito;

                return tieneProductos && tieneConsulta;

            default:
                return false;
        }
    }

    get puedeGenerarVenta(): boolean {
        // 1. Validar que haya items según tipo de venta
        if (this.tipoVenta === 'solo_productos' && this.venta.productos.length === 0) {
            return false;
        }

        if (this.tipoVenta === 'solo_consulta' && !this.consultaEnCarrito) {
            return false;
        }

        if (this.tipoVenta === 'consulta_productos' && !this.consultaEnCarrito && this.venta.productos.length === 0) {
            return false;
        }

        //VALIDACIÓN DE CLIENTE PARA SOLO PRODUCTOS
        if (this.tipoVenta === 'solo_productos') {
            const clienteValido = this.validarClienteSoloProductos();
            if (!clienteValido) {
                return false;
            }
        }

        // 2. Validar métodos de pago
        if (this.venta.metodosDePago.length === 0 && this.venta.formaPago !== 'de_contado-pendiente') {
            return false;
        }

        if (this.venta.formaPago !== 'de_contado-pendiente') {
            for (let metodo of this.venta.metodosDePago) {
                if (!this.metodoCompleto(metodo)) {
                    return false;
                }
            }
        }

        // 3. Validar montos según forma de pago
        const totalRequerido = this.totalPagar;
        const totalPagado = this.totalPagadoPorMetodos;

        switch (this.venta.formaPago) {
            case 'contado':
                if (Math.abs(totalPagado - totalRequerido) > 0.01) {
                    console.log('Contado: montos no coinciden');
                    return false;
                }
                break;

            case 'abono':
                if (this.venta.montoAbonado <= 0) {
                    console.log('Abono: monto inválido');
                    return false;
                }
                if (Math.abs(this.venta.montoAbonado - totalPagado) > 0.01) {
                    console.log('Abono: monto abonado no coincide con métodos');
                    return false;
                }
                break;

            case 'cashea':
                const inicialMinima = this.calcularInicialCasheaPorNivel(totalRequerido, this.nivelCashea);
                if ((this.venta.montoInicial || 0) < inicialMinima) {
                    console.log('Cashea: inicial insuficiente');
                    return false;
                }
                break;

            case 'de_contado-pendiente':
                console.log('Pago pendiente - válido sin métodos');
                break;

            default:
                console.log('Forma de pago no válida');
                return false;
        }

        console.log('Todo válido - se puede generar');
        return true;
    }

    private productoGeneraOrden(producto: ItemCarrito): boolean {
        if (!producto || !producto.nombre) return false;

        const nombre = producto.nombre.toLowerCase();
        const palabrasClave = [
            'lente', 'cristal', 'progresivo', 'bifocal',
            'monofocal', 'oftálmico', 'lente de contacto',
            'lentes de contacto', 'armazón', 'montura'
        ];

        // Buscar en el nombre
        const coincideNombre = palabrasClave.some(palabra => nombre.includes(palabra));

        // Buscar en la categoría si existe (asumiendo que el producto tiene categoría)
        const categoria = (producto as any).categoria?.toLowerCase() || '';
        const coincideCategoria = palabrasClave.some(palabra => categoria.includes(palabra));

        return coincideNombre || coincideCategoria;
    }

    private limpiarObjeto(obj: any): any {
        if (obj === null || obj === undefined) return obj;

        if (Array.isArray(obj)) {
            return obj.map(item => this.limpiarObjeto(item)).filter(item => item !== null && item !== undefined);
        }

        if (typeof obj === 'object') {
            const cleaned: any = {};
            for (const [key, value] of Object.entries(obj)) {
                const cleanedValue = this.limpiarObjeto(value);
                if (cleanedValue !== null && cleanedValue !== undefined && cleanedValue !== '') {
                    cleaned[key] = cleanedValue;
                }
            }
            return Object.keys(cleaned).length > 0 ? cleaned : null;
        }

        return obj;
    }

    async generarVenta(): Promise<void> {

        // ============================================
        // 1. VALIDAR MÉTODOS DE PAGO
        // ============================================
        if (!this.validarMetodosPago()) {
            this.swalService.showWarning(
                'Métodos de pago incompletos',
                'Completa todos los métodos de pago antes de generar la venta.'
            );
            return;
        }

        // ============================================
        // 2. VALIDAR CONDICIONES GENERALES DE LA VENTA
        // ============================================
        if (!this.puedeGenerarVenta) {
            this.swalService.showWarning(
                'No se puede generar la venta',
                'Verifica que todos los campos estén completos y los montos sean correctos.'
            );
            return;
        }

        // ============================================
        // 3. VALIDAR FÓRMULA PARA ORDEN DE TRABAJO
        // ============================================
        const requiereOrdenTrabajo = this.tipoVenta !== 'solo_consulta' &&
            this.venta.productos.some(p => this.productoGeneraOrden(p));

        if (requiereOrdenTrabajo && this.pacienteSeleccionado && this.historiaMedicaSeleccionada) {
            const tieneFormula = this.tieneFormulaCompleta(this.historiaMedicaSeleccionada);

            // Si no tiene fórmula Y no está forzada la orden
            if (!tieneFormula && !this.generarOrdenTrabajo) {
                const resultado = await this.swalService.showConfirm(
                    'Sin fórmula óptica',
                    `El paciente <strong>${this.pacienteSeleccionado.informacionPersonal?.nombreCompleto || 'seleccionado'}</strong> no tiene fórmula óptica registrada en la historia médica.<br><br>
                    <span class="text-warning">⚠️ No se generará orden de trabajo para el laboratorio.</span><br><br>
                    ¿Desea continuar con la venta?`,
                    'Sí, continuar',
                    'Revisar'
                );

                if (!resultado.isConfirmed) {
                    return;
                }
            }

            // Si no tiene fórmula pero la orden está forzada, continuar sin advertencia
            if (!tieneFormula && this.generarOrdenTrabajo) {
            }
        }

        // ============================================
        // 4. PREVENIR MÚLTIPLES GENERACIONES
        // ============================================
        if (this.generandoVenta) {
            return;
        }

        // ============================================
        // 5. GENERAR VENTA
        // ============================================
        try {
            this.generandoVenta = true;
            this.loader.showWithMessage('🔄 Generando venta...');

            // PRE-CALCULAR el recibo ANTES de llamar al API
            this.prepararReciboLocal();

            await new Promise(resolve => setTimeout(resolve, 1000));

            const datosParaAPI = this.prepararDatosParaAPI();

            this.generarVentaService.crearVenta(datosParaAPI).subscribe({
                next: async (resultado: any) => {
                    if (resultado.message === 'ok' && resultado.venta) {
                        const numeroVenta = resultado.venta.numero_venta;
                        const ventaKey = resultado.venta.key || resultado.venta.id || resultado.venta._id || null;

                        this.loader.updateMessage('Venta generada exitosamente');
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        this.loader.updateMessage('📄 Generando recibo de pago...');
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        this.loader.hide();

                        // ACTUALIZAR solo el número de venta y mostrar recibo
                        this.actualizarNumeroVentaRecibo(numeroVenta, ventaKey);
                        this.mostrarReciboAutomatico();
                        this.limpiarSelectProductos();
                        this.resetearVentaCompleta(false);

                    } else {
                        throw new Error(resultado.message || 'Error al generar la venta');
                    }
                },
                error: (error) => {
                    this.manejarErrorVenta(error);
                }
            });

        } catch (error) {
            this.manejarErrorGeneracion(error);
        } finally {
            this.generandoVenta = false;
        }
    }

    private prepararReciboLocal(): void {
        this.datosRecibo = this.crearDatosReciboReal();
    }

    private actualizarNumeroVentaRecibo(numeroVenta: string, ventaKey: string | null = null): void {
        if (this.datosRecibo) {
            // Solo actualizar el número de venta
            this.datosRecibo.numeroVenta = numeroVenta;
        }

        this.ventaReciboKey = ventaKey;
    }

    /**
     * Obtiene información de la sede
     */
    private obtenerInfoSede(): any {
        const sedeKeyActual = (this.sedeInfo?.key || this.currentUser?.sede || this.sedeActiva || '').trim().toLowerCase();
        const sedeActual = this.sedeInfo
            || this.userStateService.getSedeActual()
            || (sedeKeyActual ? this.userStateService.getSedePorKey(sedeKeyActual) : null);

        if (sedeActual) {
            return {
                nombre: sedeActual.nombre_optica || sedeActual.nombre || 'NEW VISION LENS',
                direccion: sedeActual.direccion || 'C.C. Candelaria, Local PB-04, Guarenas',
                telefono: sedeActual.telefono || '0212-365-39-42',
                rif: sedeActual.rif || 'J-123456789',
                email: sedeActual.email || 'newvisionlens2020@gmail.com'
            };
        }

        return {
            nombre: 'NEW VISION LENS',
            direccion: 'C.C. Candelaria, Local PB-04, Guarenas',
            telefono: '0212-365-39-42',
            rif: 'J-123456789',
            email: 'newvisionlens2020@gmail.com'
        };
    }

    private mostrarReciboAutomatico(): void {
        if (!this.datosRecibo) {
            this.datosRecibo = this.crearDatosReciboReal();
        }

        this.informacionVenta = {
            numeroVenta: this.datosRecibo.numeroVenta,
            fecha: this.datosRecibo.fecha,
            hora: this.datosRecibo.hora,
            estado: 'completada',
            formaPago: this.datosRecibo.configuracion.formaPago,
            moneda: this.datosRecibo.configuracion.moneda
        };

        this.actualizarVistaPreviaRecibo();
        this.mostrarModalRecibo = true;
        this.ventaGenerada = true;
        this.cerrarModalResumen();
        this.cdr.detectChanges();
    }

    private manejarErrorVenta(error: any): void {
        console.error('Error en la llamada al API:', error);
        this.loader.updateMessage('Error al procesar la venta');

        setTimeout(() => {
            this.loader.hide();
            let mensajeError = 'Error al conectar con el servidor';

            if (error.error?.message) {
                mensajeError = error.error.message;
            } else if (error.message) {
                mensajeError = error.message;
            }

            this.swalService.showError('Error en la transacción', mensajeError);
        }, 1500);
    }

    private generarReciboHTMLUnificado(datos: any, vista: ReceiptViewMode = 'preview'): string {
        const contacto = this.obtenerInfoSede();
        const formaPago = datos?.configuracion?.formaPago || this.venta.formaPago || 'contado';

        return generateUnifiedReceiptHTML({
            datos,
            vista,
            tituloRecibo: this.getTituloReciboParaHTML(formaPago),
            mensajeFinal: this.getMensajeFinalParaHTML(formaPago),
            formatearMoneda: (monto, moneda) => this.formatearMoneda(monto, moneda),
            formatearTipoPago: (tipo) => this.formatearTipoPago(tipo),
            obtenerNombreNivelCashea: (nivel) => this.obtenerNombreNivelCashea(nivel),
            contacto
        });
    }

    generarReciboHTML(datos: any): string {
        return this.generarReciboHTMLUnificado(datos || this.crearDatosReciboReal(), 'print');
    }

    private obtenerReciboHTMLParaSalida(vista: 'print' | 'pdf' = 'print'): string | null {
        const datos = this.datosRecibo || this.crearDatosReciboReal();
        if (!datos) {
            return null;
        }

        return this.generarReciboHTMLUnificado(datos, vista);
    }

    obtenerVistaPreviaReciboHTML(): string {
        const datos = this.datosRecibo || this.crearDatosReciboReal();
        return datos ? this.generarReciboHTMLUnificado(datos, 'preview') : '';
    }

    private actualizarVistaPreviaRecibo(): void {
        const html = this.obtenerVistaPreviaReciboHTML();

        this.limpiarVistaPreviaRecibo();

        if (!html) {
            this.previewReciboUrl = null;
            return;
        }

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        this.previewReciboObjectUrl = URL.createObjectURL(blob);
        this.previewReciboUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.previewReciboObjectUrl);
    }

    private limpiarVistaPreviaRecibo(): void {
        this.previewReciboUrl = null;

        if (this.previewReciboObjectUrl) {
            URL.revokeObjectURL(this.previewReciboObjectUrl);
            this.previewReciboObjectUrl = null;
        }
    }

    // Métodos auxiliares para el HTML
    private getTituloReciboParaHTML(formaPago: string): string {
        switch (formaPago) {
            case 'abono':
                return 'RECIBO DE ABONO';
            case 'cashea':
                return 'RECIBO DE PAGO - CASHEA';
            case 'contado':
            default:
                return 'RECIBO DE VENTA';
        }
    }

    private getMensajeFinalParaHTML(formaPago: string): string {
        switch (formaPago) {
            case 'abono':
                return '¡Gracias por su compra!';
            case 'cashea':
                return '¡Gracias por su compra! ';
            case 'contado':
            default:
                return '¡Gracias por su compra!';
        }
    }

    private getTextoTotalPagadoParaHTML(formaPago: string): string {
        switch (formaPago) {
            case 'abono':
                return 'TOTAL ABONADO';
            case 'cashea':
                return 'TOTAL PAGADO AHORA';
            case 'contado':
            default:
                return 'TOTAL PAGADO';
        }
    }

    imprimirRecibo(): void {
        const htmlContent = this.obtenerReciboHTMLParaSalida('print');
        if (!htmlContent) {
            return;
        }

        const ventanaImpresion = window.open('', '_blank', 'width=900,height=1100');

        if (!ventanaImpresion) {
            this.swalService.showError('Error', 'No se pudo abrir la ventana de impresión. Permite ventanas emergentes.');
            return;
        }

        ventanaImpresion.document.write(htmlContent);
        ventanaImpresion.document.close();

        ventanaImpresion.onload = () => {
            setTimeout(() => {
                try {
                    ventanaImpresion.focus();
                    ventanaImpresion.onafterprint = () => {
                        setTimeout(() => {
                            ventanaImpresion.close();
                        }, 100);
                    };
                    ventanaImpresion.print();
                } catch (error) {
                    console.error('Error al imprimir:', error);
                    this.swalService.showInfo(
                        'Recibo listo',
                        'El recibo se ha generado. Usa Ctrl+P para imprimir manualmente.'
                    );
                    setTimeout(() => {
                        ventanaImpresion.close();
                    }, 2000);
                }
            }, 400);
        };

        setTimeout(() => {
            if (!ventanaImpresion.closed) {
                ventanaImpresion.close();
            }
        }, 10000);
    }

    async descargarPDF(): Promise<void> {
        const htmlContent = this.obtenerReciboHTMLParaSalida('pdf');
        if (!htmlContent) {
            return;
        }

        this.swalService.showLoadingAlert('Generando PDF del recibo...');

        try {
            const canvas = await this.renderizarReciboHTMLACanvas(htmlContent);
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
                compress: true
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const imgData = canvas.toDataURL('image/png', 1.0);
            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let remainingHeight = imgHeight;
            let offsetY = 0;

            pdf.addImage(imgData, 'PNG', 0, offsetY, imgWidth, imgHeight, undefined, 'FAST');
            remainingHeight -= pageHeight;

            while (remainingHeight > 0.1) {
                offsetY = remainingHeight - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, offsetY, imgWidth, imgHeight, undefined, 'FAST');
                remainingHeight -= pageHeight;
            }

            pdf.save(`recibo-${this.datosRecibo?.numeroVenta || 'venta'}.pdf`);
        } catch (error) {
            console.error('Error al generar PDF del recibo:', error);
            this.swalService.showError('Error', 'No se pudo generar el PDF del recibo.');
        } finally {
            this.swalService.closeLoading();
        }
    }

    private async renderizarReciboHTMLACanvas(htmlContent: string): Promise<HTMLCanvasElement> {
        const iframe = document.createElement('iframe');
        const objectUrl = URL.createObjectURL(new Blob([htmlContent], { type: 'text/html;charset=utf-8' }));

        iframe.style.position = 'fixed';
        iframe.style.left = '-10000px';
        iframe.style.top = '0';
        iframe.style.width = '840px';
        iframe.style.height = '1188px';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';
        iframe.style.border = '0';

        document.body.appendChild(iframe);

        try {
            await new Promise<void>((resolve, reject) => {
                iframe.onload = () => resolve();
                iframe.onerror = () => reject(new Error('No se pudo cargar el documento temporal del recibo.'));
                iframe.src = objectUrl;
            });

            const iframeWindow = iframe.contentWindow;
            const iframeDocument = iframe.contentDocument;

            if (!iframeWindow || !iframeDocument) {
                throw new Error('No se pudo acceder al documento temporal del recibo.');
            }

            await new Promise<void>((resolve) => {
                iframeWindow.requestAnimationFrame(() => {
                    iframeWindow.setTimeout(() => resolve(), 180);
                });
            });

            const target = (iframeDocument.querySelector('.recibo-page') as HTMLElement) || iframeDocument.body;

            return await html2canvas(target, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: Math.ceil(target.scrollWidth),
                height: Math.ceil(target.scrollHeight),
                windowWidth: Math.ceil(target.scrollWidth),
                windowHeight: Math.ceil(target.scrollHeight)
            });
        } finally {
            URL.revokeObjectURL(objectUrl);
            iframe.remove();
        }
    }
    formatearMoneda(monto: number | null | undefined, moneda?: string): string {
        // Validar que el monto sea un número válido
        if (monto === null || monto === undefined || isNaN(monto)) {
            const monedaDefault = moneda || this.datosRecibo?.configuracion?.moneda || this.venta.moneda;
            return this.obtenerSimboloMoneda(monedaDefault) + '0,00';
        }

        // Asegurarse de que es un número
        const montoNumerico = Number(monto);

        if (isNaN(montoNumerico)) {
            const monedaDefault = moneda || this.datosRecibo?.configuracion?.moneda || this.venta.moneda;
            return this.obtenerSimboloMoneda(monedaDefault) + '0,00';
        }

        // Usar la moneda específica si se proporciona, sino la del recibo, sino la de la venta
        const monedaFinal = moneda || this.datosRecibo?.configuracion?.moneda || this.venta.moneda;
        const simbolo = this.obtenerSimboloMoneda(monedaFinal);

        // Formatear según el estilo venezolano
        return this.formatearNumeroVenezolano(montoNumerico, simbolo);
    }

    // Nueva función para formatear números al estilo venezolano
    private formatearNumeroVenezolano(valor: number, simbolo: string): string {
        const valorRedondeado = Math.round(valor * 100) / 100;

        const partes = valorRedondeado.toString().split('.');
        let parteEntera = partes[0];
        let parteDecimal = partes[1] || '00';
        parteDecimal = parteDecimal.padEnd(2, '0');
        parteEntera = parteEntera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

        if (simbolo === 'Bs.') {
            return `${simbolo} ${parteEntera},${parteDecimal}`;
        } else {
            return `${simbolo}${parteEntera},${parteDecimal}`;
        }
    }

    private manejarErrorGeneracion(error: any): void {
        console.error('Error al generar venta:', error);

        let mensaje = 'Ocurrió un error inesperado al generar la venta';

        if (error?.error?.message) {
            mensaje = error.error.message;
        } else if (error?.message) {
            mensaje = error.message;
        } else if (typeof error === 'string') {
            mensaje = error;
        }

        this.swalService.showError('Error en la transacción', mensaje);
    }

    cerrarModalRecibo(): void {
        this.limpiarTodosLosSelects();
        this.mostrarModalRecibo = false;
        this.ventaGenerada = false;
        this.limpiarVistaPreviaRecibo();
        this.datosRecibo = null;
        this.ventaReciboKey = null;

        this.cerrarModalResumen();

        // Limpiar completamente el estado de la venta
        setTimeout(() => {
            this.resetearVentaCompleta();
            this.cdr.detectChanges();
        }, 300);
    }

    private cerrarModalResumen(): void {
        const modalElement = document.getElementById('resumenVentaModal');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            }
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }
    }

    onModalShown(): void {
        // Resetear scroll cuando se abre el modal
        setTimeout(() => {
            const modalBody = document.querySelector('.modal-body-detalle');
            if (modalBody) {
                modalBody.scrollTop = 0;
            }
        }, 50);
    }

    formatearTipoPago(tipo: string): string {
        const tipos: { [key: string]: string } = {
            'efectivo': 'EFECTIVO',
            'punto': 'PUNTO DE VENTA',
            'pagomovil': 'PAGO MÓVIL',
            'transferencia': 'TRANSFERENCIA',
            'zelle': 'ZELLE'
        };
        return tipos[tipo] || tipo.toUpperCase();
    }

    async copiarEnlace(): Promise<void> {
        try {
            this.swalService.showLoadingAlert('Generando enlace de descarga...');

            const datos = this.datosRecibo || this.crearDatosReciboReal();
            const sedeInfo = datos?.sede || this.obtenerInfoSede();
            const nombreSede = sedeInfo?.nombre || 'NEW VISION LENS';
            const direccionSede = sedeInfo?.direccion || 'C.C. Candelaria, Local PB-04, Guarenas';
            const telefonoSede = sedeInfo?.telefono || '0212-365-39-42';
            const rifSede = sedeInfo?.rif || 'J-123456789';
            const emailSede = sedeInfo?.email || 'newvisionlens2020@gmail.com';

            // EN LUGAR de generar PDF, creamos un texto con la información
            let texto = `📋 ${nombreSede} - Recibo de Venta\n\n` +
                `Recibo: ${datos.numeroVenta}\n` +
                `Fecha: ${datos.fecha}\n` +
                `Hora: ${datos.hora}\n` +
                `Cliente: ${datos.cliente.nombre}\n` +
                `Cédula: ${datos.cliente.cedula}\n` +
                `Teléfono: ${datos.cliente.telefono}\n` +
                `Total venta: ${this.formatearMoneda(datos.totales.total, datos.configuracion?.moneda)}\n` +
                `${this.debeMostrarConversionBsEnRecibo(datos.configuracion?.moneda) ? `Total en Bs: ${this.formatearMoneda(datos.totales.totalEnBolivar ?? this.obtenerMontoReciboEnBolivar(datos.totales.total, datos.configuracion?.moneda), 'bolivar')}\n` : ''}` +
                `Forma de pago: ${this.venta.formaPago.toUpperCase()}\n\n`;

            // Agregar productos
            texto += `PRODUCTOS:\n`;
            datos.productos.forEach((producto: any, index: number) => {
                texto += `${index + 1}. ${producto.nombre} x${producto.cantidad} - ${this.formatearMoneda(producto.subtotal)}\n`;
            });

            texto += `\n📍 ${nombreSede}\n`;
            texto += `🏪 ${direccionSede}\n`;
            texto += `📞 ${telefonoSede}\n`;
            texto += `🧾 RIF: ${rifSede}\n`;
            texto += `✉️ ${emailSede}\n\n`;
            texto += `_Conserve este comprobante para cualquier reclamo._`;

            // Copiar al portapapeles
            const copiado = await this.copiarAlPortapapeles(texto);

            this.swalService.closeLoading();

            if (copiado) {
                this.swalService.showSuccess('Información Copiada',
                    `Se ha copiado la información del recibo ${datos.numeroVenta}.\n\n` +
                    `El cliente puede recibir esta información por WhatsApp o Email.`
                );
            } else {
                this.swalService.showError('Error', 'No se pudo copiar la información automáticamente.');
            }

        } catch (error) {
            this.swalService.closeLoading();
            console.error('Error al copiar enlace:', error);
            this.swalService.showError('Error',
                'No se pudo copiar la información. Por favor, use el botón "Descargar PDF" para obtener el archivo.'
            );
        }
    }

    /**
    * Método simple y confiable para copiar al portapapeles
    */
    private async copiarAlPortapapeles(texto: string): Promise<boolean> {
        try {
            // Método moderno
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(texto);
                return true;
            } else {
                // Método fallback
                const textArea = document.createElement('textarea');
                textArea.value = texto;
                textArea.style.position = 'absolute';
                textArea.style.left = '-9999px';
                document.body.appendChild(textArea);
                textArea.select();
                textArea.setSelectionRange(0, 99999);
                const result = document.execCommand('copy');
                document.body.removeChild(textArea);
                return result;
            }
        } catch (error) {
            console.error('Error copiando al portapapeles:', error);
            return false;
        }
    }

    getProductosSeguros(): any[] {
        if (this.datosRecibo?.productos && this.datosRecibo.productos.length > 0) {
            return this.datosRecibo.productos;
        }

        if (this.venta.productos && this.venta.productos.length > 0) {
            return this.venta.productos.map(p => ({
                nombre: p.nombre || 'Producto',
                cantidad: p.cantidad || 1,
                precioUnitario: p.precio || 0,
                subtotal: (p.precio || 0) * (p.cantidad || 1)
            }));
        }

        return [];
    }

    getMetodosPagoSeguros(): any[] {
        return this.datosRecibo?.metodosPago || this.venta.metodosDePago.map(m => ({
            tipo: m.tipo,
            monto: m.monto,
            referencia: m.referencia,
            banco: m.banco,
            bancoEmisor: m.banco,
            bancoReceptor: m.bancoReceptor,
            notaPago: m.notaPago,
            moneda: m.moneda || this.getMonedaParaMetodo(m.tipo, m),
            montoEnSistema: this.redondear(this.convertirMontoExacto(m.monto || 0, m.moneda || this.getMonedaParaMetodo(m.tipo, m), this.venta.moneda)),
            monedaSistema: this.venta.moneda,
            montoEnBolivar: this.redondear(this.convertirMontoExacto(m.monto || 0, m.moneda || this.getMonedaParaMetodo(m.tipo, m), 'bolivar'))
        }));
    }

    getSubtotalSeguro(): number {
        if (this.datosRecibo?.totales?.subtotal) {
            return this.datosRecibo.totales.subtotal;
        }

        // Devolver el subtotal con IVA para que sea consistente
        return this.calcularTotalProductos();
    }

    getDescuentoSeguro(): number {
        return this.datosRecibo?.totales?.descuento ||
            (this.venta.descuento ? (this.totalProductos * (this.venta.descuento / 100)) : 0);
    }

    getIvaSeguro(): number {
        return this.datosRecibo?.totales?.iva ||
            this.productosConDetalle.reduce((sum, p) => sum + (p.iva || 0), 0);
    }

    getTotalPagadoSeguro(): number {
        if (this.datosRecibo?.totales?.totalPagado) {
            return this.datosRecibo.totales.totalPagado;
        }

        // Calcular basado en la forma de pago actual
        switch (this.venta.formaPago) {
            case 'contado':
                return this.totalPagadoPorMetodos;
            case 'abono':
                return this.venta.montoAbonado || 0;
            case 'cashea':
                return this.totalPagadoCashea;
            default:
                return this.totalPagadoPorMetodos;
        }
    }

    getTituloRecibo(): string {
        const formaPago = this.datosRecibo?.configuracion?.formaPago || this.venta.formaPago;

        switch (formaPago) {
            case 'abono':
                return 'RECIBO DE ABONO';
            case 'cashea':
                return 'RECIBO DE PAGO - CASHEA';
            case 'contado':
            default:
                return 'RECIBO DE PAGO';
        }
    }

    getTextoTotalPagado(): string {
        const formaPago = this.datosRecibo?.configuracion?.formaPago || this.venta.formaPago;

        switch (formaPago) {
            case 'abono':
                return 'TOTAL ABONADO';
            case 'cashea':
                return 'TOTAL PAGADO AHORA';
            case 'contado':
            default:
                return 'TOTAL PAGADO';
        }
    }

    getMensajeFinal(): string {
        switch (this.venta.formaPago) {
            case 'abono':
                return '¡Gracias por su abono! Conserve este comprobante';
            case 'cashea':
                return '¡Gracias por su compra! Plan Cashea activado';
            case 'contado':
            default:
                return '¡Gracias por su compra! Conserve este comprobante';
        }
    }

    getDeudaPendienteAbono(): number {
        if (this.venta.formaPago !== 'abono') return 0;

        const total = this.getMontoTotalSeguro();
        const abonado = this.venta.montoAbonado || 0;

        const deuda = Math.max(total - abonado, 0);

        return this.redondear(deuda);
    }

    getDeudaPendienteCashea(): number {
        if (this.venta.formaPago !== 'cashea') return 0;

        const total = this.getMontoTotalSeguro();
        const pagadoAhora = this.totalPagadoCashea;

        const deuda = Math.max(total - pagadoAhora, 0);

        return this.redondear(deuda);
    }

    getMontoTotalSeguro(): number {
        const total = this.datosRecibo?.totales?.total || this.montoTotal;
        return total;
    }

    private obtenerMontoConsultaAplicado(): number {
        if (!this.consultaEnCarrito) {
            return 0;
        }

        if (this.tipoVenta === 'consulta_productos') {
            return this.redondear(this.pagoMedico || 0);
        }

        return this.redondear(this.montoConsulta || 0);
    }

    obtenerMontoReciboEnBolivar(monto: number, moneda?: string): number {
        const monedaOrigen = moneda || this.datosRecibo?.configuracion?.moneda || this.venta.moneda;

        if (monedaOrigen === 'bolivar') {
            return this.redondear(monto || 0);
        }

        return this.redondear(this.convertirMontoExacto(monto || 0, monedaOrigen, 'bolivar'));
    }

    debeMostrarConversionBsEnRecibo(moneda?: string): boolean {
        const monedaOrigen = moneda || this.datosRecibo?.configuracion?.moneda || this.venta.moneda;
        return monedaOrigen !== 'bolivar';
    }

    debeMostrarConversionBsPorMetodo(metodo: any): boolean {
        const monedaOriginal = this.normalizarMonedaMetodo(metodo?.moneda) || 'dolar';

        return monedaOriginal !== 'bolivar';
    }

    private crearDatosReciboReal(): any {
        const fechaActual = new Date();
        const sedeInfo = this.obtenerInfoSede();
        const vendedorInfo = this.getResumenAsesor();
        const montoConsultaAplicado = this.obtenerMontoConsultaAplicado();

        // 1. Calcular SUBTOTAL SIN IVA (productos)
        const subtotalSinIvaProductos = this.calcularSubtotalSinIvaGlobal();

        // 2. Calcular SUBTOTAL CON IVA (productos)
        const subtotalConIvaProductos = this.subtotalConIvaCorregido;

        // 3. Calcular IVA REAL
        const ivaReal = this.calcularTotalIvaDespuesDescuento();

        // 4. Calcular descuento sobre el subtotal SIN IVA
        const descuentoMonto = this.calcularDescuento();

        // 5. Calcular base imponible con descuento (SIN IVA)
        const baseImponibleConDescuento = this.baseImponibleConDescuento;

        // 6. Calcular total de productos con descuento (SIN IVA)
        const totalProductosConDescuentoSinIva = baseImponibleConDescuento;

        // 7. Calcular total de productos con IVA
        const totalProductosConIva = this.redondear(totalProductosConDescuentoSinIva + ivaReal);

        // Determinar el total pagado según la forma de pago REAL
        let totalPagado = 0;
        switch (this.venta.formaPago) {
            case 'contado':
                totalPagado = this.totalPagadoPorMetodos;
                break;
            case 'abono':
                totalPagado = this.venta.montoAbonado || 0;
                break;
            case 'cashea':
                totalPagado = this.totalPagadoCashea;
                break;
            default:
                totalPagado = this.totalPagadoPorMetodos;
        }

        // Productos con detalles (incluyendo consulta)
        const productosConDetalles = this.obtenerProductosConDetalles();

        if (montoConsultaAplicado > 0) {
            const cargo = this.obtenerCargoEspecialista(this.historiaMedicaSeleccionada);
            const consultaItem = {
                nombre: `Consulta de ${cargo}`,
                codigo: `CONS-${this.historiaMedicaSeleccionada?.nHistoria}`,
                cantidad: 1,
                precioUnitario: montoConsultaAplicado,
                subtotal: montoConsultaAplicado,
                iva: 0,
                total: montoConsultaAplicado,
                aplicaIva: false,
                esConsulta: true,
                medico: this.obtenerNombreMedico(this.historiaMedicaSeleccionada)
            };
            productosConDetalles.unshift(consultaItem);
        }

        // Calcular total final (productos + consulta)
        const totalFinal = this.redondear(totalProductosConIva + montoConsultaAplicado);

        let clienteInfo = {
            nombre: 'CLIENTE GENERAL',
            cedula: 'N/A',
            telefono: 'N/A',
            esPaciente: false
        };

        if (this.requierePaciente && this.pacienteSeleccionado) {
            clienteInfo = {
                nombre: this.pacienteSeleccionado?.informacionPersonal?.nombreCompleto || 'PACIENTE',
                cedula: this.pacienteSeleccionado?.informacionPersonal?.cedula || 'N/A',
                telefono: this.pacienteSeleccionado?.informacionPersonal?.telefono || 'N/A',
                esPaciente: true
            };
        } else if (!this.requierePaciente) {
            clienteInfo = {
                nombre: this.clienteSinPaciente.nombreCompleto?.trim() || 'CLIENTE GENERAL',
                cedula: this.clienteSinPaciente.cedula?.trim() || 'N/A',
                telefono: this.clienteSinPaciente.telefono?.trim() || 'N/A',
                esPaciente: false
            };
        }

        // Métodos de pago
        const metodosPagoParaRecibo = this.venta.metodosDePago.map(m => {
            const monedaMetodo = m.moneda || this.getMonedaParaMetodo(m.tipo, m);
            const montoEnSistema = this.redondear(this.convertirMontoExacto(m.monto || 0, monedaMetodo, this.venta.moneda));
            const montoEnBolivar = this.redondear(this.convertirMontoExacto(m.monto || 0, monedaMetodo, 'bolivar'));
            return {
                tipo: m.tipo || 'efectivo',
                monto: m.monto || 0,
                referencia: m.referencia || '',
                banco: m.banco || '',
                bancoEmisor: m.banco || '',
                bancoReceptor: m.bancoReceptor || '',
                notaPago: m.notaPago || '',
                moneda: monedaMetodo,
                montoEnSistema: montoEnSistema,
                monedaSistema: this.venta.moneda,
                montoEnBolivar: montoEnBolivar
            };
        });

        const datosRecibo: any = {
            numeroVenta: 'V-' + Date.now().toString().slice(-6),
            fecha: fechaActual.toLocaleDateString('es-VE'),
            hora: fechaActual.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
            vendedor: vendedorInfo,
            sede: sedeInfo,
            cliente: clienteInfo,
            productos: productosConDetalles,
            metodosPago: metodosPagoParaRecibo,
            totales: {
                subtotal: subtotalSinIvaProductos,           // ← AHORA ES SIN IVA
                subtotalConIva: subtotalConIvaProductos,     // ← NUEVO: subtotal con IVA
                descuento: descuentoMonto,
                iva: ivaReal,
                consulta: montoConsultaAplicado,
                total: totalFinal,
                totalPagado: totalPagado,
                totalEnBolivar: this.obtenerMontoReciboEnBolivar(totalFinal, this.venta.moneda)
            },
            configuracion: {
                formaPago: this.venta.formaPago,
                moneda: this.venta.moneda,
                descuento: this.venta.descuento,
                impuesto: this.ivaPorcentaje,
                observaciones: this.construirObservacionesVenta()
            }
        };

        // Agregar información específica para Cashea
        if (this.venta.formaPago === 'cashea') {
            datosRecibo.cashea = {
                nivel: this.nivelCashea,
                inicial: this.venta.montoInicial || 0,
                cuotasAdelantadas: this.resumenCashea.cantidad,
                montoAdelantado: this.resumenCashea.total,
                cantidadCuotas: this.cantidadCuotasCashea,
                montoPorCuota: this.montoPrimeraCuota,
                deudaPendiente: this.getDeudaPendienteCashea()
            };
        }

        // Agregar información específica para Abono
        if (this.venta.formaPago === 'abono') {
            datosRecibo.abono = {
                montoAbonado: this.venta.montoAbonado || 0,
                deudaPendiente: this.getDeudaPendienteAbono(),
                porcentajePagado: this.porcentajeAbonadoDelTotal,
                abonos: [{
                    fecha: fechaActual.toLocaleDateString('es-VE'),
                    monto: this.venta.montoAbonado || 0,
                    numero: 1
                }]
            };
        }

        return datosRecibo;
    }

    private obtenerProductosConDetalles(): any[] {
        return this.venta.productos.map((p, index) => {
            const productoCalculado = this.productosConDetalle.find(pc => pc.id === p.id);

            if (productoCalculado) {
                // Usar precio SIN IVA para mostrar en tabla
                const precioSinIva = productoCalculado.precioConvertido || 0;
                const cantidad = p.cantidad || 1;
                const subtotalSinIva = precioSinIva * cantidad;

                return {
                    nombre: p.nombre || 'Producto',
                    codigo: p.codigo || 'N/A',
                    cantidad: cantidad,
                    precioUnitario: precioSinIva,
                    precioConIva: productoCalculado.precioConIva || 0,
                    subtotal: subtotalSinIva,
                    iva: productoCalculado.iva || 0,
                    total: productoCalculado.total || 0,
                    aplicaIva: p.aplicaIva || false,
                    moneda: p.moneda
                };
            }

            // Fallback
            const cantidad = p.cantidad || 1;
            const precioSinIva = p.precio || 0;
            const subtotalSinIva = precioSinIva * cantidad;
            const ivaCalculado = p.aplicaIva ? subtotalSinIva * (this.ivaPorcentaje / 100) : 0;

            return {
                nombre: p.nombre || 'Producto',
                codigo: p.codigo || 'N/A',
                cantidad: cantidad,
                precioUnitario: precioSinIva, // SIN IVA
                precioConIva: p.precioConIva || 0,
                subtotal: subtotalSinIva, // cantidad × precio SIN IVA
                iva: ivaCalculado,
                total: subtotalSinIva + ivaCalculado,
                aplicaIva: p.aplicaIva || false,
                moneda: p.moneda
            };
        });
    }

    /**
     * Compartir por WhatsApp usando la información del cliente del modal
     */
    compartirWhatsApp(): void {
        try {
            const datos = this.datosRecibo || this.crearDatosReciboReal();

            // Obtener el teléfono del cliente directamente de los datos del modal
            const telefonoCliente = this.obtenerTelefonoCliente();

            if (!telefonoCliente) {
                this.solicitarTelefonoParaWhatsApp(datos);
                return;
            }

            this.enviarWhatsAppDirecto(telefonoCliente, datos);

        } catch (error) {
            console.error('Error al compartir por WhatsApp:', error);
            this.swalService.showError('Error', 'No se pudo abrir WhatsApp. Verifica que tengas la aplicación instalada.');
        }
    }

    private solicitarTelefonoParaWhatsApp(datos: any): void {
        const htmlContent = `
        <div class="text-start">
            <p class="mb-3">Ingresa el número de teléfono del cliente:</p>
            <input type="tel" 
                   id="telefonoInput" 
                   class="form-control" 
                   placeholder="Ej: 584141234567"
                   pattern="[0-9+]{10,15}"
                   required>
            <small class="form-text text-muted">Incluye código de país (ej: 58 para Venezuela)</small>
        </div>
    `;

        this.swalService.showConfirm(
            'Compartir por WhatsApp',
            htmlContent,
            'Enviar',
            'Cancelar'
        ).then((result) => {
            if (result.isConfirmed) {
                const telefonoInput = document.getElementById('telefonoInput') as HTMLInputElement;
                if (telefonoInput && telefonoInput.value) {
                    let telefono = telefonoInput.value.replace(/\D/g, '');

                    // Asegurar formato internacional para Venezuela
                    if (!telefono.startsWith('58') && telefono.length === 10) {
                        telefono = '58' + telefono;
                    }

                    if (telefono.length >= 10) {
                        this.enviarWhatsAppDirecto(telefono, datos);
                    } else {
                        this.swalService.showError('Error', 'Por favor ingresa un número de teléfono válido.');
                        this.solicitarTelefonoParaWhatsApp(datos);
                    }
                }
            }
        });

        // Focus en el input después de que se abra el modal
        setTimeout(() => {
            const telefonoInput = document.getElementById('telefonoInput') as HTMLInputElement;
            if (telefonoInput) {
                telefonoInput.focus();
            }
        }, 300);
    }

    private enviarWhatsAppDirecto(telefono: string, datos: any): void {
        const sedeInfo = datos?.sede || this.obtenerInfoSede();
        const nombreSede = sedeInfo?.nombre || 'NEW VISION LENS';
        const direccionSede = sedeInfo?.direccion || 'C.C. Candelaria, Local PB-04, Guarenas';
        const telefonoSede = sedeInfo?.telefono || '0212-365-39-42';
        const emailSede = sedeInfo?.email || 'newvisionlens2020@gmail.com';

        // Crear mensaje mejorado
        let mensaje = `*${nombreSede}* 🛍️\n\n`;
        mensaje += `*${this.getTituloRecibo()}* 📄\n`;
        mensaje += `*Número:* ${datos.numeroVenta}\n`;
        mensaje += `*Fecha:* ${datos.fecha}\n`;
        mensaje += `*Hora:* ${datos.hora}\n`;
        mensaje += `*Cliente:* ${datos.cliente.nombre}\n`;
        mensaje += `*Cédula:* ${datos.cliente.cedula}\n\n`;

        // Información específica por tipo de pago
        switch (this.venta.formaPago) {
            case 'abono':
                mensaje += `*Forma de pago:* ABONO PARCIAL 💰\n`;
                mensaje += `*Monto abonado:* ${this.formatearMoneda(datos.totales.totalPagado)}\n`;
                mensaje += `*Deuda pendiente:* ${this.formatearMoneda(this.getDeudaPendienteAbono())}\n`;
                mensaje += `*Porcentaje pagado:* ${Math.round(this.porcentajeAbonadoDelTotal)}%\n\n`;
                mensaje += `¡Gracias por su abono! 🎉\n`;
                break;

            case 'cashea':
                mensaje += `*Forma de pago:* CASHEA 📅\n`;
                mensaje += `*Nivel:* ${this.obtenerNombreNivelCashea(this.nivelCashea)}\n`;
                mensaje += `*Total pagado ahora:* ${this.formatearMoneda(datos.totales.totalPagado)}\n`;
                mensaje += `*Inicial:* ${this.formatearMoneda(this.venta.montoInicial)}\n`;
                if (this.resumenCashea.cantidad > 0) {
                    mensaje += `*Cuotas adelantadas:* ${this.resumenCashea.cantidad}\n`;
                }
                mensaje += `*Deuda pendiente:* ${this.formatearMoneda(this.getDeudaPendienteCashea())}\n`;
                mensaje += `*Cuotas restantes:* ${this.cantidadCuotas - this.resumenCashea.cantidad}\n\n`;
                mensaje += `¡Plan Cashea activado! 🔄\n`;
                break;

            case 'contado':
            default:
                mensaje += `*Forma de pago:* CONTADO 💵\n`;
                mensaje += `*Total pagado:* ${this.formatearMoneda(datos.totales.totalPagado)}\n\n`;
                mensaje += `¡Pago completado! ✅\n`;
        }

        // Métodos de pago utilizados
        if (datos.metodosPago && datos.metodosPago.length > 0) {
            mensaje += `\n*Métodos de pago utilizados:*\n`;
            datos.metodosPago.forEach((metodo: any) => {
                const emoji = this.obtenerEmojiMetodoPago(metodo.tipo);
                const montoVisible = metodo.monto ?? metodo.montoEnSistema ?? metodo.montoEnMonedaSistema;
                const monedaVisible = metodo.moneda || metodo.monedaSistema || datos.configuracion?.moneda;
                mensaje += `• ${emoji} ${this.formatearTipoPago(metodo.tipo)}: ${this.formatearMoneda(montoVisible, monedaVisible)}\n`;
                if (this.debeMostrarConversionBsPorMetodo(metodo)) {
                    mensaje += `  Bs: ${this.formatearMoneda(metodo.montoEnBolivar ?? this.obtenerMontoReciboEnBolivar(montoVisible, monedaVisible), 'bolivar')}\n`;
                }
                if (metodo.referencia) {
                    mensaje += `  Ref: ${metodo.referencia}\n`;
                }
                if (metodo.bancoEmisor || metodo.banco) {
                    mensaje += `  Banco emisor: ${metodo.bancoEmisor || metodo.banco}\n`;
                }
                if (metodo.bancoReceptor) {
                    mensaje += `  Banco receptor: ${metodo.bancoReceptor}\n`;
                }
                if (metodo.notaPago) {
                    mensaje += `  Nota: ${metodo.notaPago}\n`;
                }
            });
        }

        mensaje += `\n📍 *${nombreSede}*\n`;
        mensaje += `🏪 ${direccionSede}\n`;
        mensaje += `📞 ${telefonoSede}\n`;
        mensaje += `✉️ ${emailSede}\n\n`;
        mensaje += `_Conserve este comprobante para cualquier reclamo._`;

        // Crear URL de WhatsApp
        const urlWhatsApp = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;

        // Abrir WhatsApp
        window.open(urlWhatsApp, '_blank');

        this.swalService.showSuccess('WhatsApp', 'Redirigiendo a WhatsApp para enviar mensaje');
    }

    private obtenerEmojiMetodoPago(tipo: string): string {
        const emojis: { [key: string]: string } = {
            'efectivo': '💵',
            'punto': '💳',
            'pagomovil': '📱',
            'transferencia': '🏦',
            'zelle': '🌐'
        };
        return emojis[tipo] || '💰';
    }

    /**
     * Obtiene el teléfono del cliente desde el modal de generar venta
     */
    private obtenerTelefonoCliente(): string {
        if (this.requierePaciente && this.pacienteSeleccionado) {
            return this.pacienteSeleccionado.informacionPersonal?.telefono || '';
        } else if (!this.requierePaciente) {
            return this.clienteSinPaciente.telefono || '';
        }
        return '';
    }

    /**
     * Compartir por Email usando la información del cliente del modal
     */
    compartirEmail(): void {
        try {
            const datos = this.datosRecibo || this.crearDatosReciboReal();

            // Obtener el email del cliente directamente de los datos del modal
            const emailCliente = this.obtenerEmailCliente();

            if (!emailCliente || !this.validarEmail(emailCliente)) {
                // this.solicitarEmailParaEnvio(datos);
                return;
            }

            //  this.enviarEmailDirecto(emailCliente, datos);

        } catch (error) {
            console.error('Error al compartir por email:', error);
            this.swalService.showError('Error', 'No se pudo abrir el cliente de email.');
        }
    }

    /**
     * Obtiene el email del cliente desde el modal de generar venta
     */
    private obtenerEmailCliente(): string {
        if (this.requierePaciente && this.pacienteSeleccionado) {
            return this.pacienteSeleccionado.informacionPersonal?.email || '';
        } else if (!this.requierePaciente) {
            return this.clienteSinPaciente.email || '';
        }
        return '';
    }

    // === MÉTODOS PARA CLIENTE SIN PACIENTE ===
    get mostrarFormulacionMedica(): boolean {
        return this.requierePaciente && !!this.historiaMedica;
    }

    get mostrarClienteSinPaciente(): boolean {
        return !this.requierePaciente;
    }

    // En tu componente TypeScript
    onTipoPersonaChange(): void {
        // Resetear campos según el tipo de persona
        if (this.clienteSinPaciente.tipoPersona === 'juridica') {
            // Para persona jurídica, formatear RIF si es necesario
            if (this.clienteSinPaciente.cedula && !this.clienteSinPaciente.cedula.toUpperCase().startsWith('J')) {
                this.clienteSinPaciente.cedula = 'J-' + this.clienteSinPaciente.cedula.replace(/[^0-9]/g, '');
            }
        }

        // Limpiar empresa referida cuando cambia el tipo de persona
        this.limpiarInformacionEmpresa();

        // Forzar actualización de la vista
        this.cdr.detectChanges();
    }

    get datosClienteParaVenta(): any {
        if (this.requierePaciente && this.pacienteSeleccionado) {
            return {
                tipo: 'paciente',
                datos: this.pacienteSeleccionado
            };
        } else if (!this.requierePaciente) {
            return {
                tipo: 'cliente_general',
                datos: this.clienteSinPaciente
            };
        }
        return null;
    }

    /**
    * Obtiene la clase CSS para el badge de estado
    */
    getEstadoBadgeClass(): string {
        const estado = this.informacionVenta?.estado?.toLowerCase() || 'completada';

        switch (estado) {
            case 'completada':
            case 'completed':
            case 'completado':
                return 'status-completed';
            case 'pendiente':
            case 'pending':
                return 'status-pending';
            case 'procesando':
            case 'processing':
                return 'status-processing';
            default:
                return 'status-completed';
        }
    }

    getEstadoTexto(): string {
        const estado = this.informacionVenta?.estado?.toLowerCase() || 'completada';

        switch (estado) {
            case 'completada':
            case 'completed':
            case 'completado':
                return 'Completado';
            case 'pendiente':
            case 'pending':
                return 'Pendiente';
            case 'procesando':
            case 'processing':
                return 'Procesando';
            default:
                return 'Completado';
        }
    }
    // Validar email (ahora obligatorio)
    validarEmail(email: string): boolean {
        // Si está vacío, es válido (opcional)
        if (!email || email.trim() === '') return true;

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email.trim());
    }

    // Validar cédula/RIF (obligatorio)
    validarCedula(cedula: string, tipoPersona: string): boolean {
        if (!cedula || cedula.trim() === '') return false;

        const cedulaLimpia = cedula.trim();

        if (tipoPersona === 'juridica') {
            // Para persona jurídica (RIF): J-123456789
            const rifRegex = /^[JjVGgEe]-?\d{7,9}$/;
            if (!rifRegex.test(cedulaLimpia)) return false;

            // Si no tiene la J al inicio, agregarla automáticamente
            if (!cedulaLimpia.toUpperCase().startsWith('J')) {
                this.clienteSinPaciente.cedula = 'J-' + cedulaLimpia.replace(/[^0-9]/g, '');
            }
            return true;
        } else {
            // Para persona natural: solo números, máximo 8 dígitos
            const cedulaRegex = /^\d{1,8}$/;
            return cedulaRegex.test(cedulaLimpia);
        }
    }

    // Validar nombre según el tipo de persona
    validarNombre(nombre: string): boolean {
        if (!nombre || nombre.trim() === '') return false;

        const nombreLimpio = nombre.trim();
        const tipoPersona = this.clienteSinPaciente.tipoPersona;

        if (tipoPersona === 'juridica') {
            // Para persona jurídica (razón social): permitir letras, números, puntos, comas, guiones, etc.
            const razonSocialRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s\.\,\-\&]+$/;
            return razonSocialRegex.test(nombreLimpio);
        } else {
            // Para persona natural: solo letras y espacios
            const nombreNaturalRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
            return nombreNaturalRegex.test(nombreLimpio);
        }
    }

    // Actualizar el mensaje de error según el tipo de persona
    getMensajeErrorNombre(): string {
        const tipoPersona = this.clienteSinPaciente.tipoPersona;

        if (tipoPersona === 'juridica') {
            return 'La razón social puede contener letras, números, espacios, puntos (.), comas (,), guiones (-) y símbolos como &';
        } else {
            return 'El nombre solo puede contener letras y espacios';
        }
    }

    onTelefonoBlur(): void {
        const telefono = this.clienteSinPaciente.telefono;

        if (telefono && telefono.trim() !== '') {
            const telefonoFormateado = this.formatearTelefonoVenezuela(telefono);

            // Solo actualizar si el formato cambió
            if (telefonoFormateado !== telefono) {
                this.clienteSinPaciente.telefono = telefonoFormateado;
            }

            // Validar después del formateo
            this.validarTelefonoFormateado(telefonoFormateado);
        }
    }

    private validarTelefonoFormateado(telefono: string): void {
        if (!this.validarTelefono(telefono)) {
            this.mostrarErrorTelefono();
            this.mensajeValidacionCliente = this.getMensajeErrorTelefono();
        } else {
            this.limpiarErrorTelefono();
        }
    }

    // Validar teléfono
    validarTelefono(telefono: string): boolean {
        if (!telefono || telefono.trim() === '') return false;

        const telefonoLimpio = telefono.trim();

        // Aceptar formatos internacionales y locales
        const formatosAceptados = [
            /^\+\d{1,3} \d{7,15}$/,     // +58 4121234567, +57 3123456789
            /^\d{1,3} \d{7,15}$/,       // 58 4121234567, 57 3123456789
            /^\d{10,11}$/,              // 4121234567 o 04121234567 (Venezuela)
            /^\+?\d{10,15}$/,           // +584121234567 o 584121234567
            /^\d{1,3}\s+\d{7,15}$/      // 57  3123456789 (con espacios múltiples)
        ];

        return formatosAceptados.some(pattern => pattern.test(telefonoLimpio));
    }

    getMensajeErrorTelefono(): string {
        return 'Formato inválido. Para Venezuela: 4121234567. Otros países: +código número';
    }


    private formatearTelefonoVenezuela(telefono: string): string {
        if (!telefono) return '';

        const telefonoLimpio = telefono.replace(/[\-\(\)]/g, '').trim();

        // Caso 1: Ya tiene formato correcto con +, dejarlo como está
        if (telefonoLimpio.startsWith('+')) {
            return this.formatearConEspacio(telefonoLimpio);
        }

        // Caso 2: Si ya tiene 58 sin +, agregar el + (Venezuela)
        if (telefonoLimpio.startsWith('58') && telefonoLimpio.length > 2) {
            // Si tiene espacio después del 58: "58 412..."
            if (telefonoLimpio.includes(' ')) {
                const partes = telefonoLimpio.split(' ');
                if (partes[0] === '58') {
                    return `+58 ${partes.slice(1).join('')}`;
                }
            } else {
                // Sin espacio: "58412..."
                const numero = telefonoLimpio.substring(2);
                return `+58 ${numero}`;
            }
        }

        // Caso 3: Detectar formato internacional con código y espacio (ej: "57 3123456789")
        const formatoInternacional = this.detectarFormatoInternacional(telefonoLimpio);
        if (formatoInternacional) {
            return `+${formatoInternacional}`;
        }

        // Caso 4: Detectar números venezolanos por sus códigos de área
        const esNumeroVenezolano = this.esNumeroVenezolano(telefonoLimpio.replace(/\s/g, ''));

        if (esNumeroVenezolano) {
            return `+58 ${telefonoLimpio.replace(/\s/g, '')}`;
        }

        // Caso 5: Si no coincide con nada, dejar como está
        return telefono;
    }

    // Formatear con espacio después del código (mejorado)
    private formatearConEspacio(telefono: string): string {
        // Si ya tiene + pero no espacio después del código, agregarlo
        if (telefono.startsWith('+') && !telefono.includes(' ')) {
            // Buscar donde termina el código (1-3 dígitos después del +)
            const match = telefono.match(/^\+(\d{1,3})(\d+)$/);
            if (match) {
                const codigo = match[1];
                const numero = match[2];
                return `+${codigo} ${numero}`;
            }
        }

        // Si ya tiene formato con espacio, dejarlo como está
        return telefono;
    }

    // Detectar formato internacional: "código número" (ej: "57 3123456789")
    private detectarFormatoInternacional(telefono: string): string | null {
        // Patrón: 1-3 dígitos + espacio + 7-15 dígitos
        const patronInternacional = /^(\d{1,3})\s+(\d{7,15})$/;
        const match = telefono.match(patronInternacional);

        if (match) {
            const codigo = match[1];
            const numero = match[2];
            return `${codigo} ${numero}`;
        }

        return null;
    }

    // Verificar si es un número venezolano (mantenemos igual)
    private esNumeroVenezolano(telefono: string): boolean {
        // Remover espacios para la validación
        const telefonoSinEspacios = telefono.replace(/\s/g, '');

        // Patrones de números venezolanos
        const patronesVenezuela = [
            /^(0412|0414|0416|0424|0426|0412|0424|0416|0426|0414)/, // Móviles con 0
            /^(412|414|416|424|426)/, // Móviles sin 0
            /^(0212|0234|0235|0241|0243|0244|0245|0246|0247|0248|0249|0251|0252|0253|0254|0255|0256|0257|0258|0259|0261|0262|0263|0264|0265|0266|0267|0268|0269|0271|0272|0273|0274|0275)/, // Fijos con 0
            /^(212|234|235|241|243|244|245|246|247|248|249|251|252|253|254|255|256|257|258|259|261|262|263|264|265|266|267|268|269|271|272|273|274|275)/ // Fijos sin 0
        ];

        return patronesVenezuela.some(patron => patron.test(telefonoSinEspacios));
    }

    // Formatear teléfono automáticamente (sin forzar código de país)
    formatearTelefono(telefono: string): string {
        if (!telefono) return '';

        const telefonoLimpio = telefono.replace(/\D/g, '');

        // Si empieza con código de país (más de 8 dígitos), formatear con espacio después del código
        if (telefonoLimpio.length > 8) {
            // Asumir que los primeros 1-3 dígitos son código de país
            const codigoPaisLength = telefonoLimpio.length - 8; // 8 dígitos para el número local
            const codigoPais = telefonoLimpio.substring(0, codigoPaisLength);
            const numeroLocal = telefonoLimpio.substring(codigoPaisLength);

            return `+${codigoPais} ${numeroLocal}`;
        }

        return telefonoLimpio;
    }

    // Validar cliente completo (todos los campos obligatorios)
    validarClienteSinPaciente(): boolean {
        const cliente = this.clienteSinPaciente;

        const nombreValido = this.validarNombre(cliente.nombreCompleto);
        const cedulaValida = this.validarCedula(cliente.cedula, cliente.tipoPersona);
        const telefonoValido = this.validarTelefono(cliente.telefono);
        // Email es opcional: solo valida si hay contenido, sino pasa como válido
        const emailValido = cliente.email ? this.validarEmail(cliente.email) : true;

        return nombreValido && cedulaValida && telefonoValido && emailValido;
    }

    onTelefonoChange(): void {
        const telefono = this.clienteSinPaciente.telefono;

        if (!this.validarTelefono(telefono)) {
            this.mostrarErrorTelefono();
        } else {
            this.limpiarErrorTelefono();
        }
        this.actualizarEstadoValidacion();
    }

    onEmailChange(): void {
        const email = this.clienteSinPaciente.email;

        // Si está vacío o tiene formato válido, limpiar error
        if (!email || email.trim() === '' || this.validarEmail(email)) {
            this.limpiarErrorEmail();
        } else {
            this.mostrarErrorEmail();
        }
        this.actualizarEstadoValidacion();
    }

    onNombreChange(): void {
        const nombre = this.clienteSinPaciente.nombreCompleto;

        if (!this.validarNombre(nombre)) {
            this.mostrarErrorNombre();
        } else {
            this.limpiarErrorNombre();
        }
        this.actualizarEstadoValidacion();
    }

    // Métodos para mostrar/ocultar errores
    mostrarErrorCedula(): void {
        const elemento = document.querySelector('[data-cedula-input]');
        if (elemento) {
            elemento.classList.add('input-error');
        }
    }

    limpiarErrorCedula(): void {
        const elemento = document.querySelector('[data-cedula-input]');
        if (elemento) {
            elemento.classList.remove('input-error');
        }
    }

    mostrarErrorTelefono(): void {
        const elemento = document.querySelector('[data-telefono-input]');
        if (elemento) {
            elemento.classList.add('input-error');
        }
    }

    limpiarErrorTelefono(): void {
        const elemento = document.querySelector('[data-telefono-input]');
        if (elemento) {
            elemento.classList.remove('input-error');
        }
    }

    mostrarErrorEmail(): void {
        const elemento = document.querySelector('[data-email-input]');
        if (elemento) {
            elemento.classList.add('input-error');
        }
    }

    limpiarErrorEmail(): void {
        const elemento = document.querySelector('[data-email-input]');
        if (elemento) {
            elemento.classList.remove('input-error');
        }
    }

    mostrarErrorNombre(): void {
        const elemento = document.querySelector('[data-nombre-input]');
        if (elemento) {
            elemento.classList.add('input-error');
        }
    }

    limpiarErrorNombre(): void {
        const elemento = document.querySelector('[data-nombre-input]');
        if (elemento) {
            elemento.classList.remove('input-error');
        }
    }

    // Obtener mensajes de error para mostrar al usuario
    getMensajeErrorCedula(): string {
        const tipoPersona = this.clienteSinPaciente.tipoPersona;
        if (tipoPersona === 'juridica') {
            return 'Formato de RIF inválido. Use J- seguido de 7-9 números. Ej: J-123456789';
        } else {
            return 'La cédula debe contener solo números (máximo 8 dígitos)';
        }
    }

    getMensajeErrorEmail(): string {
        return 'Formato de email inválido. Use: ejemplo@correo.com (opcional)';
    }

    // Obtener estado individual de cada campo para mostrar en la UI
    getEstadoCampoNombre(): { valido: boolean, mensaje: string } {
        const nombre = this.clienteSinPaciente.nombreCompleto;
        if (!nombre || nombre.trim() === '') {
            return { valido: false, mensaje: 'El nombre es obligatorio' };
        }
        return {
            valido: this.validarNombre(nombre),
            mensaje: this.getMensajeErrorNombre()
        };
    }

    getEstadoCampoCedula(): { valido: boolean, mensaje: string } {
        const cedula = this.clienteSinPaciente.cedula;
        const tipoPersona = this.clienteSinPaciente.tipoPersona;
        if (!cedula || cedula.trim() === '') {
            return { valido: false, mensaje: 'La cédula/RIF es obligatorio' };
        }
        return {
            valido: this.validarCedula(cedula, tipoPersona),
            mensaje: this.getMensajeErrorCedula()
        };
    }

    getEstadoCampoTelefono(): { valido: boolean, mensaje: string } {
        const telefono = this.clienteSinPaciente.telefono;
        if (!telefono || telefono.trim() === '') {
            return { valido: false, mensaje: 'El teléfono es obligatorio' };
        }
        return {
            valido: this.validarTelefono(telefono),
            mensaje: this.getMensajeErrorTelefono()
        };
    }

    getEstadoCampoEmail(): { valido: boolean, mensaje: string } {
        const email = this.clienteSinPaciente.email;

        // Si está vacío, es válido (campo opcional)
        if (!email || email.trim() === '') {
            return { valido: true, mensaje: '' };
        }

        // Si tiene contenido, validar formato
        return {
            valido: this.validarEmail(email),
            mensaje: this.getMensajeErrorEmail()
        };
    }

    limpiarInformacionEmpresa(): void {
        this.usarEmpresaEnVenta = false;
        this.mostrarInfoEmpresa = false;

        if (this.empresaReferidaInfo) {
            // Solo limpiar el toggle, no la información de la empresa
        }
    }

    onToggleUsoEmpresa(event: any): void {
        const isChecked = event.target.checked;
        this.usarEmpresaEnVenta = isChecked;

        // Mostrar feedback al usuario
        const mensaje = isChecked
            ? 'Empresa referida activada para esta venta'
            : 'Empresa referida desactivada';

        this.snackBar.open(mensaje, 'Cerrar', {
            duration: 2000,
            panelClass: ['snackbar-info']
        });

    }

    obtenerInfoEmpresaParaAPI(): any {
        // Verificar primero si hay información de empresa referida activa
        if (!this.usarEmpresaEnVenta || !this.empresaReferidaInfo) {
            return null;
        }

        // Verificar si la empresa tiene datos válidos
        if (!this.empresaReferidaInfo.nombre || !this.empresaReferidaInfo.rif) {
            return null;
        }

        // Construir objeto de empresa para el API
        return {
            referidoEmpresa: true,
            empresaNombre: this.empresaReferidaInfo.nombre,
            empresaRif: this.empresaReferidaInfo.rif,
            empresaTelefono: this.empresaReferidaInfo.telefono || '',
            empresaDireccion: this.empresaReferidaInfo.direccion || '',
            empresaCorreo: this.empresaReferidaInfo.email || ''
        };
    }

    private autocompletarDatosCliente(datosCliente: any): void {
        // Verificar primero si realmente hay datos del cliente
        const clienteInfo = datosCliente.cliente || datosCliente;

        // Si la cédula es null, no hay cliente - SALIR INMEDIATAMENTE
        if (!clienteInfo || clienteInfo.cedula === null) {
            this.clienteEncontrado = false;
            this.validacionIntentada = true;
            this.mensajeValidacionCliente = 'Cliente no encontrado';

            // Limpiar campos y ocultar sección de empresa
            this.limpiarCamposCliente();
            this.empresaReferidaInfo = null;
            this.usarEmpresaEnVenta = false;

            this.cdr.detectChanges();
            return;
        }

        // 1. Limpiar información anterior primero
        this.limpiarInformacionEmpresa();

        // 2. Determinar tipo de persona basado en la cédula
        if (clienteInfo.cedula && clienteInfo.cedula.toUpperCase().startsWith('J')) {
            this.clienteSinPaciente.tipoPersona = 'juridica';
        } else {
            this.clienteSinPaciente.tipoPersona = 'natural';
        }

        // 3. Autocompletar datos básicos del cliente (solo si no son null)
        this.clienteSinPaciente.nombreCompleto = clienteInfo.nombre || clienteInfo.nombreCompleto || '';
        this.clienteSinPaciente.telefono = clienteInfo.telefono || '';
        this.clienteSinPaciente.email = clienteInfo.email || '';
        this.clienteSinPaciente.cedula = clienteInfo.cedula || datosCliente.cedula || this.clienteSinPaciente.cedula;

        // 4. IMPORTANTE: Manejar información de empresa si existe y no es null
        const empresaInfo = clienteInfo.informacionEmpresa;

        if (empresaInfo?.referidoEmpresa === true &&
            empresaInfo.empresaNombre !== null &&
            empresaInfo.empresaRif !== null &&
            empresaInfo.empresaNombre.trim() !== '' &&
            empresaInfo.empresaRif.trim() !== '') {

            // Usar los nombres de propiedades correctos del API
            this.empresaReferidaInfo = {
                referidoEmpresa: empresaInfo.referidoEmpresa,
                nombre: empresaInfo.empresaNombre || '',
                rif: empresaInfo.empresaRif || '',
                telefono: empresaInfo.empresaTelefono || '',
                direccion: empresaInfo.empresaDireccion || '',
                email: empresaInfo.empresaCorreo || ''
            };

            // Activar por defecto si tiene empresa referida
            this.usarEmpresaEnVenta = true;

            // Mostrar mensaje informativo
            const nombreEmpresa = this.empresaReferidaInfo.nombre;
            if (nombreEmpresa) {
                /* this.snackBar.open(`Empresa referida encontrada: ${nombreEmpresa}`, 'Cerrar', {
                     duration: 3000,
                     panelClass: ['snackbar-success']
                 });*/
            }

        } else {
            this.empresaReferidaInfo = null;
            this.usarEmpresaEnVenta = false;
        }

        // 5. Limpiar errores de validación
        this.limpiarErroresValidacion();

        // 6. Actualizar estado - CLIENTE ENCONTRADO
        this.clienteEncontrado = true;
        this.validacionIntentada = true;
        this.mensajeValidacionCliente = 'Cliente encontrado - Datos autocompletados';

        // Forzar detección de cambios
        this.cdr.detectChanges();
    }

    private limpiarErroresValidacion(): void {
        this.limpiarErrorCedula();
        this.limpiarErrorNombre();
        this.limpiarErrorTelefono();
        this.limpiarErrorEmail();
    }

    onCampoEditadoManualmente(): void {
        // marcar como edición manual
        if (this.clienteEncontrado) {
            this.editandoManual = true;
            this.clienteEncontrado = false;
            this.validacionIntentada = false;
            this.mensajeValidacionCliente = '✏️ Editando datos manualmente';

            this.snackBar.open('Modo edición manual activado', 'Cerrar', {
                duration: 2000,
                panelClass: ['snackbar-info']
            });
        }
    }

    /**
     * Método mejorado para cambio de cédula - validación solo en blur
     */
    onCedulaChange(): void {
        const cedula = this.clienteSinPaciente.cedula;
        const tipoPersona = this.clienteSinPaciente.tipoPersona;

        // Si ya había un cliente encontrado y el usuario está cambiando la cédula,
        // marcar que el cliente encontrado ya no es válido
        if (this.clienteEncontrado && cedula !== this.cedulaAnterior) {
            this.clienteEncontrado = false;
            this.validacionIntentada = false;
            this.mensajeValidacionCliente = 'Cédula modificada';

            // Limpiar campos autocompletados
            this.limpiarCamposCliente();
        }

        if (!this.validarCedula(cedula, tipoPersona)) {
            this.mostrarErrorCedula();
            this.mensajeValidacionCliente = this.getMensajeErrorCedula();
            this.clienteEncontrado = false;
            this.validacionIntentada = false;
        } else {
            this.limpiarErrorCedula();
            this.mensajeValidacionCliente = '';
        }

        this.actualizarEstadoValidacion();
    }

    /**
    * Se ejecuta cuando el usuario hace focus en el campo de cédula
    */
    onCedulaFocus(): void {
        // Si ya había un cliente encontrado y el usuario vuelve a hacer focus,
        // asumimos que quiere editar
        if (this.clienteEncontrado) {
            this.editandoManual = true;
            this.mensajeValidacionCliente = '✏️ Editando manualmente - haga blur para buscar';
        }
    }

    actualizarEstadoValidacion(): void {
        const valido = this.validarClienteSinPaciente();
        // Puedes usar esta función para habilitar/deshabilitar botones, etc.
    }

    onCedulaBlur(): void {
        const cedula = this.clienteSinPaciente.cedula?.trim();
        const tipoPersona = this.clienteSinPaciente.tipoPersona;

        if (!cedula) {
            this.limpiarEstadoValidacion();
            return;
        }

        // Validar formato básico
        if (!this.validarCedula(cedula, tipoPersona)) {
            this.mostrarErrorCedula();
            this.mensajeValidacionCliente = this.getMensajeErrorCedula();
            this.clienteEncontrado = false;
            this.validacionIntentada = false;
            return;
        }

        // Solo buscar si la cédula es válida y tiene al menos 4 caracteres
        if (cedula.length >= 4) {
            // Solo buscar si es una cédula diferente a la anterior
            if (!this.clienteEncontrado || cedula !== this.cedulaAnterior) {
                this.validarClientePorCedula();
            }
        } else {
            this.mensajeValidacionCliente = 'Ingrese al menos 4 dígitos para buscar';
            this.clienteEncontrado = false;
            this.validacionIntentada = false;
        }
    }

    /**
     * Limpia completamente el estado de validación
     */
    private limpiarEstadoValidacion(): void {
        this.clienteEncontrado = false;
        this.validacionIntentada = false;
        this.editandoManual = false;
        this.mensajeValidacionCliente = '';
        this.cedulaAnterior = '';

        // Limpiar campos autocompletados
        if (this.clienteSinPaciente.cedula) {
            // Solo limpiar otros campos si la cédula tiene valor
            // pero mantiene la cédula actual
            const cedulaActual = this.clienteSinPaciente.cedula;
            const tipoPersonaActual = this.clienteSinPaciente.tipoPersona;

            this.clienteSinPaciente.nombreCompleto = '';
            this.clienteSinPaciente.telefono = '';
            this.clienteSinPaciente.email = '';

            // Mantener cédula y tipo de persona
            this.clienteSinPaciente.cedula = cedulaActual;
            this.clienteSinPaciente.tipoPersona = tipoPersonaActual;
        }

        // Limpiar empresa referida
        this.empresaReferidaInfo = null;
        this.usarEmpresaEnVenta = false;

        // Limpiar errores visuales
        this.limpiarErroresValidacion();
    }

    forzarValidacionCliente(): void {
        const cedula = this.clienteSinPaciente.cedula?.trim();

        if (!cedula) {
            this.mensajeValidacionCliente = 'Ingrese una cédula o RIF para validar';
            return;
        }

        if (!this.validarCedula(cedula, this.clienteSinPaciente.tipoPersona)) {
            this.mensajeValidacionCliente = this.getMensajeErrorCedula();
            return;
        }

        this.validarClientePorCedula();
    }

    buscarClientePorCedula(cedula: string): Observable<any> {
        // Por ahora retornamos un observable vacío
        return of({
            existe: false,
            mensaje: 'API no implementada'
        });
    }

    getClaseBotonValidar(): string {
        let clase = 'btn-validar-compact';

        if (this.validandoCliente) {
            clase += ' btn-validando';
        } else if (this.clienteEncontrado) {
            clase += ' btn-encontrado';
        } else if (this.validacionIntentada && !this.clienteEncontrado && this.clienteSinPaciente.cedula) {
            // Solo mostrar "no encontrado" si ya se intentó validar y no se encontró
            clase += ' btn-no-encontrado';
        }
        // En otros casos, se mantiene el estado por defecto

        return clase;
    }

    async validarClientePorCedula(): Promise<void> {
        const cedula = this.clienteSinPaciente.cedula?.trim();

        // Validaciones básicas
        if (!cedula) {
            this.mensajeValidacionCliente = 'Ingrese una cédula o RIF para validar';
            this.validacionIntentada = false;
            this.clienteEncontrado = false;
            return;
        }

        if (!this.validarCedula(cedula, this.clienteSinPaciente.tipoPersona)) {
            this.mensajeValidacionCliente = this.getMensajeErrorCedula();
            this.validacionIntentada = false;
            this.clienteEncontrado = false;
            return;
        }

        // Guardar la cédula actual antes de la validación
        this.cedulaAnterior = cedula;

        // Iniciar validación
        this.validandoCliente = true;
        this.clienteEncontrado = false;
        this.validacionIntentada = false;
        this.mensajeValidacionCliente = '🔍 Buscando cliente en la base de datos...';

        try {
            const respuesta = await lastValueFrom(this.clienteService.buscarPorCedula(cedula));

            // Verificar si la cédula actual es la misma que se envió a buscar
            if (this.clienteSinPaciente.cedula?.trim() !== cedula) {
                // El usuario cambió la cédula durante la búsqueda, ignorar resultado
                this.validandoCliente = false;
                return;
            }

            // MARCAR QUE LA VALIDACIÓN SE INTENTÓ
            this.validacionIntentada = true;

            // VERIFICACIÓN SIMPLE: Si la cédula en la respuesta es null, el cliente no existe
            const clienteExiste = respuesta.cliente && respuesta.cliente.cedula !== null;

            if (clienteExiste) {
                this.clienteEncontrado = true;
                this.mensajeValidacionCliente = 'Cliente encontrado';

                // Autocompletar con la nueva estructura
                this.autocompletarDatosCliente(respuesta);

                this.snackBar.open('Cliente encontrado - Datos autocompletados', 'Cerrar', {
                    duration: 3000,
                    panelClass: ['snackbar-success']
                });
            } else {
                this.clienteEncontrado = false;
                this.mensajeValidacionCliente = 'Cliente no encontrado - Complete los datos manualmente';

                // IMPORTANTE: Limpiar campos y ocultar sección de empresa
                this.limpiarCamposCliente();
                this.empresaReferidaInfo = null;
                this.usarEmpresaEnVenta = false;
                this.clienteSinPaciente.cedula = cedula;

                this.snackBar.open('Cliente no encontrado. Complete los datos manualmente.', 'Cerrar', {
                    duration: 4000,
                    panelClass: ['snackbar-info']
                });
            }

        } catch (error: any) {
            this.validacionIntentada = true;
            this.clienteEncontrado = false;
            this.mensajeValidacionCliente = '⚠️ Error al conectar con el servidor';

            this.limpiarCamposCliente();
            this.empresaReferidaInfo = null;
            this.usarEmpresaEnVenta = false;
            this.clienteSinPaciente.cedula = cedula;

            let mensajeError = 'Error al validar cliente. Verifique su conexión.';
            if (error.error?.message) {
                mensajeError = error.error.message;
            } else if (error.message) {
                mensajeError = error.message;
            }

            this.snackBar.open(mensajeError, 'Cerrar', {
                duration: 3000,
                panelClass: ['snackbar-warning']
            });

        } finally {
            this.validandoCliente = false;
            this.cdr.detectChanges();
        }
    }

    private limpiarCamposCliente(): void {
        // Guardar cédula actual y tipo de persona
        const cedulaActual = this.clienteSinPaciente.cedula;
        const tipoPersonaActual = this.clienteSinPaciente.tipoPersona;

        // Limpiar todos los campos excepto la cédula
        this.clienteSinPaciente = {
            tipoPersona: tipoPersonaActual,
            nombreCompleto: '',
            cedula: cedulaActual, // Mantener la cédula actual
            telefono: '',
            email: ''
        };

        // Limpiar empresa referida
        this.empresaReferidaInfo = null;
        this.usarEmpresaEnVenta = false;
        this.mostrarInfoEmpresa = false;

        // Limpiar errores de validación
        this.limpiarErroresValidacion();

        // Actualizar estado de validación
        this.actualizarEstadoValidacion();
    }

    /**
     * Determina si debe mostrarse la sección de empresa referida
     */
    get mostrarSeccionEmpresa(): boolean {
        if (!this.clienteEncontrado) {
            return false;
        }

        if (!this.empresaReferidaInfo) {
            return false;
        }

        const tieneEmpresaValida = this.empresaReferidaInfo.referidoEmpresa === true &&
            this.empresaReferidaInfo.nombre &&
            this.empresaReferidaInfo.nombre.trim() !== '' &&
            this.empresaReferidaInfo.rif &&
            this.empresaReferidaInfo.rif.trim() !== '';

        return tieneEmpresaValida;
    }

    getTooltipBotonValidar(): string {
        if (this.editandoManual) {
            return 'Editando manualmente - haga blur para buscar nuevamente';
        }

        if (this.validandoCliente) {
            return 'Buscando cliente...';
        } else if (this.clienteEncontrado) {
            return 'Cliente encontrado - Click para re-validar';
        } else if (this.validacionIntentada && !this.clienteEncontrado) {
            return 'Cliente no encontrado - Complete los datos manualmente';
        } else if (!this.clienteSinPaciente.cedula) {
            return 'Ingrese una cédula para buscar';
        } else if (!this.validarCedula(this.clienteSinPaciente.cedula, this.clienteSinPaciente.tipoPersona)) {
            return 'Cédula inválida - Corrija el formato';
        } else if (this.clienteSinPaciente.cedula.length < 4) {
            return 'Ingrese al menos 4 caracteres para buscar';
        } else {
            return 'Buscar cliente en base de datos';
        }
    }

    /**
     * Se ejecuta cuando se borran dígitos de la cédula
     */
    onCedulaBorrado(): void {
        const cedulaActual = this.clienteSinPaciente.cedula?.trim() || '';

        if (this.clienteEncontrado &&
            (cedulaActual.length < this.cedulaAnterior.length ||
                cedulaActual !== this.cedulaAnterior)) {

            this.limpiarEstadoValidacion();
            this.mensajeValidacionCliente = 'Cédula modificada - Ingrese una cédula válida';
        }
    }

    abrirModalResumenConValidacion(): void {
        // Validar productos
        if (this.venta.productos.length === 0) {
            this.swalService.showWarning('Sin productos', 'Debes agregar al menos un producto para continuar.');
            return;
        }

        // Validar paciente si es requerido
        if (this.requierePaciente && !this.pacienteSeleccionado) {
            this.swalService.showWarning('Paciente requerido', 'Debes seleccionar un paciente para continuar.');
            return;
        }

        // Si pasa todas las validaciones, abrir el modal
        this.abrirModalResumen();
    }

    /**
     * Obtiene la tasa de cambio utilizada para la venta
     */
    private obtenerTasaUtilizada(): number {
        const monedaVenta = this.venta.moneda.toLowerCase();
        const monedaNormalizada = this.normalizarIdMoneda(monedaVenta);

        // Si la moneda es bolívar, retornar 1
        if (monedaNormalizada === 'bolivar') {
            return 1;
        }

        // Buscar la tasa en las tasas disponibles
        const tasa = this.tasasDisponibles.find(t => t.id === monedaNormalizada);

        if (tasa) {
            return tasa.valor;
        }

        // Si no se encuentra la tasa, buscar por nombre como fallback
        const tasaPorNombre = this.tasasDisponibles.find(t =>
            t.nombre.toLowerCase() === monedaNormalizada
        );

        return tasaPorNombre?.valor || 1;
    }
    /**
 * Normaliza el ID de moneda para búsqueda en las tasas
 */
    private normalizarIdMoneda(moneda: string): string {
        const mapaMonedas: { [key: string]: string } = {
            'dolar': 'dolar',
            'usd': 'dolar',
            '$': 'dolar',
            'euro': 'euro',
            'eur': 'euro',
            '€': 'euro',
            'bolivar': 'bolivar',
            'ves': 'bolivar',
            'bs': 'bolivar'
        };
        return mapaMonedas[moneda.toLowerCase()] || moneda.toLowerCase();
    }

    // Método para obtener encabezado del recibo
    getEncabezadoRecibo(): string {
        const sedeInfo = this.userStateService.getSedeActual();

        let encabezado = '';

        if (sedeInfo && sedeInfo.nombre_optica) {
            const nombre = sedeInfo.nombre_optica || 'NEW VISION LENS';
            const direccion = sedeInfo.direccion || 'C.C. Candelaria, Local PB-04, Guarenas';
            const telefono = sedeInfo.telefono || '0212-365-39-42';
            const rif = sedeInfo.rif || 'J-123456789';
            const email = sedeInfo.email || 'newvisionlens2020@gmail.com';

            encabezado = `${nombre}<br>${direccion}<br>Telf.: ${telefono} | Rif: ${rif}<br>Email: ${email}`;
        } else {
            encabezado = 'NEW VISION LENS<br>C.C. Candelaria, Local PB-04, Guarenas<br>Telf.: 0212-365-39-42 | Rif: J-123456789<br>Email: newvisionlens2020@gmail.com';
        }

        return encabezado; // Siempre retorna un string
    }

    // Nuevos métodos
    getPrecioSinIva(producto: any): number {
        return producto.precioConvertido || 0;
    }

    get subtotalConIvaCorregido(): number {
        // Calcula el subtotal CON IVA
        if (!Array.isArray(this.productosConDetalle) || this.productosConDetalle.length === 0) {
            return 0;
        }

        const subtotal = this.productosConDetalle.reduce((acc, producto) => {
            // Usamos precioConIva (que ya incluye IVA si aplica)
            const precioUnitario = producto.precioConIva || 0;
            const cantidad = producto.cantidad || 1;
            return acc + (precioUnitario * cantidad);
        }, 0);

        return this.redondear(subtotal);
    }

    calcularDescuentoSobreBaseImponible(): number {
        // Descuento sobre el subtotal SIN IVA
        const baseImponible = this.subtotalCorregido; // ← SIN IVA
        return this.venta.descuento ? (baseImponible * (this.venta.descuento / 100)) : 0;
    }

    calcularBaseImponibleConDescuento(): number {
        const baseImponible = this.subtotalCorregido;
        const descuento = this.calcularDescuentoSobreBaseImponible();
        return baseImponible - descuento;
    }

    /**
    * Calcula el IVA sobre una base con descuento usando productosConDetalle
    */
    calcularIvaSobreBaseConDescuento(baseConDescuento: number): number {
        if (!Array.isArray(this.productosConDetalle) || this.productosConDetalle.length === 0) {
            return 0;
        }

        // Calcular qué porcentaje del total representa cada producto que aplica IVA
        const subtotalSinIva = this.calcularSubtotalSinIvaGlobal();
        if (subtotalSinIva === 0) return 0;

        let ivaTotal = 0;

        this.productosConDetalle.forEach(producto => {
            if (producto.aplicaIva) {
                // Calcular qué porcentaje representa este producto del total sin IVA
                const precioSinIva = producto.precioConvertido || 0;
                const cantidad = producto.cantidad || 1;
                const subtotalProducto = precioSinIva * cantidad;
                const porcentajeProducto = subtotalProducto / subtotalSinIva;

                // Aplicar ese porcentaje a la base con descuento
                const baseProductoConDescuento = baseConDescuento * porcentajeProducto;
                ivaTotal += baseProductoConDescuento * (this.ivaPorcentaje / 100);
            }
        });

        return this.redondear(ivaTotal);
    }

    calcularIvaTotal(): number {
        if (!Array.isArray(this.productosConDetalle)) return 0;

        return this.productosConDetalle.reduce((acc, producto) => {
            const subtotalSinIva = this.calcularSubtotalSinIvaProducto(producto);
            const aplicaIva = producto.aplicaIva ?? false;

            return aplicaIva ?
                acc + (subtotalSinIva * (this.ivaPorcentaje / 100)) :
                acc;
        }, 0);
    }

    calcularSubtotalSinIvaProducto(producto: any): number {
        const precioSinIva = producto.precioConvertido || 0;
        const cantidad = producto.cantidad || 1;
        return precioSinIva * cantidad;
    }


    calcularSubtotalSinIvaGlobal(): number {
        if (!Array.isArray(this.productosConDetalle) || this.productosConDetalle.length === 0) {
            return 0;
        }

        return this.productosConDetalle.reduce((acc, producto) => {
            const precioSinIva = producto.precioConvertido || 0;
            const cantidad = producto.cantidad || 1;
            return acc + (precioSinIva * cantidad);
        }, 0);
    }

    calcularSubtotalSinIvaPorProductos(productos: ItemCarrito[]): number {
        if (!productos || productos.length === 0) return 0;

        return productos.reduce((acc, p) => {
            const precioSinIva = p.precio || 0;
            const cantidad = p.cantidad || 1;
            return acc + (precioSinIva * cantidad);
        }, 0);
    }

    calcularIvaPorProductoOriginal(producto: any): number {
        if (!producto.aplicaIva) return 0;

        const subtotalSinIva = this.calcularSubtotalSinIvaProducto(producto);
        return subtotalSinIva * (this.ivaPorcentaje / 100);
    }

    calcularTotalIvaOriginal(): number {
        if (!Array.isArray(this.productosConDetalle)) return 0;

        return this.productosConDetalle.reduce((acc, producto) => {
            return acc + this.calcularIvaPorProductoOriginal(producto);
        }, 0);
    }

    calcularDescuento(): number {
        const subtotalSinIva = this.calcularSubtotalSinIvaGlobal();
        const descuentoPorcentaje = this.venta.descuento ?? 0;

        // Descuento sobre subtotal SIN IVA
        return this.redondear(subtotalSinIva * (descuentoPorcentaje / 100));
    }

    calcularProporcionProducto(producto: any): number {
        const subtotalTotalSinIva = this.calcularSubtotalSinIvaGlobal();
        if (subtotalTotalSinIva === 0) return 0;

        const subtotalProducto = this.calcularSubtotalSinIvaProducto(producto);
        return subtotalProducto / subtotalTotalSinIva;
    }

    calcularDescuentoPorProducto(producto: any): number {
        const descuentoTotal = this.calcularDescuento();
        const proporcion = this.calcularProporcionProducto(producto);

        return descuentoTotal * proporcion;
    }

    calcularBaseConDescuentoPorProducto(producto: any): number {
        const subtotalProducto = this.calcularSubtotalSinIvaProducto(producto);
        const descuentoProducto = this.calcularDescuentoPorProducto(producto);

        return subtotalProducto - descuentoProducto;
    }

    calcularIvaDespuesDescuentoPorProducto(producto: any): number {
        if (!producto.aplicaIva) return 0;

        const baseConDescuento = this.calcularBaseConDescuentoPorProducto(producto);
        return baseConDescuento * (this.ivaPorcentaje / 100);
    }

    calcularTotalIvaDespuesDescuento(): number {
        if (!Array.isArray(this.productosConDetalle) || this.productosConDetalle.length === 0) {
            return 0;
        }

        let ivaTotal = 0;

        this.productosConDetalle.forEach(producto => {
            if (producto.aplicaIva) {
                ivaTotal += this.calcularIvaDespuesDescuentoPorProducto(producto);
            }
        });

        return this.redondear(ivaTotal);
    }

    get subtotalCorregido(): number {
        return this.calcularSubtotalSinIvaGlobal();
    }

    get ivaCorregido(): number {
        // Para mostrar en el resumen, usamos el IVA después del descuento
        return this.calcularTotalIvaDespuesDescuento();
    }

    get descuentoCorregido(): number {
        return this.calcularDescuento();
    }

    get baseImponibleConDescuento(): number {
        let total = 0;
        this.productosConDetalle.forEach(producto => {
            total += this.calcularBaseConDescuentoPorProducto(producto);
        });
        return this.redondear(total);
    }

    //Subtotal sin IVA (productos + consulta según corresponda)
    get subtotalSinIva(): number {
        let subtotal = this.calcularSubtotalSinIvaGlobal(); // Productos

        // Para solo consulta, el subtotal es el monto de la consulta
        if (this.tipoVenta === 'solo_consulta' && this.consultaEnCarrito) {
            subtotal = this.montoConsulta;
        }

        // Para consulta + productos, sumamos la consulta al subtotal de productos
        if (this.tipoVenta === 'consulta_productos' && this.consultaEnCarrito) {
            subtotal += this.pagoMedico; // Solo el pago médico
        }

        return this.redondear(subtotal);
    }

    /**
     * Descuento aplicado (solo aplica a productos, no a consulta)
     */
    get descuentoAplicado(): number {
        // El descuento solo aplica a productos, no a consulta
        return this.calcularDescuento();
    }

    /**
     * Subtotal con descuento (productos + consulta)
     */
    get subtotalConDescuento(): number {
        let subtotalConDesc = 0;

        // Productos con descuento
        this.productosConDetalle.forEach(producto => {
            subtotalConDesc += this.calcularBaseConDescuentoPorProducto(producto);
        });

        // Sumar consulta según tipo de venta
        if (this.tipoVenta === 'solo_consulta' && this.consultaEnCarrito) {
            subtotalConDesc += this.montoConsulta;
        }

        if (this.tipoVenta === 'consulta_productos' && this.consultaEnCarrito) {
            subtotalConDesc += this.pagoMedico;
        }

        return this.redondear(subtotalConDesc);
    }

    get ivaCalculado(): number {
        // El IVA solo aplica a productos, no a consulta
        return this.calcularTotalIvaDespuesDescuento();
    }

    get totalPagar(): number {
        let total = this.subtotalConDescuento + this.ivaCalculado;
        return this.redondear(total);
    }

    get montoTotal(): number {
        return this.totalPagar;
    }

    get montoTotalVenta(): number {
        let total = 0;
        // Sumar productos
        for (const item of this.venta.productos) {
            total += (item.precio || 0) * (item.cantidad || 1);
        }
        // Sumar consulta
        if (this.consultaEnCarrito) {
            total += this.montoConsulta || 0;
        }
        return total;
    }

    // === MÉTODOS MEJORADOS PARA EL RESUMEN ===
    get tieneDescuento(): boolean {
        return (this.venta.descuento ?? 0) > 0;
    }

    get porcentajeDescuento(): number {
        return this.venta.descuento ?? 0;
    }

    get resumenLineas(): any[] {
        const lineas = [];

        // Línea 1: Subtotal
        lineas.push({
            label: 'Subtotal (sin IVA)',
            value: this.formatearMoneda(this.subtotalSinIva, this.venta.moneda),
            tipo: 'subtotal',
            icono: 'bi-cart'
        });

        // Línea 2: Descuento (solo si hay)
        if (this.tieneDescuento) {
            lineas.push({
                label: `Descuento (${this.porcentajeDescuento}%)`,
                value: `-${this.formatearMoneda(this.descuentoAplicado, this.venta.moneda)}`,
                tipo: 'descuento',
                icono: 'bi-tag'
            });

            // Línea 3: Subtotal con descuento (solo si hay descuento)
            lineas.push({
                label: 'Subtotal con descuento',
                value: this.formatearMoneda(this.subtotalConDescuento, this.venta.moneda),
                tipo: 'subtotal-descuento',
                icono: 'bi-calculator'
            });
        }

        // Línea 4: IVA
        lineas.push({
            label: `IVA (${this.ivaPorcentaje}%)`,
            value: this.formatearMoneda(this.ivaCalculado, this.venta.moneda),
            tipo: 'iva',
            icono: 'bi-percent'
        });

        // Línea 5: Total
        lineas.push({
            label: 'Total a pagar',
            value: this.formatearMoneda(this.totalPagar, this.venta.moneda),
            tipo: 'total',
            icono: 'bi-cash-stack'
        });

        return lineas;
    }

    // Método para cargar información de empresa referida si aplica
    cargarInfoEmpresaReferida(paciente: Paciente): void {
        if (paciente?.informacionEmpresa?.referidoEmpresa) {
            this.empresaReferidaInfo = {
                referidoEmpresa: paciente.informacionEmpresa.referidoEmpresa,
                nombre: paciente.informacionEmpresa.empresaNombre,
                rif: paciente.informacionEmpresa.empresaRif,
                telefono: paciente.informacionEmpresa.empresaTelefono,
                direccion: paciente.informacionEmpresa.empresaDireccion,
                email: paciente.informacionEmpresa.empresaCorreo
            };

            // Activar el uso de empresa por defecto si tiene empresa referida
            this.usarEmpresaEnVenta = true;

        } else {
            this.empresaReferidaInfo = null;
            this.usarEmpresaEnVenta = false;
        }
    }



    // Método para mostrar/ocultar info de empresa
    toggleEmpresaInfo(): void {
        this.mostrarInfoEmpresa = !this.mostrarInfoEmpresa;
    }

    // Método para verificar si tiene empresa referida
    tieneEmpresaReferida(): boolean {
        if (!this.pacienteSeleccionado) return false;

        return this.pacienteSeleccionado.informacionEmpresa?.referidoEmpresa === true &&
            !!this.pacienteSeleccionado.informacionEmpresa?.empresaNombre;
    }

    // Métodos para obtener información de empresa referida
    obtenerNombreEmpresa(): string {
        return this.pacienteSeleccionado?.informacionEmpresa?.empresaNombre || '';
    }

    obtenerRifEmpresa(): string {
        return this.pacienteSeleccionado?.informacionEmpresa?.empresaRif || '';
    }

    obtenerDireccionEmpresa(): string {
        return this.pacienteSeleccionado?.informacionEmpresa?.empresaDireccion || '';
    }

    obtenerTelefonoEmpresa(): string {
        return this.pacienteSeleccionado?.informacionEmpresa?.empresaTelefono || '';
    }

    obtenerEmailEmpresa(): string {
        return this.pacienteSeleccionado?.informacionEmpresa?.empresaCorreo || '';
    }

    // Método para copiar datos al portapapeles
    copiarDato(texto: string, tipo: string): void {
        if (!texto) return;

        navigator.clipboard.writeText(texto).then(() => {
            this.snackBar.open(`${tipo} copiado al portapapeles`, 'Cerrar', {
                duration: 2000,
                panelClass: ['snackbar-success']
            });
        });
    }

    calcularEdad(fechaNacimiento: string): number {
        if (!fechaNacimiento) return 0;

        try {
            const hoy = new Date();
            const nacimiento = new Date(fechaNacimiento);

            if (isNaN(nacimiento.getTime())) return 0;

            let edad = hoy.getFullYear() - nacimiento.getFullYear();
            const mes = hoy.getMonth() - nacimiento.getMonth();

            if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
                edad--;
            }

            return edad;
        } catch (error) {
            console.error('Error calculando edad:', error);
            return 0;
        }
    }

    // Métodos para verificar y obtener info de empresa (iguales que para paciente)
    tieneEmpresaReferidaCliente(): boolean {
        return this.clienteEsReferido &&
            (!!this.clienteEmpresaReferida.nombre.trim() ||
                !!this.clienteEmpresaReferida.rif.trim());
    }

    obtenerNombreEmpresaReferidaCliente(): string {
        return this.clienteEmpresaReferida.nombre || '';
    }

    obtenerRifEmpresaReferidaCliente(): string {
        return this.clienteEmpresaReferida.rif || '';
    }

    obtenerDireccionEmpresaReferidaCliente(): string {
        return this.clienteEmpresaReferida.direccion || '';
    }

    obtenerTelefonoEmpresaReferidaCliente(): string {
        return this.clienteEmpresaReferida.telefono || '';
    }

    obtenerEmailEmpresaReferidaCliente(): string {
        return this.clienteEmpresaReferida.email || '';
    }

    // Limpiar datos de empresa
    limpiarEmpresaReferidaCliente(): void {
        this.clienteEmpresaReferida = {
            nombre: '',
            rif: '',
            telefono: '',
            email: '',
            direccion: ''
        };
        this.mostrarInfoEmpresa = false;
    }


    private agregarConsultaSinCosto(historia: any): void {
        const tipo = this.determinarTipoHistoria(historia);
        const esOftalmologo = historia.tipoProfesional === 'oftalmologo';
        const pagoPendiente = historia.datosConsulta?.pagoPendiente === true;

        this.pagoMedico = 0;
        this.pagoOptica = 0;
        this.montoConsulta = 0;
        this.montoConsultaOriginal = 0;
        this.consultaEnCarrito = true;

        this.cdr.detectChanges();

        let mensaje = '';
        if (esOftalmologo && !pagoPendiente) {
            mensaje = '✅ Consulta agregada (ya pagada anteriormente)';
        } else if (historia.formulaExterna && historia.tipoProfesional === 'oftalmologo' && !pagoPendiente) {
            mensaje = '✅ Rectificación externa agregada (pagada anteriormente)';
        } else if (historia.formulaExterna && !historia.tipoProfesional) {
            mensaje = '✅ Fórmula externa agregada (sin costo)';
        } else if (historia.tipoProfesional === 'optometrista') {
            mensaje = '✅ Consulta de optometrista agregada (sin costo)';
        } else if (tipo === 'externa_rectificada_oftalmologo' && !pagoPendiente) {
            mensaje = '✅ Rectificación externa agregada (pagada)';
        } else {
            mensaje = '✅ Historia seleccionada (sin costo)';
        }

        this.snackBar.open(mensaje, 'Cerrar', {
            duration: 2000,
            panelClass: ['snackbar-info']
        });
    }

    agregarConsultaAlCarrito(): void {
        if (!this.historiaMedicaSeleccionada) {
            console.log('❌ No hay historia seleccionada');
            return;
        }

        // Verificar si ya existe
        if (this.consultaEnCarrito) {
            console.log('⚠️ Ya hay una consulta en el carrito');
            return;
        }

        const historia = this.historiaMedicaSeleccionada;
        const especialista = historia.datosConsulta?.especialista;
        const esOftalmologo = especialista?.tipo === 'OFTALMOLOGO';
        const pagoPendiente = historia.datosConsulta?.pagoPendiente === true;
        const formulaExterna = historia.datosConsulta?.formulaExterna === true;
        const tieneFormulaOriginal = !!historia.datosConsulta?.formulaOriginal?.medicoOrigen?.nombre;

        // Determinar si genera ingreso
        let generaIngreso = false;

        if (this.tipoVenta === 'solo_consulta') {
            // Solo se genera ingreso si:
            // 1. Es oftalmólogo interno con pago pendiente
            // 2. Es externa rectificada por oftalmólogo con pago pendiente
            generaIngreso = (esOftalmologo && pagoPendiente && !formulaExterna) ||
                (formulaExterna && tieneFormulaOriginal && esOftalmologo && pagoPendiente);
        } else {
            // Para consulta + productos, solo genera ingreso si:
            // 1. Es oftalmólogo interno con pago pendiente
            // 2. Es externa rectificada por oftalmólogo con pago pendiente
            // (solo el costo médico)
            generaIngreso = (esOftalmologo && pagoPendiente && !formulaExterna) ||
                (formulaExterna && tieneFormulaOriginal && esOftalmologo && pagoPendiente);
        }

        if (generaIngreso) {
            // Obtener costos reales del backend
            this.generarVentaService.getCostosConsulta(historia.id).pipe(take(1)).subscribe({
                next: (costos) => {
                    console.log('💰 Costos recibidos:', costos);

                    const totalConsulta = parseFloat(costos.totalConsulta) || 0;
                    const costoMedico = parseFloat(costos.costoMedico) || 0;
                    const costoOptica = parseFloat(costos.costoOptica) || 0;

                    // Asignar valores según el tipo de venta
                    if (this.tipoVenta === 'solo_consulta') {
                        this.pagoMedico = costoMedico;
                        this.pagoOptica = costoOptica;
                        this.montoConsulta = totalConsulta;
                    } else {
                        // Para consulta + productos, solo el costo médico
                        this.pagoMedico = costoMedico;
                        this.pagoOptica = 0;
                        this.montoConsulta = costoMedico;
                    }

                    this.montoConsultaOriginal = totalConsulta;
                    this.consultaEnCarrito = true;

                    console.log('✅ Valores asignados:', {
                        pagoMedico: this.pagoMedico,
                        pagoOptica: this.pagoOptica,
                        montoConsulta: this.montoConsulta
                    });

                    this.cdr.detectChanges();

                    this.snackBar.open('✅ Consulta agregada al carrito', 'Cerrar', {
                        duration: 3000,
                        panelClass: ['snackbar-success']
                    });
                },
                error: (error) => {
                    console.error('❌ Error al obtener costos:', error);
                    this.agregarConsultaSinCosto(historia);
                }
            });
        } else {
            // No genera ingreso
            this.agregarConsultaSinCosto(historia);
        }
    }

    // Para saber si mostrar el campo de monto de consulta
    get mostrarMontoConsulta(): boolean {
        return this.tipoVenta !== 'solo_productos' &&
            !!this.historiaMedicaSeleccionada;
    }

    // Para saber qué formas de pago mostrar
    get formasPagoDisponibles(): any[] {
        if (this.tipoVenta === 'solo_consulta') {
            // Solo consulta: contado y cashea
            return [
                { value: 'contado', label: 'Contado' },
                { value: 'cashea', label: 'Cashea' }
            ];
        } else {
            // Otros tipos: todas
            return [
                { value: 'contado', label: 'Contado' },
                { value: 'abono', label: 'Abono' },
                { value: 'cashea', label: 'Cashea' },
                { value: 'de_contado-pendiente', label: 'Pendiente' }
            ];
        }
    }

    // Para saber si mostrar el resumen
    get puedeMostrarResumen(): boolean {
        switch (this.tipoVenta) {
            case 'solo_productos':
                return this.venta.productos.length > 0;

            case 'solo_consulta':
                return this.consultaEnCarrito;

            case 'consulta_productos':
                return this.consultaEnCarrito || this.venta.productos.length > 0;

            default:
                return false;
        }
    }

    // Para el tooltip del botón generar
    getMensajeTooltipBotonGenerar(): string {
        switch (this.tipoVenta) {
            case 'solo_productos':
                return this.venta.productos.length === 0
                    ? 'Agrega al menos un producto'
                    : 'Generar venta';

            case 'solo_consulta':
                if (!this.pacienteSeleccionado) return 'Selecciona un paciente';
                if (!this.historiaMedicaSeleccionada) return 'Selecciona una historia';
                if (!this.consultaEnCarrito) return 'Agrega la consulta al carrito';
                return 'Generar venta';

            case 'consulta_productos':
                if (!this.pacienteSeleccionado) return 'Selecciona un paciente';
                if (!this.historiaMedicaSeleccionada) return 'Selecciona una historia';
                if (!this.consultaEnCarrito && this.venta.productos.length === 0) {
                    return 'Agrega consulta o productos';
                }
                return 'Generar venta';

            default:
                return 'Generar venta';
        }
    }

    get otrasHistorias(): any[] {
        if (!this.historiasMedicas || !this.historiaMedicaSeleccionada) {
            return this.historiasMedicas || [];
        }
        return this.historiasMedicas.filter(h =>
            h.id !== this.historiaMedicaSeleccionada.id
        );
    }

    limpiarCarrito(): void {
        this.venta.productos = [];
        this.consultaEnCarrito = false;
        this.actualizarProductosConDetalle();
    }

    // Actualiza eliminarItem
    eliminarItem(item: ItemCarrito): void {
        if (item.tipo === 'CONSULTA') {
            this.consultaEnCarrito = false;
        }
        this.venta.productos = this.venta.productos.filter(p => p.id !== item.id);
        this.actualizarProductosConDetalle();
    }

    // Actualiza aumentarCantidad
    aumentarCantidad(item: ItemCarrito): void {
        if (item.tipo === 'CONSULTA') return; // No aumentar cantidad de consultas

        const producto = this.venta.productos.find(p => p.id === item.id) as ItemCarrito;
        if (producto && producto.cantidad < (producto.stock || 999)) {
            producto.cantidad = (producto.cantidad || 1) + 1;
            this.actualizarProductosConDetalle();
        }
    }

    // Actualiza disminuirCantidad
    disminuirCantidad(item: ItemCarrito): void {
        if (item.tipo === 'CONSULTA') return; // No disminuir cantidad de consultas

        const producto = this.venta.productos.find(p => p.id === item.id) as ItemCarrito;
        if (producto && (producto.cantidad || 1) > 1) {
            producto.cantidad = (producto.cantidad || 1) - 1;
            this.actualizarProductosConDetalle();
        }
    }

    trackByItem(index: number, item: any): string {
        return item.id || index.toString();
    }

    getIconoCategoria(producto: any): string {
        if (!producto) return 'bi-box';

        const nombre = (producto.nombre || '').toLowerCase();
        const categoria = (producto.categoria || '').toLowerCase();

        if (nombre.includes('lente') || categoria.includes('lente')) return 'bi-eyeglasses';
        if (nombre.includes('montura') || categoria.includes('montura')) return 'bi-bag';
        if (nombre.includes('accesorio') || categoria.includes('accesorio')) return 'bi-stopwatch';
        if (nombre.includes('contacto') || categoria.includes('contacto')) return 'bi-eye';

        return 'bi-box';
    }


    get pasoPacienteCompletado(): boolean {
        return this.tipoVenta === 'solo_productos' || !!this.pacienteSeleccionado;
    }

    get pasoHistoriaCompletado(): boolean {
        if (this.tipoVenta === 'solo_productos') return true;
        return !!this.historiaMedicaSeleccionada;
    }

    get pasoProductosCompletado(): boolean {
        if (this.tipoVenta === 'solo_consulta') {
            return this.consultaEnCarrito;
        }
        return this.venta.productos.length > 0;
    }

    seleccionarTipoVenta(tipo: 'solo_consulta' | 'consulta_productos' | 'solo_productos'): void {
        const pacienteActual = this.pacienteSeleccionado;

        // RESETEAR TODO EL ESTADO DEL MODAL
        this.resetearEstadoModal();

        // Actualizar tipo
        this.tipoVenta = tipo;
        this.intentoGenerar = false;

        // LIMPIAR CARRITO Y SELECCIÓN DE HISTORIA
        this.limpiarCarritoCompleto();

        // Limpiar selección de historia
        this.historiaSeleccionadaId = null;
        this.historiaMedicaSeleccionada = null;
        this.historiaMedica = null;
        this.montoConsulta = 0;
        this.montoConsultaOriginal = 0;
        this.pagoMedico = 0;
        this.pagoOptica = 0;
        this.consultaEnCarrito = false;

        // Limpiar métodos de pago
        this.venta.metodosDePago = [];

        // Resetear descuento
        this.venta.descuento = 0;

        // Resetear forma de pago a contado (valor por defecto)
        this.venta.formaPago = 'contado';

        // Resetear moneda
        this.venta.moneda = this.normalizarMonedaParaVenta(this.monedaSistema);

        // Resetear abono
        this.venta.montoAbonado = 0;
        this.valorTemporal = '';
        this.montoExcedido = false;

        // Resetear cashea
        this.venta.montoInicial = 0;
        this.valorInicialTemporal = '';
        this.cuotasCashea = [];
        this.resumenCashea = { cantidad: 0, total: 0, totalBs: 0 };
        this.nivelCashea = 'nivel3';
        this.cantidadCuotasCashea = 3;

        // LIMPIAR DATOS DEL CLIENTE PARA SOLO PRODUCTOS
        if (tipo === 'solo_productos') {
            this.pacienteSeleccionado = null;
            this.historiasMedicas = [];

            // Limpiar cliente sin paciente
            this.clienteSinPaciente = {
                tipoPersona: 'natural',
                nombreCompleto: '',
                cedula: '',
                telefono: '',
                email: ''
            };

            // Limpiar validación de cliente
            this.validandoCliente = false;
            this.clienteEncontrado = false;
            this.mensajeValidacionCliente = '';
            this.cedulaAnterior = '';
            this.validacionIntentada = false;
            this.editandoManual = false;

            // Limpiar empresa referida
            this.empresaReferidaInfo = null;
            this.usarEmpresaEnVenta = false;
            this.mostrarInfoEmpresa = false;
            this.limpiarEmpresaReferidaCliente();
        } else {
            // Para otros tipos, restaurar el paciente si existía
            this.pacienteSeleccionado = pacienteActual;

            // Si hay paciente, usar onPacienteSeleccionado para recargar historias
            if (this.pacienteSeleccionado) {
                this.onPacienteSeleccionado(this.pacienteSeleccionado);
            }
        }

        // Actualizar cálculos
        this.actualizarProductosConDetalle();

        // Forzar detección de cambios
        this.cdr.detectChanges();
    }

    get productosFiltradosPorCategoria(): ProductoBusquedaOption[] {
        return this.productosBusquedaDisponibles;
    }

    get requierePaciente(): boolean {
        return this.tipoVenta !== 'solo_productos';
    }

    get esSoloConsulta(): boolean {
        return this.tipoVenta === 'solo_consulta';
    }

    get esConsultaProductos(): boolean {
        return this.tipoVenta === 'consulta_productos';
    }

    get esSoloProductos(): boolean {
        return this.tipoVenta === 'solo_productos';
    }

    getHistoriaMarkerClass(): string {
        return this.getHistoriaMarkerClassForHistoria(this.historiaMedicaSeleccionada);
    }

    getHistoriaIcon(): string {
        return this.getHistoriaIconForHistoria(this.historiaMedicaSeleccionada);
    }

    getHistoriaTagText(): string {
        return this.getHistoriaTagTextForHistoria(this.historiaMedicaSeleccionada);
    }

    getHistoriaTagClass(): string {
        return this.getHistoriaTagClassForHistoria(this.historiaMedicaSeleccionada);
    }

    getHistoriaMarkerClassForHistoria(historia: any): string {
        if (!historia || !historia.data) return '';

        const fact = historia.data.datosConsulta?.facturacion;
        const formulaExterna = historia.data.datosConsulta?.formulaExterna;

        if (formulaExterna) return 'marker-externa';
        if (fact?.tipoProfesional === 'oftalmologo') return 'marker-oftalmologo';
        if (fact?.tipoProfesional === 'optometrista') return 'marker-optometrista';
        return 'marker-default';
    }

    getHistoriaIconForHistoria(historia: any): string {
        if (!historia || !historia.data) return 'bi-clock';

        const formulaExterna = historia.data.datosConsulta?.formulaExterna;
        const tipoProfesional = historia.data.datosConsulta?.facturacion?.tipoProfesional;

        if (formulaExterna) return 'bi-box-arrow-up-right';
        if (tipoProfesional === 'oftalmologo') return 'bi-person-badge';
        if (tipoProfesional === 'optometrista') return 'bi-person';
        return 'bi-clock';
    }

    getHistoriaTagTextForHistoria(historia: any): string {
        const h = historia?.data || historia;
        if (!h) return '';

        const formulaExterna = h.datosConsulta?.formulaExterna;
        const tipoProfesional = h.datosConsulta?.medico?.cargo;

        if (formulaExterna) return '🔷 Fórmula externa';
        if (tipoProfesional === 'Oftalmólogo') return '👁️ Oftalmólogo';
        if (tipoProfesional === 'Optometrista') return '👓 Optometrista';
        return '📋 Historia';
    }

    getHistoriaTagClassForHistoria(historia: any): string {
        const h = historia?.data || historia;
        if (!h) return '';

        const formulaExterna = h.datosConsulta?.formulaExterna;
        const tipoProfesional = h.datosConsulta?.medico?.cargo;

        if (formulaExterna) return 'tag-externa';
        if (tipoProfesional === 'Oftalmólogo') return 'tag-oftalmologo';
        if (tipoProfesional === 'Optometrista') return 'tag-optometrista';
        return 'tag-default';
    }

    crearPacienteRapido(): void {
        // Opción 1: Abrir en nueva pestaña 
        const url = '/pacientes?abrirModal=nuevo';
        window.open(url, '_blank');

        this.snackBar.open('Serás redirigido para crear un nuevo paciente', 'Cerrar', {
            duration: 3000
        });
    }

    buscarPacientes(): void {
        this.mostrarResultadosPacientes = this.textoBusquedaPaciente.trim().length >= 3;

        // Forzar detección de cambios y re-posicionamiento
        this.cdr.detectChanges();

        // Asegurar que los resultados sean visibles
        setTimeout(() => {
            const results = document.querySelector('.modern-search-results');
            if (results) {
                results.setAttribute('style', 'display: block !important; opacity: 1 !important; visibility: visible !important;');
            }
        }, 50);
    }

    // Método para cerrar resultados al hacer clic fuera
    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        const searchContainer = document.querySelector('.buscador-moderno');
        const results = document.querySelector('.modern-search-results');

        if (searchContainer && !searchContainer.contains(event.target as Node) && results) {
            this.mostrarResultadosPacientes = false;
            this.cdr.detectChanges();
        }
    }

    seleccionarPaciente(paciente: any): void {
        this.pacienteSeleccionado = paciente;
        this.mostrarResultadosPacientes = false;
        this.mostrandoBusqueda = false; // Ocultar buscador, mostrar tarjeta
        this.textoBusquedaPaciente = '';
        this.onPacienteSeleccionado(paciente);
        this.cdr.detectChanges();
    }

    buscarHistorias(): void {
        this.cdr.detectChanges();
    }

    get pacientesFiltrados(): any[] {
        if (!this.textoBusquedaPaciente || this.textoBusquedaPaciente.trim().length < 3) {
            return [];
        }

        const filtro = this.textoBusquedaPaciente.toLowerCase().trim();
        return this.todosLosPacientes.filter(p => {
            const nombre = (p.informacionPersonal?.nombreCompleto || '').toLowerCase();
            const cedula = (p.informacionPersonal?.cedula || '').toLowerCase();
            const email = (p.informacionPersonal?.email || '').toLowerCase();

            return nombre.includes(filtro) || cedula.includes(filtro) || email.includes(filtro);
        }).slice(0, 10); // Limitar a 10 resultados
    }

    recargarPacientes(): void {
        this.pacientesService.getPacientes().pipe(take(1)).subscribe({
            next: (response) => {
                this.todosLosPacientes = response.pacientes || [];
                this.pacientesFiltradosPorSede = this.todosLosPacientes;

                this.snackBar.open('Lista de pacientes actualizada', 'Cerrar', {
                    duration: 2000,
                    panelClass: ['snackbar-success']
                });

                // Si estaba buscando, actualizar resultados
                if (this.textoBusquedaPaciente) {
                    this.buscarPacientes();
                }

                this.cdr.detectChanges();
            },
            error: (error) => {
                console.error('Error recargando pacientes:', error);
                this.snackBar.open('Error al actualizar pacientes', 'Cerrar', {
                    duration: 3000,
                    panelClass: ['snackbar-error']
                });
            }
        });
    }

    esConsultaCobrable(historia?: any): boolean {
        const h = historia || this.historiaMedicaSeleccionada;
        if (!h) {
            console.log('No hay historia');
            return false;
        }

        // Verificar que sea oftalmólogo y no externa
        const esOftalmologo = h.datosConsulta?.medico?.cargo === 'Oftalmólogo';
        const esExterna = h.datosConsulta?.formulaExterna === true;

        if (esExterna) {
            console.log('Es fórmula externa');
            return false;
        }

        if (!esOftalmologo) {
            console.log('No es oftalmólogo');
            return false;
        }

        // Verificar pago pendiente
        const pagoPendiente = h.datosConsulta?.pagoPendiente === true;
        if (!pagoPendiente) {
            console.log('No tiene pago pendiente');
            return false;
        }

        return true;
    }

    getMensajeConsulta(historia?: any): string {
        const h = historia || this.historiaMedicaSeleccionada;
        if (!h) return '';

        // 🔴 Acceder correctamente a la estructura
        const datosConsulta = h.datosConsulta || h.data?.datosConsulta;
        const especialista = datosConsulta?.especialista;

        const esOftalmologo = especialista?.tipo === 'OFTALMOLOGO';
        const esOptometrista = especialista?.tipo === 'OPTOMETRISTA';
        const esExterno = especialista?.tipo === 'EXTERNO';
        const pagoPendiente = datosConsulta?.pagoPendiente === true;
        const formulaExterna = datosConsulta?.formulaExterna === true;
        const tieneFormulaOriginal = !!datosConsulta?.formulaOriginal?.medicoOrigen?.nombre;

        // Oftalmólogo interno
        if (esOftalmologo && !formulaExterna) {
            return pagoPendiente ? 'Pendiente de pago' : 'Pagada';
        }

        // Optometrista interno
        if (esOptometrista && !formulaExterna) {
            return 'Sin costo';
        }

        // Fórmula externa sin rectificar
        if (formulaExterna && !tieneFormulaOriginal && !esOftalmologo && !esOptometrista) {
            return 'Sin costo';
        }

        // Externa rectificada por oftalmólogo
        if (formulaExterna && tieneFormulaOriginal && esOftalmologo) {
            return pagoPendiente ? 'Rectificación externa (pendiente)' : 'Rectificación externa (pagada)';
        }

        // Externa rectificada por optometrista
        if (formulaExterna && tieneFormulaOriginal && esOptometrista) {
            return 'Rectificación externa (sin costo)';
        }

        // Médico externo puro
        if (esExterno) {
            return 'Fórmula externa';
        }

        return '';
    }

    onHistoriaSeleccionada(event: any): void {
        if (!event) {
            this.historiaMedicaSeleccionada = null;
            return;
        }

        // Asignar la historia seleccionada (viene como objeto completo)
        this.historiaMedicaSeleccionada = event;
        this.historiaMedica = event;

        this.cdr.detectChanges();
    }

    get totalHistoriasSegunTipo(): number {
        if (this.tipoVenta === 'solo_consulta') {
            // Solo contar historias de oftalmólogo (internas y externas rectificadas)
            return this.historiasMedicas.filter(h => {
                const datosConsulta = h.datosConsulta || h.data?.datosConsulta;
                const especialista = datosConsulta?.especialista;
                const esOftalmologo = especialista?.tipo === 'OFTALMOLOGO';
                const formulaExterna = datosConsulta?.formulaExterna === true;
                const tieneFormulaOriginal = !!datosConsulta?.formulaOriginal?.medicoOrigen?.nombre;

                // Oftalmólogo interno o externa rectificada por oftalmólogo
                return (esOftalmologo && !formulaExterna) ||
                    (formulaExterna && tieneFormulaOriginal && esOftalmologo);
            }).length;
        }
        return this.historiasMedicas.length;
    }

    get historiasOftalmologoNoExternas(): any[] {
        if (!this.historiasMedicas || this.historiasMedicas.length === 0) {
            return [];
        }

        return this.historiasMedicas.filter(h => {
            const datosConsulta = h.datosConsulta || h.data?.datosConsulta;
            const especialista = datosConsulta?.especialista;
            const esOftalmologo = especialista?.tipo === 'OFTALMOLOGO';
            const formulaExterna = datosConsulta?.formulaExterna === true;
            const tieneFormulaOriginal = !!datosConsulta?.formulaOriginal?.medicoOrigen?.nombre;

            // Incluye:
            // 1. Oftalmólogo interno
            // 2. Fórmula externa rectificada por oftalmólogo
            return (esOftalmologo && !formulaExterna) ||
                (formulaExterna && tieneFormulaOriginal && esOftalmologo);
        });
    }

    get historiasFiltradas(): any[] {
        if (!this.historiasMedicas || this.historiasMedicas.length === 0) {
            return [];
        }

        // PASO 1: Filtrar por tipo de venta
        let historiasBase: any[];

        if (this.tipoVenta === 'solo_consulta') {
            // Solo consulta: SOLO historias que generan cobro
            historiasBase = this.historiasMedicas.filter(h => {
                const datosConsulta = h.datosConsulta || h.data?.datosConsulta;
                const especialista = datosConsulta?.especialista;
                const esOftalmologo = especialista?.tipo === 'OFTALMOLOGO';
                const formulaExterna = datosConsulta?.formulaExterna === true;
                const tieneFormulaOriginal = !!datosConsulta?.formulaOriginal?.medicoOrigen?.nombre;
                const pagoPendiente = datosConsulta?.pagoPendiente === true;

                // CASO 1: Oftalmólogo interno (propia consulta)
                if (esOftalmologo && !formulaExterna) {
                    return true; // Mostrar siempre, tanto pendiente como pagada
                }

                // CASO 2: Fórmula externa rectificada por oftalmólogo
                if (formulaExterna && tieneFormulaOriginal && esOftalmologo) {
                    return true; // Mostrar siempre, tanto pendiente como pagada
                }

                // NO mostrar:
                // - Optometristas
                // - Fórmulas externas puras
                // - Rectificaciones por optometrista
                return false;
            });

            console.log('Historias para solo consulta:', historiasBase.length);
            historiasBase.forEach(h => {
                const especialista = h.datosConsulta?.especialista;
                console.log(`- ${h.nHistoria}: ${especialista?.tipo}, formulaExterna: ${h.formulaExterna}`);
            });

        } else {
            // Consulta + productos: TODAS las historias
            historiasBase = this.historiasMedicas;
        }

        // PASO 2: Si no hay filtro de texto, devolver base
        if (!this.filtroHistoriasTexto || this.filtroHistoriasTexto.trim() === '') {
            return historiasBase;
        }

        // PASO 3: Aplicar filtro de búsqueda
        const filtro = this.filtroHistoriasTexto.toLowerCase().trim();

        return historiasBase.filter(h => {
            const nHistoria = (h.nHistoria || '').toLowerCase();
            const medico = (h.datosConsulta?.medico?.nombre || '').toLowerCase();
            const fecha = new Date(h.auditoria?.fechaCreacion).toLocaleDateString().toLowerCase();

            return nHistoria.includes(filtro) ||
                medico.includes(filtro) ||
                fecha.includes(filtro);
        });
    }

    getTituloHistoria(historia: any): string {
        if (historia.formulaExterna) {
            return 'Fórmula externa - No genera cobro';
        }

        if (historia.tipoProfesional === 'oftalmologo') {
            const estado = historia.datosConsulta?.pagoPendiente === true ? 'Pendiente' : 'Pagada';
            return `Consulta de oftalmólogo - ${estado}`;
        }

        if (historia.tipoProfesional === 'optometrista') {
            return 'Consulta de optometrista - Sin costo';
        }

        return 'Historia clínica';
    }

    esHistoriaSeleccionable(historia: any): boolean {
        if (this.tipoVenta === 'solo_consulta') {
            return historia.tipoProfesional === 'oftalmologo' && !historia.formulaExterna;
        }
        return true;
    }

    private actualizarHistoriaSeleccionada(historia: any): void {
        this.historiaSeleccionadaId = historia.id;
        this.historiaMedicaSeleccionada = historia;
        this.cdr.detectChanges();

    }

    limpiarFiltro(): void {
        this.filtroHistoriasTexto = '';
        this.cdr.detectChanges();

        setTimeout(() => {
            const input = document.querySelector('.minimal-search-input') as HTMLInputElement;
            if (input) {
                input.focus();
            }
        }, 50);
    }

    get historiasPaginadas(): any[] {
        const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
        const fin = inicio + this.itemsPorPagina;
        return this.historiasFiltradas.slice(inicio, fin);
    }

    get totalPaginas(): number {
        return Math.ceil(this.historiasFiltradas.length / this.itemsPorPagina);
    }

    cambiarPagina(nuevaPagina: number): void {
        if (nuevaPagina >= 1 && nuevaPagina <= this.totalPaginas) {
            this.paginaActual = nuevaPagina;
            // Scroll al inicio del contenedor
            setTimeout(() => {
                const container = document.querySelector('.historias-scroll-container');
                if (container) {
                    container.scrollTop = 0;
                }
            }, 50);
        }
    }

    filtrarHistorias(): void {
        this.paginaActual = 1;
        this.cdr.detectChanges();
    }

    get carritoTotalmenteVacio(): boolean {
        // No hay productos Y no hay consulta
        return this.venta.productos.length === 0 && !this.consultaEnCarrito;
    }

    // Actualizar total de consulta cuando cambian médico u óptica
    actualizarTotalConsulta(): void {
        this.montoConsulta = (this.pagoMedico || 0) + (this.pagoOptica || 0);
        this.cdr.detectChanges();
    }

    // Verificar si la consulta ya está agregada
    consultaYaAgregada(): boolean {
        return this.consultaEnCarrito;
    }

    // Obtener nombre del médico
    obtenerNombreMedico(historia: any) {
        if (!historia) return 'No especificado';

        // Intentar obtener de la nueva estructura
        if (historia.datosConsulta?.especialista) {
            const esp = historia.datosConsulta.especialista;
            if (esp.tipo === 'EXTERNO' && esp.externo) {
                return esp.externo.nombre || 'Médico Externo';
            } else if (esp.tipo !== 'EXTERNO') {
                return esp.nombre || 'No especificado';
            }
        }
    }

    // Total de items visuales
    get totalItemsVisual(): number {
        let total = this.venta.productos.length;
        if (this.consultaEnCarrito) {
            total += 1;
        }
        return total;
    }

    // Texto del resumen según el tipo de venta
    get textoResumen(): string {
        if (this.tipoVenta === 'solo_consulta') {
            return 'Total consulta:';
        }
        if (this.tipoVenta === 'consulta_productos') {
            if (this.consultaEnCarrito && this.venta.productos.length > 0) {
                return 'Total (consulta + productos):';
            } else if (this.consultaEnCarrito) {
                return 'Total consulta:';
            } else {
                return 'Total productos:';
            }
        }
        return 'Total:';
    }

    get pasoItemsCompletado(): boolean {
        if (this.tipoVenta === 'solo_consulta') {
            return this.consultaEnCarrito;
        }
        if (this.tipoVenta === 'consulta_productos') {
            return this.consultaEnCarrito || this.venta.productos.length > 0;
        }
        return this.venta.productos.length > 0;
    }

    limpiarCarritoCompleto(): void {
        if (this.tipoVenta === 'solo_consulta') {
            // Solo consulta: limpiar consulta
            this.limpiarConsulta();
        } else if (this.tipoVenta === 'consulta_productos') {
            // Consulta + productos: limpiar todo
            this.limpiarConsulta();
            this.venta.productos = [];
        } else {
            // Solo productos: limpiar productos
            this.venta.productos = [];
        }

        this.actualizarProductosConDetalle();
    }

    private limpiarConsulta(): void {
        this.consultaEnCarrito = false;
        this.montoConsulta = 0;
        this.montoConsultaOriginal = 0;
        this.pagoMedico = 0;
        this.pagoOptica = 0;
    }

    // Método para validar que los datos del cliente estén completos en solo productos
    private validarClienteSoloProductos(): boolean {
        if (this.tipoVenta !== 'solo_productos') return true;

        const cliente = this.clienteSinPaciente;

        // Validar que todos los campos requeridos estén llenos
        const nombreValido = cliente.nombreCompleto && cliente.nombreCompleto.trim() !== '';
        const cedulaValida = cliente.cedula && cliente.cedula.trim() !== '';
        const telefonoValido = cliente.telefono && cliente.telefono.trim() !== '';

        return nombreValido && cedulaValida && telefonoValido;
    }


    // Método para determinar el tipo de historia
    determinarTipoHistoria(historia: any): TipoHistoria {
        if (!historia) return 'oftalmologo_pendiente';

        // 🔴 Acceder correctamente a la estructura
        const datosConsulta = historia.datosConsulta || historia.data?.datosConsulta;
        const especialista = datosConsulta?.especialista;

        const esOftalmologo = especialista?.tipo === 'OFTALMOLOGO';
        const esOptometrista = especialista?.tipo === 'OPTOMETRISTA';
        const esExterno = especialista?.tipo === 'EXTERNO';
        const pagoPendiente = datosConsulta?.pagoPendiente === true;
        const formulaExterna = datosConsulta?.formulaExterna === true;
        const tieneFormulaOriginal = !!datosConsulta?.formulaOriginal?.medicoOrigen?.nombre;

        console.log('Determinando tipo:', {
            especialistaTipo: especialista?.tipo,
            esOftalmologo,
            esOptometrista,
            esExterno,
            pagoPendiente,
            formulaExterna,
            tieneFormulaOriginal
        });

        // Caso 1: Oftalmólogo interno (no externa)
        if (esOftalmologo && !formulaExterna) {
            return pagoPendiente ? 'oftalmologo_pendiente' : 'oftalmologo_pagado';
        }

        // Caso 2: Optometrista interno (no externa)
        if (esOptometrista && !formulaExterna) {
            return 'optometrista';
        }

        // Caso 3: Fórmula externa sin rectificar
        if (formulaExterna && !tieneFormulaOriginal && !esOftalmologo && !esOptometrista) {
            return 'externa_sin_rectificar';
        }

        // Caso 4: Fórmula externa rectificada por oftalmólogo
        if (formulaExterna && tieneFormulaOriginal && esOftalmologo) {
            return pagoPendiente ? 'externa_rectificada_oftalmologo' : 'oftalmologo_pagado';
        }

        // Caso 5: Fórmula externa rectificada por optometrista
        if (formulaExterna && tieneFormulaOriginal && esOptometrista) {
            return 'externa_rectificada_optometrista';
        }

        // Caso 6: Médico externo puro
        if (esExterno) {
            return 'externa_sin_rectificar';
        }

        return 'oftalmologo_pendiente';
    }

    seleccionarHistoria(historia: any): void {
        console.log('📋 seleccionarHistoria llamado');
        console.log('Historia:', historia);

        if (this.historiaSeleccionadaId === historia.id) {
            return;
        }

        const datosConsulta = historia.datosConsulta || historia.data?.datosConsulta;
        const especialista = datosConsulta?.especialista;

        const esOftalmologo = especialista?.tipo === 'OFTALMOLOGO';
        const esOptometrista = especialista?.tipo === 'OPTOMETRISTA';
        const esExterno = especialista?.tipo === 'EXTERNO';
        const pagoPendiente = datosConsulta?.pagoPendiente === true;
        const formulaExterna = datosConsulta?.formulaExterna === true;
        const tieneFormulaOriginal = !!datosConsulta?.formulaOriginal?.medicoOrigen?.nombre;

        const tipo = this.determinarTipoHistoria(historia);

        console.log('Tipo determinado:', tipo);
        console.log('¿Pago pendiente?:', pagoPendiente);
        console.log('¿Es oftalmólogo?:', esOftalmologo);
        console.log('¿Es externa?:', formulaExterna);
        console.log('¿Tiene fórmula original?:', tieneFormulaOriginal);

        // ============================================
        // CASO: SOLO CONSULTA
        // ============================================
        if (this.tipoVenta === 'solo_consulta') {

            // Verificar si es una historia válida para solo consulta
            const esValidaParaSoloConsulta = (esOftalmologo && !formulaExterna) || // Oftalmólogo interno
                (formulaExterna && tieneFormulaOriginal && esOftalmologo); // Externa rectificada por oftalmólogo

            if (!esValidaParaSoloConsulta) {
                let mensaje = '';
                if (esOptometrista) {
                    mensaje = 'Las consultas de optometrista no generan costo y no se pueden vender como consulta.';
                } else if (formulaExterna && !tieneFormulaOriginal) {
                    mensaje = 'Las fórmulas externas puras no generan costo y no se pueden vender como consulta.';
                } else if (formulaExterna && tieneFormulaOriginal && esOptometrista) {
                    mensaje = 'Las rectificaciones por optometrista no generan costo.';
                } else {
                    mensaje = 'Esta historia no puede venderse como consulta.';
                }

                this.swalService.showInfo('No se puede vender', mensaje);
                return;
            }

            // Si es válida pero ya está pagada
            if (esOftalmologo && !pagoPendiente) {
                this.swalService.showWarning(
                    'Consulta ya pagada',
                    'Esta consulta de oftalmólogo ya ha sido pagada anteriormente. No se puede volver a cobrar.'
                );
                return;
            }

            // Limpiar solo si hay otra consulta
            if (this.consultaEnCarrito) {
                this.limpiarConsulta();
            }

            // Actualizar la historia seleccionada
            this.actualizarHistoriaSeleccionada(historia);

            // Agregar al carrito
            setTimeout(() => {
                this.agregarConsultaAlCarrito();
            }, 100);

            return;
        }

        // ============================================
        // CASO: CONSULTA + PRODUCTOS
        // ============================================
        if (this.tipoVenta === 'consulta_productos') {

            // Para consulta + productos, podemos seleccionar cualquier historia
            // pero mostramos mensajes informativos según el caso
            if (esOftalmologo && !pagoPendiente && !formulaExterna) {
                this.swalService.showInfo(
                    'Consulta pagada',
                    'Esta consulta ya fue pagada anteriormente. Se agregará al carrito sin costo.'
                );
            } else if (formulaExterna && tieneFormulaOriginal && esOftalmologo && !pagoPendiente) {
                this.swalService.showInfo(
                    'Rectificación pagada',
                    'Esta rectificación externa ya fue pagada anteriormente. Se agregará al carrito sin costo.'
                );
            }

            // Limpiar consulta anterior si existía
            if (this.consultaEnCarrito) {
                this.limpiarConsulta();
            }

            // Actualizar la historia seleccionada
            this.actualizarHistoriaSeleccionada(historia);

            // Agregar al carrito
            setTimeout(() => {
                this.agregarConsultaAlCarrito();
            }, 100);

            // Mensaje informativo rápido
            let mensaje = '';
            if (esOftalmologo && pagoPendiente && !formulaExterna) {
                mensaje = '👁️ Consulta de oftalmólogo';
            } else if (esOftalmologo && !pagoPendiente && !formulaExterna) {
                mensaje = '👁️ Consulta de oftalmólogo (pagada) - Sin costo';
            } else if (esOptometrista) {
                mensaje = '👓 Consulta de optometrista - Sin costo';
            } else if (formulaExterna && !tieneFormulaOriginal) {
                mensaje = '🔷 Fórmula externa - Sin costo';
            } else if (formulaExterna && tieneFormulaOriginal && esOftalmologo && pagoPendiente) {
                mensaje = '🔄 Rectificación por oftalmólogo (pendiente)';
            } else if (formulaExterna && tieneFormulaOriginal && esOftalmologo && !pagoPendiente) {
                mensaje = '🔄 Rectificación por oftalmólogo (pagada) - Sin costo';
            } else if (formulaExterna && tieneFormulaOriginal && esOptometrista) {
                mensaje = '🔄 Rectificación por optometrista - Sin costo';
            }

            if (mensaje) {
                this.snackBar.open(mensaje, 'Cerrar', { duration: 2000 });
            }

            return;
        }
    }

    get historiasExternasOftalmologoCount(): number {
        if (!this.historiasMedicas || this.historiasMedicas.length === 0) {
            return 0;
        }
        return this.historiasMedicas.filter(h =>
            h.formulaExterna && h.tipoProfesional === 'oftalmologo'
        ).length;
    }

    // Métodos para obtener información del especialista en ventas
    obtenerCargoEspecialista(historia: any): string {
        if (!historia?.datosConsulta?.especialista) return 'Oftalmología';

        const esp = historia.datosConsulta.especialista;
        if (esp.tipo === 'EXTERNO' && esp.externo) {
            return esp.externo.nombre ? 'Médico Externo' : 'Externo';
        } else if (esp.tipo === 'OFTALMOLOGO') {
            return 'Oftalmólogo';
        } else if (esp.tipo === 'OPTOMETRISTA') {
            return 'Optometrista';
        }
        return 'Oftalmología';
    }

    obtenerNombreEspecialista(historia: any): string {
        if (!historia?.datosConsulta?.especialista) return '';

        const esp = historia.datosConsulta.especialista;
        if (esp.tipo === 'EXTERNO' && esp.externo) {
            return esp.externo.nombre || '';
        } else if (esp.tipo !== 'EXTERNO') {
            return esp.nombre || '';
        }
        return '';
    }

    // Para determinar si es oftalmólogo (para el color del icono)
    esOftalmologo(historia: any): boolean {
        if (!historia?.datosConsulta?.especialista) return false;
        return historia.datosConsulta.especialista.tipo === 'OFTALMOLOGO';
    }

    esOptometrista(historia: any): boolean {
        if (!historia?.datosConsulta?.especialista) return false;
        return historia.datosConsulta.especialista.tipo === 'OPTOMETRISTA';
    }

    esExterno(historia: any): boolean {
        if (!historia?.datosConsulta?.especialista) return false;
        return historia.datosConsulta.especialista.tipo === 'EXTERNO';
    }

    // Agrega este método en tu componente
    private puedeVenderseComoConsulta(historia: any): boolean {
        if (!historia) return false;

        const tipo = this.determinarTipoHistoria(historia);
        const pagoPendiente = historia.datosConsulta?.pagoPendiente === true;

        // Para solo consulta, solo se puede vender:
        // 1. Oftalmólogo con pago pendiente (no pagado)
        // 2. Externa rectificada por oftalmólogo con pago pendiente
        if (tipo === 'oftalmologo_pendiente') {
            return true; // Oftalmólogo pendiente de pago
        }

        if (tipo === 'externa_rectificada_oftalmologo' && pagoPendiente) {
            return true; // Externa rectificada con pago pendiente
        }

        // Los siguientes NO se pueden vender como consulta:
        // - Oftalmólogo pagado
        // - Optometrista (nunca genera costo)
        // - Externa sin rectificar
        // - Externa rectificada por optometrista
        // - Externa rectificada por oftalmólogo pagada

        return false;
    }

}
