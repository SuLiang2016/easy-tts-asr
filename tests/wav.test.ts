import { describe, expect, it } from "vitest";
import { encodeWav } from "@/lib/audio/wav-encode";
import { appendSilence, parseWavInfo, pcmDurationSeconds } from "@/lib/volc/wav-info";

describe("encodeWav", () => {
  it("写出正确的 RIFF 头与 16bit PCM 采样", () => {
    const samples = Float32Array.from([0, 0.5, -0.5, 1, -1]);
    const buffer = encodeWav([samples], 16000);
    const view = new DataView(buffer);

    expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(36 + 10); // 44 头 + 5 样本 × 2 字节
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // 单声道
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16); // 位深
    expect(view.getUint32(40, true)).toBe(10); // data 大小

    // 采样钳制与量化
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(16383); // 0.5 * 32767
    expect(view.getInt16(48, true)).toBe(-16384); // -0.5 * 32768
    expect(view.getInt16(50, true)).toBe(32767);
    expect(view.getInt16(52, true)).toBe(-32768);
    expect(buffer.byteLength).toBe(44 + 10);
  });

  it("空声道数组抛错", () => {
    expect(() => encodeWav([], 16000)).toThrow();
  });
});

describe("parseWavInfo", () => {
  it("跳过 data 前的额外子块（JUNK/LIST）正确定位", () => {
    const pcm = Buffer.alloc(4, 0x11);
    const fmt = Buffer.alloc(16);
    fmt.writeUInt16LE(1, 0); // PCM
    fmt.writeUInt16LE(1, 2); // channels
    fmt.writeUInt32LE(16000, 4); // sample rate
    fmt.writeUInt32LE(32000, 8); // byte rate
    fmt.writeUInt16LE(2, 12); // block align
    fmt.writeUInt16LE(16, 14); // bits

    const junk = Buffer.alloc(4, 0xff); // 4 字节 junk payload
    const chunks = Buffer.concat([
      Buffer.from("WAVE", "ascii"),
      Buffer.from("fmt ", "ascii"), int32(16), fmt,
      Buffer.from("JUNK", "ascii"), int32(4), junk,
      Buffer.from("data", "ascii"), int32(pcm.length), pcm,
    ]);
    const wav = Buffer.concat([Buffer.from("RIFF", "ascii"), int32(chunks.length), chunks]);

    const info = parseWavInfo(wav);
    expect(info.channels).toBe(1);
    expect(info.sampleRate).toBe(16000);
    expect(info.sampleWidth).toBe(2);
    expect(info.pcmData.length).toBe(4);
  });

  it("缺少 data 块时抛错", () => {
    // 合法 RIFF + fmt（16B）+ 若干全零字节，长度 ≥ 44，遍历完所有子块仍找不到 data
    const fmt = Buffer.alloc(16);
    fmt.writeUInt16LE(1, 0);
    fmt.writeUInt16LE(1, 2);
    fmt.writeUInt32LE(16000, 4);
    fmt.writeUInt16LE(16, 14);
    const chunks = Buffer.concat([
      Buffer.from("WAVE", "ascii"),
      Buffer.from("fmt ", "ascii"), int32(16), fmt,
      Buffer.alloc(12), // 空白区，无 data 块
    ]);
    const wav = Buffer.concat([Buffer.from("RIFF", "ascii"), int32(chunks.length), chunks]);
    expect(() => parseWavInfo(wav)).toThrow(/data/);
  });

  it("非 RIFF 文件抛错", () => {
    expect(() => parseWavInfo(Buffer.from("ID3whatever"))).toThrow(/RIFF/);
  });
});

describe("appendSilence / pcmDurationSeconds", () => {
  it("16kHz 单声道 16bit 下 300ms = 9600 字节", () => {
    const pcm = Buffer.alloc(8);
    const padded = appendSilence(pcm, 16000, 1, 2, 300);
    expect(padded.length).toBe(8 + 9600);
  });

  it("由 PCM 长度反推时长", () => {
    expect(pcmDurationSeconds(16000 * 2 * 2, 16000, 1, 2)).toBe(2);
    expect(pcmDurationSeconds(0, 16000, 1, 2)).toBe(0);
  });
});

function int32(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeInt32LE(value, 0);
  return buf;
}
