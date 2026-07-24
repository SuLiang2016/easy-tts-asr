// 火山引擎语音 API 基础配置
// 支持新版控制台 (X-Api-Key) 和旧版控制台 (appid + token) 两种鉴权方式

const VOLC_API_KEY = process.env.VOLC_API_KEY;
const VOLC_TTS_APP_ID = process.env.VOLC_TTS_APP_ID;
const VOLC_TTS_ACCESS_TOKEN = process.env.VOLC_TTS_ACCESS_TOKEN;
const VOLC_TTS_CLUSTER = process.env.VOLC_TTS_CLUSTER || "volcano_tts";
const VOLC_TTS_RESOURCE_ID = process.env.VOLC_TTS_RESOURCE_ID || "volc.service_type.10029";
const VOLC_ASR_RESOURCE_ID = process.env.VOLC_ASR_RESOURCE_ID || "volc.bigasr.auc_turbo";

// 优先使用新版控制台 API Key
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
  audioUrl: string;
  encoding: string;
  sampleRate: number;
}

/**
 * 文字转语音 - 短文本同步接口
 */
export async function synthesizeSpeech(options: TTSOptions): Promise<TTSResult> {
  const { text, voiceType, speed = 1.0, volume = 1.0, pitch = 1.0, encoding = "mp3" } = options;

  // 新版控制台：X-Api-Key
  // 旧版控制台：X-Api-App-Id + X-Api-Access-Key
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Api-Request-Id": crypto.randomUUID(),
    "X-Api-Resource-Id": VOLC_TTS_RESOURCE_ID,
  };

  if (useNewAuth) {
    headers["X-Api-Key"] = VOLC_API_KEY!;
  } else {
    if (!VOLC_TTS_APP_ID || !VOLC_TTS_ACCESS_TOKEN) {
      throw new Error("请配置 VOLC_API_KEY 或 VOLC_TTS_APP_ID + VOLC_TTS_ACCESS_TOKEN");
    }
    headers["X-Api-App-Id"] = VOLC_TTS_APP_ID;
    headers["X-Api-Access-Key"] = VOLC_TTS_ACCESS_TOKEN;
  }

  const body = {
    app: {
      appid: VOLC_TTS_APP_ID || "",
      token: VOLC_TTS_ACCESS_TOKEN || "",
      cluster: VOLC_TTS_CLUSTER,
    },
    user: {
      uid: "hello-tts-user",
    },
    audio: {
      voice_type: voiceType,
      encoding,
      speed_ratio: speed,
      volume_ratio: volume,
      pitch_ratio: pitch,
    },
    request: {
      reqid: crypto.randomUUID(),
      text,
      text_type: "plain",
      operation: "query",
    },
  };

  const response = await fetch("https://openspeech.bytedance.com/api/v1/tts", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS 请求失败: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    data?: string;
    audio?: {
      encoding?: string;
      sample_rate?: number;
    };
  };

  if (!data.data) {
    throw new Error("TTS 返回数据异常，无音频内容");
  }

  const audioBuffer = Buffer.from(data.data, "base64");
  const blob = new Blob([audioBuffer], { type: `audio/${encoding === "ogg_opus" ? "ogg" : encoding}` });
  const audioUrl = URL.createObjectURL(blob);

  return {
    audioBase64: data.data,
    audioUrl,
    encoding: data.audio?.encoding || encoding,
    sampleRate: data.audio?.sample_rate || 24000,
  };
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
