
import { QuoteInputs, GlobalVariables, TransportRate, ServiceType, CalculationResult, ModelData, BallastData, DetailedCostBreakdown } from '../types';

const addMinutes = (timeStr: string, minutes: number): string => {
  const [h, m] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m + minutes);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const formatDateWithTime = (baseDateStr: string, offsetDays: number, timeStr: string): string => {
  const date = new Date(baseDateStr);
  date.setDate(date.getDate() + offsetDays);
  return `${date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}, ore ${timeStr}`;
};

const calculateTripsByWeekend = (startDateStr: string, workDays: number, isTrasferta: boolean): number => {
  if (!isTrasferta || workDays <= 0) return workDays > 0 ? 1 : 0;
  let trips = 1;
  let currentDate = new Date(startDateStr);
  let daysFound = 0;
  while (daysFound < workDays) {
    const dayOfWeek = currentDate.getDay(); 
    if (dayOfWeek !== 0 && dayOfWeek !== 6) daysFound++;
    if (dayOfWeek === 0 && daysFound < workDays) trips++;
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return trips;
};

export const calculateQuote = (
  inputs: QuoteInputs,
  vars: GlobalVariables,
  transportRates: TransportRate[],
  modelData: ModelData,
  selectedBallast: BallastData | undefined
): CalculationResult => {
  const internalCosts: DetailedCostBreakdown[] = [];
  const externalCosts: DetailedCostBreakdown[] = [];
  const generalLogisticsCosts: DetailedCostBreakdown[] = [];
  let transportTotal = 0;
  let transportMethodName = inputs.serviceType === ServiceType.ASSISTENZA ? 'Solo Trasferta Squadra' : 'Furgone Aziendale';
  const isAssistenza = inputs.serviceType === ServiceType.ASSISTENZA;
  const structureWeight = isAssistenza ? 0 : (modelData.peso_struttura_per_posto * inputs.postiAuto);
  let numZavorre = 0;
  let weightZavorre = 0;
  if (!isAssistenza && inputs.optZavorre && inputs.postiAuto > 0 && selectedBallast) {
    numZavorre = 1 + Math.ceil(inputs.postiAuto / 2);
    weightZavorre = numZavorre * (selectedBallast.peso_kg || 0);
  }
  const totalWeight = structureWeight + weightZavorre;
  const distanceKm = inputs.logistics.fetched ? inputs.logistics.distanceKm : 0;
  const isTrasferta = distanceKm > vars.soglia_distanza_trasferta_km;
  const hotelCostPerNight = inputs.logistics.avgHotelPrice || 120;
  let totalWorkHours = 0;
  let workDays = 0;
  const internalTechs = inputs.useInternalTechs ? (isAssistenza ? inputs.assistenzaTecniciCount : inputs.numInternalTechs) : 0;
  const externalTechs = inputs.useExternalTechs ? inputs.numExternalTechs : 0;
  const totalTechs = internalTechs + externalTechs;

  if (isAssistenza) {
    workDays = inputs.assistenzaGiorni;
    totalWorkHours = workDays * vars.ore_lavoro_giornaliere_standard * totalTechs;
  } else {
    let hpp = modelData.ore_struttura_per_posto;
    if (inputs.optPannelliFotovoltaici) {
      hpp += modelData.ore_pv_per_posto;
      if (inputs.optGuarnizioni) hpp += modelData.ore_pv_guarnizioni_per_posto;
    }
    if (inputs.optIlluminazioneLED) hpp += vars.ore_led_per_posto_global || modelData.ore_led_per_posto;
    if (inputs.optInstallazioneTelo) hpp += modelData.ore_telo_per_posto;
    if (inputs.optPannelliCoibentati) hpp += modelData.ore_coibentati_per_posto;
    if (inputs.optZavorre) hpp += modelData.ore_zavorre_per_posto;
    const rawH = hpp * inputs.postiAuto;
    const discount = vars.hourly_discounts.find(d => inputs.postiAuto > d.threshold);
    totalWorkHours = rawH * (1 - (discount?.percentage || 0) / 100);
    workDays = inputs.manualInternalWorkDays || (totalTechs > 0 ? Math.ceil(totalWorkHours / (vars.ore_lavoro_giornaliere_standard * totalTechs)) : 0);
  }

  if (!isAssistenza) {
    const cleanDest = inputs.indirizzoCompleto.trim().toLowerCase(); 
    const rate = transportRates.find(r => cleanDest.includes(r.provincia.toLowerCase()) || cleanDest.includes(r.regione.toLowerCase()));
    const prices = rate?.prices || {};
    const capFurgone = modelData.max_pa_furgone || 3;
    const capCamion = modelData.max_pa_camion_gru || 12;
    if (totalWeight < 1000 && inputs.postiAuto <= capFurgone && !inputs.optZavorre) {
      if (inputs.usePublicTransport) {
        const shipping = (distanceKm * 2 * (vars.costo_usura_mezzo_euro_km + 0.12)) + 250;
        generalLogisticsCosts.push({ 
          label: 'Spedizione Materiale (Mezzo dedicato)', value: shipping, isBold: true,
          formula: `(${distanceKm}km * 2 * €${(vars.costo_usura_mezzo_euro_km + 0.12).toFixed(3)}) + €250 quota fissa`,
          tooltip: `Spedizione tramite furgone aziendale mentre la squadra viaggia con mezzi pubblici.`
        });
        transportTotal += shipping;
      }
      transportMethodName = 'Furgone Aziendale';
    } else if (totalWeight <= 16000 && (inputs.postiAuto <= capCamion || inputs.optZavorre)) {
      const costKm = distanceKm * 2 * 2.2;
      const totalTruckDuration = ((distanceKm * 2) / 70) + 2;
      let truckHotelCost = 0;
      if (totalTruckDuration > 13 || inputs.extraDaysCamionGru > 0) truckHotelCost = (inputs.extraDaysCamionGru > 0 ? inputs.extraDaysCamionGru : 1) * 100;
      const craneTotal = costKm + truckHotelCost;
      generalLogisticsCosts.push({ label: 'Trasporto Camion con Gru', value: craneTotal, isBold: true, formula: `${distanceKm * 2}km * €2.2/km ${truckHotelCost > 0 ? '+ €' + truckHotelCost + ' Hotel' : ''}` });
      transportTotal += craneTotal;
      transportMethodName = 'Camion con Gru';
    } else {
      let base = prices['Bilico 13mt'] || prices['BIL'] || 1600;
      const numTrucks = Math.max(Math.ceil(totalWeight / 24000), Math.ceil(inputs.postiAuto / (modelData.max_pa_bilico || 40)));
      transportTotal += base * numTrucks;
      generalLogisticsCosts.push({ label: `Trasporto Bilico 13mt (x${numTrucks})`, value: base * numTrucks, isBold: true });
      transportMethodName = 'Bilico 13mt';
    }
  }

  // Fix: Add missing 'type' property to the fallback object for selectedLastMile to satisfy TypeScript requirements.
  const selectedLastMile = inputs.logistics.lastMileOptions[inputs.selectedLastMileIndex] || { type: 'N/A', price: 0, durationMinutes: 30, details: '' };
  const trips = calculateTripsByWeekend(inputs.startDate, workDays, isTrasferta);
  let travelDurationOneWay = inputs.usePublicTransport 
    ? (inputs.publicTransportMode === 'train' ? inputs.logistics.trainDurationMinutes : inputs.logistics.planeDurationMinutes) + selectedLastMile.durationMinutes
    : inputs.logistics.driveDurationMinutes;
  const arrivalTimeMins = (17 * 60 + 30) + travelDurationOneWay;
  const needsExtraNightForReturn = isTrasferta && arrivalTimeMins > 1140;

  if (inputs.useInternalTechs && internalTechs > 0) {
    const internalWorkHours = isAssistenza ? (workDays * vars.ore_lavoro_giornaliere_standard * internalTechs) : (totalWorkHours * (totalTechs > 0 ? (internalTechs / totalTechs) : 1));
    internalCosts.push({ 
      label: isAssistenza ? `Manodopera (${internalTechs} tec)` : 'Manodopera Interna', 
      value: internalWorkHours * vars.costo_orario_tecnico_interno, 
      isBold: true, 
      formula: `${internalWorkHours.toFixed(1)}h * €${vars.costo_orario_tecnico_interno}/h`,
      tooltip: `Costo orario interno: €${vars.costo_orario_tecnico_interno}/h. Calcolato su un totale di ${internalWorkHours.toFixed(1)} ore uomo.`
    });
    if (inputs.usePublicTransport) {
      const mode = inputs.publicTransportMode;
      const ticket = mode === 'plane' ? inputs.logistics.planePrice : inputs.logistics.trainPrice;
      internalCosts.push({ 
        label: `Biglietti ${mode === 'plane' ? 'Aereo' : 'Treno'} A/R`, value: ticket * 2 * internalTechs * trips,
        formula: `€${ticket} (Prezzo pers. A/R) x ${internalTechs} tec x ${trips} viaggi`,
        tooltip: `Costo individuale A/R stimato: €${ticket}. Include tutti i viaggi di rientro weekend previsti.`
      });
      internalCosts.push({ 
        label: `Last Mile (${selectedLastMile.type})`, value: selectedLastMile.price * trips,
        formula: `€${selectedLastMile.price} (Tot. Squadra A/R) x ${trips} viaggi`,
        tooltip: `Dettagli tratta finale selezionata: ${selectedLastMile.details}`
      });
    } else {
      const totalKm = (distanceKm * 2 * trips) + (isTrasferta ? workDays * 30 : 0);
      const kmCost = vars.costo_usura_mezzo_euro_km + 0.12 + (vars.costo_medio_gasolio_euro_litro / vars.km_per_litro_furgone);
      internalCosts.push({ label: 'Carburante e Usura Mezzo', value: totalKm * kmCost, formula: `${totalKm}km tot. x €${kmCost.toFixed(3)}/km` });
    }
    internalCosts.push({ 
      label: 'Manodopera Viaggio', value: (travelDurationOneWay / 60) * 2 * trips * internalTechs * vars.costo_orario_tecnico_interno,
      tooltip: `Retribuzione tempo di viaggio: ${(travelDurationOneWay/60).toFixed(1)}h a tratta per ${internalTechs} tecnici.`
    });
    if (isTrasferta || workDays > 1) {
      const foodDays = workDays + (needsExtraNightForReturn ? 1 : 0);
      const hotelNights = Math.max(0, (workDays - 1) - (trips - 1) * 2) + (needsExtraNightForReturn ? 1 : 0);
      internalCosts.push({ 
        label: 'Diarie e Vitto', value: internalTechs * vars.diaria_squadra_interna * foodDays,
        formula: `€${vars.diaria_squadra_interna} x ${internalTechs} tec x ${foodDays} gg`,
        tooltip: `Vitto per persona: €${vars.diaria_squadra_interna}/gg. ${needsExtraNightForReturn ? 'Include +1 giorno per rientro posticipato.' : ''}`
      });
      if (isTrasferta) internalCosts.push({ 
        label: 'Soggiorno Hotel', value: hotelNights * internalTechs * hotelCostPerNight,
        formula: `€${hotelCostPerNight} x ${internalTechs} tec x ${hotelNights} notti`,
        tooltip: `Pernottamento hotel: €${hotelCostPerNight}/notte per persona. ${needsExtraNightForReturn ? 'Include +1 notte per rientro tardivo (>19:00).' : ''}`
      });
    }
  }

  if (inputs.useExternalTechs && externalTechs > 0) {
    const extWorkH = isAssistenza ? (workDays * vars.ore_lavoro_giornaliere_standard * externalTechs) : (totalWorkHours * (totalTechs > 0 ? (externalTechs / totalTechs) : 0));
    externalCosts.push({ 
      label: 'Manodopera Squadra Esterna', value: extWorkH * vars.costo_orario_squadra_esterna, isBold: true,
      tooltip: `Costo orario esterno: €${vars.costo_orario_squadra_esterna}/h per ${extWorkH.toFixed(1)} ore.`
    });
    if (!inputs.externalIsLocal) externalCosts.push({ 
      label: 'Trasferta Squadra Esterna', value: externalTechs * vars.diaria_squadra_esterna * workDays,
      tooltip: `Diaria esterna: €${vars.diaria_squadra_esterna}/gg per ${externalTechs} tecnici.`
    });
  }

  const equipmentRental = isAssistenza ? 0 : (inputs.clientHasForklift ? 0 : 700);
  const returnDayOffset = (workDays - 1) + (needsExtraNightForReturn ? 1 : 0);
  const totalCost = internalCosts.reduce((a,b)=>a+b.value,0) + externalCosts.reduce((a,b)=>a+b.value,0) + transportTotal + equipmentRental + inputs.extraCosts.reduce((a,b)=>a+b.value,0);

  return {
    totalCost, sellPrice: totalCost * (1 + vars.margine_percentuale_installazione / 100),
    totalEquipmentRental: equipmentRental, totalTransportAndTravel: transportTotal, 
    totalManpower: internalCosts.reduce((a,b)=>a+b.value,0) + externalCosts.reduce((a,b)=>a+b.value,0),           
    installationTotal: 0, transportTotal, equipmentTotal: equipmentRental, extraCostsTotal: inputs.extraCosts.reduce((a,b)=>a+b.value,0),
    transportMethod: transportMethodName, structureWeight, totalWeight, totalHours: totalWorkHours, totalDays: workDays, workDays,
    workSchedule: [
      `PARTENZA: ${formatDateWithTime(inputs.startDate, 0, inputs.usePublicTransport ? (inputs.publicTransportMode === 'train' ? inputs.logistics.trainDepartureTime||'08:00' : inputs.logistics.planeDepartureTime||'07:00') : "07:00")}`,
      `ARRIVO CANTIERE: ${formatDateWithTime(inputs.startDate, 0, addMinutes("07:00", travelDurationOneWay))}`,
      `FINE LAVORI: ${formatDateWithTime(inputs.startDate, workDays-1, "17:30")}`,
      needsExtraNightForReturn ? `PERNOTTAMENTO EXTRA: Rientro HQ posticipato alla mattina dopo (Arrivo HQ > 19:00).` : null,
      `RIENTRO HQ: ${formatDateWithTime(inputs.startDate, returnDayOffset, needsExtraNightForReturn ? addMinutes("07:00", travelDurationOneWay) : addMinutes("17:30", travelDurationOneWay))}`
    ].filter(Boolean) as string[], 
    internalTeamCosts: internalCosts, externalTeamCosts: externalCosts, generalLogisticsCosts,
    numZavorre, weightZavorre, discountAppliedPerc: 0
  };
};
