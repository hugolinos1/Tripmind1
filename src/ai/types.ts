import { z } from 'zod';

// From ai-enrich-event-details.ts
export const EnrichEventInputSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    locationName: z.string().optional(),
    type: z.string(),
});
export type EnrichEventInput = z.infer<typeof EnrichEventInputSchema>;

export const EnrichEventOutputSchema = z.object({
  description: z.string().describe("A detailed, engaging description for the event. Write it in French."),
  practicalInfo: z.object({
    openingHours: z.string().optional().describe("Opening hours, if applicable."),
    price: z.string().optional().describe("Price range or ticket cost, if applicable."),
    website: z.string().optional().describe("The official website for the event or location."),
    tips: z.string().optional().describe("Actionable tips for visitors."),
  }).describe("Practical information about the event. All values should be in French."),
});
export type EnrichEventOutput = z.infer<typeof EnrichEventOutputSchema>;


// From ai-generate-trip-itinerary.ts
export interface GenerateItineraryInput {
  tripId: string;
  title: string;
  destinations: string[];
  startDate: string;
  endDate: string;
  travelers: any;
  preferences: any;
}

export type EventPlan = {
    type: 'visit' | 'meal' | 'transport' | 'accommodation' | 'activity';
    title: string;
    description?: string;
    startTime: string; // "HH:mm"
    durationMinutes?: number;
    locationName?: string;
    lat?: number;
    lng?: number;
};

export type DayPlan = {
    date: string; // "YYYY-MM-DD"
    location: string;
    events: EventPlan[];
};

export type GenerateItineraryOutput = DayPlan[];


// From ai-get-destination-insights.ts
export interface GetDestinationInsightsInput {
  destinations: string[];
  sectionId: string;
  sectionLabel: string;
}

export interface GetDestinationInsightsOutput {
  content: string; // Markdown formatted content
}

// For ai-get-transport-suggestions.ts
const TransportEventObjectSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  locationName: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
export const TransportSuggestionInputSchema = z.object({
  startEvent: TransportEventObjectSchema,
  endEvent: TransportEventObjectSchema,
});
export type TransportSuggestionInput = z.infer<typeof TransportSuggestionInputSchema>;

export const TransportSuggestionSchema = z.object({
  mode: z.enum(['walking', 'public_transport', 'taxi', 'bike_sharing', 'plane', 'other']).describe("Mode of transport."),
  durationMinutes: z.number().describe("Estimated travel time in minutes."),
  distanceKm: z.number().optional().describe("Estimated distance in kilometers."),
  cost: z.string().describe("Estimated cost, e.g., 'Gratuit', '€2.15', '€15-20'."),
  description: z.string().describe("Brief description in French, including ease of use and tips."),
  isEcoFriendly: z.boolean().optional().describe("Whether this option is environmentally friendly."),
});

export const TransportSuggestionOutputSchema = z.object({
  suggestions: z.array(TransportSuggestionSchema),
});
export type TransportSuggestionOutput = z.infer<typeof TransportSuggestionOutputSchema>;

// From ai-geocode-location.ts
export const GeocodeInputSchema = z.object({
  location: z.string().describe("The location name or address to geocode."),
});
export type GeocodeInput = z.infer<typeof GeocodeInputSchema>;

export const GeocodeOutputSchema = z.object({
  lat: z.number().describe("The latitude of the location."),
  lng: z.number().describe("The longitude of the location."),
});
export type GeocodeOutput = z.infer<typeof GeocodeOutputSchema>;

// From ai-complete-day-itinerary.ts
const CompletedEventSchema = z.object({
    id: z.string().optional(),
    type: z.enum(['visit', 'meal', 'transport', 'accommodation', 'activity']),
    title: z.string(),
    description: z.string().optional(),
    startTime: z.string().optional(), // "HH:mm"
    durationMinutes: z.number().optional(),
    locationName: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
});

export const CompleteDayItineraryInputSchema = z.object({
    date: z.string(),
    location: z.string(),
    startLocationName: z.string().optional(),
    endLocationName: z.string().optional(),
    existingEvents: z.array(z.object({
        id: z.string(),
        title: z.string(),
        type: z.string(),
        startTime: z.string().optional().nullable(),
        locationName: z.string().optional().nullable(),
    })),
    preferences: z.any(),
});
export type CompleteDayItineraryInput = z.infer<typeof CompleteDayItineraryInputSchema>;

export const CompleteDayItineraryOutputSchema = z.object({
    events: z.array(CompletedEventSchema)
});
export type CompleteDayItineraryOutput = z.infer<typeof CompleteDayItineraryOutputSchema>;
