import { Component, OnInit, ChangeDetectorRef, OnDestroy, ViewChild  } from '@angular/core';
import { Producto } from '../../productos/producto.model';
import { ProductoService } from '../../productos/producto.service';
import { SystemConfigService } from '../../system-config/system-config.service';
import { GenerarVentaService } from './generar-venta.service';
import { Tasa } from '../../../Interfaces/models-interface';
import { SwalService } from '../../../core/services/swal/swal.service';
import { forkJoin, map, Subject } from 'rxjs';
import { take } from 'rxjs/operators';
import { LoaderService } from './../../../shared/loader/loader.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UserStateService } from '../../../core/services/userState/user-state-service';
import { PacientesService } from '../../../core/services/pacientes/pacientes.service';
import { HistoriaMedicaService } from '../../../core/services/historias-medicas/historias-medicas.service';
import { Paciente } from '../../pacientes/paciente-interface';
import { HistoriaMedica } from './../../historias-medicas/historias_medicas-interface';
import { VentaDto, ProductoVenta, ProductoVentaCalculado, CuotaCashea, DatosRecibo } from '../venta-interfaz';
import { Empleado, User } from '../../../Interfaces/models-interface';
import { EmpleadosService } from './../../../core/services/empleados/empleados.service';
import { trigger, transition, style, animate } from '@angular/animations';
import * as bootstrap from 'bootstrap';
import { Subscription } from 'rxjs';
import { ProductoConversionService } from '../../productos/productos-list/producto-conversion.service';
import { NgSelectComponent } from '@ng-select/ng-select';

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
    // === CONSTRUCTOR ===
    constructor(
        private productoService: ProductoService,
        private generarVentaService: GenerarVentaService,
        private swalService: SwalService,
        private userStateService: UserStateService,
        private snackBar: MatSnackBar,
        private authService: AuthService,
        private cdr: ChangeDetectorRef,
        private loader: LoaderService,
        private pacientesService: PacientesService,
        private historiaService: HistoriaMedicaService,
        private empleadosService: EmpleadosService,
        private systemConfigService: SystemConfigService,
        private productoConversionService: ProductoConversionService
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

    historiaMedica: HistoriaMedica | null = null;

    productosConDetalle: ProductoVentaCalculado[] = [];
    totalProductos: number = 0;
    cuotasCashea: CuotaCashea[] = [];
    valorInicialTemporal = '';

    // === PROPIEDADES ADICIONALES PARA GENERACIÓN DE VENTA ===
    generandoVenta: boolean = false;
    generandoRecibo: boolean = false;
    ventaGenerada: boolean = false;
    urlRecibo: string = '';
    errorGeneracion: string = '';

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

    private montoCubiertoAnterior: number = 0;

    // === CICLO DE VIDA ===
    ngOnInit(): void {
        this.resetearCarga();
        this.registrarTarea();
        this.obtenerConfiguracionSistema();
        this.suscribirCambiosConfiguracion();
        this.cargarDatosIniciales();
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
            'BS': 'bolivar'
        };
        return mapaMonedas[monedaSistema] || 'dolar';
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

    // === MÉTODOS DE PACIENTES ===
    onPacienteSeleccionado(pacienteSeleccionado: Paciente | null): void {
        this.registrarTarea();
        this.historiaMedica = null;

        if (!pacienteSeleccionado?.key) {
            console.error('No se encontró la clave del paciente seleccionado.', pacienteSeleccionado?.key);
            this.completarTarea();
            return;
        }

        const pacienteKey = pacienteSeleccionado.key;

        this.historiaService.getHistoriasPorPaciente(pacienteKey).pipe(take(1)).subscribe({
            next: historial => {
                if (!historial || historial.length === 0) {
                    this.swalService.showWarning(
                        'Sin historia médica',
                        'Este paciente no tiene historia registrada. Puedes continuar si es una venta libre.'
                    );
                    this.historiaMedica = null;
                    this.completarTarea();
                    return;
                }

                this.historiaMedica = historial.sort((a, b) =>
                    new Date(b.auditoria.fechaCreacion).getTime() - new Date(a.auditoria.fechaCreacion).getTime()
                )[0];

                if (!this.historiaMedica?.examenOcular?.refraccionFinal) {
                    this.swalService.showInfo(
                        'Sin fórmula óptica',
                        'Este paciente no tiene fórmula registrada. Puedes continuar con venta libre.'
                    );
                }

                this.completarTarea();
            },
            error: () => {
                this.swalService.showError(
                    'Error al cargar historia',
                    'No se pudo obtener la historia médica del paciente.'
                );
                this.historiaMedica = null;
                this.completarTarea();
            }
        });
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

    // === MÉTODOS DE PRODUCTOS ===
    agregarProductoAlCarrito(producto: ProductoVenta | any): void {
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
            this.swalService.showInfo('Producto actualizado', 'Se incrementó la cantidad en el carrito.');
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
        this.productoSeleccionado = undefined;
        this.limpiarSelectProductos();
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

    // === CÁLCULOS DE PRODUCTOS ===
    actualizarProductosConDetalle(): void {
        const monedaDestino = this.venta.moneda;
        const tasaDestino = this.tasasDisponibles.find(t => t.nombre.toLowerCase() === monedaDestino)?.valor ?? 1;

        this.productosConDetalle = this.venta.productos.map(p => {
            const cantidad = p.cantidad ?? 1;
            const aplicaIva = p.aplicaIva ?? false;
            const tasaOrigen = this.tasasDisponibles.find(t => t.nombre.toLowerCase() === p.moneda)?.valor ?? 1;

            const subtotal = +(p.precio * cantidad).toFixed(2);
            const iva = aplicaIva ? +(subtotal * (this.ivaPorcentaje / 100)).toFixed(2) : 0;
            const totalEnOrigen = subtotal + iva;
            const factor = tasaOrigen / tasaDestino;
            const totalConvertido = +(totalEnOrigen * factor).toFixed(2);

            return {
                ...p,
                codigo: p.codigo,
                cantidad,
                subtotal,
                iva,
                total: totalConvertido,
                precioConvertido: +(p.precio * factor).toFixed(2),
                stock: p.stock
            };
        });

        this.totalProductos = this.calcularTotalProductos();
    }

    calcularTotalProductos(): number {
        if (!Array.isArray(this.productosConDetalle)) return 0;
        return this.productosConDetalle.reduce((acc, p) => {
            const total = +p.total || 0;
            return acc + total;
        }, 0);
    }

    eliminarMetodo(index: number): void {
        this.venta.metodosDePago.splice(index, 1);
    }

    onMetodoPagoChange(index: number): void {
        const metodo = this.venta.metodosDePago[index];

        if (metodo.monto && metodo.monto > 0) {
            const monedaMetodo = this.getMonedaParaMetodo(metodo.tipo);
            metodo.valorTemporal = `${metodo.monto.toFixed(2)} ${this.obtenerSimboloMoneda(monedaMetodo)}`;
        } else {
            metodo.valorTemporal = '';
        }

        this.cdr.detectChanges();
    }

    formatearMontoMetodo(index: number): void {
        const metodo = this.venta.metodosDePago[index];
        const monedaMetodo = this.getMonedaParaMetodo(metodo.tipo);

        if (!metodo.tipo) {
            this.snackBar.open('⚠️ Primero selecciona un método de pago', 'Cerrar', { duration: 3000 });
            metodo.valorTemporal = '';
            metodo.monto = 0;
            return;
        }

        const limpio = metodo.valorTemporal?.replace(/[^\d.]/g, '').trim();

        if (!limpio) {
            metodo.monto = 0;
            metodo.valorTemporal = '';
            return;
        }

        const monto = parseFloat(limpio);

        if (isNaN(monto)) {
            metodo.monto = 0;
            metodo.valorTemporal = '';
            return;
        }

        const maximoEnMonedaSistema = this.getMontoRestanteParaMetodo(index);
        const maximoEnMonedaMetodo = monedaMetodo === this.venta.moneda
            ? maximoEnMonedaSistema
            : this.convertirMontoExacto(maximoEnMonedaSistema, this.venta.moneda, monedaMetodo);

        let montoFinal = Math.min(monto, maximoEnMonedaMetodo);

        // Para métodos en bolívares, forzar 2 decimales exactos
        if (this.esMetodoEnBolivares(metodo.tipo)) {
            montoFinal = Number(montoFinal.toFixed(2));
            metodo.valorTemporal = `${montoFinal.toFixed(2)} Bs`;
        } else {
            // Para otras monedas, redondear a 2 decimales
            montoFinal = Number(montoFinal.toFixed(2));
            metodo.valorTemporal = `${montoFinal.toFixed(2)} ${this.obtenerSimboloMoneda(monedaMetodo)}`;
        }

        metodo.monto = montoFinal;

        // Mostrar advertencia si el usuario intentó exceder el máximo
        if (monto > maximoEnMonedaMetodo) {
            this.snackBar.open(`⚠️ El monto se ajustó al máximo disponible: ${montoFinal.toFixed(2)} ${this.obtenerSimboloMoneda(monedaMetodo)}`, 'Cerrar', {
                duration: 3000,
                panelClass: ['snackbar-warning']
            });
        }

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

    get montoTotal(): number {
        const descuento = this.venta.descuento ?? 0;
        const totalConDescuento = this.totalProductos * (1 - descuento / 100);
        return this.redondear(totalConDescuento);
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

    // === MÉTODOS CASHEA (RESTAURADOS) ===
    onFormaPagoChange(valor: string): void {
        this.venta.formaPago = valor;

        if (valor === 'cashea') {
            this.venta.moneda = 'dolar';
            this.controlarCuotasPorNivel();
            this.actualizarMontoInicialCashea();
            this.generarCuotasCashea();
        }

        this.venta.metodosDePago = [];
        this.resumenCashea = { cantidad: 0, total: 0, totalBs: 0 };
    }

    asignarInicialPorNivel(): void {
        const totalConDescuento = this.montoTotal;
        const minimo = this.calcularInicialCasheaPorNivel(totalConDescuento, this.nivelCashea);
        this.venta.montoInicial = minimo;
        this.valorInicialTemporal = `${minimo.toFixed(2)} ${this.obtenerSimboloMoneda(this.venta.moneda)}`;

        this.controlarCuotasPorNivel();
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

        this.actualizarProductosConDetalle();

        if (this.venta.formaPago === 'cashea') {
            this.actualizarMontoInicialCashea();
            this.generarCuotasCashea();
        }
    }

    actualizarMontoInicialCashea(): void {
        const totalConDescuento = this.montoTotal;
        const nuevoMontoInicial = this.calcularInicialCasheaPorNivel(totalConDescuento, this.nivelCashea);

        this.venta.montoInicial = nuevoMontoInicial;
        this.valorInicialTemporal = `${nuevoMontoInicial.toFixed(2)} ${this.obtenerSimboloMoneda(this.venta.moneda)}`;
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

    // Método para verificar si Cashea está configurado correctamente
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
        const inicial = this.venta.montoInicial ?? this.calcularInicialCasheaPorNivel(total, this.nivelCashea);
        const restante = total - inicial;
        const montoPorCuota = this.redondear(restante / numeroCuotas);

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
        // Asegurar que Cashea siempre use dólares
        if (this.venta.formaPago === 'cashea') {
            this.venta.moneda = 'dolar';
        }

        const plan = this.calcularCasheaPlan(this.cantidadCuotasCashea);
        this.cuotasCashea = plan.cuotasOrdenadas.map((cuota, index) => ({
            ...cuota,
            habilitada: index === 0
        }));
        this.actualizarResumenCashea();
    }

    toggleCuotaSeleccionada(index: number): void {
        const cuota = this.cuotasCashea[index];
        const estabaSeleccionada = cuota.seleccionada;

        cuota.seleccionada = !cuota.seleccionada;

        if (cuota.seleccionada && index + 1 < this.cuotasCashea.length) {
            this.cuotasCashea[index + 1].habilitada = true;
        }

        if (!cuota.seleccionada) {
            for (let i = index + 1; i < this.cuotasCashea.length; i++) {
                this.cuotasCashea[i].seleccionada = false;
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
            // Asegurar que Cashea use dólares
            this.venta.moneda = 'dolar';
            this.controlarCuotasPorNivel();
            this.actualizarMontoInicialCashea();
            this.generarCuotasCashea();
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
        return `Adelantando ${this.resumenCashea.cantidad} cuota${this.resumenCashea.cantidad > 1 ? 's' : ''}`;
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
        const moneda = this.tasasDisponibles.find(m => m.id === normalizado);
        return moneda?.simbolo ?? '';
    }

    getMonedaParaMetodo(tipoMetodo: string): string {
        const monedasPorMetodo: { [key: string]: string } = {
            'efectivo': this.monedaEfectivo.toLowerCase() === 'eur' ? 'euro' : 'dolar',
            'zelle': 'dolar',
            'debito': 'bolivar',
            'credito': 'bolivar',
            'pagomovil': 'bolivar',
            'transferencia': 'bolivar'
        };
        return monedasPorMetodo[tipoMetodo] || this.venta.moneda;
    }

    esMetodoEnBolivares(tipoMetodo: string): boolean {
        const metodosEnBs = ['debito', 'credito', 'pagomovil', 'transferencia'];
        return metodosEnBs.includes(tipoMetodo);
    }

    getMontoRestanteParaMetodo(index: number): number {
        // Calcular lo que ya se ha pagado en otros métodos (en la moneda del sistema)
        const otrosMontos = this.venta.metodosDePago
            .filter((_, i) => i !== index)
            .reduce((sum, metodo) => {
                const montoMetodo = metodo.monto ?? 0;
                const monedaMetodo = this.getMonedaParaMetodo(metodo.tipo);

                if (monedaMetodo !== this.venta.moneda) {
                    return sum + this.convertirMontoExacto(montoMetodo, monedaMetodo, this.venta.moneda);
                }
                return sum + montoMetodo;
            }, 0);

        // El restante es la diferencia entre lo requerido y lo ya pagado
        const restante = Math.max(this.montoCubiertoPorMetodos - otrosMontos, 0);

        // Redondear para evitar problemas de precisión con decimales
        return this.redondear(restante);
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
        return producto.aplicaIva ? (producto.precioConIva || producto.precio) : producto.precio;
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
        // Si el campo está vacío, mostrar todos los bancos
        const metodo = this.venta.metodosDePago[index];
        if (!metodo.banco) {
            // Forzar la actualización de la lista
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

    // Método simplificado - solo para personalizado
    aplicarTamanoPersonalizado(ancho: string, alto: string): void {
        // Validar formato del ancho
        if (!ancho.match(/^\d+(px|%|vw|vh)$/)) {
            this.swalService.showWarning('Formato inválido', 'El ancho debe ser en px, %, vw o vh (ej: 1100px)');
            return;
        }

        // Validar formato del alto
        if (!alto.match(/^\d+(px|%|vw|vh)$/)) {
            this.swalService.showWarning('Formato inválido', 'El alto debe ser en px, %, vw o vh (ej: 700px)');
            return;
        }

        this.anchoPersonalizado = ancho;
        this.altoPersonalizado = alto;
        this.tamanoModalRecibo = 'xl'; // Siempre mantenemos XL como tipo

        setTimeout(() => {
            this.ajustarDimensionesModal();
        }, 50);
    }

    forzarTamanioCarta(): void {
        this.anchoPersonalizado = '800px';
        this.altoPersonalizado = '1000px';
        this.mostrarControlesPersonalizados = false;

        setTimeout(() => {
            this.ajustarDimensionesModal();
        }, 50);
    }

    // Método simplificado para ajustar dimensiones
    private ajustarDimensionesModal(): void {
        if (!this.mostrarModalRecibo) return;

        setTimeout(() => {
            const modalDialog = document.querySelector('#reciboModal .modal-dialog') as HTMLElement;
            const iframe = document.querySelector('.recibo-iframe') as HTMLIFrameElement;

            if (modalDialog) {
                // Para XL fijo
                modalDialog.style.maxWidth = '900px';
                modalDialog.style.width = '900px';
                modalDialog.style.maxHeight = '90vh';
            }

            if (iframe) {
                // Para XL fijo
                iframe.style.height = '700px';

                // Si hay tamaño personalizado, aplicar esas dimensiones al iframe
                if (this.mostrarControlesPersonalizados) {
                    iframe.style.height = this.altoPersonalizado;
                }
            }
        }, 100);
    }

    // Método simplificado para obtener la altura del iframe
    getAlturaIframe(): string {
        return this.mostrarControlesPersonalizados ? this.altoPersonalizado : '700px';
    }

    // Método simplificado para obtener el ancho del modal
    getAnchoModal(): string {
        return this.mostrarControlesPersonalizados ? this.anchoPersonalizado : '1100px';
    }

    // Método para mostrar/ocultar controles personalizados
    toggleControlesPersonalizados(): void {
        this.mostrarControlesPersonalizados = !this.mostrarControlesPersonalizados;
        if (this.mostrarControlesPersonalizados) {
            setTimeout(() => {
                this.ajustarDimensionesModal();
            }, 50);
        }
    }

    compartirRecibo(): void {
        this.swalService.showConfirm(
            'Compartir Recibo',
            `
        <div class="text-center">
            <p class="mb-4">Elige cómo quieres compartir el recibo:</p>
            <div class="row g-3">
                <div class="col-6">
                    <button class="btn btn-success w-100 p-3 compartir-btn" data-tipo="whatsapp">
                        <i class="bi bi-whatsapp fs-4"></i>
                        <div class="small mt-1">WhatsApp</div>
                    </button>
                </div>
                <div class="col-6">
                    <button class="btn btn-primary w-100 p-3 compartir-btn" data-tipo="email">
                        <i class="bi bi-envelope fs-4"></i>
                        <div class="small mt-1">Email</div>
                    </button>
                </div>
                <div class="col-6">
                    <button class="btn btn-info w-100 p-3 compartir-btn" data-tipo="enlace">
                        <i class="bi bi-link fs-4"></i>
                        <div class="small mt-1">Copiar Enlace</div>
                    </button>
                </div>
                <div class="col-6">
                    <button class="btn btn-secondary w-100 p-3 compartir-btn" data-tipo="descargar">
                        <i class="bi bi-download fs-4"></i>
                        <div class="small mt-1">Solo Descargar</div>
                    </button>
                </div>
            </div>
        </div>
        `,
            'Cerrar',
            'Cancelar'
        ).then((result) => {
            if (result.isConfirmed) {
                console.log('Modal de compartir cerrado');
            }
        });

        // Agregar event listeners CORREGIDO
        setTimeout(() => {
            const buttons = document.querySelectorAll('.compartir-btn');
            buttons.forEach(button => {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    // CORRECCIÓN: Usar la sintaxis correcta para dataset
                    const tipo = (e.currentTarget as HTMLElement).dataset['tipo'];
                    if (tipo) {
                        this.procesarCompartir(tipo);
                        this.swalService.closeLoading();
                    }
                });
            });
        }, 100);
    }

    // Versión alternativa más simple para compartir
    compartirReciboSimple(): void {
        this.swalService.showInfo(
            'Compartir Recibo',
            `
        <div class="text-center">
            <p class="mb-3">Opciones para compartir:</p>
            <div class="d-grid gap-2">
                <button class="btn btn-success compartir-btn-simple" data-tipo="whatsapp">
                    <i class="bi bi-whatsapp me-2"></i>Compartir por WhatsApp
                </button>
                <button class="btn btn-primary compartir-btn-simple" data-tipo="email">
                    <i class="bi bi-envelope me-2"></i>Enviar por Email
                </button>
                <button class="btn btn-info compartir-btn-simple" data-tipo="enlace">
                    <i class="bi bi-link me-2"></i>Copiar Enlace
                </button>
                <button class="btn btn-secondary compartir-btn-simple" data-tipo="descargar">
                    <i class="bi bi-download me-2"></i>Descargar PDF
                </button>
            </div>
        </div>
        `
        );

        // Agregar event listeners CORREGIDO
        setTimeout(() => {
            const buttons = document.querySelectorAll('.compartir-btn-simple');
            buttons.forEach(button => {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    // CORRECCIÓN: Usar la sintaxis correcta para dataset
                    const tipo = (e.currentTarget as HTMLElement).dataset['tipo'];
                    if (tipo) {
                        this.procesarCompartir(tipo);
                        this.swalService.closeLoading();
                    }
                });
            });
        }, 100);
    }

    // Procesar la opción de compartir seleccionada - CORREGIDO
    private procesarCompartir(tipo: string): void {
        switch (tipo) {
            case 'whatsapp':
                this.compartirWhatsApp();
                break;
            case 'email':
                this.compartirEmail();
                break;
            case 'enlace':
                this.copiarEnlace();
                break;
            case 'descargar':
                this.descargarPDF();
                break;
        }
    }

    async descargarPDFAvanzado(): Promise<void> {
        if (!this.urlRecibo) {
            this.swalService.showError('Error', 'No hay recibo disponible para descargar');
            return;
        }

        try {
            this.swalService.showLoadingAlert('Descargando recibo...');

            // Usar fetch para obtener el PDF
            const response = await fetch(this.urlRecibo);
            if (!response.ok) throw new Error('Error al obtener el PDF');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `recibo-${this.informacionVenta?.numeroVenta || 'venta'}.pdf`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Liberar recursos
            window.URL.revokeObjectURL(url);

            this.swalService.closeLoading();
            this.swalService.showSuccess('Éxito', 'Recibo descargado correctamente');

        } catch (error) {
            this.swalService.closeLoading();
            console.error('Error en descarga:', error);
            this.swalService.showError('Error', 'No se pudo descargar el recibo');
        }
    }

    // === VALIDACIONES ===
    validarEntrada(event: KeyboardEvent): void {
        const tecla = event.key;
        const permitido = /^[0-9.,]$/;
        if (!permitido.test(tecla)) {
            event.preventDefault();
        }
    }

    formatearMonto(): void {
        const limpio = this.valorTemporal.replace(/[^\d.]/g, '').trim();

        if (!limpio) {
            this.venta.montoAbonado = 0;
            this.valorTemporal = '';
            this.montoExcedido = false;
            this.cdr.detectChanges();
            return;
        }

        const monto = parseFloat(limpio);
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
            this.valorTemporal = `${adeudado.toFixed(2)} ${this.obtenerSimboloMoneda(this.venta.moneda)}`;
            this.venta.montoAbonado = adeudado;
            this.cdr.detectChanges();
            return;
        }

        this.venta.montoAbonado = monto;
        this.valorTemporal = `${monto.toFixed(2)} ${this.obtenerSimboloMoneda(this.venta.moneda)}`;
        this.cdr.detectChanges();
    }

    formatearInicialCashea(): void {
        const limpio = this.valorInicialTemporal.replace(/[^\d.]/g, '').trim();

        if (!limpio) {
            this.venta.montoInicial = 0;
            this.valorInicialTemporal = '';
            return;
        }

        const monto = parseFloat(limpio);
        const minimo = this.calcularInicialCasheaPorNivel(this.montoTotal, this.nivelCashea);

        if (isNaN(monto)) {
            this.venta.montoInicial = 0;
            this.valorInicialTemporal = '';
            return;
        }

        if (monto < minimo) {
            this.venta.montoInicial = minimo;
            this.valorInicialTemporal = `${minimo.toFixed(2)} ${this.obtenerSimboloMoneda(this.venta.moneda)}`;
            return;
        }

        this.venta.montoInicial = monto;
        this.valorInicialTemporal = `${monto.toFixed(2)} ${this.obtenerSimboloMoneda(this.venta.moneda)}`;
    }

    ngAfterViewInit(): void {
        const modalElement = document.getElementById('resumenVentaModal');
        if (modalElement) {
            modalElement.addEventListener('hidden.bs.modal', () => {
                this.resetearModalVenta();
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

    private limpiarSelectProductos(): void {
        console.log('🔧 Limpiando select de productos...');

        // 1. Limpiar el modelo
        this.productoSeleccionado = undefined;

        // 2. Forzar detección de cambios inmediata
        this.cdr.detectChanges();

        // 3. Usar el ViewChild para limpiar el ng-select
        setTimeout(() => {
            if (this.productoSelect) {
                this.productoSelect.close();
                this.productoSelect.clearModel();
                console.log('✅ Select limpiado via ViewChild');
            }

            // 4. Limpieza visual adicional del DOM
            this.limpiarVisualmenteSelect();

            this.cdr.detectChanges();
        }, 100);
    }

    private limpiarVisualmenteSelect(): void {
        const selectContainer = document.querySelector('#selectorProducto .ng-select-container');
        if (!selectContainer) return;

        // Remover cualquier valor visual que pueda quedar
        const valueElements = selectContainer.querySelectorAll('.ng-value');
        valueElements.forEach(el => el.remove());

        // Forzar que el placeholder sea visible
        const placeholder = selectContainer.querySelector('.ng-placeholder');
        if (placeholder) {
            placeholder.classList.remove('ng-hide');
        }

        console.log('✅ Limpieza visual completada');
    }

    resetearModalVenta(): void {
        this.venta.descuento = 0;
        this.venta.observaciones = '';
        this.venta.montoInicial = 0;
        this.venta.numeroCuotas = 0;
        this.venta.montoAbonado = 0;
        this.venta.metodosDePago = [];
        this.venta.formaPago = 'contado';
        this.venta.impuesto = 16;
        this.valorInicialTemporal = '';
        this.montoExcedido = false;
    }

    // === MÉTODOS ADICIONALES NECESARIOS ===
    get nombreCompletoAsesor(): string {
        return this.currentUser?.nombre ?? 'Sin nombre';
    }

    getResumenAsesor(): string {
        const asesor = this.empleadosDisponibles.find(e => e.id === this.asesorSeleccionado);
        if (!asesor) return 'Sin asesor asignado';
        return `${asesor.nombre} — ${asesor.cargoNombre}`;
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
        this.cdr.detectChanges();
    }

    hayMetodoEfectivoSeleccionado(): boolean {
        return this.venta.metodosDePago.some(metodo => metodo.tipo === 'efectivo');
    }

    mostrarConversionBs(tipoMetodo: string): boolean {
        const monedaMetodo = this.getMonedaParaMetodo(tipoMetodo);
        return monedaMetodo !== 'bolivar' && this.venta.moneda !== 'bolivar';
    }

    calcularConversionBs(monto: number, tipoMetodo: string): number {
        if (!monto || monto <= 0) return 0;

        const monedaMetodo = this.getMonedaParaMetodo(tipoMetodo);
        if (monedaMetodo === 'bolivar') {
            return this.redondear(monto);
        }

        const tasa = this.tasasPorId[monedaMetodo] || 1;
        return this.redondear(monto * tasa);
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
                console.log('🔄 Banco actualizado desde código:', metodo.banco);
            } else {
                console.log('❌ No se encontró banco con código:', metodo.bancoCodigo);
                metodo.bancoNombre = '';
                metodo.banco = '';
            }
        } else {
            metodo.bancoNombre = '';
            metodo.banco = '';
        }
    }

    onBancoObjectChange(bancoObject: any, index: number): void {
        console.log('🔄 onBancoObjectChange - Objeto:', bancoObject);

        const metodo = this.venta.metodosDePago[index];

        if (!bancoObject) {
            console.log('❌ Objeto vacío - limpiando datos');
            metodo.bancoCodigo = '';
            metodo.bancoNombre = '';
            metodo.banco = '';
            metodo.bancoObject = null;
            this.cdr.detectChanges();
            return;
        }

        console.log('✅ Banco objeto seleccionado:', bancoObject);

        // Actualizar todas las propiedades
        metodo.bancoCodigo = bancoObject.codigo;
        metodo.bancoNombre = bancoObject.nombre;
        metodo.banco = `${bancoObject.codigo} - ${bancoObject.nombre}`;
        metodo.bancoObject = bancoObject;

        console.log('📝 Método actualizado:', {
            bancoCodigo: metodo.bancoCodigo,
            bancoNombre: metodo.bancoNombre,
            banco: metodo.banco
        });

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

    agregarMetodo(): void {
        this.venta.metodosDePago.push({
            tipo: '',
            monto: 0,
            valorTemporal: '',
            referencia: '',
            bancoCodigo: '',
            bancoNombre: '',
            banco: '',
            bancoObject: null
        });
    }


    compararBanco = (a: any, b: any): boolean => {
        if (!a || !b) return a === b;
        return a.codigo === b.codigo;
    };

    onBancoChange(banco: { codigo: string; nombre: string } | null, index: number): void {
        console.log('🔄 Banco seleccionado:', banco);

        const metodo = this.venta.metodosDePago[index];

        if (!banco) {
            metodo.bancoCodigo = '';
            metodo.bancoNombre = '';
            metodo.banco = '';        // string formateado vacío
            metodo.bancoObject = null;
            return;
        }

        metodo.bancoCodigo = banco.codigo;
        metodo.bancoNombre = banco.nombre;
        metodo.banco = `${banco.codigo} - ${banco.nombre}`; // string formateado
        metodo.bancoObject = banco; // objeto completo

        console.log('📝 Método actualizado:', metodo);
    }

    onTipoMetodoChange(index: number): void {
        const metodo = this.venta.metodosDePago[index];

        console.log('Cambio tipo método:', metodo.tipo, 'en índice:', index);

        // 🔄 LIMPIAR TODOS LOS CAMPOS DEL MÉTODO
        metodo.monto = 0;
        metodo.valorTemporal = '';
        metodo.referencia = '';
        metodo.bancoCodigo = '';
        metodo.bancoNombre = '';
        metodo.banco = '';
        metodo.bancoObject = null;

        console.log('🔄 Todos los campos del método han sido limpiados');

        this.onMetodoPagoChange(index);
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

    // Método para verificar si se puede generar la venta - ACTUALIZADO
    get puedeGenerarVenta(): boolean {
        // Verificar que hay productos
        if (this.venta.productos.length === 0) {
            return false;
        }

        // Verificar que todos los métodos de pago estén completamente configurados
        const metodosCompletos = this.venta.metodosDePago.every(metodo => {
            // Verificar tipo de pago seleccionado
            if (!metodo.tipo) return false;

            // Verificar monto válido
            if (!metodo.monto || metodo.monto <= 0) return false;

            // Para métodos que requieren banco (pago móvil, transferencia)
            if (this.necesitaBanco(metodo.tipo)) {
                if (!metodo.banco || !metodo.bancoObject) return false;
            }

            // Para métodos que requieren referencia (pago móvil, transferencia)
            if (this.necesitaReferencia(metodo.tipo)) {
                if (!metodo.referencia || metodo.referencia.trim() === '') return false;
            }

            return true;
        });

        if (!metodosCompletos) {
            return false;
        }

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

    // Mensaje de estado para el botón - MEJORADO
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
            return `Faltan ${this.redondear(diferencia)} ${this.obtenerSimboloMoneda(this.venta.moneda)}`;
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

    // === MÉTODOS DE VENTA Y RECIBO ===
    async generarVenta(): Promise<void> {
        if (!this.puedeGenerarVenta) {
            this.swalService.showWarning(
                'No se puede generar la venta',
                'Verifica que todos los campos estén completos y los montos sean correctos.'
            );
            return;
        }

        if (this.generandoVenta) {
            return;
        }

        try {
            this.generandoVenta = true;
            this.loader.showWithMessage('Procesando venta...');

            // Simular proceso de venta
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Mostrar recibo automáticamente
            this.mostrarReciboAutomatico();
            this.limpiarSelectProductos(); // Limpiar select al cerrar modal
            this.resetearModalVenta();

        } catch (error) {
            console.error('Error al generar venta:', error);
            this.manejarErrorGeneracion(error);
        } finally {
            this.generandoVenta = false;
            this.loader.hide();
        }
    }

    // === MÉTODOS DE RECIBO ===
    generarReciboHTML(datos: any): string {
        if (!datos) {
            datos = this.crearDatosReciboReal();
        }

        const formaPago = datos.configuracion?.formaPago || 'contado';
        const tituloRecibo = this.getTituloReciboParaHTML(formaPago);
        const mensajeFinal = this.getMensajeFinalParaHTML(formaPago);

        return `
    <!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recibo - ${datos.numeroVenta}</title>
    <style>
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
            font-size: 10px;
            line-height: 1.15;
            color: #333;
            background: white;
            padding: 20mm 10mm 10mm 10mm;
            width: 210mm;
            height: 297mm;
            margin: 0 auto;
        }
        
        .recibo-container {
            width: 100%;
            max-width: 190mm;
            margin: 0 auto;
            background: white;
            padding: 0;
            height: auto;
            max-height: 257mm;
            overflow: hidden;
        }
        
        .recibo-header {
            text-align: center;
            border-bottom: 2px solid #2c5aa0;
            padding-bottom: 6px;
            margin-bottom: 8px;
        }
        
        .empresa-nombre {
            font-size: 16px;
            font-weight: bold;
            color: #2c5aa0;
            margin-bottom: 2px;
        }
        
        .empresa-info {
            font-size: 8px;
            color: #666;
            margin-bottom: 1px;
            line-height: 1.1;
        }
        
        .titulo-venta {
            font-size: 12px;
            font-weight: 600;
            color: #2c5aa0;
            margin: 6px 0 2px 0;
        }
        
        .info-rapida {
            background: #f8f9fa;
            padding: 4px;
            border-radius: 2px;
            border: 1px solid #dee2e6;
            margin-bottom: 8px;
            font-size: 8px;
        }
        
        .cliente-compacto {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-left: 2px solid #2c5aa0;
            padding: 6px;
            font-size: 8px;
            margin-bottom: 8px;
            border-radius: 2px;
        }
        
        .tabla-productos {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
            font-size: 8px;
        }
        
        .tabla-productos th {
            background: #2c5aa0;
            color: white;
            font-weight: 600;
            padding: 3px 4px;
            text-align: left;
            border: 1px solid #dee2e6;
            font-size: 8px;
        }
        
        .tabla-productos td {
            border: 1px solid #dee2e6;
            padding: 2px 3px;
            vertical-align: middle;
            font-size: 8px;
        }
        
        .text-center { text-align: center; }
        .text-end { text-align: right; }
        
        .metodos-compactos {
            margin-bottom: 8px;
        }
        
        .metodo-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
            padding: 2px 0;
            border-bottom: 1px dashed #dee2e6;
            font-size: 8px;
        }
        
        .resumen-cashea {
            background: #f8f9fa;
            padding: 6px;
            border-radius: 3px;
            margin: 6px 0;
            border-left: 2px solid #0dcaf0;
        }
        
        .pagos-section {
            margin-bottom: 6px;
        }
        
        .pago-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
            padding: 3px 0;
            border-bottom: 1px dashed #dee2e6;
            font-size: 8px;
        }
        
        .pago-total {
            display: flex;
            justify-content: space-between;
            margin-top: 4px;
            padding-top: 4px;
            border-top: 1px solid #ccc;
            font-size: 8px;
        }
        
        .resumen-cuotas-compacto {
            display: flex;
            justify-content: center;
            gap: 15px;
            margin-top: 6px;
            text-align: center;
        }
        
        .cuota-info {
            text-align: center;
        }
        
        .monto-cuota {
            font-size: 7px;
            color: #666;
            margin-top: 1px;
        }
        
        .resumen-abono {
            background: #f8f9fa;
            padding: 6px;
            border-radius: 3px;
            margin: 6px 0;
            border-left: 2px solid #ffc107;
        }
        
        .abonos-section {
            margin-bottom: 6px;
        }
        
        .abono-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
            padding: 3px 0;
            border-bottom: 1px dashed #dee2e6;
            font-size: 8px;
        }
        
        .total-abonado {
            border-top: 1px solid #ccc;
            padding-top: 3px;
            margin-top: 3px;
        }
        
        .resumen-financiero {
            background: white;
            padding: 6px;
            border-radius: 3px;
            border: 1px solid #e9ecef;
            margin: 6px 0;
        }
        
        .deuda-section, .progreso-section {
            text-align: center;
            margin-bottom: 6px;
        }
        
        .deuda-label, .progreso-label {
            font-size: 7px;
            color: #666;
            margin-bottom: 1px;
        }
        
        .deuda-monto, .progreso-porcentaje {
            font-size: 10px;
            font-weight: bold;
        }
        
        .resumen-contado {
            background: #f8f9fa;
            padding: 6px;
            border-radius: 3px;
            margin: 6px 0;
            border-left: 2px solid #198754;
            text-align: center;
        }
        
        .totales-compactos {
            margin-bottom: 8px;
        }
        
        .totales-compactos table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
        }
        
        .totales-compactos td {
            padding: 3px 4px;
            border: 1px solid #dee2e6;
        }
        
        .table-success {
            background: linear-gradient(135deg, #d4edda, #c3e6cb);
        }
        
        .observaciones-compactas {
            margin-bottom: 8px;
        }
        
        .alert-warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 4px;
            border-radius: 2px;
            font-size: 8px;
        }
        
        .terminos-compactos {
            border-top: 1px solid #ddd;
            padding-top: 6px;
            margin-top: 8px;
            font-size: 7px;
            color: #666;
        }
        
        .mensaje-final {
            text-align: center;
            border-top: 1px solid #ddd;
            padding-top: 6px;
            margin-top: 6px;
            font-size: 9px;
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
            padding: 1px 3px;
            font-size: 7px;
            font-weight: 600;
            line-height: 1;
            text-align: center;
            white-space: nowrap;
            vertical-align: baseline;
            border-radius: 1px;
        }
        
        .bg-primary { background-color: #2c5aa0; color: white; }
        .bg-success { background-color: #198754; color: white; }
        .bg-info { background-color: #0dcaf0; color: black; }
        .bg-warning { background-color: #ffc107; color: black; }
        
        .progress {
            background-color: #e9ecef;
            border-radius: 4px;
            overflow: hidden;
            height: 3px;
            margin: 2px auto;
            width: 50%;
        }
        
        .progress-bar {
            background-color: #198754;
            height: 100%;
            transition: width 0.6s ease;
        }
        
        .fw-bold { font-weight: bold; }
        .small { font-size: 7px; }
        .fs-6 { font-size: 10px; }

        .page-break-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
        }

        @media print {
            body {
                padding: 20mm 10mm 10mm 10mm;
                margin: 0;
                width: 210mm;
                height: 297mm;
                font-size: 9px;
            }
            
            .recibo-container {
                border: none;
                padding: 0;
                box-shadow: none;
                max-height: 257mm;
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
        <!-- Encabezado -->
        <div class="recibo-header page-break-avoid">
            <div class="empresa-nombre">NEW VISION LENS</div>
            <div class="empresa-info">C.C. Candelaria, Local PB-04, Guarenas | Tel: 0212-365-39-42</div>
            <div class="empresa-info">RIF: J-123456789 | newvisionlens2020@gmail.com</div>
            <div class="titulo-venta">${tituloRecibo}</div>
        </div>

        <!-- Información rápida -->
        <div class="info-rapida page-break-avoid">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px;">
                <div><strong>Recibo:</strong> ${datos.numeroVenta}</div>
                <div><strong>Fecha:</strong> ${datos.fecha}</div>
                <div><strong>Hora:</strong> ${datos.hora}</div>
                <div><strong>Vendedor:</strong> ${datos.vendedor}</div>
            </div>
        </div>

        <!-- Cliente -->
        <div class="cliente-compacto page-break-avoid">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
                <div><strong>Cliente:</strong> ${datos.cliente.nombre}</div>
                <div><strong>Cédula:</strong> ${datos.cliente.cedula}</div>
                <div><strong>Teléfono:</strong> ${datos.cliente.telefono}</div>
            </div>
        </div>

        <!-- Productos -->
        <div class="productos-compactos page-break-avoid">
            <h6 style="font-weight: bold; margin-bottom: 6px; color: #2c5aa0; border-bottom: 1px solid #2c5aa0; padding-bottom: 2px;">PRODUCTOS</h6>
            <table class="tabla-productos">
                <thead>
                    <tr>
                        <th width="5%" class="text-center">#</th>
                        <th width="55%">Descripción</th>
                        <th width="10%" class="text-center">Cant</th>
                        <th width="15%" class="text-end">P. Unitario</th>
                        <th width="15%" class="text-end">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${datos.productos.map((producto: any, index: number) => `
                        <tr>
                            <td class="text-center">${index + 1}</td>
                            <td>${producto.nombre}</td>
                            <td class="text-center">${producto.cantidad || 1}</td>
                            <td class="text-end">${this.formatearMoneda(producto.precioUnitario)}</td>
                            <td class="text-end">${this.formatearMoneda(producto.subtotal)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- Métodos de pago -->
        ${datos.metodosPago && datos.metodosPago.length > 0 ? `
            <div class="metodos-compactos page-break-avoid">
                <h6 style="font-weight: bold; margin-bottom: 6px; color: #2c5aa0; border-bottom: 1px solid #2c5aa0; padding-bottom: 2px;">PAGOS</h6>
                ${datos.metodosPago.map((metodo: any) => `
                    <div class="metodo-item">
                        <span>
                            <span class="badge bg-primary">${this.formatearTipoPago(metodo.tipo)}</span>
                            ${metodo.referencia ? '- Ref: ' + metodo.referencia : ''}
                            ${metodo.banco ? '- ' + metodo.banco : ''}
                        </span>
                        <span>${this.formatearMoneda(metodo.monto)}</span>
                    </div>
                `).join('')}
            </div>
        ` : ''}

        <!-- SECCIÓN CASHEA COMPLETA - CORREGIDA -->
        ${datos.cashea ? `
            <div class="resumen-venta page-break-avoid">
                <h6 style="font-weight: bold; margin-bottom: 6px; color: #2c5aa0; border-bottom: 1px solid #2c5aa0; padding-bottom: 2px;">RESUMEN DE VENTA</h6>
                
                <div class="resumen-cashea">
                    <!-- Forma de pago -->
                    <div style="text-align: center; margin-bottom: 8px;">
                        <span class="badge bg-info fs-6">PLAN CASHEA</span>
                    </div>

                    <!-- Información del plan Cashea -->
                    <div style="text-align: center; margin-bottom: 8px;">
                        <div class="cashea-info">
                            <div class="nivel-cashea" style="margin-bottom: 4px;">
                                <small class="text-muted">NIVEL</small>
                                <div class="fw-bold text-primary" style="font-size: 10px;">${this.obtenerNombreNivelCashea(datos.cashea.nivel)}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Desglose de pagos - CORREGIDO -->
                    <div class="pagos-section">
                        <h6 style="text-align: center; margin-bottom: 8px; font-weight: bold; color: #2c5aa0; font-size: 10px;">DESGLOSE DE PAGOS</h6>

                        <!-- Pago inicial -->
                        <div class="pago-item">
                            <div style="text-align: center; width: 50%;">
                                <strong style="font-size: 9px;">Pago Inicial</strong>
                            </div>
                            <div style="text-align: center; width: 50%;">
                                <strong style="font-size: 9px;">${this.formatearMoneda(datos.cashea.inicial)}</strong>
                            </div>
                        </div>

                        <!-- Cuotas adelantadas -->
                        ${datos.cashea.cuotasAdelantadas > 0 ? `
                            <div class="pago-item">
                                <div style="text-align: center; width: 50%;">
                                    <strong style="font-size: 9px;">${datos.cashea.cuotasAdelantadas} Cuota${datos.cashea.cuotasAdelantadas > 1 ? 's' : ''} Adelantada${datos.cashea.cuotasAdelantadas > 1 ? 's' : ''}</strong>
                                </div>
                                <div style="text-align: center; width: 50%;">
                                    <strong style="font-size: 9px;">${this.formatearMoneda(datos.cashea.montoAdelantado)}</strong>
                                </div>
                            </div>
                        ` : ''}

                        <!-- Total pagado ahora - CORREGIDO: MISMA FILA QUE LOS TÍTULOS -->
                        <div class="pago-total">
                            <div style="text-align: center; width: 50%;">
                                <strong style="font-size: 9px;">TOTAL PAGADO AHORA:</strong>
                            </div>
                            <div style="text-align: center; width: 50%;">
                                <strong class="text-success" style="font-size: 9px;">${this.formatearMoneda(datos.totales.totalPagado)}</strong>
                            </div>
                        </div>
                    </div>

                    <!-- Resumen de cuotas -->
                    <div class="resumen-cuotas-compacto">
                        <div class="cuota-info">
                            <small class="text-muted" style="font-size: 8px;">CUOTAS PENDIENTES</small>
                            <div class="fw-bold text-warning" style="font-size: 10px;">${datos.cashea.cantidadCuotas - datos.cashea.cuotasAdelantadas}</div>
                            <div class="monto-cuota">${this.formatearMoneda(datos.cashea.montoCuota)} c/u</div>
                        </div>
                        <div class="cuota-info">
                            <small class="text-muted" style="font-size: 8px;">DEUDA PENDIENTE</small>
                            <div class="fw-bold text-danger" style="font-size: 10px;">${this.formatearMoneda(datos.cashea.deudaPendiente)}</div>
                            <div class="monto-cuota">${this.formatearMoneda(datos.cashea.montoCuota * (datos.cashea.cantidadCuotas - datos.cashea.cuotasAdelantadas))} total</div>
                        </div>
                    </div>
                </div>
            </div>
        ` : ''}

        <!-- Resto del código se mantiene igual -->
        ${datos.abono ? `
            <div class="resumen-venta page-break-avoid">
                <h6 style="font-weight: bold; margin-bottom: 6px; color: #2c5aa0; border-bottom: 1px solid #2c5aa0; padding-bottom: 2px;">RESUMEN DE VENTA</h6>
                
                <div class="resumen-abono">
                    <!-- Forma de pago -->
                    <div style="text-align: center; margin-bottom: 8px;">
                        <span class="badge bg-warning text-dark fs-6">ABONO PARCIAL</span>
                    </div>

                    <!-- Abonos realizados -->
                    <div class="abonos-section">
                        <h6 style="text-align: center; margin-bottom: 8px; font-weight: bold; color: #2c5aa0; font-size: 10px;">ABONOS REALIZADOS</h6>

                        <div class="abonos-list">
                            <div class="abono-item">
                                <div style="text-align: center; width: 50%;">
                                    <strong style="font-size: 9px;">${datos.fecha}</strong>
                                </div>
                                <div style="text-align: center; width: 50%;">
                                    <strong style="font-size: 9px;">${this.formatearMoneda(datos.abono.montoAbonado)}</strong>
                                </div>
                            </div>
                            
                            <!-- Total abonado EN LA MISMA SECCIÓN -->
                            <div class="abono-item total-abonado" style="border-top: 1px solid #ccc; padding-top: 4px; margin-top: 4px;">
                                <div style="text-align: center; width: 50%;">
                                    <strong style="font-size: 9px;">TOTAL ABONADO:</strong>
                                </div>
                                <div style="text-align: center; width: 50%;">
                                    <strong class="text-success" style="font-size: 9px;">${this.formatearMoneda(datos.abono.montoAbonado)}</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Resumen financiero -->
                    <div class="resumen-financiero">
                        <div class="deuda-section">
                            <div class="deuda-label">DEUDA PENDIENTE</div>
                            <div class="deuda-monto text-danger">${this.formatearMoneda(datos.abono.deudaPendiente)}</div>
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
        ` : ''}

        ${!datos.cashea && !datos.abono ? `
            <div class="resumen-venta page-break-avoid">
                <h6 style="font-weight: bold; margin-bottom: 6px; color: #2c5aa0; border-bottom: 1px solid #2c5aa0; padding-bottom: 2px;">RESUMEN DE VENTA</h6>
                
                <div class="resumen-contado">
                    <div style="margin-bottom: 6px;">
                        <strong style="font-size: 10px;">Forma de pago:</strong><br>
                        <span class="badge bg-success">CONTADO</span>
                    </div>
                    <div>
                        <strong style="font-size: 10px;">Monto total:</strong><br>
                        ${this.formatearMoneda(datos.totales.totalPagado)}
                    </div>
                    <div style="margin-top: 6px; font-size: 9px; color: #666;">
                        El pago ha sido realizado en su totalidad
                    </div>
                </div>
            </div>
        ` : ''}

        <!-- Totales -->
        <div class="totales-compactos page-break-avoid">
            <div style="display: flex; justify-content: flex-end;">
                <div style="width: 50%;">
                    <table style="width: 100%;">
                        <tr>
                            <td class="fw-bold" style="font-size: 10px;">Subtotal:</td>
                            <td class="text-end" style="font-size: 10px;">${this.formatearMoneda(datos.totales.subtotal)}</td>
                        </tr>
                        <tr>
                            <td class="fw-bold" style="font-size: 10px;">Descuento:</td>
                            <td class="text-end text-danger" style="font-size: 10px;">- ${this.formatearMoneda(datos.totales.descuento)}</td>
                        </tr>
                        <tr>
                            <td class="fw-bold" style="font-size: 10px;">IVA:</td>
                            <td class="text-end" style="font-size: 10px;">${this.formatearMoneda(datos.totales.iva)}</td>
                        </tr>
                        <tr class="table-success">
                            <td class="fw-bold" style="font-size: 11px;">${this.getTextoTotalPagadoParaHTML(formaPago)}:</td>
                            <td class="text-end fw-bold" style="font-size: 11px;">${this.formatearMoneda(datos.totales.totalPagado)}</td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>

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
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 6px;">
                <div>
                    <p style="margin-bottom: 2px;">
                        <i class="bi bi-exclamation-triangle"></i>
                        Pasados 30 días no nos hacemos responsables de trabajos no retirados
                    </p>
                    <p style="margin-bottom: 0;">
                        <i class="bi bi-info-circle"></i>
                        Estado de orden: tracking.optolapp.com
                    </p>
                </div>
                <div style="text-align: right;">
                    <small>${new Date().getFullYear()} © New Vision Lens</small>
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

        setTimeout(() => {
            try {
                ventanaImpresion.focus();
                ventanaImpresion.print();
            } catch (error) {
                console.error('Error al imprimir:', error);
                this.swalService.showInfo(
                    'Recibo listo',
                    'El recibo se ha generado. Usa Ctrl+P para imprimir manualmente.'
                );
            }
        }, 500);
    }

    // === MÉTODOS AUXILIARES ===
    formatearMoneda(monto: number | null | undefined): string {
        // Validar que el monto sea un número válido
        if (monto === null || monto === undefined || isNaN(monto)) {
            return '$0.00';
        }

        // Asegurarse de que es un número
        const montoNumerico = Number(monto);

        if (isNaN(montoNumerico)) {
            return '$0.00';
        }

        return `$${montoNumerico.toFixed(2)}`;
    }

    private manejarErrorGeneracion(error: any): void {
        console.error('Error al generar venta:', error);
        const mensaje = error?.message || 'Ocurrió un error inesperado al generar la venta';
        this.swalService.showError('Error en la transacción', mensaje);
    }

    private cerrarModalResumen(): void {
        const modalElement = document.getElementById('resumenVentaModal');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            }
        }
    }















    // === MÉTODOS DEL RECIBO ===

    /**
 * Muestra el modal de recibo automáticamente después de generar la venta
 */
    private mostrarReciboAutomatico(): void {
        this.loader.updateMessage('¡Venta generada exitosamente!');

        // Crear datos del recibo con información REAL
        this.datosRecibo = this.crearDatosReciboReal();
        // Depurar datos para verificar
        this.verificarDatosRecibo();

        this.informacionVenta = {
            numeroVenta: this.datosRecibo.numeroVenta,
            fecha: this.datosRecibo.fecha,
            hora: this.datosRecibo.hora,
            estado: 'Completada',
            formaPago: this.venta.formaPago
        };

        setTimeout(() => {
            this.loader.hide();
            this.mostrarModalRecibo = true;
            this.ventaGenerada = true;
            this.cerrarModalResumen();
            this.cdr.detectChanges();
        }, 1000);
    }

    /**
     * Cierra el modal de recibo y resetea la venta
     */
    cerrarModalRecibo(): void {
        this.limpiarSelectProductos();
        this.mostrarModalRecibo = false;
        this.ventaGenerada = false;
        this.datosRecibo = null;

        setTimeout(() => {
            this.resetearVenta();
            this.cdr.detectChanges();
        }, 300);
    }

    /**
     * Formatea el tipo de pago para mostrar en el recibo
     */
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

    private resetearVenta(): void {
        // Resetear el objeto venta
        this.venta = {
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

        // Limpiar todas las selecciones
        this.pacienteSeleccionado = null;
        this.productoSeleccionado = undefined;
        this.asesorSeleccionado = this.currentUser?.id ?? null;

        // Resetear Cashea
        this.resumenCashea = { cantidad: 0, total: 0, totalBs: 0 };
        this.cuotasCashea = [];
        this.valorInicialTemporal = '';
        this.valorTemporal = '';
        this.nivelCashea = 'nivel3';
        this.cantidadCuotasCashea = 3;

        // Resetear paciente
        this.requierePaciente = false;
        this.historiaMedica = null;

        // Actualizar la vista
        this.actualizarProductosConDetalle();
    }


    /**
     * Descarga el recibo como PDF
     */
    descargarPDF(): void {
        // Generar cuotas Cashea si no existen
        if (this.venta.formaPago === 'cashea' && (!this.cuotasCashea || this.cuotasCashea.length === 0)) {
            this.generarCuotasCashea();
        }

        const datos = this.datosRecibo || this.crearDatosReciboReal();
        const htmlContent = this.generarReciboHTML(datos);

        const ventana = window.open('', '_blank', 'width=400,height=600');

        if (!ventana) {
            this.swalService.showError('Error', 'No se pudo abrir la ventana para descargar.');
            return;
        }

        ventana.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Recibo_${datos.numeroVenta}_PDF</title>
        <style>
            body { margin: 0; padding: 10px; background: white; }
            .download-header { text-align: center; padding: 20px; background: #28a745; color: white; }
            @media print { .download-header { display: none; } }
        </style>
        <script>window.onload = () => window.print();</script>
    </head>
    <body>
        <div class="download-header">
            <h3>📥 Descargando Recibo...</h3>
        </div>
        ${htmlContent}
    </body>
    </html>
    `);
        ventana.document.close();

        this.swalService.showInfo('Descargar PDF', 'Se ha abierto una ventana para descargar el recibo.');
    }
    /**
     * Comparte por Email
     */
    compartirEmail(): void {
        const datos = this.datosRecibo || this.crearDatosReciboReal();
        const asunto = `Recibo de Venta ${datos.numeroVenta}`;
        const cuerpo = `Hola,\n\nTe comparto los detalles de la venta ${datos.numeroVenta}:\n- Total: ${this.formatearMoneda(datos.totales.totalPagado)}\n- Fecha: ${datos.fecha}\n- Cliente: ${datos.cliente.nombre}\n\n¡Gracias por tu preferencia!`;

        const mailtoLink = `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
        window.location.href = mailtoLink;
    }

    /**
     * Copia enlace del recibo
     */
    async copiarEnlace(): Promise<void> {
        const datos = this.datosRecibo || this.crearDatosReciboReal();
        const texto = `Recibo de Venta ${datos.numeroVenta} - Total: ${this.formatearMoneda(datos.totales.totalPagado)} - Fecha: ${datos.fecha}`;

        try {
            await navigator.clipboard.writeText(texto);
            this.swalService.showSuccess('Éxito', 'Información del recibo copiada al portapapeles');
        } catch (error) {
            console.error('Error al copiar:', error);
            this.swalService.showError('Error', 'No se pudo copiar la información');
        }
    }

    getProductosSeguros(): any[] {
        return this.datosRecibo?.productos || this.venta.productos.map(p => ({
            nombre: p.nombre,
            cantidad: p.cantidad,
            precioUnitario: p.precio,
            subtotal: (p.precio || 0) * (p.cantidad || 1)
        }));
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
        return this.datosRecibo?.totales?.subtotal || this.totalProductos;
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

    /**
    * Obtiene el título del recibo según la forma de pago REAL
    */
    getTituloRecibo(): string {
        // Usar la forma de pago de los datos del recibo si existe, sino usar la actual
        const formaPago = this.datosRecibo?.configuracion?.formaPago || this.venta.formaPago;

        //console.log('formaPago', formaPago);

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
    /**
     * Obtiene el texto para el total pagado según la forma de pago
     */
    /**
   * Obtiene el texto para el total pagado según la forma de pago REAL
   */
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

    /**
     * Obtiene el mensaje final según la forma de pago
     */
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

    /**
     * Calcula la deuda pendiente para Cashea
     */
    getDeudaPendienteCashea(): number {
        if (this.venta.formaPago !== 'cashea') return 0;

        const total = this.montoTotal;
        const pagadoAhora = this.totalPagadoCashea;

        return Math.max(total - pagadoAhora, 0);
    }

    /**
     * Calcula la deuda pendiente para Abono
     */
    getDeudaPendienteAbono(): number {
        if (this.venta.formaPago !== 'abono') return 0;

        const total = this.montoTotal;
        const abonado = this.venta.montoAbonado || 0;

        return Math.max(total - abonado, 0);
    }

    /**
  * Crea datos del recibo basados en la información real de la venta
  */
    private crearDatosReciboReal(): any {
        const fechaActual = new Date();

        // Obtener información de la sede del usuario actual
        const sedeInfo = this.currentUser?.sede || 'Sede Principal';
        const telefonoSede = '0212-365-39-42';
        const rifSede = 'J-123456789';

        // Calcular totales reales
        const subtotal = this.totalProductos || 0;
        const descuento = this.venta?.descuento ? (subtotal * (this.venta.descuento / 100)) : 0;
        const iva = this.productosConDetalle?.reduce((sum, p) => sum + (p.iva || 0), 0) || 0;
        const total = this.montoTotal || 0;

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

        // Obtener productos con detalles calculados
        const productosConDetalles = this.obtenerProductosConDetalles();

        // Crear objeto base del recibo
        const datosRecibo: any = {
            // Información general
            numeroVenta: 'V-' + Date.now().toString().slice(-6),
            fecha: fechaActual.toLocaleDateString('es-VE'),
            hora: fechaActual.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
            vendedor: this.getResumenAsesor() || 'Vendedor',

            // Información de la sede
            sede: {
                nombre: sedeInfo,
                direccion: 'C.C. Candelaria, Local PB-04, Guarenas',
                telefono: telefonoSede,
                rif: rifSede,
                email: 'newvisionlens2020@gmail.com'
            },

            // Información del cliente
            cliente: {
                nombre: this.pacienteSeleccionado?.informacionPersonal?.nombreCompleto || 'CLIENTE GENERAL',
                cedula: this.pacienteSeleccionado?.informacionPersonal?.cedula || 'N/A',
                telefono: this.pacienteSeleccionado?.informacionPersonal?.telefono || 'N/A'
            },

            // Productos reales del carrito con detalles calculados
            productos: productosConDetalles,

            // Métodos de pago reales
            metodosPago: this.venta.metodosDePago.map(m => ({
                tipo: m.tipo || 'efectivo',
                monto: m.monto || 0,
                referencia: m.referencia || '',
                banco: m.banco || '',
                moneda: this.getMonedaParaMetodo(m.tipo)
            })),

            // Totales reales
            totales: {
                subtotal: subtotal,
                descuento: descuento,
                iva: iva,
                total: total,
                totalPagado: totalPagado
            },

            // Configuración de la venta - INCLUIR FORMA DE PAGO REAL
            configuracion: {
                formaPago: this.venta.formaPago, // ← ESTA ES LA CLAVE
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
                // Agregar array de abonos para estructura de tabla
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

    /**
     * Obtiene los productos con sus detalles calculados
     */
    private obtenerProductosConDetalles(): any[] {
        return this.venta.productos.map((p, index) => {
            // Buscar el producto en productosConDetalle
            const productoCalculado = this.productosConDetalle.find(pc => pc.id === p.id);

            // Si encontramos el producto calculado, usar esos datos
            if (productoCalculado) {
                return {
                    nombre: p.nombre || 'Producto',
                    codigo: p.codigo || 'N/A',
                    cantidad: p.cantidad || 1,
                    precioUnitario: p.precio || 0,
                    precioConIva: p.precioConIva || 0,
                    subtotal: productoCalculado.subtotal || 0,
                    iva: productoCalculado.iva || 0,
                    total: productoCalculado.total || 0,
                    aplicaIva: p.aplicaIva || false,
                    moneda: p.moneda
                };
            }

            // Si no encontramos el producto calculado, calcular los valores manualmente
            /*  const cantidad = p.cantidad || 1;
              const precioUnitario = p.precio || 0;
              const subtotal = precioUnitario * cantidad;
              const iva = p.aplicaIva ? subtotal * (this.ivaPorcentaje / 100) : 0;
              const total = subtotal + iva;*/

            return {
                nombre: p.nombre || 'Producto',
                codigo: p.codigo || 'N/A',
                cantidad: p.cantidad,
                precioUnitario: p.precio,
                precioConIva: p.precioConIva || 0,
                subtotal: productoCalculado.subtotal,
                iva: productoCalculado.iva,
                total: productoCalculado.total,
                aplicaIva: p.aplicaIva || false,
                moneda: p.moneda
            };
        });
    }

    /**
     * Compartir por WhatsApp mejorado con información específica
     */
    compartirWhatsApp(): void {
        const datos = this.datosRecibo || this.crearDatosReciboReal();

        let mensaje = `*NEW VISION LENS* 🛍️\n\n`;
        mensaje += `*${this.getTituloRecibo()}:* ${datos.numeroVenta}\n`;
        mensaje += `*Fecha:* ${datos.fecha}\n`;
        mensaje += `*Hora:* ${datos.hora}\n`;
        mensaje += `*Cliente:* ${datos.cliente.nombre}\n`;
        mensaje += `*Cédula:* ${datos.cliente.cedula}\n`;

        // Información específica por tipo de pago
        switch (this.venta.formaPago) {
            case 'abono':
                mensaje += `*Forma de pago:* ABONO PARCIAL\n`;
                mensaje += `*Monto abonado:* ${this.formatearMoneda(datos.totales.totalPagado)}\n`;
                mensaje += `*Deuda pendiente:* ${this.formatearMoneda(this.getDeudaPendienteAbono())}\n`;
                mensaje += `*Porcentaje pagado:* ${Math.round(this.porcentajeAbonadoDelTotal)}%\n\n`;
                mensaje += `¡Gracias por su abono! 🎉\n`;
                break;

            case 'cashea':
                mensaje += `*Forma de pago:* CASHEA\n`;
                mensaje += `*Nivel:* ${this.obtenerNombreNivelCashea(this.nivelCashea)}\n`;
                mensaje += `*Total pagado ahora:* ${this.formatearMoneda(datos.totales.totalPagado)}\n`;
                mensaje += `*Inicial:* ${this.formatearMoneda(this.venta.montoInicial)}\n`;
                if (this.resumenCashea.cantidad > 0) {
                    mensaje += `*Cuotas adelantadas:* ${this.resumenCashea.cantidad}\n`;
                }
                mensaje += `*Deuda pendiente:* ${this.formatearMoneda(this.getDeudaPendienteCashea())}\n`;
                mensaje += `*Cuotas restantes:* ${this.cantidadCuotas - this.resumenCashea.cantidad}\n\n`;
                mensaje += `¡Plan Cashea activado! 📅\n`;
                break;

            case 'contado':
            default:
                mensaje += `*Forma de pago:* CONTADO\n`;
                mensaje += `*Total pagado:* ${this.formatearMoneda(datos.totales.totalPagado)}\n\n`;
                mensaje += `¡Pago completado! ✅\n`;
        }

        // Métodos de pago utilizados
        if (datos.metodosPago && datos.metodosPago.length > 0) {
            mensaje += `\n*Métodos de pago:*\n`;
            datos.metodosPago.forEach((metodo: any) => {
                mensaje += `• ${this.formatearTipoPago(metodo.tipo)}: ${this.formatearMoneda(metodo.monto)}\n`;
            });
        }

        mensaje += `\nConserve este comprobante para cualquier reclamo.`;

        const urlWhatsApp = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
        window.open(urlWhatsApp, '_blank');

        this.swalService.showSuccess('Compartir', 'Redirigiendo a WhatsApp...');
    }


    /**
 * Método para depurar y verificar los datos del recibo
 */
    private verificarDatosRecibo(): void {
        console.log('=== DEPURACIÓN DATOS RECIBO ===');
        console.log('Forma de pago en venta:', this.venta.formaPago);
        console.log('Forma de pago en datosRecibo:', this.datosRecibo?.configuracion?.formaPago);
        console.log('Datos Cashea:', this.datosRecibo?.cashea);
        console.log('Nivel Cashea:', this.nivelCashea);
        console.log('Monto inicial:', this.venta.montoInicial);
        console.log('Total pagado Cashea:', this.totalPagadoCashea);
        console.log('==============================');
    }
}