import { ComponentFixture, TestBed, fakeAsync, tick, flushMicrotasks } from '@angular/core/testing';
import { of } from 'rxjs';

import { VerPacientesComponent } from './pacientes.component';

describe('VerPacientesComponent', () => {
  let component: VerPacientesComponent;
  let fixture: ComponentFixture<VerPacientesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VerPacientesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VerPacientesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('muestra swal con acción y navega a historias cuando el usuario confirma', fakeAsync(() => {
    // Preparar formulario con valores mínimos requeridos
    component.formPaciente.patchValue({
      nombreCompleto: 'Juan Perez',
      cedula: '12345678',
      telefono: '04141234567',
      fechaNacimiento: '1990-01-01',
      ocupacion: 'Ingeniero',
      genero: 'Masculino',
      direccion: 'Calle Falsa 123',
      usuarioLentes: 'Sí',
      fotofobia: 'No',
      usoDispositivo: 'No',
      traumatismoOcular: 'No',
      cirugiaOcular: 'No'
    });

    // Mocks
    const pacienteResp: any = {
      paciente: {
        id: '1',
        key: 'sede-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        informacionPersonal: { fechaNacimiento: '1990-01-01', genero: 'm' }
      }
    };

    // Spy en servicios utilizados por el componente
    (component as any).pacientesService = { createPaciente: jasmine.createSpy('createPaciente').and.returnValue(of(pacienteResp)) };
    (component as any).swalService = { showSuccessWithAction: jasmine.createSpy('showSuccessWithAction').and.returnValue(Promise.resolve({ isConfirmed: true })) };
    const routerSpy = { navigate: jasmine.createSpy('navigate') };
    (component as any).router = routerSpy;

    spyOn(sessionStorage, 'setItem');

    // Ejecutar
    component.crearPaciente();

    // El Observable emite sincrónicamente; procesar promesas
    flushMicrotasks();
    tick();

    expect((component as any).pacientesService.createPaciente).toHaveBeenCalled();
    expect((component as any).swalService.showSuccessWithAction).toHaveBeenCalled();
    expect(sessionStorage.setItem).toHaveBeenCalledWith('pacienteParaHistoria', jasmine.any(String));
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/pacientes-historias']);
  }));
});

