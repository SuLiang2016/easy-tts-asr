import WebSocket from "ws";
import { VOLC_CONFIG, requireApiKey } from "./config";
import { truncateForDisplay, UpstreamError } from "./errors";
import { appendSilence, parseWavInfo, pcmDurationSeconds } from "./wav-info";
import {
  buildAudioOnlyRequest,
  buildFullClientRequest,
  parseResponse,
  splitBySize,
} from "./asr-protocol";

export interface ASROptions {
  audioBase64: string;
  format?: "wav" | "mp3" | "ogg";
  language?: string;
  /** 音频时长上限（秒），用于换声等场景的服务端兜底；0 = 不限制 */
  maxDurationSeconds?: number;
}

export interface ASRResult {
  text: string;
  duration: number;
}

/** WebSocket 连接建立超时 */
const CONNECT_TIMEOUT_MS = 10_000;
/** 发完音频后等待识别结果的超时 */
const RESULT_TIMEOUT_MS = 120_000;
/** 发送背压阈值：积压超过 4MB 时稍作等待 */
const SEND_BACKPRESSURE_BYTES = 4 * 1024 * 1024;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new UpstreamError("ASR", message)), ms);
    }),
  ]).finally(() => clearTimeout(timer!));
}

/**
 * 通过 WebSocket 单流接口识别语音（Agent Plan 端点，bigmodel_nostream）。
 * 音频分片连续快速发送（带背压控制），整体耗时从「每片 100ms」的分钟级降到秒级。
 */
export async function recognizeSpeech(options: ASROptions): Promise<ASRResult> {
  const apiKey = requireApiKey();
  const { audioBase64, format: declaredFormat = "wav" } = options;

  const audioBuffer = Buffer.from(audioBase64, "base64");
  if (audioBuffer.length === 0) {
    throw new UpstreamError("ASR", "音频数据为空");
  }

  // WAV：定位 data 块提取 PCM，声明 format=pcm；mp3/ogg：整包直发
  let audioData: Buffer;
  let sampleRate = 16000;
  let channels = 1;
  let sampleWidth = 2;
  let audioFormat: string;

  if (audioBuffer.length >= 44 && audioBuffer.subarray(0, 4).toString("ascii") === "RIFF") {
    const info = parseWavInfo(audioBuffer);
    audioData = info.pcmData;
    sampleRate = info.sampleRate;
    channels = info.channels;
    sampleWidth = info.sampleWidth;
    audioFormat = "pcm";
  } else {
    audioData = audioBuffer;
    audioFormat = declaredFormat;
  }

  if (audioData.length === 0) {
    throw new UpstreamError("ASR", "音频数据为空");
  }

  if (options.maxDurationSeconds && audioFormat === "pcm") {
    const seconds = pcmDurationSeconds(audioData.length, sampleRate, channels, sampleWidth);
    if (seconds > options.maxDurationSeconds) {
      throw new UpstreamError(
        "ASR",
        `音频时长约 ${Math.ceil(seconds)} 秒，超过 ${options.maxDurationSeconds} 秒上限`
      );
    }
  }

  // 尾部补 300ms 静音，规避识别引擎截掉最后一个字
  if (audioFormat === "pcm") {
    audioData = appendSilence(audioData, sampleRate, channels, sampleWidth, 300);
  }

  const segments =
    audioFormat === "pcm"
      ? splitBySize(audioData, Math.floor((sampleRate * channels * sampleWidth * 200) / 1000))
      : audioFormat === "mp3"
      ? splitMp3ByFrames(audioData, 200)
      : splitBySize(audioData, 4000);

  const reqId = crypto.randomUUID();
  const ws = new WebSocket(VOLC_CONFIG.asrWsUrl, {
    headers: {
      "X-Api-Key": apiKey,
      "X-Api-Resource-Id": VOLC_CONFIG.asrResourceId,
      "X-Api-Request-Id": reqId,
      "X-Api-Connect-Id": reqId,
      "X-Api-Sequence": "-1",
    },
  });

  let seq = 1;
  let recognizedText = "";
  let duration = 0;
  let errorCode = 0;
  let errorMessage = "";
  let connectionError = "";

  try {
    // 1. 建立连接（带超时）
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        ws.once("open", resolve);
        ws.once("error", reject);
      }),
      CONNECT_TIMEOUT_MS,
      "ASR 服务连接超时，请稍后再试"
    );

    // 2. 发送 full client request 并等待初始响应（带超时）
    const fullRequest = buildFullClientRequest(seq, audioFormat);
    ws.send(fullRequest);
    seq++;

    await withTimeout(
      new Promise<void>((resolve) => {
        ws.once("message", () => resolve());
        ws.once("error", () => resolve());
        ws.once("close", () => resolve());
      }),
      CONNECT_TIMEOUT_MS,
      "ASR 服务无响应，请稍后再试"
    );

    if (ws.readyState !== WebSocket.OPEN) {
      throw new UpstreamError("ASR", "ASR 连接中断，请稍后再试");
    }

    // 3. 注册结果收集器（发送音频前注册，避免丢失服务端响应）
    const resultPromise = new Promise<void>((resolve) => {
      ws.on("message", (data: Buffer) => {
        const resp = parseResponse(data);

        if (resp.code !== 0) {
          errorCode = resp.code;
          const errPayload = resp.payload as { message?: string } | null;
          errorMessage = errPayload?.message || "识别错误";
          resolve();
          return;
        }

        const resultPayload = resp.payload as {
          result?: { text?: string; additions?: { duration?: string } };
        } | null;

        if (resultPayload?.result?.text) {
          recognizedText = resultPayload.result.text;
        }
        if (resultPayload?.result?.additions?.duration) {
          const parsed = parseInt(resultPayload.result.additions.duration, 10);
          duration = Number.isFinite(parsed) ? parsed : 0;
        }

        if (resp.isLast) {
          resolve();
        }
      });

      ws.on("error", (err: Error) => {
        connectionError = err.message;
        resolve();
      });
      ws.on("close", () => resolve());
    });

    // 4. 连续发送音频分片（带背压控制），最后一包发负序号
    for (let i = 0; i < segments.length; i++) {
      const isLast = i === segments.length - 1;
      ws.send(buildAudioOnlyRequest(seq, segments[i], isLast));
      if (!isLast) seq++;

      if (!isLast && ws.bufferedAmount > SEND_BACKPRESSURE_BYTES) {
        await sleep(20);
      }
    }

    // 5. 等待识别结果（带总超时）
    await withTimeout(resultPromise, RESULT_TIMEOUT_MS, "ASR 识别超时，请尝试更短的音频");
  } finally {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  }

  if (errorCode !== 0) {
    throw new UpstreamError(
      "ASR",
      `ASR 识别错误（${errorCode}）：${truncateForDisplay(errorMessage)}`,
      reqId
    );
  }
  if (connectionError) {
    throw new UpstreamError("ASR", `ASR 连接中断：${truncateForDisplay(connectionError)}`, reqId);
  }

  return { text: recognizedText, duration };
}

// ===== mp3 帧级切分 =====

interface Mp3FrameInfo {
  length: number;
  durationMs: number;
}

function getMp3FrameInfo(data: Buffer, offset: number): Mp3FrameInfo | null {
  if (offset + 4 > data.length || data[offset] !== 0xff || (data[offset + 1] & 0xe0) !== 0xe0) return null;

  const versionBits = (data[offset + 1] >> 3) & 0x03;
  const layerBits = (data[offset + 1] >> 1) & 0x03;
  const bitrateIndex = (data[offset + 2] >> 4) & 0x0f;
  const sampleRateIndex = (data[offset + 2] >> 2) & 0x03;
  const padding = (data[offset + 2] >> 1) & 0x01;

  if (versionBits === 0x01 || layerBits === 0x00 || bitrateIndex === 0x00 || bitrateIndex === 0x0f || sampleRateIndex === 0x03) {
    return null;
  }

  const version = versionBits === 0x03 ? 1 : versionBits === 0x02 ? 2 : 2.5;
  const layer = layerBits === 0x03 ? 1 : layerBits === 0x02 ? 2 : 3;
  const sampleRates: Record<string, number[]> = {
    "1": [44100, 48000, 32000],
    "2": [22050, 24000, 16000],
    "2.5": [11025, 12000, 8000],
  };
  const bitratesMpeg1: Record<number, number[]> = {
    1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  };
  const bitratesMpeg2: Record<number, number[]> = {
    1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  };
  const bitrate = (version === 1 ? bitratesMpeg1[layer][bitrateIndex] : bitratesMpeg2[layer][bitrateIndex]) * 1000;
  const frameSampleRate = sampleRates[String(version)][sampleRateIndex];
  const samplesPerFrame = layer === 1 ? 384 : layer === 3 && version !== 1 ? 576 : 1152;
  const length = layer === 1
    ? Math.floor(((12 * bitrate) / frameSampleRate + padding) * 4)
    : Math.floor(((layer === 3 && version !== 1 ? 72 : 144) * bitrate) / frameSampleRate + padding);

  if (length <= 4 || offset + length > data.length) return null;
  return { length, durationMs: (samplesPerFrame / frameSampleRate) * 1000 };
}

function splitMp3ByFrames(data: Buffer, targetMs: number): Buffer[] {
  const segments: Buffer[] = [];
  let segmentStart = 0;
  let segmentDuration = 0;
  let offset = 0;
  let foundFrame = false;

  while (offset < data.length - 4) {
    const frame = getMp3FrameInfo(data, offset);
    if (!frame) {
      offset++;
      continue;
    }

    foundFrame = true;
    offset += frame.length;
    segmentDuration += frame.durationMs;

    if (segmentDuration >= targetMs && offset < data.length) {
      segments.push(data.subarray(segmentStart, offset));
      segmentStart = offset;
      segmentDuration = 0;
    }
  }

  if (!foundFrame) return splitBySize(data, 4000);
  if (segmentStart < data.length) segments.push(data.subarray(segmentStart));
  return segments;
}
