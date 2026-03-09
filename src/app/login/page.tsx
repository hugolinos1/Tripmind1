
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/logo';
import { Eye, EyeOff } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth, useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';

const formSchema = z.object({
  email: z.string().email({ message: 'Veuillez entrer une adresse email valide.' }),
  password: z.string().min(6, { message: 'Le mot de passe doit contenir au moins 6 caractères.' }),
});

type FormValues = z.infer<typeof formSchema>;

function getFriendlyAuthErrorMessage(error: any): string {
  switch (error.code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email ou mot de passe incorrect.';
    case 'auth/invalid-email':
      return "L'adresse email est invalide.";
    case 'auth/email-already-in-use':
      return 'Cette adresse email est déjà utilisée par un autre compte.';
    case 'auth/weak-password':
      return 'Le mot de passe est trop faible.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives de connexion. Veuillez réessayer plus tard.';
    default:
      return 'Une erreur est survenue. Veuillez réessayer.';
  }
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = (values: FormValues) => {
    setFirebaseError(null);
    const authPromise = isSignUp
      ? createUserWithEmailAndPassword(auth, values.email, values.password)
      : signInWithEmailAndPassword(auth, values.email, values.password);

    authPromise.catch((error) => {
      setFirebaseError(getFriendlyAuthErrorMessage(error));
    });
  };

  const handleGoogleSignIn = async () => {
    setFirebaseError(null);
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch((error) => {
      setFirebaseError(getFriendlyAuthErrorMessage(error));
    });
  };

  if (!isClient || isUserLoading || user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-900 to-bg-dark">
        <div className="mx-auto max-w-sm w-full space-y-4">
            <div className="flex justify-center">
                <Logo />
            </div>
            <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-900 to-bg-dark">
      <Card className="mx-auto max-w-sm w-full bg-slate-800/50 border-slate-700/50 glass-light">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <Logo />
          </div>
          <CardTitle className="text-2xl font-headline">
            {isSignUp ? "Créer un compte" : "Connexion"}
          </CardTitle>
          <CardDescription>
            {isSignUp
              ? "Entrez vos informations pour créer votre compte"
              : "Entrez votre email pour vous connecter à votre compte"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="m@exemple.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center">
                      <FormLabel>Mot de passe</FormLabel>
                      {!isSignUp && (
                        <button
                          type="button"
                          onClick={() => alert("Fonctionnalité de mot de passe oublié à implémenter.")}
                          className="ml-auto inline-block text-sm underline"
                        >
                          Mot de passe oublié?
                        </button>
                      )}
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          {...field}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-white"
                          aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {firebaseError && <p className="text-sm font-medium text-destructive">{firebaseError}</p>}
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {isSignUp ? "S'inscrire" : "Se connecter"}
              </Button>
            </form>
          </Form>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-600" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-800/50 px-2 text-muted-foreground">Ou continuer avec</span>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
            Se connecter avec Google
          </Button>
          <div className="mt-4 text-center text-sm">
            {isSignUp ? "Vous avez déjà un compte?" : "Pas encore de compte?"}{' '}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setFirebaseError(null);
                form.reset();
              }}
              className="underline"
            >
              {isSignUp ? "Se connecter" : "S'inscrire"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
