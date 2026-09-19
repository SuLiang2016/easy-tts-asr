import { describe, expect, it } from "vitest";
import {
  mapTtsAdjustments,
  pitchToSemitones,
  speedToSpeechRate,
  volumeToLoudnessRate,
} from "@/lib/volc/tts-params";
import { parseTTSRecord } from "@/lib/volc/tts";
import { UpstreamError } from "@/lib/volc/errors";

describe("TTS 调节参数映射", () => {
  it("语速倍率线性映射 speech_rate [-50, 100]", () => {
    expect(speedToSpeechRate(1.0)).toBe(0);
    expect(speedToSpeechRate(0.5)).toBe(-50);
    expect(speedToSpeechRate(2.0)).toBe(100);
    expect(speedToSpeechRate(1.5)).toBe(50);
    expect(speedToSpeechRate(3.0)).toBe(100); // 钳制
    expect(speedToSpeechRate(0.2)).toBe(-50);
  });

  it("音量倍率线性映射 loudness_rate [-50, 100]", () => {
    expect(volumeToLoudnessRate(1.0)).toBe(0);
    expect(volumeToLoudnessRate(0.5)).toBe(-50);
    expect(volumeToLoudnessRate(2.0)).toBe(100);
  });

  it("音调倍率按半音映射 pitch [-12, 12]", () => {
    expect(pitchToSemitones(1.0)).toBe(0);
    expect(pitchToSemitones(2.0)).toBe(12);
    expect(pitchToSemitones(0.5)).toBe(-12);
    expect(pitchToSemitones(1.5)).toBe(7); // round(12*log2(1.5))
  });

  it("默认值（1.0）不下发任何字段，保持请求体零回归", () => {
    expect(mapTtsAdjustments({ speed: 1, volume: 1, pitch: 1 })).toEqual({});
    expect(mapTtsAdjustments({})).toEqual({});
  });

  it("偏离默认值时下发对应字段", () => {
    expect(mapTtsAdjustments({ speed: 1.5 })).toEqual({ speech_rate: 50 });
    expect(mapTtsAdjustments({ volume: 0.5, pitch: 2 })).toEqual({ loudness_rate: -50, pitch: 12 });
  });
});

describe("parseTTSRecord", () => {
  it("解析音频分片", () => {
    expect(parseTTSRecord(JSON.stringify({ code: 0, data: "QUJD" }), "")).toEqual({ audioBase64: "QUJD" });
  });

  it("解析完成标记", () => {
    expect(parseTTSRecord(JSON.stringify({ code: 20000000 }), "")).toEqual({ done: true });
  });

  it("错误码抛 UpstreamError", () => {
    expect(() => parseTTSRecord(JSON.stringify({ code: 45000001, message: "quota" }), "log-1")).toThrow(UpstreamError);
  });

  it("流中脏数据行跳过而不是中断", () => {
    expect(parseTTSRecord("{{not json", "")).toEqual({});
  });

  it("无 code 但有 data 时仍提取音频", () => {
    expect(parseTTSRecord(JSON.stringify({ data: "QUJD" }), "")).toEqual({ audioBase64: "QUJD" });
  });
});
