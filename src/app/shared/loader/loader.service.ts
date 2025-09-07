import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })

export class LoaderService {
  private _loading$ = new BehaviorSubject<boolean>(false);
  readonly loading$ = this._loading$.asObservable();

  private minDisplayTime = 400; // ms
  private loaderTimeout: any;

  show(): void {
    clearTimeout(this.loaderTimeout);
    this._loading$.next(true);
  }

  hide(): void {
    this.loaderTimeout = setTimeout(() => {
      this._loading$.next(false);
    }, this.minDisplayTime);
  }
}
