import { Component, OnInit, Input, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../../core/services/auth/auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { SwalService } from '../../core/services/swal/swal.service';
import { SharedUserService } from '../../core/services/sharedUser/shared-user.service';
import { User } from '../../Interfaces/models-interface';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { UserStateService } from '../../core/services/userState/user-state-service';
import { TasaCambiariaService } from '../../core/services/tasaCambiaria/tasaCambiaria.service';
import { Tasa } from '../../Interfaces/models-interface';
import { LoaderService } from '../../shared/loader/loader.service';

// Importar Bootstrap
import * as bootstrap from 'bootstrap';

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})

export class SidebarComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() userRoleKey: string = '';
  @Input() userRoleName: string = '';
  @Input() userName: string = '';
  profileImage: string = 'assets/default-photo.png';
  sedeActual: string = '';
  tasaDolar: number = 0;
  tasaEuro: number = 0;
  private subsTasaCambio!: Subscription;
  selectedMenuLabel: string = '';
  selectedSubmenuLabel: string | null = null;

  private userSubscriptions: Subscription[] = [];
  private userDropdown: any;

  constructor(
    private swalService: SwalService,
    private router: Router,
    private authService: AuthService,
    private sharedUserService: SharedUserService,
    private userStateService: UserStateService,
    private tasaCambiariaService: TasaCambiariaService,
    public loader: LoaderService,
    private cdRef: ChangeDetectorRef
  ) { }

  menuItems = [
    {
      label: 'Tablero Principal',
      icon: 'fas fa-tachometer-alt',
      routerLink: '/dashboard',
      roles: ['admin', 'gerente', 'asesor-optico']
    },
    {
      label: 'Datos Clínicos',
      icon: 'fas fa-stethoscope',
      submenu: [
        { label: 'Pacientes', routerLink: '/pacientes', roles: ['admin', 'gerente', 'asesor-optico'] },
        { label: 'Historias Medicas', routerLink: '/pacientes-historias', roles: ['admin', 'gerente', 'asesor-optico'] }
      ],
      roles: ['admin', 'gerente', 'asesor-optico'],
      underConstruction: false
    },
    {
      label: 'Inventario de Productos',
      icon: 'fas fa-boxes',
      routerLink: '/productos-inventario',
      roles: ['admin', 'gerente', 'asesor-optico'],
      underConstruction: false
    },
    {
      label: 'Gestión de Ventas',
      icon: 'fas fa-shopping-cart',
      routerLink: '/ventas',
      roles: ['admin', 'gerente', 'asesor-optico'],
      underConstruction: false
    },
    {
      label: 'Órdenes de Trabajo',
      icon: 'fas fa-clipboard-list',
      routerLink: '/ordenes-de-trabajo',
      roles: ['admin', 'gerente', 'asesor-optico'],
      underConstruction: false
    },
    {
      label: 'Gestión de Usuarios',
      icon: 'fas fa-users-cog',
      routerLink: '/empleados',
      roles: ['admin'],
      underConstruction: false
    }
  ];

  filteredMenu: any[] = [];

  ngOnInit(): void {
    //Restaurar selección previa desde localStorage
    const savedMenu = localStorage.getItem('selectedMenuLabel');
    const savedSubmenu = localStorage.getItem('selectedSubmenuLabel');

    if (savedMenu) {
      this.selectedMenuLabel = savedMenu;
    } else {
      this.selectedMenuLabel = 'Dashboard';
    }

    if (savedSubmenu) {
      this.selectedSubmenuLabel = savedSubmenu;
    } else {
      this.selectedSubmenuLabel = null;
    }

    //Obtener tasas de cambio
    this.subsTasaCambio = this.tasaCambiariaService.getTasas().subscribe(({ usd, eur }) => {
      this.tasaDolar = usd;
      this.tasaEuro = eur;
      this.cdRef.detectChanges();
    });

    //Inicializar menú y datos
    this.initializeMenu();
    this.markActiveFromUrl(this.router.url);
    this.initializeUserData();
    this.setupSubscriptions();
    this.obtenerSedeActual();
    this.obtenerTasaCambio();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initializeBootstrapDropdowns();
      this.cdRef.detectChanges();
    });
  }

  private initializeBootstrapDropdowns(): void {
    // Inicializar dropdown de usuario con Bootstrap
    const userDropdownElement = document.getElementById('userDropdown');
    if (userDropdownElement) {
      this.userDropdown = new bootstrap.Dropdown(userDropdownElement);
    }
  }

  // Método para toggle manual del dropdown
  toggleUserDropdown(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.userDropdown) {
      this.userDropdown.toggle();
    } else {
      // Fallback manual
      const dropdownMenu = document.querySelector('.user-dropdown-menu');
      if (dropdownMenu) {
        const isShowing = dropdownMenu.classList.contains('show');

        // Cerrar todos los dropdowns primero
        document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
          menu.classList.remove('show');
        });

        // Abrir/cerrar el actual
        if (!isShowing) {
          dropdownMenu.classList.add('show');
        }
      }
    }
  }

  // Cerrar dropdown cuando se hace click en un item
  closeUserDropdown(): void {
    if (this.userDropdown) {
      this.userDropdown.hide();
    } else {
      const dropdownMenu = document.querySelector('.user-dropdown-menu');
      if (dropdownMenu) {
        dropdownMenu.classList.remove('show');
      }
    }
  }

  // Navegar a Mi Perfil
  goToMyProfile(): void {
    this.closeUserDropdown();
    this.router.navigate(['/my-account']);
  }

  // Navegar a Tipo de Cambio
  goToExchangeRate(): void {
    this.closeUserDropdown();
    this.router.navigate(['/Tipo-de-cambio']);
  }

  // Navegar a Configuración del sistema
  goToSystemConfig(): void {
    this.closeUserDropdown();
    this.router.navigate(['/configuracion-sistema']);
  }


  private normalizeUrl(url: string): string {
    return (url || '').split('?')[0].split('#')[0].trim().toLowerCase();
  }

  private routeMatches(currentUrl: string, route: string): boolean {
    const current = this.normalizeUrl(currentUrl);
    const target = this.normalizeUrl(route);

    return current === target || current.startsWith(`${target}/`);
  }

  isNavbarRouteActive(route: string): boolean {
    return this.routeMatches(this.router.url, route);
  }


  markActiveFromUrl(url: string): void {
    this.selectedMenuLabel = '';
    this.selectedSubmenuLabel = null;

    for (const menu of this.filteredMenu) {
      if (menu.routerLink && this.routeMatches(url, menu.routerLink)) {
        this.selectedMenuLabel = menu.label;
        localStorage.setItem('selectedMenuLabel', this.selectedMenuLabel);
        localStorage.setItem('selectedSubmenuLabel', '');
        return;
      }

      if (menu.submenu) {
        const sub = menu.submenu.find((s: { routerLink: string }) => this.routeMatches(url, s.routerLink));
        if (sub) {
          this.selectedMenuLabel = menu.label;
          this.selectedSubmenuLabel = sub.label;
          localStorage.setItem('selectedMenuLabel', this.selectedMenuLabel);
          localStorage.setItem('selectedSubmenuLabel', this.selectedSubmenuLabel);
          return;
        }
      }
    }

    localStorage.setItem('selectedMenuLabel', '');
    localStorage.setItem('selectedSubmenuLabel', '');
  }

  buildSubmenuItem(sub: any, parentLabel: string): any {
    return { ...sub, parentLabel };
  }

  ngOnDestroy(): void {
    this.userSubscriptions.forEach(sub => sub.unsubscribe());
    if (this.subsTasaCambio) {
      this.subsTasaCambio.unsubscribe();
    }
  }

  private setupSubscriptions(): void {
    // Suscripción a cambios en el perfil compartido
    const userProfileSub = this.sharedUserService.currentUserProfile$.subscribe((profile: User) => {
      if (profile) {
        this.userName = profile.nombre || this.userName;
        if (profile.ruta_imagen) {
          this.profileImage = this.sharedUserService.getFullImageUrl(profile.ruta_imagen);
        }
        this.cdRef.detectChanges();
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
        this.cdRef.detectChanges();
      }
    });

    const routerSub = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe(event => {
      this.markActiveFromUrl(event.urlAfterRedirects);
      this.cdRef.detectChanges();
    });

    this.userSubscriptions.push(userProfileSub, authUserSub, routerSub);
  }

  private initializeUserData(): void {
    const currentUser = this.authService.getCurrentUser();
    const currentRole = this.authService.getCurrentRol();

    // Detectar si es una nueva sesión (por ejemplo, tras cierre por inactividad)
    const isNewSession = !sessionStorage.getItem('sessionStarted');

    if (isNewSession) {
      // Limpiar residuos visuales persistentes
      localStorage.removeItem('selectedMenuLabel');
      localStorage.removeItem('selectedSubmenuLabel');

      // Marcar que la sesión ya fue inicializada
      sessionStorage.setItem('sessionStarted', 'true');
    }

    if (currentUser) {
      this.userName = currentUser.nombre || '';
      this.userRoleName = currentRole?.name || '';

      if (currentUser.ruta_imagen) {
        this.profileImage = this.sharedUserService.getFullImageUrl(currentUser.ruta_imagen);
      }
    }

    this.cdRef.detectChanges();
  }

  handleImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) return;

    target.src = 'assets/default-photo.png';
    this.profileImage = 'assets/default-photo.png';
  }

  private initializeMenu(): void {
    const currentRol = this.authService.getCurrentRol();
    const currentName = this.authService.getCurrentUser();

    this.userRoleKey = currentRol?.key || '';
    this.userRoleName = currentRol?.name || '';
    this.userName = currentName?.nombre || '';

    this.filteredMenu = this.menuItems
      .map(menu => {
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
    const menuLabel = target.querySelector('p')?.textContent?.trim() || '';

    const isSameMenu = this.selectedMenuLabel === menuLabel;

    //Si el mismo menú está activo, cerrarlo
    if (isSameMenu) {
      this.selectedMenuLabel = '';
      this.selectedSubmenuLabel = '';
      localStorage.setItem('selectedMenuLabel', '');
      localStorage.setItem('selectedSubmenuLabel', '');
      return;
    }

    //Abrir el nuevo menú
    this.selectedMenuLabel = menuLabel;
    this.selectedSubmenuLabel = '';

    localStorage.setItem('selectedMenuLabel', this.selectedMenuLabel);
    localStorage.setItem('selectedSubmenuLabel', '');
  }

  onMenuClick(event: Event, menuItem: any): void {
    if (menuItem?.underConstruction) {
      event.preventDefault();
      event.stopImmediatePropagation();
      // this.swalService.showInfo('Este módulo está en desarrollo. Próximamente disponible.');
      return;
    }

    // 🟢 Marcar nuevo menú/submenú antes de resetear
    if (!menuItem.submenu && !menuItem.parentLabel) {
      this.selectedMenuLabel = menuItem.label;
      this.selectedSubmenuLabel = null;
    } else if (menuItem.parentLabel) {
      this.selectedMenuLabel = menuItem.parentLabel;
      this.selectedSubmenuLabel = menuItem.label;
    } else {
      this.selectedMenuLabel = menuItem.label;
      this.selectedSubmenuLabel = null;
    }

    // 📱 Cierre automático en móvil
    if (window.innerWidth < 768) {
      const body = document.body;
      if (body.classList.contains('sidebar-open')) {
        const toggleButton = document.querySelector('[data-widget="pushmenu"]') as HTMLElement;
        toggleButton?.click();
      }
    }

    localStorage.setItem('selectedMenuLabel', this.selectedMenuLabel);
    localStorage.setItem('selectedSubmenuLabel', this.selectedSubmenuLabel || '');
  }

  //Método para abrir el modal de logout
  openLogoutModal(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Cerrar el dropdown primero
    this.closeUserDropdown();

    // Abre el modal de logout usando Bootstrap
    const modalElement = document.getElementById('logoutModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  //Método para confirmar logout
  confirmLogout(): void {
    this.authService.logout();

    localStorage.removeItem('selectedMenuLabel');
    localStorage.removeItem('selectedSubmenuLabel');
    sessionStorage.removeItem('sessionStarted');

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
    //Solo te suscribís una vez al subject reactivo
    this.subsTasaCambio = this.tasaCambiariaService.getTasas().subscribe(({ usd, eur }) => {
      this.tasaDolar = usd;
      this.tasaEuro = eur;
    });

    //Inicializás las tasas desde el backend, pero sin reasignar directamente
    this.tasaCambiariaService.getTasaActual().subscribe({
      next: (res: { tasas: Tasa[] }) => {
        const dolar = res.tasas.find(t => t.id === 'dolar');
        const euro = res.tasas.find(t => t.id === 'euro');

        const usd = dolar?.valor ?? 0;
        const eur = euro?.valor ?? 0;

        //Propagás solo vía setTasas()
        this.tasaCambiariaService.setTasas(usd, eur);
      },
      error: () => {
        // Si hubo error, también lo propagás como estado reactivo
        this.tasaCambiariaService.setTasas(0, 0);
      }
    });
  }
}