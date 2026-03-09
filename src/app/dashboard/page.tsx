
'use client';

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUser, useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

function isValidDate(d: any) {
  return d instanceof Date && !isNaN(d.getTime());
}

function TripCard({ trip }: { trip: any }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const startDate = trip.startDate?.toDate ? trip.startDate.toDate() : new Date(trip.startDate);
  const endDate = trip.endDate?.toDate ? trip.endDate.toDate() : new Date(trip.endDate);
  
  const imageUrl = trip.imageUrl || `https://picsum.photos/seed/${trip.id}/800/400`;
  const imageHint = trip.imageUrl ? trip.title : 'travel landscape';

  const handleDelete = () => {
      if (!user || !firestore) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Vous devez être connecté pour supprimer un voyage.",
        });
        return;
      };
      const tripRef = doc(firestore, 'users', user.uid, 'trips', trip.id);
      deleteDocumentNonBlocking(tripRef);
      toast({
          title: "Voyage supprimé",
          description: `Le voyage "${trip.title}" a été supprimé.`,
      });
  }
  
  return (
      <Card className="overflow-hidden h-full flex flex-col group border-slate-700/80 bg-slate-900 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
          <Link href={`/trips/${trip.id}`} className="flex-grow flex flex-col">
              <CardHeader className="p-0 relative h-48">
                  <Image
                      src={imageUrl}
                      alt={trip.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      data-ai-hint={imageHint}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <CardTitle className="absolute bottom-4 left-4 text-2xl font-headline text-white">
                      {trip.title}
                  </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow p-4">
                  <p className="text-sm text-slate-400">{Array.isArray(trip.destinations) ? trip.destinations.join(" · ") : ''}</p>
              </CardContent>
          </Link>
          <CardFooter className="p-4 bg-slate-800/30 flex items-center justify-between">
              <div className="text-sm text-slate-300">
                  {isValidDate(startDate) && isValidDate(endDate) ? 
                  `${format(startDate, 'd MMM', { locale: fr })} - ${format(endDate, 'd MMM yyyy', { locale: fr })}`
                  : 'Dates non définies'}
              </div>
              
              <AlertDialog>
                  <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                      </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                      <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer le voyage ?</AlertDialogTitle>
                          <AlertDialogDescription>
                              Êtes-vous sûr de vouloir supprimer le voyage "{trip.title}" ? Cette action est irréversible.
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Supprimer
                          </AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
              </AlertDialog>
          </CardFooter>
      </Card>
  );
}

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  useEffect(() => {
    // If auth is done loading and there's no user, redirect to login.
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const tripsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'trips');
  }, [firestore, user]);

  const { data: trips, isLoading: isTripsLoading } = useCollection(tripsQuery);

  const isLoading = isUserLoading || isTripsLoading;

  return (
    <div className="flex flex-col min-h-screen bg-bg-dark">
      <AppHeader />
      <main className="flex-1 container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold font-headline">Mes Voyages</h1>
          <Button asChild>
            <Link href="/new-trip">
              <PlusCircle className="mr-2 h-4 w-4" />
              Créer un voyage
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 w-full rounded-lg" />)}
          
          {!isLoading && trips && trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}

          {!isLoading && (!trips || trips.length === 0) && (
            <Card className="col-span-full flex flex-col items-center justify-center p-12 border-dashed border-slate-700 bg-slate-800/20">
              <h2 className="text-xl font-semibold mb-2">Commencez votre première aventure !</h2>
              <p className="text-slate-400 mb-6">Vous n'avez pas encore de voyage. Créez-en un pour commencer à planifier.</p>
              <Button asChild>
                <Link href="/new-trip">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Créer un nouveau voyage
                </Link>
              </Button>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
