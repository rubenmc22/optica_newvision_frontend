export interface OpcionSelect {
    value: string | number;
    label: string;
}

// ===== VALORES DE REFRACCIÓN =====
export const OPCIONES_REF: Record<string, OpcionSelect[]> = {
    esf: [
        { value: '0.00', label: 'Plano (0.00)' },
        // Valores positivos HIPERMETROPIA
        { value: '+0.25', label: '+0.25' },
        { value: '+0.50', label: '+0.50' },
        { value: '+0.75', label: '+0.75' },
        { value: '+1.00', label: '+1.00' },
        { value: '+1.25', label: '+1.25' },
        { value: '+1.50', label: '+1.50' },
        { value: '+1.75', label: '+1.75' },
        { value: '+2.00', label: '+2.00' },
        { value: '+2.25', label: '+2.25' },
        { value: '+2.50', label: '+2.50' },
        { value: '+2.75', label: '+2.75' },
        { value: '+3.00', label: '+3.00' },
        { value: '+3.25', label: '+3.25' },
        { value: '+3.50', label: '+3.50' },
        { value: '+3.75', label: '+3.75' },
        { value: '+4.00', label: '+4.00' },
        { value: '+4.25', label: '+4.25' },
        { value: '+4.50', label: '+4.50' },
        { value: '+4.75', label: '+4.75' },
        { value: '+5.00', label: '+5.00' },
        { value: '+5.25', label: '+5.25' },
        { value: '+5.50', label: '+5.50' },
        { value: '+5.75', label: '+5.75' },
        { value: '+6.00', label: '+6.00' },
        { value: '+6.25', label: '+6.25' },
        { value: '+6.50', label: '+6.50' },
        { value: '+6.75', label: '+6.75' },
        { value: '+7.00', label: '+7.00' },
        { value: '+7.25', label: '+7.25' },
        { value: '+7.50', label: '+7.50' },
        { value: '+7.75', label: '+7.75' },
        { value: '+8.00', label: '+8.00' },
        { value: '+8.25', label: '+8.25' },
        { value: '+8.50', label: '+8.50' },
        { value: '+8.75', label: '+8.75' },
        { value: '+9.00', label: '+9.00' },
        { value: '+9.25', label: '+9.25' },
        { value: '+9.50', label: '+9.50' },
        { value: '+9.75', label: '+9.75' },
        { value: '+10.00', label: '+10.00' },
        { value: '+10.25', label: '+10.25' },
        { value: '+10.50', label: '+10.50' },
        { value: '+10.75', label: '+10.75' },
        { value: '+11.00', label: '+11.00' },
        { value: '+11.25', label: '+11.25' },
        { value: '+11.50', label: '+11.50' },
        { value: '+11.75', label: '+11.75' },
        { value: '+12.00', label: '+12.00' },
        { value: '+12.25', label: '+12.25' },
        { value: '+12.50', label: '+12.50' },
        { value: '+12.75', label: '+12.75' },
        { value: '+13.00', label: '+13.00' },
        { value: '+13.25', label: '+13.25' },
        { value: '+13.50', label: '+13.50' },
        { value: '+13.75', label: '+13.75' },
        { value: '+14.00', label: '+14.00' },
        { value: '+14.25', label: '+14.25' },
        { value: '+14.50', label: '+14.50' },
        { value: '+14.75', label: '+14.75' },
        { value: '+15.00', label: '+15.00' },

        // Valores negativos MIOPIA
        { value: '-0.25', label: '-0.25' },
        { value: '-0.50', label: '-0.50' },
        { value: '-0.75', label: '-0.75' },
        { value: '-1.00', label: '-1.00' },
        { value: '-1.25', label: '-1.25' },
        { value: '-1.50', label: '-1.50' },
        { value: '-1.75', label: '-1.75' },
        { value: '-2.00', label: '-2.00' },
        { value: '-2.25', label: '-2.25' },
        { value: '-2.50', label: '-2.50' },
        { value: '-2.75', label: '-2.75' },
        { value: '-3.00', label: '-3.00' },
        { value: '-3.25', label: '-3.25' },
        { value: '-3.50', label: '-3.50' },
        { value: '-3.75', label: '-3.75' },
        { value: '-4.00', label: '-4.00' },
        { value: '-4.25', label: '-4.25' },
        { value: '-4.50', label: '-4.50' },
        { value: '-4.75', label: '-4.75' },
        { value: '-5.00', label: '-5.00' },
        { value: '-5.25', label: '-5.25' },
        { value: '-5.50', label: '-5.50' },
        { value: '-5.75', label: '-5.75' },
        { value: '-6.00', label: '-6.00' },
        { value: '-6.25', label: '-6.25' },
        { value: '-6.50', label: '-6.50' },
        { value: '-6.75', label: '-6.75' },
        { value: '-7.00', label: '-7.00' },
        { value: '-7.25', label: '-7.25' },
        { value: '-7.50', label: '-7.50' },
        { value: '-7.75', label: '-7.75' },
        { value: '-8.00', label: '-8.00' },
        { value: '-8.25', label: '-8.25' },
        { value: '-8.50', label: '-8.50' },
        { value: '-8.75', label: '-8.75' },
        { value: '-9.00', label: '-9.00' },
        { value: '-9.25', label: '-9.25' },
        { value: '-9.50', label: '-9.50' },
        { value: '-9.75', label: '-9.75' },
        { value: '-10.00', label: '-10.00' },
        { value: '-10.25', label: '-10.25' },
        { value: '-10.50', label: '-10.50' },
        { value: '-10.75', label: '-10.75' },
        { value: '-11.00', label: '-11.00' },
        { value: '-11.25', label: '-11.25' },
        { value: '-11.50', label: '-11.50' },
        { value: '-11.75', label: '-11.75' },
        { value: '-12.00', label: '-12.00' },
        { value: '-12.25', label: '-12.25' },
        { value: '-12.50', label: '-12.50' },
        { value: '-12.75', label: '-12.75' },
        { value: '-13.00', label: '-13.00' },
        { value: '-13.25', label: '-13.25' },
        { value: '-13.50', label: '-13.50' },
        { value: '-13.75', label: '-13.75' },
        { value: '-14.00', label: '-14.00' },
        { value: '-14.25', label: '-14.25' },
        { value: '-14.50', label: '-14.50' },
        { value: '-14.75', label: '-14.75' },
        { value: '-15.00', label: '-15.00' },
        { value: '-15.25', label: '-15.25' },
        { value: '-15.50', label: '-15.50' },
        { value: '-15.75', label: '-15.75' },
        { value: '-16.00', label: '-16.00' },
        { value: '-16.25', label: '-16.25' },
        { value: '-16.50', label: '-16.50' },
        { value: '-16.75', label: '-16.75' },
        { value: '-17.00', label: '-17.00' },
        { value: '-17.25', label: '-17.25' },
        { value: '-17.50', label: '-17.50' },
        { value: '-17.75', label: '-17.75' },
        { value: '-18.00', label: '-18.00' },
        { value: '-18.25', label: '-18.25' },
        { value: '-18.50', label: '-18.50' },
        { value: '-18.75', label: '-18.75' },
        { value: '-19.00', label: '-19.00' },
        { value: '-19.25', label: '-19.25' },
        { value: '-19.50', label: '-19.50' },
        { value: '-19.75', label: '-19.75' },
        { value: '-20.00', label: '-20.00' },
        { value: '-20.25', label: '-20.25' },
        { value: '-20.50', label: '-20.50' },
        { value: '-20.75', label: '-20.75' },
        { value: '-21.00', label: '-21.00' },
        { value: '-21.25', label: '-21.25' },
        { value: '-21.50', label: '-21.50' },
        { value: '-21.75', label: '-21.75' },
        { value: '-22.00', label: '-22.00' },
        { value: '-22.25', label: '-22.25' },
        { value: '-22.50', label: '-22.50' },
        { value: '-22.75', label: '-22.75' },
        { value: '-23.00', label: '-23.00' },
        { value: '-23.25', label: '-23.25' },
        { value: '-23.50', label: '-23.50' },
        { value: '-23.75', label: '-23.75' },
        { value: '-24.00', label: '-24.00' },
        { value: '-24.25', label: '-24.25' },
        { value: '-24.50', label: '-24.50' },
        { value: '-24.75', label: '-24.75' },
        { value: '-25.00', label: '-25.00' }
    ],

    cil: [
        { value: '0.00', label: '0.00' },
        { value: '-0.25', label: '-0.25' },
        { value: '-0.50', label: '-0.50' },
        { value: '-0.75', label: '-0.75' },
        { value: '-1.00', label: '-1.00' },
        { value: '-1.25', label: '-1.25' },
        { value: '-1.50', label: '-1.50' },
        { value: '-1.75', label: '-1.75' },
        { value: '-2.00', label: '-2.00' },
        { value: '-2.25', label: '-2.25' },
        { value: '-2.50', label: '-2.50' },
        { value: '-2.75', label: '-2.75' },
        { value: '-3.00', label: '-3.00' },
        { value: '-3.25', label: '-3.25' },
        { value: '-3.50', label: '-3.50' },
        { value: '-3.75', label: '-3.75' },
        { value: '-4.00', label: '-4.00' },
        { value: '-4.25', label: '-4.25' },
        { value: '-4.50', label: '-4.50' },
        { value: '-4.75', label: '-4.75' },
        { value: '-5.00', label: '-5.00' },
        { value: '-5.25', label: '-5.25' },
        { value: '-5.50', label: '-5.50' },
        { value: '-5.75', label: '-5.75' },
        { value: '-6.00', label: '-6.00' },
        { value: '-6.25', label: '-6.25' },
        { value: '-6.50', label: '-6.50' },
        { value: '-6.75', label: '-6.75' },
        { value: '-7.00', label: '-7.00' },
        { value: '-7.25', label: '-7.25' },
        { value: '-7.50', label: '-7.50' },
        { value: '-7.75', label: '-7.75' },
        { value: '-8.00', label: '-8.00' },
        { value: '-8.25', label: '-8.25' },
        { value: '-8.50', label: '-8.50' },
        { value: '-8.75', label: '-8.75' },
        { value: '-9.00', label: '-9.00' },
        { value: '-9.25', label: '-9.25' },
        { value: '-9.50', label: '-9.50' },
        { value: '-9.75', label: '-9.75' },
        { value: '-10.00', label: '-10.00' },
        { value: '-10.25', label: '-10.25' },
        { value: '-10.50', label: '-10.50' },
        { value: '-10.75', label: '-10.75' },
        { value: '-11.00', label: '-11.00' },
        { value: '-11.25', label: '-11.25' },
        { value: '-11.50', label: '-11.50' },
        { value: '-11.75', label: '-11.75' },
        { value: '-12.00', label: '-12.00' },
        { value: '-12.25', label: '-12.25' },
        { value: '-12.50', label: '-12.50' },
        { value: '-12.75', label: '-12.75' },
        { value: '-13.00', label: '-13.00' },
        { value: '-13.25', label: '-13.25' },
        { value: '-13.50', label: '-13.50' },
        { value: '-13.75', label: '-13.75' },
        { value: '-14.00', label: '-14.00' },
        { value: '-14.25', label: '-14.25' },
        { value: '-14.50', label: '-14.50' },
        { value: '-14.75', label: '-14.75' },
        { value: '-15.00', label: '-15.00' }
    ],

    eje: (() => {
        const opciones: OpcionSelect[] = [];
        for (let i = 1; i <= 180; i++) {
            opciones.push({ value: i, label: `${i}°` });
        }
        return opciones;
    })(),

    add: [
        { value: '0.00', label: 'N/A (0.00)' },
        { value: '+1.00', label: '+1.00' },
        { value: '+1.25', label: '+1.25' },
        { value: '+1.50', label: '+1.50' },
        { value: '+1.75', label: '+1.75' },
        { value: '+2.00', label: '+2.00' },
        { value: '+2.25', label: '+2.25' },
        { value: '+2.50', label: '+2.50' },
        { value: '+2.75', label: '+2.75' },
        { value: '+3.00', label: '+3.00' },
    ],

    // ALTURA - ajustado de 0 a 40 mm
    alt: (() => {
        const opciones: OpcionSelect[] = [];
        for (let i = 0; i <= 40; i++) {
            opciones.push({ value: i.toString(), label: `${i} mm` });
        }
        return opciones;
    })(),

    // DISTANCIA PUPILAR - ajustado de 50 a 80 mm
    dp: (() => {
        const opciones: OpcionSelect[] = [];
        for (let i = 50; i <= 80; i++) {
            opciones.push({ value: i.toString(), label: `${i} mm` });
        }
        return opciones;
    })()
};

// ===== AGUDEZ VISUAL =====
export const OPCIONES_AV: Record<string, OpcionSelect[]> = {
    lejos: [
        { value: '20/20', label: '20/20 (Normal)' },
        { value: '20/25', label: '20/25' },
        { value: '20/30', label: '20/30' },
        { value: '20/40', label: '20/40' },
        { value: '20/50', label: '20/50' },
        { value: '20/60', label: '20/60' },
        { value: '20/70', label: '20/70' },
        { value: '20/80', label: '20/80' },
        { value: '20/100', label: '20/100' },
        { value: '20/200', label: '20/200' },
        { value: '20/400', label: '20/400' },
        { value: 'CF', label: 'CF (Conteo Dedos)' },
        { value: 'HM', label: 'HM (Movimiento Manos)' },
        { value: 'LP', label: 'LP (Percepción Luz)' },
        { value: 'NLP', label: 'NLP (No Percepción Luz)' }
    ],

    cerca: [
        { value: 'J1', label: 'J1 (Excelente)' },
        { value: 'J2', label: 'J2' },
        { value: 'J3', label: 'J3' },
        { value: 'J4', label: 'J4' },
        { value: 'J5', label: 'J5' },
        { value: 'J6', label: 'J6' },
        { value: 'J7', label: 'J7' },
        { value: 'J8', label: 'J8' },
        { value: 'J9', label: 'J9' },
        { value: 'J10', label: 'J10' },
        { value: 'J11', label: 'J11' },
        { value: 'J12', label: 'J12' },
        { value: 'J14', label: 'J14' },
        { value: 'J16', label: 'J16' },
        { value: 'J18', label: 'J18' },
        { value: 'J20', label: 'J20' }
    ],

    // AV Sin Corrección
    avsc: [
        { value: '20/20', label: '20/20' },
        { value: '20/25', label: '20/25' },
        { value: '20/30', label: '20/30' },
        { value: '20/40', label: '20/40' },
        { value: '20/50', label: '20/50' },
        { value: '20/60', label: '20/60' },
        { value: '20/70', label: '20/70' },
        { value: '20/80', label: '20/80' },
        { value: '20/100', label: '20/100' },
        { value: 'CF', label: 'CF (Conteo Dedos)' },
        { value: 'HM', label: 'HM (Movimiento Manos)' },
        { value: 'LP', label: 'LP (Percepción Luz)' }
    ],

    // AV Con Añadido Esférico
    avae: [
        { value: 'J1', label: 'J1 (Excelente)' },
        { value: 'J2', label: 'J2' },
        { value: 'J3', label: 'J3' },
        { value: 'J4', label: 'J4' },
        { value: 'J5', label: 'J5' },
        { value: 'J6', label: 'J6' },
        { value: 'J7', label: 'J7' },
        { value: 'J8', label: 'J8' },
        { value: 'J9', label: 'J9' },
        { value: 'J10', label: 'J10' }
    ],

    // AV Binocular
    binocular: [
        { value: '20/20', label: '20/20' },
        { value: '20/25', label: '20/25' },
        { value: '20/30', label: '20/30' }
        // Solo mantengo los primeros 3 que tenías
    ]
};

// ===== ANTECEDENTES =====
export const OPCIONES_ANTECEDENTES_PERSONALES: string[] = [
    'Diabetes',
    'Hipertensión',
    'Migraña',
    'Fotosensibilidad',
    'Traumatismo ocular',
    'Queratocono',
    'Glaucoma',
    'Retinopatía diabética',
    'Degeneración macular',
    'Uveítis',
    'Catarata',
    'Queratitis',
    'Desprendimiento de retina',
    'Ojo seco',
    'Conjuntivitis alérgica',
    'Orzuelos',
    'Pterigion'
];

export const OPCIONES_ANTECEDENTES_FAMILIARES: string[] = [
    'Diabetes',
    'Hipertensión',
    'Migraña',
    'Traumatismo ocular',
    'Queratocono',
    'Glaucoma',
    'Degeneración macular',
    'Retinopatía diabética'
];

// ===== MOTIVOS DE CONSULTA =====
export const MOTIVOS_CONSULTA: string[] = [
    'Molestia ocular',
    'Fatiga visual',
    'Consulta rutinaria',
    'Actualizar fórmula',
    'Sensibilidad lumínica',
    'Cefalea',
    'Evaluación prequirúrgica',
    'Control post-operatorio',
    'Dificultad visual lejos',
    'Dificultad visual cerca',
    'Otro'
];

// ===== TIPOS DE CRISTALES =====
export const TIPOS_CRISTALES: any[] = [
  { value: 'MONOFOCAL', label: 'Monofocal visión sencilla' },
  { value: 'MONOFOCAL_DIGITAL', label: 'Monofocal Visión sencilla digital' },
  { value: 'BIFOCAL', label: 'Bifocal' },
  { value: 'PROGRESIVO_CONVENCIONAL', label: 'Progresivo convencional' },
  { value: 'PROGRESIVO_DIGITAL_BASICO', label: 'Progresivo digital básico' },
  { value: 'PROGRESIVO_DIGITAL_INTERMEDIO', label: 'Progresivo digital intermedio' },
  { value: 'PROGRESIVO_DIGITAL_AMPLIO', label: 'Progresivo digital amplio' },
  { value: 'LENTES_CONTACTO', label: 'Lentes de contacto' }
];

export const TIPOS_LENTES_CONTACTO: any[] = [
  { value: 'DESECHABLES_BIOMEDIC', label: 'Desechables biomedic' },
  { value: 'DESECHABLES_EVOLUTION', label: 'Desechables evolution' },
  { value: 'TORICOS', label: 'Toricos' },
  { value: 'CONTAFLEX', label: 'Contaflex' },
  { value: 'COSMETICOS', label: 'Cosmeticos' },
  { value: 'COSMETICOS_FORMULADOS', label: 'Cosmeticos formulados' }
];
// ===== MATERIALES =====
export const MATERIALES: OpcionSelect[] = [
    { value: 'CR39', label: 'CR39' },
    { value: 'POLICARBONATO', label: 'Policarbonato' },
    { value: 'HI_INDEX_156', label: 'Hi Index 1.56' },
    { value: 'HI_INDEX_167', label: 'Hi Index 1.67' },
    { value: 'HI_INDEX_174', label: 'Hi Index 1.74' },
    { value: 'OTRO', label: 'Otro (especificar)' }
];

// ===== TRATAMIENTOS Y ADITIVOS =====
export const TRATAMIENTOS_ADITIVOS: OpcionSelect[] = [
    { value: 'TRANSICION_PLUS', label: 'Transición Pluss' },
    { value: 'BLUE_BLOCK', label: 'Blue Block' },
    { value: 'FOTOSENSIBLE', label: 'Fotosensible' },
    { value: 'FOTOCROMATICO', label: 'Fotocromático' },
    { value: 'ANTIREFLEJO', label: 'Antirreflejo' },
    { value: 'AR_VERDE', label: 'Antirreflejo verde' },
    { value: 'COLORACION_DEGRADE', label: 'Coloración en degradé' },
    { value: 'COLORACION_FULL_COLOR', label: 'Coloración full color' },
    { value: 'COLORACION', label: 'Coloración' }
];

// ===== FORMAS DE PAGO =====
export const FORMAS_PAGO: OpcionSelect[] = [
    { value: 'EFECTIVO', label: 'Efectivo' },
    { value: 'TARJETA_CREDITO', label: 'Tarjeta de crédito' },
    { value: 'TARJETA_DEBITO', label: 'Tarjeta de débito' },
    { value: 'TRANSFERENCIA', label: 'Transferencia bancaria' },
    { value: 'PAGO_MOVIL', label: 'Pago móvil' },
    { value: 'ZELLE', label: 'Zelle' },
];

// ===== INTERFACES PARA EXAMEN OCULAR =====

export interface Lensometria {
    esf_od: string;
    cil_od: string;
    eje_od: string;
    add_od: string;
    av_lejos_od: string;
    av_cerca_od: string;
    av_lejos_bi: string;
    av_bi: string;
    esf_oi: string;
    cil_oi: string;
    eje_oi: string;
    add_oi: string;
    av_lejos_oi: string;
    av_cerca_oi: string;
    av_cerca_bi: string;
}

export interface Refraccion {
    esf_od: string;
    cil_od: string;
    eje_od: string;
    add_od: string;
    avccl_od: string;   // AV con corrección lejos
    avccc_od: string;   // AV con corrección cerca
    avccl_bi: string;   // AV con corrección lejos binocular
    avccc_bi: string;   // AV con corrección cerca binocular
    esf_oi: string;
    cil_oi: string;
    eje_oi: string;
    add_oi: string;
    avccl_oi: string;
    avccc_oi: string;
}

export interface RefraccionFinal {
    esf_od: string;
    cil_od: string;
    eje_od: string;
    add_od: string;
    alt_od: string;     // Altura
    dp_od: string;      // Distancia pupilar
    esf_oi: string;
    cil_oi: string;
    eje_oi: string;
    add_oi: string;
    alt_oi: string;
    dp_oi: string;
}

export interface AVSC_AVAE_Otros {
    avsc_od: string;    // AV sin corrección
    avae_od: string;    // AV con añadido esférico
    otros_od?: string;  // Observaciones ojo derecho
    avsc_oi: string;
    avae_oi: string;
    otros_oi?: string;  // Observaciones ojo izquierdo
    avsc_bi: string;    // AV sin corrección binocular
}

export interface ExamenOcular {
    lensometria: Lensometria;
    refraccion: Refraccion;
    refraccionFinal: RefraccionFinal;
    avsc_avae_otros: AVSC_AVAE_Otros;
}

// ===== FUNCIÓN PARA CREAR EXAMEN OCULAR VACÍO =====
export function crearExamenOcularVacio(): ExamenOcular {
    return {
        lensometria: {
            esf_od: '',
            cil_od: '',
            eje_od: '',
            add_od: '',
            av_lejos_od: '',
            av_cerca_od: '',
            av_lejos_bi: '',
            av_bi: '',
            esf_oi: '',
            cil_oi: '',
            eje_oi: '',
            add_oi: '',
            av_lejos_oi: '',
            av_cerca_oi: '',
            av_cerca_bi: ''
        },
        refraccion: {
            esf_od: '',
            cil_od: '',
            eje_od: '',
            add_od: '',
            avccl_od: '',
            avccc_od: '',
            avccl_bi: '',
            avccc_bi: '',
            esf_oi: '',
            cil_oi: '',
            eje_oi: '',
            add_oi: '',
            avccl_oi: '',
            avccc_oi: ''
        },
        refraccionFinal: {
            esf_od: '',
            cil_od: '',
            eje_od: '',
            add_od: '',
            alt_od: '',
            dp_od: '',
            esf_oi: '',
            cil_oi: '',
            eje_oi: '',
            add_oi: '',
            alt_oi: '',
            dp_oi: ''
        },
        avsc_avae_otros: {
            avsc_od: '',
            avae_od: '',
            otros_od: '',
            avsc_oi: '',
            avae_oi: '',
            otros_oi: '',
            avsc_bi: ''
        }
    };
}

// ===== INTERVALOS DE HORA DE USO DE LENTES =====
export const INTERVALOS_HORA_USO: OpcionSelect[] = [
    { value: 'MENOS_1_HORA', label: 'Menos de 1 hora' },
    { value: '1_A_3_HORAS', label: '1 a 3 horas' },
    { value: '3_A_6_HORAS', label: '3 a 6 horas' },
    { value: 'MAS_6_HORAS', label: 'Más de 6 horas' }
];

// También disponible como array de strings simple
export const INTERVALOS_HORA: string[] = [
    'Menos de 1 hora',
    '1 a 3 horas',
    '3 a 6 horas',
    'Más de 6 horas'
];

// ===== CONSTANTES PARA OJOS (Versión simplificada) =====
export const OJOS = {
    OD: 'OD',  // Ojo derecho
    OI: 'OI',  // Ojo izquierdo
    AMBOS: 'AMBOS'
};
