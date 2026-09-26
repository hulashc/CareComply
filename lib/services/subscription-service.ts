import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUBSCRIPTION_CONFIG, SUBSCRIPTION_STATUS } from "@/lib/config/subscription";

export interface OrgSubscription {
  id: string;
  name: string;
  stripe_customer_id: string | null;
  subscription_id: string | null;
  subscription_status: string | null;
  seats_purchased: number | null;
}

export async function getOrgSubscription(orgId: string): Promise<OrgSubscription | null> {
  const supabase = createAdminClient();
  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, name, stripe_customer_id, subscription_id, subscription_status, seats_purchased")
    .eq("id", orgId)
    .single();

  if (error) return null;
  return org;
}

export async function getOrCreateStripeCustomer(
  orgId: string,
  orgName: string
): Promise<string> {
  const supabase = createAdminClient();
  const { data: org, error } = await supabase
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", orgId)
    .single();

  if (error) return "";
  if (org?.stripe_customer_id) {
    return org.stripe_customer_id;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: orgName,
    metadata: { org_id: orgId },
  });

  await supabase
    .from("organizations")
    .update({ stripe_customer_id: customer.id })
    .eq("id", orgId);

  return customer.id;
}

export async function createCheckoutSession(orgId: string, successUrl: string, cancelUrl: string, seats?: number) {
  const org = await getOrgSubscription(orgId);
  if (!org) throw new Error("Organization not found");

  const stripeCustomerId = await getOrCreateStripeCustomer(orgId, org.name);
  const stripe = getStripe();

  const carerCount = await getCarerCount(orgId);
  const quantity = seats && seats > 0 ? seats : Math.max(carerCount, 1);

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: SUBSCRIPTION_CONFIG.currency,
          product_data: {
            name: SUBSCRIPTION_CONFIG.productName,
            description: SUBSCRIPTION_CONFIG.productDescription,
          },
          recurring: { interval: "month" },
          unit_amount: SUBSCRIPTION_CONFIG.pricePerSeat * 100,
        },
        quantity,
      },
    ],
    subscription_data: {
      metadata: { org_id: orgId },
    },
    allow_promotion_codes: true,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return { url: session.url };
}

export async function createCustomerPortalSession(orgId: string, returnUrl: string) {
  const org = await getOrgSubscription(orgId);
  if (!org) throw new Error("Organization not found");
  if (!org.stripe_customer_id) throw new Error("No Stripe customer found");

  const stripe = getStripe();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: returnUrl,
    configuration: await getOrCreatePortalConfig(stripe),
  });

  return { url: portalSession.url };
}

async function getOrCreatePortalConfig(stripe: ReturnType<typeof getStripe>) {
  const configs = await stripe.billingPortal.configurations.list({ limit: 1, active: true });
  if (configs.data.length > 0) {
    return configs.data[0].id;
  }

  const config = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: "CareComply Subscription Management",
    },
    features: {
      subscription_update: { enabled: true, default_allowed_updates: ["price", "quantity"] },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
    },
  });

  return config.id;
}

export async function syncSubscriptionFromStripe(subscription: {
  id: string;
  status: string;
  customer: string;
  items: { data: Array<{ quantity: number }> };
}) {
  const supabase = createAdminClient();

  const { data: org, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("stripe_customer_id", subscription.customer)
    .single();

  if (error || !org) return;

  const seats = subscription.items.data[0]?.quantity ?? 0;

  await supabase
    .from("organizations")
    .update({
      subscription_id: subscription.id,
      subscription_status: subscription.status,
      seats_purchased: seats,
    })
    .eq("id", org.id);
}

export async function handleSubscriptionDeleted(subscription: { id: string; customer: string }) {
  const supabase = createAdminClient();

  const { data: org2, error: orgErr2 } = await supabase
    .from("organizations")
    .select("id")
    .eq("stripe_customer_id", subscription.customer)
    .single();

  if (orgErr2 || !org2) return;

  await supabase
    .from("organizations")
    .update({
      subscription_id: null,
      subscription_status: SUBSCRIPTION_STATUS.CANCELED,
      seats_purchased: 0,
    })
    .eq("id", org2.id);
}

async function getCarerCount(orgId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("carers")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);
  return count ?? 0;
}
