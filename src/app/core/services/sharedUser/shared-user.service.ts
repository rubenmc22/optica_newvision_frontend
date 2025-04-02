// shared-user.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })

export class SharedUserService {
  private userProfile = new BehaviorSubject<any>(null);
  currentUserProfile$ = this.userProfile.asObservable();

  updateUserProfile(profile: any) {
    this.userProfile.next(profile);
  }

  getFullImageUrl(ruta: string | null): string {
    if (!ruta) return 'assets/default-photo.png';
    if (ruta.startsWith('http')) return ruta;
    if (ruta.startsWith('/public')) return `${environment.baseUrl}${ruta}`;
    return `${environment.baseUrl}/public/profile-images/${ruta}`;
  }
}