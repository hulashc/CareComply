import { getRedis } from "@/lib/redis";

export type JobType =
  | "email:invite"
  | "email:approval"
  | "email:rejection"
  | "email:welcome"
  | "email:expiry_alert"
  | "email:subscription"
  | "report:compliance_export"
  | "report:incident_export"
  | "ai:document_ocr";

export type JobPayload = Record<string, unknown>;

export type Job = {
  id: string;
  type: JobType;
  payload: JobPayload;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  error?: string;
};

const QUEUE_KEY = "carecomply:jobs:pending";
const PROCESSING_KEY = "carecomply:jobs:processing";
const RESULT_PREFIX = "carecomply:jobs:result:";
const MAX_ATTEMPTS = 3;

export async function dispatchJob(type: JobType, payload: JobPayload): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;

  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job: Job = {
    id,
    type,
    payload,
    status: "pending",
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    createdAt: new Date().toISOString(),
  };

  await redis.lpush(QUEUE_KEY, JSON.stringify(job));
  return id;
}

export async function getJobResult(jobId: string): Promise<Job | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.get<string>(`${RESULT_PREFIX}${jobId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function processNextJob(): Promise<Job | null> {
  const redis = getRedis();
  if (!redis) return null;

  const raw = await redis.rpop(QUEUE_KEY);
  if (!raw) return null;

  const job: Job = JSON.parse(raw);
  job.status = "processing";
  job.attempts++;

  await redis.set(`${PROCESSING_KEY}:${job.id}`, JSON.stringify(job), { ex: 300 });

  try {
    await runJob(job);
    job.status = "completed";
  } catch (err) {
    job.error = err instanceof Error ? err.message : "Unknown error";
    if (job.attempts < job.maxAttempts) {
      job.status = "pending";
      await redis.lpush(QUEUE_KEY, JSON.stringify(job));
    } else {
      job.status = "failed";
    }
  }

  await redis.del(`${PROCESSING_KEY}:${job.id}`);
  await redis.set(`${RESULT_PREFIX}${job.id}`, JSON.stringify(job), { ex: 86400 });

  return job;
}

async function runJob(job: Job) {
  const { processEmailJob } = await import("./email-jobs");
  const { processReportJob } = await import("./report-jobs");
  const { processDocumentJob } = await import("./document-jobs");

  if (job.type.startsWith("email:")) {
    await processEmailJob(job);
  } else if (job.type.startsWith("report:")) {
    await processReportJob(job);
  } else if (job.type.startsWith("ai:")) {
    await processDocumentJob(job);
  }
}
