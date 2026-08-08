"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api/client-error";
import {
  PREFERENCE_GENERATION_TYPES,
  PREFERENCE_TONES,
  type UserPreferences,
} from "@/lib/preferences";
import { uploadFiles } from "@/lib/uploadthing";

const GENERATION_TYPE_LABELS: Record<
  (typeof PREFERENCE_GENERATION_TYPES)[number],
  string
> = {
  tweet: "Tweets",
  blog: "Blog outline",
  caption: "Social captions",
  photo: "Photo generator",
  poster: "Posters",
  prompt_upgrade: "Prompt upgrade",
};

type SettingsFormProps = {
  initialPreferences: UserPreferences;
  clerkAvatarUrl: string | null;
};

export function SettingsForm({
  initialPreferences,
  clerkAvatarUrl,
}: SettingsFormProps) {
  const router = useRouter();
  const { signOut } = useClerk();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [defaultTone, setDefaultTone] = useState(
    initialPreferences.defaultTone ?? ""
  );
  const [defaultGenerationType, setDefaultGenerationType] = useState(
    initialPreferences.defaultGenerationType ?? ""
  );
  const [marketingOptOut, setMarketingOptOut] = useState(
    initialPreferences.marketingOptOut
  );
  const [customAvatarUrl, setCustomAvatarUrl] = useState(
    initialPreferences.customAvatarUrl
  );
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const avatarUrl = customAvatarUrl ?? clerkAvatarUrl;

  const savePreferences = useCallback(async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultTone: defaultTone || null,
          defaultGenerationType: defaultGenerationType || null,
          marketingOptOut,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(getApiErrorMessage(data, "Failed to save preferences"));
      }
      setMessage("Preferences saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [defaultTone, defaultGenerationType, marketingOptOut, router]);

  const handleAvatarUpload = async (file: File) => {
    setUploadingAvatar(true);
    setError(null);
    setMessage(null);
    try {
      const result = await uploadFiles("avatarImage", { files: [file] });
      const uploaded = result?.[0];
      const url = uploaded?.serverData?.url ?? uploaded?.ufsUrl ?? null;
      if (!url) throw new Error("Upload returned no URL");
      setCustomAvatarUrl(url);
      setMessage("Avatar updated.");
      router.refresh();
    } catch {
      setError("Failed to upload avatar. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const clearCustomAvatar = async () => {
    setUploadingAvatar(true);
    setError(null);
    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customAvatarUrl: null }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(getApiErrorMessage(data, "Failed to clear avatar"));
      }
      setCustomAvatarUrl(null);
      setMessage("Custom avatar removed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(getApiErrorMessage(data, "Export failed"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `contentai-export-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Export downloaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== "DELETE MY ACCOUNT") return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE MY ACCOUNT" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(getApiErrorMessage(data, "Failed to delete account"));
      }
      await signOut({ redirectUrl: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avatar</CardTitle>
          <CardDescription>
            Upload a custom avatar, or keep your Clerk profile image
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Avatar"
              className="h-16 w-16 rounded-full border border-zinc-200 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-xs text-zinc-400">
              No photo
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingAvatar}
              onClick={() => avatarInputRef.current?.click()}
            >
              {uploadingAvatar ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
              ) : null}
              Upload avatar
            </Button>
            {customAvatarUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploadingAvatar}
                onClick={clearCustomAvatar}
              >
                Use Clerk photo
              </Button>
            ) : null}
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleAvatarUpload(file);
              e.target.value = "";
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Content preferences</CardTitle>
          <CardDescription>
            Defaults applied when you open AI generators
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="default-tone">Default tone</Label>
            <select
              id="default-tone"
              value={defaultTone}
              onChange={(e) => setDefaultTone(e.target.value)}
              className="flex h-10 w-full max-w-sm rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">No default</option>
              {PREFERENCE_TONES.map((tone) => (
                <option key={tone} value={tone}>
                  {tone}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-generation-type">Preferred tool</Label>
            <select
              id="default-generation-type"
              value={defaultGenerationType}
              onChange={(e) => setDefaultGenerationType(e.target.value)}
              className="flex h-10 w-full max-w-sm rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">No preference</option>
              {PREFERENCE_GENERATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {GENERATION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={marketingOptOut}
              onChange={(e) => setMarketingOptOut(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Opt out of product tips and marketing emails
          </label>

          <Button type="button" onClick={savePreferences} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            ) : null}
            Save preferences
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your data</CardTitle>
          <CardDescription>
            Download a JSON export of your profile, projects, and generations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            ) : null}
            Export all my data
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delete account</CardTitle>
          <CardDescription>
            Permanently delete your Clerk account and all ContentAI data. This
            cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="delete-confirm">
            Type <span className="font-mono">DELETE MY ACCOUNT</span> to confirm
          </Label>
          <input
            id="delete-confirm"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            className="flex h-10 w-full max-w-md rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
            autoComplete="off"
          />
          <Button
            type="button"
            variant="outline"
            disabled={deleting || deleteConfirm !== "DELETE MY ACCOUNT"}
            onClick={handleDelete}
            className="border-red-200 text-red-700 hover:bg-red-50"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            ) : null}
            Delete my account
          </Button>
        </CardContent>
      </Card>

      {message ? (
        <p className="text-sm text-zinc-600" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
