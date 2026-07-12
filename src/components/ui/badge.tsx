import * as React from "react";
import { cn } from "@/lib/utils";

const Badge = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "outline" }
>(({ className, variant = "default", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
      variant === "default" && "bg-zinc-900 text-white",
      variant === "outline" && "border border-zinc-200 text-zinc-900",
      className
    )}
    {...props}
  />
));
Badge.displayName = "Badge";

export { Badge };
