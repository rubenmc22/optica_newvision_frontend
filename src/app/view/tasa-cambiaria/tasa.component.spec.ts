import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TasaComponent } from './tasa.component';

describe('TasaComponent', () => {
  let component: TasaComponent;
  let fixture: ComponentFixture<TasaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TasaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TasaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
