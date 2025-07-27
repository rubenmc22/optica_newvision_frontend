import { Component, OnInit } from '@angular/core';
import { TasaCambiariaService } from '../../core/services/tasaCambiaria/tasaCambiaria.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Modal } from 'bootstrap';
import { Tasa, HistorialTasa } from '../../Interfaces/models-interface';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-ver-atletas',
  standalone: false,
  templateUrl: './tasa.component.html',
  styleUrls: ['./tasa.component.scss']
})
export class TasaComponent implements OnInit {
  // Propiedades del componente
  tasas: any[] = [];
  historialTasaSeleccionada: any[] = [];
  simboloSeleccionado: string = '';

  // Control de UI
  menuAbierto: string | null = null;
  popoverActivo: string | null = null;

  // Configuración de tasas
  metodoTasa: { [key: string]: string } = {};
  tasaManual: { [key: string]: number } = {};
  fechaActualizacionManual: { [key: string]: string } = {};
  autoActualizar: { [key: string]: boolean } = {};
  nuevaTasaManual: number = 0;

  // BCV relacionados
  loadingBCV: { [key: string]: boolean } = {};
  valorBCV: { [key: string]: number } = {};
  bcvDisponible: { [key: string]: boolean } = {};

  constructor(
    private tasaService: TasaCambiariaService,
    private snackBar: MatSnackBar,
    private cdRef: ChangeDetectorRef
  ) { }

  // ==================== CICLO DE VIDA ====================
  ngOnInit(): void {
    console.log(' metodoTasa', this.metodoTasa);
    this.cargarTasas();
    this.cargarReferenciaBCV();
  }

  // ==================== MÉTODOS DE CARGA INICIAL ====================
  cargarTasas(): void {
    this.tasaService.getTasaActual().subscribe(response => {
      this.tasas = response.tasas || [];

      this.tasas.forEach(tasa => {
        const id = tasa.id;
        const modo = this.getModoValidacion(id);

        this.metodoTasa[id] = modo;
        this.tasaManual[id] = modo === 'manual' ? tasa.valor : 0;
        this.fechaActualizacionManual[id] = tasa.updated_at;
        this.autoActualizar[id] = !!tasa.rastreo_bcv;
        this.valorBCV[id] = tasa.valor;

      });

      this.cdRef.detectChanges();
    });
  }

  getModoValidacion(id: string): 'bcv' | 'manual' | 'automatico' {
    const t = this.tasas.find(x => x.id === id);
    if (!t) return 'manual';

    const tipo = t.ultimo_tipo_cambio?.toLowerCase();

    if (tipo === 'manual con bcv') return 'bcv';        // se interpreta como BCV
    if (tipo === 'manual') return 'manual';
    if (tipo === 'automatico') return 'automatico';

    return 'manual';
  }

  calcularModoVisual(moneda: Tasa): 'bcv' | 'manual' | 'automatico' {
    if (moneda.rastreo_bcv) return 'automatico';

    return 'bcv';
  }

  cargarReferenciaBCV(): void {
    this.tasaService.getTasaAutomaticaBCV().subscribe({
      next: (res: { tasa: { [key: string]: number } }) => {
        Object.entries(res.tasa).forEach(([monedaId, valorBCV]) => {
          this.valorBCV[monedaId] = valorBCV;
          this.bcvDisponible[monedaId] = true;
        });
      },
      error: () => {
        this.snackBar.open('⚠️ No se pudo cargar referencia oficial BCV', 'Cerrar', {
          duration: 3000,
          panelClass: ['snackbar-warning']
        });

        // ❌ Marca todos como no disponibles
        this.tasas.forEach(tasa => {
          this.bcvDisponible[tasa.id] = false;
        });
      }
    });
  }

  // ==================== MÉTODOS DE GESTIÓN DE TASAS ====================
  actualizarYRecargarTasasDesdeBCV(): void {
    this.tasaService.updateTasaBCV().subscribe({
      next: (response: { tasa: Tasa[] }) => {
        this.tasas = response.tasa || [];

        this.tasas.forEach((tasa: Tasa) => {
          const id = tasa.id;
          this.metodoTasa[id] = this.calcularModoVisual(tasa);

          this.tasaManual[id] = tasa.metodo === 'manual' ? tasa.valor : 0;
          this.fechaActualizacionManual[id] = tasa.metodo === 'manual' ? tasa.updated_at : '';
          this.autoActualizar[id] = !!tasa.rastreo_bcv;

          const moneda = this.tasas.find((t: Tasa) => t.id === id);
          if (moneda) {
            moneda.valor = tasa.valor;
            moneda.updated_at = tasa.updated_at;
          }
        });

        this.snackBar.open('✅ Tasas sincronizadas con BCV', 'Cerrar', {
          duration: 4000,
          panelClass: ['snackbar-success']
        });
      },
      error: () => {
        this.snackBar.open('Error al sincronizar con BCV', 'Cerrar', {
          duration: 3000,
          panelClass: ['snackbar-error']
        });
      }
    });
  }

  activarRastreoBCVConSincronizacion(monedaId: string): void {
    const rastreoActivo = !!this.autoActualizar[monedaId];

    this.tasaService.activarRastreoAutoamticoBCV(monedaId, rastreoActivo).subscribe({
      next: ({ tasa }) => {
        this.autoActualizar[monedaId] = !!tasa.rastreo_bcv;

        if (tasa.rastreo_bcv) {
          this.metodoTasa[monedaId] = 'bcv';
          this.tasaManual[monedaId] = 0;
          this.cdRef.detectChanges();

          const moneda = this.tasas.find(t => t.id === monedaId);
          if (moneda) {
            moneda.valor = tasa.valor;
            moneda.updated_at = tasa.updated_at;
          }

          this.snackBar.open(
            `✅ Sincronización automática activada con el BCV para "${monedaId}"`,
            'Cerrar',
            { duration: 4000, panelClass: ['snackbar-success'] }
          );
        } else {
          this.snackBar.open(
            `🔕 Sincronización automática desactivada para el ${monedaId}`,
            'Cerrar',
            { duration: 3000, panelClass: ['snackbar-warning'] }
          );
        }
      },
      error: () => {
        this.snackBar.open('Error al actualizar rastreo automático', 'Cerrar', {
          duration: 3000,
          panelClass: ['snackbar-error']
        });
      }
    });
  }


  updateTasaBCVPorId(monedaId: string): void {//ajustar esta funcion al update tasas por id
    this.tasaService.updateTasaBCVPorId(monedaId).subscribe({
      next: ({ tasa }) => {
        const monedaActualizada = tasa.find((t: Tasa) => t.id === monedaId);
        if (monedaActualizada) {
          const moneda = this.tasas.find(t => t.id === monedaId);
          if (moneda) {
            moneda.valor = monedaActualizada.valor;
            moneda.updated_at = monedaActualizada.updated_at;

            // 🔁 Estado visual sincronizado
            this.autoActualizar[monedaId] = !!monedaActualizada.rastreo_bcv;
            this.metodoTasa[monedaId] = this.calcularModoVisual(monedaActualizada);

            this.valorBCV[monedaId] = monedaActualizada.valor;
            this.tasaManual[monedaId] = !monedaActualizada.rastreo_bcv ? monedaActualizada.valor : 0;

            // 🧹 Cerrar el formulario si está abierto
            // this.mostrarFormularioManual[monedaId] = false;

            this.cdRef.detectChanges();
            this.cerrarMenu();
          }

          this.snackBar.open(`✅ Solo se actualizó ${monedaId}`, 'Cerrar', {
            duration: 4000, panelClass: ['snackbar-success']
          });
        }
      },

      error: () => {
        this.snackBar.open('Error al sincronizar con BCV', 'Cerrar', {
          duration: 3000, panelClass: ['snackbar-error']
        });
      }
    });
  }

  guardarTasaManual(monedaId: string): void {
    const valor = parseFloat(this.nuevaTasaManual.toFixed(2));
    const metodo = 'manual';
    const fecha = new Date().toISOString();

    this.tasaService.updateTasaManual(monedaId, valor, metodo, fecha).subscribe({
      next: () => {
        const moneda = this.tasas.find(t => t.id === monedaId);
        if (moneda) {
          moneda.valor = valor;
          moneda.updated_at = fecha;
          this.metodoTasa[monedaId] = metodo;
          this.autoActualizar[monedaId] = false;
          this.fechaActualizacionManual[monedaId] = fecha;
          this.tasaManual[monedaId] = valor;
          this.cdRef.detectChanges();
        }

        this.snackBar.open(`✅ Tasa manual guardada para ${monedaId}`, 'Cerrar', {
          duration: 3000,
          panelClass: ['snackbar-success']
        });

        this.cerrarPopover();
      },
      error: () => {
        this.snackBar.open('Error al guardar tasa manual', 'Cerrar', {
          duration: 3000,
          panelClass: ['snackbar-error']
        });
      }
    });
  }

  // ==================== MÉTODOS DE HISTORIAL ====================
  verHistorial(monedaId: string): void {
    const tasaSeleccionada = this.tasas.find(t => t.id === monedaId);
    if (!tasaSeleccionada) return;

    this.simboloSeleccionado = tasaSeleccionada.simbolo;

    this.tasaService.getHistorialTasas(monedaId).subscribe({
      next: (res) => {
        this.historialTasaSeleccionada = res.historial.map(item => ({
          usuario: item.usuario.nombre,
          fecha: item.updated_at,
          valor: item.valor_nuevo,
          metodo: item.tipo_cambio?.toLowerCase().includes('bcv') ? 'bcv' : 'manual'
        }));
        this.modalOpen('modalHistorial');
      },
      error: () => {
        this.snackBar.open(`⚠️ No se pudo cargar historial para ${monedaId}`, 'Cerrar', {
          duration: 3000,
          panelClass: ['snackbar-warning']
        });
      }
    });
  }

  // ==================== MÉTODOS DE UI ====================
  abrirPopover(moneda: string): void {
    this.menuAbierto = null;
    this.popoverActivo = moneda;
  }

  cerrarPopover(): void {
    this.popoverActivo = null;
  }

  abrirMenu(event: MouseEvent, monedaId: string): void {
    event.stopPropagation(); // ✋ Evita que la apertura dispare cierre por clickOutside
    this.menuAbierto = monedaId;
  }

  cerrarMenu(): void {
    this.menuAbierto = null;
  }

  modalOpen(id: string): void {
    const modalElement = document.getElementById(id);
    if (!modalElement) return;

    const modalInstance = new Modal(modalElement);
    modalInstance.show();
  }
}