"use client";

import { useState, useRef, useImperativeHandle, forwardRef } from "react";
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

    const togglePlay = () => {
      if (!audioRef.current) return;
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
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
        <audio
          ref={audioRef}
          src={src}
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
          className="hidden"
        />
        <Button variant="outline" size="icon" onClick={togglePlay}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <div className="flex-1">
          <audio src={src} controls className="h-10 w-full" />
        </div>
        <Button variant="outline" size="icon" onClick={handleDownload} title="下载音频">
          <Download className="h-4 w-4" />
        </Button>
      </div>
    );
  }
);

AudioPlayer.displayName = "AudioPlayer";
