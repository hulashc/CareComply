"use client";

import { useState, useEffect, useCallback } from "react";

export interface SubscriptionData {
  status: string | null;
  carerCount: number;
  seatsPurchased: number;
  loading: boolean;
  dismissed: boolean;
}

export function useSubscription() {
  const [data, setData] = useState<SubscriptionData>({
    status: null,
    carerCount: 0,
    seatsPurchased: 0,
    loading: true,
    dismissed: typeof window !== "undefined" && sessionStorage.getItem("sub_banner_dismissed") === "true",
  });

  useEffect(() => {
    async function check() {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) { setData(prev => ({ ...prev, loading: false })); return; }

        const { data: admin } = await supabase
          .from("admins").select("org_id").eq("id", userData.user.id).single();
        if (!admin?.org_id) { setData(prev => ({ ...prev, loading: false })); return; }

        const [orgRes, carerRes] = await Promise.all([
          supabase.from("organizations").select("subscription_status, seats_purchased").eq("id", admin.org_id).single(),
          supabase.from("carers").select("*", { count: "exact", head: true }).eq("org_id", admin.org_id),
        ]);

        setData(prev => ({
          ...prev,
          status: orgRes.data?.subscription_status ?? null,
          carerCount: carerRes.count ?? 0,
          seatsPurchased: orgRes.data?.seats_purchased ?? 0,
          loading: false,
        }));
      } catch {
        setData(prev => ({ ...prev, loading: false }));
      }
    }
    check();
  }, []);

  const dismiss = useCallback(() => {
    sessionStorage.setItem("sub_banner_dismissed", "true");
    setData(prev => ({ ...prev, dismissed: true }));
  }, []);

  const undismiss = useCallback(() => {
    sessionStorage.removeItem("sub_banner_dismissed");
    setData(prev => ({ ...prev, dismissed: false }));
  }, []);

  return { ...data, dismiss, undismiss };
}

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
