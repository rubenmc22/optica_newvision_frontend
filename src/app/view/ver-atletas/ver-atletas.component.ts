import { Component, OnInit } from '@angular/core';
import { AtletasService } from '../../core/services/atletas/atletas.service';
import { Router } from '@angular/router'; // Router para navegación
import { SwalService } from '../../core/services/swal/swal.service'; // Importa el servicio de SweetAlert2

@Component({
  selector: 'app-ver-atletas',
  standalone: false,
  templateUrl: './ver-atletas.component.html',
  styleUrls: ['./ver-atletas.component.scss']
})
export class VerAtletasComponent implements OnInit {

  atletas: any[] = [];
  atletasFiltrados: any[] = [];
  cargando = true;
  errorMessage = '';

  constructor(
    private swalService: SwalService, // Inyecta el servicio de SweetAlert2
    private router: Router, // Inyecta el Router para la navegación
    private atletasService: AtletasService // Servicio de autenticación
  ) { }

  ngOnInit(): void {
    this.cargarAtletas();
  }

  cargarAtletas(): void {
    this.cargando = true;
    this.errorMessage = '';

    this.atletasService.getAllAtletas().subscribe({
      next: (atletas) => {
        // Procesar datos para asegurar valores por defecto
        this.atletas = atletas.map(atleta => ({
          ...atleta,
          deporte: atleta.deporte || null,
          posicion: atleta.posicion || null,
          edad: atleta.edad || 0,
          generoTexto: atleta.genero === 'M' ? 'Masculino' : 'Femenino'
        }));

        console.log('Atletas cargados:', this.atletas);
        this.aplicarFiltros();
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar atletas:', error);
        this.errorMessage = 'Error al cargar la lista de atletas';
        this.cargando = false;
        this.swalService.showError('Error', 'No se pudo cargar la lista de atletas');
      }
    });
  }

  filtros = {
    deporte: null as { id: number; name: string } | null,
    posicion: '',
    genero: '',
    edadMin: '' as string | null,
    edadMax: '' as string | null,
    busqueda: ''
  };

  posicionesFiltradas: string[] = [];
  // atletasFiltrados = [...this.atletas];

  // Paginación
  paginaActual: number = 1;
  tamanioPagina: number = 5;

  // Total de registros (filtrados)
  get totalRegistros(): number {
    return this.atletasFiltrados.length;
  }

  get totalPaginas(): number {
    return Math.ceil(this.totalRegistros / this.tamanioPagina);
  }

  get atletasPaginados(): any[] {
    const inicio = (this.paginaActual - 1) * this.tamanioPagina;
    return this.atletasFiltrados.slice(inicio, inicio + this.tamanioPagina);
  }

  availableSports = [
    { id: 1, name: 'Fútbol' },
    { id: 2, name: 'Voleibol' },
    { id: 3, name: 'Baloncesto' },
    { id: 4, name: 'Natación' },
    { id: 5, name: 'Atletismo' }
  ];

  sportPositions: { [key: number]: string[] } = {
    1: ['Delantero', 'Defensa', 'Portero', 'Mediocampista'],
    2: ['Central', 'Libero', 'Punta', 'Armador'],
    3: ['Base', 'Escolta', 'Ala', 'Pívot'],
    4: ['Espalda', 'Libre', 'Mariposa', 'Pecho'],
    5: ['Corredor', 'Lanzador', 'Saltador']
  };

  // Método para verificar si un atleta tiene datos incompletos
  tieneDatosIncompletos(atleta: any): boolean {
    return !atleta.cedula || !atleta.fecha_nacimiento || !atleta.altura ||
      !atleta.peso || !atleta.nacionalidad || !atleta.deporte ||
      !atleta.posicion;
  }

  // Método específico para campos obligatorios (excepto cédula)
  tieneCamposObligatoriosIncompletos(atleta: any): boolean {
    return !atleta.fecha_nacimiento || !atleta.altura ||
      !atleta.peso || !atleta.nacionalidad || !atleta.deporte ||
      !atleta.posicion;
  }

  // Método para obtener tooltip con campos faltantes
  getTooltipCamposFaltantes(atleta: any): string {
    const camposFaltantes = [];

    if (!atleta.fecha_nacimiento) camposFaltantes.push('Fecha de Nacimiento');
    // if (!atleta.altura) camposFaltantes.push('Altura');
    // if (!atleta.peso) camposFaltantes.push('Peso');
    //if (!atleta.nacionalidad) camposFaltantes.push('Nacionalidad');
    if (!atleta.deporte) camposFaltantes.push('Deporte');
    if (!atleta.posicion) camposFaltantes.push('Posición');

    return camposFaltantes.length > 0
      ? 'El Atleta no se ha registrado completamente, faltan registrar los siguientes campos: ' + camposFaltantes.join(', ')
      : 'Registro completo';
  }

  onSportDropdownChange(event: Event): void {
    const selectedValue = (event.target as HTMLSelectElement).value;

    const selectedSport: { id: number; name: string } | null =
      selectedValue ? this.availableSports.find(d => d.id === +selectedValue) || null : null;

    this.onSportSelect(selectedSport);
  }

  onSportSelect(sport: { id: number; name: string } | null): void {
    if (sport) {
      this.filtros.deporte = sport;
      this.posicionesFiltradas = this.sportPositions[sport.id] || [];
    } else {
      this.filtros.deporte = null;
      this.posicionesFiltradas = [];
    }
    this.aplicarFiltros();
  }

  aplicarFiltros(): void {
    // Función para normalizar texto (remover acentos y convertir a minúsculas)
    const normalizarTexto = (texto: string): string => {
      if (!texto) return '';
      return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    };

    // Convertir valores numéricos
    const edadMin = this.filtros.edadMin ? +this.filtros.edadMin : 0;
    const edadMax = this.filtros.edadMax ? +this.filtros.edadMax : 999;

    this.atletasFiltrados = this.atletas.filter(atleta => {
      // Normalizar el término de búsqueda
      const terminoBusqueda = normalizarTexto(this.filtros.busqueda);

      // Verificar coincidencia en nombre, cédula o correo
      const coincideBusqueda = !terminoBusqueda ||
        normalizarTexto(atleta.nombre).includes(terminoBusqueda) ||
        (atleta.cedula && normalizarTexto(atleta.cedula).includes(terminoBusqueda)) ||
        (atleta.correo && normalizarTexto(atleta.correo).includes(terminoBusqueda));

      // Verificar otros filtros
      const coincideDeporte = !this.filtros.deporte ||
        normalizarTexto(atleta.deporte) === normalizarTexto(this.filtros.deporte.name);

      const coincidePosicion = !this.filtros.posicion ||
        normalizarTexto(atleta.posicion) === normalizarTexto(this.filtros.posicion);

      const coincideGenero = !this.filtros.genero ||
        normalizarTexto(atleta.generoTexto) === normalizarTexto(this.filtros.genero);

      const coincideEdad = atleta.edad == null ||
        (atleta.edad >= edadMin && atleta.edad <= edadMax);

      return coincideBusqueda && coincideDeporte && coincidePosicion &&
        coincideGenero && coincideEdad;
    });

    // Reiniciar paginación
    this.paginaActual = 1;
  }


  validarSoloNumeros(event: Event): void {
    const input = event.target as HTMLInputElement;

    input.value = input.value.replace(/[^0-9]/g, '');

    if (input.id === 'edadMin') {
      this.filtros.edadMin = input.value || null;
    } else if (input.id === 'edadMax') {
      this.filtros.edadMax = input.value || null;
    }

    this.aplicarFiltros();
  }

  cambiarPagina(direccion: number): void {
    const nuevaPagina = this.paginaActual + direccion;
    if (nuevaPagina > 0 && nuevaPagina <= this.totalPaginas) {
      this.paginaActual = nuevaPagina;
    }
  }

  ordenActual: string = '';
  ordenAscendente: boolean = true;

  ordenarTabla(campo: keyof typeof this.atletas[0]): void {
    const esString = (val: any): val is string => typeof val === 'string';

    this.atletasFiltrados.sort((a, b) => {
      const valorA = esString(a[campo]) ? a[campo].toLowerCase() : String(a[campo]);
      const valorB = esString(b[campo]) ? b[campo].toLowerCase() : String(b[campo]);

      if (valorA < valorB) {
        return this.ordenAscendente ? -1 : 1;
      }
      if (valorA > valorB) {
        return this.ordenAscendente ? 1 : -1;
      }
      return 0;
    });
  }

  onFocus(): void {
    const selectElement = document.getElementById('deporte');
    if (selectElement) {
      selectElement.style.boxShadow = '0 0 5px var(--primary-color)'; // Sombra amarilla

    }
  }

  onBlur(): void {
    const selectElement = document.getElementById('deporte');
    if (selectElement) {
      selectElement.style.boxShadow = 'none'; // Sin sombra al perder el foco
    }
  }

}
