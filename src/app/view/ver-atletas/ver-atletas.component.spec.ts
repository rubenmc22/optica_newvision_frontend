import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VerAtletasComponent } from './ver-atletas.component';

describe('VerAtletasComponent', () => {
  let component: VerAtletasComponent;
  let fixture: ComponentFixture<VerAtletasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerAtletasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VerAtletasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
