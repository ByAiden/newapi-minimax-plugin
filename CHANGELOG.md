---
changelogVersion: 1
plugin: byaiden_minimax
version: 2.1.0
locale: "en"
translations:
  zh-CN: CHANGELOG.zh-CN.md
---

# Changelog

## [2.1.0]

### Added

- Upstream type channel setting: `MiniMax API` (the default, unchanged) or `OpenAI-compatible relay`. A relay channel sends Chat Completions, Responses and Anthropic Messages to the relay's OpenAI paths unchanged and bills the usage it reports, sends speech, transcription and image generation to its OpenAI audio and image endpoints with the same billing facts, and returns the relay's own model list. Video, H3-Context-IR, regeneration, cancel and delete, image editing, H3-Image-Context-IR and music fail on a relay channel with an error naming the upstream type, before anything is reserved. Saving a relay channel with an empty or MiniMax Base URL is refused.
- Usage fact `billable_input_images` on the H3 video models and regeneration: the input images MiniMax charges (beyond the first 5, beyond the first 2 on `MiniMax-H3-Max`), worked out at submit and on settlement, also through a second gateway.

### Changed

- README video and regeneration price expressions use `u("billable_input_images")` instead of `max(u("input_images") - 5, 0)`, so model pages show them as price tables (for `MiniMax-H3` as this plugin's own price for the model, since new-api's built-in `hailuo` plugin also declares it). The amounts charged are unchanged, and `input_images` is still reported, so existing expressions keep working.
