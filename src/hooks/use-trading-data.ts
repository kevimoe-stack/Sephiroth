import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mockBacktests, mockLivePortfolios, mockPaperPortfolios, mockRiskRules, mockStrategies, mockWalkforward } from "@/lib/mock-data";
import { invokeAgent, parseStrategyPrompt, runAgentMetaAllocation, runAgentOrchestrator, runAgentRebalance, runAgentRegime, runAgentScheduler, runLifecycleSnapshot, runMonitorSnapshot, runTournamentSnapshot } from "@/lib/agent";
import { hasSupabaseEnv, supabase } from "@/integrations/supabase/client";
import { invokeBacktest, invokeWalkforward, type ResearchConfig } from "@/lib/research";
import { invokePaperTrade, type PaperTradeRequest } from "@/lib/paper";
import { invokeExecuteTrade, type ExecuteTradeRequest } from "@/lib/live";
import type { AgentAllocation, AgentJobRun, AgentJobStep, AgentLifecycleEvent, AgentLifecycleRun, AgentMetaAllocationEntry, AgentMetaAllocationRun, AgentMonitorAlert, AgentMonitorRun, AgentRebalanceAction, AgentRebalanceRun, AgentRegimeRun, AgentRegimeSnapshot, AgentSchedulerConfig, AgentSchedulerRun, AgentTournamentEntry, AgentTournamentRun, Backtest, LiveOrder, LivePortfolio, PaperPortfolio, RiskRule, Strategy, WalkforwardResult } from "@/integrations/supabase/types";

const keys = {
  strategies: ["strategies"] as const,
  backtests: ["backtests"] as const,
  walkforward: ["walkforward"] as const,
  paper: ["paper-portfolios"] as const,
  risk: ["risk-rules"] as const,
  live: ["live-portfolios"] as const,
  liveOrders: ["live-orders"] as const,
  tournaments: ["agent-tournament-runs"] as const,
  tournamentEntries: ["agent-tournament-entries"] as const,
  lifecycleRuns: ["agent-lifecycle-runs"] as const,
  lifecycleEvents: ["agent-lifecycle-events"] as const,
  allocations: ["agent-allocations"] as const,
  monitorRuns: ["agent-monitor-runs"] as const,
  monitorAlerts: ["agent-monitor-alerts"] as const,
  jobRuns: ["agent-job-runs"] as const,
  jobSteps: ["agent-job-steps"] as const,
  schedulerConfigs: ["agent-scheduler-configs"] as const,
  schedulerRuns: ["agent-scheduler-runs"] as const,
  rebalanceRuns: ["agent-rebalance-runs"] as const,
  rebalanceActions: ["agent-rebalance-actions"] as const,
  regimeRuns: ["agent-regime-runs"] as const,
  regimeSnapshots: ["agent-regime-snapshots"] as const,
  metaAllocationRuns: ["agent-meta-allocation-runs"] as const,
  metaAllocationEntries: ["agent-meta-allocation-entries"] as const,
};

async function fetchStrategies() {
  if (!hasSupabaseEnv || !supabase) return mockStrategies.filter((s) => s.status !== "eliminated");
  const { data, error } = await supabase.from("strategies").select("*").neq("status", "eliminated").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Strategy[];
}

async function fetchBacktests() {
  if (!hasSupabaseEnv || !supabase) return mockBacktests;
  const { data, error } = await supabase.from("backtests").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Backtest[];
}

async function fetchWalkforwardResults() {
  if (!hasSupabaseEnv || !supabase) return mockWalkforward;
  const { data, error } = await supabase.from("walkforward_results").select("*").order("window_number", { ascending: true });
  if (error) throw error;
  return data as WalkforwardResult[];
}

async function fetchPaperPortfolios() {
  if (!hasSupabaseEnv || !supabase) return mockPaperPortfolios;
  const { data, error } = await supabase.from("paper_portfolio").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return data as PaperPortfolio[];
}

async function fetchRiskRules() {
  if (!hasSupabaseEnv || !supabase) return mockRiskRules;
  const { data, error } = await supabase.from("risk_rules").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return data as RiskRule[];
}

async function fetchLivePortfolios() {
  if (!hasSupabaseEnv || !supabase) return mockLivePortfolios;
  const { data, error } = await supabase.from("live_portfolios").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return data as LivePortfolio[];
}

async function fetchLiveOrders() {
  if (!hasSupabaseEnv || !supabase) return [];
  const { data, error } = await supabase.from("live_orders").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as LiveOrder[];
}

async function fetchTournamentRuns() {
  if (!hasSupabaseEnv || !supabase) return [];
  const { data, error } = await supabase.from("agent_tournament_runs").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as AgentTournamentRun[];
}

async function fetchTournamentEntries() {
  if (!hasSupabaseEnv || !supabase) return [];
  const { data, error } = await supabase.from("agent_tournament_entries").select("*").order("rank", { ascending: true });
  if (error) throw error;
  return data as AgentTournamentEntry[];
}

async function fetchLifecycleRuns() {
  if (!hasSupabaseEnv || !supabase) return [];
  const { data, error } = await supabase.from("agent_lifecycle_runs").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as AgentLifecycleRun[];
}

async function fetchLifecycleEvents() {
  if (!hasSupabaseEnv || !supabase) return [];
  const { data, error } = await supabase.from("agent_lifecycle_events").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as AgentLifecycleEvent[];
}

async function fetchAllocations() {
  if (!hasSupabaseEnv || !supabase) return [];
  const { data, error } = await supabase.from("agent_allocations").select("*").order("allocation_percent", { ascending: false });
  if (error) throw error;
  return data as AgentAllocation[];
}

async function fetchMonitorRuns() {
  if (!hasSupabaseEnv || !supabase) return [];
  const { data, error } = await supabase.from("agent_monitor_runs").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as AgentMonitorRun[];
}

async function fetchMonitorAlerts() {
  if (!hasSupabaseEnv || !supabase) return [];
  const { data, error } = await supabase.from("agent_monitor_alerts").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as AgentMonitorAlert[];
}

async function fetchJobRuns() {
  if (!hasSupabaseEnv || !supabase) return [];
  const { data, error } = await supabase.from("agent_job_runs").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as AgentJobRun[];
}

async function fetchJobSteps() {
  if (!hasSupabaseEnv || !supabase) return [];
  const { data, error } = await supabase.from("agent_job_steps").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as AgentJobStep[];
}

async function fetchSchedulerConfigs() {
  if (!hasSupabaseEnv || !supabase) return [];
  const { data, error } = await supabase.from("agent_scheduler_configs").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as AgentSchedulerConfig[];
}

async function fetchSchedulerRuns() {
  if (!hasSupabaseEnv || !supabase) return [];
  const { data, error } = await supabase.from("agent_scheduler_runs").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as AgentSchedulerRun[];
}

async function fetchRebalanceRuns() {
  if (!hasSupabaseEnv || !supabase) return [];
  const { data, error } = await supabase.from("agent_rebalance_runs").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as AgentRebalanceRun[];
}

async function fetchRebalanceActions() {
  if (!hasSupabaseEnv || !supabase) return [];
  const { data, error } = await supabase.from("agent_rebalance_actions").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as AgentRebalanceAction[];
}

async function fetchRegimeRuns() {
  if (!hasSupabaseEnv || !supabase) return [];
  const { data, error } = await supabase.from("agent_regime_runs").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as AgentRegimeRun[];
}

async function fetchRegimeSnapshots() {
  if (!hasSupabaseEnv || !supabase) return [];
  const { data, error } = await supabase.from("agent_regime_snapshots").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as AgentRegimeSnapshot[];
}

async function fetchMetaAllocationRuns() {
  if (!hasSupabaseEnv || !supabase) return [];
  const { data, error } = await supabase.from("agent_meta_allocation_runs").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as AgentMetaAllocationRun[];
}

async function fetchMetaAllocationEntries() {
  if (!hasSupabaseEnv || !supabase) return [];
  const { data, error } = await supabase.from("agent_meta_allocation_entries").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as AgentMetaAllocationEntry[];
}

export function useStrategies() {
  return useQuery({ queryKey: keys.strategies, queryFn: fetchStrategies });
}

export function useBacktests() {
  return useQuery({ queryKey: keys.backtests, queryFn: fetchBacktests });
}

export function useWalkforwardResults() {
  return useQuery({ queryKey: keys.walkforward, queryFn: fetchWalkforwardResults });
}

export function usePaperPortfolios() {
  return useQuery({ queryKey: keys.paper, queryFn: fetchPaperPortfolios });
}

export function useRiskRules() {
  return useQuery({ queryKey: keys.risk, queryFn: fetchRiskRules });
}

export function useLivePortfolios() {
  return useQuery({ queryKey: keys.live, queryFn: fetchLivePortfolios });
}

export function useLiveOrders() {
  return useQuery({ queryKey: keys.liveOrders, queryFn: fetchLiveOrders });
}

export function useRecentLiveOrders(limit = 10) {
  return useQuery({
    queryKey: [...keys.liveOrders, "recent", limit],
    queryFn: async () => {
      const orders = await fetchLiveOrders();
      return orders.slice(0, limit);
    },
  });
}

export function useTournamentRuns() {
  return useQuery({ queryKey: keys.tournaments, queryFn: fetchTournamentRuns });
}

export function useTournamentEntries() {
  return useQuery({ queryKey: keys.tournamentEntries, queryFn: fetchTournamentEntries });
}

export function useLifecycleRuns() {
  return useQuery({ queryKey: keys.lifecycleRuns, queryFn: fetchLifecycleRuns });
}

export function useLifecycleEvents() {
  return useQuery({ queryKey: keys.lifecycleEvents, queryFn: fetchLifecycleEvents });
}

export function useAllocations() {
  return useQuery({ queryKey: keys.allocations, queryFn: fetchAllocations });
}

export function useMonitorRuns() {
  return useQuery({ queryKey: keys.monitorRuns, queryFn: fetchMonitorRuns });
}

export function useMonitorAlerts() {
  return useQuery({ queryKey: keys.monitorAlerts, queryFn: fetchMonitorAlerts });
}

export function useJobRuns() {
  return useQuery({ queryKey: keys.jobRuns, queryFn: fetchJobRuns });
}

export function useJobSteps() {
  return useQuery({ queryKey: keys.jobSteps, queryFn: fetchJobSteps });
}

export function useSchedulerConfigs() {
  return useQuery({ queryKey: keys.schedulerConfigs, queryFn: fetchSchedulerConfigs });
}

export function useSchedulerRuns() {
  return useQuery({ queryKey: keys.schedulerRuns, queryFn: fetchSchedulerRuns });
}

export function useRebalanceRuns() {
  return useQuery({ queryKey: keys.rebalanceRuns, queryFn: fetchRebalanceRuns });
}

export function useRebalanceActions() {
  return useQuery({ queryKey: keys.rebalanceActions, queryFn: fetchRebalanceActions });
}

export function useRegimeRuns() {
  return useQuery({ queryKey: keys.regimeRuns, queryFn: fetchRegimeRuns });
}

export function useRegimeSnapshots() {
  return useQuery({ queryKey: keys.regimeSnapshots, queryFn: fetchRegimeSnapshots });
}

export function useMetaAllocationRuns() {
  return useQuery({ queryKey: keys.metaAllocationRuns, queryFn: fetchMetaAllocationRuns });
}

export function useMetaAllocationEntries() {
  return useQuery({ queryKey: keys.metaAllocationEntries, queryFn: fetchMetaAllocationEntries });
}

export function useCreateStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Strategy>) => {
      if (!hasSupabaseEnv || !supabase) return payload;
      const { data, error } = await supabase.from("strategies").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.strategies }),
  });
}

export function useUpdateStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Strategy> & { id: string }) => {
      if (!hasSupabaseEnv || !supabase) return payload;
      const { data, error } = await supabase.from("strategies").update(payload).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.strategies }),
  });
}

export function useDeleteStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!hasSupabaseEnv || !supabase) return id;
      const { error } = await supabase.from("strategies").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.strategies }),
  });
}

export function useRunBacktest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ResearchConfig) => invokeBacktest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.backtests });
      queryClient.invalidateQueries({ queryKey: keys.strategies });
    },
  });
}

export function useRunWalkforward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ResearchConfig) => invokeWalkforward(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.walkforward }),
  });
}

export function useParseStrategy() {
  return useMutation({
    mutationFn: async (prompt: string) => parseStrategyPrompt(prompt),
  });
}

export function useAgentAnalyze() {
  return useMutation({
    mutationFn: async (strategyId: string) => invokeAgent({ action: "analyze", strategyId }),
  });
}

export function useAgentOptimize() {
  return useMutation({
    mutationFn: async (strategyId: string) => invokeAgent({ action: "optimize", strategyId }),
  });
}

export function useAgentCreateVariant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (strategyId: string) => invokeAgent({ action: "create-variant", strategyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.strategies });
    },
  });
}

export function useAgentCreateVariantPack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (strategyId: string) => invokeAgent({ action: "create-variant-pack", strategyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.strategies });
    },
  });
}

export function useAgentBulkAnalyze() {
  return useMutation({
    mutationFn: async () => invokeAgent({ action: "bulk-analyze" }),
  });
}

export function useRunTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => runTournamentSnapshot(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.tournaments });
      queryClient.invalidateQueries({ queryKey: keys.tournamentEntries });
      queryClient.invalidateQueries({ queryKey: keys.strategies });
    },
  });
}

export function useRunLifecycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => runLifecycleSnapshot(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.lifecycleRuns });
      queryClient.invalidateQueries({ queryKey: keys.lifecycleEvents });
      queryClient.invalidateQueries({ queryKey: keys.allocations });
    },
  });
}

export function useRunMonitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => runMonitorSnapshot(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.monitorRuns });
      queryClient.invalidateQueries({ queryKey: keys.monitorAlerts });
    },
  });
}

export function useRunOrchestrator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => runAgentOrchestrator(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.jobRuns });
      queryClient.invalidateQueries({ queryKey: keys.jobSteps });
      queryClient.invalidateQueries({ queryKey: keys.tournaments });
      queryClient.invalidateQueries({ queryKey: keys.tournamentEntries });
      queryClient.invalidateQueries({ queryKey: keys.lifecycleRuns });
      queryClient.invalidateQueries({ queryKey: keys.lifecycleEvents });
      queryClient.invalidateQueries({ queryKey: keys.allocations });
      queryClient.invalidateQueries({ queryKey: keys.monitorRuns });
      queryClient.invalidateQueries({ queryKey: keys.monitorAlerts });
      queryClient.invalidateQueries({ queryKey: keys.regimeRuns });
      queryClient.invalidateQueries({ queryKey: keys.regimeSnapshots });
      queryClient.invalidateQueries({ queryKey: keys.metaAllocationRuns });
      queryClient.invalidateQueries({ queryKey: keys.metaAllocationEntries });
      queryClient.invalidateQueries({ queryKey: keys.strategies });
    },
  });
}

export function useRunScheduler() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => runAgentScheduler(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.schedulerRuns });
      queryClient.invalidateQueries({ queryKey: keys.jobRuns });
      queryClient.invalidateQueries({ queryKey: keys.jobSteps });
      queryClient.invalidateQueries({ queryKey: keys.rebalanceRuns });
      queryClient.invalidateQueries({ queryKey: keys.rebalanceActions });
      queryClient.invalidateQueries({ queryKey: keys.monitorRuns });
      queryClient.invalidateQueries({ queryKey: keys.monitorAlerts });
      queryClient.invalidateQueries({ queryKey: keys.regimeRuns });
      queryClient.invalidateQueries({ queryKey: keys.regimeSnapshots });
      queryClient.invalidateQueries({ queryKey: keys.metaAllocationRuns });
      queryClient.invalidateQueries({ queryKey: keys.metaAllocationEntries });
    },
  });
}

export function useRunRebalance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => runAgentRebalance(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.rebalanceRuns });
      queryClient.invalidateQueries({ queryKey: keys.rebalanceActions });
      queryClient.invalidateQueries({ queryKey: keys.allocations });
    },
  });
}

export function useRunRegime() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => runAgentRegime(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.regimeRuns });
      queryClient.invalidateQueries({ queryKey: keys.regimeSnapshots });
    },
  });
}

export function useRunMetaAllocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => runAgentMetaAllocation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.metaAllocationRuns });
      queryClient.invalidateQueries({ queryKey: keys.metaAllocationEntries });
    },
  });
}

export function usePaperTradeAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PaperTradeRequest) => invokePaperTrade(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.paper });
    },
  });
}

export function useExecuteTradeAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ExecuteTradeRequest) => invokeExecuteTrade(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.live });
      queryClient.invalidateQueries({ queryKey: keys.liveOrders });
    },
  });
}
