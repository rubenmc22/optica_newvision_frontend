import { Component } from '@angular/core';

@Component({
  selector: 'app-ver-atletas',
  standalone: false,
  templateUrl: './ver-atletas.component.html',
  styleUrls: ['./ver-atletas.component.scss']
})
export class VerAtletasComponent {
  atletas = [
    {
      cedula: '24367965',
      nombre: 'Ruben Dario Martinez Castro',
      edad: 29,
      genero: 'Hombre',
      deporte: 'Voleibol',
      posicion: 'Armador',
      correo: 'rubemm18@gmail.com'
    },
    {
      cedula: '24367966',
      nombre: 'Jesus Eduardo Martinez Castro',
      edad: 26,
      genero: 'Hombre',
      deporte: 'Futbol',
      posicion: 'Delantero',
      correo: 'jesusmc18@gmail.com'
    },
    {
      cedula: '45367967',
      nombre: 'María Fernanda López',
      edad: 24,
      genero: 'Mujer',
      deporte: 'Baloncesto',
      posicion: 'Base',
      correo: 'mariafl@gmail.com'
    },
    {
      cedula: '56789012',
      nombre: 'Ana Beatriz Pérez',
      edad: 22,
      genero: 'Mujer',
      deporte: 'Natación',
      posicion: 'Espalda',
      correo: 'anaperez@gmail.com'
    },
    {
      cedula: '34567890',
      nombre: 'Carlos Alberto Jiménez',
      edad: 33,
      genero: 'Hombre',
      deporte: 'Atletismo',
      posicion: 'Corredor',
      correo: 'carlosj@gmail.com'
    },
    {
      cedula: '87654321',
      nombre: 'Luis Miguel Rodríguez',
      edad: 27,
      genero: 'Hombre',
      deporte: 'Baloncesto',
      posicion: 'Escolta',
      correo: 'luisr@gmail.com'
    },
    {
      cedula: '11223344',
      nombre: 'Lucía Fernández',
      edad: 19,
      genero: 'Mujer',
      deporte: 'Fútbol',
      posicion: 'Defensa',
      correo: 'luciaf@gmail.com'
    },
    {
      cedula: '22334455',
      nombre: 'Andrea Morales',
      edad: 30,
      genero: 'Mujer',
      deporte: 'Voleibol',
      posicion: 'Punta',
      correo: 'andream@gmail.com'
    },
    {
      cedula: '33445566',
      nombre: 'José Ramírez',
      edad: 21,
      genero: 'Hombre',
      deporte: 'Futbol',
      posicion: 'Portero',
      correo: 'joser@gmail.com'
    },
    {
      cedula: '44556677',
      nombre: 'Valeria Torres',
      edad: 25,
      genero: 'Mujer',
      deporte: 'Natación',
      posicion: 'Mariposa',
      correo: 'valeriat@gmail.com'
    }
  ];

  filtros = {
    deporte: null as { id: number; name: string } | null,
    posicion: '',
    genero: '',
    edadMin: '' as string | null,
    edadMax: '' as string | null,
    busqueda: ''
  };

  posicionesFiltradas: string[] = [];
  atletasFiltrados = [...this.atletas];

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
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

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
        !this.filtros.genero || atleta.genero === this.filtros.genero;
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
    if (this.ordenActual === campo) {
      this.ordenAscendente = !this.ordenAscendente;
    } else {
      this.ordenActual = campo;
      this.ordenAscendente = true;
    }

    this.atletasFiltrados.sort((a, b) => {
      const valorA = a[campo]?.toString().toLowerCase() || '';
      const valorB = b[campo]?.toString().toLowerCase() || '';

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
