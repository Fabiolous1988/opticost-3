import { GoogleGenAI } from "@google/genai";
import { LogisticsData } from '../types';

const AI_ORIGIN_ADDRESS = "Via Disciplina 11, 37036 San Martino Buon Albergo, Verona, Italy";

export const fetchLogisticsFromAI = async (destination: string): Promise<LogisticsData> => {
  if (!process.env.API_KEY) {
    console.warn("No API Key found");
    return {
      distanceKm: 0,
      durationMinutes: 0,
      avgHotelPrice: 100,
      trainPrice: 0,
      planePrice: 0,
      lastMilePrice: 0,
      recommendedMode: 'none',
      fetched: false
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // We use gemini-2.5-flash which supports tools for real-time data.
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
           - Compare Train vs Plane. They should DIFFERENT costs. If they are identical, re-evaluate. 
           - Last Mile: Estimate cost (Taxi/Bus) from the arrival Station/Airport to the final address (One way * 2 for daily commute or just Arrival?). Assume Arrival + Departure from station.

        Return ONLY a raw JSON object with this structure (no markdown):
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
        tools: [{ googleSearch: {} }, { googleMaps: {} }],
      }
    });

    let text = response.text;
    if (!text) throw new Error("No response from AI");
    
    // Sanitize response
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const data = JSON.parse(text);

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
      avgHotelPrice: (typeof data.avgHotelPrice === 'number' && data.avgHotelPrice > 0) ? data.avgHotelPrice : 110, // Fallback if still 0
      trainPrice: typeof data.trainPrice === 'number' ? data.trainPrice : 0,
      planePrice: typeof data.planePrice === 'number' ? data.planePrice : 0,
      lastMilePrice: typeof data.lastMilePrice === 'number' ? data.lastMilePrice : 20,
      recommendedMode: recommended,
      fetched: true
    };

  } catch (error) {
    console.error("AI Logistics Error:", error);
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