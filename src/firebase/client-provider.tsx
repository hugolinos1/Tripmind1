'use client';

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

function FirebaseConfigErrorScreen() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
            <div style={{
                textAlign: 'center',
                padding: '2rem',
                borderRadius: '0.5rem',
                border: '1px solid hsl(var(--border))',
                maxWidth: '600px',
                background: 'hsl(var(--card))',
            }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'hsl(var(--primary))' }}>Erreur de Configuration Firebase</h1>
                <p style={{ marginTop: '1rem', color: 'hsl(var(--muted-foreground))' }}>
                    La connexion à Firebase a échoué. L'application ne peut pas démarrer.
                </p>
                <p style={{ marginTop: '1rem', color: 'hsl(var(--muted-foreground))' }}>
                    Veuillez vérifier que vous avez copié le fichier <code>.env</code> en <code>.env.local</code> et rempli les variables de configuration Firebase.
                </p>
                 <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
                    Un redémarrage du serveur de développement peut être nécessaire.
                </p>
            </div>
        </div>
    );
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    // Initialize Firebase on the client side, once per component mount.
    return initializeFirebase();
  }, []); // Empty dependency array ensures this runs only once on mount

  if (!firebaseServices) {
    return <FirebaseConfigErrorScreen />;
  }

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
