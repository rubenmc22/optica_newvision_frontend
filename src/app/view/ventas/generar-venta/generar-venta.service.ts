import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { HistorialTasa, Tasa } from '../../../Interfaces/models-interface';

@Injectable({
    providedIn: 'root'
})

export class GenerarVentaService {
  constructor(private http: HttpClient) {}

  getTasas(): Observable<{ message: string; tasas: Tasa[] }> {
    return this.http.get<{ message: string; tasas: Tasa[] }>(
      `${environment.apiUrl}/tasas/`
    );
  }
}