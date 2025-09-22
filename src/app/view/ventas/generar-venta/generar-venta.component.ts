import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { Producto, ProductoDto, MonedaVisual } from '../../productos/producto.model';
import { ProductoService } from '../../productos/producto.service';
import { Sede } from '../../../view/login/login-interface';

import { TasaCambiariaService } from '../../../core/services/tasaCambiaria/tasaCambiaria.service';
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
import { VentaDto, ProductoVentaDto, ProductoVenta } from '../venta-interfaz';
import { Empleado, User } from '../../../Interfaces/models-interface';
import { EmpleadosService } from './../../../core/services/empleados/empleados.service';


@Component({
    selector: 'app-generar-venta',
    standalone: false,
    templateUrl: './generar-venta.component.html',
    styleUrls: ['./generar-venta.component.scss']
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
    readonly IVA = 0.16;


    venta: VentaDto = {
        productos: [],
        moneda: 'usd',
        formaPago: 'contado',
        descuento: 0,
        impuesto: 16,
        observaciones: '',
        montoInicial: 0,
        numeroCuotas: 0,
        montoAbonado: 0,
        metodosDePago: []
    };

    productosConDetalle: {
        id: string;
        nombre: string;
        precio: number;
        cantidad: number;
        subtotal: number;
        iva: number;
        total: number;
        moneda: string;
    }[] = [];




    constructor(
        private productoService: ProductoService,
        private tasaCambiariaService: TasaCambiariaService,
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
            productos: this.productoService.getProductos().pipe(take(1)),
            pacientes: this.pacientesService.getPacientes().pipe(
                take(1),
                map(resp => resp.pacientes ?? [])
            ),
            usuario: this.userStateService.currentUser$.pipe(take(1)),
            tasas: this.tasaCambiariaService.getTasas().pipe(
                take(1),
                map(t => ({
                    dolar: t.usd ?? 0,
                    euro: t.eur ?? 0
                })),
                catchError(() => of({ dolar: 0, euro: 0 }))
            ),
            asesores: this.empleadosService.getAllEmpleados().pipe(take(1)) // ✅ llamada al API de empleados
        }).subscribe(({ productos, pacientes, usuario, tasas, asesores }) => {
            this.productos = productos;
            this.pacientes = pacientes;
            this.tasaDolar = tasas.dolar;
            this.tasaEuro = tasas.euro;
            this.todosLosPacientes = pacientes;
            this.pacientesFiltradosPorSede = pacientes;

            this.currentUser = usuario;
            this.asesorSeleccionado = usuario?.id ?? null;
            this.empleadosDisponibles = asesores;

            console.log('Productos: ', this.productos);

            this.sedeActiva = usuario?.sede?.trim().toLowerCase() ?? '';
            // this.productosFiltradosPorSede = productos.filter(p => p.sede === this.sedeActiva);
            this.productosFiltradosPorSede = productos
                .filter(p => p.sede?.trim().toLowerCase() === this.sedeActiva)
                .map(p => ({
                    ...p,
                    precioConIva: +p.precio, // cableado desde el campo original
                    aplicaIva: this.determinarSiAplicaIva(p),
                    moneda: p.moneda
                }));

            console.log(' this.productosFiltradosPorSede: ', this.productosFiltradosPorSede);




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
        console.log('🔍 pacienteKey:', pacienteKey);

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


    agregarProducto(producto: ProductoVenta): void {
        const yaExiste = this.venta.productos.find(p => p.id === producto.id);

        if (yaExiste) {
            yaExiste.cantidad = (yaExiste.cantidad ?? 1) + 1;
        } else {
            const precioSinIva = producto.aplicaIva
                ? +(producto.precioConIva / (1 + this.IVA)).toFixed(2)
                : producto.precioConIva;

            this.venta.productos.push({
                id: producto.id,
                nombre: producto.nombre,
                precio: precioSinIva,
                moneda: producto.moneda,
                cantidad: 1,
                aplicaIva: producto.aplicaIva
            });
        }
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
        this.snackBar.open(`${eliminado} eliminado`, 'Cerrar', { duration: 2000 });
    }

    agregarProductoPorSeleccion(producto: any): void {
        const yaExiste = this.venta.productos.some(p => p.id === producto.id);
        if (yaExiste) {
            this.swalService.showInfo('Producto ya agregado', 'Este producto ya está en el carrito.');
            return;
        }

        const productoDto: ProductoVentaDto = {
            id: producto.id,
            nombre: producto.nombre,
            precio: +producto.precio,
            moneda: producto.moneda?.toLowerCase() === 'ves' ? 'bs' : producto.moneda ?? 'usd',
            cantidad: 1,
            aplicaIva: producto.categoria?.toLowerCase() === 'monturas' || producto.nombre?.toLowerCase().includes('montura')
        };

        this.venta.productos.push(productoDto);
        this.actualizarProductosConDetalle();
        this.productoSeleccionado = null;
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
            moneda: 'usd',
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
        const minimo = this.calcularInicialCasheaPorNivel(this.totalConDescuento, this.nivelCashea);
        this.venta.montoInicial = minimo;
    }

    validarInicialCashea(): void {
        const minimo = this.calcularInicialCasheaPorNivel(this.totalConDescuento, this.nivelCashea);
        if ((this.venta.montoInicial ?? 0) < minimo) {
            this.venta.montoInicial = minimo;
            this.snackBar.open(`La inicial no puede ser menor a ${minimo} $ para ${this.nivelCashea}`, 'Cerrar', {
                duration: 3000
            });
        }
    }

    calcularCasheaPlan(): { inicial: number; cuotas: number[]; fechas: string[] } {
        const total = this.totalConDescuento;
        const inicial = this.venta.montoInicial ?? this.calcularInicialCasheaPorNivel(total, this.nivelCashea);
        const restante = total - inicial;
        const numeroCuotas = 3;
        const montoPorCuota = +(restante / numeroCuotas).toFixed(2);

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

    onFormaPagoChange(valor: string): void {
        this.venta.formaPago = valor;
        if (valor === 'cashea') {
            this.asignarInicialPorNivel();
        }
    }

    actualizarProductosConDetalle(): void {
        this.productosConDetalle = this.venta.productos.map(p => {
            const precioConIva = p.precio;
            const precioSinIva = p.aplicaIva ? +(precioConIva / (1 + this.IVA)).toFixed(2) : precioConIva;
            const iva = p.aplicaIva ? +(precioConIva - precioSinIva).toFixed(2) : 0;
            const subtotal = +(precioSinIva * p.cantidad).toFixed(2);
            const total = +(precioConIva * p.cantidad).toFixed(2);

            return {
                id: p.id,
                nombre: p.nombre,
                precio: precioSinIva,
                cantidad: p.cantidad,
                subtotal,
                iva,
                total,
                moneda: p.moneda
            };
        });
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







}