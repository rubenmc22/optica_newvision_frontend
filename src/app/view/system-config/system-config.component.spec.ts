import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
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
        correoPrincipal: 'notificaciones@opticanewvision.com',
        correoSecundario: 'respaldo.notificaciones@opticanewvision.com',
        destinoEnvio: 'principal',
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
        correoPrincipal: 'notificaciones@opticanewvision.com',
        correoSecundario: 'respaldo.notificaciones@opticanewvision.com',
        destinoEnvio: 'principal',
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
    crearBancoCatalogo: jasmine.createSpy('crearBancoCatalogo').and.callFake((banco) => of(banco)),
    actualizarBancoCatalogo: jasmine.createSpy('actualizarBancoCatalogo').and.callFake((banco) => of(banco)),
    crearMetodoPagoCatalogo: jasmine.createSpy('crearMetodoPagoCatalogo').and.callFake((metodo) => of({
      message: 'ok',
      metodo,
      ultimaActualizacion: '2026-04-11T10:00:00.000Z'
    })),
    actualizarMetodoPagoCatalogo: jasmine.createSpy('actualizarMetodoPagoCatalogo').and.callFake((metodo) => of({
      message: 'ok',
      metodo,
      ultimaActualizacion: '2026-04-11T10:00:00.000Z'
    })),
    actualizarCorreosNotificacion: () => of({
      message: 'ok',
      correos: {
        correoPrincipal: 'notificaciones@opticanewvision.com',
        correoSecundario: 'respaldo.notificaciones@opticanewvision.com',
        destinoEnvio: 'principal',
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
    configServiceMock.crearBancoCatalogo.calls.reset();
    configServiceMock.actualizarBancoCatalogo.calls.reset();
    configServiceMock.crearMetodoPagoCatalogo.calls.reset();
    configServiceMock.actualizarMetodoPagoCatalogo.calls.reset();
    swalServiceMock.showError.calls.reset();
    swalServiceMock.showSuccess.calls.reset();

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

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should persist new bank immediately when confirmed', () => {
    component.abrirModalNuevoBanco('national');
    component.nuevoBancoCatalogo = {
      code: '0199',
      name: 'Banco de Prueba',
      scope: 'national'
    };

    component.confirmarNuevoBanco();

    expect(configServiceMock.crearBancoCatalogo).toHaveBeenCalledWith({
      code: '0199',
      name: 'Banco de Prueba',
      scope: 'national',
      active: true
    });
    expect(component.mostrarModalNuevoBanco).toBeFalse();
    expect(component.metodosPagoConfig?.bankCatalog.some((banco) => banco.code === '0199')).toBeTrue();
    expect(component.metodosPagoDraft?.bankCatalog.some((banco) => banco.code === '0199')).toBeTrue();
    expect(component.paymentConfigNotice).toEqual(jasmine.objectContaining({
      tone: 'success',
      message: 'Banco Banco de Prueba agregado al catálogo.'
    }));
  });

  it('should debounce consecutive autosaves for the same method into one request', fakeAsync(() => {
    const metodo = component.metodosPagoDraft?.methods[0];

    expect(metodo).toBeTruthy();

    metodo!.label = 'Pago Móvil Express';
    component.persistirMetodoPago(metodo!.key);
    metodo!.description = 'Pago móvil interbancario actualizado';
    component.persistirMetodoPago(metodo!.key);

    expect(configServiceMock.actualizarMetodoPagoCatalogo).not.toHaveBeenCalled();

    tick(699);
    expect(configServiceMock.actualizarMetodoPagoCatalogo).not.toHaveBeenCalled();

    tick(1);

    expect(configServiceMock.actualizarMetodoPagoCatalogo).toHaveBeenCalledTimes(1);
    expect(configServiceMock.actualizarMetodoPagoCatalogo).toHaveBeenCalledWith(
      jasmine.objectContaining({
        key: 'pago_movil',
        label: 'Pago Móvil Express',
        description: 'Pago móvil interbancario actualizado'
      })
    );
    expect(component.metodosPagoConfig?.methods.find((item) => item.key === 'pago_movil')?.label).toBe('Pago Móvil Express');
    expect(component.paymentConfigNotice).toEqual(jasmine.objectContaining({
      tone: 'success',
      message: 'Cambios guardados en Pago Móvil Express.'
    }));
  }));

  it('should persist method availability after debounce when toggled', fakeAsync(() => {
    const metodo = component.metodosPagoDraft?.methods[0];

    expect(metodo).toBeTruthy();

    component.alternarDisponibilidadMetodo(metodo!, false);

    tick(700);

    expect(configServiceMock.actualizarMetodoPagoCatalogo).toHaveBeenCalledWith(
      jasmine.objectContaining({
        key: 'pago_movil',
        enabled: false
      })
    );
    expect(component.metodosPagoConfig?.methods.find((item) => item.key === 'pago_movil')?.enabled).toBeFalse();
    expect(component.metodosPagoDraft?.methods.find((item) => item.key === 'pago_movil')?.enabled).toBeFalse();
    expect(component.paymentConfigNotice).toEqual(jasmine.objectContaining({
      tone: 'success',
      message: 'Cambios guardados en Pago Móvil.'
    }));
  }));

  it('should persist bank status immediately when toggled', () => {
    component.alternarEstadoBancoCatalogo('0102');

    expect(configServiceMock.actualizarBancoCatalogo).toHaveBeenCalledWith(
      jasmine.objectContaining({
        code: '0102',
        active: false
      })
    );
    expect(component.metodosPagoConfig?.bankCatalog.find((banco) => banco.code === '0102')?.active).toBeFalse();
    expect(component.metodosPagoDraft?.bankCatalog.find((banco) => banco.code === '0102')?.active).toBeFalse();
    expect(component.paymentConfigNotice).toEqual(jasmine.objectContaining({
      tone: 'success',
      message: 'Banco de Venezuela desactivado en el catálogo.'
    }));
  });

  it('should persist new method immediately when confirmed', () => {
    component.abrirModalNuevoMetodo();
    component.nuevoMetodoPago = {
      label: 'Binance Pay',
      description: 'Canal alterno en USDT',
      currency: 'USDT',
      requiresReceiverAccount: false
    };

    component.confirmarNuevoMetodo();

    expect(configServiceMock.crearMetodoPagoCatalogo).toHaveBeenCalledWith(
      jasmine.objectContaining({
        key: 'binance_pay',
        label: 'Binance Pay',
        description: 'Canal alterno en USDT',
        currency: 'USDT',
        isCustom: true
      })
    );
    expect(component.mostrarModalNuevoMetodo).toBeFalse();
    expect(component.metodosPagoConfig?.methods.some((metodo) => metodo.key === 'binance_pay')).toBeTrue();
    expect(component.metodosPagoDraft?.methods.some((metodo) => metodo.key === 'binance_pay')).toBeTrue();
    expect(component.paymentConfigNotice).toEqual(jasmine.objectContaining({
      tone: 'success',
      message: 'Método Binance Pay agregado correctamente.'
    }));
  });
});
