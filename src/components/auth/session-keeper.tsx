"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

export function SessionKeeper() {
  const { isSignedIn, getToken } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isSignedIn) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const keepAlive = async () => {
      try {
        await getToken();
        await fetch("/api/session/heartbeat", { method: "POST" });
      } catch {
        // Session refresh is best-effort; Clerk handles token renewal client-side.
      }
    };

    keepAlive();
    intervalRef.current = setInterval(keepAlive, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isSignedIn, getToken]);

  return null;
}
