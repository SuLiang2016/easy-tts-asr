import Link from "next/link";
import { Volume2, Mic, AudioWaveform, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    href: "/tts",
    icon: Volume2,
    title: "文字转语音",
    description: "输入文字，选择音色，一键生成自然流畅的语音。支持语速、音量、音调调节。",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    href: "/asr",
    icon: Mic,
    title: "语音转文字",
    description: "上传音频或录音，快速识别为文字。支持一键复制或继续生成语音。",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    href: "/voice-conversion",
    icon: AudioWaveform,
    title: "换声",
    description: "上传一段语音，换成另一种音色，轻松实现恶搞变声或风格化配音。",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-10">
      {/* 欢迎区域 */}
      <section className="space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Hello TTS
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          基于火山引擎语音大模型的个人语音工坊。支持文字转语音、语音转文字、换声功能，
          操作简单，效果自然。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link href="/tts">
            <Button size="lg" className="gap-2">
              开始使用 <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/settings">
            <Button size="lg" variant="outline">
              配置大模型
            </Button>
          </Link>
        </div>
      </section>

      {/* 功能卡片 */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link key={feature.href} href={feature.href} className="group">
              <Card className="h-full transition-all hover:border-primary/50 hover:shadow-sm">
                <CardHeader>
                  <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-lg ${feature.bg}`}>
                    <Icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="flex items-center gap-1 text-sm font-medium text-primary group-hover:underline">
                    进入功能 <ArrowRight className="h-4 w-4" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>

      {/* 使用说明 */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-xl font-semibold">快速上手指南</h2>
        <ol className="mt-4 list-inside list-decimal space-y-2 text-muted-foreground">
          <li>文字转语音：输入文本，选择喜欢的音色，点击生成即可播放或下载。</li>
          <li>语音转文字：上传音频或录音，稍等片刻即可获得识别文本。</li>
          <li>换声：上传音频，选择目标音色，系统会先识别文字再用新音色合成。</li>
          <li>如需使用 AI 润色功能，请先在设置页配置你的 OpenAI 兼容大模型。</li>
        </ol>
      </section>
    </div>
  );
}
