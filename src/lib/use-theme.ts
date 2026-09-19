"use client";

import { useCallback, useSyncExternalStore } from "react";
import { readLocalRaw, useHydrated, writeLocalRaw } from "./use-local-store";

type Theme = "light" | "dark";

const STORAGE_KEY = "hello-tts-theme";
const THEME_CHANGE_EVENT = "hello-tts-theme-change";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(): Theme | null {
  const raw = readLocalRaw(STORAGE_KEY);
  return raw === "light" || raw === "dark" ? raw : null;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
}

function getThemeSnapshot(): Theme {
  return getStoredTheme() ?? getSystemTheme();
}

function subscribeTheme(onChange: () => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => {
    applyTheme(getThemeSnapshot());
    onChange();
  };

  window.addEventListener("storage", handleChange);
  window.addEventListener(THEME_CHANGE_EVENT, handleChange);
  mediaQuery.addEventListener("change", handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(THEME_CHANGE_EVENT, handleChange);
    mediaQuery.removeEventListener("change", handleChange);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => "light" as Theme);
  // layout 内联脚本已保证首屏 HTML 主题正确；hydrated 只用于图标等纯客户端展示的稳定
  const hydrated = useHydrated();

  const toggleTheme = useCallback(() => {
    const next: Theme = getThemeSnapshot() === "dark" ? "light" : "dark";
    applyTheme(next);
    writeLocalRaw(STORAGE_KEY, next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  return { theme, toggleTheme, mounted: hydrated };
}
