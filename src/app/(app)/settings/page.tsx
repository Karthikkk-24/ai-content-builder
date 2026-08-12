import { auth, currentUser } from "@clerk/nextjs/server";
import { SettingsForm } from "@/components/settings/settings-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ensureUser } from "@/lib/db/users";
import { getUserPreferences } from "@/lib/preferences";
import {
  getRateLimitRulesSummary,
  TIER_LIMIT_MULTIPLIER,
} from "@/lib/rate-limit";

const ROUTE_LABELS: Record<string, string> = {
  tweet: "Tweets",
  blog: "Blog outline",
  caption: "Social captions",
  photo: "Photos",
  poster: "Posters",
  "prompt-upgrade": "Prompt upgrade",
  default: "Other AI routes",
};

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) return null;

  await ensureUser(userId);
  const [preferences, clerkUser] = await Promise.all([
    getUserPreferences(userId),
    currentUser(),
  ]);
  const rateLimitRules = getRateLimitRulesSummary().filter(
    (rule) => rule.route !== "default"
  );
  const windowSeconds = rateLimitRules[0]?.windowSeconds ?? 60;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage your account and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>
            Name, email, password, and connected accounts are managed in Clerk
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">
            Use the profile menu in the top-right corner to update sign-in
            details. Avatar, generation defaults, export, and account deletion
            are below.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage limits</CardTitle>
          <CardDescription>
            Per-endpoint sliding windows of {windowSeconds} seconds (not daily
            quotas). Free-tier base caps; Pro ×{TIER_LIMIT_MULTIPLIER.pro},
            Enterprise ×{TIER_LIMIT_MULTIPLIER.enterprise}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm text-zinc-600">
            {rateLimitRules.map((rule) => (
              <li key={rule.route}>
                {ROUTE_LABELS[rule.route] ?? rule.route}: {rule.maxRequests} /{" "}
                {rule.windowSeconds}s
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <SettingsForm
        key={[
          preferences.defaultTone,
          preferences.defaultGenerationType,
          preferences.marketingOptOut,
          preferences.customAvatarUrl,
        ].join("|")}
        initialPreferences={preferences}
        clerkAvatarUrl={clerkUser?.imageUrl ?? null}
      />
    </div>
  );
}
