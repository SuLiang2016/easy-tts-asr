"use server";

import { recognizeSpeech, synthesizeSpeech, UpstreamError, type ASROptions, type TTSOptions } from "@/lib/volc";
import { VOICES } from "@/lib/voices";

export interface TTSActionInput {
  text: string;
  voiceType: string;
  speed?: number;
  volume?: number;
  pitch?: number;
  encoding?: "mp3" | "wav" | "pcm" | "ogg_opus";
}

export interface TTSActionResult {
  success: boolean;
  audioBase64?: string;
  encoding?: string;
  error?: string;
}

export interface ASRActionInput {
  audioBase64: string;
  format?: "wav" | "mp3" | "ogg";
  language?: string;
  maxDurationSeconds?: number;
}

export interface ASRActionResult {
  success: boolean;
  text?: string;
  duration?: number;
  error?: string;
}

export interface VoiceConversionInput {
  audioBase64: string;
  format?: "wav" | "mp3" | "ogg";
  voiceType: string;
  speed?: number;
  volume?: number;
  pitch?: number;
}

export interface VoiceConversionResult {
  success: boolean;
  text?: string;
  audioBase64?: string;
  encoding?: string;
  error?: string;
}

const MAX_TEXT_LENGTH = 1000;
/** base64 解码后的音频字节上限 */
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
/** 换声源音频时长上限（60 秒 + 5 秒余量） */
const VOICE_CONVERSION_MAX_SECONDS = 65;

const VOICE_IDS = new Set(VOICES.map((v) => v.id));

/** 粗校验输入数值：必须是有限数字并钳制到接口支持范围 */
function clampEffect(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.min(2, Math.max(0.5, value));
}

/** base64 音频解码后的大小校验（防止空数据与超限数据进入上游调用） */
function validateAudioBase64(audioBase64: string): string | null {
  if (!audioBase64) return "音频数据为空";
  const bytes = Math.floor(audioBase64.length * 0.75);
  if (bytes > MAX_AUDIO_BYTES) return "音频超过 20MB 上限";
  return null;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof UpstreamError) return err.message;
  return "服务暂时不可用，请稍后再试";
}

/**
 * Server Action: 文字转语音
 * 返回 base64 音频数据，避免服务端生成 blob URL 在客户端失效
 */
export async function textToSpeech(input: TTSActionInput): Promise<TTSActionResult> {
  try {
    if (typeof input.text !== "string" || !input.text.trim()) {
      return { success: false, error: "请输入要合成的文字" };
    }
    if (input.text.length > MAX_TEXT_LENGTH) {
      return { success: false, error: `文本超过 ${MAX_TEXT_LENGTH} 字符上限` };
    }
    if (!VOICE_IDS.has(input.voiceType)) {
      return { success: false, error: "不支持的音色" };
    }

    const options: TTSOptions = {
      text: input.text.trim(),
      voiceType: input.voiceType,
      speed: clampEffect(input.speed),
      volume: clampEffect(input.volume),
      pitch: clampEffect(input.pitch),
      encoding: input.encoding,
    };

    const result = await synthesizeSpeech(options);

    return {
      success: true,
      audioBase64: result.audioBase64,
      encoding: result.encoding,
    };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}

/**
 * Server Action: 语音转文字
 * ASR 页 5 分钟长音频走 /api/asr Route Handler（FormData 免 base64 膨胀），
 * 此 Action 保留给换声流水线与程序化调用。
 */
export async function speechToText(input: ASRActionInput): Promise<ASRActionResult> {
  try {
    const sizeError = validateAudioBase64(input.audioBase64);
    if (sizeError) return { success: false, error: sizeError };

    const options: ASROptions = {
      audioBase64: input.audioBase64,
      format: input.format,
      language: input.language,
      maxDurationSeconds: input.maxDurationSeconds,
    };

    const result = await recognizeSpeech(options);

    return { success: true, text: result.text, duration: result.duration };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}

/**
 * Server Action: 换声（服务端串行 ASR -> TTS 流水线）
 */
export async function convertVoice(input: VoiceConversionInput): Promise<VoiceConversionResult> {
  try {
    const sizeError = validateAudioBase64(input.audioBase64);
    if (sizeError) return { success: false, error: sizeError };
    if (!VOICE_IDS.has(input.voiceType)) {
      return { success: false, error: "不支持的音色" };
    }

    // 步骤 1：识别文字（服务端兜底 60 秒时长上限）
    const asrResult = await recognizeSpeech({
      audioBase64: input.audioBase64,
      format: input.format,
      maxDurationSeconds: VOICE_CONVERSION_MAX_SECONDS,
    });

    if (!asrResult.text) {
      return { success: false, error: "未能识别出任何文字" };
    }

    // 步骤 2：用目标音色合成（识别文本按 TTS 上限截断）
    const ttsResult = await synthesizeSpeech({
      text: asrResult.text.slice(0, MAX_TEXT_LENGTH),
      voiceType: input.voiceType,
      speed: clampEffect(input.speed),
      volume: clampEffect(input.volume),
      pitch: clampEffect(input.pitch),
      encoding: "mp3",
    });

    return {
      success: true,
      text: asrResult.text,
      audioBase64: ttsResult.audioBase64,
      encoding: ttsResult.encoding,
    };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}
