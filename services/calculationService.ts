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
  // Determine duration based on mode
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
      return total > 0 ? total : 0;
  };

  const getSplitCostString = (total: number): string => {
      const half = total / 2;
      return `(€${half.toFixed(2)} Andata + €${half.toFixed(2)} Ritorno)`;
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

    internalCosts.push({ 
        label: 'Manodopera (Lavoro)', 
        value: laborSite, 
        details: `${totalWorkHours}h totali x €${rateInternal}`,
        tooltip: `Logica: Ore Giornaliere (${workHoursPerDay}h) x Giorni (${inputs.assistenzaGiorni}) x Tecnici (${numTechs}) x Costo Orario (€${rateInternal})`
    });
    
    if (laborTravel > 0) {
        internalCosts.push({ 
            label: 'Manodopera (Viaggio A/R)', 
            value: laborTravel, 
            details: `${totalTravelHoursPaid.toFixed(1)}h retribuite (${numberOfRoundTrips} viaggi x ${numTechs} tec)`,
            tooltip: `Logica: Ore Viaggio A/R (${travelHoursRoundTrip.toFixed(1)}h) x N. Viaggi (${numberOfRoundTrips}) x N. Tecnici (${numTechs}) x Costo Orario (€${rateInternal}). I tecnici interni vengono pagati anche per le ore di guida.`
        });
    }

    // Logistics Costs (Assistenza is usually Internal)
    if (inputs.usePublicTransport && inputs.logistics.fetched) {
       const ticketCost = getPublicTransportCostPerPerson() * numTechs * numberOfRoundTrips;
       const modeLabel = inputs.publicTransportMode === 'plane' ? 'Aereo' : 'Treno';
       internalCosts.push({ 
           label: `Biglietti ${modeLabel} + Last Mile`, 
           value: ticketCost, 
           details: `${getSplitCostString(ticketCost)}`,
           tooltip: `Logica: Prezzo A/R medio rilevato (${getPublicTransportCostPerPerson().toFixed(2)}€/persona) x ${numTechs} Tecnici.`
       });
       
       const localTransport = 20 * inputs.assistenzaGiorni;
       internalCosts.push({ 
           label: 'Trasporti Locali (Taxi/Bus)', 
           value: localTransport,
           tooltip: `Logica: Forfait spostamenti in loco: 20€/giorno x ${inputs.assistenzaGiorni} giorni.`
       });

       let hotelTotal = 0;
       if (isTrasferta || inputs.assistenzaGiorni > 1) {
           const actualNights = Math.max(0, inputs.assistenzaGiorni - 1);
           hotelTotal = actualNights * numTechs * hotelCostPerNight;
           if (hotelTotal > 0) internalCosts.push({ 
               label: 'Hotel & Alloggio', 
               value: hotelTotal, 
               details: `${actualNights} notti`,
               tooltip: `Logica: Prezzo medio Hotel (${hotelCostPerNight}€) x Notti (${actualNights}) x Tecnici (${numTechs}). Fonte AI o default.`
           });
       }
       
       const diaria = numTechs * vars.diaria_squadra_interna * inputs.assistenzaGiorni;
       internalCosts.push({ 
           label: 'Diarie Tecnici', 
           value: diaria,
           tooltip: `Logica: Diaria (${vars.diaria_squadra_interna}€) x Giorni (${inputs.assistenzaGiorni}) x Tecnici (${numTechs}).`
       });

    } else {
        // Nostro Mezzo
        const tripDistance = distanceKmOneWay * 2;
        let totalKm = 0;
        totalKm += (tripDistance * numberOfRoundTrips);
        if (isTrasferta) totalKm += (inputs.assistenzaGiorni * 30); 

        const fuelCost = (totalKm / vars.km_per_litro_furgone) * vars.costo_medio_gasolio_euro_litro;
        const wearCost = totalKm * vars.costo_usura_mezzo_euro_km;
        const tollsCost = totalKm * 0.12; 

        // Ferry for Van
        let ferryTotal = 0;
        if (inputs.logistics.isIsland && inputs.logistics.ferryCostVan > 0) {
            ferryTotal = inputs.logistics.ferryCostVan * numberOfRoundTrips;
        }

        internalCosts.push({ 
            label: 'Carburante Furgone', 
            value: fuelCost, 
            details: `${totalKm.toFixed(0)} km stima`,
            tooltip: `Logica: Km Totali (${totalKm.toFixed(0)}) / Km/Litro (${vars.km_per_litro_furgone}) * Costo Diesel (${vars.costo_medio_gasolio_euro_litro}€).`
        });
        internalCosts.push({ 
            label: 'Usura & Pedaggi', 
            value: wearCost + tollsCost,
            tooltip: `Logica: Usura (${vars.costo_usura_mezzo_euro_km}€/km) + Pedaggi stima (0.12€/km) x Km Totali.`
        });
        
        if (ferryTotal > 0) {
            internalCosts.push({ 
                label: 'Traghetti Furgone (A/R)', 
                value: ferryTotal,
                details: getSplitCostString(ferryTotal),
                tooltip: `Logica: Costo Traghetto Furgone rilevato AI (${inputs.logistics.ferryCostVan}€) x Numero Viaggi.`
            });
        }

        if (isTrasferta) {
             const diaria = numTechs * vars.diaria_squadra_interna * inputs.assistenzaGiorni;
             internalCosts.push({ 
                 label: 'Diarie Tecnici', 
                 value: diaria,
                 tooltip: `Logica: Diaria (${vars.diaria_squadra_interna}€) x Giorni (${inputs.assistenzaGiorni}) x Tecnici (${numTechs}).`
             });
             
             const nights = Math.max(0, inputs.assistenzaGiorni - 1);
             const hotelC = nights * numTechs * hotelCostPerNight;
             if (hotelC > 0) internalCosts.push({ 
                 label: 'Hotel & Alloggio', 
                 value: hotelC,
                 tooltip: `Logica: Prezzo Hotel (${hotelCostPerNight}€) x Notti (${nights}) x Tecnici (${numTechs}).`
             });
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
             internalCosts.push({ 
                 label: 'Manodopera Cantiere', 
                 value: laborSite, 
                 details: `${(totalWorkHours * internalRatio).toFixed(1)}h x €${rateInternal}`, 
                 isBold: true,
                 tooltip: `Logica: Ore Totali (${totalWorkHours.toFixed(1)}) divise pro-quota interna (${(internalRatio*100).toFixed(0)}%) x Costo Orario (€${rateInternal}).`
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
                    details: `${getSplitCostString(laborTravel)}`,
                    tooltip: `Logica: Durata Viaggio A/R (${travelHoursRoundTrip.toFixed(1)}h) x N. Viaggi (${trips}) x N. Tecnici (${internalTechs}) x Costo Orario (€${rateInternal}). I tecnici vengono pagati per guidare.`
                });
             }

             // Logistics Internal
             if (inputs.usePublicTransport && inputs.logistics.fetched) {
                const ticketCost = getPublicTransportCostPerPerson() * internalTechs;
                const modeLabel = inputs.publicTransportMode === 'plane' ? 'Aereo' : 'Treno';
                internalCosts.push({ 
                    label: `Biglietti ${modeLabel} (A/R)`, 
                    value: ticketCost,
                    details: `${getSplitCostString(ticketCost)}`,
                    tooltip: `Logica: Costo Biglietto A/R rilevato AI x ${internalTechs} Tecnici. Include Last Mile.`
                });
                
                const localTrans = 20 * daysRequired;
                internalCosts.push({ 
                    label: 'Trasporti Locali', 
                    value: localTrans,
                    tooltip: `Logica: Forfait 20€/giorno per taxi/bus locale.`
                });

                const nights = Math.max(0, daysRequired - 1); 
                const hotelCost = nights * internalTechs * hotelCostPerNight;
                if (hotelCost > 0) internalCosts.push({ 
                    label: 'Hotel Squadra', 
                    value: hotelCost,
                    tooltip: `Logica: Prezzo Hotel (${hotelCostPerNight}€) x Notti (${nights}) x Tecnici (${internalTechs}).`
                });

                const diaria = internalTechs * vars.diaria_squadra_interna * daysRequired;
                internalCosts.push({ 
                    label: 'Diaria', 
                    value: diaria,
                    tooltip: `Logica: Diaria giornaliera (${vars.diaria_squadra_interna}€) x Giorni x Tecnici.`
                });

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

                // Ferry
                let ferryTotal = 0;
                if (inputs.logistics.isIsland && inputs.logistics.ferryCostVan > 0) {
                     // Assume 1 trip (or more if long job)
                     const nTrips = isTrasferta ? 1 : daysRequired;
                     ferryTotal = inputs.logistics.ferryCostVan * nTrips;
                }

                internalCosts.push({ 
                    label: 'Carburante Furgone', 
                    value: fuelCost, 
                    details: `${totalKm.toFixed(0)}km totali`,
                    tooltip: `Logica: Km stimati (${totalKm.toFixed(0)}) / Consumo (${vars.km_per_litro_furgone} km/l) * Prezzo Diesel.`
                });
                internalCosts.push({ 
                    label: 'Usura & Pedaggi', 
                    value: wearCost + tollsCost,
                    tooltip: `Logica: Usura veicolo (${vars.costo_usura_mezzo_euro_km}€/km) + Pedaggi autostradali.`
                });

                if (ferryTotal > 0) {
                    internalCosts.push({ 
                        label: 'Traghetti Furgone (A/R)', 
                        value: ferryTotal,
                        details: getSplitCostString(ferryTotal),
                        tooltip: `Logica: Costo Traghetto Furgone rilevato AI (${inputs.logistics.ferryCostVan}€) x Viaggi.`
                    });
                }

                if (isTrasferta) {
                    const nights = Math.max(0, daysRequired - 1);
                    const hotelCost = nights * internalTechs * hotelCostPerNight;
                    if(hotelCost > 0) internalCosts.push({ 
                        label: 'Hotel Squadra', 
                        value: hotelCost,
                        tooltip: `Logica: Costo Hotel (${hotelCostPerNight}€) x Notti (${nights}) x Tecnici (${internalTechs}).`
                    });

                    const diaria = internalTechs * vars.diaria_squadra_interna * daysRequired;
                    internalCosts.push({ 
                        label: 'Diaria', 
                        value: diaria,
                        tooltip: `Logica: Diaria (${vars.diaria_squadra_interna}€) x Giorni (${daysRequired}) x Tecnici.`
                    });
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
                 isBold: true,
                 tooltip: `Logica: Ore Totali pro-quota esterna x Costo Orario Esterno (€${rateExternal}). Include margine azienda. NESSUN rimborso extra.`
             });
             
             // STRICTLY NO EXTRA COSTS FOR EXTERNAL TEAM AS REQUESTED
             // "La squadra esterna NON ha diritto a hotel e rimborso viaggio di alcun tipo. L'unica paga a cui ha diritto è quella oraria."
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
  
  // LOGIC CHANGE: If using Public Transport, User requested "NON mettere nel preventivo i costi di bilico, camion con gru o altro".
  // Only calculate material transport if using "Nostro Mezzo" (implies standard truck logistics) or explicitly forced.
  // We will assume "Mezzi Pubblici" means no Heavy Transport charged on this quote.

  let transportMethod = 'Non Definito';
  let shippingCost = 0;
  let unloadingSurcharge = 0;
  let ferryExtra = 0;

  if (!inputs.usePublicTransport) {
      
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

          // Note: Ferry for this furgone is likely same as team furgone if they travel together?
          // If Internal Team is present, they take the van. 
          // If only shipping, we need to add ferry.
          // To avoid double counting, if internal team exists, this "Material Transport" cost is duplicative of their travel cost?
          // Usually separate "Material Transport" implies a dedicated delivery trip if the team can't carry it.
          // Given logic, we sum it up. 
          if (inputs.logistics.isIsland && inputs.logistics.ferryCostVan > 0) {
             ferryExtra = inputs.logistics.ferryCostVan;
          }

          generalLogistics.push({ 
              label: 'Trasporto Materiale (Furgone)', 
              value: shippingCost + ferryExtra, 
              details: 'Carburante + Autista dedicato' + (ferryExtra ? ' + Traghetto' : ''), 
              isBold: true,
              tooltip: `Logica: Peso materiale (${totalWeight}kg) < 1000kg. Costo viaggio furgone + eventuale trasferta autista.`
          });
      }
      // 2. Camion con Gru
      else if (totalWeight <= LIMIT_GRU) {
          let baseCost = findPrice('gru', inputs.postiAuto);
          if (baseCost === 0) baseCost = 1300; 

          transportMethod = 'Camion con Gru (Autoscarico)';
          unloadingSurcharge = 100; // una tantum

          // For Camion Gru: Cost + Diaria Driver + Hotel Driver (if Trasferta)
          let driverExtra = 0;
          if (isTrasferta) {
              driverExtra = vars.diaria_squadra_interna + hotelCostPerNight;
          } else {
              driverExtra = vars.diaria_squadra_interna; 
          }

          if (inputs.logistics.isIsland && inputs.logistics.ferryCostTruck > 0) {
             ferryExtra = inputs.logistics.ferryCostTruck;
          }

          shippingCost = baseCost + driverExtra + ferryExtra;
          
          generalLogistics.push({ 
              label: 'Nolo Camion Gru', 
              value: baseCost,
              tooltip: `Logica: Tariffa regione/provincia per Camion Gru (${baseCost}€).`
          });
          generalLogistics.push({ 
              label: 'Supplemento Scarico Gru', 
              value: unloadingSurcharge,
              tooltip: `Logica: Supplemento fisso per operazione di scarico con gru.`
          });
          generalLogistics.push({ 
              label: 'Logistica Autista Gru (Diaria/Hotel)', 
              value: driverExtra,
              tooltip: `Logica: Diaria Autista + eventuale Hotel se in trasferta.`
          });
          if (ferryExtra > 0) {
             generalLogistics.push({ 
                 label: 'Traghetto Camion (A/R)', 
                 value: ferryExtra,
                 details: getSplitCostString(ferryExtra),
                 tooltip: `Logica: Costo Traghetto Bilico/Camion rilevato AI.`
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
              isBold: true,
              tooltip: `Logica: Tariffa Bilico (${baseCost}€) x Numero Mezzi (${numTrucks}). Include tutto.`
          });

          if (ferryExtra > 0) {
             generalLogistics.push({ 
                 label: 'Traghetto Bilico (A/R)', 
                 value: ferryExtra,
                 details: getSplitCostString(ferryExtra),
                 tooltip: `Logica: Costo Traghetto Bilico rilevato AI x Numero Mezzi.`
             });
          }
      }

      transportTotal = shippingCost + unloadingSurcharge;
  } else {
      // Mezzi Pubblici selected -> No Material Transport Costs
      transportMethod = 'Trasporto Materiali Escluso (Viaggio Mezzi Pubblici)';
      generalLogistics.push({
          label: 'Trasporto Materiali',
          value: 0,
          details: 'Non calcolato (Opzione Mezzi Pubblici attiva)',
          tooltip: 'Hai selezionato Mezzi Pubblici per la squadra. Come da richiesta, i costi di Bilico/Gru sono stati esclusi da questo preventivo.'
      });
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
    totalWeight: 0, // Not relevant for display if simplified
    totalHours: totalWorkHours,
    totalDays: daysRequired,
    internalTeamCosts: internalCosts,
    externalTeamCosts: externalCosts,
    generalLogisticsCosts: generalLogistics,
    numZavorre: 0,
    weightZavorre: 0,
    discountAppliedPerc
  };
};