
# Contexte de Développement : Application TripMind

## 1. Vue d'ensemble de l'application

### 1.1. Mission
TripMind est un planificateur de voyage intelligent conçu pour aider les utilisateurs à créer, organiser et enrichir leurs itinéraires de voyage. L'application s'appuie sur l'intelligence artificielle pour générer des suggestions pertinentes, automatiser les tâches de planification fastidieuses et centraliser toutes les informations de voyage en un seul endroit.

### 1.2. Fonctionnalités principales
- **Authentification des utilisateurs** via email/mot de passe et fournisseurs OAuth (Google).
- **Tableau de bord centralisé** pour visualiser, créer et supprimer des voyages.
- **Création de voyage guidée** pour définir les destinations, les dates, les participants et les préférences.
- **Génération d'itinéraire par l'IA** pour créer un plan de voyage complet, jour par jour.
- **Éditeur d'itinéraire quotidien** avec vue cartographique interactive (Leaflet) pour visualiser et modifier les événements.
- **Enrichissement d'événements par l'IA** pour obtenir des descriptions détaillées, des informations pratiques (horaires, prix) et des conseils.
- **Suggestions de transport par l'IA** entre les différents événements d'une journée.
- **Gestion des documents de voyage** par événement (billets, réservations).
- **Section "À Savoir"** générée par l'IA, fournissant des informations contextuelles sur la destination (culture, gastronomie, sécurité, etc.).

## 2. Stack Technique
- **Framework Frontend:** Next.js 14+ avec l'App Router.
- **Langage:** TypeScript.
- **Bibliothèque UI:** React.
- **Système de composants:** shadcn/ui, offrant des composants accessibles et personnalisables.
- **Styling:** Tailwind CSS pour l'utilitaire CSS et une approche "utility-first".
- **Icônes:** `lucide-react`.
- **Backend & Base de Données:** Firebase
  - **Authentification:** Firebase Authentication (Email/Password, Google).
  - **Base de données:** Firestore (NoSQL) pour le stockage des données utilisateur, des voyages et des itinéraires.
- **Intelligence Artificielle:** Intégration de modèles de langage via l'API OpenRouter pour la génération de contenu.
- **Gestion de formulaires:** `react-hook-form` avec `zod` pour la validation de schémas.

## 3. Architecture des Fonctionnalités Détaillées

### 3.1. Authentification et Données Utilisateur
- Les utilisateurs peuvent s'inscrire et se connecter avec leur email/mot de passe ou leur compte Google.
- À la première connexion, un document utilisateur est automatiquement créé dans Firestore à l'emplacement `/users/{userId}`.
- **Schéma `User` (Firestore):**
  - `id`: (String) UID de Firebase Auth.
  - `email`: (String) Email de l'utilisateur.
  - `name`: (String) Nom d'affichage.
  - `avatar`: (String) URL de l'avatar.
  - `language`, `currency`: (String) Préférences de l'utilisateur.
  - `createdAt`, `updatedAt`: (Timestamp) Timestamps de création/mise à jour.

### 3.2. Planification de Voyage
- **Création de voyage (`/new-trip`):** Un formulaire permet de saisir les informations initiales : titre, destinations (séparées par des virgules), dates, composition du groupe de voyageurs et préférences (rythme, budget, centres d'intérêt).
- **Modification de voyage (`/trips/[id]/edit`):** Permet de mettre à jour les informations du voyage, y compris une image d'illustration choisie via une recherche web (Picsum) ou un upload.
- **Stockage:** Les voyages sont stockés dans la sous-collection `/users/{userId}/trips/{tripId}`.

### 3.3. Itinéraire et Édition (`/trips/[id]`)
C'est l'écran principal de l'application, divisé en deux parties : l'itinéraire détaillé et la carte interactive.

#### 3.3.1. Structure des données (Firestore)
- **Jours (`Day`):** `/users/{userId}/trips/{tripId}/days/{dayId}`
  - Chaque document représente un jour du voyage avec une date, un index, et des informations sur les lieux de départ/retour.
- **Événements (`Event`):** `/users/{userId}/trips/{tripId}/days/{dayId}/events/{eventId}`
  - Représente une activité, un repas, un transport, etc. Contient les détails (titre, heure, durée, lieu), le contenu enrichi par l'IA, et les pièces jointes.

#### 3.3.2. Génération d'Itinéraire par l'IA
- **Génération complète:** Si aucun jour n'existe pour un voyage, un bouton "Générer tout l'itinéraire" est disponible.
  - **Input (`GenerateItineraryInput`):** Détails du voyage (titre, dates, destinations, voyageurs, préférences).
  - **Prompt:** Demande à l'IA de créer un itinéraire jour par jour, en respectant un schéma JSON strict.
  - **Schéma de Sortie JSON attendu:**
    ```json
    {
      "itinerary": [
        {
          "date": "YYYY-MM-DD",
          "location": "City, Country",
          "events": [
            {
              "type": "'visit' | 'meal' | 'transport' | 'accommodation' | 'activity'",
              "title": "Titre de l'événement en français",
              "startTime": "HH:mm",
              "durationMinutes": 60,
              "description": "Brève description de l'événement en français.",
              "locationName": "Specific location name",
              "lat": 48.8584,
              "lng": 2.2945
            }
          ]
        }
      ]
    }
    ```

- **Complétion d'une journée:** Un bouton "Compléter la journée" sur un jour spécifique permet d'ajouter des événements autour de ceux déjà existants.
  - **Input (`CompleteDayItineraryInput`):** Date, lieu, préférences, et liste des événements existants.
  - **Prompt:** Demande à l'IA d'ajouter des événements complémentaires tout en préservant les événements existants (identifiés par leur `id`).
  - **Schéma de Sortie JSON attendu:**
    ```json
    {
      "events": [
        {
          "id": "optional-id-for-existing-events",
          "type": "activity",
          "title": "Titre de l'événement en français",
          "startTime": "HH:mm",
          "durationMinutes": 60,
          "description": "Brève description de l'événement en français.",
          "locationName": "Specific location name",
          "lat": 48.8584,
          "lng": 2.2945
        }
      ]
    }
    ```

#### 3.3.3. Enrichissement d'Événement par l'IA
- Chaque événement possède un bouton "Enrichir" (`<Sparkles />`).
  - **Input (`EnrichEventInput`):** Titre, type, lieu et description actuelle de l'événement.
  - **Prompt:** Demande à l'IA de réécrire la description et de trouver des informations pratiques.
  - **Schéma de Sortie JSON attendu:**
    ```json
    {
      "description": "A detailed, engaging description for the event. Write it in French.",
      "practicalInfo": {
        "openingHours": "(e.g., 'Lundi-Vendredi : 9h-18h')",
        "price": "(e.g., 'Entrée gratuite', 'À partir de 25€')",
        "website": "https://www.example.com",
        "tips": "Actionable tips for visitors in French."
      }
    }
    ```

#### 3.3.4. Suggestions de Transport par l'IA
- Entre chaque événement (et depuis le lieu de départ), une carte permet de générer des suggestions de trajet.
  - **Input (`TransportSuggestionInput`):** Objet de l'événement de départ et objet de l'événement d'arrivée (contenant titre, lieu, et coordonnées si disponibles).
  - **Prompt:** Demande à l'IA de fournir 2-3 options de transport pertinentes.
  - **Schéma de Sortie JSON attendu:**
    ```json
    {
      "suggestions": [
        {
          "mode": "walking | bus | taxi | plane | metro | etc.",
          "durationMinutes": 25,
          "distanceKm": 1.8,
          "cost": "Gratuit | €2.15 | €15-20",
          "description": "Description et conseils en français.",
          "isEcoFriendly": true
        }
      ]
    }
    ```

### 3.4. Section "À Savoir"
- Un onglet dédié sur la page de l'itinéraire permet de consulter des informations sur la destination.
- Chaque section ("Incontournables", "Gastronomie", etc.) a son propre bouton pour générer du contenu.
  - **Input (`GetDestinationInsightsInput`):** Destinations et thème de la section.
  - **Prompt:** Demande à l'IA de fournir des informations pratiques sur le sujet demandé, au format Markdown.
  - **Schéma de Sortie attendu:**
    ```json
    {
      "content": "Contenu en Markdown..."
    }
    ```

## 4. Structure de la Base de Données et Sécurité

### 4.1. Schéma Firestore (`docs/backend.json`)
La structure hiérarchique est conçue pour la sécurité et la performance, en colocalisant les données d'un utilisateur.
- `/users/{userId}`: (Doc) Profil de l'utilisateur.
- `/users/{userId}/trips/{tripId}`: (Collection) Voyages de l'utilisateur.
- `/users/{userId}/trips/{tripId}/days/{dayId}`: (Collection) Jours d'un voyage.
- `/users/{userId}/trips/{tripId}/days/{dayId}/events/{eventId}`: (Collection) Événements d'une journée.
- `/users/{userId}/trips/{tripId}/insights/{insightId}`: (Collection) Contenu de la section "À Savoir".

### 4.2. Règles de Sécurité (`firestore.rules`)
- **Philosophie:** Modèle de possession stricte. Un utilisateur ne peut lire et écrire que les documents situés sous son propre chemin (`/users/{request.auth.uid}`).
- **Protection:** La lecture de la collection racine `/users` est interdite pour empêcher l'énumération des utilisateurs.
- **Intégrité:** Les règles valident que les documents créés dans des sous-collections contiennent les bons identifiants parents (ex: un `Day` doit avoir le bon `tripId`).

## 5. Guide de Style et UI/UX

- **Thème Général:** Sombre, avec une esthétique "glassmorphism" (arrière-plans translucides avec effet de flou).
- **Couleurs:**
  - Arrière-plan principal: `slate-900` (`#0f172a`).
  - Couleur primaire (accents): Ambre (`#f59e0b`).
  - Couleur secondaire (actions destructives, etc.): Rouge (`#ef4444`).
  - Couleurs par type d'événement:
    - Visite: `amber`
    - Repas: `rose`
    - Transport: `sky`
    - Hébergement: `emerald`
    - Activité: `purple`
- **Typographie:**
  - Titres et éléments d'impact: `Space Grotesk`.
  - Corps du texte et informations: `Inter`.
- **Interactions:**
  - L'application est entièrement responsive.
  - Utilisation de `Carousel` pour la navigation entre les jours sur mobile.
  - Modales et boîtes de dialogue (`Dialog`) pour les formulaires (création/modification d'événements).
  - Menus déroulants (`DropdownMenu`) pour les actions contextuelles sur les événements.
  - Notifications (`Toaster`) pour les confirmations et les erreurs.

## 6. Logique de l'Interface Client

- **Gestion d'état Firebase:** L'application utilise des hooks personnalisés (`useUser`, `useDoc`, `useCollection`) qui encapsulent `onSnapshot` de Firestore pour une mise à jour des données en temps réel.
- **Memoization:** `useMemo` et `useCallback` sont utilisés intensivement pour stabiliser les références d'objets et les fonctions passées en props, afin d'éviter des rendus inutiles et de garantir la performance, notamment sur la page de l'itinéraire.
- **Opérations non-bloquantes:** Les écritures vers Firestore (`setDoc`, `updateDoc`, etc.) sont effectuées via des fonctions "non-bloquantes" qui ne `await` pas la promesse, afin de garder l'interface fluide. La gestion des erreurs se fait via un `.catch()` qui émet un événement global, intercepté par un `FirebaseErrorListener` pour afficher une superposition d'erreur claire en développement.
