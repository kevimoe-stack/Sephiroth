import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFunctions = [
  "run-backtest",
  "run-walkforward",
  "paper-trade",
  "execute-trade",
  "parse-strategy",
  "ai-agent",
  "agent-tournament",
  "agent-lifecycle",
  "agent-monitor",
  "agent-orchestrator",
  "agent-rebalance",
  "agent-scheduler",
  "agent-regime",
  "agent-meta-allocation",
];
const recommendedEnv = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "BINANCE_API_KEY",
  "BINANCE_API_SECRET",
  "TELEGRAM_BOT_TOKEN",
];

const requiredMigrations = [
  "20260327_000001_init.sql",
  "20260328_000002_agent_tournament.sql",
  "20260329_000003_agent_lifecycle.sql",
  "20260329_000004_agent_monitoring.sql",
  "20260329_000005_agent_jobs.sql",
  "20260329_000006_agent_scheduler_rebalance.sql",
  "20260329_000007_agent_regime_meta.sql",
];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function resultLine(label, ok, detail = "") {
  const prefix = ok ? "[OK]" : "[MISSING]";
  return `${prefix} ${label}${detail ? ` - ${detail}` : ""}`;
}

function loadEnvExample() {
  const envPath = path.join(root, ".env.example");
  if (!fs.existsSync(envPath)) return [];
  return fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => line.split("=")[0].trim())
    .filter(Boolean);
}

const lines = [];
lines.push("Sephiroth Production Readiness Check");
lines.push("");
lines.push(resultLine("Frontend app", exists("src/App.tsx")));
lines.push(resultLine("Supabase config", exists("supabase/config.toml")));
lines.push(resultLine(".env.example", exists(".env.example")));
lines.push("");
lines.push("Functions:");
for (const fn of requiredFunctions) {
  lines.push(resultLine(fn, exists(path.join("supabase", "functions", fn, "index.ts"))));
}
lines.push("");
lines.push("Migrations:");
for (const migration of requiredMigrations) {
  lines.push(resultLine(migration, exists(path.join("supabase", "migrations", migration))));
}
lines.push("");
lines.push("Environment Template:");
const documentedEnv = loadEnvExample();
for (const envName of recommendedEnv) {
  lines.push(resultLine(envName, documentedEnv.includes(envName), documentedEnv.includes(envName) ? "documented in .env.example" : "missing from .env.example"));
}
lines.push("");
lines.push("Manual Production Gates:");
lines.push("- Supabase migrations applied");
lines.push("- All Edge Functions deployed");
lines.push("- Secrets set: SUPABASE_SERVICE_ROLE_KEY, BINANCE keys if needed");
lines.push("- Paper trading tested before any live dry-run or live execution");
lines.push("- Scheduler tested manually before cron activation");
lines.push("- Critical monitor alerts resolved before promoting a live champion");
lines.push("- Dry-run execution and then Binance testnet validated before real capital");

console.log(lines.join("\n"));
