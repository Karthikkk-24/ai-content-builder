import { Webhook } from "svix";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { WebhookEvent } from "@clerk/nextjs/server";
import {
  createRequestId,
  logAction,
  logSecurityEvent,
} from "@/lib/api/response";
import { readRawBody, WEBHOOK_BODY_LIMIT_BYTES } from "@/lib/api/read-json";
import { invalidateUserCache } from "@/lib/cache";
import { resolveClerkPrimaryEmail } from "@/lib/clerk-email";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/** Svix default is 5 minutes; set explicitly to document the replay window. */
const SVIX_TOLERANCE_SECONDS = 300;

export async function POST(req: Request) {
  const requestId = createRequestId();
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    logSecurityEvent({
      type: "webhook_failure",
      requestId,
      action: "clerk.webhook",
      reason: "Webhook secret not configured",
      status: 500,
    });
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    logSecurityEvent({
      type: "webhook_failure",
      requestId,
      action: "clerk.webhook",
      reason: "Missing svix headers",
      status: 400,
    });
    return new Response("Missing svix headers", { status: 400 });
  }

  // Reject stale timestamps before buffering the body (DoS).
  const timestampSeconds = Number(svixTimestamp);
  if (
    !Number.isFinite(timestampSeconds) ||
    Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) >
      SVIX_TOLERANCE_SECONDS
  ) {
    logSecurityEvent({
      type: "webhook_failure",
      requestId,
      action: "clerk.webhook",
      reason: "Stale or invalid svix timestamp",
      status: 400,
      detail: svixId,
    });
    return new Response("Stale webhook timestamp", { status: 400 });
  }

  const rawBody = await readRawBody(req, WEBHOOK_BODY_LIMIT_BYTES);
  if (!rawBody.ok) {
    logSecurityEvent({
      type: "webhook_failure",
      requestId,
      action: "clerk.webhook",
      reason: rawBody.message,
      status: rawBody.status,
      detail: svixId,
    });
    return new Response(rawBody.message, { status: rawBody.status });
  }

  // Raw UTF-8 text so signature bytes match what Clerk signed.
  const body = rawBody.text;

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;
  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    logSecurityEvent({
      type: "webhook_failure",
      requestId,
      action: "clerk.webhook",
      reason: "Invalid signature",
      status: 400,
      detail: svixId,
    });
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    if (evt.type === "user.created" || evt.type === "user.updated") {
      const {
        id,
        email_addresses,
        primary_email_address_id,
        first_name,
        last_name,
        image_url,
      } = evt.data;
      const email = resolveClerkPrimaryEmail(
        email_addresses,
        primary_email_address_id
      );
      const name = [first_name, last_name].filter(Boolean).join(" ") || null;

      await db
        .insert(users)
        .values({
          id,
          email,
          name,
          avatarUrl: image_url,
        })
        .onConflictDoUpdate({
          target: users.id,
          set: { email, name, avatarUrl: image_url },
        });

      await invalidateUserCache(id);

      logAction({
        requestId,
        action: `clerk.${evt.type}`,
        userId: id,
        outcome: "success",
        resource: svixId,
      });
    } else if (evt.type === "user.deleted") {
      const { id } = evt.data;
      if (id) {
        // Cascades to projects, generations, and reference_images via FKs.
        await db.delete(users).where(eq(users.id, id));
        await invalidateUserCache(id);
        logAction({
          requestId,
          action: "clerk.user.deleted",
          userId: id,
          outcome: "success",
          resource: svixId,
        });
      }
    }
  } catch (error) {
    console.error("Webhook DB error:", error);
    logSecurityEvent({
      type: "webhook_failure",
      requestId,
      action: "clerk.webhook",
      reason: "Database error while processing webhook",
      status: 500,
      detail: evt.type,
    });
    // Non-2xx so Clerk retries.
    return new Response("Webhook handler failed", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
