import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VerPacientesComponent } from './ver-pacientes.component';

describe('VerPacientesComponent', () => {
  let component: VerPacientesComponent;
  let fixture: ComponentFixture<VerPacientesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerPacientesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VerPacientesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
