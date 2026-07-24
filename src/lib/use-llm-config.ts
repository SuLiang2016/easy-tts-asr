"use client";

import { useState } from "react";

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
}

const STORAGE_KEY = "hello-tts-llm-config";

const DEFAULT_CONFIG: LLMConfig = {
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-3.5-turbo",
  temperature: 0.7,
};

export function useLLMConfig() {
  const [config, setConfig] = useState<LLMConfig>(() => {
    if (typeof window === "undefined") return DEFAULT_CONFIG;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch {
    }
    return DEFAULT_CONFIG;
  });

  const saveConfig = (newConfig: LLMConfig) => {
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
  };

  const hasConfig = !!config.apiKey && !!config.baseUrl && !!config.model;

  return { config, saveConfig, hasConfig, mounted: true };
}
