import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraficoTotalSedeComponent } from './grafico-total-sede.component';

describe('GraficoTotalSedeComponent', () => {
  let component: GraficoTotalSedeComponent;
  let fixture: ComponentFixture<GraficoTotalSedeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraficoTotalSedeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GraficoTotalSedeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
