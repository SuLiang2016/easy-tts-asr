"use client";

import { useMemo, useSyncExternalStore } from "react";

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
}

const STORAGE_KEY = "hello-tts-llm-config";
const LLM_CONFIG_CHANGE_EVENT = "hello-tts-llm-config-change";

const DEFAULT_CONFIG: LLMConfig = {
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-3.5-turbo",
  temperature: 0.7,
};

function parseStoredConfig(stored: string): LLMConfig {
  try {
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch {
  }

  return DEFAULT_CONFIG;
}

function readStoredConfigSnapshot(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function subscribeLLMConfig(onChange: () => void) {
  const handleChange = () => onChange();

  window.addEventListener("storage", handleChange);
  window.addEventListener(LLM_CONFIG_CHANGE_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(LLM_CONFIG_CHANGE_EVENT, handleChange);
  };
}

export function useLLMConfig() {
  const configSnapshot = useSyncExternalStore(subscribeLLMConfig, readStoredConfigSnapshot, () => "");
  const config = useMemo(() => parseStoredConfig(configSnapshot), [configSnapshot]);

  const saveConfig = (newConfig: LLMConfig) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    window.dispatchEvent(new Event(LLM_CONFIG_CHANGE_EVENT));
  };

  const hasConfig = !!config.apiKey && !!config.baseUrl && !!config.model;

  return { config, saveConfig, hasConfig, mounted: true };
}
