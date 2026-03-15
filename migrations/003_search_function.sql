-- Create a SQL function to perform vector nearest-neighbor search over job embeddings
-- This function lives in public schema for easy RPC from Supabase client

CREATE OR REPLACE FUNCTION public.public_search_jobs(query_embedding vector, lim integer)
RETURNS TABLE(job_id text, title text, company text, description text, distance float)
LANGUAGE sql STABLE
AS $$
  SELECT j.id as job_id, j.title, j.company, j.description, (je.embedding <-> query_embedding) as distance
  FROM jobsearch.job_embeddings je
  JOIN jobsearch.jobs j ON j.id = je.job_id
  ORDER BY je.embedding <-> query_embedding
  LIMIT lim;
$$;
