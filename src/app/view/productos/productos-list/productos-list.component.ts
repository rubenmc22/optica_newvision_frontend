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
    productos: Producto[] = [];
    mostrarModal: boolean = false;
    modoModal: 'agregar' | 'editar' | 'ver' = 'agregar';
    productoSeleccionado?: Producto;

    // Tasas cambiarias
    tasaDolar: number = 0;
    tasaEuro: number = 0;

    // Paginación
    paginaActual: number = 1;
    productosPorPagina: number = 12;

    constructor(
        private productoService: ProductoService,
        private tasaCambiariaService: TasaCambiariaService
    ) { }

    ngOnInit(): void {
        const recibidos = this.productoService.getProductos();
        this.productos = recibidos?.length ? recibidos : this.generarProductosDummy(1000);
        this.obtenerTasaCambio();
    }

    obtenerTasaCambio(): void {
        this.tasaCambiariaService.getTasaActual().subscribe({
            next: (res: { tasas: Tasa[] }) => {
                const dolar = res.tasas.find(t => t.id === 'dolar');
                const euro = res.tasas.find(t => t.id === 'euro');

                this.tasaDolar = dolar?.valor ?? 0;
                this.tasaEuro = euro?.valor ?? 0;
            },
            error: () => {
                this.tasaDolar = 0;
                this.tasaEuro = 0;
            }
        });
    }

    get paginas(): number[] {
        return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
    }

    get paginasVisibles(): number[] {
        const rango = 3;
        const inicio = Math.max(this.paginaActual - rango, 1);
        const fin = Math.min(inicio + rango * 2, this.totalPaginas);
        return Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i);
    }

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

    get productoSeguro(): Producto {
        return this.productoSeleccionado ?? {
            id: crypto.randomUUID(),
            nombre: '',
            tipo: 'montura',
            marca: '',
            color: '',
            codigo: '',
            material: '',
            stock: 0,
            precio: 0,
            moneda: 'usd',
            activo: true,
            descripcion: '',
            imagenUrl: '',
            fechaIngreso: new Date().toISOString().split('T')[0]
        };
    }

    get productosPaginados(): Producto[] {
        const inicio = (this.paginaActual - 1) * this.productosPorPagina;
        return this.productos.slice(inicio, inicio + this.productosPorPagina);
    }

    get totalPaginas(): number {
        return Math.ceil(this.productos.length / this.productosPorPagina);
    }

    getPrecioBs(producto: Producto): number {
        switch (producto.moneda) {
            case 'usd':
                return producto.precio * this.tasaDolar;
            case 'eur':
                return producto.precio * this.tasaEuro;
            case 'ves':
                return producto.precio;
            default:
                return 0;
        }
    }

    generarProductosDummy(cantidad: number): Producto[] {
        const tipos: Producto['tipo'][] = ['montura', 'lente', 'liquido', 'accesorio'];
        const marcas = ['VisionPro', 'OptiClear', 'LentiMax', 'FocusOne'];
        const colores = ['Negro', 'Azul', 'Rojo', 'Transparente'];
        const monedas: Producto['moneda'][] = ['usd', 'eur', 'ves'];

        return Array.from({ length: cantidad }, (_, i) => ({
            id: (i + 1).toString(),
            nombre: `Producto ${i + 1}`,
            tipo: tipos[i % tipos.length],
            marca: marcas[i % marcas.length],
            color: colores[i % colores.length],
            material: 'Acetato',
            codigo: `NV-${String(i + 1).padStart(5, '0')}`,
            stock: Math.floor(Math.random() * 50),
            precio: parseFloat((Math.random() * 100).toFixed(2)),
            moneda: monedas[i % monedas.length],
            activo: Math.random() > 0.2,
            descripcion: 'Producto simulado para pruebas.',
            imagenUrl: this.obtenerImagen(tipos[i % tipos.length]),
            fechaIngreso: '2025-07-27'
        }));
    }

    obtenerImagen(tipo: Producto['tipo']): string {
        const imagenes = {
            montura: 'assets/montura_2.avif',
            lente: 'assets/montura_1.png',
            liquido: 'assets/montura_3.jpg',
            accesorio: 'assets/montura_2.avif'
        };
        return imagenes[tipo];
    }
}
