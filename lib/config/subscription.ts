export const SUBSCRIPTION_CONFIG = {
  pricePerSeat: 10,
  currency: "gbp",
  productName: "CareComply Carer Seat",
  productDescription: "Per-carer monthly subscription for CareComply compliance management.",
} as const;

export const SUBSCRIPTION_STATUS = {
  ACTIVE: "active",
  PAST_DUE: "past_due",
  CANCELED: "canceled",
  INCOMPLETE: "incomplete",
  INCOMPLETE_EXPIRED: "incomplete_expired",
  UNPAID: "unpaid",
  PAUSED: "paused",
} as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

export function isSubscriptionActive(status: string | null): boolean {
  if (!status) return false;
  return status === SUBSCRIPTION_STATUS.ACTIVE;
}
