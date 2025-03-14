import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PostloginTemplateComponent } from './postlogin-template.component';

describe('PostloginTemplateComponent', () => {
  let component: PostloginTemplateComponent;
  let fixture: ComponentFixture<PostloginTemplateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostloginTemplateComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PostloginTemplateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
