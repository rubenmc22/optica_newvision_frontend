import { TestBed } from '@angular/core/testing';

import { HistoriaMedicaService } from '../historias-medicas/historias-medicas.service';

describe('HistoriaMedicaService', () => {
  let service: HistoriaMedicaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HistoriaMedicaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
