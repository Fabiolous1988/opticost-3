import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { LogisticsData } from '../types';

const AI_ORIGIN_ADDRESS = "Via Disciplina 11, 37036 San Martino Buon Albergo, Verona, Italy";

// Helper to extract JSON from Markdown or text
const cleanJson = (text: string): string => {
  if (!text) return "{}";
  const firstOpen = text.indexOf('{');
  const lastClose = text.lastIndexOf('}');
  
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      return text.substring(firstOpen, lastClose + 1);
  }
  return text;
};

// Helper to parse error messages
const parseErrorMessage = (error: any): string => {
    let msg = error?.message || String(error);
    
    // Check if message is a JSON string
    try {
        if (msg.startsWith('{')) {
            const parsed = JSON.parse(msg);
            if (parsed.error?.message) {
                msg = parsed.error.message;
            }
        }
    } catch (e) {
        // ignore json parse error
    }

    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
        return "Quota API esaurita (Errore 429). Hai raggiunto il limite del piano gratuito di Google Gemini. Riprova tra qualche minuto o usa una chiave a pagamento.";
    }
    
    if (msg.includes("403") || msg.includes("API key")) {
        return "Chiave API non valida o con restrizioni. Controlla la chiave e riprova.";
    }

    if (msg.includes("503") || msg.includes("overloaded")) {
        return "Il modello AI è momentaneamente sovraccarico (Errore 503). Riprova tra poco.";
    }

    return msg;
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchLogisticsFromAI = async (destination: string, apiKey: string): Promise<LogisticsData> => {
  if (!apiKey) {
    throw new Error("Chiave API mancante. Inseriscila nella schermata iniziale.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = 'gemini-2.5-flash';

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ];

  const prompt = `
    I am a logistics planner for a company based in Verona (Origin: ${AI_ORIGIN_ADDRESS}).
    Destination: ${destination}

    Task:
    1. Calculate driving distance (KM) and duration (Minutes) from Origin to Destination.
    2. Search for 3-star hotels near the Destination. Estimate the average price per night for a single room. 
       If no specific data, estimate for the region (e.g. 90-130 EUR).
    3. Public Transport Analysis (ROUND TRIP / ANDATA E RITORNO Cost per Person):
       - Train: Estimate ROUND TRIP cost from Verona Porta Nuova to nearest station.
       - Plane: Estimate ROUND TRIP cost from Verona Airport (VRN) to nearest airport.
       - Last Mile: Estimate cost (Taxi/Bus) from Station/Airport to final address.

    Return ONLY a raw JSON object:
    {
      "distanceKm": number,
      "durationMinutes": number,
      "avgHotelPrice": number,
      "trainPrice": number,
      "planePrice": number,
      "lastMilePrice": number
    }
  `;

  // --- ATTEMPT 1: WITH TOOLS (Search) ---
  // Retry loop for overloaded/503 errors
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`AI Attempt 1 (Try ${attempt}/3): Using Google Search Tool...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            safetySettings: safetySettings
          }
        });

        const text = response.text;
        if (!text) throw new Error("Risposta AI vuota (Tentativo 1)");

        return parseResponse