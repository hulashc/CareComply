import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

type AuditEntry = {
  action: string;
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
  orgId?: string | null;
  details?: string | null;
};

export async function logAudit(entry: AuditEntry) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("audit_logs").insert({
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      actor_id: entry.actorId ?? undefined,
      org_id: entry.orgId ?? undefined,
      details: entry.details ?? null,
    });
    if (error) console.error("[Audit] Failed:", error.message);

    // Also write to analytics_events for trend reporting
    supabase.from("analytics_events").insert({
      org_id: entry.orgId ?? undefined,
      event_type: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? undefined,
      actor_id: entry.actorId ?? undefined,
      metadata: entry.details ? { details: entry.details } as Json : undefined,
    }).then(({ error: e }) => { if (e) console.error("[Analytics] Failed:", e.message); });
  } catch {
  }
}

export async function logAnalyticsEvent(
  orgId: string,
  eventType: string,
  metadata?: Record<string, unknown>,
) {
  try {
    const supabase = createAdminClient();
    await supabase.from("analytics_events").insert({
      org_id: orgId,
      event_type: eventType,
      metadata: metadata as Json ?? undefined,
    });
  } catch {
  }
}
