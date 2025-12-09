import { GlobalVariables, TransportRate, ModelData, BallastData, DiscountTier } from '../types';

const MODELS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR9RtPO7RSU2bQMuQLxtF44P0IT0ccAp4NgMAmSx6u-xGBNtSb2GPrN9YbVdLA7XQ/pub?output=csv';
const VARIABLES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSk32mnQqJSHloRb9OtVSqjpMvcNrnN9c5INGTUXr6N3t0AwisjfftWyIT8m-YBgg/pub?output=csv';
const TRANSPORT_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTL-4djiL6_Z8-PmHgKeJ2QmEHtZdChrJXEBIni0FyQ8Nu3dkm_6j5haSd6SElMNw/pub?output=csv';

const parseFloatSafe = (val: string): number => {
  if (!val) return 0;
  // Handle European format 1.234,56 or standard 1234.56
  let clean = val.toLowerCase().replace(/[€\skg%]/g, '').trim();
  
  // If comma exists and dot exists, assume dot is thousands separator (European) -> remove dot, replace comma with dot
  if (clean.includes(',') && clean.includes('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
      // If only comma, replace with dot
      clean = clean.replace(',', '.');
  }
  
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const splitCsvLine = (line: string): string[] => {
  // Simple heuristic for semicolon vs comma
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
  // Handle empty trailing
  if (matches.length === 0 && line.length > 0) return line.split(separator);
  return matches;
};

export const fetchGlobalVariables = async (): Promise<GlobalVariables> => {
  try {
    const response = await fetch(VARIABLES_CSV_URL);
    const text = await response.text();
    const lines = text.split('\n');
    
    const vars: GlobalVariables = {
      soglia_distanza_trasferta_km: 150,
      diaria_squadra_interna: 50,
      soglia_minima_ore_lavoro_utili: 2,
      ore_lavoro_giornaliere_standard: 8, // Fixed to 8 as requested
      km_per_litro_furgone: 11,
      costo_medio_gasolio_euro_litro: 1.8,
      costo_usura_mezzo_euro_km: 0.037,
      costo_orario_tecnico_interno: 25,
      costo_orario_squadra_esterna: 26.5,
      diaria_squadra_esterna: 70,
      margine_percentuale_installazione: 25,
      costo_mezzo_sollevamento_base: 1000,
      costo_noleggio_muletto_base: 700,
      costo_noleggio_muletto_extra: 120,
      hourly_discounts: []
    };

    const discounts: DiscountTier[] = [];

    lines.forEach(line => {
      const parts = splitCsvLine(line);
      if (parts.length < 2) return;
      const key = parts[0].trim().toLowerCase();
      const valueStr = parts[1]; 
      const numVal = parseFloatSafe(valueStr);

      if (key.includes('distanza_trasferta')) vars.soglia_distanza_trasferta_km = numVal;
      if (key.includes('diaria_interna')) vars.diaria_squadra_interna = numVal;
      // if (key.includes('ore_standard')) vars.ore_lavoro_giornaliere_standard = numVal; // Forced to 8
      if (key.includes('km_litro')) vars.km_per_litro_furgone = numVal;
      if (key.includes('costo_gasolio')) vars.costo_medio_gasolio_euro_litro = numVal;
      if (key.includes('usura')) vars.costo_usura_mezzo_euro_km = numVal;
      if (key.includes('orario_esterna')) vars.costo_orario_squadra_esterna = numVal;
      if (key.includes('diaria_esterna')) vars.diaria_squadra_esterna = numVal;
      if (key.includes('margine')) vars.margine_percentuale_installazione = numVal;
      
      // Discount Parsing (e.g. "sconto ore per >150 posti auto (%)")
      if (key.includes('sconto ore') && key.includes('posti')) {
         const match = key.match(/>\s*(\d+)/);
         if (match) {
           discounts.push({
             threshold: parseInt(match[1]),
             percentage: numVal
           });
         }
      }
    });

    // Sort discounts descending by threshold (highest threshold checked first)
    vars.hourly_discounts = discounts.sort((a, b) => b.threshold - a.threshold);

    return vars;
  } catch (e) {
    console.error("Error fetching variables", e);
    // Fallback
    return {
      soglia_distanza_trasferta_km: 150,
      diaria_squadra_interna: 50,
      soglia_minima_ore_lavoro_utili: 2,
      ore_lavoro_giornaliere_standard: 8,
      km_per_litro_furgone: 11,
      costo_medio_gasolio_euro_litro: 1.85,
      costo_usura_mezzo_euro_km: 0.037,
      costo_orario_tecnico_interno: 30,
      costo_orario_squadra_esterna: 26.5,
      diaria_squadra_esterna: 70,
      margine_percentuale_installazione: 25,
      costo_mezzo_sollevamento_base: 1000,
      costo_noleggio_muletto_base: 700,
      costo_noleggio_muletto_extra: 120,
      hourly_discounts: []
    };
  }
};

export const fetchTransportRates = async (): Promise<TransportRate[]> => {
  try {
    const response = await fetch(TRANSPORT_CSV_URL);
    const text = await response.text();
    const lines = text.split('\n');
    
    if (lines.length < 2) return [];

    const headerRow = splitCsvLine(lines[0]);
    const headers = headerRow.map(h => h.trim());

    const idxRegione = headers.findIndex(h => h.toLowerCase().includes('regione'));
    const idxProvincia = headers.findIndex(h => h.toLowerCase().includes('provincia'));

    const priceIndices: number[] = [];
    headers.forEach((h, idx) => {
      if (idx !== idxRegione && idx !== idxProvincia && h.length > 0) {
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
        // Store keys as lowercase for consistent lookup
        const headerName = headers[idx].trim();
        const valStr = cols[idx];
        const val = parseFloatSafe(valStr);
        if (val > 0) {
          prices[headerName] = val;
        }
      });

      rates.push({
        regione: region.trim(),
        provincia: province.trim(),
        prices: prices
      });
    }

    return rates;

  } catch (e) {
    console.error("Error fetching transport", e);
    return [];
  }
};

export const fetchModelsAndBallasts = async (): Promise<{ models: ModelData[], ballasts: BallastData[] }> => {
  try {
    const response = await fetch(MODELS_CSV_URL);
    const text = await response.text();
    const lines = text.split('\n');
    
    const models: ModelData[] = [];
    const ballasts: BallastData[] = [];

    if (lines.length < 2) return { models: [], ballasts: [] };

    const headerRow = splitCsvLine(lines[0]);
    const headers = headerRow.map(h => h.trim().toUpperCase());
    
    // Strict column mapping as per user instruction
    const idxName = headers.findIndex(h => h === 'MODELLO_STRUTTURA');
    const idxOreStruttura = headers.findIndex(h => h === 'ORE_INSTALLAZIONE_1PA');
    const idxOrePV = headers.findIndex(h => h === 'ORE_INSTALLAZIONE_1PA_PF');
    const idxOreGuarnizioni = headers.findIndex(h => h === 'ORE_INSTALLAZIONE_1PA_PF_GUARNIZIONI'); 
    const idxOreCoib = headers.findIndex(h => h === 'ORE_INSTALLAZIONE_PANNELLI_COIBENTATI');
    const idxOreTelo = headers.findIndex(h => h === 'ORE_INSTALLAZIONE_PANNELLI_TELO_TENSIONATO');
    const idxOreLed = headers.findIndex(h => h.includes('LED') || h.includes('ILLUMINAZIONE')); 

    const idxKg = headers.findIndex(h => h === 'KG');
    
    const dataLines = lines.slice(1);

    dataLines.forEach(line => {
      if (!line.trim()) return;
      const cols = splitCsvLine(line);
      if (cols.length < 1) return;
      
      const getName = () => idxName >= 0 ? cols[idxName] : cols[0];
      const name = getName()?.trim();
      if (!name) return;

      if (name.toLowerCase().includes('zavorra')) {
        let weight = 0;
        if (idxKg >= 0) {
          weight = parseFloatSafe(cols[idxKg]);
        }
        
        // Fallback for Zavorra weight if missing in CSV
        if (weight === 0) {
           const match = name.match(/(\d+)/);
           if (match) {
             const val = parseInt(match[0]);
             if (val > 10) weight = val; 
           }
        }
        
        ballasts.push({
          nome: name,
          peso_kg: weight
        });
      } else {
        let peso = 0;
        let oreStr = 0;
        let orePv = 0;
        let oreTelo = 0;
        let oreLed = 0;
        let oreCoib = 0;

        if (idxKg >= 0) peso = parseFloatSafe(cols[idxKg]);
        if (idxOreStruttura >= 0) oreStr = parseFloatSafe(cols[idxOreStruttura]);
        if (idxOrePV >= 0) orePv = parseFloatSafe(cols[idxOrePV]);
        if (idxOreTelo >= 0) oreTelo = parseFloatSafe(cols[idxOreTelo]);
        if (idxOreCoib >= 0) oreCoib = parseFloatSafe(cols[idxOreCoib]);
        if (idxOreLed >= 0) oreLed = parseFloatSafe(cols[idxOreLed]);

        // Default manual values if columns are missing/zero to avoid 0 cost
        if (oreTelo === 0) oreTelo = 1.0;
        if (oreLed === 0) oreLed = 0.5;

        models.push({
          nome: name,
          peso_struttura_per_posto: peso,
          ore_struttura_per_posto: oreStr,
          ore_pv_per_posto: orePv,
          ore_telo_per_posto: oreTelo,
          ore_led_per_posto: oreLed,
          ore_coibentati_per_posto: oreCoib
        });
      }
    });

    if (ballasts.length === 0) {
      ballasts.push({ nome: 'Zavorra Standard', peso_kg: 60 });
    }

    return { models, ballasts };
  } catch (e) {
    console.error("Error fetching models", e);
    return { models: [], ballasts: [] };
  }
};