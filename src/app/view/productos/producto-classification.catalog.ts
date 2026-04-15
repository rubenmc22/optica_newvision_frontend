import { TIPOS_CRISTALES, TIPOS_LENTES_CONTACTO, MATERIALES, TRATAMIENTOS_ADITIVOS } from '../../shared/constants/historias-medicas';
import {
  Producto,
  ProductoEstadoOperativo,
  ProductoOrigenClasificacion,
  ProductoTipoItem
} from './producto.model';

export interface ProductoClassificationGuide {
  tipoItem: ProductoTipoItem;
  titulo: string;
  resumen: string;
  icono: string;
  ejemplos: string[];
  badgeClass: string;
}

export interface ProductoClassificationRuleMatch {
  tipoItem: ProductoTipoItem;
  requiereFormula: boolean;
  requierePaciente: boolean;
  requiereHistoriaMedica: boolean;
  permiteFormulaExterna: boolean;
  requiereItemPadre: boolean;
  requiereProcesoTecnico: boolean;
  esClasificacionConfiable: boolean;
}

type ProductoClasificable = Partial<Pick<Producto,
  'categoria'
  | 'nombre'
  | 'descripcion'
  | 'material'
  | 'codigo'
  | 'tipoItem'
  | 'requiereFormula'
  | 'requierePaciente'
  | 'requiereHistoriaMedica'
  | 'permiteFormulaExterna'
  | 'requiereItemPadre'
  | 'requiereProcesoTecnico'
  | 'origenClasificacion'
  | 'esClasificacionConfiable'
  | 'clasificacionManual'
>>;

export interface ProductoClasificacionNormalizada extends ProductoClassificationRuleMatch {
  origenClasificacion: ProductoOrigenClasificacion;
  clasificacionManual: boolean;
  estadoOperativo: ProductoEstadoOperativo;
}

export const PRODUCTO_CLASSIFICATION_GUIDES: ProductoClassificationGuide[] = [
  {
    tipoItem: 'inventariable',
    titulo: 'Inventariable',
    resumen: 'Producto comercial que puede venderse solo y no depende de una fórmula.',
    icono: 'bi-box2-heart',
    ejemplos: ['Monturas', 'Líquidos', 'Estuches', 'Accesorios'],
    badgeClass: 'meta-pill--inventariable'
  },
  {
    tipoItem: 'base_formulado',
    titulo: 'Base formulado',
    resumen: 'Línea clínica principal que requiere fórmula y habilita proceso técnico.',
    icono: 'bi-eyeglasses',
    ejemplos: ['Cristal monofocal', 'Cristal progresivo', 'Lente formulado'],
    badgeClass: 'meta-pill--formulado'
  },
  {
    tipoItem: 'addon_tecnico',
    titulo: 'Addon técnico',
    resumen: 'Complemento técnico que debe colgar de una línea base y no venderse solo.',
    icono: 'bi-sliders',
    ejemplos: ['Blue Block', 'Fotocromático', 'CR-39', 'Policarbonato'],
    badgeClass: 'meta-pill--addon'
  },
  {
    tipoItem: 'desconocido',
    titulo: 'Revisión manual',
    resumen: 'Familia ambigua que requiere decisión operativa antes de usarla clínicamente.',
    icono: 'bi-exclamation-diamond',
    ejemplos: ['Lentes', 'Lentes de contacto', 'Referencias legacy'],
    badgeClass: 'meta-pill--revision'
  }
];

const TIPOS_CRISTALES_NORMALIZADOS = TIPOS_CRISTALES
  .filter((item: any) => item?.value !== 'LENTES_CONTACTO')
  .flatMap((item: any) => [item?.value, item?.label])
  .map((item: unknown) => normalizarTextoClasificacion(item));

const TIPOS_CONTACTO_NORMALIZADOS = TIPOS_LENTES_CONTACTO
  .flatMap((item: any) => [item?.value, item?.label])
  .map((item: unknown) => normalizarTextoClasificacion(item));

const MATERIALES_NORMALIZADOS = MATERIALES
  .flatMap((item) => [item.value, item.label])
  .map((item) => normalizarTextoClasificacion(item));

const TRATAMIENTOS_NORMALIZADOS = TRATAMIENTOS_ADITIVOS
  .flatMap((item) => [item.value, item.label])
  .map((item) => normalizarTextoClasificacion(item));

const CATEGORIAS_INVENTARIABLES = new Set([
  'monturas',
  'liquidos',
  'liquido',
  'estuches',
  'estuche',
  'miscelaneos',
  'misceláneos',
  'accesorios',
  'accesorio',
  'repuestos',
  'repuesto'
]);

const CATEGORIAS_AMBIGUAS = new Set([
  'lentes',
  'lente',
  'lentes de contacto'
]);

const PALABRAS_INVENTARIABLES = [
  'montura',
  'armazon',
  'estuche',
  'liquido',
  'spray',
  'cadena',
  'cordon',
  'pano',
  'microfibra',
  'accesorio',
  'repuesto'
];

const PALABRAS_BASE_FORMULADO = [
  'cristal',
  'monofocal',
  'bifocal',
  'progresivo',
  'multifocal',
  'ocupacional',
  'oftalmico',
  'graduado',
  'graduacion',
  'adaptacion',
  'torico',
  'formula'
];

const PALABRAS_ADDON_TECNICO = [
  'blue block',
  'blueblock',
  'fotocrom',
  'transition',
  'transitions',
  'antirrefle',
  'anti refle',
  'filtro',
  'tratamiento',
  'cr39',
  'cr-39',
  'policarbon',
  'resina',
  'uv',
  'material'
];

const PALABRAS_CONTACTO_FORMULADO = [
  'torico',
  'formulado',
  'graduado'
];

const PALABRAS_CONTACTO_COMERCIAL = [
  'cosmetico',
  'cosmético',
  'color'
];

export function normalizarTextoClasificacion(valor: unknown): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function contieneAlgunTermino(texto: string, terminos: string[]): boolean {
  return terminos.some((termino) => texto.includes(termino));
}

export function resolverClasificacionMaestra(textoPlano: string, categoria: string): ProductoClassificationRuleMatch {
  if (contieneAlgunTermino(textoPlano, [...TRATAMIENTOS_NORMALIZADOS, ...MATERIALES_NORMALIZADOS, ...PALABRAS_ADDON_TECNICO])) {
    return {
      tipoItem: 'addon_tecnico',
      requiereFormula: false,
      requierePaciente: false,
      requiereHistoriaMedica: false,
      permiteFormulaExterna: false,
      requiereItemPadre: true,
      requiereProcesoTecnico: true,
      esClasificacionConfiable: true
    };
  }

  if (contieneAlgunTermino(textoPlano, [...TIPOS_CRISTALES_NORMALIZADOS, ...PALABRAS_BASE_FORMULADO])) {
    return {
      tipoItem: 'base_formulado',
      requiereFormula: true,
      requierePaciente: true,
      requiereHistoriaMedica: false,
      permiteFormulaExterna: true,
      requiereItemPadre: false,
      requiereProcesoTecnico: true,
      esClasificacionConfiable: true
    };
  }

  if (contieneAlgunTermino(textoPlano, TIPOS_CONTACTO_NORMALIZADOS)) {
    if (contieneAlgunTermino(textoPlano, PALABRAS_CONTACTO_FORMULADO)) {
      return {
        tipoItem: 'base_formulado',
        requiereFormula: true,
        requierePaciente: true,
        requiereHistoriaMedica: false,
        permiteFormulaExterna: true,
        requiereItemPadre: false,
        requiereProcesoTecnico: true,
        esClasificacionConfiable: true
      };
    }

    if (contieneAlgunTermino(textoPlano, PALABRAS_CONTACTO_COMERCIAL)) {
      return {
        tipoItem: 'inventariable',
        requiereFormula: false,
        requierePaciente: false,
        requiereHistoriaMedica: false,
        permiteFormulaExterna: false,
        requiereItemPadre: false,
        requiereProcesoTecnico: false,
        esClasificacionConfiable: true
      };
    }

    return {
      tipoItem: 'desconocido',
      requiereFormula: false,
      requierePaciente: false,
      requiereHistoriaMedica: false,
      permiteFormulaExterna: false,
      requiereItemPadre: false,
      requiereProcesoTecnico: false,
      esClasificacionConfiable: false
    };
  }

  if (CATEGORIAS_INVENTARIABLES.has(categoria) || contieneAlgunTermino(textoPlano, PALABRAS_INVENTARIABLES)) {
    return {
      tipoItem: 'inventariable',
      requiereFormula: false,
      requierePaciente: false,
      requiereHistoriaMedica: false,
      permiteFormulaExterna: false,
      requiereItemPadre: false,
      requiereProcesoTecnico: false,
      esClasificacionConfiable: true
    };
  }

  if (CATEGORIAS_AMBIGUAS.has(categoria)) {
    return {
      tipoItem: 'desconocido',
      requiereFormula: false,
      requierePaciente: false,
      requiereHistoriaMedica: false,
      permiteFormulaExterna: false,
      requiereItemPadre: false,
      requiereProcesoTecnico: false,
      esClasificacionConfiable: false
    };
  }

  return {
    tipoItem: 'desconocido',
    requiereFormula: false,
    requierePaciente: false,
    requiereHistoriaMedica: false,
    permiteFormulaExterna: false,
    requiereItemPadre: false,
    requiereProcesoTecnico: false,
    esClasificacionConfiable: false
  };
}

export function construirTextoClasificacionProducto(producto: ProductoClasificable | null | undefined): {
  textoPlano: string;
  categoria: string;
} {
  const categoria = normalizarTextoClasificacion(producto?.categoria);
  const nombre = normalizarTextoClasificacion(producto?.nombre);
  const descripcion = normalizarTextoClasificacion(producto?.descripcion);
  const material = normalizarTextoClasificacion(producto?.material);
  const codigo = normalizarTextoClasificacion(producto?.codigo);

  return {
    categoria,
    textoPlano: [categoria, nombre, descripcion, material, codigo].filter(Boolean).join(' | ')
  };
}

export function resolverEstadoOperativoProducto(clasificacion: Pick<ProductoClasificacionNormalizada,
  'tipoItem'
  | 'requiereFormula'
  | 'requiereItemPadre'
  | 'esClasificacionConfiable'
>): ProductoEstadoOperativo {
  if (!clasificacion.esClasificacionConfiable || clasificacion.tipoItem === 'desconocido') {
    return 'requiere_revision';
  }

  if (clasificacion.requiereItemPadre || clasificacion.tipoItem === 'addon_tecnico') {
    return 'dependencia_tecnica';
  }

  if (clasificacion.requiereFormula || clasificacion.tipoItem === 'base_formulado') {
    return 'listo_clinico';
  }

  return 'listo_comercial';
}

export function normalizarClasificacionProducto(producto: ProductoClasificable | null | undefined): ProductoClasificacionNormalizada {
  const { textoPlano, categoria } = construirTextoClasificacionProducto(producto);
  const clasificacionInferida = resolverClasificacionMaestra(textoPlano, categoria);
  const tieneTipoExplicito = Boolean(producto?.tipoItem);
  const clasificacionManual = Boolean(producto?.clasificacionManual || producto?.origenClasificacion === 'manual');

  const tipoItem = producto?.tipoItem ?? clasificacionInferida.tipoItem;
  const requiereFormula = Boolean(producto?.requiereFormula ?? clasificacionInferida.requiereFormula);
  const requierePaciente = Boolean(producto?.requierePaciente ?? clasificacionInferida.requierePaciente ?? requiereFormula);
  const requiereHistoriaMedica = Boolean(producto?.requiereHistoriaMedica ?? clasificacionInferida.requiereHistoriaMedica);
  const permiteFormulaExterna = Boolean(producto?.permiteFormulaExterna ?? clasificacionInferida.permiteFormulaExterna ?? requiereFormula);
  const requiereItemPadre = Boolean(producto?.requiereItemPadre ?? clasificacionInferida.requiereItemPadre);
  const requiereProcesoTecnico = Boolean(
    producto?.requiereProcesoTecnico
    ?? clasificacionInferida.requiereProcesoTecnico
    ?? (tipoItem === 'base_formulado' || tipoItem === 'addon_tecnico')
  );
  const origenClasificacion = clasificacionManual
    ? 'manual'
    : (producto?.origenClasificacion ?? (tieneTipoExplicito ? 'catalogo' : 'inferido'));
  const esClasificacionConfiable = Boolean(
    producto?.esClasificacionConfiable
    ?? (tieneTipoExplicito ? tipoItem !== 'desconocido' : clasificacionInferida.esClasificacionConfiable)
  );

  const clasificacionNormalizada: ProductoClasificacionNormalizada = {
    tipoItem,
    requiereFormula,
    requierePaciente,
    requiereHistoriaMedica,
    permiteFormulaExterna,
    requiereItemPadre,
    requiereProcesoTecnico,
    origenClasificacion,
    esClasificacionConfiable,
    clasificacionManual,
    estadoOperativo: 'requiere_revision'
  };

  clasificacionNormalizada.estadoOperativo = resolverEstadoOperativoProducto(clasificacionNormalizada);

  return clasificacionNormalizada;
}