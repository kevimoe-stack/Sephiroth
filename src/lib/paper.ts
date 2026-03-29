import { supabase } from "@/integrations/supabase/client";

export interface PaperTradeRequest {
  action: "start" | "check" | "stop";
  strategyId: string;
  initialCapital?: number;
}

export async function invokePaperTrade(request: PaperTradeRequest) {
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert. Für Paper Trading wird eine Edge Function benötigt.");
  }
  const { data, error } = await supabase.functions.invoke("paper-trade", {
    body: request,
  });
  if (error) throw error;
  return data;
}
