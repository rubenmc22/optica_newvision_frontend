import { Component, OnInit, Input } from '@angular/core';
import { AuthService } from '../../core/services/auth/auth.service'; // Servicio de autenticación
import { Router } from '@angular/router'; // Router para navegación
import { SwalService } from '../../core/services/swal/swal.service';

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {

  @Input() userRoleKey: string = '';
  @Input() userRoleName: string = '';
  @Input() userName: string = '';

  constructor(
    private swalService: SwalService, // Inyecta el servicio de SweetAlert2
    private router: Router, // Inyecta el Router para la navegación
    private authService: AuthService // Servicio de autenticación
  ) { }


  // Definición dinámica de los menús y submenús según el rol
  menuItems = [
    {
      label: 'Dashboard',
      icon: 'fas fa-tachometer-alt',
      routerLink: '/dashboard',
      roles: ['admin', 'representante', 'atleta']
    },
    {
      label: 'Deportes',
      icon: 'fas fa-football-ball',
      submenu: [
        { label: 'Voleibol', routerLink: '/deportes/voleibol', roles: ['admin', 'representante', 'atleta'] },
        { label: 'Béisbol', routerLink: '/deportes/beisbol', roles: ['admin', 'representante', 'atleta'] },
        { label: 'Fútbol', routerLink: '/deportes/futbol', roles: ['admin', 'representante', 'atleta'] }
      ],
      roles: ['admin', 'representante', 'atleta'],
      underConstruction: true // Marca el menú de Deportes como en desarrollo
    },
    {
      label: 'Atletas',
      icon: 'fas fa-users',
      submenu: [
        { label: 'Agregar Atletas', routerLink: '/crear-atletas', roles: ['admin', 'representante'] },
        { label: 'Ver Atletas', routerLink: '/ver-atletas', roles: ['admin'] },
        { label: 'Ficha Técnica', routerLink: '/ficha-tecnica', roles: ['admin', 'representante'], underConstruction: true }
      ],
      roles: ['admin', 'representante']
    },
    {
      label: 'Mi Perfil',
      icon: 'fas fa-user',
      submenu: [
        { label: 'Gestionar mi Cuenta', routerLink: '/my-account', roles: ['admin', 'representante', 'atleta'] },
        { label: 'Ficha Técnica', routerLink: '/ficha-tecnica', roles: ['atleta'], underConstruction: true },
        { label: 'Mis estadísticas / habilidades', routerLink: '/estadisticas', roles: ['admin', 'representante', 'atleta'] }
      ],
      roles: ['admin', 'representante', 'atleta']
    }
  ];

  // Menú filtrado dinámicamente
  filteredMenu: {
    label: string;
    routerLink?: string;
    submenu?: { label: string; routerLink: string; roles: string[]; underConstruction?: boolean }[];
    roles: string[];
    icon?: string;
    underConstruction?: boolean;
  }[] = [];

  ngOnInit(): void {
    this.initializeMenu();
  }

  private initializeMenu(): void {
    const currentRol = this.authService.getCurrentRol();
  //  console.log('currentRol', currentRol);
    const currentName = this.authService.getCurrentUser();
    this.userRoleKey = currentRol?.key || '';
    this.userRoleName = currentRol?.name || '';
    this.userName = currentName?.nombre || '';

    this.filteredMenu = this.menuItems
      .map(menu => {
        // Si el usuario no es atleta, mueve "Ficha Técnica" al menú de Atletas
        if (menu.label === 'Atletas' && this.userRoleKey !== 'atleta' && menu.submenu) {
          // Asegurar que no exista duplicación
          const fichaTecnicaExists = menu.submenu.some(sub => sub.label === 'Ficha Técnica');
          if (!fichaTecnicaExists) {
            menu.submenu.push({
              label: 'Ficha Técnica',
              routerLink: '/ficha-tecnica',
              roles: ['admin', 'representante'],
              underConstruction: false
            });
          }
        }

        // Filtrar submenús visibles para el rol
        if (menu.submenu) {
          const filteredSubmenu = menu.submenu.filter(sub => sub.roles.includes(this.userRoleKey));
          return { ...menu, submenu: filteredSubmenu };
        }

        return menu;
      })
      .filter(menu => menu.roles.includes(this.userRoleKey) || (menu.submenu && menu.submenu.length > 0)); // Filtrar menús
  }


  toggleSubmenu(event: Event): void {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    const submenu = target.nextElementSibling as HTMLElement | null;
    const icon = target.querySelector('.fas.fa-angle-left') as HTMLElement | null;

    if (submenu) {
      const isOpen = submenu.classList.contains('menu-open');

      if (isOpen) {
        submenu.classList.remove('menu-open');
        submenu.style.display = 'none';
        if (icon) {
          icon.classList.remove('fa-rotate-custom-open');
          icon.classList.add('fa-rotate-custom');
        }
      } else {
        submenu.classList.add('menu-open');
        submenu.style.display = 'block';
        if (icon) {
          icon.classList.remove('fa-rotate-custom');
          icon.classList.add('fa-rotate-custom-open');
        }
      }
    }
  }

  onMenuClick(event: Event, menuItem: any) {
  //  console.log('menuItem', menuItem);
    if (menuItem?.underConstruction) {
      console.log('menuItem?.underConstruction', menuItem?.underConstruction);
      event.preventDefault();  // Detiene el routerLink
      event.stopImmediatePropagation();  // Evita otros listeners

      return;
    }

  }

  confirmLogout(): void {
    this.authService.logout(); // Llamar al método de logout
    this.swalService.showSuccess('Sesión cerrada', 'Tu sesión se ha cerrado exitosamente.')
      .then(() => {
        this.router.navigate(['/login']); // Redirigir al login
      });
  }

  getMarginForModule(moduleName: string): string {
    const margins: { [key: string]: string } = {
      'Dashboard': '8px',    // Margen estándar
      'Deportes': '10px',    // Más margen por jerarquía o diseño
      'Atletas': '5px',     // Margen intermedio
      'Mi Perfil': '10px',   // Más espacio para destacar
    };

    return margins[moduleName] || '8px'; // Valor por defecto si no hay coincidencia
  }

}