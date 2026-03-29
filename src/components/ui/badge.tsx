import type { HTMLAttributes } from "react";
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
