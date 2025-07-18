
export interface OpcionSelect {
    value: string | number;
    label: string;
}

export const OPCIONES_REF: Record<string, OpcionSelect[]> = {
    esf: [
        { value: '0.00', label: 'Plano (0.00)' },
        // Valores positivos
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
        // Valores negativos
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
        { value: '-6.00', label: '-6.00' }
    ],

    cil: [
        { value: '0.00', label: '0.00' },
        // Valores positivos
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
        // Valores negativos
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
        { value: '-6.00', label: '-6.00' }
    ],

    eje: [
        { value: 1, label: '1°' },
        { value: 2, label: '2°' },
        { value: 90, label: '90°' },
        { value: 180, label: '180°' }
    ],

    add: [
        { value: '0.00', label: 'N/A (0.00)' },
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
        { value: '+3.50', label: '+3.50' }
    ],

    avLejos: [
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

    avCerca: [
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

    avBinocular: [
        { value: '20/20', label: '20/20' },
        { value: '20/25', label: '20/25' },
        { value: '20/30', label: '20/30' },
        // ... otros valores binocular ...
    ],// Agregar estas nuevas opciones para ALT y DP si es necesario

    alt: [
        { value: '0', label: '0 mm' },
        { value: '1', label: '1 mm' },
        { value: '2', label: '2 mm' },
        { value: '3', label: '3 mm' },
        { value: '4', label: '4 mm' },
        { value: '5', label: '5 mm' }
        // ... agregar más valores según sea necesario
    ],

    dp: [
        { value: '60', label: '60 mm' },
        { value: '62', label: '62 mm' },
        { value: '64', label: '64 mm' },
        { value: '66', label: '66 mm' },
        { value: '68', label: '68 mm' },
        { value: '70', label: '70 mm' }
    ],

    // Nuevas opciones para AVSC y AVAE
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
    ]
};

export const opcionesAntecedentes =
    [
        'Diabetes', 'Hipertensión', 'Migraña', 'Fotosensibilidad',
        'Traumatismo ocular', 'Queratocono', 'Glaucoma', 'Retinopatía diabética'
    ];

export const OPCIONES_ANTECEDENTES: string[] = [
    'Diabetes',
    'Hipertensión',
    'Migraña',
    'Fotosensibilidad',
    'Traumatismo ocular',
    'Queratocono',
    'Glaucoma',
    'Retinopatía diabética'
];

export const MOTIVOS_CONSULTA: string[] = [
  'Molestia ocular',
  'Fatiga visual',
  'Consulta rutinaria',
  'Actualizar fórmula',
  'Sensibilidad lumínica',
  'Dolor de cabeza',
  'Evaluación prequirúrgica',
  'Control post-operatorio',
  'Dificultad visual lejos',
  'Dificultad visual cerca',
  'Otro'
];

export const TIPOS_CRISTALES: string[] = [
  'Monofocal visión sencilla',
  'Visión sencilla digital',
  'Bifocal',
  'Progresivo digital básico',
  'Progresivo digital intermedio',
  'Progresivo digital amplio'
];