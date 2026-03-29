CREATE TABLE agent_regime_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'completed',
  symbols_count INTEGER DEFAULT 0,
  summary JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_regime_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regime_run_id UUID REFERENCES agent_regime_runs(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  regime_label TEXT NOT NULL,
  trend_score NUMERIC,
  volatility_score NUMERIC,
  efficiency_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_meta_allocation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regime_run_id UUID REFERENCES agent_regime_runs(id) ON DELETE SET NULL,
  lifecycle_run_id UUID REFERENCES agent_lifecycle_runs(id) ON DELETE SET NULL,
  monitor_run_id UUID REFERENCES agent_monitor_runs(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'proposed',
  reserve_target NUMERIC DEFAULT 0.2,
  summary JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_meta_allocation_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_allocation_run_id UUID REFERENCES agent_meta_allocation_runs(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  current_allocation NUMERIC,
  suggested_allocation NUMERIC,
  role TEXT,
  regime_label TEXT,
  confidence_score NUMERIC,
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

SELECT enable_public_rls('agent_regime_runs');
SELECT enable_public_rls('agent_regime_snapshots');
SELECT enable_public_rls('agent_meta_allocation_runs');
SELECT enable_public_rls('agent_meta_allocation_entries');
