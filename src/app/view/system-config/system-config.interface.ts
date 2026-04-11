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