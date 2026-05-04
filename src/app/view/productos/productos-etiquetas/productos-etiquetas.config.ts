export type ProductLabelFieldKey = 'codigo' | 'nombre' | 'precio' | 'marca';

export interface ProductLabelFieldConfig {
  key: ProductLabelFieldKey;
  label: string;
  enabled: boolean;
  order: number;
}

export interface ProductLabelSettings {
  fields: ProductLabelFieldConfig[];
  columns: number;
  labelWidthMm: number;
  labelHeightMm: number;
  showBorder: boolean;
  cantidadMasivaDefault: number | null;
  updatedAt: string;
}

export const PRODUCT_LABEL_STORAGE_KEY = 'inventario_productos_etiquetas_config';

export const PRODUCT_LABEL_DEFAULT_SETTINGS: ProductLabelSettings = {
  fields: [
    { key: 'codigo', label: 'Codigo', enabled: true, order: 0 },
    { key: 'nombre', label: 'Nombre', enabled: true, order: 1 },
    { key: 'marca', label: 'Marca', enabled: false, order: 2 },
    { key: 'precio', label: 'Precio', enabled: true, order: 3 }
  ],
  columns: 3,
  labelWidthMm: 63,
  labelHeightMm: 34,
  showBorder: true,
  cantidadMasivaDefault: null,
  updatedAt: new Date().toISOString()
};

export function normalizeProductLabelSettings(settings?: ProductLabelSettings | null): ProductLabelSettings {
  const fieldsMap = new Map<string, ProductLabelFieldConfig>();

  (settings?.fields ?? []).forEach((field) => {
    fieldsMap.set(field.key, {
      key: field.key,
      label: String(field.label ?? '').trim() || getDefaultLabelForField(field.key),
      enabled: field.enabled !== false,
      order: Number.isFinite(field.order) ? field.order : 0
    });
  });

  const mergedFields = PRODUCT_LABEL_DEFAULT_SETTINGS.fields
    .map((defaultField) => ({
      ...defaultField,
      ...(fieldsMap.get(defaultField.key) ?? {})
    }))
    .sort((a, b) => a.order - b.order)
    .map((field, order) => ({
      ...field,
      order
    }));

  return {
    fields: mergedFields,
    columns: normalizeNumberInRange(settings?.columns, 1, 4, PRODUCT_LABEL_DEFAULT_SETTINGS.columns),
    labelWidthMm: normalizeNumberInRange(settings?.labelWidthMm, 35, 100, PRODUCT_LABEL_DEFAULT_SETTINGS.labelWidthMm),
    labelHeightMm: normalizeNumberInRange(settings?.labelHeightMm, 20, 80, PRODUCT_LABEL_DEFAULT_SETTINGS.labelHeightMm),
    showBorder: settings?.showBorder !== false,
    cantidadMasivaDefault: normalizeNullablePositiveInteger(settings?.cantidadMasivaDefault),
    updatedAt: settings?.updatedAt || PRODUCT_LABEL_DEFAULT_SETTINGS.updatedAt
  };
}

function normalizeNumberInRange(value: number | undefined, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function normalizeNullablePositiveInteger(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
}

function getDefaultLabelForField(key: ProductLabelFieldKey): string {
  const labels: Record<ProductLabelFieldKey, string> = {
    codigo: 'Codigo',
    nombre: 'Nombre',
    precio: 'Precio',
    marca: 'Marca'
  };

  return labels[key];
}