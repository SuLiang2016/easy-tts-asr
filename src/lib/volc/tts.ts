import { VOLC_CONFIG, requireApiKey } from "./config";
import { truncateForDisplay, UpstreamError } from "./errors";
import { mapTtsAdjustments } from "./tts-params";

export interface TTSOptions {
  text: string;
  voiceType: string;
  /** 语速倍率，1.0 = 不变（映射到 speech_rate） */
  speed?: number;
  /** 音量倍率，1.0 = 不变（映射到 loudness_rate） */
  volume?: number;
  /** 音调倍率，1.0 = 不变（映射到 pitch 半音） */
  pitch?: number;
  encoding?: "mp3" | "wav" | "pcm" | "ogg_opus";
}

export interface TTSResult {
  audioBase64: string;
  encoding: string;
  sampleRate: number;
}

const TTS_SAMPLE_RATE = 24000;
const TTS_TIMEOUT_MS = 60_000;

function logIdOf(response: Response): string {
  return response.headers.get("X-Tt-Logid") || response.headers.get("x-tt-logid") || "";
}

/**
 * 通过 HTTP 单向流式接口合成语音（Agent Plan 端点）。
 * 语速/音量/音调仅在偏离默认值时下发，避免默认请求行为变化。
 */
export async function synthesizeSpeech(options: TTSOptions): Promise<TTSResult> {
  const apiKey = requireApiKey();
  const { text, voiceType, encoding = "mp3" } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Connection": "keep-alive",
    "X-Api-Key": apiKey,
    "X-Api-Request-Id": crypto.randomUUID(),
    "X-Api-Resource-Id": VOLC_CONFIG.ttsResourceId,
    "X-Control-Require-Usage-Tokens-Return": "*",
  };

  const body = {
    req_params: {
      text,
      speaker: voiceType,
      audio_params: {
        format: encoding,
        sample_rate: TTS_SAMPLE_RATE,
        ...mapTtsAdjustments({ speed: options.speed, volume: options.volume, pitch: options.pitch }),
      },
    },
  };

  let response: Response;
  try {
    response = await fetch(VOLC_CONFIG.ttsHttpUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new UpstreamError("TTS", "TTS 服务响应超时，请稍后再试");
    }
    throw new UpstreamError("TTS", "TTS 服务连接失败，请检查网络后重试");
  }

  const logId = logIdOf(response);

  if (!response.ok) {
    const errorText = await response.text();
    throw new UpstreamError(
      "TTS",
      `TTS 请求失败（HTTP ${response.status}）${logId ? ` logid=${logId}` : ""}：${truncateForDisplay(errorText)}`,
      logId
    );
  }

  const audioBase64 = await readTTSAudioBase64(response, logId);

  if (!audioBase64) {
    throw new UpstreamError("TTS", "TTS 返回数据异常，无音频内容", logId);
  }

  return {
    audioBase64,
    encoding,
    sampleRate: TTS_SAMPLE_RATE,
  };
}

async function readTTSAudioBase64(response: Response, logId: string): Promise<string> {
  if (!response.body) {
    return parseTTSRecords(await response.text(), logId);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let pending = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() || "";

      for (const line of lines) {
        const data = parseTTSRecord(line, logId);
        // done 提前返回时取消读取，释放底层连接
        if (data.done) {
          await reader.cancel().catch(() => {});
          return chunks.join("");
        }
        if (data.audioBase64) chunks.push(data.audioBase64);
      }

      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }

  if (pending.trim()) {
    const data = parseTTSRecord(pending, logId);
    if (data.audioBase64) chunks.push(data.audioBase64);
  }

  return chunks.join("");
}

function parseTTSRecords(text: string, logId: string): string {
  const chunks: string[] = [];
  const records = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  for (const record of records.length ? records : [text.trim()].filter(Boolean)) {
    const data = parseTTSRecord(record, logId);
    if (data.done) break;
    if (data.audioBase64) chunks.push(data.audioBase64);
  }

  return chunks.join("");
}

export function parseTTSRecord(record: string, logId: string): { audioBase64?: string; done?: boolean } {
  let data: { code?: number; data?: string; message?: string };
  try {
    data = JSON.parse(record) as { code?: number; data?: string; message?: string };
  } catch {
    // 流中的一行脏数据不应中断整次合成，跳过
    return {};
  }
  if (data.code === 20000000) return { done: true };
  if (data.code === 0 && data.data) return { audioBase64: data.data };
  if (data.code && data.code > 0) {
    throw new UpstreamError(
      "TTS",
      `TTS 返回错误（${data.code}）${logId ? ` logid=${logId}` : ""}：${truncateForDisplay(data.message || "")}`,
      logId
    );
  }
  if (data.data) return { audioBase64: data.data };
  return {};
}
