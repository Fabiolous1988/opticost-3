import { QuoteInputs, GlobalVariables, TransportRate, ServiceType, CalculationResult, ModelData, BallastData, DetailedCostBreakdown } from '../types';

export const calculateQuote = (
  inputs: QuoteInputs,
  vars: GlobalVariables,
  transportRates: TransportRate[],
  modelData: ModelData,
  selectedBallast: BallastData | undefined
): CalculationResult => {
  
  let totalCost = 0;
  let installationCost = 0;
  let transportCost = 0;
  let laborCost = 0;
  let travelCost = 0;
  let perDiemCost = 0;
  let equipmentCost = 0;
  let discountAppliedPerc = 0;

  const breakdown: DetailedCostBreakdown[] = [];

  // Use AI extracted distance if available
  const distanceKm = inputs.logistics.fetched ? inputs.logistics.distanceKm : 0;
  const hotelCostPerNight = (inputs.logistics.fetched && inputs.logistics.avgHotelPrice > 0) 
    ? inputs.logistics.avgHotelPrice 
    : 120;

  // --- Helper for Public Transport Cost ---
  const getPublicTransportCost = (numPeople: number): number => {
      if (!inputs.logistics.fetched) return 0;
      
      const trainTotal = inputs.logistics.trainPrice + inputs.logistics.lastMilePrice;
      const planeTotal = inputs.logistics.planePrice + inputs.logistics.lastMilePrice;
      
      // Use the cheaper viable option
      let costPerPerson = 0;
      if (inputs.logistics.planePrice > 0 && planeTotal < trainTotal) {
          costPerPerson = planeTotal;
      } else {
          costPerPerson = trainTotal;
      }
      
      // If AI returned 0 for both (failed), use a fallback estimate based on distance
      if (costPerPerson === 0 && distanceKm > 0) {
          costPerPerson = distanceKm * 0.25; // Crude estimate A/R
      }

      return costPerPerson * numPeople;
  };

  // --- 1. Service: ASSISTENZA ---
  if (inputs.serviceType === ServiceType.ASSISTENZA) {
    const numTechs = inputs.assistenzaTecniciCount;
    const hoursPerDay = vars.ore_lavoro_giornaliere_standard; 
    const totalHours = inputs.assistenzaGiorni * hoursPerDay * numTechs;
    
    laborCost = totalHours * vars.costo_orario_tecnico_interno;
    breakdown.push({ label: 'Manodopera Assistenza', value: laborCost, details: `${totalHours}h x €${vars.costo_orario_tecnico_interno}` });

    // Travel
    if (inputs.usePublicTransport && inputs.logistics.fetched) {
       const ticketCost = getPublicTransportCost(numTechs);
       breakdown.push({ label: 'Biglietti Mezzi Pubblici', value: ticketCost, details: `Per ${numTechs} tecnici` });
       
       // Hotel Logic
       let hotelTotal = 0;
       if (distanceKm > vars.soglia_distanza_trasferta_km || inputs.assistenzaGiorni > 1) {
           const actualNights = Math.max(0, inputs.assistenzaGiorni - 1);
           hotelTotal = actualNights * numTechs * hotelCostPerNight;
           if (hotelTotal > 0) breakdown.push({ label: 'Hotel & Alloggio', value: hotelTotal, details: `${actualNights} notti x ${numTechs} pers.` });
       }
       
       // Diaria for public transport travel
       const diaria = numTechs * vars.diaria_squadra_interna * inputs.assistenzaGiorni;
       perDiemCost = diaria;
       breakdown.push({ label: 'Diarie Tecnici', value: perDiemCost });
       
       travelCost = ticketCost + hotelTotal + perDiemCost;
    } else {
        // Company Vehicle (Furgone) Logic - STRICTLY MATCHING Installazione Completa
        const tripDistance = distanceKm * 2; // A/R
        let totalKm = tripDistance;
        const isTrasferta = distanceKm > vars.soglia_distanza_trasferta_km;

        if (isTrasferta) {
             totalKm += (inputs.assistenzaGiorni * 30); // Commute hotel-site
             if (inputs.assistenzaGiorni > 5) {
                 const weeks = Math.floor(inputs.assistenzaGiorni / 5);
                 totalKm += (weeks * tripDistance); // Weekly return
             }
        } else {
             totalKm = tripDistance * inputs.assistenzaGiorni; // Daily commute from HQ if close
        }

        const fuelCost = (totalKm / vars.km_per_litro_furgone) * vars.costo_medio_gasolio_euro_litro;
        const wearCost = totalKm * vars.costo_usura_mezzo_euro_km;
        const tollsCost = totalKm * 0.12; // Estimate highway tolls

        breakdown.push({ label: 'Carburante Furgone', value: fuelCost, details: `${totalKm.toFixed(0)} km stima` });
        breakdown.push({ label: 'Usura & Pedaggi', value: wearCost + tollsCost });

        const vehicleCost = fuelCost + wearCost + tollsCost;
        let travelExpenses = 0;

        if (isTrasferta) {
             // Diaria
             const diaria = numTechs * vars.diaria_squadra_interna * inputs.assistenzaGiorni;
             breakdown.push({ label: 'Diarie Tecnici', value: diaria });
             perDiemCost = diaria;

             // Hotel
             const nights = Math.max(0, inputs.assistenzaGiorni - 1);
             const hotelC = nights * numTechs * hotelCostPerNight;
             if (hotelC > 0) breakdown.push({ label: 'Hotel & Alloggio', value: hotelC });
             
             travelExpenses = perDiemCost + hotelC;
        }

        travelCost = vehicleCost + travelExpenses;
    }

    installationCost = laborCost + travelCost; 
    totalCost = installationCost;
    
    return {
      totalCost,
      sellPrice: totalCost * ((100 + vars.margine_percentuale_installazione) / 100),
      installationCost: laborCost,
      transportCost: travelCost, 
      transportMethod: inputs.usePublicTransport ? 'Mezzi Pubblici' : 'Mezzo Aziendale (Furgone)',
      totalWeight: 0,
      totalHours,
      totalDays: inputs.assistenzaGiorni,
      travelCost,
      perDiemCost,
      laborCost,
      equipmentCost: 0,
      numZavorre: 0,
      weightZavorre: 0,
      discountAppliedPerc: 0,
      breakdown
    };
  }

  // --- 2. Service: INSTALLAZIONE COMPLETA ---

  // A. Work Hours
  let baseHoursPerSpot = modelData.ore_struttura_per_posto;
  if (inputs.optPannelliFotovoltaici) baseHoursPerSpot += modelData.ore_pv_per_posto;
  if (inputs.optIlluminazioneLED) baseHoursPerSpot += modelData.ore_led_per_posto;
  if (inputs.optInstallazioneTelo) baseHoursPerSpot += modelData.ore_telo_per_posto;
  if (inputs.optPannelliCoibentati) baseHoursPerSpot += modelData.ore_coibentati_per_posto;
  
  let totalHours = baseHoursPerSpot * inputs.postiAuto;

  // B. Discounts
  const discount = vars.hourly_discounts.find(d => inputs.postiAuto > d.threshold);
  if (discount) {
      discountAppliedPerc = discount.percentage;
      const discountFactor = (100 - discount.percentage) / 100;
      totalHours = totalHours * discountFactor;
  }

  // C. Team & Days
  const internalTechs = inputs.useInternalTechs ? inputs.numInternalTechs : 0;
  const externalTechs = inputs.useExternalTechs ? inputs.numExternalTechs : 0;
  const totalTechs = internalTechs + externalTechs;

  const dailyHoursAvailable = vars.ore_lavoro_giornaliere_standard * totalTechs;
  const daysRequired = totalTechs > 0 ? Math.ceil(totalHours / dailyHoursAvailable) : 0;

  // D. Labor Cost
  const internalLabor = totalTechs > 0 ? (totalHours * (internalTechs/totalTechs)) * vars.costo_orario_tecnico_interno : 0;
  const externalLabor = totalTechs > 0 ? (totalHours * (externalTechs/totalTechs)) * vars.costo_orario_squadra_esterna : 0;
  laborCost = internalLabor + externalLabor;

  breakdown.push({ label: 'Manodopera Totale', value: laborCost, details: `${totalHours.toFixed(1)} ore totali (${daysRequired} gg)`, isBold: true });

  // E. Logistics / Travel Costs (Technicians)
  const isTrasferta = distanceKm > vars.soglia_distanza_trasferta_km;
  const totalTechsCount = internalTechs + externalTechs;

  if (inputs.usePublicTransport && inputs.logistics.fetched) {
      // Public Transport
      const ticketCostTotal = getPublicTransportCost(totalTechsCount);
      breakdown.push({ label: 'Biglietti Mezzi Pubblici', value: ticketCostTotal, details: 'Treno/Aereo A/R' });

      const nights = Math.max(0, daysRequired - 1); 
      const hotelCostTotal = nights * totalTechsCount * hotelCostPerNight;
      if (hotelCostTotal > 0) breakdown.push({ label: 'Hotel Squadra', value: hotelCostTotal, details: `${nights} notti` });
      
      const internalDiaria = internalTechs * vars.diaria_squadra_interna * daysRequired;
      const externalDiaria = externalTechs * vars.diaria_squadra_esterna * daysRequired;
      perDiemCost = internalDiaria + externalDiaria;
      breakdown.push({ label: 'Diarie Tecnici', value: perDiemCost });

      travelCost = ticketCostTotal + hotelCostTotal + perDiemCost;
  } else {
      // Company Vehicle (Furgone Tecnico)
      const tripDistance = distanceKm * 2;
      let totalKm = tripDistance;
      
      // Additional KM for daily commute or weekly return if long job
      if (isTrasferta) {
        totalKm += (daysRequired * 30); // Commute hotel-site
        if (daysRequired > 5) {
           const weeks = Math.floor(daysRequired / 5);
           totalKm += (weeks * tripDistance); // Weekly return
        }
      } else {
        totalKm = tripDistance * daysRequired; // Daily commute from HQ if close
      }

      const fuelCost = (totalKm / vars.km_per_litro_furgone * vars.costo_medio_gasolio_euro_litro);
      const wearCost = (totalKm * vars.costo_usura_mezzo_euro_km);
      const tollsCost = totalKm * 0.12; // Estimate highway tolls

      breakdown.push({ label: 'Carburante Furgone Tecnici', value: fuelCost, details: `${totalKm.toFixed(0)} km stima` });
      breakdown.push({ label: 'Usura & Pedaggi', value: wearCost + tollsCost });

      const vehicleCost = fuelCost + wearCost + tollsCost;
      
      if (isTrasferta) {
        const internalDiaria = internalTechs * vars.diaria_squadra_interna * daysRequired;
        const externalDiaria = externalTechs * vars.diaria_squadra_esterna * daysRequired;
        perDiemCost = internalDiaria + externalDiaria;
        breakdown.push({ label: 'Diarie Tecnici', value: perDiemCost });
        
        // Hotel Costs
        const nights = Math.max(0, daysRequired - 1);
        const hotelCostTotal = nights * totalTechsCount * hotelCostPerNight;
        if(hotelCostTotal > 0) breakdown.push({ label: 'Hotel Squadra', value: hotelCostTotal });

        travelCost = vehicleCost + perDiemCost + hotelCostTotal;
      } else {
        travelCost = vehicleCost;
      }
  }

  // F. Equipment (Forklift)
  if (!inputs.clientHasForklift) {
    equipmentCost = vars.costo_noleggio_muletto_base;
    if (daysRequired > 5) {
      const extraDays = daysRequired - 5;
      equipmentCost += extraDays * vars.costo_noleggio_muletto_extra;
    }
    breakdown.push({ label: 'Noleggio Muletto', value: equipmentCost, details: 'Non presente in cantiere' });
  }

  installationCost = laborCost + travelCost + equipmentCost;

  // G. Transport & Weight Logic (Material Transport)
  // Strict hierarchy: Furgone -> Gru -> Bilico

  let numZavorre = 0;
  let weightZavorre = 0;
  
  if (inputs.optZavorre && inputs.postiAuto > 0 && selectedBallast) {
    numZavorre = 1 + Math.ceil(inputs.postiAuto / 2);
    const bWeight = selectedBallast.peso_kg || 0;
    weightZavorre = numZavorre * bWeight;
  }

  const structureWeight = modelData.peso_struttura_per_posto * inputs.postiAuto;
  const totalWeight = structureWeight + weightZavorre;

  // Find Rate for Province
  const cleanDest = inputs.indirizzoCompleto.trim().toLowerCase(); 
  const rate = transportRates.find(r => 
    cleanDest.includes(r.provincia.toLowerCase()) || 
    cleanDest.includes(r.regione.toLowerCase())
  );
  const prices = rate?.prices || {};

  const LIMIT_BILICO = 24000;
  const LIMIT_GRU = 16000;
  const LIMIT_FURGONE = 1000;

  let transportMethod = 'Non Definito';
  let shippingCost = 0;

  const findPrice = (keyword: string, spots: number): number => {
      // 1. Look for specific spots key (e.g. "Bilico 1-10")
      const keys = Object.keys(prices);
      const vehicleKeys = keys.filter(k => k.toLowerCase().includes(keyword.toLowerCase()));
      
      for (const key of vehicleKeys) {
        const lower = key.toLowerCase();
        // Range 1-10
        const range = lower.match(/(\d+)\s*-\s*(\d+)/);
        if (range) {
            const min = parseInt(range[1]);
            const max = parseInt(range[2]);
            if (spots >= min && spots <= max) return prices[key];
        }
        // Gt > 15
        const gt = lower.match(/>\s*(\d+)/);
        if (gt) {
            const min = parseInt(gt[1]);
            if (spots > min) return prices[key];
        }
      }
      
      // 2. Fallback to generic key (e.g. just "Camion Gru")
      const generic = vehicleKeys.find(k => !/\d/.test(k));
      if (generic) return prices[generic];
      
      // 3. Fallback to first available
      if (vehicleKeys.length > 0) return prices[vehicleKeys[0]];
      
      return 0;
  };

  // LOGIC
  // 1. Furgone
  if (totalWeight < LIMIT_FURGONE && !inputs.optZavorre && inputs.postiAuto <= 3) {
      transportMethod = 'Furgone Aziendale (Nostro Mezzo)';
      // Cost calculation for Company Van delivering material
      const dist = distanceKm * 2; 
      const fuel = (dist / vars.km_per_litro_furgone) * vars.costo_medio_gasolio_euro_litro;
      const wear = dist * vars.costo_usura_mezzo_euro_km;
      const tolls = dist * 0.12;
      const driverLogistics = isTrasferta ? (vars.diaria_squadra_interna + hotelCostPerNight) : 0;
      
      shippingCost = fuel + wear + tolls + driverLogistics;
      breakdown.push({ label: 'Trasporto Materiale (Furgone)', value: shippingCost, details: 'Carburante + Autista', isBold: true });
  }
  // 2. Camion con Gru (Priority if fits)
  else if (totalWeight <= LIMIT_GRU) {
      let baseCost = findPrice('gru', inputs.postiAuto);
      // Fallback if price missing but logic says Gru
      if (baseCost === 0) baseCost = 1300; 

      transportMethod = 'Camion con Gru (Autoscarico)';
      
      let driverExtra = 0;
      if (isTrasferta) {
          // Driver Hotel + Diaria (1 person)
          driverExtra = hotelCostPerNight + 50; // Est. Diaria driver
      }

      shippingCost = baseCost + driverExtra;
      breakdown.push({ label: 'Nolo Camion Gru', value: baseCost });
      if (driverExtra > 0) breakdown.push({ label: 'Logistica Autista Gru', value: driverExtra, details: 'Hotel + Diaria' });
  }
  // 3. Bilico (Default)
  else {
      let baseCost = findPrice('bilico', inputs.postiAuto);
      if (baseCost === 0) baseCost = 1600; // Fallback

      // If heavy, multiple trucks?
      const numTrucks = Math.ceil(totalWeight / LIMIT_BILICO);
      transportMethod = numTrucks > 1 ? `Bilico Standard x${numTrucks}` : 'Bilico Standard';
      
      shippingCost = baseCost * numTrucks;
      breakdown.push({ label: `Trasporto ${transportMethod}`, value: shippingCost, isBold: true });
  }

  transportCost = shippingCost;
  totalCost = installationCost + transportCost;
  const marginMultiplier = (100 + vars.margine_percentuale_installazione) / 100;

  return {
    totalCost,
    sellPrice: totalCost * marginMultiplier,
    installationCost,
    transportCost,
    transportMethod,
    totalWeight,
    totalHours,
    totalDays: daysRequired,
    travelCost,
    perDiemCost,
    laborCost,
    equipmentCost,
    numZavorre,
    weightZavorre,
    discountAppliedPerc,
    breakdown
  };
};