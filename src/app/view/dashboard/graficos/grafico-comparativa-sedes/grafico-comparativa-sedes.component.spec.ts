import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraficoComparativaSedesComponent } from './grafico-comparativa-sedes.component';

describe('GraficoComparativaSedesComponent', () => {
  let component: GraficoComparativaSedesComponent;
  let fixture: ComponentFixture<GraficoComparativaSedesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraficoComparativaSedesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GraficoComparativaSedesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
