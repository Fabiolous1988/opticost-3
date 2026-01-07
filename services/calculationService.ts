
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
  let equipmentTotal = 0;
  let transportMethodName = 'Furgone Aziendale';

  // 1. PESI E CAPACITÀ DINAMICHE DAL CSV
  const structureWeight = (modelData.peso_struttura_per_posto * inputs.postiAuto);
  let numZavorre = 0;
  let weightZavorre = 0;
  if (inputs.optZavorre && inputs.postiAuto > 0 && selectedBallast) {
    numZavorre = 1 + Math.ceil(inputs.postiAuto / 2);
    weightZavorre = numZavorre * (selectedBallast.peso_kg || 0);
  }
  const totalWeight = structureWeight + weightZavorre;

  // 2. LOGISTICA
  const distanceKm = inputs.logistics.fetched ? inputs.logistics.distanceKm : 0;
  const isTrasferta = distanceKm > vars.soglia_distanza_trasferta_km;
  const hotelCostPerNight = inputs.logistics.avgHotelPrice || 120;

  // 3. TRASPORTO MATERIALE (Usando limiti dinamici CSV riga per riga)
  const cleanDest = inputs.indirizzoCompleto.trim().toLowerCase(); 
  const rate = transportRates.find(r => cleanDest.includes(r.provincia.toLowerCase()) || cleanDest.includes(r.regione.toLowerCase()));
  const prices = rate?.prices || {};
  
  const capFurgone = modelData.max_pa_furgone || 3;
  const capCamion = modelData.max_pa_camion_gru || 12;
  const capBilico = modelData.max_pa_bilico || 40;

  if (totalWeight < 1000 && inputs.postiAuto <= capFurgone && !inputs.optZavorre) {
      if (inputs.usePublicTransport) {
          const shipping = (distanceKm * 2 * (vars.costo_usura_mezzo_euro_km + 0.12)) + 250;
          generalLogisticsCosts.push({ 
              label: 'Spedizione Materiale (Mezzo dedicato)', value: shipping, isBold: true,
              formula: `(${distanceKm}km * 2 * €${(vars.costo_usura_mezzo_euro_km + 0.12).toFixed(3)}) + €250 quota fissa`,
              tooltip: `Spedizione necessaria perché la squadra viaggia senza furgone.`
          });
          transportTotal += shipping;
      }
      transportMethodName = 'Furgone Aziendale';
  } else if (totalWeight <= 16000 && inputs.postiAuto <= capCamion) {
      let base = prices['Camion con Gru'] || prices['GR'] || 1300;
      let extraZavorre = (numZavorre > 0 ? 250 : 0);
      const craneTotal = base + 100 + extraZavorre;
      generalLogisticsCosts.push({ 
          label: 'Trasporto Camion con Gru', value: craneTotal, isBold: true,
          formula: `Tariffa €${base} + Gestione €100 + Scarico Zavorre €${extraZavorre}`,
          tooltip: `Peso elevato o zavorre presenti. Richiede scarico con gru.`
      });
      transportTotal += craneTotal;
      transportMethodName = 'Camion con Gru';
  } else {
      let base = prices['Bilico 13mt'] || prices['BIL'] || 1600;
      const numTrucks = Math.max(Math.ceil(totalWeight / 24000), Math.ceil(inputs.postiAuto / capBilico));
      const bilicoTotal = base * numTrucks;
      generalLogisticsCosts.push({ 
          label: `Trasporto Bilico 13mt (x${numTrucks})`, value: bilicoTotal, isBold: true,
          formula: `€${base} * ${numTrucks} mezzi necessari`,
          tooltip: `Carico superiore a 16t o superamento capacità Bilico del modello (${capBilico} PA).`
      });
      transportTotal += bilicoTotal;
      transportMethodName = 'Bilico 13mt';
  }

  // 4. ORE LAVORO (LOGICA ADDITIVA TASSATIVA)
  let totalWorkHours = 0;
  let workDays = 0;
  const totalTechs = (inputs.useInternalTechs ? inputs.numInternalTechs : 0) + (inputs.useExternalTechs ? inputs.numExternalTechs : 0);

  if (inputs.serviceType === ServiceType.ASSISTENZA) {
    workDays = inputs.assistenzaGiorni;
    totalWorkHours = workDays * vars.ore_lavoro_giornaliere_standard * inputs.assistenzaTecniciCount;
  } else {
    // 4a. ORE STRUTTURA BASE
    let hpp = modelData.ore_struttura_per_posto;

    // 4b. LOGICA FOTOVOLTAICO + GUARNIZIONI (Somma ore)
    if (inputs.optPannelliFotovoltaici) {
      hpp += modelData.ore_pv_per_posto;
      // Se selezionate guarnizioni, SOMMA ore extra guarnizioni
      if (inputs.optGuarnizioni) {
        hpp += modelData.ore_pv_guarnizioni_per_posto;
      }
    }

    // 4c. ALTRI ACCESSORI (SOMMA PURA)
    if (inputs.optIlluminazioneLED) hpp += modelData.ore_led_per_posto;
    if (inputs.optInstallazioneTelo) hpp += modelData.ore_telo_per_posto;
    if (inputs.optPannelliCoibentati) hpp += modelData.ore_coibentati_per_posto;
    if (inputs.optZavorre) hpp += modelData.ore_zavorre_per_posto;

    const rawH = hpp * inputs.postiAuto;
    const discount = vars.hourly_discounts.find(d => inputs.postiAuto > d.threshold);
    totalWorkHours = rawH * (1 - (discount?.percentage || 0) / 100);
    workDays = inputs.manualInternalWorkDays || (totalTechs > 0 ? Math.ceil(totalWorkHours / (vars.ore_lavoro_giornaliere_standard * totalTechs)) : 0);
  }

  // 5. SQUADRA INTERNA
  let travelDurationOneWay = 0;
  let firstLegDepartureTime = "07:00";
  let firstLegLabel = "PARTENZA DA HQ";
  let siteArrivalTime = "09:00";

  if (inputs.useInternalTechs) {
    const internalTechs = inputs.numInternalTechs;
    const internalWorkHours = totalWorkHours * (totalTechs > 0 ? (internalTechs / totalTechs) : 1);
    const labor = internalWorkHours * vars.costo_orario_tecnico_interno;
    internalCosts.push({ 
        label: 'Manodopera Installazione', value: labor, isBold: true, 
        formula: `${internalWorkHours.toFixed(1)}h * €${vars.costo_orario_tecnico_interno}/h`,
        tooltip: 'Costo orario della squadra interna per montaggio.'
    });

    let trips = (isTrasferta && workDays > 5) ? (1 + Math.floor((workDays - 1) / 5)) : 1;
    if (!isTrasferta) trips = workDays;

    if (inputs.usePublicTransport) {
        const mode = inputs.publicTransportMode;
        const depTime = mode === 'train' ? inputs.logistics.trainDepartureTime : inputs.logistics.planeDepartureTime;
        const dur = mode === 'train' ? inputs.logistics.trainDurationMinutes : inputs.logistics.planeDurationMinutes;
        const lastMileDur = inputs.logistics.lastMileDurationMinutes;
        
        travelDurationOneWay = dur + lastMileDur;
        firstLegDepartureTime = depTime || "08:00";
        firstLegLabel = `PARTENZA ${mode === 'train' ? 'TRENO' : 'AEREO'}`;
        siteArrivalTime = addMinutes(firstLegDepartureTime, travelDurationOneWay);

        const ticket = mode === 'plane' ? inputs.logistics.planePrice : inputs.logistics.trainPrice;
        internalCosts.push({ 
            label: `Biglietti ${mode === 'plane' ? 'Aereo' : 'Treno'} A/R`, value: ticket * 2 * internalTechs * trips,
            formula: `€${ticket} * 2 (A/R) * ${internalTechs} tec * ${trips} viaggi`,
            tooltip: 'Costo totale titoli di viaggio squadra.'
        });
        internalCosts.push({ 
            label: 'Last Mile (Totale Squadra A/R)', value: inputs.logistics.lastMilePrice * trips, 
            formula: `€${inputs.logistics.lastMilePrice} * ${trips} viaggi`,
            tooltip: inputs.logistics.lastMileDetails 
        });
    } else {
        travelDurationOneWay = inputs.logistics.driveDurationMinutes;
        firstLegDepartureTime = "07:00";
        firstLegLabel = "PARTENZA DA HQ (Furgone)";
        siteArrivalTime = addMinutes(firstLegDepartureTime, travelDurationOneWay);
        
        const totalKm = (distanceKm * 2 * trips) + (isTrasferta ? workDays * 30 : 0);
        const fuelWear = totalKm * (vars.costo_usura_mezzo_euro_km + 0.12 + (vars.costo_medio_gasolio_euro_litro / vars.km_per_litro_furgone));
        internalCosts.push({ 
            label: 'Carburante e Usura Mezzo', value: fuelWear,
            formula: `${totalKm.toFixed(0)}km * €${(vars.costo_usura_mezzo_euro_km + 0.12 + (vars.costo_medio_gasolio_euro_litro / vars.km_per_litro_furgone)).toFixed(3)}/km`,
            tooltip: 'Costo chilometrico reale incluso usura e carburante.'
        });
    }

    const travelLabor = (travelDurationOneWay / 60) * 2 * trips * internalTechs * vars.costo_orario_tecnico_interno;
    internalCosts.push({ 
        label: 'Manodopera Viaggio', value: travelLabor,
        formula: `${((travelDurationOneWay / 60) * 2).toFixed(1)}h a/r * ${trips} viaggi * ${internalTechs} tec * €${vars.costo_orario_tecnico_interno}/h`,
        tooltip: 'Costo orario del tempo di viaggio tecnici.'
    });

    if (isTrasferta || workDays > 1) {
        const diarie = internalTechs * vars.diaria_squadra_interna * workDays;
        internalCosts.push({ 
            label: 'Diarie e Vitto', value: diarie,
            formula: `€${vars.diaria_squadra_interna} * ${workDays}gg * ${internalTechs} tec`,
            tooltip: 'Pasti e indennità trasferta tecnici.'
        });
        if (isTrasferta) {
            const hotelCost = Math.max(0, workDays - 1) * internalTechs * hotelCostPerNight;
            internalCosts.push({ 
                label: 'Soggiorno Hotel', value: hotelCost,
                formula: `€${hotelCostPerNight} * ${Math.max(0, workDays - 1)} notti * ${internalTechs} tec`,
                tooltip: 'Pernottamento hotel vicino cantiere.'
            });
        }
    }
  }

  if (inputs.useExternalTechs) {
    const extH = totalWorkHours * (totalTechs > 0 ? (inputs.numExternalTechs / totalTechs) : 1);
    const laborExt = extH * vars.costo_orario_squadra_esterna;
    externalCosts.push({ 
        label: 'Manodopera Squadra Esterna', value: laborExt, isBold: true,
        formula: `${extH.toFixed(1)}h * €${vars.costo_orario_squadra_esterna}/h`,
        tooltip: 'Costo manodopera ditta esterna.'
    });
    if (!inputs.externalIsLocal) {
        const diariaExt = inputs.numExternalTechs * vars.diaria_squadra_esterna * workDays;
        externalCosts.push({ 
            label: 'Trasferta Squadra Esterna', value: diariaExt,
            formula: `€${vars.diaria_squadra_esterna} * ${workDays}gg * ${inputs.numExternalTechs} tec`,
            tooltip: 'Diarie per squadra esterna non locale.'
        });
    }
  }

  if (!inputs.clientHasForklift) {
      const rental = vars.costo_noleggio_muletto_base + Math.max(0, workDays - 5) * vars.costo_noleggio_muletto_extra;
      generalLogisticsCosts.push({ 
          label: 'Noleggio Muletto Scarico', value: rental,
          formula: `Base €${vars.costo_noleggio_muletto_base} + Extra €${Math.max(0, workDays - 5) * vars.costo_noleggio_muletto_extra}`,
          tooltip: 'Noleggio muletto locale per scarico materiale.'
      });
      equipmentTotal += rental;
  }

  let extraCostsTotal = 0;
  inputs.extraCosts.forEach(e => { extraCostsTotal += e.value; });

  const totalCost = internalCosts.reduce((a,b)=>a+b.value,0) + externalCosts.reduce((a,b)=>a+b.value,0) + transportTotal + equipmentTotal + extraCostsTotal;

  const schedule = [
    `${firstLegLabel}: ${formatDateWithTime(inputs.startDate, 0, firstLegDepartureTime)}`,
    `ARRIVO IN CANTIERE: ${formatDateWithTime(inputs.startDate, 0, siteArrivalTime)}`,
    `FINE LAVORI PREVISTA: ${formatDateWithTime(inputs.startDate, workDays-1, "17:30")}`,
    `RIENTRO PREVISTO HQ: ${formatDateWithTime(inputs.startDate, workDays-1, addMinutes("17:30", travelDurationOneWay))}`
  ];

  return {
    totalCost,
    sellPrice: totalCost * (1 + vars.margine_percentuale_installazione / 100),
    totalEquipmentRental: equipmentTotal,
    totalTransportAndTravel: 0, 
    totalManpower: 0,           
    installationTotal: 0, transportTotal, equipmentTotal, extraCostsTotal,
    transportMethod: transportMethodName, structureWeight, totalWeight, totalHours: totalWorkHours, totalDays: workDays, workDays,
    workSchedule: schedule, internalTeamCosts: internalCosts, externalTeamCosts: externalCosts, generalLogisticsCosts,
    numZavorre, weightZavorre, discountAppliedPerc: 0
  };
};
