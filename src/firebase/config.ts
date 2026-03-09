export const firebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

// A simple check to see if the environment variables are loaded correctly, especially for client components.
if (typeof window !== 'undefined' && !firebaseConfig.projectId) {
    console.warn(
      "Firebase config is not loaded. Make sure you have a .env file with the necessary NEXT_PUBLIC_FIREBASE_ variables."
    );
}
