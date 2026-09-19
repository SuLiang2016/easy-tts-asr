<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-info -->
# Hello TTS - 项目信息

## 项目概述
基于火山引擎语音大模型的个人语音工坊。支持文字转语音（TTS）、语音转文字（ASR）、换声（ASR+TTS 流水线）三大功能，提供 AI 润色能力。纯 Web 端，无用户体系，无需登录。业务术语表见 `CONTEXT.md`。

## 技术栈
- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript（strict + noUnusedLocals/Parameters）
- **样式**: Tailwind CSS v4 (CSS 变量 + `@variant dark` 实现深色模式)
- **图标**: lucide-react
- **测试**: vitest（纯函数单测：协议编解码、WAV 编解码、参数映射）
- **UI 方案**: 自建组件库（button/card/input/slider/alert/audio-player），位于 `src/components/ui/`

## 项目结构
```
build.js              # 打包脚本：合并 standalone+static+public+.env.local 到 dist/
src/
├── app/              # 页面（5个）+ Server Actions + Route Handler
│   ├── page.tsx           # 首页（欢迎语 + 功能卡片）
│   ├── layout.tsx         # 根布局（导航栏 + 深色模式内联脚本）
│   ├── globals.css        # 全局样式（CSS 变量定义主题 + color-scheme）
│   ├── actions.ts         # TTS/ASR/换声 Server Actions（输入校验 + 错误规范化）
│   ├── actions-llm.ts     # AI 润色 Server Action（baseUrl 校验 + 超时）
│   ├── api/asr/route.ts   # ASR 长音频上传端点（FormData 二进制）
│   ├── tts/page.tsx       # 文字转语音（服务端读 searchParams prop 下发）
│   ├── tts/workspace.tsx  # TTS 工作区（客户端，含生成历史）
│   ├── asr/page.tsx       # 语音转文字（含识别历史；上传走 /api/asr）
│   ├── voice-conversion/  # 换声（含换声历史）
│   └── settings/          # 大模型配置
├── components/
│   ├── navbar.tsx         # 导航栏（含主题切换）
│   ├── voice-controls.tsx # 音色选择 + 三滑杆（TTS/换声页共用）
│   ├── audio-recorder.tsx # 浏览器录音（MediaRecorder，MIME 探测）
│   └── ui/                # 通用 UI 组件
├── hooks/
│   └── use-audio-history.ts # 历史列表 + blob URL 全生命周期（删除/清空/卸载 revoke）
└── lib/
    ├── volc/              # 火山协议层（服务端）
    │   ├── tts.ts / asr.ts      # TTS HTTP / ASR WebSocket 调用（超时、背压）
    │   ├── asr-protocol.ts      # WS 二进制帧编解码（纯函数，可测）
    │   ├── wav-info.ts          # WAV 解析 / 补静音（纯函数，可测）
    │   ├── tts-params.ts        # 倍率 -> speech_rate/loudness_rate/pitch 映射（纯函数，可测）
    │   ├── config.ts / errors.ts # 服务端配置 / UpstreamError 错误规范化
    │   └── index.ts             # 统一出口（@/lib/volc）
    ├── audio/             # 浏览器音频
    │   ├── wav-encode.ts        # 16bit WAV 编码（纯函数，可测）
    │   └── index.ts             # AudioContext 单例、prepareAudioForASR（统一前置处理）
    ├── use-local-store.ts # localStorage 读取 + useHydrated（真实 hydration 信号）
    ├── use-theme.ts       # 深色模式 Hook
    ├── use-llm-config.ts  # 大模型配置 Hook（localStorage）
    ├── format.ts / random.ts / clipboard.ts / polish.ts # 小工具
    ├── voices.ts          # 15 个音色配置（前后端共用白名单）
    └── utils.ts           # cn() 工具函数
tests/                    # vitest 单测
```

## 核心功能约束
- **TTS**: HTTP 单向流式接口，上限 1000 字符；语速/音量/音调滑杆（0.5–2.0 倍率）映射到 `speech_rate`/`loudness_rate`/`pitch`，等于 1.0 的字段不下发
- **ASR**: WebSocket 单流接口（bigmodel_nostream），Agent Plan 端点，音频上限 5 分钟 / 20MB；5 分钟长音频经 `/api/asr` Route Handler + FormData 上传
- **换声**: 服务端串行 ASR->TTS，音频上限 60 秒（服务端按 WAV PCM 时长兜底校验 65 秒）
- **录音**: MediaRecorder API，MIME 按 `isTypeSupported` 探测（webm/mp4/ogg），自动转 16kHz 单声道 WAV + 补 300ms 尾部静音后发送
- **AI 润色**: OpenAI 兼容接口，用户自配 Key/URL/模型/温度，存 localStorage；baseUrl 限 http/https
- **深色模式**: CSS 变量 + class 切换，默认跟随系统偏好
- **火山 Key**: 写死在服务端 `.env.local`，不暴露给前端

## 音色方案（15个）
- 10 个精品音色（男女声各风格）
- 5 个恶搞/特色音色（卡通、萝莉、机器人、方言、小怪兽）

## 主要技术决策
1. 火山 API 调用只在服务端（Server Actions + Route Handler），Key 不暴露；服务端做输入校验（文本长度、音频大小、音色白名单）
2. `bodySizeLimit: "20mb"` 放 `experimental.serverActions` 下；ASR 长音频不走此通道（见决策 3）
3. ASR 上传走 `/api/asr` Route Handler + FormData 直传二进制：绕开 bodySizeLimit 且免 base64 膨胀（旧方案 20MB 文件 base64 后 26.7MB 必炸）；TTS/换声音频量小，仍走 Server Action base64
4. no `useTransition` + `startTransition` = 直接 async/await 调用 Server Action（避免 HMR 中断请求）
5. 无用户体系，配置存在浏览器 localStorage；`useHydrated()` 提供真实 hydration 信号（不要用恒真的 mounted 假信号）
6. TTS/ASR/换声历史仅存组件内存（刷新即失），统一用 `useAudioHistory` 管理 blob URL 生命周期（删除/清空/组件卸载都 revoke），禁止绕过 hook 直接 `createObjectURL`
7. 上游调用一律有超时：TTS/LLM fetch 60s（AbortSignal.timeout），ASR WS 连接 10s / 结果等待 120s；ASR 分片连续快发 + bufferedAmount 背压（旧实现每片等 100ms，5 分钟音频发送就要 150 秒）
8. 打包部署用 `output: "standalone"`；`build.js` 合并产物到 `dist/` 并生成 `start.js`，详见下方「打包与部署」

## 打包与部署
- **打包**: `npm run pack` = lint + `next build` + `node build.js`（跨平台 Node 脚本，Windows 打包/Linux 服务器跑都行）
- **启动**: `npm start` -> `node dist/start.js`（`start.js` 用 `process.loadEnvFile` 加载 `dist/.env.local`，找不到则回退系统环境变量）
- **Node 版本**: 服务器需 **>= 20.12**（`process.loadEnvFile` 要求）；更低版本时启动器会显式报错而不是静默丢配置
- **dist/ 结构**: `server.js` + `.next/`(server+static) + `public/` + `node_modules/`(standalone 追踪的最小依赖) + `.env.local` + `start.js`
- **可移植**: `dist/` 整体打包上传服务器，`cd dist && node start.js` 即可（服务器只需 Node，无需 `npm install`、无需源码）
- **环境变量优先级**: 系统 env > `dist/.env.local`（PM2/systemd 注入的 Key 覆盖包内默认；包内 `.env.local` 作兜底）
- **standalone 坑**: `.next/standalone` 不含 `.next/static` 和 `public/`，须手动合并（`build.js` 已处理，且对两者做存在性预检）
- **ws 依赖**: `src/lib/volc/asr.ts` 直接 `import WebSocket from "ws"`（服务端 ASR 运行时依赖），**不可删除**；Next 内置的 `next/dist/compiled/ws` 只供 Next 内部使用，不会别名用户代码的 ws 导入
- **dist/ 已 gitignore**（含真实 VOLC_API_KEY，勿提交、勿分享）

## 重要说明
- `Buffer` 在浏览器端不可用，使用 `base64ToArrayBuffer()` 替代
- Next.js 16 中 `serverActions` 配置在 `experimental` 字段下
- `SliderHTMLAttributes` 不包含 min/max/step，改用 `InputHTMLAttributes`
- `crypto.randomUUID` / `navigator.clipboard` 仅在安全上下文（https/localhost）可用，本项目的 http 局域网部署场景必须走 `lib/random.ts` / `lib/clipboard.ts` 的兜底实现
- 跨页传参（ASR→TTS）用服务端 page 的 `searchParams`（Promise，需 await）下发 prop，**不要在客户端用 `useSearchParams`**——本版本 dev 模式下其 Suspense 回退会永不解析（fallback 卡死）
- 项目使用 Tailwind CSS v4（`@import "tailwindcss"` 语法，通过 `@variant dark` 实现深色模式）
- 终端为 PowerShell 5，**不支持 bash heredoc 语法**（`<<'EOF'`），多行 git commit 消息请使用多个 `-m` 参数拼接
<!-- END:project-info -->
