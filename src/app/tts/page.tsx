"use client";

import { useState } from "react";
import { Wand2, Sparkles, Clock, Mic2, X, Trash2 } from "lucide-react";
import { textToSpeech } from "@/app/actions";
import { polishText } from "@/app/actions-llm";
import { Button } from "@/components/ui/button";
import { Textarea, Select, Label } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { AudioPlayer } from "@/components/ui/audio-player";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VOICES, FEATURED_VOICES, FUN_VOICES } from "@/lib/voices";
import { useLLMConfig } from "@/lib/use-llm-config";
import { base64ToArrayBuffer } from "@/lib/audio";
import { cn } from "@/lib/utils";

const MAX_TEXT_LENGTH = 250; // 约 1024 字节的 80%
const MEMORY_WARN_THRESHOLD = 10 * 1024 * 1024; // 10MB 软警告

type Generation = {
  id: string;
  text: string;
  voiceType: string;
  speed: number;
  volume: number;
  pitch: number;
  audioBlobUrl: string;
  audioSize: number;
  createdAt: number;
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (d.toDateString() === now.toDateString()) return time;
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

const getVoiceName = (id: string) => VOICES.find((v) => v.id === id)?.name ?? id;

export default function TTSPage() {
  const [text, setText] = useState("");
  const [voiceType, setVoiceType] = useState(VOICES[0].id);
  const [speed, setSpeed] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [audioSrc, setAudioSrc] = useState<string>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const [generations, setGenerations] = useState<Generation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadedText, setLoadedText] = useState("");

  const { config, hasConfig } = useLLMConfig();

  const dirty = text !== loadedText;
  const totalSize = generations.reduce((sum, g) => sum + g.audioSize, 0);

  const handleGenerate = async () => {
    if (!text.trim() || isOverLimit) return;
    setError(undefined);
    setAudioSrc(undefined); // 清空播放器：新音频只入历史，不自动加载
    setIsLoading(true);

    try {
      const result = await textToSpeech({
        text: text.trim(),
        voiceType,
        speed,
        volume,
        pitch,
        encoding: "mp3",
      });

      if (result.success && result.audioBase64) {
        const buffer = base64ToArrayBuffer(result.audioBase64);
        const blob = new Blob([buffer], { type: "audio/mp3" });
        const url = URL.createObjectURL(blob);
        const gen: Generation = {
          id: crypto.randomUUID(),
          text: text.trim(),
          voiceType,
          speed,
          volume,
          pitch,
          audioBlobUrl: url,
          audioSize: blob.size,
          createdAt: Date.now(),
        };
        // 只入历史，不自动加载到播放器；标记当前文本为已锚定，避免误触发切换确认
        setGenerations((prev) => [gen, ...prev]);
        setLoadedText(text);
      } else {
        setError(result.error || "生成失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePolish = async () => {
    if (!text.trim() || !hasConfig) return;
    setError(undefined);
    setIsLoading(true);

    try {
      const result = await polishText({ text: text.trim(), config });
      if (result.success && result.polishedText) {
        setText(result.polishedText);
      } else {
        setError(result.error || "润色失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "润色失败");
    } finally {
      setIsLoading(false);
    }
  };

  const loadGeneration = (gen: Generation) => {
    if (gen.id === activeId) return;
    if (dirty && !window.confirm("当前文本未保存，切换将丢失，是否继续？")) return;
    setText(gen.text);
    setVoiceType(gen.voiceType);
    setSpeed(gen.speed);
    setVolume(gen.volume);
    setPitch(gen.pitch);
    setAudioSrc(gen.audioBlobUrl);
    setLoadedText(gen.text);
    setActiveId(gen.id);
  };

  const deleteGeneration = (id: string) => {
    const target = generations.find((g) => g.id === id);
    if (target) URL.revokeObjectURL(target.audioBlobUrl);
    setGenerations((prev) => prev.filter((g) => g.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setAudioSrc(undefined);
      setLoadedText("");
    }
  };

  const clearAll = () => {
    if (generations.length === 0) return;
    generations.forEach((g) => URL.revokeObjectURL(g.audioBlobUrl));
    setGenerations([]);
    setActiveId(null);
    setAudioSrc(undefined);
    // 不动 Textarea 文本：清空音频历史与文本输入无关
  };

  const currentLength = new Blob([text]).size;
  const isOverLimit = currentLength > MAX_TEXT_LENGTH;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">文字转语音</h1>
        <p className="text-muted-foreground">输入文字，选择音色，一键生成语音。多次生成累积为历史，点击任意条目回填并播放。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>文本内容</CardTitle>
          <CardDescription>
            建议控制在 {MAX_TEXT_LENGTH} 字节以内（当前 {currentLength} 字节）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="请输入要合成的文字..."
              rows={6}
              className={isOverLimit ? "border-destructive" : ""}
            />
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
              {currentLength}/{MAX_TEXT_LENGTH}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePolish}
              disabled={!hasConfig || !text.trim() || isLoading}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              AI 润色
            </Button>
            {!hasConfig && (
              <span className="text-xs text-muted-foreground">
                （未配置大模型，润色功能已禁用）
              </span>
            )}
            {activeId && dirty && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                已修改未保存：切换或清空将丢失当前编辑
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>音色与效果</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>选择音色</Label>
            <Select value={voiceType} onChange={(e) => setVoiceType(e.target.value)}>
              <optgroup label="精品音色">
                {FEATURED_VOICES.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} - {voice.description}
                  </option>
                ))}
              </optgroup>
              <optgroup label="特色/恶搞音色">
                {FUN_VOICES.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} - {voice.description}
                  </option>
                ))}
              </optgroup>
            </Select>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <Slider
              label="语速"
              valueDisplay={speed.toFixed(1)}
              min={0.2}
              max={3.0}
              step={0.1}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
            />
            <Slider
              label="音量"
              valueDisplay={volume.toFixed(1)}
              min={0.1}
              max={3.0}
              step={0.1}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
            />
            <Slider
              label="音调"
              valueDisplay={pitch.toFixed(1)}
              min={0.1}
              max={3.0}
              step={0.1}
              value={pitch}
              onChange={(e) => setPitch(parseFloat(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      {error && <Alert variant="destructive">{error}</Alert>}

      <Button
        size="lg"
        onClick={handleGenerate}
        disabled={!text.trim() || isOverLimit || isLoading}
        className="w-full gap-2"
      >
        <Wand2 className="h-5 w-5" />
        {isLoading ? "生成中..." : "生成语音"}
      </Button>

      <AudioPlayer src={audioSrc} isLoading={isLoading} fileName="tts-output.mp3" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>
                生成历史
                {generations.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    （{generations.length}）· 共 {formatSize(totalSize)}
                  </span>
                )}
              </CardTitle>
              {totalSize > MEMORY_WARN_THRESHOLD && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  音频占用较高，建议清理不再需要的历史
                </p>
              )}
            </div>
            {generations.length > 0 && (
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
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {generations.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                尚无生成记录，点击上方「生成语音」开始
              </p>
            ) : (
              generations.map((g) => (
                <div
                  key={g.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => loadGeneration(g)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      loadGeneration(g);
                    }
                  }}
                  className={cn(
                    "group relative w-full cursor-pointer rounded-md border p-3 transition-colors",
                    activeId === g.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span className="shrink-0">{formatTime(g.createdAt)}</span>
                    <Mic2 className="h-3 w-3 shrink-0" />
                    <span className="shrink-0 truncate">{getVoiceName(g.voiceType)}</span>
                    <span className="shrink-0">· {formatSize(g.audioSize)}</span>
                  </div>
                  <p className="line-clamp-2 text-sm">{g.text || "（无文本）"}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteGeneration(g.id);
                    }}
                    disabled={isLoading}
                    aria-label="删除该条"
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
