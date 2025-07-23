import { Component } from '@angular/core';
import { AuthData, Rol } from '../../Interfaces/models-interface';
import { PacientesService } from '../../core/services/pacientes/pacientes.service';
import { PacienteGrafico } from './../pacientes/paciente-interface';

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
  totalHistorias: number = 128;
  totalVentas: number = 52;
  ordenesPendientes: number = 6;

  pacientes: PacienteGrafico[] = [];

  // 📊 Datos para comparativa por sede
  datosComparativa: Record<string, { pacientes: number; ventas: number; ordenes: number }> | null = null;

  // 📅 Distribución mensual por sede actual
  datosLocales: {
    total: number;
    porMes: Record<string, { pacientes: number; ventas: number; ordenes: number }>;
  } | null = null;

  constructor(private pacientesService: PacientesService) {}

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

    this.cargarPacientes();
  }

  cargarPacientes(): void {
    this.pacientesService.getPacientes().subscribe({
      next: (data) => {
        this.pacientes = Array.isArray(data.pacientes)
          ? data.pacientes.map((p: any): PacienteGrafico => ({
              id: p.key,
              nombre: p.nombre,
              cedula: p.cedula,
              sede: p.sede?.id ?? 'sin-sede',
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
  }

  cargarDatosGraficos(): void {
    if (!this.pacientes.length) return;

    // 📊 Agrupación por sede
    const agrupadoPorSede: Record<string, { pacientes: number; ventas: number; ordenes: number }> = {};

    for (const p of this.pacientes) {
      const sede = p.sede;
      if (!agrupadoPorSede[sede]) {
        agrupadoPorSede[sede] = {
          pacientes: 0,
          ventas: Math.floor(Math.random() * 30), // Simulado
          ordenes: Math.floor(Math.random() * 10)  // Simulado
        };
      }
      agrupadoPorSede[sede].pacientes += 1;
    }

    const key = this.rolUsuario?.key ?? '';
    if (['admin', 'gerente'].includes(key)) {
      this.datosComparativa = agrupadoPorSede;
    }

    // 📅 Agrupación por mes para sede actual
    const pacientesSede = this.pacientes.filter(p => p.sede === this.sedeActual);
    const porMes: Record<string, { pacientes: number; ventas: number; ordenes: number }> = {};

    for (const p of pacientesSede) {
      const fecha = new Date(p.created_at);
      const mes = fecha.toLocaleString('default', { month: 'long', year: 'numeric' });

      if (!porMes[mes]) {
        porMes[mes] = {
          pacientes: 0,
          ventas: Math.floor(Math.random() * 15), // Simulado
          ordenes: Math.floor(Math.random() * 5)  // Simulado
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
