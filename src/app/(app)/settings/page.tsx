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
        <p className="mt-1 text-sm text-zinc-500">Manage your account and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Your profile and sign-in are managed securely</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">
            Update your name, email, password, and connected accounts from the
            profile menu in the top-right corner.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Content</CardTitle>
          <CardDescription>How your work is saved</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-500">
          <p>
            AI generations are automatically saved as projects in the Content Builder
            so you can edit, expand, and export them anytime.
          </p>
          <p>
            You can also create blank projects manually from the Content Builder page.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage</CardTitle>
          <CardDescription>AI generation limits</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">
            Free-tier AI providers apply daily rate limits. If generation fails,
            wait a moment and try again.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
