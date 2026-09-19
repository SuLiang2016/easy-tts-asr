import { describe, expect, it } from "vitest";
import { gzipSync, gunzipSync } from "zlib";
import {
  buildAudioOnlyRequest,
  buildFullClientRequest,
  COMPRESS_GZIP,
  FLAG_WITH_SEQUENCE,
  MSG_CLIENT_AUDIO_ONLY,
  MSG_CLIENT_FULL_REQUEST,
  MSG_SERVER_ERROR,
  MSG_SERVER_FULL_RESPONSE,
  parseResponse,
  SERIAL_JSON,
  splitBySize,
} from "@/lib/volc/asr-protocol";

/** 读取 offset 处 4 字节长度字段，解压其后的 gzip payload */
function gunzipAt(buf: Buffer, offset: number): string {
  const size = buf.readUInt32BE(offset);
  return gunzipSync(buf.subarray(offset + 4, offset + 4 + size)).toString("utf-8");
}

describe("buildFullClientRequest", () => {
  it("协议头与 payload 符合规范", () => {
    const frame = buildFullClientRequest(1, "pcm");

    expect(frame[0]).toBe((0x01 << 4) | 0x01); // 协议版本 + 头大小
    expect(frame[1]).toBe((MSG_CLIENT_FULL_REQUEST << 4) | FLAG_WITH_SEQUENCE);
    expect(frame[2]).toBe((SERIAL_JSON << 4) | COMPRESS_GZIP);
    expect(frame.readInt32BE(4)).toBe(1); // sequence

    const payloadJson = gunzipAt(frame, 8);
    const parsed = JSON.parse(payloadJson) as { audio: { format: string; rate: number } };
    expect(parsed.audio.format).toBe("pcm");
    expect(parsed.audio.rate).toBe(16000);
  });
});

describe("buildAudioOnlyRequest", () => {
  it("普通分片发正序号，最后一包发负序号", () => {
    const segment = Buffer.alloc(10, 0x7f);
    const normal = buildAudioOnlyRequest(3, segment, false);
    const last = buildAudioOnlyRequest(3, segment, true);

    expect(normal[1]).toBe((MSG_CLIENT_AUDIO_ONLY << 4) | FLAG_WITH_SEQUENCE);
    expect(normal.readInt32BE(4)).toBe(3);

    // 最后一包 flags 低 4 位 = 0x02（负序号标志）
    expect(last[1] & 0x0f).toBe(0x02);
    expect(last.readInt32BE(4)).toBe(-3);

    // payload 长度字段与 gzip 后长度一致
    const size = normal.readUInt32BE(8);
    expect(normal.length).toBe(12 + size);
  });
});

describe("parseResponse", () => {
  it("解析 server full response（isLast + JSON payload）", () => {
    const payload = gzipSync(Buffer.from(JSON.stringify({ result: { text: "你好世界" } })));
    const frame = Buffer.concat([
      Buffer.from([0x11, (MSG_SERVER_FULL_RESPONSE << 4) | 0x02, (SERIAL_JSON << 4) | COMPRESS_GZIP, 0x00]),
      int32(payload.length),
      payload,
    ]);

    const resp = parseResponse(frame);
    expect(resp.code).toBe(0);
    expect(resp.isLast).toBe(true);
    const parsed = resp.payload as { result: { text: string } };
    expect(parsed.result.text).toBe("你好世界");
  });

  it("解析 server error 帧", () => {
    const payload = gzipSync(Buffer.from(JSON.stringify({ message: "quota exceeded" })));
    const frame = Buffer.concat([
      Buffer.from([0x11, (MSG_SERVER_ERROR << 4) | 0x01, (SERIAL_JSON << 4) | COMPRESS_GZIP, 0x00]),
      int32(7), // sequence
      int32(45000001), // code
      int32(payload.length),
      payload,
    ]);

    const resp = parseResponse(frame);
    expect(resp.code).toBe(45000001);
    const parsed = resp.payload as { message: string };
    expect(parsed.message).toBe("quota exceeded");
  });
});

describe("splitBySize", () => {
  it("按大小切片且保留尾部不足一片的数据", () => {
    const data = Buffer.alloc(25, 1);
    const segments = splitBySize(data, 10);
    expect(segments).toHaveLength(3);
    expect(segments[0].length).toBe(10);
    expect(segments[2].length).toBe(5);
  });
});

function int32(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeInt32BE(value, 0);
  return buf;
}
