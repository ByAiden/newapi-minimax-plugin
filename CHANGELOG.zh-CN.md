---
changelogVersion: 1
plugin: byaiden_minimax
version: 2.0.0
locale: "zh-CN"
---

# Changelog

## [2.0.0]

### Added

- 一个渠道即可接入 MiniMax 全部 API：文本支持 OpenAI Chat Completions、OpenAI Responses 和 Anthropic Messages（原样透传，支持流式），「获取模型列表」返回 MiniMax 的文本模型加上本插件的媒体模型。
- 语音合成：`POST /v1/audio/speech`，模型 `speech-2.8-hd`、`speech-2.8-turbo`、`speech-2.6-hd`、`speech-2.6-turbo`、`speech-02-hd`、`speech-02-turbo`，返回音频字节或 OpenAI 语音事件；新增渠道设置「默认音色」。
- 语音识别：`POST /v1/audio/transcriptions`，模型 `asr-1.0`，支持 `json` 和带分段、逐词时间戳的 `verbose_json`。
- H3-Context-IR 视频提示词任务（`POST /v2/h3_context_ir`，模型 `MiniMax-H3-Context-IR`）、视频重生成到 2K（`POST /v2/video_regeneration`，模型 `MiniMax-H3-Regeneration`），以及视频任务的取消和删除（`DELETE /v2/video_generation/{id}`）。
- 图片提示词增强（`POST /v1/h3_image_context_ir`）和音乐生成（`POST /v1/music_generation`，模型 `music-3.0`、`music-2.6`、`music-cover`）。
- README 给出所有模型可直接粘贴的价格表达式。

### Changed

- 插件名称由 MiniMax H3 改为 MiniMax。原有视频和图片接口、插件 key 和计费字段都不变。

### Migration

- 已有渠道照常工作。要提供新模型，把它们加到渠道里（获取模型列表或手动填写）并保存价格。
