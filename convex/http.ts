/**
 * convex/http.ts
 * HTTP endpoints for external integrations
 * Includes Clerk webhook handler for user sync
 */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Webhook } from "svix";

const http = httpRouter();

/**
 * POST /clerk-users-webhook
 * Receives Clerk webhook events for user management
 * Validates Svix signature and processes user.created, user.updated, user.deleted events
 */
http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Get webhook secret from environment
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error("CLERK_WEBHOOK_SECRET not configured in Convex environment");
      return new Response("Webhook not configured", { status: 500 });
    }

    // Extract payload and Svix headers
    const payload = await request.text();
    const svixHeaders = {
      "svix-id": request.headers.get("svix-id") || "",
      "svix-timestamp": request.headers.get("svix-timestamp") || "",
      "svix-signature": request.headers.get("svix-signature") || "",
    };

    // Validate signature with Svix
    const wh = new Webhook(webhookSecret);
    let event: any;
    
    try {
      event = wh.verify(payload, svixHeaders);
    } catch (err) {
      const error = err as Error;
      console.error("❌ Invalid Clerk webhook signature:", error.message);
      return new Response("Invalid signature", { status: 400 });
    }

    // Process event based on type
    console.log("📥 Received Clerk webhook:", event.type, "for user:", event.data?.id);

    try {
      switch (event.type) {
        case "user.created":
        case "user.updated": {
          let data = event.data;
          const existing = await ctx.runQuery(internal.users.getUserByClerkIdInternal, {
            clerkId: data.id,
          });
          // Bootstrap missing source versions from Clerk, not a potentially stale event.
          if (existing?.clerkUpdatedAt === undefined) {
            const secret = process.env.CLERK_SECRET_KEY;
            if (!secret) throw new Error("CLERK_SECRET_KEY not configured");
            const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(data.id)}`, {
              headers: { Authorization: `Bearer ${secret}` },
            });
            if (response.status === 404) {
              await ctx.runMutation(internal.users.deleteFromClerk, { clerkUserId: data.id });
              break;
            }
            if (!response.ok) throw new Error(`Failed to fetch Clerk user: ${response.status}`);
            const current = await response.json();
            if (current.id !== data.id) throw new Error("Clerk user ID mismatch");
            data = current;
          }
          await ctx.runMutation(internal.users.upsertFromClerk, { 
            data,
          });
          console.log("✅ User synced:", event.data.id);
          break;
        }

        case "user.deleted":
          await ctx.runMutation(internal.users.deleteFromClerk, { 
            clerkUserId: event.data.id 
          });
          console.log("✅ User deleted:", event.data.id);
          break;

        default:
          console.log("ℹ️ Ignored Clerk webhook event type:", event.type);
      }

      return new Response(JSON.stringify({ success: true }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
      
    } catch (error) {
      const err = error as Error;
      console.error("❌ Error processing webhook:", err.message);
      // Let Clerk retry failed synchronization instead of acknowledging lost data.
      return new Response(JSON.stringify({ 
        success: false, 
        error: err.message 
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  })
});

export default http;
