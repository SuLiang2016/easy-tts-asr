"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";

interface AudioRecorderProps {
  onAudioReady: (file: File) => void;
  /** 获取麦克风失败等错误的用户可读文案回调；不传时退回 alert */
  onError?: (message: string) => void;
  maxDurationSeconds?: number;
  /** 外部处理中时禁用开始按钮，避免并发提交 */
  disabled?: boolean;
}

/** 按浏览器支持度选择录音容器（Safari 产出 mp4/aac，不能硬编码 webm） */
const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_MIME_TYPES.find((mime) => {
    try {
      return MediaRecorder.isTypeSupported(mime);
    } catch {
      return false;
    }
  });
}

function extForMime(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}

function describeMediaError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") return "麦克风权限被拒绝，请在浏览器地址栏允许麦克风访问";
    if (err.name === "NotFoundError") return "未检测到麦克风设备";
  }
  return "无法访问麦克风，请检查设备与权限设置";
}

export function AudioRecorder({ onAudioReady, onError, maxDurationSeconds = 60, disabled }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const durationRef = useRef(0);
  const unmountedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    clearTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop(); // onstop 负责收尾与产出文件
    } else if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  }, [clearTimer]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      } catch (err) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        throw err;
      }

      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        clearTimer();
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const file = new File([blob], `recording.${extForMime(type)}`, { type });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        // 卸载触发的 stop 不再回调父组件（否则导航后还会发起一次请求）
        if (!unmountedRef.current) {
          setRecordedFile(file);
          setLastDuration(durationRef.current);
          onAudioReady(file);
        }
      };

      recorder.start();
      setIsRecording(true);
      setDuration(0);
      durationRef.current = 0;
      startedAtRef.current = Date.now();

      // 按真实墙钟计时，到点即停（旧实现混入 state updater 且多录 1 秒）
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setDuration(elapsed);
        durationRef.current = elapsed;
        if (elapsed >= maxDurationSeconds) {
          stopRecording();
        }
      }, 250);
    } catch (err) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      const message = describeMediaError(err);
      if (onError) {
        onError(message);
      } else {
        alert(message);
      }
    }
  }, [clearTimer, maxDurationSeconds, onAudioReady, onError, stopRecording]);

  const clearRecording = useCallback(() => {
    setRecordedFile(null);
    setLastDuration(null);
    setDuration(0);
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      clearTimer();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      } else if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [clearTimer]);

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
      {!isRecording && !recordedFile && (
        <Button onClick={startRecording} className="gap-2" disabled={disabled}>
          <Mic className="h-4 w-4" />
          开始录音
        </Button>
      )}
      {isRecording && (
        <>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive animate-pulse">
            <Mic className="h-4 w-4" />
          </div>
          <span className="font-mono text-lg">{formatDuration(duration)}</span>
          <Button variant="destructive" size="sm" onClick={stopRecording} className="gap-2">
            <Square className="h-4 w-4" />
            停止
          </Button>
        </>
      )}
      {!isRecording && recordedFile && (
        <>
          <span className="text-sm text-muted-foreground">
            已录制 {formatDuration(lastDuration ?? 0)}
          </span>
          <Button variant="outline" size="sm" onClick={clearRecording} className="gap-2">
            <Trash2 className="h-4 w-4" />
            清除
          </Button>
        </>
      )}
    </div>
  );
}
