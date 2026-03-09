'use server';

/**
 * @fileOverview A Genkit flow for generating comprehensive practical information about travel destinations.
 *
 * - getDestinationInsights - A function that handles the generation of destination insights.
 * - GetDestinationInsightsInput - The input type for the getDestinationInsights function.
 * - GetDestinationInsightsOutput - The return type for the getDestinationInsights function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define sub-schemas for the output structure
const VocabularyBasicsSchema = z.object({
  phrase: z.string().describe('Common phrase in the local language.'),
  translation: z.string().describe('Translation of the phrase in the user\'s language.'),
  pronunciation: z.string().describe('Phonetic pronunciation guide.')
});

const VocabularyPoliteExpressionsSchema = z.object({
  phrase: z.string().describe('Polite expression in the local language.'),
  translation: z.string().describe('Translation of the expression.')
});

const VocabularyFoodTermsSchema = z.object({
  term: z.string().describe('Local food-related term.'),
  translation: z.string().describe('Translation of the food term.')
});

const VocabularyUsefulPhrasesSchema = z.object({
  phrase: z.string().describe('Useful phrase for travelers.'),
  translation: z.string().describe('Translation of the useful phrase.'),
  context: z.string().describe('Context in which the phrase is used.')
});

const VocabularySchema = z.object({
  basics: z.array(VocabularyBasicsSchema).describe('Basic phrases for daily interactions.'),
  politeExpressions: z.array(VocabularyPoliteExpressionsSchema).describe('Expressions for showing politeness.'),
  foodTerms: z.array(VocabularyFoodTermsSchema).describe('Common food-related vocabulary.'),
  usefulPhrases: z.array(VocabularyUsefulPhrasesSchema).describe('Other general useful phrases.')
});

const GastronomySpecialtySchema = z.object({
  name: z.string().describe('Name of the local food specialty.'),
  description: z.string().describe('Description of the specialty.'),
  whereToTry: z.string().describe('Recommended places or types of establishments to try it.')
});

const GastronomyDrinkSchema = z.object({
  name: z.string().describe('Name of a local drink.'),
  description: z.string().describe('Description of the drink.'),
  alcoholic: z.boolean().describe('True if the drink is alcoholic, false otherwise.')
});

const GastronomySchema = z.object({
  specialties: z.array(GastronomySpecialtySchema).describe('Famous local dishes and specialties.'),
  mealTimes: z.string().describe('Typical meal times in the destination (e.g., "Breakfast 7-9 AM, Lunch 1-3 PM, Dinner 8-10 PM").'),
  drinks: z.array(GastronomyDrinkSchema).describe('Popular local beverages.'),
  streetFood: z.array(z.string()).describe('List of common street food options.'),
  foodEtiquette: z.array(z.string()).describe('Dining etiquette and customs.')
});

const CustomsSchema = z.object({
  greetings: z.string().describe('Common greeting customs.'),
  tipping: z.string().describe('Tipping culture and recommendations.'),
  dress: z.string().describe('Dress code suggestions for various situations.'),
  behavior: z.string().describe('General behavioral norms and what to avoid.'),
  culturalNuances: z.array(z.string()).describe('Other important cultural nuances.')
});

const CurrencyBudgetSchema = z.object({
  backpacker: z.string().describe('Daily budget estimate for backpackers (e.g., "€30-€50").'),
  midRange: z.string().describe('Daily budget estimate for mid-range travelers (e.g., "€80-€150").'),
  luxury: z.string().describe('Daily budget estimate for luxury travelers (e.g., "€200+").')
});

const CurrencySchema = z.object({
  name: z.string().describe('Local currency name (e.g., "Euro").'),
  exchangeRate: z.string().describe('Approximate exchange rate against a common currency (e.g., "1 USD = 0.92 EUR").'),
  paymentMethods: z.array(z.string()).describe('Commonly accepted payment methods (e.g., "Cash, Credit Card, Mobile Pay").'),
  budget: CurrencyBudgetSchema.describe('Estimated daily budget ranges for different travel styles.'),
  tippingGuide: z.string().describe('Detailed guide on tipping practices.')
});

const PricesSchema = z.object({
  coffee: z.string().describe('Average price of a coffee.'),
  meal: z.string().describe('Average price of a casual meal.'),
  restaurant: z.string().describe('Average price of a meal in a mid-range restaurant.'),
  transport: z.string().describe('Average price of a single public transport ticket.'),
  taxi: z.string().describe('Approximate starting fare or typical short ride cost for a taxi.'),
  hotel: z.string().describe('Average price for a mid-range hotel per night.'),
  museum: z.string().describe('Average entrance fee for a museum/attraction.'),
  grocery: z.string().describe('Approximate cost for basic groceries.')
});

const MustSeeItemSchema = z.object({
  name: z.string().describe('Name of a must-see attraction or landmark.'),
  why: z.string().describe('Reason why it is a must-see.'),
  duration: z.string().describe('Recommended visit duration.'),
  bestTime: z.string().describe('Best time of day or year to visit.')
});

const HiddenGemItemSchema = z.object({
  name: z.string().describe('Name of a hidden gem or less-known spot.'),
  why: z.string().describe('Reason why it is a hidden gem.'),
  howToGet: z.string().describe('Directions or best way to reach it.')
});

const TransportationAirportOptionSchema = z.object({
  type: z.string().describe('Type of transport (e.g., "Train", "Bus", "Taxi").'),
  price: z.string().describe('Approximate price.'),
  duration: z.string().describe('Estimated travel duration.'),
  details: z.string().describe('Additional details or tips.')
});

const TransportationAirportSchema = z.object({
  options: z.array(TransportationAirportOptionSchema).describe('Options for getting from the airport to the city center.')
});

const TransportationLocalSchema = z.object({
  types: z.array(z.string()).describe('Types of local transportation available (e.g., "Metro", "Tram", "Bicycle Rental").'),
  passes: z.array(z.string()).describe('Information on travel passes or tickets.'),
  apps: z.array(z.string()).describe('Recommended transportation apps.')
});

const TransportationSchema = z.object({
  fromAirport: TransportationAirportSchema.describe('Information on transportation options from the main airport(s).'),
  localTransport: TransportationLocalSchema.describe('Details about local public transportation.'),
  tips: z.array(z.string()).describe('General transportation tips.')
});

const WeatherSeasonsSchema = z.object({
  spring: z.string().describe('Typical weather in spring.'),
  summer: z.string().describe('Typical weather in summer.'),
  autumn: z.string().describe('Typical weather in autumn.'),
  winter: z.string().describe('Typical weather in winter.')
});

const WeatherSchema = z.object({
  bestPeriod: z.string().describe('Best time of year to visit regarding weather.'),
  seasons: WeatherSeasonsSchema.describe('Detailed weather information by season.'),
  whatToPack: z.array(z.string()).describe('Suggestions on what to pack.'),
  climateInfo: z.string().describe('General climate information.')
});

const EmergencyNumbersSchema = z.object({
  police: z.string().describe('Emergency number for police.'),
  ambulance: z.string().describe('Emergency number for ambulance/medical services.'),
  fire: z.string().describe('Emergency number for fire department.'),
  general: z.string().describe('General emergency number (if applicable).')
});

const EmergencyEmbassySchema = z.object({
  address: z.string().describe('Address of the user\'s country embassy/consulate (if known, otherwise general info).'),
  phone: z.string().describe('Phone number of the embassy/consulate.'),
  hours: z.string().describe('Opening hours of the embassy/consulate.')
});

const EmergencySchema = z.object({
  numbers: EmergencyNumbersSchema.describe('Important emergency contact numbers.'),
  embassy: EmergencyEmbassySchema.describe('Information about relevant embassies or consulates.'),
  usefulApps: z.array(z.string()).describe('Recommended emergency-related apps.'),
  healthTips: z.array(z.string()).describe('Health and safety tips.')
});

// Input Schema for the flow
const GetDestinationInsightsInputSchema = z.object({
  destinations: z.string().describe('A comma-separated list of travel destinations (e.g., "Paris, London").'),
  section: z.enum([
    'vocabulary',
    'gastronomy',
    'customs',
    'currency',
    'prices',
    'prohibitions',
    'scams',
    'mustSee',
    'hiddenGems',
    'transportation',
    'weather',
    'emergency'
  ]).optional().describe('Optional: A specific section of information to retrieve (e.g., "gastronomy"). If omitted, all available sections will be returned.')
});
export type GetDestinationInsightsInput = z.infer<typeof GetDestinationInsightsInputSchema>;

// Output Schema for the flow (full object)
const GetDestinationInsightsOutputSchema = z.object({
  vocabulary: VocabularySchema.optional().describe('Key local vocabulary and phrases.'),
  gastronomy: GastronomySchema.optional().describe('Information about local food, drinks, and dining customs.'),
  customs: CustomsSchema.optional().describe('General customs, etiquette, and cultural nuances.'),
  currency: CurrencySchema.optional().describe('Details about local currency, payment, and budgeting.'),
  prices: PricesSchema.optional().describe('Average prices for common goods and services.'),
  prohibitions: z.array(z.string()).optional().describe('Local prohibitions.'),
  scams: z.array(z.string()).optional().describe('Common scams targeting tourists.'),
  mustSee: z.array(MustSeeItemSchema).optional().describe('Top attractions and must-visit places.'),
  hiddenGems: z.array(HiddenGemItemSchema).optional().describe('Lesser-known but worthwhile spots.'),
  transportation: TransportationSchema.optional().describe('Information on getting around, including to/from the airport and local transport.'),
  weather: WeatherSchema.optional().describe('Climate and weather patterns, including best times to visit and what to pack.'),
  emergency: EmergencySchema.optional().describe('Emergency contacts, health tips, and embassy information.')
}).describe('Comprehensive practical information about a travel destination.');
export type GetDestinationInsightsOutput = z.infer<typeof GetDestinationInsightsOutputSchema>;

// Prompt definition
const getDestinationInsightsPrompt = ai.definePrompt({
  name: 'getDestinationInsightsPrompt',
  input: { schema: GetDestinationInsightsInputSchema },
  output: { schema: GetDestinationInsightsOutputSchema },
  model: 'googleai/gemini-1.0-pro',
  prompt: `
    You are an expert travel guide providing comprehensive practical information about travel destinations.
    Your goal is to provide a detailed, well-structured JSON response based on the user's request.

    **Destinations:** {{{destinations}}}

    {{#if section}}
    **Focus:** You are specifically asked to provide information for the '{{{section}}}' section. While generating the full JSON structure, prioritize detailed content for the '{{{section}}}' key. For other top-level keys, you can provide concise summaries or empty arrays/objects if they are not the primary focus, but ensure all top-level keys are present in the final JSON object to maintain structural integrity.
    {{else}}
    **Focus:** Provide comprehensive practical information covering all sections described below for the destination(s).
    {{/if}}

    **Output Format:**
    Generate a single JSON object with the following top-level keys: "vocabulary", "gastronomy", "customs", "currency", "prices", "prohibitions", "scams", "mustSee", "hiddenGems", "transportation", "weather", "emergency".
    Each key must map to an object or array corresponding to its section's detailed schema.
    If you cannot find specific information for any field, provide an empty string for text fields, an empty array for array fields, or null for nullable fields, ensuring the structure is always valid JSON.
    Do not include any introductory or concluding text outside the JSON object.
    The output should strictly conform to the JSON schema provided by the system.
  `
});

// Flow definition
const getDestinationInsightsFlow = ai.defineFlow(
  {
    name: 'getDestinationInsightsFlow',
    inputSchema: GetDestinationInsightsInputSchema,
    outputSchema: GetDestinationInsightsOutputSchema
  },
  async (input) => {
    const { output } = await getDestinationInsightsPrompt(input);

    if (!output) {
      throw new Error('AI failed to generate destination insights.');
    }

    // The flow's outputSchema is GetDestinationInsightsOutput, which is the full object.
    // The API endpoint should handle filtering by `section` if needed.
    // So, we just return the full output from the prompt.
    return output;
  }
);

// Wrapper function for the flow
export async function getDestinationInsights(
  input: GetDestinationInsightsInput
): Promise<GetDestinationInsightsOutput> {
  return getDestinationInsightsFlow(input);
}
