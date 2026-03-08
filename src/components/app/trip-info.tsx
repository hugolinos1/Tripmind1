import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { BookText, ChefHat, Handshake, Landmark, RefreshCw, Train, Umbrella, Siren, Wallet, Ban, Search, Sprout } from "lucide-react";
import { Skeleton } from "../ui/skeleton";

interface TripInfoProps {
  destinations: string[];
}

const sections = [
    { id: 'mustSee', label: 'Incontournables', icon: Landmark },
    { id: 'hiddenGems', label: 'Pépites cachées', icon: Sprout },
    { id: 'gastronomy', label: 'Gastronomie', icon: ChefHat },
    { id: 'transportation', label: 'Transports', icon: Train },
    { id: 'customs', label: 'Coutumes', icon: Handshake },
    { id: 'vocabulary', label: 'Vocabulaire', icon: BookText },
    { id: 'currency', label: 'Monnaie & Budget', icon: Wallet },
    { id: 'prices', label: 'Prix sur place', icon: Wallet },
    { id: 'weather', label: 'Météo', icon: Umbrella },
    { id: 'prohibitions', label: 'Interdictions', icon: Ban },
    { id: 'scams', label: 'Arnaques à éviter', icon: Search },
    { id: 'emergency', label: 'Urgences', icon: Siren },
]

const TripInfo = ({ destinations }: TripInfoProps) => {
  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold font-headline">À savoir sur {destinations.join(" & ")}</h2>
        <p className="text-slate-400">Informations pratiques générées par IA pour préparer votre voyage.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map(section => (
            <InfoCard 
                key={section.id} 
                title={section.label}
                icon={<section.icon className="h-6 w-6" />}
            />
        ))}
      </div>
    </div>
  );
};

interface InfoCardProps {
    title: string;
    icon: React.ReactNode;
}

const InfoCard = ({ title, icon }: InfoCardProps) => {
    return (
        <Card className="border-slate-800 bg-slate-800/30 flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                    <div className="text-primary">{icon}</div>
                    <CardTitle className="text-lg font-headline">{title}</CardTitle>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary">
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="flex-grow">
                {/* Example of loading state */}
                <div className="space-y-2 mt-2">
                    <Skeleton className="h-4 w-4/5 bg-slate-700" />
                    <Skeleton className="h-4 w-full bg-slate-700" />
                    <Skeleton className="h-4 w-2/3 bg-slate-700" />
                </div>
            </CardContent>
        </Card>
    );
};


export default TripInfo;
