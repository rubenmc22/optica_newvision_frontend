import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrearAtletasComponent } from './crear-atletas.component';

describe('CrearAtletasComponent', () => {
  let component: CrearAtletasComponent;
  let fixture: ComponentFixture<CrearAtletasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearAtletasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CrearAtletasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
