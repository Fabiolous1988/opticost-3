
import { GoogleGenAI } from "@google/genai";
import { LogisticsData, QuoteInputs, GlobalVariables, CalculationResult, ChatMessage, LastMileOption } from '../types';

const AI_ORIGIN_ADDRESS = "Via Disciplina 11, 37036 San Martino Buon Albergo, Verona, Italy";

const cleanJson = (text: string): string => {
  if (!text) return "{}";
  const firstOpen = text.indexOf('{');
  const lastClose = text.lastIndexOf('}');
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      return text.substring(firstOpen, lastClose + 1);
  }
  return text;
};

export const fetchLogisticsFromAI = async (destination: string, startDate?: string): Promise<LogisticsData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Agisci come un analista logistico Pergosolar INFLESSIBILE ed ESPERTO.
  PIANIFICAZIONE VIAGGIO:
  DA: ${AI_ORIGIN_ADDRESS} (Verona)
  A: ${destination}
  DATA PARTENZA: ${startDate || 'prossimo lunedì'}

  REGOLE DI RICERCA TASSATIVE (Usa Google Search per verificare i dati):
  1. HOTEL: Trova un hotel 3/4 stelle REALE a ${destination}. 
     - "avgHotelPrice": Costo medio a notte PER 1 PERSONA.
     - "hotelSource": DEVE ESSERE UN LINK FUNZIONANTE. Se non trovi l'URL esatto dell'hotel, USA SEMPRE: "https://www.booking.com/searchresults.it.html?ss=${encodeURIComponent(destination)}". 
     - TASSATIVO: MAI inventare link profondi (deep links) che potrebbero generare 404. Se hai il minimo dubbio, usa la homepage di Booking.com o la ricerca per città.
  
  2. TRENO/AEREO: 
     - "trainPrice" e "planePrice": Costo biglietto A/R PER 1 PERSONA.
     - "trainSource"/"planeSource": Genera link con parametri di ricerca (es. Trenitalia o Skyscanner con partenza Verona e arrivo ${destination}). Se non sei certo della validità del link parametrizzato, usa la HOMEPAGE ufficiale (es. trenitalia.com).

  3. LAST MILE (STAZIONE/AEROPORTO -> CANTIERE):
     - Fornisci almeno DUE alternative reali e distinte (es. Taxi vs Bus locale, o Noleggio Auto).
     - Per ogni opzione: "type", "price" (TOTALE A/R per 2 persone), "durationMinutes", "details", "sourceUrl".
     - TASSATIVO LINK: Se non trovi il link specifico del servizio locale, USA L'URL DELLA HOMEPAGE del servizio (es. radiotaxi.it) o il link a Google Maps della zona. NO 404.

  RISPONDI SOLO CON QUESTO JSON:
  {
    "distanceKm": number,
    "driveDurationMinutes": number,
    "avgHotelPrice": number,
    "hotelSource": "string",
    "trainPrice": number,
    "trainSource": "string",
    "trainDurationMinutes": number,
    "departureStation": "string",
    "arrivalStation": "string",
    "trainDepartureTime": "HH:mm",
    "planePrice": number,
    "planeSource": "string",
    "planeDurationMinutes": number,
    "departureAirport": "string",
    "arrivalAirport": "string",
    "planeDepartureTime": "HH:mm",
    "lastMileOptions": [
      {
        "type": "string",
        "price": number,
        "durationMinutes": number,
        "details": "string",
        "sourceUrl": "string"
      }
    ],
    "isIsland": boolean,
    "ferryCostVan": number,
    "ferryCostTruck": number,
    "ferrySource": "string",
    "recommendedMode": "train" | "plane" | "none"
  }`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    
    const rawData = JSON.parse(cleanJson(response.text || "{}"));
    
    const lastMileOpts: LastMileOption[] = [];
    
    // Opzione "Nessuno" SEMPRE presente e SEMPRE al primo posto (index 0)
    lastMileOpts.push({
      type: 'Nessuno / Passaggio Privato',
      price: 0,
      durationMinutes: 30,
      details: 'Nessun costo di trasporto locale previsto. La squadra si muove autonomamente o con mezzi del cliente.'
    });

    if (rawData.lastMileOptions && Array.isArray(rawData.lastMileOptions)) {
      rawData.lastMileOptions.forEach((o: any) => {
        // Evitiamo di duplicare opzioni a costo zero se già presenti
        if (o.price > 0 || o.type !== 'Nessuno') {
          lastMileOpts.push({
            type: o.type || 'Alternativa',
            price: Number(o.price) || 0,
            durationMinutes: Number(o.durationMinutes) || 30,
            details: o.details || 'Dettagli non disponibili',
            sourceUrl: o.sourceUrl || ''
          });
        }
      });
    }

    return {
      distanceKm: Number(rawData.distanceKm) || 0,
      driveDurationMinutes: Number(rawData.driveDurationMinutes) || 0,
      avgHotelPrice: Number(rawData.avgHotelPrice) || 120,
      hotelSource: rawData.hotelSource || 'https://www.booking.com',
      trainPrice: Number(rawData.trainPrice) || 0,
      trainSource: rawData.trainSource || 'https://www.trenitalia.com',
      trainDurationMinutes: Number(rawData.trainDurationMinutes) || 0,
      departureStation: rawData.departureStation || 'Verona Porta Nuova',
      arrivalStation: rawData.arrivalStation || 'Stazione Locale',
      trainDepartureTime: rawData.trainDepartureTime || '07:30',
      planePrice: Number(rawData.planePrice) || 0,
      planeSource: rawData.planeSource || 'https://www.skyscanner.it',
      planeDurationMinutes: Number(rawData.planeDurationMinutes) || 0,
      departureAirport: rawData.departureAirport || 'Verona (VRN)',
      arrivalAirport: rawData.arrivalAirport || 'Aeroporto Vicino',
      planeDepartureTime: rawData.planeDepartureTime || '07:00',
      lastMileOptions: lastMileOpts,
      lastMilePrice: lastMileOpts[0].price,
      lastMileDurationMinutes: lastMileOpts[0].durationMinutes,
      lastMileDetails: lastMileOpts[0].details,
      ferryCostVan: Number(rawData.ferryCostVan) || 0,
      ferryCostTruck: Number(rawData.ferryCostTruck) || 0,
      ferrySource: rawData.ferrySource,
      isIsland: Boolean(rawData.isIsland),
      recommendedMode: rawData.recommendedMode || 'none',
      fetched: true
    };
  } catch (e) {
    throw new Error("Errore durante l'analisi logistica AI.");
  }
};

export const getChatResponse = async (
  history: ChatMessage[],
  context: { inputs: QuoteInputs; vars: GlobalVariables; result: CalculationResult | null }
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `Sei l'assistente esperto di OptiCost Pergosolar. 
  
  LOGICA TECNICA SORGENTE:
  1. VIAGGI (Weekend): calculateTripsByWeekend(startDate, workDays). 1 viaggio base + 1 per ogni domenica lavorativa.
  2. RIENTRO HQ (19:00): Se Fine Lavori (17:30) + Viaggio > 19:00, scatta +1 notte hotel e +1 giorno vitto.
  3. PREZZI PER PERSONA: Hotel, vitto e biglietti sono basati sul costo unitario per tecnico.
  4. LAST MILE: L'utente può scegliere tra diverse opzioni, inclusa l'opzione "Nessuno" a costo zero.

  CONTESTO ATTUALE:
  - Indirizzo: ${context.inputs.indirizzoCompleto}
  - Squadra Interna: ${context.inputs.useInternalTechs ? (context.inputs.serviceType === 'ASSISTENZA' ? context.inputs.assistenzaTecniciCount : context.inputs.numInternalTechs) : 0} persone.
  - Giorni totali: ${context.result?.workDays}
  - Last Mile Selezionato: ${context.inputs.logistics.lastMileOptions[context.inputs.selectedLastMileIndex]?.type || 'Nessuno'}

  Sii trasparente e cita i costi per persona. Se vedi link 404 segnalalo all'utente e suggerisci di usare la homepage del fornitore.`;

  const contents = history.map(msg => ({ 
    role: msg.role === 'user' ? 'user' : 'model', 
    parts: [{ text: msg.text }] 
  }));

  try {
    const response = await ai.models.generateContent({ 
      model: 'gemini-3-pro-preview', 
      contents, 
      config: { systemInstruction } 
    });
    return response.text || "Spiacente, non riesco a elaborare la risposta.";
  } catch (e) { 
    throw new Error("Errore comunicazione AI."); 
  }
};
