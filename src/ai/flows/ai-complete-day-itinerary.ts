'use server';
/**
 * @fileOverview Completes a day's itinerary using an AI model.
 */
import {
    CompleteDayItineraryInput,
    CompleteDayItineraryOutput,
    CompleteDayItineraryOutputSchema,
} from '@/ai/types';

const promptTemplate = (input: CompleteDayItineraryInput) => `
You are an expert travel planner AI. Your task is to complete a single day's itinerary, adding new events around existing ones.

**Trip & Day Details:**
- **Date:** ${input.date}
- **Primary Location:** ${input.location}
- **Start of Day Location:** ${input.startLocationName || 'Not specified'}
- **End of Day Location:** ${input.endLocationName || 'Not specified'}
- **Traveler Preferences:** ${JSON.stringify(input.preferences)}

**Existing Events (Must be included in the final output with their original 'id'):**
${input.existingEvents.length > 0 ? input.existingEvents.map(e => `- (id: ${e.id}) ${e.startTime || 'Time not set'}: ${e.title} at ${e.locationName || 'unspecified location'}`).join('\n') : 'No existing events for this day.'}

**Instructions:**
1.  **Analyze the existing plan.** Understand the timings and locations of the existing events.
2.  **Add new, complementary events.** Based on the traveler preferences, add new activities, meals, or transport suggestions to fill the gaps in the day. Make the day feel full and well-paced.
3.  **Preserve existing events.** Your final output MUST include all the "Existing Events" without modification. When you include an existing event, you MUST include its original \`id\` in the output object for that event. For newly generated events, do not include an \`id\` field.
4.  **Order all events.** Arrange the final list of events (both existing and newly generated) in a logical chronological order.
5.  **Constrain Event Types.** The \`type\` for each event MUST be one of the following exact strings: 'visit', 'meal', 'transport', 'accommodation', 'activity'.
6.  **Provide all text in French.** All titles and descriptions must be in French.
7.  **Format the output as a valid JSON object.** Your entire response must be ONLY a raw JSON object. Do not include markdown backticks or any other text outside of the JSON. **CRITICAL**: Ensure the JSON is valid. All strings containing double quotes must have them escaped with a backslash (e.g., "description": "Une description \\"avec\\" des guillemets.").

**JSON Output Schema:**
The output must be a JSON object with a single "events" key, containing an array of event objects for the completed day.
\`\`\`json
{
  "events": [
    {
      "id": "optional-id-for-existing-events",
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
\`\`\`

Now, generate the completed itinerary for the day described above.
`;

export async function completeDayItinerary(input: CompleteDayItineraryInput): Promise<CompleteDayItineraryOutput> {
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

        const validation = CompleteDayItineraryOutputSchema.safeParse(jsonData);
        if (!validation.success) {
            console.error("Zod validation failed", validation.error);
            throw new Error("La réponse de l'IA ne correspond pas au format attendu.");
        }

        return validation.data;

    } catch (e: any) {
        console.error("Erreur lors de la complétion de l'itinéraire:", e);
        throw new Error(`La complétion de l'itinéraire a échoué. Détails: ${e.message}`);
    }
}
