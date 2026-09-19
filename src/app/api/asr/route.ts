import { recognizeSpeech, UpstreamError } from "@/lib/volc";

/**
 * ASR 上传通道：Route Handler + FormData。
 * Server Action 通道有 bodySizeLimit 且 base64 会膨胀 1/3，
 * 5 分钟 / 20MB 长音频走这里直传二进制，服务端自行转 base64。
 */
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("audio");

    if (!(file instanceof File)) {
      return Response.json({ success: false, error: "缺少音频文件" }, { status: 400 });
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return Response.json({ success: false, error: "音频超过 20MB 上限" }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await recognizeSpeech({
      audioBase64: buffer.toString("base64"),
      format: "wav",
    });

    return Response.json({ success: true, text: result.text, duration: result.duration });
  } catch (err) {
    const message = err instanceof UpstreamError ? err.message : "服务暂时不可用，请稍后再试";
    return Response.json({ success: false, error: message }, { status: 502 });
  }
}
