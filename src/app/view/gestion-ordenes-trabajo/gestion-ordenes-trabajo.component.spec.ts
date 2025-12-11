import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionOrdenesTrabajoComponent } from './gestion-ordenes-trabajo.component';

describe('GestionOrdenesTrabajoComponent', () => {
  let component: GestionOrdenesTrabajoComponent;
  let fixture: ComponentFixture<GestionOrdenesTrabajoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GestionOrdenesTrabajoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GestionOrdenesTrabajoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
