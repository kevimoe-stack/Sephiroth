import { NavLink as RouterNavLink } from "react-router-dom";
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
