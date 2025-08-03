import { Component, OnInit } from '@angular/core';
import { Producto } from '../producto.model';
import { ProductoService } from '../producto.service';
import { TasaCambiariaService } from '../../../core/services/tasaCambiaria/tasaCambiaria.service';
import { Tasa } from '../../../Interfaces/models-interface';

@Component({
    selector: 'app-productos-inventario',
    standalone: false,
    templateUrl: './productos-inventario.component.html',
    styleUrls: ['./productos-inventario.component.scss']
})

export class ProductosInventarioComponent implements OnInit {

    constructor(

    ) { }

    ngOnInit(): void {

    }


}
