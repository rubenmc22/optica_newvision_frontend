import { Component, Input, OnInit } from '@angular/core';
import {ChartConfiguration,  ChartOptions } from 'chart.js';

@Component({
  selector: 'app-grafico-total-sede',
 standalone: false,
  templateUrl: './grafico-total-sede.component.html',
  styleUrl: './grafico-total-sede.component.scss'
})
export class GraficoTotalSedeComponent {
@Input() total: number = 0;
}
