'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Loader2, Upload, Search } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface ImagePickerProps {
  value?: string;
  onChange: (value: string) => void;
  searchDefaultValue?: string;
}

export function ImagePicker({ value, onChange, searchDefaultValue }: ImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchDefaultValue || '');
  const [searchedImageUrl, setSearchedImageUrl] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit
        toast({
            variant: 'destructive',
            title: "Image trop lourde",
            description: "Veuillez choisir une image de moins de 1 Mo.",
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange(reader.result as string);
        setOpen(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    setSearchedImageUrl(null);
    try {
      // Add a random seed to avoid browser caching and get a new image
      const response = await fetch(`https://source.unsplash.com/800x400/?${searchQuery.replace(/ /g, ',')}&t=${new Date().getTime()}`);
      if (response.ok) {
        setSearchedImageUrl(response.url);
      } else {
        toast({
            variant: 'destructive',
            title: "Erreur de recherche",
            description: "Impossible de rechercher l'image. Veuillez réessayer.",
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: "Erreur réseau",
        description: "Une erreur est survenue lors de la recherche d'image.",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseSearchedImage = () => {
    if (searchedImageUrl) {
      onChange(searchedImageUrl);
      setOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      {value && (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-slate-700">
          <Image src={value} alt="Aperçu du voyage" layout="fill" objectFit="cover" />
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">{value ? "Changer l'image" : "Ajouter une image d'illustration"}</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Choisir une image d'illustration</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="search" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="search">Rechercher sur le web</TabsTrigger>
              <TabsTrigger value="upload">Charger une image</TabsTrigger>
            </TabsList>
            <TabsContent value="search" className="space-y-4 py-4">
              <div className="flex w-full items-center space-x-2">
                <Input
                  id="search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ex: 'Japon, temples, printemps'"
                />
                <Button type="button" onClick={handleSearch} disabled={isSearching} size="icon">
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="sr-only">Rechercher</span>
                </Button>
              </div>
              <div className="relative w-full aspect-video bg-slate-800 rounded-md flex items-center justify-center">
                {isSearching && <Loader2 className="h-8 w-8 animate-spin text-slate-400" />}
                {!isSearching && searchedImageUrl && (
                  <Image src={searchedImageUrl} alt="Résultat de la recherche" layout="fill" objectFit="cover" className="rounded-md" />
                )}
                {!isSearching && !searchedImageUrl && (
                  <p className="text-slate-400">L'aperçu de l'image apparaîtra ici.</p>
                )}
              </div>
              <DialogFooter>
                  <Button onClick={handleUseSearchedImage} disabled={!searchedImageUrl}>Utiliser cette image</Button>
              </DialogFooter>
            </TabsContent>
            <TabsContent value="upload" className="space-y-4 py-4">
              <div className="flex items-center justify-center w-full">
                <Label htmlFor="picture" className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer bg-slate-800/50 hover:bg-slate-800">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-4 text-slate-400" />
                        <p className="mb-2 text-sm text-slate-400"><span className="font-semibold">Cliquez pour charger</span> ou glissez-déposez</p>
                        <p className="text-xs text-slate-500">PNG, JPG (MAX. 1Mo)</p>
                    </div>
                    <Input id="picture" type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleFileChange} />
                </Label>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
