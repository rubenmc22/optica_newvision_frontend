import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { AuthService } from '../../core/services/auth/auth.service';
import { Router } from '@angular/router';
import { SwalService } from '../../core/services/swal/swal.service';
import { SharedUserService } from '../../core/services/sharedUser/shared-user.service';
import { environment } from '../../../environments/environment';
import { User } from '../../Interfaces/models-interface';
import { Subscription } from 'rxjs';
import { UserStateService } from '../../core/services/userState/user-state-service';
import { TasaCambiariaService } from '../../core/services/tasaCambiaria/tasaCambiaria.service';
import { Tasa } from '../../Interfaces/models-interface';

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
  sedeActual: string = '';
  tasaDolar: number = 0;
  tasaEuro: number = 0;



  private userSubscriptions: Subscription[] = [];

  constructor(
    private swalService: SwalService,
    private router: Router,
    private authService: AuthService,
    private sharedUserService: SharedUserService,
    private userStateService: UserStateService,
    private tasaCambiariaService: TasaCambiariaService,

  ) { }

  menuItems = [
    {
      label: 'Dashboard',
      icon: 'fas fa-tachometer-alt',
      routerLink: '/dashboard',
      roles: ['admin', 'gerente', 'asesor']
    },
    {
      label: 'Pacientes',
      icon: 'fas fa-football-ball',
      submenu: [
        { label: 'Ver pacientes', routerLink: '/pacientes', roles: ['admin', 'gerente', 'asesor'] },
        { label: 'Historias Medicas', routerLink: '/pacientes-historias', roles: ['admin', 'gerente', 'asesor'] },

      ],
      roles: ['admin', 'gerente', 'asesor'],
      //  underConstruction: true
    },
    {
      label: 'Productos',
      icon: 'fas fa-users',
      routerLink: '/productos',
      roles: ['admin', 'gerente', 'asesor']
      /* submenu: [
         { label: 'Agregar Atletas', routerLink: '/crear-atletas', roles: ['admin', 'gerente'] },
         { label: 'Ver Atletas', routerLink: '/ver-atletas', roles: ['admin'] },
         { label: 'Ficha Técnica', routerLink: '/ficha-tecnica', roles: ['admin', 'gerente'], underConstruction: true }
       ],*/
    },
    {
      label: 'Ventas',
      icon: 'fas fa-football-ball',
      submenu: [
        { label: 'Historial de ventas.', routerLink: '/Ventas/voleibol', roles: ['admin', 'gerente', 'asesor'] },
        { label: 'Presupuesto', routerLink: '/Ventas/presupuesto', roles: ['admin', 'gerente', 'asesor'] },
        { label: 'Cierre de caja', routerLink: '/Ventas/cierre-de-caja', roles: ['admin', 'gerente'] },

      ],
      roles: ['admin', 'gerente', 'asesor'],
      //  underConstruction: true
    },
    {
      label: 'Ordenes de Trabajo',
      icon: 'fas fa-football-ball',
      routerLink: '/ordenes-de-trabajo',
      roles: ['admin', 'gerente', 'asesor'],
      /* submenu: [
         { label: 'Ordenes de trabajo', routerLink: '/ordenes-de-trabajo', roles: ['admin', 'gerente', 'asesor'] },
         { label: 'Presupuesto', routerLink: '/Ventas/presupuesto', roles: ['admin', 'gerente', 'asesor'] },
         { label: 'Cierre de caja', routerLink: '/Ventas/cierre-de-caja', roles: ['admin', 'gerente'] },
 
       ],*/

      //  underConstruction: true
    },
    {
      label: 'Administración',
      icon: 'fas fa-user',
      submenu: [
        { label: 'Configurar mi Cuenta', routerLink: '/my-account', roles: ['admin', 'gerente', 'asesor'] },
        { label: 'Gestionar usuarios', routerLink: '/usuarios-empleados', roles: ['admin'], underConstruction: false },
        { label: 'Tipo de cambio', routerLink: '/Tipo-de-cambio', roles: ['admin', 'gerente', 'asesor'] }
      ],
      roles: ['admin', 'gerente', 'asesor']
    }
  ];

  filteredMenu: any[] = [];

  ngOnInit(): void {
    this.initializeMenu();
    this.initializeUserData();
    this.setupSubscriptions();
    this.obtenerSedeActual();
    this.obtenerTasaCambio();
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
  obtenerSedeActual(): void {
    const authData = sessionStorage.getItem('authData');

    if (authData) {
      try {
        const parsed = JSON.parse(authData) as {
          sede?: { nombre?: string };
        };

        const nombreOriginal = parsed?.sede?.nombre ?? 'Sin sede';
        this.sedeActual = nombreOriginal.replace(/^Sede\s+/i, '');
      } catch (e) {
        console.error('Error al parsear authData:', e);
        this.sedeActual = 'Sin sede';
      }
    } else {
      this.sedeActual = 'Sin sede';
    }
  }


  obtenerTasaCambio(): void {
    this.tasaCambiariaService.getTasaActual().subscribe({
      next: (res: { tasas: Tasa[] }) => {
        const tasas: Tasa[] = res.tasas;

        this.tasaDolar = tasas.find((t: Tasa) => t.id === 'dolar')?.valor ?? 0;
        this.tasaEuro = tasas.find((t: Tasa) => t.id === 'euro')?.valor ?? 0;
      },
      error: () => {
        this.tasaDolar = 0;
        this.tasaEuro = 0;
      }
    });

  }
}