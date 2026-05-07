import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-cierre-kpi-grid',
  standalone: false,
  templateUrl: './cierre-kpi-grid.component.html',
  styleUrls: ['./cierre-kpi-grid.component.scss']
})
export class CierreKpiGridComponent {
  @Input() cierreActual: any = null;
  @Input() totalVentas: number = 0;
  @Input() totalPendientes: number = 0;
  @Input() netoDia: number = 0;
  @Input() transaccionesCount: number = 0;
  @Input() ventasPendientesCount: number = 0;
}