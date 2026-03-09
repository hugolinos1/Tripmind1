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
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { v4 as uuidv4 } from 'uuid';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel';

const MapView = dynamic(() => import('../../../../components/app/map-view'), {
  ssr: false,
  loading: () => <div className="bg-slate-800 animate-pulse w-full h-full" />,
});

// Matches the Day entity in Firestore
interface Day {
    id: string;
    date: {
        seconds: number;
        nanoseconds: number;
    }; // Firestore Timestamp
    orderIndex: number;
}

export default function TripEditorPage({ params }: { params: { id: string } }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const tripId = params.id as string;

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState<'full' | 'day' | false>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // --- Data Fetching from Firestore ---
  const tripRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'trips', tripId);
  }, [firestore, user, tripId]);

  const { data: tripData, isLoading: isTripLoading } = useDoc(tripRef);

  const daysQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'trips', tripId, 'days'), orderBy('orderIndex'));
  }, [firestore, user, tripId]);
  const { data: days, isLoading: isDaysLoading } = useCollection<Day>(daysQuery);

  const selectedDay = days?.[selectedDayIndex];

  const eventsQuery = useMemoFirebase(() => {
    if (!user || !firestore || !selectedDay) return null;
    return query(collection(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDay.id, 'events'), orderBy('orderIndex'));
  }, [firestore, user, tripId, selectedDay]);
  const { data: events, isLoading: isEventsLoading } = useCollection<EventType>(eventsQuery);

  // Reset selected day if days change
  useEffect(() => {
    setSelectedDayIndex(0);
  }, [days?.length]);

  const handleGenerateItinerary = async (dayIndex?: number) => {
    if (!tripData) {
        toast({
            variant: "destructive",
            title: "Erreur",
            description: "Les données du voyage ne sont pas encore chargées.",
        });
        return;
    }

    const generationType = typeof dayIndex === 'number' ? 'day' : 'full';
    setIsGenerating(generationType);
    setGenerationError(null);

    const travelers = JSON.parse(tripData.travelers || '{}');
    const preferences = JSON.parse(tripData.preferences || '{}');

    const tripStartDate = tripData.startDate?.toDate();
    const tripEndDate = tripData.endDate?.toDate();

    if (!tripStartDate || !tripEndDate) {
        toast({ variant: "destructive", title: "Erreur", description: "Les dates du voyage ne sont pas définies." });
        setIsGenerating(false);
        return;
    }

    try {
        const input: GenerateItineraryInput = {
            tripId: tripData.id,
            title: tripData.title,
            destinations: tripData.destinations,
            startDate: format(tripStartDate, 'yyyy-MM-dd'),
            endDate: format(tripEndDate, 'yyyy-MM-dd'),
            travelers: travelers,
            preferences: preferences,
        };

        const generatedItinerary = await generateTripItinerary(input);
        
        if (!user || !firestore) throw new Error("Utilisateur ou base de données non disponible.");
        if (days && days.length > 0) {
            // This is a simple guard. A more robust solution would involve merging or clearing data.
            toast({
                variant: "destructive",
                title: "Itinéraire existant",
                description: "Veuillez supprimer ce voyage et en créer un nouveau pour régénérer un itinéraire complet.",
            });
            setIsGenerating(false);
            return;
        }

        const batch = writeBatch(firestore);

        for (const [dayIdx, generatedDay] of generatedItinerary.entries()) {
            const dayId = uuidv4();
            const dayRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', dayId);

            const dayData = {
                tripId: tripId,
                date: new Date(generatedDay.date),
                orderIndex: dayIdx,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            batch.set(dayRef, dayData);

            for (const [eventIndex, generatedEvent] of generatedDay.events.entries()) {
                const eventId = uuidv4();
                const eventRef = doc(dayRef, 'events', eventId);
                const eventData = {
                    dayId: dayId,
                    type: generatedEvent.type,
                    title: generatedEvent.title,
                    description: generatedEvent.description || '',
                    startTime: generatedEvent.startTime || null,
                    durationMinutes: generatedEvent.durationMinutes || null,
                    locationName: generatedEvent.locationName || '',
                    lat: generatedEvent.lat || null,
                    lng: generatedEvent.lng || null,
                    orderIndex: eventIndex,
                    isAiEnriched: false,
                    photos: [],
                    practicalInfo: JSON.stringify({}),
                    attachments: [],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };
                batch.set(eventRef, eventData);
            }
        }
        
        await batch.commit();
        toast({ title: "Itinéraire sauvegardé !", description: "Votre itinéraire a été généré et sauvegardé avec succès." });

    } catch (error) {
        console.error("Failed to generate and save itinerary:", error);
        const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
        setGenerationError(`La génération a échoué : ${errorMessage}`);
        toast({ variant: "destructive", title: "Échec de la génération", description: errorMessage });
    } finally {
        setIsGenerating(false);
    }
  };

  const handleEnrichEvent = async (eventId: string) => {
    if (!selectedDay || !events) {
        toast({ variant: "destructive", title: "Erreur", description: "Aucun jour ou événement sélectionné." });
        return;
    }
    const eventToEnrich = events.find(e => e.id === eventId);

    if (!eventToEnrich || !user || !firestore) {
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

        const eventRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDay.id, 'events', eventId);
        
        updateDocumentNonBlocking(eventRef, {
            description: enrichedData.description,
            practicalInfo: JSON.stringify(enrichedData.practicalInfo),
            isAiEnriched: true,
            updatedAt: serverTimestamp()
        });

        toast({ title: "Succès", description: `L'événement "${eventToEnrich.title}" a été enrichi.` });
    } catch (error: any) {
        console.error("Failed to enrich event:", error);
        toast({
            variant: "destructive",
            title: "Échec de l'enrichissement",
            description: error.message || "Une erreur inconnue est survenue.",
        });
        throw error;
    }
  };

  const handleAddAttachment = (eventId: string, newAttachment: Attachment) => {
    if (!selectedDay || !events || !user || !firestore) return;

    const eventToUpdate = events.find(e => e.id === eventId);
    if (!eventToUpdate) return;
    
    const updatedAttachments = [...(eventToUpdate.attachments || []), newAttachment];
    const eventRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDay.id, 'events', eventId);

    updateDocumentNonBlocking(eventRef, { attachments: updatedAttachments, updatedAt: serverTimestamp() });

    toast({
      title: "Pièce jointe ajoutée",
      description: `Le fichier "${newAttachment.filename}" a été ajouté.`,
    });
  };

  const isLoading = isTripLoading || isDaysLoading;

  if (isLoading) {
    return (
        <div className="flex flex-col h-screen bg-bg-dark">
            <AppHeader />
             <header className="container mx-auto px-6 py-4 flex items-center justify-between border-b border-slate-800">
                <Skeleton className="h-12 w-1/3" />
                <Skeleton className="h-10 w-64" />
            </header>
            <div className="container mx-auto px-6 py-4 border-b border-slate-800">
                 <Skeleton className="h-10 w-1/4" />
            </div>
            <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-px bg-slate-800 overflow-hidden">
                <div className="p-6 space-y-4">
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
                 <Skeleton className="h-full w-full" />
            </div>
        </div>
    )
  }

  const dayDate = selectedDay?.date?.seconds ? new Date(selectedDay.date.seconds * 1000) : null;
  const dayEvents = events || [];

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
              <h1 className="text-2xl font-bold font-headline">{tripData?.title}</h1>
              <p className="text-sm text-slate-400 flex items-center gap-2">
                <MapPin className="h-3 w-3" />
                {Array.isArray(tripData?.destinations) ? tripData?.destinations.join(' → ') : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end">
             <div className="flex items-center gap-2">
                <Button variant="outline" asChild>
                  <Link href={`/trips/${tripId}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Modifier
                  </Link>
                </Button>
                <Button variant="outline">
                  <Share2 className="mr-2 h-4 w-4" />
                  Partager
                </Button>
                {(!days || days.length === 0) && (
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
                )}
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
            {days && days.length > 0 ? (
              <>
                {/* Day Selector */}
                <div className="w-full border-b border-slate-800">
                    <div className="container mx-auto px-6">
                        <div className="relative py-2">
                            <Carousel
                                opts={{
                                    align: "start",
                                    dragFree: true,
                                }}
                                className="mx-8"
                            >
                                <CarouselContent className="-ml-2">
                                    {days.map((day, index) => {
                                        return (
                                            <CarouselItem key={day.id} className="basis-auto pl-2">
                                                <Button
                                                    variant={selectedDayIndex === index ? 'secondary' : 'ghost'}
                                                    className={`flex-shrink-0 ${selectedDayIndex === index ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                                                    onClick={() => setSelectedDayIndex(index)}
                                                >
                                                    Jour {day.orderIndex + 1}
                                                </Button>
                                            </CarouselItem>
                                        )
                                    })}
                                </CarouselContent>
                                <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-slate-800/80 hover:bg-slate-700 disabled:hidden" />
                                <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-slate-800/80 hover:bg-slate-700 disabled:hidden" />
                            </Carousel>
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
                            {isEventsLoading ? (
                                <>
                                    <Skeleton className="h-24 w-full" />
                                    <Skeleton className="h-24 w-full" />
                                </>
                            ) : dayEvents.length > 0 ? (
                               dayEvents.map((event, index) => (
                                 <React.Fragment key={event.id}>
                                    <EventCard event={event} onEnrich={handleEnrichEvent} onAddAttachment={(att) => handleAddAttachment(event.id, att)} />
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
                                </Card>
                            )}
                        </div>
                    </div>
                  </div>
                  <div className="bg-bg-dark h-full min-h-[300px] lg:min-h-0">
                    <MapView events={dayEvents} />
                  </div>
                </div>
              </>
            ) : (
                <div className="flex-grow flex items-center justify-center">
                     <Card className="col-span-full flex flex-col items-center justify-center p-12 border-dashed border-slate-700 bg-slate-800/20">
                        <h2 className="text-xl font-semibold mb-2">Prêt à planifier ?</h2>
                        <p className="text-slate-400 mb-6">Générez un itinéraire pour commencer.</p>
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
                     </Card>
                </div>
            )}
          </TabsContent>

          <TabsContent value="info" className="flex-grow overflow-y-auto bg-slate-900/50">
            <TripInfo destinations={Array.isArray(tripData?.destinations) ? tripData.destinations : []} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
