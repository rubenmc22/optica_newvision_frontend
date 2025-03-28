import { Component, OnInit } from '@angular/core';
import { AtletasService } from '../core/services/atletas/atletas.service';
import { Router } from '@angular/router'; // Router para navegación
import { SwalService } from '../core/services/swal/swal.service'; // Importa el servicio de SweetAlert2

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
        this.atletas = atletas;
        console.log('atletas', atletas);
        this.aplicarFiltros(); // Aplica filtros iniciales
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
    const normalizarTexto = (texto: string): string =>
      texto
        .normalize('NFD') // Normaliza caracteres con tilde/acento
        .replace(/[\u0300-\u036f]/g, '') // Elimina marcas diacríticas (acentos)
        .toLowerCase(); // Convierte todo a minúsculas

    const edadMinValida = this.filtros.edadMin ? Number(this.filtros.edadMin) || 0 : 0;
    const edadMaxValida = this.filtros.edadMax ? Number(this.filtros.edadMax) || 999 : 999;

    this.atletasFiltrados = this.atletas.filter(atleta => {
      const deporteValido =
        !this.filtros.deporte ||
        normalizarTexto(atleta.deporte) === normalizarTexto(this.filtros.deporte?.name || '');
      const posicionValida =
        !this.filtros.posicion ||
        normalizarTexto(atleta.posicion) === normalizarTexto(this.filtros.posicion);
      const generoValido =
        !this.filtros.genero ||
        atleta.generoTexto.toLowerCase() === this.filtros.genero.toLowerCase();
      const edadValida =
        atleta.edad >= edadMinValida && atleta.edad <= edadMaxValida;
      const busquedaValida =
        !this.filtros.busqueda ||
        normalizarTexto(atleta.nombre).includes(normalizarTexto(this.filtros.busqueda)) ||
        normalizarTexto(atleta.cedula).includes(normalizarTexto(this.filtros.busqueda)) ||
        normalizarTexto(atleta.correo).includes(normalizarTexto(this.filtros.busqueda));

      return (
        deporteValido &&
        posicionValida &&
        generoValido &&
        edadValida &&
        busquedaValida
      );
    });

    // Reinicia a la primera página después de filtrar
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
