import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full border border-white/10 bg-black/20 px-4 text-base text-foreground outline-none transition-all placeholder:text-foreground/30 focus:border-primary",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
