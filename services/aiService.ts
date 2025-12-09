import { GoogleGenAI } from "@google/genai";
import { LogisticsData } from '../types';

const AI_ORIGIN_ADDRESS = "Via Disciplina 11, 37036 San Martino Buon Albergo, Verona, Italy";

// Helper to extract JSON from Markdown or text
const cleanJson = (text: string): string => {
  // Finds the first occurrence of { ... } including nested braces if possible, 
  // but simple regex for outermost { } usually suffices for Gemini JSON mode.
  // We match from the first { to the last }
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
};

export const fetchLogisticsFromAI = async (destination: string, apiKey: string): Promise<LogisticsData> => {
  // STRICT CHECK: If no key is passed, we cannot proceed.
  // We do NOT check process.env here to avoid deployment crashes.
  if (!apiKey) {
    console.warn("No API Key provided to fetchLogisticsFromAI");
    return {
      distanceKm: 0,
      durationMinutes: 0,
      avgHotelPrice: 110,
      trainPrice: 0,
      planePrice: 0,
      lastMilePrice: 0,
      recommendedMode: 'none',
      fetched: false
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // We use googleSearch to get real world data for distance and prices
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        I am a logistics planner for a company based in Verona (Origin: ${AI_ORIGIN_ADDRESS}).
        Destination: ${destination}

        Task:
        1. Calculate driving distance (KM) and duration (Minutes) from Origin to Destination.
        2. Search for 3-star hotels near the Destination. Estimate the average price per night for a single room. 
           IMPORTANT: If no specific hotel data is found, provide a realistic estimate for that region (e.g. 90-130 EUR). Do not return 0.
        3. Public Transport Analysis (ROUND TRIP / ANDATA E RITORNO Cost per Person):
           - Train: Search for actual train ticket prices from Verona Porta Nuova to the nearest major station. Estimate ROUND TRIP cost.
           - Plane: Search for actual flight prices from Verona Airport (VRN) (or nearby like Venice/Bergamo if VRN is limited) to the nearest airport. Estimate ROUND TRIP cost.
           - Compare Train vs Plane. They MUST have DIFFERENT costs based on real data.
           - Last Mile: Estimate cost (Taxi/Bus) from the arrival Station/Airport to the final address (Round Trip).

        Return ONLY a raw JSON object with this structure (no markdown code blocks):
        {
          "distanceKm": number,
          "durationMinutes": number,
          "avgHotelPrice": number,
          "trainPrice": number,
          "planePrice": number,
          "lastMilePrice": number
        }
      `,
      config: {
        tools: [{ googleSearch: {} }],
        // Note: responseMimeType: 'application/json' is NOT used with tools to avoid errors.
        // We parse the text manually.
      }
    });

    let text = response.text;
    if (!text) throw new Error("No response text from AI");
    
    // Robust JSON extraction
    const jsonStr = cleanJson(text);
    let data;
    try {
        data = JSON.parse(jsonStr);
    } catch (e) {
        console.error("Failed to parse AI JSON:", jsonStr);
        throw new Error("Invalid JSON format from AI");
    }

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

  } catch (error) {
    console.error("AI Logistics Error:", error);
    // Return a failed state but don't crash the app
    return {
      distanceKm: 0,
      durationMinutes: 0,
      avgHotelPrice: 110,
      trainPrice: 0,
      planePrice: 0,
      lastMilePrice: 0,
      recommendedMode: 'none',
      fetched: false
    };
  }
};