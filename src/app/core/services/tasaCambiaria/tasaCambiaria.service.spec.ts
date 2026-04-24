import { TestBed } from '@angular/core/testing';

import { TasaCambiariaService } from '../tasaCambiaria/tasaCambiaria.service';

describe('EmpleadosService', () => {
  let service: TasaCambiariaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TasaCambiariaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
