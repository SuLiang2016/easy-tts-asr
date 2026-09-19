"use client";

import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from "react";
import { Play, Pause, Download, Loader2 } from "lucide-react";
import { Button } from "./button";

interface AudioPlayerProps {
  src?: string;
  isLoading?: boolean;
  fileName?: string;
  onPlayChange?: (playing: boolean) => void;
}

export interface AudioPlayerHandle {
  pause: () => void;
}

/**
 * 音频播放器：单个 <audio controls> 承载全部播放控制，
 * 自定义按钮与原生控件操作同一元素，天然互斥（旧版双元素会重叠出声）。
 */
export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  ({ src, isLoading, fileName = "audio.mp3", onPlayChange }, ref) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        pause: () => {
          audioRef.current?.pause();
        },
      }),
      []
    );

    // 换源时停止旧播放状态
    useEffect(() => {
      setIsPlaying(false);
      onPlayChange?.(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src]);

    const togglePlay = () => {
      if (!audioRef.current) return;
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
    };

    const handleDownload = () => {
      if (!src) return;
      const link = document.createElement("a");
      link.href = src;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    if (isLoading) {
      return (
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>正在生成音频...</span>
        </div>
      );
    }

    if (!src) {
      return (
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <span>生成完成后将显示播放器</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
        <Button
          variant="outline"
          size="icon"
          onClick={togglePlay}
          aria-label={isPlaying ? "暂停" : "播放"}
          title={isPlaying ? "暂停" : "播放"}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <div className="flex-1">
          <audio
            ref={audioRef}
            src={src}
            controls
            onPlay={() => {
              setIsPlaying(true);
              onPlayChange?.(true);
            }}
            onPause={() => {
              setIsPlaying(false);
              onPlayChange?.(false);
            }}
            onEnded={() => {
              setIsPlaying(false);
              onPlayChange?.(false);
            }}
            className="h-10 w-full"
          />
        </div>
        <Button variant="outline" size="icon" onClick={handleDownload} title="下载音频" aria-label="下载音频">
          <Download className="h-4 w-4" />
        </Button>
      </div>
    );
  }
);

AudioPlayer.displayName = "AudioPlayer";
