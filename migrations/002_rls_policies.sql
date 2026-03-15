-- RLS policies for jobsearch schema (user-owned data)

-- Enable RLS on user-owned tables
ALTER TABLE IF EXISTS jobsearch.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS jobsearch.resume_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS jobsearch.saved_jobs ENABLE ROW LEVEL SECURITY;

-- Allow users to manage only their own resumes
CREATE POLICY IF NOT EXISTS resumes_owner ON jobsearch.resumes
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow resume_embeddings only when resume belongs to user
CREATE POLICY IF NOT EXISTS resume_embeddings_owner ON jobsearch.resume_embeddings
  FOR ALL
  USING (resume_id IN (SELECT id FROM jobsearch.resumes WHERE user_id = auth.uid()));

-- Allow users to manage their saved jobs
CREATE POLICY IF NOT EXISTS saved_jobs_owner ON jobsearch.saved_jobs
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Jobs can be readable publicly (optional). Keep writes restricted to service role.
-- Uncomment to allow public reads:
-- CREATE POLICY jobs_public_read ON jobsearch.jobs FOR SELECT USING (true);
