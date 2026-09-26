import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CATEGORY_TO_DOC_TYPE: Record<string, string> = {
  passport: "Passport",
  visa_brp: "Visa / BRP",
  sharecode: "Sharecode",
  address_proof: "Proof of Address",
  dbs_certificate: "DBS Certificate",
  driving_licence: "Driving Licence",
  other: "Other Document",
};

export function isAllowedUrl(url: string): boolean {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) return false;
    const parsed = new URL(url);
    const allowed = new URL(appUrl);
    return parsed.origin === allowed.origin;
  } catch {
    return false;
  }
}

export const hasEnvVars =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function validateEnv() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "CRON_SECRET",
    "NEXT_PUBLIC_APP_URL",
  ] as const;

  const optional = [
    "RESEND_API_KEY",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "OLLAMA_BASE_URL",
    "OLLAMA_MODEL",
    "GROQ_API_KEY",
    "AI_MODEL",
    "TESSERACT_LANG",
  ] as const;

  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.warn("[CareComply] Missing required env vars:", missing.join(", "));
    console.warn("[CareComply] Application may not function correctly.");
  }

  const optionalMissing: string[] = [];
  for (const key of optional) {
    if (!process.env[key]) {
      optionalMissing.push(key);
    }
  }

  if (optionalMissing.length > 0) {
    console.info("[CareComply] Optional env vars not set:", optionalMissing.join(", "));
    console.info("[CareComply] Some features (email notifications) will run in fallback mode.");
  }

  return missing.length === 0;
}
