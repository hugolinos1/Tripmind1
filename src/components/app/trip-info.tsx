
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { BookText, ChefHat, Handshake, Landmark, RefreshCw, Train, Umbrella, Siren, Wallet, Ban, Search, Sprout, Loader2, Terminal, Sparkles, ChevronDown } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { useState, useCallback } from "react";
import { getDestinationInsights } from "@/ai/flows/ai-get-destination-insights";
import ReactMarkdown from 'react-markdown';
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useUser, useFirestore, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';


interface TripInfoProps {
  tripId: string;
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

const TripInfo = ({ tripId, destinations }: TripInfoProps) => {
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
                sectionId={section.id}
                destinations={destinations}
                tripId={tripId}
            />
        ))}
      </div>
    </div>
  );
};

interface InfoCardProps {
    title: string;
    icon: React.ReactNode;
    sectionId: string;
    destinations: string[];
    tripId: string;
}

const InfoCard = ({ title, icon, sectionId, destinations, tripId }: InfoCardProps) => {
    const { user } = useUser();
    const firestore = useFirestore();
    
    const [isGenerating, setIsGenerating] = useState(false); // for AI loading state
    const [error, setError] = useState<string | null>(null);

    const insightRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, 'users', user.uid, 'trips', tripId, 'insights', sectionId);
    }, [user, firestore, tripId, sectionId]);

    const { data: insightData, isLoading: isInsightLoading } = useDoc<{content: string}>(insightRef);
    const content = insightData?.content;

    const fetchContentAndSave = useCallback(async () => {
        if (!user || !firestore || !insightRef) {
             setError("Vous devez être connecté pour effectuer cette action.");
             return;
        }
        setIsGenerating(true);
        setError(null);
        try {
            const result = await getDestinationInsights({
                destinations,
                sectionId,
                sectionLabel: title,
            });
            
            const dataToSave = {
                id: sectionId,
                tripId: tripId,
                content: result.content,
                updatedAt: serverTimestamp(),
                ...(!insightData && { createdAt: serverTimestamp() })
            };

            setDocumentNonBlocking(insightRef, dataToSave, { merge: true });

        } catch (e: any) {
            setError(e.message || "Une erreur est survenue.");
        } finally {
            setIsGenerating(false);
        }
    }, [destinations, sectionId, title, user, firestore, tripId, insightData, insightRef]);

    const showContent = !isInsightLoading && !!content;
    const showGenerateButton = !isInsightLoading && !content && !error;
    const showSkeleton = isInsightLoading;

    return (
        <Card className="border-slate-800 bg-slate-800/30 flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                    <div className="text-primary">{icon}</div>
                    <CardTitle className="text-lg font-headline">{title}</CardTitle>
                </div>
                {showContent && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={fetchContentAndSave} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                )}
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
                {showSkeleton && (
                    <div className="space-y-2 mt-2">
                        <Skeleton className="h-4 w-4/5 bg-slate-700" />
                        <Skeleton className="h-4 w-full bg-slate-700" />
                        <Skeleton className="h-4 w-2/3 bg-slate-700" />
                    </div>
                )}
                {error && (
                     <Alert variant="destructive" className="mt-2">
                        <Terminal className="h-4 w-4" />
                        <AlertTitle>Erreur</AlertTitle>
                        <AlertDescription className="text-xs">{error}</AlertDescription>
                         <Button variant="link" size="sm" onClick={fetchContentAndSave} className="p-0 h-auto mt-2 text-destructive">
                            Réessayer
                        </Button>
                    </Alert>
                )}
                {showContent && (
                    <Collapsible defaultOpen>
                        <CollapsibleTrigger asChild>
                            <button className="text-sm text-slate-400 hover:text-white flex items-center gap-1 data-[state=open]:text-white mb-2">
                                Voir les détails
                                <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                            </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="prose prose-sm prose-invert max-w-none prose-p:text-slate-300 prose-ul:text-slate-300 prose-strong:text-white">
                                <ReactMarkdown className="[&_p]:my-2 [&_ul]:my-2">{content}</ReactMarkdown>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}
                {showGenerateButton && (
                    <div className="flex-grow flex flex-col items-center justify-center text-center m-auto">
                        <Button onClick={fetchContentAndSave} disabled={isGenerating}>
                            {isGenerating ? (
                                <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Génération...
                                </>
                            ): (
                                <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Générer les infos
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};


export default TripInfo;
