"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "pointerdown", "scroll", "touchstart"] as const;

/**
 * Keeps the Clerk session warm, but only while the tab is visible and the
 * user has been active since the last beat (avoids idle/background waste).
 */
export function SessionKeeper() {
  const { isSignedIn, getToken } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeSinceLastBeat = useRef(true);

  useEffect(() => {
    if (!isSignedIn) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const markActive = () => {
      activeSinceLastBeat.current = true;
    };

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, markActive, { passive: true });
    }

    const keepAlive = async () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      if (!activeSinceLastBeat.current) {
        return;
      }

      activeSinceLastBeat.current = false;

      try {
        await getToken();
        await fetch("/api/session/heartbeat", { method: "POST" });
      } catch {
        // Session refresh is best-effort; Clerk handles token renewal client-side.
      }
    };

    // Initial beat while the tab is focused.
    if (document.visibilityState === "visible") {
      void keepAlive();
    }

    intervalRef.current = setInterval(() => {
      void keepAlive();
    }, HEARTBEAT_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        activeSinceLastBeat.current = true;
        void keepAlive();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, markActive);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isSignedIn, getToken]);

  return null;
}
