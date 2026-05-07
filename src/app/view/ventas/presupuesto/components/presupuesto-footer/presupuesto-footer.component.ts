import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';

type TipoExportacionPresupuesto = 'vigentes' | 'vencidos' | 'todos';

@Component({
  selector: 'app-presupuesto-footer',
  standalone: false,
  templateUrl: './presupuesto-footer.component.html',
  styleUrls: ['./presupuesto-footer.component.scss']
})
export class PresupuestoFooterComponent implements OnDestroy {
  @Input() diasParaAutoArchivo = 30;
  @Input() tabActiva: 'vigentes' | 'vencidos' = 'vigentes';
  @Input() totalVigentes = 0;
  @Input() totalVencidos = 0;

  @Output() export = new EventEmitter<TipoExportacionPresupuesto>();

  mostrarMenuExportar = false;
  private timeoutCerrarMenu: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    if (this.timeoutCerrarMenu) {
      clearTimeout(this.timeoutCerrarMenu);
    }
  }

  abrirMenuExportar(): void {
    if (this.timeoutCerrarMenu) {
      clearTimeout(this.timeoutCerrarMenu);
      this.timeoutCerrarMenu = null;
    }

    this.mostrarMenuExportar = true;
  }

  cerrarMenuExportar(): void {
    this.timeoutCerrarMenu = setTimeout(() => {
      this.mostrarMenuExportar = false;
      this.timeoutCerrarMenu = null;
    }, 300);
  }

  mantenerMenuAbierto(): void {
    if (this.timeoutCerrarMenu) {
      clearTimeout(this.timeoutCerrarMenu);
      this.timeoutCerrarMenu = null;
    }
  }

  seleccionarOpcionExportar(tipo: TipoExportacionPresupuesto): void {
    if (this.timeoutCerrarMenu) {
      clearTimeout(this.timeoutCerrarMenu);
      this.timeoutCerrarMenu = null;
    }

    this.mostrarMenuExportar = false;
    this.export.emit(tipo);
  }
}