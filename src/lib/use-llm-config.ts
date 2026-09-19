"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { readLocalRaw, useHydrated, writeLocalRaw } from "./use-local-store";

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
}

const STORAGE_KEY = "hello-tts-llm-config";
const LLM_CONFIG_CHANGE_EVENT = "hello-tts-llm-config-change";

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-3.5-turbo",
  temperature: 0.7,
};

function parseStoredConfig(raw: string | null): LLMConfig {
  if (!raw) return DEFAULT_LLM_CONFIG;
  try {
    const parsed = JSON.parse(raw) as Partial<LLMConfig>;
    return {
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : DEFAULT_LLM_CONFIG.apiKey,
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : DEFAULT_LLM_CONFIG.baseUrl,
      model: typeof parsed.model === "string" ? parsed.model : DEFAULT_LLM_CONFIG.model,
      temperature:
        typeof parsed.temperature === "number" && Number.isFinite(parsed.temperature)
          ? Math.min(2, Math.max(0, parsed.temperature))
          : DEFAULT_LLM_CONFIG.temperature,
    };
  } catch {
    return DEFAULT_LLM_CONFIG;
  }
}

function readConfigSnapshot(): string | null {
  return readLocalRaw(STORAGE_KEY);
}

function getServerConfigSnapshot(): string | null {
  return null;
}

function subscribeLLMConfig(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(LLM_CONFIG_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LLM_CONFIG_CHANGE_EVENT, onChange);
  };
}

export function useLLMConfig() {
  const raw = useSyncExternalStore(subscribeLLMConfig, readConfigSnapshot, getServerConfigSnapshot);
  const hydrated = useHydrated();
  const config = useMemo(() => parseStoredConfig(raw), [raw]);

  const saveConfig = useCallback((newConfig: LLMConfig) => {
    writeLocalRaw(STORAGE_KEY, JSON.stringify(newConfig));
    window.dispatchEvent(new Event(LLM_CONFIG_CHANGE_EVENT));
  }, []);

  const hasConfig = !!config.apiKey && !!config.baseUrl && !!config.model;

  return { config, saveConfig, hasConfig, hydrated };
}
