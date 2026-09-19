"use client";

import { useSyncExternalStore } from "react";

/**
 * 真实的 hydration 信号：服务端渲染期间为 false，客户端完成首次渲染后为 true。
 * 用于避免 SSR 快照与 localStorage 实际值不一致导致的 UI 闪跳/误判。
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

/** 安全读取 localStorage 字符串，任何异常（隐私模式等）返回 null */
export function readLocalRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** 安全写入 localStorage */
export function writeLocalRaw(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 隐私模式等场景下写入失败，静默降级为会话内生效
  }
}
