'use server';
/**
 * @fileOverview Generates a trip itinerary using the OpenRouter API.
 */
import {
    GenerateItineraryInput,
    GenerateItineraryOutput,
} from '@/ai/types';


const promptTemplate = (input: GenerateItineraryInput) => `
You are an expert travel planner AI. Your task is to generate a detailed day-by-day itinerary for a trip.

**Trip Details:**
- **Title:** ${input.title}
- **Destinations:** ${input.destinations.join(', ')}
- **Dates:** ${input.startDate} to ${input.endDate}
- **Travelers:** ${JSON.stringify(input.travelers)}
- **Preferences:** ${JSON.stringify(input.preferences)}

**Instructions:**
1.  Create a plausible and engaging itinerary for the entire duration of the trip. **All text content (titles, descriptions) MUST be in French.**
2.  Each day should have a series of events (activities, meals, transport, etc.).
3.  For each event, provide a type, title, start time, and other relevant details like location. The event \`type\` MUST be one of the following exact strings: 'visit', 'meal', 'transport', 'accommodation', 'activity'.
4.  The final output MUST be ONLY a raw JSON object. Do not include markdown backticks or any other text outside of the JSON. **CRITICAL**: Ensure the JSON is valid. All strings containing double quotes must have them escaped with a backslash (e.g., "description": "Une description \\"avec\\" des guillemets.").

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
          "title": "Titre de l'événement en français",
          "startTime": "HH:mm",
          "durationMinutes": 60,
          "description": "Brève description de l'événement en français.",
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
            // Models can sometimes wrap the JSON in markdown, so we extract it.
            const jsonStart = message.indexOf('{');
            const jsonEnd = message.lastIndexOf('}');
            if (jsonStart === -1 || jsonEnd === -1) {
                throw new Error("Aucun objet JSON trouvé dans la réponse de l'IA.");
            }
            const jsonString = message.substring(jsonStart, jsonEnd + 1);
            jsonData = JSON.parse(jsonString);
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
