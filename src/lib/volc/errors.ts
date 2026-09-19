/** 上游（火山/大模型）调用错误的统一封装：携带来源与 logid，文案已是用户可读的中文 */
export class UpstreamError extends Error {
  constructor(
    /** 出错的上游服务 */
    public readonly kind: "TTS" | "ASR" | "LLM" | "配置",
    message: string,
    /** 火山返回的 X-Tt-Logid，排查问题时需要提供给官方 */
    public readonly logId?: string
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

/** 截断上游返回的原始错误体（可能是大段 HTML），避免整页灌进 UI */
export function truncateForDisplay(text: string, max = 200): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max)}…` : compact;
}
