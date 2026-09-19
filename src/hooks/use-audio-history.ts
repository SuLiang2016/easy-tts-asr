"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface HistoryItemBase {
  id: string;
  createdAt: number;
  /** 存在时由 hook 负责全部 revoke（删除/清空/卸载） */
  audioBlobUrl?: string;
}

/**
 * 统一的生成历史管理：列表状态 + blob URL 全生命周期（删除、清空、组件卸载时 revoke）。
 * TTS / ASR / 换声三页共用，杜绝 createObjectURL 泄漏。
 */
export function useAudioHistory<T extends HistoryItemBase>() {
  const [items, setItems] = useState<T[]>([]);
  // 镜像 ref 供事件回调（remove/clear/卸载清理）读取当前列表，同步在 effect 中完成
  const itemsRef = useRef<T[]>(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const revoke = useCallback((item: T | undefined) => {
    if (item?.audioBlobUrl) {
      URL.revokeObjectURL(item.audioBlobUrl);
    }
  }, []);

  /** 新记录插到最前 */
  const add = useCallback((item: T) => {
    setItems((prev) => [item, ...prev]);
  }, []);

  const remove = useCallback(
    (id: string) => {
      revoke(itemsRef.current.find((item) => item.id === id));
      setItems((prev) => prev.filter((item) => item.id !== id));
    },
    [revoke]
  );

  const clear = useCallback(() => {
    itemsRef.current.forEach(revoke);
    setItems([]);
  }, [revoke]);

  // 组件卸载（如路由切换）时释放全部 blob，防止内存泄漏
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => {
        if (item.audioBlobUrl) URL.revokeObjectURL(item.audioBlobUrl);
      });
    };
  }, []);

  return { items, add, remove, clear };
}
