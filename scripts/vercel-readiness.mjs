import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function line(label, ok, detail = "") {
  const prefix = ok ? "[OK]" : "[MISSING]";
  return `${prefix} ${label}${detail ? ` - ${detail}` : ""}`;
}

const packageJson = readJson("package.json");
const vercelConfig = exists("vercel.json") ? readJson("vercel.json") : null;
const envTemplate = exists(".env.example")
  ? fs
      .readFileSync(path.join(root, ".env.example"), "utf8")
      .split(/\r?\n/)
      .filter((entry) => entry.includes("="))
      .map((entry) => entry.split("=")[0].trim())
  : [];

const requiredEnv = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];

const lines = [];
lines.push("Sephiroth Vercel Readiness Check");
lines.push("");
lines.push(line("package.json", exists("package.json")));
lines.push(line("vite.config.ts", exists("vite.config.ts")));
lines.push(line("vercel.json", exists("vercel.json")));
lines.push(line("build script", packageJson.scripts?.build === "tsc -b && vite build", packageJson.scripts?.build ?? "not configured"));
lines.push(
  line(
    "Vercel output directory",
    vercelConfig?.outputDirectory === "dist",
    vercelConfig?.outputDirectory ?? "not configured",
  ),
);
lines.push(
  line(
    "SPA rewrite",
    Array.isArray(vercelConfig?.rewrites) && vercelConfig.rewrites.length > 0,
    Array.isArray(vercelConfig?.rewrites) ? `${vercelConfig.rewrites.length} rewrite rule(s)` : "missing",
  ),
);
lines.push("");
lines.push("Required Vercel Environment Variables:");
for (const envName of requiredEnv) {
  lines.push(line(envName, envTemplate.includes(envName), envTemplate.includes(envName) ? "documented in .env.example" : "missing from .env.example"));
}
lines.push("");
lines.push("Manual Deploy Gates:");
lines.push("- Import repo into Vercel");
lines.push("- Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel project settings");
lines.push("- Deploy Supabase migrations and Edge Functions before trusting live workflows");
lines.push("- Validate BrowserRouter routes after first deployment");
lines.push("- Run paper trading before enabling any execution workflow");

console.log(lines.join("\n"));
