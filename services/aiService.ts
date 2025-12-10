import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { LogisticsData } from '../types';

const AI_ORIGIN_ADDRESS = "Via Disciplina 11, 37036 San Martino Buon Albergo, Verona, Italy";

// Helper to extract JSON from Markdown or text
const cleanJson = (text: string): string => {
  if (!text) return "{}";
  // Find first { and last }
  const firstOpen = text.indexOf('{');
  const lastClose = text.lastIndexOf('}');
  
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      return text.substring(firstOpen, lastClose + 1);
  }
  return text;
};

// Helper to parse error messages for UI
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
        return "Quota API esaurita (Errore 429). Hai raggiunto il limite del piano gratuito.";
    }
    
    if (msg.includes("403") || msg.includes("API key")) {
        return "Chiave API non valida o con restrizioni. Controlla la chiave.";
    }

    if (msg.includes("503") || msg.includes("overloaded")) {
        return "Modello AI sovraccarico (Errore 503). Riprova tra poco.";
    }

    return msg;
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchLogisticsFromAI = async (destination: string, apiKey: string): Promise<LogisticsData> => {
  if (!apiKey) {
    throw new Error("Chiave API mancante. Inseriscila nella schermata iniziale.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Safety settings to prevent blocking valid responses
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ];

  const promptTools = `
    You are a logistics planner. Origin: ${AI_ORIGIN_ADDRESS}. Destination: ${destination}.

    Task: Search the web to find real-time logistics data.
    1. Exact driving distance (KM) and duration.
    2. Average 3-star hotel price per night in destination (single room).
    3. Round Trip (Andata/Ritorno) cost per person for Train (Verona PN -> Dest) and Plane (Verona VRN -> Dest).
    4. Last mile cost (Taxi/Bus).

    Return JSON:
    {
      "distanceKm": number,
      "durationMinutes": number,
      "avgHotelPrice": number,
      "trainPrice": number,
      "planePrice": number,
      "lastMilePrice": number,
      "recommendedMode": "train" | "plane" | "none"
    }
  `;

  // Model Rotation Strategy: Try most capable first, fallback to faster/different load balancers if overloaded.
  // ALWAYS use tools. NEVER estimate.
  const modelsToTry = [
    'gemini-1.5-pro',     // Attempt 1: Best reasoning, usually stable on paid
    'gemini-2.5-flash',   // Attempt 2: Newest flash
    'gemini-1.5-flash'    // Attempt 3: Older flash (different load balancer)
  ];

  let lastError: any = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    console.log(`Logistics Attempt ${i + 1}/${modelsToTry.length} using ${currentModel} with Google Search...`);

    try {
        const response = await ai.models.generateContent({
            model: currentModel,
            contents: promptTools,
            config: {
                tools: [{ googleSearch: {} }],
                safetySettings: safetySettings
            }
        });

        const text = response.text || "";
        const cleaned = cleanJson(text);
        
        try {
            const json = JSON.parse(cleaned);
            return {
                distanceKm: Number(json.distanceKm) || 0,
                durationMinutes: Number(json.durationMinutes) || 0,
                avgHotelPrice: Number(json.avgHotelPrice) || 0,
                trainPrice: Number(json.trainPrice) || 0,
                planePrice: Number(json.planePrice) || 0,
                lastMilePrice: Number(json.lastMilePrice) || 0,
                recommendedMode: json.recommendedMode || 'none',
                fetched: true
            };
        } catch (parseError) {
            console.warn(`JSON Parse error on ${currentModel}:`, text);
            throw new Error("Invalid JSON response");
        }

    } catch (error: any) {
        console.warn(`${currentModel} failed:`, error);
        lastError = error;
        
        const errMsg = String(error);
        
        // If Auth error (403/Key), stop immediately. Do not rotate.
        if (errMsg.includes("403") || errMsg.includes("API key")) {
            throw new Error(parseErrorMessage(error));
        }

        // If it's the last attempt, don't wait, just throw
        if (i < modelsToTry.length - 1) {
             // Wait 2s before trying next model
             await wait(2000);
        }
    }
  }

  // If we reach here, all models failed
  throw new Error(parseErrorMessage(lastError));
};
