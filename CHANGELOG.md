---
changelogVersion: 1
plugin: byaiden_minimax
version: 2.0.0
locale: "en"
translations:
  zh-CN: CHANGELOG.zh-CN.md
---

# Changelog

## [2.0.0]

### Added

- One channel now serves the whole MiniMax API: text through OpenAI Chat Completions, OpenAI Responses and Anthropic Messages (passed through, streaming included), and Fetch models (MiniMax's text models plus this plugin's media models).
- Speech: `POST /v1/audio/speech` with `speech-2.8-hd`, `speech-2.8-turbo`, `speech-2.6-hd`, `speech-2.6-turbo`, `speech-02-hd` and `speech-02-turbo`, answered with audio bytes or OpenAI speech events, and a Default voice channel setting.
- Transcription: `POST /v1/audio/transcriptions` with `asr-1.0`, as `json` or `verbose_json` with segments and word timestamps.
- H3-Context-IR video prompt tasks (`POST /v2/h3_context_ir`, model `MiniMax-H3-Context-IR`), video regeneration to 2K (`POST /v2/video_regeneration`, model `MiniMax-H3-Regeneration`) and cancel or delete of video tasks (`DELETE /v2/video_generation/{id}`).
- Image prompt enhancement (`POST /v1/h3_image_context_ir`) and music generation (`POST /v1/music_generation` with `music-3.0`, `music-2.6` and `music-cover`).
- Ready-to-paste price expressions for every model in the README.

### Changed

- The plugin is named MiniMax instead of MiniMax H3. Existing video and image endpoints, the plugin key and the billing facts are unchanged.

### Migration

- Existing channels keep working. Add the new models to the channel (Fetch models, or type them) and save their prices to offer them.
