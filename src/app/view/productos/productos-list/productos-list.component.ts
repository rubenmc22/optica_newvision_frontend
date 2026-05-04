import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { Producto, MonedaVisual, ProductoEstadoDisponibilidad, ProductoEstadoOperativo, ProductoTipoItem } from '../producto.model';
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
import { PRODUCTO_CLASSIFICATION_GUIDES, normalizarClasificacionProducto, normalizarTextoClasificacion } from '../producto-classification.catalog';
import { OpcionSelect } from '../../../shared/constants/historias-medicas';
import { normalizarProductoCristalConfig } from '../producto-cristal-config.util';

@Component({
    selector: 'app-productos-list',
    standalone: false,
    templateUrl: './productos-list.component.html',
    styleUrls: ['./productos-list.component.scss']
})
export class ProductosListComponent implements OnInit, OnDestroy {
    @Output() onCerrar = new EventEmitter<void>();
    @ViewChild('modalBodyRef') private modalBodyRef?: ElementRef<HTMLDivElement>;
    @ViewChild('seccionCategoriaRef') private seccionCategoriaRef?: ElementRef<HTMLDivElement>;
    @ViewChild('categoriaSelectRef') private categoriaSelectRef?: ElementRef<HTMLDivElement>;
    @ViewChild('descripcionTextareaRef') private descripcionTextareaRef?: ElementRef<HTMLTextAreaElement>;

    private readonly CATEGORIA_FILTROS_ADITIVOS_NORMALIZADA = 'filtros/aditivos';
    private readonly TRATAMIENTOS_CRISTAL_VACIOS: string[] = [];
    private readonly TIPO_CRISTAL_ABREVIATURAS: Record<string, string> = {
        PLANO: 'Plano',
        MONOFOCAL: 'V.S.',
        MONOFOCAL_DIGITAL: 'V.S. Dig.',
        BIFOCAL: 'Bif.',
        PROGRESIVO_CONVENCIONAL: 'V.0.0',
        PROGRESIVO_DIGITAL_BASICO: 'V.1.0',
        PROGRESIVO_DIGITAL_INTERMEDIO: 'V.1.5',
        PROGRESIVO_DIGITAL_AMPLIO: 'V.2.0'
    };
    private readonly MATERIAL_CRISTAL_ABREVIATURAS: Record<string, string> = {
        CR39: 'CR39',
        POLICARBONATO: 'Poli',
        HI_INDEX_156: 'HI 1.56',
        HI_INDEX_160: 'HI 1.60',
        HI_INDEX_167: 'HI 1.67',
        HI_INDEX_174: 'HI 1.74',
        TRIVEX: 'Trivex',
        OTRO: 'Otro'
    };
    private readonly TRATAMIENTO_CRISTAL_ABREVIATURAS: Record<string, string> = {
        BLANCO: 'Blanco',
        TRANSICION_PLUS: 'trans.',
        BLUE_BLOCK: 'Blue Block',
        BLUE_BLOCK_AR: 'Blue+AR',
        FOTOSENSIBLE: 'foto',
        FOTOCROMATICO: 'foto',
        FOTOCROMATICO_BLUE_BLOCK: 'Foto+BB',
        FOTOCROMATICO_AR: 'Foto+AR',
        ANTIREFLEJO: 'AR',
        AR_VERDE: 'AR verde',
        COLORACION_DEGRADE: 'degradé',
        COLORACION_FULL_COLOR: 'full color',
        COLORACION: 'color',
        POLARIZADO: 'Polar.',
        ESPEJADO: 'Esp.'
    };
    private readonly TIPO_CRISTAL_LISTA_PRECIOS: Record<string, string> = {
        PLANO: 'PLANO',
        MONOFOCAL: 'VISION SENCILLA',
        MONOFOCAL_DIGITAL: 'VISION SENCILLA DIGITAL',
        BIFOCAL: 'BIFOCAL',
        PROGRESIVO_CONVENCIONAL: 'PROGRESIVO',
        PROGRESIVO_DIGITAL_BASICO: 'PROGRESIVO DIGITAL BASICO',
        PROGRESIVO_DIGITAL_INTERMEDIO: 'PROGRESIVO DIGITAL INTERMEDIO',
        PROGRESIVO_DIGITAL_AMPLIO: 'PROGRESIVO DIGITAL AMPLIO'
    };
    private readonly PRESENTACION_CRISTAL_LISTA_PRECIOS: Record<string, string> = {
        VS: '',
        VS_TALLADO: 'TALLADO',
        TERMINADOS: 'TERMINADOS',
        TALLADOS: 'TALLADOS',
        CONVENCIONAL: 'CONVENCIONAL',
        DIGITAL_FIRST: 'DIGITAL FIRST'
    };
    private readonly MATERIAL_CRISTAL_LISTA_PRECIOS: Record<string, string> = {
        CR39: 'CR39',
        POLICARBONATO: 'POLI',
        HI_INDEX_156: 'HI INDEX 1.56',
        HI_INDEX_160: 'HI INDEX 1.60',
        HI_INDEX_167: 'HI INDEX 1.67',
        HI_INDEX_174: 'HI INDEX 1.74',
        TRIVEX: 'TRIVEX',
        OTRO: 'OTRO'
    };
    private readonly TRATAMIENTO_CRISTAL_LISTA_PRECIOS: Record<string, string> = {
        BLANCO: 'BLANCO',
        ANTIREFLEJO: 'ANTIRREFLEJO',
        FOTOCROMATICO: 'FOTO',
        BLUE_BLOCK: 'BLUE BLOCK',
        FOTOCROMATICO_BLUE_BLOCK: 'FOTO BLUE BLOCK',
        BLUE_BLOCK_AR: 'BLUE BLOCK ANTIRREFLEJO',
        FOTOCROMATICO_AR: 'FOTO ANTIRREFLEJO',
        POLARIZADO: 'POLARIZADO',
        ESPEJADO: 'ESPEJADO'
    };
    private readonly PRESENTACIONES_CRISTAL_POR_TIPO: Record<string, OpcionSelect[]> = {
        PLANO: [],
        MONOFOCAL: [
            { value: 'VS', label: 'V/S' },
            { value: 'VS_TALLADO', label: 'V/S tallado' }
        ],
        MONOFOCAL_DIGITAL: [],
        BIFOCAL: [
            { value: 'TERMINADOS', label: 'Terminados' },
            { value: 'TALLADOS', label: 'Tallados' }
        ],
        PROGRESIVO_CONVENCIONAL: [
            { value: 'CONVENCIONAL', label: 'Convencional' },
            { value: 'DIGITAL_FIRST', label: 'Digital first' }
        ],
        PROGRESIVO_DIGITAL_BASICO: [],
        PROGRESIVO_DIGITAL_INTERMEDIO: [],
        PROGRESIVO_DIGITAL_AMPLIO: []
    };

    // CONSTANTES
    readonly PRODUCTOS_POR_PAGINA = 12;
    readonly RANGO_PAGINACION = 3;
    readonly IVA = 0.16;
    readonly STOCK_BAJO_LIMITE = 5;
    precioInputTemporal: string = '';
    estaEditandoPrecio: boolean = false;
    costoLaboratorioInputTemporal: string = '';
    estaEditandoCostoLaboratorio: boolean = false;

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
    nombreProductoPersonalizado: boolean = false;
    descripcionProductoPersonalizada: boolean = false;

    // FILTROS
    filtroBusqueda = '';
    tipoSeleccionado = '';
    disponibilidadSeleccionada = '';
    estadoSeleccionado: boolean = true;
    sedeActiva: string = '';
    sedeFiltro: string = this.sedeActiva;
    ordenarPorStockActivo: boolean = false;
    ordenStockAscendente: boolean = true;

    // CATÁLOGO
    categoriasProducto: string[] = ['Monturas', 'Cristales', 'Lentes de contacto', 'Líquidos', 'Estuches', 'Accesorios'];
    moneda: MonedaVisual[] = [];
    tiposCristalesDisponibles: OpcionSelect[] = [
        { value: 'PLANO', label: 'Plano' },
        { value: 'MONOFOCAL', label: 'Monofocal visión sencilla' },
        { value: 'MONOFOCAL_DIGITAL', label: 'Monofocal visión sencilla digital' },
        { value: 'BIFOCAL', label: 'Bifocal' },
        { value: 'PROGRESIVO_CONVENCIONAL', label: 'Progresivo' },
        { value: 'PROGRESIVO_DIGITAL_BASICO', label: 'Progresivo digital básico' },
        { value: 'PROGRESIVO_DIGITAL_INTERMEDIO', label: 'Progresivo digital intermedio' },
        { value: 'PROGRESIVO_DIGITAL_AMPLIO', label: 'Progresivo digital amplio' }
    ];
    tiposLentesContactoDisponibles: OpcionSelect[] = [
        { value: 'ESFERICOS', label: 'Esféricos' },
        { value: 'TORICOS', label: 'Tóricos' },
        { value: 'GAS_PERMEABLE', label: 'Gas permeable' },
        { value: 'COSMETICOS', label: 'Cosméticos' },
        { value: 'COSMETICOS_FORMULADOS', label: 'Cosméticos formulados' }
    ];
    materialesDisponibles: OpcionSelect[] = [
        { value: 'CR39', label: 'CR-39' },
        { value: 'POLICARBONATO', label: 'Policarbonato' },
        { value: 'HI_INDEX_156', label: 'High Index 1.56' },
        { value: 'HI_INDEX_160', label: 'High Index 1.60' },
        { value: 'HI_INDEX_167', label: 'High Index 1.67' },
        { value: 'HI_INDEX_174', label: 'High Index 1.74' },
        { value: 'TRIVEX', label: 'Trivex' },
        { value: 'OTRO', label: 'Otro' }
    ];
    tratamientosDisponibles: OpcionSelect[] = [
        { value: 'BLANCO', label: 'Blanco' },
        { value: 'ANTIREFLEJO', label: 'Antirreflejo' },
        { value: 'FOTOCROMATICO', label: 'Fotocromático' },
        { value: 'BLUE_BLOCK', label: 'Blue Block' },
        { value: 'FOTOCROMATICO_BLUE_BLOCK', label: 'Fotocromático + Blue Block' },
        { value: 'BLUE_BLOCK_AR', label: 'Blue Block + antirreflejo' },
        { value: 'FOTOCROMATICO_AR', label: 'Fotocromático + antirreflejo' },
        { value: 'POLARIZADO', label: 'Polarizado' },
        { value: 'ESPEJADO', label: 'Espejado' }
    ];
    readonly clasificacionesDisponibles = PRODUCTO_CLASSIFICATION_GUIDES;
    readonly disponibilidadesDisponibles: Array<{ value: ProductoEstadoDisponibilidad; label: string }> = [
        { value: 'disponible', label: 'Disponible' },
        { value: 'agotado', label: 'Agotado' }
    ];

    // MODAL
    avatarPreview: string | null = null;
    imagenPreviewAmplia: string | null = null;
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
        this.toggleMobileShellFooter(true);
        this.cargarDatosIniciales();
        this.suscribirCambiosConfiguracion();
        this.productoOriginal = { ...this.producto };
    }

    ngOnDestroy(): void {
        this.toggleMobileShellFooter(false);
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
        this.obtenerConfiguracionSistema();
        this.cargarProductosYSedes();
    }

    private obtenerConfiguracionSistema(): void {
        this.monedaSistema = this.systemConfigService.getMonedaPrincipal();
        this.simboloMonedaSistema = this.systemConfigService.getSimboloMonedaPrincipal();
    }

    private toggleMobileShellFooter(active: boolean): void {
        if (typeof document === 'undefined') {
            return;
        }

        document.body.classList.toggle('labels-hide-mobile-shell-footer', active);
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
            this.productos = this.productoConversionService
                .convertirListaProductosAmonedaSistema(productosResponse.productos ?? [])
                .map(producto => this.prepararProductoParaEdicion(producto))
                .filter(producto => this.debeMostrarProductoEnReestructuracion(producto));

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
            this.productoTieneAlertaInventario(producto)
        ).length;
    }

    get totalProductosAgotados(): number {
        return this.productos.filter(producto =>
            this.getDisponibilidadInventario(producto) === 'agotado'
        ).length;
    }

    get totalCristalesFormulados(): number {
        return this.productos.filter(producto => this.getTipoItemProducto(producto) === 'base_formulado').length;
    }

    get totalProductosBajoPedido(): number {
        return this.productos.filter(producto => {
            const stock = Math.max(Number(producto?.stock ?? 0), 0);
            return this.controlaStockProducto(producto)
                && this.getDisponibilidadInventario(producto) === 'disponible'
                && stock > 0
                && stock <= this.STOCK_BAJO_LIMITE;
        }).length;
    }

    get totalInventarioPrincipal(): number {
        return this.productos.filter(producto => this.esInventarioPrincipalProducto(producto)).length;
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
        this.nombreProductoPersonalizado = this.tieneNombrePersonalizado(productoPreparado);
        this.descripcionProductoPersonalizada = this.tieneDescripcionPersonalizada(productoPreparado);

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
            this.ajustarAlturaDescripcionTextarea();
        });

        document.body.classList.add('modal-open');
    }

    cerrarModal(): void {
        this.mostrarModal = false;
        this.nombreProductoPersonalizado = false;
        this.descripcionProductoPersonalizada = false;
        this.producto = null;
        this.productoOriginal = null;
        this.productoSeleccionado = undefined;
        this.avatarPreview = '';
        this.imagenPreviewAmplia = null;
        this.imagenSeleccionada = null;
        this.cargando = false;
        document.body.classList.remove('modal-open');
    }

    abrirVistaAmpliadaImagen(event?: Event): void {
        event?.stopPropagation();

        const imagen = this.getProfileImage();
        if (!imagen) {
            return;
        }

        this.imagenPreviewAmplia = imagen;
    }

    cerrarVistaAmpliadaImagen(event?: Event): void {
        event?.stopPropagation();
        this.imagenPreviewAmplia = null;
    }

    guardarProducto(): void {
        if (this.botonGuardarDeshabilitado()) {
            return;
        }

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

        const esCristal = this.normalizarCategoriaProducto(producto.categoria) === 'cristales';
        if (esCristal && producto.cristalConfig?.costoLaboratorio !== undefined && producto.cristalConfig?.costoLaboratorio !== null) {
            formData.append('costoLaboratorio', String(producto.cristalConfig.costoLaboratorio));
        }

        formData.append('stock', producto.stock.toString());
        formData.append('activo', producto.activo ? 'true' : 'false');
        formData.append('fechaIngreso', producto.fechaIngreso);
        formData.append('aplicaIva', producto.aplicaIva.toString());
        formData.append('precio', precioPersistencia.toString());
        this.appendClasificacionProductoToFormData(formData, producto);
        this.appendCategoriaConfigToFormData(formData, producto);

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
                this.productos = this.productoConversionService
                    .convertirListaProductosAmonedaSistema(productos)
                    .map(item => this.prepararProductoParaEdicion(item));
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

        const esCristal = this.normalizarCategoriaProducto(producto.categoria) === 'cristales';
        if (esCristal && producto.cristalConfig?.costoLaboratorio !== undefined && producto.cristalConfig?.costoLaboratorio !== null) {
            formData.append('costoLaboratorio', String(producto.cristalConfig.costoLaboratorio));
        }

        formData.append('stock', producto.stock?.toString() ?? '0');
        formData.append('activo', producto.activo ? 'true' : 'false');
        formData.append('fechaIngreso', producto.fechaIngreso ?? '');
        formData.append('aplicaIva', producto.aplicaIva.toString());
        formData.append('precio', precioPersistencia.toString());
        this.appendClasificacionProductoToFormData(formData, producto);
        this.appendCategoriaConfigToFormData(formData, producto);

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
                this.productos = this.productoConversionService
                    .convertirListaProductosAmonedaSistema(productos)
                    .map(item => this.prepararProductoParaEdicion(item));
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
        this.disponibilidadSeleccionada = '';
        this.estadoSeleccionado = true;
    }

    get productosFiltrados(): Producto[] {
        const texto = this.filtroBusqueda?.trim().toLowerCase() ?? '';
        const tipo = this.tipoSeleccionado?.toLowerCase() ?? '';
        const disponibilidad = this.disponibilidadSeleccionada ?? '';
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
            const disponibilidadInventario = this.getDisponibilidadInventario(p);

            const coincideTexto =
                nombre.includes(texto) ||
                codigo.includes(texto) ||
                marca.includes(texto) ||
                modelo.includes(texto) ||
                proveedor.includes(texto) ||
                material.includes(texto) ||
                color.includes(texto);

            const coincideTipo = !tipo || categoria === tipo;
            const coincideDisponibilidad = !disponibilidad || disponibilidadInventario === disponibilidad;
            const coincideEstado = estado === null || activo === estado;
            const coincideSede = !sede || sedeProducto === sede;

            return coincideTexto && coincideTipo && coincideDisponibilidad && coincideEstado && coincideSede;
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
        const controlaStock = this.resolverControlaStock({ ...base, ...clasificacion });
        const stockNormalizado = controlaStock ? Math.max(Number(base.stock ?? 0), 0) : 0;
        const nombreManual = String(base.nombre ?? '').trim();
        const nombreResuelto = this.nombreProductoPersonalizado && nombreManual
            ? nombreManual
            : this.resolverNombreProducto(base);
        const descripcionManual = String(base.descripcion ?? '').trim();
        const descripcionResuelta = this.descripcionProductoPersonalizada && descripcionManual
            ? descripcionManual
            : this.resolverDescripcionProducto(base);

        return this.enriquecerProductoInventario({
            ...base,
            ...clasificacion,
            id: base.id || crypto.randomUUID(),
            nombre: nombreResuelto,
            descripcion: descripcionResuelta,
            stock: stockNormalizado,
            moneda: base.moneda || this.monedaSistema,
            fechaIngreso: base.fechaIngreso || new Date().toISOString().split('T')[0],
            imagenUrl: this.avatarPreview || base.imagenUrl || ''
        });
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
            categoria: '',
            stock: 0,
            aplicaIva: false,
            precio: 0,
            precioConIva: 0,
            moneda: this.monedaSistema,
            activo: true,
            descripcion: '',
            cristalConfig: normalizarProductoCristalConfig(undefined),
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

        const productoActual = this.obtenerProductoComparable(this.producto);
        const productoBase = this.obtenerProductoComparable(this.productoOriginal);

        const imagenCambiada = this.imagenSeleccionada !== null;
        return JSON.stringify(productoActual) !== JSON.stringify(productoBase) || imagenCambiada;
    }

    formularioValido(): boolean {
        if (!this.producto) {
            return false;
        }

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
            if (campo === 'precio') return this.precioFormularioCompleto();
            if (typeof valor === 'number') return valor >= 0;
            return valor !== undefined && valor !== null && `${valor}`.trim().length > 0;
        });

        if (this.producto.aplicaIva) {
            return valido
                && this.precioFormularioCompleto()
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

    private precioFormularioCompleto(): boolean {
        const precioActual = this.producto?.aplicaIva ? this.producto?.precioConIva : this.producto?.precio;
        return typeof precioActual === 'number' && !isNaN(precioActual) && precioActual > 0;
    }

    private obtenerProductoComparable(producto: Producto | null | undefined): Partial<Producto> | null {
        if (!producto) {
            return null;
        }

        const comparable = { ...this.prepararProductoParaEdicion(producto) };
        delete comparable.imagenUrl;
        return comparable;
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

    getCostoLaboratorioDisplay(): string {
        if (this.estaEditandoCostoLaboratorio && this.costoLaboratorioInputTemporal !== '') {
            return this.costoLaboratorioInputTemporal;
        }

        const costo = this.producto?.cristalConfig?.costoLaboratorio;
        if (costo === null || costo === undefined || costo === 0) {
            return '';
        }

        return Number(costo).toFixed(2).replace(',', '.');
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

    onCostoLaboratorioCristalFocus(): void {
        this.estaEditandoCostoLaboratorio = true;
        const costoActual = this.producto?.cristalConfig?.costoLaboratorio;

        if (costoActual === null || costoActual === undefined || costoActual === 0) {
            this.costoLaboratorioInputTemporal = '';
            return;
        }

        const valorFormateado = Number(costoActual).toFixed(2).replace(',', '.');
        this.costoLaboratorioInputTemporal = valorFormateado.endsWith('.00')
            ? valorFormateado.replace('.00', '')
            : valorFormateado;
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

    onCostoLaboratorioCristalInput(event: Event): void {
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

        this.costoLaboratorioInputTemporal = valor;

        if (valor === '' || valor === '.') {
            this.actualizarCostoLaboratorioCristalModelo(null);
            return;
        }

        const numero = parseFloat(valor);
        this.actualizarCostoLaboratorioCristalModelo(Number.isFinite(numero) && numero >= 0 ? numero : null);
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

    onCostoLaboratorioCristalBlur(): void {
        this.estaEditandoCostoLaboratorio = false;
        const costoActual = this.producto?.cristalConfig?.costoLaboratorio;

        if (costoActual === null || costoActual === undefined || !Number.isFinite(Number(costoActual))) {
            this.actualizarCostoLaboratorioCristalModelo(null);
            this.costoLaboratorioInputTemporal = '';
            return;
        }

        this.actualizarCostoLaboratorioCristalModelo(Number(Number(costoActual).toFixed(2)));
        this.costoLaboratorioInputTemporal = '';
    }

    private actualizarPrecioModelo(valor: number): void {
        if (this.producto.aplicaIva) {
            this.producto.precioConIva = valor;
        } else {
            this.producto.precio = valor;
        }
    }

    private actualizarCostoLaboratorioCristalModelo(valor: number | null): void {
        if (!this.producto) {
            return;
        }

        this.actualizarProductoFormulario({
            ...this.producto,
            cristalConfig: {
                ...normalizarProductoCristalConfig(this.producto?.cristalConfig),
                costoLaboratorio: valor
            }
        });
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
            this.loader.hide();
            this.dataIsReady = true;
        }
    }

    private prepararProductoParaEdicion(producto: Producto): Producto {
        const productoNormalizado = this.normalizarCamposSegunCategoria(producto);
        const productoConNombre = this.tieneNombrePersonalizado(productoNormalizado)
            ? {
                ...productoNormalizado,
                nombre: String(productoNormalizado.nombre ?? '').trim()
            }
            : this.sincronizarNombreProducto(productoNormalizado);

        const productoConDescripcion = this.tieneDescripcionPersonalizada(productoConNombre)
            ? {
                ...productoConNombre,
                descripcion: String(productoConNombre.descripcion ?? '').trim()
            }
            : this.sincronizarDescripcionProducto(productoConNombre);

        return this.enriquecerProductoInventario(productoConDescripcion);
    }

    private enriquecerProductoInventario(producto: Producto): Producto {
        const clasificacion = normalizarClasificacionProducto(producto);
        const controlaStock = this.resolverControlaStock({ ...producto, ...clasificacion });

        return {
            ...producto,
            ...clasificacion,
            controlaStock,
            disponibilidadInventario: this.resolverDisponibilidadInventario({ ...producto, ...clasificacion, controlaStock })
        };
    }

    private appendClasificacionProductoToFormData(formData: FormData, producto: Producto): void {
        const clasificacion = normalizarClasificacionProducto(producto);
        const camposFuncionales: Record<string, string> = {
            requiere_formula: String(clasificacion.requiereFormula)
        };

        Object.entries(camposFuncionales).forEach(([clave, valor]) => {
            formData.append(clave, valor);
        });
    }

    private appendCategoriaConfigToFormData(formData: FormData, producto: Producto): void {
        const categoria = this.normalizarCategoriaProducto(producto.categoria);
        const payloadPorCategoria: Record<string, Record<string, unknown> | null> = {
            cristalConfig: categoria === 'cristales' ? this.construirCristalConfigPayload(producto) : null,
            monturaConfig: categoria === 'monturas' ? this.construirMonturaConfigPayload(producto) : null,
            lenteContactoConfig: categoria === 'lentes de contacto' ? this.construirLenteContactoConfigPayload(producto) : null,
            liquidoConfig: categoria === 'liquidos' ? this.construirLiquidoConfigPayload(producto) : null,
            estucheConfig: categoria === 'estuches' ? this.construirEstucheConfigPayload(producto) : null,
            accesorioConfig: categoria === 'accesorios' ? this.construirAccesorioConfigPayload(producto) : null
        };

        Object.entries(payloadPorCategoria).forEach(([clave, valor]) => {
            if (valor) {
                formData.append(clave, JSON.stringify(valor));
            }
        });
    }

    private construirCristalConfigPayload(producto: Producto): Record<string, unknown> {
        const cristalConfig = normalizarProductoCristalConfig(producto.cristalConfig);

        return {
            categoria: 'Cristales',
            nombre: this.resolverNombreProducto(producto),
            marca: String(producto.marca ?? '').trim(),
            tipoCristal: String(producto.modelo ?? '').trim(),
            presentacion: this.getPresentacionCristal(producto),
            modelo: String(producto.modelo ?? '').trim(),
            material: String(producto.material ?? '').trim(),
            color: producto.color ?? null,
            proveedor: String(producto.proveedor ?? '').trim(),
            tratamientos: cristalConfig.tratamientos,
            rangoFormula: cristalConfig.rangoFormula,
            materialOtro: cristalConfig.materialOtro,
            descripcion: this.resolverDescripcionProducto(producto)
        };
    }

    private resolverCostoLaboratorioCristalParaPersistencia(valorActual: number | null | undefined): number | null {
        const textoTemporal = String(this.costoLaboratorioInputTemporal ?? '').trim();

        if (textoTemporal) {
            const numeroTemporal = Number(textoTemporal.replace(',', '.'));
            if (Number.isFinite(numeroTemporal) && numeroTemporal >= 0) {
                return Number(numeroTemporal.toFixed(2));
            }
        }

        if (valorActual === null || valorActual === undefined || !Number.isFinite(Number(valorActual))) {
            return null;
        }

        return Number(Number(valorActual).toFixed(2));
    }

    private construirMonturaConfigPayload(producto: Producto): Record<string, unknown> {
        return {
            categoria: 'Monturas',
            nombre: this.resolverNombreProducto(producto),
            marca: String(producto.marca ?? '').trim(),
            modelo: String(producto.modelo ?? '').trim(),
            color: String(producto.color ?? '').trim(),
            material: String(producto.material ?? '').trim(),
            proveedor: String(producto.proveedor ?? '').trim(),
            descripcion: this.resolverDescripcionProducto(producto)
        };
    }

    private construirLenteContactoConfigPayload(producto: Producto): Record<string, unknown> {
        return {
            categoria: 'Lentes de contacto',
            nombre: this.resolverNombreProducto(producto),
            marca: String(producto.marca ?? '').trim(),
            tipoLenteContacto: String(producto.modelo ?? '').trim(),
            modelo: String(producto.modelo ?? '').trim(),
            color: String(producto.color ?? '').trim(),
            material: String(producto.material ?? '').trim() || null,
            proveedor: String(producto.proveedor ?? '').trim(),
            rangoFormula: this.esTipoLenteContactoFormulado(producto?.modelo)
                ? this.getRangoFormulaLenteContacto(producto)
                : '',
            descripcion: this.resolverDescripcionProducto(producto)
        };
    }

    private construirLiquidoConfigPayload(producto: Producto): Record<string, unknown> {
        return {
            categoria: 'Líquidos',
            nombre: this.resolverNombreProducto(producto),
            marca: String(producto.marca ?? '').trim(),
            modelo: String(producto.modelo ?? '').trim(),
            proveedor: String(producto.proveedor ?? '').trim(),
            descripcion: this.resolverDescripcionProducto(producto)
        };
    }

    private construirEstucheConfigPayload(producto: Producto): Record<string, unknown> {
        return {
            categoria: 'Estuches',
            nombre: this.resolverNombreProducto(producto),
            marca: String(producto.marca ?? '').trim(),
            modelo: String(producto.modelo ?? '').trim(),
            material: String(producto.material ?? '').trim(),
            proveedor: String(producto.proveedor ?? '').trim(),
            descripcion: this.resolverDescripcionProducto(producto)
        };
    }

    private construirAccesorioConfigPayload(producto: Producto): Record<string, unknown> {
        return {
            categoria: 'Accesorios',
            nombre: this.resolverNombreProducto(producto),
            marca: String(producto.marca ?? '').trim(),
            modelo: String(producto.modelo ?? '').trim(),
            color: String(producto.color ?? '').trim(),
            material: String(producto.material ?? '').trim(),
            proveedor: String(producto.proveedor ?? '').trim(),
            descripcion: this.resolverDescripcionProducto(producto)
        };
    }

    private validarCamposCondicionalesProducto(): boolean {
        if (this.esCristalConfigurableActual) {
            const tratamientos = this.getTratamientosCristal(this.producto);
            const materialOtro = String(this.producto?.cristalConfig?.materialOtro ?? '').trim();
            const presentacion = this.getPresentacionCristal(this.producto);

            if (this.presentacionCristalEsObligatoria && !presentacion) {
                return false;
            }

            if (!tratamientos.length) {
                return false;
            }

            if (this.mostrarCampoMaterialOtroCristal && !materialOtro) {
                return false;
            }
        }

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
        return this.normalizarCategoriaProducto(this.producto?.categoria);
    }

    get hayCategoriaSeleccionada(): boolean {
        return Boolean(this.categoriaProductoActual);
    }

    get usaSelectorTipoCategoria(): boolean {
        return ['cristales', 'lentes de contacto'].includes(this.categoriaProductoActual);
    }

    get mostrarCampoModeloTexto(): boolean {
        return !this.usaSelectorTipoCategoria;
    }

    get usaSelectorMaterialCategoria(): boolean {
        return this.categoriaProductoActual === 'cristales';
    }

    get mostrarCampoMarca(): boolean {
        return true;
    }

    get usaSelectorMarcaCategoria(): boolean {
        return false;
    }

    get usaSelectorPresentacionCristal(): boolean {
        return this.esCristalConfigurableActual && this.opcionesPresentacionCristal.length > 0;
    }

    get mostrarCampoMaterialOtroCristal(): boolean {
        return this.esCristalConfigurableActual && String(this.producto?.material ?? '').trim() === 'Otro';
    }

    get mostrarCampoRangoFormulaLenteContacto(): boolean {
        return this.categoriaProductoActual === 'lentes de contacto' && this.esTipoLenteContactoFormulado(this.producto?.modelo);
    }

    get mostrarCampoMaterial(): boolean {
        return ['monturas', 'accesorios', 'estuches', 'liquidos'].includes(this.categoriaProductoActual);
    }

    get mostrarCampoColor(): boolean {
        return ['monturas', 'lentes de contacto', 'accesorios'].includes(this.categoriaProductoActual);
    }

    get mostrarCampoStock(): boolean {
        return this.categoriaControlaStock(this.categoriaProductoActual);
    }

    get costoLaboratorioEditableEnFormulario(): boolean {
        return !this.categoriaProductoActual || this.esCristalConfigurableActual;
    }

    get marcaEsObligatoria(): boolean {
        return false;
    }

    get presentacionCristalEsObligatoria(): boolean {
        return this.usaSelectorPresentacionCristal;
    }

    get stockEsObligatorio(): boolean {
        return this.mostrarCampoStock && !this.esCristalConfigurableActual;
    }

    get materialEsObligatorio(): boolean {
        return ['monturas', 'cristales'].includes(this.categoriaProductoActual);
    }

    get esCristalConfigurableActual(): boolean {
        return this.categoriaProductoActual === 'cristales';
    }

    get tipoCategoriaEsObligatorio(): boolean {
        return this.usaSelectorTipoCategoria;
    }

    get etiquetaTipoCategoria(): string {
        switch (this.categoriaProductoActual) {
            case 'cristales':
                return 'Tipo de cristal';
            case 'lentes de contacto':
                return 'Tipo de lente';
            default:
                return 'Tipo';
        }
    }

    get etiquetaMarcaCategoria(): string {
        return 'Marca';
    }

    get etiquetaPresentacionCristal(): string {
        return 'Presentación';
    }

    get etiquetaMaterialCategoria(): string {
        if (this.esCristalConfigurableActual) {
            return 'Material del cristal';
        }

        return this.usaSelectorMaterialCategoria ? 'Tipo de material' : 'Material';
    }

    get placeholderCategoriaProducto(): string {
        return 'Elige la familia comercial del producto';
    }

    get placeholderNombreProducto(): string {
        if (this.esCristalConfigurableActual) {
            return 'Puedes escribirlo manualmente o partir de la sugerencia con nomenclatura comercial de lista de precios';
        }

        return 'Puedes escribir un nombre manual o usar la sugerencia basada en la categoría';
    }

    get placeholderModeloCategoria(): string {
        switch (this.categoriaProductoActual) {
            case 'monturas':
                return 'Ej. Carrera 8847, Ray-Ban Erika';
            case 'liquidos':
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
                return 'Selecciona la familia comercial';
            case 'lentes de contacto':
                return 'Selecciona el tipo de lente';
            default:
                return 'Selecciona una opción';
        }
    }

    get placeholderMarcaCategoria(): string {
        switch (this.categoriaProductoActual) {
            case 'cristales':
                return 'Ej. Essilor, Hoya, Kodak';
            case 'monturas':
                return 'Ej. Ray-Ban, Vogue, Calvin Klein';
            case 'lentes de contacto':
                return 'Ej. Biomedics, Evolution';
            case 'liquidos':
                return 'Ej. Renu, Opti-Free';
            case 'estuches':
            case 'accesorios':
                return 'Ej. Genérico, Vision Case';
            default:
                return 'Marca comercial';
        }
    }

    get placeholderPresentacionCristal(): string {
        return this.usaSelectorPresentacionCristal
            ? 'Selecciona la presentación comercial'
            : 'Ingresa la presentación comercial';
    }

    get placeholderProveedorCategoria(): string {
        switch (this.categoriaProductoActual) {
            case 'cristales':
                return 'Ej. Imperio Optico, OPAS, Vector';
            case 'monturas':
                return 'Ej. Distribuidor oficial o importadora';
            default:
                return 'Nombre del proveedor o distribuidor';
        }
    }

    get etiquetaProveedorCategoria(): string {
        return this.categoriaProductoActual === 'cristales' ? 'Laboratorio' : 'Proveedor';
    }

    get iconoProveedorCategoria(): string {
        return this.categoriaProductoActual === 'cristales' ? 'bi-buildings' : 'bi-truck';
    }

    get ayudaProveedorCategoria(): string {
        return 'Usa el proveedor o distribuidor con el que gestionas esta referencia.';
    }

    get placeholderMaterialCategoria(): string {
        switch (this.categoriaProductoActual) {
            case 'cristales':
                return 'Selecciona el material base del cristal';
            case 'monturas':
                return 'Ej. Acetato, metal, titanio';
            case 'accesorios':
                return 'Ej. Silicona, microfibra, plástico';
            default:
                return 'Material del producto';
        }
    }

    get placeholderMaterialOtroCristal(): string {
        return 'Describe el material del cristal';
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
                return 'Notas comerciales u operativas visibles para el equipo sobre esta configuración.';
            case 'monturas':
                return 'Describe talla, estilo, detalles visuales o referencia interna.';
            default:
                return 'Agrega detalles útiles para identificar el producto más rápido.';
        }
    }

    get placeholderRangoFormulaCristal(): string {
        return 'Ej. Esf. +4.00 a -6.00 | Cil hasta -2.00';
    }

    get placeholderRangoFormulaLenteContacto(): string {
        return 'Ej. Esf. -8.00 a +6.00 | Cil hasta -2.75';
    }

    get placeholderStockCategoria(): string {
        switch (this.categoriaProductoActual) {
            case 'cristales':
                return 'Ej. 4 pares disponibles o 0 si no hay existencia';
            case 'monturas':
                return 'Ej. 12 unidades disponibles';
            case 'lentes de contacto':
                return 'Ej. 24 cajas disponibles';
            case 'liquidos':
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
            case 'lentes de contacto':
                return this.tiposLentesContactoDisponibles;
            default:
                return [];
        }
    }

    get opcionesMaterialCategoria(): OpcionSelect[] {
        return this.usaSelectorMaterialCategoria ? this.materialesDisponibles : [];
    }

    get opcionesPresentacionCristal(): OpcionSelect[] {
        if (!this.esCristalConfigurableActual) {
            return [];
        }

        return this.obtenerOpcionesPresentacionCristal(this.producto?.modelo);
    }

    get disponibilidadActualProducto(): ProductoEstadoDisponibilidad {
        return this.getDisponibilidadInventario(this.producto);
    }

    get tipoItemActualProducto(): ProductoTipoItem {
        return this.getTipoItemProducto(this.producto);
    }

    get estadoOperativoActualProducto(): ProductoEstadoOperativo {
        return this.getEstadoOperativoProducto(this.producto);
    }

    get mostrarAvisoStockReferenciaCristal(): boolean {
        return this.categoriaProductoActual === 'cristales';
    }

    get nombreProductoSugeridoActual(): string {
        return this.resolverNombreProducto(this.producto);
    }

    get naturalezaInventarioActualProducto(): string {
        return this.getNaturalezaInventarioLabel(this.producto);
    }

    esProductoCristalConfigurable(producto: Partial<Producto> | null | undefined): boolean {
        return this.normalizarCategoriaProducto(producto?.categoria) === 'cristales';
    }

    getTratamientosCristal(producto: Partial<Producto> | null | undefined): string[] {
        return Array.isArray(producto?.cristalConfig?.tratamientos)
            ? producto!.cristalConfig!.tratamientos
            : this.TRATAMIENTOS_CRISTAL_VACIOS;
    }

    getRangoFormulaCristal(producto: Partial<Producto> | null | undefined): string {
        return String(producto?.cristalConfig?.rangoFormula ?? '').trim();
    }

    getRangoFormulaLenteContacto(producto: Partial<Producto> | null | undefined): string {
        return String(producto?.lenteContactoConfig?.rangoFormula ?? '').trim();
    }

    getPresentacionCristal(producto: Partial<Producto> | null | undefined): string {
        const presentacion = String(producto?.cristalConfig?.presentacion ?? '').trim();
        if (presentacion) {
            return presentacion;
        }

        const marcaCristal = String(producto?.cristalConfig?.marca ?? '').trim();
        if (!marcaCristal && this.normalizarCategoriaProducto(producto?.categoria) === 'cristales') {
            return String(producto?.marca ?? '').trim();
        }

        return '';
    }

    getResumenConfiguracionCristal(producto: Partial<Producto> | null | undefined): string {
        const tratamientos = this.getTratamientosCristal(producto).join(' + ');
        const partes = [
            producto?.modelo?.trim(),
            this.getPresentacionCristal(producto),
            this.obtenerMaterialCristalDisplay(producto),
            tratamientos,
            this.getRangoFormulaCristal(producto),
            String(producto?.proveedor ?? '').trim()
        ].filter(Boolean);

        return partes.join(' | ');
    }

    getNombreProductoDisplay(producto: Partial<Producto> | null | undefined): string {
        const nombrePersistido = String(producto?.nombre ?? '').trim();
        return nombrePersistido || this.obtenerNombreProductoLineas(producto).join(' | ');
    }

    getNombreProductoDisplayMultilinea(producto: Partial<Producto> | null | undefined): string {
        const nombrePersistido = String(producto?.nombre ?? '').trim();
        return nombrePersistido || this.obtenerNombreProductoLineas(producto).join('\n');
    }

    getNombreProductoLineas(producto: Partial<Producto> | null | undefined): string[] {
        const lineas = this.obtenerNombreProductoLineas(producto);
        return lineas.length ? lineas : [''];
    }

    controlaStockProducto(producto: Partial<Producto> | null | undefined): boolean {
        return this.resolverControlaStock(producto);
    }

    getTipoItemProducto(producto: Partial<Producto> | null | undefined): ProductoTipoItem {
        if (!producto) {
            return 'desconocido';
        }

        return producto.tipoItem ?? normalizarClasificacionProducto(producto).tipoItem;
    }

    getEstadoOperativoProducto(producto: Partial<Producto> | null | undefined): ProductoEstadoOperativo {
        if (!producto) {
            return 'requiere_revision';
        }

        return producto.estadoOperativo ?? normalizarClasificacionProducto(producto).estadoOperativo;
    }

    getDisponibilidadInventario(producto: Partial<Producto> | null | undefined): ProductoEstadoDisponibilidad {
        if (!producto) {
            return 'catalogo_tecnico';
        }

        return producto.disponibilidadInventario ?? this.resolverDisponibilidadInventario(producto);
    }

    esInventarioPrincipalProducto(producto: Partial<Producto> | null | undefined): boolean {
        const tipoItem = this.getTipoItemProducto(producto);
        return tipoItem === 'inventariable' || tipoItem === 'base_formulado';
    }

    esCatalogoTecnicoProducto(producto: Partial<Producto> | null | undefined): boolean {
        return this.getTipoItemProducto(producto) === 'addon_tecnico';
    }

    getNaturalezaInventarioLabel(producto: Partial<Producto> | null | undefined): string {
        if (this.esCatalogoTecnicoProducto(producto)) {
            return 'Catalogo tecnico';
        }

        if (this.esInventarioPrincipalProducto(producto)) {
            return 'Inventario principal';
        }

        return 'Revision operativa';
    }

    getNaturalezaInventarioDescripcion(producto: Partial<Producto> | null | undefined): string {
        if (this.esCatalogoTecnicoProducto(producto)) {
            return 'Apoyo configurable del cristal final. No es la referencia principal de venta.';
        }

        if (this.esInventarioPrincipalProducto(producto)) {
            return 'Referencia principal visible en inventario y utilizable en venta.';
        }

        return 'Familia ambigua que debe revisarse antes de usarse como referencia operativa.';
    }

    getNaturalezaInventarioBadgeClass(producto: Partial<Producto> | null | undefined): string {
        if (this.esCatalogoTecnicoProducto(producto)) {
            return 'meta-pill--naturaleza-tecnica';
        }

        if (this.esInventarioPrincipalProducto(producto)) {
            return 'meta-pill--naturaleza-principal';
        }

        return 'meta-pill--revision';
    }

    getProveedorResumen(producto: Partial<Producto> | null | undefined): string {
        const valor = String(producto?.proveedor || '').trim();
        return valor || (this.getTipoItemProducto(producto) === 'base_formulado' ? 'Laboratorio no definido' : 'Proveedor no definido');
    }

    getClasificacionTitulo(producto: Partial<Producto> | null | undefined): string {
        const tipoItem = this.getTipoItemProducto(producto);
        return this.clasificacionesDisponibles.find(item => item.tipoItem === tipoItem)?.titulo ?? 'Revisión manual';
    }

    getClasificacionResumen(producto: Partial<Producto> | null | undefined): string {
        const tipoItem = this.getTipoItemProducto(producto);
        return this.clasificacionesDisponibles.find(item => item.tipoItem === tipoItem)?.resumen ?? 'Requiere revisión operativa.';
    }

    getClasificacionBadgeClass(producto: Partial<Producto> | null | undefined): string {
        const tipoItem = this.getTipoItemProducto(producto);
        return this.clasificacionesDisponibles.find(item => item.tipoItem === tipoItem)?.badgeClass ?? 'meta-pill--revision';
    }

    getEstadoOperativoLabel(producto: Partial<Producto> | null | undefined): string {
        switch (this.getEstadoOperativoProducto(producto)) {
            case 'listo_comercial':
                return 'Listo comercial';
            case 'listo_clinico':
                return 'Listo clínico';
            case 'dependencia_tecnica':
                return 'Dependencia técnica';
            default:
                return 'Requiere revisión';
        }
    }

    getEstadoOperativoBadgeClass(producto: Partial<Producto> | null | undefined): string {
        switch (this.getEstadoOperativoProducto(producto)) {
            case 'listo_comercial':
                return 'meta-pill--estado-comercial';
            case 'listo_clinico':
                return 'meta-pill--estado-clinico';
            case 'dependencia_tecnica':
                return 'meta-pill--estado-tecnico';
            default:
                return 'meta-pill--revision';
        }
    }

    getDisponibilidadLabel(producto: Partial<Producto> | null | undefined): string {
        switch (this.getDisponibilidadInventario(producto)) {
            case 'disponible':
                return 'Disponible';
            case 'agotado':
                return 'Agotado';
            default:
                return 'Catálogo técnico';
        }
    }

    getDisponibilidadDetalle(producto: Partial<Producto> | null | undefined): string {
        const disponibilidad = this.getDisponibilidadInventario(producto);
        const stock = Math.max(Number(producto?.stock ?? 0), 0);

        switch (disponibilidad) {
            case 'disponible':
                if (this.getTipoItemProducto(producto) === 'base_formulado') {
                    return `Cristal visible en inventario con ${stock} unidad(es) registradas.`;
                }
                return `${stock} unidad(es) disponibles para venta.`;
            case 'agotado':
                return 'Sin unidades disponibles para venta inmediata desde inventario.';
            default:
                return 'Referencia técnica disponible para clasificación, no como inventario principal.';
        }
    }

    getDisponibilidadBadgeClass(producto: Partial<Producto> | null | undefined): string {
        switch (this.getDisponibilidadInventario(producto)) {
            case 'disponible':
                return 'badge-disponibilidad--disponible';
            case 'agotado':
                return 'badge-disponibilidad--agotado';
            default:
                return 'badge-disponibilidad--catalogo';
        }
    }

    getDisponibilidadIcono(producto: Partial<Producto> | null | undefined): string {
        switch (this.getDisponibilidadInventario(producto)) {
            case 'disponible':
                return 'bi-check2-circle';
            case 'agotado':
                return 'bi-x-octagon';
            default:
                return 'bi-sliders';
        }
    }

    getStockTexto(producto: Partial<Producto> | null | undefined): string {
        const stock = Math.max(Number(producto?.stock ?? 0), 0);
        const disponibilidad = this.getDisponibilidadInventario(producto);

        if (disponibilidad === 'catalogo_tecnico') {
            return 'Catálogo sin stock operativo';
        }

        return `${stock} unidad(es)`;
    }

    getStockTextoClase(producto: Partial<Producto> | null | undefined): string {
        switch (this.getDisponibilidadInventario(producto)) {
            case 'disponible':
                return Math.max(Number(producto?.stock ?? 0), 0) <= this.STOCK_BAJO_LIMITE ? 'stock-bajo' : 'stock-alto';
            case 'agotado':
                return 'stock-agotado';
            default:
                return 'stock-informativo';
        }
    }

    productoTieneAlertaInventario(producto: Partial<Producto> | null | undefined): boolean {
        const disponibilidad = this.getDisponibilidadInventario(producto);
        const stock = Math.max(Number(producto?.stock ?? 0), 0);

        if (disponibilidad === 'agotado') {
            return true;
        }

        return this.controlaStockProducto(producto) && stock > 0 && stock <= this.STOCK_BAJO_LIMITE;
    }

    onCategoriaProductoModelChange(valor: string | null | Event): void {
        if (!this.producto) {
            return;
        }

        const categoria = typeof valor === 'string' || valor === null ? valor : null;

        this.actualizarProductoFormulario({
            ...this.producto,
            categoria: categoria ?? '',
            modelo: '',
            marca: '',
            material: '',
            color: '',
            proveedor: '',
            tipoItem: undefined,
            requiereFormula: undefined,
            requierePaciente: undefined,
            requiereHistoriaMedica: undefined,
            permiteFormulaExterna: undefined,
            requiereItemPadre: undefined,
            requiereProcesoTecnico: undefined,
            origenClasificacion: undefined,
            esClasificacionConfiable: undefined,
            clasificacionManual: undefined,
            estadoOperativo: undefined,
            controlaStock: undefined,
            disponibilidadInventario: undefined,
            cristalConfig: normalizarProductoCristalConfig(undefined),
            lenteContactoConfig: undefined
        });

        setTimeout(() => this.desplazarModalASeccionCategoria(), 60);
    }

    onCategoriaProductoOpen(): void {
        setTimeout(() => {
            this.desplazarModalHastaElemento(
                this.categoriaSelectRef?.nativeElement ?? this.seccionCategoriaRef?.nativeElement,
                20
            );
        }, 0);
    }

    onModeloProductoModelChange(valor: string | null | Event): void {
        if (!this.producto) {
            return;
        }

        const modelo: string | null = typeof valor === 'string' ? valor : null;
        const presentacionesDisponibles = this.obtenerOpcionesPresentacionCristal(modelo ?? '');
        const presentacionPorDefecto = presentacionesDisponibles.length === 1
            ? presentacionesDisponibles[0].label
            : '';

        this.actualizarProductoFormulario({
            ...this.producto,
            modelo: modelo ?? '',
            cristalConfig: this.esCristalConfigurableActual
                ? {
                    ...normalizarProductoCristalConfig(this.producto?.cristalConfig),
                    presentacion: presentacionPorDefecto
                }
                : this.producto?.cristalConfig,
            lenteContactoConfig: this.categoriaProductoActual === 'lentes de contacto'
                ? {
                    ...this.producto?.lenteContactoConfig,
                    rangoFormula: this.esTipoLenteContactoFormulado(modelo) ? this.getRangoFormulaLenteContacto(this.producto) : ''
                }
                : this.producto?.lenteContactoConfig
        });
    }

    onMaterialProductoModelChange(valor: string | null | Event): void {
        if (!this.producto) {
            return;
        }

        const material = typeof valor === 'string' || valor === null ? valor : null;

        this.actualizarProductoFormulario({
            ...this.producto,
            material: material ?? '',
            cristalConfig: {
                ...normalizarProductoCristalConfig(this.producto?.cristalConfig),
                materialOtro: material === 'Otro'
                    ? normalizarProductoCristalConfig(this.producto?.cristalConfig).materialOtro
                    : ''
            }
        });
    }

    onMaterialOtroCristalChange(valor: string | null | Event): void {
        if (!this.producto) {
            return;
        }

        const materialOtro = typeof valor === 'string' || valor === null ? valor : null;

        this.actualizarProductoFormulario({
            ...this.producto,
            cristalConfig: {
                ...normalizarProductoCristalConfig(this.producto?.cristalConfig),
                materialOtro: materialOtro ?? ''
            }
        });
    }

    onMarcaProductoModelChange(valor: string | null | Event): void {
        if (!this.producto) {
            return;
        }

        const marca = typeof valor === 'string' || valor === null ? valor : null;

        this.actualizarProductoFormulario({
            ...this.producto,
            marca: marca ?? ''
        });
    }

    onPresentacionCristalChange(valor: string | null | Event): void {
        if (!this.producto) {
            return;
        }

        const presentacion = typeof valor === 'string' || valor === null ? valor : null;

        this.actualizarProductoFormulario({
            ...this.producto,
            cristalConfig: {
                ...normalizarProductoCristalConfig(this.producto?.cristalConfig),
                presentacion: presentacion ?? ''
            }
        });
    }

    onTratamientosCristalModelChange(valor: string[] | null): void {
        if (!this.producto) {
            return;
        }

        this.actualizarProductoFormulario({
            ...this.producto,
            cristalConfig: {
                ...normalizarProductoCristalConfig(this.producto?.cristalConfig),
                tratamientos: valor ?? []
            }
        });
    }

    onRangoFormulaCristalChange(valor: string | null | Event): void {
        if (!this.producto) {
            return;
        }

        const rangoFormula = typeof valor === 'string' || valor === null ? valor : null;

        this.actualizarProductoFormulario({
            ...this.producto,
            cristalConfig: {
                ...normalizarProductoCristalConfig(this.producto?.cristalConfig),
                rangoFormula: rangoFormula ?? ''
            }
        });
    }

    onRangoFormulaLenteContactoChange(valor: string | null | Event): void {
        if (!this.producto) {
            return;
        }

        const rangoFormula = typeof valor === 'string' || valor === null ? valor : null;

        this.actualizarProductoFormulario({
            ...this.producto,
            lenteContactoConfig: {
                ...this.producto?.lenteContactoConfig,
                rangoFormula: rangoFormula ?? ''
            }
        });
    }

    onCostoLaboratorioCristalChange(valor: number | string | null): void {
        const costo = valor === null || valor === '' ? null : Number(valor);
        this.actualizarCostoLaboratorioCristalModelo(Number.isFinite(costo as number) && (costo as number) >= 0 ? Number(costo) : null);
    }

    onCategoriaProductoChange(): void {
        this.actualizarProductoFormulario({
            ...this.producto,
            categoria: this.producto?.categoria ?? ''
        });
    }

    onModeloTextoProductoChange(valor: string | null | Event): void {
        if (!this.producto) {
            return;
        }

        const modelo = typeof valor === 'string' || valor === null ? valor : null;

        this.actualizarProductoFormulario({
            ...this.producto,
            modelo: modelo ?? ''
        });
    }

    onNombreProductoModelChange(valor: string | null | Event): void {
        if (!this.producto) {
            return;
        }

        const nombre = typeof valor === 'string' || valor === null
            ? valor ?? ''
            : (valor.target as HTMLTextAreaElement | null)?.value ?? '';

        const nombreNormalizado = String(nombre).trim();

        if (!nombreNormalizado) {
            this.nombreProductoPersonalizado = false;
            this.actualizarProductoFormulario({
                ...this.producto,
                nombre: ''
            });
            return;
        }

        this.nombreProductoPersonalizado = true;
        this.producto = this.enriquecerProductoInventario({
            ...this.normalizarCamposSegunCategoria({
                ...this.producto,
                nombre: nombreNormalizado
            }),
            nombre: nombreNormalizado
        });
    }

    onDescripcionProductoModelChange(valor: string | null | Event): void {
        if (!this.producto) {
            return;
        }

        const descripcion = typeof valor === 'string' || valor === null
            ? valor ?? ''
            : (valor.target as HTMLTextAreaElement | null)?.value ?? '';

        const descripcionNormalizada = String(descripcion).trim();

        if (!descripcionNormalizada) {
            this.descripcionProductoPersonalizada = false;
            this.actualizarProductoFormulario({
                ...this.producto,
                descripcion: ''
            });
            return;
        }

        this.descripcionProductoPersonalizada = true;
        this.producto = this.enriquecerProductoInventario({
            ...this.normalizarCamposSegunCategoria({
                ...this.producto,
                descripcion: descripcionNormalizada
            }),
            descripcion: descripcionNormalizada
        });
        this.programarAjusteDescripcionTextarea();
    }

    usarNombreSugerido(): void {
        if (!this.producto) {
            return;
        }

        this.nombreProductoPersonalizado = false;
        this.actualizarProductoFormulario({
            ...this.producto,
            nombre: ''
        });
    }

    private normalizarCamposSegunCategoria(producto: Producto): Producto {
        const categoria = this.normalizarCategoriaProducto(producto?.categoria);
        const siguiente = {
            ...producto,
            categoria: this.obtenerCategoriaVisual(producto?.categoria)
        };

        if (this.categoriaUsaSelectorModelo(categoria)) {
            if (!this.valorPerteneceAOpciones(siguiente.modelo, this.obtenerOpcionesModeloPorCategoria(categoria))) {
                siguiente.modelo = '';
            }
        }

        if (categoria === 'cristales') {
            const opcionesPresentacion = this.obtenerOpcionesPresentacionCristal(siguiente.modelo);
            const presentacionActual = this.getPresentacionCristal(siguiente);

            if (opcionesPresentacion.length === 1) {
                siguiente.cristalConfig = {
                    ...normalizarProductoCristalConfig(siguiente.cristalConfig),
                    presentacion: opcionesPresentacion[0].label
                };
            } else if (opcionesPresentacion.length > 0 && !this.valorPerteneceAOpciones(presentacionActual, opcionesPresentacion)) {
                siguiente.cristalConfig = {
                    ...normalizarProductoCristalConfig(siguiente.cristalConfig),
                    presentacion: ''
                };
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

        if (categoria === 'cristales' && siguiente.material !== 'Otro') {
            siguiente.cristalConfig = {
                ...normalizarProductoCristalConfig(siguiente.cristalConfig),
                materialOtro: ''
            };
        }

        if (!this.debeMostrarColorSegunCategoria(categoria)) {
            siguiente.color = '';
        }

        if (!this.categoriaControlaStock(categoria)) {
            siguiente.stock = 0;
        }

        siguiente.cristalConfig = categoria === 'cristales' || !categoria
            ? normalizarProductoCristalConfig(siguiente.cristalConfig)
            : undefined;

        return siguiente;
    }

    private sincronizarNombreProducto(producto: Producto): Producto {
        return {
            ...producto,
            nombre: this.resolverNombreProducto(producto)
        };
    }

    private sincronizarDescripcionProducto(producto: Producto): Producto {
        return {
            ...producto,
            descripcion: this.resolverDescripcionProducto(producto)
        };
    }

    private actualizarProductoFormulario(producto: Producto): void {
        const productoNormalizado = this.normalizarCamposSegunCategoria(producto);
        const mantenerNombreManual = this.nombreProductoPersonalizado && this.tieneNombrePersonalizado(productoNormalizado);
        const productoConNombre = mantenerNombreManual
            ? {
                ...productoNormalizado,
                nombre: String(productoNormalizado.nombre ?? '').trim()
            }
            : this.sincronizarNombreProducto(productoNormalizado);
        this.nombreProductoPersonalizado = mantenerNombreManual;
        const productoConDescripcion = this.descripcionProductoPersonalizada
            ? {
                ...productoConNombre,
                descripcion: String(productoConNombre.descripcion ?? '').trim()
            }
            : this.sincronizarDescripcionProducto(productoConNombre);

        this.producto = this.enriquecerProductoInventario(productoConDescripcion);
        this.programarAjusteDescripcionTextarea();
    }

    private programarAjusteDescripcionTextarea(): void {
        setTimeout(() => this.ajustarAlturaDescripcionTextarea());
    }

    private ajustarAlturaDescripcionTextarea(): void {
        const textarea = this.descripcionTextareaRef?.nativeElement;

        if (!textarea) {
            return;
        }

        textarea.style.height = '48px';
        textarea.style.height = `${Math.max(textarea.scrollHeight, 48)}px`;
    }

    private desplazarModalASeccionCategoria(): void {
        this.desplazarModalHastaElemento(this.seccionCategoriaRef?.nativeElement, 20);
    }

    private desplazarModalHastaElemento(elemento: HTMLElement | undefined, margenSuperior: number): void {
        const contenedor = this.modalBodyRef?.nativeElement;

        if (!contenedor || !elemento) {
            return;
        }

        const contenedorRect = contenedor.getBoundingClientRect();
        const elementoRect = elemento.getBoundingClientRect();
        const destino = contenedor.scrollTop + (elementoRect.top - contenedorRect.top) - margenSuperior;

        contenedor.scrollTo({
            top: Math.max(destino, 0),
            behavior: 'smooth'
        });
    }

    private tieneNombrePersonalizado(producto: Partial<Producto> | null | undefined): boolean {
        const nombreActual = String(producto?.nombre ?? '').trim();

        if (!nombreActual) {
            return false;
        }

        const productoSinNombre = {
            ...producto,
            nombre: ''
        };
        const nombreSugerido = this.resolverNombreProducto(productoSinNombre);

        if (this.normalizarNombreComparable(nombreActual) === this.normalizarNombreComparable(nombreSugerido)) {
            return false;
        }

        return !this.esNombreAutomaticoLegacy(productoSinNombre, nombreActual);
    }

    private esNombreAutomaticoLegacy(producto: Partial<Producto> | null | undefined, nombreActual: string): boolean {
        const categoria = this.obtenerCategoriaVisual(producto?.categoria);
        const categoriaNormalizada = this.normalizarCategoriaProducto(categoria);
        const nombreComparable = this.normalizarNombreComparable(nombreActual);

        if (!categoria || !nombreComparable) {
            return false;
        }

        const variantesLegacy: string[] = [];

        if (categoriaNormalizada === 'monturas') {
            variantesLegacy.push(
                [categoria, producto?.marca?.trim(), producto?.modelo?.trim(), producto?.color?.trim()]
                    .filter(Boolean)
                    .join(' '),
                [categoria, producto?.marca?.trim(), producto?.modelo?.trim()]
                    .filter(Boolean)
                    .join(' ')
            );
        }

        if (['estuches', 'accesorios'].includes(categoriaNormalizada)) {
            variantesLegacy.push(
                [categoria, producto?.modelo?.trim()]
                    .filter(Boolean)
                    .join(' '),
                [categoria, producto?.marca?.trim(), producto?.modelo?.trim()]
                    .filter(Boolean)
                    .join(' ')
            );
        }

        return variantesLegacy
            .map(item => this.normalizarNombreComparable(item))
            .filter(Boolean)
            .includes(nombreComparable);
    }

    private normalizarNombreComparable(valor: string | null | undefined): string {
        return String(valor ?? '')
            .replace(/[-|]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    }

    private tieneDescripcionPersonalizada(producto: Partial<Producto> | null | undefined): boolean {
        const descripcionActual = String(producto?.descripcion ?? '').trim();

        if (!descripcionActual) {
            return false;
        }

        return descripcionActual !== this.resolverDescripcionProducto({
            ...producto,
            descripcion: ''
        });
    }

    private resolverControlaStock(producto: Partial<Producto> | null | undefined): boolean {
        if (!producto) {
            return false;
        }

        const clasificacion = normalizarClasificacionProducto(producto);
        return clasificacion.tipoItem === 'inventariable' || clasificacion.tipoItem === 'base_formulado';
    }

    private resolverDisponibilidadInventario(producto: Partial<Producto> | null | undefined): ProductoEstadoDisponibilidad {
        if (!this.resolverControlaStock(producto)) {
            return 'catalogo_tecnico';
        }

        const stock = Math.max(Number(producto?.stock ?? 0), 0);

        if (stock > 0) {
            return 'disponible';
        }

        return 'agotado';
    }

    private resolverNombreProducto(producto: Partial<Producto> | null | undefined): string {
        const categoria = this.obtenerCategoriaVisual(producto?.categoria);
        if (!categoria) {
            return '';
        }

        const categoriaNormalizada = this.normalizarCategoriaProducto(categoria);

        if (categoriaNormalizada === 'cristales') {
            return this.obtenerNombreProductoLineas(producto).join(' | ');
        }

        const nombreBase = this.resolverNombreProductoBase(producto, categoria, categoriaNormalizada);
        if (nombreBase) {
            return nombreBase;
        }

        const tipo = this.obtenerTipoParaNombre(producto, categoriaNormalizada);
        return [categoria, tipo].filter(Boolean).join(' - ');
    }

    private resolverDescripcionProducto(producto: Partial<Producto> | null | undefined): string {
        const categoriaNormalizada = this.normalizarCategoriaProducto(producto?.categoria);

        if (categoriaNormalizada === 'monturas') {
            const partes = [
                this.construirEtiquetaProducto('Montura', [producto?.marca, producto?.modelo]),
                this.construirDetalleDescripcion('color', producto?.color),
                this.construirDetalleDescripcion('material', producto?.material),
                this.construirDetalleDescripcion('proveedor', producto?.proveedor)
            ].filter(Boolean);

            return this.finalizarDescripcionProducto(partes, 'Montura');
        }

        if (categoriaNormalizada === 'lentes de contacto') {
            const partes = [
                this.construirEtiquetaProducto('Lente de contacto', [producto?.marca, this.obtenerTipoParaNombre(producto, categoriaNormalizada)]),
                this.construirDetalleDescripcion('color', producto?.color),
                this.construirDetalleDescripcion('proveedor', producto?.proveedor)
            ];

            if (this.esTipoLenteContactoFormulado(producto?.modelo)) {
                partes.push(this.construirDetalleDescripcion('rango de formula', this.getRangoFormulaLenteContacto(producto)));
            }

            return this.finalizarDescripcionProducto(partes.filter(Boolean), 'Lente de contacto');
        }

        if (categoriaNormalizada !== 'cristales') {
            return this.finalizarDescripcionProducto([
                this.construirEtiquetaProducto(this.obtenerCategoriaVisual(producto?.categoria) || 'Producto', [producto?.marca, producto?.modelo]),
                this.construirDetalleDescripcion('material', producto?.material),
                this.construirDetalleDescripcion('color', producto?.color),
                this.construirDetalleDescripcion('proveedor', producto?.proveedor)
            ].filter(Boolean), this.obtenerCategoriaVisual(producto?.categoria) || 'Producto');
        }

        const tipo = this.obtenerTipoCristalDescripcion(producto?.modelo);
        const presentacion = this.obtenerPresentacionCristalDescripcion(producto?.modelo, this.getPresentacionCristal(producto));
        const material = this.obtenerMaterialCristalDescripcion(this.obtenerMaterialCristalDisplay(producto));
        const tratamientos = this.getTratamientosCristal(producto)
            .map(tratamiento => this.obtenerTratamientoCristalDescripcion(tratamiento))
            .filter(Boolean)
            .map(item => item.toLowerCase());
        const rangoFormula = this.getRangoFormulaCristal(producto);

        const partes: string[] = [];
        const tipoDetallado = [tipo, presentacion].filter(Boolean).join(' ');

        partes.push(tipoDetallado
            ? `Cristal ${tipoDetallado.toLowerCase()}`
            : 'Cristal formulado');

        if (material) {
            partes.push(`en material ${material.toLowerCase()}`);
        }

        if (tratamientos.length) {
            partes.push(`con ${this.unirListadoTexto(tratamientos, 'y')}`);
        }

        if (rangoFormula) {
            partes.push(`para rango de formula ${rangoFormula}`);
        }

        return `${partes.join(', ')}.`.replace(/\s+,/g, ',').replace(/\.+$/, '.');
    }

    private obtenerNombreProductoLineas(producto: Partial<Producto> | null | undefined): string[] {
        if (!producto) {
            return [];
        }

        const categoria = this.obtenerCategoriaVisual(producto?.categoria);
        const categoriaNormalizada = this.normalizarCategoriaProducto(categoria);

        if (categoriaNormalizada !== 'cristales') {
            const nombre = this.resolverNombreProductoBase(producto, categoria, categoriaNormalizada);
            return nombre ? [nombre] : [];
        }

        const tipo = this.obtenerTipoCristalListaPrecios(producto?.modelo);
        const presentacion = this.obtenerPresentacionCristalListaPrecios(producto?.modelo, this.getPresentacionCristal(producto));
        const material = this.obtenerMaterialCristalListaPrecios(this.obtenerMaterialCristalDisplay(producto));
        const tratamientos = this.getTratamientosCristal(producto)
            .map(tratamiento => this.obtenerTratamientoCristalListaPrecios(tratamiento))
            .filter(Boolean);
        const rangoFormula = this.formatearRangoCristalListaPrecios(this.getRangoFormulaCristal(producto));

        return [[tipo, presentacion, material, ...tratamientos, rangoFormula]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()]
            .filter(Boolean);
    }

    private resolverNombreProductoBase(
        producto: Partial<Producto> | null | undefined,
        categoria: string,
        categoriaNormalizada: string
    ): string {
        if (!producto) {
            return '';
        }

        const modelo = categoriaNormalizada === 'lentes de contacto'
            ? this.obtenerTipoParaNombre(producto, categoriaNormalizada)
            : producto?.modelo?.trim();

        const material = producto?.material?.trim();

        return [categoria, producto?.marca?.trim(), modelo, material]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    }

    private esTipoLenteContactoFormulado(valor: string | null | undefined): boolean {
        return String(valor ?? '').trim().toLowerCase().includes('formulado');
    }

    private construirEtiquetaProducto(prefijo: string, valores: Array<string | null | undefined>): string {
        const detalle = valores
            .map(valor => String(valor ?? '').trim())
            .filter(Boolean)
            .join(' ')
            .trim();

        return detalle ? `${prefijo} ${detalle}` : prefijo;
    }

    private construirDetalleDescripcion(etiqueta: string, valor: string | null | undefined): string {
        const texto = String(valor ?? '').trim();
        return texto ? `${etiqueta} ${texto}` : '';
    }

    private finalizarDescripcionProducto(partes: string[], fallback: string): string {
        if (!partes.length) {
            return `${fallback}.`;
        }

        return `${partes.join(', ')}.`.replace(/\s+,/g, ',').replace(/\.+$/, '.');
    }

    private abreviarTipoCristal(valor: string | null | undefined): string {
        const opcion = this.tiposCristalesDisponibles.find(item => item.label === String(valor ?? '').trim() || item.value === String(valor ?? '').trim());
        const clave = String(opcion?.value ?? valor ?? '').trim().toUpperCase();
        return this.TIPO_CRISTAL_ABREVIATURAS[clave] || String(valor ?? '').trim();
    }

    private obtenerTipoCristalListaPrecios(valor: string | null | undefined): string {
        const opcion = this.tiposCristalesDisponibles.find(item => item.label === String(valor ?? '').trim() || item.value === String(valor ?? '').trim());
        const clave = String(opcion?.value ?? valor ?? '').trim().toUpperCase();
        return this.TIPO_CRISTAL_LISTA_PRECIOS[clave] || String(valor ?? '').trim().toUpperCase();
    }

    private obtenerTipoCristalDescripcion(valor: string | null | undefined): string {
        const opcion = this.tiposCristalesDisponibles.find(item => item.label === String(valor ?? '').trim() || item.value === String(valor ?? '').trim());
        return String(opcion?.label ?? valor ?? '').trim();
    }

    private abreviarMaterialCristal(valor: string | null | undefined): string {
        const opcion = this.materialesDisponibles.find(item => item.label === String(valor ?? '').trim() || item.value === String(valor ?? '').trim());
        const clave = String(opcion?.value ?? valor ?? '').trim().toUpperCase();
        return this.MATERIAL_CRISTAL_ABREVIATURAS[clave] || String(valor ?? '').trim();
    }

    private obtenerMaterialCristalListaPrecios(valor: string | null | undefined): string {
        const opcion = this.materialesDisponibles.find(item => item.label === String(valor ?? '').trim() || item.value === String(valor ?? '').trim());
        const clave = String(opcion?.value ?? valor ?? '').trim().toUpperCase();

        if (clave === 'OTRO') {
            return String(valor ?? '').trim().toUpperCase();
        }

        return this.MATERIAL_CRISTAL_LISTA_PRECIOS[clave] || String(valor ?? '').trim().toUpperCase();
    }

    private obtenerMaterialCristalDescripcion(valor: string | null | undefined): string {
        const opcion = this.materialesDisponibles.find(item => item.label === String(valor ?? '').trim() || item.value === String(valor ?? '').trim());
        return String(opcion?.label ?? valor ?? '').trim();
    }

    private obtenerMaterialCristalDisplay(producto: Partial<Producto> | null | undefined): string {
        const material = String(producto?.material ?? '').trim();

        if (material === 'Otro') {
            return String(producto?.cristalConfig?.materialOtro ?? '').trim() || material;
        }

        return material;
    }

    private abreviarTratamientoCristal(valor: string | null | undefined): string {
        const opcion = this.tratamientosDisponibles.find(item => item.label === String(valor ?? '').trim() || item.value === String(valor ?? '').trim());
        const clave = String(opcion?.value ?? valor ?? '').trim().toUpperCase();
        return this.TRATAMIENTO_CRISTAL_ABREVIATURAS[clave] || String(valor ?? '').trim();
    }

    private obtenerTratamientoCristalListaPrecios(valor: string | null | undefined): string {
        const opcion = this.tratamientosDisponibles.find(item => item.label === String(valor ?? '').trim() || item.value === String(valor ?? '').trim());
        const clave = String(opcion?.value ?? valor ?? '').trim().toUpperCase();
        return this.TRATAMIENTO_CRISTAL_LISTA_PRECIOS[clave] || String(valor ?? '').trim().toUpperCase();
    }

    private obtenerTratamientoCristalDescripcion(valor: string | null | undefined): string {
        const opcion = this.tratamientosDisponibles.find(item => item.label === String(valor ?? '').trim() || item.value === String(valor ?? '').trim());
        return String(opcion?.label ?? valor ?? '').trim();
    }

    private obtenerPresentacionCristalListaPrecios(
        tipoCristal: string | null | undefined,
        valor: string | null | undefined
    ): string {
        const opcionesPresentacion = this.obtenerOpcionesPresentacionCristal(tipoCristal);
        const opcion = opcionesPresentacion.find(item => item.label === String(valor ?? '').trim() || item.value === String(valor ?? '').trim());
        const clave = String(opcion?.value ?? valor ?? '').trim().toUpperCase().replace(/\s+/g, '_');
        return this.PRESENTACION_CRISTAL_LISTA_PRECIOS[clave] || String(valor ?? '').trim().toUpperCase();
    }

    private obtenerPresentacionCristalDescripcion(
        tipoCristal: string | null | undefined,
        valor: string | null | undefined
    ): string {
        const opcionesPresentacion = this.obtenerOpcionesPresentacionCristal(tipoCristal);
        const opcion = opcionesPresentacion.find(item => item.label === String(valor ?? '').trim() || item.value === String(valor ?? '').trim());
        return String(opcion?.label ?? valor ?? '').trim();
    }

    private formatearRangoCristalListaPrecios(valor: string | null | undefined): string {
        const texto = String(valor ?? '').trim();
        if (!texto) {
            return '';
        }

        return texto
            .toUpperCase()
            .replace(/PLANO/g, 'PL.')
            .replace(/\bPL\b/g, 'PL.')
            .replace(/\s+/g, ' ')
            .replace(/\s*\+\/\-\s*/g, ' +/- ')
            .replace(/\s*\+\s*/g, ' +')
            .replace(/\s*-\s*/g, ' -')
            .trim();
    }

    private unirListadoTexto(items: string[], conjuncion: string): string {
        if (!items.length) {
            return '';
        }

        if (items.length === 1) {
            return items[0];
        }

        if (items.length === 2) {
            return `${items[0]} ${conjuncion} ${items[1]}`;
        }

        return `${items.slice(0, -1).join(', ')} ${conjuncion} ${items[items.length - 1]}`;
    }

    private abreviarRangoCristal(valor: string | null | undefined): string {
        const texto = String(valor ?? '').trim();
        if (!texto) {
            return '';
        }

        return texto
            .replace('Plano a ', 'PL a ')
            .replace('Cualquier esfera', 'Esf. lib.')
            .replace(' o más', '+')
            .replace(' | Cil hasta ', ' | Cil<=')
            .replace(' | Cil ', ' | Cil ')
            .replace(' a -', ' a -')
            .replace('Caso especial / laboratorio', 'RX Esp. Lab.');
    }

    private categoriaControlaStock(categoria: string): boolean {
        const categoriaNormalizada = this.normalizarCategoriaProducto(categoria);
        return ['monturas', 'cristales', 'lentes de contacto', 'liquidos', 'estuches', 'accesorios'].includes(categoriaNormalizada);
    }

    private obtenerOpcionesPresentacionCristal(tipo: string | null | undefined): OpcionSelect[] {
        const opcion = this.tiposCristalesDisponibles.find(item => item.label === String(tipo ?? '').trim() || String(item.value) === String(tipo ?? '').trim());
        const clave = String(opcion?.value ?? tipo ?? '').trim().toUpperCase();

        return this.PRESENTACIONES_CRISTAL_POR_TIPO[clave] ?? [];
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
        return ['cristales', 'lentes de contacto'].includes(categoria);
    }

    private categoriaUsaSelectorMaterial(categoria: string): boolean {
        return categoria === 'cristales';
    }

    private debeMostrarMarcaSegunCategoria(categoria: string): boolean {
        return true;
    }

    private debeMostrarModeloTextoSegunCategoria(categoria: string): boolean {
        return !this.categoriaUsaSelectorModelo(categoria);
    }

    private debeMostrarMaterialSegunCategoria(categoria: string): boolean {
        return ['monturas', 'accesorios', 'estuches', 'liquidos'].includes(categoria);
    }

    private debeMostrarColorSegunCategoria(categoria: string): boolean {
        return ['monturas', 'lentes de contacto', 'accesorios'].includes(categoria);
    }

    private obtenerOpcionesModeloPorCategoria(categoria: string): OpcionSelect[] {
        switch (categoria) {
            case 'cristales':
                return this.tiposCristalesDisponibles;
            case 'lentes de contacto':
                return this.tiposLentesContactoDisponibles;
            default:
                return [];
        }
    }

    private obtenerDescripcionPersistencia(producto: Producto): string {
        return String(producto.descripcion ?? '').trim();
    }

    private debeMostrarProductoEnReestructuracion(producto: Partial<Producto> | null | undefined): boolean {
        const categoria = this.normalizarCategoriaProducto(producto?.categoria);
        return !['materiales', this.CATEGORIA_FILTROS_ADITIVOS_NORMALIZADA].includes(categoria);
    }

    private normalizarCategoriaProducto(categoria: unknown): string {
        const categoriaNormalizada = normalizarTextoClasificacion(categoria);

        if (['filtro', 'filtros', 'aditivo', 'aditivos', 'filtro/aditivos', 'filtros/aditivos'].includes(categoriaNormalizada)) {
            return this.CATEGORIA_FILTROS_ADITIVOS_NORMALIZADA;
        }

        return categoriaNormalizada;
    }

    private obtenerCategoriaVisual(categoria: unknown): string {
        const categoriaNormalizada = this.normalizarCategoriaProducto(categoria);

        if (!categoriaNormalizada) {
            return '';
        }

        return String(categoria ?? '').trim();
    }

    private valorPerteneceAOpciones(valor: string | undefined, opciones: OpcionSelect[]): boolean {
        if (!valor) {
            return false;
        }

        return opciones.some(opcion => opcion.label === valor || String(opcion.value) === valor);
    }
}