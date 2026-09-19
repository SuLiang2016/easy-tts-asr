import TTSWorkspace from "./workspace";

/**
 * ASR 页「送去 TTS」通过 ?text= 传参。
 * 在服务端页面读取 searchParams prop 直接下发给客户端工作区，
 * 不在客户端使用 useSearchParams（本版本 dev 模式下其 Suspense 回退解析有坑）。
 */
export default async function TTSPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { text } = await searchParams;
  const incomingText = typeof text === "string" ? text : undefined;
  return <TTSWorkspace incomingText={incomingText} />;
}
