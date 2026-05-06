import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { PresupuestoService } from './presupuesto.service';
import { Presupuesto } from './presupuesto.interfaz';
import { TasaCambiariaService } from '../../../core/services/tasaCambiaria/tasaCambiaria.service';
import { buildPresupuestoReportDocument } from './presupuesto-report.util';

@Component({
  selector: 'app-presupuesto-pdf-public',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './presupuesto-pdf-public.component.html',
  styleUrls: ['./presupuesto-pdf-public.component.scss']
})
export class PresupuestoPdfPublicComponent implements OnInit, OnDestroy {
  cargando = true;
  error = '';
  reporteDocumento = '';
  private tasaUsd = 0;
  private tasaEur = 0;
  private autoPrintPendiente = false;
  private frameRenderPendiente: ReturnType<typeof setTimeout> | null = null;

  private queryParamsSubscription?: Subscription;
  private reportFrame?: ElementRef<HTMLIFrameElement>;

  @ViewChild('reportFrame')
  set reportFrameRef(frame: ElementRef<HTMLIFrameElement> | undefined) {
    this.reportFrame = frame;
    if (frame) {
      this.programarRenderEnFrame();
    }
  }

  constructor(
    private route: ActivatedRoute,
    private titleService: Title,
    private presupuestoService: PresupuestoService,
    private tasaCambiariaService: TasaCambiariaService
  ) {}

  ngOnInit(): void {
    this.queryParamsSubscription = this.route.queryParamMap.subscribe((params) => {
      void this.cargarPresupuesto(params.get('token'), params.get('autoprint'));
    });
  }

  ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
    if (this.frameRenderPendiente) {
      clearTimeout(this.frameRenderPendiente);
      this.frameRenderPendiente = null;
    }
  }

  imprimir(): void {
    const frameWindow = this.reportFrame?.nativeElement?.contentWindow;

    if (frameWindow) {
      frameWindow.focus();
      frameWindow.print();
      return;
    }

    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  onFrameLoad(): void {
    if (!this.autoPrintPendiente) {
      return;
    }

    this.autoPrintPendiente = false;
    setTimeout(() => this.imprimir(), 350);
  }

  esAutoprint(value: string | null): boolean {
    return ['1', 'true', 'si', 'yes'].includes(String(value || '').trim().toLowerCase());
  }

  private async cargarPresupuesto(token: string | null, autoprint: string | null): Promise<void> {
    this.cargando = true;
    this.error = '';
    this.reporteDocumento = '';
    this.autoPrintPendiente = false;

    try {
      if (!token) {
        throw new Error('El token del presupuesto es obligatorio.');
      }

      await this.cargarTasasPublicas();

      const presupuesto = await firstValueFrom(this.presupuestoService.obtenerPresupuestoPublico(token));
      this.aplicarReporte(presupuesto);
      this.titleService.setTitle(`Óptica New Vision - Presupuesto ${presupuesto.codigo || ''}`.trim());
      this.autoPrintPendiente = this.esAutoprint(autoprint);
    } catch (error) {
      console.error('Error al cargar el presupuesto público:', error);
      this.error = error instanceof Error
        ? error.message
        : 'No se pudo construir el documento del presupuesto.';
    } finally {
      this.cargando = false;
    }
  }

  private aplicarReporte(presupuesto: Presupuesto): void {
    const monedaPresupuesto = this.normalizarCodigoMoneda(presupuesto?.moneda);
    this.reporteDocumento = buildPresupuestoReportDocument(presupuesto, {
      datosSede: presupuesto?.sede || null,
      monedaSistema: monedaPresupuesto,
      simboloMonedaSistema: this.obtenerSimboloMoneda(monedaPresupuesto),
      nombreAsesor: presupuesto?.vendedor || 'N/A',
      resolverReferenciaBs: (monto: number, moneda: string) => this.convertirMontoABolivares(monto, moneda),
      mostrarReferenciaBs: monedaPresupuesto !== 'VES'
    });
    this.programarRenderEnFrame();
  }

  private programarRenderEnFrame(): void {
    if (this.frameRenderPendiente) {
      clearTimeout(this.frameRenderPendiente);
    }

    this.frameRenderPendiente = setTimeout(() => {
      this.frameRenderPendiente = null;
      this.renderizarDocumentoEnFrame();
    }, 0);
  }

  private renderizarDocumentoEnFrame(): void {
    const iframe = this.reportFrame?.nativeElement;

    if (!iframe || !this.reporteDocumento) {
      return;
    }

    const frameDocument = iframe.contentDocument;
    if (!frameDocument) {
      return;
    }

    frameDocument.open();
    frameDocument.write(this.reporteDocumento);
    frameDocument.close();
  }

  private async cargarTasasPublicas(): Promise<void> {
    try {
      const response = await firstValueFrom(this.tasaCambiariaService.getTasaAutomaticaBCV());
      const tasas = response?.tasa || {};
      const usd = Number(tasas['dolar'] ?? tasas['usd'] ?? 0);
      const eur = Number(tasas['euro'] ?? tasas['eur'] ?? 0);

      this.tasaUsd = usd > 0 ? usd : 0;
      this.tasaEur = eur > 0 ? eur : 0;

      if (usd > 0 || eur > 0) {
        this.tasaCambiariaService.setTasas(usd, eur);
      }
    } catch (error) {
      console.warn('No se pudo cargar la referencia pública BCV para el presupuesto:', error);
    }
  }

  private normalizarCodigoMoneda(moneda: string | null | undefined): 'USD' | 'EUR' | 'VES' {
    const valor = String(moneda || '').trim().toLowerCase();

    if (['usd', 'dolar', 'dólar', '$'].includes(valor)) {
      return 'USD';
    }

    if (['eur', 'euro', '€'].includes(valor)) {
      return 'EUR';
    }

    return 'VES';
  }

  private obtenerSimboloMoneda(moneda: 'USD' | 'EUR' | 'VES'): string {
    switch (moneda) {
      case 'USD':
        return '$';
      case 'EUR':
        return '€';
      default:
        return 'Bs.';
    }
  }

  private convertirMontoABolivares(monto: number, moneda: string): number {
    const montoNumerico = Number(monto || 0);
    if (!montoNumerico) {
      return 0;
    }

    switch (this.normalizarCodigoMoneda(moneda)) {
      case 'USD':
        return Number((montoNumerico * this.tasaUsd).toFixed(2));
      case 'EUR':
        return Number((montoNumerico * this.tasaEur).toFixed(2));
      default:
        return Number(montoNumerico.toFixed(2));
    }
  }
}
