import { describe, expect, it } from "vitest";
import { batchSchema } from "./schemas";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const snap = (over: Record<string, unknown> = {}) => ({
  id: id(1),
  client_id: id(2),
  start_time: "2026-03-02T09:00:00.000Z",
  end_time: "2026-03-02T10:00:00.000Z",
  required_carers: 1,
  carer_ids: [id(3)],
  ...over,
});

describe("batchSchema", () => {
  it("accepts a normal move", () => {
    expect(batchSchema.safeParse({ upserts: [snap()] }).success).toBe(true);
  });

  it("rejects an empty batch", () => {
    expect(batchSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a visit that ends before it starts", () => {
    expect(batchSchema.safeParse({ upserts: [snap({ end_time: "2026-03-02T08:00:00.000Z" })] }).success).toBe(false);
  });

  it("rejects more carers than the visit needs, and duplicate carers", () => {
    expect(batchSchema.safeParse({ upserts: [snap({ carer_ids: [id(3), id(4)] })] }).success).toBe(false);
    expect(batchSchema.safeParse({ upserts: [snap({ required_carers: 2, carer_ids: [id(3), id(3)] })] }).success).toBe(false);
  });

  it("allows a double-up with two different carers", () => {
    expect(batchSchema.safeParse({ upserts: [snap({ required_carers: 2, carer_ids: [id(3), id(4)] })] }).success).toBe(true);
  });

  it("requires a reason to force an override", () => {
    expect(batchSchema.safeParse({ upserts: [snap()], force: true }).success).toBe(false);
    expect(batchSchema.safeParse({ upserts: [snap()], force: true, reason: "ok" }).success).toBe(false);
    expect(batchSchema.safeParse({ upserts: [snap()], force: true, reason: "Client asked for Ann" }).success).toBe(true);
  });

  it("rejects the same visit twice, or both saved and deleted", () => {
    expect(batchSchema.safeParse({ upserts: [snap(), snap()] }).success).toBe(false);
    expect(batchSchema.safeParse({ upserts: [snap()], deletes: [{ id: id(1) }] }).success).toBe(false);
  });

  it("rejects unknown fields", () => {
    expect(batchSchema.safeParse({ upserts: [snap({ status: "confirmed" })] }).success).toBe(false);
  });
});
