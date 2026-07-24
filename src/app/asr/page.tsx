"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Volume2, Sparkles, FileAudio } from "lucide-react";
import { speechToText } from "@/app/actions";
import { polishText } from "@/app/actions-llm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AudioRecorder } from "@/components/audio-recorder";
import { fileToBase64, convertToWav } from "@/lib/audio";
import { useLLMConfig } from "@/lib/use-llm-config";

const MAX_FILE_SIZE_MB = 20;
const MAX_DURATION_SECONDS = 300; // 5 分钟

export default function ASRPage() {
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string>();
  const router = useRouter();
  const { config, hasConfig } = useLLMConfig();

  const processAudio = async (file: File) => {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`文件过大，请限制在 ${MAX_FILE_SIZE_MB}MB 以内`);
      return;
    }

    setError(undefined);
    setText("");
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
        setText(result.text);
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
    await processAudio(file);
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
    if (!text) return;
    const encoded = encodeURIComponent(text);
    router.push(`/tts?text=${encoded}`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">语音转文字</h1>
        <p className="text-muted-foreground">上传音频或录音，自动识别为文字</p>
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
              <AudioRecorder onAudioReady={processAudio} maxDurationSeconds={MAX_DURATION_SECONDS} />
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
        <CardContent className="space-y-4">
          <div className="relative">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="识别结果将显示在这里..."
              rows={8}
              disabled={isLoading}
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/80">
                <span className="text-sm text-muted-foreground">识别中...</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={!text} className="gap-1.5">
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
            <Button variant="outline" size="sm" onClick={handleSendToTTS} disabled={!text.trim()} className="gap-1.5">
              <Volume2 className="h-4 w-4" />
              送去 TTS
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
  );
}
