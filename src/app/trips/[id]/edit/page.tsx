
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser, useDoc, updateDocumentNonBlocking, useMemoFirebase } from '@/firebase';

import { AppHeader } from '@/components/app/app-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, ArrowLeft, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ImagePicker } from '@/components/app/image-picker';

const formSchema = z.object({
  title: z.string().min(3, { message: 'Le titre doit contenir au moins 3 caractères.' }),
  destinations: z.string().min(3, { message: 'Veuillez entrer au moins une destination.' }),
  imageUrl: z.string().optional(),
  dateRange: z.object({
    from: z.date({ required_error: "Date de début requise." }),
    to: z.date().optional(),
  }).refine(data => data.from && data.to ? data.to >= data.from : true, {
    message: "La date de fin doit être après la date de début.",
    path: ["to"],
  }),
  adults: z.coerce.number().min(1, { message: "Il doit y avoir au moins un adulte." }),
  childrenAges: z.string().optional(),
  hasPets: z.boolean().default(false),
  pace: z.number().min(0).max(100),
  budget: z.number().min(0).max(100),
  interests: z.array(z.string()).default([]),
  mustSee: z.string().optional(),
  placesToAvoid: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const availableInterests = ['Culture', 'Gastronomie', 'Nature', 'Histoire', 'Art', 'Sport', 'Shopping', 'Détente', 'Aventure', 'Plage'];

export default function EditTripPage() {
  const router = useRouter();
  const params = useParams();
  const { id: tripId } = params;
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tripRef = useMemoFirebase(() => {
    if (!user || !firestore || !tripId) return null;
    return doc(firestore, 'users', user.uid, 'trips', tripId as string);
  }, [firestore, user, tripId]);

  const { data: tripData, isLoading: isTripLoading } = useDoc(tripRef);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      destinations: '',
      imageUrl: '',
      adults: 1,
      childrenAges: '',
      hasPets: false,
      pace: 50,
      budget: 50,
      interests: [],
      mustSee: '',
      placesToAvoid: '',
    },
  });

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (tripData) {
      try {
        const travelers = JSON.parse(tripData.travelers || '{}');
        const preferences = JSON.parse(tripData.preferences || '{}');
        
        form.reset({
            title: tripData.title,
            destinations: Array.isArray(tripData.destinations) ? tripData.destinations.join(', ') : '',
            imageUrl: tripData.imageUrl || '',
            dateRange: {
                from: tripData.startDate?.toDate(),
                to: tripData.endDate?.toDate(),
            },
            adults: travelers.adults || 1,
            childrenAges: (travelers.children || []).join(', '),
            hasPets: travelers.hasPets || false,
            pace: preferences.pace || 50,
            budget: preferences.budget || 50,
            interests: preferences.interests || [],
            mustSee: (preferences.mustSee || []).join(', '),
            placesToAvoid: (preferences.placesToAvoid || []).join(', '),
        });
      } catch(e) {
        console.error("Failed to parse trip data:", e);
        toast({
          variant: "destructive",
          title: "Erreur de chargement",
          description: "Impossible de charger les détails du voyage.",
        });
      }
    }
  }, [tripData, form, toast]);

  const onSubmit = async (values: FormValues) => {
    if (!user || !firestore || !tripId) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Connexion requise pour modifier un voyage.",
      });
      return;
    }
    
    setIsSubmitting(true);

    try {
      const tripDataToUpdate = {
        title: values.title,
        destinations: values.destinations.split(',').map(d => d.trim()),
        imageUrl: values.imageUrl,
        startDate: values.dateRange.from,
        endDate: values.dateRange.to || values.dateRange.from,
        travelers: JSON.stringify({ 
            adults: values.adults, 
            children: values.childrenAges?.split(',').map(a => a.trim()).filter(a => a) || [], 
            hasPets: values.hasPets 
        }),
        preferences: JSON.stringify({ 
            pace: values.pace, 
            budget: values.budget, 
            interests: values.interests || [],
            mustSee: values.mustSee?.split(',').map(i => i.trim()).filter(i => i) || [],
            placesToAvoid: values.placesToAvoid?.split(',').map(i => i.trim()).filter(i => i) || [],
        }),
        updatedAt: serverTimestamp(),
      };
      
      const tripDocRef = doc(firestore, 'users', user.uid, 'trips', tripId as string);
      await updateDocumentNonBlocking(tripDocRef, tripDataToUpdate);

      toast({
        title: "Voyage mis à jour !",
        description: "Les modifications ont été enregistrées.",
      });

      router.push(`/trips/${tripId}`);

    } catch (error) {
      console.error("Error updating trip: ", error);
      toast({
        variant: "destructive",
        title: "Oh non ! Une erreur est survenue.",
        description: "Impossible de mettre à jour le voyage. Veuillez réessayer.",
      });
      setIsSubmitting(false);
    }
  };

  if (isUserLoading || isTripLoading) {
      return (
          <div className="flex flex-col min-h-screen bg-bg-dark">
              <AppHeader />
              <main className="flex-1 container mx-auto px-6 py-8 flex items-center justify-center">
                  <Card className="w-full max-w-2xl bg-slate-800/50 border-slate-700/50">
                      <CardHeader>
                          <Skeleton className="h-8 w-1/2" />
                          <Skeleton className="h-4 w-3/4" />
                      </CardHeader>
                      <CardContent className="space-y-6">
                          <Skeleton className="h-48 w-full" />
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-24 w-full" />
                          <Skeleton className="h-32 w-full" />
                          <div className="flex justify-end">
                            <Skeleton className="h-10 w-32" />
                          </div>
                      </CardContent>
                  </Card>
              </main>
          </div>
      )
  }

  return (
    <div className="flex flex-col min-h-screen bg-bg-dark">
      <AppHeader />
      <main className="flex-1 container mx-auto px-6 py-8 flex items-center justify-center">
        <Card className="w-full max-w-2xl bg-slate-800/50 border-slate-700/50">
            <CardHeader>
                <div className="flex items-center gap-4 mb-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                      <Link href={`/trips/${tripId}`}>
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Retour</span>
                      </Link>
                    </Button>
                    <CardTitle className="font-headline text-2xl">Modifier le voyage</CardTitle>
                </div>
                <CardDescription>Mettez à jour les détails de votre voyage.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="imageUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Image du voyage</FormLabel>
                                    <FormControl>
                                        <ImagePicker
                                            value={field.value}
                                            onChange={field.onChange}
                                            searchDefaultValue={form.watch('title')}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                              control={form.control}
                              name="title"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Titre du voyage</FormLabel>
                                      <FormControl>
                                          <Input placeholder="Ex: Aventure au Japon" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <FormField
                              control={form.control}
                              name="destinations"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Destinations</FormLabel>
                                      <FormControl>
                                          <Input placeholder="Paris, Lyon, Marseille" {...field} />
                                      </FormControl>
                                      <CardDescription className="text-xs pt-1">Séparez plusieurs destinations par une virgule.</CardDescription>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                        </div>
                         <FormField
                          control={form.control}
                          name="dateRange"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Dates du voyage</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant={"outline"}
                                      className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !field.value?.from && "text-muted-foreground"
                                      )}
                                    >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {field.value?.from ? (
                                        field.value.to ? (
                                          <>
                                            {format(field.value.from, "d MMM yyyy", { locale: fr })} -{" "}
                                            {format(field.value.to, "d MMM yyyy", { locale: fr })}
                                          </>
                                        ) : (
                                          format(field.value.from, "d MMM yyyy", { locale: fr })
                                        )
                                      ) : (
                                        <span>Choisissez vos dates</span>
                                      )}
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="range"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    numberOfMonths={2}
                                    locale={fr}
                                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Voyageurs */}
                        <div className="space-y-4 rounded-lg border border-slate-700 p-4">
                          <h3 className="text-lg font-medium">Voyageurs</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="adults"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Adultes</FormLabel>
                                  <FormControl>
                                    <Input type="number" min="1" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="childrenAges"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Âges des enfants</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Ex: 5, 8" {...field} />
                                  </FormControl>
                                  <CardDescription className="text-xs pt-1">Séparez les âges par une virgule.</CardDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name="hasPets"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-700/50 p-3 shadow-sm">
                                <div className="space-y-0.5">
                                  <FormLabel>Animaux de compagnie</FormLabel>
                                  <CardDescription className="text-xs">
                                    Voyagez-vous avec des animaux ?
                                  </CardDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Préférences */}
                        <div className="space-y-6 rounded-lg border border-slate-700 p-4">
                          <h3 className="text-lg font-medium">Préférences de voyage</h3>
                          <FormField
                            control={form.control}
                            name="pace"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Rythme du voyage</FormLabel>
                                <FormControl>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs text-muted-foreground">Détendu</span>
                                        <Slider
                                            value={[field.value]}
                                            onValueChange={(value) => field.onChange(value[0])}
                                            max={100}
                                            step={1}
                                        />
                                        <span className="text-xs text-muted-foreground">Intense</span>
                                    </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="budget"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Budget</FormLabel>
                                <FormControl>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs text-muted-foreground">Économique</span>
                                        <Slider
                                            value={[field.value]}
                                            onValueChange={(value) => field.onChange(value[0])}
                                            max={100}
                                            step={1}
                                        />
                                        <span className="text-xs text-muted-foreground">Luxe</span>
                                    </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="interests"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Centres d'intérêt</FormLabel>
                                <FormControl>
                                  <div className="flex flex-wrap gap-2">
                                    {availableInterests.map((interest) => (
                                      <Button
                                        key={interest}
                                        type="button"
                                        variant={field.value.includes(interest) ? "secondary" : "outline"}
                                        onClick={() => {
                                          const newValue = field.value.includes(interest)
                                            ? field.value.filter((i) => i !== interest)
                                            : [...field.value, interest];
                                          field.onChange(newValue);
                                        }}
                                        className="text-sm h-8"
                                      >
                                        {interest}
                                      </Button>
                                    ))}
                                  </div>
                                </FormControl>
                                <CardDescription className="text-xs pt-1">Sélectionnez un ou plusieurs thèmes.</CardDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                           <FormField
                              control={form.control}
                              name="mustSee"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Incontournables</FormLabel>
                                      <FormControl>
                                          <Input placeholder="Tour Eiffel, Musée du Louvre..." {...field} />
                                      </FormControl>
                                      <CardDescription className="text-xs pt-1">Lieux que vous voulez absolument visiter (séparés par une virgule).</CardDescription>
                                      <FormMessage />
                                  </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="placesToAvoid"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Lieux à éviter</FormLabel>
                                      <FormControl>
                                          <Input placeholder="Zones très touristiques..." {...field} />
                                      </FormControl>
                                      <CardDescription className="text-xs pt-1">Lieux ou types de lieux à exclure (séparés par une virgule).</CardDescription>
                                      <FormMessage />
                                  </FormItem>
                              )}
                            />
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Enregistrement...
                                    </>
                                ) : (
                                    "Enregistrer les modifications"
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
