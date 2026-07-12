import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isClerkConfigured } from "@/lib/clerk-config";
import { isRedisConfigured } from "@/lib/redis";

export default function SettingsPage() {
  const redisEnabled = isRedisConfigured();
  const clerkConfigured = isClerkConfigured();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage your preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance</CardTitle>
          <CardDescription>Redis caching and session persistence</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-md border border-zinc-200 p-3">
            <div>
              <p className="text-sm font-medium">Redis Cache</p>
              <p className="text-xs text-zinc-500">
                Speeds up dashboard, profile, and rate limiting
              </p>
            </div>
            <span className="text-xs text-zinc-400">
              {redisEnabled ? "Connected" : "In-memory fallback"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-zinc-200 p-3">
            <div>
              <p className="text-sm font-medium">Session Persistence</p>
              <p className="text-xs text-zinc-500">
                Keeps you signed in with automatic session refresh
              </p>
            </div>
            <span className="text-xs text-zinc-400">
              {clerkConfigured ? "Active" : "Keyless dev mode"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Providers</CardTitle>
          <CardDescription>
            Free-tier providers configured for this app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-md border border-zinc-200 p-3">
            <div>
              <p className="text-sm font-medium">Gemini 3.5 Flash</p>
              <p className="text-xs text-zinc-500">Text generation & vision</p>
            </div>
            <span className="text-xs text-zinc-400">Primary</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-zinc-200 p-3">
            <div>
              <p className="text-sm font-medium">Groq Llama 3.3 70B</p>
              <p className="text-xs text-zinc-500">Text fallback</p>
            </div>
            <span className="text-xs text-zinc-400">Fallback</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-zinc-200 p-3">
            <div>
              <p className="text-sm font-medium">Pollinations Flux</p>
              <p className="text-xs text-zinc-500">Image generation</p>
            </div>
            <span className="text-xs text-zinc-400">Primary</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stay signed in</CardTitle>
          <CardDescription>Recommended Clerk dashboard settings</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">
            In Clerk Dashboard → Sessions, set session lifetime to 30 days and
            enable multi-session if you use multiple devices. Add your production
            Clerk keys to <code className="text-xs">.env.local</code> for persistent
            sessions outside development keyless mode.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
