import { ProductoCristalConfig, ProductoPrecioCristal } from './producto.model';

const CRISTAL_CONFIG_START = '[NV_CRISTAL_CONFIG]';
const CRISTAL_CONFIG_END = '[/NV_CRISTAL_CONFIG]';

interface ProductoCristalConfigPayload {
  version: 1;
  crystalConfig: ProductoCristalConfig;
  descripcionUsuario: string;
}

export function normalizarTratamientosCristal(valor: unknown): string[] {
  if (!Array.isArray(valor)) {
    return [];
  }

  return Array.from(new Set(
    valor
      .map(item => String(item ?? '').trim())
      .filter(Boolean)
  ));
}

export function normalizarProductoCristalConfig(config: Partial<ProductoCristalConfig> | null | undefined): ProductoCristalConfig {
  return {
    tratamientos: normalizarTratamientosCristal(config?.tratamientos),
    rangoFormula: String(config?.rangoFormula ?? '').trim(),
    precioPor: normalizarPrecioPorCristal(config?.precioPor)
  };
}

export function normalizarPrecioPorCristal(valor: unknown): ProductoPrecioCristal {
  return String(valor ?? '').trim().toLowerCase() === 'ojo' ? 'ojo' : 'par';
}

export function parseDescripcionProductoCristal(descripcion: unknown): { descripcionUsuario: string; crystalConfig?: ProductoCristalConfig } {
  const texto = String(descripcion ?? '');
  const startIndex = texto.indexOf(CRISTAL_CONFIG_START);
  const endIndex = texto.indexOf(CRISTAL_CONFIG_END);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return {
      descripcionUsuario: texto.trim()
    };
  }

  const payloadTexto = texto.slice(startIndex + CRISTAL_CONFIG_START.length, endIndex).trim();

  try {
    const payload = JSON.parse(payloadTexto) as Partial<ProductoCristalConfigPayload>;
    return {
      descripcionUsuario: String(payload?.descripcionUsuario ?? '').trim(),
      crystalConfig: normalizarProductoCristalConfig(payload?.crystalConfig)
    };
  } catch {
    return {
      descripcionUsuario: texto.trim()
    };
  }
}

export function serializarDescripcionProductoCristal(
  descripcionUsuario: unknown,
  crystalConfig: Partial<ProductoCristalConfig> | null | undefined,
  incluirConfiguracion: boolean
): string {
  const descripcionNormalizada = String(descripcionUsuario ?? '').trim();

  if (!incluirConfiguracion) {
    return descripcionNormalizada;
  }

  const payload: ProductoCristalConfigPayload = {
    version: 1,
    crystalConfig: normalizarProductoCristalConfig(crystalConfig),
    descripcionUsuario: descripcionNormalizada
  };

  return `${CRISTAL_CONFIG_START}${JSON.stringify(payload)}${CRISTAL_CONFIG_END}`;
}