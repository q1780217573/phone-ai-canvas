# AI 画图（手机端 PWA）

一部安卓手机独立使用的 AI 画图应用。没有后端，浏览器直连中转站。

## 功能

| 模块 | 内容 |
| :--- | :--- |
| 生图 | 文生图；0–2 张参考图自动切换到改图接口；1:1 / 3:4 / 4:3 三档 |
| 提示词库 | 分类、搜索、使用次数、方括号占位符填空、JSON 导入导出；内置 24 节气高定 + 六类通用词库 |
| 参考图 | 收藏常用参考图，一键带到生图页 |
| 库 | 作品网格、收藏、删除、保存到手机 |
| 设置 | API 地址、Key、模型管理（可增删、设默认）、外观三档、原图保留张数、存储占用 |

## 本地开发

```bash
pnpm install
pnpm dev            # 开发，默认 5173/5180
pnpm build          # 产出 dist/
pnpm preview --host # 预览构建产物，供同局域网手机访问
pnpm check          # TypeScript 类型检查
```

图标重新生成：`node scripts/gen-icons.mjs`

## 接口契约（实测于 2026-11-18）

基址：`https://api.apikey.fan/v1`（OpenAI 兼容）

| 动作 | 端点 | 说明 |
| :--- | :--- | :--- |
| 文生图 | `POST /images/generations` | 返回 `b64_json`，单张 1.2–2.2 MB |
| 改图 | `POST /images/edits` | multipart，`image[]` 支持 1–2 张 |
| 自检 | `POST /chat/completions` | 1 token 空问答 |

已知限制（都已实测，代码里不依赖）：

- `output_format` / `quality` / `partial_images` 参数被中转站忽略，输出恒为 PNG，流式无中间帧
- `/v1/models` 只返回生图模型，对话模型需内置清单（现仅用于连接自检）
- 无余额查询接口，`/v1/dashboard/*` 全部 404
- 当前 key 分组下，`deepseek-*` 的请求实际由 `gpt-6.1-sol` 应答

## 调试技巧

设置页把 API Key 填成 `mock`（仅开发模式生效），生图会返回本地绘制的测试图，不消耗额度，用来验证界面链路。

## 内置词库

| 文件 | 内容 |
| :--- | :--- |
| `src/data/jieqi.ts` | 二十四节气 · 高定礼服 24 条（每节气四段式：灵感 + 廓形 + 元素 + 关键词 + 摄影参数/反向词） |
| `src/data/prompt-pack.ts` | 通用词库 30 条，六类：人像、风景、产品、插画、家居、宠物 |
| `src/lib/db.ts` | `main.tsx` 启动调用 `ensureSeed()`，幂等写入，id 前缀 `jieqi-` / `pack-`，已存在的跳过 |

扩展方式：

- 通用词库直接往 `src/data/prompt-pack.ts` 的 `PROMPT_PACK` 追加对象（`title` / `category` / `body`）即可
- 节气词库由 `node scripts/gen-jieqi.mjs` 从源 HTML 生成，改内容请改源文件后重新生成，勿手改 `jieqi.ts`

两者都不要改动已有条目的顺序与 id —— 老用户设备上靠 `jieqi-0…23` / `pack-0…29` 判重，重排会导致重复导入。

## 主题

三档：跟随系统 / 亮色 / 暗色，设置页可切，默认跟随系统。

- 所有颜色走 CSS 变量（`--c-*`，RGB 三元组形式，支持 `/透明度` 修饰），定义在 `src/index.css` 的 `[data-theme='dark']` 与 `[data-theme='light']` 两个块里
- 亮色为暖白：底 `#F7F6F3`、卡片 `#FFFFFF`、描边 `#E2DDD4`；强调色压深到 `#BC431B` 以保证白底可读
- **结果页看图固定深底**（`data-theme="dark"` 局部作用域），避免浅底导致颜色判断失真
- 首帧防闪：`index.html` 内联脚本先读 localStorage 里的主题再上色

对比度实测（WCAG）：暗色 8 组全部 ≥ AA，亮色 7 组全部 ≥ AA，最低 4.52（`muted / surface`）。

## 存储规则

- 缩略图 WebP 512px 永久保留
- 原图默认保留最近 100 张，超出后只留缩略图 + 提示词（可「照此再来一张」）
- 数据全部在手机浏览器的 IndexedDB，不上传

## 部署

PWA 安装（添加到主屏幕）需要 HTTPS，`http://局域网IP` 只能当普通网页用。

推荐 GitHub Pages：把 `dist/` 推到仓库，开启 Pages 即得一个 HTTPS 地址，手机打开后「添加到主屏幕」。
