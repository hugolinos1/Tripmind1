import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Edit, Home, MapPin, MoreVertical, Sparkles, Star, Bus, Trash2, Utensils } from "lucide-react";
import { Badge } from "../ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

type EventType = 'visit' | 'meal' | 'transport' | 'accommodation' | 'activity';

interface Event {
  id: string;
  type: EventType;
  title: string;
  startTime?: string;
  durationMinutes?: number;
  locationName?: string;
  isAiEnriched: boolean;
}

const eventTypeConfig = {
  visit: { color: "border-event-visit", icon: MapPin },
  meal: { color: "border-event-meal", icon: Utensils },
  transport: { color: "border-event-transport", icon: Bus },
  accommodation: { color: "border-event-accommodation", icon: Home },
  activity: { color: "border-event-activity", icon: Star },
};

const EventCard = ({ event }: { event: Event }) => {
  const config = eventTypeConfig[event.type] || eventTypeConfig.activity;
  const Icon = config.icon;
  
  return (
    <Card className={`border-l-4 ${config.color} border-y-slate-800 border-r-slate-800 bg-slate-800/30 group hover:bg-slate-800/60 transition-colors`}>
      <CardContent className="p-4 flex gap-4 items-start">
        <div className="flex-grow">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-slate-400"/>
              <h3 className="font-semibold text-white">{event.title}</h3>
            </div>
            {event.isAiEnriched && (
              <Badge variant="outline" className="text-primary border-primary/50 text-xs h-fit">
                <Sparkles className="h-3 w-3 mr-1" />
                Enrichi
              </Badge>
            )}
          </div>
          
          <div className="text-sm text-slate-400 mt-1 space-y-1 pl-6">
            {event.startTime && (
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                <span>{event.startTime} {event.durationMinutes ? `(${event.durationMinutes} min)` : ''}</span>
              </div>
            )}
            {event.locationName && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                <span>{event.locationName}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary">
                <Sparkles className="h-4 w-4" />
                <span className="sr-only">Enrichir</span>
            </Button>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" />
                        Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
};

export default EventCard;
