import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-presupuesto-page',
  standalone: false,
  templateUrl: './presupuesto-page.component.html',
  styleUrls: ['./presupuesto-page.component.scss']
})
export class PresupuestoPageComponent implements OnInit {
  pageTitle = 'Presupuestos';
  pageSubtitle = 'Listado operativo, seguimiento comercial y edición de propuestas.';
  contextoRuta: string | null = null;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const presupuestoId = this.route.snapshot.paramMap.get('id');
    const ultimoSegmento = this.route.snapshot.url.at(-1)?.path || '';

    if (ultimoSegmento === 'nuevo') {
      this.pageTitle = 'Nuevo presupuesto';
      this.contextoRuta = 'Ruta activa para crear una nueva propuesta comercial.';
      return;
    }

    if (presupuestoId) {
      this.pageTitle = 'Detalle de presupuesto';
      this.contextoRuta = `Ruta activa para revisar el presupuesto ${presupuestoId}.`;
    }
  }
}