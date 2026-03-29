import { supabase } from "@/integrations/supabase/client";

export interface AgentAnalyzeRequest {
  action: "analyze" | "optimize" | "bulk-analyze" | "create-variant";
  strategyId?: string;
}

export async function invokeAgent(request: AgentAnalyzeRequest) {
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert. Fuer Agent-Analysen werden Edge Functions benoetigt.");
  }
  const { data, error } = await supabase.functions.invoke("ai-agent", {
    body: request,
  });
  if (error) throw error;
  return data;
}

export async function parseStrategyPrompt(prompt: string) {
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert. Fuer Strategy Parsing werden Edge Functions benoetigt.");
  }
  const { data, error } = await supabase.functions.invoke("parse-strategy", {
    body: { prompt },
  });
  if (error) throw error;
  return data;
}

export async function runTournamentSnapshot() {
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert. Fuer Tournament-Runs werden Edge Functions benoetigt.");
  }
  const { data, error } = await supabase.functions.invoke("agent-tournament");
  if (error) throw error;
  return data;
}

export async function runLifecycleSnapshot() {
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert. Fuer Lifecycle-Runs werden Edge Functions benoetigt.");
  }
  const { data, error } = await supabase.functions.invoke("agent-lifecycle");
  if (error) throw error;
  return data;
}

export async function runMonitorSnapshot() {
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert. Fuer Monitor-Runs werden Edge Functions benoetigt.");
  }
  const { data, error } = await supabase.functions.invoke("agent-monitor");
  if (error) throw error;
  return data;
}

export async function runAgentOrchestrator() {
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert. Fuer den Agent-Loop wird eine Edge Function benoetigt.");
  }
  const { data, error } = await supabase.functions.invoke("agent-orchestrator");
  if (error) throw error;
  return data;
}

export async function runAgentScheduler() {
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert. Fuer den Scheduler wird eine Edge Function benoetigt.");
  }
  const { data, error } = await supabase.functions.invoke("agent-scheduler");
  if (error) throw error;
  return data;
}

export async function runAgentRebalance() {
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert. Fuer Rebalance wird eine Edge Function benoetigt.");
  }
  const { data, error } = await supabase.functions.invoke("agent-rebalance");
  if (error) throw error;
  return data;
}

export async function runAgentRegime() {
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert. Fuer Regime-Analyse wird eine Edge Function benoetigt.");
  }
  const { data, error } = await supabase.functions.invoke("agent-regime");
  if (error) throw error;
  return data;
}

export async function runAgentMetaAllocation() {
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert. Fuer Meta-Allokation wird eine Edge Function benoetigt.");
  }
  const { data, error } = await supabase.functions.invoke("agent-meta-allocation");
  if (error) throw error;
  return data;
}
