---
changelogVersion: 1
plugin: byaiden_minimax
version: 1.2.3
locale: "en"
translations:
  zh-CN: CHANGELOG.zh-CN.md
---

# Changelog

## [1.2.3]

### Changed

- Video requests accept a top-level `ratio` as well as `metadata.ratio` (which wins when both are set). Before, a top-level `ratio` was ignored.

### Fixed

- A video `prompt` or `ratio` that is not a string (for example an array) is refused before the request is sent. Before, the prompt was sent to MiniMax as the text `[object Object]` and the video was billed.
