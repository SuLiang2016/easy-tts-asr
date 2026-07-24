"use client";

import { Save, Key, Link2, Bot, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { useLLMConfig } from "@/lib/use-llm-config";
import { useState } from "react";

export default function SettingsPage() {
  const { config, saveConfig, hasConfig } = useLLMConfig();
  const [form, setForm] = useState(config);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveConfig(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
              温度（Temperature）
            </Label>
            <Input
              id="temperature"
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={form.temperature}
              onChange={(e) =>
                setForm({ ...form, temperature: parseFloat(e.target.value) || 0 })
              }
            />
          </div>

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
