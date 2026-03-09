'use server';
/**
 * @fileOverview Test connectivity to OpenRouter.
 * This file uses the native fetch API to connect to OpenRouter, bypassing any SDK issues.
 */

export async function testOpenRouterConnectivity(prompt: string): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        throw new Error("La variable d'environnement OPENROUTER_API_KEY n'est pas définie.");
    }

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "openrouter/auto", // Use auto-selection for free models
                messages: [
                    { role: "system", content: "You are a test assistant. Confirm that you received the message with a simple, polite sentence in French." },
                    { role: "user", content: prompt }
                ],
            })
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("Erreur de l'API OpenRouter:", errorBody);
            throw new Error(`Erreur de l'API OpenRouter: ${response.status} ${response.statusText}. Détails: ${errorBody?.error?.message || 'Aucun détail'}`);
        }

        const data = await response.json();
        const message = data.choices[0]?.message?.content;

        if (!message) {
            throw new Error("Réponse vide ou malformée reçue d'OpenRouter.");
        }

        return message;

    } catch (e: any) {
        console.error("Erreur lors de l'appel à OpenRouter:", e);
        // Re-throw a user-friendly error for the test page.
        throw new Error(`Échec de la connexion à OpenRouter. Détails: ${e.message}`);
    }
}
