import { Component } from '@angular/core';
import { LoaderService } from './loader.service';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

@Component({
  selector: 'app-global-loader',
  standalone: false,
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.scss']
})
export class LoaderComponent {
  constructor(public loader: LoaderService) {}
  
}
