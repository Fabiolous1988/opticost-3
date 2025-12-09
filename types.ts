import { Type } from "@google/genai";

export interface DiscountTier {
  threshold: number; // e.g. 150
  percentage: number; // e.g. 8.5
}

export interface GlobalVariables {
  soglia_distanza_trasferta_km: number;
  diaria_squadra_interna: number;
  soglia_minima_ore_lavoro_utili: number;
  ore_lavoro_giornaliere_standard: number;
  km_per_litro_furgone: number;
  costo_medio_gasolio_euro_litro: number;
  costo_usura_mezzo_euro_km: number;
  costo_orario_tecnico_interno: number;
  costo_orario_squadra_esterna: number;
  diaria_squadra_esterna: number;
  margine_percentuale_installazione: number;
  costo_mezzo_sollevamento_base: number; // Legacy
  costo_noleggio_muletto_base: number; // 700
  costo_noleggio_muletto_extra: number; // 120
  hourly_discounts: DiscountTier[];
}

export interface TransportRate {
  provincia: string;
  regione: string;
  prices: Record<string, number>; 
}

export interface ModelData {
  nome: string;
  peso_struttura_per_posto: number;
  ore_struttura_per_posto: number;
  ore_pv_per_posto: number; 
  ore_telo_per_posto: number;
  ore_led_per_posto: number;
  ore_coibentati_per_posto: number;
}

export interface BallastData {
  nome: string;
  peso_kg: number;
}

export enum ServiceType {
  INSTALLAZIONE_COMPLETA = 'INSTALLAZIONE_COMPLETA',
  ASSISTENZA = 'ASSISTENZA',
}

export interface LogisticsData {
  distanceKm: number;
  durationMinutes: number;
  avgHotelPrice: number;
  
  // Public Transport Details (Round Trip)
  trainPrice: number;
  planePrice: number;
  lastMilePrice: number;
  recommendedMode: 'train' | 'plane' | 'none';

  fetched: boolean;
}

export interface QuoteInputs {
  serviceType: ServiceType;
  
  // Date
  startDate: string;

  // Location
  indirizzoCompleto: string;
  logistics: LogisticsData;

  // Model & Config
  modello: string;
  postiAuto: number;
  
  // Techs
  useInternalTechs: boolean;
  numInternalTechs: number;
  useExternalTechs: boolean;
  numExternalTechs: number;

  // Assistenza specific
  assistenzaGiorni: number;
  assistenzaTecniciCount: number;

  // Options
  optInstallazioneTelo: boolean;
  optPannelliFotovoltaici: boolean;
  optIlluminazioneLED: boolean;
  optPannelliCoibentati: boolean;
  
  // Logistics Options
  clientHasForklift: boolean; // "Disponibilità Muletto"
  usePublicTransport: boolean; // "Mezzi Pubblici"
  
  // Ballasts
  optZavorre: boolean;
  tipoZavorraNome: string;
}

export interface DetailedCostBreakdown {
  label: string;
  value: number;
  details?: string;
  isBold?: boolean;
}

export interface CalculationResult {
  totalCost: number;
  sellPrice: number;
  installationCost: number;
  transportCost: number;
  transportMethod: string;
  totalWeight: number;
  totalHours: number;
  totalDays: number;
  travelCost: number;
  perDiemCost: number;
  laborCost: number;
  equipmentCost: number;
  numZavorre: number;
  weightZavorre: number;
  discountAppliedPerc: number;
  
  // Detailed breakdown for report
  breakdown: DetailedCostBreakdown[];
}