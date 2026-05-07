import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-presupuesto-stats',
  standalone: false,
  templateUrl: './presupuesto-stats.component.html',
  styleUrl: './presupuesto-stats.component.scss'
})
export class PresupuestoStatsComponent {
  @Input() estadisticas!: { totalVigentes: number; proximosAVencer: number; totalVencidos: number };
  @Input() totalValorFormatted = '';
  @Output() tabChange = new EventEmitter<'vigentes' | 'vencidos'>();
}