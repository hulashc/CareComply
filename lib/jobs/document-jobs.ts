import type { Job } from "./queue";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadFromStorage, runOcr } from "@/lib/ai/document-ocr";
import { classifyDocument, verifyDocument } from "@/lib/ai/document-classify";
import type { TablesUpdate } from "@/lib/database.types";

export async function processDocumentJob(job: Job): Promise<void> {
  const p = job.payload;

  switch (job.type) {
    case "ai:document_ocr": {
      const docId = p.documentId as string;
      const bucket = (p.bucket as string) || "applicant-documents";
      const filePath = p.filePath as string;
      const applicantName = (p.applicantName as string) || null;

      await processDocumentOcr(docId, bucket, filePath, applicantName);
      break;
    }
    default:
      throw new Error(`Unknown AI job type: ${job.type}`);
  }
}

async function processDocumentOcr(
  docId: string,
  bucket: string,
  filePath: string,
  applicantName: string | null,
): Promise<void> {
  const supabase = createAdminClient();

  const buffer = await downloadFromStorage(bucket, filePath);
  if (!buffer) {
    throw new Error(`Failed to download file from ${bucket}/${filePath}`);
  }

  const ocrResult = await runOcr(buffer);

  const classification = await classifyDocument(
    filePath.split("/").pop() || filePath,
    ocrResult.text,
  );

  const verification = applicantName
    ? await verifyDocument(classification.documentTypeName, ocrResult.text, applicantName)
    : null;

  let docTypeId: string | null = null;
  if (classification.documentTypeName) {
    const { data: existing } = await supabase
      .from("document_types")
      .select("id")
      .eq("name", classification.documentTypeName)
      .maybeSingle();

    if (existing) {
      docTypeId = existing.id;
    }
  }

  const updateData: Partial<TablesUpdate<"documents">> = {
    extracted_data: {
      ocr_text: ocrResult.text.slice(0, 10000),
      document_type_classified: classification.documentTypeName,
      document_number: classification.documentNumber,
      extracted_name: classification.extractedName,
      issue_date: classification.issueDate,
      classification_confidence: classification.confidence,
      ...(verification ? {
        name_match: verification.nameMatch,
        name_explanation: verification.nameExplanation,
        overall_verified: verification.overallMatch,
        discrepancies: verification.discrepancies,
      } : {}),
    },
    confidence_scores: {
      ocr_confidence: Math.round(ocrResult.confidence),
      classification_confidence: classification.confidence,
    },
  };

  if (classification.expiryDate) {
    updateData.expiry_date = classification.expiryDate;
  }
  if (docTypeId) {
    updateData.document_type_id = docTypeId;
  }

  const { error } = await supabase
    .from("documents")
    .update(updateData)
    .eq("id", docId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to update document ${docId}: ${error.message}`);
  }
}
