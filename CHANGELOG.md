---
changelogVersion: 1
plugin: byaiden_minimax
version: 2.0.1
locale: "en"
translations:
  zh-CN: CHANGELOG.zh-CN.md
---

# Changelog

## [2.0.1]

### Fixed

- Native video query replies (`GET /v2/query/video_generation/{id}`, also under `/byaiden_minimax`) no longer pass MiniMax's stored reply through: `task.id` is the gateway's task id, `task.content.url` is the gateway's own artifact address (left out when the gateway has no server address), and MiniMax's task, file and trace ids and CDN links are dropped. Status, usage, resolution and the Context-IR prompt keep MiniMax's shape. The same holds through a second gateway, which still settles on the forwarded usage and downloads from the middle gateway's artifact endpoint.
- Native create replies of video, Context-IR and regeneration tasks hold only the gateway's `task_id`, and native image, image prompt enhancement and music replies leave out MiniMax's trace ids.
