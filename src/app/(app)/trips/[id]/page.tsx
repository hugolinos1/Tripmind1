'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import React from 'react';
import { AppHeader } from '@/components/app/app-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Bot, Calendar, Info, MapPin, RefreshCw, Share2, PlusCircle, Edit } from 'lucide-react';
import Link from 'next/link';
import EventCard, { type Event as EventType, type Attachment } from '@/components/app/event-card';
import { TransportSuggestionCard } from '@/components/app/transport-suggestion-card';
import TripInfo from '@/components/app/trip-info';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generateTripItinerary } from '@/ai/flows/ai-generate-trip-itinerary';
import type { GenerateItineraryInput } from '@/ai/types';
import { enrichEventDetails } from '@/ai/flows/ai-enrich-event-details';
import { useToast } from '@/hooks/use-toast';

const MapView = dynamic(() => import('../../../../components/app/map-view'), {
  ssr: false,
  loading: () => <div className="bg-slate-800 animate-pulse w-full h-full" />,
});

type Day = {
    id: string;
    date: Date;
    orderIndex: number;
    events: EventType[];
}

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
        { id: "e1", type: "accommodation" as const, title: "Check-in Hotel Gracery Shinjuku", startTime: "15:00", durationMinutes: 60, locationName: "Hotel Gracery Shinjuku, 1 Chome-19-1 Kabukicho, Shinjuku City, Tokyo 160-8466", isAiEnriched: true, lat: 35.6963, lng: 139.7006, description: "Arrivée et installation à l'hôtel célèbre pour sa tête de Godzilla.", attachments: [{ id: 'attach1', filename: 'Réservation Hotel.pdf', category: 'reservation' as const, url: '#' }] },
        { id: "e2", type: "visit" as const, title: "Exploration de Shinjuku Gyoen", startTime: "16:30", durationMinutes: 120, locationName: "Shinjuku Gyoen National Garden, 11 Naitomachi, Shinjuku City, Tokyo 160-0014", isAiEnriched: false, lat: 35.6852, lng: 139.711, description: "Première découverte de la ville avec une balade dans ce magnifique parc impérial." },
        { id: "e3", type: "meal" as const, title: "Dîner Ramen à Ichiran", startTime: "19:00", durationMinutes: 75, locationName: "Ichiran Shinjuku Central East Exit, 3 Chome-34-11 Shinjuku, Shinjuku City, Tokyo 160-0022", isAiEnriched: true, lat: 35.6909, lng: 139.7034, description: "Dégustation de ramens authentiques dans des box individuels pour une expérience immersive." },
      ] : [],
  })) as Day[],
};

const LOCAL_STORAGE_KEY_PREFIX = 'trip_';

export default function TripEditorPage({ params }: { params: { id: string } }) {
  const [trip, setTrip] = useState({...initialTrip, id: params.id });
  const [selectedDay, setSelectedDay] = useState(0);
  const [isGenerating, setIsGenerating] = useState<'full' | 'day' | false>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const { toast } = useToast();

  const dayEvents = trip.days[selectedDay]?.events || [];
  const dayDate = trip.days[selectedDay]?.date;

  const handleGenerateItinerary = async (dayIndex?: number) => {
    const generationType = typeof dayIndex === 'number' ? 'day' : 'full';
    setIsGenerating(generationType);
    setGenerationError(null);

    const mockTravelers = { adults: 2, children: [], hasPets: false };
    const mockPreferences = { pace: 50, budget: 50, interests: ['culture', 'gastronomy'], accessibility: [], dietary: [], alreadyVisited: [], mustSee: [] };

    const isSingleDay = typeof dayIndex === 'number';
    const startDate = isSingleDay ? format(trip.days[dayIndex!].date, 'yyyy-MM-dd') : trip.startDate;
    const endDate = isSingleDay ? format(trip.days[dayIndex!].date, 'yyyy-MM-dd') : trip.endDate;

    try {
        const input: GenerateItineraryInput = {
            tripId: trip.id,
            title: trip.title,
            destinations: trip.destinations,
            startDate: startDate,
            endDate: endDate,
            travelers: mockTravelers,
            preferences: mockPreferences,
        };

        const generatedItinerary = await generateTripItinerary(input);

        setTrip(currentTrip => {
            const newDays = [...currentTrip.days];
            if (isSingleDay && typeof dayIndex === 'number') {
                 const dayToUpdate = newDays[dayIndex];
                 const dayString = format(dayToUpdate.date, 'yyyy-MM-dd');
                 const generatedDay = generatedItinerary.find(genDay => genDay.date === dayString);

                 if (generatedDay) {
                     newDays[dayIndex] = {
                         ...dayToUpdate,
                         events: generatedDay.events.map((event, index) => ({
                             ...event,
                             id: `gen-event-${dayToUpdate.id}-${index}`,
                             isAiEnriched: false, 
                         })),
                     };
                 }
            } else {
                generatedItinerary.forEach(generatedDay => {
                    const dayIndexToUpdate = newDays.findIndex(d => format(d.date, 'yyyy-MM-dd') === generatedDay.date);
                    if (dayIndexToUpdate !== -1) {
                        const dayToUpdate = newDays[dayIndexToUpdate];
                        newDays[dayIndexToUpdate] = {
                            ...dayToUpdate,
                            events: generatedDay.events.map((event, index) => ({
                                ...event,
                                id: `gen-event-${dayToUpdate.id}-${index}`,
                                isAiEnriched: false,
                            })),
                        };
                    }
                });
            }
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

  const handleEnrichEvent = async (eventId: string) => {
    let eventToEnrich: EventType | undefined;
    
    // Find the event across all days
    for (const day of trip.days) {
        eventToEnrich = day.events.find(e => e.id === eventId);
        if (eventToEnrich) break;
    }

    if (!eventToEnrich) {
        toast({ variant: "destructive", title: "Erreur", description: "L'événement à enrichir n'a pas été trouvé." });
        return;
    }

    try {
        const enrichedData = await enrichEventDetails({
            title: eventToEnrich.title,
            description: eventToEnrich.description,
            locationName: eventToEnrich.locationName,
            type: eventToEnrich.type,
        });

        // Update the trip state with the enriched data
        setTrip(currentTrip => {
            const newDays = currentTrip.days.map(day => ({
                ...day,
                events: day.events.map(event => {
                    if (event.id === eventId) {
                        return {
                            ...event,
                            description: enrichedData.description,
                            practicalInfo: enrichedData.practicalInfo,
                            isAiEnriched: true,
                        };
                    }
                    return event;
                }),
            }));
            return { ...currentTrip, days: newDays };
        });
        toast({ title: "Succès", description: `L'événement "${eventToEnrich.title}" a été enrichi.` });
    } catch (error: any) {
        console.error("Failed to enrich event:", error);
        toast({
            variant: "destructive",
            title: "Échec de l'enrichissement",
            description: error.message || "Une erreur inconnue est survenue.",
        });
        // Re-throw to be caught by the card's local handler if needed
        throw error;
    }
  };

  const handleAddAttachment = (eventId: string, newAttachment: Attachment) => {
    setTrip(currentTrip => {
        const newDays = currentTrip.days.map(day => {
            const eventIndex = day.events.findIndex(e => e.id === eventId);
            if (eventIndex > -1) {
                const updatedEvents = [...day.events];
                const eventToUpdate = { ...updatedEvents[eventIndex] };
                
                eventToUpdate.attachments = [...(eventToUpdate.attachments || []), newAttachment];
                updatedEvents[eventIndex] = eventToUpdate;

                return { ...day, events: updatedEvents };
            }
            return day;
        });

        const newTrip = { ...currentTrip, days: newDays };
        return newTrip;
    });

    toast({
      title: "Pièce jointe ajoutée",
      description: `Le fichier "${newAttachment.filename}" a été ajouté.`,
    });
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
                <Button variant="outline" asChild>
                  <Link href={`/trips/${trip.id}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Modifier
                  </Link>
                </Button>
                <Button variant="outline">
                  <Share2 className="mr-2 h-4 w-4" />
                  Partager
                </Button>
                <Button onClick={() => handleGenerateItinerary()} disabled={isGenerating !== false}>
                {isGenerating === 'full' ? (
                    <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Génération en cours...
                    </>
                ) : (
                    <>
                    <Bot className="mr-2 h-4 w-4" />
                    Générer tout l'itinéraire
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
                           dayEvents.map((event, index) => (
                             <React.Fragment key={event.id}>
                                <EventCard event={event} onEnrich={handleEnrichEvent} onAddAttachment={handleAddAttachment} />
                                {index < dayEvents.length - 1 && (
                                    <TransportSuggestionCard 
                                        startEvent={event}
                                        endEvent={dayEvents[index + 1]}
                                    />
                                )}
                             </React.Fragment>
                           ))
                        ) : (
                            <Card className="text-center p-8 border-dashed border-slate-700 bg-slate-800/20">
                                <p className="text-slate-400">Aucun événement pour ce jour.</p>
                                <div className="mt-4 flex justify-center items-center gap-4">
                                  <Button onClick={() => handleGenerateItinerary(selectedDay)} disabled={isGenerating !== false}>
                                    {isGenerating === 'day' ? (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                            Génération...
                                        </>
                                    ) : (
                                        <>
                                            <Bot className="mr-2 h-4 w-4" />
                                            Générer la journée
                                        </>
                                    )}
                                  </Button>
                                  <Button variant="outline">
                                      <PlusCircle className="mr-2 h-4 w-4" />
                                      Ajouter manuellement
                                  </Button>
                                </div>
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
