'use client';

import { useState } from 'react';
import Link from 'next/link';
import { testOpenRouterConnectivity } from '@/ai/flows/ai-test-connectivity';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/logo';

export default function TestAiPage() {
  const [prompt, setPrompt] = useState('Bonjour, est-ce que ça marche ?');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleTest = async () => {
    setIsLoading(true);
    setResponse('');
    setError('');
    try {
      const result = await testOpenRouterConnectivity(prompt);
      setResponse(result);
    } catch (e: any) {
      console.error(e);
      let errorMessage = e.message || 'Une erreur inconnue est survenue.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-bg-dark">
      <header className="container mx-auto px-6">
        <nav className="flex justify-between items-center py-6">
          <Logo />
          <Button variant="outline" asChild>
            <Link href="/dashboard">Retour au tableau de bord</Link>
          </Button>
        </nav>
      </header>
      <main className="flex-1 container mx-auto px-6 py-8 flex items-center justify-center">
        <Card className="w-full max-w-2xl bg-slate-800/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Test de Connectivité IA</CardTitle>
            <CardDescription>
              Utilisez ce formulaire pour envoyer un message simple au modèle d'IA et vérifier si la connexion fonctionne correctement.
              Cette page utilise désormais OpenRouter.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="prompt-input" className="text-sm font-medium">Message à envoyer</label>
              <Input
                id="prompt-input"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Entrez un message de test..."
              />
            </div>
            <Button onClick={handleTest} disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                'Lancer le test'
              )}
            </Button>
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-4">
            {response && (
              <div className="w-full space-y-2">
                <h3 className="font-semibold text-lg text-green-400">Réponse de l'IA (Succès)</h3>
                <pre className="text-sm bg-slate-900 rounded-md p-4 whitespace-pre-wrap font-mono">{response}</pre>
              </div>
            )}
            {error && (
              <div className="w-full space-y-2">
                <h3 className="font-semibold text-lg text-destructive">Erreur</h3>
                <pre className="text-sm bg-destructive/10 border border-destructive/50 text-destructive-foreground rounded-md p-4 whitespace-pre-wrap font-mono">{error}</pre>
              </div>
            )}
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
