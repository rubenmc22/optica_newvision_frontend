import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { Producto, ProductoDto } from '../producto.model';
import { Sede } from '../../../view/login/login-interface';
import { ProductoService } from '../producto.service';
import { TasaCambiariaService } from '../../../core/services/tasaCambiaria/tasaCambiaria.service';
import { Tasa } from '../../../Interfaces/models-interface';
import { SwalService } from '../../../core/services/swal/swal.service';
import { Observable, of, forkJoin, map } from 'rxjs';
import { switchMap, take, catchError } from 'rxjs/operators';
import { LoaderService } from './../../../shared/loader/loader.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UserStateService } from '../../../core/services/userState/user-state-service';



@Component({
    selector: 'app-productos-list',
    standalone: false,
    templateUrl: './productos-list.component.html',
    styleUrls: ['./productos-list.component.scss']
})

export class ProductosListComponent implements OnInit {
    @Output() onCerrar = new EventEmitter<void>();

    // CONSTANTES
    private readonly PRODUCTOS_POR_PAGINA = 12;
    private readonly RANGO_PAGINACION = 3;

    // ESTADO DEL COMPONENTE
    productos: Producto[] = [];
    mostrarModal: boolean = false;
    modoModal: 'agregar' | 'editar' | 'ver' = 'agregar';
    productoSeleccionado?: Producto;
    paginaActual = 1;
    cargando: boolean = false;
    productosFiltradosPorSede: Producto[] = [];
    sedesDisponibles: Sede[] = [];
    tareasPendientes = 0;
    dataIsReady = false;

    // FILTROS
    filtroBusqueda = '';
    tipoSeleccionado = '';
    estadoSeleccionado: boolean = true;
    sedeActiva: string = '';
    sedeFiltro: string = this.sedeActiva;
    filtro: string = '';
    categoriaAbierto = false;
    ordenarPorStockActivo: boolean = false;
    ordenStockAscendente: boolean = true;


    // CATÁLOGO
    categoriasProducto: string[] = ['Monturas', 'Lentes', 'Líquidos', 'Estuches', 'Misceláneos', 'Lentes de contacto'];
    moneda: string[] = [];
    imagenesPorTipo: Record<Producto['categoria'], string> = {
        lente: 'assets/cristales.jpg',
        montura: 'assets/montura_2.avif',
        estuche: 'assets/estuches.jpg',
        liquido: 'assets/liquido.webp',
        accesorio: 'assets/accesorios.jpg',
    };

    //MODAL
    avatarPreview: string | null = null;
    user: any = { ruta_imagen: '' };
    esSoloLectura: boolean = false;
    producto: any = {};
    productoOriginal: any;

    // TASAS DE CAMBIO
    tasaDolar = 0;
    tasaEuro = 0;

    constructor(
        private productoService: ProductoService,
        private tasaCambiariaService: TasaCambiariaService,
        //    private fb: FormBuilder,
        private swalService: SwalService,
        private userStateService: UserStateService,
        private snackBar: MatSnackBar,
        private authService: AuthService,
        private cdr: ChangeDetectorRef,
        private loader: LoaderService
    ) { }

    // =========== LIFECYCLE HOOKS ===========
    ngOnInit(): void {
        this.cargarDatosIniciales();
        this.productoOriginal = { ...this.producto };
    }

    private cargarDatosIniciales(): void {
        this.iniciarCarga();
        this.tareaIniciada();
        this.obtenerTasasCambio();
        this.cargarProductosYSedes(); // delega la lógica
    }

    // =========== GESTIÓN DE DATOS ===========
    private cargarProductosYSedes(): void {
        this.iniciarCarga();
        this.tareaIniciada();

        forkJoin({
            productos: this.productoService.getProductos().pipe(
                take(1),
                catchError(error => {
                    console.error('Error al cargar productos:', error);
                    this.snackBar.open('⚠️ No se pudo cargar el catálogo de productos.', 'Cerrar', {
                        duration: 5000,
                        panelClass: ['snackbar-error']
                    });
                    return of([]); // ← aquí está el cambio
                })
            ),
            sedes: this.authService.getSedes().pipe(
                take(1),
                catchError(error => {
                    console.error('Error al cargar sedes:', error);
                    this.snackBar.open('⚠️ No se pudieron cargar las sedes disponibles.', 'Cerrar', {
                        duration: 5000,
                        panelClass: ['snackbar-warning']
                    });
                    return of({ sedes: [] });
                })
            ),
            user: this.userStateService.currentUser$.pipe(
                take(1),
                catchError(error => {
                    console.error('Error al cargar usuario:', error);
                    this.snackBar.open('⚠️ Error al cargar su información de usuario.', 'Cerrar', {
                        duration: 5000,
                        panelClass: ['snackbar-error']
                    });
                    return of(null);
                })
            )
        }).subscribe(({ productos, sedes, user }) => {
            this.productos = productos;
            this.ordenarPorStock();

            this.sedesDisponibles = (sedes.sedes ?? [])
                .map(s => ({
                    ...s,
                    key: s.key?.trim().toLowerCase() || '',
                    nombre: s.nombre?.trim() || ''
                }))
                .sort((a, b) =>
                    a.nombre.replace(/^sede\s+/i, '').localeCompare(
                        b.nombre.replace(/^sede\s+/i, ''),
                        'es',
                        { sensitivity: 'base' }
                    )
                );

            const sedeUsuario = (user?.sede ?? '').trim().toLowerCase();
            const sedeValida = this.sedesDisponibles.some(s => s.key === sedeUsuario);

            this.sedeActiva = sedeValida ? sedeUsuario : '';
            this.sedeFiltro = this.sedeActiva;

            this.tareaFinalizada();
        });


    }

    private obtenerTasasCambio(): void {
        this.tasaCambiariaService.getTasaActual().subscribe({
            next: (res: { tasas: Tasa[] }) => {
                // Guardar valores de referencia
                this.tasaDolar = res.tasas.find(t => t.id === 'dolar')?.valor ?? 0;
                this.tasaEuro = res.tasas.find(t => t.id === 'euro')?.valor ?? 0;

                // Mapa de conversión fijo
                const idToCode: Record<string, string> = {
                    dolar: 'USD',
                    euro: 'EUR'
                };

                // Construir lista base desde servicio
                const monedasServicio = res.tasas.map(t => {
                    const id = t.id?.toLowerCase() ?? '';
                    return idToCode[id] || t.nombre?.trim().toUpperCase() || id.toUpperCase();
                });

                // Eliminar duplicados + vacíos
                const unicas = Array.from(new Set(monedasServicio.filter(m => m)));

                // Forzar que VES esté siempre de último
                this.moneda = [...unicas.filter(m => m !== 'VES'), 'VES'];
            },
            error: () => {
                // Fallback seguro
                this.tasaDolar = 0;
                this.tasaEuro = 0;
                this.moneda = ['USD', 'EUR', 'VES'];
            }
        });
    }

    cargarPagina(pagina: number): void {
        this.paginaActual = pagina;
        this.productoService.getProductosPorPagina(pagina, this.PRODUCTOS_POR_PAGINA)
            .subscribe(res => {
                this.productos = this.actualizarEstadoPorStock(res);
            });
    }

    private iniciarCarga(): void {
        this.tareasPendientes = 0;
        this.loader.show();
    }

    private tareaIniciada(): void {
        this.tareasPendientes++;
        this.dataIsReady = false;
    }

    private tareaFinalizada(): void {

        this.tareasPendientes--;
        if (this.tareasPendientes <= 0) {
            setTimeout(() => this.loader.hide(), 300); // Delay visual
            this.dataIsReady = true;
        }
    }

    // =========== GESTIÓN DE MODAL ===========
    abrirModal(modo: 'agregar' | 'editar' | 'ver', producto?: Producto): void {
        this.modoModal = modo;
        const base = producto ?? this.crearProductoVacio();
        this.productoSeleccionado = base;
        this.producto = { ...base };
        this.esSoloLectura = (modo === 'ver');
        this.mostrarModal = true;
        document.body.classList.add('modal-open');
    }

    cerrarModal(): void {
        this.mostrarModal = false;
        this.productoSeleccionado = undefined;
        document.body.classList.remove('modal-open'); // restaura scroll
    }

    guardarProducto(): void {
        if (this.producto?.moneda) {
            this.producto.moneda = this.producto.moneda.toLowerCase();
        }

        if (this.modoModal === 'agregar') {
            this.agregarProductoFlow();
        } else {
            this.editarProductoFlow();
        }
    }

    private agregarProductoFlow(): void {
        const producto = this.productoSeguro;
        this.cargando = true;

        this.productoService.agregarProducto(producto)
            .pipe(
                switchMap(() => {
                    this.swalService.showSuccess(
                        '¡Registro exitoso!',
                        'Producto agregado correctamente'
                    );
                    return this.productoService.getProductos();
                }),
                catchError((error) => {
                    this.cargando = false;
                    this.manejarErrorOperacion(error, 'agregar');
                    return of<Producto[]>([]);
                })
            )
            .subscribe(productos => {
                this.productos = productos;
                this.cerrarModal();
            });

    }

    private editarProductoFlow(): void {
        const producto = this.productoSeguro;

        this.productoService.editarProducto(producto)
            .pipe(
                switchMap(() => {
                    this.swalService.showSuccess('¡Actualización exitosa!', 'Producto actualizado correctamente');
                    return this.productoService.getProductos();
                }),
                catchError((error) => {
                    this.manejarErrorOperacion(error, 'editar');
                    return of([]);
                })
            )
            .subscribe((productos) => {
                if (productos.length) {
                    this.productos = productos;
                    this.cerrarModal();
                }
            });
    }

    private manejarErrorOperacion(error: any, operacion: 'agregar' | 'editar'): void {
        const msg = error.error?.message ?? '';

        if (msg.includes('Ya existe un producto con el mismo nombre')) {
            this.swalService.showWarning(
                'Duplicado',
                'Ya existe un producto con este nombre. Cambia el nombre e intenta nuevamente.'
            );
        } else {
            this.swalService.showError(
                'Error',
                operacion === 'agregar'
                    ? 'No se pudo agregar el producto'
                    : 'No se pudo actualizar el producto'
            );
        }
    }

    // =========== FILTRADO Y BÚSQUEDA ===========
    limpiarFiltros(): void {
        this.filtroBusqueda = '';
        this.tipoSeleccionado = '';
        this.estadoSeleccionado = true;
    }

    get productosFiltrados(): Producto[] {
        const texto = this.filtroBusqueda?.trim().toLowerCase() ?? '';
        const tipo = this.tipoSeleccionado?.toLowerCase() ?? '';
        const sede = this.sedeFiltro?.trim().toLowerCase() ?? '';
        const estado = this.estadoSeleccionado;

        const productosValidos = Array.isArray(this.productos) ? this.productos : [];

        const filtrados = productosValidos.filter(p => {
            const nombre = p.nombre?.toLowerCase() ?? '';
            const codigo = p.codigo?.toLowerCase() ?? '';
            const categoria = p.categoria?.toLowerCase() ?? '';
            const sedeProducto = p.sede?.toLowerCase() ?? '';
            const activo = p.activo;

            const coincideTexto = nombre.includes(texto) || codigo.includes(texto);
            const coincideTipo = !tipo || categoria === tipo;
            const coincideEstado = estado === null || activo === estado;
            const coincideSede = !sede || sedeProducto === sede;

            return coincideTexto && coincideTipo && coincideEstado && coincideSede;
        });

        if (this.ordenarPorStockActivo) {
            return [...filtrados].sort((a, b) => {
                const stockA = a.stock ?? 0;
                const stockB = b.stock ?? 0;
                return this.ordenStockAscendente ? stockA - stockB : stockB - stockA;
            });
        }

        return filtrados;
    }

    ngOnChanges() {
        if (this.mostrarModal) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
    }

    ordenarPorStock(): void {
        this.ordenarPorStockActivo = true;
        this.ordenStockAscendente = !this.ordenStockAscendente;
        this.paginaActual = 1;
    }


    // =========== PAGINACIÓN ===========
    get productosPaginados(): Producto[] {
        const inicio = (this.paginaActual - 1) * this.PRODUCTOS_POR_PAGINA;
        return this.productosFiltrados.slice(inicio, inicio + this.PRODUCTOS_POR_PAGINA);
    }

    get totalPaginas(): number {
        return Math.ceil(this.productosFiltrados.length / this.PRODUCTOS_POR_PAGINA);
    }

    get paginas(): number[] {
        return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
    }

    get paginasVisibles(): number[] {
        const inicio = Math.max(this.paginaActual - this.RANGO_PAGINACION, 1);
        const fin = Math.min(inicio + this.RANGO_PAGINACION * 2, this.totalPaginas);
        return Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i);
    }

    // =========== UTILIDADES ===========
    get productoSeguro(): Producto {
        return this.productoSeleccionado ?? this.crearProductoVacio();
    }

    private crearProductoVacio(): Producto {
        return {
            id: crypto.randomUUID(),
            sede: '',
            nombre: '',
            marca: '',
            color: '',
            codigo: '',
            material: '',
            proveedor: '',
            categoria: null as any,
            stock: 0,
            precio: 0,
            moneda: null as any,
            activo: true,
            descripcion: '',
            imagenUrl: '',
            fechaIngreso: new Date().toISOString().split('T')[0]
        };
    }

    actualizarEstadoPorStock(productos: Producto[]): Producto[] {
        return productos.map(p => p.stock === 0 ? { ...p, activo: false } : p);
    }

    getPrecioBs(producto: Producto): number {
        switch (producto.moneda) {
            case 'usd': return producto.precio * this.tasaDolar;
            case 'eur': return producto.precio * this.tasaEuro;
            case 'ves': return producto.precio;
            default: return 0;
        }
    }

    getSimboloMoneda(moneda: string): string {
        switch (moneda) {
            case 'usd': return '$';
            case 'eur': return '€';
            case 'ves': return 'Bs';
            default: return moneda.toUpperCase();
        }
    }


    obtenerImagen(categoria: string): string {
        // Mapa local para las categorías más comunes
        const imagenes: Record<string, string> = {
            montura: 'assets/montura_2.avif',
            lente: 'assets/montura_1.png',
            liquido: 'assets/montura_3.jpg',
            estuche: 'assets/montura_1.png',
            accesorio: 'assets/montura_2.avif'
        };

        // Normalizamos a minúsculas para evitar problemas de casing
        const clave = categoria?.toLowerCase() ?? '';

        return imagenes[clave] || 'assets/default.jpg';
    }

    getProfileImage(): string {
        return this.avatarPreview || this.producto?.imagenUrl || 'assets/avatar-placeholder.avif';
    }

    handleImageError(event: Event): void {
        const img = event.target as HTMLImageElement;
        img.src = 'assets/avatar-placeholder.avif';
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;

        if (input.files && input.files[0]) {
            const file = input.files[0];

            const reader = new FileReader();
            reader.onload = () => {
                this.avatarPreview = reader.result as string;
                // Si estás cargando el archivo al backend, aquí podrías disparar la carga
            };
            reader.readAsDataURL(file);
        }
    }

    formularioModificado(): boolean {
        if (!this.productoOriginal || !this.producto) return false;
        return JSON.stringify(this.productoOriginal) !== JSON.stringify(this.producto);
    }

    formularioValido(): boolean {
        const camposObligatorios = [
            'codigo', 'activo', 'marca', 'categoria',
            'material', 'proveedor', 'stock', 'precio', 'moneda'
        ];

        return camposObligatorios.every(campo => {
            const valor = this.producto?.[campo];

            if (typeof valor === 'boolean') return true;
            if (typeof valor === 'number') return !isNaN(valor);
            return valor !== undefined && valor !== null && `${valor}`.trim().length > 0;
        });

    }

    actualizarPacientesPorSede(): void {
        //  this.limpiarDatos();
        const sedeId = this.sedeFiltro?.trim().toLowerCase();
        this.productosFiltradosPorSede = !sedeId
            ? [...this.productos]
            : this.productos.filter(p => p.sede === sedeId);
    }

    obtenerSedeDesdePaciente(productos: Producto): string {
        return productos?.sede?.toLowerCase() || '';
    }

    onImageError(event: Event): void {
        const imgElement = event.target as HTMLImageElement;
        imgElement.src = 'assets/avatar-placeholder.avif';
    }

}