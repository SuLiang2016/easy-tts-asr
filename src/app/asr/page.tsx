"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Volume2, Sparkles, FileAudio, Mic, Clock, X, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AudioRecorder } from "@/components/audio-recorder";
import { prepareAudioForASR } from "@/lib/audio";
import { useLLMConfig } from "@/lib/use-llm-config";
import { applyPolish } from "@/lib/polish";
import { copyToClipboard } from "@/lib/clipboard";
import { formatTime } from "@/lib/format";
import { randomId } from "@/lib/random";
import { useAudioHistory } from "@/hooks/use-audio-history";
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

export default function ASRPage() {
  const { items: recognitions, add, remove: deleteRecognitionById, clear: clearHistory } = useAudioHistory<Recognition>();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [loadedText, setLoadedText] = useState(""); // 加载到 Textarea 时的快照，用于检测 dirty
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string>();
  const [copied, setCopied] = useState(false);
  const busyRef = useRef(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const { config, hasConfig } = useLLMConfig();

  const dirty = text !== loadedText;

  const processAudio = async (file: File, source: "record" | "upload") => {
    // 并发守卫：处理中忽略新提交，避免 fileName/loading/错误状态互相覆盖
    if (busyRef.current) {
      setError("正在处理中，请等待当前任务完成");
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`文件过大，请限制在 ${MAX_FILE_SIZE_MB}MB 以内`);
      return;
    }

    busyRef.current = true;
    setError(undefined);
    setIsLoading(true);
    setFileName(file.name);

    try {
      // 统一前置处理：任何格式 -> 16kHz 单声道 WAV + 300ms 尾部静音
      const prepared = await prepareAudioForASR(file);

      // 5 分钟长音频走 Route Handler + FormData：免 base64 膨胀与 bodySizeLimit
      const form = new FormData();
      form.append("audio", prepared.blob, "audio.wav");
      const response = await fetch("/api/asr", { method: "POST", body: form });
      const result = (await response.json()) as { success: boolean; text?: string; error?: string };

      if (result.success && result.text !== undefined) {
        add({
          id: randomId(),
          text: result.text,
          source,
          fileName: source === "upload" ? file.name : undefined,
          createdAt: Date.now(),
        });
      } else {
        setError(result.error || "识别失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "处理失败");
    } finally {
      busyRef.current = false;
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
    deleteRecognitionById(id);
    if (activeId === id) {
      setActiveId(null);
      setText("");
      setLoadedText("");
    }
  };

  const clearAll = () => {
    if (recognitions.length === 0) return;
    if (dirty && !window.confirm("当前文字未保存，清空将丢失，是否继续？")) return;
    clearHistory();
    setActiveId(null);
    setText("");
    setLoadedText("");
  };

  const handleCopy = async () => {
    if (!text) return;
    const ok = await copyToClipboard(text);
    setCopied(ok);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handlePolish = async () => {
    if (!text.trim() || !hasConfig) return;
    setError(undefined);
    setIsLoading(true);

    try {
      const outcome = await applyPolish(text, config);
      if (outcome.ok && outcome.text) {
        setText(outcome.text);
        setLoadedText(outcome.text); // 润色结果视为已锚定，避免误报 dirty
      } else {
        setError(outcome.error || "润色失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "润色失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendToTTS = () => {
    if (!text.trim()) return;
    router.push(`/tts?text=${encodeURIComponent(text)}`);
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
            支持 mp3 / wav / ogg 等常见格式，时长建议不超过 {MAX_DURATION_SECONDS / 60} 分钟
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
              <AudioRecorder
                onAudioReady={(f) => processAudio(f, "record")}
                onError={setError}
                maxDurationSeconds={MAX_DURATION_SECONDS}
                disabled={isLoading}
              />
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    disabled={!text || isLoading}
                    className="gap-1.5"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "已复制" : "复制文字"}
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
