from pathlib import Path
root = Path('/mnt/data/sephiroth')
files = {
'package.json': '''{
  "name": "sephiroth-trading-platform",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@supabase/supabase-js": "^2.57.4",
    "@tanstack/react-query": "^5.90.21",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.511.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.56.4",
    "react-router-dom": "^6.30.1",
    "recharts": "^3.2.1",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.3.1",
    "zod": "^3.25.67"
  },
  "devDependencies": {
    "@types/node": "^24.5.2",
    "@types/react": "^18.3.24",
    "@types/react-dom": "^18.3.7",
    "@vitejs/plugin-react": "^5.0.4",
    "autoprefixer": "^10.4.21",
    "postcss": "^8.5.6",
    "tailwindcss": "^3.4.17",
    "tailwindcss-animate": "^1.0.7",
    "typescript": "^5.9.2",
    "vite": "^7.1.7"
  }
}
''',
'index.html': '''<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sephiroth Trading Platform</title>
    <meta name="description" content="Research, Validation, Execution und Agent Layer für Trading-Strategien" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
''',
'.env.example': '''VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_OPENAI_BASE_URL=https://api.openai.com/v1
VITE_OPENAI_API_KEY=
''',
'vite.config.ts': '''import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
''',
'postcss.config.js': '''export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
''',
'tailwind.config.ts': '''import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        primary: "hsl(var(--primary))",
        secondary: "hsl(var(--secondary))",
        muted: "hsl(var(--muted))",
        accent: "hsl(var(--accent))",
        destructive: "hsl(var(--destructive))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        sidebar: "hsl(var(--sidebar))",
        chart: {
          up: "hsl(var(--chart-up))",
          down: "hsl(var(--chart-down))",
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      boxShadow: {
        soft: "0 10px 30px rgba(10, 14, 35, 0.08)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
''',
'tsconfig.json': '''{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
''',
'tsconfig.app.json': '''{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
''',
'tsconfig.node.json': '''{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "tailwind.config.ts"]
}
''',
'src/vite-env.d.ts': '/// <reference types="vite/client" />\n',
'src/lib/utils.ts': '''import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPercent(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "–";
  return `${value.toFixed(2)}%`;
}

export function formatNumber(value?: number | null, digits = 2) {
  if (value === undefined || value === null || Number.isNaN(value)) return "–";
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatCurrency(value?: number | null, currency = "USD") {
  if (value === undefined || value === null || Number.isNaN(value)) return "–";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
''',
'src/integrations/supabase/types.ts': '''export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AssetClass = "crypto" | "stocks" | "forex" | "futures";
export type StrategyStatus = "draft" | "active" | "eliminated" | "archived";

export interface Strategy {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  asset_class: AssetClass;
  description: string | null;
  parameters: Record<string, Json> | null;
  status: StrategyStatus;
  is_champion: boolean;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Backtest {
  id: string;
  strategy_id: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  final_capital: number | null;
  total_return: number | null;
  cagr: number | null;
  sharpe_ratio: number | null;
  max_drawdown: number | null;
  win_rate: number | null;
  profit_factor: number | null;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  avg_trade_duration: string | null;
  equity_curve: { date: string; value: number }[];
  monthly_returns: Record<string, number>;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface WalkforwardResult {
  id: string;
  strategy_id: string;
  window_number: number;
  in_sample_start: string;
  in_sample_end: string;
  out_of_sample_start: string;
  out_of_sample_end: string;
  in_sample_sharpe: number | null;
  in_sample_return: number | null;
  in_sample_max_dd: number | null;
  out_of_sample_sharpe: number | null;
  out_of_sample_return: number | null;
  out_of_sample_max_dd: number | null;
  efficiency_ratio: number | null;
  optimized_params: Record<string, Json> | null;
  passed: boolean | null;
  created_at: string;
}

export interface PaperPortfolio {
  id: string;
  strategy_id: string;
  initial_capital: number;
  current_capital: number;
  peak_capital: number | null;
  is_active: boolean;
  total_pnl: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  max_drawdown: number | null;
  created_at: string;
  updated_at: string;
}

export interface RiskRule {
  id: string;
  strategy_id: string | null;
  is_global: boolean;
  max_position_size: number;
  stop_loss_percent: number;
  take_profit_percent: number;
  max_daily_loss: number;
  trailing_stop_enabled: boolean;
  trailing_stop_percent: number;
  created_at: string;
  updated_at: string;
}

export interface LivePortfolio {
  id: string;
  strategy_id: string;
  exchange: string;
  api_key_name: string | null;
  initial_capital: number;
  current_capital: number;
  is_active: boolean;
  total_pnl: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  max_drawdown: number | null;
  last_signal_check: string | null;
  created_at: string;
  updated_at: string;
}
''',
'src/integrations/supabase/client.ts': '''import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseEnv
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
''',
'src/lib/mock-data.ts': '''import type { Backtest, LivePortfolio, PaperPortfolio, RiskRule, Strategy, WalkforwardResult } from "@/integrations/supabase/types";

const now = new Date().toISOString();

export const mockStrategies: Strategy[] = [
  {
    id: "s1",
    name: "BTC EMA Trend Rider",
    symbol: "BTCUSDT",
    timeframe: "4h",
    asset_class: "crypto",
    description: "Trendfolge mit EMA Crossover und ATR Stop.",
    parameters: { fast: 21, slow: 55, atr: 14 },
    status: "active",
    is_champion: true,
    tags: ["trend", "ema", "btc"],
    created_at: now,
    updated_at: now,
  },
  {
    id: "s2",
    name: "ETH RSI Mean Reversion",
    symbol: "ETHUSDT",
    timeframe: "1h",
    asset_class: "crypto",
    description: "RSI-basierte Reversion in Seitwärtsphasen.",
    parameters: { rsiPeriod: 14, oversold: 28, overbought: 72 },
    status: "active",
    is_champion: false,
    tags: ["mean-reversion", "rsi", "eth"],
    created_at: now,
    updated_at: now,
  },
  {
    id: "s3",
    name: "SOL Donchian Breakout",
    symbol: "SOLUSDT",
    timeframe: "1d",
    asset_class: "crypto",
    description: "Breakout über Donchian Channels mit Volumenfilter.",
    parameters: { channel: 20, volumeMultiplier: 1.5 },
    status: "draft",
    is_champion: false,
    tags: ["breakout", "donchian", "sol"],
    created_at: now,
    updated_at: now,
  },
];

export const mockBacktests: Backtest[] = [
  {
    id: "b1",
    strategy_id: "s1",
    start_date: "2023-01-01",
    end_date: "2025-12-31",
    initial_capital: 10000,
    final_capital: 18450,
    total_return: 84.5,
    cagr: 23.3,
    sharpe_ratio: 1.84,
    max_drawdown: -16.2,
    win_rate: 47.8,
    profit_factor: 1.93,
    total_trades: 68,
    winning_trades: 33,
    losing_trades: 35,
    avg_trade_duration: "3.4 Tage",
    equity_curve: [
      { date: "2025-01", value: 12000 },
      { date: "2025-03", value: 13500 },
      { date: "2025-06", value: 14900 },
      { date: "2025-09", value: 16050 },
      { date: "2025-12", value: 18450 },
    ],
    monthly_returns: { Jan: 4.2, Feb: 1.1, Mar: 3.4 },
    status: "completed",
    created_at: now,
    updated_at: now,
  },
  {
    id: "b2",
    strategy_id: "s2",
    start_date: "2023-01-01",
    end_date: "2025-12-31",
    initial_capital: 10000,
    final_capital: 15100,
    total_return: 51,
    cagr: 15.1,
    sharpe_ratio: 1.21,
    max_drawdown: -12.9,
    win_rate: 56.4,
    profit_factor: 1.41,
    total_trades: 124,
    winning_trades: 70,
    losing_trades: 54,
    avg_trade_duration: "18h",
    equity_curve: [
      { date: "2025-01", value: 11100 },
      { date: "2025-03", value: 11800 },
      { date: "2025-06", value: 12900 },
      { date: "2025-09", value: 14000 },
      { date: "2025-12", value: 15100 },
    ],
    monthly_returns: { Jan: 2.1, Feb: -0.4, Mar: 3.0 },
    status: "completed",
    created_at: now,
    updated_at: now,
  },
];

export const mockWalkforward: WalkforwardResult[] = [
  {
    id: "w1",
    strategy_id: "s1",
    window_number: 1,
    in_sample_start: "2023-01-01",
    in_sample_end: "2024-06-30",
    out_of_sample_start: "2024-07-01",
    out_of_sample_end: "2024-12-31",
    in_sample_sharpe: 1.9,
    in_sample_return: 42,
    in_sample_max_dd: -11,
    out_of_sample_sharpe: 1.4,
    out_of_sample_return: 16,
    out_of_sample_max_dd: -8,
    efficiency_ratio: 0.74,
    optimized_params: { fast: 20, slow: 55 },
    passed: true,
    created_at: now,
  },
  {
    id: "w2",
    strategy_id: "s1",
    window_number: 2,
    in_sample_start: "2023-07-01",
    in_sample_end: "2024-12-31",
    out_of_sample_start: "2025-01-01",
    out_of_sample_end: "2025-06-30",
    in_sample_sharpe: 1.7,
    in_sample_return: 38,
    in_sample_max_dd: -14,
    out_of_sample_sharpe: 1.1,
    out_of_sample_return: 10,
    out_of_sample_max_dd: -9,
    efficiency_ratio: 0.65,
    optimized_params: { fast: 21, slow: 55 },
    passed: true,
    created_at: now,
  },
];

export const mockPaperPortfolios: PaperPortfolio[] = [
  {
    id: "p1",
    strategy_id: "s1",
    initial_capital: 10000,
    current_capital: 10420,
    peak_capital: 10640,
    is_active: true,
    total_pnl: 420,
    total_trades: 12,
    winning_trades: 7,
    losing_trades: 5,
    max_drawdown: -4.3,
    created_at: now,
    updated_at: now,
  },
];

export const mockRiskRules: RiskRule[] = [
  {
    id: "r1",
    strategy_id: null,
    is_global: true,
    max_position_size: 0.1,
    stop_loss_percent: 0.02,
    take_profit_percent: 0.04,
    max_daily_loss: 0.05,
    trailing_stop_enabled: true,
    trailing_stop_percent: 0.015,
    created_at: now,
    updated_at: now,
  },
];

export const mockLivePortfolios: LivePortfolio[] = [
  {
    id: "l1",
    strategy_id: "s1",
    exchange: "binance",
    api_key_name: "main-binance",
    initial_capital: 1000,
    current_capital: 1028,
    is_active: false,
    total_pnl: 28,
    total_trades: 4,
    winning_trades: 3,
    losing_trades: 1,
    max_drawdown: -2.5,
    last_signal_check: now,
    created_at: now,
    updated_at: now,
  },
];
''',
'src/hooks/use-trading-data.ts': '''import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mockBacktests, mockLivePortfolios, mockPaperPortfolios, mockRiskRules, mockStrategies, mockWalkforward } from "@/lib/mock-data";
import { hasSupabaseEnv, supabase } from "@/integrations/supabase/client";
import type { Backtest, LivePortfolio, PaperPortfolio, RiskRule, Strategy, WalkforwardResult } from "@/integrations/supabase/types";

const keys = {
  strategies: ["strategies"] as const,
  backtests: ["backtests"] as const,
  walkforward: ["walkforward"] as const,
  paper: ["paper-portfolios"] as const,
  risk: ["risk-rules"] as const,
  live: ["live-portfolios"] as const,
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
''',
'src/components/ui/button.tsx': '''import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive";
type ButtonSize = "default" | "sm" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-primary text-white hover:opacity-90",
  secondary: "bg-secondary text-foreground hover:bg-secondary/80",
  outline: "border border-border bg-transparent hover:bg-muted",
  ghost: "bg-transparent hover:bg-muted",
  destructive: "bg-destructive text-white hover:opacity-90",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-9 px-3 text-sm",
  lg: "h-11 px-6 text-base",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
''',
'src/components/ui/card.tsx': '''import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-border bg-card shadow-soft", className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-slate-500", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}
''',
'src/components/ui/input.tsx': '''import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn("flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-primary", className)}
      {...props}
    />
  ),
);
Input.displayName = "Input";
''',
'src/components/ui/textarea.tsx': '''import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn("flex min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-primary", className)}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
''',
'src/components/ui/badge.tsx': '''import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  default: "bg-primary/10 text-primary",
  secondary: "bg-secondary text-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  outline: "border border-border bg-transparent text-foreground",
};

export function Badge({ className, children, ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants }) {
  const variant = (props as { variant?: keyof typeof variants }).variant ?? "default";
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", variants[variant], className)}>{children}</span>;
}
''',
'src/components/ui/table.tsx': '''import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full caption-bottom text-sm", className)} {...props} />;
}
export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) { return <thead className={cn("[&_tr]:border-b", className)} {...props} />; }
export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) { return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />; }
export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) { return <tr className={cn("border-b border-border transition hover:bg-muted/60", className)} {...props} />; }
export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) { return <th className={cn("h-11 px-4 text-left align-middle font-medium text-slate-500", className)} {...props} />; }
export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) { return <td className={cn("p-4 align-middle", className)} {...props} />; }
''',
'src/components/ui/tabs.tsx': '''import { cn } from "@/lib/utils";
import { createContext, useContext, useState, type HTMLAttributes, type ReactNode } from "react";

const TabsContext = createContext<{ value: string; setValue: (value: string) => void } | null>(null);

export function Tabs({ defaultValue, children, className }: { defaultValue: string; children: ReactNode; className?: string }) {
  const [value, setValue] = useState(defaultValue);
  return <TabsContext.Provider value={{ value, setValue }}><div className={className}>{children}</div></TabsContext.Provider>;
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("inline-flex rounded-xl bg-muted p-1", className)} {...props} />;
}

export function TabsTrigger({ value, className, children }: { value: string; className?: string; children: ReactNode }) {
  const ctx = useContext(TabsContext)!;
  const active = ctx.value === value;
  return <button onClick={() => ctx.setValue(value)} className={cn("rounded-lg px-3 py-2 text-sm font-medium", active ? "bg-card shadow" : "text-slate-500", className)}>{children}</button>;
}

export function TabsContent({ value, className, children }: { value: string; className?: string; children: ReactNode }) {
  const ctx = useContext(TabsContext)!;
  if (ctx.value !== value) return null;
  return <div className={className}>{children}</div>;
}
''',
'src/components/NavLink.tsx': '''import { NavLink as RouterNavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function NavLink({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <RouterNavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
          isActive ? "bg-primary text-white shadow-soft" : "text-slate-600 hover:bg-muted hover:text-foreground",
        )
      }
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </RouterNavLink>
  );
}
''',
'src/components/layout/AppSidebar.tsx': '''import { BarChart3, Bot, ClipboardList, Gauge, LayoutDashboard, Settings, ShieldCheck, Swords, Zap } from "lucide-react";
import { NavLink } from "@/components/NavLink";

const items = [
  ["/", "Dashboard", LayoutDashboard],
  ["/strategies", "Strategien", ClipboardList],
  ["/backtests", "Backtesting", BarChart3],
  ["/walkforward", "Walk-Forward", Gauge],
  ["/champion", "Champion", Swords],
  ["/paper-trading", "Paper Trading", ShieldCheck],
  ["/execution", "Execution", Zap],
  ["/agent", "Agent", Bot],
  ["/guide", "Anleitung", ClipboardList],
] as const;

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-border bg-card/70 p-4 backdrop-blur lg:block">
      <div className="mb-8 flex items-center gap-3 rounded-2xl border border-border bg-background p-4">
        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-slate-500">Research Lab</p>
          <h1 className="font-semibold">Sephiroth</h1>
        </div>
      </div>
      <nav className="space-y-2">
        {items.map(([to, label, icon]) => (
          <NavLink key={to} to={to} label={label} icon={icon} />
        ))}
      </nav>
      <div className="mt-8 border-t border-border pt-4">
        <NavLink to="/settings" label="Einstellungen" icon={Settings} />
      </div>
    </aside>
  );
}
''',
'src/components/layout/AppLayout.tsx': '''import { Menu } from "lucide-react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/layout/AppSidebar";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <AppSidebar />
      <div className="flex-1">
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 px-4 py-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-border bg-card p-2 lg:hidden">
              <Menu className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Strategy-to-Execution Platform</p>
              <h2 className="text-lg font-semibold">Sephiroth Trading Platform</h2>
            </div>
          </div>
        </header>
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
''',
'src/components/dashboard/KpiCard.tsx': '''import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function KpiCard({ title, value, subtitle, icon: Icon }: { title: string; value: string; subtitle: string; icon: LucideIcon }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between pt-6">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
''',
'src/components/dashboard/StrategyRankingTable.tsx': '''import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatPercent } from "@/lib/utils";
import type { Backtest, Strategy } from "@/integrations/supabase/types";

export function StrategyRankingTable({ strategies, backtests }: { strategies: Strategy[]; backtests: Backtest[] }) {
  const navigate = useNavigate();
  const rows = useMemo(() => {
    return strategies
      .map((strategy) => {
        const backtest = backtests.find((b) => b.strategy_id === strategy.id);
        const score = ((backtest?.sharpe_ratio ?? 0) * 0.5) + ((backtest?.win_rate ?? 0) * 0.2) + ((backtest?.total_return ?? 0) * 0.3);
        return { strategy, backtest, score };
      })
      .sort((a, b) => b.score - a.score);
  }, [backtests, strategies]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategie-Ranking</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Strategie</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Sharpe</TableHead>
                <TableHead>Return</TableHead>
                <TableHead>Win Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ strategy, backtest, score }) => (
                <TableRow key={strategy.id} className="cursor-pointer" onClick={() => navigate(`/strategies/${strategy.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">{strategy.name}</p>
                        <p className="text-xs text-slate-500">{strategy.symbol} · {strategy.timeframe}</p>
                      </div>
                      {strategy.is_champion && <Badge variant="success">Champion</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{formatNumber(score)}</TableCell>
                  <TableCell>{formatNumber(backtest?.sharpe_ratio)}</TableCell>
                  <TableCell>{formatPercent(backtest?.total_return)}</TableCell>
                  <TableCell>{formatPercent(backtest?.win_rate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
''',
'src/components/strategies/CreateStrategyDialog.tsx': '''import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateStrategy } from "@/hooks/use-trading-data";

const schema = z.object({
  name: z.string().min(2),
  symbol: z.string().min(2),
  timeframe: z.string().min(1),
  description: z.string().optional(),
  tags: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function CreateStrategyDialog() {
  const [open, setOpen] = useState(false);
  const createStrategy = useCreateStrategy();
  const { register, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { timeframe: "4h" },
  });

  const onSubmit = handleSubmit(async (values) => {
    await createStrategy.mutateAsync({
      ...values,
      status: "draft",
      is_champion: false,
      asset_class: "crypto",
      tags: values.tags?.split(",").map((tag) => tag.trim()).filter(Boolean),
    });
    reset();
    setOpen(false);
  });

  if (!open) return <Button onClick={() => setOpen(true)}>Strategie erstellen</Button>;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle>Neue Strategie</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <Input placeholder="Name" {...register("name")} />
          <div className="grid gap-4 md:grid-cols-2">
            <Input placeholder="Symbol" {...register("symbol")} />
            <Input placeholder="Timeframe" {...register("timeframe")} />
          </div>
          <Textarea placeholder="Beschreibung" {...register("description")} />
          <Input placeholder="Tags, komma-getrennt" {...register("tags")} />
          <div className="flex gap-3">
            <Button type="submit" disabled={createStrategy.isPending}>Speichern</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
''',
'src/components/strategies/BulkOperationsDialog.tsx': '''import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BulkOperationsDialog() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk-Operationen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-500">
        <p>Vorbereitet für Varianten-Erstellung, Bulk-Status-Updates und spätere Agent-Workflows.</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary">Varianten erzeugen</Button>
          <Button variant="outline">Status aktualisieren</Button>
          <Button variant="outline">Tags ergänzen</Button>
        </div>
      </CardContent>
    </Card>
  );
}
''',
'src/pages/DashboardPage.tsx': '''import { Activity, Crown, Percent, Sigma } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StrategyRankingTable } from "@/components/dashboard/StrategyRankingTable";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBacktests, useStrategies } from "@/hooks/use-trading-data";
import { formatNumber, formatPercent } from "@/lib/utils";

export default function DashboardPage() {
  const { data: strategies = [] } = useStrategies();
  const { data: backtests = [] } = useBacktests();
  const champion = strategies.find((strategy) => strategy.is_champion);
  const championBacktest = backtests.find((backtest) => backtest.strategy_id === champion?.id);
  const bestSharpe = Math.max(...backtests.map((backtest) => backtest.sharpe_ratio ?? 0), 0);
  const avgDrawdown = backtests.length ? backtests.reduce((sum, item) => sum + (item.max_drawdown ?? 0), 0) / backtests.length : 0;
  const assetCounts = strategies.reduce<Record<string, number>>((acc, strategy) => {
    acc[strategy.asset_class] = (acc[strategy.asset_class] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Strategien" value={String(strategies.length)} subtitle="Aktive und Draft-Strategien" icon={Sigma} />
        <KpiCard title="Bester Sharpe" value={formatNumber(bestSharpe)} subtitle="Über alle Backtests" icon={Activity} />
        <KpiCard title="Ø Max Drawdown" value={formatPercent(avgDrawdown)} subtitle="Gefiltert ohne eliminierte Strategien" icon={Percent} />
        <KpiCard title="Champion" value={champion?.name ?? "–"} subtitle={champion?.symbol ?? "Noch nicht gesetzt"} icon={Crown} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Champion Equity Curve</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={championBacktest?.equity_curve ?? []}>
                <defs>
                  <linearGradient id="equity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#equity)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Asset-Klassen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(assetCounts).map(([assetClass, count]) => (
              <div key={assetClass} className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
                <span className="capitalize">{assetClass}</span>
                <Badge variant="secondary">{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <StrategyRankingTable strategies={strategies} backtests={backtests} />
    </div>
  );
}
''',
'src/pages/StrategiesPage.tsx': '''import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CreateStrategyDialog } from "@/components/strategies/CreateStrategyDialog";
import { BulkOperationsDialog } from "@/components/strategies/BulkOperationsDialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useStrategies } from "@/hooks/use-trading-data";

export default function StrategiesPage() {
  const { data: strategies = [] } = useStrategies();
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => strategies.filter((strategy) => [strategy.name, strategy.symbol, ...(strategy.tags ?? [])].join(" ").toLowerCase().includes(query.toLowerCase())),
    [query, strategies],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative max-w-xl flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-10" placeholder="Strategien durchsuchen" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-3">
          <CreateStrategyDialog />
        </div>
      </div>

      <BulkOperationsDialog />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((strategy) => (
          <Link key={strategy.id} to={`/strategies/${strategy.id}`}>
            <Card className={strategy.is_champion ? "border-success/40 ring-1 ring-success/30" : undefined}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{strategy.name}</CardTitle>
                    <p className="mt-1 text-sm text-slate-500">{strategy.symbol} · {strategy.timeframe}</p>
                  </div>
                  {strategy.is_champion && <Badge variant="success">Champion</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-500">
                <p>{strategy.description}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{strategy.status}</Badge>
                  {(strategy.tags ?? []).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
''',
'src/pages/StrategyDetailPage.tsx': '''import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBacktests, useStrategies, useWalkforwardResults } from "@/hooks/use-trading-data";
import { formatNumber, formatPercent } from "@/lib/utils";

export default function StrategyDetailPage() {
  const { id } = useParams();
  const { data: strategies = [] } = useStrategies();
  const { data: backtests = [] } = useBacktests();
  const { data: walkforward = [] } = useWalkforwardResults();
  const strategy = strategies.find((item) => item.id === id);
  const strategyBacktests = backtests.filter((item) => item.strategy_id === id);
  const latestBacktest = strategyBacktests[0];
  const wfRows = useMemo(() => walkforward.filter((item) => item.strategy_id === id), [id, walkforward]);

  if (!strategy) return <div>Strategie nicht gefunden.</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <CardTitle>{strategy.name}</CardTitle>
                <Badge variant="secondary">{strategy.status}</Badge>
                {strategy.is_champion && <Badge variant="success">Champion</Badge>}
              </div>
              <p className="mt-2 text-sm text-slate-500">{strategy.symbol} · {strategy.timeframe} · {strategy.asset_class}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline">Bearbeiten</Button>
              <Button variant="destructive">Löschen</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">{strategy.description}</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Backtest</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <div><p className="text-sm text-slate-500">Return</p><p className="text-xl font-semibold">{formatPercent(latestBacktest?.total_return)}</p></div>
              <div><p className="text-sm text-slate-500">Sharpe</p><p className="text-xl font-semibold">{formatNumber(latestBacktest?.sharpe_ratio)}</p></div>
              <div><p className="text-sm text-slate-500">Max DD</p><p className="text-xl font-semibold">{formatPercent(latestBacktest?.max_drawdown)}</p></div>
              <div><p className="text-sm text-slate-500">Win Rate</p><p className="text-xl font-semibold">{formatPercent(latestBacktest?.win_rate)}</p></div>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={latestBacktest?.equity_curve ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.18)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Walk-Forward</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={wfRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="window_number" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="in_sample_sharpe" fill="hsl(var(--chart-1))" />
                  <Bar dataKey="out_of_sample_sharpe" fill="hsl(var(--chart-2))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 text-sm">
              {wfRows.map((row) => (
                <div key={row.id} className="rounded-xl bg-muted p-4">
                  <div className="flex items-center justify-between">
                    <span>Fenster {row.window_number}</span>
                    <Badge variant={row.passed ? "success" : "warning"}>{row.passed ? "Bestanden" : "Prüfen"}</Badge>
                  </div>
                  <p className="mt-2 text-slate-500">IS Sharpe {formatNumber(row.in_sample_sharpe)} · OOS Sharpe {formatNumber(row.out_of_sample_sharpe)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
''',
'src/pages/BacktestsPage.tsx': '''import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBacktests, useStrategies } from "@/hooks/use-trading-data";
import { formatNumber, formatPercent } from "@/lib/utils";

export default function BacktestsPage() {
  const { data: backtests = [] } = useBacktests();
  const { data: strategies = [] } = useStrategies();
  const rows = useMemo(() => backtests.map((backtest) => ({ backtest, strategy: strategies.find((strategy) => strategy.id === backtest.strategy_id) })).filter((row) => row.strategy), [backtests, strategies]);

  return (
    <Card>
      <CardHeader><CardTitle>Alle Backtests</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Strategie</TableHead>
                <TableHead>Zeitraum</TableHead>
                <TableHead>Return</TableHead>
                <TableHead>Sharpe</TableHead>
                <TableHead>Max DD</TableHead>
                <TableHead>Win Rate</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ backtest, strategy }) => (
                <TableRow key={backtest.id}>
                  <TableCell>{strategy?.name}</TableCell>
                  <TableCell>{backtest.start_date} → {backtest.end_date}</TableCell>
                  <TableCell>{formatPercent(backtest.total_return)}</TableCell>
                  <TableCell>{formatNumber(backtest.sharpe_ratio)}</TableCell>
                  <TableCell>{formatPercent(backtest.max_drawdown)}</TableCell>
                  <TableCell>{formatPercent(backtest.win_rate)}</TableCell>
                  <TableCell><Badge variant="secondary">{backtest.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
''',
'src/pages/WalkForwardPage.tsx': '''import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStrategies, useWalkforwardResults } from "@/hooks/use-trading-data";

export default function WalkForwardPage() {
  const { data: results = [] } = useWalkforwardResults();
  const { data: strategies = [] } = useStrategies();
  const rows = results.map((item) => ({ ...item, strategy: strategies.find((strategy) => strategy.id === item.strategy_id)?.name ?? item.strategy_id }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>IS vs OOS Sharpe</CardTitle></CardHeader>
        <CardContent className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="window_number" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="in_sample_sharpe" fill="hsl(var(--chart-1))" />
              <Bar dataKey="out_of_sample_sharpe" fill="hsl(var(--chart-2))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <Card key={row.id}>
            <CardHeader><CardTitle>{row.strategy} · Fenster {row.window_number}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-500">
              <p>IS: {row.in_sample_start} → {row.in_sample_end}</p>
              <p>OOS: {row.out_of_sample_start} → {row.out_of_sample_end}</p>
              <p>Effizienz: {row.efficiency_ratio?.toFixed(2) ?? "–"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
''',
'src/pages/ChampionPage.tsx': '''import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StrategyRankingTable } from "@/components/dashboard/StrategyRankingTable";
import { useBacktests, useStrategies } from "@/hooks/use-trading-data";

export default function ChampionPage() {
  const { data: strategies = [] } = useStrategies();
  const { data: backtests = [] } = useBacktests();
  const champion = strategies.find((item) => item.is_champion);
  const challenger = strategies.find((item) => !item.is_champion);
  const championBacktest = backtests.find((item) => item.strategy_id === champion?.id);
  const challengerBacktest = backtests.find((item) => item.strategy_id === challenger?.id);
  const data = [
    { metric: "Sharpe", champion: championBacktest?.sharpe_ratio ?? 0, challenger: challengerBacktest?.sharpe_ratio ?? 0 },
    { metric: "Win Rate", champion: championBacktest?.win_rate ?? 0, challenger: challengerBacktest?.win_rate ?? 0 },
    { metric: "Profit Factor", champion: championBacktest?.profit_factor ?? 0, challenger: challengerBacktest?.profit_factor ?? 0 },
    { metric: "CAGR", champion: championBacktest?.cagr ?? 0, challenger: challengerBacktest?.cagr ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Champion vs Challenger</CardTitle></CardHeader>
        <CardContent className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <Radar dataKey="champion" fill="hsl(var(--chart-1))" fillOpacity={0.35} stroke="hsl(var(--chart-1))" />
              <Radar dataKey="challenger" fill="hsl(var(--chart-2))" fillOpacity={0.2} stroke="hsl(var(--chart-2))" />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <StrategyRankingTable strategies={strategies} backtests={backtests} />
    </div>
  );
}
''',
'src/pages/PaperTradingPage.tsx': '''import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePaperPortfolios, useStrategies } from "@/hooks/use-trading-data";
import { formatCurrency, formatPercent } from "@/lib/utils";

export default function PaperTradingPage() {
  const { data: portfolios = [] } = usePaperPortfolios();
  const { data: strategies = [] } = useStrategies();
  const active = portfolios.filter((portfolio) => portfolio.is_active);
  const inactive = portfolios.filter((portfolio) => !portfolio.is_active);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Paper Trading starten</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm text-slate-500">
          <p>Strategien verfügbar: {strategies.length}</p>
          <Button>Start</Button>
          <Button variant="outline">Signale prüfen</Button>
          <Button variant="destructive">Stop</Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Aktive Portfolios</TabsTrigger>
          <TabsTrigger value="inactive">Inaktive Portfolios</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4 grid gap-4 md:grid-cols-2">
          {active.map((portfolio) => (
            <Card key={portfolio.id}>
              <CardHeader><CardTitle>{strategies.find((item) => item.id === portfolio.strategy_id)?.name ?? portfolio.strategy_id}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-500">
                <p>Kapital: {formatCurrency(portfolio.current_capital)}</p>
                <p>PnL: {formatCurrency(portfolio.total_pnl)}</p>
                <p>Max DD: {formatPercent(portfolio.max_drawdown)}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="inactive" className="mt-4 grid gap-4 md:grid-cols-2">
          {inactive.length === 0 ? <Card><CardContent className="pt-6 text-sm text-slate-500">Noch keine inaktiven Portfolios.</CardContent></Card> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
''',
'src/pages/ExecutionPage.tsx': '''import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBacktests, useLivePortfolios, useRiskRules, useStrategies, useWalkforwardResults } from "@/hooks/use-trading-data";

export default function ExecutionPage() {
  const { data: strategies = [] } = useStrategies();
  const { data: backtests = [] } = useBacktests();
  const { data: wf = [] } = useWalkforwardResults();
  const { data: riskRules = [] } = useRiskRules();
  const { data: live = [] } = useLivePortfolios();

  return (
    <Tabs defaultValue="pipeline" className="space-y-4">
      <TabsList>
        <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        <TabsTrigger value="risk">Risk</TabsTrigger>
        <TabsTrigger value="live">Live Trading</TabsTrigger>
        <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
      </TabsList>
      <TabsContent value="pipeline" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {strategies.map((strategy) => {
          const hasBacktest = backtests.some((item) => item.strategy_id === strategy.id);
          const hasWf = wf.some((item) => item.strategy_id === strategy.id);
          return (
            <Card key={strategy.id}>
              <CardHeader><CardTitle>{strategy.name}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-500">
                <p>Backtest: {hasBacktest ? "bereit" : "offen"}</p>
                <p>Walk-Forward: {hasWf ? "bereit" : "offen"}</p>
                <p>Paper: vorbereitet</p>
                <p>Execution: vorbereitet</p>
              </CardContent>
            </Card>
          );
        })}
      </TabsContent>
      <TabsContent value="risk">
        <Card>
          <CardHeader><CardTitle>Globale Risk Rules</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-500">
            {riskRules.map((rule) => (
              <div key={rule.id} className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <p>Positionsgröße: {rule.max_position_size * 100}%</p>
                <p>Stop Loss: {rule.stop_loss_percent * 100}%</p>
                <p>Take Profit: {rule.take_profit_percent * 100}%</p>
                <p>Daily Loss: {rule.max_daily_loss * 100}%</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="live">
        <Card>
          <CardHeader><CardTitle>Live Trading</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-500">
            <p>Aktive Live-Portfolios: {live.filter((item) => item.is_active).length}</p>
            <div className="flex gap-3">
              <Button>Start</Button>
              <Button variant="outline">Check</Button>
              <Button variant="destructive">Stop</Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="monitoring">
        <Card>
          <CardHeader><CardTitle>Monitoring</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-500">
            <p>Bereit für Deployment-Checklist, Sharpe-Monitoring und Pipeline Alerts.</p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
''',
'src/pages/AgentPage.tsx': '''import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBacktests, useStrategies, useWalkforwardResults } from "@/hooks/use-trading-data";
import { formatNumber } from "@/lib/utils";

export default function AgentPage() {
  const { data: strategies = [] } = useStrategies();
  const { data: backtests = [] } = useBacktests();
  const { data: wf = [] } = useWalkforwardResults();

  const healthRows = strategies.map((strategy) => {
    const backtest = backtests.find((item) => item.strategy_id === strategy.id);
    const wfPassRate = wf.filter((item) => item.strategy_id === strategy.id && item.passed).length;
    const health = ((backtest?.sharpe_ratio ?? 0) * 40) + ((backtest?.win_rate ?? 0) * 0.6) + (wfPassRate * 10);
    return { strategy, health };
  });

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="portfolio">Portfolio Analysis</TabsTrigger>
        <TabsTrigger value="analyze">Analyze</TabsTrigger>
        <TabsTrigger value="optimize">Optimize</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {healthRows.map(({ strategy, health }) => (
          <Card key={strategy.id}>
            <CardHeader><CardTitle>{strategy.name}</CardTitle></CardHeader>
            <CardContent className="text-sm text-slate-500">Health Score: <span className="font-semibold text-foreground">{formatNumber(health)}</span></CardContent>
          </Card>
        ))}
      </TabsContent>
      <TabsContent value="portfolio">
        <Card><CardHeader><CardTitle>Portfolio Analysis</CardTitle></CardHeader><CardContent className="flex gap-3"><Button>Bulk-Analyse starten</Button><Button variant="outline">Ranking aktualisieren</Button></CardContent></Card>
      </TabsContent>
      <TabsContent value="analyze">
        <Card><CardHeader><CardTitle>Einzelanalyse</CardTitle></CardHeader><CardContent className="flex gap-3"><Button>Analyse ausführen</Button><Button variant="outline">Prompt anzeigen</Button></CardContent></Card>
      </TabsContent>
      <TabsContent value="optimize">
        <Card><CardHeader><CardTitle>Parameter-Optimierung</CardTitle></CardHeader><CardContent className="flex gap-3"><Button>Optimieren</Button><Button variant="outline">JSON-Vorschlag laden</Button></CardContent></Card>
      </TabsContent>
    </Tabs>
  );
}
''',
'src/pages/GuidePage.tsx': '''import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const phases = [
  ["1. Research Lab", "Strategie definieren, Backtest fahren, Champion-Kandidaten bilden."],
  ["2. Validation Layer", "Walk-Forward und Paper Trading zur Robustheitsprüfung."],
  ["3. Execution Layer", "Risk Rules setzen und Live-Pipeline vorbereiten."],
  ["4. Agent Layer", "KI für Analyse, Ranking und Optimierung verwenden."],
];

export default function GuidePage() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {phases.map(([title, text]) => (
        <Card key={title}>
          <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
          <CardContent className="text-sm text-slate-500">{text}</CardContent>
        </Card>
      ))}
      <Card className="xl:col-span-2">
        <CardHeader><CardTitle>Checklist vor Live-Trading</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-500">
          <p>✓ Backtest mit realistischer Fee-Struktur</p>
          <p>✓ Walk-Forward mit bestandenem OOS-Fenster</p>
          <p>✓ Paper Trading mit stabiler Equity</p>
          <p>✓ Risk Rules und Kill-Switch definiert</p>
        </CardContent>
      </Card>
    </div>
  );
}
''',
'src/pages/SettingsPage.tsx': '''import { hasSupabaseEnv } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card><CardHeader><CardTitle>Telegram Bot</CardTitle></CardHeader><CardContent className="text-sm text-slate-500">Benötigt TELEGRAM_BOT_TOKEN.</CardContent></Card>
      <Card><CardHeader><CardTitle>Strategietypen</CardTitle></CardHeader><CardContent className="text-sm text-slate-500">15 Typen für Backtesting und Auto-Detection vorbereitet.</CardContent></Card>
      <Card><CardHeader><CardTitle>Datenquellen</CardTitle></CardHeader><CardContent className="text-sm text-slate-500">Binance für Backtests, CryptoCompare für Paper/Live.</CardContent></Card>
      <Card><CardHeader><CardTitle>Walk-Forward</CardTitle></CardHeader><CardContent className="text-sm text-slate-500">70/30 Ratio, SMA Grid Search, Efficiency Ratio.</CardContent></Card>
      <Card><CardHeader><CardTitle>DB-Status</CardTitle></CardHeader><CardContent className="text-sm text-slate-500">{hasSupabaseEnv ? "Supabase verbunden" : "Mock-Modus aktiv – Env Variablen fehlen."}</CardContent></Card>
    </div>
  );
}
''',
'src/pages/NotFound.tsx': '''import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-slate-500">Die gewünschte Seite wurde nicht gefunden.</p>
      <Link to="/"><Button>Zurück zum Dashboard</Button></Link>
    </div>
  );
}
''',
'src/pages/Index.tsx': 'export { default } from "./DashboardPage";\n',
'src/App.tsx': '''import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "@/pages/Index";
import DashboardPage from "@/pages/DashboardPage";
import StrategiesPage from "@/pages/StrategiesPage";
import StrategyDetailPage from "@/pages/StrategyDetailPage";
import BacktestsPage from "@/pages/BacktestsPage";
import WalkForwardPage from "@/pages/WalkForwardPage";
import ChampionPage from "@/pages/ChampionPage";
import PaperTradingPage from "@/pages/PaperTradingPage";
import ExecutionPage from "@/pages/ExecutionPage";
import AgentPage from "@/pages/AgentPage";
import GuidePage from "@/pages/GuidePage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Index />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/strategies" element={<StrategiesPage />} />
            <Route path="/strategies/:id" element={<StrategyDetailPage />} />
            <Route path="/backtests" element={<BacktestsPage />} />
            <Route path="/walkforward" element={<WalkForwardPage />} />
            <Route path="/champion" element={<ChampionPage />} />
            <Route path="/paper-trading" element={<PaperTradingPage />} />
            <Route path="/execution" element={<ExecutionPage />} />
            <Route path="/agent" element={<AgentPage />} />
            <Route path="/guide" element={<GuidePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
''',
'src/main.tsx': '''import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
''',
'src/index.css': '''@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 220 20% 97%;
  --foreground: 220 25% 10%;
  --card: 0 0% 100%;
  --primary: 245 58% 51%;
  --secondary: 220 16% 93%;
  --muted: 220 16% 93%;
  --accent: 167 72% 40%;
  --destructive: 0 72% 51%;
  --success: 152 60% 40%;
  --warning: 38 92% 50%;
  --border: 220 16% 90%;
  --radius: 0.75rem;
  --sidebar: 0 0% 100%;
  --chart-up: 152 60% 40%;
  --chart-down: 0 72% 51%;
  --chart-1: 245 58% 51%;
  --chart-2: 167 72% 40%;
  --chart-3: 38 92% 50%;
  --chart-4: 270 65% 60%;
  --chart-5: 220 80% 58%;
}

.dark {
  --background: 225 25% 8%;
  --foreground: 220 15% 90%;
  --card: 225 22% 11%;
  --primary: 245 58% 61%;
  --accent: 167 72% 45%;
  --border: 225 18% 18%;
  --secondary: 225 18% 16%;
  --muted: 225 18% 16%;
  --sidebar: 225 22% 11%;
}

@layer base {
  * { @apply border-border; }
  body {
    @apply bg-background text-foreground antialiased;
    font-family: "DM Sans", sans-serif;
  }
  code, pre { font-family: "JetBrains Mono", monospace; }
}
''',
'supabase/config.toml': '''project_id = "sephiroth"

[functions.run-backtest]
verify_jwt = false
[functions.run-walkforward]
verify_jwt = false
[functions.paper-trade]
verify_jwt = false
[functions.execute-trade]
verify_jwt = false
[functions.parse-strategy]
verify_jwt = false
[functions.ai-agent]
verify_jwt = false
[functions.telegram-bot]
verify_jwt = false
''',
'supabase/functions/_shared/cors.ts': '''export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
''',
'supabase/functions/run-backtest/index.ts': '''import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const body = await req.json();
  return Response.json({
    ok: true,
    function: "run-backtest",
    message: "Scaffold bereit. Implementiere hier Binance-Daten, Auto-Detection und Trade-Simulation.",
    input: body,
  }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
''',
'supabase/functions/run-walkforward/index.ts': '''import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const body = await req.json();
  return Response.json({ ok: true, function: "run-walkforward", message: "Scaffold bereit für 70/30 IS/OOS + SMA Grid Search.", input: body }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
''',
'supabase/functions/paper-trade/index.ts': '''import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const body = await req.json();
  return Response.json({ ok: true, function: "paper-trade", message: "Scaffold bereit für start/check/stop und Signal-Generierung.", input: body }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
''',
'supabase/functions/execute-trade/index.ts': '''import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const body = await req.json();
  return Response.json({ ok: true, function: "execute-trade", message: "Scaffold bereit für Binance Live-Execution oder Simulation ohne Keys.", input: body }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
''',
'supabase/functions/parse-strategy/index.ts': '''import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const body = await req.json();
  return Response.json({ ok: true, function: "parse-strategy", message: "Scaffold bereit für JSON-Erkennung und GPT-kompatibles Parsing.", input: body }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
''',
'supabase/functions/ai-agent/index.ts': '''import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const body = await req.json();
  return Response.json({ ok: true, function: "ai-agent", message: "Scaffold bereit für analyze, optimize und bulk-analyze über GPT-kompatible Chat-Completions.", input: body }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
''',
'supabase/functions/telegram-bot/index.ts': '''import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const body = await req.json();
  return Response.json({ ok: true, function: "telegram-bot", message: "Scaffold bereit für Telegram-Webhook und Strategie-Erstellung.", input: body }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
''',
'supabase/migrations/20260327_000001_init.sql': '''CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.asset_class AS ENUM ('crypto', 'stocks', 'forex', 'futures');

CREATE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  timeframe TEXT DEFAULT '1d',
  asset_class asset_class DEFAULT 'crypto',
  description TEXT,
  parameters JSONB,
  status TEXT DEFAULT 'draft',
  is_champion BOOLEAN DEFAULT false,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE backtests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  initial_capital NUMERIC DEFAULT 10000,
  final_capital NUMERIC,
  total_return NUMERIC,
  cagr NUMERIC,
  sharpe_ratio NUMERIC,
  max_drawdown NUMERIC,
  win_rate NUMERIC,
  profit_factor NUMERIC,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  avg_trade_duration TEXT,
  equity_curve JSONB DEFAULT '[]',
  monthly_returns JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE backtest_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backtest_id UUID REFERENCES backtests(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  entry_date TIMESTAMPTZ NOT NULL,
  exit_date TIMESTAMPTZ,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  quantity NUMERIC NOT NULL,
  pnl NUMERIC,
  pnl_percent NUMERIC,
  fees NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE walkforward_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  window_number INTEGER NOT NULL,
  in_sample_start DATE NOT NULL,
  in_sample_end DATE NOT NULL,
  out_of_sample_start DATE NOT NULL,
  out_of_sample_end DATE NOT NULL,
  in_sample_sharpe NUMERIC,
  in_sample_return NUMERIC,
  in_sample_max_dd NUMERIC,
  out_of_sample_sharpe NUMERIC,
  out_of_sample_return NUMERIC,
  out_of_sample_max_dd NUMERIC,
  efficiency_ratio NUMERIC,
  optimized_params JSONB,
  passed BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE paper_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  initial_capital NUMERIC DEFAULT 10000,
  current_capital NUMERIC DEFAULT 10000,
  peak_capital NUMERIC,
  is_active BOOLEAN DEFAULT true,
  total_pnl NUMERIC DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  max_drawdown NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE paper_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  price NUMERIC NOT NULL,
  indicator_values JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE paper_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES paper_signals(id),
  symbol TEXT NOT NULL,
  direction TEXT DEFAULT 'long',
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  quantity NUMERIC NOT NULL,
  entry_date TIMESTAMPTZ DEFAULT now(),
  exit_date TIMESTAMPTZ,
  status TEXT DEFAULT 'open',
  pnl NUMERIC,
  pnl_percent NUMERIC,
  fees NUMERIC,
  slippage NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE paper_equity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES paper_portfolio(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  snapshot_date TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE risk_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id),
  is_global BOOLEAN DEFAULT false,
  max_position_size NUMERIC DEFAULT 0.1,
  stop_loss_percent NUMERIC DEFAULT 0.02,
  take_profit_percent NUMERIC DEFAULT 0.04,
  max_daily_loss NUMERIC DEFAULT 0.05,
  trailing_stop_enabled BOOLEAN DEFAULT false,
  trailing_stop_percent NUMERIC DEFAULT 0.015,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE live_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  exchange TEXT DEFAULT 'binance',
  api_key_name TEXT,
  initial_capital NUMERIC DEFAULT 1000,
  current_capital NUMERIC DEFAULT 1000,
  is_active BOOLEAN DEFAULT false,
  total_pnl NUMERIC DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  max_drawdown NUMERIC,
  last_signal_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE live_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES live_portfolios(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  exchange_order_id TEXT,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  order_type TEXT DEFAULT 'market',
  quantity NUMERIC NOT NULL,
  price NUMERIC,
  filled_price NUMERIC,
  status TEXT DEFAULT 'pending',
  pnl NUMERIC,
  fees NUMERIC DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION enable_public_rls(table_name text) RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('CREATE POLICY "public all" ON %I FOR ALL USING (true) WITH CHECK (true)', table_name);
END; $$ LANGUAGE plpgsql;

SELECT enable_public_rls('strategies');
SELECT enable_public_rls('backtests');
SELECT enable_public_rls('backtest_trades');
SELECT enable_public_rls('walkforward_results');
SELECT enable_public_rls('paper_portfolio');
SELECT enable_public_rls('paper_signals');
SELECT enable_public_rls('paper_positions');
SELECT enable_public_rls('paper_equity_snapshots');
SELECT enable_public_rls('risk_rules');
SELECT enable_public_rls('live_portfolios');
SELECT enable_public_rls('live_orders');

CREATE TRIGGER trg_strategies_updated BEFORE UPDATE ON strategies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_backtests_updated BEFORE UPDATE ON backtests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_paper_portfolio_updated BEFORE UPDATE ON paper_portfolio FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_risk_rules_updated BEFORE UPDATE ON risk_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_live_portfolios_updated BEFORE UPDATE ON live_portfolios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_live_orders_updated BEFORE UPDATE ON live_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
''',
'README.md': '''# Sephiroth Trading Platform

Dieses Projekt ist ein GPT-nachgebauter Scaffold auf Basis deines Blueprint-Dokuments.

## Enthalten
- Vite + React + TypeScript Frontend
- Tailwind Design System mit den Blueprint-Farben
- Routing für alle Seiten
- Mock-Daten für direkten Start ohne Backend
- Supabase Client + Typen + CRUD-Hooks
- SQL-Migration für das komplette Schema
- Edge-Function-Scaffolds für Backtest, Walk-Forward, Paper, Execution, Parsing, Agent und Telegram

## Start
```bash
npm install
cp .env.example .env
npm run dev
```

## Supabase
1. `.env` mit `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` füllen.
2. Migration aus `supabase/migrations/20260327_000001_init.sql` anwenden.
3. Functions unter `supabase/functions/*` deployen.

## Nächster sinnvoller Schritt
Die App läuft bereits mit Mock-Daten. Danach sollten die Edge Functions und echte Datenquellen schrittweise implementiert werden.
''',
}
for rel, content in files.items():
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')
print(f'wrote {len(files)} files')
