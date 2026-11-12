---
changelogVersion: 1
plugin: "byaiden_minimax"
version: "1.0.0"
locale: "zh-CN"
---
# Changelog

## [1.0.0]

### Added

- 可以用 `MiniMax-H3`、`MiniMax-H3-Highspeed`、`MiniMax-H3-Lite` 和 `MiniMax-H3-Max` 根据文字、首尾帧，或参考图片、视频和音频生成视频，支持 `POST /v1/videos`、`POST /v1/responses` 和 MiniMax 原生的 `POST /v2/video_generation`。
- 可以通过 OpenAI 图片接口使用 `MiniMax-H3-Image` 和 `MiniMax-H3-Image-Highspeed`：`POST /v1/images/generations` 文生图，`POST /v1/images/edits` 用 1 到 16 张参考图编辑图片，支持 JSON 和 multipart 上传。
- 视频可以按秒数、分辨率、输入图片张数和输入视频秒数定价；图片可以按 MiniMax 的输入文本、参考图、输出图片三种 token 定价，也可以按张定价。请求按 MiniMax 报告的实际用量结算。
