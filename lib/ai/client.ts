import { createOpenAI } from "@ai-sdk/openai";

function createAIClient() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
  const baseURL = process.env.GROQ_API_KEY
    ? "https://api.groq.com/openai/v1"
    : process.env.OPENAI_API_KEY
      ? "https://api.openai.com/v1"
      : process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
  const modelName = process.env.AI_MODEL || (process.env.GROQ_API_KEY ? "llama3-8b-8192" : process.env.OPENAI_API_KEY ? "gpt-4o-mini" : "llama3");
  const provider = createOpenAI({ baseURL, apiKey: apiKey || "ollama" });
  return provider(modelName);
}

export function getModel() {
  return createAIClient();
}
