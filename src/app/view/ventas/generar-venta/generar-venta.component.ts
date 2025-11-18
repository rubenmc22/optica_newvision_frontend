import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Producto } from '../../productos/producto.model';
import { ProductoService } from '../../productos/producto.service';
import { SystemConfigService } from '../../system-config/system-config.service';
import { GenerarVentaService } from './generar-venta.service';
import { Tasa } from '../../../Interfaces/models-interface';
import { SwalService } from '../../../core/services/swal/swal.service';
import { forkJoin, map } from 'rxjs';
import { take } from 'rxjs/operators';
import { LoaderService } from './../../../shared/loader/loader.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UserStateService } from '../../../core/services/userState/user-state-service';
import { PacientesService } from '../../../core/services/pacientes/pacientes.service';
import { HistoriaMedicaService } from '../../../core/services/historias-medicas/historias-medicas.service';
import { Paciente } from '../../pacientes/paciente-interface';
import { HistoriaMedica } from './../../historias-medicas/historias_medicas-interface';
import { VentaDto, ProductoVenta, ProductoVentaCalculado, CuotaCashea } from '../venta-interfaz';
import { Empleado, User } from '../../../Interfaces/models-interface';
import { EmpleadosService } from './../../../core/services/empleados/empleados.service';
import { trigger, transition, style, animate } from '@angular/animations';
import * as bootstrap from 'bootstrap';
import { Subscription } from 'rxjs';
import { ProductoConversionService } from '../../productos/productos-list/producto-conversion.service';

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
    informacionVenta: any = null;
    errorGeneracion: string = '';

    // === PROPIEDADES PARA CONTROL DE TAMAÑO DEL MODAL ===
    tamanoModalRecibo: 'xl' = 'xl';
    anchoPersonalizado: string = '1100px';
    altoPersonalizado: string = '700px';

    mostrarControlesPersonalizados: boolean = false;


    // Modal para mostrar el recibo
    mostrarModalRecibo: boolean = false;

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
                    p.activo === true
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
        this.productoSeleccionado = null;
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

    // === MÉTODOS DE PAGO ===
    agregarMetodo(): void {
        this.venta.metodosDePago.push({
            tipo: '',
            monto: 0,
            valorTemporal: '',
            referencia: '',
            banco: ''
        });
    }

    eliminarMetodo(index: number): void {
        this.venta.metodosDePago.splice(index, 1);
    }

    onMetodoPagoChange(index: number): void {
        const metodo = this.venta.metodosDePago[index];

        // Solo actualizar formato si ya tiene monto
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

        // OBTENER EL MÁXIMO PERMITIDO para este método
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

    // === MÉTODO DE GENERACIÓN DE VENTA MEJORADO ===
    async generarVenta(): Promise<void> {
        // Validaciones iniciales
        if (!this.puedeGenerarVenta) {
            this.swalService.showWarning(
                'No se puede generar la venta',
                'Verifica que todos los campos estén completos y los montos sean correctos.'
            );
            return;
        }

        if (this.generandoVenta) {
            return; // Evitar múltiples clics
        }

        try {
            // Resetear estados
            this.generandoVenta = true;
            this.generandoRecibo = false;
            this.ventaGenerada = false;
            this.errorGeneracion = '';
            this.urlRecibo = '';

            // Mostrar loader inicial
            this.loader.showWithMessage('Iniciando proceso de venta...');

            // 1. Preparar datos de la venta
            const datosVenta = this.prepararDatosVenta();

            console.log('Datos de venta a enviar:', datosVenta);

            // 2. Generar venta (simulación mientras el API no está listo)
            await this.simularGeneracionVenta(datosVenta);

            // 3. Obtener recibo
            await this.obtenerReciboVenta();

            // 4. Mostrar éxito y recibo
            this.mostrarRecibo();

        } catch (error) {
            this.manejarErrorGeneracion(error);
        } finally {
            this.generandoVenta = false;
            this.loader.hide();
        }
    }

    // Método para preparar los datos de la venta - MANTENIDO
    private prepararDatosVenta(): any {
        return {
            productos: this.venta.productos.map(p => ({
                id: p.id,
                nombre: p.nombre,
                codigo: p.codigo,
                precio: p.precio,
                precioConIva: p.precioConIva,
                cantidad: p.cantidad,
                aplicaIva: p.aplicaIva,
                moneda: p.moneda
            })),
            paciente: this.pacienteSeleccionado ? {
                id: this.pacienteSeleccionado.key,
                nombre: this.pacienteSeleccionado.informacionPersonal?.nombreCompleto,
                cedula: this.pacienteSeleccionado.informacionPersonal?.cedula
            } : null,
            asesor: this.asesorSeleccionado ? {
                id: this.asesorSeleccionado,
                nombre: this.getResumenAsesor()
            } : null,
            configuracion: {
                moneda: this.venta.moneda,
                formaPago: this.venta.formaPago,
                descuento: this.venta.descuento,
                impuesto: this.venta.impuesto,
                observaciones: this.venta.observaciones,
                montoInicial: this.venta.montoInicial,
                numeroCuotas: this.venta.numeroCuotas,
                montoAbonado: this.venta.montoAbonado
            },
            metodosPago: this.venta.metodosDePago.map(m => ({
                tipo: m.tipo,
                monto: m.monto,
                referencia: m.referencia,
                banco: m.banco,
                moneda: this.getMonedaParaMetodo(m.tipo)
            })),
            cashea: this.venta.formaPago === 'cashea' ? {
                nivel: this.nivelCashea,
                cantidadCuotas: this.cantidadCuotasCashea,
                cuotasAdelantadas: this.resumenCashea.cantidad,
                montoAdelantado: this.resumenCashea.total
            } : null,
            totales: {
                subtotal: this.totalProductos,
                descuento: this.venta.descuento ? (this.totalProductos * (this.venta.descuento / 100)) : 0,
                iva: this.productosConDetalle.reduce((sum, p) => sum + (p.iva || 0), 0),
                total: this.montoTotal
            }
        };
    }

    // Simulación de generación de venta - MANTENIDO
    private async simularGeneracionVenta(datosVenta: any): Promise<void> {
        this.loader.updateMessage('Procesando transacción...');

        // Simular delay de red
        await new Promise(resolve => setTimeout(resolve, 2000));

        this.loader.updateMessage('Validando métodos de pago...');
        await new Promise(resolve => setTimeout(resolve, 1500));

        this.loader.updateMessage('Registrando venta en el sistema...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Simular respuesta exitosa del API
        return Promise.resolve();
    }

    // Método para obtener el recibo - MEJORADO
    private async obtenerReciboVenta(): Promise<void> {
        this.generandoRecibo = true;
        this.loader.updateMessage('Generando comprobante de pago...');

        try {
            // Simular generación de PDF
            await new Promise(resolve => setTimeout(resolve, 3000));

            // URL de ejemplo del recibo (en producción vendrá del API)
            this.urlRecibo = 'https://example.com/recibos/venta-001.pdf';
            this.informacionVenta = {
                numeroVenta: 'V-' + Date.now(),
                fecha: new Date().toLocaleDateString('es-VE'),
                hora: new Date().toLocaleTimeString('es-VE'),
                estado: 'Completada'
            };

            this.generandoRecibo = false;
            this.ventaGenerada = true;
        } catch (error) {
            this.generandoRecibo = false;
            throw error;
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

    // Método simplificado para ajustar dimensiones
    private ajustarDimensionesModal(): void {
        if (!this.mostrarModalRecibo) return;

        setTimeout(() => {
            const modalDialog = document.querySelector('#reciboModal .modal-dialog') as HTMLElement;
            const iframe = document.querySelector('.recibo-iframe') as HTMLIFrameElement;

            if (modalDialog) {
                // Para XL fijo
                modalDialog.style.maxWidth = '1100px';
                modalDialog.style.width = '1100px';
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
    // Método para mostrar el recibo - ACTUALIZADO
    private mostrarRecibo(): void {
        this.loader.updateMessage('¡Venta generada exitosamente!');

        // Resetear a tamaño por defecto
        //this.tamanoModalRecibo = 'lg';

        setTimeout(() => {
            this.loader.hide();
            this.mostrarModalRecibo = true;

            // Ajustar dimensiones después de que el modal se muestre
            setTimeout(() => {
                this.ajustarDimensionesModal();
            }, 100);

            this.cdr.detectChanges();
            this.cerrarModalResumen();
        }, 1000);
    }

    // Nuevo método para cerrar modal de resumen
    private cerrarModalResumen(): void {
        const modalElement = document.getElementById('resumenVentaModal');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            }
        }
    }

    // Manejo de errores - MANTENIDO
    private manejarErrorGeneracion(error: any): void {
        console.error('Error al generar venta:', error);

        this.errorGeneracion = error?.message || 'Ocurrió un error inesperado al generar la venta';

        this.swalService.showError(
            'Error en la transacción',
            this.obtenerMensajeError(error)
        );
    }

    // Método para obtener mensajes de error específicos - MANTENIDO
    private obtenerMensajeError(error: any): string {
        if (error?.status === 400) {
            return 'Los datos de la venta son inválidos. Verifica la información.';
        } else if (error?.status === 402) {
            return 'Error en el procesamiento de pago. Verifica los métodos de pago.';
        } else if (error?.status === 409) {
            return 'Ya existe una venta con estos datos.';
        } else if (error?.status === 503) {
            return 'El servicio de ventas no está disponible temporalmente. Intenta nuevamente.';
        } else {
            return 'No se pudo completar la transacción. Intenta nuevamente.';
        }
    }

    // Método para cerrar el modal del recibo - MEJORADO
    cerrarModalRecibo(): void {
        this.mostrarModalRecibo = false;
        this.ventaGenerada = false;

        // Pequeño delay antes de resetear para mejor UX
        setTimeout(() => {
            this.resetearVenta();
            this.cdr.detectChanges();
        }, 300);
    }

    // Método para resetear la venta - MANTENIDO
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
        this.resumenCashea = { cantidad: 0, total: 0, totalBs: 0 };
        this.cuotasCashea = [];
        this.valorInicialTemporal = '';
        this.valorTemporal = '';

        this.actualizarProductosConDetalle();
    }

    // Método para imprimir el recibo - MEJORADO
    imprimirRecibo(): void {
        const iframe = document.querySelector('.recibo-iframe') as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
            // Esperar a que el iframe esté listo
            const tryPrint = () => {
                try {
                    iframe.contentWindow!.print();
                } catch (error) {
                    // Si falla, intentar después de un breve delay
                    setTimeout(() => {
                        iframe.contentWindow!.print();
                    }, 500);
                }
            };

            if (iframe.contentDocument?.readyState === 'complete') {
                tryPrint();
            } else {
                iframe.onload = tryPrint;
            }
        }
    }

    // Método para compartir el recibo - MANTENIDO
    compartirRecibo(): void {
        this.swalService.showInfo(
            'Compartir Recibo',
            'Esta funcionalidad estará disponible próximamente. Por ahora puedes descargar el PDF.'
        );
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
            });
        }
        this.cdr.detectChanges();
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

    // === MÉTODOS PARA REFERENCIA Y BANCO ===
    necesitaReferencia(tipoMetodo: string): boolean {
        const metodosConReferencia = ['pagomovil', 'transferencia'];
        return metodosConReferencia.includes(tipoMetodo);
    }

    necesitaBanco(tipoMetodo: string): boolean {
        const metodosConBanco = ['pagomovil', 'transferencia'];
        return metodosConBanco.includes(tipoMetodo);
    }

    // Lista de bancos disponibles
    // En tu componente TypeScript
    get bancosDisponibles(): any[] {
        return [
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
    }

    onBancoChange(codigoBanco: string, index: number): void {
        const metodo = this.venta.metodosDePago[index];
        const bancoSeleccionado = this.bancosDisponibles.find(b => b.codigo === codigoBanco);

        if (bancoSeleccionado) {
            metodo.bancoCodigo = bancoSeleccionado.codigo;
            metodo.bancoNombre = bancoSeleccionado.nombre;
            metodo.banco = `${bancoSeleccionado.codigo} - ${bancoSeleccionado.nombre}`;
        } else {
            metodo.bancoCodigo = '';
            metodo.bancoNombre = '';
            metodo.banco = '';
        }
    }

    // Método para formatear la visualización
    getBancoDisplay(banco: any): string {
        if (!banco) return '';
        if (typeof banco === 'string') return banco;
        return `${banco.codigo} - ${banco.nombre}`;
    }

    // Método de búsqueda personalizado
    filtrarBancos(term: string, item: any): boolean {
        if (!term) return true;

        const termLower = term.toLowerCase().trim();
        const codigo = item.codigo?.toLowerCase() || '';
        const nombre = item.nombre?.toLowerCase() || '';
        const display = `${item.codigo} - ${item.nombre}`.toLowerCase();

        return codigo.includes(termLower) ||
            nombre.includes(termLower) ||
            display.includes(termLower);
    }

    // Método para limpiar campos cuando cambia el tipo de método
    onTipoMetodoChange(index: number): void {
        const metodo = this.venta.metodosDePago[index];

        // Limpiar campos específicos si ya no son necesarios
        if (!this.necesitaReferencia(metodo.tipo)) {
            metodo.referencia = '';
        }
        if (!this.necesitaBanco(metodo.tipo)) {
            metodo.banco = '';
        }

        this.onMetodoPagoChange(index);
    }

    // Método para verificar si se puede generar la venta
    get puedeGenerarVenta(): boolean {
        // Verificar que hay productos
        if (this.venta.productos.length === 0) {
            return false;
        }

        // Verificar que el monto cubierto por métodos sea suficiente
        const montoCubierto = this.totalPagadoPorMetodos;
        const montoRequerido = this.montoCubiertoPorMetodos;

        // Usar comparación con tolerancia para decimales
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

    // Mensaje de estado para el botón
    get mensajeEstadoBoton(): string {
        if (this.venta.productos.length === 0) {
            return 'Agrega productos para continuar';
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
}