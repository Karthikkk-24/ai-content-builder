import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { createRequestId, logSecurityEvent } from "@/lib/api/response";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

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

  const payload = await req.json();
  const body = JSON.stringify(payload);
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

  if (evt.type === "user.created" || evt.type === "user.updated") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;
    const email = email_addresses?.[0]?.email_address || "";
    const name = [first_name, last_name].filter(Boolean).join(" ") || null;

    try {
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
    } catch (error) {
      console.error("Webhook DB error:", error);
    }
  }

  return new Response("OK", { status: 200 });
}
