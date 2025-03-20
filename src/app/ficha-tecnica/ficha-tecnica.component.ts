import { Component } from '@angular/core';

@Component({
  selector: 'app-ficha-tecnica',
  standalone: false,
  templateUrl: './ficha-tecnica.component.html',
  styleUrls: ['./ficha-tecnica.component.scss']
})
export class FichaTecnicaComponent {
  // Datos del usuario
  user: {
    photo: string;
    name: string;
    age: string;
    birthDate: string;
    height: string;
    weight: string;
    sports: { id: number; name: string; position: string; stats: { label: string; value: number }[] }[];
  } = {
    photo: '',
    name: 'Juan Pérez',
    age: '29',
    birthDate: this.formatDate('1995-11-10'),
    height: '180 cm',
    weight: '75 kg',
    sports: []
  };

  // Mock de deportes disponibles con ID numérico
  availableSports = [
    { id: 1, name: 'Fútbol', stats: [] },
    { id: 2, name: 'Voleibol', stats: [] },
    { id: 3, name: 'Baloncesto', stats: [] },
    { id: 4, name: 'Natación', stats: [] },
    { id: 5, name: 'Atletismo', stats: [] }
  ];

  // Propiedad para controlar la pestaña activa
  activeTab: number = 0; // Inicializa con la primera pestaña

  // Posiciones disponibles asociadas a cada deporte por ID
  sportPositions: { [key: number]: string[] } = {
    1: ['Delantero', 'Defensa', 'Portero', 'Mediocampista'],
    2: ['Central', 'Libero', 'Punta', 'Armador'],
    3: ['Base', 'Escolta', 'Ala', 'Pívot'],
    4: ['Espalda', 'Libre', 'Mariposa', 'Pecho'],
    5: ['Corredor', 'Lanzador', 'Saltador']
  };

  // Posiciones dinámicas
  positions: string[] = [];

  // Campos adicionales del usuario
  additionalFields = [
    { key: 'nationality', label: 'Nacionalidad', value: '', placeholder: 'Ej: Venezuela' },
    { key: 'weight', label: 'Peso', value: '', placeholder: 'Ej: 80kg' },
    { key: 'height', label: 'Altura', value: '', placeholder: 'Ej: 170cm' }
  ];

  // Estados de edición para los campos adicionales
  edit: { [key: string]: boolean } = {};

  // Deporte y posición seleccionados
  selectedSport: { id: number; name: string; stats: { label: string; value: number }[] } | null = null;
  selectedPosition: string = '';

  // Alternar edición de campos adicionales
  toggleEdit(field: string): void {
    if (!this.edit[field]) {
      this.edit[field] = true; // Activa el modo de edición
    } else {
      this.edit[field] = false; // Desactiva el modo de edición
      console.log(`Guardando campo ${field}:`, this.getFieldValue(field));
    }
  }

  // Obtener el valor de un campo adicional
  getFieldValue(field: string): string {
    const userField = this.additionalFields.find(item => item.key === field);
    return userField?.value || (this.user as any)[field] || '';
  }

  // Manejar selección de deportes y cargar posiciones dinámicamente
  onSportSelect(sport: { id: number; name: string; stats: { label: string; value: number }[] } | null): void {
    this.selectedSport = sport;

    // Validar que selectedSport y selectedSport.id son válidos
    if (sport?.id && this.sportPositions[sport.id]) {
      this.positions = this.sportPositions[sport.id]; // Acceso seguro por ID
    } else {
      this.positions = []; // Si no es válido, limpiamos posiciones
    }
  }

  // Manejar selección de posición
  onPositionSelect(position: string): void {
    if (this.selectedSport && position) {
      // Agregar el deporte automáticamente al seleccionar la posición
      if (!this.user.sports.find(s => s.id === this.selectedSport?.id)) {
        this.user.sports.push({
          id: this.selectedSport.id,
          name: this.selectedSport.name,
          position,
          stats: this.generateStats(this.selectedSport.name)
        });
        console.log(`Deporte agregado automáticamente: ${this.selectedSport.name} - Posición: ${position}`);
      }
      // Reiniciar los campos después de agregar
      this.selectedSport = null;
      this.positions = [];
      this.selectedPosition = '';
    }
  }

  // Cambiar entre pestañas (deportes)
  switchTab(index: number): void {
    this.activeTab = index;
    console.log(`Pestaña activa cambiada: Deporte - ${this.user.sports[index]?.name}`);
  }

  // Generar estadísticas iniciales para un deporte
  private generateStats(sportName: string): { label: string; value: number }[] {
    return [
      { label: 'Partidos Jugados', value: 0 },
      { label: 'Victorias', value: 0 },
      { label: 'Derrotas', value: 0 },
      { label: 'Puntos', value: 0 }
    ];
  }

  // Eliminar un deporte seleccionado
  removeSport(sportId: number): void {
    this.user.sports = this.user.sports.filter(s => s.id !== sportId);
    console.log(`Deporte eliminado: ID - ${sportId}`);
  }

  // Formatear fecha
  private formatDate(date: string): string {
    if (!date) return 'Información no disponible';
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }
}
