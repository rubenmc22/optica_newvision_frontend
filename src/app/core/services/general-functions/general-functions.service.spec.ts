import { TestBed } from '@angular/core/testing';

import { GeneralFunctionsService } from '../general-functions/general-functions.service';

describe('GeneralFunctionsService', () => {
  let service: GeneralFunctionsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GeneralFunctionsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
