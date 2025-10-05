import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { Producto, ProductoDto, MonedaVisual } from '../../productos/producto.model';
import { ProductoService } from '../../productos/producto.service';
import { Sede } from '../../../view/login/login-interface';

import { GenerarVentaService } from './generar-venta.service';
import { Tasa } from '../../../Interfaces/models-interface';
import { SwalService } from '../../../core/services/swal/swal.service';
import { Observable, of, forkJoin, map } from 'rxjs';
import { switchMap, take, catchError } from 'rxjs/operators';
import { LoaderService } from './../../../shared/loader/loader.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UserStateService } from '../../../core/services/userState/user-state-service';
import { HttpErrorResponse } from '@angular/common/http';
import { PacientesService } from '../../../core/services/pacientes/pacientes.service';
import { HistoriaMedicaService } from '../../../core/services/historias-medicas/historias-medicas.service';
import { Paciente, PacientesListState } from '../../pacientes/paciente-interface';
import { HistoriaMedica, Recomendaciones, TipoMaterial, Antecedentes, ExamenOcular, Medico, DatosConsulta } from './../../historias-medicas/historias_medicas-interface';
import { VentaDto, ProductoVentaDto, ProductoVenta, ProductoVentaCalculado } from '../venta-interfaz';
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

    productos: Producto[] = [];
    pacientes: any[] = [];
    tasaDolar = 0;
    tasaEuro = 0;
    sedeActiva: string = '';
    sedeFiltro: string = this.sedeActiva;
    productosFiltradosPorSede: Producto[] = [];
    historiaMedica: HistoriaMedica | null = null;
    tareasPendientes = 0;
    dataIsReady = false;
    pacienteInput: string = '';
    busquedaProducto: string = '';
    pacienteSeleccionado: Paciente | null = null;
    pacientesFiltradosPorSede: Paciente[] = [];
    todosLosPacientes: Paciente[] = [];
    productoSeleccionado: string | null = null;
    empleadosDisponibles: Empleado[] = [];
    currentUser: User | null = null;
    asesorSeleccionado: string | null = null;
    nivelCashea: 'nivel1' | 'nivel2' | 'nivel3' | 'nivel4' | 'nivel5' | 'nivel6' = 'nivel3';
    ivaPorcentaje = 0; // en porcentaje, como 16
    tasasDisponibles: Tasa[] = [];
    tasasPorId: Record<string, number> = {};
    monedasDisponibles: Tasa[] = [];
    productosConDetalle: ProductoVentaCalculado[] = [];
    totalProductos: number = 0;
    requierePaciente: boolean = false; // ✅ por defecto no se requiere


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
        this.resetearCarga(); // limpia estado visual y activa loader
        this.registrarTarea();
        this.cargarDatosIniciales();
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
            //    console.log('Tasas disponibles:', this.tasasDisponibles);
            this.monedasDisponibles = tasas;
            this.tasasPorId = Object.fromEntries(tasas.map(t => [t.id, t.valor]));
            console.log('this.tasasPorId', this.tasasPorId);

            this.venta.moneda = 'dolar';
            this.actualizarProductosConDetalle();

            this.completarTarea();
        });
    }

    onPacienteSeleccionado(pacienteSeleccionado: Paciente | null): void {
        this.registrarTarea();
        this.historiaMedica = null;

        if (!pacienteSeleccionado?.key) {
            console.error('No se encontró la clave del paciente seleccionado.', pacienteSeleccionado?.key);
            this.completarTarea();
            return;
        }

        const pacienteKey = pacienteSeleccionado.key;
        // console.log('🔍 pacienteKey:', pacienteKey);

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

                // Tomamos la más reciente por fecha de creación
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

    agregarProductoAlCarrito(producto: ProductoVenta | any): void {
        const yaExiste = this.venta.productos.find(p => p.id === producto.id);
        console.log('agregarProductoAlCarrito - producto', producto);

        // console.log('agregarProductoAlCarrito - producto ', producto);
        // Validaciones defensivas
        const stockDisponible = producto.stock ?? 0;
        const precioBase = +(producto.precio ?? 0);
        const precioFinal = +(producto.precioConIva ?? 0);
        const monedaOriginal = this.idMap[producto.moneda?.toLowerCase()] ?? producto.moneda?.toLowerCase() ?? 'dolar';

        const aplicaIva = producto.aplicaIva ?? false;


        //  console.log('agregarProductoAlCarrito - monedaOriginal ', monedaOriginal);

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
                precio: precioBase,
                precioConIva: precioFinal,
                moneda: monedaOriginal, // ✅ se conserva la moneda original
                cantidad: 1,
                aplicaIva,
                stock: producto.stock ?? 0 // ✅ importante para validación posterior
            });
        }

        this.actualizarProductosConDetalle();
        this.productoSeleccionado = null;
    }


    determinarSiAplicaIva(producto: Producto): boolean {
        // Puedes ajustar esta lógica según el tipo, categoría o nombre
        return producto.categoria === 'Monturas' || producto.nombre.toLowerCase().includes('monturas');
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

    eliminarProducto(id: string): void {
        const eliminado = this.venta.productos.find(p => p.id === id)?.nombre;
        this.venta.productos = this.venta.productos.filter(p => p.id !== id);

        this.actualizarProductosConDetalle(); // ✅ actualiza la tabla

        this.snackBar.open(`${eliminado} eliminado`, 'Cerrar', { duration: 2000 });
    }


    filtrarProductoPorNombreOCodigo(term: string, item: Producto): boolean {
        const nombre = item.nombre?.toLowerCase() ?? '';
        const codigo = item.codigo?.toLowerCase() ?? '';
        const normalizado = term.trim().toLowerCase();
        return nombre.includes(normalizado) || codigo.includes(normalizado);
    }

    generarVenta(): void {
        if (this.venta.productos.length === 0) {
            this.swalService.showWarning('Sin productos', 'Debes agregar al menos un producto para generar la venta.');
            return;
        }

        const payload = {
            ...this.venta,
            total: this.totalConDescuento,
            sede: this.sedeActiva
        };

        /*   const totalPagado = this.venta.metodosDePago.reduce((sum, m) => sum + m.monto, 0);
   if (totalPagado !== this.totalConDescuento) {
     this.swalService.showWarning('Monto inconsistente', 'La suma de los métodos de pago no coincide con el total.');
     return;
   }*/


        this.loader.show();
        /* this.ventasService.crearVenta(payload).subscribe({
             next: () => {
                 this.loader.hide();
                 this.swalService.showSuccess('Venta generada', 'La venta se registró correctamente.');
                 this.resetFormulario();
             },
             error: () => {
                 this.loader.hide();
                 this.swalService.showError('Error al generar venta', 'Ocurrió un problema al registrar la venta.');
             }
         });*/
    }

    resetFormulario(): void {
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
            }, 300); // Delay visual para evitar parpadeo
        }
    }

    calcularMontoPorCuota(): number {
        const total = this.totalConDescuento;
        const restante = total - (this.venta.montoInicial ?? 0);
        const cuotas = this.venta.numeroCuotas ?? 1;
        return cuotas > 0 ? +(restante / cuotas).toFixed(2) : 0;
    }

    agregarMetodo(): void {
        this.venta.metodosDePago.push({ tipo: '', monto: 0 });
    }

    eliminarMetodo(index: number): void {
        this.venta.metodosDePago.splice(index, 1);
    }

    //User actual de la sesion
    get nombreCompletoAsesor(): string {
        return this.currentUser?.nombre ?? 'Sin nombre';
    }

    //Asesor asignado para la venta
    getResumenAsesor(): string {
        const asesor = this.empleadosDisponibles.find(e => e.id === this.asesorSeleccionado);
        if (!asesor) return 'Sin asesor asignado';
        return `${asesor.nombre} — ${asesor.cargoNombre}`;
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

    asignarInicialPorNivel(): void {
        const minimo = this.calcularInicialCasheaPorNivel(this.montoTotal, this.nivelCashea);
        this.venta.montoInicial = minimo;
    }

    validarInicialCashea(): void {
        const minimo = this.calcularInicialCasheaPorNivel(this.montoTotal, this.nivelCashea);
        if ((this.venta.montoInicial ?? 0) < minimo) {
            this.venta.montoInicial = minimo;
            this.snackBar.open(`La inicial no puede ser menor a ${minimo} ${this.obtenerSimboloMoneda(this.venta.moneda)} para ${this.nivelCashea}`, 'Cerrar', {
                duration: 3000
            });
        }
    }

    calcularCasheaPlan(): { inicial: number; cuotas: number[]; fechas: string[] } {
        const total = this.montoTotal;
        const inicial = this.venta.montoInicial ?? this.calcularInicialCasheaPorNivel(total, this.nivelCashea);
        const restante = total - inicial;
        const numeroCuotas = 3;
        const montoPorCuota = this.redondear(restante / numeroCuotas);

        const fechas: string[] = [];
        const hoy = new Date();
        for (let i = 1; i <= numeroCuotas; i++) {
            const fecha = new Date(hoy);
            fecha.setDate(hoy.getDate() + i * 14);
            fechas.push(fecha.toLocaleDateString('es-VE'));
        }

        return {
            inicial,
            cuotas: Array(numeroCuotas).fill(montoPorCuota),
            fechas
        };
    }

    get progresoCashea(): number {
        const plan = this.calcularCasheaPlan();
        const pagado = this.redondear(plan.inicial + plan.cuotas.reduce((a, b) => a + b, 0));
        const porcentaje = (pagado / this.montoTotal) * 100;
        return this.casheaBalanceValido ? 100 : Math.round(porcentaje);
    }



    onFormaPagoChange(valor: string): void {
        this.venta.formaPago = valor;
        if (valor === 'cashea') {
            this.asignarInicialPorNivel();
        }
    }

    redondear(valor: number): number {
        return Math.round(valor * 100) / 100;
    }


    actualizarProductosConDetalle(): void {
        const tasaDestino = this.tasasDisponibles.find(t => t.nombre.toLowerCase() === this.venta.moneda)?.valor ?? 1;

        console.log('this.venta.productos', this.venta.productos);
        this.productosConDetalle = this.venta.productos.map(p => {
            const cantidad = p.cantidad ?? 1;
            const aplicaIva = p.aplicaIva ?? false;
            const tasaOrigen = this.tasasDisponibles.find(t => t.nombre.toLowerCase() === p.moneda)?.valor ?? 1;

            // Subtotal en moneda original
            const subtotal = +(p.precio * cantidad).toFixed(2);

            // IVA en moneda original
            const iva = aplicaIva ? +(subtotal * (this.ivaPorcentaje / 100)).toFixed(2) : 0;

            // Total en moneda original
            const totalEnOrigen = subtotal + iva;

            // Conversión al destino
            const factor = tasaOrigen / tasaDestino;
            const totalConvertido = +(totalEnOrigen * factor).toFixed(2);

            return {
                ...p,
                cantidad,
                subtotal, // en moneda original
                iva,      // en moneda original
                total: totalConvertido, // en moneda seleccionada
                precioConvertido: +(p.precio * factor).toFixed(2),
                stock: p.stock // ✅ mantenerlo para validación visual
            };
        });

        this.totalProductos = this.calcularTotalProductos();
    }

    get subtotal(): number {
        // Suma de subtotales sin IVA
        return this.productosConDetalle.reduce((acc, p) => acc + p.subtotal, 0);
    }

    get totalIva(): number {
        // Suma total del IVA por producto
        return this.productosConDetalle.reduce((acc, p) => acc + p.iva, 0);
    }

    get totalGeneral(): number {
        // Total final con IVA incluido
        return +(this.subtotal + this.totalIva).toFixed(2);
    }

    get totalConDescuento(): number {
        const bruto = this.subtotal + this.totalIva;
        const descuento = (this.venta.descuento ?? 0) / 100;
        return +(bruto * (1 - descuento)).toFixed(2);
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



    convertirMonto(monto: number, origen: string, destino: string): number {
        if (origen === destino) return +monto.toFixed(2);

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

    private readonly idMap: Record<string, string> = {
        usd: 'dolar',
        ves: 'bolivar',
        bs: 'bolivar',
        eur: 'euro',
        $: 'dolar',
        '€': 'euro'
    };

    obtenerSimboloMoneda(id: string): string {
        // console.log ('obtenerSimboloMoneda - id', id);
        const normalizado = this.idMap[id?.toLowerCase()] ?? id?.toLowerCase();
        const moneda = this.tasasDisponibles.find(m => m.id === normalizado);
        return moneda?.simbolo ?? '';
    }

    calcularTotalProductos(): number {
        if (!Array.isArray(this.productosConDetalle)) return 0;

        return this.productosConDetalle.reduce((acc, p) => {
            const total = +p.total || 0;
            return acc + total;
        }, 0);
    }

    trackByProducto(index: number, item: any): string {
        return item.id;
    }


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

    obtenerEquivalenteBs(monto: number): number {
        const moneda = this.venta.moneda;
        const tasa = this.tasasPorId?.[moneda] ?? 1;
        return moneda === 'bolivar' ? monto : monto * tasa;
    }

    redondearDosDecimales(valor: number): number {
        return Math.round(valor * 100) / 100;
    }

    get montoTotal(): number {
        const descuento = this.venta.descuento ?? 0;
        return Math.round((this.totalProductos * (1 - descuento / 100)) * 100) / 100;
    }

    get totalAdeudado(): number {
        return Math.max(this.montoTotal - (this.venta.montoAbonado ?? 0), 0);
    }

    get casheaBalanceValido(): boolean {
        const plan = this.calcularCasheaPlan();
        const totalPagado = this.redondear(plan.inicial + plan.cuotas.reduce((a, b) => a + b, 0));
        return Math.abs(totalPagado - this.montoTotal) < 0.01;
    }

}