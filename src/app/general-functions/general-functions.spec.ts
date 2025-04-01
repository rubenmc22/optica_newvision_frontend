import { TestBed } from '@angular/core/testing';

import { GeneralFunctions } from './general-functions';

describe('GeneralFunctions', () => {
  let service: GeneralFunctions;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GeneralFunctions);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
