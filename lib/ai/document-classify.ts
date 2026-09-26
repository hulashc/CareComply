import { generateObject } from "ai";
import { getModel } from "./client";

export type DocumentClassification = {
  documentTypeName: string;
  expiryDate: string | null;
  issueDate: string | null;
  documentNumber: string | null;
  extractedName: string | null;
  confidence: "high" | "medium" | "low";
};

export type VerificationResult = {
  nameMatch: boolean;
  nameExplanation: string | null;
  overallMatch: boolean;
  discrepancies: string[];
};

export async function classifyDocument(
  fileName: string,
  ocrText: string
): Promise<DocumentClassification> {
  const prompt = `Analyze this document and extract key information.

File name: ${fileName}
OCR text:
${ocrText}

Extract:
- documentTypeName: What type of document is this? (Passport, Visa/BRP, DBS Certificate, Driving Licence, Proof of Address, Sharecode, Other Document)
- expiryDate: Expiry date in YYYY-MM-DD format (null if not found)
- issueDate: Issue date in YYYY-MM-DD format (null if not found)
- documentNumber: Document/ID number (null if not found)
- extractedName: Full name found on the document (null if not found)
- confidence: How confident are you of this classification? (high/medium/low)

Respond with valid JSON only (no markdown, no explanation):
{"documentTypeName": "...", "expiryDate": "...", "issueDate": "...", "documentNumber": "...", "extractedName": "...", "confidence": "..."}`;

  const { object } = await generateObject({
    model: getModel(),
    prompt,
    output: "no-schema",
  });

  const result = object as Record<string, string | null>;
  return {
    documentTypeName: (result.documentTypeName as string) || "Other Document",
    expiryDate: (result.expiryDate as string) || null,
    issueDate: (result.issueDate as string) || null,
    documentNumber: (result.documentNumber as string) || null,
    extractedName: (result.extractedName as string) || null,
    confidence: (result.confidence as "high" | "medium" | "low") || "low",
  };
}

export async function verifyDocument(
  docTypeName: string,
  ocrText: string,
  applicantName: string | null
): Promise<VerificationResult> {
  if (!applicantName) {
    return { nameMatch: false, nameExplanation: null, overallMatch: true, discrepancies: [] };
  }

  const prompt = `Verify this ${docTypeName} document against the applicant's name.

Document text:
${ocrText.slice(0, 2000)}

Applicant name: ${applicantName}

Does the name on the document match the applicant name? Check for:
- Exact match
- Minor differences (middle name, nickname, spelling variation)
- Major differences (completely different name)

Respond with valid JSON only (no markdown, no explanation):
{"nameMatch": true/false, "nameExplanation": "...", "overallMatch": true/false, "discrepancies": ["..."]}`;

  const { object } = await generateObject({
    model: getModel(),
    prompt,
    output: "no-schema",
  });

  const result = object as Record<string, unknown>;
  return {
    nameMatch: result.nameMatch === true,
    nameExplanation: (result.nameExplanation as string) || null,
    overallMatch: result.overallMatch === true,
    discrepancies: (result.discrepancies as string[]) || [],
  };
}
