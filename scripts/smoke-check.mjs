import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(root, "supabase", "config.toml");
const config = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";

const expectedFunctions = [
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

const missing = expectedFunctions.filter((name) => !config.includes(`[functions.${name}]`));

console.log("Sephiroth Smoke Check");
console.log("");
console.log(`Functions configured in supabase/config.toml: ${expectedFunctions.length - missing.length}/${expectedFunctions.length}`);
if (missing.length > 0) {
  console.log("Missing function config entries:");
  for (const name of missing) console.log(`- ${name}`);
} else {
  console.log("All expected function config entries are present.");
}
