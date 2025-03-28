import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FichaTecnicaComponent } from './ficha-tecnica.component';

describe('FichaTecnicaComponent', () => {
  let component: FichaTecnicaComponent;
  let fixture: ComponentFixture<FichaTecnicaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FichaTecnicaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FichaTecnicaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
