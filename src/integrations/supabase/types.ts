export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AssetClass = "crypto" | "stocks" | "forex" | "futures";
export type StrategyStatus = "draft" | "active" | "eliminated" | "archived";

export interface Strategy {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  asset_class: AssetClass;
  description: string | null;
  parameters: Record<string, Json> | null;
  status: StrategyStatus;
  is_champion: boolean;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Backtest {
  id: string;
  strategy_id: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  final_capital: number | null;
  total_return: number | null;
  cagr: number | null;
  sharpe_ratio: number | null;
  max_drawdown: number | null;
  win_rate: number | null;
  profit_factor: number | null;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  avg_trade_duration: string | null;
  equity_curve: { date: string; value: number }[];
  monthly_returns: Record<string, number>;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BacktestTrade {
  id: string;
  backtest_id: string;
  direction: string;
  entry_date: string;
  exit_date: string | null;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  pnl: number | null;
  pnl_percent: number | null;
  fees: number;
  notes: string | null;
  created_at: string;
}

export interface WalkforwardResult {
  id: string;
  strategy_id: string;
  window_number: number;
  in_sample_start: string;
  in_sample_end: string;
  out_of_sample_start: string;
  out_of_sample_end: string;
  in_sample_sharpe: number | null;
  in_sample_return: number | null;
  in_sample_max_dd: number | null;
  out_of_sample_sharpe: number | null;
  out_of_sample_return: number | null;
  out_of_sample_max_dd: number | null;
  efficiency_ratio: number | null;
  optimized_params: Record<string, Json> | null;
  passed: boolean | null;
  created_at: string;
}

export interface PaperPortfolio {
  id: string;
  strategy_id: string;
  initial_capital: number;
  current_capital: number;
  peak_capital: number | null;
  is_active: boolean;
  total_pnl: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  max_drawdown: number | null;
  created_at: string;
  updated_at: string;
}

export interface RiskRule {
  id: string;
  strategy_id: string | null;
  is_global: boolean;
  max_position_size: number;
  stop_loss_percent: number;
  take_profit_percent: number;
  max_daily_loss: number;
  trailing_stop_enabled: boolean;
  trailing_stop_percent: number;
  created_at: string;
  updated_at: string;
}

export interface LivePortfolio {
  id: string;
  strategy_id: string;
  exchange: string;
  api_key_name: string | null;
  initial_capital: number;
  current_capital: number;
  is_active: boolean;
  total_pnl: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  max_drawdown: number | null;
  last_signal_check: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiveOrder {
  id: string;
  portfolio_id: string;
  strategy_id: string;
  exchange_order_id: string | null;
  symbol: string;
  side: string;
  order_type: string;
  quantity: number;
  price: number | null;
  filled_price: number | null;
  status: string;
  pnl: number | null;
  fees: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentTournamentRun {
  id: string;
  champion_strategy_id: string | null;
  challenger_strategy_id: string | null;
  total_candidates: number;
  qualified_candidates: number;
  kernel_name: string;
  notes: Json[] | null;
  created_at: string;
}

export interface AgentTournamentEntry {
  id: string;
  tournament_run_id: string;
  strategy_id: string;
  rank: number;
  health_score: number | null;
  readiness_score: number | null;
  capital_preservation_score: number | null;
  risk_management_score: number | null;
  fitness_score: number | null;
  passed_kernel: boolean;
  kernel_reasons: Json[] | null;
  created_at: string;
}

export interface AgentLifecycleRun {
  id: string;
  tournament_run_id: string | null;
  champion_strategy_id: string | null;
  challenger_strategy_id: string | null;
  reserve_allocation: number;
  notes: Json[] | null;
  created_at: string;
}

export interface AgentLifecycleEvent {
  id: string;
  lifecycle_run_id: string;
  strategy_id: string;
  event_type: string;
  severity: string;
  payload: Json;
  created_at: string;
}

export interface AgentAllocation {
  id: string;
  lifecycle_run_id: string;
  strategy_id: string;
  allocation_percent: number;
  role: string;
  rationale: string | null;
  created_at: string;
}

export interface AgentMonitorRun {
  id: string;
  lifecycle_run_id: string | null;
  monitored_agents: number;
  alerts_count: number;
  severe_alerts_count: number;
  summary: Json | null;
  created_at: string;
}

export interface AgentMonitorAlert {
  id: string;
  monitor_run_id: string;
  strategy_id: string;
  alert_type: string;
  severity: string;
  status: string;
  metric_value: number | null;
  threshold_value: number | null;
  message: string | null;
  created_at: string;
}

export interface AgentJobRun {
  id: string;
  job_name: string;
  status: string;
  steps_total: number;
  steps_completed: number;
  summary: Json | null;
  created_at: string;
}

export interface AgentJobStep {
  id: string;
  job_run_id: string;
  step_name: string;
  status: string;
  payload: Json | null;
  created_at: string;
}

export interface AgentSchedulerConfig {
  id: string;
  name: string;
  is_active: boolean;
  cadence_label: string;
  auto_rebalance: boolean;
  severe_alert_threshold: number;
  notes: Json[] | null;
  created_at: string;
  updated_at: string;
}

export interface AgentSchedulerRun {
  id: string;
  config_id: string | null;
  status: string;
  orchestrator_job_run_id: string | null;
  rebalance_run_id: string | null;
  summary: Json | null;
  created_at: string;
}

export interface AgentRebalanceRun {
  id: string;
  monitor_run_id: string | null;
  lifecycle_run_id: string | null;
  status: string;
  reserve_target: number;
  rationale: Json[] | null;
  created_at: string;
}

export interface AgentRebalanceAction {
  id: string;
  rebalance_run_id: string;
  strategy_id: string;
  action_type: string;
  current_allocation: number | null;
  suggested_allocation: number | null;
  reason: string | null;
  created_at: string;
}

export interface AgentRegimeRun {
  id: string;
  status: string;
  symbols_count: number;
  summary: Json | null;
  created_at: string;
}

export interface AgentRegimeSnapshot {
  id: string;
  regime_run_id: string;
  strategy_id: string;
  symbol: string;
  timeframe: string;
  regime_label: string;
  trend_score: number | null;
  volatility_score: number | null;
  efficiency_score: number | null;
  created_at: string;
}

export interface AgentMetaAllocationRun {
  id: string;
  regime_run_id: string | null;
  lifecycle_run_id: string | null;
  monitor_run_id: string | null;
  status: string;
  reserve_target: number;
  summary: Json | null;
  created_at: string;
}

export interface AgentMetaAllocationEntry {
  id: string;
  meta_allocation_run_id: string;
  strategy_id: string;
  current_allocation: number | null;
  suggested_allocation: number | null;
  role: string | null;
  regime_label: string | null;
  confidence_score: number | null;
  rationale: string | null;
  created_at: string;
}
