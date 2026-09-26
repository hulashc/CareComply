import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

let wsTransport: any = undefined;
if (typeof globalThis !== "undefined" && !globalThis.WebSocket) {
  try {
    const { WebSocket } = require("ws");
    wsTransport = WebSocket;
  } catch {}
}

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      ...(wsTransport ? { realtime: { transport: wsTransport } } : {}),
    }
  );
}
