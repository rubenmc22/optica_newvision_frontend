import { Component, OnInit } from '@angular/core';
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
    // CONSTANTES
    private readonly PRODUCTOS_POR_PAGINA = 12;
    private readonly RANGO_PAGINACION = 3;

    // ESTADO DEL COMPONENTE
    productos: Producto[] = [];
    mostrarModal = false;
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

    // CATÁLOGOS
    tiposProducto: string[] = ['Montura', 'Lente', 'Líquido', 'Estuche', 'Accesorio'];
    imagenesPorTipo: Record<Producto['tipo'], string> = {
        lente: 'assets/cristales.jpg',
        montura: 'assets/montura_2.avif',
        estuche: 'assets/estuches.jpg',
        liquido: 'assets/liquido.webp',
        accesorio: 'assets/accesorios.jpg',
    };

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
        this.productoSeleccionado = producto;
        this.mostrarModal = true;
    }

    cerrarModal(): void {
        this.mostrarModal = false;
        this.productoSeleccionado = undefined;
    }

    guardarProducto(producto: Producto): void {
        if (this.modoModal === 'agregar') {
            this.productoService.agregarProducto(producto);
        } else if (this.modoModal === 'editar') {
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
                p.tipo.toLowerCase() === this.tipoSeleccionado.toLowerCase();
            const coincideEstado = this.estadoSeleccionado === null ||
                p.activo === this.estadoSeleccionado;
            return coincideTexto && coincideTipo && coincideEstado;
        });
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
            tipo: 'montura',
            marca: '',
            color: '',
            codigo: '',
            material: '',
            proveedor: '',
            categoria: '',
            stock: 0,
            precio: 0,
            moneda: 'usd',
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

    obtenerImagen(tipo: Producto['tipo']): string {
        const imagenes = {
            montura: 'assets/montura_2.avif',
            lente: 'assets/montura_1.png',
            liquido: 'assets/montura_3.jpg',
            estuche: 'assets/montura_1.png',
            accesorio: 'assets/montura_2.avif'
        };
        return imagenes[tipo] ?? 'assets/default.jpg';
    }

    // =========== DATOS DE PRUEBA ===========
    generarProductosDummy(cantidad: number): Producto[] {
        const tipos: Producto['tipo'][] = ['montura', 'lente', 'liquido', 'estuche', 'accesorio'];
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
}