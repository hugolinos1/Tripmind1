'use server';
/**
 * @fileOverview A Genkit flow to enrich event details with practical information and photos.
 *
 * - enrichEventDetails - A function that handles the event enrichment process.
 * - EnrichEventInput - The input type for the enrichEventDetails function.
 * - EnrichEventOutput - The return type for the enrichEventDetails function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PracticalInfoSchema = z.object({
  openingHours: z.string().describe("Typical opening hours for the event or location, e.g., '9h-18h', 'Ouvert 24h/24', 'Fermé le lundi'."),
  priceRange: z.string().describe("Estimated price range for the event or location, e.g., '10-20€', 'Gratuit', '$$$'. If unknown, state 'Inconnu'."),
  tips: z.array(z.string()).describe("An array of useful tips (1-3 sentences each) for visiting this event or location, e.g., 'Arriver tôt le matin pour éviter la foule.'."),
  bestTimeToVisit: z.string().describe("Best time of day or season to visit the event or location, e.g., 'Matin pour éviter la foule', 'Printemps ou automne', 'Toute l'année'. If unknown, state 'Inconnu'."),
});

const EnrichEventOutputSchema = z.object({
  description: z.string().describe("A detailed, engaging, and informative description of the event or location, suitable for a travel guide (approx. 3-5 sentences)."),
  practicalInfo: PracticalInfoSchema.describe("Practical information about the event including opening hours, price range, tips, and best time to visit."),
  photos: z.array(z.string().url()).describe("An array of 1 to 3 placeholder image URLs from Lorem Picsum (e.g., 'https://picsum.photos/seed/paris-eiffel-tower/400/300') that visually represent the event or location. The 'seed' should be a lower-kebab-case string derived from the event's location name to ensure relevant but random images."),
});
export type EnrichEventOutput = z.infer<typeof EnrichEventOutputSchema>;

const EnrichEventInputSchema = z.object({
  eventTitle: z.string().describe("The title of the event or activity to enrich (e.g., 'Musée du Louvre', 'Dîner à La Tour d'Argent')."),
  locationName: z.string().describe("The name of the primary location associated with the event (e.g., 'Paris', 'Eiffel Tower', 'Restaurant Le Jules Verne')."),
  locationAddress: z.string().describe("The full address of the event location (e.g., 'Rue de Rivoli, 75001 Paris, France')."),
  tripDestinations: z.array(z.string()).describe("A list of cities or regions (e.g., ['Paris', 'Lyon', 'Nice']) that are part of the overall trip, providing broader context for the AI."),
});
export type EnrichEventInput = z.infer<typeof EnrichEventInputSchema>;

export async function enrichEventDetails(input: EnrichEventInput): Promise<EnrichEventOutput> {
  return enrichEventFlow(input);
}

const enrichEventPrompt = ai.definePrompt({
  name: 'enrichEventPrompt',
  input: { schema: EnrichEventInputSchema },
  output: { schema: EnrichEventOutputSchema },
  prompt: `Tu es un guide touristique expert et un assistant de voyage. Ton rôle est de fournir des informations pratiques et attrayantes sur un événement ou un lieu spécifique.\nGénère une description détaillée, des informations pratiques (horaires d'ouverture, fourchette de prix, conseils utiles, meilleur moment pour visiter) et des URLs de photos pour l'événement suivant.\n\n---\n**Détails de l'événement:**\n- **Titre:** {{{eventTitle}}}\n- **Lieu:** {{{locationName}}}\n- **Adresse:** {{{locationAddress}}}\n- **Contexte du voyage (Destinations principales):** {{#each tripDestinations}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}\n---\n\nFournis des informations utiles, pertinentes et concises pour les voyageurs. La description doit être riche, informative et invitante.\nPour les photos, utilise des URLs de Lorem Picsum (https://picsum.photos/seed/{seed}/400/300) en générant un 'seed' pertinent (en minucules et tirets, basé sur le nom du lieu et/ou de l'événement pour des images variées mais liées), par exemple 'https://picsum.photos/seed/paris-louvre-museum/400/300'. Fournis entre 1 et 3 URLs de photos.`,
});

const enrichEventFlow = ai.defineFlow(
  {
    name: 'enrichEventFlow',
    inputSchema: EnrichEventInputSchema,
    outputSchema: EnrichEventOutputSchema,
  },
  async (input) => {
    const { output } = await enrichEventPrompt(input);

    if (!output) {
      throw new Error('AI did not return any output for event enrichment.');
    }
    
    return output;
  }
);
