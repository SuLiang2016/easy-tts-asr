/**
 * 纯函数：把 PCM 采样编码为 16bit WAV（RIFF）容器。
 * 与浏览器 API 解耦，便于单元测试。
 */

function writeString(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/** 计算 16bit PCM WAV 的 data 子块字节数 */
export function wavDataLength(sampleCount: number, channels: number): number {
  return sampleCount * channels * 2;
}

/**
 * 将多声道 Float32 采样（-1..1）编码为 16bit PCM WAV 的 ArrayBuffer。
 * 采样会被钳制到 [-1, 1]。
 */
export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  if (channels.length === 0) throw new Error("没有可编码的声道");
  const numberOfChannels = channels.length;
  const sampleCount = channels[0].length;
  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const dataLength = wavDataLength(sampleCount, numberOfChannels);
  const bufferLength = 44 + dataLength;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // RIFF chunk descriptor
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt 块大小
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < sampleCount; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return arrayBuffer;
}
