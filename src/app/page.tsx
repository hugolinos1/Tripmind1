import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Landmark, Map } from 'lucide-react';
import { Logo } from '@/components/logo';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-slate-900 to-bg-dark text-white">
      <header className="container mx-auto px-6">
        <nav className="flex justify-between items-center py-6">
          <Logo />
          <div className="space-x-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Se connecter</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard">Commencer gratuitement</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/test-ai">Tester l'IA</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main className="flex-grow">
        <section className="container mx-auto px-6 py-20 text-center flex flex-col items-center">
          <h1 className="text-4xl md:text-6xl font-bold font-headline mb-4 leading-tight">
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
        <p>&copy; {new Date().getFullYear()} TripMind. Tous droits réservés.</p>
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
