import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { Producto, ProductoDto, MonedaVisual } from '../producto.model';
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
    readonly IVA = 0.16;

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
    moneda: MonedaVisual[] = [];

    //MODAL
    avatarPreview: string | null = null;
    user: any = { ruta_imagen: '' };
    esSoloLectura: boolean = false;
    producto: any = {};
    productoOriginal: Producto | undefined | null;
    imagenSeleccionada: File | null = null;

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
                take(1)
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
                const monedasVisuales: MonedaVisual[] = res.tasas.map(t => ({
                    id: t.id?.toLowerCase() ?? '',
                    alias: t.id === 'dolar' ? 'USD' : t.id === 'euro' ? 'EUR' : 'Bs',
                    simbolo: t.simbolo?.trim() ?? '',
                    nombre: t.nombre?.trim() ?? '',
                    valor: t.valor ?? 0
                }));

                // Guardar tasas específicas si las necesitas
                this.tasaDolar = monedasVisuales.find(m => m.id === 'dolar')?.valor ?? 0;
                this.tasaEuro = monedasVisuales.find(m => m.id === 'euro')?.valor ?? 0;

                // Guardar lista completa para el ng-select
                this.moneda = monedasVisuales;
            },
            error: () => {
                this.tasaDolar = 0;
                this.tasaEuro = 0;
                this.moneda = [
                    { id: 'dolar', alias: 'USD', simbolo: '$', nombre: 'Dólar', valor: 0 },
                    { id: 'euro', alias: 'EUR', simbolo: '€', nombre: 'Euro', valor: 0 },
                    { id: 'bolivar', alias: 'Bs', simbolo: 'Bs', nombre: 'Bolívar', valor: 1 }
                ];
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
        // Clonado profundo para evitar referencias compartidas
        const base = producto
            ? JSON.parse(JSON.stringify(producto))
            : this.crearProductoVacio();

        // Normalización defensiva de moneda
        const monedaNormalizada = this.normalizarMoneda(base.moneda);
        const productoFinal: Producto = {
            ...base,
            moneda: monedaNormalizada,
            id: base.id ?? crypto.randomUUID(), // ← blindaje obligatorio
        };

        // Asignación de estado visual y funcional
        this.producto = { ...productoFinal };
        this.productoOriginal = modo === 'editar' ? { ...productoFinal } : null;
        this.productoSeleccionado = modo === 'editar' ? { ...productoFinal } : undefined;
        this.modoModal = modo;
        this.esSoloLectura = modo === 'ver';
        this.mostrarModal = true;
        this.avatarPreview = '';
        this.imagenSeleccionada = null;


        setTimeout(() => {
            this.cdr.detectChanges?.();
        });

        document.body.classList.add('modal-open');
    }

    cerrarModal(): void {
        this.mostrarModal = false;
        this.producto = null;
        this.productoOriginal = null;
        this.productoSeleccionado = undefined;
        this.avatarPreview = '';
        this.imagenSeleccionada = null;
        this.cargando = false;
        document.body.classList.remove('modal-open');
    }

    guardarProducto(): void {
        if (this.modoModal === 'agregar') {
            this.agregarProductoFlow();
        } else {
            this.editarProductoFlow();
        }
    }

    private agregarProductoFlow(): void {
        if (this.cargando) return;
        this.cargando = true;

        const producto = this.productoSeguro;
        const formData = new FormData();

        formData.append('nombre', producto.nombre);
        formData.append('marca', producto.marca);
        formData.append('modelo', producto.modelo ?? '');
        formData.append('color', producto.color ?? '');
        formData.append('material', producto.material ?? '');
        formData.append('proveedor', producto.proveedor);
        formData.append('categoria', producto.categoria);
        formData.append('stock', producto.stock.toString());
        formData.append('moneda', producto.moneda);
        formData.append('activo', producto.activo ? 'true' : 'false');
        formData.append('descripcion', producto.descripcion ?? '');
        formData.append('fechaIngreso', producto.fechaIngreso);

        // ✅ IVA logic simplificada
        formData.append('aplicaIva', producto.aplicaIva.toString());

        if (producto.aplicaIva) {
            producto.precio = producto.precioConIva ?? producto.precio;
        }

        formData.append('precio', producto.precio.toString());

        if (this.imagenSeleccionada) {
            formData.append('imagen', this.imagenSeleccionada);
        }

        this.productoService.agregarProductoFormData(formData).pipe(
            switchMap(() => {
                this.swalService.showSuccess('¡Registro exitoso!', 'Producto agregado correctamente');
                return this.productoService.getProductos();
            })
        ).subscribe({
            next: (productos) => {
                this.productos = productos;
                this.cargando = false;
                this.cerrarModal();
            },
            error: (error) => {
                this.cargando = false;
                this.manejarErrorOperacion(error, 'agregar');
            }
        });
    }

    private editarProductoFlow(): void {
        if (this.cargando) return;
        this.cargando = true;

        const producto = this.productoSeguro;
        const formData = new FormData();

        formData.append('nombre', producto.nombre ?? '');
        formData.append('marca', producto.marca ?? '');
        formData.append('modelo', producto.modelo ?? '');
        formData.append('color', producto.color ?? '');
        formData.append('material', producto.material ?? '');
        formData.append('proveedor', producto.proveedor ?? '');
        formData.append('categoria', producto.categoria ?? '');
        formData.append('stock', producto.stock?.toString() ?? '0');
        formData.append('moneda', producto.moneda ?? '');
        formData.append('activo', producto.activo ? 'true' : 'false');
        formData.append('descripcion', producto.descripcion ?? '');
        formData.append('fechaIngreso', producto.fechaIngreso ?? '');

        // ✅ IVA logic simplificada
        formData.append('aplicaIva', producto.aplicaIva.toString());

        if (producto.aplicaIva) {
            producto.precio = producto.precioConIva ?? producto.precio;
        }

        formData.append('precio', producto.precio?.toString() ?? '0');


        if (this.imagenSeleccionada) {
            formData.append('imagen', this.imagenSeleccionada);
        }

        const id = this.productoSeleccionado?.id;
        if (!id) {
            this.swalService.showError('Error', 'No se encontró el ID del producto para editar.');
            this.cargando = false;
            return;
        }

        this.productoService.editarProducto(formData, id).pipe(
            switchMap(() => {
                this.swalService.showSuccess('¡Actualización exitosa!', 'Producto actualizado correctamente');
                return this.productoService.getProductos();
            })
        ).subscribe({
            next: (productos) => {
                this.productos = productos;
                this.cargando = false;
                this.cerrarModal();
            },
            error: (error) => {
                this.cargando = false;
                this.manejarErrorOperacion(error, 'editar');
            }
        });
    }

    private manejarErrorOperacion(error: any, operacion: 'agregar' | 'editar'): void {
        const msg = error.error?.message ?? '';
        console.error('Error en operación:', error);

        if (msg.includes('Ya existe un producto con el mismo nombre')) {
            this.swalService.showWarning(
                'Duplicado',
                'Ya existe un producto con este nombre. Cambia el nombre e intenta nuevamente.'
            );
        } else {
            const titulo = operacion === 'agregar' ? 'No se pudo agregar el producto' : 'No se pudo actualizar el producto';
            const detalle = msg.length > 0 ? msg : 'Ocurrió un error inesperado.';

            this.swalService.showError(titulo, detalle);
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
            const marca = p.marca?.toLowerCase() ?? '';
            const modelo = p.modelo?.toLowerCase() ?? '';
            const proveedor = p.proveedor?.toLowerCase() ?? '';
            const material = p.material?.toLowerCase() ?? '';
            const color = p.color?.toLowerCase() ?? '';
            const sedeProducto = p.sede?.toLowerCase() ?? '';
            const activo = p.activo;

            const coincideTexto =
                nombre.includes(texto) ||
                codigo.includes(texto) ||
                marca.includes(texto) ||
                modelo.includes(texto) ||
                proveedor.includes(texto) ||
                material.includes(texto) ||
                color.includes(texto);

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

    get productosVisualizados(): Producto[] {
        const sede = this.sedeFiltro?.trim().toLowerCase();
        if (!sede || sede === 'todas') {
            return this.productos; // ← mostrar todos los productos
        }
        return this.productos.filter(p => p.sede?.toLowerCase() === sede);
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
        const base = this.producto ?? this.crearProductoVacio();
        console.log('BASE', base);
        return {
            ...base,
            id: base.id || crypto.randomUUID(),
            moneda: base.moneda?.toLowerCase() ?? 'bolivar', // ya es el id del backend
            fechaIngreso: base.fechaIngreso || new Date().toISOString().split('T')[0],
            imagenUrl: this.avatarPreview || base.imagenUrl || ''
        };
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
            modelo: '',
            proveedor: '',
            categoria: null as any,
            stock: 0,
            aplicaIva: false,
            precio: 0,
            precioConIva: 0,
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

    private normalizarMoneda(moneda: string): string {
        switch (moneda?.toLowerCase()) {
            case 'usd': return 'dolar';
            case 'eur': return 'euro';
            case 'ves': return 'bolivar';
            default: return moneda?.toLowerCase() ?? 'bolivar';
        }
    }

    esMonedaBolivar(moneda: string): boolean {
        return this.normalizarMoneda(moneda) === 'bolivar';
    }

    getPrecioBs(producto: Producto): number {
        const monedaId = this.normalizarMoneda(producto.moneda);
        const tasa = this.moneda.find(m => m.id === monedaId)?.valor ?? 1;
        return producto.precio * tasa;
    }

    getSimboloMoneda(monedaId: string): string {
        const id = this.normalizarMoneda(monedaId);
        return this.moneda.find(m => m.id === id)?.simbolo ?? '';
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
            this.imagenSeleccionada = input.files[0];

            const reader = new FileReader();
            reader.onload = () => {
                this.avatarPreview = reader.result as string;
            };
            reader.readAsDataURL(this.imagenSeleccionada);
        }
    }

    formularioModificado(): boolean {
        if (!this.productoOriginal || !this.producto) return false;

        const productoActual = { ...this.producto };
        const productoBase = { ...this.productoOriginal };

        // Ignorar campos que no afectan la lógica visual
        delete productoActual.imagenUrl;
        delete productoBase.imagenUrl;

        const imagenCambiada = this.imagenSeleccionada !== null;
        const modificado = JSON.stringify(productoActual) !== JSON.stringify(productoBase) || imagenCambiada;
        console.log('¿Formulario modificado?', modificado);

        return JSON.stringify(productoActual) !== JSON.stringify(productoBase) || imagenCambiada;
    }


    formularioValido(): boolean {
        const camposObligatorios = [
            'nombre', 'activo', 'marca', 'categoria',
            'material', 'stock', 'precio', 'moneda'
        ];

        return camposObligatorios.every(campo => {
            const valor = this.producto?.[campo];

            if (typeof valor === 'boolean') return true;
            if (typeof valor === 'number') return valor >= 0;
            return valor !== undefined && valor !== null && `${valor}`.trim().length > 0;
        });
    }

    botonGuardarDeshabilitado(): boolean {
        console.log('Evaluando estado del botón');
        if (this.cargando) return true;

        console.log('Evaluando estado del botón 2');
        if (this.modoModal === 'editar') {
            return !this.formularioModificado() || !this.formularioValido();
        }

        return !this.formularioValido();
    }

    limpiarSiCero(campo: 'stock' | 'precio'): void {
        if (this.producto[campo] === 0) {
            this.producto[campo] = null;
        }
    }

    limpiarCeroInicial(event: Event, campo: 'stock' | 'precio'): void {
        const input = event.target as HTMLInputElement;
        const valor = input.value;

        // Si empieza con 0 y tiene más dígitos, lo limpiamos
        if (/^0\d+/.test(valor)) {
            const limpio = valor.replace(/^0+/, '');
            this.producto[campo] = Number(limpio);
        }
    }

    restaurarCeroSiVacio(campo: 'stock' | 'precio'): void {
        const valor = this.producto[campo];
        if (valor === null || valor === undefined || valor === '') {
            this.producto[campo] = 0;
        }
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

    onToggleIva(): void {
        if (!this.producto.aplicaIva) {
            this.producto.precioConIva = undefined;
        } else {
            this.calcularPrecioSinIva();
        }
    }

    calcularPrecioSinIva(): void {
        const conIva = this.producto.precioConIva ?? 0;
        this.producto.precio = +(conIva / (1 + this.IVA)).toFixed(2);
    }

    sincronizarPrecio(): void {
        if (this.producto.aplicaIva) {
            this.producto.precioConIva = this.producto.precio;
        } else {
            this.producto.precio = this.producto.precioConIva;
        }
    }
}