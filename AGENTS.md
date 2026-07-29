<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-info -->
# Hello TTS - 项目信息

## 项目概述
基于火山引擎语音大模型的个人语音工坊。支持文字转语音（TTS）、语音转文字（ASR）、换声（ASR+TTS 流水线）三大功能，提供 AI 润色能力。纯 Web 端，无用户体系，无需登录。

## 技术栈
- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS v4 (CSS 变量 + `@variant dark` 实现深色模式)
- **图标**: lucide-react
- **UI 方案**: 自建组件库（button/card/input/slider/alert/audio-player），位于 `src/components/ui/`

## 项目结构
```
build.js              # 打包脚本：合并 standalone+static+public+.env.local 到 dist/
src/
├── app/              # 页面（5个）+ Server Actions
│   ├── page.tsx           # 首页（欢迎语 + 功能卡片）
│   ├── layout.tsx         # 根布局（导航栏 + 深色模式脚本）
│   ├── globals.css        # 全局样式（CSS 变量定义主题）
│   ├── actions.ts         # TTS/ASR/换声 Server Actions
│   ├── actions-llm.ts     # AI 润色 Server Action
│   ├── tts/page.tsx       # 文字转语音（含生成历史）
│   ├── asr/page.tsx       # 语音转文字（含识别历史）
│   ├── voice-conversion/  # 换声
│   └── settings/          # 大模型配置
├── components/
│   ├── navbar.tsx         # 导航栏（含主题切换）
│   ├── audio-recorder.tsx # 浏览器录音（MediaRecorder API）
│   └── ui/                # 通用 UI 组件
└── lib/
    ├── volc.ts            # 火山 TTS/ASR SDK（服务端）
    ├── audio.ts           # 浏览器端音频工具（base64/WAV转换）
    ├── voices.ts          # 15 个音色配置
    ├── use-theme.ts       # 深色模式 Hook
    ├── use-llm-config.ts  # 大模型配置 Hook（localStorage）
    └── utils.ts           # cn() 工具函数
```

## 核心功能约束
- **TTS**: HTTP 单向流式接口，上限 1000 字符
- **ASR**: WebSocket 单流接口（bigmodel_nostream），Agent Plan 端点，音频上限 5 分钟 / 20MB
- **换声**: 服务端串行 ASR->TTS，音频上限 60 秒
- **录音**: MediaRecorder API，WebM 格式，自动转 WAV 发送
- **AI 润色**: OpenAI 兼容接口，用户自配 Key/URL/模型/温度，存 localStorage
- **深色模式**: CSS 变量 + class 切换，默认跟随系统偏好
- **火山 Key**: 写死在服务端 `.env.local`，不暴露给前端

## 音色方案（15个）
- 10 个精品音色（男女声各风格）
- 5 个恶搞/特色音色（卡通、萝莉、机器人、方言、小怪兽）

## 主要技术决策
1. Server Actions 处理所有火山 API 调用（Key 在服务端不暴露）
2. `bodySizeLimit: "20mb"` 放 `experimental.serverActions` 下
3. 音频 base64 传输，避免服务器存储开销
4. no `useTransition` + `startTransition` = 直接 async/await 调用 Server Action（避免 HMR 中断请求）
5. 无用户体系，配置存在浏览器 localStorage
6. TTS/ASR 历史仅存组件内存（刷新即失）；TTS 音频用 `URL.createObjectURL` 生成 blob URL，删除/清空时须 `URL.revokeObjectURL` 释放
7. 打包部署用 `output: "standalone"`；`build.js` 合并产物到 `dist/` 并生成 `start.js`，详见下方「打包与部署」

## 打包与部署
- **打包**: `npm run pack` = lint + `next build` + `node build.js`（跨平台 Node 脚本，Windows 打包/Linux 服务器跑都行）
- **启动**: `npm start` -> `node dist/start.js`（`start.js` 用 `process.loadEnvFile` 加载 `dist/.env.local`，找不到则回退系统环境变量）
- **dist/ 结构**: `server.js` + `.next/`(server+static) + `public/` + `node_modules/`(standalone 追踪的最小依赖) + `.env.local` + `start.js`
- **可移植**: `dist/` 整体打包上传服务器，`cd dist && node start.js` 即可（服务器只需 Node，无需 `npm install`、无需源码）
- **环境变量优先级**: 系统 env > `dist/.env.local`（PM2/systemd 注入的 Key 覆盖包内默认；包内 `.env.local` 作兜底）
- **standalone 坑**: `.next/standalone` 不含 `.next/static` 和 `public/`，须手动合并（`build.js` 已处理）
- **ws 依赖**: 运行时走 Next 内置 `next/dist/compiled/ws` 别名，`package.json` 里的 `ws` 实际冗余但无害
- **dist/ 已 gitignore**（含真实 VOLC_API_KEY，勿提交、勿分享）

## 重要说明
- `Buffer` 在浏览器端不可用，使用 `base64ToArrayBuffer()` 替代
- Next.js 16 中 `serverActions` 配置在 `experimental` 字段下
- `SliderHTMLAttributes` 不包含 min/max/step，改用 `InputHTMLAttributes`
- 项目使用 Tailwind CSS v4（`@import "tailwindcss"` 语法，通过 `@variant dark` 实现深色模式）
- 终端为 PowerShell 5，**不支持 bash heredoc 语法**（`<<'EOF'`），多行 git commit 消息请使用多个 `-m` 参数拼接
<!-- END:project-info -->
