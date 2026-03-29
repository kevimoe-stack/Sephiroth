CREATE TABLE agent_lifecycle_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_run_id UUID REFERENCES agent_tournament_runs(id) ON DELETE SET NULL,
  champion_strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  challenger_strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  reserve_allocation NUMERIC DEFAULT 0.2,
  notes JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lifecycle_run_id UUID REFERENCES agent_lifecycle_runs(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lifecycle_run_id UUID REFERENCES agent_lifecycle_runs(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  allocation_percent NUMERIC NOT NULL,
  role TEXT NOT NULL,
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

SELECT enable_public_rls('agent_lifecycle_runs');
SELECT enable_public_rls('agent_lifecycle_events');
SELECT enable_public_rls('agent_allocations');
