"use client";

import { Save, Key, Link2, Bot, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { useLLMConfig } from "@/lib/use-llm-config";
import { useEffect, useRef, useState } from "react";

/** 表单态：温度保持字符串，允许输入中间态（如 "0."），保存时再解析钳制 */
interface SettingsFormState {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: string;
}

const clampTemperature = (value: number) => Math.min(2, Math.max(0, value));

function toFormState(config: { apiKey: string; baseUrl: string; model: string; temperature: number }): SettingsFormState {
  return {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    temperature: String(config.temperature),
  };
}

export default function SettingsPage() {
  const { config, saveConfig, hasConfig, hydrated } = useLLMConfig();
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [form, setForm] = useState<SettingsFormState>(() => toFormState(config));
  const [syncedFromStorage, setSyncedFromStorage] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // hydration 后从 localStorage 同步一次真实配置；之后的编辑只属于本页，
  // 不会被跨标签页保存静默重置（渲染期条件同步是 React 官方推荐的 props->state 调整模式）
  if (hydrated && !syncedFromStorage) {
    setSyncedFromStorage(true);
    setForm(toFormState(config));
  }

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  const handleSave = () => {
    const parsedTemperature = parseFloat(form.temperature);
    if (Number.isNaN(parsedTemperature)) {
      setFormError("温度必须是 0 ~ 2 之间的数字");
      return;
    }

    setFormError(undefined);
    saveConfig({
      apiKey: form.apiKey,
      baseUrl: form.baseUrl,
      model: form.model,
      temperature: clampTemperature(parsedTemperature),
    });

    setSaved(true);
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
    }
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-muted-foreground">配置 AI 润色所需的大模型参数</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>大模型配置（OpenAI 兼容）</CardTitle>
          <CardDescription>
            配置你自己的大模型 API，用于 ASR 和 TTS 页面的 AI 润色功能。
            所有信息仅保存在浏览器本地，不会上传到服务器。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Key
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="sk-..."
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseUrl" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Base URL
            </Label>
            <Input
              id="baseUrl"
              type="url"
              placeholder="https://api.openai.com/v1"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">支持任意 OpenAI 兼容服务（含本地 http://localhost 服务）</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              模型名称
            </Label>
            <Input
              id="model"
              placeholder="gpt-3.5-turbo"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="temperature" className="flex items-center gap-2">
              <Thermometer className="h-4 w-4" />
              温度（Temperature，0 ~ 2）
            </Label>
            <Input
              id="temperature"
              type="text"
              inputMode="decimal"
              placeholder="0.7"
              value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: e.target.value })}
            />
          </div>

          {formError && <Alert variant="destructive">{formError}</Alert>}
          {saved && <Alert>配置已保存</Alert>}

          <Button onClick={handleSave} className="w-full gap-2">
            <Save className="h-4 w-4" />
            保存配置
          </Button>

          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            当前状态：{hasConfig ? "已配置，AI 润色功能可用" : "未配置，AI 润色功能已禁用"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
