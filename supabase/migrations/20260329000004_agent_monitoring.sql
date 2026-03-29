CREATE TABLE agent_monitor_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lifecycle_run_id UUID REFERENCES agent_lifecycle_runs(id) ON DELETE SET NULL,
  monitored_agents INTEGER DEFAULT 0,
  alerts_count INTEGER DEFAULT 0,
  severe_alerts_count INTEGER DEFAULT 0,
  summary JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_monitor_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_run_id UUID REFERENCES agent_monitor_runs(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  status TEXT DEFAULT 'open',
  metric_value NUMERIC,
  threshold_value NUMERIC,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

SELECT enable_public_rls('agent_monitor_runs');
SELECT enable_public_rls('agent_monitor_alerts');
