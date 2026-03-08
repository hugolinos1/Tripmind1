'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { AppHeader } from '@/components/app/app-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Bot, Calendar, Info, MapPin, RefreshCw, Share2 } from 'lucide-react';
import Link from 'next/link';
import EventCard from '@/components/app/event-card';
import TripInfo from '@/components/app/trip-info';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generateTripItinerary } from '@/ai/flows/ai-generate-trip-itinerary';
import type { GenerateItineraryInput } from '@/ai/schemas/trip-itinerary-schemas';

const MapView = dynamic(() => import('@/components/app/map-view'), {
  ssr: false,
  loading: () => <div className="bg-slate-800 animate-pulse w-full h-full" />,
});

const initialTrip = {
  id: "1",
  title: "Aventure au Japon",
  destinations: ["Tokyo", "Kyoto"],
  startDate: "2024-08-15",
  endDate: "2024-08-29",
  days: Array.from({ length: 15 }, (_, i) => ({
    id: `day-${i + 1}`,
    date: new Date(new Date("2024-08-15").setDate(new Date("2024-08-15").getDate() + i)),
    orderIndex: i,
    events: i === 0 ? [
        { id: "e1", type: "accommodation" as const, title: "Check-in Hotel Gracery Shinjuku", startTime: "15:00", durationMinutes: 60, locationName: "Shinjuku, Tokyo", isAiEnriched: true, lat: 35.695, lng: 139.700, description: "Arrivée et installation à l\'hôtel." },
        { id: "e2", type: "visit" as const, title: "Exploration de Shinjuku Gyoen", startTime: "16:30", durationMinutes: 120, locationName: "Shinjuku Gyoen National Garden", isAiEnriched: false, lat: 35.685, lng: 139.710, description: "Première découverte de la ville avec une balade dans ce magnifique parc." },
        { id: "e3", type: "meal" as const, title: "Dîner Ramen à Ichiran", startTime: "19:00", durationMinutes: 75, locationName: "Ichiran Shinjuku Central East Exit", isAiEnriched: true, lat: 35.691, lng: 139.704, description: "Dégustation de ramens authentiques." },
      ] : [],
  })),
};

export default function TripEditorPage({ params }: { params: { id: string } }) {
  const [trip, setTrip] = useState(initialTrip);
  const [selectedDay, setSelectedDay] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const dayEvents = trip.days[selectedDay]?.events || [];
  const dayDate = trip.days[selectedDay]?.date;

  const handleGenerateItinerary = async () => {
    setIsGenerating(true);
    setGenerationError(null);

    const mockTravelers = { adults: 2, children: [], hasPets: false };
    const mockPreferences = { pace: 50, budget: 50, interests: ['culture', 'gastronomy'], accessibility: [], dietary: [], alreadyVisited: [], mustSee: [] };

    try {
        const input: GenerateItineraryInput = {
            tripId: trip.id,
            title: trip.title,
            destinations: trip.destinations,
            startDate: trip.startDate,
            endDate: trip.endDate,
            travelers: mockTravelers,
            preferences: mockPreferences,
        };

        const generatedItinerary = await generateTripItinerary(input);

        setTrip(currentTrip => {
            const newDays = currentTrip.days.map(day => {
                const dayString = format(day.date, 'yyyy-MM-dd');
                const generatedDay = generatedItinerary.find(genDay => genDay.date === dayString);

                if (generatedDay) {
                    return {
                        ...day,
                        events: generatedDay.events.map((event, index) => ({
                            ...event,
                            id: `gen-event-${day.id}-${index}`,
                            isAiEnriched: false, 
                        })),
                    };
                }
                return day;
            });

            return { ...currentTrip, days: newDays };
        });

    } catch (error) {
        console.error("Failed to generate itinerary:", error);
        const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
        setGenerationError(`La génération a échoué : ${errorMessage}`);
    } finally {
        setIsGenerating(false);
    }
  };


  return (
    <div className="flex flex-col h-screen bg-bg-dark">
      <AppHeader />

      <div className="flex-grow flex flex-col overflow-hidden">
        {/* Trip Header */}
        <header className="container mx-auto px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Retour au dashboard</span>
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold font-headline">{trip.title}</h1>
              <p className="text-sm text-slate-400 flex items-center gap-2">
                <MapPin className="h-3 w-3" />
                {trip.destinations.join(' → ')}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2">
                <Button variant="outline">
                <Share2 className="mr-2 h-4 w-4" />
                Partager
                </Button>
                <Button onClick={handleGenerateItinerary} disabled={isGenerating}>
                {isGenerating ? (
                    <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Génération en cours...
                    </>
                ) : (
                    <>
                    <Bot className="mr-2 h-4 w-4" />
                    Générer l'itinéraire
                    </>
                )}
                </Button>
            </div>
            {generationError && <p className="text-sm text-destructive mt-2">{generationError}</p>}
          </div>
        </header>

        <Tabs defaultValue="itinerary" className="flex-grow flex flex-col overflow-hidden">
          <div className="container mx-auto px-6 border-b border-slate-800">
            <TabsList className="p-0 bg-transparent -mb-px">
              <TabsTrigger value="itinerary" className="text-base rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent">
                <Calendar className="mr-2 h-4 w-4" /> Itinéraire
              </TabsTrigger>
              <TabsTrigger value="info" className="text-base rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent">
                <Info className="mr-2 h-4 w-4" /> À Savoir
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="itinerary" className="flex-grow flex flex-col overflow-hidden bg-slate-900/50">
            {/* Day Selector */}
            <div className="w-full border-b border-slate-800">
              <div className="container mx-auto px-6">
              <div className="flex items-center gap-2 overflow-x-auto py-2 no-scrollbar">
                {trip.days.map((day, index) => (
                  <Button
                    key={day.id}
                    variant={selectedDay === index ? 'secondary' : 'ghost'}
                    className={`flex-shrink-0 ${selectedDay === index ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                    onClick={() => setSelectedDay(index)}
                  >
                    Jour {day.orderIndex + 1}
                    <span className="ml-2 text-xs opacity-70">
                      {format(day.date, 'd MMM', { locale: fr })}
                    </span>
                  </Button>
                ))}
              </div>
              </div>
            </div>
            
            <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-px bg-slate-800 overflow-hidden">
              <div className="flex flex-col bg-bg-dark lg:overflow-y-auto">
                <div className="p-6">
                    <h2 className="text-xl font-bold mb-4 font-headline capitalize">
                        {dayDate ? format(dayDate, 'EEEE d MMMM', { locale: fr }) : ''}
                    </h2>
                    <div className="space-y-4">
                        {dayEvents.length > 0 ? (
                           dayEvents.map(event => <EventCard key={event.id} event={event} />)
                        ) : (
                            <Card className="text-center p-8 border-dashed border-slate-700 bg-slate-800/20">
                                <p className="text-slate-400">Aucun événement pour ce jour. Cliquez sur "Générer l'itinéraire" pour commencer.</p>
                                <Button className="mt-4">Ajouter un événement</Button>
                            </Card>
                        )}
                    </div>
                </div>
              </div>
              <div className="bg-bg-dark h-full min-h-[300px] lg:min-h-0">
                <MapView events={dayEvents} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="info" className="flex-grow overflow-y-auto bg-slate-900/50">
            <TripInfo destinations={trip.destinations} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
