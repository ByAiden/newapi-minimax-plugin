---
locale: zh-CN
---
# MiniMax

[English](README.md) | **简体中文**

用 `MiniMax-H3` 根据文字、首尾帧，或参考图片、视频和音频生成视频；用 `MiniMax-H3-Image` 和 `MiniMax-H3-Image-Highspeed` 生成和编辑图片。

这是 `hailuo` 插件的 1.5.0 版本，删除了海螺 2.3、2.3 Fast、02 和 01 系列模型。升级前请先看更新日志。

## 渠道设置

- 渠道类型选 MiniMax (35)。
- 密钥填 MiniMax 开放平台创建的 API Key。`MiniMax-H3` 和图片模型由 MiniMax 按量计费。
- API 地址填 Key 所属平台的地址：国际站 `https://api.minimax.io`，国内站 `https://api.minimaxi.com`，末尾不要加 `/v1`。
- 如果上游是另一台 New API 网关，渠道类型选 New API (60)，填写该网关的地址和它的令牌。上游网关也需要安装本版本插件。

## 模型与接口

| 接口 | 用途 | 模型 |
| --- | --- | --- |
| `POST /v1/videos` | 根据提示词生成视频。图生视频时传 `input_reference`，或在 multipart 请求里上传 `input_reference` 文件。 | `MiniMax-H3` |
| `POST /v1/responses` | 通过 Responses API 生成视频，支持流式、同步等待和后台三种调用方式。第二张图作为尾帧。 | `MiniMax-H3` |
| `POST /v2/video_generation` | 用 MiniMax 原生的 H3 请求体生成视频。 | `MiniMax-H3` |
| `GET /v2/query/video_generation/{task_id}` | 查询 H3 任务。 | `MiniMax-H3` |
| `POST /v1/images/generations` | 文生图，OpenAI 图片接口：`prompt`、`n`（1 到 10）、`size`，另支持 MiniMax 的 `aspect_ratio`、`area`、`output_format`、`output_compression` 和 `disable_prompt_enhanced`。 | `MiniMax-H3-Image`、`MiniMax-H3-Image-Highspeed` |
| `POST /v1/images/edits` | 图片编辑，1 到 16 张参考图。可以用 JSON（`image` 传 URL，或 `images[].image_url`），也可以用 OpenAI SDK 的 multipart 上传（`image` / `image[]`）。 | `MiniMax-H3-Image`、`MiniMax-H3-Image-Highspeed` |

图片接口等全部图片生成完才返回，默认返回 URL；请求里设 `response_format: "b64_json"` 时返回 base64。单张图片生成失败或被 MiniMax 内容审核拦下时，不放进返回结果；只有一张都没生成出来，整个请求才算失败。MiniMax 原生的图片请求体和返回（包括失败的图片）走 `/hailuo/v1/images/generations` 和 `/hailuo/v1/images/edits`。

视频由客户端轮询 `GET /v1/videos/{task_id}`，完成后从 `GET /v1/videos/{task_id}/content` 下载。MiniMax 原生的视频路径也可以加 `/hailuo` 前缀调用。

## 计费

视频和图片模型的价格字段分开设置。

`MiniMax-H3`：

- “视频生成单价”按视频秒数计费。请求没写时长时按 5 秒计算（MiniMax 原生路径按 15 秒），最后按 MiniMax 报告的秒数结算。
- “输出视频分辨率”可以给 `768P` 和 `2K` 分别定价。
- “输入图片单价”按输入图片张数计费；“输入视频单价”按输入视频秒数计费，先按 15 秒预扣，MiniMax 报告实际时长后再结算。

`MiniMax-H3-Image` 和 `MiniMax-H3-Image-Highspeed`（MiniMax 按 token 计费）：

- “图片输入文本单价”“图片参考图输入单价”“图片输出单价”都是 token 单价。MiniMax 每成功生成一张图，就把输入 token 计一次；提示词扩写也会增加文本 token。
- “图片生成单价”按成功生成的张数计费，适合不想按 token、只想按张定价的情况。
- 提交时先预扣一个估算值：输出 token 按请求的尺寸算（每 1024 像素 1 个 token；`auto` 尺寸按 `area` 算，默认 4K），输入 token 按偏高的估算值算。最后按 MiniMax 报告的实际用量结算，只收成功生成的图片。

例如想按 `MiniMax-H3-Image` 的官方价格加价 `M` 倍，可以保存这样的任务表达式：`tier("base", (u("image_input_text_tokens") * 2.3 + u("image_input_image_tokens") * 1.5 + u("image_output_tokens") * 3.8) / 1000000 * M)`。保存前请先核对 MiniMax 当前价格；`MiniMax-H3-Image-Highspeed` 的图片 token 单价更高。

## 示例

```bash
curl https://your-gateway.example.com/v1/images/generations \
  -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{"model": "MiniMax-H3-Image", "prompt": "阳光下窗台上的橘猫，胶片质感", "aspect_ratio": "16:9", "area": "2K"}'
```

```bash
curl https://your-gateway.example.com/v1/videos \
  -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{"model": "MiniMax-H3", "prompt": "一只狐狸在松林的新雪里小跑", "seconds": 6, "size": "768P"}'
```

## 限制

- `MiniMax-H3` 生成 4 到 15 秒的视频，分辨率 `768P` 或 `2K`。最多 9 张图片、3 段参考视频、3 段参考音频。一个请求只能用首尾帧，或者只能用参考素材，不能混用。
- 图片请求每次生成 1 到 10 张。`WIDTHxHEIGHT` 形式的尺寸要在 655,360 到 20,000,000 像素之间，宽高比在 1:3 到 3:1 之间，而且不能和 `aspect_ratio`、`area` 同时使用。
- 图片编辑总会做提示词扩写，所以 `disable_prompt_enhanced` 只能用在文生图上，而且要同时指定固定尺寸或 `aspect_ratio`。
- 不支持蒙版、透明背景、随机种子和流式返回图片。
- MiniMax 的图片接口不是幂等的：请求重试会重新生成、重新收费。4K 多张图可能要好几分钟，网关最多等到协议超时（默认 600 秒）。
- 带 `callback_url` 的请求会被拒绝，请改为查询任务。

## 测试

```bash
npm test
```
