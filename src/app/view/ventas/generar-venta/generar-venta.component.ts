import { Component, OnInit, ChangeDetectorRef, OnDestroy, ViewChild } from '@angular/core';
import { Producto } from '../../productos/producto.model';
import { ProductoService } from '../../productos/producto.service';
import { SystemConfigService } from '../../system-config/system-config.service';
import { GenerarVentaService } from './generar-venta.service';
import { Tasa } from '../../../Interfaces/models-interface';
import { SwalService } from '../../../core/services/swal/swal.service';
import { forkJoin, map, Subject, Observable, of } from 'rxjs';
import { take } from 'rxjs/operators';
import { LoaderService } from './../../../shared/loader/loader.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UserStateService } from '../../../core/services/userState/user-state-service';
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
import { NgSelectComponent } from '@ng-select/ng-select';
import * as jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

    // === PROPIEDADES ADICIONALES PARA GENERACIÓN DE VENTA ===
    generandoVenta: boolean = false;
    generandoRecibo: boolean = false;
    ventaGenerada: boolean = false;
    urlRecibo: string = '';
    errorGeneracion: string = '';

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

    onProductoSeleccionadoChange(productoId: string): void {
        if (!productoId) return;

        // Buscar el producto completo por ID
        const producto = this.productosFiltradosPorSede.find(p => p.id === productoId);

        if (producto) {
            this.agregarProductoAlCarrito(producto);
            // Limpiar la selección después de agregar
            setTimeout(() => {
                this.productoSeleccionado = null;
            }, 100);
        }
    }

    // Mantener tu método original pero asegurarte de que recibe el objeto completo
    agregarProductoAlCarrito(producto: any): void {
        // Validación CRÍTICA: Verificar que el producto existe y tiene ID
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
        this.limpiarSelectProductos();

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

        // Obtener el máximo disponible en la MONEDA DEL MÉTODO
        const maximoEnMonedaMetodo = this.getMontoRestanteParaMetodo(index);

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
        } else {
            // Para contado y abono, usar la moneda del sistema
            this.venta.moneda = this.normalizarMonedaParaVenta(this.monedaSistema);
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
        let inicial = this.venta.montoInicial ?? this.calcularInicialCasheaPorNivel(total, this.nivelCashea);

        // Validar que el inicial no exceda el total
        if (inicial > total) {
            inicial = total;
        }

        const restante = Math.max(total - inicial, 0); // Asegurar que no sea negativo
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
        // Validar que estamos en modo Cashea
        if (this.venta.formaPago !== 'cashea') {
            return;
        }

        // Asegurar que Cashea siempre use dólares
        this.venta.moneda = 'dolar';

        // Validar que el monto inicial no sea mayor al total
        const total = this.montoTotal;
        const inicial = this.venta.montoInicial ?? 0;

        if (inicial > total) {
            this.venta.montoInicial = total;
            this.valorInicialTemporal = `${total.toFixed(2)} ${this.obtenerSimboloMoneda(this.venta.moneda)}`;
        }

        // Recalcular el plan
        const plan = this.calcularCasheaPlan(this.cantidadCuotasCashea);

        // Actualizar las cuotas
        this.cuotasCashea = plan.cuotasOrdenadas.map((cuota, index) => ({
            ...cuota,
            habilitada: index === 0
        }));

        // Actualizar resumen
        this.actualizarResumenCashea();

        // Forzar actualización de la vista
        this.cdr.detectChanges();
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
        // 1. Calcular lo que ya se ha pagado en otros métodos (en la moneda del sistema - euros)
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
            this.generarCuotasCashea();
            return;
        }

        const monto = parseFloat(limpio);
        const minimo = this.calcularInicialCasheaPorNivel(this.montoTotal, this.nivelCashea);

        if (isNaN(monto)) {
            this.venta.montoInicial = 0;
            this.valorInicialTemporal = '';
            this.generarCuotasCashea();
            return;
        }

        if (monto < minimo) {
            this.venta.montoInicial = minimo;
            this.valorInicialTemporal = `${minimo.toFixed(2)} ${this.obtenerSimboloMoneda(this.venta.moneda)}`;
            this.generarCuotasCashea();
            return;
        }

        this.venta.montoInicial = monto;
        this.valorInicialTemporal = `${monto.toFixed(2)} ${this.obtenerSimboloMoneda(this.venta.moneda)}`;
        this.generarCuotasCashea();
    }

    onMontoInicialChange(): void {
        if (this.venta.formaPago === 'cashea') {
            // Forzar regeneración de cuotas cuando el monto inicial cambia
            this.generarCuotasCashea();

            // También actualizar el resumen
            this.actualizarResumenCashea();

            // Forzar detección de cambios
            this.cdr.detectChanges();
        }
    }

    ngAfterViewInit(): void {
        const modalElement = document.getElementById('resumenVentaModal');
        if (modalElement) {
            modalElement.addEventListener('hidden.bs.modal', () => {
                this.resetearVentaCompleta();
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
        this.productoSeleccionado = null;

        setTimeout(() => {
            if (this.productoSelect?.isOpen) {
                this.productoSelect.close();
            }
        });
    }

    resetearModalVenta(): void {
        // Limpiar propiedades básicas de venta
        this.venta.descuento = 0;
        this.venta.observaciones = '';
        this.venta.montoInicial = 0;
        this.venta.numeroCuotas = 0;
        this.venta.montoAbonado = 0;
        this.venta.metodosDePago = [];

        // IMPORTANTE: Restablecer la forma de pago a contado Y la moneda a la del sistema
        this.venta.formaPago = 'contado';
        this.venta.moneda = this.normalizarMonedaParaVenta(this.monedaSistema); // ← Esto es clave

        this.venta.impuesto = 16;
        this.valorInicialTemporal = '';
        this.valorTemporal = '';
        this.montoExcedido = false;

        // Limpiar propiedades específicas de Cashea
        this.nivelCashea = 'nivel3';
        this.cantidadCuotasCashea = 3;
        this.cuotasCashea = [];
        this.resumenCashea = { cantidad: 0, total: 0, totalBs: 0 };

        // Restablecer moneda efectivo
        this.monedaEfectivo = this.monedaSistema; // ← Usar moneda del sistema

        // Forzar actualización de productos con la moneda correcta
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

        return `${asesor.nombre} — ${asesor.cargoNombre || 'Asesor'}`;
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
        // Forzar actualización de la vista
        this.cdr.detectChanges();

        // Verificar que el asesor existe
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

        // Convertir desde la moneda del método a bolívares
        if (monedaMetodo === 'dolar') {
            return this.redondear(monto * (this.tasasPorId['dolar'] ?? 1));
        } else if (monedaMetodo === 'euro') {
            return this.redondear(monto * (this.tasasPorId['euro'] ?? 1));
        } else {
            return this.redondear(monto); // Ya está en bolívares
        }
    }

    getInfoConversionMetodo(metodo: any): string {
        if (!metodo.monto || metodo.monto <= 0) return '';

        const monedaMetodo = this.getMonedaParaMetodo(metodo.tipo);
        const montoEnSistema = this.convertirMontoExacto(metodo.monto, monedaMetodo, this.venta.moneda);

        if (monedaMetodo === this.venta.moneda) {
            return ''; // No mostrar conversión si es la misma moneda
        }

        return `⇄ ${montoEnSistema.toFixed(2)} ${this.obtenerSimboloMoneda(this.venta.moneda)}`;
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

    onTipoMetodoChange(index: number): void {
        const metodo = this.venta.metodosDePago[index];

        metodo.monto = 0;
        metodo.valorTemporal = '';
        metodo.referencia = '';
        metodo.bancoCodigo = '';
        metodo.bancoNombre = '';
        metodo.banco = '';
        metodo.bancoObject = null;

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

    private parsearFechaCuota(fechaString: string): Date {
        try {
            // Formato: "vie, 13 de febrero de 2026"
            const partes = fechaString.split(', ');
            if (partes.length > 1) {
                const fechaParte = partes[1]; // "13 de febrero de 2026"

                const meses: { [key: string]: number } = {
                    'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3,
                    'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7,
                    'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
                };

                const fechaPartes = fechaParte.split(' de ');
                if (fechaPartes.length === 3) {
                    const dia = parseInt(fechaPartes[0]);
                    const mes = meses[fechaPartes[1].toLowerCase()];
                    const año = parseInt(fechaPartes[2]);

                    if (!isNaN(dia) && mes !== undefined && !isNaN(año)) {
                        const fecha = new Date(año, mes, dia);
                        return fecha;
                    }
                }
            }

            const fechaFallback = new Date(fechaString);
            if (!isNaN(fechaFallback.getTime())) {
                return fechaFallback;
            }

            console.warn('Usando fecha fallback para:', fechaString);
            return new Date(2030, 0, 1);
        } catch (error) {
            console.error('Error al parsear fecha de cuota:', fechaString, error);
            return new Date(2030, 0, 1);
        }
    }

    prepararDatosParaAPI(): any {
        const fechaActual = new Date();

        let estadoVenta = 'completada';

        if (this.venta.formaPago === 'abono') {
            const montoAbonado = this.venta.montoAbonado || 0;
            const montoTotal = this.montoTotal;
            const diferencia = Math.abs(montoAbonado - montoTotal);
            estadoVenta = diferencia < 0.01 ? 'completada' : 'pendiente';

        } else if (this.venta.formaPago === 'cashea') {
            //Determinar estado por fecha de última cuota
            if (this.cuotasCashea && this.cuotasCashea.length > 0) {
                // Obtener la fecha de la última cuota
                const ultimaCuota = this.cuotasCashea[this.cuotasCashea.length - 1];
                const fechaUltimaCuota = this.parsearFechaCuota(ultimaCuota.fecha);

                // Si la fecha actual es posterior a la fecha de la última cuota, está completada
                estadoVenta = fechaActual > fechaUltimaCuota ? 'completada' : 'pendiente';

            } else {
                // Si no hay cuotas, usar lógica de monto como fallback
                const totalPagadoCashea = this.totalPagadoCashea;
                const montoTotal = this.montoTotal;
                const diferencia = Math.abs(totalPagadoCashea - montoTotal);
                estadoVenta = diferencia < 0.01 ? 'completada' : 'pendiente';
            }
        }

        // Preparar datos del cliente
        let clienteData: any = {};
        if (this.requierePaciente && this.pacienteSeleccionado) {
            clienteData = {
                tipo: 'paciente',
                informacion: {
                    nombreCompleto: this.pacienteSeleccionado.informacionPersonal?.nombreCompleto,
                    cedula: this.pacienteSeleccionado.informacionPersonal?.cedula,
                    telefono: this.pacienteSeleccionado.informacionPersonal?.telefono,
                    email: this.pacienteSeleccionado.informacionPersonal?.email
                },
                validado: true // Pacientes siempre están validados
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
                validado: this.clienteEncontrado, // Indica si fue validado por API
                requiereRegistro: !this.clienteEncontrado // Indica si necesita ser guardado en BD
            };
        }

        const productosData = this.venta.productos.map(producto => ({
            productoId: producto.id,
            cantidad: producto.cantidad,
            moneda: producto.moneda
        }));

        // Preparar métodos de pago
        const metodosPagoData = this.venta.metodosDePago.map(metodo => ({
            tipo: metodo.tipo,
            monto: metodo.monto,
            moneda: this.getMonedaParaMetodo(metodo.tipo),
            referencia: metodo.referencia || null,
            bancoCodigo: metodo.bancoCodigo || null,
            bancoNombre: metodo.bancoNombre || null
        }));

        // Preparar datos específicos por forma de pago
        let formaPagoData: any = {};
        switch (this.venta.formaPago) {
            case 'contado':
                formaPagoData = {
                    tipo: 'contado',
                    montoTotal: this.montoTotal,
                    montoInicial: 0,
                    cantidadCuotas: "0",
                    montoPorCuota: 0,
                    cuotasAdelantadas: 0,
                    montoAdelantado: 0,
                    totalPagadoAhora: this.totalPagadoPorMetodos,
                    deudaPendiente: 0,
                    cuotas: []
                };
                break;

            case 'abono':
                formaPagoData = {
                    tipo: 'abono',
                    montoTotal: this.montoTotal,
                    montoInicial: this.venta.montoAbonado,
                    cantidadCuotas: "0",
                    montoPorCuota: 0,
                    cuotasAdelantadas: 0,
                    montoAdelantado: 0,
                    totalPagadoAhora: this.venta.montoAbonado,
                    deudaPendiente: this.getDeudaPendienteAbono(),
                    cuotas: []
                };
                break;

            case 'cashea':
                formaPagoData = {
                    tipo: 'cashea',
                    nivel: this.nivelCashea,
                    montoTotal: this.montoTotal,
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
                break;
        }

        // Estructura completa para el API
        const datosParaAPI = {
            venta: {
                fecha: fechaActual.toISOString(),
                estado: estadoVenta,
                formaPago: this.venta.formaPago,
                moneda: this.venta.moneda,
                observaciones: this.venta.observaciones || null,
                impuesto: this.venta.impuesto
            },
            totales: {
                subtotal: this.totalProductos,
                descuento: this.venta.descuento ? (this.totalProductos * (this.venta.descuento / 100)) : 0,
                iva: this.productosConDetalle.reduce((sum, p) => sum + (p.iva || 0), 0),
                total: this.montoTotal,
                totalPagado: this.totalPagadoPorMetodos
            },
            cliente: clienteData,
            asesor: {
                id: parseInt(this.asesorSeleccionado || '0')
            },
            productos: productosData,
            metodosPago: metodosPagoData,
            formaPago: formaPagoData,
            auditoria: {
                usuarioCreacion: parseInt(this.currentUser?.id || '0'),
                fechaCreacion: fechaActual.toISOString()
            }
        };

        return datosParaAPI;
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

            this.loader.showWithMessage('🔄 Generando venta...');
            await new Promise(resolve => setTimeout(resolve, 1000));

            const datosParaAPI = this.prepararDatosParaAPI();

            this.generarVentaService.crearVenta(datosParaAPI).subscribe({
                next: async (resultado: any) => {

                    if (resultado.message === 'ok' && resultado.venta) {
                        const numeroVenta = resultado.venta.venta?.key ||
                            resultado.venta.numeroVenta ||
                            `V-${Date.now().toString().slice(-6)}`;

                        this.loader.updateMessage('✅ Venta generada exitosamente');

                        await new Promise(resolve => setTimeout(resolve, 2000));

                        this.loader.updateMessage('📄 Generando recibo de pago...');

                        await new Promise(resolve => setTimeout(resolve, 1000));

                        this.loader.hide();

                        // Mostrar recibo automáticamente 
                        this.mostrarReciboAutomatico({
                            ...datosParaAPI,
                            numeroVenta: numeroVenta,
                            ventaId: resultado.venta.venta?.key,
                            datosRealesAPI: resultado.venta
                        });

                        this.limpiarSelectProductos();
                        this.resetearModalVenta();

                    } else {
                        throw new Error(resultado.message || 'Error al generar la venta');
                    }
                },
                error: (error) => {
                    console.error('Error en la llamada al API:', error);

                    this.loader.updateMessage('Error al procesar la venta');

                    setTimeout(() => {
                        this.loader.hide();

                        let mensajeError = 'Error al conectar con el servidor';

                        if (error.error?.message) {
                            mensajeError = error.error.message;
                        } else if (error.message) {
                            mensajeError = error.message;
                        } else if (error.error) {
                            mensajeError = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
                        }

                        this.swalService.showError('Error en la transacción', mensajeError);
                    }, 1500);
                }
            });

        } catch (error) {
            console.error('Error al generar venta:', error);
            this.loader.updateMessage('Error inesperado');

            setTimeout(() => {
                this.loader.hide();
                this.manejarErrorGeneracion(error);
            }, 1500);

        } finally {
            this.generandoVenta = false;
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
        console.log('datos', datos);

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
                                    <div class="monto-cuota">${this.formatearMoneda(datos.cashea.montoPorCuota)} c/u</div>
                                </div>
                                <div class="cuota-info">
                                    <small class="text-muted" style="font-size: 8px;">DEUDA PENDIENTE</small>
                                    <div class="fw-bold text-danger" style="font-size: 10px;">${this.formatearMoneda(datos.cashea.deudaPendiente)}</div>
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

    // === MÉTODOS DEL RECIBO ===
    private mostrarReciboAutomatico(data: any): void {
        let datosRecibo = this.crearDatosReciboReal();

        if (data.datosRealesAPI) {
            const apiData = data.datosRealesAPI;

            // Actualizar con datos reales del API
            datosRecibo = {
                ...datosRecibo,
                numeroVenta: data.numeroVenta || apiData.venta?.key,
                fecha: apiData.venta?.fecha ?
                    new Date(apiData.venta.fecha).toLocaleDateString('es-VE') : datosRecibo.fecha,
                hora: apiData.venta?.fecha ?
                    new Date(apiData.venta.fecha).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : datosRecibo.hora,
                vendedor: apiData.asesor?.nombre || datosRecibo.vendedor,
                cliente: {
                    nombre: apiData.cliente?.informacion?.nombreCompleto || datosRecibo.cliente.nombre,
                    cedula: apiData.cliente?.informacion?.cedula || datosRecibo.cliente.cedula,
                    telefono: apiData.cliente?.informacion?.telefono || datosRecibo.cliente.telefono
                },
                productos: apiData.productos?.map((producto: any) => ({
                    nombre: producto.datos?.nombre || 'Producto',
                    codigo: producto.datos?.codigo || 'N/A',
                    cantidad: producto.cantidad || 1,
                    precioUnitario: producto.precio_unitario || 0,
                    subtotal: producto.total || 0
                })) || datosRecibo.productos,
                totales: {
                    subtotal: apiData.totales?.subtotal || datosRecibo.totales.subtotal,
                    descuento: apiData.totales?.descuento || datosRecibo.totales.descuento,
                    iva: apiData.totales?.iva || datosRecibo.totales.iva,
                    total: apiData.totales?.total || datosRecibo.totales.total,
                    totalPagado: apiData.totales?.totalPagado || datosRecibo.totales.totalPagado
                }
            };
        } else {
            // Si no hay datos del API, usar los datos generados pero actualizar el número de venta
            datosRecibo.numeroVenta = data.numeroVenta || datosRecibo.numeroVenta;
        }

        this.datosRecibo = datosRecibo;

        this.informacionVenta = {
            numeroVenta: data.numeroVenta || this.datosRecibo.numeroVenta,
            fecha: this.datosRecibo.fecha,
            hora: this.datosRecibo.hora,
            estado: data.datosRealesAPI?.venta?.estatus_venta || 'completada',
            formaPago: data.datosRealesAPI?.venta?.formaPago || this.venta.formaPago
        };

        // MOSTRAR RECIBO INMEDIATAMENTE (sin delays adicionales)
        this.mostrarModalRecibo = true;
        this.ventaGenerada = true;
        this.cerrarModalResumen();
        this.cdr.detectChanges();
    }

    cerrarModalRecibo(): void {
        this.limpiarSelectProductos();
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

    private resetearVentaCompleta(): void {
        // Limpiar productos
        this.venta.productos = [];

        // Restablecer a valores por defecto del sistema
        this.venta.moneda = this.normalizarMonedaParaVenta(this.monedaSistema);
        this.venta.formaPago = 'contado';
        this.venta.descuento = 0;
        this.venta.impuesto = 16;
        this.venta.observaciones = '';
        this.venta.montoInicial = 0;
        this.venta.numeroCuotas = 0;
        this.venta.montoAbonado = 0;
        this.venta.metodosDePago = [];

        // Limpiar Cashea completamente
        this.nivelCashea = 'nivel3';
        this.cantidadCuotasCashea = 3;
        this.cuotasCashea = [];
        this.resumenCashea = { cantidad: 0, total: 0, totalBs: 0 };
        this.valorInicialTemporal = '';

        // Limpiar abono
        this.valorTemporal = '';
        this.montoExcedido = false;

        // Restablecer moneda efectivo
        this.monedaEfectivo = this.monedaSistema;

        // Limpiar selecciones
        this.pacienteSeleccionado = null;
        this.productoSeleccionado = null;
        this.asesorSeleccionado = this.currentUser?.id ?? null;

        // Limpiar cliente sin paciente
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

        // Limpiar validación de cliente
        this.validandoCliente = false;
        this.clienteEncontrado = false;
        this.mensajeValidacionCliente = '';

        // Actualizar productos con la moneda correcta
        this.actualizarProductosConDetalle();
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

    private resetearVenta(): void {
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

        this.pacienteSeleccionado = null;
        this.productoSeleccionado = null;
        this.asesorSeleccionado = this.currentUser?.id ?? null;

        this.clienteSinPaciente = {
            tipoPersona: 'natural',
            nombreCompleto: '',
            cedula: '',
            telefono: '',
            email: ''
        };

        this.resumenCashea = { cantidad: 0, total: 0, totalBs: 0 };
        this.cuotasCashea = [];
        this.valorInicialTemporal = '';
        this.valorTemporal = '';
        this.nivelCashea = 'nivel3';
        this.cantidadCuotasCashea = 3;

        this.requierePaciente = false;
        this.historiaMedica = null;
        this.mostrarSelectorAsesor = false;

        this.monedaEfectivo = 'USD';

        this.actualizarProductosConDetalle();

        // Forzar scroll al inicio
        setTimeout(() => {
            const modalBody = document.querySelector('.modal-body-detalle');
            if (modalBody) {
                modalBody.scrollTop = 0;
            }
        }, 100);
    }

    async descargarPDF(): Promise<void> {
        let datos: any;

        try {
            if (this.venta.formaPago === 'cashea' && (!this.cuotasCashea || this.cuotasCashea.length === 0)) {
                this.generarCuotasCashea();
            }

            datos = this.datosRecibo || this.crearDatosReciboReal();
            await this.generarPDFSeguro(datos);

        } catch (error) {
            console.error('Error al generar PDF:', error);
            this.swalService.closeLoading();

            if (datos) {
                this.descargarPDFSimple(datos);
            } else {
                const datosFallback = this.datosRecibo || this.crearDatosReciboReal();
                this.descargarPDFSimple(datosFallback);
            }
        }
    }

    private async generarPDFSeguro(datos: any): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const iframe = document.createElement('iframe');
                iframe.style.position = 'fixed';
                iframe.style.right = '0';
                iframe.style.bottom = '0';
                iframe.style.width = '210mm';
                iframe.style.height = '297mm';
                iframe.style.border = 'none';
                iframe.style.visibility = 'hidden';

                document.body.appendChild(iframe);

                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

                if (!iframeDoc) {
                    document.body.removeChild(iframe);
                    reject(new Error('No se pudo acceder al documento del iframe'));
                    return;
                }

                // Escribir contenido en el iframe
                iframeDoc.open();
                iframeDoc.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { 
                            margin: 0; 
                            padding: 15mm; 
                            background: white;
                            width: 210mm;
                            min-height: 297mm;
                            font-family: Arial, sans-serif;
                        }
                        * {
                            box-sizing: border-box;
                        }
                    </style>
                </head>
                <body>
                    ${this.generarReciboHTML(datos)}
                </body>
                </html>
            `);
                iframeDoc.close();

                setTimeout(async () => {
                    try {
                        const canvas = await html2canvas(iframeDoc.body, {
                            scale: 1.5,
                            useCORS: true,
                            logging: false,
                            backgroundColor: '#ffffff',
                            allowTaint: false,
                            foreignObjectRendering: false
                        });

                        // Limpiar
                        document.body.removeChild(iframe);

                        // Crear PDF
                        const pdf = new jsPDF.jsPDF({
                            orientation: 'portrait',
                            unit: 'mm',
                            format: 'a4'
                        });

                        const imgWidth = 210;
                        const imgHeight = (canvas.height * imgWidth) / canvas.width;
                        const imgData = canvas.toDataURL('image/jpeg', 0.8);

                        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
                        pdf.save(`Recibo_${datos.numeroVenta}.pdf`);

                        this.swalService.closeLoading();
                        this.swalService.showSuccess('PDF Descargado', 'El recibo se ha descargado correctamente.');
                        resolve();

                    } catch (canvasError) {
                        document.body.removeChild(iframe);
                        reject(canvasError);
                    }
                }, 1000);

            } catch (error) {
                reject(error);
            }
        });
    }

    private descargarPDFSimple(datos: any): void {
        try {
            const htmlContent = this.generarReciboHTML(datos);

            // Crear blob y descargar como HTML que puede ser impreso como PDF
            const blob = new Blob([`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Recibo_${datos.numeroVenta}</title>
                <style>
                    @media print {
                        @page { margin: 0; size: A4; }
                        body { margin: 15mm; }
                    }
                    body { 
                        font-family: Arial, sans-serif; 
                        margin: 20px;
                        -webkit-print-color-adjust: exact !important;
                    }
                </style>
            </head>
            <body>
                ${htmlContent}
                <script>
                    // Auto-abrir diálogo de impresión al cargar
                    window.onload = function() {
                        setTimeout(() => {
                            window.print();
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `], { type: 'text/html' });

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Recibo_${datos.numeroVenta}.html`;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setTimeout(() => URL.revokeObjectURL(url), 100);

            this.swalService.showInfo(
                'Descarga HTML',
                'Se ha descargado el recibo como HTML. Ábrelo y usa "Imprimir → Guardar como PDF" para obtener el PDF.'
            );

        } catch (error) {
            console.error('Error en método simple:', error);
            this.swalService.showError('Error', 'No se pudo generar el archivo.');
        }
    }

    async copiarEnlace(): Promise<void> {
        try {
            this.swalService.showLoadingAlert('Generando enlace de descarga...');

            const datos = this.datosRecibo || this.crearDatosReciboReal();

            // Generar el PDF y obtener el Blob
            const pdfBlob = await this.generarPDFBlob(datos);

            // Crear URL del Blob
            const pdfUrl = URL.createObjectURL(pdfBlob);

            // Crear texto con el enlace de descarga REAL
            const texto = `📋 NEW VISION LENS - Recibo de Venta\n\n` +
                `Recibo: ${datos.numeroVenta}\n` +
                `Fecha: ${datos.fecha}\n` +
                `Hora: ${datos.hora}\n` +
                `Cliente: ${datos.cliente.nombre}\n` +
                `Total: ${this.formatearMoneda(datos.totales.totalPagado)}\n` +
                `Forma de pago: ${this.venta.formaPago.toUpperCase()}\n\n` +
                `📎 DESCARGAR RECIBO EN PDF:\n` +
                `${pdfUrl}\n\n` +
                `¡Gracias por su compra! 🛍️\n\n` +
                `*Instrucciones:* Copie y pegue este enlace en su navegador para descargar el PDF.`;

            // Copiar al portapapeles
            const copiado = await this.copiarAlPortapapeles(texto);

            this.swalService.closeLoading();

            if (copiado) {
                this.swalService.showSuccess('✅ Enlace Copiado',
                    `Se ha generado un enlace de descarga para el recibo ${datos.numeroVenta}.\n\n` +
                    `🔗 *El enlace ha sido copiado al portapapeles*\n\n` +
                    `El cliente puede:\n` +
                    `• Pegar el enlace en su navegador\n` +
                    `• Descargar el PDF directamente\n` +
                    `• Compartirlo por cualquier medio\n\n` +
                    `⏰ *El enlace estará disponible por 24 horas*`
                );

                // Programar limpieza automática después de 24 horas
                setTimeout(() => {
                    URL.revokeObjectURL(pdfUrl);
                    console.log('Enlace del PDF revocado después de 24 horas');
                }, 24 * 60 * 60 * 1000); // 24 horas

            } else {
                this.swalService.showError('Error', 'No se pudo copiar el enlace automáticamente.');
            }

        } catch (error) {
            this.swalService.closeLoading();
            console.error('Error al generar enlace:', error);
            this.swalService.showError('Error',
                'No se pudo generar el enlace de descarga. Por favor, use el botón "Descargar PDF" para obtener el archivo.'
            );
        }
    }

    /**
     * Genera el PDF y retorna el Blob
     */
    private async generarPDFBlob(datos: any): Promise<Blob> {
        return new Promise((resolve, reject) => {
            try {
                // Crear un iframe temporal para renderizar el HTML
                const iframe = document.createElement('iframe');
                iframe.style.position = 'fixed';
                iframe.style.right = '0';
                iframe.style.bottom = '0';
                iframe.style.width = '210mm';
                iframe.style.height = '297mm';
                iframe.style.border = 'none';
                iframe.style.visibility = 'hidden';
                iframe.style.zIndex = '-1';

                document.body.appendChild(iframe);

                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

                if (!iframeDoc) {
                    document.body.removeChild(iframe);
                    reject(new Error('No se pudo acceder al documento del iframe'));
                    return;
                }

                // Escribir contenido en el iframe
                iframeDoc.open();
                iframeDoc.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { 
                            margin: 0; 
                            padding: 15mm; 
                            background: white;
                            width: 210mm;
                            min-height: 297mm;
                            font-family: Arial, sans-serif;
                        }
                        * {
                            box-sizing: border-box;
                        }
                    </style>
                </head>
                <body>
                    ${this.generarReciboHTML(datos)}
                </body>
                </html>
            `);
                iframeDoc.close();

                // Esperar a que el contenido se cargue
                setTimeout(async () => {
                    try {
                        const canvas = await html2canvas(iframeDoc.body, {
                            scale: 1.5,
                            useCORS: true,
                            logging: false,
                            backgroundColor: '#ffffff',
                            allowTaint: false,
                            foreignObjectRendering: false
                        });

                        // Limpiar el iframe
                        document.body.removeChild(iframe);

                        // Convertir canvas a Blob
                        canvas.toBlob((blob) => {
                            if (blob) {
                                resolve(blob);
                            } else {
                                reject(new Error('No se pudo generar el Blob del PDF'));
                            }
                        }, 'application/pdf', 0.9); // 90% de calidad

                    } catch (canvasError) {
                        document.body.removeChild(iframe);
                        reject(canvasError);
                    }
                }, 1500); // Dar más tiempo para cargar

            } catch (error) {
                reject(error);
            }
        });
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
                textArea.setSelectionRange(0, 99999); // Para móviles
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

    getTituloRecibo(): string {
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

    getDeudaPendienteCashea(): number {
        if (this.venta.formaPago !== 'cashea') return 0;

        const total = this.montoTotal;
        const pagadoAhora = this.totalPagadoCashea;

        return Math.max(total - pagadoAhora, 0);
    }

    getDeudaPendienteAbono(): number {
        if (this.venta.formaPago !== 'abono') return 0;

        const total = this.montoTotal;
        const abonado = this.venta.montoAbonado || 0;

        return Math.max(total - abonado, 0);
    }

    private crearDatosReciboReal(): any {
        const fechaActual = new Date();

        // Obtener información de la sede del usuario actual
        const sedeInfo = this.currentUser?.sede || 'Sede Principal';
        const telefonoSede = '0212-365-39-42';
        const rifSede = 'J-123456789';

        const vendedorInfo = this.getResumenAsesor();

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

        //Obtener productos con detalles calculados
        const productosConDetalles = this.obtenerProductosConDetalles();

        //Obtener información del cliente CORRECTAMENTE
        let clienteInfo = {
            nombre: 'CLIENTE GENERAL',
            cedula: 'N/A',
            telefono: 'N/A'
        };

        if (this.requierePaciente && this.pacienteSeleccionado) {
            clienteInfo = {
                nombre: this.pacienteSeleccionado?.informacionPersonal?.nombreCompleto || 'CLIENTE GENERAL',
                cedula: this.pacienteSeleccionado?.informacionPersonal?.cedula || 'N/A',
                telefono: this.pacienteSeleccionado?.informacionPersonal?.telefono || 'N/A'
            };
        } else if (!this.requierePaciente) {
            clienteInfo = {
                nombre: this.clienteSinPaciente.nombreCompleto?.trim() || 'CLIENTE GENERAL',
                cedula: this.clienteSinPaciente.cedula?.trim() || 'N/A',
                telefono: this.clienteSinPaciente.telefono?.trim() || 'N/A'
            };
        }

        const datosRecibo: any = {
            // Información general
            numeroVenta: 'V-' + Date.now().toString().slice(-6),
            fecha: fechaActual.toLocaleDateString('es-VE'),
            hora: fechaActual.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
            //USAR LA INFORMACIÓN CORREGIDA DEL VENDEDOR
            vendedor: vendedorInfo,

            // Información de la sede
            sede: {
                nombre: sedeInfo,
                direccion: 'C.C. Candelaria, Local PB-04, Guarenas',
                telefono: telefonoSede,
                rif: rifSede,
                email: 'newvisionlens2020@gmail.com'
            },

            //USAR LA INFORMACIÓN CORREGIDA DEL CLIENTE
            cliente: clienteInfo,

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
                mensaje += `• ${emoji} ${this.formatearTipoPago(metodo.tipo)}: ${this.formatearMoneda(metodo.monto)}\n`;
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


    private solicitarEmailParaEnvio(datos: any): void {
        // Mostrar el email actual si existe
        const emailActual = this.obtenerEmailCliente();
        const placeholder = emailActual ? emailActual : 'ejemplo@correo.com';

        const htmlContent = `
        <div class="text-start">
            <p class="mb-3">Ingresa la dirección de email del cliente:</p>
            <input type="email" 
                   id="emailInput" 
                   class="form-control" 
                   placeholder="${placeholder}"
                   value="${emailActual || ''}"
                   required>
            <small class="form-text text-muted">Se enviará el recibo a esta dirección</small>
        </div>
    `;

        this.swalService.showConfirm(
            'Enviar por Email',
            htmlContent,
            'Enviar',
            'Cancelar'
        ).then((result) => {
            if (result.isConfirmed) {
                const emailInput = document.getElementById('emailInput') as HTMLInputElement;
                if (emailInput && emailInput.value) {
                    const email = emailInput.value.trim();

                    if (this.validarEmail(email)) {
                        this.enviarEmailDirecto(email, datos);
                    } else {
                        this.swalService.showError('Error', 'Por favor ingresa una dirección de email válida.');
                        this.solicitarEmailParaEnvio(datos);
                    }
                }
            }
        });

        // Focus y seleccionar texto en el input después de que se abra el modal
        setTimeout(() => {
            const emailInput = document.getElementById('emailInput') as HTMLInputElement;
            if (emailInput) {
                emailInput.focus();
                emailInput.select();
            }
        }, 300);
    }

    private enviarEmailDirecto(email: string, datos: any): void {
        const asunto = `Recibo de Venta ${datos.numeroVenta} - New Vision Lens`;

        let cuerpo = `Estimado/a ${datos.cliente.nombre},\n\n`;
        cuerpo += `Le enviamos los detalles de su compra en NEW VISION LENS:\n\n`;
        cuerpo += `========================================\n`;
        cuerpo += `           RECIBO DE VENTA\n`;
        cuerpo += `========================================\n\n`;
        cuerpo += `Número de recibo: ${datos.numeroVenta}\n`;
        cuerpo += `Fecha: ${datos.fecha}\n`;
        cuerpo += `Hora: ${datos.hora}\n`;
        cuerpo += `Cliente: ${datos.cliente.nombre}\n`;
        cuerpo += `Cédula: ${datos.cliente.cedula}\n\n`;

        cuerpo += `PRODUCTOS:\n`;
        cuerpo += `----------------------------------------\n`;
        datos.productos.forEach((producto: any, index: number) => {
            cuerpo += `${index + 1}. ${producto.nombre}\n`;
            cuerpo += `   Cantidad: ${producto.cantidad}\n`;
            cuerpo += `   Precio: ${this.formatearMoneda(producto.precioUnitario)}\n`;
            cuerpo += `   Subtotal: ${this.formatearMoneda(producto.subtotal)}\n\n`;
        });

        cuerpo += `----------------------------------------\n`;
        cuerpo += `Subtotal: ${this.formatearMoneda(datos.totales.subtotal)}\n`;
        if (datos.totales.descuento > 0) {
            cuerpo += `Descuento: -${this.formatearMoneda(datos.totales.descuento)}\n`;
        }
        cuerpo += `IVA: ${this.formatearMoneda(datos.totales.iva)}\n`;
        cuerpo += `TOTAL: ${this.formatearMoneda(datos.totales.totalPagado)}\n\n`;

        cuerpo += `Forma de pago: ${this.venta.formaPago.toUpperCase()}\n\n`;

        if (datos.metodosPago && datos.metodosPago.length > 0) {
            cuerpo += `Métodos de pago utilizados:\n`;
            datos.metodosPago.forEach((metodo: any) => {
                cuerpo += `• ${this.formatearTipoPago(metodo.tipo)}: ${this.formatearMoneda(metodo.monto)}\n`;
                if (metodo.referencia) {
                    cuerpo += `  Referencia: ${metodo.referencia}\n`;
                }
                if (metodo.banco) {
                    cuerpo += `  Banco: ${metodo.banco}\n`;
                }
            });
            cuerpo += `\n`;
        }

        cuerpo += `========================================\n`;
        cuerpo += `NEW VISION LENS\n`;
        cuerpo += `C.C. Candelaria, Local PB-04, Guarenas\n`;
        cuerpo += `Teléfono: 0212-365-39-42\n`;
        cuerpo += `Email: newvisionlens2020@gmail.com\n\n`;

        cuerpo += `¡Gracias por su compra!\n`;
        cuerpo += `Conserve este comprobante para cualquier reclamo.\n\n`;
        cuerpo += `Atentamente,\n`;
        cuerpo += `El equipo de New Vision Lens`;

        // Crear enlace mailto
        const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;

        // Abrir cliente de email
        window.location.href = mailtoLink;

        this.swalService.showSuccess('Email', `Se ha abierto tu cliente de email para enviar a ${email}`);
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
                this.solicitarEmailParaEnvio(datos);
                return;
            }

            this.enviarEmailDirecto(emailCliente, datos);

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
        //  console.log('this.informacionVenta?',this.informacionVenta);
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

    // === MÉTODOS DE VALIDACIÓN PARA CLIENTE SIN PACIENTE ===

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

    // Validar nombre (solo alfabético y espacios, obligatorio)
    validarNombre(nombre: string): boolean {
        if (!nombre || nombre.trim() === '') return false;

        const nombreRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
        return nombreRegex.test(nombre.trim());
    }

    // Validar teléfono (estructura internacional, obligatorio)
    validarTelefono(telefono: string): boolean {
        if (!telefono || telefono.trim() === '') return false;

        const telefonoLimpio = telefono.trim();

        // Remover todos los espacios para validar
        const telefonoSinEspacios = telefonoLimpio.replace(/\s/g, '');

        // Validar que solo contenga números y posiblemente el signo + al inicio
        if (!/^\+?\d+$/.test(telefonoSinEspacios)) return false;

        // Validar longitud mínima y máxima (8-15 dígitos sin código de país, o más con código)
        const longitud = telefonoSinEspacios.replace('+', '').length;

        // Longitud típica: 
        // - Sin código: 8-11 dígitos
        // - Con código: 10-15 dígitos (incluyendo código de país)
        if (longitud < 8 || longitud > 15) return false;

        return true;
    }

    // Formatear teléfono automáticamente (sin forzar código de país)
    formatearTelefono(telefono: string): string {
        if (!telefono) return '';

        const telefonoLimpio = telefono.replace(/\D/g, ''); // Remover todo excepto números

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

            if (telefono) {
                this.clienteSinPaciente.telefono = this.formatearTelefono(telefono);
            }
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

    // Actualizar estado de validación general
    actualizarEstadoValidacion(): void {
        const valido = this.validarClienteSinPaciente();
        // Puedes usar esta función para habilitar/deshabilitar botones, etc.
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

    getMensajeErrorTelefono(): string {
        return 'Formato de teléfono inválido. Use: 58 4121234567 o 4121234567';
    }

    getMensajeErrorEmail(): string {
        return 'Formato de email inválido. Use: ejemplo@correo.com';
    }

    getMensajeErrorNombre(): string {
        return 'El nombre solo puede contener letras y espacios';
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




    // === MÉTODOS PARA VALIDACIÓN DE CLIENTE VÍA API ===

    /**
     * Simula la búsqueda de cliente en la base de datos
     * TODO: Reemplazar con llamada real al API cuando esté disponible
     */
    private simularBusquedaCliente(cedula: string): Promise<any> {
        return new Promise((resolve, reject) => {
            // Simular delay de red
            setTimeout(() => {
                // Datos de prueba - simular que algunos clientes existen y otros no
                const clientesExistentes: any = {
                    '12345678': {
                        existe: true,
                        datos: {
                            nombreCompleto: 'MARÍA GABRIELA PÉREZ RODRÍGUEZ',
                            telefono: '+58 4121234567',
                            email: 'maria.perez@email.com',
                            tipoPersona: 'natural'
                        }
                    },
                    '87654321': {
                        existe: true,
                        datos: {
                            nombreCompleto: 'CARLOS JOSÉ MARTÍNEZ LÓPEZ',
                            telefono: '+58 4149876543',
                            email: 'carlos.martinez@empresa.com',
                            tipoPersona: 'natural'
                        }
                    },
                    'J-123456789': {
                        existe: true,
                        datos: {
                            nombreCompleto: 'TECNOLOGÍA AVANZADA C.A.',
                            telefono: '+58 2125558899',
                            email: 'ventas@tecnologia-avanzada.com',
                            tipoPersona: 'juridica'
                        }
                    }
                };

                const cliente = clientesExistentes[cedula];

                if (cliente) {
                    resolve(cliente);
                } else {
                    resolve({
                        existe: false,
                        mensaje: 'Cliente no encontrado en la base de datos'
                    });
                }
            }, 1500); // Simular 1.5 segundos de delay
        });
    }

    /**
     * Autocompleta los datos del cliente cuando es encontrado
     */
    private autocompletarDatosCliente(datosCliente: any): void {
        // Actualizar tipo de persona si es diferente
        if (datosCliente.tipoPersona && datosCliente.tipoPersona !== this.clienteSinPaciente.tipoPersona) {
            this.clienteSinPaciente.tipoPersona = datosCliente.tipoPersona;
        }

        // Autocompletar campos
        this.clienteSinPaciente.nombreCompleto = datosCliente.nombreCompleto || '';
        this.clienteSinPaciente.telefono = datosCliente.telefono || '';
        this.clienteSinPaciente.email = datosCliente.email || '';

        // Limpiar errores de validación
        this.limpiarErroresValidacion();

        // Forzar validación de los campos autocompletados
        this.actualizarEstadoValidacion();
    }

    /**
     * Limpia todos los errores de validación
     */
    private limpiarErroresValidacion(): void {
        this.limpiarErrorCedula();
        this.limpiarErrorNombre();
        this.limpiarErrorTelefono();
        this.limpiarErrorEmail();
    }

    onCampoEditadoManualmente(): void {
        // Solo resetear si previamente se había encontrado el cliente
        // o si se había intentado validar
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
            // NO validamos automáticamente aquí, solo en blur
        }

        this.actualizarEstadoValidacion();
    }

    /**
     * Método para validar cuando el usuario sale del campo (blur)
     */
    onCedulaBlur(): void {
        console.log('🔍 onCedulaBlur() ejecutado'); // Para debug

        const cedula = this.clienteSinPaciente.cedula?.trim();
        const tipoPersona = this.clienteSinPaciente.tipoPersona;

        if (!cedula) {
            console.log('Cédula vacía, no validar');
            return;
        }

        // Validar formato básico
        if (!this.validarCedula(cedula, tipoPersona)) {
            console.log('Cédula inválida:', cedula);
            this.mostrarErrorCedula();
            this.mensajeValidacionCliente = this.getMensajeErrorCedula();
            return;
        }

        console.log('Cédula válida, procediendo a validar:', cedula);

        // Solo validar si la cédula es válida y tiene al menos 4 caracteres
        if (cedula.length >= 4) {
            this.validarClientePorCedula();
        } else {
            console.log('Cédula muy corta, no validar:', cedula.length);
        }
    }

    /**
     * Método para forzar validación manual
     */
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

    /**
     * TODO: Implementar cuando el API esté listo
     */
    buscarClientePorCedula(cedula: string): Observable<any> {
        // Por ahora retornamos un observable vacío
        return of({
            existe: false,
            mensaje: 'API no implementada'
        });
    }

    /**
     * TODO: Implementar cuando el API esté listo
     */
    guardarCliente(datosCliente: any): Observable<any> {
        // Por ahora retornamos un observable vacío
        return of({
            success: true,
            mensaje: 'Cliente guardado exitosamente',
            clienteId: 'CLI-' + Date.now()
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
            const respuesta = await this.simularBusquedaCliente(cedula);

            // MARCAR QUE LA VALIDACIÓN SE INTENTÓ
            this.validacionIntentada = true;

            if (respuesta.existe) {
                // CLIENTE ENCONTRADO - Autocompletar datos
                this.clienteEncontrado = true;
                this.mensajeValidacionCliente = '✅ Cliente encontrado - Datos autocompletados';
                this.autocompletarDatosCliente(respuesta.datos);

                /*  this.snackBar.open('Cliente encontrado - Datos autocompletados', 'Cerrar', {
                      duration: 3000,
                      panelClass: ['snackbar-success']
                  });*/
            } else {
                // CLIENTE NO ENCONTRADO - Limpiar campos excepto cédula
                this.clienteEncontrado = false;
                this.mensajeValidacionCliente = 'Cliente no encontrado - Complete los datos manualmente';

                // Limpiar todos los campos excepto la cédula
                this.limpiarCamposCliente();

                // Restaurar la cédula (por si se modificó durante la limpieza)
                this.clienteSinPaciente.cedula = cedulaActual;

                /* this.snackBar.open('Cliente no encontrado. Complete los datos manualmente.', 'Cerrar', {
                     duration: 4000,
                     panelClass: ['snackbar-info']
                 });*/
            }

        } catch (error) {
            this.validacionIntentada = true;
            this.clienteEncontrado = false;
            this.mensajeValidacionCliente = '⚠️ Error al conectar con el servidor';

            // En caso de error, también limpiar campos
            this.limpiarCamposCliente();
            this.clienteSinPaciente.cedula = cedulaActual;

            this.snackBar.open('Error al validar cliente. Verifique su conexión.', 'Cerrar', {
                duration: 3000,
                panelClass: ['snackbar-warning']
            });
            console.log('error', error);
        } finally {
            this.validandoCliente = false;
            this.cdr.detectChanges();
        }
    }

    private limpiarCamposCliente(): void {
        // Guardar la cédula actual y tipo de persona
        const cedulaActual = this.clienteSinPaciente.cedula;
        const tipoPersonaActual = this.clienteSinPaciente.tipoPersona;

        // Limpiar todos los campos
        this.clienteSinPaciente = {
            tipoPersona: tipoPersonaActual, // Mantener el tipo de persona
            nombreCompleto: '',
            cedula: cedulaActual, // Restaurar la cédula después de limpiar
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
}