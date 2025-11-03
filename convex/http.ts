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
        case "user.updated":
          await ctx.runMutation(internal.users.upsertFromClerk, { 
            data: event.data 
          });
          console.log("✅ User synced:", event.data.id);
          break;

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
      // Still return 200 to prevent Clerk from retrying
      return new Response(JSON.stringify({ 
        success: false, 
        error: err.message 
      }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  })
});

export default http;