import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AcceptTycComponent } from './accept-tyc-component.component';

describe('AcceptTycComponent', () => {
  let component: AcceptTycComponent;
  let fixture: ComponentFixture<AcceptTycComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AcceptTycComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AcceptTycComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
