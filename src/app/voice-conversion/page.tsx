"use client";

import { useState, useTransition } from "react";
import { Upload, Wand2, FileAudio } from "lucide-react";
import { convertVoice } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Select, Label, Textarea } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { AudioPlayer } from "@/components/ui/audio-player";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AudioRecorder } from "@/components/audio-recorder";
import { fileToBase64, convertToWav, base64ToUint8Array } from "@/lib/audio";
import { VOICES, FEATURED_VOICES, FUN_VOICES } from "@/lib/voices";

const MAX_FILE_SIZE_MB = 20;
const MAX_DURATION_SECONDS = 30; // 换声限制 30 秒，适配短文本 TTS

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
  const [isPending, startTransition] = useTransition();

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSourceAudio(file);
  };

  const handleConvert = async () => {
    if (!sourceFile) return;
    setError(undefined);
    setIsLoading(true);

    startTransition(async () => {
      try {
        let audioFile = sourceFile;
        if (sourceFile.type.includes("webm")) {
          try {
            const wavBlob = await convertToWav(sourceFile);
            audioFile = new File([wavBlob], "recording.wav", { type: "audio/wav" });
          } catch {
            // ignore
          }
        }

        const base64 = await fileToBase64(audioFile);
        const format = audioFile.type.includes("mp3")
          ? "mp3"
          : audioFile.type.includes("ogg")
          ? "ogg"
          : "wav";

        const result = await convertVoice({
          audioBase64: base64,
          format,
          voiceType,
          speed,
          volume,
          pitch,
        });

        if (result.success && result.audioBase64) {
          setRecognizedText(result.text || "");
          const bytes = base64ToUint8Array(result.audioBase64);
          const blob = new Blob([bytes], { type: "audio/mp3" });
          setAudioSrc(URL.createObjectURL(blob));
        } else {
          setError(result.error || "换声失败");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "处理失败");
      } finally {
        setIsLoading(false);
      }
    });
  };

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
                onChange={handleFileUpload}
                className="hidden"
                disabled={isLoading || isPending}
              />
            </label>
            <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-card p-4">
              <AudioRecorder onAudioReady={processSourceAudio} maxDurationSeconds={MAX_DURATION_SECONDS} />
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
        disabled={!sourceFile || isLoading || isPending}
        className="w-full gap-2"
      >
        <Wand2 className="h-5 w-5" />
        {isLoading || isPending ? "处理中..." : "开始换声"}
      </Button>

      <AudioPlayer src={audioSrc} isLoading={isLoading || isPending} fileName="converted-voice.mp3" />
    </div>
  );
}
