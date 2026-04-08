import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { HistoriasMedicasComponent } from './historias-medicas.component';

describe('HistoriasMedicasComponent', () => {
  let component: HistoriasMedicasComponent;
  let fixture: ComponentFixture<HistoriasMedicasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HistoriasMedicasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistoriasMedicasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('precarga paciente desde sessionStorage y abre modal', (done) => {
    const pacienteMock: any = {
      key: 'abc',
      id: 'abc',
      informacionPersonal: { cedula: '123' }
    };

    // Guardar en sessionStorage la info que produce pacientes.component
    sessionStorage.setItem('pacienteParaHistoria', JSON.stringify(pacienteMock));
    sessionStorage.setItem('desdePacientes', '1');

    // Mock del servicio de pacientes para devolver la lista que contiene al paciente
    (component as any).pacientesService = { getPacientes: () => of({ pacientes: [pacienteMock] }) };

    spyOn(component, 'abrirModalConFocus').and.callFake(() => { done(); });

    // Llamar al método que ahora contiene la lógica de precarga
    component.cargarPacientes();
  });

  it('no abre modal si existe paciente en sessionStorage pero no viene desde pacientes', () => {
    const pacienteMock: any = {
      key: 'abc',
      id: 'abc',
      informacionPersonal: { cedula: '123' }
    };

    sessionStorage.setItem('pacienteParaHistoria', JSON.stringify(pacienteMock));
    sessionStorage.removeItem('desdePacientes');

    (component as any).pacientesService = { getPacientes: () => of({ pacientes: [pacienteMock] }) };

    const abrirSpy = spyOn(component, 'abrirModalConFocus');

    component.cargarPacientes();

    expect(abrirSpy).not.toHaveBeenCalled();
  });
});
