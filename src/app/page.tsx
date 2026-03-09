'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Landmark, Map, Menu } from 'lucide-react';
import { Logo } from '@/components/logo';
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export default function LandingPage() {
  const [year, setYear] = useState<number | string>('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      setYear(new Date().getFullYear());
    }
  }, [isClient]);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-slate-900 to-bg-dark text-white">
      <header className="container mx-auto px-6">
        <nav className="flex justify-between items-center py-6">
          <Logo />
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Se connecter</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/test-ai">Tester l'IA</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard">Commencer gratuitement</Link>
            </Button>
          </div>
          {/* Mobile Nav */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Ouvrir le menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-slate-900/95 backdrop-blur-sm border-slate-700 w-[240px] sm:w-sm">
                <nav className="flex flex-col items-center justify-center h-full space-y-6 text-lg">
                  <Link href="/login" className="hover:text-primary transition-colors">Se connecter</Link>
                  <Link href="/test-ai" className="hover:text-primary transition-colors">Tester l'IA</Link>
                  <Button asChild size="lg" className="w-full max-w-[200px] mt-4">
                    <Link href="/dashboard">Commencer</Link>
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </header>

      <main className="flex-grow">
        <section className="container mx-auto px-6 py-20 text-center flex flex-col items-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold font-headline mb-4 leading-tight">
            Planifiez vos voyages avec <span className="gradient-text">l'IA</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-3xl mb-8">
            TripMind est votre assistant de voyage personnel qui crée des itinéraires sur-mesure, trouve les meilleures activités et organise chaque détail pour vous.
          </p>
          <Button size="lg" asChild>
            <Link href="/dashboard">Créez votre premier voyage</Link>
          </Button>
        </section>

        <section className="container mx-auto px-6 py-20">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <FeatureCard
              icon={<Bot className="h-10 w-10 text-primary" />}
              title="Itinéraires Intelligents"
              description="Laissez notre IA concevoir un plan de voyage complet basé sur vos envies, votre budget et votre rythme."
            />
            <FeatureCard
              icon={<Landmark className="h-10 w-10 text-primary" />}
              title="Découvertes Enrichies"
              description="Obtenez des informations pratiques, des photos inspirantes et des conseils d'experts pour chaque lieu que vous visitez."
            />
            <FeatureCard
              icon={<Map className="h-10 w-10 text-primary" />}
              title="Organisation Centralisée"
              description="Rassemblez vos billets, réservations et notes en un seul endroit. Visualisez votre parcours sur une carte interactive."
            />
          </div>
        </section>
      </main>

      <footer className="container mx-auto px-6 py-6 text-center text-slate-400">
        <p>&copy; {isClient ? year : ''} TripMind. Tous droits réservés.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="bg-slate-800/50 border-slate-700/50 glass-light">
      <CardHeader className="flex flex-col items-center">
        <div className="p-3 rounded-full bg-slate-900 mb-4">{icon}</div>
        <CardTitle className="font-headline text-2xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-slate-300">{description}</p>
      </CardContent>
    </Card>
  );
}
