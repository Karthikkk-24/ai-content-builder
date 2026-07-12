import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { touchUserSession } from "@/lib/session";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  if (userId) {
    touchUserSession(userId).catch(() => {});
  }

  if (!isPublicRoute(req)) {
    const signInUrl = new URL("/sign-in", req.url);
    await auth.protect({
      unauthenticatedUrl: signInUrl.toString(),
    });
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
