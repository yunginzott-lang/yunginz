import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[144px] w-full border border-white/10 bg-black/20 px-4 py-4 text-base text-foreground outline-none transition-all placeholder:text-foreground/30 focus:border-primary",
      className
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
