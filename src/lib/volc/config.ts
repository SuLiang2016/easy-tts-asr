import { UpstreamError } from "./errors";

/** 火山引擎服务端配置（Key 只存在于服务端，不暴露给前端） */
export const VOLC_CONFIG = {
  apiKey: process.env.VOLC_API_KEY ?? "",
  ttsHttpUrl:
    process.env.VOLC_TTS_HTTP_URL ||
    "https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional",
  ttsResourceId: process.env.VOLC_TTS_RESOURCE_ID || "seed-tts-2.0",
  asrWsUrl:
    process.env.VOLC_ASR_WS_URL ||
    "wss://openspeech.bytedance.com/api/v3/plan/sauc/bigmodel_nostream",
  asrResourceId: process.env.VOLC_ASR_RESOURCE_ID || "volc.seedasr.sauc.duration",
} as const;

export function requireApiKey(): string {
  if (!VOLC_CONFIG.apiKey) {
    throw new UpstreamError("配置", "服务端未配置 VOLC_API_KEY，请在 .env.local 或系统环境变量中设置");
  }
  return VOLC_CONFIG.apiKey;
}
