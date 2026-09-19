"use client";

import { useRef, useState } from "react";
import { Wand2, FileAudio, Clock, Mic2, X, Trash2, Play, Pause, Download, RotateCcw } from "lucide-react";
import { convertVoice } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { AudioPlayer, AudioPlayerHandle } from "@/components/ui/audio-player";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AudioRecorder } from "@/components/audio-recorder";
import { VoiceControls } from "@/components/voice-controls";
import { useAudioHistory } from "@/hooks/use-audio-history";
import { prepareAudioForASR, base64ToArrayBuffer } from "@/lib/audio";
import { VOICES } from "@/lib/voices";
import { formatSize, formatTime } from "@/lib/format";
import { randomId } from "@/lib/random";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE_MB = 20;
const MAX_DURATION_SECONDS = 60; // 换声限制 60 秒

type Conversion = {
  id: string;
  text: string;
  voiceType: string;
  audioBlobUrl: string;
  audioSize: number;
  createdAt: number;
};

const getVoiceName = (id: string) => VOICES.find((v) => v.id === id)?.name ?? id;

export default function VoiceConversionPage() {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [voiceType, setVoiceType] = useState(VOICES[0].id);
  const [speed, setSpeed] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [recognizedText, setRecognizedText] = useState("");
  const [audioSrc, setAudioSrc] = useState<string>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const { items: conversions, add, remove: deleteConversionById, clear: clearHistory } = useAudioHistory<Conversion>();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const mainPlayerRef = useRef<AudioPlayerHandle>(null);
  const inlineAudioRef = useRef<HTMLAudioElement | null>(null);

  const processSourceAudio = async (file: File) => {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`文件过大，请限制在 ${MAX_FILE_SIZE_MB}MB 以内`);
      return;
    }
    setSourceFile(file);
    setError(undefined);
    setRecognizedText("");
    setAudioSrc(undefined);
  };

  const handleConvert = async () => {
    if (!sourceFile) return;
    setError(undefined);
    setIsLoading(true);

    try {
      // 前置处理与服务端校验（60 秒上限）共用 ASR 流水线
      const prepared = await prepareAudioForASR(sourceFile);

      const result = await convertVoice({
        audioBase64: prepared.base64,
        format: prepared.format,
        voiceType,
        speed,
        volume,
        pitch,
      });

      if (result.success && result.audioBase64) {
        const buffer = base64ToArrayBuffer(result.audioBase64);
        const blob = new Blob([buffer], { type: "audio/mp3" });
        const conversion: Conversion = {
          id: randomId(),
          text: result.text || "",
          voiceType,
          audioBlobUrl: URL.createObjectURL(blob),
          audioSize: blob.size,
          createdAt: Date.now(),
        };
        add(conversion);
        // 最新结果直接进播放器与识别文字区
        setRecognizedText(conversion.text);
        setAudioSrc(conversion.audioBlobUrl);
        setActiveId(conversion.id);
      } else {
        setError(result.error || "换声失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "处理失败");
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversion = (c: Conversion) => {
    if (c.id === activeId && audioSrc === c.audioBlobUrl) return;
    if (inlineAudioRef.current) inlineAudioRef.current.pause();
    setPlayingId(null);
    setRecognizedText(c.text);
    setAudioSrc(c.audioBlobUrl);
    setActiveId(c.id);
  };

  const toggleInlinePlay = (c: Conversion) => {
    const audio = inlineAudioRef.current;
    if (!audio) return;
    if (playingId === c.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    mainPlayerRef.current?.pause();
    audio.src = c.audioBlobUrl;
    audio
      .play()
      .then(() => setPlayingId(c.id))
      .catch(() => {});
  };

  const handleDownload = (c: Conversion) => {
    const link = document.createElement("a");
    link.href = c.audioBlobUrl;
    link.download = `converted-${getVoiceName(c.voiceType)}-${c.id.slice(0, 6)}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteConversion = (id: string) => {
    deleteConversionById(id);
    if (activeId === id) {
      setActiveId(null);
      setAudioSrc(undefined);
      setRecognizedText("");
    }
    if (playingId === id) {
      if (inlineAudioRef.current) inlineAudioRef.current.pause();
      setPlayingId(null);
    }
  };

  const clearAll = () => {
    if (conversions.length === 0) return;
    if (inlineAudioRef.current) inlineAudioRef.current.pause();
    clearHistory();
    setActiveId(null);
    setAudioSrc(undefined);
    setRecognizedText("");
    setPlayingId(null);
  };

  const totalSize = conversions.reduce((sum, c) => sum + c.audioSize, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">换声</h1>
        <p className="text-muted-foreground">上传语音，选择目标音色，生成变声后的音频</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>上传或录制原声</CardTitle>
          <CardDescription>
            为保证效果，建议音频时长不超过 {MAX_DURATION_SECONDS} 秒
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted px-6 py-8 transition-colors hover:bg-muted/80">
              <FileAudio className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">点击上传音频文件</span>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processSourceAudio(file);
                  e.target.value = "";
                }}
                className="hidden"
                disabled={isLoading}
              />
            </label>
            <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-card p-4">
              <AudioRecorder
                onAudioReady={processSourceAudio}
                onError={setError}
                maxDurationSeconds={MAX_DURATION_SECONDS}
                disabled={isLoading}
              />
            </div>
          </div>
          {sourceFile && (
            <p className="text-sm text-muted-foreground">已选择：{sourceFile.name}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>目标音色与效果</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <VoiceControls
            voiceType={voiceType}
            onVoiceChange={setVoiceType}
            speed={speed}
            onSpeedChange={setSpeed}
            volume={volume}
            onVolumeChange={setVolume}
            pitch={pitch}
            onPitchChange={setPitch}
          />
        </CardContent>
      </Card>

      {recognizedText && (
        <Card>
          <CardHeader>
            <CardTitle>识别文字</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea value={recognizedText} readOnly rows={4} />
          </CardContent>
        </Card>
      )}

      {error && <Alert variant="destructive">{error}</Alert>}

      <Button
        size="lg"
        onClick={handleConvert}
        disabled={!sourceFile || isLoading}
        className="w-full gap-2"
      >
        <Wand2 className="h-5 w-5" />
        {isLoading ? "处理中..." : "开始换声"}
      </Button>

      <AudioPlayer ref={mainPlayerRef} src={audioSrc} isLoading={isLoading} fileName="converted-voice.mp3" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              换声历史
              {conversions.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  （{conversions.length}）· 共 {formatSize(totalSize)}
                </span>
              )}
            </CardTitle>
            {conversions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                disabled={isLoading}
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
              >
                <Trash2 className="h-3 w-3" />
                清空
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {conversions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                尚无换声记录，点击上方「开始换声」生成
              </p>
            ) : (
              conversions.map((c) => {
                const isPlaying = playingId === c.id;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "rounded-md border p-3 transition-colors",
                      activeId === c.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span className="shrink-0">{formatTime(c.createdAt)}</span>
                      <Mic2 className="h-3 w-3 shrink-0" />
                      <span className="shrink-0 truncate">{getVoiceName(c.voiceType)}</span>
                      <span className="shrink-0">· {formatSize(c.audioSize)}</span>
                    </div>
                    <p className="line-clamp-2 text-sm">{c.text || "（无识别内容）"}</p>
                    <div className="mt-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleInlinePlay(c)}
                        disabled={isLoading}
                        aria-label={isPlaying ? "暂停" : "播放"}
                        title={isPlaying ? "暂停" : "播放"}
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-muted disabled:opacity-50",
                          isPlaying ? "text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(c)}
                        disabled={isLoading}
                        aria-label="下载音频"
                        title="下载音频"
                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => loadConversion(c)}
                        disabled={isLoading}
                        aria-label="加载到播放器"
                        title="加载到播放器"
                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteConversion(c.id)}
                        disabled={isLoading}
                        aria-label="删除该条"
                        title="删除该条"
                        className="ml-auto flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* 就地播放共享音频元素 */}
      <audio ref={inlineAudioRef} onEnded={() => setPlayingId(null)} className="hidden" />
    </div>
  );
}
