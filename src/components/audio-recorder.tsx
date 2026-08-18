"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AudioRecorderProps {
  onAudioReady: (file: File) => void;
  maxDurationSeconds?: number;
}

export function AudioRecorder({ onAudioReady, maxDurationSeconds = 60 }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], "recording.webm", { type: "audio/webm" });
        setRecordedFile(file);
        onAudioReady(file);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev >= maxDurationSeconds) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      alert("无法访问麦克风，请检查权限设置");
    }
  }, [maxDurationSeconds, onAudioReady, stopRecording]);

  const clearRecording = useCallback(() => {
    setRecordedFile(null);
    setDuration(0);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      } else if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
      {!isRecording && !recordedFile && (
        <Button onClick={startRecording} className="gap-2">
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
            已录制 {formatDuration(Math.round(recordedFile.size / 16000) || 1)}
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
