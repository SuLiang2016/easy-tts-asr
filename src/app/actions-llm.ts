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

    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature,
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`大模型请求失败: ${response.status} ${errorText}`);
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
    return {
      success: false,
      error: err instanceof Error ? err.message : "未知错误",
    };
  }
}
