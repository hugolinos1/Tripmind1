# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Environment Variables

This project uses environment variables to manage API keys and Firebase configuration.

### Local Development

1.  Create a new file named `.env.local` in the root of the project. This file is already listed in `.gitignore` and will not be committed.
2.  Copy the contents of the `.env` file into your new `.env.local` file.
3.  Fill in the values for each variable.

```env
# .env.local

# Get your key from https://openrouter.ai/
OPENROUTER_API_KEY="sk-or-..."

# Firebase project configuration
# You can get these from your Firebase project settings
NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."
NEXT_PUBLIC_FIREBASE_APP_ID="..."
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="..."

```

### Deployment (GitHub Actions)

For deployment, you must set these environment variables as **Repository Secrets** in your GitHub repository settings.

1.  Go to your repository on GitHub.
2.  Navigate to `Settings` > `Secrets and variables` > `Actions`.
3.  Click `New repository secret` for each variable listed above and provide its value.
