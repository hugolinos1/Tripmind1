'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Edit, Home, Info, MapPin, MoreVertical, Sparkles, Star, Bus, Trash2, Utensils, Loader2, ChevronDown, Globe, Paperclip, FileText, PlusCircle } from "lucide-react";
import { Badge } from "../ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "../ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { useState, useRef } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type EventType = 'visit' | 'meal' | 'transport' | 'accommodation' | 'activity';

export interface Attachment {
  id: string;
  filename: string;
  category: 'ticket' | 'voucher' | 'reservation' | 'other';
}

// Adding description and practicalInfo to the event type for the card
export interface Event {
  id: string;
  type: EventType;
  title: string;
  startTime?: string;
  durationMinutes?: number;
  locationName?: string;
  isAiEnriched: boolean;
  description?: string;
  practicalInfo?: {
    openingHours?: string;
    price?: string;
    tips?: string;
    website?: string;
  };
  lat?: number;
  lng?: number;
  attachments?: Attachment[];
}

interface EventCardProps {
    event: Event;
    onEnrich: (eventId: string) => Promise<void>;
    onAddAttachment: (eventId: string, attachment: Attachment) => void;
}

const eventTypeConfig = {
  visit: { color: "border-event-visit", icon: MapPin },
  meal: { color: "border-event-meal", icon: Utensils },
  transport: { color: "border-event-transport", icon: Bus },
  accommodation: { color: "border-event-accommodation", icon: Home },
  activity: { color: "border-event-activity", icon: Star },
};

const EventCard = ({ event, onEnrich, onAddAttachment }: EventCardProps) => {
  const [isEnriching, setIsEnriching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const config = eventTypeConfig[event.type] || eventTypeConfig.activity;
  const Icon = config.icon;
  
  const handleEnrich = async () => {
    setIsEnriching(true);
    try {
        await onEnrich(event.id);
    } catch (error) {
        // Error is handled by parent (toast)
        console.error("Enrichment failed in EventCard:", error);
    } finally {
        setIsEnriching(false);
    }
  };

  const handleAddAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const newAttachment: Attachment = {
              id: `attach-${Date.now()}-${Math.random()}`, // simple unique id
              filename: file.name,
              category: 'other', // default category
          };
          onAddAttachment(event.id, newAttachment);
      }
      // Reset file input to allow selecting the same file again
      if (e.target) {
          e.target.value = '';
      }
  };

  const hasPracticalInfo = event.practicalInfo && (event.practicalInfo.openingHours || event.practicalInfo.price || event.practicalInfo.tips || event.practicalInfo.website);
  const hasAttachments = event.attachments && event.attachments.length > 0;

  return (
    <Card className={`border-l-4 ${config.color} border-y-slate-800 border-r-slate-800 bg-slate-800/30 group hover:bg-slate-800/60 transition-colors`}>
      <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
      <CardContent className="p-4 flex gap-4 items-start">
        <div className="flex-grow">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-slate-400"/>
              <h3 className="font-semibold text-white">{event.title}</h3>
              {hasPracticalInfo && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-slate-400 cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent>
                            <div className="space-y-2 p-1 text-sm max-w-xs">
                                {event.practicalInfo?.openingHours && <p><strong>Horaires:</strong> {event.practicalInfo.openingHours}</p>}
                                {event.practicalInfo?.price && <p><strong>Prix:</strong> {event.practicalInfo.price}</p>}
                                {event.practicalInfo?.tips && <p><strong>Conseils:</strong> {event.practicalInfo.tips}</p>}
                                {event.practicalInfo?.website && (
                                    <p className="flex items-center gap-2">
                                        <Globe className="h-4 w-4 text-slate-400" />
                                        <a href={event.practicalInfo.website} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
                                            Visiter le site web
                                        </a>
                                    </p>
                                )}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
              )}
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary">
                          <Paperclip className="h-4 w-4" />
                          <span className="sr-only">Pièces jointes</span>
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                      <DropdownMenuLabel>Pièces jointes</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {hasAttachments ? (
                          event.attachments?.map((att) => (
                              <DropdownMenuItem key={att.id} asChild>
                                  <a href="#" onClick={(e) => e.preventDefault()} className="cursor-pointer">
                                      <FileText className="mr-2 h-4 w-4" />
                                      <span>{att.filename}</span>
                                  </a>
                              </DropdownMenuItem>
                          ))
                      ) : (
                          <DropdownMenuItem disabled>Aucune pièce jointe</DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={handleAddAttachmentClick} className="cursor-pointer">
                          <PlusCircle className="mr-2 h-4 w-4" />
                          <span>Ajouter une pièce jointe</span>
                      </DropdownMenuItem>
                  </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {event.isAiEnriched && (
              <Badge variant="outline" className="text-primary border-primary/50 text-xs h-fit">
                <Sparkles className="h-3 w-3 mr-1" />
                Enrichi
              </Badge>
            )}
          </div>
          
          <div className="text-sm text-slate-400 mt-1 space-y-2 pl-6">
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
          
          {event.description && (
            <Collapsible className="pl-6 pt-2">
              <CollapsibleTrigger asChild>
                  <button className="text-sm text-slate-400 hover:text-white flex items-center gap-1 data-[state=open]:text-white">
                      Voir les détails
                      <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                  <p className="text-slate-300 text-sm leading-relaxed">{event.description}</p>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={handleEnrich} disabled={isEnriching}>
                            {isEnriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            <span className="sr-only">Enrichir</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Enrichir avec l'IA</TooltipContent>
                </Tooltip>
            </TooltipProvider>
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
