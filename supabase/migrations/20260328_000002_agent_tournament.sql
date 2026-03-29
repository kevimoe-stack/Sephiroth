CREATE TABLE agent_tournament_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  champion_strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  challenger_strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  total_candidates INTEGER DEFAULT 0,
  qualified_candidates INTEGER DEFAULT 0,
  kernel_name TEXT DEFAULT 'capital-preservation-kernel',
  notes JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_tournament_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_run_id UUID REFERENCES agent_tournament_runs(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  health_score NUMERIC,
  readiness_score NUMERIC,
  capital_preservation_score NUMERIC,
  risk_management_score NUMERIC,
  fitness_score NUMERIC,
  passed_kernel BOOLEAN DEFAULT false,
  kernel_reasons JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

SELECT enable_public_rls('agent_tournament_runs');
SELECT enable_public_rls('agent_tournament_entries');
