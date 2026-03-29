import { Menu } from "lucide-react";
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
