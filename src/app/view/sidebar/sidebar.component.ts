import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { AuthService } from '../../core/services/auth/auth.service';
import { Router } from '@angular/router';
import { SwalService } from '../../core/services/swal/swal.service';
import { SharedUserService } from '../../core/services/sharedUser/shared-user.service';
import { environment } from '../../../environments/environment';
import { User } from '../../Interfaces/models-interface';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Input() userRoleKey: string = '';
  @Input() userRoleName: string = '';
  @Input() userName: string = '';
  profileImage: string = 'assets/default-photo.png';

  private userSubscriptions: Subscription[] = [];

  constructor(
    private swalService: SwalService,
    private router: Router,
    private authService: AuthService,
    private sharedUserService: SharedUserService,
  ) { }

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
      underConstruction: true
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

  filteredMenu: any[] = [];

  ngOnInit(): void {
    this.initializeMenu();
    this.initializeUserData();
    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    this.userSubscriptions.forEach(sub => sub.unsubscribe());
  }

  private setupSubscriptions(): void {
    // Suscripción a cambios en el perfil compartido
    const userProfileSub = this.sharedUserService.currentUserProfile$.subscribe((profile: User) => {
      if (profile) {
        this.userName = profile.nombre || this.userName;
        if (profile.ruta_imagen) {
          this.profileImage = this.sharedUserService.getFullImageUrl(profile.ruta_imagen);
        }
      }
    });

    // Suscripción a cambios en el AuthService
    const authUserSub = this.authService.currentUser$.subscribe(authData => {
      if (authData?.user) {
        this.userName = authData.user.nombre || this.userName;
        this.userRoleName = authData.rol?.name || '';
        if (authData.user.ruta_imagen) {
          this.profileImage = this.sharedUserService.getFullImageUrl(authData.user.ruta_imagen);
        }
      }
    });

    this.userSubscriptions.push(userProfileSub, authUserSub);
  }

  private updateUserProfile(user: User): void {
    if (user) {
      this.userName = user.nombre || this.userName;

      // Actualiza la imagen solo si hay un cambio real
      if (user.ruta_imagen && user.ruta_imagen !== this.profileImage) {
        this.profileImage = this.sharedUserService.getFullImageUrl(user.ruta_imagen);
      } else if (!user.ruta_imagen) {
        this.profileImage = 'assets/default-photo.png';
      }
    }
  }

  private initializeUserData(): void {
    const currentUser = this.authService.getCurrentUser();
    const currentRole = this.authService.getCurrentRol();

    if (currentUser) {
      this.userName = currentUser.nombre || '';
      this.userRoleName = currentRole?.name || '';

      if (currentUser.ruta_imagen) {
        this.profileImage = this.sharedUserService.getFullImageUrl(currentUser.ruta_imagen);
      }
    }
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/default-photo.png';
  }

  private initializeMenu(): void {
    const currentRol = this.authService.getCurrentRol();
    const currentName = this.authService.getCurrentUser();

    this.userRoleKey = currentRol?.key || '';
    this.userRoleName = currentRol?.name || '';
    this.userName = currentName?.nombre || '';

    this.filteredMenu = this.menuItems
      .map(menu => {
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

        if (menu.submenu) {
          const filteredSubmenu = menu.submenu.filter(sub => sub.roles.includes(this.userRoleKey));
          return { ...menu, submenu: filteredSubmenu };
        }

        return menu;
      })
      .filter(menu => menu.roles.includes(this.userRoleKey) || (menu.submenu && menu.submenu.length > 0));
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
    if (menuItem?.underConstruction) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
  }

  confirmLogout(): void {
    this.authService.logout();
    this.swalService.showSuccess('Sesión cerrada', 'Tu sesión se ha cerrado exitosamente.')
      .then(() => {
        this.router.navigate(['/login']);
      });
  }

  getMarginForModule(moduleName: string): string {
    const margins: { [key: string]: string } = {
      'Dashboard': '8px',
      'Deportes': '10px',
      'Atletas': '5px',
      'Mi Perfil': '10px',
    };
    return margins[moduleName] || '8px';
  }
}