const BASE = "/api/carer";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function put(path: string, body: any): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const carerApi = {
  me: () => get<any>("/me"),
  shifts: () => get<any[]>("/shifts"),
  tasks: () => get<any[]>("/tasks"),
  completeTask: (id: string) => put("/tasks", { id, action: "complete" }),
  handovers: () => get<any[]>("/handovers"),
  clients: () => get<any[]>("/clients"),
  clientDetail: (id: string) => get<{ client: any; medications: any[]; carePlans: any[]; tasks: any[] }>(`/client/${id}`),
};
