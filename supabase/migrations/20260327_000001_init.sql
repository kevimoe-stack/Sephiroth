CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.asset_class AS ENUM ('crypto', 'stocks', 'forex', 'futures');

CREATE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  timeframe TEXT DEFAULT '1d',
  asset_class asset_class DEFAULT 'crypto',
  description TEXT,
  parameters JSONB,
  status TEXT DEFAULT 'draft',
  is_champion BOOLEAN DEFAULT false,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE backtests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  initial_capital NUMERIC DEFAULT 10000,
  final_capital NUMERIC,
  total_return NUMERIC,
  cagr NUMERIC,
  sharpe_ratio NUMERIC,
  max_drawdown NUMERIC,
  win_rate NUMERIC,
  profit_factor NUMERIC,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  avg_trade_duration TEXT,
  equity_curve JSONB DEFAULT '[]',
  monthly_returns JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE backtest_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backtest_id UUID REFERENCES backtests(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  entry_date TIMESTAMPTZ NOT NULL,
  exit_date TIMESTAMPTZ,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  quantity NUMERIC NOT NULL,
  pnl NUMERIC,
  pnl_percent NUMERIC,
  fees NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE walkforward_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  window_number INTEGER NOT NULL,
  in_sample_start DATE NOT NULL,
  in_sample_end DATE NOT NULL,
  out_of_sample_start DATE NOT NULL,
  out_of_sample_end DATE NOT NULL,
  in_sample_sharpe NUMERIC,
  in_sample_return NUMERIC,
  in_sample_max_dd NUMERIC,
  out_of_sample_sharpe NUMERIC,
  out_of_sample_return NUMERIC,
  out_of_sample_max_dd NUMERIC,
  efficiency_ratio NUMERIC,
  optimized_params JSONB,
  passed BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE paper_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  initial_capital NUMERIC DEFAULT 10000,
  current_capital NUMERIC DEFAULT 10000,
  peak_capital NUMERIC,
  is_active BOOLEAN DEFAULT true,
  total_pnl NUMERIC DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  max_drawdown NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE paper_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  price NUMERIC NOT NULL,
  indicator_values JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE paper_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES paper_signals(id),
  symbol TEXT NOT NULL,
  direction TEXT DEFAULT 'long',
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  quantity NUMERIC NOT NULL,
  entry_date TIMESTAMPTZ DEFAULT now(),
  exit_date TIMESTAMPTZ,
  status TEXT DEFAULT 'open',
  pnl NUMERIC,
  pnl_percent NUMERIC,
  fees NUMERIC,
  slippage NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE paper_equity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES paper_portfolio(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  snapshot_date TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE risk_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id),
  is_global BOOLEAN DEFAULT false,
  max_position_size NUMERIC DEFAULT 0.1,
  stop_loss_percent NUMERIC DEFAULT 0.02,
  take_profit_percent NUMERIC DEFAULT 0.04,
  max_daily_loss NUMERIC DEFAULT 0.05,
  trailing_stop_enabled BOOLEAN DEFAULT false,
  trailing_stop_percent NUMERIC DEFAULT 0.015,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE live_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  exchange TEXT DEFAULT 'binance',
  api_key_name TEXT,
  initial_capital NUMERIC DEFAULT 1000,
  current_capital NUMERIC DEFAULT 1000,
  is_active BOOLEAN DEFAULT false,
  total_pnl NUMERIC DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  max_drawdown NUMERIC,
  last_signal_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE live_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES live_portfolios(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  exchange_order_id TEXT,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  order_type TEXT DEFAULT 'market',
  quantity NUMERIC NOT NULL,
  price NUMERIC,
  filled_price NUMERIC,
  status TEXT DEFAULT 'pending',
  pnl NUMERIC,
  fees NUMERIC DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION enable_public_rls(table_name text) RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('CREATE POLICY "public all" ON %I FOR ALL USING (true) WITH CHECK (true)', table_name);
END; $$ LANGUAGE plpgsql;

SELECT enable_public_rls('strategies');
SELECT enable_public_rls('backtests');
SELECT enable_public_rls('backtest_trades');
SELECT enable_public_rls('walkforward_results');
SELECT enable_public_rls('paper_portfolio');
SELECT enable_public_rls('paper_signals');
SELECT enable_public_rls('paper_positions');
SELECT enable_public_rls('paper_equity_snapshots');
SELECT enable_public_rls('risk_rules');
SELECT enable_public_rls('live_portfolios');
SELECT enable_public_rls('live_orders');

CREATE TRIGGER trg_strategies_updated BEFORE UPDATE ON strategies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_backtests_updated BEFORE UPDATE ON backtests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_paper_portfolio_updated BEFORE UPDATE ON paper_portfolio FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_risk_rules_updated BEFORE UPDATE ON risk_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_live_portfolios_updated BEFORE UPDATE ON live_portfolios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_live_orders_updated BEFORE UPDATE ON live_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
