/**
 * 火山引擎语音能力统一出口（服务端专用）。
 * - tts.ts / asr.ts：业务调用
 * - asr-protocol.ts / wav-info.ts / tts-params.ts：纯协议与映射（可单测）
 * - config.ts / errors.ts：配置与错误规范化
 */
export type { TTSOptions, TTSResult } from "./tts";
export type { ASROptions, ASRResult } from "./asr";
export { synthesizeSpeech } from "./tts";
export { recognizeSpeech } from "./asr";
export { UpstreamError, truncateForDisplay } from "./errors";
