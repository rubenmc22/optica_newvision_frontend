import { Component, ElementRef, OnInit, Input, ChangeDetectorRef } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../core/services/auth/auth.service'; // Servicio de autenticación
import { Router } from '@angular/router'; // Router para navegación
import Swal from 'sweetalert2';
import { SwalService } from '../core/services/swal/swal.service'; // Importa el servicio de SweetAlert2
//import { SwalService } from '../services/swal/swal.service'; // Servicio de SweetAlert2

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {


  constructor(
    private swalService: SwalService, // Inyecta el servicio de SweetAlert2
    private router: Router, // Inyecta el Router para la navegación
    private authService: AuthService // Servicio de autenticación
  ) { }

  @Input() userRole: string = 'admin'; // Recibe el rol del usuario dinámicamente

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
        { label: 'Ficha Técnica', routerLink: '/ficha-tecnica', roles: ['admin', 'representante'], underConstruction: false }
      ],
      roles: ['admin', 'representante']
    },
    {
      label: 'Mi Perfil',
      icon: 'fas fa-user',
      submenu: [
        { label: 'Gestionar mi Cuenta', routerLink: '/my-account', roles: ['admin', 'representante', 'atleta'] },
        { label: 'Ficha Técnica', routerLink: '/ficha-tecnica', roles: ['atleta'], underConstruction: false },
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
    console.log('Preparando menú dinámico.');

    this.filteredMenu = this.menuItems
      .map(menu => {
        // Si el usuario no es atleta, mueve "Ficha Técnica" al menú de Atletas
        if (menu.label === 'Atletas' && this.userRole !== 'atleta' && menu.submenu) {
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
          const filteredSubmenu = menu.submenu.filter(sub => sub.roles.includes(this.userRole));
          return { ...menu, submenu: filteredSubmenu };
        }

        return menu;
      })
      .filter(menu => menu.roles.includes(this.userRole) || (menu.submenu && menu.submenu.length > 0)); // Filtrar menús
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