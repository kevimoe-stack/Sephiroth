import { BarChart3, Bot, ClipboardList, Gauge, LayoutDashboard, Settings, ShieldCheck, Swords, Zap } from "lucide-react";
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
