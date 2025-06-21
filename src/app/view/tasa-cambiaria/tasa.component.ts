import { Component, OnInit } from '@angular/core';
import { TasaCambiariaService } from '../../core/services/tasaCambiaria/tasaCambiaria.service';
import { Router } from '@angular/router'; // Router para navegación
import { SwalService } from '../../core/services/swal/swal.service'; // Importa el servicio de SweetAlert2
import { FormsModule } from '@angular/forms'; // ✅ Importa FormsModule

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

  constructor(private tasaService: TasaCambiariaService) { }

  ngOnInit(): void {
    this.cargarTasas();
  }

  cargarTasas(): void {
    this.tasaService.getTasaActual().subscribe(response => {
      this.tasas = response.tasas || [];

      this.tasas.forEach(tasa => {
        this.metodoTasa[tasa.id] = tasa.metodo || 'bcv';
        this.tasaManual[tasa.id] = tasa.metodo === 'manual' ? tasa.valor : 0;
        this.fechaActualizacionManual[tasa.id] = tasa.metodo === 'manual' ? tasa.fecha : '';
        this.autoActualizar[tasa.id] = false;
      });
    });
  }

  abrirPopover(moneda: string): void {
    this.menuAbierto = null; // ✅ Cierra el menú de configuración automáticamente
    this.popoverActivo = moneda;
  }

  cerrarPopover(): void {
    this.popoverActivo = null;
  }

  guardarTasaManual(moneda: string): void {
    const fechaActual = new Date().toLocaleString();
    const id = this.tasas.find(t => t.nombre.toLowerCase() === moneda.toLowerCase())?.id;

    if (!id) {
      console.error(`❌ No se encontró la moneda: ${moneda}`);
      return;
    }

    this.tasaService.setTasaManual(id, this.nuevaTasaManual, 'manual', fechaActual).subscribe({
      next: () => {
        this.tasaManual[id] = this.nuevaTasaManual;
        this.metodoTasa[id] = 'manual';
        this.fechaActualizacionManual[id] = fechaActual;
        this.cerrarPopover();
        this.menuAbierto = null;
        console.log(`✅ Tasa manual guardada correctamente: ${moneda}`);
      },
      error: (err) => {
        console.error(`❌ Error al guardar la tasa manual en el backend:`, err);
      }
    });
  }



  actualizarBCV(moneda: string): void {
    const tasaBCV = this.tasas.find(t => t.id === moneda)?.valor || 0;
    this.tasaManual[moneda] = tasaBCV;
    this.metodoTasa[moneda] = 'bcv';
    this.fechaActualizacionManual[moneda] = '';
    this.menuAbierto = null;
  }

  cerrarMenu(): void {
    this.menuAbierto = null;
  }

  toggleMenu(moneda: string): void {
    this.menuAbierto = this.menuAbierto === moneda ? null : moneda;
  }

  verificarAutoActualizar(moneda: string): void {
    console.log(`Auto actualización ${this.autoActualizar[moneda] ? 'activada' : 'desactivada'} para ${moneda}`);
  }

  verHistorial(moneda: string): void {
    console.log(`Ver historial para ${moneda}`);
  }
}
