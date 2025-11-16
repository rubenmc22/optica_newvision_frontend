import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Producto, MonedaVisual } from '../producto.model';
import { Sede } from '../../../view/login/login-interface';
import { ProductoService } from '../producto.service';
import { TasaCambiariaService } from '../../../core/services/tasaCambiaria/tasaCambiaria.service';
import { SwalService } from '../../../core/services/swal/swal.service';
import { Observable, of, forkJoin } from 'rxjs';
import { switchMap, take, catchError } from 'rxjs/operators';
import { LoaderService } from './../../../shared/loader/loader.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UserStateService } from '../../../core/services/userState/user-state-service';
import { ProductoConversionService } from './producto-conversion.service';
import { SystemConfigService } from '../../system-config/system-config.service';

@Component({
    selector: 'app-productos-list',
    standalone: false,
    templateUrl: './productos-list.component.html',
    styleUrls: ['./productos-list.component.scss']
})
export class ProductosListComponent implements OnInit, OnDestroy {
    @Output() onCerrar = new EventEmitter<void>();

    // CONSTANTES
    readonly PRODUCTOS_POR_PAGINA = 12;
    readonly RANGO_PAGINACION = 3;
    readonly IVA = 0.16;
    precioInputTemporal: string = '';
    estaEditandoPrecio: boolean = false;

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
    ordenarPorStockActivo: boolean = false;
    ordenStockAscendente: boolean = true;

    // CATÁLOGO
    categoriasProducto: string[] = ['Monturas', 'Lentes', 'Líquidos', 'Estuches', 'Misceláneos', 'Lentes de contacto'];
    moneda: MonedaVisual[] = [];

    // MODAL
    avatarPreview: string | null = null;
    user: any = { ruta_imagen: '' };
    esSoloLectura: boolean = false;
    producto: any = {};
    productoOriginal: Producto | undefined | null;
    imagenSeleccionada: File | null = null;

    // TASAS DE CAMBIO
    tasasActuales = { usd: 0, eur: 0 };

    // SUSCRIPCIONES
    private configSubscription: any;
    private tasasSubscription: any;

    // MONEDA DEL SISTEMA
    monedaSistema: string = 'USD';
    simboloMonedaSistema: string = '$';

    constructor(
        private productoService: ProductoService,
        private tasaCambiariaService: TasaCambiariaService,
        private productoConversionService: ProductoConversionService,
        private systemConfigService: SystemConfigService,
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
        this.suscribirCambiosConfiguracion();
        this.productoOriginal = { ...this.producto };
    }

    ngOnDestroy(): void {
        if (this.configSubscription) {
            this.configSubscription.unsubscribe();
        }
        if (this.tasasSubscription) {
            this.tasasSubscription.unsubscribe();
        }
    }

    private suscribirCambiosConfiguracion(): void {
        this.configSubscription = this.systemConfigService.config$.subscribe(config => {
            this.monedaSistema = config.monedaPrincipal;
            this.simboloMonedaSistema = config.simboloMoneda;
            this.actualizarProductosPorCambioMoneda();
        });

        this.tasasSubscription = this.systemConfigService.getTasasActuales().subscribe(tasas => {
            this.tasasActuales = tasas;
            this.actualizarConversionesProductos();
        });
    }

    private cargarDatosIniciales(): void {
        this.iniciarCarga();
        this.tareaIniciada();
        this.obtenerConfiguracionSistema();
        this.cargarProductosYSedes();
    }

    private obtenerConfiguracionSistema(): void {
        this.monedaSistema = this.systemConfigService.getMonedaPrincipal();
        this.simboloMonedaSistema = this.systemConfigService.getSimboloMonedaPrincipal();
    }

    // =========== GESTIÓN DE DATOS ===========
    private cargarProductosYSedes(): void {
        this.iniciarCarga();
        this.tareaIniciada();

        forkJoin({
            productosResponse: this.productoService.getProductos().pipe(take(1)),
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
        }).subscribe(({ productosResponse, sedes, user }) => {
            this.productos = this.productoConversionService.convertirListaProductosAmonedaSistema(
                productosResponse.productos ?? []
            );

            this.corregirProductosInconsistentes();

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

    /**
     * Corregir productos con precios inconsistentes
     */
    private corregirProductosInconsistentes(): void {
        const productosInconsistentes = this.productos.filter(producto =>
            !producto.aplicaIva &&
            producto.precioConIva &&
            producto.precio !== producto.precioConIva
        );

        if (productosInconsistentes.length > 0) {
           // console.log('🔧 Corrigiendo productos inconsistentes:', productosInconsistentes.length);

            this.productos = this.productos.map(producto => {
                if (!producto.aplicaIva && producto.precioConIva && producto.precio !== producto.precioConIva) {
                    return {
                        ...producto,
                        precio: producto.precioConIva
                    };
                }
                return producto;
            });
        }
    }

    private actualizarProductosPorCambioMoneda(): void {
        if (this.productos.length > 0) {
            this.productos = this.productoConversionService.actualizarPreciosPorCambioMoneda(this.productos);
            this.snackBar.open(
                `✅ Precios actualizados a ${this.simboloMonedaSistema} (${this.monedaSistema})`,
                'Cerrar',
                { duration: 3000, panelClass: ['snackbar-success'] }
            );
            this.cdr.detectChanges();
        }
    }

    private actualizarConversionesProductos(): void {
        if (this.productos.length > 0) {
            const productosNecesitanConversion = this.productos.filter(p =>
                this.productoConversionService.necesitaReconversion(p)
            );
            if (productosNecesitanConversion.length > 0) {
                this.productos = this.productoConversionService.actualizarPreciosPorCambioMoneda(this.productos);
            }
        }
    }

    // =========== MÉTODOS PARA PRECIOS ===========
    getPrecioParaMostrar(producto: Producto): number {
        return producto.aplicaIva ?
            (producto.precioConIva || producto.precio) :
            producto.precio;
    }

    getPrecioBs(producto: Producto): number {
        const precioParaMostrar = this.getPrecioParaMostrar(producto);
        const precioEnBs = this.systemConfigService.convertirMonto(
            precioParaMostrar,
            producto.moneda,
            'VES'
        );
        return precioEnBs;
    }

    getPrecioBaseParaReferencia(producto: Producto): number {
        return producto.aplicaIva ? producto.precio : 0;
    }

    getSimboloMoneda(monedaId: string): string {
        if (monedaId === this.monedaSistema) {
            return this.simboloMonedaSistema;
        }
        const id = this.normalizarMoneda(monedaId);
        return this.moneda.find(m => m.id === id)?.simbolo ?? '';
    }

    getSimboloMonedaActual(): string {
        return this.simboloMonedaSistema;
    }

    esMonedaBolivar(moneda: string): boolean {
        if (!moneda) return false;
        const monedaNormalizada = moneda.toLowerCase();
        return monedaNormalizada === 'bolivar' ||
            monedaNormalizada === 'ves' ||
            monedaNormalizada === 'bs' ||
            monedaNormalizada === 'bolívar';
    }

    private normalizarMoneda(moneda: string): string {
        switch (moneda?.toLowerCase()) {
            case 'usd': return 'dolar';
            case 'eur': return 'euro';
            case 'bs': return 'bolivar';
            default: return moneda?.toLowerCase() ?? 'bolivar';
        }
    }

    // =========== GESTIÓN DE MODAL ===========
    abrirModal(modo: 'agregar' | 'editar' | 'ver', producto?: Producto): void {
        const base = producto
            ? JSON.parse(JSON.stringify(producto))
            : this.crearProductoVacio();

        const productoFinal: Producto = {
            ...base,
            moneda: this.monedaSistema,
            id: base.id ?? crypto.randomUUID(),
        };

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

        const producto = this.productoConversionService.prepararNuevoProducto(this.productoSeguro);
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
            next: ({ productos }) => {
                this.productos = this.productoConversionService.convertirListaProductosAmonedaSistema(productos);
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
            next: ({ productos }) => {
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
            return this.productos;
        }
        return this.productos.filter(p => p.sede?.toLowerCase() === sede);
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

    get paginasVisibles(): number[] {
        const inicio = Math.max(this.paginaActual - this.RANGO_PAGINACION, 1);
        const fin = Math.min(inicio + this.RANGO_PAGINACION * 2, this.totalPaginas);
        return Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i);
    }

    // =========== UTILIDADES ===========
    get productoSeguro(): Producto {
        const base = this.producto ?? this.crearProductoVacio();

        return {
            ...base,
            id: base.id || crypto.randomUUID(),
            moneda: base.moneda?.toLowerCase() ?? 'bolivar',
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

        delete productoActual.imagenUrl;
        delete productoBase.imagenUrl;

        const imagenCambiada = this.imagenSeleccionada !== null;
        return JSON.stringify(productoActual) !== JSON.stringify(productoBase) || imagenCambiada;
    }

    formularioValido(): boolean {
        const camposObligatorios = [
            'nombre', 'activo', 'marca', 'categoria',
            'material', 'stock', 'precio', 'moneda'
        ];

        const valido = camposObligatorios.every(campo => {
            const valor = this.producto?.[campo];
            if (typeof valor === 'boolean') return true;
            if (typeof valor === 'number') return valor >= 0;
            return valor !== undefined && valor !== null && `${valor}`.trim().length > 0;
        });

        if (this.producto.aplicaIva) {
            return valido && (this.producto.precioConIva !== undefined && this.producto.precioConIva >= 0);
        }

        return valido;
    }

    botonGuardarDeshabilitado(): boolean {
        if (this.cargando) return true;
        if (this.modoModal === 'editar') {
            return !this.formularioModificado() || !this.formularioValido();
        }
        return !this.formularioValido();
    }

    actualizarPacientesPorSede(): void {
        const sedeId = this.sedeFiltro?.trim().toLowerCase();
        this.productosFiltradosPorSede = !sedeId
            ? [...this.productos]
            : this.productos.filter(p => p.sede === sedeId);
    }

    onImageError(event: Event): void {
        const imgElement = event.target as HTMLImageElement;
        imgElement.src = 'assets/avatar-placeholder.avif';
    }

    onToggleIva(): void {
        if (!this.producto.aplicaIva) {
            this.producto.precioConIva = undefined;
        } else {
            if (this.producto.precio && this.producto.precio > 0) {
                this.producto.precioConIva = Number((this.producto.precio * (1 + this.IVA)).toFixed(2));
            } else {
                this.producto.precioConIva = 0;
            }
        }
        this.onPrecioBlur();
    }

    // =========== MANEJO DE PRECIO MEJORADO ===========
    getPrecioDisplay(): string {
        if (this.estaEditandoPrecio && this.precioInputTemporal !== '') {
            return this.precioInputTemporal;
        }

        const precio = this.producto.aplicaIva ? this.producto.precioConIva : this.producto.precio;
        if (!precio || precio === 0) {
            return '';
        }

        return precio.toFixed(2).replace(',', '.'); 
    }

    onPrecioFocus(): void {
        this.estaEditandoPrecio = true;
        const precioActual = this.producto.aplicaIva ? this.producto.precioConIva : this.producto.precio;

        if (precioActual === 0 || !precioActual) {
            this.precioInputTemporal = '';
        } else {
            const valorFormateado = precioActual.toFixed(2).replace(',', '.');
            if (valorFormateado.endsWith('.00')) {
                this.precioInputTemporal = valorFormateado.replace('.00', '');
            } else {
                this.precioInputTemporal = valorFormateado;
            }
        }
    }

    onPrecioInput(event: Event): void {
        const input = event.target as HTMLInputElement;
        let valor = input.value;

        valor = valor.replace(/[^\d.,]/g, '');
        valor = valor.replace(',', '.');

        const partes = valor.split('.');
        if (partes.length > 2) {
            valor = partes[0] + '.' + partes.slice(1).join('');
        }

        if (partes.length === 2 && partes[1].length > 2) {
            valor = partes[0] + '.' + partes[1].substring(0, 2);
        }

        this.precioInputTemporal = valor;

        if (valor === '' || valor === '.') {
            this.actualizarPrecioModelo(0);
        } else {
            const numero = parseFloat(valor) || 0;
            this.actualizarPrecioModelo(numero);
        }
    }

    onPrecioBlur(): void {
        this.estaEditandoPrecio = false;
        let precio = this.producto.aplicaIva ? this.producto.precioConIva : this.producto.precio;

        if (precio === null || precio === undefined || isNaN(precio)) {
            precio = 0;
        }

        precio = Number(parseFloat(precio.toString()).toFixed(2));
        this.actualizarPrecioModelo(precio);
        this.precioInputTemporal = '';
    }

    private actualizarPrecioModelo(valor: number): void {
        if (this.producto.aplicaIva) {
            this.producto.precioConIva = valor;
        } else {
            this.producto.precio = valor;
        }
    }

    sincronizarPrecio(): void {
        if (this.producto.aplicaIva && this.producto.precio) {
            this.producto.precioConIva = Number((this.producto.precio * (1 + this.IVA)).toFixed(2));
        } else if (!this.producto.aplicaIva) {
            this.producto.precioConIva = undefined;
        }
        this.estaEditandoPrecio = false;
        this.precioInputTemporal = '';
        this.onPrecioBlur();
    }

    formatearPrecio(): void {
        this.onPrecioBlur();
    }

    calcularPrecioSinIva(): void {
        if (this.producto.precioConIva && this.producto.precioConIva > 0) {
            this.producto.precio = Number((this.producto.precioConIva / (1 + this.IVA)).toFixed(2));
        }
        this.onPrecioBlur();
    }

    soloNumerosStock(event: Event): void {
        const input = event.target as HTMLInputElement;
        input.value = input.value.replace(/[^0-9]/g, '');

        if (input.value && !isNaN(Number(input.value))) {
            this.producto.stock = Number(input.value);
        } else {
            this.producto.stock = 0;
        }
    }

    formatearStock(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.value || input.value === '') {
            this.producto.stock = 0;
            input.value = '0';
        }
    }

    // =========== CARGA ===========
    cargarPagina(pagina: number): void {
        this.paginaActual = pagina;
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
            setTimeout(() => this.loader.hide(), 300);
            this.dataIsReady = true;
        }
    }
}