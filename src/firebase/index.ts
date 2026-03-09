'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (getApps().length) {
    return getSdks(getApp());
  }

  // First, check if the configuration is provided via environment variables.
  // This is the primary method for local development.
  if (firebaseConfig.projectId && firebaseConfig.apiKey) {
    const firebaseApp = initializeApp(firebaseConfig);
    return getSdks(firebaseApp);
  }

  // If environment variables are not set, try the automatic initialization.
  // This is for environments like Firebase App Hosting.
  try {
    const firebaseApp = initializeApp();
    return getSdks(firebaseApp);
  } catch (e) {
    // If both methods fail, it means the configuration is missing.
    throw new Error(
      "Firebase configuration is missing or incomplete. " +
      "Please copy `.env` to `.env.local` and fill in your Firebase project details. " +
      "If you've just created the file, you may need to restart the development server."
    );
  }
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
