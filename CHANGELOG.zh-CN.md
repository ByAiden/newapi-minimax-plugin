---
changelogVersion: 1
plugin: "hailuo"
version: "1.5.0"
locale: "zh-CN"
---
# Changelog

## [1.5.0]

### Added

- 可以通过 OpenAI 图片接口使用 `MiniMax-H3-Image` 和 `MiniMax-H3-Image-Highspeed`：`POST /v1/images/generations` 文生图，`POST /v1/images/edits` 用 1 到 16 张参考图编辑图片，支持 JSON 和 multipart 上传。MiniMax 原生的图片请求体可以走 `/hailuo` 前缀。
- 图片可以按 MiniMax 的输入文本、参考图、输出图片三种 token 定价，也可以按张定价。请求按 MiniMax 报告的实际用量结算，没生成出来的图片不收费。

### Removed

- 删除海螺模型 `MiniMax-Hailuo-2.3`、`MiniMax-Hailuo-2.3-Fast`、`MiniMax-Hailuo-02` 和 01 系列（`T2V-01-Director`、`T2V-01`、`I2V-01-Director`、`I2V-01-live`、`I2V-01`、`S2V-01`）。
- 删除这些模型用的 /v1 视频路径：`POST /v1/video_generation`、`GET /v1/query/video_generation`、`GET /hailuo/v1/query/video_generation/{task_id}` 和 `GET /v1/files/retrieve`。

### Changed

- 插件名改为 MiniMax。`POST /v1/videos` 和 `POST /v1/responses` 只服务 `MiniMax-H3`。
- 原生路径的错误统一使用 MiniMax 的类型化错误格式。

### Migration

- **升级前：**等所有海螺 2.3、02 和 01 系列任务跑完。升级后网关不再查询这些任务，也不再提供它们的视频下载。
- **模型和价格：**从 MiniMax 渠道里删掉已移除的模型，加上 `MiniMax-H3-Image` 和 `MiniMax-H3-Image-Highspeed`，先给图片模型设好价格再开放使用。
- **API 地址：**把渠道的 API 地址设为 Key 所属平台的地址：`https://api.minimax.io` 或 `https://api.minimaxi.com`。
