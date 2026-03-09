'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sparkles,
  Loader2,
  Walk,
  Bus,
  Car,
  Bike,
  HelpCircle,
  Clock,
  Euro,
  Leaf,
  ChevronDown,
  Waypoints,
} from 'lucide-react';
import { getTransportSuggestions } from '@/ai/flows/ai-get-transport-suggestions';
import type { TransportSuggestionOutput, TransportSuggestionInput } from '@/ai/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TransportSuggestionCardProps {
  startEvent: TransportSuggestionInput['startEvent'];
  endEvent: TransportSuggestionInput['endEvent'];
}

type Suggestion = TransportSuggestionOutput['suggestions'][0];

const modeIcons: Record<Suggestion['mode'] | 'other', React.ElementType> = {
  walking: Walk,
  public_transport: Bus,
  taxi: Car,
  bike_sharing: Bike,
  other: HelpCircle,
};

export function TransportSuggestionCard({ startEvent, endEvent }: TransportSuggestionCardProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setSuggestions(null);
    try {
      const result = await getTransportSuggestions({ startEvent, endEvent });
      setSuggestions(result.suggestions);
    } catch (e: any) {
      setError(e.message || 'Une erreur est survenue.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!suggestions && !isLoading && !error) {
    return (
      <div className="flex justify-center items-center my-2 transition-all duration-300 ease-in-out">
        <div className="h-px bg-slate-700 flex-grow"></div>
        <Button variant="outline" size="sm" onClick={handleGenerate} className="mx-4 flex-shrink-0 border-slate-600 hover:bg-slate-800 hover:text-primary">
          <Sparkles className="mr-2 h-4 w-4" />
          Trajet vers l'événement suivant
        </Button>
        <div className="h-px bg-slate-700 flex-grow"></div>
      </div>
    );
  }
  
  if(isLoading){
      return (
        <div className="flex justify-center items-center my-4 p-4 text-slate-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span>Recherche d'itinéraires...</span>
        </div>
      );
  }

  if (error) {
    return (
        <Alert variant="destructive" className="my-3">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Erreur de suggestion</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
             <Button variant="link" size="sm" onClick={handleGenerate} className="p-0 h-auto mt-2 text-destructive">
                Réessayer
            </Button>
        </Alert>
    );
  }

  if (suggestions && suggestions.length > 0) {
    return (
        <Collapsible defaultOpen className="my-2 group/collapsible">
            <div className="flex justify-center items-center transition-all duration-300 ease-in-out">
                <div className="h-px bg-slate-700 flex-grow"></div>
                <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="mx-4 flex-shrink-0 text-slate-400 hover:text-primary data-[state=open]:text-primary">
                        <Sparkles className="mr-2 h-4 w-4" />
                        Trajet vers "{endEvent.title}"
                        <ChevronDown className="ml-2 h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                    </Button>
                </CollapsibleTrigger>
                <div className="h-px bg-slate-700 flex-grow"></div>
            </div>
            <CollapsibleContent>
                <Card className="mt-2 mb-1 bg-slate-900/30 border-slate-800 shadow-inner">
                    <CardContent className="p-3 space-y-2">
                        {suggestions.map((suggestion, index) => {
                            const Icon = modeIcons[suggestion.mode] || HelpCircle;
                            const modeLabels: Record<Suggestion['mode'], string> = {
                                walking: 'À pied',
                                public_transport: 'Transport public',
                                taxi: 'Taxi / VTC',
                                bike_sharing: 'Vélo en libre-service',
                                other: 'Autre'
                            };
                            return (
                                <div key={`${suggestion.mode}-${index}`} className="p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700">
                                    <div className="flex items-center gap-4">
                                        <Icon className="h-5 w-5 text-primary flex-shrink-0" />
                                        <div className="flex-grow">
                                            <p className="font-semibold text-white">{modeLabels[suggestion.mode] || suggestion.mode}</p>
                                            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                                                {suggestion.distanceKm && <span className="flex items-center gap-1.5"><Waypoints className="h-3 w-3" /> {suggestion.distanceKm} km</span>}
                                                <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {suggestion.durationMinutes} min</span>
                                                <span className="flex items-center gap-1.5"><Euro className="h-3 w-3" /> {suggestion.cost}</span>
                                                {suggestion.isEcoFriendly && <span className="flex items-center gap-1.5 text-green-400"><Leaf className="h-3 w-3" /> Écologique</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-300 mt-2 pl-9">{suggestion.description}</p>
                                </div>
                            );
                        })}
                        <div className="text-center pt-1">
                            <Button variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-slate-300" onClick={handleGenerate}>
                                <Sparkles className="mr-1 h-3 w-3" />
                                Régénérer les suggestions
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </CollapsibleContent>
        </Collapsible>
    );
  }

  return null;
}
