# HTTP 一次性 TTS / ASR 调整计划

## Summary

目标是把项目语音链路调整为：

1. TTS 使用 HTTP 一次性合成，不使用 WebSocket。
2. ASR 使用 HTTP 一次性识别，不使用 WebSocket。
3. 将前一轮整理出的清单落到可执行任务中。
4. 代码调整按阶段执行；每完成一次阶段调整，都运行验证并创建一次 git commit。

用户已确认：

- TTS 音色列表采用保守替换：只保留/替换为文档已出现的真实 speaker，优先确保首轮可用。
- Git 提交采用分阶段提交：每个阶段验证通过后分别 commit。

## Current State Analysis

### 本地文档依据

- `tts-asr-rd.md` 中 TTS HTTP 接口地址为：`https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional`。
- 文档 TTS HTTP 示例使用 Header：`X-Api-Key`、`X-Api-Resource-Id: seed-tts-2.0`、`Content-Type`、`Connection: keep-alive`、`X-Control-Require-Usage-Tokens-Return: *`。
- 文档 TTS HTTP 示例使用请求体：`req_params.text`、`req_params.speaker`、`req_params.audio_params.format`、`req_params.audio_params.sample_rate`。
- 文档 TTS HTTP 示例响应是按行/分块返回 JSON，需要累加 `code === 0` 的 `data`，遇到 `code === 20000000` 结束。
- 文档截图中的 ASR Agent Plan 示例主要是 WebSocket；但用户明确要求 ASR 一次性 HTTP，不走 WS。

### 当前代码状态

- `src/lib/volc.ts` 当前 TTS 请求仍使用旧接口 `https://openspeech.bytedance.com/api/v1/tts`。
- `src/lib/volc.ts` 当前 TTS 请求体是旧版 `app/user/audio/request` 结构，不匹配 HTTP Agent Plan 的 `req_params`。
- `src/lib/volc.ts` 当前 TTS 仍混有旧版 `VOLC_TTS_APP_ID`、`VOLC_TTS_ACCESS_TOKEN`、`VOLC_TTS_CLUSTER`。
- `src/lib/volc.ts` 当前 TTS 返回类型包含 `audioUrl`，但 Server Action 只需要 `audioBase64`，服务端创建 Blob URL 对客户端无意义。
- `src/lib/volc.ts` 当前 ASR endpoint 是 `https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash`，符合一次请求直接返回的方向，可以保留。
- `src/lib/volc.ts` 当前 ASR Header 仍混有旧版 AppKey/AccessKey 分支，需要统一为 API Key 模式。
- `.env.example` 当前 TTS Resource ID 是旧值 `volc.service_type.10029`，需要改为 `seed-tts-2.0`。
- `.env.example` 当前仍暴露旧版 TTS app/token/cluster 示例，需清理，避免误配。
- `src/lib/voices.ts` 当前音色 ID 是占位/旧式示例，用户确认采用保守替换，应至少保留文档中已出现的 `zh_female_vv_uranus_bigtts`。
- `package.json` 可用验证命令为 `pnpm lint` 与 `pnpm build`。

## Proposed Changes

### 阶段 1：配置模板与清单落盘

文件：

- `.env.example`
- 新增或更新项目内清单文档，建议路径：`docs/volc-http-adjustment-checklist.md`

调整内容：

1. `.env.example`：
   - 保留 `VOLC_API_KEY=your_agent_plan_api_key_here`。
   - 设置 `VOLC_TTS_RESOURCE_ID=seed-tts-2.0`。
   - 保留 `VOLC_ASR_RESOURCE_ID=volc.bigasr.auc_turbo`，因为 ASR 走 HTTP 极速识别，不走 WS Agent Plan ASR。
   - 新增可配置 endpoint：
     - `VOLC_TTS_HTTP_URL=https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional`
     - `VOLC_ASR_HTTP_URL=https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash`
   - 移除旧版 TTS `VOLC_TTS_APP_ID`、`VOLC_TTS_ACCESS_TOKEN`、`VOLC_TTS_CLUSTER` 示例。
2. 清单文档：
   - 记录本次要调整的 TTS Endpoint、Header、Body、响应解析、音色、ASR Header、错误日志、类型清理、换声链路验证。

验证：

- 运行 `pnpm lint`。
- 若 lint 通过，执行 commit：`chore: document volc http speech configuration`。

### 阶段 2：TTS HTTP 一次性合成改造

文件：

- `src/lib/volc.ts`
- `src/lib/voices.ts`

调整内容：

1. `src/lib/volc.ts`：
   - 删除旧版 TTS app/token/cluster 鉴权分支。
   - 要求 `VOLC_API_KEY` 必填；缺失时抛出明确错误。
   - TTS endpoint 改为 `VOLC_TTS_HTTP_URL`，默认 `https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional`。
   - TTS Resource ID 默认 `seed-tts-2.0`。
   - TTS Header 使用：
     - `Content-Type: application/json`
     - `Connection: keep-alive`
     - `X-Api-Key`
     - `X-Api-Resource-Id`
     - `X-Api-Request-Id`
     - `X-Control-Require-Usage-Tokens-Return: *`
   - TTS Body 改为：
     - `req_params.text`
     - `req_params.speaker`
     - `req_params.audio_params.format`
     - `req_params.audio_params.sample_rate`
   - `voiceType` 作为 `speaker` 传入。
   - 响应解析改为兼容 chunked/逐行 JSON：
     - 使用 `response.body.getReader()` 读取文本分块。
     - 按换行拆 JSON。
     - 累加 `code === 0` 且存在 `data` 的 base64 音频片段。
     - 遇到 `code === 20000000` 结束。
     - 如果出现 `code > 0` 且不是结束码，抛出包含 `X-Tt-Logid` 的错误。
     - 兼容非 chunked 单 JSON 响应，防止服务端直接返回单个 JSON 对象。
   - 删除 `TTSResult.audioUrl` 和服务端 Blob URL 构造。
2. `src/lib/voices.ts`：
   - 保守替换音色列表。
   - 至少保留文档示例 speaker：`zh_female_vv_uranus_bigtts`。
   - 保留分类结构，但不再保留未知 speaker，避免接口报 speaker 无效。

验证：

- 运行 `pnpm lint`。
- 运行 `pnpm build`。
- 若通过，执行 commit：`feat: switch tts to volc http synthesis`。

### 阶段 3：ASR HTTP 一次性识别校准

文件：

- `src/lib/volc.ts`

调整内容：

1. 保留当前一次性 HTTP ASR endpoint：默认 `https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash`。
2. 支持 `VOLC_ASR_HTTP_URL` 覆盖 endpoint。
3. ASR Resource ID 默认 `volc.bigasr.auc_turbo`。
4. 删除旧版 AppKey/AccessKey 分支，统一使用 `VOLC_API_KEY`。
5. Header 使用：
   - `Content-Type: application/json`
   - `X-Api-Key`
   - `X-Api-Resource-Id`
   - `X-Api-Request-Id`
   - `X-Api-Sequence: -1`
6. 请求体保持 HTTP flash 结构：
   - `user.uid`
   - `audio.data`
   - `audio.format`
   - `request.model_name: bigmodel`
   - `request.language`
   - `request.enable_punc`
   - `request.enable_itn`
7. 错误处理增强：
   - 非 2xx 响应包含状态码、响应 message/json 和 `X-Tt-Logid`。
   - JSON 解析失败时返回可诊断错误。
8. 不引入 WebSocket，不使用 `volc.seedasr.sauc.duration`。

验证：

- 运行 `pnpm lint`。
- 运行 `pnpm build`。
- 若通过，执行 commit：`fix: align asr with volc http flash recognition`。

### 阶段 4：换声链路与前端兼容验证

文件：

- `src/app/actions.ts`
- `src/app/tts/page.tsx`
- `src/app/asr/page.tsx`
- `src/app/voice-conversion/page.tsx`

调整内容：

1. 检查 `actions.ts` 是否还依赖被删除的 `audioUrl` 类型；若无依赖则不改。
2. 检查 TTS 页是否能处理保守替换后的音色列表。
3. 检查 ASR 页仍按 base64 传音频，继续使用一次性 HTTP ASR。
4. 检查换声页仍是一次性 HTTP ASR  一次性 HTTP TTS，无需额外改动。
5. 如类型或 lint 暴露兼容问题，做最小修复。

验证：

- 运行 `pnpm lint`。
- 运行 `pnpm build`。
- 若通过，执行 commit：`test: verify http speech flows`。

## Assumptions & Decisions

1. 不改 `.env.local` 中真实密钥，避免触碰敏感配置；只更新 `.env.example` 和代码默认值。
2. ASR 明确不走 WebSocket，因此不使用 `wss://openspeech.bytedance.com/api/v3/plan/sauc/*`。
3. ASR HTTP 一次性识别沿用当前 `api/v3/auc/bigmodel/recognize/flash`，并通过配置项允许覆盖。
4. TTS 改为 Agent Plan HTTP `api/v3/plan/tts/unidirectional`。
5. 音色保守替换，只使用文档中已出现的 `zh_female_vv_uranus_bigtts`，不保留未知 speaker。
6. 每个阶段完成后必须验证，验证通过后再 git commit。
7. 不新增依赖；使用 Node/Next 内置 `fetch`、Web Streams、TypeScript 实现。
8. 不添加代码注释，遵循当前开发约束。

## Verification Steps

每个阶段执行：

1. `pnpm lint`
2. 对涉及构建/类型的阶段执行 `pnpm build`
3. `git diff --check`
4. 查看 `git diff`，确认没有密钥泄露或无关改动。
5. 通过后 `git add` 对应文件并 `git commit -m "..."`。

最终完成后额外确认：

1. `git status --short` 显示工作区干净。
2. TTS 代码不再请求 `api/v1/tts`。
3. TTS 代码使用 `req_params`。
4. ASR 代码不包含 WebSocket endpoint。
5. 换声仍调用同一组一次性 HTTP 方法。
