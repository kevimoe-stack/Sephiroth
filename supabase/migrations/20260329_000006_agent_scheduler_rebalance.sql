CREATE TABLE agent_scheduler_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  cadence_label TEXT DEFAULT 'manual',
  auto_rebalance BOOLEAN DEFAULT false,
  severe_alert_threshold INTEGER DEFAULT 1,
  notes JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_scheduler_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES agent_scheduler_configs(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'completed',
  orchestrator_job_run_id UUID REFERENCES agent_job_runs(id) ON DELETE SET NULL,
  rebalance_run_id UUID,
  summary JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_rebalance_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_run_id UUID REFERENCES agent_monitor_runs(id) ON DELETE SET NULL,
  lifecycle_run_id UUID REFERENCES agent_lifecycle_runs(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'proposed',
  reserve_target NUMERIC DEFAULT 0.2,
  rationale JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_rebalance_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rebalance_run_id UUID REFERENCES agent_rebalance_runs(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  current_allocation NUMERIC,
  suggested_allocation NUMERIC,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

SELECT enable_public_rls('agent_scheduler_configs');
SELECT enable_public_rls('agent_scheduler_runs');
SELECT enable_public_rls('agent_rebalance_runs');
SELECT enable_public_rls('agent_rebalance_actions');

CREATE TRIGGER trg_agent_scheduler_configs_updated
BEFORE UPDATE ON agent_scheduler_configs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO agent_scheduler_configs (name, is_active, cadence_label, auto_rebalance, severe_alert_threshold, notes)
SELECT 'Default Agent Scheduler', true, 'manual', true, 1, '["created-by-migration"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM agent_scheduler_configs);
