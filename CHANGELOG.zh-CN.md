---
changelogVersion: 1
plugin: byaiden_minimax
version: 2.1.0
locale: "zh-CN"
---

# Changelog

## [2.1.0]

### Added

- 新增渠道设置「上游类型」：`MiniMax 官方 API`（默认，行为不变）或 `OpenAI 兼容中转`。中转渠道把 Chat Completions、Responses 和 Anthropic Messages 原样发往中转的 OpenAI 路径并按其返回的用量计费，语音合成、语音识别和图片生成发往中转的 OpenAI 音频和图片接口，计费字段不变，获取模型列表返回中转自己的列表。视频、H3-Context-IR、重生成、取消和删除、图片编辑、H3-Image-Context-IR 和音乐在中转渠道上直接报错（写明上游类型），不会预扣。中转渠道的 API 地址为空或为 MiniMax 官方地址时无法保存。
- H3 视频模型和重生成新增用量字段 `billable_input_images`：MiniMax 实际收费的输入图片数（前 5 张之外，`MiniMax-H3-Max` 为前 2 张之外），提交和结算时都会计算，经第二层网关时同样有效。

### Changed

- README 中视频和重生成的价格表达式改用 `u("billable_input_images")`，替代 `max(u("input_images") - 5, 0)`，模型详情页会显示为价格表（`MiniMax-H3` 需设为本插件对该模型的单独价格，因为 new-api 内置的 `hailuo` 插件也声明了该模型）。扣费金额不变；插件仍上报 `input_images`，现有表达式照常可用。
