'use server';
/**
 * @fileOverview Fetches destination insights using the OpenRouter API.
 */
import {
    GetDestinationInsightsInput,
    GetDestinationInsightsOutput,
} from '@/ai/types';

const promptTemplate = (input: GetDestinationInsightsInput) => `
You are a world-class travel expert.
A user is planning a trip to ${input.destinations.join(' and ')}.
Provide detailed, practical, and engaging information about the following topic: **${input.sectionLabel}**.

**Instructions:**
- Respond in French.
- Format the response as clear, readable markdown.
- Be specific and provide actionable tips. For example, for "Vocabulary", provide a list of useful phrases. For "Must-See", list key attractions with brief descriptions.
- The information should be concise yet comprehensive for a traveler.

Generate the content for the "**${input.sectionLabel}**" section.
`;

export async function getDestinationInsights(input: GetDestinationInsightsInput): Promise<GetDestinationInsightsOutput> {
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

        return { content: message };

    } catch (e: any) {
        console.error("Erreur lors de la récupération des informations sur la destination:", e);
        throw new Error(`La récupération des informations a échoué. Détails: ${e.message}`);
    }
}
