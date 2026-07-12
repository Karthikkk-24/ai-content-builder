import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: ClassValue;
} = {}) {
  return twMerge(
    clsx(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:pointer-events-none disabled:opacity-50",
      {
        "bg-zinc-900 text-white hover:bg-zinc-800": variant === "default",
        "border border-zinc-200 bg-white hover:bg-zinc-50": variant === "outline",
        "hover:bg-zinc-100": variant === "ghost",
        "bg-zinc-100 text-zinc-900 hover:bg-zinc-200": variant === "secondary",
      },
      {
        "h-10 px-4 py-2": size === "default",
        "h-8 rounded-md px-3 text-xs": size === "sm",
        "h-12 rounded-md px-8": size === "lg",
        "h-10 w-10": size === "icon",
      },
      className
    )
  );
}
