// shared-user.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SharedUserService {
  private userProfile = new BehaviorSubject<any>(null);
  
  // Expón el observable
  currentUserProfile$ = this.userProfile.asObservable();

  // Actualiza el perfil del usuario
  updateUserProfile(profile: any) {
    this.userProfile.next(profile);
  }

  // Obtiene la URL completa de la imagen
  getFullImageUrl(ruta: string): string {
    if (!ruta) return 'assets/default-photo.png';
    return ruta.startsWith('http') ? ruta : `${environment.baseUrl}${ruta}`;
  }
}