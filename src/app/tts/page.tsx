"use client";

import { useState } from "react";
import { Wand2, Sparkles } from "lucide-react";
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

const MAX_TEXT_LENGTH = 250; // 约 1024 字节的 80%

export default function TTSPage() {
  const [text, setText] = useState("");
  const [voiceType, setVoiceType] = useState(VOICES[0].id);
  const [speed, setSpeed] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [audioSrc, setAudioSrc] = useState<string>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const { config, hasConfig } = useLLMConfig();

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setError(undefined);
    setAudioSrc(undefined);
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
        setAudioSrc(URL.createObjectURL(blob));
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

  const currentLength = new Blob([text]).size;
  const isOverLimit = currentLength > MAX_TEXT_LENGTH;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">文字转语音</h1>
        <p className="text-muted-foreground">输入文字，选择音色，一键生成语音</p>
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

          <div className="flex flex-wrap gap-2">
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
              <span className="self-center text-xs text-muted-foreground">
                （未配置大模型，润色功能已禁用）
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
    </div>
  );
}
