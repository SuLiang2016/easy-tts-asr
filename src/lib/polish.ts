import { polishText } from "@/app/actions-llm";
import type { LLMConfig } from "@/lib/use-llm-config";

export interface PolishOutcome {
  ok: boolean;
  text?: string;
  error?: string;
}

/**
 * AI 润色的通用调用（TTS / ASR 页共用）：
 * 调用 Server Action 并把结果归一为 { ok, text | error }。
 */
export async function applyPolish(text: string, config: LLMConfig): Promise<PolishOutcome> {
  const result = await polishText({ text: text.trim(), config });
  if (result.success && result.polishedText) {
    return { ok: true, text: result.polishedText };
  }
  return { ok: false, error: result.error || "润色失败" };
}
