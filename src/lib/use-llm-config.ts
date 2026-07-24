"use client";

import { useEffect, useState } from "react";

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
  const [config, setConfig] = useState<LLMConfig>(DEFAULT_CONFIG);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(stored) });
      }
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  const saveConfig = (newConfig: LLMConfig) => {
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
  };

  const hasConfig = mounted && !!config.apiKey && !!config.baseUrl && !!config.model;

  return { config, saveConfig, hasConfig, mounted };
}
