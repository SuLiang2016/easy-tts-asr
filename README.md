# Hello TTS - 语音工坊

基于火山引擎语音大模型的个人语音工坊：**文字转语音（TTS）**、**语音转文字（ASR）**、**换声**（ASR→TTS 流水线），附带用户自配大模型的 **AI 润色**。纯 Web 端，无用户体系。

## 快速开始

```bash
# 1. 配置火山 API Key（服务端使用，不暴露给前端）
cp .env.example .env.local
# 编辑 .env.local 填入 VOLC_API_KEY 等

# 2. 开发
npm install
npm run dev

# 3. 测试 / 检查
npm test        # vitest 单元测试
npm run lint    # eslint
npm run typecheck

# 4. 打包可移植产物
npm run pack    # lint + next build + 合并产物到 dist/
```

## 部署（standalone 可移植包）

```bash
npm run pack
# 上传 dist/ 整个目录到服务器（服务器只需 Node >= 20.12）
cd dist && node start.js
```

- `dist/` 已合并 `.next/static`、`public/`、`node_modules/`（最小依赖）与 `.env.local`
- 环境变量优先级：系统 env > `dist/.env.local`（PM2/systemd 注入的 Key 覆盖包内默认）
- ⚠️ `dist/` 内含真实 API Key，勿提交、勿外传
- ⚠️ 启动器需要 **Node >= 20.12**（`process.loadEnvFile`），更低版本会丢失 `.env.local` 兜底（启动器会显式报错提示）

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `VOLC_API_KEY` | 火山 Agent Plan API Key（ark- 开头），必需 |
| `VOLC_TTS_HTTP_URL` | TTS 单向流式端点，默认官方 plan 端点 |
| `VOLC_TTS_RESOURCE_ID` | 默认 `seed-tts-2.0` |
| `VOLC_ASR_WS_URL` | ASR WebSocket 端点，默认官方 plan 端点 |
| `VOLC_ASR_RESOURCE_ID` | 默认 `volc.seedasr.sauc.duration` |

## 技术栈

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · lucide-react · vitest

## 架构速览

```
src/
├── app/
│   ├── actions.ts          # TTS/ASR/换声 Server Actions（输入校验 + 错误规范化）
│   ├── actions-llm.ts      # AI 润色 Server Action（baseUrl 校验 + 超时）
│   ├── api/asr/route.ts    # ASR 长音频上传（FormData，免 base64 膨胀与 bodySizeLimit）
│   ├── tts/ asr/ voice-conversion/ settings/   # 4 个功能页
├── components/
│   ├── voice-controls.tsx  # 音色选择 + 语速/音量/音调滑杆（页面共用）
│   ├── audio-recorder.tsx  # MediaRecorder 录音（MIME 探测、真实计时）
│   └── ui/                 # 自建组件库
├── hooks/
│   └── use-audio-history.ts # 历史列表 + blob URL 全生命周期管理
└── lib/
    ├── volc/               # 火山协议层（tts/asr 调用、二进制协议、参数映射、错误规范化）
    ├── audio/              # 浏览器音频（WAV 编码、AudioContext 单例、ASR 前置处理）
    ├── use-theme.ts / use-llm-config.ts # localStorage store（真实 hydration 语义）
    └── voices.ts           # 音色表（前后端共用白名单）
```

关键设计决策与术语见 `AGENTS.md` 与 `CONTEXT.md`。
