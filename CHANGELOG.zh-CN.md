---
changelogVersion: 1
plugin: byaiden_minimax
version: 2.0.1
locale: "zh-CN"
---

# Changelog

## [2.0.1]

### Fixed

- 原生视频查询（`GET /v2/query/video_generation/{id}`，以及 `/byaiden_minimax` 前缀路径）不再原样返回 MiniMax 的结果：`task.id` 是网关的任务 ID，`task.content.url` 是网关自己的产物地址（网关未设置服务器地址时省略），MiniMax 的任务 ID、文件 ID、trace ID 和 CDN 链接都不再返回。状态、用量、分辨率和 Context-IR 提示词保持 MiniMax 的结构。经过第二层网关时同样如此，外层仍按转发的用量结算，并从中间层的产物接口下载。
- 视频、Context-IR 和重生成任务的原生创建返回只含网关的 `task_id`；原生图片、图片提示词增强和音乐返回去掉 MiniMax 的 trace ID。
