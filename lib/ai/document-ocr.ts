import { createWorker } from "tesseract.js";
import { createAdminClient } from "@/lib/supabase/admin";

export type OcrResult = {
  text: string;
  confidence: number;
};

export async function runOcr(fileBuffer: Buffer): Promise<OcrResult> {
  const lang = process.env.TESSERACT_LANG || "eng";
  const worker = await createWorker(lang);

  try {
    const { data } = await worker.recognize(fileBuffer);

    return {
      text: data.text?.trim() ?? "",
      confidence: data.confidence ?? 0,
    };
  } finally {
    await worker.terminate();
  }
}

export async function downloadFromStorage(
  bucket: string,
  filePath: string
): Promise<Buffer | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(bucket).download(filePath);
  if (error || !data) return null;

  const buffer = Buffer.from(await data.arrayBuffer());
  return buffer;
}
