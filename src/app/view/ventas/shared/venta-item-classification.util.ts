import { Producto } from '../../productos/producto.model';
import { PresupuestoVentaLineaDraft, VentaItemTipo, EstadoValidacionClinicaDraft } from './presupuesto-venta-handoff.util';
import { contieneAlgunTermino, normalizarTextoClasificacion, resolverClasificacionMaestra } from '../../productos/producto-classification.catalog';

export interface ClasificacionVentaItem {
    tipoItem: VentaItemTipo;
    requiereFormula: boolean;
    requierePaciente: boolean;
    requiereHistoriaMedica: boolean;
    permiteFormulaExterna: boolean;
    requiereItemPadre: boolean;
    requiereProcesoTecnico: boolean;
    origenClasificacion: 'catalogo' | 'inferido';
    esClasificacionConfiable: boolean;
}

type ItemClasificable = Partial<Pick<Producto, 'categoria' | 'nombre' | 'descripcion' | 'material' | 'codigo'>> & {
    tipoItem?: VentaItemTipo;
    requiereFormula?: boolean;
    requierePaciente?: boolean;
    requiereHistoriaMedica?: boolean;
    permiteFormulaExterna?: boolean;
    requiereItemPadre?: boolean;
};

export interface ResumenClasificacionLineas {
    requiereSoporteClinico: boolean;
    requiereProcesoTecnico: boolean;
    estadoValidacionClinica: EstadoValidacionClinicaDraft;
    lineasConRequerimientoClinico: string[];
}

export function clasificarItemVenta(item: ItemClasificable | null | undefined): ClasificacionVentaItem {
    if (!item) {
        return {
            tipoItem: 'desconocido',
            requiereFormula: false,
            requierePaciente: false,
            requiereHistoriaMedica: false,
            permiteFormulaExterna: false,
            requiereItemPadre: false,
            requiereProcesoTecnico: false,
            origenClasificacion: 'inferido',
            esClasificacionConfiable: false
        };
    }

    if (item.tipoItem) {
        const tipoItem = item.tipoItem;
        const requiereFormula = Boolean(item.requiereFormula);
        const requiereItemPadre = Boolean(item.requiereItemPadre);
        return {
            tipoItem,
            requiereFormula,
            requierePaciente: Boolean(item.requierePaciente ?? requiereFormula),
            requiereHistoriaMedica: Boolean(item.requiereHistoriaMedica),
            permiteFormulaExterna: Boolean(item.permiteFormulaExterna ?? requiereFormula),
            requiereItemPadre,
            requiereProcesoTecnico: tipoItem === 'base_formulado' || tipoItem === 'addon_tecnico',
            origenClasificacion: 'catalogo',
            esClasificacionConfiable: tipoItem !== 'desconocido'
        };
    }

    const categoria = normalizarTextoClasificacion(item.categoria);
    const nombre = normalizarTextoClasificacion(item.nombre);
    const descripcion = normalizarTextoClasificacion(item.descripcion);
    const material = normalizarTextoClasificacion(item.material);
    const codigo = normalizarTextoClasificacion(item.codigo);
    const texto = [categoria, nombre, descripcion, material, codigo].filter(Boolean).join(' | ');
    const clasificacion = resolverClasificacionMaestra(texto, categoria);

    return {
        tipoItem: clasificacion.tipoItem,
        requiereFormula: clasificacion.requiereFormula,
        requierePaciente: clasificacion.requierePaciente,
        requiereHistoriaMedica: clasificacion.requiereHistoriaMedica,
        permiteFormulaExterna: clasificacion.permiteFormulaExterna,
        requiereItemPadre: clasificacion.requiereItemPadre,
        requiereProcesoTecnico: clasificacion.requiereProcesoTecnico,
        origenClasificacion: 'inferido',
        esClasificacionConfiable: clasificacion.esClasificacionConfiable
    };
}

export function construirLineaPresupuestoVenta(producto: any, index: number): PresupuestoVentaLineaDraft {
    const clasificacion = clasificarItemVenta({
        codigo: producto?.codigo,
        nombre: producto?.nombre,
        descripcion: producto?.descripcion,
        categoria: producto?.categoria,
        material: producto?.material,
        tipoItem: producto?.tipoItem,
        requiereFormula: producto?.requiereFormula,
        requierePaciente: producto?.requierePaciente,
        requiereHistoriaMedica: producto?.requiereHistoriaMedica,
        permiteFormulaExterna: producto?.permiteFormulaExterna,
        requiereItemPadre: producto?.requiereItemPadre
    });

    return {
        lineaKey: `presupuesto-linea-${index + 1}-${String(producto?.id ?? producto?.codigo ?? 'sin-id')}`,
        id: producto?.id,
        codigo: producto?.codigo,
        descripcion: producto?.descripcion || producto?.nombre || 'Producto',
        categoria: producto?.categoria,
        material: producto?.material,
        cantidad: Math.max(1, Number(producto?.cantidad || 1)),
        precioUnitario: Number(producto?.precio || 0),
        descuento: Number(producto?.descuento || 0),
        totalLinea: Number(producto?.total || 0),
        tipoItem: clasificacion.tipoItem,
        requiereFormula: clasificacion.requiereFormula,
        requierePaciente: clasificacion.requierePaciente,
        requiereHistoriaMedica: clasificacion.requiereHistoriaMedica,
        permiteFormulaExterna: clasificacion.permiteFormulaExterna,
        requiereItemPadre: clasificacion.requiereItemPadre,
        requiereProcesoTecnico: clasificacion.requiereProcesoTecnico,
        origenClasificacion: clasificacion.origenClasificacion,
        esClasificacionConfiable: clasificacion.esClasificacionConfiable,
        configuracionTecnica: null
    };
}

export function resumirClasificacionLineas(lineas: PresupuestoVentaLineaDraft[]): ResumenClasificacionLineas {
    const lineasValidas = Array.isArray(lineas) ? lineas : [];
    const lineasConRequerimientoClinico = lineasValidas
        .filter((linea) => linea.requiereFormula)
        .map((linea) => linea.lineaKey);

    const tieneRevisionManual = lineasValidas.some((linea) => !linea.esClasificacionConfiable);
    const requiereSoporteClinico = lineasValidas.some((linea) => linea.requiereFormula || !linea.esClasificacionConfiable);
    const requiereProcesoTecnico = lineasValidas.some((linea) => linea.requiereProcesoTecnico);

    return {
        requiereSoporteClinico,
        requiereProcesoTecnico,
        estadoValidacionClinica: requiereSoporteClinico
            ? (tieneRevisionManual ? 'revision_manual' : 'pendiente')
            : 'no_requerida',
        lineasConRequerimientoClinico
    };
}