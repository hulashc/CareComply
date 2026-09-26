export function classifyIncident(title: string, description: string): string {
  return `Classify this incident report into severity and category.

Title: ${title}
Description: ${description}

Severity options: low, medium, high, critical
Category examples: fall, medication, behaviour, safeguarding, equipment, infection, moving_handling, other

Respond with valid JSON only (no markdown, no explanation):
{"severity": "...", "category": "..."}`;
}


export function summarizeCareNotes(clientName: string, startDate: string, endDate: string, notes: string): string {
  return `Summarize these care notes for ${clientName} from ${startDate} to ${endDate}.

Notes:
${notes}

Provide a concise summary covering: mood trends, fluid/nutrition changes, any concerns, and overall wellbeing.

Respond with valid JSON only (no markdown, no explanation):
{"summary": "...", "mood_trend": "...", "concerns": ["..."]}`;
}
