import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const body = await req.json();
  return Response.json({ ok: true, function: "telegram-bot", message: "Scaffold bereit für Telegram-Webhook und Strategie-Erstellung.", input: body }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
