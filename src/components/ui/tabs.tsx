import { cn } from "@/lib/utils";
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
