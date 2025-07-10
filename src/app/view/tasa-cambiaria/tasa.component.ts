import { Component, OnInit } from '@angular/core';
import { TasaCambiariaService } from '../../core/services/tasaCambiaria/tasaCambiaria.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Modal } from 'bootstrap';
import { Tasa, HistorialTasa } from '../../Interfaces/models-interface';

@Component({
  selector: 'app-ver-atletas',
  standalone: false,
  templateUrl: './tasa.component.html',
  styleUrls: ['./tasa.component.scss']
})

export class TasaComponent implements OnInit {
  tasas: any[] = [];
  metodoTasa: { [key: string]: string } = {};
  tasaManual: { [key: string]: number } = {};
  fechaActualizacionManual: { [key: string]: string } = {};
  autoActualizar: { [key: string]: boolean } = {};
  menuAbierto: string | null = null;
  popoverActivo: string | null = null;
  nuevaTasaManual: number = 0;
  historialTasaSeleccionada: any[] = [];
  simboloSeleccionado: string = '';
  loadingBCV: { [key: string]: boolean } = {};
  valorBCV: { [key: string]: number } = {};
  bcvDisponible: { [key: string]: boolean } = {};



  constructor(
    private tasaService: TasaCambiariaService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.cargarTasas();
    this.cargarReferenciaBCV();
  }

  cargarTasas(): void {
    this.tasaService.getTasaActual().subscribe(response => {
      this.tasas = response.tasas || [];

      this.tasas.forEach(tasa => {
        const id = tasa.id;
        console.log('RDMC tasa', tasa);
        if (!tasa.rastreo_bcv) {
          // 🟢 Modo manual
          this.metodoTasa[id] = 'manual';
          this.tasaManual[id] = tasa.valor;
          this.fechaActualizacionManual[id] = tasa.updated_at;
          this.autoActualizar[id] = false;
        } else {
          // 🔵 Modo BCV oficial
          this.metodoTasa[id] = 'bcv';
          this.tasaManual[id] = 0;
          this.autoActualizar[id] = true;
          this.valorBCV[id] = tasa.valor;
        }

      });

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

        // ❌ Marca todos como no disponibles
        this.tasas.forEach(tasa => {
          this.bcvDisponible[tasa.id] = false;
        });
      }
    });
  }


  actualizarYRecargarTasasDesdeBCV(): void {
    this.tasaService.updateTasaBCV().subscribe({
      next: (response: { tasa: Tasa[] }) => {
        this.tasas = response.tasa || [];

        this.tasas.forEach((tasa: Tasa) => {
          const id = tasa.id;

          this.metodoTasa[id] = tasa.metodo || 'bcv';
          this.tasaManual[id] = tasa.metodo === 'manual' ? tasa.valor : 0;
          this.fechaActualizacionManual[id] = tasa.metodo === 'manual' ? tasa.updated_at : '';
          this.autoActualizar[id] = !!tasa.rastreo_bcv;
          //   this.valorBCV[id] = tasa.valor;

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
      next: (res: { tasa: Tasa }) => {
        this.autoActualizar[monedaId] = !!res.tasa.rastreo_bcv;

        if (res.tasa.rastreo_bcv) {
          this.metodoTasa[monedaId] = 'bcv';
          this.tasaManual[monedaId] = 0;

          // 🟢 1. Actualiza primero la base con la tasa oficial
          this.loadingBCV[monedaId] = true;
          this.tasaService.updateTasaBCV().subscribe({
            next: () => {
              // 🔄 2. Luego consulta desde BD ya persistida
              this.tasaService.getTasaActual().subscribe((response: { tasas: Tasa[] }) => {
                const monedaActualizada = response.tasas.find((t: Tasa) => t.id === monedaId);
                if (monedaActualizada) {
                  const moneda = this.tasas.find((t: Tasa) => t.id === monedaId);
                  if (moneda) {
                    moneda.valor = monedaActualizada.valor;
                    moneda.updated_at = monedaActualizada.updated_at;

                  }
                }
                this.loadingBCV[monedaId] = false; // ✅ Oculta spinner al terminar
                this.snackBar.open(`✅  Sincronización automática activada con el BCV para "${monedaId}"`, 'Cerrar', {
                  duration: 4000,
                  panelClass: ['snackbar-success']
                });
              });
            },
            error: () => {
              this.snackBar.open('Error al sincronizar tasa desde BCV', 'Cerrar', {
                duration: 3000,
                panelClass: ['snackbar-error']
              });
            }
          });
        } else {
          this.snackBar.open(`🔕 Sincronización automática desactivado para el ${monedaId}`, 'Cerrar', {
            duration: 3000,
            panelClass: ['snackbar-warning']
          });
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

  actualizarTasaDesdeBCV(monedaId: string): void {
    this.tasaService.getTasaAutomaticaBCV().subscribe({
      next: (res) => {
        const tasasBCV = res.tasa;
        const nuevoValor = tasasBCV[monedaId];

        if (nuevoValor !== undefined) {
          const moneda = this.tasas.find(t => t.id === monedaId);
          if (moneda) {
            moneda.valor = nuevoValor;
            this.metodoTasa[monedaId] = 'bcv';
            this.tasaManual[monedaId] = 0;
            // ✅ Guarda la referencia oficial BCV independientemente del modo actual
            //   this.valorBCV[monedaId] = nuevoValor;
          }

          this.cerrarPopover();
          this.snackBar.open(`✅ Tasa oficial BCV actualizada para ${monedaId}`, 'Cerrar', {
            duration: 4000,
            panelClass: ['snackbar-success']
          });
        } else {
          this.snackBar.open(`⚠️ No se encontró información BCV para ${monedaId}`, 'Cerrar', {
            duration: 3000,
            panelClass: ['snackbar-warning']
          });
        }
      },
      error: () => {
        this.snackBar.open('Error al obtener tasa BCV', 'Cerrar', {
          duration: 3000,
          panelClass: ['snackbar-error']
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


  modalOpen(id: string): void {
    const modalElement = document.getElementById(id);
    if (!modalElement) return;

    const modalInstance = new Modal(modalElement);
    modalInstance.show();
  }
}
