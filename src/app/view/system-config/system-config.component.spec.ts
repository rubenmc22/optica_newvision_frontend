import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { SystemConfigComponent } from './system-config.component';
import { SystemConfigService } from './system-config.service';
import { SwalService } from '../../core/services/swal/swal.service';

describe('SystemConfigComponent', () => {
  let component: SystemConfigComponent;
  let fixture: ComponentFixture<SystemConfigComponent>;

  const configServiceMock = {
    config$: of({
      monedaPrincipal: 'USD',
      simboloMoneda: '$',
      decimales: 2,
      ultimaActualizacion: '2026-04-11T10:00:00.000Z'
    }),
    getConfig: () => ({
      monedaPrincipal: 'USD',
      simboloMoneda: '$',
      decimales: 2,
      ultimaActualizacion: '2026-04-11T10:00:00.000Z'
    }),
    getTasasActuales: () => of({ usd: 36.5, eur: 39.9 }),
    obtenerConfigDesdeBackend: jasmine.createSpy('obtenerConfigDesdeBackend'),
    cambiarMonedaPrincipal: () => of({ message: 'ok', moneda_base: 'dolar' }),
    resetConfig: jasmine.createSpy('resetConfig'),
    tieneCorreosNotificacionPersistidos: () => true,
    tieneMetodosPagoPersistidos: () => true,
    obtenerCorreosNotificacion: () => of({
      message: 'ok',
      correos: {
        habilitado: true,
        correoPrincipal: 'notificaciones@opticanewvision.com',
        correoSecundario: 'respaldo.notificaciones@opticanewvision.com',
        correoSeleccionado: 'principal',
        ultimaActualizacion: '2026-04-11T10:00:00.000Z'
      }
    }),
    obtenerMetodosPagoConfigurables: () => of({
      message: 'ok',
      paymentMethods: {
        ultimaActualizacion: '2026-04-11T10:00:00.000Z',
        bankCatalog: [
          { code: '0102', name: 'Banco de Venezuela', scope: 'national', active: true },
          { code: '0134', name: 'Banesco', scope: 'national', active: true },
          { code: 'BOFAUS3N', name: 'Bank of America (BOFA)', scope: 'international', active: true }
        ],
        methods: [
          {
            key: 'pago_movil',
            label: 'Pago Móvil',
            description: 'Pago móvil interbancario',
            enabled: true,
            currency: 'VES',
            requiresReceiverAccount: true,
            isCustom: false,
            accounts: [
              {
                id: 'pm-1',
                bank: 'Banco de Venezuela',
                bankCode: '0102',
                ownerName: 'Ruben Perez',
                ownerId: 'V-12345678',
                phone: '04121234567',
                email: '',
                accountDescription: 'Cuenta personal principal'
              }
            ]
          }
        ]
      }
    }),
    guardarCorreosNotificacion: () => of({
      message: 'ok',
      correos: {
        habilitado: true,
        correoPrincipal: 'notificaciones@opticanewvision.com',
        correoSecundario: 'respaldo.notificaciones@opticanewvision.com',
        correoSeleccionado: 'principal',
        ultimaActualizacion: '2026-04-11T10:00:00.000Z'
      }
    }),
    guardarMetodosPagoConfigurables: () => of({
      message: 'ok',
      paymentMethods: {
        ultimaActualizacion: '2026-04-11T10:00:00.000Z',
        bankCatalog: [
          { code: '0102', name: 'Banco de Venezuela', scope: 'national', active: true }
        ],
        methods: []
      }
    }),
    actualizarCorreosNotificacion: () => of({
      message: 'ok',
      correos: {
        habilitado: true,
        correoPrincipal: 'notificaciones@opticanewvision.com',
        correoSecundario: 'respaldo.notificaciones@opticanewvision.com',
        correoSeleccionado: 'principal',
        ultimaActualizacion: '2026-04-11T10:00:00.000Z'
      }
    }),
    actualizarMetodosPagoConfigurables: () => of({
      message: 'ok',
      paymentMethods: {
        ultimaActualizacion: '2026-04-11T10:00:00.000Z',
        bankCatalog: [
          { code: '0102', name: 'Banco de Venezuela', scope: 'national', active: true }
        ],
        methods: []
      }
    })
  };

  const swalServiceMock = {
    showSuccess: jasmine.createSpy('showSuccess'),
    showWarning: jasmine.createSpy('showWarning'),
    showError: jasmine.createSpy('showError'),
    showConfirm: jasmine.createSpy('showConfirm').and.returnValue(Promise.resolve({ isConfirmed: false }))
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SystemConfigComponent],
      imports: [FormsModule, ReactiveFormsModule],
      providers: [
        { provide: SystemConfigService, useValue: configServiceMock },
        { provide: SwalService, useValue: swalServiceMock }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SystemConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
