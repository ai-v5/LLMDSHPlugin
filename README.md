# LLMDSHPlugin

DeepSeek Harness (DSH) 插件：在桌面端/Web 端侧边栏左下角增加 **Token 统计**，按天汇总当前 profile 下所有 Session 的 token 用量。

## 功能

- 左下角 footer 常驻入口，显示今日 token 总量。
- 点击展开统计面板：今日、近 7 天、近 N 天总量，以及每日柱状图和明细列表。
- 按 provider 上报的 usage 统计，包含 `inputTokens`、`outputTokens`、`cacheReadTokens`、`cacheWriteTokens`。
- 支持 7 / 14 / 30 / 90 天范围切换与手动刷新。
- 只读扫描 Session 历史，不修改任何 Session 或配置；fork 继承的事件不会重复计数。

## 安装

要求 DSH Desktop / Web 已安装，且 profile 中已启用 `@deepseek-ai/dsh-base`。

从本地目录安装到 Desktop profile：

```powershell
dsh plugin --profile desktop add D:\WORK\ai-v5\LLMDSHPlugin
```

或直接从 GitHub 安装：

```powershell
dsh plugin --profile desktop add github:ai-v5/LLMDSHPlugin
```

安装后重启 DSH Desktop（或重新加载窗口）。插件会出现在侧边栏左下角 Settings 上方。

卸载：

```powershell
dsh plugin --profile desktop remove llm-dsh-token-usage
```

## 统计口径

- 数据来自 DSH 的 `ctx.sessionQuery`：先 `listSessions()`，再读取每个 Session 的完整事件日志。
- 每个 `assistant/message` 或 `assistant/attempt` 的 provider usage 都会计入；同一 turn/step 的后续样本会替换前一样本，`llm/retry-started` 之后的 attempt 单独累计。
- `compaction/summary` 自带的 usage 也会计入（压缩调用不在 agent loop 的 step 内，日志里只有这一条记录）。
- 日期按 Host 本地时区划分。
- `totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens`，其中包含 prompt cache 命中读取；面板同时展示不含 cache read 的 `inputOutputTokens`。
- 子 Session 与父 Session 都是独立 Session，会各自计入；fork 继承的前缀通过 `inheritedEventCount` 排除。

## 接口

Host 端注册只读路由：

```
GET /api/llm-token-usage/stats?days=30&refresh=1
```

返回：

```json
{
  "generatedAt": 1760000000000,
  "days": 30,
  "range": { "from": "2026-09-19", "to": "2026-10-18" },
  "today": { "date": "2026-10-18", "inputTokens": 0, "outputTokens": 0, "cacheReadTokens": 0, "cacheWriteTokens": 0, "totalTokens": 0, "inputOutputTokens": 0, "sessions": 0 },
  "totals": { "...": "same shape as today" },
  "allTime": { "...": "same shape as today" },
  "series": [{ "date": "2026-09-19", "...": "same shape as today" }],
  "sessionCount": 0,
  "skippedSessions": 0,
  "incomplete": false
}
```

结果缓存 60 秒；`refresh=1` 跳过缓存。

## 开发

```powershell
node --test tests/stats.test.mjs
node --check lib/stats.js
node --check index.js
node --check client.js
```

项目本身不需要构建：`index.js` 是 Host 半部，`client.js` 是浏览器半部，`locale/*.json` 提供插件管理页显示名称。

## 参考

设计上参考了 MIT 许可的 [HaoyueQin/dsh-usage-statistics-panel](https://github.com/HaoyueQin/dsh-usage-statistics-panel) 的按天口径与 footer 面板布局；本仓库代码是独立实现，没有复制其源码。

## License

MIT
