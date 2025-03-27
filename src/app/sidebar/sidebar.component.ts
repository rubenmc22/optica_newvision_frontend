import { Component, Input, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../core/services/auth/auth.service';
import { Router } from '@angular/router';
import { SwalService } from '../core/services/swal/swal.service';

interface ApiUser {
  id?: string;
  cedula?: string;
  correo?: string;
  nombre?: string;
  telefono?: string;
  email?: string;
}

interface Rol {
  _id: string;
  key: string;
  name: string;
}

interface MenuItem {
  label: string;
  icon?: string;
  routerLink?: string;
  submenu?: SubMenuItem[];
  roles: string[];
  underConstruction?: boolean;
  isOpen?: boolean;
}

interface SubMenuItem {
  label: string;
  routerLink: string;
  roles: string[];
  underConstruction?: boolean;
}

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
  filteredMenu: MenuItem[] = [];

  constructor(
    private swalService: SwalService,
    private router: Router,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) { }

  private menuItems: MenuItem[] = [
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
      underConstruction: true
    },
    {
      label: 'Atletas',
      icon: 'fas fa-users',
      submenu: [
        { label: 'Agregar Atletas', routerLink: '/crear-atletas', roles: ['admin', 'representante'] },
        { label: 'Ver Atletas', routerLink: '/ver-atletas', roles: ['admin'] },
        { label: 'Ficha Técnica', routerLink: '/ficha-tecnica', roles: ['admin', 'representante'] }
      ],
      roles: ['admin', 'representante']
    },
    {
      label: 'Mi Perfil',
      icon: 'fas fa-user',
      submenu: [
        { label: 'Gestionar mi Cuenta', routerLink: '/my-account', roles: ['admin', 'representante', 'atleta'] },
        { label: 'Ficha Técnica', routerLink: '/ficha-tecnica', roles: ['atleta'] },
        { label: 'Mis estadísticas / habilidades', routerLink: '/estadisticas', roles: ['admin', 'representante', 'atleta'] }
      ],
      roles: ['admin', 'representante', 'atleta']
    }
  ];

  ngOnInit(): void {
    this.initializeMenu();
  }

  private initializeMenu(): void {
    const currentRol = this.authService.getCurrentRol();
    console.log('currentRol', currentRol);
    const currentName = this.authService.getCurrentUser();
    this.userRoleKey = currentRol?.key || '';
    this.userRoleName = currentRol?.name || '';
    this.userName = currentName?.nombre || '';

    this.filteredMenu = this.menuItems
      .filter(menu => this.hasPermission(menu.roles))
      .map(menu => {
        // Si el usuario no es atleta, mueve "Ficha Técnica" al menú de Atletas
        if (menu.label === 'Atletas' && this.userRoleKey !== 'atleta' && menu.submenu) {
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

        return {
          ...menu,
          isOpen: false,
          submenu: menu.submenu?.filter(sub => this.hasPermission(sub.roles))
        };
      })
      .filter(menu => menu.roles.includes(this.userRoleKey) || (menu.submenu && menu.submenu.length > 0));
  }

  toggleMenu(menu: MenuItem): void {
    // Cierra otros menús abiertos primero
    this.filteredMenu.forEach(m => {
      if (m !== menu) m.isOpen = false;
    });

    // Alterna el estado del menú actual
    menu.isOpen = !menu.isOpen;
  }

  handleMenuClick(event: Event, menuItem: MenuItem): void {
    if (menuItem.underConstruction) {
      event.preventDefault();
      this.showUnderConstructionMessage(menuItem.label);
      return;
    }

    if (menuItem.submenu) {
      event.preventDefault();
      this.toggleMenu(menuItem);
      return;
    }

    // Si no tiene submenú, el routerLink manejará la navegación
  }

  private hasPermission(requiredRoles: string[]): boolean {
    return requiredRoles.includes(this.userRoleKey);
  }

  private showUnderConstructionMessage(menuLabel: string): void {
    this.snackBar.open(`El módulo ${menuLabel} está en desarrollo`, 'Cerrar', {
      duration: 3000,
      panelClass: ['info-snackbar']
    });
  }
  onMenuClick(event: Event, menuItem: any): void {
    if (menuItem.underConstruction || !menuItem.routerLink) {
      event.preventDefault(); // Evita la navegación
      console.log('Módulo en desarrollo:', menuItem.label);
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
}