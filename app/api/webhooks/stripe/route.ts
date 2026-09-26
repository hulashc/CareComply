import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { syncSubscriptionFromStripe, handleSubscriptionDeleted } from "@/lib/services/subscription-service";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const sub = (await stripe.subscriptions.retrieve(session.subscription as string)) as unknown as Stripe.Subscription;
          await syncSubscriptionFromStripe({
            id: sub.id,
            status: sub.status,
            customer: sub.customer as string,
            items: { data: sub.items.data.map((i) => ({ quantity: i.quantity ?? 0 })) },
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscriptionFromStripe({
          id: sub.id,
          status: sub.status,
          customer: sub.customer as string,
          items: { data: sub.items.data.map((i) => ({ quantity: i.quantity ?? 0 })) },
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await handleSubscriptionDeleted({
          id: sub.id,
          customer: sub.customer as string,
        });
        break;
      }
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
