export interface SystemConfig {
  monedaPrincipal: 'USD' | 'EUR' | 'VES';
  simboloMoneda: string;
  decimales: number;
  ultimaActualizacion: string;
}

export interface Tasa {
  rastreo_bcv: boolean;
  id: string;
  nombre: string;
  simbolo: string;
  valor: number;
  ultimo_tipo_cambio: string | null;
  updated_at: string;
}

export interface SystemConfigResponse {
  message: string;
  config: SystemConfig;
}

export interface MonedaBaseRequest {
  monedaBase: string;
}

export interface MonedaBaseResponse {
  message: string;
  moneda_base: string;
}

export type NotificationEmailChannel = 'principal' | 'secundario';

export interface NotificationEmailSettings {
  habilitado: boolean;
  correoPrincipal: string;
  correoSecundario: string;
  correoSeleccionado: NotificationEmailChannel;
  ultimaActualizacion: string;
}

export interface NotificationEmailUpsertRequest {
  habilitado: boolean;
  correoPrincipal: string;
  correoSecundario: string;
  correoSeleccionado: NotificationEmailChannel;
}

export interface NotificationEmailGetResponse {
  message: string;
  correos: NotificationEmailSettings;
}

export interface NotificationEmailUpsertResponse {
  message: string;
  correos: NotificationEmailSettings;
}

export type PaymentMethodCurrency = 'VES' | 'USD' | 'EUR' | 'CRYPTO' | 'USDT' | 'BTC' | 'ETH' | 'MULTI';
export type PaymentMethodBankScope = 'national' | 'international';

export interface PaymentMethodBank {
  code: string;
  name: string;
  scope: PaymentMethodBankScope;
  active: boolean;
}

export interface PaymentMethodBankApiItem {
  codigo: string;
  nombre: string;
  scope: PaymentMethodBankScope;
  activo?: boolean;
}

export interface PaymentMethodAccount {
  id: string;
  bank: string;
  bankCode: string;
  ownerName: string;
  ownerId: string;
  phone: string;
  email?: string;
  walletAddress?: string;
  accountDescription: string;
}

export interface PaymentMethodConfig {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  currency: PaymentMethodCurrency;
  requiresReceiverAccount: boolean;
  isCustom: boolean;
  accounts: PaymentMethodAccount[];
}

export interface PaymentMethodsSettings {
  bankCatalog: PaymentMethodBank[];
  methods: PaymentMethodConfig[];
  ultimaActualizacion: string;
}

export interface PaymentMethodsUpsertRequest {
  bankCatalog: PaymentMethodBank[];
  methods: PaymentMethodConfig[];
}

export interface PaymentMethodsGetResponse {
  message: string;
  paymentMethods: PaymentMethodsSettings;
  persisted?: boolean;
}

export interface PaymentMethodsUpsertResponse {
  message: string;
  paymentMethods: PaymentMethodsSettings;
}

export interface PaymentMethodBanksCatalogResponse {
  message: string;
  bancos: PaymentMethodBankApiItem[];
}

export interface PaymentMethodBankBackendResponse {
  message: string;
  banco: PaymentMethodBankApiItem;
}

export interface PaymentMethodBankBackendUpdateRequest {
  nombre: string;
  scope: PaymentMethodBankScope;
  activo?: boolean;
}

export interface PaymentMethodsBackendGetResponse {
  message: string;
  metodos: PaymentMethodConfig[];
  ultimaActualizacion: string;
}

export interface PaymentMethodBackendResponse {
  message: string;
  metodo: PaymentMethodConfig;
  ultimaActualizacion: string;
}

export interface PaymentMethodBackendUpdateRequest {
  label: string;
  description: string;
  enabled: boolean;
  currency: PaymentMethodCurrency;
  requiresReceiverAccount: boolean;
  isCustom: boolean;
  accounts: PaymentMethodAccount[];
}
