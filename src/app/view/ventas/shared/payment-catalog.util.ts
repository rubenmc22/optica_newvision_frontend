import {
  PaymentMethodAccount,
  PaymentMethodConfig,
  PaymentMethodCurrency,
  PaymentMethodsSettings,
  PaymentMethodBankScope
} from '../../system-config/system-config.interface';

export type VentaPaymentMethodValue = string;
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

export type VentaReceiverAccountsMap = Record<string, VentaReceiverAccountOption[]>;

export interface VentaPaymentCatalog {
  tiposPago: VentaPaymentMethodOption[];
  bancosNacionales: VentaBankOption[];
  bancosInternacionales: VentaBankOption[];
  bancosPuntoVenta: VentaPuntoBankOption[];
  cuentasReceptorasPorMetodo: VentaReceiverAccountsMap;
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

const METHOD_EMOJI: Record<string, string> = {
  efectivo: '💵',
  punto: '💳',
  pagomovil: '📱',
  transferencia: '🏦',
  zelle: '🌐',
  binance: '🪙'
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
  const settingsMethods = Array.isArray(settings?.methods)
    ? settings.methods.filter((method) => method.enabled !== false)
    : [];

  if (settingsMethods.length > 0) {
    const metodosConfigurados = settingsMethods.reduce<VentaPaymentMethodOption[]>((acc, methodConfig) => {
      const methodValue = normalizeConfiguredMethodValue(methodConfig.key);
      const supportedMethod = findSupportedMethodDefinition(methodValue);

      if (acc.some((method) => method.value === methodValue)) {
        return acc;
      }

      acc.push({
        value: methodValue,
        label: `${getPaymentMethodEmoji(methodValue, methodConfig)} ${methodConfig.label?.trim() || supportedMethod?.fallbackLabel || formatMethodLabel(methodValue)}`.trim(),
        icon: supportedMethod?.icon || getPaymentMethodIcon(methodValue, methodConfig),
        defaultMoneda: mapPaymentCurrencyToVentaCurrency(
          methodConfig.currency,
          supportedMethod?.defaultMoneda || inferFallbackCurrency(methodValue)
        ),
        configKey: methodConfig.key
      });

      return acc;
    }, []);

    if (metodosConfigurados.length > 0) {
      return metodosConfigurados;
    }
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
): VentaReceiverAccountsMap {
  const cuentasPorMetodo = createEmptyReceiverAccountMap();
  const settingsMethods = Array.isArray(settings?.methods)
    ? settings.methods.filter((method) => method.enabled !== false)
    : [];

  for (const methodConfig of settingsMethods) {
    const methodValue = normalizeConfiguredMethodValue(methodConfig.key);
    if (!methodValue) {
      continue;
    }

    cuentasPorMetodo[methodValue] = buildReceiverAccountOptions(methodConfig, methodValue, bankCatalog);
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
  const bankName = `${account.bank || ''}`.trim();
  const ownerName = `${account.ownerName || ''}`.trim();
  const ownerId = `${account.ownerId || ''}`.trim();
  const phone = `${account.phone || ''}`.trim();
  const email = `${account.email || ''}`.trim();
  const walletAddress = `${account.walletAddress || ''}`.trim();
  const catalogBank = bankCatalog.find((bank) => bank.codigo === codigo);
  const descripcion = `${account.accountDescription || walletAddress || email || ownerName || ownerId || phone || 'Cuenta receptora'}`.trim();
  const nombre = bankName || catalogBank?.nombre || ownerName || email || abbreviateWalletAddress(walletAddress) || descripcion || 'Cuenta receptora';
  const id = `${account.id || `${configKey}-${codigo}-${descripcion}`}`.trim();
  const detalles: string[] = [];

  if (phone) {
    detalles.push(`Telf. ${phone}`);
  }

  if (ownerId) {
    detalles.push(`CI. ${ownerId}`);
  }

  if (!bankName && email) {
    detalles.push(email);
  }

  const walletLabel = walletAddress ? abbreviateWalletAddress(walletAddress) : '';
  const displayTitle = bankName || catalogBank?.nombre
    ? (detalles.length > 0 ? `${nombre} (${detalles.join(' - ')})` : nombre)
    : [nombre, walletLabel && walletLabel !== nombre ? `(${walletLabel})` : ''].filter(Boolean).join(' ');
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
    email: email || undefined,
    walletAddress: walletAddress || undefined,
    methodValue,
    configKey,
    displayTitle,
    displaySubtitle,
    displayText: displaySubtitle && displaySubtitle !== displayTitle
      ? `${displayTitle} - ${displaySubtitle}`
      : displayTitle
  };
}

function findConfiguredMethod(
  methodDefinition: SupportedMethodDefinition,
  configuredMethods: PaymentMethodConfig[]
): PaymentMethodConfig | undefined {
  return configuredMethods.find((method) => methodDefinition.aliases.includes(normalizeMethodKey(method.key)));
}

function findSupportedMethodDefinition(methodValue: string): SupportedMethodDefinition | undefined {
  return SUPPORTED_PAYMENT_METHODS.find((method) => method.value === methodValue || method.aliases.includes(methodValue));
}

function normalizeConfiguredMethodValue(value: string | undefined): string {
  const normalizedKey = normalizeMethodKey(value);
  return findSupportedMethodDefinition(normalizedKey)?.value || normalizedKey;
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
    case 'CRYPTO':
    case 'USDT':
    case 'BTC':
    case 'ETH':
      return 'dolar';
    default:
      return fallback;
  }
}

function createEmptyReceiverAccountMap(): VentaReceiverAccountsMap {
  return {};
}

function inferFallbackCurrency(methodValue: string): VentaPaymentMethodCurrency {
  if (methodValue === 'punto' || methodValue === 'pagomovil' || methodValue === 'transferencia') {
    return 'bolivar';
  }

  if (methodValue === 'zelle' || methodValue.includes('crypto') || methodValue.includes('binance')) {
    return 'dolar';
  }

  return 'dolar';
}

function getPaymentMethodEmoji(methodValue: string, methodConfig: PaymentMethodConfig): string {
  if (METHOD_EMOJI[methodValue]) {
    return METHOD_EMOJI[methodValue];
  }

  if (['CRYPTO', 'USDT', 'BTC', 'ETH'].includes(methodConfig.currency)) {
    return '🪙';
  }

  if (methodConfig.requiresReceiverAccount) {
    return '🏧';
  }

  return '💳';
}

function getPaymentMethodIcon(methodValue: string, methodConfig: PaymentMethodConfig): string {
  if (methodValue.includes('binance') || ['CRYPTO', 'USDT', 'BTC', 'ETH'].includes(methodConfig.currency)) {
    return 'bi-currency-bitcoin';
  }

  if (methodConfig.requiresReceiverAccount) {
    return 'bi-wallet2';
  }

  return 'bi-credit-card-2-front';
}

function formatMethodLabel(methodValue: string): string {
  return `${methodValue || ''}`
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
    .trim() || 'Metodo de pago';
}

function abbreviateWalletAddress(value: string): string {
  const walletAddress = `${value || ''}`.trim();
  if (walletAddress.length <= 18) {
    return walletAddress;
  }

  return `${walletAddress.slice(0, 10)}...${walletAddress.slice(-6)}`;
}