import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AcceptTycComponentComponent } from './accept-tyc-component.component';

describe('AcceptTycComponentComponent', () => {
  let component: AcceptTycComponentComponent;
  let fixture: ComponentFixture<AcceptTycComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AcceptTycComponentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AcceptTycComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
