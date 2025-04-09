import { Component, OnInit } from '@angular/core';
import { InactivityService } from './../../core/services/inactivityService/inactivity.service';

@Component({
  selector: 'app-postlogin-layout',
  standalone: false,
  templateUrl: './postlogin-template.component.html',
  styleUrls: ['./postlogin-template.component.scss']
})
export class PostloginTemplateComponent {
constructor(private inactivityService: InactivityService) {}


  ngOnInit(): void {
    this.inactivityService.startWatching(); // Inicia el monitoreo de inactividad
  }
}

