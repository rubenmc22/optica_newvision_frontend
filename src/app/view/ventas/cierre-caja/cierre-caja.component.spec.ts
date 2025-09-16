import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CierreCajaComponent } from './cierre-caja.component';

describe('CierreCajaComponent', () => {
  let component: CierreCajaComponent;
  let fixture: ComponentFixture<CierreCajaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CierreCajaComponent]
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
