'use server';
/**
 * @fileOverview A Genkit flow for generating a detailed day-by-day itinerary for a trip based on user preferences.
 *
 * - generateTripItinerary - A function that handles the trip itinerary generation process.
 * - GenerateItineraryInput - The input type for the generateTripItinerary function.
 * - GenerateItineraryOutput - The return type for the generateTripItinerary function.
 */

import {ai} from '@/ai/genkit';
import { z } from 'genkit';

const TravelersSchema = z.object({
  adults: z.number().describe('Number of adults traveling.'),
  children: z.array(z.string()).describe('Ages of children, e.g., ["5", "8", "12"].'),
  hasPets: z.boolean().describe('Whether pets are traveling.'),
});

const PreferencesSchema = z.object({
  pace: z.number().min(0).max(100).describe('Travel pace (0-100): 0 for relaxed, 100 for intense.'),
  budget: z.number().min(0).max(100).describe('Travel budget (0-100): 0 for economic, 100 for luxury.'),
  interests: z.array(z.string()).describe('List of travel interests, e.g., ["culture", "nature", "gastronomy"].'),
  accessibility: z.array(z.string()).describe('Accessibility needs, e.g., ["wheelchair", "reduced-mobility"].'),
  dietary: z.array(z.string()).describe('Dietary restrictions, e.g., ["vegetarian", "vegan"].'),
  alreadyVisited: z.array(z.string()).describe('Places already visited by the user.'),
  mustSee: z.array(z.string()).describe('Places the user absolutely wants to see.'),
});

const EventTypeSchema = z.union([
  z.literal('visit'),
  z.literal('meal'),
  z.literal('transport'),
  z.literal('accommodation'),
  z.literal('activity'),
]);

const ItineraryEventSchema = z.object({
  type: EventTypeSchema.describe('Type of event: visit, meal, transport, accommodation, activity.'),
  title: z.string().describe('Title of the event.'),
  description: z.string().describe('Detailed description of the event.'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:mm format').describe('Start time of the event in HH:mm format.'),
  durationMinutes: z.number().int().positive().describe('Duration of the event in minutes.'),
  locationName: z.string().describe('Name of the location.'),
  locationAddress: z.string().describe('Full address of the location.'),
  lat: z.number().describe('Latitude of the event location.'),
  lng: z.number().describe('Longitude of the event location.'),
});

const ItineraryDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').describe('Date of the day in YYYY-MM-DD format.'),
  events: z.array(ItineraryEventSchema).describe('List of events for the day, ordered chronologically.'),
});

const GenerateItineraryOutputSchema = z.array(ItineraryDaySchema).describe('A detailed day-by-day itinerary.');
export type GenerateItineraryOutput = z.infer<typeof GenerateItineraryOutputSchema>;

const GenerateItineraryInputSchema = z.object({
  tripId: z.string().describe('The ID of the trip.'),
  title: z.string().describe('The title of the trip.'),
  destinations: z.array(z.string()).describe('A list of destinations for the trip, e.g., ["Paris", "Lyon"].'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').describe('The start date of the trip in YYYY-MM-DD format.'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').describe('The end date of the trip in YYYY-MM-DD format.'),
  travelers: TravelersSchema.describe('Details about the travelers.'),
  preferences: PreferencesSchema.describe('User preferences for the trip.'),
});
export type GenerateItineraryInput = z.infer<typeof GenerateItineraryInputSchema>;


const generateItineraryPrompt = ai.definePrompt({
  name: 'generateItineraryPrompt',
  input: { schema: GenerateItineraryInputSchema },
  config: {
    temperature: 0.7,
  },
  prompt: `Tu es un planificateur de voyage expert et un assistant IA. Ta mission est de générer un itinéraire de voyage détaillé, jour par jour, en te basant sur les préférences fournies.

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
  
Réponds uniquement en format JSON.`
});

const generateTripItineraryFlow = ai.defineFlow(
  {
    name: 'generateTripItineraryFlow',
    inputSchema: GenerateItineraryInputSchema,
    outputSchema: GenerateItineraryOutputSchema,
  },
  async (input) => {
    const response = await generateItineraryPrompt(input);
    const textResponse = response.text;
    
    if (!textResponse) {
      throw new Error('Failed to generate itinerary: AI returned no output.');
    }
    
    try {
      const jsonText = textResponse.replace(/^```json\n?/, '').replace(/```$/, '');
      const parsed = JSON.parse(jsonText);
      return GenerateItineraryOutputSchema.parse(parsed);
    } catch (e) {
      console.error("Failed to parse AI response:", e, "Raw response:", textResponse);
      throw new Error("Failed to parse AI JSON response.");
    }
  }
);

export async function generateTripItinerary(input: GenerateItineraryInput): Promise<GenerateItineraryOutput> {
  return generateTripItineraryFlow(input);
}
