import { GoogleGenAI } from "@google/genai";
import { LogisticsData } from '../types';

const AI_ORIGIN_ADDRESS = "Via Disciplina 11, 37036 San Martino Buon Albergo, Verona, Italy";

// Helper to extract JSON from Markdown or text
const cleanJson = (text: string): string => {
  if (!text) return "{}";
  // Finds the first occurrence of { ... } including nested braces if possible.
  // We match from the first { to the last } to handle code blocks like ```json ... ```
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
};

export const fetchLogisticsFromAI = async (destination: string, apiKey: string): Promise<LogisticsData> => {
  // STRICT CHECK: If no key is passed, we cannot proceed.
  if (!apiKey) {
    console.warn("No API Key provided to fetchLogisticsFromAI");
    return createEmptyLogistics(false);
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = 'gemini-2.5-flash';

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

  // --- ATTEMPT 1: WITH GOOGLE SEARCH TOOLS ---
  try {
    console.log("AI Attempt 1: Using Google Search Tool...");
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response text from AI (Tool)");

    return parseResponse(text);

  } catch (error) {
    console.warn("AI Attempt 1 (Tools) Failed:", error);
    
    // --- ATTEMPT 2: FALLBACK (PURE ESTIMATION) ---
    try {
      console.log("AI Attempt 2: Fallback to Estimation (No Tools)...");
      const fallbackPrompt = prompt + `\n\nIMPORTANT: Since external search is unavailable, please ESTIMATE these values based on your internal knowledge of geography and pricing. Be realistic.`;
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: fallbackPrompt,
        // No tools config here
      });

      const text = response.text;
      if (!text) throw new Error("Empty response text from AI (Fallback)");

      return parseResponse(text);

    } catch (fallbackError) {
      console.error("AI Attempt 2 (Fallback) Failed:", fallbackError);
      return createEmptyLogistics(false);
    }
  }
};

// Helper to parse the JSON response
const parseResponse = (text: string): LogisticsData => {
  try {
    const jsonStr = cleanJson(text);
    const data = JSON.parse(jsonStr);

    // Determine recommended mode
    let recommended: 'train' | 'plane' | 'none' = 'none';
    if (data.trainPrice > 0 || data.planePrice > 0) {
        if (data.planePrice > 0 && data.planePrice < data.trainPrice) {
            recommended = 'plane';
        } else if (data.trainPrice > 0) {
            recommended = 'train';
        }
    }

    return {
      distanceKm: typeof data.distanceKm === 'number' ? data.distanceKm : 0,
      durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : 0,
      avgHotelPrice: (typeof data.avgHotelPrice === 'number' && data.avgHotelPrice > 0) ? data.avgHotelPrice : 110, 
      trainPrice: typeof data.trainPrice === 'number' ? data.trainPrice : 0,
      planePrice: typeof data.planePrice === 'number' ? data.planePrice : 0,
      lastMilePrice: typeof data.lastMilePrice === 'number' ? data.lastMilePrice : 20,
      recommendedMode: recommended,
      fetched: true
    };
  } catch (e) {
    console.error("JSON Parse Error:", e, "Input text:", text);
    throw e;
  }
};

const createEmptyLogistics = (fetched: boolean): LogisticsData => ({
  distanceKm: 0,
  durationMinutes: 0,
  avgHotelPrice: 110,
  trainPrice: 0,
  planePrice: 0,
  lastMilePrice: 0,
  recommendedMode: 'none',
  fetched: fetched
});
