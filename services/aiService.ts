
import { GoogleGenAI } from "@google/genai";
import { LogisticsData, QuoteInputs, GlobalVariables, CalculationResult, ChatMessage } from '../types';

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

// Removed unused apiKey parameter - SDK must use process.env.API_KEY
export const fetchLogisticsFromAI = async (destination: string, startDate?: string): Promise<LogisticsData> => {
  // Always initialize with process.env.API_KEY as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Agisci come un esperto logistico senior INFLESSIBILE. Pianifica il viaggio per 2 tecnici Pergosolar.
  PARTENZA: ${AI_ORIGIN_ADDRESS} (Verona Porta Nuova)
  DESTINAZIONE: ${destination}
  DATA: ${startDate || 'prossimo lunedì'}

  REGOLE DI RICERCA TASSATIVE (Usa Google Search):
  1. KM E TEMPO AUTO: Distanza stradale e tempo guida reali.
  2. HOTEL: Prezzo REALE camera doppia/2 singole 3* a ${destination}. Metti URL Fonte funzionante.
  3. TRENO: 
     - Cerca treni da Verona Porta Nuova alla stazione più vicina a ${destination}.
     - ORARIO PARTENZA: Solo treni dalle 07:00 del mattino in poi. 
     - Riporta orario esatto, durata e Prezzo A/R totale per 1 persona.
  4. AEREO:
     - Cerca voli da VRN o BGY. 
     - SE NON ESISTE UN VOLO DIRETTO O SENSATO (es. Verona-Milano), scrivi Prezzo 0 e "N/A". NON INVENTARE ROTTE.
  5. LAST MILE:
     - Tragitto stazione/aeroporto -> cantiere.
     - "lastMilePrice" = COSTO TOTALE SQUADRA (2 PERSONE) ANDATA E RITORNO.

  RESTITUISCI SOLO JSON:
  {
    "distanceKm": number,
    "driveDurationMinutes": number,
    "avgHotelPrice": number,
    "hotelSource": "URL",
    "trainPrice": number,
    "trainSource": "URL",
    "trainDurationMinutes": number,
    "departureStation": "string",
    "arrivalStation": "string",
    "trainDepartureTime": "HH:mm",
    "planePrice": number,
    "planeSource": "URL",
    "planeDurationMinutes": number,
    "departureAirport": "string",
    "arrivalAirport": "string",
    "planeDepartureTime": "HH:mm",
    "lastMilePrice": number,
    "lastMileDurationMinutes": number,
    "lastMileDetails": "string dettagliata",
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
    
    return {
      distanceKm: Number(rawData.distanceKm) || 0,
      driveDurationMinutes: Number(rawData.driveDurationMinutes) || 0,
      avgHotelPrice: Number(rawData.avgHotelPrice) || 120,
      hotelSource: rawData.hotelSource,
      trainPrice: Number(rawData.trainPrice) || 0,
      trainSource: rawData.trainSource,
      trainDurationMinutes: Number(rawData.trainDurationMinutes) || 0,
      departureStation: rawData.departureStation || 'Verona Porta Nuova',
      arrivalStation: rawData.arrivalStation || 'N/D',
      trainDepartureTime: rawData.trainDepartureTime || '07:30',
      planePrice: Number(rawData.planePrice) || 0,
      planeSource: rawData.planeSource,
      planeDurationMinutes: Number(rawData.planeDurationMinutes) || 0,
      departureAirport: rawData.departureAirport || 'Verona (VRN)',
      arrivalAirport: rawData.arrivalAirport || 'N/D',
      planeDepartureTime: rawData.planeDepartureTime || '07:00',
      lastMilePrice: Number(rawData.lastMilePrice) || 0,
      lastMileDurationMinutes: Number(rawData.lastMileDurationMinutes) || 30,
      lastMileDetails: rawData.lastMileDetails || 'Trasporto locale',
      ferryCostVan: Number(rawData.ferryCostVan) || 0,
      ferryCostTruck: Number(rawData.ferryCostTruck) || 0,
      ferrySource: rawData.ferrySource,
      isIsland: Boolean(rawData.isIsland),
      recommendedMode: rawData.recommendedMode || 'none',
      fetched: true
    };
  } catch (e) {
    throw new Error("Errore durante la ricerca logistica reale.");
  }
};

/**
 * Generates a response from the AI assistant for the chat interface.
 * Uses current quote context to provide accurate and personalized explanations.
 */
// Removed unused apiKey parameter - SDK must use process.env.API_KEY
export const getChatResponse = async (
  history: ChatMessage[],
  context: { inputs: QuoteInputs; vars: GlobalVariables; result: CalculationResult | null }
): Promise<string> => {
  // Always initialize with process.env.API_KEY as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `Sei l'assistente virtuale esperto di Pergosolar OptiCost. 
  Il tuo compito è spiegare i calcoli del preventivo, i costi logistici e fornire consulenza tecnica sulla posa.
  
  DATI CORRENTI DEL PREVENTIVO:
  - Modello Struttura: ${context.inputs.modello}
  - Posti Auto: ${context.inputs.postiAuto}
  - Peso Totale Stimato: ${context.result?.totalWeight || 0} kg
  - Mezzo di Trasporto: ${context.result?.transportMethod || 'N/D'}
  - Prezzo di Vendita (ivato/margine): €${context.result?.sellPrice.toLocaleString('it-IT') || '0'}
  - Costo Vivo Aziendale: €${context.result?.totalCost.toLocaleString('it-IT') || '0'}
  - Giorni di Cantiere Previsti: ${context.result?.totalDays || 0}
  - Distanza Cantiere: ${context.inputs.logistics.distanceKm || 0} km
  
  Configurazione Squadre:
  - Tecnici Interni: ${context.inputs.useInternalTechs ? context.inputs.numInternalTechs : 0}
  - Tecnici Esterni: ${context.inputs.useExternalTechs ? context.inputs.numExternalTechs : 0}
  
  Opzioni Installate:
  - Moduli Fotovoltaici: ${context.inputs.optPannelliFotovoltaici ? 'SI' : 'NO'}
  - Illuminazione LED: ${context.inputs.optIlluminazioneLED ? 'SI' : 'NO'}
  - Telo PVC: ${context.inputs.optInstallazioneTelo ? 'SI' : 'NO'}
  - Pannelli Coibentati: ${context.inputs.optPannelliCoibentati ? 'SI' : 'NO'}
  - Zavorre Cemento: ${context.inputs.optZavorre ? 'SI (' + context.result?.numZavorre + ' pezzi)' : 'NO'}

  LINEE GUIDA PER LA RISPOSTA:
  1. Sii professionale, tecnico ma colloquiale.
  2. Spiega SEMPRE il "perché" di un costo se richiesto (es. perché il bilico? Perché il peso supera le 16 tonnellate).
  3. Usa i dati del preventivo forniti sopra per essere preciso.
  4. Se l'utente chiede come risparmiare, suggerisci l'uso di squadre esterne locali o l'ottimizzazione del numero di posti auto per sfruttare gli sconti quantità (se presenti nelle variabili).`;

  // Map the application chat history to the format required by the Google GenAI SDK
  const contents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
      }
    });
    
    return response.text || "Non ho potuto generare una risposta valida in questo momento.";
  } catch (e) {
    console.error("AI Chat Error:", e);
    throw new Error("Errore durante la comunicazione con l'assistente AI.");
  }
};
