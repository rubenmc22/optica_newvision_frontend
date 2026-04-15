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
import { normalizarClasificacionProducto, normalizarTextoClasificacion } from '../producto-classification.catalog';
import { MATERIALES, OpcionSelect, TIPOS_CRISTALES, TIPOS_LENTES_CONTACTO, TRATAMIENTOS_ADITIVOS } from '../../../shared/constants/historias-medicas';

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
    readonly STOCK_BAJO_LIMITE = 5;
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
    categoriasProducto: string[] = ['Monturas', 'Cristales', 'Filtros', 'Aditivos', 'Materiales', 'Lentes de contacto', 'Líquidos', 'Estuches', 'Accesorios'];
    moneda: MonedaVisual[] = [];
    tiposCristalesDisponibles: OpcionSelect[] = TIPOS_CRISTALES.filter(item => item.value !== 'LENTES_CONTACTO');
    tiposLentesContactoDisponibles: OpcionSelect[] = TIPOS_LENTES_CONTACTO;
    materialesDisponibles: OpcionSelect[] = MATERIALES;
    tratamientosDisponibles: OpcionSelect[] = TRATAMIENTOS_ADITIVOS;

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

    get etiquetaMonedaSistema(): string {
        return `${this.simboloMonedaSistema} ${this.monedaSistema}`;
    }

    get totalProductosRegistrados(): number {
        return this.productos.length;
    }

    get totalProductosActivos(): number {
        return this.productos.filter(producto => producto.activo).length;
    }

    get totalProductosConAlerta(): number {
        return this.productos.filter(producto =>
            this.controlaStockProducto(producto) && (producto.stock ?? 0) <= this.STOCK_BAJO_LIMITE
        ).length;
    }

    get totalProductosAgotados(): number {
        return this.productos.filter(producto =>
            this.controlaStockProducto(producto) && (producto.stock ?? 0) === 0
        ).length;
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
            case 'ves': return 'bolivar';
            default: return moneda?.toLowerCase() ?? 'bolivar';
        }
    }

    private obtenerMonedaPersistencia(producto: Producto): string {
        return producto.monedaOriginal || producto.moneda || this.monedaSistema;
    }

    private obtenerPrecioVisibleFormulario(producto: Producto): number {
        const precioVisible = producto.aplicaIva
            ? (producto.precioConIva ?? producto.precio)
            : producto.precio;

        return Number((precioVisible || 0).toFixed(2));
    }

    private obtenerPrecioParaPersistencia(producto: Producto): number {
        const monedaVisible = producto.moneda || this.monedaSistema;
        const monedaPersistencia = this.obtenerMonedaPersistencia(producto);
        const precioVisible = this.obtenerPrecioVisibleFormulario(producto);

        const precioConvertido = this.systemConfigService.convertirMonto(
            precioVisible,
            monedaVisible,
            monedaPersistencia
        );

        return Number(precioConvertido.toFixed(2));
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

        const productoPreparado = this.prepararProductoParaEdicion(productoFinal);

        this.producto = productoPreparado;
        this.productoOriginal = modo === 'editar' ? { ...productoPreparado } : null;
        this.productoSeleccionado = modo === 'editar' ? { ...productoPreparado } : undefined;
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
        const precioPersistencia = this.obtenerPrecioParaPersistencia(producto);
        const formData = new FormData();

        formData.append('nombre', producto.nombre);
        formData.append('marca', producto.marca);
        formData.append('modelo', producto.modelo ?? '');
        formData.append('color', producto.color ?? '');
        formData.append('material', producto.material ?? '');
        formData.append('proveedor', producto.proveedor);
        formData.append('categoria', producto.categoria);
        formData.append('stock', producto.stock.toString());
        formData.append('moneda', this.obtenerMonedaPersistencia(producto));
        formData.append('activo', producto.activo ? 'true' : 'false');
        formData.append('descripcion', producto.descripcion ?? '');
        formData.append('fechaIngreso', producto.fechaIngreso);
        formData.append('aplicaIva', producto.aplicaIva.toString());
        formData.append('precio', precioPersistencia.toString());
        this.appendClasificacionProductoToFormData(formData, producto);

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
                this.corregirProductosInconsistentes();
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
        const precioPersistencia = this.obtenerPrecioParaPersistencia(producto);
        const formData = new FormData();

        formData.append('nombre', producto.nombre ?? '');
        formData.append('marca', producto.marca ?? '');
        formData.append('modelo', producto.modelo ?? '');
        formData.append('color', producto.color ?? '');
        formData.append('material', producto.material ?? '');
        formData.append('proveedor', producto.proveedor ?? '');
        formData.append('categoria', producto.categoria ?? '');
        formData.append('stock', producto.stock?.toString() ?? '0');
        formData.append('moneda', this.obtenerMonedaPersistencia(producto));
        formData.append('activo', producto.activo ? 'true' : 'false');
        formData.append('descripcion', producto.descripcion ?? '');
        formData.append('fechaIngreso', producto.fechaIngreso ?? '');
        formData.append('aplicaIva', producto.aplicaIva.toString());
        formData.append('precio', precioPersistencia.toString());
        this.appendClasificacionProductoToFormData(formData, producto);

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
                this.productos = this.productoConversionService.convertirListaProductosAmonedaSistema(productos);
                this.corregirProductosInconsistentes();
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
                'Ya existe un producto con una configuracion similar. Ajusta la categoria, marca o referencia e intenta nuevamente.'
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
            const nombre = this.getNombreProductoDisplay(p).toLowerCase();
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
        const base = this.normalizarCamposSegunCategoria(this.producto ?? this.crearProductoVacio());
        const clasificacion = normalizarClasificacionProducto(base);
        const controlaStock = this.categoriaControlaStock(base.categoria);
        const stockNormalizado = controlaStock ? Math.max(Number(base.stock ?? 0), 0) : 0;
        const nombreResuelto = this.resolverNombreProducto(base);

        return {
            ...base,
            ...clasificacion,
            id: base.id || crypto.randomUUID(),
            nombre: nombreResuelto,
            stock: stockNormalizado,
            moneda: base.moneda || this.monedaSistema,
            fechaIngreso: base.fechaIngreso || new Date().toISOString().split('T')[0],
            imagenUrl: this.avatarPreview || base.imagenUrl || ''
        };
    }

    private crearProductoVacio(): Producto {
        const productoBase: Producto = {
            id: crypto.randomUUID(),
            sede: '',
            nombre: '',
            marca: '',
            color: '',
            codigo: '',
            material: '',
            modelo: '',
            proveedor: '',
            categoria: '',
            stock: 0,
            aplicaIva: false,
            precio: 0,
            precioConIva: 0,
            moneda: this.monedaSistema,
            activo: true,
            descripcion: '',
            imagenUrl: '',
            fechaIngreso: new Date().toISOString().split('T')[0]
        };

        return {
            ...productoBase,
            ...normalizarClasificacionProducto(productoBase)
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
        const camposObligatorios = ['activo', 'categoria', 'precio', 'moneda'];

        if (this.stockEsObligatorio) {
            camposObligatorios.push('stock');
        }

        if (this.marcaEsObligatoria) {
            camposObligatorios.push('marca');
        }

        if (this.usaSelectorTipoCategoria || this.mostrarCampoModeloTexto) {
            if (this.tipoCategoriaEsObligatorio) {
                camposObligatorios.push('modelo');
            }
        }

        if (this.materialEsObligatorio) {
            camposObligatorios.push('material');
        }

        const valido = camposObligatorios.every(campo => {
            const valor = this.producto?.[campo];
            if (typeof valor === 'boolean') return true;
            if (typeof valor === 'number') return valor >= 0;
            return valor !== undefined && valor !== null && `${valor}`.trim().length > 0;
        });

        if (this.producto.aplicaIva) {
            return valido
                && (this.producto.precioConIva !== undefined && this.producto.precioConIva >= 0)
                && this.validarCamposCondicionalesProducto();
        }

        return valido && this.validarCamposCondicionalesProducto();
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

    private prepararProductoParaEdicion(producto: Producto): Producto {
        return {
            ...this.normalizarCamposSegunCategoria(producto),
            ...normalizarClasificacionProducto(this.normalizarCamposSegunCategoria(producto))
        };
    }

    private appendClasificacionProductoToFormData(formData: FormData, producto: Producto): void {
        const clasificacion = normalizarClasificacionProducto(producto);
        const camposFuncionales: Record<string, string> = {
            requiere_formula: String(clasificacion.requiereFormula),
            requiere_item_padre: String(clasificacion.requiereItemPadre)
        };

        Object.entries(camposFuncionales).forEach(([clave, valor]) => {
            formData.append(clave, valor);
        });
    }

    private validarCamposCondicionalesProducto(): boolean {
        if (this.usaSelectorTipoCategoria && this.tipoCategoriaEsObligatorio) {
            const valor = this.producto?.modelo;
            if (!valor || !String(valor).trim()) {
                return false;
            }
        }

        if (this.materialEsObligatorio) {
            const valor = this.producto?.material;
            if (!valor || !String(valor).trim()) {
                return false;
            }
        }

        return true;
    }

    get categoriaProductoActual(): string {
        return normalizarTextoClasificacion(this.producto?.categoria);
    }

    get usaSelectorTipoCategoria(): boolean {
        return ['cristales', 'filtros', 'aditivos', 'lentes de contacto'].includes(this.categoriaProductoActual);
    }

    get mostrarCampoModeloTexto(): boolean {
        return !this.usaSelectorTipoCategoria && this.categoriaProductoActual !== 'materiales';
    }

    get usaSelectorMaterialCategoria(): boolean {
        return this.categoriaProductoActual === 'materiales';
    }

    get mostrarCampoMarca(): boolean {
        return !['cristales', 'filtros', 'aditivos', 'materiales'].includes(this.categoriaProductoActual);
    }

    get mostrarCampoMaterial(): boolean {
        return ['monturas', 'materiales', 'accesorios', 'estuches', 'liquidos', 'líquidos'].includes(this.categoriaProductoActual);
    }

    get mostrarCampoColor(): boolean {
        return ['monturas', 'lentes de contacto', 'accesorios'].includes(this.categoriaProductoActual);
    }

    get mostrarCampoStock(): boolean {
        return this.categoriaControlaStock(this.categoriaProductoActual);
    }

    get marcaEsObligatoria(): boolean {
        return ['monturas', 'lentes de contacto', 'liquidos', 'líquidos', 'estuches', 'accesorios'].includes(this.categoriaProductoActual);
    }

    get stockEsObligatorio(): boolean {
        return this.mostrarCampoStock;
    }

    get materialEsObligatorio(): boolean {
        return ['monturas', 'materiales'].includes(this.categoriaProductoActual);
    }

    get tipoCategoriaEsObligatorio(): boolean {
        return this.usaSelectorTipoCategoria;
    }

    get etiquetaTipoCategoria(): string {
        switch (this.categoriaProductoActual) {
            case 'cristales':
                return 'Tipo de cristal';
            case 'filtros':
                return 'Tipo de filtro';
            case 'aditivos':
                return 'Tipo de aditivo';
            case 'lentes de contacto':
                return 'Tipo de lente';
            default:
                return 'Tipo';
        }
    }

    get etiquetaMaterialCategoria(): string {
        return this.usaSelectorMaterialCategoria ? 'Tipo de material' : 'Material';
    }

    get placeholderCategoriaProducto(): string {
        return 'Elige la familia comercial del producto';
    }

    get placeholderNombreProducto(): string {
        return 'Se genera automaticamente segun la categoria y el tipo';
    }

    get placeholderModeloCategoria(): string {
        switch (this.categoriaProductoActual) {
            case 'monturas':
                return 'Ej. Carrera 8847, Ray-Ban Erika';
            case 'liquidos':
            case 'líquidos':
                return 'Ej. Solución 120 ml, kit de limpieza';
            case 'estuches':
            case 'accesorios':
                return 'Ej. Estuche rígido negro, cordón deportivo';
            default:
                return 'Ingresa una referencia reconocible para inventario';
        }
    }

    get placeholderTipoCategoria(): string {
        switch (this.categoriaProductoActual) {
            case 'cristales':
                return 'Selecciona el tipo';
            case 'filtros':
                return 'Selecciona el filtro';
            case 'aditivos':
                return 'Selecciona el aditivo';
            case 'lentes de contacto':
                return 'Selecciona el tipo';
            default:
                return 'Selecciona una opción';
        }
    }

    get placeholderMarcaCategoria(): string {
        switch (this.categoriaProductoActual) {
            case 'monturas':
                return 'Ej. Ray-Ban, Vogue, Calvin Klein';
            case 'lentes de contacto':
                return 'Ej. Biomedics, Evolution';
            case 'liquidos':
            case 'líquidos':
                return 'Ej. Renu, Opti-Free';
            case 'estuches':
            case 'accesorios':
                return 'Ej. Genérico, Vision Case';
            default:
                return 'Marca comercial';
        }
    }

    get placeholderProveedorCategoria(): string {
        switch (this.categoriaProductoActual) {
            case 'cristales':
                return 'Ej. Laboratorio principal';
            case 'monturas':
                return 'Ej. Distribuidor oficial o importadora';
            default:
                return 'Nombre del proveedor o distribuidor';
        }
    }

    get placeholderMaterialCategoria(): string {
        switch (this.categoriaProductoActual) {
            case 'monturas':
                return 'Ej. Acetato, metal, titanio';
            case 'materiales':
                return 'Selecciona un material estandarizado';
            case 'accesorios':
                return 'Ej. Silicona, microfibra, plástico';
            default:
                return 'Material del producto';
        }
    }

    get placeholderColorCategoria(): string {
        switch (this.categoriaProductoActual) {
            case 'monturas':
                return 'Ej. Negro mate, carey, dorado';
            case 'lentes de contacto':
                return 'Ej. Azul, miel, verde';
            default:
                return 'Color o acabado visible';
        }
    }

    get placeholderDescripcionCategoria(): string {
        switch (this.categoriaProductoActual) {
            case 'cristales':
                return 'Añade observaciones útiles como rango, proveedor o notas comerciales.';
            case 'monturas':
                return 'Describe talla, estilo, detalles visuales o referencia interna.';
            case 'filtros':
            case 'aditivos':
                return 'Resume el uso técnico o comercial de este complemento.';
            default:
                return 'Agrega detalles útiles para identificar el producto más rápido.';
        }
    }

    get placeholderStockCategoria(): string {
        switch (this.categoriaProductoActual) {
            case 'monturas':
                return 'Ej. 12 unidades disponibles';
            case 'lentes de contacto':
                return 'Ej. 24 cajas disponibles';
            case 'liquidos':
            case 'líquidos':
                return 'Ej. 18 unidades disponibles';
            case 'estuches':
            case 'accesorios':
                return 'Ej. 10 unidades disponibles';
            default:
                return '0';
        }
    }

    get opcionesTipoCategoria(): OpcionSelect[] {
        switch (this.categoriaProductoActual) {
            case 'cristales':
                return this.tiposCristalesDisponibles;
            case 'filtros':
            case 'aditivos':
                return this.tratamientosDisponibles;
            case 'lentes de contacto':
                return this.tiposLentesContactoDisponibles;
            default:
                return [];
        }
    }

    get opcionesMaterialCategoria(): OpcionSelect[] {
        return this.usaSelectorMaterialCategoria ? this.materialesDisponibles : [];
    }

    getNombreProductoDisplay(producto: Partial<Producto> | null | undefined): string {
        return this.resolverNombreProducto(producto);
    }

    controlaStockProducto(producto: Partial<Producto> | null | undefined): boolean {
        return this.categoriaControlaStock(producto?.categoria ?? '');
    }

    onCategoriaProductoModelChange(valor: string | null | Event): void {
        if (!this.producto) {
            return;
        }

        const categoria = typeof valor === 'string' || valor === null ? valor : null;

        this.producto = this.sincronizarNombreProducto(this.normalizarCamposSegunCategoria({
            ...this.producto,
            categoria: categoria ?? ''
        }));
    }

    onModeloProductoModelChange(valor: string | null | Event): void {
        if (!this.producto) {
            return;
        }

        const modelo = typeof valor === 'string' || valor === null ? valor : null;

        this.producto = this.sincronizarNombreProducto(this.normalizarCamposSegunCategoria({
            ...this.producto,
            modelo: modelo ?? ''
        }));
    }

    onMaterialProductoModelChange(valor: string | null | Event): void {
        if (!this.producto) {
            return;
        }

        const material = typeof valor === 'string' || valor === null ? valor : null;

        this.producto = this.sincronizarNombreProducto(this.normalizarCamposSegunCategoria({
            ...this.producto,
            material: material ?? ''
        }));
    }

    onCategoriaProductoChange(): void {
        this.producto = this.sincronizarNombreProducto(this.normalizarCamposSegunCategoria({
            ...this.producto,
            categoria: this.producto?.categoria ?? ''
        }));
    }

    onModeloTextoProductoChange(valor: string | null | Event): void {
        if (!this.producto) {
            return;
        }

        const modelo = typeof valor === 'string' || valor === null ? valor : null;

        this.producto = this.sincronizarNombreProducto(this.normalizarCamposSegunCategoria({
            ...this.producto,
            modelo: modelo ?? ''
        }));
    }

    private normalizarCamposSegunCategoria(producto: Producto): Producto {
        const categoria = normalizarTextoClasificacion(producto?.categoria);
        const siguiente = { ...producto };

        if (!this.debeMostrarMarcaSegunCategoria(categoria)) {
            siguiente.marca = '';
        }

        if (this.categoriaUsaSelectorModelo(categoria)) {
            if (!this.valorPerteneceAOpciones(siguiente.modelo, this.obtenerOpcionesModeloPorCategoria(categoria))) {
                siguiente.modelo = '';
            }
        }

        if (!this.debeMostrarModeloTextoSegunCategoria(categoria) && !this.categoriaUsaSelectorModelo(categoria)) {
            siguiente.modelo = '';
        }

        if (this.categoriaUsaSelectorMaterial(categoria)) {
            if (!this.valorPerteneceAOpciones(siguiente.material, this.materialesDisponibles)) {
                siguiente.material = '';
            }
        }

        if (!this.debeMostrarMaterialSegunCategoria(categoria) && !this.categoriaUsaSelectorMaterial(categoria)) {
            siguiente.material = '';
        }

        if (!this.debeMostrarColorSegunCategoria(categoria)) {
            siguiente.color = '';
        }

        if (!this.categoriaControlaStock(categoria)) {
            siguiente.stock = 0;
        }

        return siguiente;
    }

    private sincronizarNombreProducto(producto: Producto): Producto {
        return {
            ...producto,
            nombre: this.resolverNombreProducto(producto)
        };
    }

    private resolverNombreProducto(producto: Partial<Producto> | null | undefined): string {
        const categoria = producto?.categoria?.trim() ?? '';
        if (!categoria) {
            return '';
        }

        const categoriaNormalizada = normalizarTextoClasificacion(categoria);
        const tipo = this.obtenerTipoParaNombre(producto, categoriaNormalizada);

        return [categoria, tipo].filter(Boolean).join(' - ');
    }

    private categoriaControlaStock(categoria: string): boolean {
        const categoriaNormalizada = normalizarTextoClasificacion(categoria);
        return ['monturas', 'lentes de contacto', 'liquidos', 'líquidos', 'estuches', 'accesorios'].includes(categoriaNormalizada);
    }

    private obtenerTipoParaNombre(producto: Partial<Producto> | null | undefined, categoria: string): string {
        if (!producto) {
            return '';
        }

        if (this.categoriaUsaSelectorModelo(categoria)) {
            return producto.modelo?.trim() ?? '';
        }

        if (this.categoriaUsaSelectorMaterial(categoria)) {
            return producto.material?.trim() ?? '';
        }

        return producto.modelo?.trim() ?? '';
    }

    private categoriaUsaSelectorModelo(categoria: string): boolean {
        return ['cristales', 'filtros', 'aditivos', 'lentes de contacto'].includes(categoria);
    }

    private categoriaUsaSelectorMaterial(categoria: string): boolean {
        return categoria === 'materiales';
    }

    private debeMostrarMarcaSegunCategoria(categoria: string): boolean {
        return !['cristales', 'filtros', 'aditivos', 'materiales'].includes(categoria);
    }

    private debeMostrarModeloTextoSegunCategoria(categoria: string): boolean {
        return !this.categoriaUsaSelectorModelo(categoria) && categoria !== 'materiales';
    }

    private debeMostrarMaterialSegunCategoria(categoria: string): boolean {
        return ['monturas', 'materiales', 'accesorios', 'estuches', 'liquidos', 'líquidos'].includes(categoria);
    }

    private debeMostrarColorSegunCategoria(categoria: string): boolean {
        return ['monturas', 'lentes de contacto', 'accesorios'].includes(categoria);
    }

    private obtenerOpcionesModeloPorCategoria(categoria: string): OpcionSelect[] {
        switch (categoria) {
            case 'cristales':
                return this.tiposCristalesDisponibles;
            case 'filtros':
            case 'aditivos':
                return this.tratamientosDisponibles;
            case 'lentes de contacto':
                return this.tiposLentesContactoDisponibles;
            default:
                return [];
        }
    }

    private valorPerteneceAOpciones(valor: string | undefined, opciones: OpcionSelect[]): boolean {
        if (!valor) {
            return false;
        }

        return opciones.some(opcion => opcion.label === valor || String(opcion.value) === valor);
    }
}