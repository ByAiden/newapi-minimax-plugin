---
changelogVersion: 1
plugin: byaiden_minimax
version: 2.0.2
locale: "en"
translations:
  zh-CN: CHANGELOG.zh-CN.md
---

# Changelog

## [2.0.2]

### Changed

- README price expressions for `MiniMax-H3-Context-IR`, `MiniMax-H3-Image` and `MiniMax-H3-Image-Highspeed` divide each token term by 1000000 on its own, so the gateway's model page shows them as a price table instead of the raw expression. The amounts charged are unchanged.
- README notes that the video expressions stay shown as raw expressions, because the free input image allowance (`max(...)`) has no price table form.
