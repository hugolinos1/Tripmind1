import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Mock data for trips
const mockTrips = [
  {
    id: "1",
    title: "Aventure au Japon",
    destinations: ["Tokyo", "Kyoto"],
    startDate: "2024-08-15",
    endDate: "2024-08-29",
    status: "active",
    image: PlaceHolderImages.find(p => p.id === 'trip-japan') || { imageUrl: 'https://picsum.photos/seed/1/800/400', imageHint: 'japan temple' },
  },
  {
    id: "2",
    title: "Escapade Italienne",
    destinations: ["Rome", "Florence", "Venise"],
    startDate: "2024-09-10",
    endDate: "2024-09-20",
    status: "draft",
    image: PlaceHolderImages.find(p => p.id === 'trip-italy') || { imageUrl: 'https://picsum.photos/seed/2/800/400', imageHint: 'italy coast' },
  },
  {
    id: "3",
    title: "Découverte de la Patagonie",
    destinations: ["El Calafate", "Ushuaia"],
    startDate: "2025-01-20",
    endDate: "2025-02-05",
    status: "active",
    image: PlaceHolderImages.find(p => p.id === 'trip-patagonia') || { imageUrl: 'https://picsum.photos/seed/3/800/400', imageHint: 'patagonia mountains' },
  },
];

export default function DashboardPage() {
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
          {mockTrips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      </main>
    </div>
  );
}

function TripCard({ trip }: { trip: (typeof mockTrips)[0] }) {
  const startDate = new Date(trip.startDate);
  const endDate = new Date(trip.endDate);
  
  return (
    <Link href={`/trips/${trip.id}`}>
      <Card className="overflow-hidden h-full flex flex-col group border-slate-700/80 bg-slate-900 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
        <CardHeader className="p-0 relative h-48">
          <Image
            src={trip.image.imageUrl}
            alt={trip.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            data-ai-hint={trip.image.imageHint}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <CardTitle className="absolute bottom-4 left-4 text-2xl font-headline text-white">
            {trip.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow p-4">
          <p className="text-sm text-slate-400">{trip.destinations.join(" · ")}</p>
        </CardContent>
        <CardFooter className="p-4 bg-slate-800/30">
          <div className="text-sm text-slate-300">
            {format(startDate, 'd MMM', { locale: fr })} - {format(endDate, 'd MMM yyyy', { locale: fr })}
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
