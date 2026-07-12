export const clerkConfig = {
  signInUrl: "/sign-in",
  signUpUrl: "/sign-up",
  afterSignInUrl: "/dashboard",
  afterSignUpUrl: "/dashboard",
  signInFallbackRedirectUrl: "/dashboard",
  signUpFallbackRedirectUrl: "/dashboard",
  signInForceRedirectUrl: "/dashboard",
  signUpForceRedirectUrl: "/dashboard",
} as const;

export function isClerkConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY
  );
}
