CREATE TABLE agent_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  steps_total INTEGER DEFAULT 0,
  steps_completed INTEGER DEFAULT 0,
  summary JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_job_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_run_id UUID REFERENCES agent_job_runs(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

SELECT enable_public_rls('agent_job_runs');
SELECT enable_public_rls('agent_job_steps');
