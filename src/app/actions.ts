"use server";

import { recognizeSpeech, synthesizeSpeech, type TTSOptions, type ASROptions } from "@/lib/volc";

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

/**
 * Server Action: 文字转语音
 * 返回 base64 音频数据，避免服务端生成 blob URL 在客户端失效
 */
export async function textToSpeech(input: TTSActionInput): Promise<TTSActionResult> {
  try {
    const options: TTSOptions = {
      text: input.text,
      voiceType: input.voiceType,
      speed: input.speed,
      volume: input.volume,
      pitch: input.pitch,
      encoding: input.encoding,
    };

    const result = await synthesizeSpeech(options);

    return {
      success: true,
      audioBase64: result.audioBase64,
      encoding: result.encoding,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "未知错误",
    };
  }
}

export interface ASRActionInput {
  audioBase64: string;
  format?: "wav" | "mp3" | "ogg";
  language?: string;
}

export interface ASRActionResult {
  success: boolean;
  text?: string;
  duration?: number;
  error?: string;
}

/**
 * Server Action: 语音转文字
 */
export async function speechToText(input: ASRActionInput): Promise<ASRActionResult> {
  try {
    const options: ASROptions = {
      audioBase64: input.audioBase64,
      format: input.format,
      language: input.language,
    };

    const result = await recognizeSpeech(options);

    return {
      success: true,
      text: result.text,
      duration: result.duration,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "未知错误",
    };
  }
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

/**
 * Server Action: 换声
 * 1. ASR 识别原音频文字
 * 2. TTS 用目标音色合成
 */
export async function convertVoice(input: VoiceConversionInput): Promise<VoiceConversionResult> {
  try {
    // 步骤 1：识别文字
    const asrResult = await recognizeSpeech({
      audioBase64: input.audioBase64,
      format: input.format,
    });

    if (!asrResult.text) {
      return {
        success: false,
        error: "未能识别出任何文字",
      };
    }

    // 步骤 2：用目标音色合成
    const ttsResult = await synthesizeSpeech({
      text: asrResult.text,
      voiceType: input.voiceType,
      speed: input.speed,
      volume: input.volume,
      pitch: input.pitch,
      encoding: "mp3",
    });

    return {
      success: true,
      text: asrResult.text,
      audioBase64: ttsResult.audioBase64,
      encoding: ttsResult.encoding,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "未知错误",
    };
  }
}
