import * as React from "react";

import { cn } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex items-center border border-primary/40 px-4 py-2 text-xs uppercase tracking-[0.3em] text-primary",
        className
      )}
      {...props}
    />
  );
}
