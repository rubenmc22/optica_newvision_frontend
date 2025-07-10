import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PacientesService } from '../../../core/services/pacientes/pacientes.service';
import { forkJoin } from 'rxjs'; // Agrega esta línea con las demás importaciones

@Component({
  selector: 'app-historias-medicas',
  standalone: false,
  templateUrl: './historias-medicas.component.html',
  styleUrl: './historias-medicas.component.scss'
})

export class HistoriasMedicasComponent implements OnInit {
  idPaciente: string = '';
  paciente: any = null;
  historias: any[] = [];
  historiaSeleccionada: any = null;
  cargando: boolean = true;
  ultimaHistoriaFecha: string | null = null; // Definir la propiedad faltante

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pacientesService: PacientesService
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const idPaciente = params.get('id');
      if (idPaciente) {
        // 🚀 Cargar historial específico
        this.cargarHistorialDePaciente(idPaciente);
      } else {
        // 🗂 Mostrar vista general o mensaje
        this.mostrarVistaGeneralDeHistorias();
      }
    });
  }

  cargarHistorialDePaciente(idPaciente: string): void {

  }

  mostrarVistaGeneralDeHistorias(): void {

  }


  cargarDatos(): void {
    this.cargando = true;

    // Cargar datos del paciente y sus historias en paralelo
    forkJoin([
      this.pacientesService.getPaciente(this.idPaciente),
      this.pacientesService.getHistoriasPaciente(this.idPaciente)
    ]).subscribe({
      next: ([paciente, historias]) => {
        this.paciente = paciente;
        this.historias = historias;
        this.cargando = false;

        // Mostrar vista previa de la última historia si existe
        if (this.historias.length > 0) {
          this.verHistoriaDetalle(this.historias[0]);
        }
      },
      error: (err) => {
        console.error('Error al cargar datos:', err);
        this.cargando = false;
      }
    });
  }

  // Método para calcular edad (versión en componente)
  calcularEdad(fechaNacimiento: string): number {
    return this.pacientesService.calcularEdad(fechaNacimiento);
  }


  verHistoriaDetalle(historia: any): void {
    this.historiaSeleccionada = historia;

    // Animación o efecto visual al seleccionar
    document.querySelectorAll('.historia-card').forEach(el => {
      el.classList.remove('active');
    });
    document.getElementById(`historia-${historia.id}`)?.classList.add('active');
  }

  cerrarHistorias(): void {
    const estadoAnterior = JSON.parse(sessionStorage.getItem('pacientesListState') || '{}');
    this.router.navigate(['/pacientes/lista'], {
      state: { scrollPosition: estadoAnterior.scrollPosition }
    });
  }

  nuevaHistoria(): void {
    // Implementar lógica para nueva historia
  }
}
