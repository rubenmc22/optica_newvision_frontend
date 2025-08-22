import { Component } from '@angular/core';
import { AuthData, Rol } from '../../Interfaces/models-interface';
import { PacientesService } from '../../core/services/pacientes/pacientes.service';
import { HistoriaMedicaService } from '../../core/services/historias-medicas/historias-medicas.service';
import { PacienteGrafico } from './../pacientes/paciente-interface';
import { DatosPorSede  } from './dashboard-interface';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})

export class DashboardComponent {
  rolUsuario: Rol | null = null;
  sedeActual: string = '';

  // Métricas generales simuladas
  totalHistorias: number = 0;
  totalVentas: string = 'No disponible';
  ordenesPendientes: string = 'No disponible';

  pacientes: PacienteGrafico[] = [];

  // 📊 Datos para comparativa por sede
datosComparativa: Record<string, DatosPorSede> | null = null;

  // 📅 Distribución mensual por sede actual
  datosLocales: {
    total: number;
    porMes: Record<string, { pacientes: number; ventas: number; ordenes: number }>;
  } | null = null;

  constructor(
    private pacientesService: PacientesService,
    private historiasService: HistoriaMedicaService // ← nuevo
  ) { }

  ngOnInit(): void {
    this.initializePantalla();
  }

  private initializePantalla(): void {
    const sessionUser = sessionStorage.getItem('authData');
    if (sessionUser) {
      const auth = JSON.parse(sessionUser) as AuthData;
      this.rolUsuario = auth.rol ?? null;
      this.sedeActual = auth.sede?.key ?? 'sin-sede';
    }

    this.cargarPacientesYHistorias();
  }

  cargarPacientesYHistorias(): void {
    forkJoin({
      pacientes: this.pacientesService.getPacientes(),
      historias: this.historiasService.getHistoriasMedicasAll()
    }).subscribe({
      next: ({ pacientes, historias }) => {
        this.pacientes = Array.isArray(pacientes.pacientes)
          ? pacientes.pacientes.map((p: any): PacienteGrafico => ({
            id: p.key,
            nombre: p.informacionPersonal?.nombreCompleto,
            cedula: p.informacionPersonal?.cedula,
            sede: p.key?.split('-')[0] ?? 'sin-sede',
            created_at: p.created_at
          }))
          : [];

        const historiasFiltradas = Array.isArray(historias.historiales_medicos)
          ? historias.historiales_medicos
          : [];

        this.totalHistorias = historiasFiltradas.filter(h => h.pacienteId?.startsWith(this.sedeActual)).length;
        this.cargarDatosGraficos(historiasFiltradas);
      },
      error: (err) => {
        console.error('Error al cargar datos:', err);
        this.pacientes = [];
        this.totalHistorias = 0;
      }
    });
  }


  /* cargarPacientes(): void {
     this.pacientesService.getPacientes().subscribe({
       next: (data) => {
         this.pacientes = Array.isArray(data.pacientes)
           ? data.pacientes.map((p: any): PacienteGrafico => ({
             id: p.key,
             nombre: p.informacionPersonal?.nombreCompleto,
             cedula: p.informacionPersonal?.cedula,
             sede: p.key?.split('-')[0] ?? 'sin-sede',
             created_at: p.created_at
           }))
           : [];
 
         this.cargarDatosGraficos();
       },
       error: (error) => {
         console.error('Error al cargar pacientes:', error);
         this.pacientes = [];
       }
     });
   }*/

  cargarDatosGraficos(historias: any[]): void {
    const agrupadoPorSede: Record<string, { pacientes: number; ventas: number; ordenes: number; historias: number }> = {};

    for (const p of this.pacientes) {
      const sede = p.sede;
      if (!agrupadoPorSede[sede]) {
        agrupadoPorSede[sede] = {
          pacientes: 0,
          ventas: Math.floor(Math.random() * 30),
          ordenes: Math.floor(Math.random() * 10),
          historias: 0
        };
      }
      agrupadoPorSede[sede].pacientes += 1;
    }

    for (const h of historias) {
      const sede = h.pacienteId?.split('-')[0] ?? 'sin-sede';
      if (!agrupadoPorSede[sede]) {
        agrupadoPorSede[sede] = {
          pacientes: 0,
          ventas: 0,
          ordenes: 0,
          historias: 0
        };
      }
      agrupadoPorSede[sede].historias += 1;
    }

    const key = this.rolUsuario?.key ?? '';
    if (['admin', 'gerente'].includes(key)) {
      this.datosComparativa = agrupadoPorSede;
    }

    // 📅 Agrupación mensual por sede actual
    const historiasSede = historias.filter(h => h.pacienteId?.startsWith(this.sedeActual));
    const porMes: Record<string, { pacientes: number; ventas: number; ordenes: number; historias: number }> = {};

    for (const h of historiasSede) {
      const fecha = new Date(h.auditoria?.fechaCreacion ?? h.created_at);
      const mes = fecha.toLocaleString('default', { month: 'long', year: 'numeric' });

      if (!porMes[mes]) {
        porMes[mes] = {
          pacientes: 0,
          ventas: Math.floor(Math.random() * 15),
          ordenes: Math.floor(Math.random() * 5),
          historias: 0
        };
      }
      porMes[mes].historias += 1;
    }

    const pacientesSede = this.pacientes.filter(p => p.sede === this.sedeActual);
    for (const p of pacientesSede) {
      const fecha = new Date(p.created_at);
      const mes = fecha.toLocaleString('default', { month: 'long', year: 'numeric' });

      if (!porMes[mes]) {
        porMes[mes] = {
          pacientes: 0,
          ventas: Math.floor(Math.random() * 15),
          ordenes: Math.floor(Math.random() * 5),
          historias: 0
        };
      }
      porMes[mes].pacientes += 1;
    }

    this.datosLocales = {
      total: pacientesSede.length,
      porMes
    };
  }


  // 🛡️ Helper para visibilidad de gráficos
  get puedeVerComparativa(): boolean {
    const key = this.rolUsuario?.key ?? '';
    return ['admin', 'gerente'].includes(key) && !!this.datosComparativa;
  }
}
