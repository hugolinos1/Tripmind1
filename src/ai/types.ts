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
