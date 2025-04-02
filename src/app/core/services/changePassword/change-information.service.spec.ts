import { TestBed } from '@angular/core/testing';

import { ChangeInformationService } from './change-information.service';

describe('ChangeInformationService', () => {
  let service: ChangeInformationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChangeInformationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
