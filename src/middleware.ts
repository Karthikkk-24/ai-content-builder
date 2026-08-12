import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { appContentSecurityPolicy } from "@/lib/csp";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/share(.*)",
  "/api/webhooks(.*)",
  "/api/share(.*)",
  "/api/health(.*)",
]);

const isAuthOrLanding = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(
  async (auth, req) => {
    const { userId } = await auth();
    const dashboardUrl = new URL("/dashboard", req.url);

    if (userId && isAuthOrLanding(req)) {
      return NextResponse.redirect(dashboardUrl);
    }

    if (!isPublicRoute(req)) {
      await auth.protect({
        unauthenticatedUrl: new URL("/sign-in", req.url).toString(),
      });
    }

    return NextResponse.next();
  },
  {
    contentSecurityPolicy: appContentSecurityPolicy,
  }
);

export const config = {
  matcher: [
    // Skip Next internals, static assets, and health probes (no Clerk dependency).
    "/((?!_next|api/health|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
