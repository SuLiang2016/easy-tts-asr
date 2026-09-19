/**
 * 火山 ASR WebSocket 二进制协议（纯函数，可测试）。
 * 帧结构：[4B 协议头][可选 4B sequence][payload]
 * 协议头：[高4位协议版本|低4位头大小(×4B)][高4位消息类型|低4位 flags][高4位序列化|低4位压缩][保留]
 */
import { gzipSync, gunzipSync } from "zlib";

export const PROTOCOL_VERSION = 0x01;
export const HEADER_SIZE_UNIT = 0x01; // 1 * 4 字节

export const MSG_CLIENT_FULL_REQUEST = 0x01;
export const MSG_CLIENT_AUDIO_ONLY = 0x02;
export const MSG_SERVER_FULL_RESPONSE = 0x09;
export const MSG_SERVER_ERROR = 0x0f;

export const FLAG_WITH_SEQUENCE = 0x01;
export const FLAG_LAST_NO_SEQUENCE = 0x02; // 负序号（最后一包）

export const SERIAL_JSON = 0x01;
export const COMPRESS_GZIP = 0x01;

export function buildHeader(msgType: number, flags: number): Buffer {
  const header = Buffer.alloc(4);
  header[0] = (PROTOCOL_VERSION << 4) | HEADER_SIZE_UNIT;
  header[1] = (msgType << 4) | flags;
  header[2] = (SERIAL_JSON << 4) | COMPRESS_GZIP;
  header[3] = 0x00;
  return header;
}

/** full client request（JSON 元数据：音频格式、模型开关） */
export function buildFullClientRequest(seq: number, format: string = "pcm"): Buffer {
  const header = buildHeader(MSG_CLIENT_FULL_REQUEST, FLAG_WITH_SEQUENCE);

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

  return Buffer.concat([
    header,
    int32BE(seq),
    int32BE(gzipSync(Buffer.from(payload, "utf-8")).length),
    gzipSync(Buffer.from(payload, "utf-8")),
  ]);
}

/** audio only request（音频分片）；isLast 时发负序号 */
export function buildAudioOnlyRequest(seq: number, segment: Buffer, isLast: boolean): Buffer {
  const flags = isLast ? FLAG_LAST_NO_SEQUENCE : FLAG_WITH_SEQUENCE;
  const compressed = gzipSync(segment);
  return Buffer.concat([
    buildHeader(MSG_CLIENT_AUDIO_ONLY, flags),
    int32BE(isLast ? -seq : seq),
    int32BE(compressed.length),
    compressed,
  ]);
}

export interface AsrServerResponse {
  code: number;
  isLast: boolean;
  payload: unknown;
}

/** 解析服务端响应帧；无法识别的 payload 解析为 null */
export function parseResponse(msg: Buffer): AsrServerResponse {
  const headerSize = msg[0] & 0x0f;
  const msgType = msg[1] >> 4;
  const flags = msg[1] & 0x0f;
  const serialMethod = msg[2] >> 4;
  const compression = msg[2] & 0x0f;

  let payload = msg.subarray(headerSize * 4);
  let isLast = false;

  if (flags & 0x01) {
    payload = payload.subarray(4); // sequence
  }
  if (flags & 0x02) {
    isLast = true;
  }
  if (flags & 0x04) {
    payload = payload.subarray(4); // event
  }

  let code = 0;
  if (msgType === MSG_SERVER_FULL_RESPONSE) {
    payload = payload.subarray(4); // payload_size
  } else if (msgType === MSG_SERVER_ERROR) {
    code = payload.readInt32BE(0);
    payload = payload.subarray(8); // code + payload_size
  }

  if (payload.length === 0) {
    return { code, isLast, payload: null };
  }

  if (compression === COMPRESS_GZIP) {
    payload = gunzipSync(payload);
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

function int32BE(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeInt32BE(value, 0);
  return buf;
}

/** 按固定字节大小切片（用于 PCM 按 200ms 估算分片） */
export function splitBySize(data: Buffer, segmentSize: number): Buffer[] {
  const segments: Buffer[] = [];
  for (let i = 0; i < data.length; i += segmentSize) {
    segments.push(data.subarray(i, Math.min(i + segmentSize, data.length)));
  }
  return segments;
}
