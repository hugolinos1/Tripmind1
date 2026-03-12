
'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { updateDoc } from 'firebase/firestore';

import { AppHeader } from '@/components/app/app-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Bot, Calendar, Info, MapPin, RefreshCw, Share2, PlusCircle, Edit, Loader2, Copy } from 'lucide-react';
import Link from 'next/link';
import EventCard from '@/components/app/event-card';
import type { Event as EventType, Attachment } from '@/components/app/event-card';
import { TransportSuggestionCard } from '@/components/app/transport-suggestion-card';
import TripInfo from '@/components/app/trip-info';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generateTripItinerary } from '@/ai/flows/ai-generate-trip-itinerary';
import type { GenerateItineraryInput, CompleteDayItineraryInput, TransportSuggestionOutput } from '@/ai/types';
import { completeDayItinerary } from '@/ai/flows/ai-complete-day-itinerary';
import { enrichEventDetails } from '@/ai/flows/ai-enrich-event-details';
import { geocodeLocation } from '@/ai/flows/ai-geocode-location';
import { getTransportSuggestions } from '@/ai/flows/ai-get-transport-suggestions';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, serverTimestamp, writeBatch, deleteDoc, getDocs } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { v4 as uuidv4 } from 'uuid';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel';
import { cn } from '@/lib/utils';
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

const eventFormSchema = z.object({
    title: z.string().min(3, { message: 'Le titre doit contenir au moins 3 caractères.' }),
    notes: z.string().optional(),
    type: z.enum(['activity', 'visit', 'meal', 'transport', 'accommodation'], { required_error: 'Veuillez sélectionner un type.'}),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Format HH:mm invalide.' }).optional().or(z.literal('')),
    durationMinutes: z.coerce.number().int().positive().optional(),
    locationName: z.string().optional(),
  });
  
type EventFormValues = z.infer<typeof eventFormSchema>;
  
type Suggestion = TransportSuggestionOutput['suggestions'][0];

export default function TripEditorPage({ params }: { params: { id: string } }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const tripId = params.id as string;
  const isMobile = useIsMobile();

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState<'full' | 'day' | 'completing' | false>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<EventType | null>(null); // null for 'add', event for 'edit'
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [isGeocoding, setIsGeocoding] = useState<null | 'start' | 'end' | string>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareableLink, setShareableLink] = useState('');

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

  const selectedDayId = useMemo(() => days?.[selectedDayIndex]?.id, [days, selectedDayIndex]);
  
  const selectedDay = useMemo(() => {
      if (!days || !selectedDayId) return undefined;
      return days.find(d => d.id === selectedDayId);
  }, [days, selectedDayId]);

  const eventsQuery = useMemoFirebase(() => {
    if (!user || !firestore || !selectedDayId) return null;
    return query(collection(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDayId, 'events'), orderBy('orderIndex'));
  }, [firestore, user, tripId, selectedDayId]);
  const { data: events, isLoading: isEventsLoading } = useCollection<EventType>(eventsQuery);

  const eventsRef = useRef(events);
  useEffect(() => {
      eventsRef.current = events;
  }, [events]);
  
  const eventForm = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: '',
      type: 'activity',
      startTime: '',
      durationMinutes: undefined,
      locationName: '',
      notes: '',
    },
  });

  const handleOpenEventForm = useCallback((event: EventType | null) => {
    setCurrentEvent(event);
    setIsEventFormOpen(true);
    setTimeout(() => {
        if (event) {
            eventForm.reset({
                title: event.title || '',
                notes: event.notes || '',
                type: event.type || 'activity',
                startTime: event.startTime || '',
                durationMinutes: event.durationMinutes || undefined,
                locationName: event.locationName || '',
            });
        } else {
            eventForm.reset({
                title: '',
                notes: '',
                type: 'activity',
                startTime: '',
                durationMinutes: undefined,
                locationName: '',
            });
        }
    }, 0);
  }, [eventForm]);

  const handleEventFormSubmit = useCallback(async (values: EventFormValues) => {
    if (!user || !firestore || !selectedDayId) {
        toast({ variant: 'destructive', title: 'Erreur', description: "Impossible de sauvegarder l'événement." });
        return;
    }
    
    setIsEventFormOpen(false);

    const eventPromise = new Promise(async (resolve, reject) => {
        try {
            if (currentEvent) {
                // Edit existing event
                const eventRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDayId, 'events', currentEvent.id);
                const dataToUpdate = {
                    title: values.title,
                    type: values.type,
                    startTime: values.startTime || null,
                    durationMinutes: values.durationMinutes || null,
                    locationName: values.locationName || '',
                    notes: values.notes || '',
                    updatedAt: serverTimestamp(),
                };
                await updateDoc(eventRef, dataToUpdate);
            } else {
                // Add new event
                const orderIndex = eventsRef.current?.length || 0;
                const eventId = uuidv4();
                const eventRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDayId, 'events', eventId);
                
                const eventData = {
                    id: eventId,
                    dayId: selectedDayId,
                    type: values.type,
                    title: values.title,
                    description: '',
                    notes: values.notes || '',
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
                    transportSuggestions: null,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };
                await setDocumentNonBlocking(eventRef, eventData, { merge: false });
            }
            resolve(true);
        } catch (error) {
            reject(error);
        }
    });

    toast({
        title: currentEvent ? "Mise à jour en cours..." : "Ajout en cours...",
        description: `L'événement "${values.title}" est en cours de sauvegarde.`,
    });

    try {
        await eventPromise;
        toast({
            title: currentEvent ? "Événement mis à jour !" : "Événement ajouté !",
            description: `L'événement "${values.title}" a été sauvegardé.`,
        });
    } catch(error) {
        console.error("Failed to save event:", error);
        toast({
            variant: "destructive",
            title: "Oh non ! Une erreur est survenue.",
            description: "Impossible d'enregistrer l'événement. Veuillez réessayer.",
        });
    }

    setCurrentEvent(null);
    eventForm.reset();
  }, [currentEvent, firestore, user, tripId, selectedDayId, toast, eventForm]);

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

  const handleLocationUpdate = useCallback((field: 'start' | 'end', value: string) => {
    if (!user || !firestore || !selectedDayId) return;
    
    const dayRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDayId);

    const updateData: { [key: string]: any } = {};
    if (field === 'start') {
        updateData.startLocationName = value;
        updateData.startLat = null;
        updateData.startLng = null;
    } else { // field === 'end'
        updateData.endLocationName = value;
        updateData.endLat = null;
        updateData.endLng = null;
    }

    updateDocumentNonBlocking(dayRef, updateData);

    // If updating the end location, also update the start location of the next day
    const nextDay = days?.[selectedDayIndex + 1];
    if (field === 'end' && nextDay) {
        const nextDayRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', nextDay.id);
        updateDocumentNonBlocking(nextDayRef, { startLocationName: value, startLat: null, startLng: null });
    }
  }, [user, firestore, tripId, selectedDayId, days, selectedDayIndex]);

  const handleGeocodeDayLocation = useCallback(async (field: 'start' | 'end') => {
    if (!user || !firestore || !selectedDayId) return;

    const locationName = field === 'start' ? startLocation : endLocation;
    if (!locationName) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Le nom du lieu est vide.' });
        return;
    }

    setIsGeocoding(field);
    try {
        const { lat, lng } = await geocodeLocation({ location: locationName });
        
        const dayRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDayId);
        const updateData = field === 'start' 
            ? { startLat: lat, startLng: lng }
            : { endLat: lat, endLng: lng };

        await updateDoc(dayRef, updateData);

        toast({ title: 'Géolocalisation réussie', description: `${locationName} a été localisé.` });

    } catch (error: any) {
        console.error("Geocoding failed:", error);
        toast({ variant: 'destructive', title: 'Échec de la géolocalisation', description: error.message });
    } finally {
        setIsGeocoding(null);
    }
  }, [user, firestore, selectedDayId, tripId, toast, startLocation, endLocation]);

  const handleGeocodeEvent = useCallback(async (eventId: string) => {
    const currentEvents = eventsRef.current;
    if (!user || !firestore || !selectedDayId || !currentEvents) return;

    const eventToGeocode = currentEvents.find(e => e.id === eventId);
    if (!eventToGeocode || !eventToGeocode.locationName) {
        toast({ variant: 'destructive', title: 'Erreur', description: "Le nom du lieu de l'événement est vide." });
        return;
    }

    setIsGeocoding(eventId);
    try {
        const { lat, lng } = await geocodeLocation({ location: eventToGeocode.locationName });

        const eventRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDayId, 'events', eventId);
        await updateDoc(eventRef, { lat, lng, updatedAt: serverTimestamp() });

        toast({ title: 'Géolocalisation réussie', description: `${eventToGeocode.locationName} a été localisé.` });

    } catch (error: any) {
        console.error("Geocoding failed:", error);
        toast({ variant: 'destructive', title: 'Échec de la géolocalisation', description: error.message });
    } finally {
        setIsGeocoding(null);
    }
  }, [user, firestore, selectedDayId, tripId, toast]);

  const handleCreateDaysManually = async () => {
    if (!tripData || !user || !firestore) {
        toast({ variant: "destructive", title: "Erreur", description: "Données du voyage non chargées." });
        return;
    }
        const tripStartDate = (tripData.startDate as any)?.toDate ? (tripData.startDate as any).toDate() : null;
        const tripEndDate = (tripData.endDate as any)?.toDate ? (tripData.endDate as any).toDate() : null;

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
                startLocationName: i > 0 ? "" : tripData.destinations[0] || "", // Only set for first day, others inherit
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

    const tripStartDate = (tripData.startDate as any)?.toDate ? (tripData.startDate as any).toDate() : null;
    const tripEndDate = (tripData.endDate as any)?.toDate ? (tripData.endDate as any).toDate() : null;

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

  const handleCompleteDayWithAI = useCallback(async () => {
    const currentEvents = eventsRef.current;
    if (!tripData || !selectedDayId || !currentEvents || !user || !firestore || !days) {
        toast({
            variant: "destructive",
            title: "Erreur",
            description: "Données requises manquantes pour compléter la journée.",
        });
        return;
    }
    const day = days.find(d => d.id === selectedDayId);
    if (!day) return;

    setIsGenerating('completing');
    setGenerationError(null);

    const dayDate = (day.date as any)?.toDate ? (day.date as any).toDate() : new Date(day.date.seconds * 1000);

    try {
        const preferences = JSON.parse(tripData.preferences || '{}');
        const existingEventsForAI = currentEvents.map(e => ({
            id: e.id,
            title: e.title,
            type: e.type,
            startTime: e.startTime,
            locationName: e.locationName,
        }));

        const input: CompleteDayItineraryInput = {
            date: format(dayDate, 'yyyy-MM-dd'),
            location: tripData.destinations[0] || '', // Use first destination as primary location
            startLocationName: day.startLocationName,
            endLocationName: day.endLocationName,
            existingEvents: existingEventsForAI,
            preferences: preferences,
        };

        const result = await completeDayItinerary(input);
        const { events: aiGeneratedPlan } = result;

        const batch = writeBatch(firestore);
        const eventsCollectionRef = collection(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDayId, 'events');

        for (const [index, eventFromAI] of aiGeneratedPlan.entries()) {
            if (eventFromAI.id) {
                // This is an existing event. Find its ref and update its orderIndex.
                const eventRef = doc(eventsCollectionRef, eventFromAI.id);
                batch.update(eventRef, { orderIndex: index, updatedAt: serverTimestamp() });
            } else {
                // This is a new event. Create it with the correct orderIndex.
                const newEventId = uuidv4();
                const newEventRef = doc(eventsCollectionRef, newEventId);
                const newEventData = {
                    dayId: selectedDayId,
                    type: eventFromAI.type,
                    title: eventFromAI.title,
                    description: eventFromAI.description || '',
                    startTime: eventFromAI.startTime || null,
                    durationMinutes: eventFromAI.durationMinutes || null,
                    locationName: eventFromAI.locationName || '',
                    lat: eventFromAI.lat || null,
                    lng: eventFromAI.lng || null,
                    orderIndex: index,
                    isAiEnriched: false,
                    photos: [],
                    practicalInfo: JSON.stringify({}),
                    attachments: [],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };
                batch.set(newEventRef, newEventData);
            }
        }

        await batch.commit();

        toast({
            title: "Journée complétée !",
            description: "L'itinéraire a été mis à jour avec de nouvelles suggestions."
        });

    } catch (error) {
        console.error("Failed to complete day with AI:", error);
        const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
        setGenerationError(`La complétion a échoué : ${errorMessage}`);
        toast({ variant: "destructive", title: "Échec de la complétion", description: errorMessage });
    } finally {
        setIsGenerating(false);
    }
  }, [tripData, selectedDayId, user, firestore, toast, tripId, days]);

  const handleEnrichEvent = useCallback(async (eventId: string) => {
    const currentEvents = eventsRef.current;
    if (!selectedDayId || !currentEvents) {
        toast({ variant: "destructive", title: "Erreur", description: "Aucun jour ou événement sélectionné." });
        return;
    }
    const eventToEnrich = currentEvents.find(e => e.id === eventId);

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

        const eventRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDayId, 'events', eventId);
        
        await updateDoc(eventRef, {
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
  }, [user, firestore, tripId, selectedDayId, toast]);
  
  const handleGenerateTransportSuggestions = useCallback(async (startEvent: EventType, endEvent: EventType): Promise<Suggestion[] | undefined> => {
    if (!user || !firestore || !selectedDayId) {
        throw new Error("Impossible de sauvegarder les suggestions de trajet.");
    }
    
    const result = await getTransportSuggestions({ startEvent, endEvent });

    if (startEvent.id) {
        // It's a regular event-to-event suggestion
        const eventRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDayId, 'events', startEvent.id);
        
        await updateDoc(eventRef, {
            transportSuggestions: JSON.stringify(result.suggestions),
            updatedAt: serverTimestamp()
        });
    } else {
        // It's the day-start-to-first-event suggestion
        const dayRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDayId);
        await updateDoc(dayRef, {
            transportSuggestions: JSON.stringify(result.suggestions),
            updatedAt: serverTimestamp()
        });
    }

    return result.suggestions;
  }, [user, firestore, selectedDayId, tripId]);

  const handleAddAttachment = useCallback(async (eventId: string, newAttachment: Attachment) => {
    const currentEvents = eventsRef.current;
    if (!selectedDayId || !currentEvents || !user || !firestore) return;

    const eventToUpdate = currentEvents.find(e => e.id === eventId);
    if (!eventToUpdate) return;
    
    const updatedAttachments = [...(eventToUpdate.attachments || []), newAttachment];
    const eventRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDayId, 'events', eventId);

    await updateDoc(eventRef, { attachments: updatedAttachments, updatedAt: serverTimestamp() });

    toast({
      title: "Pièce jointe ajoutée",
      description: `Le fichier "${newAttachment.filename}" a été ajouté.`,
    });
  }, [user, firestore, selectedDayId, tripId, toast]);

  const handleMoveEvent = useCallback(async (eventId: string, direction: 'up' | 'down') => {
    const currentEvents = eventsRef.current;
    if (!user || !firestore || !selectedDayId || !currentEvents || currentEvents.length < 2) return;

    const eventIndex = currentEvents.findIndex(e => e.id === eventId);
    if (eventIndex === -1) return;

    const otherEventIndex = direction === 'up' ? eventIndex - 1 : eventIndex + 1;
    if (otherEventIndex < 0 || otherEventIndex >= currentEvents.length) return;

    const eventToMove = currentEvents[eventIndex];
    const otherEvent = currentEvents[otherEventIndex];

    const batch = writeBatch(firestore);

    const eventToMoveRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDayId, 'events', eventToMove.id);
    batch.update(eventToMoveRef, { orderIndex: otherEvent.orderIndex, updatedAt: serverTimestamp() });

    const otherEventRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDayId, 'events', otherEvent.id);
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
  }, [user, firestore, selectedDayId, tripId, toast]);

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    const currentEvents = eventsRef.current;
    if (!user || !firestore || !selectedDayId || !currentEvents) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer l'événement.",
      });
      return;
    }
    
    const eventToDelete = currentEvents.find(e => e.id === eventId);
    if (!eventToDelete) {
        toast({ variant: "destructive", title: "Erreur", description: "Événement non trouvé." });
        return;
    }
    
    const batch = writeBatch(firestore);
    
    const eventRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDayId, 'events', eventId);
    
    // Use the non-blocking delete function which will handle its own errors
    deleteDoc(eventRef).catch(err => console.error("Non-blocking delete failed", err));

    // Re-order subsequent events
    const eventsToUpdate = currentEvents
        .filter(e => e.orderIndex > eventToDelete.orderIndex)
        .sort((a,b) => a.orderIndex - b.orderIndex);

    eventsToUpdate.forEach(event => {
        const subsequentEventRef = doc(firestore, 'users', user.uid, 'trips', tripId, 'days', selectedDayId, 'events', event.id);
        batch.update(subsequentEventRef, { orderIndex: event.orderIndex - 1, updatedAt: serverTimestamp() });
    });

    try {
        await batch.commit();
        toast({
            title: "Événement supprimé",
            description: "L'itinéraire a été mis à jour.",
        });
    } catch(error) {
        console.error("Error reordering after delete:", error);
        toast({
            variant: "destructive",
            title: "Erreur de mise à jour",
            description: "Impossible de réorganiser l'itinéraire. Veuillez rafraîchir.",
        });
    }
  }, [user, firestore, selectedDayId, tripId, toast]);

  const handleShare = async () => {
    if (!user || !firestore || !tripData || !days) {
      toast({ variant: "destructive", title: "Erreur", description: "Les données du voyage ne sont pas entièrement chargées." });
      return;
    }

    setIsSharing(true);
    toast({ title: 'Création du lien de partage...' });

    try {
      const batch = writeBatch(firestore);
      let token = tripData.shareToken || uuidv4();

      // Update original trip with shareToken if it's new
      if (!tripData.shareToken) {
        const originalTripRef = doc(firestore, 'users', user.uid, 'trips', tripId);
        batch.update(originalTripRef, { shareToken: token });
      }

      // Create public copy of trip data
      const publicTripRef = doc(firestore, 'publicTrips', tripId);
      const publicTripData = { ...tripData, userId: user.uid };
      batch.set(publicTripRef, publicTripData);

      // Create public copies of all days and their events
      for (const day of days) {
        const publicDayRef = doc(publicTripRef, 'days', day.id);
        const publicDayData = { ...day, userId: user.uid };
        batch.set(publicDayRef, publicDayData);

        const eventsCollectionRef = collection(firestore, 'users', user.uid, 'trips', tripId, 'days', day.id, 'events');
        const eventsSnapshot = await getDocs(eventsCollectionRef);
        
        eventsSnapshot.docs.forEach(eventDoc => {
            const publicEventRef = doc(publicDayRef, 'events', eventDoc.id);
            const { notes, ...eventDataWithoutNotes } = eventDoc.data(); // Exclude private notes
            const publicEventData = { ...eventDataWithoutNotes, userId: user.uid };
            batch.set(publicEventRef, publicEventData);
        });
      }

      await batch.commit();

      const generatedLink = `${window.location.origin}/share/${tripId}`;
      setShareableLink(generatedLink);
      setShareDialogOpen(true);

    } catch (error) {
      console.error("Sharing failed:", error);
      toast({ variant: 'destructive', title: 'Erreur de partage', description: "Impossible de créer le lien." });
    } finally {
      setIsSharing(false);
    }
  };

  const startOfDayEvent = useMemo(() => ({
      title: 'Lieu de départ',
      locationName: startLocation,
      lat: selectedDay?.startLat,
      lng: selectedDay?.startLng,
  }), [startLocation, selectedDay?.startLat, selectedDay?.startLng]);

  const endOfDayEvent = useMemo(() => ({
      id: 'end-of-day',
      title: "Lieu de retour",
      locationName: endLocation,
      lat: selectedDay?.endLat,
      lng: selectedDay?.endLng,
      type: 'activity' as const,
      isAiEnriched: false,
      orderIndex: -1,
  }), [endLocation, selectedDay?.endLat, selectedDay?.endLng]);


  const isLoading = isTripLoading || isDaysLoading;

  if (isLoading) {
    return (
        <div className="flex flex-col min-h-screen bg-bg-dark">
            <AppHeader />
             <header className="container mx-auto px-6 py-4 flex items-center justify-between border-b border-slate-800">
                <Skeleton className="h-12 w-1/3" />
                <Skeleton className="h-10 w-64" />
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
             <div className="flex items-center flex-wrap justify-end gap-2">
                <Button variant="outline" asChild>
                  <Link href={`/trips/${tripId}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Modifier
                  </Link>
                </Button>
                <Button variant="outline" onClick={handleShare} disabled={isSharing}>
                  {isSharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
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

          <TabsContent value="itinerary" className="flex-grow flex flex-col">
            <div className="lg:grid lg:grid-cols-2 lg:grid-rows-1 flex-grow">
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
                              <Button onClick={handleCompleteDayWithAI} disabled={isGenerating !== false} size="sm">
                                  {isGenerating === 'completing' ? (
                                  <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      En cours...
                                  </>
                                  ) : (
                                  <>
                                      <Bot className="mr-2 h-4 w-4" />
                                      Compléter la journée
                                  </>
                                  )}
                              </Button>
                          </div>
                          
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
                                      <Label htmlFor="end-location" className="text-xs font-semibold text-slate-400">Lieu de retour</Label>
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
                                              aria-label="Géolocaliser le lieu de retour"
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
                                  <>
                                      {(startLocation || selectedDay?.startLat) && (
                                          <TransportSuggestionCard 
                                              startEvent={startOfDayEvent as any}
                                              endEvent={dayEvents[0] as any}
                                              savedSuggestionsJSON={selectedDay?.transportSuggestions}
                                              onGenerate={handleGenerateTransportSuggestions as any}
                                          />
                                      )}
                                      {dayEvents.map((event, index) => (
                                      <React.Fragment key={event.id}>
                                          <EventCard 
                                          event={event} 
                                          onEnrich={handleEnrichEvent} 
                                          onAddAttachment={handleAddAttachment}
                                          onMove={handleMoveEvent}
                                          onGeocode={handleGeocodeEvent}
                                          onDelete={handleDeleteEvent}
                                          onEdit={handleOpenEventForm}
                                          isFirst={index === 0}
                                          isLast={index === dayEvents.length - 1}
                                          isGeocoding={isGeocoding === event.id}
                                          />
                                          {index < dayEvents.length - 1 ? (
                                              <TransportSuggestionCard 
                                                  startEvent={event as any}
                                                  endEvent={dayEvents[index + 1] as any}
                                                  savedSuggestionsJSON={event.transportSuggestions}
                                                  onGenerate={handleGenerateTransportSuggestions as any}
                                              />
                                          ) : (
                                              (endLocation || selectedDay?.endLat) && (
                                                  <TransportSuggestionCard 
                                                      startEvent={event as any}
                                                      endEvent={endOfDayEvent as any}
                                                      savedSuggestionsJSON={event.transportSuggestions}
                                                      onGenerate={handleGenerateTransportSuggestions as any}
                                                  />
                                              )
                                          )}
                                      </React.Fragment>
                                      ))}
                                  </>
                              ) : (
                                  <Card className="text-center p-8 border-dashed border-slate-700 bg-slate-800/20">
                                      <p className="text-slate-400">Aucun événement pour ce jour.</p>
                                  </Card>
                              )}
                               {!isEventsLoading && (
                                  <div className="pt-4">
                                    <Button variant="outline" className="w-full" onClick={() => handleOpenEventForm(null)}>
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Ajouter un événement
                                    </Button>
                                  </div>
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
            </div>
          </TabsContent>

          <TabsContent value="info" className="flex-grow overflow-y-auto bg-slate-900/50">
            <TripInfo tripId={tripId} destinations={Array.isArray(tripData?.destinations) ? tripData.destinations : []} />
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={isEventFormOpen} onOpenChange={setIsEventFormOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>{currentEvent ? "Modifier l'événement" : 'Ajouter un nouvel événement'}</DialogTitle>
                  <DialogDescription>
                      {currentEvent ? "Mettez à jour les détails de votre événement." : `Remplissez les détails de votre nouvel événement pour le ${dayDate ? `Jour ${selectedDayIndex+1}`: ''}.`}
                  </DialogDescription>
              </DialogHeader>
              <Form {...eventForm}>
                  <form onSubmit={eventForm.handleSubmit(handleEventFormSubmit)} className="space-y-4">
                      <FormField control={eventForm.control} name="title" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Titre</FormLabel>
                              <FormControl><Input placeholder="Ex: Dîner au restaurant" {...field} /></FormControl>
                              <FormMessage />
                          </FormItem>
                      )}/>
                      <FormField control={eventForm.control} name="notes" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Commentaires</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Ajoutez vos notes personnelles ici..." {...field} className="resize-y" />
                              </FormControl>
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
                          <Button type="button" variant="ghost" onClick={() => setIsEventFormOpen(false)}>Annuler</Button>
                          <Button type="submit" disabled={eventForm.formState.isSubmitting}>
                            {currentEvent ? "Enregistrer les modifications" : "Ajouter l'événement"}
                          </Button>
                      </DialogFooter>
                  </form>
              </Form>
          </DialogContent>
      </Dialog>
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Partager votre voyage</DialogTitle>
                <DialogDescription>
                    Copiez le lien ci-dessous et partagez-le. Toute personne disposant du lien pourra consulter cet itinéraire.
                </DialogDescription>
            </DialogHeader>
            <div className="flex items-center space-x-2">
                <div className="grid flex-1 gap-2">
                    <Label htmlFor="link" className="sr-only">
                        Lien
                    </Label>
                    <Input id="link" defaultValue={shareableLink} readOnly />
                </div>
                <Button type="submit" size="sm" className="px-3" onClick={() => {
                    navigator.clipboard.writeText(shareableLink);
                    toast({ title: 'Copié !', description: 'Le lien de partage a été copié.' });
                }}>
                    <span className="sr-only">Copier</span>
                    <Copy className="h-4 w-4" />
                </Button>
            </div>
            <DialogFooter className="sm:justify-start">
                <Button type="button" variant="secondary" onClick={() => setShareDialogOpen(false)}>
                    Fermer
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
