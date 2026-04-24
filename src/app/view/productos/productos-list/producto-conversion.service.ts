// services/producto-conversion.service.ts
import { Injectable } from '@angular/core';
import { SystemConfigService } from './../../system-config/system-config.service';
import { TasaCambiariaService } from './../../../core/services/tasaCambiaria/tasaCambiaria.service';

export interface ProductoConversion {
    convertirProductoAmonedaSistema(producto: any): any;
    convertirListaProductosAmonedaSistema(productos: any[]): any[];
    actualizarPreciosPorCambioMoneda(productos: any[]): any[];
}

@Injectable({
    providedIn: 'root'
})


export class ProductoConversionService {

    constructor(
        private configService: SystemConfigService,
        private tasaService: TasaCambiariaService
    ) { }

    /**
     * Convierte un producto a la moneda del sistema actual
     */
    convertirProductoAmonedaSistema(producto: any): any {
        const monedaSistema = this.configService.getMonedaPrincipal();

        if (producto.moneda === monedaSistema && !producto.monedaOriginal) {
            return producto;
        }

        const monedaOriginal = producto.monedaOriginal || producto.moneda;
        const precioBase = producto.precioOriginal || producto.precio;

        // Si ya está convertido a la moneda actual, mantener la conversión
        if (producto.moneda === monedaSistema && producto.monedaOriginal) {
            return producto;
        }

        // Convertir desde la moneda original a la moneda del sistema
        const precioConvertido = this.configService.convertirMonto(
            precioBase,
            monedaOriginal,
            monedaSistema
        );

        const precioConIvaConvertido = producto.precioConIva
            ? this.configService.convertirMonto(
                producto.precioConIva,
                monedaOriginal,
                monedaSistema
            )
            : undefined;

        return {
            ...producto,
            moneda: monedaSistema,
            precio: precioConvertido,
            precioConIva: precioConIvaConvertido,
            precioOriginal: precioBase,
            monedaOriginal: monedaOriginal,
            tasaConversion: this.obtenerTasaConversion(monedaOriginal, monedaSistema),
            fechaConversion: new Date().toISOString()
        };
    }

    /**
     * Convierte una lista de productos a la moneda del sistema
     */
    convertirListaProductosAmonedaSistema(productos: any[]): any[] {
        const monedaSistema = this.configService.getMonedaPrincipal();

        return productos.map(producto => {
            // Para productos nuevos sin monedaOriginal, establecer la moneda del sistema
            if (!producto.monedaOriginal && producto.moneda === monedaSistema) {
                return {
                    ...producto,
                    precioOriginal: producto.precio,
                    monedaOriginal: monedaSistema,
                    tasaConversion: 1,
                    fechaConversion: new Date().toISOString()
                };
            }

            return this.convertirProductoAmonedaSistema(producto);
        });
    }

    /**
     * Actualiza los precios cuando cambia la moneda del sistema
     */
    actualizarPreciosPorCambioMoneda(productos: any[]): any[] {
        //console.log('🔄 Actualizando precios por cambio de moneda del sistema');
        return this.convertirListaProductosAmonedaSistema(productos);
    }

    /**
    * Obtiene la tasa de conversión entre dos monedas CORREGIDO
    */
    private obtenerTasaConversion(monedaOrigen: string, monedaDestino: string): number {
        if (monedaOrigen === monedaDestino) return 1;

        try {
            const tasaOrigen = this.configService.getTasaPorId(monedaOrigen);
            const tasaDestino = this.configService.getTasaPorId(monedaDestino);

            if (tasaDestino === 0) return 1;

            const tasa = tasaOrigen / tasaDestino;

            return tasa;
        } catch (error) {
            console.error('Error calculando tasa de conversión:', error);
            return 1;
        }
    }

    /**
     * Prepara un nuevo producto para guardar (siempre en moneda del sistema)
     */
    prepararNuevoProducto(productoData: any): any {
        const monedaSistema = this.configService.getMonedaPrincipal();

        return {
            ...productoData,
            moneda: monedaSistema,
            precioOriginal: productoData.precio,
            monedaOriginal: monedaSistema,
            tasaConversion: 1,
            fechaConversion: new Date().toISOString()
        };
    }

    /**
     * Obtiene el precio en bolívares como referencia
     */
    getPrecioEnBs(producto: any): number {
        // SIEMPRE usar precio SIN IVA para la conversión a bolívares
        // Independientemente de si el producto aplica IVA o no
        const precioSinIva = producto.precio || 0;
        const monedaOriginal = producto.monedaOriginal || producto.moneda;

        // Convertir usando el método seguro de conversión
        return this.convertirDirectoABs(precioSinIva, monedaOriginal);
    }

    /**
    * Conversión directa a bolívares
    */
    private convertirDirectoABs(monto: number, monedaOrigen: string): number {
        const tasa = this.configService.getTasaPorId(monedaOrigen);
        const resultado = monto * tasa;

        return Number(resultado.toFixed(2));
    }

    /**
     * Obtiene información de conversión para mostrar - MEJORADO
     */
    getInfoConversion(producto: any): {
        monedaOriginal: string,
        precioOriginal: number,
        tasa: number,
        precioEnBs: number,
        necesitaConversion: boolean
    } {
        const monedaSistema = this.configService.getMonedaPrincipal();
        const monedaOriginal = producto.monedaOriginal || producto.moneda;
        const precioOriginal = producto.precioOriginal || producto.precio;
        const necesitaConversion = monedaOriginal !== monedaSistema;

        // Calcular precio en Bs correctamente
        const precioEnBs = this.convertirDirectoABs(precioOriginal, monedaOriginal);

        return {
            monedaOriginal: monedaOriginal,
            precioOriginal: precioOriginal,
            tasa: producto.tasaConversion || 1,
            precioEnBs: precioEnBs,
            necesitaConversion: necesitaConversion
        };
    }

    /**
     * Verifica si un producto necesita reconversión
     */
    necesitaReconversion(producto: any): boolean {
        const monedaSistema = this.configService.getMonedaPrincipal();
        const monedaOriginal = producto.monedaOriginal || producto.moneda;

        return monedaOriginal !== monedaSistema || producto.moneda !== monedaSistema;
    }
}