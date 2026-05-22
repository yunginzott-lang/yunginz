import * as React from "react";

import { cn } from "@/lib/utils";

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-12 w-full border border-white/10 bg-black/20 px-4 text-sm uppercase tracking-[0.18em] text-foreground outline-none focus:border-primary",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
