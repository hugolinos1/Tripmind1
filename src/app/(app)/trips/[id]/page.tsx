'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { AppHeader } from '@/components/app/app-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Bot, Calendar, Info, MapPin, RefreshCw, Share2, PlusCircle, Edit, Loader2 } from 'lucide-react';
import Link from 'next/link';
import EventCard, { type Event as EventType, type Attachment } from '@/components/app/event-card';
import { TransportSuggestionCard } from '@/components/app/transport-suggestion-card';
import TripInfo from '@/components/app/trip-info';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generateTripItinerary } from '@/ai/flows/ai-generate-trip-itinerary';
import type { GenerateItineraryInput } from '@/ai/types';
import { enrichEventDetails } from '@/ai/flows/ai-enrich-event-details';
import { geocodeLocation } from '@/ai/flows/ai-geocode-location';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, serverTimestamp, writeBatch, setDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { v4 as uuidv4 } from 'uuid';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel';
import { cn } from '@/lib/utils';

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
    startLocationName?: string;
    endLocationName?: string;
    startLat?: number;
    startLng?: number;
    endLat?: number;
    endLng?: number;
}

const eventFormSchema = z.object({
    title: z.string().min(3, { message: 'Le titre doit contenir au moins 3 caractères.' }),
    type: z.enum(['activity', 'visit', 'meal', 'transport', 'accommodation'], { required_error: 'Veuillez sélectionner un type.'}),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Format HH:mm invalide.' }).optional().or(z.literal('')),
    durationMinutes: z.coerce.number().int().positive().optional(),
    locationName: z.string().optional(),
  });
  
type EventFormValues = z.infer<typeof eventFormSchema>;
  

export default function TripEditorPage({ params }: { params: { id: string } }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const tripId = params.id as string;

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState<'full' | 'day' | false>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [isGeocoding, setIsGeocoding] = useState<null | 'start' | 'end' | string>(null);

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
  
  const eventForm = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: '',
      type: 'activity',
      startTime: '',
      durationMinutes: undefined,
      locationName: '',
    },
  });

  // Reset selected day if days change
  useEffect(() => {
    setSelectedDayIndex(0);
  }, [days?.length]);

  useEffect(() => {
    if (selectedDay) {
        setStartLocation(selectedDay.startLocationName || '');
        setEndLocation(selectedDay.endLocationName || '');
    } else {
        setStartLocation('');
        setEndLocation('');
    }
  }, [selectedDay]);

  const handleLocationUpdate = (field: 'start' | 'end', value: string) => {
    if (!user || !firestore || !selectedDay) return;
    
    if ((field === 'start' && value === selectedDay.startLocationName) || (field === 'end' && value === selectedDay.endLocationName)) return;

    toast({ title: "Mise à jour...", description: "Enregistrement du lieu." });
    
    const dayRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDay.id);

    if (field === 'start') {
        updateDocumentNonBlocking(dayRef, { startLocationName: value, startLat: null, startLng: null });
    } else { // field === 'end'
        updateDocumentNonBlocking(dayRef, { endLocationName: value, endLat: null, endLng: null });
        const nextDay = days?.[selectedDayIndex + 1];
        if (nextDay) {
            const nextDayRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', nextDay.id);
            updateDocumentNonBlocking(nextDayRef, { startLocationName: value, startLat: null, startLng: null });
        }
    }
  };

  const handleGeocodeDayLocation = async (field: 'start' | 'end') => {
    if (!user || !firestore || !selectedDay) return;

    const locationName = field === 'start' ? startLocation : endLocation;
    if (!locationName) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Le nom du lieu est vide.' });
        return;
    }

    setIsGeocoding(field);
    try {
        const { lat, lng } = await geocodeLocation({ location: locationName });
        
        const dayRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDay.id);
        const updateData = field === 'start' 
            ? { startLat: lat, startLng: lng }
            : { endLat: lat, endLng: lng };

        updateDocumentNonBlocking(dayRef, updateData);

        toast({ title: 'Géolocalisation réussie', description: `${locationName} a été localisé.` });

    } catch (error: any) {
        console.error("Geocoding failed:", error);
        toast({ variant: 'destructive', title: 'Échec de la géolocalisation', description: error.message });
    } finally {
        setIsGeocoding(null);
    }
  }

  const handleGeocodeEvent = async (eventId: string) => {
    if (!user || !firestore || !selectedDay || !events) return;

    const eventToGeocode = events.find(e => e.id === eventId);
    if (!eventToGeocode || !eventToGeocode.locationName) {
        toast({ variant: 'destructive', title: 'Erreur', description: "Le nom du lieu de l'événement est vide." });
        return;
    }

    setIsGeocoding(eventId);
    try {
        const { lat, lng } = await geocodeLocation({ location: eventToGeocode.locationName });

        const eventRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDay.id, 'events', eventId);
        updateDocumentNonBlocking(eventRef, { lat, lng, updatedAt: serverTimestamp() });

        toast({ title: 'Géolocalisation réussie', description: `${eventToGeocode.locationName} a été localisé.` });

    } catch (error: any) {
        console.error("Geocoding failed:", error);
        toast({ variant: 'destructive', title: 'Échec de la géolocalisation', description: error.message });
    } finally {
        setIsGeocoding(null);
    }
  };

  const handleCreateDaysManually = async () => {
    if (!tripData || !user || !firestore) {
        toast({ variant: "destructive", title: "Erreur", description: "Données du voyage non chargées." });
        return;
    }
    const tripStartDate = tripData.startDate?.toDate();
    const tripEndDate = tripData.endDate?.toDate();

    if (!tripStartDate || !tripEndDate) {
        toast({ variant: "destructive", title: "Erreur", description: "Les dates du voyage ne sont pas définies." });
        return;
    }

    try {
        const batch = writeBatch(firestore);
        // Calculate number of days. Add 1 to include both start and end dates.
        const diffTime = tripEndDate.getTime() - tripStartDate.getTime();
        const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

        for (let i = 0; i <= diffDays; i++) {
            const dayDate = new Date(tripStartDate);
            dayDate.setDate(dayDate.getDate() + i);

            const dayId = uuidv4();
            const dayRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', dayId);
            const dayData = {
                tripId: tripId,
                date: dayDate,
                orderIndex: i,
                notes: "",
                startLocationName: "",
                endLocationName: "",
                startLat: null,
                startLng: null,
                endLat: null,
                endLng: null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            batch.set(dayRef, dayData);
        }
        await batch.commit();
        toast({ title: "Jours créés !", description: "Vous pouvez maintenant ajouter des événements à chaque jour." });
    } catch (error) {
        console.error("Failed to create days:", error);
        toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer la structure des jours." });
    }
  };

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
                startLocationName: generatedDay.location,
                endLocationName: generatedDay.location,
                startLat: null,
                startLng: null,
                endLat: null,
                endLng: null,
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

  const handleAddEvent = async (values: EventFormValues) => {
    if (!user || !firestore || !selectedDay) {
        toast({ variant: "destructive", title: "Erreur", description: "Impossible d'ajouter un événement. Aucun jour sélectionné." });
        return;
    }
    
    const orderIndex = events?.length || 0;

    try {
        const eventId = uuidv4();
        const eventRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDay.id, 'events', eventId);
        
        const eventData = {
            dayId: selectedDay.id,
            type: values.type,
            title: values.title,
            description: '',
            startTime: values.startTime || null,
            durationMinutes: values.durationMinutes || null,
            locationName: values.locationName || '',
            lat: null,
            lng: null,
            orderIndex: orderIndex,
            isAiEnriched: false,
            photos: [],
            practicalInfo: JSON.stringify({}),
            attachments: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        await setDoc(eventRef, eventData);
        
        toast({ title: "Événement ajouté !", description: `L'événement "${values.title}" a été ajouté.` });
        setIsAddEventOpen(false);
        eventForm.reset();

    } catch (error) {
        console.error("Error adding event:", error);
        toast({ variant: "destructive", title: "Erreur", description: "Impossible d'ajouter l'événement." });
    }
  };

  const handleMoveEvent = async (eventId: string, direction: 'up' | 'down') => {
    if (!user || !firestore || !selectedDay || !events || events.length < 2) return;

    const eventIndex = events.findIndex(e => e.id === eventId);
    if (eventIndex === -1) return;

    const otherEventIndex = direction === 'up' ? eventIndex - 1 : eventIndex + 1;
    if (otherEventIndex < 0 || otherEventIndex >= events.length) return;

    const eventToMove = events[eventIndex];
    const otherEvent = events[otherEventIndex];

    const batch = writeBatch(firestore);

    const eventToMoveRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDay.id, 'events', eventToMove.id);
    batch.update(eventToMoveRef, { orderIndex: otherEvent.orderIndex, updatedAt: serverTimestamp() });

    const otherEventRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDay.id, 'events', otherEvent.id);
    batch.update(otherEventRef, { orderIndex: eventToMove.orderIndex, updatedAt: serverTimestamp() });

    try {
        await batch.commit();
        toast({ title: "Ordre mis à jour", description: "L'ordre des événements a été modifié." });
    } catch (error) {
        console.error("Error reordering events: ", error);
        toast({
            variant: "destructive",
            title: "Erreur",
            description: "Impossible de réorganiser les événements."
        });
    }
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
                                <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-slate-800/80 hover:bg-slate-700 disabled:hidden text-foreground" />
                                <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-slate-800/80 hover:bg-slate-700 disabled:hidden text-foreground" />
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
                        
                        <Card className="mb-6 bg-slate-800/50 border-slate-700/50">
                            <CardContent className="p-4 space-y-4">
                                <div>
                                    <Label htmlFor="start-location" className="text-xs font-semibold text-slate-400">Lieu de départ</Label>
                                    <div className="relative flex items-center mt-1">
                                        <Input
                                            id="start-location"
                                            value={startLocation}
                                            onChange={(e) => setStartLocation(e.target.value)}
                                            onBlur={(e) => handleLocationUpdate('start', e.target.value)}
                                            placeholder="Hôtel, aéroport, gare..."
                                            className="bg-slate-900/50 border-slate-700 pr-10"
                                        />
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className={cn(
                                                "absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8",
                                                selectedDay?.startLat && selectedDay?.startLng 
                                                    ? 'text-green-500 hover:text-green-400' 
                                                    : 'text-slate-400 hover:text-primary'
                                            )}
                                            onClick={() => handleGeocodeDayLocation('start')}
                                            disabled={isGeocoding === 'start' || !startLocation}
                                            aria-label="Géolocaliser le lieu de départ"
                                        >
                                            {isGeocoding === 'start' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="end-location" className="text-xs font-semibold text-slate-400">Lieu d'arrivée</Label>
                                    <div className="relative flex items-center mt-1">
                                        <Input
                                            id="end-location"
                                            value={endLocation}
                                            onChange={(e) => setEndLocation(e.target.value)}
                                            onBlur={(e) => handleLocationUpdate('end', e.target.value)}
                                            placeholder="Hôtel, aéroport, gare..."
                                            className="bg-slate-900/50 border-slate-700 pr-10"
                                        />
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className={cn(
                                                "absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8",
                                                selectedDay?.endLat && selectedDay?.endLng 
                                                    ? 'text-green-500 hover:text-green-400' 
                                                    : 'text-slate-400 hover:text-primary'
                                            )}
                                            onClick={() => handleGeocodeDayLocation('end')}
                                            disabled={isGeocoding === 'end' || !endLocation}
                                            aria-label="Géolocaliser le lieu d'arrivée"
                                        >
                                            {isGeocoding === 'end' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-4">
                            {isEventsLoading ? (
                                <>
                                    <Skeleton className="h-24 w-full" />
                                    <Skeleton className="h-24 w-full" />
                                </>
                            ) : dayEvents.length > 0 ? (
                               dayEvents.map((event, index) => (
                                 <React.Fragment key={event.id}>
                                    {index === 0 && (startLocation || selectedDay?.startLat) && (
                                        <TransportSuggestionCard 
                                            startEvent={{ title: 'Lieu de départ', locationName: startLocation, lat: selectedDay?.startLat, lng: selectedDay?.startLng }}
                                            endEvent={event}
                                        />
                                    )}
                                    <EventCard 
                                      event={event} 
                                      onEnrich={handleEnrichEvent} 
                                      onAddAttachment={(att) => handleAddAttachment(event.id, att)}
                                      onMoveUp={() => handleMoveEvent(event.id, 'up')}
                                      onMoveDown={() => handleMoveEvent(event.id, 'down')}
                                      onGeocode={handleGeocodeEvent}
                                      isFirst={index === 0}
                                      isLast={index === dayEvents.length - 1}
                                      isGeocoding={isGeocoding === event.id}
                                    />
                                    {index < dayEvents.length - 1 ? (
                                        <TransportSuggestionCard 
                                            startEvent={event}
                                            endEvent={dayEvents[index + 1]}
                                        />
                                    ) : (
                                        (endLocation || selectedDay?.endLat) && (
                                            <TransportSuggestionCard 
                                                startEvent={event}
                                                endEvent={{ title: "Lieu d'arrivée", locationName: endLocation, lat: selectedDay?.endLat, lng: selectedDay?.endLng }}
                                            />
                                        )
                                    )}
                                 </React.Fragment>
                               ))
                            ) : (
                                <Card className="text-center p-8 border-dashed border-slate-700 bg-slate-800/20">
                                    <p className="text-slate-400">Aucun événement pour ce jour.</p>
                                </Card>
                            )}
                             {!isEventsLoading && (
                                <div className="pt-4">
                                    <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" className="w-full">
                                                <PlusCircle className="mr-2 h-4 w-4" />
                                                Ajouter un événement
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Ajouter un nouvel événement</DialogTitle>
                                                <DialogDescription>
                                                    Remplissez les détails de votre nouvel événement pour le {dayDate ? `Jour ${selectedDayIndex+1}`: ''}.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <Form {...eventForm}>
                                                <form onSubmit={eventForm.handleSubmit(handleAddEvent)} className="space-y-4">
                                                    <FormField control={eventForm.control} name="title" render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Titre</FormLabel>
                                                            <FormControl><Input placeholder="Ex: Dîner au restaurant" {...field} /></FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}/>
                                                    <FormField control={eventForm.control} name="type" render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Type</FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                <FormControl><SelectTrigger><SelectValue placeholder="Sélectionnez un type" /></SelectTrigger></FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="activity">Activité</SelectItem>
                                                                    <SelectItem value="visit">Visite</SelectItem>
                                                                    <SelectItem value="meal">Repas</SelectItem>
                                                                    <SelectItem value="transport">Transport</SelectItem>
                                                                    <SelectItem value="accommodation">Hébergement</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}/>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <FormField control={eventForm.control} name="startTime" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Heure de début</FormLabel>
                                                                <FormControl><Input placeholder="HH:mm" {...field} /></FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}/>
                                                        <FormField control={eventForm.control} name="durationMinutes" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Durée (min)</FormLabel>
                                                                <FormControl><Input type="number" placeholder="Ex: 60" {...field} /></FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}/>
                                                    </div>
                                                    <FormField control={eventForm.control} name="locationName" render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Lieu (optionnel)</FormLabel>
                                                            <FormControl><Input placeholder="Nom ou addresse du lieu" {...field} /></FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}/>
                                                    <DialogFooter>
                                                        <Button type="submit" disabled={eventForm.formState.isSubmitting}>Ajouter l'événement</Button>
                                                    </DialogFooter>
                                                </form>
                                            </Form>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            )}
                        </div>
                    </div>
                  </div>
                  <div className="bg-bg-dark h-full min-h-[300px] lg:min-h-0">
                    <MapView events={dayEvents} day={selectedDay} />
                  </div>
                </div>
              </>
            ) : (
                <div className="flex-grow flex items-center justify-center">
                     <Card className="col-span-full flex flex-col items-center justify-center p-12 border-dashed border-slate-700 bg-slate-800/20">
                        <h2 className="text-xl font-semibold mb-2">Prêt à planifier ?</h2>
                        <p className="text-slate-400 mb-6">Choisissez une option pour commencer à remplir votre itinéraire.</p>
                        <div className="flex gap-4">
                            <Button onClick={() => handleGenerateItinerary()} disabled={isGenerating !== false}>
                                {isGenerating === 'full' ? (
                                    <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Génération...
                                    </>
                                ) : (
                                    <>
                                    <Bot className="mr-2 h-4 w-4" />
                                    Générer avec l'IA
                                    </>
                                )}
                            </Button>
                             <Button variant="outline" onClick={handleCreateDaysManually}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Commencer manuellement
                            </Button>
                        </div>
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
