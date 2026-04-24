import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VentasDashboardComponent } from './ventas-dashboard.component';

describe('VentasDashboardComponent', () => {
  let component: VentasDashboardComponent;
  let fixture: ComponentFixture<VentasDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VentasDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VentasDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
