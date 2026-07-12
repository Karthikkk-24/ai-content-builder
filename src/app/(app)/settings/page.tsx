import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage your preferences</p>
      </div>

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
              <p className="text-sm font-medium">Gemini 2.0 Flash</p>
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
          <CardTitle className="text-base">Usage</CardTitle>
          <CardDescription>Free tier limits apply per provider</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">
            Gemini: ~1,500 requests/day. Groq: ~14,400 requests/day. Pollinations
            Flux: unlimited free tier with rate limits.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
