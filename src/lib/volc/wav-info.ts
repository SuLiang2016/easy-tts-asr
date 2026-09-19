/**
 * WAV 容器解析（纯函数，可测试）。
 * 遍历 RIFF 子块定位 "data"，而不是假设 fmt 固定在偏移 22/24/34 ——
 * 带 LIST/JUNK 等额外块的 WAV 会错位。
 */

export interface WavInfo {
  channels: number;
  /** 字节宽（2 = 16bit） */
  sampleWidth: number;
  sampleRate: number;
  pcmData: Buffer;
}

export function parseWavInfo(data: Buffer): WavInfo {
  if (data.length < 44 || data.subarray(0, 4).toString("ascii") !== "RIFF") {
    throw new Error("WAV 文件无效：缺少 RIFF 头");
  }

  // fmt 块紧随 "WAVE" 标识，但需按子块遍历确认其位置
  let pos = 12;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;

  while (pos + 8 <= data.length) {
    const chunkId = data.subarray(pos, pos + 4).toString("ascii");
    const chunkSize = data.readUInt32LE(pos + 4);

    if (chunkId === "fmt ") {
      channels = data.readUInt16LE(pos + 8 + 2);
      sampleRate = data.readUInt32LE(pos + 8 + 4);
      bitsPerSample = data.readUInt16LE(pos + 8 + 14);
    } else if (chunkId === "data") {
      if (!channels || !sampleRate || !bitsPerSample) {
        throw new Error("WAV 文件无效：data 块之前未找到 fmt 块");
      }
      return {
        channels,
        sampleWidth: bitsPerSample / 8,
        sampleRate,
        pcmData: data.subarray(pos + 8, Math.min(pos + 8 + chunkSize, data.length)),
      };
    }

    pos += 8 + chunkSize + (chunkSize % 2); // 子块按 2 字节对齐
  }

  throw new Error("WAV 文件无效：未找到 data 子块");
}

/** 在 PCM 数据尾部追加指定毫秒的静音（全零样本） */
export function appendSilence(
  data: Buffer,
  sampleRate: number,
  channels: number,
  sampleWidth: number,
  durationMs: number
): Buffer {
  const silenceSize = Math.floor((sampleRate * channels * sampleWidth * durationMs) / 1000);
  return Buffer.concat([data, Buffer.alloc(silenceSize)]);
}

/** 由 PCM 数据量估算时长（秒） */
export function pcmDurationSeconds(
  pcmLength: number,
  sampleRate: number,
  channels: number,
  sampleWidth: number
): number {
  const bytesPerSecond = sampleRate * channels * sampleWidth;
  return bytesPerSecond > 0 ? pcmLength / bytesPerSecond : 0;
}
