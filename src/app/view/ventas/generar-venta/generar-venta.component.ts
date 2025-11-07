import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Producto } from '../../productos/producto.model';
import { ProductoService } from '../../productos/producto.service';

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

export class GenerarVentaComponent implements OnInit {

    // === CONSTRUCTOR Y CICLO DE VIDA ===
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
    ) { }

    ngOnInit(): void {
        this.resetearCarga();
        this.registrarTarea();
        this.cargarDatosIniciales();
    }


    // === PROPIEDADES DEL COMPONENTE ===

    // Estado y configuración
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

    // Datos maestros
    productos: Producto[] = [];
    pacientes: any[] = [];
    todosLosPacientes: Paciente[] = [];
    pacientesFiltradosPorSede: Paciente[] = [];
    productosFiltradosPorSede: Producto[] = [];
    empleadosDisponibles: Empleado[] = [];
    tasasDisponibles: Tasa[] = [];
    monedasDisponibles: Tasa[] = [];
    tasasPorId: Record<string, number> = {};

    // Selecciones del usuario
    pacienteSeleccionado: Paciente | null = null;
    productoSeleccionado: string | null = null;
    asesorSeleccionado: string | null = null;

    // Datos médicos
    historiaMedica: HistoriaMedica | null = null;

    // Carrito y cálculos
    productosConDetalle: ProductoVentaCalculado[] = [];
    totalProductos: number = 0;
    cuotasCashea: CuotaCashea[] = [];
    valorInicialTemporal = '';

    // Modelo de venta
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

    // Resumen Cashea
    resumenCashea = {
        cantidad: 0,
        total: 0,
        totalBs: 0
    };

    // Mapeos y constantes
    private readonly idMap: Record<string, string> = {
        usd: 'dolar',
        ves: 'bolivar',
        bs: 'bolivar',
        eur: 'euro',
        $: 'dolar',
        '€': 'euro'
    };

    private montoCubiertoAnterior: number = 0;

    // === MÉTODOS DE INICIALIZACIÓN Y CARGA ===

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
            this.productos = productosResponse.productos ?? [];

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

            this.venta.moneda = 'dolar';
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

    // === MÉTODOS DE PRODUCTOS Y CARRITO ===
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


    // === CÁLCULOS Y ACTUALIZACIONES DE PRODUCTOS ===
    actualizarProductosConDetalle(): void {
        const tasaDestino = this.tasasDisponibles.find(t => t.nombre.toLowerCase() === this.venta.moneda)?.valor ?? 1;

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


    // === MÉTODOS DE VENTA Y PAGO ===
    private validaciones = {
        ventaBasica: (): boolean => {
            if (this.venta.productos.length === 0) {
                this.swalService.showWarning('Sin productos', 'Debes agregar al menos un producto para generar la venta.');
                return false;
            }

            if (this.requierePaciente && !this.pacienteSeleccionado) {
                this.swalService.showWarning('Paciente requerido', 'Debes seleccionar un paciente para continuar con la venta.');
                return false;
            }

            return true;
        },

        metodosPago: (): boolean => {
            if (this.venta.metodosDePago.length === 0) {
                this.swalService.showWarning('Método de pago requerido', 'Debes agregar al menos un método de pago.');
                return false;
            }

            const metodosInvalidos = this.venta.metodosDePago.filter(metodo =>
                !metodo.tipo || !metodo.monto || metodo.monto <= 0
            );

            if (metodosInvalidos.length > 0) {
                this.swalService.showWarning('Métodos de pago incompletos', 'Todos los métodos de pago deben tener un tipo y monto válido.');
                return false;
            }

            const totalMetodos = this.totalPagadoPorMetodos;
            const montoRequerido = this.montoCubiertoPorMetodos;
            const diferencia = Math.abs(totalMetodos - montoRequerido);

            if (diferencia > 0.01) {
                this.swalService.showWarning('Monto incorrecto',
                    `El total de métodos de pago (${totalMetodos}) no coincide con el monto requerido (${montoRequerido}).`);
                return false;
            }

            return true;
        },

        formaPagoEspecifica: (): boolean => {
            const montoTotalVenta = this.montoTotal;

            if (this.venta.formaPago === 'abono') {
                if (!this.venta.montoAbonado || this.venta.montoAbonado <= 0) {
                    this.swalService.showWarning('Abono inválido', 'Debes especificar un monto abonado válido.');
                    return false;
                }

                if (this.venta.montoAbonado >= montoTotalVenta) {
                    this.swalService.showWarning('Abono excedido', 'El monto abonado no puede ser mayor o igual al total de la venta.');
                    return false;
                }
            }

            if (this.venta.formaPago === 'cashea') {
                const inicialMinima = this.calcularInicialCasheaPorNivel(montoTotalVenta, this.nivelCashea);
                if (!this.venta.montoInicial || this.venta.montoInicial < inicialMinima) {
                    this.swalService.showWarning('Inicial insuficiente',
                        `El monto inicial para Cashea debe ser al menos ${inicialMinima} ${this.obtenerSimboloMoneda(this.venta.moneda)}`);
                    return false;
                }

                /*   if (this.resumenCashea.cantidad === 0) {
                       this.swalService.showWarning('Cuotas requeridas', 'Debes seleccionar al menos una cuota para adelantar.');
                       return false;
                   }
   
                   if (!this.casheaBalanceValido) {
                       this.swalService.showWarning('Balance inválido', 'El cálculo de cuotas de Cashea no es válido.');
                       return false;
                   }*/
            }

            return true;
        },

        stockProductos: (): boolean => {
            const productosSinStock = this.productosConDetalle.filter(p =>
                (p.cantidad ?? 1) > (p.stock ?? 0)
            );

            if (productosSinStock.length > 0) {
                const nombresProductos = productosSinStock.map(p => p.nombre).join(', ');
                this.swalService.showWarning('Stock insuficiente',
                    `Los siguientes productos no tienen suficiente stock: ${nombresProductos}`);
                return false;
            }

            return true;
        },

        ejecutarTodas: (): boolean => {
            return this.validaciones.ventaBasica() &&
                this.validaciones.metodosPago() &&
                this.validaciones.formaPagoEspecifica() &&
                this.validaciones.stockProductos();
        }
    };

    convertirMonto(monto: number, origen: string, destino: string): number {
        if (origen === destino) return this.redondear(monto);

        const tasas = {
            bolivar: 1,
            dolar: this.tasasPorId['dolar'] ?? 0,
            euro: this.tasasPorId['euro'] ?? 0
        };

        const montoEnBs = origen === 'dolar'
            ? monto * tasas.dolar
            : origen === 'euro'
                ? monto * tasas.euro
                : monto;

        return destino === 'dolar'
            ? +(montoEnBs / tasas.dolar).toFixed(2)
            : destino === 'euro'
                ? +(montoEnBs / tasas.euro).toFixed(2)
                : +montoEnBs.toFixed(2);
    }

    // Método para formatear fecha a ISO
    formatearFechaISO(fechaString: string): string {
        try {
            const partes = fechaString.split(' ');
            if (partes.length >= 4) {
                const dia = partes[1];
                const mes = this.obtenerNumeroMes(partes[3]);
                const año = partes[5];
                return new Date(`${año}-${mes}-${dia.padStart(2, '0')}`).toISOString();
            }
            return new Date().toISOString();
        } catch {
            return new Date().toISOString();
        }
    }

    // Método auxiliar para obtener número de mes
    obtenerNumeroMes(mes: string): string {
        const meses: { [key: string]: string } = {
            'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
            'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
            'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
        };
        return meses[mes.toLowerCase()] || '01';
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

    private payloadBuilder = {
        basico: (): any => ({
            fecha: new Date().toISOString(),
            sede: this.sedeActiva,
            moneda: this.venta.moneda,
            formaPago: this.venta.formaPago,
            descuento: this.venta.descuento || 0,
            observaciones: this.venta.observaciones || '',
            asesor: this.asesorSeleccionado,
        }),

        paciente: (): any => {
            if (!this.requierePaciente || !this.pacienteSeleccionado) {
                return { paciente: null };
            }

            return {
                paciente: {
                    key: this.pacienteSeleccionado.key
                }
            };
        },

        productos: (): any => {
            const productosMinimos = this.venta.productos.map(p => {
                const cantidad = p.cantidad || 1;

                // Solo información esencial para la venta
                return {
                    id: p.id,
                    cantidad: cantidad,
                    precio: this.convertirMonto(p.precio, p.moneda, this.venta.moneda),
                    precioConIva: this.convertirMonto(p.precioConIva, p.moneda, this.venta.moneda),
                    subtotal: this.convertirMonto(p.precio * cantidad, p.moneda, this.venta.moneda),
                    total: this.convertirMonto(p.precioConIva * cantidad, p.moneda, this.venta.moneda),
                };
            });

            return { productos: productosMinimos };
        },

        financieros: (): any => {
            const productos = this.payloadBuilder.productos().productos;

            const subtotal = this.redondear(productos.reduce((sum: number, p: any) => sum + p.subtotal, 0));
            const total = this.redondear(productos.reduce((sum: number, p: any) => sum + p.total, 0));
            const totalDescuento = this.redondear(total * (this.venta.descuento / 100));
            const totalFinal = this.redondear(total - totalDescuento);

            return {
                subtotal: subtotal,
                totalDescuento: totalDescuento,
                total: totalFinal,
                metodosDePago: this.venta.metodosDePago.map(metodo => ({
                    tipo: metodo.tipo,
                    monto: metodo.monto || 0,
                }))
            };
        },

        formaPago: (): any => {
            const financieros = this.payloadBuilder.financieros();
            const total = financieros.total;

            switch (this.venta.formaPago) {
                case 'contado':
                    return {
                        pagoCompleto: true,
                    };

                case 'abono':
                    return {
                        pagoCompleto: false,
                        montoAbonado: this.venta.montoAbonado,
                        saldoPendiente: total - (this.venta.montoAbonado || 0)
                    };

                case 'cashea':
                    const cantidadCuotas = Number(this.cantidadCuotasCashea) || 3;

                    return {
                        pagoCompleto: false,
                        financiado: true,
                        nivelCashea: this.nivelCashea,
                        montoInicial: this.venta.montoInicial,
                        cantidadCuotas: cantidadCuotas,
                        montoPorCuota: this.montoPrimeraCuota,
                        cuotasAdelantadas: this.cuotasCashea
                            .filter(c => c.seleccionada && !c.pagada)
                            .map(c => ({
                                numero: c.id,
                                monto: c.monto,
                                fechaVencimiento: this.formatearFechaISO(c.fecha)
                            })),
                        totalAdelantado: this.resumenCashea.total
                    };

                default:
                    return {};
            }
        },

        historiaMedica: (): any => {
            if (!this.requierePaciente || !this.historiaMedica || !this.historiaMedica.id) {
                return {};
            }

            //ID de la historia médica más reciente
            return {
                historiaMedicaId: this.historiaMedica.id
            };
        },

        construirCompleto: (): any => {
            const basico = this.payloadBuilder.basico();
            const paciente = this.payloadBuilder.paciente();
            const productos = this.payloadBuilder.productos();
            const financieros = this.payloadBuilder.financieros();
            const formaPago = this.payloadBuilder.formaPago();
            const historiaMedica = this.payloadBuilder.historiaMedica();

            return {
                ...basico,
                ...paciente,
                ...productos,
                ...financieros,
                ...formaPago,
                ...historiaMedica
            };
        }
    };

    // === UTILIDADES DE UI AGRUPADAS ===
    private uiUtils = {
        cerrarModal: (): void => {
            const modalElement = document.getElementById('resumenVentaModal');
            if (modalElement) {
                const modal = bootstrap.Modal.getInstance(modalElement);
                modal?.hide();
            }
        },

        mostrarExito: (): void => {
            this.swalService.showSuccess('Venta generada', 'La venta se ha registrado exitosamente.');
        },

        mostrarError: (error: any): void => {
            console.error('Error al generar venta:', error);
            this.swalService.showError('Error', 'No se pudo generar la venta. Por favor, intenta nuevamente.');
        }
    };

    generarVenta(): void {
        if (!this.validaciones.ejecutarTodas()) {
            return;
        }

        const payload = this.payloadBuilder.construirCompleto();
        this.loader.show();

        console.log('payload', payload);

        /* this.generarVentaService.crearVenta(payload).subscribe({
             next: (response) => {
                 this.loader.hide();
                 this.uiUtils.mostrarExito();
                 this.uiUtils.cerrarModal();
                 this.resetFormularioCompleto();
                 console.log('Venta generada:', response);
             },
             error: (error) => {
                 this.loader.hide();
                 this.uiUtils.mostrarError(error);
             }
         });*/
    }

    resetFormularioCompleto(): void {
        this.venta = {
            productos: [],
            moneda: 'dolar',
            formaPago: 'contado',
            impuesto: 16,
            descuento: 0,
            observaciones: '',
            montoInicial: 0,
            numeroCuotas: 0,
            montoAbonado: 0,
            metodosDePago: []
        };

        this.historiaMedica = null;
        this.pacienteSeleccionado = null;
        this.productoSeleccionado = null;
        this.asesorSeleccionado = this.currentUser?.id ?? null;
        this.requierePaciente = false;
        this.productosConDetalle = [];
        this.totalProductos = 0;
        this.cuotasCashea = [];
        this.resumenCashea = { cantidad: 0, total: 0, totalBs: 0 };
        this.valorInicialTemporal = '';
        this.valorTemporal = '';
        this.montoExcedido = false;
    }


    // === MÉTODOS DE PAGO Y MÉTODOS DE PAGO ===
    agregarMetodo(): void {
        this.venta.metodosDePago.push({ tipo: '', monto: 0 });
    }

    eliminarMetodo(index: number): void {
        this.venta.metodosDePago.splice(index, 1);
    }

    autocompletarUltimoMetodo(): void {
        if (this.venta.metodosDePago.length === 0) return;

        const index = this.venta.metodosDePago.length - 1;
        const restante = this.getMontoRestanteParaMetodo(index);

        if (restante > 0) {
            const metodoActual = this.venta.metodosDePago[index];
            const montoActual = metodoActual.monto ?? 0;

            if (montoActual === 0 || Math.abs(montoActual - restante) > 0.01) {
                metodoActual.monto = restante;
                metodoActual.valorTemporal = `${restante.toFixed(2)} ${this.obtenerSimboloMoneda(this.venta.moneda)}`;
            }
        }
    }

    validarMontoMetodo(index: number): void {
        const maximo = this.getMontoRestanteParaMetodo(index);
        const actual = this.venta.metodosDePago[index].monto ?? 0;

        if (actual > maximo) {
            this.venta.metodosDePago[index].monto = maximo;
        }
    }

    getMontoRestanteParaMetodo(index: number): number {
        const otrosMontos = this.venta.metodosDePago
            .filter((_, i) => i !== index)
            .reduce((sum, metodo) => sum + (metodo.monto ?? 0), 0);

        const restante = Math.max(this.montoCubiertoPorMetodos - otrosMontos, 0);

        return restante;
    }


    // === CÁLCULOS FINANCIEROS ===
    get subtotal(): number {
        return this.productosConDetalle.reduce((acc, p) => acc + p.subtotal, 0);
    }

    get totalIva(): number {
        return this.productosConDetalle.reduce((acc, p) => acc + p.iva, 0);
    }

    get totalGeneral(): number {
        return +(this.subtotal + this.totalIva).toFixed(2);
    }

    get totalConDescuento(): number {
        const bruto = this.subtotal + this.totalIva;
        const descuento = (this.venta.descuento ?? 0) / 100;
        return +(bruto * (1 - descuento)).toFixed(2);
    }

    get montoTotal(): number {
        const descuento = this.venta.descuento ?? 0;
        return Math.round((this.totalProductos * (1 - descuento / 100)) * 100) / 100;
    }

    get totalAdeudado(): number {
        return Math.max(this.montoTotal - (this.venta.montoAbonado ?? 0), 0);
    }

    // Métodos de pago
    get totalPagadoPorMetodos(): number {
        return this.venta.metodosDePago.reduce((sum, metodo) => sum + (metodo.monto ?? 0), 0);
    }

    get montoCubiertoPorMetodos(): number {
        switch (this.venta.formaPago) {
            case 'contado':
                return this.montoTotal;
            case 'abono':
                return this.venta.montoAbonado ?? 0;
            case 'cashea':
                const inicial = this.venta.montoInicial ?? 0;
                const cuotasAdelantadas = this.resumenCashea.total;
                return inicial + cuotasAdelantadas;
            default:
                return 0;
        }
    }

    get restantePorMetodos(): number {
        return Math.max(this.montoCubiertoPorMetodos - this.totalPagadoPorMetodos, 0);
    }

    get desbalanceMetodos(): boolean {
        return this.totalPagadoPorMetodos > this.montoCubiertoPorMetodos;
    }

    // Progresos
    get progresoMetodos(): number {
        const pagado = this.totalPagadoPorMetodos;
        const requerido = this.montoCubiertoPorMetodos;

        if (Math.abs(pagado - requerido) < 0.01) return 100;
        return Math.min((pagado / requerido) * 100, 100);
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

    // Mensajes y títulos
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

    // === MÉTODOS CASHEA ===
    onFormaPagoChange(valor: string): void {
        this.venta.formaPago = valor;

        if (valor === 'cashea') {
            this.controlarCuotasPorNivel();
            this.actualizarMontoInicialCashea();
            this.generarCuotasCashea();
        }

        this.venta.metodosDePago = [];
        this.resumenCashea = { cantidad: 0, total: 0, totalBs: 0 };
    }

    verificarConfiguracionCashea(): void {
        console.log('🔍 Configuración Cashea actual:', {
            nivel: this.nivelCashea,
            permite6Cuotas: this.nivelPermiteCuotasExtendidas(this.nivelCashea),
            cuotasSeleccionadas: this.cantidadCuotasCashea,
            montoInicial: this.venta.montoInicial,
            montoTotal: this.montoTotal
        });
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

    verificarCambiosMontoCubierto(): void {
        const montoActual = this.montoCubiertoPorMetodos;

        if (Math.abs(montoActual - this.montoCubiertoAnterior) > 0.01) {
            this.montoCubiertoAnterior = montoActual;
            this.actualizarMontosMetodosPago();
        }
    }

    onDescuentoChange(): void {
        if (this.venta.descuento < 0) this.venta.descuento = 0;
        if (this.venta.descuento > 100) this.venta.descuento = 100;

        this.actualizarProductosConDetalle();

        if (this.venta.formaPago === 'cashea') {
            this.actualizarMontoInicialCashea();
            this.generarCuotasCashea();
            this.actualizarMontosMetodosPago();
        }
    }

    actualizarMontoInicialCashea(): void {
        const totalConDescuento = this.montoTotal;
        const nuevoMontoInicial = this.calcularInicialCasheaPorNivel(totalConDescuento, this.nivelCashea);

        this.venta.montoInicial = nuevoMontoInicial;
        this.valorInicialTemporal = `${nuevoMontoInicial.toFixed(2)} ${this.obtenerSimboloMoneda(this.venta.moneda)}`;
    }

    onNivelCasheaChange(): void {
        if (this.venta.formaPago === 'cashea') {
            this.controlarCuotasPorNivel();

            this.actualizarMontoInicialCashea();
            this.generarCuotasCashea();
        }
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

    actualizarResumenCashea(): void {
        const seleccionadas = this.cuotasCashea.filter(c => c.seleccionada);
        const total = seleccionadas.reduce((sum, c) => sum + c.monto, 0);
        const tasa = this.obtenerTasaBs();

        this.resumenCashea = {
            cantidad: seleccionadas.length,
            total,
            totalBs: this.redondear(this.obtenerEquivalenteBs(total))
        };

        this.actualizarMontosMetodosPago();
    }

    private actualizarMontosMetodosPago(): void {
        if (this.venta.metodosDePago.length === 0) return;

        let montoRestante = this.montoCubiertoPorMetodos;

        this.venta.metodosDePago.forEach((metodo, index) => {
            const maximoPermitido = this.getMontoRestanteParaMetodo(index);

            // Si el monto actual excede el nuevo máximo, ajustarlo
            if ((metodo.monto ?? 0) > maximoPermitido) {
                metodo.monto = maximoPermitido;
                metodo.valorTemporal = `${maximoPermitido.toFixed(2)} ${this.obtenerSimboloMoneda(this.venta.moneda)}`;
            }

            montoRestante -= (metodo.monto ?? 0);
        });

        this.autocompletarUltimoMetodo();
        this.cdr.detectChanges();
    }

    private actualizarValidacionMetodosPago(): void {
        if (this.venta.metodosDePago.length > 0 && this.restantePorMetodos > 0) {
            this.autocompletarUltimoMetodo();
        }

        this.cdr.detectChanges();
    }

    get casheaBalanceValido(): boolean {
        const plan = this.calcularCasheaPlan(this.cantidadCuotasCashea);
        const totalPagado = this.redondear(
            plan.inicial + plan.cuotasOrdenadas.reduce((total, cuota) => total + cuota.monto, 0)
        );
        return Math.abs(totalPagado - this.montoTotal) < 0.01;
    }

    get nombreCompletoAsesor(): string {
        return this.currentUser?.nombre ?? 'Sin nombre';
    }

    getResumenAsesor(): string {
        const asesor = this.empleadosDisponibles.find(e => e.id === this.asesorSeleccionado);
        if (!asesor) return 'Sin asesor asignado';
        return `${asesor.nombre} — ${asesor.cargoNombre}`;
    }

    // === NUEVOS MÉTODOS PARA VALIDACIÓN Y CONVERSIÓN ===

    // Método cuando cambia el tipo de método de pago
    onMetodoPagoChange(index: number): void {
        const metodo = this.venta.metodosDePago[index];

        // Si había un monto previo y ahora seleccionó un método, mantenerlo
        if (metodo.monto && metodo.monto > 0) {
            this.formatearMontoMetodo(index);
        }

        // Forzar actualización de la UI
        this.cdr.detectChanges();
    }

    // Obtener placeholder dinámico según el método
    getPlaceholderMonto(tipoMetodo: string): string {
        if (!tipoMetodo) {
            return 'Ingrese un monto';
        }

        const simbolo = this.obtenerSimboloMoneda(this.venta.moneda);
        return `Monto en ${simbolo}`;
    }

    // Determinar si mostrar conversión a bolívares
    mostrarConversionBs(tipoMetodo: string): boolean {
        // Mostrar conversión para débito y crédito cuando la moneda no es bolívar
        const mostrar = (tipoMetodo === 'debito' || tipoMetodo === 'credito' || tipoMetodo === 'transferencia' || tipoMetodo === 'pagomovil') &&
            this.venta.moneda !== 'bolivar';
        return mostrar;
    }

    // Calcular conversión a bolívares
    calcularConversionBs(monto: number): number {
        if (!monto || monto <= 0) return 0;

        const tasa = this.obtenerTasaActual();
        return this.redondear(monto * tasa);
    }

    // Obtener tasa actual de conversión
    obtenerTasaActual(): number {
        if (this.venta.moneda === 'bolivar') {
            return 1;
        }

        const tasa = this.tasasPorId[this.venta.moneda] || 1;
        return tasa;
    }


    // === MÉTODOS DE UTILIDAD ===
    redondear(valor: number): number {
        return Math.round(valor * 100) / 100;
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

    obtenerEquivalenteBs(monto: number): number {
        const moneda = this.venta.moneda;
        const tasa = this.tasasPorId?.[moneda] ?? 1;
        return moneda === 'bolivar' ? monto : monto * tasa;
    }

    // === MÉTODOS DE VALIDACIÓN Y FORMATEO ===
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

    formatearMontoMetodo(index: number): void {
        const metodo = this.venta.metodosDePago[index];

        // ✅ VALIDAR QUE TENGA MÉTODO SELECCIONADO
        if (!metodo.tipo) {
            this.snackBar.open('⚠️ Primero selecciona un método de pago', 'Cerrar', {
                duration: 3000
            });
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
        const maximo = this.getMontoRestanteParaMetodo(index);

        if (isNaN(monto)) {
            metodo.monto = 0;
            metodo.valorTemporal = '';
            return;
        }

        // ✅ SIEMPRE asegurar que no exceda el máximo
        metodo.monto = Math.min(monto, maximo);
        metodo.valorTemporal = `${metodo.monto.toFixed(2)} ${this.obtenerSimboloMoneda(this.venta.moneda)}`;
    }

    // === MÉTODOS DE UI Y MODALES ===
    abrirModalResumen(): void {
        // this.resetFormulario(); // ← limpieza previa

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

    ngAfterViewInit(): void {
        const modalElement = document.getElementById('resumenVentaModal');
        if (modalElement) {
            modalElement.addEventListener('hidden.bs.modal', () => {
                this.resetearModalVenta();
            });
        }

        // Observar cambios en montoCubiertoPorMetodos
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
        this.venta.moneda = 'dolar';
        this.valorInicialTemporal = '';
        this.montoExcedido = false;
    }

    obtenerTasaBs(): number {
        return 1;
    }

    calcularMontoPorCuota(): number {
        const total = this.totalConDescuento;
        const restante = total - (this.venta.montoInicial ?? 0);
        const cuotas = this.venta.numeroCuotas ?? 1;
        return cuotas > 0 ? +(restante / cuotas).toFixed(2) : 0;
    }

}