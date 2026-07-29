/* eslint-disable @typescript-eslint/no-require-imports */
// 将 standalone 产物打包为可移植目录 dist/：合并 static/public、复用 .env.local、生成启动器
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");
const STANDALONE = path.join(ROOT, ".next", "standalone");
const STATIC = path.join(ROOT, ".next", "static");
const PUBLIC = path.join(ROOT, "public");
const ENV_LOCAL = path.join(ROOT, ".env.local");

const STARTER = `// 可移植启动器：加载同目录 .env.local（不存在则回退系统环境变量），再启动 Next standalone server
const path = require("path");
try {
  process.loadEnvFile(path.join(__dirname, ".env.local"));
} catch {
  // .env.local 不存在或解析失败，使用系统环境变量
}
require("./server.js");
`;

// 0. 前置检查：standalone 必须已构建
if (!fs.existsSync(STANDALONE)) {
  console.error("✗ 未找到 .next/standalone，请先运行 npm run build");
  process.exit(1);
}

// 1. 清理旧的 dist（避免上次构建残留）
if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true, force: true });
}

// 2. 拷贝 standalone（含 server.js + .next/server + 追踪过的 node_modules）
fs.cpSync(STANDALONE, DIST, { recursive: true });

// 3. 合并 .next/static（浏览器端 JS/CSS）—— standalone 不自带
fs.cpSync(STATIC, path.join(DIST, ".next", "static"), { recursive: true });

// 4. 合并 public（favicon 等）—— standalone 不自带
fs.cpSync(PUBLIC, path.join(DIST, "public"), { recursive: true });

// 5. 复用 .env.local（不存在则跳过，启动器会回退系统环境变量）
if (fs.existsSync(ENV_LOCAL)) {
  fs.copyFileSync(ENV_LOCAL, path.join(DIST, ".env.local"));
}

// 6. 生成启动器 start.js
fs.writeFileSync(path.join(DIST, "start.js"), STARTER);

console.log("✓ 打包完成 -> dist/");
console.log("  本地启动: npm start");
console.log("  服务器启动: cd dist && node start.js");
