'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser, addDocumentNonBlocking } from '@/firebase';

import { AppHeader } from '@/components/app/app-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, ArrowLeft, Bot, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const formSchema = z.object({
  title: z.string().min(3, { message: 'Le titre doit contenir au moins 3 caractères.' }),
  destinations: z.string().min(3, { message: 'Veuillez entrer au moins une destination.' }),
  dateRange: z.object({
    from: z.date({ required_error: "Date de début requise." }),
    to: z.date().optional(),
  }).refine(data => data.from && data.to ? data.to >= data.from : true, {
    message: "La date de fin doit être après la date de début.",
    path: ["to"],
  }),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewTripPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      destinations: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!user || !firestore) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Vous devez être connecté pour créer un voyage.",
      });
      return;
    }
    
    setIsSubmitting(true);

    try {
      const tripData = {
        userId: user.uid,
        title: values.title,
        destinations: values.destinations.split(',').map(d => d.trim()),
        startDate: values.dateRange.from,
        endDate: values.dateRange.to || values.dateRange.from,
        travelers: JSON.stringify({ adults: 1, children: [], hasPets: false }),
        preferences: JSON.stringify({ pace: 50, budget: 50, interests: [] }),
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const tripsCollection = collection(firestore, 'users', user.uid, 'trips');
      const docRef = await addDocumentNonBlocking(tripsCollection, tripData);

      toast({
        title: "Voyage créé !",
        description: "Votre nouveau voyage a été ajouté à votre tableau de bord.",
      });

      router.push(`/trips/${docRef.id}`);

    } catch (error) {
      console.error("Error creating trip: ", error);
      toast({
        variant: "destructive",
        title: "Oh non ! Une erreur est survenue.",
        description: "Impossible de créer le voyage. Veuillez réessayer.",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-bg-dark">
      <AppHeader />
      <main className="flex-1 container mx-auto px-6 py-8 flex items-center justify-center">
        <Card className="w-full max-w-2xl bg-slate-800/50 border-slate-700/50">
            <CardHeader>
                <div className="flex items-center gap-4 mb-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                      <Link href="/dashboard">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Retour</span>
                      </Link>
                    </Button>
                    <CardTitle className="font-headline text-2xl">Créer un nouveau voyage</CardTitle>
                </div>
                <CardDescription>Remplissez les détails ci-dessous pour commencer à planifier votre prochaine aventure.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Création en cours...
                                    </>
                                ) : (
                                    "Créer et commencer à planifier"
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
