import { Component, OnInit, Input, OnDestroy, ChangeDetectorRef, HostListener, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
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

export class SidebarComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() userRoleKey: string = '';
  @Input() userRoleName: string = '';
  @Input() userName: string = '';
  @ViewChild('sidebarSurface') sidebarSurfaceRef?: ElementRef<HTMLElement>;
  @ViewChild('mainViewport', { static: false }) mainViewportRef?: ElementRef<HTMLElement>;
  profileImage: string = 'assets/default-photo.png';
  sedeActual: string = '';
  tasaDolar: number = 0;
  tasaEuro: number = 0;
  private tasaStreamSub?: Subscription;
  private tasaActualSub?: Subscription;
  selectedMenuLabel: string = '';
  selectedSubmenuLabel: string | null = null;
  isMobileView: boolean = false;
  isSidebarOpen: boolean = false;
  isDesktopSidebarCollapsed: boolean = false;
  isUserDropdownOpen: boolean = false;
  isCompactDesktopView: boolean = false;
  showQuickAccessDock: boolean = false;
  useStaticTopbar: boolean = false;
  refreshingRateId: 'dolar' | 'euro' | 'all' | null = null;
  isModalOpen: boolean = false;

  private userSubscriptions: Subscription[] = [];
  private readonly modalShownHandler = () => {
    this.isModalOpen = true;
    this.updateQuickAccessDock();
    this.cdRef.detectChanges();
  };
  private readonly modalHiddenHandler = () => {
    this.isModalOpen = !!document.querySelector('.modal.show, .modal-backdrop.show') || document.body.classList.contains('modal-open');
    this.updateQuickAccessDock();
    this.cdRef.detectChanges();
  };
  private sidebarScrollTimeouts: number[] = [];

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
      submenu: [
        { label: 'Inventario', routerLink: '/productos-inventario', roles: ['admin', 'gerente', 'asesor-optico'] },
        { label: 'Etiquetas', routerLink: '/productos-inventario/etiquetas', roles: ['admin', 'gerente', 'asesor-optico'] }
      ],
      roles: ['admin', 'gerente', 'asesor-optico'],
      underConstruction: false
    },
    {
      label: 'Gestión de Ventas',
      icon: 'fas fa-shopping-cart',
      submenu: [
        { label: 'Nueva Venta', routerLink: '/ventas/generar', roles: ['admin', 'gerente', 'asesor-optico'] },
        { label: 'Presupuestos', routerLink: '/ventas/presupuestos', roles: ['admin', 'gerente', 'asesor-optico'] },
        { label: 'Historial', routerLink: '/ventas/historial', roles: ['admin', 'gerente', 'asesor-optico'] },
        { label: 'Cierre de Caja', routerLink: '/ventas/cierres', roles: ['admin', 'gerente', 'asesor-optico'] },
        { label: 'Rendimiento Comercial', routerLink: '/ventas/rendimiento', roles: ['admin', 'gerente', 'asesor-optico'] }
      ],
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
    this.isDesktopSidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    this.updateViewportState();

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
    this.tasaStreamSub = this.tasaCambiariaService.getTasas().subscribe(({ usd, eur }) => {
      this.tasaDolar = usd;
      this.tasaEuro = eur;
      this.cdRef.detectChanges();
    });

    //Inicializar menú y datos
    this.initializeMenu();
    this.markActiveFromUrl(this.router.url);
    this.initializeUserData();
    this.setupSubscriptions();
    this.setupModalStateSync();
    this.obtenerSedeActual();
    this.obtenerTasaCambio();
  }

  ngAfterViewInit(): void {
    this.scheduleSidebarScroll();
  }

  // Método para toggle manual del dropdown
  toggleUserDropdown(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    this.isUserDropdownOpen = !this.isUserDropdownOpen;
    this.cdRef.detectChanges();
  }

  // Cerrar dropdown cuando se hace click en un item
  closeUserDropdown(): void {
    this.isUserDropdownOpen = false;
    this.cdRef.detectChanges();
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
        const sub = [...menu.submenu]
          .sort((a: { routerLink: string }, b: { routerLink: string }) => (b.routerLink?.length || 0) - (a.routerLink?.length || 0))
          .find((s: { routerLink: string }) => this.routeMatches(url, s.routerLink));
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
    this.tasaStreamSub?.unsubscribe();
    this.tasaActualSub?.unsubscribe();
    this.clearSidebarScrollTimeouts();
    document.removeEventListener('shown.bs.modal', this.modalShownHandler as EventListener);
    document.removeEventListener('hidden.bs.modal', this.modalHiddenHandler as EventListener);

    this.unlockBodyScroll();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateViewportState();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.updateQuickAccessDock();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.user-menu')) {
      this.isUserDropdownOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.isUserDropdownOpen = false;

    if (this.isMobileView && this.isSidebarOpen) {
      this.closeSidebar();
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
      if (this.isMobileView) {
        this.closeSidebar();
      }
      this.cdRef.detectChanges();
      this.scheduleSidebarScroll(120);
      this.scrollMainContentToTop();
    });

    this.userSubscriptions.push(userProfileSub, authUserSub, routerSub);
  }

  private scrollMainContentToTop(): void {
    // Scroll principal del shell (viewport interno)
    const viewport = this.mainViewportRef?.nativeElement;
    if (viewport) {
      viewport.scrollTo({ top: 0, behavior: 'auto' });
    }
    // También forzar window por si hay scroll global
    window.scrollTo({ top: 0, behavior: 'auto' });
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

  toggleSubmenu(event: Event, menu: any): void {
    event.preventDefault();

    if (!this.isMobileView && this.isDesktopSidebarCollapsed) {
      this.isDesktopSidebarCollapsed = false;
      localStorage.setItem('sidebarCollapsed', 'false');
    }

    const menuLabel = menu.label || '';

    const isSameMenu = this.selectedMenuLabel === menuLabel;

    //Si el mismo menú está activo, cerrarlo
    if (isSameMenu) {
      this.selectedMenuLabel = '';
      this.selectedSubmenuLabel = '';
      localStorage.setItem('selectedMenuLabel', '');
      localStorage.setItem('selectedSubmenuLabel', '');
      return;
    }

    const activeSubmenu = Array.isArray(menu?.submenu)
      ? [...menu.submenu]
          .sort((a: { routerLink: string }, b: { routerLink: string }) => (b.routerLink?.length || 0) - (a.routerLink?.length || 0))
          .find((sub: { routerLink: string; label: string }) => this.routeMatches(this.router.url, sub.routerLink))
      : null;

    //Abrir el nuevo menú
    this.selectedMenuLabel = menuLabel;
    this.selectedSubmenuLabel = activeSubmenu?.label || '';

    localStorage.setItem('selectedMenuLabel', this.selectedMenuLabel);
    localStorage.setItem('selectedSubmenuLabel', this.selectedSubmenuLabel || '');
    this.scheduleSidebarScroll(220);
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

    if (this.isMobileView) {
      this.closeSidebar();
    }

    localStorage.setItem('selectedMenuLabel', this.selectedMenuLabel);
    localStorage.setItem('selectedSubmenuLabel', this.selectedSubmenuLabel || '');
    this.scheduleSidebarScroll(220);
  }

  toggleSidebar(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!this.isMobileView) {
      this.isDesktopSidebarCollapsed = !this.isDesktopSidebarCollapsed;
      this.isUserDropdownOpen = false;
      localStorage.setItem('sidebarCollapsed', String(this.isDesktopSidebarCollapsed));
      this.cdRef.detectChanges();
      return;
    }

    this.isSidebarOpen = !this.isSidebarOpen;
    this.isUserDropdownOpen = false;
    this.syncBodyScrollState();
    this.cdRef.detectChanges();
  }

  closeSidebar(): void {
    if (!this.isMobileView) {
      return;
    }

    this.isSidebarOpen = false;
    this.isUserDropdownOpen = false;
    this.syncBodyScrollState();
    this.cdRef.detectChanges();
  }

  openSidebarFromDock(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (this.isMobileView) {
      this.isSidebarOpen = true;
      this.syncBodyScrollState();
      this.updateQuickAccessDock();
      this.cdRef.detectChanges();
      return;
    }

    if (this.isDesktopSidebarCollapsed) {
      this.isDesktopSidebarCollapsed = false;
      localStorage.setItem('sidebarCollapsed', 'false');
      this.cdRef.detectChanges();
    }
  }

  scrollToTop(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  refreshRate(rateId: 'dolar' | 'euro', event?: Event): void {
    this.refreshAllRates(event);
  }

  refreshAllRates(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (this.refreshingRateId) {
      return;
    }

    this.refreshingRateId = 'all';
    this.cdRef.detectChanges();

    this.tasaCambiariaService.updateTasaBCV().subscribe({
      next: () => {
        this.refreshingRateId = null;
        this.cdRef.detectChanges();
      },
      error: () => {
        this.refreshingRateId = null;
        this.cdRef.detectChanges();
        this.swalService.showError('No se pudo actualizar la tasa', 'Intenta nuevamente en unos segundos.');
      }
    });
  }

  private updateViewportState(): void {
    const mobile = window.innerWidth <= 991;
    const zoomScale = window.visualViewport?.scale ?? 1;
    this.isCompactDesktopView = !mobile && (window.innerHeight <= 860 || zoomScale >= 1.5);
    this.useStaticTopbar = true;

    if (mobile !== this.isMobileView) {
      this.isMobileView = mobile;
      this.isSidebarOpen = false;
      this.isUserDropdownOpen = false;
      this.syncBodyScrollState();
      this.updateQuickAccessDock();
      this.cdRef.detectChanges();
      return;
    }

    if (!this.isMobileView) {
      this.isSidebarOpen = false;
      this.isUserDropdownOpen = false;
      this.unlockBodyScroll();
      this.isDesktopSidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    }

    this.updateQuickAccessDock();
  }

  private updateQuickAccessDock(): void {
    const topbar = document.querySelector('.app-topbar') as HTMLElement | null;
    const modalVisible = this.isModalOpen
      || document.body.classList.contains('modal-open')
      || !!document.querySelector('.modal.show, .modal-backdrop.show');

    if (!topbar || modalVisible || this.isSidebarOpen) {
      this.showQuickAccessDock = false;
      return;
    }

    const topbarBounds = topbar.getBoundingClientRect();
    this.showQuickAccessDock = topbarBounds.bottom <= 24;
  }

  private setupModalStateSync(): void {
    document.addEventListener('shown.bs.modal', this.modalShownHandler as EventListener);
    document.addEventListener('hidden.bs.modal', this.modalHiddenHandler as EventListener);
    this.isModalOpen = !!document.querySelector('.modal.show, .modal-backdrop.show') || document.body.classList.contains('modal-open');
  }

  private syncBodyScrollState(): void {
    if (this.isMobileView && this.isSidebarOpen) {
      document.body.style.overflow = 'hidden';
      return;
    }

    this.unlockBodyScroll();
  }

  private unlockBodyScroll(): void {
    document.body.style.overflow = '';
  }

  private scheduleSidebarScroll(delay = 80): void {
    this.clearSidebarScrollTimeouts();

    [delay, delay + 140, delay + 320].forEach((timeoutDelay) => {
      const timeoutId = window.setTimeout(() => this.scrollSidebarSelectionIntoView(), timeoutDelay);
      this.sidebarScrollTimeouts.push(timeoutId);
    });
  }

  private scrollSidebarSelectionIntoView(): void {
    const surface = this.sidebarSurfaceRef?.nativeElement;
    if (!surface) {
      return;
    }

    const submenuSelector = this.selectedSubmenuLabel
      ? `.submenu-link[data-submenu-label="${this.escapeSelector(this.selectedSubmenuLabel)}"]`
      : null;

    const menuSelector = this.selectedMenuLabel
      ? `.menu-group[data-menu-label="${this.escapeSelector(this.selectedMenuLabel)}"]`
      : null;

    const submenuElement = submenuSelector ? surface.querySelector<HTMLElement>(submenuSelector) : null;
    const menuElement = menuSelector ? surface.querySelector<HTMLElement>(menuSelector) : null;
    const openPanelElement = menuElement?.querySelector<HTMLElement>('.submenu-panel.is-open') || null;
    const lastOpenSubmenuElement = openPanelElement
      ? Array.from(openPanelElement.querySelectorAll<HTMLElement>('.submenu-link')).pop() || null
      : null;
    const target = lastOpenSubmenuElement || submenuElement || openPanelElement || menuElement;

    if (!target) {
      return;
    }

    const surfaceRect = surface.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const topPadding = 20;
    const bottomPadding = 28;

    if (targetRect.top < surfaceRect.top + topPadding) {
      surface.scrollBy({
        top: targetRect.top - surfaceRect.top - topPadding,
        behavior: 'smooth'
      });
      return;
    }

    if (targetRect.bottom > surfaceRect.bottom - bottomPadding) {
      surface.scrollBy({
        top: targetRect.bottom - surfaceRect.bottom + bottomPadding,
        behavior: 'smooth'
      });
    }
  }

  private clearSidebarScrollTimeouts(): void {
    this.sidebarScrollTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    this.sidebarScrollTimeouts = [];
  }

  private escapeSelector(value: string): string {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }

    return value.replace(/(["\\.#:[\]()=<>+~*^$|])/g, '\\$1');
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
    //Inicializás las tasas desde el backend, pero sin reasignar directamente
    this.tasaActualSub = this.tasaCambiariaService.getTasaActual().subscribe({
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