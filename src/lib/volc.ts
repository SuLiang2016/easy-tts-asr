const VOLC_API_KEY = process.env.VOLC_API_KEY;
const VOLC_TTS_APP_ID = process.env.VOLC_TTS_APP_ID;
const VOLC_TTS_ACCESS_TOKEN = process.env.VOLC_TTS_ACCESS_TOKEN;
const VOLC_TTS_HTTP_URL = process.env.VOLC_TTS_HTTP_URL || "https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional";
const VOLC_TTS_RESOURCE_ID = process.env.VOLC_TTS_RESOURCE_ID || "seed-tts-2.0";
const VOLC_ASR_RESOURCE_ID = process.env.VOLC_ASR_RESOURCE_ID || "volc.bigasr.auc_turbo";

const useNewAuth = !!VOLC_API_KEY;

export interface TTSOptions {
  text: string;
  voiceType: string;
  speed?: number;
  volume?: number;
  pitch?: number;
  encoding?: "mp3" | "wav" | "pcm" | "ogg_opus";
}

export interface TTSResult {
  audioBase64: string;
  encoding: string;
  sampleRate: number;
}

export async function synthesizeSpeech(options: TTSOptions): Promise<TTSResult> {
  const { text, voiceType, encoding = "mp3" } = options;

  if (!VOLC_API_KEY) {
    throw new Error("请配置 VOLC_API_KEY");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Connection": "keep-alive",
    "X-Api-Key": VOLC_API_KEY,
    "X-Api-Request-Id": crypto.randomUUID(),
    "X-Api-Resource-Id": VOLC_TTS_RESOURCE_ID,
    "X-Control-Require-Usage-Tokens-Return": "*",
  };

  const body = {
    req_params: {
      text,
      speaker: voiceType,
      audio_params: {
        format: encoding,
        sample_rate: 24000,
      },
    },
  };

  const response = await fetch(VOLC_TTS_HTTP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const logId = response.headers.get("X-Tt-Logid") || response.headers.get("x-tt-logid") || "";

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS 请求失败: ${response.status}${logId ? ` logid=${logId}` : ""} ${errorText}`);
  }

  const audioBase64 = await readTTSAudioBase64(response, logId);

  if (!audioBase64) {
    throw new Error("TTS 返回数据异常，无音频内容");
  }

  return {
    audioBase64,
    encoding,
    sampleRate: 24000,
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

  while (true) {
    const { done, value } = await reader.read();
    pending += decoder.decode(value, { stream: !done });
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() || "";

    for (const line of lines) {
      const data = parseTTSRecord(line, logId);
      if (data.done) return chunks.join("");
      if (data.audioBase64) chunks.push(data.audioBase64);
    }

    if (done) break;
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

function parseTTSRecord(record: string, logId: string): { audioBase64?: string; done?: boolean } {
  const data = JSON.parse(record) as { code?: number; data?: string; message?: string };
  if (data.code === 20000000) return { done: true };
  if (data.code === 0 && data.data) return { audioBase64: data.data };
  if (data.code && data.code > 0) {
    throw new Error(`TTS 返回错误: ${data.code}${logId ? ` logid=${logId}` : ""} ${data.message || ""}`);
  }
  if (data.data) return { audioBase64: data.data };
  return {};
}

export interface ASROptions {
  audioBase64: string;
  format?: "wav" | "mp3" | "ogg";
  language?: string;
}

export interface ASRResult {
  text: string;
  duration: number;
}

/**
 * 语音识别 - 极速版识别接口
 * 一次请求直接返回识别结果
 */
export async function recognizeSpeech(options: ASROptions): Promise<ASRResult> {
  const { audioBase64, format = "wav", language = "zh-CN" } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Api-Request-Id": crypto.randomUUID(),
    "X-Api-Resource-Id": VOLC_ASR_RESOURCE_ID,
    "X-Api-Sequence": "-1",
  };

  if (useNewAuth) {
    headers["X-Api-Key"] = VOLC_API_KEY!;
  } else {
    if (!VOLC_TTS_APP_ID || !VOLC_TTS_ACCESS_TOKEN) {
      throw new Error("请配置 VOLC_API_KEY 或 VOLC_TTS_APP_ID + VOLC_TTS_ACCESS_TOKEN");
    }
    headers["X-Api-App-Key"] = VOLC_TTS_APP_ID;
    headers["X-Api-Access-Key"] = VOLC_TTS_ACCESS_TOKEN;
  }

  const body = {
    user: {
      uid: VOLC_TTS_APP_ID || "hello-tts-user",
    },
    audio: {
      data: audioBase64,
      format,
    },
    request: {
      model_name: "bigmodel",
      language,
      enable_punc: true,
      enable_itn: true,
    },
  };

  const response = await fetch("https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const responseData = await response.json() as {
    result?: {
      text?: string;
      additions?: {
        duration?: string;
      };
    };
    message?: string;
  };

  if (!response.ok) {
    throw new Error(`ASR 请求失败: ${response.status} ${responseData.message || JSON.stringify(responseData)}`);
  }

  const text = responseData.result?.text || "";
  const duration = parseInt(responseData.result?.additions?.duration || "0", 10);

  return { text, duration };
}
