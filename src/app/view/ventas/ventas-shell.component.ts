import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

type VentasLegacyView = 'generacion-de-ventas' | 'presupuestos' | 'historial-de-ventas' | 'cierre-de-caja';

interface VentasNavItem {
  label: string;
  description: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-ventas-shell',
  standalone: false,
  templateUrl: './ventas-shell.component.html',
  styleUrl: './ventas-shell.component.scss'
})
export class VentasShellComponent implements OnInit {
  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.redirigirRutaLegacySiAplica();
  }

  private redirigirRutaLegacySiAplica(): void {
    const childPath = this.route.firstChild?.snapshot.routeConfig?.path;
    if (childPath) {
      return;
    }

    const legacyView = this.route.snapshot.queryParamMap.get('vista') as VentasLegacyView | null;
    const destino = this.mapearVistaLegacy(legacyView);

    this.router.navigate([destino], {
      replaceUrl: true
    });
  }

  private mapearVistaLegacy(vista: VentasLegacyView | null): string {
    switch (vista) {
      case 'generacion-de-ventas':
        return '/ventas/generar';
      case 'presupuestos':
        return '/ventas/presupuestos';
      case 'historial-de-ventas':
        return '/ventas/historial';
      case 'cierre-de-caja':
        return '/ventas/cierres';
      default:
        return '/ventas/generar';
    }
  }
}
