ALTER TABLE walkforward_results
ADD COLUMN IF NOT EXISTS run_group_id UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS run_start_date DATE,
ADD COLUMN IF NOT EXISTS run_end_date DATE,
ADD COLUMN IF NOT EXISTS initial_capital NUMERIC,
ADD COLUMN IF NOT EXISTS fee_rate NUMERIC,
ADD COLUMN IF NOT EXISTS slippage_rate NUMERIC,
ADD COLUMN IF NOT EXISTS windows_requested INTEGER,
ADD COLUMN IF NOT EXISTS strategy_params_snapshot JSONB DEFAULT '{}'::jsonb;
