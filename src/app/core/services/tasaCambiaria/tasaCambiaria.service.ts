import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { HistorialTasa, Tasa } from '../../../Interfaces/models-interface';

@Injectable({
  providedIn: 'root'
})
export class TasaCambiariaService {
  private tasaActualSubject = new BehaviorSubject<{ usd: number; eur: number }>({ usd: 0, eur: 0 });
  tasas = {
    usd: 0,
    eur: 0
  };

  constructor(private http: HttpClient) {
    const usdRaw = sessionStorage.getItem('tasaDolar');
    const eurRaw = sessionStorage.getItem('tasaEuro');

    const usd = usdRaw ? +usdRaw : 0;
    const eur = eurRaw ? +eurRaw : 0;

    this.tasaActualSubject.next({ usd, eur });
  }


  // 🧠 Reactivo
  getTasas(): Observable<{ usd: number; eur: number }> {
    return this.tasaActualSubject.asObservable();
  }

  setTasas(usd: number = 0, eur: number = 0): void {
    this.tasaActualSubject.next({ usd, eur });

    sessionStorage.setItem('tasaDolar', usd?.toString() ?? '0');
    sessionStorage.setItem('tasaEuro', eur?.toString() ?? '0');
  }

  getTasaActual(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/tasas/`);
  }

  getTasaActual_id(id: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/tasas/${id}`);
  }

  getTasaAutomaticaBCV(): Observable<{ tasa: { [key: string]: number } }> {
    return this.http.get<{ tasa: { [key: string]: number } }>(
      `${environment.apiUrl}/get-tasa-bcv/`
    );
  }

  updateTasaManual(id: string, valor: number, metodo: string, fecha: string): Observable<any> {
    return this.http.put<any>(`${environment.apiUrl}/tasas-update/${id}`, { valor, metodo, fecha }).pipe(
      tap(response => {
        const tasa = response?.tasa;

        if (!tasa) return;

        const actual = this.tasaActualSubject.getValue();

        switch (tasa.id) {
          case 'dolar':
            this.setTasas(tasa.valor, actual.eur);
            break;
          case 'euro':
            this.setTasas(actual.usd, tasa.valor);
            break;
        }

      })

    );
  }

  updateTasaBCV(): Observable<any> { //usar esta para cambiar de manual a bcv
    return this.http.put<{ tasa: Tasa[] }>(`${environment.apiUrl}/tasas-update-with-bcv/`, {}).pipe(
      tap(response => {
        const tasas = response.tasa || [];
        const mapa = Object.fromEntries(tasas.map(t => [t.id, t.valor]));

        const usd = +mapa['dolar'] || 0;
        const eur = +mapa['euro'] || 0;

        this.setTasas(usd, eur);
      })
    );
  }

  updateTasaBCVPorId(id: string): Observable<any> {
  return this.http.put<{ tasa: Tasa[] }>(`${environment.apiUrl}/tasas-update-with-bcv/${id}`, {}).pipe(
    tap(response => {
      const tasas = Array.isArray(response.tasa) ? response.tasa : [response.tasa];

      const tasaDolar = tasas.find(t => t.id === 'dolar');
      const tasaEuro  = tasas.find(t => t.id === 'euro');

      const usd = tasaDolar?.valor ?? this.tasaActualSubject.value.usd;
      const eur = tasaEuro?.valor  ?? this.tasaActualSubject.value.eur;

      this.setTasas(usd, eur); // 🔁 Estado global actualizado correctamente
    })
  );
}

  activarRastreoAutomaticoBCV(id: string, rastrear_auto: boolean): Observable<{ tasa: Tasa }> {
    return this.http.put<{ tasa: Tasa }>(
      `${environment.apiUrl}/tasas-rastreo-automatico/${id}`,
      { rastrear_auto }
    ).pipe(
      tap(({ tasa }) => {
        const { id: monedaId, valor } = tasa;
        const tasaActual = this.tasaActualSubject.getValue();

        const actualizada = {
          usd: monedaId === 'dolar' ? valor : tasaActual.usd,
          eur: monedaId === 'euro' ? valor : tasaActual.eur
        };

        this.setTasas(actualizada.usd, actualizada.eur);
      })
    );
  }


  getHistorialTasas(id: string): Observable<{ message: string; historial: HistorialTasa[] }> {
    return this.http.get<{ message: string; historial: HistorialTasa[] }>(
      `${environment.apiUrl}/tasas-history/${id}`
    );
  }

  // 🧠 Helper opcional
  getTasaActualValor(): { usd: number; eur: number } {
    return this.tasaActualSubject.value;
  }
}
