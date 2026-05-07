import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-cierre-caja-page',
  standalone: false,
  templateUrl: './cierre-caja-page.component.html',
  styleUrls: ['./cierre-caja-page.component.scss']
})
export class CierreCajaPageComponent implements OnInit {
  pageTitle = 'Cierre de caja';
  pageSubtitle = 'Control operativo diario, conciliación y revisión histórica.';
  contextoRuta: string | null = null;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const fecha = this.route.snapshot.paramMap.get('fecha');
    if (fecha) {
      this.contextoRuta = `Ruta activa para la jornada operativa ${fecha}.`;
    }
  }
}