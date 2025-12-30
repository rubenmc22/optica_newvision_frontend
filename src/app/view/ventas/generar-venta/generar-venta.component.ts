import { Component, OnInit, ChangeDetectorRef, OnDestroy, ViewChild } from '@angular/core';
import { Producto } from '../../productos/producto.model';
import { ProductoService } from '../../productos/producto.service';
import { SystemConfigService } from '../../system-config/system-config.service';
import { GenerarVentaService } from './generar-venta.service';
import { Tasa } from '../../../Interfaces/models-interface';
import { SwalService } from '../../../core/services/swal/swal.service';
import { forkJoin, map, Subject, Observable, of, lastValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { LoaderService } from './../../../shared/loader/loader.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserStateService, SedeInfo } from '../../../core/services/userState/user-state-service';
import { PacientesService } from '../../../core/services/pacientes/pacientes.service';
import { HistoriaMedicaService } from '../../../core/services/historias-medicas/historias-medicas.service';
import { Paciente } from '../../pacientes/paciente-interface';
import { HistoriaMedica } from './../../historias-medicas/historias_medicas-interface';
import { VentaDto, ProductoVentaCalculado, CuotaCashea } from '../venta-interfaz';
import { Empleado, User } from '../../../Interfaces/models-interface';
import { EmpleadosService } from './../../../core/services/empleados/empleados.service';
import { trigger, transition, style, animate } from '@angular/animations';
import * as bootstrap from 'bootstrap';
import { Subscription } from 'rxjs';
import { ProductoConversionService } from '../../productos/productos-list/producto-conversion.service';
import { ClienteService } from '../../clientes/clientes.services';
import { NgSelectComponent } from '@ng-select/ng-select';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


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
        private clienteService: ClienteService
    ) { }

    // === PROPIEDADES ===
    monedaSistema: string = 'USD';
    simboloMonedaSistema: string = '$';
    private configSubscription!: Subscription;
    monedaEfectivo: string = 'USD';
    filterInput = new Subject<string>();

    dataIsReady = false;
    tareasPendientes = 0;
    sedeActiva: string = '';
    sedeFiltro: string = this.sedeActiva;
    currentUser: User | null = null;
    nivelCashea: 'nivel1' | 'nivel2' | 'nivel3' | 'nivel4' | 'nivel5' | 'nivel6' = 'nivel3';
    ivaPorcentaje = 0;
    requierePaciente: boolean = false;
    valorTemporal: string = '';
    montoExcedido: boolean = false;
    maximoCuotasPermitidas = 6;
    cantidadCuotasCashea = 3;
    sedeInfo: SedeInfo | null = null;

    productos: Producto[] = [];
    pacientes: any[] = [];
    todosLosPacientes: Paciente[] = [];
    pacientesFiltradosPorSede: Paciente[] = [];
    productosFiltradosPorSede: Producto[] = [];
    empleadosDisponibles: Empleado[] = [];
    tasasDisponibles: Tasa[] = [];
    monedasDisponibles: Tasa[] = [];
    tasasPorId: Record<string, number> = {};

    pacienteSeleccionado: Paciente | null = null;
    productoSeleccionado: string | null = null;
    asesorSeleccionado: string | null = null;

    // === PROPIEDADES ADICIONALES PARA CLIENTE SIN PACIENTE ===
    clienteSinPaciente: any = {
        tipoPersona: 'natural',
        nombreCompleto: '',
        cedula: '',
        telefono: '',
        email: ''
    };
    mostrarSelectorAsesor: boolean = false;

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
    generarOrdenTrabajo: boolean = false;

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
    currentYear: number = new Date().getFullYear();
    informacionVenta: any = null;
    // OBTENER INFORMACIÓN DE LA SEDE DESDE EL COMPONENTE

    venta: VentaDto = {
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
        this.cargarDatosIniciales();

        // SUSCRIBIRSE A LA SEDE DESDE UserStateService (ya cargada por el dashboard)
        this.userStateService.sedeActual$.subscribe(sede => {
            this.sedeInfo = sede;

            // Actualizar filtros si es necesario
            if (this.sedeInfo) {
                this.sedeActiva = this.sedeInfo.key;
                this.sedeFiltro = this.sedeActiva;

                // Filtrar productos por la sede
                this.productosFiltradosPorSede = this.productos
                    .filter(p =>
                        p.sede?.trim().toLowerCase() === this.sedeActiva &&
                        p.activo === true &&
                        (p.stock ?? 0) > 0
                    );
            }
        });
    }

    ngOnDestroy(): void {
        if (this.configSubscription) {
            this.configSubscription.unsubscribe();
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
            this.sedeActiva = usuario?.sede?.trim().toLowerCase() ?? '';

            this.productosFiltradosPorSede = this.productos
                .filter(p =>
                    p.sede?.trim().toLowerCase() === this.sedeActiva &&
                    p.activo === true &&
                    (p.stock ?? 0) > 0
                )
                .map(p => ({
                    ...p,
                    precio: +(p.precio ?? 0),
                    precioConIva: +(p.precioConIva ?? 0),
                    aplicaIva: p.aplicaIva ?? false,
                    moneda: p.moneda?.toLowerCase() === 'ves' ? 'bolivar' : p.moneda ?? 'dolar',
                    stock: p.stock ?? 0
                }));

            const tasas = tasasResponse.tasas ?? [];
            this.tasasDisponibles = tasas;
            this.monedasDisponibles = tasas;
            this.tasasPorId = Object.fromEntries(tasas.map(t => [t.id, t.valor]));

            this.actualizarProductosConDetalle();
            this.completarTarea();
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

    onHistoriaSeleccionada(event: any): void {

        // El evento puede ser el valor directamente o un objeto
        let historiaId: string | null = null;

        if (event === null || event === undefined) {
            this.historiaMedica = null;
            this.historiaMedicaSeleccionada = null;
            this.cdr.detectChanges();
            return;
        }

        if (typeof event === 'object' && event !== null) {
            // Si es un objeto, extraer el valor
            historiaId = event.value || event.key || event.id?.toString() || null;
        } else {
            // Si es un string/number directamente
            historiaId = event?.toString() || null;
        }

        if (!historiaId || historiaId.trim() === '') {
            console.warn('ID de historia vacío o inválido:', historiaId);
            this.historiaMedica = null;
            this.historiaMedicaSeleccionada = null;
            this.cdr.detectChanges();
            return;
        }

        // Buscar la historia seleccionada - comparar como string
        const historiaSeleccionada = this.historiasMedicas.find(h =>
            h.key === historiaId ||
            h.id.toString() === historiaId
        );

        if (historiaSeleccionada) {
            this.historiaMedica = historiaSeleccionada.data;
            this.historiaMedicaSeleccionada = historiaSeleccionada.data;

            // Forzar la detección de cambios
            this.cdr.detectChanges();

            // Mostrar mensaje informativo si no es la más reciente
            if (!historiaSeleccionada.esReciente) {
                this.snackBar.open(
                    `✅ Historia ${historiaSeleccionada.nHistoria} seleccionada`,
                    'Cerrar',
                    {
                        duration: 2000,
                        panelClass: ['snackbar-success']
                    }
                );
            }

            // Verificar si la nueva historia tiene fórmula
            if (!historiaSeleccionada.tieneFormula) {
                this.snackBar.open(
                    '⚠️ Esta historia no tiene fórmula óptica registrada',
                    'Cerrar',
                    {
                        duration: 3000,
                        panelClass: ['snackbar-warning']
                    }
                );
            }
        } else {
            console.warn('❌ Historia no encontrada. ID buscado:', historiaId);
            console.warn('Keys disponibles:', this.historiasMedicas?.map(h => h.key));
            this.historiaMedica = null;
            this.historiaMedicaSeleccionada = null;
            this.cdr.detectChanges();
        }
    }

    // === MÉTODOS DE PACIENTES ===
    onPacienteSeleccionado(pacienteSeleccionado: Paciente | null): void {
        this.registrarTarea();

        // Limpiar historias previas
        this.historiasMedicas = [];
        this.historiaSeleccionadaId = null;
        this.historiaMedica = null;
        this.historiaMedicaSeleccionada = null;

        if (!pacienteSeleccionado?.key) {
            console.error('No se encontró la clave del paciente seleccionado.', pacienteSeleccionado?.key);
            this.completarTarea();
            return;
        }

        const pacienteKey = pacienteSeleccionado.key;

        this.historiaService.getHistoriasPorPaciente(pacienteKey).pipe(take(1)).subscribe({
            next: (historiales: any[]) => {
                if (!historiales || historiales.length === 0) {
                    this.swalService.showWarning(
                        'Sin historia médica',
                        'Este paciente no tiene historia registrada. Puedes continuar si es una venta libre.'
                    );
                    this.completarTarea();
                    return;
                }

                const historiasOrdenadas = historiales.sort((a: any, b: any) =>
                    new Date(b.auditoria.fechaCreacion).getTime() -
                    new Date(a.auditoria.fechaCreacion).getTime()
                );

                // En onPacienteSeleccionado, cuando creas las historias:
                this.historiasMedicas = historiasOrdenadas.map((historia: any, index: number) => {
                    const fecha = new Date(historia.auditoria.fechaCreacion);
                    const tieneFormula = this.tieneFormulaCompleta(historia);

                    return {
                        key: historia.id.toString(),
                        id: historia.id,
                        nHistoria: historia.nHistoria || `H-${historia.id}`,
                        fechaFormateada: fecha.toLocaleDateString('es-VE', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        }),
                        fechaCreacion: historia.auditoria.fechaCreacion,
                        profesionalNombre: historia.auditoria?.creadoPor?.nombre ||
                            historia.datosConsulta?.medico?.nombre ||
                            'Desconocido',
                        esReciente: index === 0,
                        tieneFormula: tieneFormula,
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

                // Asegurarse de que la historia seleccionada por defecto también tenga key como string
                if (this.historiasMedicas.length > 0) {
                    this.historiaSeleccionadaId = this.historiasMedicas[0].key;
                    this.historiaMedica = this.historiasMedicas[0].data;
                    this.historiaMedicaSeleccionada = this.historiasMedicas[0].data;
                }
                // Seleccionar automáticamente la historia más reciente 
                if (this.historiasMedicas.length > 0) {
                    this.historiaSeleccionadaId = this.historiasMedicas[0].key;
                    this.historiaMedica = this.historiasMedicas[0].data;
                    this.historiaMedicaSeleccionada = this.historiasMedicas[0].data;

                    // Mostrar mensaje informativo si la historia más reciente no tiene fórmula
                    if (!this.historiasMedicas[0].tieneFormula) {
                        this.swalService.showInfo(
                            'Sin fórmula óptica',
                            'La historia más reciente no tiene fórmula registrada. Puedes seleccionar otra historia o continuar con venta libre.'
                        );
                    }
                }

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

    getMaterialesRecomendados(): string {
        if (!this.historiaMedica?.recomendaciones?.[0]?.material) {
            return '--';
        }

        const material = this.historiaMedica.recomendaciones[0].material;
        if (Array.isArray(material)) {
            return material.join(', ');
        }
        return material || '--';
    }

    private tieneFormulaCompleta(historia: any): boolean {
        if (!historia?.examenOcular?.refraccionFinal) {
            return false;
        }

        const ref = historia.examenOcular.refraccionFinal;

        const odTieneDatos = !!ref.esf_od || ref.esf_od === 0 || !!ref.cil_od || ref.cil_od === 0;
        const oiTieneDatos = !!ref.esf_oi || ref.esf_oi === 0 || !!ref.cil_oi || ref.cil_oi === 0;

        return odTieneDatos || oiTieneDatos;
    }

    tieneFormulaCompletaTemplate(historia: any): boolean {
        return this.tieneFormulaCompleta(historia);
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

    onProductoSeleccionadoChange(event: any): void {
        if (event === null || event === undefined) {
            return;
        }

        let productoId: string;

        if (typeof event === 'object' && event !== null) {
            productoId = event.id;
        } else {
            productoId = event?.toString();
        }

        if (!productoId) {
            console.error('No se pudo extraer ID del producto');
            return;
        }

        // Buscar el producto completo por ID
        const producto = this.productosFiltradosPorSede.find(p => p.id === productoId);

        if (producto) {
            this.agregarProductoAlCarrito(producto);

            setTimeout(() => {
                this.cdr.detectChanges();
            }, 100);

        } else {
            console.error('Producto no encontrado para ID:', productoId);
            this.swalService.showWarning('Error', 'No se pudo encontrar el producto seleccionado.');
        }
    }

    agregarProductoAlCarrito(producto: any): void {
        if (!producto || !producto.id) {
            console.error('Producto inválido o sin ID:', producto);
            this.swalService.showWarning('Error', 'No se puede agregar un producto inválido al carrito.');
            return;
        }

        const yaExiste = this.venta.productos.find(p => p.id === producto.id);
        const stockDisponible = producto.stock ?? 0;
        const precioBase = +(producto.precio ?? 0);
        const precioFinal = +(producto.precioConIva ?? 0);
        const monedaOriginal = this.idMap[producto.moneda?.toLowerCase()] ?? producto.moneda?.toLowerCase() ?? 'dolar';
        const aplicaIva = producto.aplicaIva ?? false;

        if (stockDisponible <= 0) {
            this.swalService.showWarning('Sin stock', 'Este producto no tiene unidades disponibles.');
            return;
        }

        if (precioBase <= 0 || (aplicaIva && precioFinal <= 0)) {
            this.swalService.showWarning('Precio inválido', 'Este producto no tiene precio asignado.');
            return;
        }

        if (yaExiste) {
            const nuevaCantidad = (yaExiste.cantidad ?? 1) + 1;

            if (nuevaCantidad > stockDisponible) {
                this.swalService.showWarning('Stock insuficiente', `Solo hay ${stockDisponible} unidades disponibles.`);
                return;
            }

            yaExiste.cantidad = nuevaCantidad;

        } else {
            this.venta.productos.push({
                id: producto.id,
                nombre: producto.nombre,
                codigo: producto.codigo,
                precio: precioBase,
                precioConIva: precioFinal,
                moneda: monedaOriginal,
                cantidad: 1,
                aplicaIva,
                stock: producto.stock ?? 0
            });

        }

        this.actualizarProductosConDetalle();

        setTimeout(() => {
            this.cdr.detectChanges();
        });
    }


    eliminarProducto(id: string): void {
        const eliminado = this.venta.productos.find(p => p.id === id)?.nombre;
        this.venta.productos = this.venta.productos.filter(p => p.id !== id);
        this.actualizarProductosConDetalle();
        this.snackBar.open(`${eliminado} eliminado`, 'Cerrar', { duration: 2000 });
    }

    filtrarProductoPorNombreOCodigo(term: string, item: Producto): boolean {
        const nombre = item.nombre?.toLowerCase() ?? '';
        const codigo = item.codigo?.toLowerCase() ?? '';
        const normalizado = term.trim().toLowerCase();
        return nombre.includes(normalizado) || codigo.includes(normalizado);
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
    }

    onMetodoPagoChange(index: number): void {
        const metodo = this.venta.metodosDePago[index];

        // Asegurar que la moneda esté sincronizada con el tipo
        if (metodo.tipo && !metodo.moneda) {
            metodo.moneda = this.getMonedaParaMetodo(metodo.tipo);
        }

        if (metodo.monto && metodo.monto > 0) {
            const monedaMetodo = metodo.moneda || this.getMonedaParaMetodo(metodo.tipo);
            metodo.valorTemporal = `${metodo.monto.toFixed(2)} ${this.obtenerSimboloMoneda(monedaMetodo)}`;
        } else {
            metodo.valorTemporal = '';
        }

        this.cdr.detectChanges();
    }

    formatearMontoMetodo(index: number): void {
        const metodo = this.venta.metodosDePago[index];

        // Usar la moneda del método si existe, sino calcularla
        const monedaMetodo = metodo.moneda || this.getMonedaParaMetodo(metodo.tipo);

        if (!metodo.tipo) {
            this.snackBar.open('⚠️ Primero selecciona un método de pago', 'Cerrar', { duration: 3000 });
            metodo.valorTemporal = '';
            metodo.monto = 0;
            return;
        }

        const limpio = metodo.valorTemporal?.replace(/[^\d.,]/g, '').trim();

        if (!limpio) {
            metodo.monto = 0;
            metodo.valorTemporal = '';
            return;
        }

        // Convertir coma decimal a punto para cálculo
        const montoString = limpio.replace(',', '.');
        const monto = parseFloat(montoString);

        if (isNaN(monto)) {
            metodo.monto = 0;
            metodo.valorTemporal = '';
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
            this.snackBar.open(`⚠️ El monto se ajustó al máximo disponible: ${this.formatearMoneda(montoFinal, monedaMetodo)}`, 'Cerrar', {
                duration: 3000,
                panelClass: ['snackbar-warning']
            });
        }

        this.cdr.detectChanges();
    }

    formatearInicialCashea(): void {
        const limpio = this.valorInicialTemporal.replace(/[^\d.,]/g, '').trim();
        const minimo = this.calcularInicialCasheaPorNivel(this.montoTotal, this.nivelCashea);

        // Si está vacío, asignar mínimo automáticamente
        if (!limpio) {
            this.venta.montoInicial = minimo;
            this.valorInicialTemporal = this.formatearMoneda(minimo, this.venta.moneda);
            this.generarCuotasCashea();

            this.snackBar.open(`Se asignó el monto mínimo: ${this.formatearMoneda(minimo, this.venta.moneda)}`, 'Cerrar', {
                duration: 2000,
                panelClass: ['snackbar-info']
            });
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

            this.snackBar.open(`El monto mínimo es ${this.formatearMoneda(minimo, this.venta.moneda)}. Se ajustó automáticamente.`, 'Cerrar', {
                duration: 3000,
                panelClass: ['snackbar-warning']
            });
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
            return;
        }

        this.montoExcedido = monto > adeudado;

        if (this.montoExcedido) {
            this.valorTemporal = this.formatearMoneda(adeudado, this.venta.moneda);
            this.venta.montoAbonado = adeudado;
            this.cdr.detectChanges();
            return;
        }

        this.venta.montoAbonado = monto;
        this.valorTemporal = this.formatearMoneda(monto, this.venta.moneda);
        this.cdr.detectChanges();
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
            const monedaMetodo = this.getMonedaParaMetodo(metodo.tipo);

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
            const monedaMetodo = this.getMonedaParaMetodo(metodo.tipo);

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

    // === MÉTODOS CASHEA ===
    onFormaPagoChange(valor: string): void {
        this.venta.formaPago = valor;

        if (valor === 'cashea') {
            this.venta.moneda = 'dolar';
            this.controlarCuotasPorNivel();
            this.actualizarMontoInicialCashea();
            this.generarCuotasCashea();

            const minimo = this.calcularInicialCasheaPorNivel(this.montoTotal, this.nivelCashea);
            this.valorInicialTemporal = this.formatearMoneda(minimo, this.venta.moneda);
        } else {
            this.venta.moneda = this.normalizarMonedaParaVenta(this.monedaSistema);
        }

        this.venta.metodosDePago = [];
        this.resumenCashea = { cantidad: 0, total: 0, totalBs: 0 };
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

    getMonedaParaMetodo(tipoMetodo: string): string {
        const monedasPorMetodo: { [key: string]: string } = {
            'efectivo': this.monedaEfectivo.toLowerCase() === 'eur' ? 'euro' :
                this.monedaEfectivo.toLowerCase() === 'ves' ? 'bolivar' :
                    this.monedaEfectivo.toLowerCase() === 'bs' ? 'bolivar' : 'dolar',
            'zelle': 'dolar',
            'debito': 'bolivar',
            'credito': 'bolivar',
            'pagomovil': 'bolivar',
            'transferencia': 'bolivar'
        };

        return monedasPorMetodo[tipoMetodo];
    }

    esMetodoEnBolivares(tipoMetodo: string): boolean {
        const metodosEnBs = ['debito', 'credito', 'pagomovil', 'transferencia'];
        return metodosEnBs.includes(tipoMetodo);
    }

    getMontoRestanteParaMetodo(index: number): number {
        const otrosMontos = this.venta.metodosDePago
            .filter((_, i) => i !== index)
            .reduce((sum, metodo) => {
                const montoMetodo = metodo.monto ?? 0;
                const monedaMetodo = this.getMonedaParaMetodo(metodo.tipo);

                // Convertir cada monto a la moneda del sistema (euros)
                if (monedaMetodo !== this.venta.moneda) {
                    const conversionExacta = this.convertirMontoExacto(montoMetodo, monedaMetodo, this.venta.moneda);
                    return sum + conversionExacta;
                }
                return sum + montoMetodo;
            }, 0);

        // 2. El restante es la diferencia entre lo requerido y lo ya pagado (en euros)
        const restanteEnEuros = Math.max(this.montoCubiertoPorMetodos - otrosMontos, 0);

        // 3. Si el método actual está en la misma moneda del sistema, devolver directamente
        const metodoActual = this.venta.metodosDePago[index];
        const monedaMetodoActual = this.getMonedaParaMetodo(metodoActual.tipo);

        if (monedaMetodoActual === this.venta.moneda) {
            return this.redondear(restanteEnEuros);
        }

        // 4. Si el método actual está en otra moneda, convertir el restante a esa moneda
        const restanteEnMonedaMetodo = this.convertirMontoExacto(restanteEnEuros, this.venta.moneda, monedaMetodoActual);
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
        const monedaMetodo = this.getMonedaParaMetodo(metodo.tipo);
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

    getPlaceholderMonto(tipoMetodo: string): string {
        if (!tipoMetodo) return 'Ingrese un monto';

        if (this.esMetodoEnBolivares(tipoMetodo)) {
            return 'Monto en Bs';
        }

        const monedaMetodo = this.getMonedaParaMetodo(tipoMetodo);
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
        if (this.venta.productos.length === 0) {
            this.swalService.showWarning('Sin productos', 'Debes agregar al menos un producto para continuar.');
            return;
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
                this.limpiarTodosLosSelects();
                this.resetearVentaCompleta(false);
                this.limpiarSelectProductos();
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

    resetearVentaCompleta(resetFormaPago: boolean = true): void {
        // 1. Limpiar productos
        this.venta.productos = [];

        // 2. Restablecer propiedades básicas de venta
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

        // 4. Limpiar propiedades específicas de Cashea
        this.nivelCashea = 'nivel3';
        this.cantidadCuotasCashea = 3;
        this.cuotasCashea = [];
        this.resumenCashea = { cantidad: 0, total: 0, totalBs: 0 };
        this.valorInicialTemporal = '';

        // 5. Limpiar abono
        this.valorTemporal = '';
        this.montoExcedido = false;

        // 6. Restablecer moneda efectivo
        this.monedaEfectivo = this.monedaSistema;

        // 7. Limpiar selecciones
        this.pacienteSeleccionado = null;
        this.productoSeleccionado = null;
        this.asesorSeleccionado = this.currentUser?.id ?? null;

        this.limpiarTodosLosSelects();

        // 8. Limpiar cliente sin paciente
        this.clienteSinPaciente = {
            tipoPersona: 'natural',
            nombreCompleto: '',
            cedula: '',
            telefono: '',
            email: ''
        };

        this.requierePaciente = false;
        this.historiaMedica = null;
        this.mostrarSelectorAsesor = false;

        // 9. Limpiar validación de cliente
        this.validandoCliente = false;
        this.clienteEncontrado = false;
        this.mensajeValidacionCliente = '';

        // 10. Actualizar productos con la moneda correcta
        this.actualizarProductosConDetalle();
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
    cambiarMonedaEfectivo(nuevaMoneda: string): void {
        this.monedaEfectivo = nuevaMoneda;

        this.venta.metodosDePago.forEach(metodo => {
            if (metodo.tipo === 'efectivo') {
                metodo.moneda = this.getMonedaParaMetodo('efectivo');

                if (metodo.monto && metodo.monto > 0) {
                    metodo.valorTemporal = this.formatearMoneda(metodo.monto, metodo.moneda);
                }
            }
        });

        this.cdr.detectChanges();
    }

    onTipoMetodoChange(index: number): void {
        const metodo = this.venta.metodosDePago[index];

        metodo.moneda = this.getMonedaParaMetodo(metodo.tipo);

        metodo.monto = 0;
        metodo.valorTemporal = '';
        metodo.referencia = '';
        metodo.bancoCodigo = '';
        metodo.bancoNombre = '';
        metodo.banco = '';
        metodo.bancoObject = null;

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
            moneda: ''
        });
    }

    hayMetodoEfectivoSeleccionado(): boolean {
        return this.venta.metodosDePago.some(metodo => metodo.tipo === 'efectivo');
    }

    mostrarConversionBs(tipoMetodo: string): boolean {
        const monedaMetodo = this.getMonedaParaMetodo(tipoMetodo);
        return monedaMetodo !== 'bolivar' && this.venta.moneda !== 'bolivar';
    }


    getInfoConversionMetodo(metodo: any): string {
        if (!metodo.monto || metodo.monto <= 0) return '';

        const monedaMetodo = this.getMonedaParaMetodo(metodo.tipo);
        const montoEnSistema = this.convertirMontoExacto(metodo.monto, monedaMetodo, this.venta.moneda);

        if (monedaMetodo === this.venta.moneda) {
            return '';
        }

        return `⇄${this.formatearMoneda(montoEnSistema, this.venta.moneda)}`;
    }

    calcularConversionBs(monto: number, tipoMetodo: string): number {
        if (!monto || monto <= 0) return 0;

        const monedaMetodo = this.getMonedaParaMetodo(tipoMetodo);

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

        const monedaMetodo = this.getMonedaParaMetodo(metodo.tipo);
        const montoEnBs = this.calcularConversionBs(metodo.monto, metodo.tipo);

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
                return '✅ El pago está completo y alineado con el monto abonado.';
            case 'cashea':
                return '✅ El pago inicial está completo y alineado con el monto requerido.';
            case 'contado':
                return '✅ El pago está completo y alineado con el monto total.';
            default:
                return '✅ El pago está completo.';
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

    bancosDisponibles: Array<{ codigo: string; nombre: string }> = [
        { codigo: '0102', nombre: 'Banco de Venezuela' },
        { codigo: '0134', nombre: 'Banesco' },
        { codigo: '0104', nombre: 'Venezolano de Crédito' },
        { codigo: '0105', nombre: 'Mercantil' },
        { codigo: '0114', nombre: 'Bancaribe' },
        { codigo: '0115', nombre: 'BOD' },
        { codigo: '0116', nombre: 'Banco Plaza' },
        { codigo: '0128', nombre: 'Banco Caribe' },
        { codigo: '0108', nombre: 'Banco Provincial' },
        { codigo: '0118', nombre: 'Banco del Sur' },
        { codigo: '0121', nombre: 'Bancamiga' },
        { codigo: '0151', nombre: '100% Banco' },
        { codigo: '0156', nombre: 'Banco del Tesoro' },
        { codigo: '0157', nombre: 'Banco Bicentenario' },
        { codigo: '0163', nombre: 'Banco Fondo Común' },
        { codigo: '0166', nombre: 'Banco Agrícola de Venezuela' },
        { codigo: '0168', nombre: 'Bancrecer' },
        { codigo: '0169', nombre: 'Mi Banco' },
        { codigo: '0171', nombre: 'Banco Activo' },
        { codigo: '0172', nombre: 'Bancamiga' },
        { codigo: '0173', nombre: 'Banco Internacional de Desarrollo' },
        { codigo: '0174', nombre: 'Banco Plaza' },
        { codigo: '0175', nombre: 'Banco de la Fuerza Armada Nacional Bolivariana' },
        { codigo: '0177', nombre: 'Banco del Tesoro' },
        { codigo: '0191', nombre: 'Banco Nacional de Crédito' },
        { codigo: '0000', nombre: 'Otro' }
    ];

    compararBanco = (a: any, b: any): boolean => {
        if (!a || !b) return a === b;
        return a.codigo === b.codigo;
    };

    onBancoChange(banco: { codigo: string; nombre: string } | null, index: number): void {
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


    // Métodos auxiliares para determinar qué campos mostrar
    necesitaReferencia(tipoMetodo: string): boolean {
        const metodosConReferencia = ['pagomovil', 'transferencia'];
        return metodosConReferencia.includes(tipoMetodo);
    }

    necesitaBanco(tipoMetodo: string): boolean {
        const metodosConBanco = ['pagomovil', 'transferencia'];
        return metodosConBanco.includes(tipoMetodo);
    }

    get puedeGenerarVenta(): boolean {
        // 1. Verificar que hay productos
        if (this.venta.productos.length === 0) {
            return false;
        }

        // 2. Validar información del cliente según el tipo de venta
        if (this.requierePaciente) {
            // Venta con paciente - debe tener paciente seleccionado
            if (!this.pacienteSeleccionado) {
                return false;
            }
        } else {
            // Venta sin paciente - debe tener información del cliente completa
            if (!this.validarClienteSinPaciente()) {
                return false;
            }
        }

        // 3. Verificar asesor seleccionado
        if (!this.asesorSeleccionado) {
            return false;
        }

        // 4. Verificar que todos los métodos de pago estén completamente configurados
        const metodosCompletos = this.venta.metodosDePago.every(metodo => {
            if (!metodo.tipo) return false;

            if (!metodo.monto || metodo.monto <= 0) return false;

            if (this.necesitaBanco(metodo.tipo)) {
                if (!metodo.banco || !metodo.bancoObject) return false;
            }

            if (this.necesitaReferencia(metodo.tipo)) {
                if (!metodo.referencia || metodo.referencia.trim() === '') return false;
            }

            return true;
        });

        if (!metodosCompletos) {
            return false;
        }

        // 5. Validaciones financieras
        const montoCubierto = this.totalPagadoPorMetodos;
        const montoRequerido = this.montoCubiertoPorMetodos;

        const diferencia = Math.abs(montoCubierto - montoRequerido);
        const pagoCompleto = diferencia < 0.01;

        // Verificar condiciones específicas por forma de pago
        switch (this.venta.formaPago) {
            case 'contado':
                return pagoCompleto;

            case 'abono':
                // Para abono, debe cubrir exactamente el monto abonado
                return pagoCompleto && (this.venta.montoAbonado ?? 0) > 0;

            case 'cashea':
                // Para Cashea, debe cubrir inicial + cuotas seleccionadas
                const inicialCubierto = pagoCompleto;
                const tieneInicialValida = (this.venta.montoInicial ?? 0) >=
                    this.calcularInicialCasheaPorNivel(this.montoTotal, this.nivelCashea);
                return inicialCubierto && tieneInicialValida;

            default:
                return false;
        }
    }

    // Método para verificar si un método de pago específico está completo
    metodoCompleto(metodo: any): boolean {
        if (!metodo.tipo) return false;
        if (!metodo.monto || metodo.monto <= 0) return false;

        // Validar campos condicionales
        if (this.necesitaBanco(metodo.tipo) && (!metodo.banco || !metodo.bancoObject)) {
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

        if (this.necesitaReferencia(metodo.tipo) && (!metodo.referencia || metodo.referencia.trim() === '')) {
            return { valido: false, mensaje: 'Ingresa número de referencia' };
        }

        return { valido: true, mensaje: 'Método completo' };
    }

    get mensajeEstadoBoton(): string {
        if (this.venta.productos.length === 0) {
            return 'Agrega productos para continuar';
        }

        // Verificar si hay métodos incompletos
        const metodosIncompletos = this.venta.metodosDePago.some(metodo => !this.metodoCompleto(metodo));
        if (metodosIncompletos) {
            return 'Completa todos los métodos de pago';
        }

        const montoCubierto = this.totalPagadoPorMetodos;
        const montoRequerido = this.montoCubiertoPorMetodos;
        const diferencia = montoRequerido - montoCubierto;

        if (diferencia > 0.01) {
            return `Faltan ${this.formatearMoneda(diferencia, this.venta.moneda)}`;
        }

        if (Math.abs(montoCubierto - montoRequerido) < 0.01) {
            return 'Listo para generar venta';
        }

        return 'Monto excedido, ajusta los métodos de pago';
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

    private obtenerProductosParaCalculoTotales(): any[] {
        // Si tenemos productosConDetalle, usarlos
        if (this.productosConDetalle && this.productosConDetalle.length > 0) {
            return this.productosConDetalle;
        }

        // Si no, usar venta.productos y calcular básico
        return this.venta.productos.map(producto => {
            const productoOriginal = this.productosFiltradosPorSede.find(p => p.id === producto.id);
            const precioUnitario = productoOriginal?.precio || producto.precio || 0;
            const aplicaIva = productoOriginal?.aplicaIva || producto.aplicaIva || false;

            return {
                ...producto,
                precioConvertido: precioUnitario,
                precio: precioUnitario,
                aplicaIva: aplicaIva,
                cantidad: producto.cantidad || 1
            };
        });
    }

    prepararDatosParaAPI(): any {
        const fechaActual = new Date();

        // SOLO cuando es paciente Y la historia tiene fórmula completa
        const debeGenerarOrdenTrabajo = this.requierePaciente &&
            this.pacienteSeleccionado &&
            this.historiaMedicaSeleccionada &&
            this.tieneFormulaCompleta(this.historiaMedicaSeleccionada);

        // Actualizar la propiedad
        this.generarOrdenTrabajo = debeGenerarOrdenTrabajo;

        let estadoVenta = 'completada';
        let estadoPago = 'completado';

        // Determinar estado del pago basado en la forma de pago y deuda
        if (this.venta.formaPago === 'abono') {
            const montoAbonado = this.venta.montoAbonado || 0;
            const montoTotal = this.montoTotal;
            const diferencia = Math.abs(montoAbonado - montoTotal);
            estadoPago = diferencia < 0.01 ? 'completado' : 'pendiente';
        } else if (this.venta.formaPago === 'cashea') {
            const totalPagadoCashea = this.totalPagadoCashea;
            const montoTotal = this.montoTotal;
            const diferencia = Math.abs(totalPagadoCashea - montoTotal);
            estadoPago = diferencia < 0.01 ? 'completado' : 'pendiente';
        }

        // OBTENER LA TASA ACTUAL UTILIZADA
        const tasaUtilizada = this.obtenerTasaUtilizada();

        // OBTENER INFORMACIÓN DEL ESPECIALISTA (MÉDICO) DESDE LA HISTORIA MÉDICA
        let especialistaData = null;
        let historiaMedicaData = null;

        if (this.historiaMedicaSeleccionada) {
            // Buscar el profesional en la historia médica
            const profesional = this.historiaMedicaSeleccionada.datosConsulta?.medico

            if (profesional) {
                especialistaData = {
                    cedula: profesional.cedula || null
                };
            }

            // Preparar datos de la historia médica para incluir en cliente
            historiaMedicaData = {
                id: this.historiaMedicaSeleccionada.id,
                key: this.historiaMedicaSeleccionada.id || null,
                nHistoria: this.historiaMedicaSeleccionada.nHistoria,
                fechaCreacion: this.historiaMedicaSeleccionada.auditoria?.fechaCreacion || fechaActual.toISOString()
            };
        }

        // Preparar datos del cliente CON LA HISTORIA MÉDICA DENTRO
        let clienteData: any = {};
        if (this.requierePaciente && this.pacienteSeleccionado) {
            clienteData = {
                tipo: 'paciente',
                informacion: {
                    tipoPersona: 'natural',
                    nombreCompleto: this.pacienteSeleccionado.informacionPersonal?.nombreCompleto,
                    cedula: this.pacienteSeleccionado.informacionPersonal?.cedula,
                    telefono: this.pacienteSeleccionado.informacionPersonal?.telefono,
                    email: this.pacienteSeleccionado.informacionPersonal?.email
                },
                // HISTORIA MÉDICA DENTRO DEL OBJETO CLIENTE
                historiaMedica: historiaMedicaData,
                // ESPECIALISTA/MÉDICO TAMBIÉN DENTRO DEL CLIENTE
                especialista: especialistaData
            };
        } else if (!this.requierePaciente) {
            clienteData = {
                tipo: 'cliente_general',
                informacion: {
                    tipoPersona: this.clienteSinPaciente.tipoPersona,
                    nombreCompleto: this.clienteSinPaciente.nombreCompleto,
                    cedula: this.clienteSinPaciente.cedula,
                    telefono: this.clienteSinPaciente.telefono,
                    email: this.clienteSinPaciente.email
                },
                // Para cliente general, no hay historia médica ni especialista
                historiaMedica: null,
                especialista: null
            };
        }

        // Productos
        const productosData = this.venta.productos.map(producto => ({
            productoId: producto.id,
            cantidad: producto.cantidad,
            moneda: producto.moneda
        }));

        // Métodos de pago
        const metodosPagoData = this.venta.metodosDePago.map(metodo => ({
            tipo: metodo.tipo,
            monto: metodo.monto,
            moneda: this.getMonedaParaMetodo(metodo.tipo),
            referencia: metodo.referencia || null,
            bancoCodigo: metodo.bancoCodigo || null,
            bancoNombre: metodo.bancoNombre || null
        }));

        // CALCULAR TOTALES CORRECTAMENTE
        // 1. Calcular SUBTOTAL 
        const subtotalSinIva = this.subtotalCorregido;

        // 1. Base imponible SIN IVA
        const baseImponible = this.subtotalCorregido;
        // 2. Descuento sobre base imponible (SIN IVA)
        const descuentoMonto = this.venta.descuento ? (baseImponible * (this.venta.descuento / 100)) : 0;
        const baseConDescuento = baseImponible - descuentoMonto;

        // 3. IVA sobre base con descuento
        const ivaCorrecto = this.calcularIvaSobreBaseConDescuento(baseConDescuento);

        // 4. Total final
        const totalCorrecto = baseConDescuento + ivaCorrecto;

        // Determinar total pagado según forma de pago
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

        // Construir el objeto final PARA API
        const datosParaAPI: any = {
            venta: {
                fecha: fechaActual.toISOString(),
                estado: estadoVenta,
                estatus_pago: estadoPago,
                formaPago: this.venta.formaPago,
                moneda: this.venta.moneda,
                observaciones: this.venta.observaciones || null,
                impuesto: this.venta.impuesto,
                tasa_cambio: tasaUtilizada,
            },
            totales: {
                subtotal: this.redondear(subtotalSinIva),
                descuento: this.redondear(descuentoMonto),
                iva: this.redondear(ivaCorrecto),
                total: this.redondear(totalCorrecto),
                totalPagado: this.redondear(totalPagado)
            },
            cliente: clienteData,
            asesor: {
                id: parseInt(this.asesorSeleccionado || '0')
            },
            productos: productosData,
            metodosPago: metodosPagoData,
            generarOrdenTrabajo: debeGenerarOrdenTrabajo,
            auditoria: {
                usuarioCreacion: parseInt(this.currentUser?.id || '0'),
                fechaCreacion: fechaActual.toISOString()
            }
        };

        // AGREGAR INFORMACIÓN ESPECÍFICA SEGÚN LA FORMA DE PAGO
        if (this.venta.formaPago === 'cashea') {
            datosParaAPI.formaPago = {
                tipo: 'cashea',
                nivel: this.nivelCashea,
                montoTotal: this.redondear(totalCorrecto),
                montoInicial: this.venta.montoInicial,
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
            const deudaPendienteAbono = Math.max(totalCorrecto - totalPagado, 0);
            const porcentajeAbonado = totalCorrecto > 0 ? (totalPagado / totalCorrecto) * 100 : 0;

            datosParaAPI.formaPagoDetalle = {
                tipo: 'abono',
                montoAbonado: this.redondear(totalPagado),
                deudaPendiente: this.redondear(deudaPendienteAbono),
                porcentajePagado: this.redondear(porcentajeAbonado)
            };
        } else if (this.venta.formaPago === 'contado') {
            datosParaAPI.formaPagoDetalle = {
                tipo: 'contado',
                montoTotal: this.redondear(totalCorrecto),
                totalPagado: this.redondear(totalPagado)
            };
        }

        return datosParaAPI;
    }

    // Método auxiliar para limpiar el objeto
    private limpiarObjeto(obj: any): any {
        Object.keys(obj).forEach(key => {
            if (obj[key] === null || obj[key] === undefined || obj[key] === '') {
                delete obj[key];
            } else if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                this.limpiarObjeto(obj[key]);
                if (Object.keys(obj[key]).length === 0) {
                    delete obj[key];
                }
            }
        });
        return obj;
    }

    // === MÉTODOS DE VENTA Y RECIBO ===
    async generarVenta(): Promise<void> {
        if (!this.puedeGenerarVenta) {
            this.swalService.showWarning(
                'No se puede generar la venta',
                'Verifica que todos los campos estén completos y los montos sean correctos.'
            );
            return;
        }

        //Mostrar advertencia si es paciente pero no tiene fórmula
        if (this.requierePaciente && this.pacienteSeleccionado && this.historiaMedicaSeleccionada) {
            const tieneFormula = this.tieneFormulaCompleta(this.historiaMedicaSeleccionada);

            if (!tieneFormula) {
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
        }

        if (this.generandoVenta) {
            return;
        }

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
                        const numeroVenta = resultado.venta.venta.numero_venta

                        this.loader.updateMessage('✅ Venta generada exitosamente');
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        this.loader.updateMessage('📄 Generando recibo de pago...');
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        this.loader.hide();

                        // ACTUALIZAR solo el número de venta y mostrar recibo
                        this.actualizarNumeroVentaRecibo(numeroVenta);
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

    /*
     * Prepara el recibo local ANTES de llamar al API
     */
    private prepararReciboLocal(): void {
        this.datosRecibo = this.crearDatosReciboReal();
    }

    private actualizarNumeroVentaRecibo(numeroVenta: string): void {
        if (this.datosRecibo) {
            this.datosRecibo.numeroVenta = numeroVenta;
            const datosApi = this.prepararDatosParaAPI();

            if (datosApi.totales) {
                this.datosRecibo.totales = {
                    subtotal: datosApi.totales.subtotal,
                    descuento: datosApi.totales.descuento,
                    iva: datosApi.totales.iva,
                    total: datosApi.totales.total,
                    totalPagado: datosApi.totales.totalPagado
                };
            }
        }
    }

    /**
     * Obtiene información de la sede
     */
    private obtenerInfoSede(): any {
        if (this.sedeInfo) {
            return {
                nombre: this.sedeInfo.nombre_optica || '',
                direccion: this.sedeInfo.direccion || '',
                telefono: this.sedeInfo.telefono || '',
                rif: this.sedeInfo.rif || '',
                email: this.sedeInfo.email || ''
            };
        }

        // Fallback si no hay información de sede
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

    generarReciboHTML(datos: any): string {
        if (!datos) {
            datos = this.crearDatosReciboReal();
        }

        const formaPago = datos.configuracion?.formaPago || 'contado';
        const tituloRecibo = this.getTituloReciboParaHTML(formaPago);
        const mensajeFinal = this.getMensajeFinalParaHTML(formaPago);

        // Determinar si mostrar "Total a pagar" según la forma de pago
        const mostrarTotalAPagar = this.debeMostrarTotalAPagar(formaPago, datos);
        const textoTotalAPagar = this.getTextoTotalAPagarParaHTML(formaPago);

        // OBTENER INFORMACIÓN DE LA SEDE DESDE EL COMPONENTE
        const sedeInfo = this.sedeInfo || this.userStateService.getSedeActual();

        // FUNCIÓN PARA LIMPIAR EL RIF
        const limpiarRif = (rif: string): string => {
            if (!rif) return '';
            return rif.replace(/^rif/i, '').trim();
        };

        // CREAR UNA FUNCIÓN LOCAL PARA FORMATEAR MONEDA
        const formatearMonedaLocal = (monto: number | null | undefined, moneda?: string) => {
            if (monto === null || monto === undefined || isNaN(monto)) {
                return this.obtenerSimboloMoneda(moneda || datos.configuracion?.moneda || 'dolar') + '0.00';
            }

            // Asegurarse de que es un número
            const montoNumerico = Number(monto);

            if (isNaN(montoNumerico)) {
                return this.obtenerSimboloMoneda(moneda || datos.configuracion?.moneda || 'dolar') + '0.00';
            }

            const monedaFinal = moneda || datos.configuracion?.moneda || 'dolar';
            const simbolo = this.obtenerSimboloMoneda(monedaFinal);

            // Formatear al estilo venezolano
            const valorRedondeado = Math.round(montoNumerico * 100) / 100;
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
        };

        // GENERAR ENCABEZADO DINÁMICO
        const generarEncabezadoSede = () => {
            if (sedeInfo) {
                const rifLimpio = limpiarRif(sedeInfo.rif || '');
                return `
                <div class="empresa-nombre">${sedeInfo.nombre_optica || sedeInfo.nombre || 'NEW VISION LENS'}</div>
                <div class="empresa-info">${sedeInfo.direccion || 'C.C. Candelaria, Local PB-04, Guarenas'} | Tel: ${sedeInfo.telefono || '0212-365-39-42'}</div>
                <div class="empresa-info">RIF: ${rifLimpio || 'J-123456789'} | ${sedeInfo.email || 'newvisionlens2020@gmail.com'}</div>
            `;
            }

            // Fallback si no hay información de sede
            return `
            <div class="empresa-nombre">NEW VISION LENS</div>
            <div class="empresa-info">C.C. Candelaria, Local PB-04, Guarenas | Tel: 0212-365-39-42</div>
            <div class="empresa-info">RIF: J-123456789 | newvisionlens2020@gmail.com</div>
        `;
        };

        // GENERAR CLIENTE
        const generarClienteHTML = () => {
            // Determinar si es paciente basado en datos.cliente.tipo o datos.cliente.esPaciente
            const esPaciente = datos.cliente?.tipo === 'PACIENTE' || datos.cliente?.esPaciente === true;
            const labelCliente = esPaciente ? 'Paciente:' : 'Cliente:';
            const nombreDefault = esPaciente ? 'PACIENTE' : 'CLIENTE GENERAL';

            return `
                <div class="cliente-compacto page-break-avoid">
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                        <div><strong>${labelCliente}</strong> ${datos.cliente.nombre || nombreDefault}</div>
                        <div><strong>Cédula:</strong> ${datos.cliente.cedula || 'N/A'}</div>
                        <div><strong>Teléfono:</strong> ${datos.cliente.telefono || 'N/A'}</div>
                    </div>
                </div>
            `;
        };

        // GENERAR TABLA DE PRODUCTOS CORREGIDA
        const generarTablaProductos = () => {
            if (!datos.productos || datos.productos.length === 0) {
                return '<div class="alert alert-warning">No hay productos</div>';
            }

            return `
            <div class="productos-compactos page-break-avoid">
                <h6 style="font-weight: bold; margin-bottom: 8px; color: #2c5aa0; border-bottom: 1px solid #2c5aa0; padding-bottom: 3px;">PRODUCTOS</h6>
                <table class="tabla-productos" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th width="5%" style="text-align: center; padding: 4px; background-color: #2c5aa0; color: white; font-weight: bold;">#</th>
                            <th width="55%" style="text-align: left; padding: 4px; background-color: #2c5aa0; color: white; font-weight: bold;">Producto</th>
                            <th width="15%" style="text-align: center; padding: 4px; background-color: #2c5aa0; color: white; font-weight: bold;">P. Unitario</th>
                            <th width="10%" style="text-align: center; padding: 4px; background-color: #2c5aa0; color: white; font-weight: bold;">Cant</th>
                            <th width="15%" style="text-align: center; padding: 4px; background-color: #2c5aa0; color: white; font-weight: bold;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${datos.productos.map((producto: any, index: number) => {
                // Asegurar que los valores son correctos
                const precioUnitario = producto.precioUnitario || 0;
                const cantidad = producto.cantidad || 1;
                const subtotalCalculado = precioUnitario * cantidad;

                return `
                            <tr>
                                <td style="text-align: center; padding: 4px; border-bottom: 1px solid #dee2e6;">${index + 1}</td>
                                <td style="text-align: left; padding: 4px; border-bottom: 1px solid #dee2e6;">${producto.nombre || 'Producto'}</td>
                                <td style="text-align: right; padding: 4px; border-bottom: 1px solid #dee2e6;">${formatearMonedaLocal(precioUnitario)}</td>
                                <td style="text-align: center; padding: 4px; border-bottom: 1px solid #dee2e6;">${cantidad}</td>
                                <td style="text-align: right; padding: 4px; border-bottom: 1px solid #dee2e6;">${formatearMonedaLocal(subtotalCalculado)}</td>
                            </tr>
                            `;
            }).join('')}
                    </tbody>
                </table>
            </div>
            `;
        };

        // GENERAR RESUMEN DE FORMA DE PAGO
        const generarResumenFormaPago = () => {
            let contenido = '';

            if (datos.cashea) {
                contenido = `
                            <div class="resumen-venta page-break-avoid">
                                <h6 style="font-weight: bold; margin-bottom: 8px; color: #2c5aa0; border-bottom: 1px solid #2c5aa0; padding-bottom: 3px;">RESUMEN DE VENTA</h6>
                                
                                <div class="resumen-cashea">
                                    <!-- Forma de pago -->
                                    <div style="text-align: center; margin-bottom: 10px;">
                                        <span class="badge bg-info fs-6">PLAN CASHEA</span>
                                    </div>

                                    <!-- Información del plan Cashea -->
                                    <div style="text-align: center; margin-bottom: 10px;">
                                        <div class="cashea-info">
                                            <div class="nivel-cashea" style="margin-bottom: 5px;">
                                                <small class="text-muted">NIVEL</small>
                                                <div class="fw-bold text-primary" style="font-size: 12px;">${this.obtenerNombreNivelCashea(datos.cashea.nivel)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Desglose de pagos -->
                                    <div class="pagos-section">
                                        <h6 style="text-align: center; margin-bottom: 10px; font-weight: bold; color: #2c5aa0; font-size: 12px;">DESGLOSE DE PAGOS</h6>

                                        <!-- Pago inicial -->
                                        <div class="pago-item">
                                            <div style="text-align: center; width: 50%;">
                                                <strong style="font-size: 11px;">Pago Inicial</strong>
                                            </div>
                                            <div style="text-align: center; width: 50%;">
                                                <strong style="font-size: 11px;">${formatearMonedaLocal(datos.cashea.inicial)}</strong>
                                            </div>
                                        </div>

                                        <!-- Cuotas adelantadas -->
                                        ${datos.cashea.cuotasAdelantadas > 0 ? `
                                            <div class="pago-item">
                                                <div style="text-align: center; width: 50%;">
                                                    <strong style="font-size: 11px;">${datos.cashea.cuotasAdelantadas} Cuota${datos.cashea.cuotasAdelantadas > 1 ? 's' : ''} Adelantada${datos.cashea.cuotasAdelantadas > 1 ? 's' : ''}</strong>
                                                </div>
                                                <div style="text-align: center; width: 50%;">
                                                    <strong style="font-size: 11px;">${formatearMonedaLocal(datos.cashea.montoAdelantado)}</strong>
                                                </div>
                                            </div>
                                        ` : ''}

                                        <!-- Total pagado ahora -->
                                        <div class="pago-total">
                                            <div style="text-align: center; width: 50%;">
                                                <strong style="font-size: 11px;">TOTAL PAGADO AHORA:</strong>
                                            </div>
                                            <div style="text-align: center; width: 50%;">
                                                <strong class="text-success" style="font-size: 11px;">${formatearMonedaLocal(datos.totales.totalPagado)}</strong>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Resumen de cuotas -->
                                    <div class="resumen-cuotas-compacto">
                                        <div class="cuota-info">
                                            <small class="text-muted" style="font-size: 10px;">CUOTAS PENDIENTES</small>
                                            <div class="fw-bold text-warning" style="font-size: 12px;">${datos.cashea.cantidadCuotas - datos.cashea.cuotasAdelantadas}</div>
                                            <div class="monto-cuota">${formatearMonedaLocal(datos.cashea.montoPorCuota)} c/u</div>
                                        </div>
                                        <div class="cuota-info">
                                            <small class="text-muted" style="font-size: 10px;">DEUDA PENDIENTE</small>
                                            <div class="fw-bold text-danger" style="font-size: 12px;">${formatearMonedaLocal(datos.cashea.deudaPendiente)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
            } else if (datos.abono) {
                contenido = `
                            <div class="resumen-venta page-break-avoid">
                                <h6 style="font-weight: bold; margin-bottom: 8px; color: #2c5aa0; border-bottom: 1px solid #2c5aa0; padding-bottom: 3px;">RESUMEN DE VENTA</h6>
                                
                                <div class="resumen-abono">
                                    <!-- Forma de pago -->
                                    <div style="text-align: center; margin-bottom: 10px;">
                                        <span class="badge bg-warning text-dark fs-6">ABONO PARCIAL</span>
                                    </div>

                                    <!-- Abonos realizados -->
                                    <div class="abonos-section">
                                        <h6 style="text-align: center; margin-bottom: 10px; font-weight: bold; color: #2c5aa0; font-size: 12px;">ABONOS REALIZADOS</h6>

                                        <div class="abonos-list">
                                            <div class="abono-item">
                                                <div style="text-align: center; width: 50%;">
                                                    <strong style="font-size: 11px;">${datos.fecha}</strong>
                                                </div>
                                                <div style="text-align: center; width: 50%;">
                                                    <strong style="font-size: 11px;">${formatearMonedaLocal(datos.abono.montoAbonado)}</strong>
                                                </div>
                                            </div>
                                            
                                            <!-- Total abonado -->
                                            <div class="abono-item total-abonado" style="border-top: 1px solid #ccc; padding-top: 5px; margin-top: 5px;">
                                                <div style="text-align: center; width: 50%;">
                                                    <strong style="font-size: 11px;">TOTAL ABONADO:</strong>
                                                </div>
                                                <div style="text-align: center; width: 50%;">
                                                    <strong class="text-success" style="font-size: 11px;">${formatearMonedaLocal(datos.abono.montoAbonado)}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Resumen financiero -->
                                    <div class="resumen-financiero">
                                        <div class="deuda-section">
                                            <div class="deuda-label">DEUDA PENDIENTE</div>
                                            <div class="deuda-monto text-danger">${formatearMonedaLocal(datos.abono.deudaPendiente)}</div>
                                        </div>

                                        <div class="progreso-section">
                                            <div class="progreso-label">PORCENTAJE PAGADO</div>
                                            <div class="progreso-porcentaje text-success">${Math.round(datos.abono.porcentajePagado)}%</div>
                                            <div class="progress">
                                                <div class="progress-bar" style="width: ${datos.abono.porcentajePagado}%"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
            } else {
                contenido = `
                            <div class="resumen-venta page-break-avoid">
                                <h6 style="font-weight: bold; margin-bottom: 8px; color: #2c5aa0; border-bottom: 1px solid #2c5aa0; padding-bottom: 3px;">RESUMEN DE VENTA</h6>
                                
                                <div class="resumen-contado">
                                    <div style="margin-bottom: 8px;">
                                        <strong style="font-size: 12px;">Forma de pago:</strong><br>
                                        <span class="badge bg-success">CONTADO</span>
                                    </div>
                                    <div>
                                        <strong style="font-size: 12px;">Monto total:</strong><br>
                                        ${formatearMonedaLocal(datos.totales.totalPagado)}
                                    </div>
                                    <div style="margin-top: 8px; font-size: 11px; color: #666;">
                                        El pago ha sido realizado en su totalidad
                                    </div>
                                </div>
                            </div>
                        `;
            }

            return contenido;
        };

        // GENERAR MÉTODOS DE PAGO
        const generarMetodosPago = () => {
            if (!datos.metodosPago || datos.metodosPago.length === 0) {
                return '';
            }

            return `
                        <div class="metodos-pago page-break-avoid" style="margin-bottom: 10px;">
                            <h6 style="font-weight: bold; margin-bottom: 8px; color: #2c5aa0; border-bottom: 1px solid #2c5aa0; padding-bottom: 3px;">MÉTODOS DE PAGO</h6>
                            ${datos.metodosPago.map((metodo: any) => `
                                <div class="metodo-item">
                                    <span>
                                        <span class="badge bg-primary">${this.formatearTipoPago(metodo.tipo)}</span>
                                        ${metodo.referencia ? '- Ref: ' + metodo.referencia : ''}
                                        ${metodo.banco ? '- ' + metodo.banco : ''}
                                    </span>
                                    <span>${formatearMonedaLocal(metodo.monto, metodo.moneda)}</span>
                                </div>
                            `).join('')}
                        </div>
                    `;
        };

        // GENERAR TOTALES
        const generarTotales = () => {
            const mostrarTotalAPagar = this.debeMostrarTotalAPagar(formaPago, datos);
            const textoTotalAPagar = this.getTextoTotalAPagarParaHTML(formaPago);
            const textoTotalPagado = this.getTextoTotalPagadoParaHTML(formaPago);

            return `
                        <div class="totales-compactos page-break-avoid">
                            <div style="display: flex; justify-content: flex-end;">
                                <div style="width: 50%;">
                                    <table style="width: 100%;">
                                        <tr>
                                            <td class="fw-bold" style="font-size: 12px;">Subtotal:</td>
                                            <td class="text-end" style="font-size: 12px;">${formatearMonedaLocal(datos.totales.subtotal)}</td>
                                        </tr>
                                        ${datos.totales.descuento > 0 ? `
                                            <tr>
                                                <td class="fw-bold" style="font-size: 12px;">Descuento:</td>
                                                <td class="text-end text-danger" style="font-size: 12px;">- ${formatearMonedaLocal(datos.totales.descuento)}</td>
                                            </tr>
                                        ` : ''}
                                        <tr>
                                            <td class="fw-bold" style="font-size: 12px;">IVA:</td>
                                            <td class="text-end" style="font-size: 12px;">${formatearMonedaLocal(datos.totales.iva)}</td>
                                        </tr>
                                        ${mostrarTotalAPagar ? `
                                            <tr class="table-info">
                                                <td class="fw-bold" style="font-size: 13px;">${textoTotalAPagar}:</td>
                                                <td class="text-end fw-bold" style="font-size: 13px;">${formatearMonedaLocal(datos.totales.total)}</td>
                                            </tr>
                                        ` : ''}
                                        <tr class="table-success">
                                            <td class="fw-bold" style="font-size: 13px;">${textoTotalPagado}:</td>
                                            <td class="text-end fw-bold" style="font-size: 13px;">${formatearMonedaLocal(datos.totales.totalPagado)}</td>
                                        </tr>
                                    </table>
                                </div>
                            </div>
                        </div>
                    `;
        };

        return `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Recibo - ${datos.numeroVenta}</title>
                <style>
                    /* ESTILOS MEJORADOS - FUENTES AUMENTADAS */
                    @page {
                        margin: 0;
                        size: A4;
                    }
                    
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Arial', sans-serif;
                        font-size: 12px;
                        line-height: 1.25;
                        color: #333;
                        background: white;
                        padding: 15mm 12mm 12mm 12mm;
                        width: 210mm;
                        height: 297mm;
                        margin: 0 auto;
                    }
                    
                    .recibo-container {
                        width: 100%;
                        max-width: 186mm;
                        margin: 0 auto;
                        background: white;
                        padding: 0;
                        height: auto;
                        max-height: 255mm;
                        overflow: hidden;
                    }
                    
                    .recibo-header {
                        text-align: center;
                        border-bottom: 2px solid #2c5aa0;
                        padding-bottom: 8px;
                        margin-bottom: 10px;
                    }
                    
                    .empresa-nombre {
                        font-size: 18px;
                        font-weight: bold;
                        color: #2c5aa0;
                        margin-bottom: 3px;
                    }
                    
                    .empresa-info {
                        font-size: 10px;
                        color: #666;
                        margin-bottom: 2px;
                        line-height: 1.3;
                    }
                    
                    .titulo-venta {
                        font-size: 14px;
                        font-weight: 600;
                        color: #2c5aa0;
                        margin: 8px 0 4px 0;
                    }
                    
                    .info-rapida {
                        background: #f8f9fa;
                        padding: 6px;
                        border-radius: 3px;
                        border: 1px solid #dee2e6;
                        margin-bottom: 10px;
                        font-size: 10px;
                    }
                    
                    .cliente-compacto {
                        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                        border-left: 3px solid #2c5aa0;
                        padding: 8px;
                        font-size: 10px;
                        margin-bottom: 10px;
                        border-radius: 3px;
                    }
                    
                    .tabla-productos {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 10px;
                        font-size: 10px;
                    }
                    
                    .tabla-productos th {
                        background: #2c5aa0;
                        color: white;
                        font-weight: 600;
                        padding: 4px 5px;
                        text-align: left;
                        border: 1px solid #dee2e6;
                        font-size: 10px;
                    }
                    
                    .tabla-productos td {
                        border: 1px solid #dee2e6;
                        padding: 3px 4px;
                        vertical-align: middle;
                        font-size: 10px;
                    }
                    
                    .text-center { text-align: center; }
                    .text-end { text-align: right; }
                    
                    .metodo-item {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 4px;
                        padding: 3px 0;
                        border-bottom: 1px dashed #dee2e6;
                        font-size: 10px;
                    }
                    
                    .resumen-cashea {
                        background: #f8f9fa;
                        padding: 8px;
                        border-radius: 4px;
                        margin: 8px 0;
                        border-left: 3px solid #0dcaf0;
                    }
                    
                    .pago-item {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 4px;
                        padding: 4px 0;
                        border-bottom: 1px dashed #dee2e6;
                        font-size: 10px;
                    }
                    
                    .pago-total {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 6px;
                        padding-top: 6px;
                        border-top: 1px solid #ccc;
                        font-size: 10px;
                    }
                    
                    .resumen-cuotas-compacto {
                        display: flex;
                        justify-content: center;
                        gap: 18px;
                        margin-top: 8px;
                        text-align: center;
                    }
                    
                    .monto-cuota {
                        font-size: 9px;
                        color: #666;
                        margin-top: 2px;
                    }
                    
                    .resumen-abono {
                        background: #f8f9fa;
                        padding: 8px;
                        border-radius: 4px;
                        margin: 8px 0;
                        border-left: 3px solid #ffc107;
                    }
                    
                    .abono-item {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 4px;
                        padding: 4px 0;
                        border-bottom: 1px dashed #dee2e6;
                        font-size: 10px;
                    }
                    
                    .total-abonado {
                        border-top: 1px solid #ccc;
                        padding-top: 4px;
                        margin-top: 4px;
                    }
                    
                    .resumen-financiero {
                        background: white;
                        padding: 8px;
                        border-radius: 4px;
                        border: 1px solid #e9ecef;
                        margin: 8px 0;
                    }
                    
                    .deuda-section, .progreso-section {
                        text-align: center;
                        margin-bottom: 8px;
                    }
                    
                    .deuda-label, .progreso-label {
                        font-size: 9px;
                        color: #666;
                        margin-bottom: 2px;
                    }
                    
                    .deuda-monto, .progreso-porcentaje {
                        font-size: 12px;
                        font-weight: bold;
                    }
                    
                    .resumen-contado {
                        background: #f8f9fa;
                        padding: 8px;
                        border-radius: 4px;
                        margin: 8px 0;
                        border-left: 3px solid #198754;
                        text-align: center;
                    }
                    
                    .totales-compactos table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 11px;
                    }
                    
                    .totales-compactos td {
                        padding: 4px 5px;
                        border: 1px solid #dee2e6;
                    }
                    
                    .table-success {
                        background: linear-gradient(135deg, #d4edda, #c3e6cb);
                    }
                    
                    .table-info {
                        background: linear-gradient(135deg, #d1ecf1, #c3e6ff);
                    }
                    
                    .observaciones-compactas {
                        margin-bottom: 10px;
                    }
                    
                    .alert-warning {
                        background: #fff3cd;
                        border: 1px solid #ffeaa7;
                        color: #856404;
                        padding: 6px;
                        border-radius: 3px;
                        font-size: 10px;
                    }
                    
                    .terminos-compactos {
                        border-top: 1px solid #ddd;
                        padding-top: 8px;
                        margin-top: 10px;
                        font-size: 9px;
                        color: #666;
                    }
                    
                    .mensaje-final {
                        text-align: center;
                        border-top: 1px solid #ddd;
                        padding-top: 8px;
                        margin-top: 8px;
                        font-size: 11px;
                        color: #2c5aa0;
                        font-weight: bold;
                    }
                    
                    .text-danger { color: #dc3545; }
                    .text-success { color: #198754; }
                    .text-warning { color: #ffc107; }
                    .text-primary { color: #2c5aa0; }
                    .text-muted { color: #666; }
                    
                    .badge {
                        display: inline-block;
                        padding: 2px 4px;
                        font-size: 9px;
                        font-weight: 600;
                        line-height: 1.2;
                        text-align: center;
                        white-space: nowrap;
                        vertical-align: baseline;
                        border-radius: 2px;
                    }
                    
                    .bg-primary { background-color: #2c5aa0; color: white; }
                    .bg-success { background-color: #198754; color: white; }
                    .bg-info { background-color: #0dcaf0; color: black; }
                    .bg-warning { background-color: #ffc107; color: black; }
                    
                    .progress {
                        background-color: #e9ecef;
                        border-radius: 4px;
                        overflow: hidden;
                        height: 4px;
                        margin: 3px auto;
                        width: 60%;
                    }
                    
                    .progress-bar {
                        background-color: #198754;
                        height: 100%;
                        transition: width 0.6s ease;
                    }
                    
                    .fw-bold { font-weight: bold; }
                    .small { font-size: 9px; }
                    .fs-6 { font-size: 12px; }

                    .page-break-avoid {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    @media print {
                        body {
                            padding: 15mm 12mm 12mm 12mm;
                            margin: 0;
                            width: 210mm;
                            height: 297mm;
                            font-size: 11px;
                        }
                        
                        .recibo-container {
                            border: none;
                            padding: 0;
                            box-shadow: none;
                            max-height: 255mm;
                            overflow: hidden;
                        }

                        @page {
                            margin: 0;
                            size: A4;
                        }
                        
                        body {
                            margin: 0;
                            -webkit-print-color-adjust: exact;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="recibo-container page-break-avoid">
                    <!-- ENCABEZADO DINÁMICO CON INFO DE SEDE -->
                    <div class="recibo-header page-break-avoid">
                        ${generarEncabezadoSede()}
                        <div class="titulo-venta">${tituloRecibo}</div>
                    </div>

                    <!-- Información rápida -->
                    <div class="info-rapida page-break-avoid">
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px;">
                            <div><strong>Recibo:</strong> ${datos.numeroVenta}</div>
                            <div><strong>Fecha:</strong> ${datos.fecha}</div>
                            <div><strong>Hora:</strong> ${datos.hora}</div>
                            <div><strong>Vendedor:</strong> ${datos.vendedor}</div>
                        </div>
                    </div>

                    <!-- Cliente -->
                    ${generarClienteHTML()}

                    <!-- Productos -->
                    ${generarTablaProductos()}

                    <!-- Métodos de pago -->
                    ${generarMetodosPago()}

                    <!-- Sección de Forma de Pago -->
                    ${generarResumenFormaPago()}

                    <!-- Totales -->
                    ${generarTotales()}

                    <!-- Observaciones -->
                    ${datos.configuracion?.observaciones ? `
                        <div class="observaciones-compactas page-break-avoid">
                            <div class="alert-warning">
                                <strong>Observación:</strong> ${datos.configuracion.observaciones}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Términos y condiciones -->
                    <div class="terminos-compactos page-break-avoid">
                        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px;">
                            <div>
                                <p style="margin-bottom: 3px;">
                                    <i class="bi bi-exclamation-triangle"></i>
                                    Pasados 30 días no nos hacemos responsables de trabajos no retirados
                                </p>
                                <p style="margin-bottom: 0;">
                                    <i class="bi bi-info-circle"></i>
                                    Estado de orden: tracking.optolapp.com
                                </p>
                            </div>
                            <div style="text-align: right;">
                                <small>${new Date().getFullYear()} © ${sedeInfo?.nombre_optica || 'New Vision Lens'}</small>
                            </div>
                        </div>
                    </div>

                    <!-- Mensaje final -->
                    <div class="mensaje-final page-break-avoid">
                        <i class="bi bi-check-circle"></i>
                        ${mensajeFinal}
                    </div>
                </div>
            </body>
            </html>
            `;
    }

    /**
     * Determina si debe mostrar el "Total a pagar" según la forma de pago
     */
    private debeMostrarTotalAPagar(formaPago: string, datos: any): boolean {
        switch (formaPago) {
            case 'contado':
                // Contado: siempre mostrar solo el total pagado (no hay deuda)
                return false;

            case 'cashea':
                // Cashea: mostrar si hay deuda pendiente
                const deudaCashea = datos.cashea?.deudaPendiente || 0;
                return deudaCashea > 0.01;

            case 'abono':
                // Abono: mostrar si hay deuda pendiente
                const deudaAbono = datos.abono?.deudaPendiente || 0;
                return deudaAbono > 0.01;

            default:
                return false;
        }
    }

    /**
     * Obtiene el texto para "Total a pagar" según la forma de pago
     */
    private getTextoTotalAPagarParaHTML(formaPago: string): string {
        switch (formaPago) {
            case 'cashea':
                return 'Total a pagar';
            case 'abono':
                return 'Total a pagar';
            case 'contado':
            default:
                return 'Total';
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
                return '¡Gracias por su abono!';
            case 'cashea':
                return '¡Gracias por su compra! Plan Cashea activado';
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
        // Generar cuotas Cashea si no existen
        if (this.venta.formaPago === 'cashea' && (!this.cuotasCashea || this.cuotasCashea.length === 0)) {
            this.generarCuotasCashea();
        }

        const datos = this.datosRecibo || this.crearDatosReciboReal();
        const htmlContent = this.generarReciboHTML(datos);

        const ventanaImpresion = window.open('', '_blank', 'width=400,height=600');

        if (!ventanaImpresion) {
            this.swalService.showError('Error', 'No se pudo abrir la ventana de impresión. Permite ventanas emergentes.');
            return;
        }

        ventanaImpresion.document.write(htmlContent);
        ventanaImpresion.document.close();

        // Esperar a que el contenido se cargue completamente
        ventanaImpresion.onload = () => {
            setTimeout(() => {
                try {
                    ventanaImpresion.focus();

                    // Agregar evento para cerrar la ventana después de imprimir
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
                    // Cerrar la ventana incluso si hay error
                    setTimeout(() => {
                        ventanaImpresion.close();
                    }, 2000);
                }
            }, 500);
        };

        // Fallback: cerrar después de un tiempo si no se detecta la impresión
        setTimeout(() => {
            if (!ventanaImpresion.closed) {
                ventanaImpresion.close();
            }
        }, 10000); // Cerrar después de 10 segundos como máximo
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
        this.datosRecibo = null;

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
            'debito': 'T. DÉBITO',
            'credito': 'T. CRÉDITO',
            'pagomovil': 'PAGO MÓVIL',
            'transferencia': 'TRANSFERENCIA',
            'zelle': 'ZELLE'
        };
        return tipos[tipo] || tipo.toUpperCase();
    }

    async descargarPDF(): Promise<void> {
        try {
            // Preparar datos si es necesario
            if (this.venta.formaPago === 'cashea' && (!this.cuotasCashea || this.cuotasCashea.length === 0)) {
                this.generarCuotasCashea();
            }

            const datos = this.datosRecibo || this.crearDatosReciboReal();

            // Mostrar loading
            this.swalService.showLoadingAlert('🖨️ Generando PDF...');

            // Llamar directamente al método que genera PDF
            await this.generarPDFConTexto(datos);

        } catch (error) {
            console.error('Error al generar PDF:', error);
            this.swalService.closeLoading();

            // Mostrar error al usuario
            this.swalService.showError(
                'Error al generar PDF',
                'No se pudo generar el archivo PDF. Por favor, intente de nuevo.'
            );
        }
    }

    private generarPDFConTexto(datos: any): void {
        try {
            this.swalService.showLoadingAlert('🖨️ Generando PDF...');

            // Crear PDF
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // Márgenes reducidos para más espacio
            const marginLeft = 10;
            const marginTop = 10;
            const pageWidth = 210;
            const contentWidth = pageWidth - (marginLeft * 2);
            let currentY = marginTop;

            // Obtener información de la sede desde UserStateService
            const sedeInfo = this.userStateService.getSedeActual() || this.obtenerInfoSede();

            // Determinar si es paciente
            const esPaciente = datos.cliente?.tipo === 'PACIENTE' || datos.cliente?.esPaciente === true;
            const labelCliente = esPaciente ? 'Paciente:' : 'Cliente:';
            const nombreDefault = esPaciente ? 'PACIENTE' : 'CLIENTE GENERAL';

            // ===== 1. ENCABEZADO DE LA EMPRESA =====
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(0, 0, 0);
            pdf.text(sedeInfo.nombre_optica || sedeInfo.nombre || 'NEW VISION LENS', 105, currentY, { align: 'center' });
            currentY += 6;

            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');

            // Dirección
            const direccion = sedeInfo.direccion || 'C.C. Candelaria, Local PB-04, Guarenas';
            pdf.text(direccion, 105, currentY, { align: 'center' });
            currentY += 4;

            // Teléfono y RIF
            const telefono = sedeInfo.telefono || '0212-365-39-42';
            const rif = sedeInfo.rif ? sedeInfo.rif.replace(/^rif/i, '').trim() : 'J-123456789';
            pdf.text(`Tel: ${telefono} | RIF: ${rif}`, 105, currentY, { align: 'center' });
            currentY += 4;

            // Email
            const email = sedeInfo.email || 'newvisionlens2020@gmail.com';
            pdf.text(`Email: ${email}`, 105, currentY, { align: 'center' });
            currentY += 6;

            // Línea separadora
            pdf.setDrawColor(44, 90, 160);
            pdf.setLineWidth(0.5);
            pdf.line(marginLeft, currentY, 195, currentY);
            currentY += 8;

            // Título del recibo
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(44, 90, 160);
            pdf.text('RECIBO DE VENTA', 105, currentY, { align: 'center' });
            currentY += 8;

            // ===== 2. INFORMACIÓN RÁPIDA =====
            // Fondo gris claro
            pdf.setFillColor(248, 249, 250);
            pdf.roundedRect(marginLeft, currentY, contentWidth, 10, 1, 1, 'F');

            // Bordes
            pdf.setDrawColor(222, 226, 230);
            pdf.setLineWidth(0.2);
            pdf.roundedRect(marginLeft, currentY, contentWidth, 10, 1, 1, 'S');

            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(51, 51, 51);

            const gridWidth = contentWidth / 4;
            const gridX = [marginLeft, marginLeft + gridWidth, marginLeft + (gridWidth * 2), marginLeft + (gridWidth * 3)];
            const gridTextY = currentY + 7;

            // Recibo
            pdf.setFont('helvetica', 'bold');
            pdf.text('Recibo:', gridX[0] + 3, gridTextY);
            pdf.setFont('helvetica', 'normal');
            pdf.text(datos.numeroVenta, gridX[0] + 15, gridTextY);

            // Fecha
            pdf.setFont('helvetica', 'bold');
            pdf.text('Fecha:', gridX[1] + 3, gridTextY);
            pdf.setFont('helvetica', 'normal');
            pdf.text(datos.fecha, gridX[1] + 15, gridTextY);

            // Hora
            pdf.setFont('helvetica', 'bold');
            pdf.text('Hora:', gridX[2] + 3, gridTextY);
            pdf.setFont('helvetica', 'normal');
            pdf.text(datos.hora, gridX[2] + 12, gridTextY);

            // Vendedor
            pdf.setFont('helvetica', 'bold');
            pdf.text('Vendedor:', gridX[3] + 3, gridTextY);
            pdf.setFont('helvetica', 'normal');
            pdf.text(datos.vendedor, gridX[3] + 20, gridTextY);

            currentY += 12;

            // ==== 3. INFORMACIÓN DEL CLIENTE ====
            const colorPaciente = [13, 202, 240];
            const colorCliente = [44, 90, 160];

            pdf.setDrawColor(
                esPaciente ? colorPaciente[0] : colorCliente[0],
                esPaciente ? colorPaciente[1] : colorCliente[1],
                esPaciente ? colorPaciente[2] : colorCliente[2]
            );
            pdf.setLineWidth(2);
            pdf.line(marginLeft, currentY, marginLeft, currentY + 12);

            // Bordes restantes
            pdf.setDrawColor(222, 226, 230);
            pdf.setLineWidth(0.2);
            pdf.roundedRect(marginLeft, currentY, contentWidth, 12, 1, 1, 'S');

            pdf.setFontSize(8);
            pdf.setTextColor(51, 51, 51);

            const clienteGridWidth = contentWidth / 3;
            const clienteGridX = [marginLeft, marginLeft + clienteGridWidth, marginLeft + (clienteGridWidth * 2)];
            const clienteTextY = currentY + 8;

            // Cliente - USAR LABEL DINÁMICO
            pdf.setFont('helvetica', 'bold');
            pdf.text(labelCliente, clienteGridX[0] + 3, clienteTextY);
            pdf.setFont('helvetica', 'normal');
            // Usar nombreDefault si no hay nombre
            pdf.text(datos.cliente.nombre || nombreDefault, clienteGridX[0] + 20, clienteTextY);

            // Cédula
            pdf.setFont('helvetica', 'bold');
            pdf.text('Cédula:', clienteGridX[1] + 3, clienteTextY);
            pdf.setFont('helvetica', 'normal');
            pdf.text(datos.cliente.cedula || 'N/A', clienteGridX[1] + 15, clienteTextY);

            // Teléfono
            pdf.setFont('helvetica', 'bold');
            pdf.text('Teléfono:', clienteGridX[2] + 3, clienteTextY);
            pdf.setFont('helvetica', 'normal');
            pdf.text(datos.cliente.telefono || 'N/A', clienteGridX[2] + 20, clienteTextY);

            currentY += 14;

            // ===== 4. TABLA DE PRODUCTOS =====
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(44, 90, 160);
            pdf.text('PRODUCTOS', marginLeft, currentY);

            // Línea debajo del título
            pdf.setDrawColor(44, 90, 160);
            pdf.setLineWidth(0.5);
            pdf.line(marginLeft, currentY + 1, marginLeft + 25, currentY + 1);

            currentY += 6;

            // Preparar datos para la tabla
            const tableData = datos.productos.map((producto: any, index: number) => [
                (index + 1).toString(),
                producto.nombre,
                producto.cantidad.toString(),
                this.formatearMonedaParaPDF(producto.precioUnitario),
                this.formatearMonedaParaPDF(producto.subtotal)
            ]);

            // Crear tabla con autoTable
            autoTable(pdf, {
                startY: currentY,
                margin: { left: marginLeft, right: 10 },
                head: [['#', 'Descripción', 'Cant', 'P. Unitario', 'Subtotal']],
                body: tableData,
                headStyles: {
                    fillColor: [44, 90, 160], // Azul
                    textColor: [255, 255, 255], // Blanco
                    fontStyle: 'bold',
                    fontSize: 8,
                    cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
                    halign: 'left'
                },
                bodyStyles: {
                    fontSize: 8,
                    cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
                    textColor: [51, 51, 51],
                    lineColor: [222, 226, 230]
                },
                styles: {
                    lineWidth: 0.2,
                    lineColor: [222, 226, 230]
                },
                columnStyles: {
                    0: {
                        cellWidth: 10,
                        halign: 'center',
                        cellPadding: { top: 2, right: 1, bottom: 2, left: 1 }
                    },
                    1: {
                        cellWidth: 90,
                        cellPadding: { top: 2, right: 2, bottom: 2, left: 2 }
                    },
                    2: {
                        cellWidth: 15,
                        halign: 'center',
                        cellPadding: { top: 2, right: 1, bottom: 2, left: 1 }
                    },
                    3: {
                        cellWidth: 25,
                        halign: 'right',
                        cellPadding: { top: 2, right: 3, bottom: 2, left: 1 }
                    },
                    4: {
                        cellWidth: 25,
                        halign: 'right',
                        cellPadding: { top: 2, right: 3, bottom: 2, left: 1 }
                    }
                },
                theme: 'grid',
                didDrawPage: (data) => {
                    // Evitar que la tabla se corte mal
                    if (data.cursor.y > 250) {
                        pdf.addPage();
                        currentY = marginTop;
                    }
                }
            });

            // Obtener la posición Y después de la tabla
            currentY = (pdf as any).lastAutoTable.finalY + 8;

            // ===== 5. MÉTODOS DE PAGO =====
            if (datos.metodosPago && datos.metodosPago.length > 0) {
                datos.metodosPago.forEach((metodo: any) => {
                    const metodoX = marginLeft;
                    const metodoWidth = contentWidth;

                    // Línea punteada
                    const dashPattern = [2, 2];
                    pdf.setLineDashPattern(dashPattern, 0);
                    pdf.setDrawColor(222, 226, 230);
                    pdf.setLineWidth(0.3);
                    pdf.line(metodoX, currentY, metodoX + metodoWidth, currentY);
                    pdf.setLineDashPattern([], 0);

                    currentY += 3;

                    // Badge del tipo de pago
                    pdf.setFillColor(44, 90, 160);
                    pdf.roundedRect(metodoX, currentY - 1, 15, 4, 1, 1, 'F');

                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(7);
                    pdf.setTextColor(255, 255, 255);
                    const tipoPagoAbrev = this.formatearTipoPago(metodo.tipo).substring(0, 8);
                    pdf.text(tipoPagoAbrev, metodoX + 2, currentY + 1);

                    // Texto del método
                    pdf.setFontSize(8);
                    pdf.setTextColor(51, 51, 51);
                    pdf.setFont('helvetica', 'normal');

                    let metodoText = '';
                    if (metodo.referencia) {
                        metodoText += ` - Ref: ${metodo.referencia}`;
                    }
                    if (metodo.banco) {
                        metodoText += ` - ${metodo.banco}`;
                    }

                    if (metodoText) {
                        pdf.text(metodoText, metodoX + 18, currentY + 1);
                    }

                    // Monto
                    pdf.text(this.formatearMonedaParaPDF(metodo.monto, metodo.moneda),
                        metodoX + metodoWidth - 2, currentY + 1, { align: 'right' });

                    currentY += 6;
                });
                currentY += 2;
            }

            // ===== 6. SECCIÓN DE FORMA DE PAGO =====
            const formaPago = datos.configuracion?.formaPago || 'contado';

            if (formaPago === 'contado') {
                pdf.setFillColor(248, 249, 250);
                pdf.roundedRect(marginLeft, currentY, contentWidth, 20, 2, 2, 'F');

                pdf.setDrawColor(25, 135, 84);
                pdf.setLineWidth(2);
                pdf.line(marginLeft, currentY, marginLeft, currentY + 20);

                pdf.setDrawColor(222, 226, 230);
                pdf.setLineWidth(0.2);
                pdf.roundedRect(marginLeft, currentY, contentWidth, 20, 2, 2, 'S');

                const centerX = marginLeft + (contentWidth / 2);
                const contentStartY = currentY + 8;

                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(51, 51, 51);
                pdf.text('Forma de pago:', centerX, contentStartY, { align: 'center' });

                // Badge CONTADO
                pdf.setFillColor(25, 135, 84);
                pdf.roundedRect(centerX - 15, contentStartY + 4, 30, 6, 3, 3, 'F');

                pdf.setFontSize(9);
                pdf.setTextColor(255, 255, 255);
                pdf.text('CONTADO', centerX, contentStartY + 7, { align: 'center' });

                pdf.setFontSize(10);
                pdf.setTextColor(51, 51, 51);
                pdf.text('Monto total:', centerX, contentStartY + 16, { align: 'center' });

                pdf.text(this.formatearMonedaParaPDF(datos.totales.totalPagado), centerX, contentStartY + 22, { align: 'center' });

                currentY += 25;
            }

            // ===== 7. TOTALES =====
            currentY += 4;

            const totalesWidth = contentWidth / 2;
            const totalesX = marginLeft + (contentWidth - totalesWidth);

            // Crear tabla de totales
            const totalesData = [
                ['Subtotal:', this.formatearMonedaParaPDF(datos.totales.subtotal)],
                ['Descuento:', `- ${this.formatearMonedaParaPDF(datos.totales.descuento)}`],
                ['IVA:', this.formatearMonedaParaPDF(datos.totales.iva)],
                ['TOTAL:', this.formatearMonedaParaPDF(datos.totales.totalPagado)]
            ];

            // Dibujar tabla de totales
            let totalY = currentY;
            totalesData.forEach((row, index) => {
                const isTotal = index === 3;

                // Fondo para total
                if (isTotal) {
                    pdf.setFillColor(212, 237, 218);
                    pdf.rect(totalesX, totalY - 3, totalesWidth, 6, 'F');
                }

                // Bordes
                pdf.setDrawColor(222, 226, 230);
                pdf.setLineWidth(0.2);
                pdf.rect(totalesX, totalY - 3, totalesWidth, 6, 'S');

                // Texto
                pdf.setFontSize(isTotal ? 11 : 10);
                pdf.setFont('helvetica', 'bold');

                if (index === 1) { // Descuento
                    pdf.setTextColor(220, 53, 69);
                } else if (isTotal) {
                    pdf.setTextColor(25, 135, 84);
                } else {
                    pdf.setTextColor(51, 51, 51);
                }

                // Etiqueta
                pdf.text(row[0], totalesX + 4, totalY);

                // Valor
                pdf.text(row[1], totalesX + totalesWidth - 4, totalY, { align: 'right' });

                totalY += 6;
            });

            currentY = totalY + 8;

            // ===== 8. OBSERVACIONES =====
            if (datos.configuracion?.observaciones) {
                pdf.setFillColor(255, 243, 205);
                pdf.setDrawColor(255, 234, 167);
                pdf.setLineWidth(0.5);
                pdf.roundedRect(marginLeft, currentY, contentWidth, 8, 1, 1, 'FD');

                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(133, 100, 4);
                pdf.text(`Observación: ${datos.configuracion.observaciones}`, marginLeft + 4, currentY + 5);

                currentY += 10;
            }

            // ===== 9. TÉRMINOS Y CONDICIONES =====
            const terminosY = Math.min(currentY, 270);

            // Línea separadora
            pdf.setDrawColor(221, 221, 221);
            pdf.setLineWidth(0.5);
            pdf.line(marginLeft, terminosY, 195, terminosY);

            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(102, 102, 102);

            // Términos
            pdf.text('Pasados 30 días no nos hacemos responsables de trabajos no retirados',
                marginLeft, terminosY + 6);
            pdf.text('Estado de orden: tracking.optolapp.com',
                marginLeft, terminosY + 12);

            // Copyright
            const copyrightText = `${new Date().getFullYear()} © ${sedeInfo.nombre_optica || sedeInfo.nombre || 'New Vision Lens'}`;
            pdf.text(copyrightText, 195, terminosY + 18, { align: 'right' });

            // ===== 10. MENSAJE FINAL =====
            const mensajeFinalY = Math.min(terminosY + 24, 285);

            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(44, 90, 160);
            pdf.text('✓ ¡Gracias por su compra!', 105, mensajeFinalY, { align: 'center' });

            // ===== 11. GUARDAR PDF =====
            pdf.save(`Recibo_${datos.numeroVenta}.pdf`);

            // Cerrar loading
            setTimeout(() => {
                this.swalService.closeLoading();
            }, 500);

        } catch (error) {
            console.error('Error generando PDF con texto:', error);
            this.swalService.closeLoading();
            this.swalService.showError('Error', 'No se pudo generar el PDF.');
            throw error;
        }
    }

    // Mantén este método auxiliar para formatear moneda
    private formatearMonedaParaPDF(monto: number | null | undefined, moneda?: string): string {
        if (monto === null || monto === undefined || isNaN(monto)) {
            return '$0,00';
        }

        const montoNumerico = Number(monto);
        if (isNaN(montoNumerico)) {
            return '$0,00';
        }

        // Formatear al estilo venezolano
        const partes = montoNumerico.toFixed(2).split('.');
        let parteEntera = partes[0];
        let parteDecimal = partes[1] || '00';

        // Agregar separadores de miles
        parteEntera = parteEntera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

        // Determinar símbolo
        let simbolo = '$';
        if (moneda) {
            const monedaNormalizada = moneda.toLowerCase();
            if (monedaNormalizada === 'bolivar' || monedaNormalizada === 'ves' || monedaNormalizada === 'bs') {
                simbolo = 'Bs.';
                return `${simbolo} ${parteEntera},${parteDecimal}`;
            } else if (monedaNormalizada === 'euro' || monedaNormalizada === 'eur') {
                simbolo = '€';
            }
        }

        return `${simbolo}${parteEntera},${parteDecimal}`;
    }

    async copiarEnlace(): Promise<void> {
        try {
            this.swalService.showLoadingAlert('Generando enlace de descarga...');

            const datos = this.datosRecibo || this.crearDatosReciboReal();

            // EN LUGAR de generar PDF, creamos un texto con la información
            let texto = `📋 NEW VISION LENS - Recibo de Venta\n\n` +
                `Recibo: ${datos.numeroVenta}\n` +
                `Fecha: ${datos.fecha}\n` +
                `Hora: ${datos.hora}\n` +
                `Cliente: ${datos.cliente.nombre}\n` +
                `Cédula: ${datos.cliente.cedula}\n` +
                `Teléfono: ${datos.cliente.telefono}\n` +
                `Total: ${this.formatearMoneda(datos.totales.totalPagado)}\n` +
                `Forma de pago: ${this.venta.formaPago.toUpperCase()}\n\n`;

            // Agregar productos
            texto += `PRODUCTOS:\n`;
            datos.productos.forEach((producto: any, index: number) => {
                texto += `${index + 1}. ${producto.nombre} x${producto.cantidad} - ${this.formatearMoneda(producto.subtotal)}\n`;
            });

            texto += `\n📍 NEW VISION LENS\n`;
            texto += `🏪 C.C. Candelaria, Local PB-04, Guarenas\n`;
            texto += `📞 0212-365-39-42\n\n`;
            texto += `_Conserve este comprobante para cualquier reclamo._`;

            // Copiar al portapapeles
            const copiado = await this.copiarAlPortapapeles(texto);

            this.swalService.closeLoading();

            if (copiado) {
                this.swalService.showSuccess('✅ Información Copiada',
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
            banco: m.banco
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

    private crearDatosReciboReal(): any {
        const fechaActual = new Date();

        const sedeInfo = this.obtenerInfoSede();
        const vendedorInfo = this.getResumenAsesor();

        // 1. Calcular SUBTOTAL REAL con IVA
        const subtotalConIva = this.calcularTotalProductos(); // Total con IVA

        // 2. Calcular IVA REAL (ya está en productosConDetalle)
        const ivaReal = this.productosConDetalle?.reduce((sum, p) => {
            return sum + (p.iva || 0);
        }, 0) || 0;

        // 3. Calcular descuento sobre el subtotal con IVA
        const baseParaDescuento = subtotalConIva;
        const descuento = this.venta?.descuento ? (baseParaDescuento * (this.venta.descuento / 100)) : 0;

        // 4. Calcular total REAL (subtotal con IVA - descuento)
        const totalReal = baseParaDescuento - descuento;

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
        const productosConDetalles = this.obtenerProductosConDetalles();

        let clienteInfo = {
            nombre: 'CLIENTE GENERAL',
            cedula: 'N/A',
            telefono: 'N/A',
            esPaciente: false // ← AGREGAR esta propiedad
        };

        if (this.requierePaciente && this.pacienteSeleccionado) {
            clienteInfo = {
                nombre: this.pacienteSeleccionado?.informacionPersonal?.nombreCompleto || 'PACIENTE',
                cedula: this.pacienteSeleccionado?.informacionPersonal?.cedula || 'N/A',
                telefono: this.pacienteSeleccionado?.informacionPersonal?.telefono || 'N/A',
                esPaciente: true // ← AGREGAR esta propiedad
            };
        } else if (!this.requierePaciente) {
            clienteInfo = {
                nombre: this.clienteSinPaciente.nombreCompleto?.trim() || 'CLIENTE GENERAL',
                cedula: this.clienteSinPaciente.cedula?.trim() || 'N/A',
                telefono: this.clienteSinPaciente.telefono?.trim() || 'N/A',
                esPaciente: false // ← AGREGAR esta propiedad
            };
        }

        // MÉTODOS DE PAGO 
        const metodosPagoParaRecibo = this.venta.metodosDePago.map(m => {
            const monedaMetodo = m.moneda || this.getMonedaParaMetodo(m.tipo);

            return {
                tipo: m.tipo || 'efectivo',
                monto: m.monto || 0,
                referencia: m.referencia || '',
                banco: m.banco || '',
                moneda: monedaMetodo
            };
        });

        const datosRecibo: any = {
            // Información general
            numeroVenta: 'V-' + Date.now().toString().slice(-6),
            fecha: fechaActual.toLocaleDateString('es-VE'),
            hora: fechaActual.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
            vendedor: vendedorInfo,

            // Información de la sede
            sede: sedeInfo,

            // INFORMACIÓN CLIENTE - ahora incluye esPaciente
            cliente: clienteInfo,

            // Productos
            productos: productosConDetalles,

            // Métodos de pago 
            metodosPago: metodosPagoParaRecibo,

            // Totales reales
            totales: {
                subtotal: subtotalConIva,
                descuento: descuento,
                iva: ivaReal,
                total: totalReal,
                totalPagado: totalPagado
            },

            // Configuración de la venta
            configuracion: {
                formaPago: this.venta.formaPago,
                moneda: this.venta.moneda,
                descuento: this.venta.descuento,
                observaciones: this.venta.observaciones
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
                abonos: [
                    {
                        fecha: fechaActual.toLocaleDateString('es-VE'),
                        monto: this.venta.montoAbonado || 0,
                        numero: 1
                    }
                ]
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
        // Crear mensaje mejorado
        let mensaje = `*NEW VISION LENS* 🛍️\n\n`;
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
                mensaje += `• ${emoji} ${this.formatearTipoPago(metodo.tipo)}: ${this.formatearMoneda(metodo.monto, metodo.moneda)}\n`;
            });
        }

        mensaje += `\n📍 *NEW VISION LENS*\n`;
        mensaje += `🏪 C.C. Candelaria, Local PB-04, Guarenas\n`;
        mensaje += `📞 0212-365-39-42\n\n`;
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
            'debito': '💳',
            'credito': '💳',
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
            // Para persona jurídica, limpiar nombre y apellido si existen
            this.clienteSinPaciente.nombre = '';
            this.clienteSinPaciente.apellido = '';
            // Puedes agregar lógica adicional aquí si es necesario
        } else {
            // Para persona natural, limpiar razón social si existe
            this.clienteSinPaciente.razonSocial = '';
        }

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
        if (!email || email.trim() === '') return false;

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
        const emailValido = this.validarEmail(cliente.email);

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

        if (!this.validarEmail(email)) {
            this.mostrarErrorEmail();
        } else {
            this.limpiarErrorEmail();
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
        return 'Formato de email inválido. Use: ejemplo@correo.com';
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
        if (!email || email.trim() === '') {
            return { valido: false, mensaje: 'El email es obligatorio' };
        }
        return {
            valido: this.validarEmail(email),
            mensaje: this.getMensajeErrorEmail()
        };
    }

    /**
     * Autocompleta los datos del cliente cuando es encontrado
    */
    private autocompletarDatosCliente(datosCliente: any): void {
        // Actualizar tipo de persona si es diferente (puedes inferirlo del RIF)
        if (datosCliente.cedula && datosCliente.cedula.toUpperCase().startsWith('J')) {
            this.clienteSinPaciente.tipoPersona = 'juridica';
        }

        this.clienteSinPaciente.nombreCompleto = datosCliente.nombre || datosCliente.nombreCompleto || '';
        this.clienteSinPaciente.telefono = datosCliente.telefono || '';
        this.clienteSinPaciente.email = datosCliente.email || '';
        this.clienteSinPaciente.cedula = datosCliente.cedula || this.clienteSinPaciente.cedula;

        // Limpiar errores de validación
        this.limpiarErroresValidacion();
    }

    private limpiarErroresValidacion(): void {
        this.limpiarErrorCedula();
        this.limpiarErrorNombre();
        this.limpiarErrorTelefono();
        this.limpiarErrorEmail();
    }

    onCampoEditadoManualmente(): void {
        if (this.clienteEncontrado || this.validacionIntentada) {
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

        // Resetear estado de validación anterior solo si cambia la cédula
        if (cedula !== this.cedulaAnterior) {
            this.clienteEncontrado = false;
            this.mensajeValidacionCliente = '';
            this.cedulaAnterior = cedula;
        }

        if (!this.validarCedula(cedula, tipoPersona)) {
            this.mostrarErrorCedula();
            this.mensajeValidacionCliente = this.getMensajeErrorCedula();
        } else {
            this.limpiarErrorCedula();
        }

        this.actualizarEstadoValidacion();
    }

    actualizarEstadoValidacion(): void {
        const valido = this.validarClienteSinPaciente();
        // Puedes usar esta función para habilitar/deshabilitar botones, etc.
    }

    onCedulaBlur(): void {
        const cedula = this.clienteSinPaciente.cedula?.trim();
        const tipoPersona = this.clienteSinPaciente.tipoPersona;

        if (!cedula) {
            return;
        }

        // Validar formato básico
        if (!this.validarCedula(cedula, tipoPersona)) {
            this.mostrarErrorCedula();
            this.mensajeValidacionCliente = this.getMensajeErrorCedula();
            return;
        }

        // Solo validar si la cédula es válida y tiene al menos 4 caracteres
        if (cedula.length >= 4) {
            this.validarClientePorCedula();
        }
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

    /**
     * Obtener clase CSS para el botón de validación
     */
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
            return;
        }

        if (!this.validarCedula(cedula, this.clienteSinPaciente.tipoPersona)) {
            this.mensajeValidacionCliente = this.getMensajeErrorCedula();
            this.validacionIntentada = false;
            return;
        }

        // Guardar la cédula actual por si necesitamos restaurarla
        const cedulaActual = this.clienteSinPaciente.cedula;

        // Iniciar validación
        this.validandoCliente = true;
        this.clienteEncontrado = false;
        this.validacionIntentada = false;
        this.mensajeValidacionCliente = '🔍 Buscando cliente en la base de datos...';

        try {
            const respuesta = await lastValueFrom(this.clienteService.buscarPorCedula(cedula));

            // MARCAR QUE LA VALIDACIÓN SE INTENTÓ
            this.validacionIntentada = true;

            if (respuesta.cliente) {
                this.clienteEncontrado = true;
                this.mensajeValidacionCliente = '✅ Cliente encontrado - Datos autocompletados';
                this.autocompletarDatosCliente(respuesta.cliente);

                this.snackBar.open('Cliente encontrado - Datos autocompletados', 'Cerrar', {
                    duration: 3000,
                    panelClass: ['snackbar-success']
                });
            } else {
                this.clienteEncontrado = false;
                this.mensajeValidacionCliente = 'Cliente no encontrado - Complete los datos manualmente';

                this.limpiarCamposCliente();
                this.clienteSinPaciente.cedula = cedulaActual;

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
            this.clienteSinPaciente.cedula = cedulaActual;

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
        const cedulaActual = this.clienteSinPaciente.cedula;
        const tipoPersonaActual = this.clienteSinPaciente.tipoPersona;

        // Limpiar todos los campos
        this.clienteSinPaciente = {
            tipoPersona: tipoPersonaActual,
            nombreCompleto: '',
            cedula: cedulaActual,
            telefono: '',
            email: ''
        };

        // Limpiar errores de validación
        this.limpiarErroresValidacion();

        // Actualizar estado de validación
        this.actualizarEstadoValidacion();
    }

    getTooltipBotonValidar(): string {
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

    puedeGenerarVentaDesdeCarrito(): boolean {
        // 1. Verificar que hay productos en el carrito
        if (this.venta.productos.length === 0) {
            return false;
        }

        // 2. Validar según el estado de requierePaciente
        if (this.requierePaciente) {
            // Si requiere paciente: debe tener producto Y paciente seleccionado
            return !!this.pacienteSeleccionado;
        } else {
            // Si no requiere paciente: solo necesita productos
            return true;
        }
    }

    getMensajeTooltipBotonGenerar(): string {
        if (this.venta.productos.length === 0) {
            return 'Agrega al menos un producto para continuar';
        }

        if (this.requierePaciente && !this.pacienteSeleccionado) {
            return 'Selecciona un paciente para continuar';
        }

        return 'Haz clic para generar la venta';
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

    calcularIvaSobreBaseConDescuento(baseConDescuento: number): number {
        if (!Array.isArray(this.productosConDetalle)) return 0;

        // Calcular qué porcentaje del total representa cada producto que aplica IVA
        const subtotalSinIva = this.calcularSubtotalSinIva();
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

    calcularSubtotalSinIva(): number {
        if (!Array.isArray(this.productosConDetalle) || this.productosConDetalle.length === 0) {
            return 0;
        }

        return this.productosConDetalle.reduce((acc, producto) => {
            return acc + this.calcularSubtotalSinIvaProducto(producto);
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
        const subtotalSinIva = this.calcularSubtotalSinIva();
        const descuentoPorcentaje = this.venta.descuento ?? 0;

        // Descuento sobre subtotal SIN IVA
        return this.redondear(subtotalSinIva * (descuentoPorcentaje / 100));
    }

    calcularProporcionProducto(producto: any): number {
        const subtotalTotalSinIva = this.calcularSubtotalSinIva();
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


    get montoTotal(): number {
        // 1. Subtotal sin IVA después del descuento
        let baseTotalConDescuento = 0;

        this.productosConDetalle.forEach(producto => {
            baseTotalConDescuento += this.calcularBaseConDescuentoPorProducto(producto);
        });

        // 2. IVA después del descuento
        const ivaDespuesDescuento = this.calcularTotalIvaDespuesDescuento();

        // 3. Total final
        const totalFinal = baseTotalConDescuento + ivaDespuesDescuento;

        return this.redondear(totalFinal);
    }


    // === MÉTODOS PARA EL RESUMEN EN HTML ===

    get subtotalCorregido(): number {
        return this.calcularSubtotalSinIva();
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

    // === MÉTODOS MEJORADOS PARA EL RESUMEN ===
    get tieneDescuento(): boolean {
        return (this.venta.descuento ?? 0) > 0;
    }

    get subtotalSinIva(): number {
        return this.calcularSubtotalSinIva();
    }

    get descuentoAplicado(): number {
        return this.calcularDescuento();
    }

    get subtotalConDescuento(): number {
        let total = 0;
        this.productosConDetalle.forEach(producto => {
            total += this.calcularBaseConDescuentoPorProducto(producto);
        });
        return this.redondear(total);
    }

    get ivaCalculado(): number {
        return this.calcularTotalIvaDespuesDescuento();
    }

    get totalPagar(): number {
        return this.montoTotal;
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

}
