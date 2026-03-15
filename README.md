# Jobsearch AI (Next.js + Firestore + Firecrawl + Groq)

This project provides an end-to-end AI job search workflow:

- Firecrawl ingestion of jobs
- Firebase Firestore job storage
- Google authentication via Firebase Auth
- Search and filter APIs in Next.js
- Resume upload, OCR, Groq extraction, and AI matching flow
- Distributed-ready API rate limiting for Vercel deployments

## Prerequisites

- Node.js 18+
- A Firebase project with Firestore and Authentication enabled
- Firecrawl API key
- Groq API key

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Copy `.env.example` to `.env` and set values:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIRECRAWL_API_KEY`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `FIRESTORE_COLLECTION_JOBS` (default: `jobs`)
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for production rate limiting on Vercel

## 3. Prepare Firestore

The backend writes job documents into the `jobs` collection with these fields:

- `title`
- `company`
- `location`
- `remoteType`
- `experienceLevel`
- `salary`
- `skills[]`
- `description`
- `applyUrl`
- `scrapedAt`

The application also stores normalized helper fields for filtering and ranking.

## 4. Run Firecrawl ingestion

```bash
npm run ingest
```

The script will:

- Scrape jobs from Firecrawl
- Normalize job fields for Firestore
- Insert or update jobs into the `jobs` collection
- Enrich listing jobs with job-detail descriptions and inferred skills

## 5. Start local development

```bash
npm run dev
```

Open `http://localhost:3000`.

## 6. Vercel deployment

Deploy this repo as a standard Next.js project on Vercel.

Set these environment variables in the Vercel project settings:

- `FIREBASE_PROJECT_ID`: Firebase project ID
- `FIREBASE_CLIENT_EMAIL`: Firebase service account email
- `FIREBASE_PRIVATE_KEY`: Firebase service account private key, kept server-side only
- `FIREBASE_STORAGE_BUCKET`: Firebase storage bucket, e.g. `your-project-id.firebasestorage.app`
- `NEXT_PUBLIC_FIREBASE_API_KEY`: Firebase web app API key
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: Firebase auth domain, e.g. `your-project-id.firebaseapp.com`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: Firebase web app project ID
- `NEXT_PUBLIC_FIREBASE_APP_ID`: Firebase web app app ID
- `FIRECRAWL_API_KEY`: Firecrawl API key
- `FIRESTORE_COLLECTION_JOBS`: Firestore collection name, typically `jobs`
- `GROQ_API_KEY`: Groq API key for resume analysis
- `GROQ_MODEL`: Groq model, default `llama-3.3-70b-versatile`
- `UPSTASH_REDIS_REST_URL`: Upstash Redis REST URL for distributed rate limiting
- `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis REST token for distributed rate limiting

Vercel notes:

- Add your Vercel production domain and preview domain to Firebase Authentication authorized domains.
- The web app uses Firebase popup auth, so `NEXT_PUBLIC_FIREBASE_*` values must match the Firebase web app you deploy.
- The current rate limiter automatically uses Upstash Redis in production when Redis credentials are present and falls back to in-memory storage only when Redis is not configured.
- Run ingestion outside Vercel request handlers. Use your local machine, a GitHub Action, or a scheduled worker to run `npm run ingest`.

## 7. Provider-specific deployment checklist

Firebase:

- Enable Firebase Authentication and the Google provider.
- Add `localhost`, your Vercel domain, and any custom domain to authorized domains.
- Keep Admin SDK credentials only in server-side environment variables.
- Rotate any keys that were previously exposed during development.

Groq:

- Use a dedicated production API key.
- Apply spend limits and monitor usage in the Groq dashboard.

Firecrawl:

- Use a dedicated production key.
- Expect some sources to degrade or return sparse data; keep source URLs configurable through environment variables.

Redis / Upstash:

- Prefer Vercel KV or Upstash Redis for production rate limiting.
- Do not rely on in-memory limiting across multiple serverless instances.

## App routes

- `/` keyword search, filters, ranking, and infinite scroll
- `/profile` resume upload and top 10 job matches
- `/jobs/[id]` job detail view
- `/api/searchJobs` GET search API
- `/api/searchMeta` GET filter options API
- `/api/resume/match` POST resume matching API

## Security notes

- Keep Firebase Admin, Groq, Firecrawl, and Redis credentials out of source control.
- The app ships with security headers and API rate limiting, but production safety still depends on correct provider configuration.
- Update Firecrawl field mapping in `src/ingest/firecrawl_ingest.js` if the upstream payload shape differs.
