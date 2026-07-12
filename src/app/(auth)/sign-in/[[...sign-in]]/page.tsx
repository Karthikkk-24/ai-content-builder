import { SignIn } from "@clerk/nextjs";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { clerkConfig } from "@/lib/clerk-config";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-zinc-900">Sign in</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Welcome back to ContentAI
          </p>
        </div>

        <GoogleSignInButton />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-zinc-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-zinc-50 px-2 text-zinc-400">or</span>
          </div>
        </div>

        <SignIn
          routing="path"
          path={clerkConfig.signInUrl}
          signUpUrl={clerkConfig.signUpUrl}
          forceRedirectUrl={clerkConfig.afterSignInUrl}
          fallbackRedirectUrl={clerkConfig.afterSignInUrl}
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "border border-zinc-200 shadow-none w-full",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtons: "hidden",
              dividerRow: "hidden",
              formButtonPrimary: "bg-zinc-900 hover:bg-zinc-800",
            },
          }}
        />
      </div>
    </div>
  );
}
