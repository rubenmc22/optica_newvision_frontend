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
  // ==================== PROPIEDADES ====================
  // Datos principales
  tasas: any[] = [];
  historialTasaSeleccionada: any[] = [];
  simboloSeleccionado: string = '';

  // Estados de UI
  menuAbierto: string | null = null;
  popoverActivo: string | null = null;
  nuevaTasaManual: number = 0;

  // Configuración de tasas
  metodoTasa: { [key: string]: string } = {};
  tasaManual: { [key: string]: number | null } = {};
  fechaActualizacionManual: { [key: string]: string } = {};
  autoActualizar: { [key: string]: boolean } = {};

  // BCV y estados
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
    this.cargarTasas();
    this.cargarReferenciaBCV();
  }

  // ==================== MÉTODOS DE CARGA INICIAL ====================
  cargarTasas(): void {
    this.tasaService.getTasaActual().subscribe({
      next: (res) => {
        const lista = res?.tasas || [];

        this.tasas = lista.map((tasa: any) => ({
          id: tasa.id,
          nombre: tasa.nombre,
          simbolo: tasa.simbolo,
          valor: tasa.valor,
          metodo: tasa.ultimo_tipo_cambio?.toLowerCase().includes('bcv') ? 'bcv' : 'manual',
          rastreo: tasa.rastreo_bcv,
          updated_at: tasa.updated_at
        }));

        lista.forEach((tasa: any) => {
          const monedaId = tasa.id;
          this.metodoTasa[monedaId] = tasa.rastreo_bcv ? 'automatico' :
            (tasa.ultimo_tipo_cambio?.toLowerCase().includes('bcv') ? 'bcv' : 'manual');
          this.autoActualizar[monedaId] = tasa.rastreo_bcv;
          this.tasaManual[monedaId] = !tasa.rastreo_bcv ? tasa.valor : null;
          this.fechaActualizacionManual[monedaId] = !tasa.rastreo_bcv ? tasa.updated_at : null;
        });

        this.cdRef.detectChanges();
      },
      error: () => {
        this.snackBar.open('❌ Error al cargar tasas actuales', 'Cerrar', {
          duration: 3000,
          panelClass: ['snackbar-warning']
        });
      }
    });
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
        this.tasas.forEach(tasa => {
          this.bcvDisponible[tasa.id] = false;
        });
      }
    });
  }

  // ==================== MÉTODOS DE GESTIÓN DE TASAS ====================
  actualizarYMostrarTasasDesdeBCV(): void {
    this.tasaService.updateTasaBCV().subscribe({
      next: (res) => {
        const respuesta = res?.tasa || [];
        respuesta.forEach((tasaActualizada: Tasa) => {
          const index = this.tasas.findIndex(t => t.id === tasaActualizada.id);
          if (index >= 0) {
            this.tasas[index].valor = tasaActualizada.valor;
            this.tasas[index].updated_at = tasaActualizada.updated_at;
            this.tasas[index].rastreo_bcv = tasaActualizada.rastreo_bcv;
            this.metodoTasa[tasaActualizada.id] = 'bcv';
            if (this.tasaManual[tasaActualizada.id]) {
              delete this.tasaManual[tasaActualizada.id];
              this.autoActualizar[tasaActualizada.id] = false;
            }
          }
        });

        this.snackBar.open('✅ Tasas actualizadas correctamente desde BCV', 'Cerrar', {
          duration: 3000,
          panelClass: ['snackbar-success']
        });
        this.cdRef.detectChanges();
      },
      error: () => {
        this.snackBar.open('❌ Error al actualizar tasas desde BCV', 'Cerrar', {
          duration: 3000,
          panelClass: ['snackbar-warning']
        });
      }
    });
  }

  activarRastreoBCVAutomatico(id: string): void {
    const rastrearAuto = this.autoActualizar[id] ?? false;
    this.tasaService.activarRastreoAutomaticoBCV(id, rastrearAuto).subscribe({
      next: ({ tasa }: { tasa: Tasa }) => {
        const index = this.tasas.findIndex(t => t.id === tasa.id);
        if (index >= 0) {
          this.tasas[index].valor = tasa.valor;
          this.tasas[index].updated_at = tasa.updated_at;
          this.tasas[index].rastreo_bcv = tasa.rastreo_bcv;
          this.metodoTasa[tasa.id] = 'bcv';
          delete this.tasaManual[tasa.id];
        }

        this.snackBar.open(`📡 Rastreo automático activado para ${tasa.nombre}`, 'Cerrar', {
          duration: 3000,
          panelClass: ['snackbar-success']
        });
        this.cdRef.detectChanges();
      },
      error: () => {
        this.snackBar.open(`⚠️ Error al activar rastreo automático`, 'Cerrar', {
          duration: 3000,
          panelClass: ['snackbar-warning']
        });
      }
    });
  }

  updateTasaBCVPorId(monedaId: string): void {
    this.loadingBCV[monedaId] = true;
    this.tasaService.updateTasaBCVPorId(monedaId).subscribe({
      next: (res) => {
        const respuestaTasa = Array.isArray(res.tasa) ? res.tasa[0] : res.tasa;
        if (respuestaTasa?.id === monedaId) {
          const index = this.tasas.findIndex(t => t.id === monedaId);
          if (index >= 0) {
            this.tasas[index].valor = respuestaTasa.valor;
          }
          this.metodoTasa[monedaId] = 'bcv';
          this.autoActualizar[monedaId] = false;
          this.cerrarMenu();

          this.snackBar.open(
            `✅ ${monedaId.toUpperCase()} actualizado a BCV: ${respuestaTasa.valor}`,
            'Cerrar',
            { duration: 2500, panelClass: ['snackbar-success'] }
          );
        } else {
          this.snackBar.open(
            `⚠️ No se encontró tasa BCV para ${monedaId}`,
            'Cerrar',
            { duration: 3000, panelClass: ['snackbar-warning'] }
          );
        }
      },
      error: () => {
        this.snackBar.open(`❌ Falló actualización BCV de ${monedaId}`, 'Cerrar', {
          duration: 3000, panelClass: ['snackbar-warning']
        });
      },
      complete: () => {
        this.loadingBCV[monedaId] = false;
        this.cdRef.detectChanges();
      }
    });
  }

  guardarTasaManual(monedaId: string): void {
    const fecha = new Date().toISOString();
    this.tasaService.updateTasaManual(monedaId, this.nuevaTasaManual, 'manual', fecha).subscribe({
      next: () => {
        this.metodoTasa[monedaId] = 'manual';
        this.tasaManual[monedaId] = this.nuevaTasaManual;
        this.autoActualizar[monedaId] = false;
        this.snackBar.open(`💾 Tasa manual actualizada para ${monedaId}`, 'Cerrar', { duration: 2500 });
        this.cdRef.detectChanges();
        this.cerrarMenu();
        this.cerrarPopover();
      },
      error: () => {
        this.snackBar.open(`❌ Falló actualización manual de ${monedaId}`, 'Cerrar', { duration: 3000 });
      }
    });
  }

  // ==================== MÉTODOS AUXILIARES ====================
  calcularModoVisual(monedaId: string): 'manual' | 'bcv' | 'automatico' {
    if (this.autoActualizar[monedaId]) return 'automatico';
    return this.metodoTasa[monedaId] === 'bcv' ? 'bcv' : 'manual';
  }

  obtenerValorVisual(monedaId: string): number {
    const modo = this.metodoTasa[monedaId];
    const tasa = this.tasas.find(t => t.id === monedaId);
    if (!tasa) return 0;

    switch (modo) {
      case 'manual': return this.tasaManual[monedaId] || 0;
      case 'bcv':
      case 'automatico': return tasa.valor || 0;
      default: return 0;
    }
  }

  // ==================== MÉTODOS DE HISTORIAL ====================
  verHistorial(monedaId: string): void {
    const tasaSeleccionada = this.tasas.find(t => t.id === monedaId);
    if (!tasaSeleccionada) return;

    this.simboloSeleccionado = tasaSeleccionada.simbolo;
    this.tasaService.getHistorialTasas(monedaId).subscribe({
      next: (res) => {
        this.historialTasaSeleccionada = res.historial
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()) // orden descendente
          .map(item => ({
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
    event.stopPropagation();
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