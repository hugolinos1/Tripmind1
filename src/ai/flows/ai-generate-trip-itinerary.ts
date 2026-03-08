'use server';
/**
 * @fileOverview A Genkit flow for generating a detailed day-by-day itinerary for a trip based on user preferences.
 *
 * - generateTripItinerary - A function that handles the trip itinerary generation process.
 * - GenerateItineraryInput - The input type for the generateTripItinerary function.
 * - GenerateItineraryOutput - The return type for the generateTripItinerary function.
 */

import {ai} from '@/ai/genkit';
import {
  GenerateItineraryInputSchema, 
  GenerateItineraryOutputSchema, 
  type GenerateItineraryInput as GenerateItineraryInputType, 
  type GenerateItineraryOutput as GenerateItineraryOutputType 
} from '@/ai/schemas/trip-itinerary-schemas';

export type GenerateItineraryInput = GenerateItineraryInputType;
export type GenerateItineraryOutput = GenerateItineraryOutputType;


const generateItineraryPrompt = ai.definePrompt({
  name: 'generateItineraryPrompt',
  input: { schema: GenerateItineraryInputSchema },
  output: { schema: GenerateItineraryOutputSchema },
  model: 'googleai/gemini-1.5-flash-latest',
  config: {
    temperature: 0.7,
  },
  prompt: `Tu es un planificateur de voyage expert et un assistant IA. Ta mission est de générer un itinéraire de voyage détaillé, jour par jour, en te basant sur les préférences fournies. La réponse doit être un objet JSON valide qui adhère strictement au schéma de sortie.

Instructions Clés :
1.  **Itinéraire Chronologique :** Les événements de chaque journée doivent être dans un ordre logique et chronologique.
2.  **Pertinence :** Assure-toi que les activités et lieux sont pertinents par rapport aux destinations et aux intérêts de l'utilisateur.
3.  **Détails Complets :** Pour chaque événement, fournis toutes les informations requises : type, titre, description, heure de début, durée, nom du lieu, adresse complète, et coordonnées géographiques (latitude et longitude). Si une adresse exacte n'est pas pertinente (par ex. "Balade dans le quartier"), donne une adresse centrale ou une description claire de la zone, avec des coordonnées approximatives.
4.  **Réalisme :** Crée un itinéraire réaliste. Prends en compte les temps de trajet entre les lieux, les heures d'ouverture probables et un rythme de voyage équilibré en fonction de la préférence "pace".
5.  **Formatage Strict :** La sortie doit être uniquement l'objet JSON, sans texte d'introduction, de conclusion ou de commentaires.
6.  **Gestion des Dates :** Calcule les dates pour chaque jour de l'itinéraire en te basant sur les 'startDate' et 'endDate' fournies.

---

Génère un itinéraire pour un voyage intitulé "{{title}}", à destination de {{destinations}} du {{startDate}} au {{endDate}}.
Détails des voyageurs:
  - Adultes: {{travelers.adults}}
  - Enfants: {{#if travelers.children}}{{#each travelers.children}} {{this}}{{/each}}{{else}}Aucun{{/if}}
  - Animaux de compagnie: {{#if travelers.hasPets}}Oui{{else}}Non{{/if}}

Préférences de voyage:
  - Rythme: {{preferences.pace}} (0=détendu, 100=intense)
  - Budget: {{preferences.budget}} (0=économique, 100=luxueux)
  - Intérêts: {{#each preferences.interests}}- {{this}}
  {{/each}}
  - Accessibilité: {{#each preferences.accessibility}}- {{this}}
  {{/each}}
  - Régimes alimentaires: {{#each preferences.dietary}}- {{this}}
  {{/each}}
  - Lieux déjà visités: {{#each preferences.alreadyVisited}}- {{this}}
  {{/each}}
  - Lieux à voir absolument: {{#each preferences.mustSee}}- {{this}}
  {{/each}}
  
Réponds uniquement en format JSON. Le schéma est le suivant :
${JSON.stringify(GenerateItineraryOutputSchema.jsonSchema(), null, 2)}`
});

const generateTripItineraryFlow = ai.defineFlow(
  {
    name: 'generateTripItineraryFlow',
    inputSchema: GenerateItineraryInputSchema,
    outputSchema: GenerateItineraryOutputSchema,
  },
  async (input) => {
    const {output} = await generateItineraryPrompt(input);
    if (!output) {
      throw new Error('Failed to generate itinerary: AI returned no output.');
    }
    return output;
  }
);

export async function generateTripItinerary(input: GenerateItineraryInput): Promise<GenerateItineraryOutput> {
  return generateTripItineraryFlow(input);
}
