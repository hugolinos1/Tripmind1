
'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import React from 'react';
import { AppHeader } from '@/components/app/app-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Info, MapPin, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import EventCard from '@/components/app/event-card';
import type { Event as EventType } from '@/components/app/event-card';
import { TransportSuggestionCard } from '@/components/app/transport-suggestion-card';
import TripInfo from '@/components/app/trip-info';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel';
import { useIsMobile } from '@/hooks/use-mobile';


const MapView = dynamic(() => import('@/components/app/map-view'), {
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
    startLocationName?: string;
    endLocationName?: string;
    startLat?: number;
    startLng?: number;
    endLat?: number;
    endLng?: number;
    transportSuggestions?: string;
}

// A read-only version of the EventCard for the public page
const PublicEventCard = ({ event }: { event: EventType }) => {
    return (
        <EventCard 
            event={event}
            onEnrich={() => Promise.resolve()}
            onAddAttachment={() => {}}
            onMove={() => {}}
            onGeocode={() => {}}
            onDelete={() => {}}
            onEdit={() => {}}
            isFirst={false}
            isLast={false}
            isGeocoding={false}
        />
    )
};


export default function SharedTripPage({ params }: { params: { id: string } }) {
  const firestore = useFirestore();
  const tripId = params.id as string;

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  // --- Data Fetching from Public Collection ---
  const tripRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'publicTrips', tripId);
  }, [firestore, tripId]);

  const { data: tripData, isLoading: isTripLoading } = useDoc(tripRef);

  const daysQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'publicTrips', tripId, 'days'), orderBy('orderIndex'));
  }, [firestore, tripId]);
  const { data: days, isLoading: isDaysLoading } = useCollection<Day>(daysQuery);

  const selectedDayId = useMemo(() => days?.[selectedDayIndex]?.id, [days, selectedDayIndex]);
  
  const selectedDay = useMemo(() => {
      if (!days || !selectedDayId) return undefined;
      return days.find(d => d.id === selectedDayId);
  }, [days, selectedDayId]);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !selectedDayId) return null;
    return query(collection(firestore, 'publicTrips', tripId, 'days', selectedDayId, 'events'), orderBy('orderIndex'));
  }, [firestore, tripId, selectedDayId]);
  const { data: events, isLoading: isEventsLoading } = useCollection<EventType>(eventsQuery);

    const startOfDayEvent = useMemo(() => ({
      title: 'Lieu de départ',
      locationName: selectedDay?.startLocationName,
      lat: selectedDay?.startLat,
      lng: selectedDay?.startLng,
  }), [selectedDay]);

  const endOfDayEvent = useMemo(() => ({
      id: 'end-of-day',
      title: "Lieu de retour",
      locationName: selectedDay?.endLocationName,
      lat: selectedDay?.endLat,
      lng: selectedDay?.endLng,
      type: 'activity' as const,
      isAiEnriched: false,
      orderIndex: -1,
  }), [selectedDay]);


  const isLoading = isTripLoading || isDaysLoading;

  if (isLoading) {
    return (
        <div className="flex flex-col min-h-screen bg-bg-dark">
            <AppHeader />
             <header className="container mx-auto px-6 py-4 flex items-center justify-between border-b border-slate-800">
                <Skeleton className="h-12 w-1/3" />
            </header>
            <div className="container mx-auto px-6 py-4 border-b border-slate-800">
                 <Skeleton className="h-10 w-1/4" />
            </div>
            <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-px bg-slate-800">
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

  if (!tripData && !isLoading) {
      return (
          <div className="flex flex-col min-h-screen bg-bg-dark">
              <AppHeader />
              <div className="flex-grow flex items-center justify-center text-center">
                  <div>
                      <h1 className="text-2xl font-bold">Voyage non trouvé</h1>
                      <p className="text-slate-400 mt-2">Ce lien de partage est peut-être invalide ou le voyage a été supprimé.</p>
                      <Button asChild className="mt-6">
                        <Link href="/">Retour à l'accueil</Link>
                      </Button>
                  </div>
              </div>
          </div>
      )
  }

  const dayDate = selectedDay?.date?.seconds ? new Date(selectedDay.date.seconds * 1000) : (selectedDay?.date as any)?.toDate ? (selectedDay?.date as any).toDate() : null;
  const dayEvents = events || [];

  return (
    <div className="flex flex-col min-h-screen bg-bg-dark">
      <AppHeader />

      <div className="flex-grow flex flex-col">
        {/* Trip Header */}
        <header className="container mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-4">
             <Button variant="outline" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Retour à l'accueil</span>
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
        </header>

        <Tabs defaultValue="itinerary" className="flex-grow flex flex-col">
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

          <TabsContent value="itinerary" className="flex-grow flex flex-col lg:grid lg:grid-cols-2 lg:grid-rows-1">
            {days && days.length > 0 ? (
              <>
                {/* Day Itinerary */}
                <div className="flex flex-col lg:overflow-y-auto relative z-10">
                    {/* Day Selector */}
                    <div className="w-full border-b border-slate-800 sticky top-0 bg-bg-dark/80 backdrop-blur-sm z-10">
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
                                    <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-slate-800/80 hover:bg-slate-700 disabled:hidden text-foreground" />
                                    <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-slate-800/80 hover:bg-slate-700 disabled:hidden text-foreground" />
                                </Carousel>
                            </div>
                        </div>
                    </div>
                    
                    {/* Event List */}
                    <div className="p-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
                            <h2 className="text-xl font-bold font-headline capitalize">
                                {dayDate ? format(dayDate, 'EEEE d MMMM', { locale: fr }) : ''}
                            </h2>
                        </div>
                        
                        <div className="space-y-4">
                            {isEventsLoading ? (
                                <>
                                    <Skeleton className="h-24 w-full" />
                                    <Skeleton className="h-24 w-full" />
                                </>
                            ) : dayEvents.length > 0 ? (
                                <>
                                    {dayEvents.map((event, index) => (
                                    <React.Fragment key={event.id}>
                                        <PublicEventCard 
                                            event={event} 
                                        />
                                        {index < dayEvents.length - 1 && (
                                            <TransportSuggestionCard 
                                                startEvent={event as any}
                                                endEvent={dayEvents[index + 1] as any}
                                                savedSuggestionsJSON={event.transportSuggestions}
                                                onGenerate={async () => {}}
                                            />
                                        )}
                                    </React.Fragment>
                                    ))}
                                </>
                            ) : (
                                <Card className="text-center p-8 border-dashed border-slate-700 bg-slate-800/20">
                                    <p className="text-slate-400">Aucun événement pour ce jour.</p>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>

                {/* Map View */}
                <div className="bg-bg-dark h-[50vh] min-h-[400px] lg:h-auto lg:min-h-0 relative z-0">
                    <MapView events={dayEvents} day={selectedDay} />
                </div>
              </>
            ) : (
                <div className="flex-grow flex items-center justify-center col-span-2">
                     <Card className="col-span-full flex flex-col items-center justify-center p-12 border-dashed border-slate-700 bg-slate-800/20">
                        <h2 className="text-xl font-semibold mb-2">Itinéraire en cours de préparation...</h2>
                        <p className="text-slate-400 mb-6">Ce voyage n'a pas encore d'itinéraire défini.</p>
                     </Card>
                </div>
            )}
          </TabsContent>

          <TabsContent value="info" className="flex-grow overflow-y-auto bg-slate-900/50">
            <TripInfo tripId={tripId} destinations={Array.isArray(tripData?.destinations) ? tripData.destinations : []} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
