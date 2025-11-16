import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigSystemComponent } from './system-config.component';

describe('ConfigSystemComponent', () => {
  let component: ConfigSystemComponent;
  let fixture: ComponentFixture<ConfigSystemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfigSystemComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfigSystemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
