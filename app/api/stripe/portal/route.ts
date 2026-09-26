import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/services/auth-guard";
import { createCustomerPortalSession } from "@/lib/services/subscription-service";
import { isAllowedUrl } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const { returnUrl } = await req.json();

    if (!returnUrl) {
      return NextResponse.json({ error: "returnUrl is required" }, { status: 400 });
    }

    if (!isAllowedUrl(returnUrl)) {
      return NextResponse.json({ error: "Invalid redirect URL" }, { status: 400 });
    }

    const result = await createCustomerPortalSession(admin.org_id!, returnUrl);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
