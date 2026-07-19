"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900">Something went wrong</h1>
      <p className="max-w-md text-sm text-zinc-500">
        An unexpected error occurred. You can try again or return to the dashboard.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className={cn(buttonVariants())}
        >
          Try again
        </button>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }))}>
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
