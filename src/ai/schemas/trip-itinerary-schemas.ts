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

export const GenerateItineraryInputSchema = z.object({
  tripId: z.string().describe('The ID of the trip.'),
  title: z.string().describe('The title of the trip.'),
  destinations: z.array(z.string()).describe('A list of destinations for the trip, e.g., ["Paris", "Lyon"].'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').describe('The start date of the trip in YYYY-MM-DD format.'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').describe('The end date of the trip in YYYY-MM-DD format.'),
  travelers: TravelersSchema.describe('Details about the travelers.'),
  preferences: PreferencesSchema.describe('User preferences for the trip.'),
});
export type GenerateItineraryInput = z.infer<typeof GenerateItineraryInputSchema>;

export const GenerateItineraryOutputSchema = z.array(ItineraryDaySchema).describe('A detailed day-by-day itinerary.');
export type GenerateItineraryOutput = z.infer<typeof GenerateItineraryOutputSchema>;
