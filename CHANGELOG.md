---
changelogVersion: 1
plugin: byaiden_minimax
version: 1.2.0
locale: "en"
translations:
  zh-CN: CHANGELOG.zh-CN.md
---

# Changelog

## [1.2.0]

### Added

- Generate videos with `MiniMax-H3`, `MiniMax-H3-Highspeed`, `MiniMax-H3-Lite` and `MiniMax-H3-Max` from text, first and last frames, or reference images, videos and audio, through `POST /v1/videos`, `POST /v1/responses` and MiniMax's own `POST /v2/video_generation`.
- Generate images with `MiniMax-H3-Image` and `MiniMax-H3-Image-Highspeed` through the OpenAI Images API: text to image at `POST /v1/images/generations`, and editing with 1 to 16 reference images at `POST /v1/images/edits`, as JSON or as multipart uploads.
- Price videos per second, per resolution and per input image or input video second, and images by MiniMax's input text, reference image and output image tokens or per delivered image. Requests settle on the usage MiniMax reports.
