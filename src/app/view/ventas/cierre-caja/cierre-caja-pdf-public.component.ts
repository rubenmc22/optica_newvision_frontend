import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { CierreCajaService } from './cierre-caja.service';
import {
  buildCierreCajaReportFromResumen,
  buildCierreCajaReportMarkup,
  CierreCajaReporteDocumento,
  decodeCierreCajaReport,
  getCierreCajaReportStyles
} from './cierre-caja-report.util';

@Component({
  selector: 'app-cierre-caja-pdf-public',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cierre-caja-pdf-public.component.html',
  styleUrls: ['./cierre-caja-pdf-public.component.scss']
})
export class CierreCajaPdfPublicComponent implements OnInit, OnDestroy {
  cargando = true;
  error = '';
  reporteHtml = '';

  private queryParamsSubscription?: Subscription;
  private styleElement?: HTMLStyleElement;

  constructor(
    private route: ActivatedRoute,
    private titleService: Title,
    private cierreCajaService: CierreCajaService
  ) {}

  ngOnInit(): void {
    this.inyectarEstilos();
    this.queryParamsSubscription = this.route.queryParamMap.subscribe((params) => {
      void this.cargarReporte(params.get('token'), params.get('data'), params.get('autoprint'));
    });
  }

  ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
    this.styleElement?.remove();
  }

  imprimir(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.print();
  }

  private inyectarEstilos(): void {
    if (typeof document === 'undefined' || this.styleElement) {
      return;
    }

    const style = document.createElement('style');
    style.setAttribute('data-cierre-caja-public-report', 'true');
    style.textContent = getCierreCajaReportStyles();
    document.head.appendChild(style);
    this.styleElement = style;
  }

  private async cargarReporte(token: string | null, payload: string | null, autoprint: string | null): Promise<void> {
    this.cargando = true;
    this.error = '';
    this.reporteHtml = '';

    try {
      let reporte: CierreCajaReporteDocumento | null = null;

      if (token) {
        const resumen = await firstValueFrom(this.cierreCajaService.obtenerResumenPublico(token));
        reporte = buildCierreCajaReportFromResumen(resumen);
      } else if (payload) {
        reporte = await decodeCierreCajaReport(payload);
      }

      if (!reporte) {
        throw new Error('No se recibió la información del cierre para renderizar el PDF.');
      }
      this.aplicarReporte(reporte);

      if (this.esAutoprint(autoprint) && typeof window !== 'undefined') {
        setTimeout(() => window.print(), 350);
      }
    } catch (error) {
      console.error('Error al cargar el PDF público de cierre de caja:', error);
      this.error = error instanceof Error
        ? error.message
        : 'No se pudo construir el documento del cierre de caja.';
    } finally {
      this.cargando = false;
    }
  }

  private aplicarReporte(reporte: CierreCajaReporteDocumento): void {
    this.reporteHtml = buildCierreCajaReportMarkup(reporte);
    this.titleService.setTitle(`Óptica New Vision - PDF cierre de caja ${reporte.fecha || ''}`.trim());
  }

  private esAutoprint(value: string | null): boolean {
    return ['1', 'true', 'si', 'yes'].includes(String(value || '').trim().toLowerCase());
  }
}