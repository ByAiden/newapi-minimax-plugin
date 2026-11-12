---
changelogVersion: 1
plugin: "hailuo"
version: "1.5.0"
locale: "en"
translations:
  zh-CN: "CHANGELOG.zh-CN.md"
---
# Changelog

## [1.5.0]

### Added

- Generate images with `MiniMax-H3-Image` and `MiniMax-H3-Image-Highspeed` through the OpenAI Images API: text to image at `POST /v1/images/generations`, and editing with 1 to 16 reference images at `POST /v1/images/edits`, as JSON or as multipart uploads. MiniMax's own image bodies work under `/hailuo`.
- Price images by MiniMax's input text, reference image and output image tokens, or per delivered image. Requests settle on the usage MiniMax reports, so images MiniMax fails to make are not charged.

### Removed

- The Hailuo models `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-2.3-Fast`, `MiniMax-Hailuo-02` and the 01 series (`T2V-01-Director`, `T2V-01`, `I2V-01-Director`, `I2V-01-live`, `I2V-01`, `S2V-01`).
- The /v1 video paths that served them: `POST /v1/video_generation`, `GET /v1/query/video_generation`, `GET /hailuo/v1/query/video_generation/{task_id}` and `GET /v1/files/retrieve`.

### Changed

- The plugin is named MiniMax. `POST /v1/videos` and `POST /v1/responses` serve `MiniMax-H3` only.
- Native errors on every path use MiniMax's typed error format.

### Migration

- **Before upgrading:** let every Hailuo 2.3, 02 and 01 series task finish. The gateway no longer polls those tasks or serves their videos.
- **Models and pricing:** remove the dropped models from your MiniMax channels, add `MiniMax-H3-Image` and `MiniMax-H3-Image-Highspeed`, and save a price for the image models before offering them.
- **API address:** set the channel's API address to `https://api.minimax.io` or `https://api.minimaxi.com`, the platform of your key.
