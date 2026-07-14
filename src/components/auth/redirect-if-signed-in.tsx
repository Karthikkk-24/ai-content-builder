"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function RedirectIfSignedIn({ to = "/dashboard" }: { to?: string }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace(to);
    }
  }, [isLoaded, isSignedIn, router, to]);

  if (isLoaded && isSignedIn) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <p className="text-sm text-zinc-500">Taking you to your dashboard...</p>
      </div>
    );
  }

  return null;
}
