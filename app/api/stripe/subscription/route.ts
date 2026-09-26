import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/services/auth-guard";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSubscriptionConfirmation } from "@/lib/services/notification-service";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const adminClient = createAdminClient();

    const { data: org } = await adminClient
      .from("organizations")
      .select("stripe_customer_id, subscription_id, subscription_status, name")
      .eq("id", admin.org_id!)
      .maybeSingle();

    if (!org?.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer found", subscription: null, customerMissing: true }, { status: 404 });
    }

    const stripe = getStripe();

    // Find any subscription for this customer (not just active)
    const subs = await stripe.subscriptions.list({
      customer: org.stripe_customer_id,
      limit: 3,
      status: "all",
    });

    const sub = subs.data.find(s => s.status === "active" || s.status === "trialing") || subs.data[0];
    if (!sub) {
      return NextResponse.json({ subscription: null });
    }

    const seats = sub.items.data[0]?.quantity ?? 0;

    // Only send confirmation email when subscription becomes active for the first time
    const wasActive = org.subscription_status === "active";
    const isNowActive = sub.status === "active" || sub.status === "trialing";

    // Sync to database
    const { error: updateErr } = await adminClient.from("organizations").update({
      subscription_id: sub.id,
      subscription_status: sub.status,
      seats_purchased: seats,
    }).eq("id", admin.org_id!);

    if (updateErr) {
      console.error("DB update error:", updateErr);
    }

    if (!wasActive && isNowActive) {
      try {
        const { data: { user } } = await adminClient.auth.admin.getUserById(admin.id);
        if (user?.email) {
          sendSubscriptionConfirmation(user.email, admin.full_name || "Admin", seats, seats * 10).catch(() => {});
        }
      } catch {
        // Non-blocking
      }
    }

    return NextResponse.json({
      subscription: {
        id: sub.id,
        status: sub.status,
        seats,
        monthlyCost: seats * 10,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Subscription sync error:", error);
    return NextResponse.json({ error: "Failed to sync subscription" }, { status: 500 });
  }
}
