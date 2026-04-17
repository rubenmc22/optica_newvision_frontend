import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';

import { CierreCajaComponent } from './cierre-caja.component';
import { CierreCajaService } from './cierre-caja.service';
import { HistorialVentaService } from '../../ventas/historial-ventas/historial-ventas.service';
import { SystemConfigService } from './../../system-config/system-config.service';
import { TasaCambiariaService } from './../../../core/services/tasaCambiaria/tasaCambiaria.service';
import { UserStateService } from './../../../core/services/userState/user-state-service';
import { SwalService } from '../../../core/services/swal/swal.service';

class CierreCajaServiceMock {
  estaUsandoDummy() { return false; }
  obtenerResumenDiario() { return of({ ventas: [], cierreExistente: null, transaccionesManuales: [] }); }
  obtenerHistorialCierres() { return of([]); }
  anularCierre() { return of({ message: 'ok' }); }
  cerrarCaja() { return of({ message: 'ok' }); }
  abrirCaja() { return of({ message: 'ok' }); }
  crearTransaccionManual() { return of({ message: 'ok' }); }
  actualizarTransaccionManual() { return of({ message: 'ok' }); }
}

class HistorialVentaServiceMock {}

class SystemConfigServiceMock {
  getMonedaPrincipal() { return 'USD'; }
  getSimboloMonedaPrincipal() { return '$'; }
}

class TasaCambiariaServiceMock {
  getTasaActual() { return of({ tasas: [] }); }
  getTasaActualValor() { return { usd: 1, eur: 1 }; }
}

class UserStateServiceMock {
  currentUser$ = of({ nombre: 'Usuario Demo' });
  sedeActual$ = of({ key: 'guatire', nombre: 'Sede Guatire' });
}

class SwalServiceMock {
  showWarning() {}
  showError() {}
  showSuccess() {}
  showInfo() {}
  showConfirm() { return Promise.resolve({ isConfirmed: false }); }
  showInputPrompt() { return Promise.resolve(null); }
}

describe('CierreCajaComponent', () => {
  let component: CierreCajaComponent;
  let fixture: ComponentFixture<CierreCajaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CierreCajaComponent],
      imports: [CommonModule, FormsModule, ReactiveFormsModule],
      providers: [
        DecimalPipe,
        DatePipe,
        { provide: CierreCajaService, useClass: CierreCajaServiceMock },
        { provide: HistorialVentaService, useClass: HistorialVentaServiceMock },
        { provide: SystemConfigService, useClass: SystemConfigServiceMock },
        { provide: TasaCambiariaService, useClass: TasaCambiariaServiceMock },
        { provide: UserStateService, useClass: UserStateServiceMock },
        { provide: SwalService, useClass: SwalServiceMock }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CierreCajaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
