import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SignInSSOCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}
