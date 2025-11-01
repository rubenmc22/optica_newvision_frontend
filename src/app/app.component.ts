import { Component, OnInit, OnDestroy } from '@angular/core';
import { InactivityService } from './core/services/inactivityService/inactivity.service';

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'optica_newvision_frontend';

  constructor(private inactivityService: InactivityService) {}

  ngOnInit() {
    // Iniciar el servicio de inactividad cuando la app carga
    this.inactivityService.startWatching();
  }

  ngOnDestroy() {
    // Detener el servicio cuando la app se destruye
    this.inactivityService.stopWatching();
  }
}