/**
 * 生成随机 ID。
 * crypto.randomUUID 仅在安全上下文（https / localhost）可用，
 * 本项目支持通过 http + 局域网 IP 访问的 standalone 部署，需自行兜底。
 */
export function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
