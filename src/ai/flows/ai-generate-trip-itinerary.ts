'use server';
/**
 * @fileOverview Generates a trip itinerary using the OpenRouter API.
 */

// These types are based on the previous definitions for compatibility.
export interface GenerateItineraryInput {
  tripId: string;
  title: string;
  destinations: string[];
  startDate: string;
  endDate: string;
  travelers: any;
  preferences: any;
}

export type Event = {
    type: 'visit' | 'meal' | 'transport' | 'accommodation' | 'activity';
    title: string;
    description?: string;
    startTime: string; // "HH:mm"
    durationMinutes?: number;
    locationName?: string;
    lat?: number;
    lng?: number;
};

export type DayPlan = {
    date: string; // "YYYY-MM-DD"
    location: string;
    events: Event[];
};

export type GenerateItineraryOutput = DayPlan[];


const promptTemplate = (input: GenerateItineraryInput) => `
You are an expert travel planner AI. Your task is to generate a detailed day-by-day itinerary for a trip.

**Trip Details:**
- **Title:** ${input.title}
- **Destinations:** ${input.destinations.join(', ')}
- **Dates:** ${input.startDate} to ${input.endDate}
- **Travelers:** ${JSON.stringify(input.travelers)}
- **Preferences:** ${JSON.stringify(input.preferences)}

**Instructions:**
1.  Create a plausible and engaging itinerary for the entire duration of the trip.
2.  Each day should have a series of events (activities, meals, transport, etc.).
3.  For each event, provide a type, title, start time, and other relevant details like location.
4.  The final output MUST be a valid JSON object with a single key "itinerary" that contains an array of day objects. Do not include any text, markdown, or explanations outside of the JSON structure.

**JSON Output Schema:**
The output must be a JSON object with the following structure:
\`\`\`json
{
  "itinerary": [
    {
      "date": "YYYY-MM-DD",
      "location": "City, Country",
      "events": [
        {
          "type": "activity",
          "title": "Event Title",
          "startTime": "HH:mm",
          "durationMinutes": 60,
          "description": "Brief description of the event.",
          "locationName": "Specific location name",
          "lat": 48.8584,
          "lng": 2.2945
        }
      ]
    }
  ]
}
\`\`\`

Now, generate the itinerary for the trip described above.
`;

export async function generateTripItinerary(input: GenerateItineraryInput): Promise<GenerateItineraryOutput> {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        throw new Error("La variable d'environnement OPENROUTER_API_KEY n'est pas définie.");
    }

    const fullPrompt = promptTemplate(input);

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "openrouter/auto",
                messages: [{ role: "user", content: fullPrompt }],
                 response_format: { type: "json_object" },
            })
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`Erreur de l'API OpenRouter: ${response.status} ${response.statusText}. Détails: ${errorBody?.error?.message || 'Aucun détail'}`);
        }

        const data = await response.json();
        const message = data.choices[0]?.message?.content;

        if (!message) {
            throw new Error("Réponse vide ou malformée reçue d'OpenRouter.");
        }

        let jsonData: any;
        try {
            jsonData = JSON.parse(message);
        } catch (e) {
            console.error("Could not parse JSON from response:", message);
            throw new Error("La réponse de l'IA n'a pas pu être analysée comme un JSON valide.");
        }

        if (!jsonData.itinerary) {
            console.error("JSON response is missing 'itinerary' key:", jsonData);
            throw new Error("La réponse de l'IA ne contient pas d'itinéraire valide.");
        }

        return jsonData.itinerary as GenerateItineraryOutput;

    } catch (e: any) {
        console.error("Erreur lors de la génération de l'itinéraire:", e);
        throw new Error(`La génération de l'itinéraire a échoué. Détails: ${e.message}`);
    }
}
