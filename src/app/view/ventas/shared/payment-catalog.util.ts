import {
  PaymentMethodAccount,
  PaymentMethodConfig,
  PaymentMethodCurrency,
  PaymentMethodsSettings,
  PaymentMethodBankScope
} from '../../system-config/system-config.interface';

export type VentaPaymentMethodValue = 'efectivo' | 'punto' | 'pagomovil' | 'transferencia' | 'zelle';
export type VentaPaymentMethodCurrency = 'dolar' | 'euro' | 'bolivar';

export interface VentaPaymentMethodOption {
  value: VentaPaymentMethodValue;
  label: string;
  icon: string;
  defaultMoneda: VentaPaymentMethodCurrency;
  configKey?: string;
}

export interface VentaBankOption {
  codigo: string;
  nombre: string;
  displayText: string;
  scope: PaymentMethodBankScope;
}

export interface VentaPuntoBankOption {
  id: string;
  nombre: string;
  codigo: string;
  displayText: string;
}

export interface VentaReceiverAccountOption {
  id: string;
  codigo: string;
  nombre: string;
  ownerName: string;
  ownerId: string;
  phone: string;
  accountDescription: string;
  email?: string;
  walletAddress?: string;
  methodValue: VentaPaymentMethodValue;
  configKey?: string;
  displayTitle: string;
  displaySubtitle: string;
  displayText: string;
}

export interface VentaPaymentCatalog {
  tiposPago: VentaPaymentMethodOption[];
  bancosNacionales: VentaBankOption[];
  bancosInternacionales: VentaBankOption[];
  bancosPuntoVenta: VentaPuntoBankOption[];
  cuentasReceptorasPorMetodo: Record<VentaPaymentMethodValue, VentaReceiverAccountOption[]>;
}

type SupportedMethodDefinition = {
  value: VentaPaymentMethodValue;
  aliases: string[];
  fallbackLabel: string;
  icon: string;
  defaultMoneda: VentaPaymentMethodCurrency;
};

const SUPPORTED_PAYMENT_METHODS: SupportedMethodDefinition[] = [
  { value: 'efectivo', aliases: ['efectivo', 'cash'], fallbackLabel: 'Efectivo', icon: 'bi-cash', defaultMoneda: 'dolar' },
  { value: 'punto', aliases: ['punto', 'punto_de_venta', 'punto_venta', 'pos'], fallbackLabel: 'Punto de Venta', icon: 'bi-credit-card', defaultMoneda: 'bolivar' },
  { value: 'pagomovil', aliases: ['pago_movil', 'pagomovil', 'pago-movil'], fallbackLabel: 'Pago Movil', icon: 'bi-phone', defaultMoneda: 'bolivar' },
  { value: 'transferencia', aliases: ['transferencia', 'transferencia_bancaria'], fallbackLabel: 'Transferencia', icon: 'bi-bank', defaultMoneda: 'bolivar' },
  { value: 'zelle', aliases: ['zelle'], fallbackLabel: 'Zelle', icon: 'bi-globe', defaultMoneda: 'dolar' }
];

const METHOD_EMOJI: Record<VentaPaymentMethodValue, string> = {
  efectivo: '💵',
  punto: '💳',
  pagomovil: '📱',
  transferencia: '🏦',
  zelle: '🌐'
};

const FALLBACK_BANKS: Array<{ codigo: string; nombre: string; scope: PaymentMethodBankScope }> = [
  { codigo: '0102', nombre: 'Banco de Venezuela', scope: 'national' },
  { codigo: '0104', nombre: 'Venezolano de Credito', scope: 'national' },
  { codigo: '0105', nombre: 'Mercantil', scope: 'national' },
  { codigo: '0108', nombre: 'Banco Provincial', scope: 'national' },
  { codigo: '0114', nombre: 'Bancaribe', scope: 'national' },
  { codigo: '0115', nombre: 'Banco Exterior', scope: 'national' },
  { codigo: '0116', nombre: 'Banco Plaza', scope: 'national' },
  { codigo: '0121', nombre: 'Bancamiga', scope: 'national' },
  { codigo: '0128', nombre: 'Banco Caribe', scope: 'national' },
  { codigo: '0134', nombre: 'Banesco', scope: 'national' },
  { codigo: '0151', nombre: '100% Banco', scope: 'national' },
  { codigo: '0156', nombre: 'Banco del Tesoro', scope: 'national' },
  { codigo: '0157', nombre: 'Banco Bicentenario', scope: 'national' },
  { codigo: '0163', nombre: 'Banco Fondo Comun', scope: 'national' },
  { codigo: '0166', nombre: 'Banco Agricola de Venezuela', scope: 'national' },
  { codigo: '0168', nombre: 'Bancrecer', scope: 'national' },
  { codigo: '0169', nombre: 'Mi Banco', scope: 'national' },
  { codigo: '0171', nombre: 'Banco Activo', scope: 'national' },
  { codigo: '0172', nombre: 'Bancamiga', scope: 'national' },
  { codigo: '0173', nombre: 'Banco Internacional de Desarrollo', scope: 'national' },
  { codigo: '0174', nombre: 'Banco Plaza', scope: 'national' },
  { codigo: '0175', nombre: 'Banco de la Fuerza Armada Nacional Bolivariana', scope: 'national' },
  { codigo: '0177', nombre: 'Banco del Tesoro', scope: 'national' },
  { codigo: '0191', nombre: 'Banco Nacional de Credito', scope: 'national' },
  { codigo: '0000', nombre: 'Otro', scope: 'national' },
  { codigo: 'BOFAUS3N', nombre: 'Bank of America', scope: 'international' },
  { codigo: 'CHASUS33', nombre: 'Chase', scope: 'international' },
  { codigo: 'WFBIUS6S', nombre: 'Wells Fargo', scope: 'international' },
  { codigo: 'CITIUS33', nombre: 'Citibank', scope: 'international' },
  { codigo: 'PNCCUS33', nombre: 'PNC Bank', scope: 'international' },
  { codigo: 'USBKUS44', nombre: 'U.S. Bank', scope: 'international' }
];

export function buildVentaPaymentCatalog(settings?: PaymentMethodsSettings | null): VentaPaymentCatalog {
  const bankCatalog = buildVentaBankCatalog(settings);
  const cuentasReceptorasPorMetodo = buildReceiverAccountsByMethod(settings, bankCatalog);

  return {
    tiposPago: buildVentaPaymentMethods(settings),
    bancosNacionales: bankCatalog.filter((bank) => bank.scope === 'national'),
    bancosInternacionales: bankCatalog.filter((bank) => bank.scope === 'international'),
    bancosPuntoVenta: bankCatalog
      .filter((bank) => bank.scope === 'national')
      .map((bank) => ({
        id: bank.codigo,
        nombre: bank.nombre,
        codigo: bank.codigo,
        displayText: bank.displayText
      })),
    cuentasReceptorasPorMetodo
  };
}

function buildVentaPaymentMethods(settings?: PaymentMethodsSettings | null): VentaPaymentMethodOption[] {
  const settingsMethods = Array.isArray(settings?.methods) ? settings.methods : [];

  const configuredSupportedMethods = SUPPORTED_PAYMENT_METHODS.reduce<VentaPaymentMethodOption[]>((acc, methodDefinition) => {
    const methodConfig = findConfiguredMethod(methodDefinition, settingsMethods);
    if (!methodConfig || methodConfig.enabled === false) {
      return acc;
    }

    acc.push({
      value: methodDefinition.value,
      label: `${METHOD_EMOJI[methodDefinition.value]} ${methodConfig.label?.trim() || methodDefinition.fallbackLabel}`,
      icon: methodDefinition.icon,
      defaultMoneda: mapPaymentCurrencyToVentaCurrency(methodConfig.currency, methodDefinition.defaultMoneda),
      configKey: methodConfig.key
    });

    return acc;
  }, []);

  if (configuredSupportedMethods.length > 0) {
    return configuredSupportedMethods;
  }

  return SUPPORTED_PAYMENT_METHODS.map((methodDefinition) => ({
    value: methodDefinition.value,
    label: `${METHOD_EMOJI[methodDefinition.value]} ${methodDefinition.fallbackLabel}`,
    icon: methodDefinition.icon,
    defaultMoneda: methodDefinition.defaultMoneda
  }));
}

function buildVentaBankCatalog(settings?: PaymentMethodsSettings | null): VentaBankOption[] {
  const configuredBanks = Array.isArray(settings?.bankCatalog)
    ? settings.bankCatalog.filter((bank) => bank.active !== false)
    : [];

  const sourceBanks = configuredBanks.length > 0
    ? configuredBanks.map((bank) => ({ codigo: bank.code, nombre: bank.name, scope: bank.scope }))
    : FALLBACK_BANKS;

  return sourceBanks
    .map((bank) => ({
      codigo: `${bank.codigo}`.trim(),
      nombre: `${bank.nombre}`.trim(),
      scope: bank.scope,
      displayText: `${`${bank.codigo}`.trim()} - ${`${bank.nombre}`.trim()}`
    }))
    .sort((current, next) => current.nombre.localeCompare(next.nombre));
}

function buildReceiverAccountsByMethod(
  settings: PaymentMethodsSettings | null | undefined,
  bankCatalog: VentaBankOption[]
): Record<VentaPaymentMethodValue, VentaReceiverAccountOption[]> {
  const cuentasPorMetodo = createEmptyReceiverAccountMap();
  const settingsMethods = Array.isArray(settings?.methods) ? settings.methods : [];

  for (const methodDefinition of SUPPORTED_PAYMENT_METHODS) {
    const methodConfig = findConfiguredMethod(methodDefinition, settingsMethods);
    if (!methodConfig || methodConfig.enabled === false) {
      continue;
    }

    cuentasPorMetodo[methodDefinition.value] = buildReceiverAccountOptions(methodConfig, methodDefinition.value, bankCatalog);
  }

  return cuentasPorMetodo;
}

function buildReceiverAccountOptions(
  methodConfig: PaymentMethodConfig,
  methodValue: VentaPaymentMethodValue,
  bankCatalog: VentaBankOption[]
): VentaReceiverAccountOption[] {
  const cuentas = Array.isArray(methodConfig.accounts) ? methodConfig.accounts : [];

  return cuentas
    .map((account) => mapReceiverAccountOption(account, methodValue, methodConfig.key, bankCatalog))
    .filter((account): account is VentaReceiverAccountOption => !!account)
    .sort((current, next) => current.displayText.localeCompare(next.displayText));
}

function mapReceiverAccountOption(
  account: PaymentMethodAccount,
  methodValue: VentaPaymentMethodValue,
  configKey: string,
  bankCatalog: VentaBankOption[]
): VentaReceiverAccountOption | null {
  const codigo = `${account.bankCode || ''}`.trim();
  const catalogBank = bankCatalog.find((bank) => bank.codigo === codigo);
  const nombre = `${account.bank || catalogBank?.nombre || codigo || 'Banco no identificado'}`.trim();
  const descripcion = `${account.accountDescription || account.ownerName || account.ownerId || account.phone || 'Cuenta receptora'}`.trim();
  const id = `${account.id || `${configKey}-${codigo}-${descripcion}`}`.trim();
  const ownerId = `${account.ownerId || ''}`.trim();
  const phone = `${account.phone || ''}`.trim();
  const detalles: string[] = [];

  if (phone) {
    detalles.push(`Telf. ${phone}`);
  }

  if (ownerId) {
    detalles.push(`CI. ${ownerId}`);
  }

  const displayTitle = detalles.length > 0
    ? `${nombre} (${detalles.join(' - ')})`
    : nombre;
  const displaySubtitle = descripcion;

  if (!id) {
    return null;
  }

  return {
    id,
    codigo,
    nombre,
    ownerName: `${account.ownerName || ''}`.trim(),
    ownerId,
    phone,
    accountDescription: `${account.accountDescription || ''}`.trim(),
    email: account.email?.trim(),
    walletAddress: account.walletAddress?.trim(),
    methodValue,
    configKey,
    displayTitle,
    displaySubtitle,
    displayText: `${displayTitle} - ${displaySubtitle}`
  };
}

function findConfiguredMethod(
  methodDefinition: SupportedMethodDefinition,
  configuredMethods: PaymentMethodConfig[]
): PaymentMethodConfig | undefined {
  return configuredMethods.find((method) => methodDefinition.aliases.includes(normalizeMethodKey(method.key)));
}

function normalizeMethodKey(value: string | undefined): string {
  return `${value || ''}`
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function mapPaymentCurrencyToVentaCurrency(
  currency: PaymentMethodCurrency | undefined,
  fallback: VentaPaymentMethodCurrency
): VentaPaymentMethodCurrency {
  switch (currency) {
    case 'USD':
      return 'dolar';
    case 'EUR':
      return 'euro';
    case 'VES':
      return 'bolivar';
    default:
      return fallback;
  }
}

function createEmptyReceiverAccountMap(): Record<VentaPaymentMethodValue, VentaReceiverAccountOption[]> {
  return {
    efectivo: [],
    punto: [],
    pagomovil: [],
    transferencia: [],
    zelle: []
  };
}