"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Volume2, Sparkles, FileAudio, Mic, Clock, X, Trash2 } from "lucide-react";
import { speechToText } from "@/app/actions";
import { polishText } from "@/app/actions-llm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AudioRecorder } from "@/components/audio-recorder";
import { fileToBase64, convertToWav } from "@/lib/audio";
import { useLLMConfig } from "@/lib/use-llm-config";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE_MB = 20;
const MAX_DURATION_SECONDS = 300; // 5 分钟

type Recognition = {
  id: string;
  text: string;
  source: "record" | "upload";
  fileName?: string;
  createdAt: number;
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (d.toDateString() === now.toDateString()) return time;
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
};

export default function ASRPage() {
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [loadedText, setLoadedText] = useState(""); // 加载到 Textarea 时的快照，用于检测 dirty
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string>();
  const router = useRouter();
  const { config, hasConfig } = useLLMConfig();

  const dirty = text !== loadedText;

  const processAudio = async (file: File, source: "record" | "upload") => {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`文件过大，请限制在 ${MAX_FILE_SIZE_MB}MB 以内`);
      return;
    }

    setError(undefined);
    setIsLoading(true);
    setFileName(file.name);

    try {
      let audioFile = file;
      // 录音格式是 webm，转成 wav 以提升识别兼容性
      if (file.type.includes("webm")) {
        try {
          const wavBlob = await convertToWav(file);
          audioFile = new File([wavBlob], "recording.wav", { type: "audio/wav" });
        } catch {
          // 转换失败则尝试直接用原文件
        }
      }

      const base64 = await fileToBase64(audioFile);
      const format = audioFile.type.includes("mp3")
        ? "mp3"
        : audioFile.type.includes("ogg")
        ? "ogg"
        : "wav";

      const result = await speechToText({ audioBase64: base64, format });

      if (result.success && result.text !== undefined) {
        const rec: Recognition = {
          id: crypto.randomUUID(),
          text: result.text,
          source,
          fileName: source === "upload" ? file.name : undefined,
          createdAt: Date.now(),
        };
        // 新识别只入列表，不自动加载到 Textarea（按设计）
        setRecognitions((prev) => [rec, ...prev]);
      } else {
        setError(result.error || "识别失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "处理失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processAudio(file, "upload");
    // 允许重复上传同一文件
    e.target.value = "";
  };

  const loadItem = (rec: Recognition) => {
    if (rec.id === activeId) return;
    if (dirty && !window.confirm("当前文字未保存，切换将丢失，是否继续？")) return;
    setText(rec.text);
    setLoadedText(rec.text);
    setActiveId(rec.id);
  };

  const deleteItem = (id: string) => {
    setRecognitions((prev) => prev.filter((r) => r.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setText("");
      setLoadedText("");
    }
  };

  const clearAll = () => {
    if (recognitions.length === 0) return;
    if (dirty && !window.confirm("当前文字未保存，清空将丢失，是否继续？")) return;
    setRecognitions([]);
    setActiveId(null);
    setText("");
    setLoadedText("");
  };

  const handleCopy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
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

  const handleSendToTTS = () => {
    if (!text.trim()) return;
    const encoded = encodeURIComponent(text);
    router.push(`/tts?text=${encoded}`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">语音转文字</h1>
        <p className="text-muted-foreground">上传音频或录音，自动识别为文字。多次识别累积为历史，点击任意条目加载到工作区。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>上传或录音</CardTitle>
          <CardDescription>
            支持 mp3 / wav / ogg 格式，时长建议不超过 {MAX_DURATION_SECONDS / 60} 分钟
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
                onChange={handleFileUpload}
                className="hidden"
                disabled={isLoading}
              />
            </label>
            <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-card p-4">
              <AudioRecorder onAudioReady={(f) => processAudio(f, "record")} maxDurationSeconds={MAX_DURATION_SECONDS} />
            </div>
          </div>
          {fileName && (
            <p className="text-sm text-muted-foreground">已选择：{fileName}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>识别结果</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div className="grid gap-4 md:grid-cols-2">
              {/* 识别历史 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    识别历史{recognitions.length > 0 ? `（${recognitions.length}）` : ""}
                  </span>
                  {recognitions.length > 0 && (
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
                <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                  {recognitions.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">尚无识别记录</p>
                  ) : (
                    recognitions.map((r) => (
                      <div
                        key={r.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => loadItem(r)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            loadItem(r);
                          }
                        }}
                        className={cn(
                          "group relative w-full cursor-pointer rounded-md border p-3 transition-colors",
                          activeId === r.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        )}
                      >
                        <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span className="shrink-0">{formatTime(r.createdAt)}</span>
                          {r.source === "record" ? (
                            <Mic className="h-3 w-3 shrink-0" />
                          ) : (
                            <FileAudio className="h-3 w-3 shrink-0" />
                          )}
                          {r.fileName && (
                            <span className="truncate">{r.fileName}</span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-sm">{r.text || "（无识别内容）"}</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteItem(r.id);
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
              </div>

              {/* 工作区 */}
              <div className="space-y-3">
                <div className="relative">
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="点击左侧历史项加载，或在此自由输入..."
                    rows={8}
                    disabled={isLoading}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy} disabled={!text || isLoading} className="gap-1.5">
                    <Copy className="h-4 w-4" />
                    复制文字
                  </Button>
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
                  <Button variant="outline" size="sm" onClick={handleSendToTTS} disabled={!text.trim() || isLoading} className="gap-1.5">
                    <Volume2 className="h-4 w-4" />
                    送去 TTS
                  </Button>
                </div>
                {activeId && dirty && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">已修改未保存：切换或清空将丢失当前编辑</p>
                )}
              </div>
            </div>

            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/80 backdrop-blur-sm">
                <span className="text-sm text-muted-foreground">处理中...</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
  );
}
