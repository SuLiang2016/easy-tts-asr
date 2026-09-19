/**
 * TTS 调节参数映射（纯函数，可测试）。
 *
 * UI 层用倍率（1.0 = 不变），火山接口用偏移量：
 * - speech_rate   [-50, 100]：100 = 2.0 倍速，-50 = 0.5 倍速 → 线性映射 (speed-1)*100
 * - loudness_rate [-50, 100]：同理线性映射 (volume-1)*100
 * - pitch         [-12, 12]：半音 → 12*log2(pitch)
 * 偏移为 0 的参数不下发，保持请求体与历史行为完全一致（默认请求零回归）。
 */

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const SPEECH_RATE_RANGE = [-50, 100] as const;
export const LOUDNESS_RATE_RANGE = [-50, 100] as const;
export const PITCH_RANGE = [-12, 12] as const;

export function speedToSpeechRate(speed: number): number {
  return clamp(Math.round((speed - 1) * 100), SPEECH_RATE_RANGE[0], SPEECH_RATE_RANGE[1]);
}

export function volumeToLoudnessRate(volume: number): number {
  return clamp(Math.round((volume - 1) * 100), LOUDNESS_RATE_RANGE[0], LOUDNESS_RATE_RANGE[1]);
}

export function pitchToSemitones(pitch: number): number {
  return clamp(Math.round(12 * Math.log2(pitch)), PITCH_RANGE[0], PITCH_RANGE[1]);
}

export interface TtsAdjustments {
  speed?: number;
  volume?: number;
  pitch?: number;
}

/** 将 UI 倍率映射为接口的 audio_params 字段；等于默认值（1.0）的字段不下发 */
export function mapTtsAdjustments(adjustments: TtsAdjustments): {
  speech_rate?: number;
  loudness_rate?: number;
  pitch?: number;
} {
  const params: { speech_rate?: number; loudness_rate?: number; pitch?: number } = {};

  if (adjustments.speed !== undefined && adjustments.speed !== 1) {
    params.speech_rate = speedToSpeechRate(adjustments.speed);
  }
  if (adjustments.volume !== undefined && adjustments.volume !== 1) {
    params.loudness_rate = volumeToLoudnessRate(adjustments.volume);
  }
  if (adjustments.pitch !== undefined && adjustments.pitch !== 1) {
    params.pitch = pitchToSemitones(adjustments.pitch);
  }

  return params;
}
