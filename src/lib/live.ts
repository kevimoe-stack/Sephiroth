import { supabase } from "@/integrations/supabase/client";

export interface ExecuteTradeRequest {
  action: "start" | "check" | "stop";
  strategyId: string;
  initialCapital?: number;
}

export async function invokeExecuteTrade(request: ExecuteTradeRequest) {
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert. Fuer Execution wird eine Edge Function benoetigt.");
  }
  const { data, error } = await supabase.functions.invoke("execute-trade", {
    body: request,
  });
  if (error) throw error;
  return data;
}
