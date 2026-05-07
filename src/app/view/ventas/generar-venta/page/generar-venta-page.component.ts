import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { VentasFlowService } from '../../shared/ventas-flow.service';

@Component({
  selector: 'app-generar-venta-page',
  standalone: false,
  templateUrl: './generar-venta-page.component.html',
  styleUrls: ['./generar-venta-page.component.scss']
})
export class GenerarVentaPageComponent implements OnInit {
  pageTitle = 'Generar venta';
  pageSubtitle = 'Registro operativo de consultas, productos y ventas mixtas.';
  contextoEntrada: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private ventasFlowService: VentasFlowService
  ) {}

  ngOnInit(): void {
    const presupuestoDraft = this.ventasFlowService.leerPresupuestoVentaDraft();
    const historiaHandoff = this.ventasFlowService.leerHistoriaVentaHandoff();
    const tipoRuta = this.route.snapshot.queryParamMap.get('tipo');

    if (presupuestoDraft) {
      this.contextoEntrada = `Entrada detectada desde presupuesto ${presupuestoDraft.origen.codigo}.`;
      return;
    }

    if (historiaHandoff) {
      this.contextoEntrada = `Entrada detectada desde historia médica ${historiaHandoff.historiaNumero || historiaHandoff.historiaId}.`;
      return;
    }

    if (tipoRuta) {
      this.contextoEntrada = `Modo inicial solicitado: ${tipoRuta}.`;
    }
  }
}