import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-historial-stats-grid',
  standalone: false,
  templateUrl: './historial-stats-grid.component.html',
  styleUrls: ['./historial-stats-grid.component.scss']
})
export class HistorialStatsGridComponent {
  @Input() totalVentas: number = 0;
  @Input() ventasCompletadas: number = 0;
  @Input() ventasPendientes: number = 0;
  @Input() ventasCanceladas: number = 0;
  @Input() montoCanceladas: number = 0;
}