/**
 * 浏览器端音频工具：base64 转换、解码重采样、ASR 前置处理。
 * Buffer 在浏览器端不可用，统一走 ArrayBuffer / Blob。
 */
import { encodeWav } from "./wav-encode";

/** ASR 前置处理统一输出：16kHz 单声道 16bit WAV */
const ASR_SAMPLE_RATE = 16000;
/** 尾部补静音时长，避免识别引擎截掉最后一个字 */
const TRAILING_SILENCE_MS = 300;

export interface PreparedAudio {
  /** 转换后的 WAV（16kHz 单声道） */
  blob: Blob;
  /** 同一份数据的 base64（供 Server Action 通道使用） */
  base64: string;
  format: "wav";
  /** 音频时长（秒，不含尾部补的静音） */
  durationSec: number;
}

/** 将 base64 字符串转换为 ArrayBuffer（浏览器端可用） */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/** 将音频文件转换为 base64 字符串（空文件抛错，避免把 data URL 前缀当数据发送） */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      if (!base64) {
        reject(new Error("文件内容为空"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

// 共享 AudioContext：浏览器对页面内 AudioContext 数量有硬上限（Chrome 约 6 个），
// 每次转换都新建会导致连续转换后 decodeAudioData 挂死。
let sharedAudioContext: AudioContext | null = null;

function getSharedAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContext();
  }
  return sharedAudioContext;
}

/** 解码浏览器支持的任意音频格式 */
async function decodeAudio(blob: Blob): Promise<AudioBuffer> {
  const audioContext = getSharedAudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  return audioContext.decodeAudioData(arrayBuffer);
}

/**
 * 解码任意浏览器支持的音频，重采样为 16kHz 单声道并编码为 WAV Blob。
 * 可选在尾部追加静音（用于规避识别引擎截尾）。
 */
export async function convertToWav(
  blob: Blob,
  options?: { sampleRate?: number; trailingSilenceMs?: number }
): Promise<Blob> {
  const { wav } = await renderToWavPrepared(blob, {
    sampleRate: options?.sampleRate ?? ASR_SAMPLE_RATE,
    trailingSilenceMs: options?.trailingSilenceMs ?? 0,
  });
  return wav;
}

async function renderToWavPrepared(
  blob: Blob,
  options: { sampleRate: number; trailingSilenceMs: number }
): Promise<{ wav: Blob; durationSec: number }> {
  const decoded = await decodeAudio(blob);
  if (decoded.length === 0) {
    throw new Error("音频内容为空");
  }

  const silenceSamples = Math.floor((options.sampleRate * options.trailingSilenceMs) / 1000);
  const totalSamples = Math.ceil(decoded.duration * options.sampleRate) + silenceSamples;

  const offlineContext = new OfflineAudioContext(1, Math.max(1, totalSamples), options.sampleRate);
  const source = offlineContext.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineContext.destination);
  source.start();

  const rendered = await offlineContext.startRendering();
  const wavBuffer = encodeWav([rendered.getChannelData(0)], options.sampleRate);
  return {
    wav: new Blob([wavBuffer], { type: "audio/wav" }),
    durationSec: decoded.duration,
  };
}

/**
 * ASR 前置处理：任何格式统一转为 16kHz 单声道 WAV 并补 300ms 尾部静音。
 * 各入口（ASR 页、换声页、录音组件）共用，保证采样率与截尾行为一致。
 */
export async function prepareAudioForASR(file: File | Blob): Promise<PreparedAudio> {
  const { wav, durationSec } = await renderToWavPrepared(file, {
    sampleRate: ASR_SAMPLE_RATE,
    trailingSilenceMs: TRAILING_SILENCE_MS,
  });
  const base64 = await fileToBase64(new File([wav], "audio.wav", { type: "audio/wav" }));
  return {
    blob: new Blob([wav], { type: "audio/wav" }),
    base64,
    format: "wav",
    durationSec,
  };
}
