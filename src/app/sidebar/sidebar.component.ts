import { Component, ElementRef, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements AfterViewInit {

  constructor(private el: ElementRef) { }

  ngAfterViewInit(): void {
    console.log('Vista inicializada. Preparando eventos del sidebar.');
  }

  toggleSubmenu(event: Event): void {
    event.preventDefault();
  
    const target = event.currentTarget as HTMLElement; // Enlace clicado
    const submenu = target.nextElementSibling as HTMLElement | null; // Submenú relacionado
    const icon = target.querySelector('.fas.fa-angle-left') as HTMLElement | null; // Flecha
  
    if (submenu) {
      const isOpen = submenu.classList.contains('menu-open');
  
      if (isOpen) {
        // Cerrar el submenú
        submenu.classList.remove('menu-open');
        submenu.style.display = 'none';
  
        if (icon) {
          icon.classList.remove('fa-rotate-custom-open');
          icon.classList.add('fa-rotate-custom'); // Regresa a la posición inicial
        }
      } else {
        // Abrir el submenú
        submenu.classList.add('menu-open');
        submenu.style.display = 'block';
  
        if (icon) {
          icon.classList.remove('fa-rotate-custom');
          icon.classList.add('fa-rotate-custom-open'); // Gira hacia abajo
        }
      }
    }
  }
  






}
