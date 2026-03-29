import { supabase } from "@/integrations/supabase/client";

export interface ResearchConfig {
  strategyId: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  feeRate: number;
  slippageRate: number;
  windows?: number;
}

export async function invokeBacktest(config: ResearchConfig) {
  if (!supabase) {
    throw new Error("Supabase ist noch nicht konfiguriert. Fuer echte Daten bitte VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY setzen.");
  }
  const { data, error } = await supabase.functions.invoke("run-backtest", {
    body: config,
  });
  if (error) throw error;
  return data;
}

export async function invokeWalkforward(config: ResearchConfig) {
  if (!supabase) {
    throw new Error("Supabase ist noch nicht konfiguriert. Fuer echte Daten bitte VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY setzen.");
  }
  const { data, error } = await supabase.functions.invoke("run-walkforward", {
    body: config,
  });
  if (error) throw error;
  return data;
}
