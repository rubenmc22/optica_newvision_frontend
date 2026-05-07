import { Component } from '@angular/core';

@Component({
  selector: 'app-historial-ventas-page',
  standalone: false,
  templateUrl: './historial-ventas-page.component.html',
  styleUrls: ['./historial-ventas-page.component.scss']
})
export class HistorialVentasPageComponent {
  pageTitle = 'Historial de ventas';
  pageSubtitle = 'Consulta operativa, pagos, filtros y seguimiento postventa.';
}