# micr-AI 文献摘取

micr-AI 是一个基于 Next.js + Tailwind CSS 的前端应用，帮助科研工作者从微生物学 PDF 文献中快速提取菌种信息、抗药性、分离来源等要素，并以结构化数据形式呈现。

## 主要能力

- 📁 **多文件上传**：支持拖拽或批量选择 PDF，实时校验格式与 20MB 体积限制。
- 🤖 **AI 智能提取**：集成 DeepSeek (OpenRouter) 接口，自动输出标准化字段（属、种、菌株、MLST、Taxonomy ID、上下文等）。
- 💾 **本地持久化**：提取结果与 API Key 仅存储在浏览器 `localStorage`，无需后端数据库。
- 📊 **可视化结果**：统计面板 + 结构化表格，支持查看上下文片段并导出 JSON/CSV。
- 🧭 **历史记录管理**：多次提取的结果自动归档，可随时切换查看或清空。

## 快速开始

> ⚠️ 本项目未包含构建后的 `node_modules`，请在本地执行依赖安装。

```bash
npm install
npm run dev
```

默认开发服务器地址为 `http://localhost:3000`。

## DeepSeek API 配置

1. 在 [OpenRouter](https://openrouter.ai/) 申请 DeepSeek 访问密钥。
2. 运行应用后，点击页面右上角的「API 设置」，填入 `sk-or-` 开头的 API Key。
3. 如需使用自定义模型，可在同一界面指定模型 ID（默认 `deepseek/deepseek-chat`）。

所有配置仅存储在本地浏览器，不会发送到任何服务器。

## PDF 解析说明

- 应用使用 `pdfjs-dist` 在浏览器侧提取文本，并在提取过程中显示进度。
- 若 PDF 页面较多或内容复杂，解析阶段可能耗时数秒，请耐心等待。

## 数据导出

- JSON：完整保存提取结果、统计信息和上下文预览。
- CSV：适用于 Excel/数据分析工具，抗药性字段会以分号分隔多个条目。

## 技术栈

- [Next.js 14](https://nextjs.org/)
- [React 18](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [pdfjs-dist](https://github.com/mozilla/pdf.js/)
- [Zod](https://github.com/colinhacks/zod)

## 许可证

本项目以 MIT License 开源，详见仓库根目录的 `LICENSE`（如存在）。
