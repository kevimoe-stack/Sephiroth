import * as React from "react";
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
