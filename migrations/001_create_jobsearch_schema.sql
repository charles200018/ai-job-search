-- Migration: create jobsearch schema and core tables
-- Run this in Supabase SQL editor or via supabase migrations

-- Enable pgvector extension (cluster-wide)
CREATE EXTENSION IF NOT EXISTS vector;

-- Isolated schema to avoid collisions with existing apps
CREATE SCHEMA IF NOT EXISTS jobsearch;

-- Users table for jobsearch-specific metadata (optional if you use auth.users)
CREATE TABLE IF NOT EXISTS jobsearch.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  name text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- Resumes metadata
CREATE TABLE IF NOT EXISTS jobsearch.resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  parsed jsonb,
  created_at timestamptz DEFAULT now()
);

-- Jobs ingested from Firecrawl (id = external id)
CREATE TABLE IF NOT EXISTS jobsearch.jobs (
  id text PRIMARY KEY,
  title text,
  company text,
  location text,
  remote boolean,
  description text,
  normalized jsonb,
  posted_at timestamptz,
  inserted_at timestamptz DEFAULT now()
);

-- Semantic embeddings for jobs (adjust dim to your model)
CREATE TABLE IF NOT EXISTS jobsearch.job_embeddings (
  job_id text PRIMARY KEY REFERENCES jobsearch.jobs(id),
  embedding vector(1536),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobsearch.resume_embeddings (
  resume_id uuid PRIMARY KEY REFERENCES jobsearch.resumes(id),
  embedding vector(1536),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobsearch.saved_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id text REFERENCES jobsearch.jobs(id),
  created_at timestamptz DEFAULT now()
);
