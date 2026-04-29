type HistoriaLike = {
  datosConsulta?: {
    especialista?: {
      tipo?: string | null;
    } | null;
    formulaExterna?: boolean | null;
    pagoPendiente?: boolean | null;
    formulaOriginal?: {
      medicoOrigen?: {
        nombre?: string | null;
      } | null;
    } | null;
  } | null;
  data?: {
    datosConsulta?: {
      especialista?: {
        tipo?: string | null;
      } | null;
      formulaExterna?: boolean | null;
      pagoPendiente?: boolean | null;
      formulaOriginal?: {
        medicoOrigen?: {
          nombre?: string | null;
        } | null;
      } | null;
    } | null;
  } | null;
};

export type HistoriaEspecialistaTipo = 'OFTALMOLOGO' | 'OPTOMETRISTA' | 'EXTERNO' | '';

export function obtenerDatosConsultaHistoria(historia: HistoriaLike | null | undefined) {
  return historia?.datosConsulta || historia?.data?.datosConsulta || null;
}

export function obtenerTipoEspecialistaHistoria(historia: HistoriaLike | null | undefined): HistoriaEspecialistaTipo {
  const tipo = String(obtenerDatosConsultaHistoria(historia)?.especialista?.tipo || '').trim().toUpperCase();

  if (tipo === 'OFTALMOLOGO' || tipo === 'OPTOMETRISTA' || tipo === 'EXTERNO') {
    return tipo;
  }

  return '';
}

export function historiaTienePagoPendiente(historia: HistoriaLike | null | undefined): boolean {
  return obtenerDatosConsultaHistoria(historia)?.pagoPendiente === true;
}

export function historiaEsFormulaExterna(historia: HistoriaLike | null | undefined): boolean {
  return obtenerDatosConsultaHistoria(historia)?.formulaExterna === true;
}

export function historiaTieneFormulaOriginal(historia: HistoriaLike | null | undefined): boolean {
  return Boolean(obtenerDatosConsultaHistoria(historia)?.formulaOriginal?.medicoOrigen?.nombre);
}

export function historiaPuedeCobrarConsulta(historia: HistoriaLike | null | undefined): boolean {
  const esOftalmologo = obtenerTipoEspecialistaHistoria(historia) === 'OFTALMOLOGO';
  const pagoPendiente = historiaTienePagoPendiente(historia);
  const formulaExterna = historiaEsFormulaExterna(historia);

  if (!esOftalmologo || !pagoPendiente) {
    return false;
  }

  if (!formulaExterna) {
    return true;
  }

  return historiaTieneFormulaOriginal(historia);
}