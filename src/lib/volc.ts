import WebSocket from "ws";
import { gzipSync, gunzipSync } from "zlib";

const VOLC_API_KEY = process.env.VOLC_API_KEY;
const VOLC_TTS_HTTP_URL = process.env.VOLC_TTS_HTTP_URL || "https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional";
const VOLC_TTS_RESOURCE_ID = process.env.VOLC_TTS_RESOURCE_ID || "seed-tts-2.0";
const VOLC_ASR_WS_URL = process.env.VOLC_ASR_WS_URL || "wss://openspeech.bytedance.com/api/v3/plan/sauc/bigmodel_nostream";
const VOLC_ASR_RESOURCE_ID = process.env.VOLC_ASR_RESOURCE_ID || "volc.seedasr.sauc.duration";

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

// ===== ASR WebSocket 二进制协议常量 =====
const PROTOCOL_V1 = 0x01;
const HEADER_SIZE = 0x01; // 1 * 4 = 4 bytes

const MSG_CLIENT_FULL_REQUEST = 0x01;
const MSG_CLIENT_AUDIO_ONLY = 0x02;
const MSG_SERVER_FULL_RESPONSE = 0x09;
const MSG_SERVER_ERROR = 0x0f;

const FLAG_POS_SEQ = 0x01;
const FLAG_NEG_WITH_SEQ = 0x03;

const SERIAL_JSON = 0x01;
const COMPRESS_GZIP = 0x01;

// ===== ASR WebSocket 实现 =====

/**
 * 构建 4 字节协议头
 */
function buildHeader(msgType: number, flags: number): Buffer {
  const header = Buffer.alloc(4);
  header[0] = (PROTOCOL_V1 << 4) | HEADER_SIZE;
  header[1] = (msgType << 4) | flags;
  header[2] = (SERIAL_JSON << 4) | COMPRESS_GZIP;
  header[3] = 0x00;
  return header;
}

/**
 * 构建 full client request（JSON 元数据）
 */
function buildFullClientRequest(seq: number, format: string = "pcm"): Buffer {
  const header = buildHeader(MSG_CLIENT_FULL_REQUEST, FLAG_POS_SEQ);

  const codec = format === "ogg" ? "opus" : "raw";

  const payload = JSON.stringify({
    user: { uid: "hello-tts-user" },
    audio: {
      format,
      codec,
      rate: 16000,
      bits: 16,
      channel: 1,
    },
    request: {
      model_name: "bigmodel",
      enable_itn: true,
      enable_punc: true,
    },
  });

  const payloadBytes = Buffer.from(payload, "utf-8");
  const compressed = gzipCompress(payloadBytes);

  const seqBuf = Buffer.alloc(4);
  seqBuf.writeInt32BE(seq, 0);

  const sizeBuf = Buffer.alloc(4);
  sizeBuf.writeUInt32BE(compressed.length, 0);

  return Buffer.concat([header, seqBuf, sizeBuf, compressed]);
}

/**
 * 构建 audio only request（音频分片）
 */
function buildAudioOnlyRequest(seq: number, segment: Buffer, isLast: boolean): Buffer {
  const flags = isLast ? FLAG_NEG_WITH_SEQ : FLAG_POS_SEQ;
  const header = buildHeader(MSG_CLIENT_AUDIO_ONLY, flags);

  const actualSeq = isLast ? -seq : seq;
  const seqBuf = Buffer.alloc(4);
  seqBuf.writeInt32BE(actualSeq, 0);

  const compressed = gzipCompress(segment);

  const sizeBuf = Buffer.alloc(4);
  sizeBuf.writeUInt32BE(compressed.length, 0);

  return Buffer.concat([header, seqBuf, sizeBuf, compressed]);
}

/**
 * 解析服务端响应
 */
function parseResponse(msg: Buffer): {
  code: number;
  isLast: boolean;
  payload: unknown;
} {
  const headerSize = msg[0] & 0x0f;
  const msgType = msg[1] >> 4;
  const flags = msg[1] & 0x0f;
  const serialMethod = msg[2] >> 4;
  const compression = msg[2] & 0x0f;

  let payload = msg.subarray(headerSize * 4);

  let isLast = false;

  if (flags & 0x01) {
    payload = payload.subarray(4); // skip sequence
  }
  if (flags & 0x02) {
    isLast = true;
  }
  if (flags & 0x04) {
    payload = payload.subarray(4); // skip event
  }

  let code = 0;
  if (msgType === MSG_SERVER_FULL_RESPONSE) {
    payload = payload.subarray(4); // skip payload_size
  } else if (msgType === MSG_SERVER_ERROR) {
    code = payload.readInt32BE(0);
    payload = payload.subarray(8); // skip code + payload_size
  }

  if (payload.length === 0) {
    return { code, isLast, payload: null };
  }

  if (compression === COMPRESS_GZIP) {
    payload = gzipDecompress(payload);
  }

  let parsed: unknown = null;
  if (serialMethod === SERIAL_JSON) {
    try {
      parsed = JSON.parse(payload.toString("utf-8"));
    } catch {
      parsed = null;
    }
  }

  return { code, isLast, payload: parsed };
}

/**
 * 从 WAV Buffer 中提取原始 PCM 数据和音频信息
 */
function parseWavInfo(data: Buffer): {
  channels: number;
  sampleWidth: number;
  sampleRate: number;
  pcmData: Buffer;
} {
  const numChannels = data.readUInt16LE(22);
  const sampleRate = data.readUInt32LE(24);
  const bitsPerSample = data.readUInt16LE(34);

  // 查找 data 子块
  let pos = 36;
  while (pos < data.length - 8) {
    const chunkId = data.subarray(pos, pos + 4).toString("ascii");
    const chunkSize = data.readUInt32LE(pos + 4);
    if (chunkId === "data") {
      return {
        channels: numChannels,
        sampleWidth: bitsPerSample / 8,
        sampleRate,
        pcmData: data.subarray(pos + 8, pos + 8 + chunkSize),
      };
    }
    pos += 8 + chunkSize;
  }

  throw new Error("WAV 文件无效：未找到 data 子块");
}

/**
 * 将音频数据按固定大小分片
 */
function splitBySize(data: Buffer, segmentSize: number): Buffer[] {
  const segments: Buffer[] = [];
  for (let i = 0; i < data.length; i += segmentSize) {
    segments.push(data.subarray(i, Math.min(i + segmentSize, data.length)));
  }
  return segments;
}

function appendSilence(data: Buffer, sampleRate: number, channels: number, sampleWidth: number, durationMs: number): Buffer {
  const silenceSize = Math.floor((sampleRate * channels * sampleWidth * durationMs) / 1000);
  return Buffer.concat([data, Buffer.alloc(silenceSize)]);
}

function getMp3FrameInfo(data: Buffer, offset: number): { length: number; durationMs: number } | null {
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
  const sampleRate = sampleRates[String(version)][sampleRateIndex];
  const samplesPerFrame = layer === 1 ? 384 : layer === 3 && version !== 1 ? 576 : 1152;
  const length = layer === 1
    ? Math.floor(((12 * bitrate) / sampleRate + padding) * 4)
    : Math.floor(((layer === 3 && version !== 1 ? 72 : 144) * bitrate) / sampleRate + padding);

  if (length <= 4 || offset + length > data.length) return null;
  return { length, durationMs: (samplesPerFrame / sampleRate) * 1000 };
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

function gzipCompress(data: Buffer): Buffer {
  return gzipSync(data);
}

function gzipDecompress(data: Buffer): Buffer {
  return gunzipSync(data);
}

/**
 * 通过 WebSocket 单流接口识别语音
 * 使用 Agent Plan 专属 API Key（ark- 开头），走 /plan/sauc/bigmodel_nostream 端点
 */
export async function recognizeSpeech(options: ASROptions): Promise<ASRResult> {
  const { audioBase64, format: declaredFormat = "wav" } = options;

  if (!VOLC_API_KEY) {
    throw new Error("请配置 VOLC_API_KEY");
  }

  // 解码 base64 音频
  const audioBuffer = Buffer.from(audioBase64, "base64");

  // 判断音频格式：WAV 需提取 PCM 数据并声明 pcm，mp3/ogg 直接发送原始字节
  let audioData: Buffer;
  let sampleRate = 16000;
  let channels = 1;
  let sampleWidth = 2;
  let audioFormat: string;

  if (audioBuffer.length >= 44 && audioBuffer.subarray(0, 4).toString("ascii") === "RIFF") {
    // WAV：提取 PCM 数据，声明 format=pcm
    const info = parseWavInfo(audioBuffer);
    audioData = info.pcmData;
    sampleRate = info.sampleRate;
    channels = info.channels;
    sampleWidth = info.sampleWidth;
    audioFormat = "pcm";
  } else {
    // mp3/ogg 等：直接发送原始字节，使用客户端声明的格式
    audioData = audioBuffer;
    audioFormat = declaredFormat;
  }

  // 分片：PCM 按采样率计算，压缩格式按固定大小
  if (audioFormat === "pcm") {
    audioData = appendSilence(audioData, sampleRate, channels, sampleWidth, 300);
  }

  const segments = audioFormat === "pcm"
    ? splitBySize(audioData, Math.floor((sampleRate * channels * sampleWidth * 200) / 1000))
    : audioFormat === "mp3"
    ? splitMp3ByFrames(audioData, 200)
    : splitBySize(audioData, 4000);
  if (segments.length === 0) {
    throw new Error("音频数据为空");
  }

  // WebSocket 连接
  const reqId = crypto.randomUUID();

  const ws = new WebSocket(VOLC_ASR_WS_URL, {
    headers: {
      "X-Api-Key": VOLC_API_KEY,
      "X-Api-Resource-Id": VOLC_ASR_RESOURCE_ID,
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

  try {
    // 等待连接建立
    await new Promise<void>((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    // 1. 发送 full client request
    const fullRequest = buildFullClientRequest(seq, audioFormat);
    ws.send(fullRequest);
    seq++;

    // 等待初始响应
    await new Promise<void>((resolve) => {
      ws.once("message", () => resolve());
    });

    // 2. 注册消息处理器（在发送音频前注册，避免丢失服务端响应）
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
          duration = parseInt(resultPayload.result.additions.duration, 10);
        }

        if (resp.isLast) {
          resolve();
        }
      });

      ws.on("error", () => resolve());
      ws.on("close", () => resolve());
    });

    // 3. 发送音频分片
    for (let i = 0; i < segments.length; i++) {
      const isLast = i === segments.length - 1;
      const audioRequest = buildAudioOnlyRequest(seq, segments[i], isLast);
      ws.send(audioRequest);
      if (!isLast) seq++;

      if (!isLast) {
        // 发包间隔 100ms（API 要求 100~200ms），最后一包后无需等待
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // 4. 等待识别结果
    await resultPromise;
  } finally {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  }

  if (errorCode !== 0) {
    throw new Error(`ASR 识别错误: ${errorCode} ${errorMessage}`);
  }

  return { text: recognizedText, duration };
}
