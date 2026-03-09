'use server';
/**
 * @fileOverview Enriches an event with details using the OpenRouter API.
 */

import { z } from 'zod';

// Basic event info to send for enrichment
export const EnrichEventInputSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    locationName: z.string().optional(),
    type: z.string(),
});
export type EnrichEventInput = z.infer<typeof EnrichEventInputSchema>;


// The enriched data we expect back from the AI
export const EnrichEventOutputSchema = z.object({
  description: z.string().describe("A detailed, engaging description for the event. Write it in French."),
  practicalInfo: z.object({
    openingHours: z.string().optional().describe("Opening hours, if applicable."),
    price: z.string().optional().describe("Price range or ticket cost, if applicable."),
    tips: z.string().optional().describe("Actionable tips for visitors."),
  }).describe("Practical information about the event. All values should be in French."),
});
export type EnrichEventOutput = z.infer<typeof EnrichEventOutputSchema>;


const promptTemplate = (input: EnrichEventInput) => `
You are a world-class travel expert and copywriter.
Your task is to enrich a travel itinerary event with detailed and practical information. The event is:

- **Title:** ${input.title}
- **Type:** ${input.type}
${input.locationName ? `- **Location:** ${input.locationName}` : ''}
${input.description ? `- **Current Description:** ${input.description}` : ''}

**Instructions:**
1.  **Rewrite and expand the description.** Make it more engaging, inspiring, and useful for a traveler. Provide context and what to expect. The language must be French.
2.  **Find practical information.** Research and provide details like opening hours, prices, and insider tips. For fields where no information can be found, return an empty string.
3.  **Format the output as a valid JSON object.** Do not include any text, markdown, or explanations outside of the JSON structure.

**JSON Output Schema:**
The output must be a JSON object that strictly follows this Zod schema:
\`\`\`json
{
  "description": "A detailed, engaging description for the event. Write it in French.",
  "practicalInfo": {
    "openingHours": "(e.g., 'Lundi-Vendredi : 9h-18h', '24/7', or 'Fermé le mardi')",
    "price": "(e.g., 'Entrée gratuite', 'À partir de 25€', 'Variable')",
    "tips": "Actionable tips for visitors in French."
  }
}
\`\`\`

Now, generate the enriched content for the event described above.
`;

export async function enrichEventDetails(input: EnrichEventInput): Promise<EnrichEventOutput> {
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

        // Validate with Zod
        const validation = EnrichEventOutputSchema.safeParse(jsonData);
        if (!validation.success) {
            console.error("Zod validation failed", validation.error);
            throw new Error("La réponse de l'IA ne correspond pas au format attendu.");
        }

        return validation.data;

    } catch (e: any) {
        console.error("Erreur lors de l'enrichissement de l'événement:", e);
        throw new Error(`L'enrichissement a échoué. Détails: ${e.message}`);
    }
}
