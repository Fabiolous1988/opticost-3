import { QuoteInputs, GlobalVariables, TransportRate, ServiceType, CalculationResult, ModelData, BallastData, DetailedCostBreakdown } from '../types';

const formatTime = (decimalHours: number): string => {
  let normalized = decimalHours % 24;
  if (normalized < 0) normalized += 24;
  
  const h = Math.floor(normalized);
  const m = Math.round((normalized - h) * 60);
  
  // Handle edge case where minutes round to 60
  if (m === 60) {
      return `${String((h + 1) % 24).padStart(2, '0')}:00`;
  }
  
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

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

  // --- WEIGHT CALCULATION (Structure + Ballast) ---
  let numZavorre = 0;
  let weightZavorre = 0;
  
  if (inputs.optZavorre && inputs.postiAuto > 0 && selectedBallast) {
    numZavorre = 1 + Math.ceil(inputs.postiAuto / 2);
    const bWeight = selectedBallast.peso_kg || 0;
    weightZavorre = numZavorre * bWeight;
  }

  const structureWeight = (modelData.peso_struttura_per_posto || 0) * inputs.postiAuto;
  const totalWeight = structureWeight + weightZavorre;

  // --- LOGISTICS AI DATA ---
  const distanceKmOneWay = inputs.logistics.fetched ? inputs.logistics.distanceKm : 0;
  let durationMinOneWay = inputs.logistics.fetched ? inputs.logistics.driveDurationMinutes : 0;
  
  if (inputs.usePublicTransport && inputs.logistics.fetched) {
      if (inputs.publicTransportMode === 'plane') {
          durationMinOneWay = inputs.logistics.planeDurationMinutes + inputs.logistics.lastMileDurationMinutes;
      } else {
          durationMinOneWay = inputs.logistics.trainDurationMinutes + inputs.logistics.lastMileDurationMinutes;
      }
  }

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
      let basePrice = inputs.publicTransportMode === 'plane' ? inputs.logistics.planePrice : inputs.logistics.trainPrice;
      const total = basePrice + inputs.logistics.lastMilePrice;
      return total > 0 ? total : 0;
  };

  const getSplitCostString = (total: number): string => {
      const half = total / 2;
      return `(€${half.toFixed(2)} Andata + €${half.toFixed(2)} Ritorno)`;
  };

  // --- Helper: Travel Hours (A/R) ---
  const travelHoursOneWay = durationMinOneWay / 60;
  const travelHoursRoundTrip = travelHoursOneWay * 2; 

  // ==========================================
  // SCHEDULING LOGIC (Technicians)
  // ==========================================
  // Rule: Start 07:00 from HQ.
  // Arrival = 7.0 + OneWayHours.
  // If Arrival > 14:00 -> No work today. Day count +1.
  // Return Deadline: 19:00.
  // Assume work ends at 17:00 standard. If 17:00 + OneWay > 19:00 -> Extra Night Hotel.
  
  let extraNightForReturn = false;
  let lostDayForTravel = false;
  
  const arrivalTime = 7.0 + travelHoursOneWay;
  if (arrivalTime > 14.0) {
      lostDayForTravel = true;
  }

  // Check return time (Assumed leaving site at 17:00)
  const returnArrivalTime = 17.0 + travelHoursOneWay;
  if (returnArrivalTime > 19.0) {
      extraNightForReturn = true;
  }

  // ==========================================
  // 1. Service: ASSISTENZA
  // ==========================================
  let totalWorkHours = 0;
  let daysRequired = 0;
  let discountAppliedPerc = 0;

  if (inputs.serviceType === ServiceType.ASSISTENZA) {
    const numTechs = inputs.assistenzaTecniciCount;
    const workHoursPerDay = vars.ore_lavoro_giornaliere_standard; // 8
    
    // Pure working hours
    totalWorkHours = inputs.assistenzaGiorni * workHoursPerDay * numTechs;
    
    // Days Calculation
    daysRequired = inputs.assistenzaGiorni;
    if (lostDayForTravel) {
        daysRequired += 1; // Add 1 day for travel
    }

    // Labor Cost (Internal)
    const laborSite = totalWorkHours * rateInternal;
    
    // Travel Labor Cost (Internal Techs get paid for travel)
    // If lostDayForTravel, they are paid for travel time on that day too? Usually yes.
    // Logic: Total Round Trips * Hours * Rate
    let numberOfRoundTrips = 0;
    if (isTrasferta) {
        numberOfRoundTrips = 1; 
        if (daysRequired > 5) {
             const extraTrips = Math.floor((daysRequired - 1) / 5);
             numberOfRoundTrips += extraTrips;
        }
    } else {
        numberOfRoundTrips = daysRequired; // Commuting every day
    }

    const totalTravelHoursPaid = travelHoursRoundTrip * numberOfRoundTrips * numTechs;
    const laborTravel = totalTravelHoursPaid * rateInternal;

    internalCosts.push({ 
        label: 'Manodopera (Lavoro)', 
        value: laborSite, 
        details: `${totalWorkHours}h totali x €${rateInternal}`,
        tooltip: `Logica: Ore Giornaliere (${workHoursPerDay}h) x Giorni Lavoro (${inputs.assistenzaGiorni}) x Tecnici.`
    });
    
    if (laborTravel > 0) {
        internalCosts.push({ 
            label: 'Manodopera (Viaggio A/R)', 
            value: laborTravel, 
            details: `${totalTravelHoursPaid.toFixed(1)}h retribuite`,
            tooltip: 'Ore di viaggio retribuite per i tecnici interni.'
        });
    }

    if (lostDayForTravel) {
        internalCosts.push({
            label: 'Supplemento Giorno Viaggio',
            value: 0, // Cost is in Hotel/Diaria/LaborTravel, this is just info
            details: `Arrivo h.${formatTime(arrivalTime)} (>14:00)`,
            tooltip: 'Poiché l\'arrivo in cantiere è previsto dopo le 14:00, il primo giorno è considerato solo viaggio.'
        });
    }

    // Logistics Costs
    if (inputs.usePublicTransport && inputs.logistics.fetched) {
       const ticketCost = getPublicTransportCostPerPerson() * numTechs * numberOfRoundTrips;
       internalCosts.push({ 
           label: 'Biglietti Viaggio + Last Mile', 
           value: ticketCost, 
           details: getSplitCostString(ticketCost)
       });
       
       const localTransport = 20 * daysRequired;
       internalCosts.push({ label: 'Trasporti Locali', value: localTransport });

       // Hotels
       let hotelNights = 0;
       if (isTrasferta || daysRequired > 1) {
           hotelNights = Math.max(0, daysRequired - 1);
       }
       if (extraNightForReturn) {
           hotelNights += 1;
       }
       
       const hotelTotal = hotelNights * numTechs * hotelCostPerNight;
       if (hotelTotal > 0) {
           internalCosts.push({ 
               label: 'Hotel & Alloggio', 
               value: hotelTotal, 
               details: `${hotelNights} notti totali`,
               tooltip: extraNightForReturn ? 'Include 1 notte extra per rientro previsto dopo le 19:00.' : ''
           });
       }
       
       const diaria = numTechs * vars.diaria_squadra_interna * daysRequired;
       internalCosts.push({ label: 'Diarie Tecnici', value: diaria });

    } else {
        // Nostro Mezzo
        const tripDistance = distanceKmOneWay * 2;
        let totalKm = (tripDistance * numberOfRoundTrips);
        if (isTrasferta) totalKm += (daysRequired * 30); 

        const fuelCost = (totalKm / vars.km_per_litro_furgone) * vars.costo_medio_gasolio_euro_litro;
        const wearCost = totalKm * vars.costo_usura_mezzo_euro_km;
        const tollsCost = totalKm * 0.12; 

        // Ferry for Van
        let ferryTotal = 0;
        if (inputs.logistics.isIsland && inputs.logistics.ferryCostVan > 0) {
            ferryTotal = inputs.logistics.ferryCostVan * numberOfRoundTrips;
        }

        internalCosts.push({ label: 'Carburante Furgone', value: fuelCost, details: `${totalKm.toFixed(0)} km stima` });
        internalCosts.push({ label: 'Usura & Pedaggi', value: wearCost + tollsCost });
        if (ferryTotal > 0) internalCosts.push({ label: 'Traghetti Furgone', value: ferryTotal });

        if (isTrasferta) {
             const diaria = numTechs * vars.diaria_squadra_interna * daysRequired;
             internalCosts.push({ label: 'Diarie Tecnici', value: diaria });
             
             let hotelNights = Math.max(0, daysRequired - 1);
             if (extraNightForReturn) hotelNights += 1;

             const hotelC = hotelNights * numTechs * hotelCostPerNight;
             if(hotelC > 0) internalCosts.push({ 
                 label: 'Hotel Squadra', 
                 value: hotelC,
                 details: `${hotelNights} notti`,
                 tooltip: extraNightForReturn ? 'Include 1 notte extra per rientro previsto dopo le 19:00.' : ''
             });
        }
    }
  }

  // ==========================================
  // 2. Service: INSTALLAZIONE COMPLETA
  // ==========================================
  if (inputs.serviceType === ServiceType.INSTALLAZIONE_COMPLETA) {
      // Work Hours Calculation
      let baseHoursPerSpot = modelData.ore_struttura_per_posto;
      if (inputs.optPannelliFotovoltaici) baseHoursPerSpot += modelData.ore_pv_per_posto;
      if (inputs.optIlluminazioneLED) baseHoursPerSpot += modelData.ore_led_per_posto;
      if (inputs.optInstallazioneTelo) baseHoursPerSpot += modelData.ore_telo_per_posto;
      if (inputs.optPannelliCoibentati) baseHoursPerSpot += modelData.ore_coibentati_per_posto;
      
      totalWorkHours = baseHoursPerSpot * inputs.postiAuto;

      // Discounts on Hours
      const discount = vars.hourly_discounts.find(d => inputs.postiAuto > d.threshold);
      if (discount) {
          discountAppliedPerc = discount.percentage;
          const discountFactor = (100 - discount.percentage) / 100;
          totalWorkHours = totalWorkHours * discountFactor;
      }

      // Techs
      const internalTechs = inputs.useInternalTechs ? inputs.numInternalTechs : 0;
      const externalTechs = inputs.useExternalTechs ? inputs.numExternalTechs : 0;
      const totalTechs = internalTechs + externalTechs;

      const dailyHoursAvailable = vars.ore_lavoro_giornaliere_standard * totalTechs;
      const workDaysRequired = totalTechs > 0 ? Math.ceil(totalWorkHours / dailyHoursAvailable) : 0;
      
      // Apply Schedule Logic
      daysRequired = workDaysRequired;
      if (lostDayForTravel) {
          daysRequired += 1;
      }

      // Labor Cost
      if (totalTechs > 0) {
          const internalRatio = internalTechs / totalTechs;
          const externalRatio = externalTechs / totalTechs;

          // --- INTERNAL ---
          if (internalTechs > 0) {
             const laborSite = (totalWorkHours * internalRatio) * rateInternal;
             internalCosts.push({ 
                 label: 'Manodopera Cantiere', 
                 value: laborSite, 
                 details: `${(totalWorkHours * internalRatio).toFixed(1)}h x €${rateInternal}`, 
                 isBold: true
             });

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
                internalCosts.push({ 
                    label: 'Ore Viaggio Retribuite', 
                    value: laborTravel,
                    details: `${getSplitCostString(laborTravel)}`
                });
             }

             if (lostDayForTravel) {
                 internalCosts.push({
                    label: 'Info: Giorno Viaggio',
                    value: 0,
                    details: 'Arrivo previsto > 14:00',
                    tooltip: 'Primo giorno dedicato al viaggio, lavoro inizia il giorno successivo.'
                 });
             }

             // Logistics Internal
             if (inputs.usePublicTransport && inputs.logistics.fetched) {
                const ticketCost = getPublicTransportCostPerPerson() * internalTechs;
                internalCosts.push({ label: 'Biglietti Mezzi (A/R)', value: ticketCost });
                
                const localTrans = 20 * daysRequired;
                internalCosts.push({ label: 'Trasporti Locali', value: localTrans });

                let hotelNights = Math.max(0, daysRequired - 1);
                if (extraNightForReturn) hotelNights += 1;

                const hotelCost = hotelNights * internalTechs * hotelCostPerNight;
                if (hotelCost > 0) internalCosts.push({ 
                    label: 'Hotel Squadra', 
                    value: hotelCost,
                    details: `${hotelNights} notti`,
                    tooltip: extraNightForReturn ? 'Include 1 notte extra per rientro tardivo (>19:00)' : ''
                });

                const diaria = internalTechs * vars.diaria_squadra_interna * daysRequired;
                internalCosts.push({ label: 'Diaria', value: diaria });

             } else {
                // Nostro Mezzo (TECNICI)
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

                // Ferry
                let ferryTotal = 0;
                if (inputs.logistics.isIsland && inputs.logistics.ferryCostVan > 0) {
                     const nTrips = isTrasferta ? 1 : daysRequired;
                     ferryTotal = inputs.logistics.ferryCostVan * nTrips;
                }

                internalCosts.push({ label: 'Carburante Furgone', value: fuelCost });
                internalCosts.push({ label: 'Usura & Pedaggi', value: wearCost + tollsCost });
                if (ferryTotal > 0) internalCosts.push({ label: 'Traghetti Furgone', value: ferryTotal });

                if (isTrasferta) {
                    let hotelNights = Math.max(0, daysRequired - 1);
                    if (extraNightForReturn) hotelNights += 1;

                    const hotelCost = hotelNights * internalTechs * hotelCostPerNight;
                    if(hotelCost > 0) internalCosts.push({ 
                        label: 'Hotel Squadra', 
                        value: hotelCost,
                        details: `${hotelNights} notti`,
                        tooltip: extraNightForReturn ? 'Include 1 notte extra per rientro tardivo (>19:00)' : ''
                    });

                    const diaria = internalTechs * vars.diaria_squadra_interna * daysRequired;
                    internalCosts.push({ label: 'Diaria', value: diaria });
                }
             }
          }

          // --- EXTERNAL ---
          if (externalTechs > 0) {
             const laborSite = (totalWorkHours * externalRatio) * rateExternal;
             externalCosts.push({ 
                 label: 'Manodopera Esterna', 
                 value: laborSite, 
                 details: `${(totalWorkHours * externalRatio).toFixed(1)}h x €${rateExternal}`, 
                 isBold: true
             });
             
             const diariaExt = externalTechs * vars.diaria_squadra_esterna * daysRequired;
             externalCosts.push({ 
                 label: 'Diaria Esterna', 
                 value: diariaExt, 
                 details: `${daysRequired} gg x ${externalTechs} tec`
             });
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
    generalLogistics.push({ 
        label: 'Noleggio Muletto', 
        value: rental, 
        details: `Base + ${Math.max(0, daysRequired-5)} gg extra`,
        tooltip: `Logica: Costo Base (€${vars.costo_noleggio_muletto_base}) per prima settimana + (€${vars.costo_noleggio_muletto_extra}) per ogni giorno successivo.`
    });
  }

  // ==========================================
  // CUSTOM EXTRA COSTS
  // ==========================================
  inputs.extraCosts.forEach(extra => {
      extraCostsTotal += extra.value;
  });


  // ==========================================
  // MATERIAL TRANSPORT
  // ==========================================
  
  let transportMethod = 'Non Definito';
  let shippingCost = 0;
  let unloadingSurcharge = 0;
  let ferryExtra = 0;

  // IF ASSISTENZA -> NO MATERIAL TRANSPORT
  if (inputs.serviceType === ServiceType.ASSISTENZA) {
      transportMethod = 'Non Richiesto (Assistenza)';
      transportTotal = 0;
      // Do not populate generalLogistics with transport items
  } else {
      // IF INSTALLAZIONE -> CALCULATE MATERIAL TRANSPORT ALWAYS
      // (Even if Techs go by Public Transport, the Material must arrive by Truck/Van)

      const cleanDest = inputs.indirizzoCompleto.trim().toLowerCase(); 
      const rate = transportRates.find(r => 
        cleanDest.includes(r.provincia.toLowerCase()) || 
        cleanDest.includes(r.regione.toLowerCase())
      );
      const prices = rate?.prices || {};

      const LIMIT_BILICO = 24000;
      const LIMIT_GRU = 16000;
      const LIMIT_FURGONE = 1000;

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

      // 1. Furgone Aziendale / Dedicato (Material)
      if (totalWeight < LIMIT_FURGONE && !inputs.optZavorre && inputs.postiAuto <= 3) {
          
          const dist = distanceKmOneWay * 2; 
          const fuel = (dist / vars.km_per_litro_furgone) * vars.costo_medio_gasolio_euro_litro;
          const wear = dist * vars.costo_usura_mezzo_euro_km;
          const tolls = dist * 0.12;
          
          if (inputs.logistics.isIsland && inputs.logistics.ferryCostVan > 0) {
             ferryExtra = inputs.logistics.ferryCostVan;
          }

          if (inputs.usePublicTransport) {
              // TECHS ARE ON TRAIN. VAN IS DEDICATED SHIPPING (Driver must be paid/accounted or courier)
              transportMethod = 'Spedizione Dedicata (Furgone)';
              // Assume a driver cost is needed since techs are not driving it.
              // Let's approximate a dedicated driver cost as 1 day labor + expenses
              const dedicatedDriverCost = 250; // Flat fee for dedicated driver or courier markup
              
              shippingCost = fuel + wear + tolls + dedicatedDriverCost;

              generalLogistics.push({ 
                  label: 'Spedizione Dedicata (Materiale)', 
                  value: shippingCost + ferryExtra, 
                  details: 'Furgone Dedicato (Materiale separato dai tecnici)', 
                  isBold: true
              });

          } else {
              // TECHS DRIVE THE VAN.
              // Fuel/Wear is cost of the van.
              // Driver cost is NOT added here because it's already in 'internalCosts' (Labor + Diaria).
              // We only list the Vehicle running costs here.
              transportMethod = 'Furgone Aziendale (Materiale con Squadra)';
              shippingCost = 0; // The vehicle costs are listed under Internal Team to avoid splitting logic weirdly in UI
              
              // However, we want to show it in the breakdown.
              // To match user expectation: "Carburante" shows under Internal Team.
              // Here we just show a note or 0 cost with explanation.
              generalLogistics.push({
                  label: 'Trasporto Materiale (Furgone)',
                  value: 0,
                  details: 'Incluso in Furgone Squadra (Vedi sopra)',
                  isBold: true
              });
          }

          if (ferryExtra > 0 && inputs.usePublicTransport) {
               // Only add ferry here if dedicated. If team drives, it's added in internalCosts
               generalLogistics.push({ label: 'Traghetto Spedizione', value: ferryExtra });
               shippingCost += ferryExtra;
          }
      }
      // 2. Camion con Gru
      else if (totalWeight <= LIMIT_GRU) {
          let baseCost = findPrice('gru', inputs.postiAuto);
          if (baseCost === 0) baseCost = 1300; 

          transportMethod = 'Camion con Gru (Autoscarico)';
          unloadingSurcharge = 100; 
          
          let ballastExtraCost = 0;
          if (numZavorre > 0) {
              // 20 mins per ballast
              const minutesBallast = numZavorre * 20;
              // Round up to nearest hour
              const hoursExtra = Math.ceil(minutesBallast / 60);
              ballastExtraCost = hoursExtra * 100;
          }

          // Truck Schedule Check
          // Start 06:00.
          // Unload Time = 1h fixed + Ballast Time.
          const unloadTimeHours = 1 + (numZavorre * 20 / 60);
          
          const totalMissionHours = (travelHoursOneWay * 2) + unloadTimeHours;
          const truckReturnTime = 6.0 + totalMissionHours;
          
          let truckDriverHotel = 0;
          let truckDriverDiaria = vars.diaria_squadra_interna; // Base daily pay for driver

          if (truckReturnTime > 19.0) {
              truckDriverHotel = hotelCostPerNight;
              truckDriverDiaria += vars.diaria_squadra_interna;
          }

          if (inputs.logistics.isIsland && inputs.logistics.ferryCostTruck > 0) {
             ferryExtra = inputs.logistics.ferryCostTruck;
          }

          shippingCost = baseCost + truckDriverDiaria + truckDriverHotel + ferryExtra + ballastExtraCost;
          
          generalLogistics.push({ 
              label: 'Nolo Camion Gru', 
              value: baseCost
          });
          generalLogistics.push({ 
              label: 'Supplemento Scarico Gru (Base)', 
              value: unloadingSurcharge,
          });
          
          if (ballastExtraCost > 0) {
              generalLogistics.push({ 
                  label: 'Supplemento Scarico Zavorre', 
                  value: ballastExtraCost,
                  details: `${numZavorre} zavorre (${(numZavorre*20)} min) -> ${Math.ceil((numZavorre*20)/60)}h extra`,
                  tooltip: '100€ per ogni ora aggiuntiva (20 min/zavorra)'
              });
          }

          generalLogistics.push({ 
              label: 'Logistica Autista Gru', 
              value: truckDriverDiaria + truckDriverHotel,
              details: truckDriverHotel > 0 ? 'Diaria + Hotel (Rientro > 19:00)' : 'Diaria Giornaliera',
              tooltip: `Partenza 06:00. Rientro stimato ore ${formatTime(truckReturnTime)}.`
          });

          if (ferryExtra > 0) {
             generalLogistics.push({ 
                 label: 'Traghetto Camion (A/R)', 
                 value: ferryExtra
             });
          }
      }
      // 3. Bilico
      else {
          let baseCost = findPrice('bilico', inputs.postiAuto);
          if (baseCost === 0) baseCost = 1600; 

          const numTrucks = Math.ceil(totalWeight / LIMIT_BILICO);
          transportMethod = numTrucks > 1 ? `Bilico Standard x${numTrucks}` : 'Bilico Standard';
          
          if (inputs.logistics.isIsland && inputs.logistics.ferryCostTruck > 0) {
             ferryExtra = inputs.logistics.ferryCostTruck * numTrucks;
          }

          // For Bilico: "All inclusive nel costo" (User request)
          shippingCost = (baseCost * numTrucks) + ferryExtra;
          
          generalLogistics.push({ 
              label: `Trasporto ${transportMethod}`, 
              value: shippingCost - ferryExtra, // Base cost
              isBold: true
          });

          if (ferryExtra > 0) {
             generalLogistics.push({ 
                 label: 'Traghetto Bilico (A/R)', 
                 value: ferryExtra
             });
          }
      }

      transportTotal = shippingCost + unloadingSurcharge;
  }

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
    totalWeight: totalWeight, // Expose total weight
    totalHours: totalWorkHours,
    totalDays: daysRequired,
    internalTeamCosts: internalCosts,
    externalTeamCosts: externalCosts,
    generalLogisticsCosts: generalLogistics,
    numZavorre: numZavorre,
    weightZavorre: weightZavorre,
    discountAppliedPerc
  };
};