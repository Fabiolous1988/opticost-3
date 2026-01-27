
import { GlobalVariables, TransportRate, ModelData, BallastData, DiscountTier, OrderedVariable } from '../types';

const MODELS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR9RtPO7RSU2bQMuQLxtF44P0IT0ccAp4NgMAmSx6u-xGBNtSb2GPrN9YbVdLA7XQ/pub?output=csv';
const VARIABLES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSk32mnQqJSHloRb9OtVSqjpMvcNrnN9c5INGTUXr6N3t0AwisjfftWyIT8m-YBgg/pub?output=csv';
const TRANSPORT_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTL-4djiL6_Z8-PmHgKeJ2QmEHtZdChrJXEBIni0FyQ8Nu3dkm_6j5haSd6SElMNw/pub?output=csv';

const parseFloatSafe = (val: string): number => {
  if (!val) return 0;
  let clean = val.toLowerCase().replace(/[€\skg%]/g, '').trim();
  if (clean.includes(',') && clean.includes('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const splitCsvLine = (line: string): string[] => {
  const separator = line.includes(';') ? ';' : ',';
  const regex = new RegExp(`(?:^|${separator})(\"(?:[^\"]+|\"\")*\"|[^${separator}]*)`, 'g');
  const matches = [];
  let match;
  while ((match = regex.exec(line)) !== null) {
      let val = match[1];
      if (val && val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1).replace(/""/g, '"');
      }
      matches.push(val ? val.trim() : '');
  }
  return matches;
};

export const fetchGlobalVariables = async (): Promise<GlobalVariables> => {
  try {
    const response = await fetch(`${VARIABLES_CSV_URL}&t=${Date.now()}`);
    const text = await response.text();
    const lines = text.split('\n');
    
    const vars: GlobalVariables = {
      soglia_distanza_trasferta_km: 150,
      diaria_squadra_interna: 50,
      soglia_minima_ore_lavoro_utili: 2,
      ore_lavoro_giornaliere_standard: 8,
      km_per_litro_furgone: 11,
      costo_medio_gasolio_euro_litro: 1.8,
      costo_usura_mezzo_euro_km: 0.037,
      costo_orario_tecnico_interno: 17.50,
      costo_orario_squadra_esterna: 26.5,
      diaria_squadra_esterna: 70,
      margine_percentuale_installazione: 25,
      costo_mezzo_sollevamento_base: 1000,
      costo_noleggio_muletto_base: 700,
      costo_noleggio_muletto_extra: 100,
      ore_led_per_posto_global: 0.5,
      hourly_discounts: [],
      ordered_vars: []
    };

    const discounts: DiscountTier[] = [];
    const ordered: OrderedVariable[] = [];

    lines.forEach(line => {
      const parts = splitCsvLine(line);
      if (parts.length < 2) return;
      
      const label = parts[0].trim();
      const val = parseFloatSafe(parts[1]);
      let internalKey: string | null = null;

      const lowerLabel = label.toLowerCase();

      // Mapping rigoroso dei valori necessari al motore di calcolo
      if (lowerLabel.includes('soglia trasferta')) {
        vars.soglia_distanza_trasferta_km = val;
        internalKey = 'soglia_distanza_trasferta_km';
      } else if (lowerLabel.includes('diaria giornaliera squadra interna')) {
        vars.diaria_squadra_interna = val;
        internalKey = 'diaria_squadra_interna';
      } else if (lowerLabel.includes('diaria giornaliera squadra esterna')) {
        vars.diaria_squadra_esterna = val;
        internalKey = 'diaria_squadra_esterna';
      } else if (lowerLabel.includes('soglia minima ore lavoro utili')) {
        vars.soglia_minima_ore_lavoro_utili = val;
        internalKey = 'soglia_minima_ore_lavoro_utili';
      } else if (lowerLabel.includes('costo gasolio')) {
        vars.costo_medio_gasolio_euro_litro = val;
        internalKey = 'costo_medio_gasolio_euro_litro';
      } else if (lowerLabel.includes('km per litro')) {
        vars.km_per_litro_furgone = val;
        internalKey = 'km_per_litro_furgone';
      } else if (lowerLabel.includes('usura mezzo')) {
        vars.costo_usura_mezzo_euro_km = val;
        internalKey = 'costo_usura_mezzo_euro_km';
      } else if (lowerLabel.includes('noleggio muletto base')) {
        vars.costo_noleggio_muletto_base = val;
        internalKey = 'costo_noleggio_muletto_base';
      } else if (lowerLabel.includes('noleggio muletto extra')) {
        vars.costo_noleggio_muletto_extra = val;
        internalKey = 'costo_noleggio_muletto_extra';
      } else if (lowerLabel.includes('ore lavoro giornaliere')) {
        vars.ore_lavoro_giornaliere_standard = val;
        internalKey = 'ore_lavoro_giornaliere_standard';
      } else if (lowerLabel.includes('margine installazione')) {
        vars.margine_percentuale_installazione = val;
        internalKey = 'margine_percentuale_installazione';
      } else if (lowerLabel.includes('paga oraria tecnico squadra interna')) {
        vars.costo_orario_tecnico_interno = val;
        internalKey = 'costo_orario_tecnico_interno';
      } else if (lowerLabel.includes('paga oraria tecnico squadra esterna')) {
        vars.costo_orario_squadra_esterna = val;
        internalKey = 'costo_orario_squadra_esterna';
      } else if (lowerLabel.includes('luci led')) {
        vars.ore_led_per_posto_global = val;
        internalKey = 'ore_led_per_posto_global';
      }

      // Se non è uno sconto, lo aggiungiamo alle variabili ordinate per il mirroring UI
      if (!lowerLabel.includes('sconto ore per >')) {
        ordered.push({ label, value: val, internalKey });
      } else {
        const match = label.match(/>(\d+)/);
        if (match) {
            discounts.push({ threshold: parseInt(match[1]), percentage: val });
        }
      }
    });

    vars.ordered_vars = ordered;
    vars.hourly_discounts = discounts.sort((a, b) => b.threshold - a.threshold);
    return vars;
  } catch (e) {
    console.error("Error fetching variables", e);
    return {
      soglia_distanza_trasferta_km: 150,
      diaria_squadra_interna: 50,
      soglia_minima_ore_lavoro_utili: 2,
      ore_lavoro_giornaliere_standard: 8,
      km_per_litro_furgone: 11,
      costo_medio_gasolio_euro_litro: 1.8,
      costo_usura_mezzo_euro_km: 0.037,
      costo_orario_tecnico_interno: 17.50,
      costo_orario_squadra_esterna: 26.5,
      diaria_squadra_esterna: 70,
      margine_percentuale_installazione: 25,
      costo_mezzo_sollevamento_base: 1000,
      costo_noleggio_muletto_base: 700,
      costo_noleggio_muletto_extra: 100,
      ore_led_per_posto_global: 0.5,
      hourly_discounts: [],
      ordered_vars: []
    };
  }
};

export const fetchTransportRates = async (): Promise<TransportRate[]> => {
  try {
    const response = await fetch(`${TRANSPORT_CSV_URL}&t=${Date.now()}`);
    const text = await response.text();
    const lines = text.split('\n');
    if (lines.length < 2) return [];

    const headerRow = splitCsvLine(lines[0]);
    const headers = headerRow.map(h => h.trim().toLowerCase());

    const idxRegione = headers.findIndex(h => h.includes('regione'));
    const idxProvincia = headers.findIndex(h => h.includes('provincia'));
    
    const priceIndices: number[] = [];
    headerRow.forEach((h, idx) => {
      if (idx !== idxRegione && idx !== idxProvincia && h.trim().length > 0) {
        priceIndices.push(idx);
      }
    });

    const rates: TransportRate[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const cols = splitCsvLine(line);
      const region = idxRegione >= 0 ? cols[idxRegione] : '';
      const province = idxProvincia >= 0 ? cols[idxProvincia] : '';
      if (!region && !province) continue;

      const prices: Record<string, number> = {};
      priceIndices.forEach(idx => {
        const headerName = headerRow[idx].trim();
        const val = parseFloatSafe(cols[idx]);
        if (val > 0) prices[headerName] = val;
      });
      rates.push({ regione: region.trim(), provincia: province.trim(), prices });
    }
    return rates;
  } catch (e) {
    console.error("Error fetching transport rates", e);
    return [];
  }
};

export const fetchModelsAndBallasts = async (): Promise<{ models: ModelData[], ballasts: BallastData[] }> => {
  try {
    const response = await fetch(`${MODELS_CSV_URL}&t=${Date.now()}`);
    const text = await response.text();
    const lines = text.split('\n');
    const models: ModelData[] = [];
    const ballasts: BallastData[] = [];
    if (lines.length < 2) return { models: [], ballasts: [] };

    const headerRow = splitCsvLine(lines[0]);
    const headers = headerRow.map(h => h.trim());

    const idxName = headers.findIndex(h => h === 'MODELLO' || h === 'STRUTTURA' || h.toUpperCase().includes('MODELLO'));
    const idxOreStruttura = headers.findIndex(h => h === 'ORE_INSTALLAZIONE_1PA');
    const idxOrePV = headers.findIndex(h => h === 'ORE_INSTALLAZIONE_1PA_PF');
    const idxOrePVGuarnizioni = headers.findIndex(h => h === 'ORE_INSTALLAZIONE_1PA_PF_GUARNIZIONI');
    const idxOreCoib = headers.findIndex(h => h === 'ORE_INSTALLAZIONE_PANNELLI_COIBENTATI');
    const idxOreTelo = headers.findIndex(h => h === 'ORE_INSTALLAZIONE_PANNELLI_TELO_TENSIONATO');
    const idxOreZavorre = headers.findIndex(h => h === 'ORE_INSTALLAZIONE_ZAVORRE');
    const idxOreLed = headers.findIndex(h => h === 'ORE_INSTALLAZIONE_1PA_LED');
    
    const idxKg = headers.findIndex(h => h === 'KG');
    const idxCapBilico = headers.findIndex(h => h === 'quante ce ne stanno in BILICO COMPLETO 13MT');
    const idxCapCamion = headers.findIndex(h => h === 'quante ce ne stanno in CAMION CON GRU');
    const idxCapFurgone = headers.findIndex(h => h === 'quante ce ne stanno in NOSTRO MEZZO');
    
    lines.slice(1).forEach(line => {
      if (!line.trim()) return;
      const cols = splitCsvLine(line);
      const name = idxName >= 0 ? cols[idxName]?.trim() : '';
      if (!name) return;

      if (name.toLowerCase().includes('zavorra')) {
        ballasts.push({ nome: name, peso_kg: idxKg >= 0 ? parseFloatSafe(cols[idxKg]) : 60 });
      } else {
        models.push({
          nome: name,
          peso_struttura_per_posto: idxKg >= 0 ? parseFloatSafe(cols[idxKg]) : 0,
          ore_struttura_per_posto: idxOreStruttura >= 0 ? parseFloatSafe(cols[idxOreStruttura]) : 0,
          ore_pv_per_posto: idxOrePV >= 0 ? parseFloatSafe(cols[idxOrePV]) : 0,
          ore_pv_guarnizioni_per_posto: idxOrePVGuarnizioni >= 0 ? parseFloatSafe(cols[idxOrePVGuarnizioni]) : 0,
          ore_telo_per_posto: idxOreTelo >= 0 ? parseFloatSafe(cols[idxOreTelo]) : 0,
          ore_led_per_posto: idxOreLed >= 0 ? parseFloatSafe(cols[idxOreLed]) : 0,
          ore_coibentati_per_posto: idxOreCoib >= 0 ? parseFloatSafe(cols[idxOreCoib]) : 0,
          ore_zavorre_per_posto: idxOreZavorre >= 0 ? parseFloatSafe(cols[idxOreZavorre]) : 0,
          max_pa_bilico: idxCapBilico >= 0 ? parseFloatSafe(cols[idxCapBilico]) || 40 : 40,
          max_pa_camion_gru: idxCapCamion >= 0 ? parseFloatSafe(cols[idxCapCamion]) || 12 : 12,
          max_pa_furgone: idxCapFurgone >= 0 ? parseFloatSafe(cols[idxCapFurgone]) || 3 : 3
        });
      }
    });
    return { models, ballasts };
  } catch (e) {
    console.error("Error fetching models and ballasts", e);
    return { models: [], ballasts: [] };
  }
};
