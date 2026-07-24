# 火山 HTTP 语音调整清单

## 目标

- TTS 使用 HTTP 一次性合成，不使用 WebSocket。
- ASR 使用 HTTP 一次性识别，不使用 WebSocket。
- 换声链路保持一次性 ASR HTTP 到一次性 TTS HTTP。

## TTS

- Endpoint 改为 `https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional`。
- Header 使用 `X-Api-Key`、`X-Api-Resource-Id: seed-tts-2.0`、`X-Api-Request-Id`、`Content-Type`、`Connection`、`X-Control-Require-Usage-Tokens-Return`。
- Body 改为 `req_params.text`、`req_params.speaker`、`req_params.audio_params.format`、`req_params.audio_params.sample_rate`。
- 响应解析改为逐行/分块 JSON，累加 `code === 0` 的 `data`，遇到 `code === 20000000` 结束。
- 删除旧版 `app/user/audio/request` 结构和旧版 app/token/cluster 鉴权分支。
- 音色列表保守替换为文档已出现的真实 speaker。

## ASR

- Endpoint 保持 HTTP 极速识别：`https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash`。
- Header 使用 `X-Api-Key`、`X-Api-Resource-Id: volc.bigasr.auc_turbo`、`X-Api-Request-Id`、`X-Api-Sequence: -1`、`Content-Type`。
- Body 保持 `user.uid`、`audio.data`、`audio.format`、`request.model_name`、`request.language`、`request.enable_punc`、`request.enable_itn`。
- 删除旧版 AppKey/AccessKey 分支。
- 不引入 WebSocket，不使用 `volc.seedasr.sauc.duration`。

## 验证与提交

- 每个阶段运行 `pnpm lint`。
- 涉及代码与类型的阶段运行 `pnpm build`。
- 每个阶段验证通过后单独 git commit。
- 提交前执行 `git diff --check` 并确认不提交真实密钥。
