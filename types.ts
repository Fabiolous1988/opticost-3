
export interface DiscountTier {
  threshold: number;
  percentage: number;
}

export interface OrderedVariable {
  label: string;
  value: number;
  internalKey: string | null;
}

export interface GlobalVariables {
  // Valori per calcoli interni
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
  costo_mezzo_sollevamento_base: number;
  costo_noleggio_muletto_base: number;
  costo_noleggio_muletto_extra: number;
  ore_led_per_posto_global: number;
  hourly_discounts: DiscountTier[];
  
  // Mirroring esatto per UI
  ordered_vars: OrderedVariable[];
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
  ore_pv_guarnizioni_per_posto: number;
  ore_telo_per_posto: number;
  ore_led_per_posto: number;
  ore_coibentati_per_posto: number;
  ore_zavorre_per_posto: number;
  max_pa_furgone: number;
  max_pa_camion_gru: number;
  max_pa_bilico: number;
}

export interface BallastData {
  nome: string;
  peso_kg: number;
}

export enum ServiceType {
  INSTALLAZIONE_COMPLETA = 'INSTALLAZIONE_COMPLETA',
  ASSISTENZA = 'ASSISTENZA',
}

export interface LastMileOption {
  type: string;
  price: number;
  durationMinutes: number;
  details: string;
  sourceUrl?: string;
}

export interface LogisticsData {
  distanceKm: number;
  driveDurationMinutes: number;
  avgHotelPrice: number;
  hotelSource?: string;
  trainPrice: number;
  trainSource?: string;
  trainDurationMinutes: number;
  departureStation?: string;
  arrivalStation?: string;
  trainDepartureTime?: string; 
  planePrice: number;
  planeSource?: string;
  planeDurationMinutes: number;
  departureAirport?: string;
  arrivalAirport?: string;
  planeDepartureTime?: string; 
  lastMilePrice: number; // Costo dell'opzione selezionata
  lastMileDurationMinutes: number;
  lastMileDetails?: string; 
  lastMileOptions: LastMileOption[];
  ferryCostVan: number;
  ferryCostTruck: number;
  ferrySource?: string;
  isIsland: boolean;
  recommendedMode: 'train' | 'plane' | 'none';
  fetched: boolean;
}

export interface CustomExtraCost {
  id: string;
  label: string;
  value: number;
}

export interface QuoteInputs {
  serviceType: ServiceType;
  startDate: string;
  indirizzoCompleto: string;
  logistics: LogisticsData;
  selectedLastMileIndex: number;
  extraCosts: CustomExtraCost[];
  modello: string;
  postiAuto: number;
  useInternalTechs: boolean;
  numInternalTechs: number;
  useExternalTechs: boolean;
  numExternalTechs: number;
  externalIsLocal: boolean; 
  assistenzaGiorni: number;
  assistenzaTecniciCount: number;
  manualInternalWorkDays: number | null; 
  optInstallazioneTelo: boolean;
  optPannelliFotovoltaici: boolean;
  optGuarnizioni: boolean;
  optIlluminazioneLED: boolean;
  optPannelliCoibentati: boolean;
  clientHasForklift: boolean; 
  usePublicTransport: boolean;
  publicTransportMode: 'train' | 'plane'; 
  optZavorre: boolean;
  tipoZavorraNome: string;
  extraDaysCamionGru: number;
}

export interface DetailedCostBreakdown {
  label: string;
  value: number;
  details?: string;
  formula?: string;
  isBold?: boolean;
  tooltip?: string;
}

export interface CalculationResult {
  totalCost: number;
  sellPrice: number;
  totalEquipmentRental: number;    
  totalTransportAndTravel: number; 
  totalManpower: number;           
  installationTotal: number;
  transportTotal: number;
  equipmentTotal: number;
  extraCostsTotal: number;
  transportMethod: string;
  structureWeight: number;
  totalWeight: number;
  totalHours: number;
  totalDays: number;
  workDays: number;
  workSchedule: string[];
  internalTeamCosts: DetailedCostBreakdown[];
  externalTeamCosts: DetailedCostBreakdown[];
  generalLogisticsCosts: DetailedCostBreakdown[];
  numZavorre: number;
  weightZavorre: number;
  discountAppliedPerc: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
