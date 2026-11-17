---
changelogVersion: 1
plugin: byaiden_minimax
version: 1.2.3
locale: "zh-CN"
---

# Changelog

## [1.2.3]

### Changed

- 视频请求支持顶层 `ratio`，同时设了 `metadata.ratio` 时以后者为准。此前顶层 `ratio` 会被忽略。

### Fixed

- 视频请求的 `prompt` 或 `ratio` 不是字符串（例如写成数组）时直接报错，不再提交。此前会把 `[object Object]` 当作提示词发给 MiniMax，照常生成并扣费。
