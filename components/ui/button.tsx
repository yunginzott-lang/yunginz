import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm uppercase tracking-[0.35em] transition-all duration-300 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary px-6 py-4 font-semibold text-primary-foreground hover:brightness-110",
        outline:
          "border border-white/20 bg-transparent px-6 py-4 text-foreground hover:border-primary hover:text-primary",
        ghost: "px-4 py-2 text-foreground/80 hover:text-primary",
        destructive:
          "bg-destructive px-6 py-4 font-semibold text-destructive-foreground"
      },
      size: {
        default: "h-12",
        sm: "h-10 px-4 py-2 text-xs",
        lg: "h-14 px-8 py-4 text-sm",
        icon: "h-11 w-11"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      ref={ref}
      {...props}
    />
  )
);

Button.displayName = "Button";
