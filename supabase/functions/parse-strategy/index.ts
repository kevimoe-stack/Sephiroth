import { corsHeaders } from "../_shared/cors.ts";

function extractSymbol(input: string) {
  const match = input.toUpperCase().match(/\b[A-Z]{2,10}(?:USDT|USD|BTC|ETH)\b/);
  return match?.[0] ?? "BTCUSDT";
}

function extractTimeframe(input: string) {
  const match = input.toLowerCase().match(/\b(1m|5m|15m|1h|4h|1d|1w)\b/);
  return match?.[1] ?? "4h";
}

function extractAssetClass(input: string) {
  const normalized = input.toLowerCase();
  if (normalized.includes("forex")) return "forex";
  if (normalized.includes("stock") || normalized.includes("aktie")) return "stocks";
  if (normalized.includes("future")) return "futures";
  return "crypto";
}

function inferName(input: string, symbol: string) {
  const firstSentence = input.split(/[.!?\n]/)[0].trim();
  return firstSentence.length > 4 ? firstSentence.slice(0, 80) : `${symbol} Strategy`;
}

function inferParameters(input: string) {
  const normalized = input.toLowerCase();
  if (normalized.includes("rsi")) return { rsiPeriod: 14, oversold: 30, exitLevel: 55 };
  if (normalized.includes("boll")) return { period: 20, multiplier: 2 };
  if (normalized.includes("macd")) return { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 };
  return { fast: 12, slow: 26 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) throw new Error("prompt is required.");

    if (prompt.startsWith("{")) {
      const parsed = JSON.parse(prompt);
      return Response.json(
        { ok: true, strategy: parsed, source: "json" },
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const symbol = extractSymbol(prompt);
    const timeframe = extractTimeframe(prompt);
    const assetClass = extractAssetClass(prompt);
    const strategy = {
      name: inferName(prompt, symbol),
      symbol,
      timeframe,
      asset_class: assetClass,
      description: prompt,
      parameters: inferParameters(prompt),
      status: "draft",
      is_champion: false,
      tags: prompt
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 3)
        .slice(0, 6),
    };

    return Response.json(
      { ok: true, strategy, source: "heuristic" },
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown parse-strategy error" },
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
