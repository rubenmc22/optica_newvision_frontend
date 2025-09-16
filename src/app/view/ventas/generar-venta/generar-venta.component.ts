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
import { VentaDto, ProductoVentaDto } from '../venta-interfaz';


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


    venta: VentaDto = {
        moneda: 'bs',
        formaPago: '',
        productos: [],
        impuesto: 16,
        descuento: undefined,
        observaciones: ''
    };


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
        private historiaService: HistoriaMedicaService
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
                map(resp => resp.pacientes ?? []) // ✅ extrae el array real
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

        }).subscribe(({ productos, pacientes, usuario, tasas }) => {
            this.productos = productos;
            this.pacientes = pacientes;
            this.tasaDolar = tasas.dolar;
            this.tasaEuro = tasas.euro;
            this.todosLosPacientes = pacientes;
            this.pacientesFiltradosPorSede = pacientes;

            this.sedeActiva = usuario?.sede?.trim().toLowerCase() ?? '';
            this.productosFiltradosPorSede = productos.filter(p => p.sede === this.sedeActiva);

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


    agregarProducto(producto: Producto): void {
        const yaExiste = this.venta.productos.find(p => p.id === producto.id);
        if (yaExiste) {
            yaExiste.cantidad = (yaExiste.cantidad ?? 1) + 1;
        } else {
            this.venta.productos.push({
                id: producto.id,
                nombre: producto.nombre,
                precio: producto.precio,
                moneda: this.venta.moneda,
                cantidad: 1
            });
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

    get subtotal(): number {
        return this.venta.productos.reduce((acc, p) => acc + (p.precio * (p.cantidad ?? 1)), 0);
    }

    get totalConImpuesto(): number {
        const iva = this.venta.impuesto ?? 16;
        return this.subtotal * (1 + iva / 100);
    }

    get totalConDescuento(): number {
        const descuento = this.venta.descuento ?? 0;
        return this.totalConImpuesto * (1 - descuento / 100);
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

    agregarProductoPorSeleccion(producto: Producto): void {
        console.log('producto recibido:', producto);

        const yaExiste = this.venta.productos.some(p => p.id === producto.id);
        if (yaExiste) {
            this.swalService.showInfo('Producto ya agregado', 'Este producto ya está en el carrito.');
            return;
        }

        this.agregarProducto(producto);
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
            moneda: 'bs',
            formaPago: '',
            impuesto: 16,
            descuento: undefined,
            observaciones: ''
        };
        this.historiaMedica = null;
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

}