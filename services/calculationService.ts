import { QuoteInputs, GlobalVariables, TransportRate, ServiceType, CalculationResult, ModelData, BallastData, DetailedCostBreakdown } from '../types';

export const calculateQuote = (
  inputs: QuoteInputs,
  vars: GlobalVariables,
  transportRates: TransportRate[],
  modelData: ModelData,
  selectedBallast: BallastData | undefined
): CalculationResult => {
  
  // Buckets for structured breakdown
  const internalCosts: DetailedCostBreakdown[] = [];
  const externalCosts: DetailedCostBreakdown[] = [];
  const generalLogistics: DetailedCostBreakdown[] = [];

  let installationTotal = 0;
  let transportTotal = 0; // Material transport
  let equipmentTotal = 0;
  let extraCostsTotal = 0;

  // Use AI extracted distance if available
  const distanceKmOneWay = inputs.logistics.fetched ? inputs.logistics.distanceKm : 0;
  const durationMinOneWay = inputs.logistics.fetched ? inputs.logistics.durationMinutes : 0;
  const hotelCostPerNight = (inputs.logistics.fetched && inputs.logistics.avgHotelPrice > 0) 
    ? inputs.logistics.avgHotelPrice 
    : 120;

  // --- Constants & Variables ---
  const isTrasferta = distanceKmOneWay > vars.soglia_distanza_trasferta_km;
  const rateInternal = vars.costo_orario_tecnico_interno; 
  const rateExternal = vars.costo_orario_squadra_esterna; 
  
  // --- Helper: Public Transport Cost (A/R) ---
  const getPublicTransportCostPerPerson = (): number => {
      if (!inputs.logistics.fetched) return 0;
      
      // Select price based on user choice
      let basePrice = 0;
      if (inputs.publicTransportMode === 'plane') {
          basePrice = inputs.logistics.planePrice;
      } else {
          basePrice = inputs.logistics.trainPrice;
      }

      // Add last mile (assumed per trip block, but simplest is add to ticket total)
      const total = basePrice + inputs.logistics.lastMilePrice;
      
      // Fallback if AI returned 0 but recommended it
      return total > 0 ? total : (distanceKmOneWay * 2 * 0.25);
  };

  // --- Helper: Travel Hours (A/R) ---
  const travelHoursRoundTrip = (durationMinOneWay * 2) / 60; 

  // ==========================================
  // 1. Service: ASSISTENZA
  // ==========================================
  let totalWorkHours = 0;
  let daysRequired = 0;
  let discountAppliedPerc = 0;

  if (inputs.serviceType === ServiceType.ASSISTENZA) {
    const numTechs = inputs.assistenzaTecniciCount;
    const workHoursPerDay = vars.ore_lavoro_giornaliere_standard; 
    totalWorkHours = inputs.assistenzaGiorni * workHoursPerDay * numTechs;
    daysRequired = inputs.assistenzaGiorni;
    
    // Labor Cost (Internal)
    const laborSite = totalWorkHours * rateInternal;
    
    // Travel Labor (Internal Techs get paid for travel)
    let totalTravelHoursPaid = 0;
    let numberOfRoundTrips = 0;

    if (isTrasferta) {
        numberOfRoundTrips = 1; 
        if (inputs.assistenzaGiorni > 5) {
             const extraTrips = Math.floor((inputs.assistenzaGiorni - 1) / 5);
             numberOfRoundTrips += extraTrips;
        }
    } else {
        numberOfRoundTrips = inputs.assistenzaGiorni;
    }

    totalTravelHoursPaid = travelHoursRoundTrip * numberOfRoundTrips * numTechs;
    const laborTravel = totalTravelHoursPaid * rateInternal;

    internalCosts.push({ label: 'Manodopera (Lavoro)', value: laborSite, details: `${totalWorkHours}h totali x €${rateInternal}` });
    
    if (laborTravel > 0) {
        internalCosts.push({ 
            label: 'Manodopera (Viaggio A/R)', 
            value: laborTravel, 
            details: `${totalTravelHoursPaid.toFixed(1)}h retribuite (${numberOfRoundTrips} viaggi x ${numTechs} tec)` 
        });
    }

    // Logistics Costs (Assistenza is usually Internal)
    if (inputs.usePublicTransport && inputs.logistics.fetched) {
       const ticketCost = getPublicTransportCostPerPerson() * numTechs * numberOfRoundTrips;
       const modeLabel = inputs.publicTransportMode === 'plane' ? 'Aereo' : 'Treno';
       internalCosts.push({ label: `Biglietti ${modeLabel} + Last Mile`, value: ticketCost, details: `${numberOfRoundTrips} viaggi A/R` });
       
       const localTransport = 20 * inputs.assistenzaGiorni;
       internalCosts.push({ label: 'Trasporti Locali (Taxi/Bus)', value: localTransport });

       let hotelTotal = 0;
       if (isTrasferta || inputs.assistenzaGiorni > 1) {
           const actualNights = Math.max(0, inputs.assistenzaGiorni - 1);
           hotelTotal = actualNights * numTechs * hotelCostPerNight;
           if (hotelTotal > 0) internalCosts.push({ label: 'Hotel & Alloggio', value: hotelTotal, details: `${actualNights} notti` });
       }
       
       const diaria = numTechs * vars.diaria_squadra_interna * inputs.assistenzaGiorni;
       internalCosts.push({ label: 'Diarie Tecnici', value: diaria });

    } else {
        // Nostro Mezzo
        const tripDistance = distanceKmOneWay * 2;
        let totalKm = 0;
        totalKm += (tripDistance * numberOfRoundTrips);
        if (isTrasferta) totalKm += (inputs.assistenzaGiorni * 30); 

        const fuelCost = (totalKm / vars.km_per_litro_furgone) * vars.costo_medio_gasolio_euro_litro;
        const wearCost = totalKm * vars.costo_usura_mezzo_euro_km;
        const tollsCost = totalKm * 0.12; 

        internalCosts.push({ label: 'Carburante Furgone', value: fuelCost, details: `${totalKm.toFixed(0)} km stima` });
        internalCosts.push({ label: 'Usura & Pedaggi', value: wearCost + tollsCost });

        if (isTrasferta) {
             const diaria = numTechs * vars.diaria_squadra_interna * inputs.assistenzaGiorni;
             internalCosts.push({ label: 'Diarie Tecnici', value: diaria });
             
             const nights = Math.max(0, inputs.assistenzaGiorni - 1);
             const hotelC = nights * numTechs * hotelCostPerNight;
             if (hotelC > 0) internalCosts.push({ label: 'Hotel & Alloggio', value: hotelC });
        }
    }
  }

  // ==========================================
  // 2. Service: INSTALLAZIONE COMPLETA
  // ==========================================
  if (inputs.serviceType === ServiceType.INSTALLAZIONE_COMPLETA) {
      // A. Work Hours Calculation
      let baseHoursPerSpot = modelData.ore_struttura_per_posto;
      if (inputs.optPannelliFotovoltaici) baseHoursPerSpot += modelData.ore_pv_per_posto;
      if (inputs.optIlluminazioneLED) baseHoursPerSpot += modelData.ore_led_per_posto;
      if (inputs.optInstallazioneTelo) baseHoursPerSpot += modelData.ore_telo_per_posto;
      if (inputs.optPannelliCoibentati) baseHoursPerSpot += modelData.ore_coibentati_per_posto;
      
      totalWorkHours = baseHoursPerSpot * inputs.postiAuto;

      // B. Discounts on Hours
      const discount = vars.hourly_discounts.find(d => inputs.postiAuto > d.threshold);
      if (discount) {
          discountAppliedPerc = discount.percentage;
          const discountFactor = (100 - discount.percentage) / 100;
          totalWorkHours = totalWorkHours * discountFactor;
      }

      // C. Days Required
      const internalTechs = inputs.useInternalTechs ? inputs.numInternalTechs : 0;
      const externalTechs = inputs.useExternalTechs ? inputs.numExternalTechs : 0;
      const totalTechs = internalTechs + externalTechs;

      const dailyHoursAvailable = vars.ore_lavoro_giornaliere_standard * totalTechs;
      daysRequired = totalTechs > 0 ? Math.ceil(totalWorkHours / dailyHoursAvailable) : 0;

      // D. Labor Cost (Separated)
      if (totalTechs > 0) {
          const internalRatio = internalTechs / totalTechs;
          const externalRatio = externalTechs / totalTechs;

          // --- INTERNAL ---
          if (internalTechs > 0) {
             const laborSite = (totalWorkHours * internalRatio) * rateInternal;
             internalCosts.push({ label: 'Manodopera Cantiere', value: laborSite, details: `${(totalWorkHours * internalRatio).toFixed(1)}h x €${rateInternal}`, isBold: true });

             // Travel Labor (Internal Only)
             let trips = 0;
             if (isTrasferta) {
                trips = 1; 
                if (daysRequired > 5) trips += Math.floor(daysRequired / 5);
             } else {
                trips = daysRequired;
             }
             const totalTravelHours = travelHoursRoundTrip * trips * internalTechs;
             const laborTravel = totalTravelHours * rateInternal;
             if (laborTravel > 0) {
                internalCosts.push({ label: 'Ore Viaggio Retribuite', value: laborTravel });
             }

             // Logistics Internal
             if (inputs.usePublicTransport && inputs.logistics.fetched) {
                const ticketCost = getPublicTransportCostPerPerson() * internalTechs;
                const modeLabel = inputs.publicTransportMode === 'plane' ? 'Aereo' : 'Treno';
                internalCosts.push({ label: `Biglietti ${modeLabel} (A/R)`, value: ticketCost });
                
                const localTrans = 20 * daysRequired;
                internalCosts.push({ label: 'Trasporti Locali', value: localTrans });

                const nights = Math.max(0, daysRequired - 1); 
                const hotelCost = nights * internalTechs * hotelCostPerNight;
                if (hotelCost > 0) internalCosts.push({ label: 'Hotel Squadra', value: hotelCost });

                const diaria = internalTechs * vars.diaria_squadra_interna * daysRequired;
                internalCosts.push({ label: 'Diaria', value: diaria });

             } else {
                // Nostro Mezzo (Calculated for Internal Team Van)
                const tripDistance = distanceKmOneWay * 2;
                let totalKm = 0;
                if (isTrasferta) {
                    totalKm += tripDistance; 
                    totalKm += (daysRequired * 30);
                    if (daysRequired > 5) {
                        const weeks = Math.floor(daysRequired / 5);
                        totalKm += (weeks * tripDistance);
                    }
                } else {
                    totalKm = tripDistance * daysRequired;
                }

                const fuelCost = (totalKm / vars.km_per_litro_furgone * vars.costo_medio_gasolio_euro_litro);
                const wearCost = (totalKm * vars.costo_usura_mezzo_euro_km);
                const tollsCost = totalKm * 0.12; 

                internalCosts.push({ label: 'Carburante Furgone', value: fuelCost, details: `${totalKm.toFixed(0)}km totali` });
                internalCosts.push({ label: 'Usura & Pedaggi', value: wearCost + tollsCost });

                if (isTrasferta) {
                    const nights = Math.max(0, daysRequired - 1);
                    const hotelCost = nights * internalTechs * hotelCostPerNight;
                    if(hotelCost > 0) internalCosts.push({ label: 'Hotel Squadra', value: hotelCost });

                    const diaria = internalTechs * vars.diaria_squadra_interna * daysRequired;
                    internalCosts.push({ label: 'Diaria', value: diaria });
                }
             }
          }

          // --- EXTERNAL ---
          if (externalTechs > 0) {
             const laborSite = (totalWorkHours * externalRatio) * rateExternal;
             externalCosts.push({ label: 'Manodopera Esterna', value: laborSite, details: `${(totalWorkHours * externalRatio).toFixed(1)}h x €${rateExternal}`, isBold: true });

             if (inputs.usePublicTransport && inputs.logistics.fetched) {
                 const ticketCost = getPublicTransportCostPerPerson() * externalTechs;
                 externalCosts.push({ label: 'Biglietti Mezzi (A/R)', value: ticketCost });

                 const localTrans = 20 * daysRequired;
                 externalCosts.push({ label: 'Trasporti Locali', value: localTrans });
                 
                 const nights = Math.max(0, daysRequired - 1); 
                 const hotelCost = nights * externalTechs * hotelCostPerNight;
                 if (hotelCost > 0) externalCosts.push({ label: 'Hotel Squadra', value: hotelCost });

                 const diaria = externalTechs * vars.diaria_squadra_esterna * daysRequired;
                 externalCosts.push({ label: 'Diaria/Vitto', value: diaria });
             } else {
                 // Assume external team comes with their van, but WE pay for fuel/logistics often? 
                 // Usually external rate includes transport, OR we pay expenses. 
                 // Based on previous logic, we calculated vehicle cost for them too if not public transport.
                 // We will assume "Nostro Mezzo" implies Internal team drives company van. 
                 // If External team is alone, do we pay for their van fuel? 
                 // Let's stick to the previous unified logic but apply it to External bucket if they are present.
                 // However, "Nostro Mezzo" strongly implies Company Asset.
                 // If External uses THEIR van, it might be included in rate or billed. 
                 // For now, if mixed team, assume they travel together or we pay vehicle.
                 
                 // If External ONLY and "Nostro Mezzo", we probably provide the van.
                 // So we calculate vehicle costs here too if needed, or if mixed, vehicle cost is already in Internal (assuming 1 van).
                 
                 if (internalTechs === 0) {
                     // Only External -> We pay for the Van (rental or ours) + Fuel
                     const tripDistance = distanceKmOneWay * 2;
                     let totalKm = 0;
                     if (isTrasferta) {
                        totalKm += tripDistance; 
                        totalKm += (daysRequired * 30);
                        if (daysRequired > 5) {
                            const weeks = Math.floor(daysRequired / 5);
                            totalKm += (weeks * tripDistance);
                        }
                    } else {
                        totalKm = tripDistance * daysRequired;
                    }
                    const fuelCost = (totalKm / vars.km_per_litro_furgone * vars.costo_medio_gasolio_euro_litro);
                    const wearCost = (totalKm * vars.costo_usura_mezzo_euro_km);
                    const tollsCost = totalKm * 0.12; 

                    externalCosts.push({ label: 'Rimborso Carburante/Furgone', value: fuelCost + wearCost + tollsCost });
                 }

                 if (isTrasferta) {
                    const nights = Math.max(0, daysRequired - 1);
                    const hotelCost = nights * externalTechs * hotelCostPerNight;
                    if(hotelCost > 0) externalCosts.push({ label: 'Hotel Squadra', value: hotelCost });

                    const diaria = externalTechs * vars.diaria_squadra_esterna * daysRequired;
                    externalCosts.push({ label: 'Diaria/Vitto', value: diaria });
                 }
             }
          }
      }
  }

  // ==========================================
  // EQUIPMENT (MULETTO)
  // ==========================================
  if (!inputs.clientHasForklift) {
    let rental = vars.costo_noleggio_muletto_base;
    if (daysRequired > 5) {
      const extraDays = daysRequired - 5;
      rental += extraDays * vars.costo_noleggio_muletto_extra; 
    }
    equipmentTotal += rental;
    generalLogistics.push({ label: 'Noleggio Muletto', value: rental, details: `Base + ${Math.max(0, daysRequired-5)} gg extra` });
  }

  // ==========================================
  // CUSTOM EXTRA COSTS
  // ==========================================
  inputs.extraCosts.forEach(extra => {
      extraCostsTotal += extra.value;
      // We'll put this in a separate section or General Logistics
      // generalLogistics.push({ label: `Extra: ${extra.label}`, value: extra.value });
  });


  // ==========================================
  // MATERIAL TRANSPORT
  // ==========================================
  let numZavorre = 0;
  let weightZavorre = 0;
  
  if (inputs.optZavorre && inputs.postiAuto > 0 && selectedBallast) {
    numZavorre = 1 + Math.ceil(inputs.postiAuto / 2);
    const bWeight = selectedBallast.peso_kg || 0;
    weightZavorre = numZavorre * bWeight;
  }

  const structureWeight = modelData.peso_struttura_per_posto * inputs.postiAuto;
  const totalWeight = structureWeight + weightZavorre;

  // Rate Lookup
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
  let unloadingSurcharge = 0;

  const findPrice = (keyword: string, spots: number): number => {
      const keys = Object.keys(prices);
      const vehicleKeys = keys.filter(k => k.toLowerCase().includes(keyword.toLowerCase()));
      for (const key of vehicleKeys) {
        const lower = key.toLowerCase();
        const range = lower.match(/(\d+)\s*-\s*(\d+)/);
        if (range) {
            const min = parseInt(range[1]);
            const max = parseInt(range[2]);
            if (spots >= min && spots <= max) return prices[key];
        }
        const gt = lower.match(/>\s*(\d+)/);
        if (gt) {
            const min = parseInt(gt[1]);
            if (spots > min) return prices[key];
        }
      }
      const generic = vehicleKeys.find(k => !/\d/.test(k));
      if (generic) return prices[generic];
      if (vehicleKeys.length > 0) return prices[vehicleKeys[0]];
      return 0;
  };

  // 1. Furgone Aziendale (Material)
  if (totalWeight < LIMIT_FURGONE && !inputs.optZavorre && inputs.postiAuto <= 3) {
      transportMethod = 'Furgone Aziendale (Nostro Mezzo)';
      const dist = distanceKmOneWay * 2; 
      const fuel = (dist / vars.km_per_litro_furgone) * vars.costo_medio_gasolio_euro_litro;
      const wear = dist * vars.costo_usura_mezzo_euro_km;
      const tolls = dist * 0.12;
      const driverLogistics = isTrasferta ? (vars.diaria_squadra_interna + hotelCostPerNight) : 0;
      
      shippingCost = fuel + wear + tolls + driverLogistics;
      generalLogistics.push({ label: 'Trasporto Materiale (Furgone)', value: shippingCost, details: 'Carburante + Autista dedicato', isBold: true });
  }
  // 2. Camion con Gru
  else if (totalWeight <= LIMIT_GRU) {
      let baseCost = findPrice('gru', inputs.postiAuto);
      if (baseCost === 0) baseCost = 1300; 

      transportMethod = 'Camion con Gru (Autoscarico)';
      unloadingSurcharge = 100; // una tantum

      // For Camion Gru: Cost + Diaria Driver + Hotel Driver (if Trasferta)
      // NO Fuel, NO Wear, NO Tolls (included in supplier price usually, or calculated differently).
      // User request: "Camion con gru vanno solo aggiunte le voci di diaria e l'eventuale alloggio"
      let driverExtra = 0;
      if (isTrasferta) {
          // 1 Day Diaria + 1 Night Hotel (assuming delivery is 1-2 days max, usually 1 trip)
          driverExtra = vars.diaria_squadra_interna + hotelCostPerNight;
      } else {
          driverExtra = vars.diaria_squadra_interna; // Just diaria for the day
      }

      shippingCost = baseCost + driverExtra;
      generalLogistics.push({ label: 'Nolo Camion Gru', value: baseCost });
      generalLogistics.push({ label: 'Supplemento Scarico Gru', value: unloadingSurcharge });
      generalLogistics.push({ label: 'Logistica Autista Gru (Diaria/Hotel)', value: driverExtra });
  }
  // 3. Bilico
  else {
      let baseCost = findPrice('bilico', inputs.postiAuto);
      if (baseCost === 0) baseCost = 1600; 

      const numTrucks = Math.ceil(totalWeight / LIMIT_BILICO);
      transportMethod = numTrucks > 1 ? `Bilico Standard x${numTrucks}` : 'Bilico Standard';
      
      // For Bilico: "All inclusive nel costo" (User request)
      shippingCost = baseCost * numTrucks;
      generalLogistics.push({ label: `Trasporto ${transportMethod}`, value: shippingCost, isBold: true });
      // No unloading surcharge here (client/muletto handles it)
  }

  transportTotal = shippingCost + unloadingSurcharge;

  // Aggregate totals
  const internalTotal = internalCosts.reduce((sum, item) => sum + item.value, 0);
  const externalTotal = externalCosts.reduce((sum, item) => sum + item.value, 0);
  
  installationTotal = internalTotal + externalTotal;

  const totalOne = installationTotal + transportTotal + equipmentTotal + extraCostsTotal;
  const marginMultiplier = (100 + vars.margine_percentuale_installazione) / 100;

  return {
    totalCost: totalOne,
    sellPrice: totalOne * marginMultiplier,
    installationTotal,
    transportTotal,
    equipmentTotal,
    extraCostsTotal,
    transportMethod,
    totalWeight,
    totalHours: totalWorkHours,
    totalDays: daysRequired,
    internalTeamCosts: internalCosts,
    externalTeamCosts: externalCosts,
    generalLogisticsCosts: generalLogistics,
    numZavorre,
    weightZavorre,
    discountAppliedPerc
  };
};