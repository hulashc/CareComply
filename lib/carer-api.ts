const BASE = "/api/carer";

export type CarerRecord = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  start_date: string | null;
  location_name?: string | null;
  [key: string]: unknown;
};

export type CarerClientSummary = {
  id: string;
  full_name: string;
  [key: string]: unknown;
};

type ClientJoin = { full_name: string } | { full_name: string }[] | null;

export function clientJoinName(c: ClientJoin): string {
  const x = Array.isArray(c) ? c[0] : c;
  return x?.full_name ?? "";
}

export type CarerShift = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  client_id: string;
  clients: ClientJoin;
  [key: string]: unknown;
};

export type CarerTask = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  client_id: string;
  clients: ClientJoin;
  [key: string]: unknown;
};

export type CarerHandover = {
  id: string;
  note_text: string;
  is_read: boolean;
  created_at: string;
  tasks_remaining: string | null;
  client_id: string;
  clients: ClientJoin;
  [key: string]: unknown;
};

export type CarerClientDetail = {
  client: Record<string, unknown> | null;
  medications: Record<string, unknown>[];
  carePlans: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function put(path: string, body: Record<string, unknown>): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const carerApi = {
  me: () => get<CarerRecord>("/me"),
  shifts: () => get<CarerShift[]>("/shifts"),
  tasks: () => get<CarerTask[]>("/tasks"),
  completeTask: (id: string) => put("/tasks", { id, action: "complete" }),
  handovers: () => get<CarerHandover[]>("/handovers"),
  clients: () => get<CarerClientSummary[]>("/clients"),
  clientDetail: (id: string) => get<CarerClientDetail>(`/client/${id}`),
};
