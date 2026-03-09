'use server';
/**
 * @fileOverview Geocodes a location string to latitude and longitude.
 */
import {
    GeocodeInput,
    GeocodeOutput,
    GeocodeOutputSchema
} from '@/ai/types';

const promptTemplate = (input: GeocodeInput) => `
You are a geocoding expert. Your task is to find the geographic coordinates (latitude and longitude) for a given location.

**Location:** ${input.location}

**Instructions:**
1.  Find the most precise latitude and longitude for the given location.
2.  If the location is ambiguous, use the most likely interpretation in a travel context. If you cannot determine coordinates, return null for lat and lng.
3.  Format the output as a valid JSON object. Your entire response must be ONLY a raw JSON object. Do not include markdown backticks or any other text outside of the JSON.

**JSON Output Schema:**
The output must be a JSON object that strictly follows this Zod schema:
\`\`\`json
{
  "lat": 48.8584,
  "lng": 2.2945
}
\`\`\`

Now, generate the coordinates for the location described above.
`;

export async function geocodeLocation(input: GeocodeInput): Promise<GeocodeOutput> {
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

        // Validate with Zod
        const validation = GeocodeOutputSchema.safeParse(jsonData);
        if (!validation.success) {
            console.error("Zod validation failed", validation.error);
            throw new Error("La réponse de l'IA ne correspond pas au format attendu.");
        }

        return validation.data;

    } catch (e: any) {
        console.error("Erreur lors du géocodage:", e);
        throw new Error(`Le géocodage a échoué. Détails: ${e.message}`);
    }
}
