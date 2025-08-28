import { Component, OnInit, Output, EventEmitter, } from '@angular/core';
import { Producto } from '../producto.model';
import { ProductoService } from '../producto.service';
import { TasaCambiariaService } from '../../../core/services/tasaCambiaria/tasaCambiaria.service';
import { Tasa } from '../../../Interfaces/models-interface';

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

    // FILTROS
    filtroBusqueda = '';
    tipoSeleccionado = '';
    estadoSeleccionado: boolean = true;
    sedeActiva: string = '';
    sedeFiltro: string = this.sedeActiva;
    filtro: string = '';
    categoriaAbierto = false;


    // CATÁLOGOS
    categoriasProducto: string[] = ['Monturas', 'Lentes', 'Líquidos', 'Estuches', 'Misceláneos', 'Lentes de contacto'];
    moneda: string[] = ['USD', 'VES'];
    imagenesPorTipo: Record<Producto['categoria'], string> = {
        lente: 'assets/cristales.jpg',
        montura: 'assets/montura_2.avif',
        estuche: 'assets/estuches.jpg',
        liquido: 'assets/liquido.webp',
        accesorio: 'assets/accesorios.jpg',
    };

    //MODAL
    modo: 'agregar' | 'editar' | 'ver' = 'agregar'; // ✅ para definir el contexto
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
        private tasaCambiariaService: TasaCambiariaService
    ) { }

    // =========== LIFECYCLE HOOKS ===========
    ngOnInit(): void {
        this.cargarDatosIniciales();
        this.productoOriginal = { ...this.producto };
    }

    private cargarDatosIniciales(): void {
        const productosRecibidos = this.productoService.getProductos();
        this.productos = productosRecibidos?.length ? productosRecibidos : this.generarProductosDummy(1000);
        this.obtenerTasasCambio();
    }

    // =========== GESTIÓN DE DATOS ===========
    private obtenerTasasCambio(): void {
        this.tasaCambiariaService.getTasaActual().subscribe({
            next: (res: { tasas: Tasa[] }) => {
                this.tasaDolar = res.tasas.find(t => t.id === 'dolar')?.valor ?? 0;
                this.tasaEuro = res.tasas.find(t => t.id === 'euro')?.valor ?? 0;
            },
            error: () => {
                this.tasaDolar = 0;
                this.tasaEuro = 0;
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

    // =========== GESTIÓN DE MODAL ===========
    abrirModal(modo: 'agregar' | 'editar' | 'ver', producto?: Producto): void {
        this.modoModal = modo;
        const base = producto ?? this.crearProductoVacio();
        this.productoSeleccionado = base;
        this.producto = { ...base }; // 🔹 Así el ngModel en la vista usa un objeto con activo = true

        this.mostrarModal = true;
        document.body.classList.add('modal-open');
    }


    cerrarModal(): void {
        this.mostrarModal = false;
        this.productoSeleccionado = undefined;
        document.body.classList.remove('modal-open'); // restaura scroll
    }

    guardarProducto(): void {
        const producto = this.productoSeguro;

        console.log('Guardando:', producto);

        if (this.modoModal === 'agregar') {
            this.productoService.agregarProducto(producto);
        } else {
            this.productoService.editarProducto(producto);
        }

        this.productos = this.productoService.getProductos();
        this.cerrarModal();
    }



    // =========== FILTRADO Y BÚSQUEDA ===========
    limpiarFiltros(): void {
        this.filtroBusqueda = '';
        this.tipoSeleccionado = '';
        this.estadoSeleccionado = true;
    }

    get productosFiltrados(): Producto[] {
        return this.productos.filter(p => {
            const texto = this.filtroBusqueda.toLowerCase();
            const coincideTexto = p.nombre.toLowerCase().includes(texto) ||
                p.codigo.toLowerCase().includes(texto);
            const coincideTipo = !this.tipoSeleccionado ||
                p.categoria.toLowerCase() === this.tipoSeleccionado.toLowerCase();
            const coincideEstado = this.estadoSeleccionado === null ||
                p.activo === this.estadoSeleccionado;
            return coincideTexto && coincideTipo && coincideEstado;
        });
    }

    ngOnChanges() {
        if (this.mostrarModal) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
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
            nombre: '',
            marca: '',
            color: '',
            codigo: '',
            material: '',
            proveedor: '',
            categoria: null as any, // antes era ''
            stock: 0,
            precio: 0,
            moneda: null as any,    // antes era ''
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


    // =========== DATOS DE PRUEBA ===========
    generarProductosDummy(cantidad: number): Producto[] {
        const tipos: Producto['categoria'][] = ['montura', 'lente', 'liquido', 'estuche', 'accesorio'];
        const marcas = ['VisionPro', 'OptiClear', 'LentiMax', 'FocusOne'];
        const proveedores = ['Distribuidora Global', 'Óptica Center', 'LensSupreme'];
        const categorias = ['Visual', 'Estética', 'Mantenimiento'];
        const colores = ['Negro', 'Azul', 'Rojo', 'Transparente'];
        const monedas: Producto['moneda'][] = ['usd', 'eur', 'ves'];

        return Array.from({ length: cantidad }, (_, i) => {
            const tipoActual = tipos[i % tipos.length];
            return {
                id: (i + 1).toString(),
                nombre: `Producto ${i + 1}`,
                tipo: tipoActual,
                categoria: categorias[i % categorias.length],
                proveedor: proveedores[i % proveedores.length],
                marca: marcas[i % marcas.length],
                codigo: `NV-${String(i + 1).padStart(5, '0')}`,
                color: colores[i % colores.length],
                material: 'Acetato',
                moneda: monedas[i % monedas.length],
                stock: Math.floor(Math.random() * 50),
                precio: parseFloat((Math.random() * 100).toFixed(2)),
                activo: Math.random() > 0.2,
                descripcion: 'Producto simulado para pruebas.',
                imagenUrl: this.imagenesPorTipo[tipoActual],
                fechaIngreso: '2025-07-27'
            };
        });
    }

    getProfileImage(): string {
        return this.avatarPreview || this.user.ruta_imagen || 'assets/avatar-placeholder.avif';
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

}