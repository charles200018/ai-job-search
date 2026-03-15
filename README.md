# Jobsearch AI (Next.js + Firestore + Firecrawl + OpenAI)

This project provides an end-to-end AI job search workflow:

- Firecrawl ingestion of jobs
- OpenAI embeddings for jobs and resumes
- Firebase Firestore job storage
- Search and filter APIs in Next.js
- Resume upload and AI matching flow

## Prerequisites

- Node.js 18+
- A Firebase project with Firestore enabled
- Firecrawl API key and endpoint
- OpenAI API key

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Copy `.env.example` to `.env` and set values:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET` (optional)
- `OPENAI_API_KEY`
- `OPENAI_EMBEDDING_MODEL` (default: `text-embedding-3-small`)
- `FIRECRAWL_API_KEY`
- `FIRECRAWL_API_URL`
- `FIRESTORE_COLLECTION_JOBS` (default: `jobs`)

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
- `embedding`
- `scrapedAt`

The application also stores normalized helper fields for filtering and ranking.

Firestore will prompt you to create composite indexes for some multi-filter queries the first time you run them. Accept the suggested indexes in the Firebase console.

## 4. Run Firecrawl ingestion

```bash
npm run ingest
```

The script will:

- Scrape jobs from Firecrawl
- Normalize job fields for Firestore
- Insert or update jobs into the `jobs` collection
- Generate embeddings per job document

## 5. Start local development

```bash
npm run dev
```

Open `http://localhost:3000`.

## App routes

- `/` keyword search, filters, ranking, and infinite scroll
- `/profile` resume upload and top 10 job matches
- `/jobs/[id]` job detail view
- `/api/searchJobs` GET search API
- `/api/searchMeta` GET filter options API
- `/api/resume/match` POST resume matching API

## Deployment notes

- Keep Firebase service account credentials server-side only.
- Firestore document size limits apply because embeddings are stored on the job document.
- Update Firecrawl field mapping in `src/ingest/firecrawl_ingest.js` if the upstream payload shape differs.
