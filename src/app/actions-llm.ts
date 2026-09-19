"use server";

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
}

export interface PolishInput {
  text: string;
  config: LLMConfig;
}

export interface PolishResult {
  success: boolean;
  polishedText?: string;
  error?: string;
}

const MAX_POLISH_TEXT_LENGTH = 5000;
const LLM_TIMEOUT_MS = 60_000;

/**
 * 校验并规范化 baseUrl：只允许 http/https（本地 Ollama 等自建服务走 http），
 * 防止把 file:/ftp: 等奇怪协议交给服务端 fetch。
 */
function normalizeBaseUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname) return null;
    return raw.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/**
 * Server Action: 使用用户配置的 OpenAI 兼容大模型润色文字
 * 所有配置由用户提供，服务端只负责转发
 */
export async function polishText(input: PolishInput): Promise<PolishResult> {
  try {
    const { text, config } = input;

    if (!config.apiKey || !config.baseUrl || !config.model) {
      return {
        success: false,
        error: "大模型配置不完整，请先在设置页配置",
      };
    }
    if (typeof text !== "string" || !text.trim()) {
      return { success: false, error: "请输入要润色的文字" };
    }
    if (text.length > MAX_POLISH_TEXT_LENGTH) {
      return { success: false, error: `文字超过 ${MAX_POLISH_TEXT_LENGTH} 字符上限` };
    }

    const baseUrl = normalizeBaseUrl(config.baseUrl);
    if (!baseUrl) {
      return { success: false, error: "Base URL 无效，请填写 http(s):// 开头的完整地址" };
    }

    const temperature = Number.isFinite(config.temperature)
      ? Math.min(2, Math.max(0, config.temperature))
      : 0.7;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature,
        messages: [
          {
            role: "system",
            content:
              "你是一位文字润色助手。请对用户提供的文字进行润色，使其更自然、流畅、适合朗读。保持原意不变，不要过度发挥。直接返回润色后的文字，不要添加解释。润色后的文字请控制在 1000 字符以内。",
          },
          {
            role: "user",
            content: text,
          },
        ],
      }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });

    if (!response.ok) {
      // 不透传上游错误体（可能是长 HTML），只保留状态码
      throw new Error(`大模型请求失败（HTTP ${response.status}）`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (data.error) {
      throw new Error(data.error.message || "大模型返回错误");
    }

    const polishedText = data.choices?.[0]?.message?.content?.trim();

    if (!polishedText) {
      throw new Error("大模型返回内容为空");
    }

    return {
      success: true,
      polishedText,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return { success: false, error: "大模型响应超时，请稍后再试" };
    }
    if (err instanceof TypeError) {
      return { success: false, error: "无法连接到大模型服务，请检查 Base URL" };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "润色失败，请稍后再试",
    };
  }
}
