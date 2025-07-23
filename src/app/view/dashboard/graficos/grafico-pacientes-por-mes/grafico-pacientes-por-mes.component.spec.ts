import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraficoPacientesPorMesComponent } from './grafico-pacientes-por-mes.component';

describe('GraficoPacientesPorMesComponent', () => {
  let component: GraficoPacientesPorMesComponent;
  let fixture: ComponentFixture<GraficoPacientesPorMesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraficoPacientesPorMesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GraficoPacientesPorMesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
