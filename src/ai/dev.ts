import { config } from 'dotenv';
config();

import '@/ai/flows/ai-enrich-event-details.ts';
import '@/ai/flows/ai-generate-trip-itinerary.ts';
import '@/ai/flows/ai-get-destination-insights.ts';