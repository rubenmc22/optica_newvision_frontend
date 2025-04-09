import { Component } from '@angular/core'; // Añade esta línea
import { AuthService } from '../../core/services/auth/auth.service';
import { ActivatedRoute, Router } from '@angular/router';


@Component({
  standalone: false,
  selector: 'app-accept-tyc',
  template: `
    <div class="tyc-container">
      <h2>Términos y Condiciones</h2>
      <!-- Contenido completo de TyC aquí -->
      <button (click)="accept()">Aceptar TyC</button>
      <button (click)="logout()">Cancelar</button>
    </div>
  `,
  styles: [`
    .tyc-container {
      max-width: 800px;
      margin: 2rem auto;
      padding: 2rem;
      border: 1px solid #ddd;
      border-radius: 8px;
    }
    button {
      margin-right: 1rem;
    }
  `]
})
export class AcceptTycComponent {
  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  accept() {
    this.authService.acceptTermsAndConditions().subscribe({
      next: () => {
        const redirectUrl = this.route.snapshot.queryParams['redirect'] || '/dashboard';
        this.router.navigateByUrl(redirectUrl, { replaceUrl: true });
      },
      error: (err) => {
        console.error('Error al aceptar TyC:', err);
        this.router.navigate(['/login']);
      }
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}