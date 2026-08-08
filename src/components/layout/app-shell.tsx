"use client";

import { useState } from "react";
import { SessionKeeper } from "@/components/auth/session-keeper";
import { cn } from "@/lib/utils";
import { Navbar } from "./navbar";
import { Sidebar } from "./sidebar";

export function AppShell({
  children,
  showRedisWarning = false,
}: {
  children: React.ReactNode;
  showRedisWarning?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dismissedRedisWarning, setDismissedRedisWarning] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-50">
      <SessionKeeper />
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          "flex min-h-screen flex-col transition-[margin-left] duration-300 ease-in-out",
          collapsed ? "lg:ml-16" : "lg:ml-64"
        )}
      >
        <Navbar
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed(!collapsed)}
          onToggleMobile={() => setMobileOpen(!mobileOpen)}
        />
        {showRedisWarning && !dismissedRedisWarning && (
          <div
            role="alert"
            className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          >
            <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
              <p>
                Redis is not configured. Caching and distributed rate limits are
                in-memory only and will not work correctly across multiple
                instances. Set{" "}
                <code className="rounded bg-amber-100 px-1">UPSTASH_REDIS_REST_URL</code>{" "}
                and{" "}
                <code className="rounded bg-amber-100 px-1">UPSTASH_REDIS_REST_TOKEN</code>.
              </p>
              <button
                type="button"
                onClick={() => setDismissedRedisWarning(true)}
                className="shrink-0 text-amber-800 underline-offset-2 hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
