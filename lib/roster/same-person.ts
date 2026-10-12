// A client can never be their own carer. One rule, shared by the server's assignment checks and the
// calendar / visit form, so the two can never disagree.

export const SAME_PERSON_MESSAGE = "A client cannot be their own carer. Choose a different carer.";

/** Names compare ignoring case and extra whitespace. */
export function normaliseName(name: string | null | undefined): string {
  return (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

interface Party {
  id?: string | null;
  name?: string | null;
}

/** True when the client and carer are the same person: same id, or the same name. */
export function isSamePerson(client: Party, carer: Party): boolean {
  if (client.id && carer.id && client.id === carer.id) return true;
  const a = normaliseName(client.name);
  return a !== "" && a === normaliseName(carer.name);
}
