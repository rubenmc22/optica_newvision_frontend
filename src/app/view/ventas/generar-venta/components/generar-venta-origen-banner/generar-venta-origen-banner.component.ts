import { Component, Input } from '@angular/core';
import { PresupuestoVentaDraft } from '../../../shared/presupuesto-venta-handoff.util';

@Component({
  selector: 'app-generar-venta-origen-banner',
  standalone: false,
  templateUrl: './generar-venta-origen-banner.component.html',
  styleUrls: ['./generar-venta-origen-banner.component.scss']
})
export class GenerarVentaOrigenBannerComponent {
  @Input() presupuestoOrigen: PresupuestoVentaDraft['origen'] | null = null;
}