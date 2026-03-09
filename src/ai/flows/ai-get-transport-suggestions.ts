'use server';
/**
 * @fileOverview Fetches transport suggestions between two events.
 */

import {
  TransportSuggestionInput,
  TransportSuggestionOutput,
  TransportSuggestionOutputSchema,
} from '@/ai/types';

const promptTemplate = (input: TransportSuggestionInput) => `
You are an expert local guide and travel planner. Your task is to provide the best transportation options between two events in an itinerary.

**Trip Details:**
- **From:** ${input.startEvent.title} (${input.startEvent.locationName || 'location not specified'})
- **To:** ${input.endEvent.title} (${input.endEvent.locationName || 'location not specified'})

**Instructions:**
1.  **Analyze the route.** Consider the distance, time of day (if known, assume midday otherwise), and typical traffic/conditions for the location.
2.  **Provide 2-3 relevant transport options.** Include public transport (metro, bus), walking, and ride-sharing/taxi. Include bike sharing if relevant for the city.
3.  **For each option, provide details.** Include estimated duration, cost in Euros (e.g., '€2.15', '€15-20', or 'Gratuit'), and a brief description in French covering ease of use, convenience, and any tips (e.g., "Idéal pour voir la ville", "Le plus rapide en heure de pointe", "Nécessite une carte de transport").
4.  **Format the output as a valid JSON object.** Your entire response must be ONLY a raw JSON object. Do not include markdown backticks or any other text outside of the JSON. **CRITICAL**: Ensure the JSON is valid. All strings containing double quotes must have them escaped with a backslash (e.g., "description": "Une description \\"avec\\" des guillemets.").

**JSON Output Schema:**
The output must be a JSON object that strictly follows this Zod schema:
\`\`\`json
{
  "suggestions": [
    {
      "mode": "walking",
      "durationMinutes": 25,
      "cost": "Gratuit",
      "description": "Une agréable promenade à travers des rues historiques, idéale pour découvrir le quartier.",
      "isEcoFriendly": true
    },
    {
      "mode": "public_transport",
      "durationMinutes": 15,
      "cost": "€1.90",
      "description": "Le métro est le moyen le plus rapide et le plus efficace pour ce trajet.",
      "isEcoFriendly": true
    }
  ]
}
\`\`\`

Now, generate the transport suggestions for the route described above.
`;

export async function getTransportSuggestions(input: TransportSuggestionInput): Promise<TransportSuggestionOutput> {
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

    // Validate with Zod
    const validation = TransportSuggestionOutputSchema.safeParse(jsonData);
    if (!validation.success) {
      console.error("Zod validation failed", validation.error);
      throw new Error("La réponse de l'IA ne correspond pas au format attendu.");
    }

    return validation.data;

  } catch (e: any) {
    console.error("Erreur lors de la récupération des suggestions de transport:", e);
    throw new Error(`La récupération des suggestions a échoué. Détails: ${e.message}`);
  }
}
