import { Injectable } from '@angular/core';
import { TipoVentaGenerada } from './generar-venta-facade.service';

@Injectable({
  providedIn: 'root'
})
export class GenerarVentaUiService {
  esTipoVentaConHistoria(tipo: TipoVentaGenerada): boolean {
    return tipo === 'solo_consulta' || tipo === 'consulta_productos';
  }

  esCambioEntreVentasConHistoria(tipoAnterior: TipoVentaGenerada, tipoNuevo: TipoVentaGenerada): boolean {
    return this.esTipoVentaConHistoria(tipoAnterior)
      && this.esTipoVentaConHistoria(tipoNuevo)
      && tipoAnterior !== tipoNuevo;
  }
}