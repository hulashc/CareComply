import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/services/auth-guard";
import { createCheckoutSession } from "@/lib/services/subscription-service";
import { isAllowedUrl } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const { successUrl, cancelUrl, seats } = await req.json();

    if (!successUrl || !cancelUrl) {
      return NextResponse.json({ error: "successUrl and cancelUrl are required" }, { status: 400 });
    }

    if (!isAllowedUrl(successUrl) || !isAllowedUrl(cancelUrl)) {
      return NextResponse.json({ error: "Invalid redirect URL" }, { status: 400 });
    }

    const result = await createCheckoutSession(admin.org_id!, successUrl, cancelUrl, seats);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
