---
locale: zh-CN
---

# MiniMax

[English](README.md) | **简体中文**

用一个 new-api 渠道、一把 MiniMax API Key 接入 MiniMax 的全部网关可用能力：

- 文本：OpenAI Chat Completions、OpenAI Responses 和 Anthropic Messages，原样透传，支持流式。
- 语音合成：OpenAI 语音接口（`/v1/audio/speech`），返回音频文件或 OpenAI 语音事件流。
- 语音识别：OpenAI 转写接口（`/v1/audio/transcriptions`）。
- 视频：`MiniMax-H3`、`MiniMax-H3-Highspeed`、`MiniMax-H3-Lite`、`MiniMax-H3-Max`，可走 OpenAI 视频接口、Responses 和 MiniMax 原生 `/v2` 接口；另有 H3-Context-IR（视频提示词增强）、视频重生成（768P 升 2K）以及任务取消和删除。
- 图片：`MiniMax-H3-Image`、`MiniMax-H3-Image-Highspeed` 的生成和编辑，以及单独的 H3-Image-Context-IR（提示词增强）。
- 音乐：`music-3.0`、`music-2.6`、`music-cover`。

需要 new-api v1.0.0-rc.50 或更新版本（支持带 provider 部分的插件）。插件 key 为 `byaiden_minimax`。较早的海螺 2.3、02 和 01 视频模型请继续用官方的 `hailuo` 插件。

## 渠道设置

1. 安装插件，只需新建一个「任务插件」类型的渠道并绑定 `byaiden_minimax`。选择插件后，渠道模型列表会自动填入下面的全部模型。
2. API 地址和密钥。地址要和 Key 所属的站点一致；把 Key 发到另一个站点会报鉴权错误。

| 站点 | API 地址 |
| --- | --- |
| 国内站（默认） | 留空，或填 `https://api.minimaxi.com` |
| 国际站 | `https://api.minimax.io` |

   末尾不要加 `/v1`。
3. 「获取模型列表」会列出 MiniMax 为该 Key 返回的文本模型，再加上本插件的全部语音合成、语音识别、视频、图片和音乐模型（MiniMax 的模型列表只有文本模型）。Key 用不了的模型会返回 MiniMax 自己的错误，从渠道里删掉即可。
4. 默认音色（渠道设置）：语音请求写的是 OpenAI 音色名（`alloy`、`nova` 等）或没写音色时使用的 MiniMax 音色 ID，默认 `English_Graceful_Lady`。其他音色见 MiniMax 系统音色列表。
5. 设置价格（见「计费」）。渠道测试按钮发送的是对话请求，测试模型请选文本模型。

从 1.x 升级时，插件 key、视频和图片接口以及它们的计费字段都不变，已有渠道照常工作。要提供新模型，把它们加到渠道里（获取模型列表，或手动填写）。

## 模型与接口

| 类别 | 模型 |
| --- | --- |
| 文本 | `MiniMax-M3.1-Flash`、`MiniMax-M3`、`MiniMax-M2.7`、`MiniMax-M2.7-highspeed`、`MiniMax-M2.5`、`MiniMax-M2.5-highspeed`、`MiniMax-M2.1`、`MiniMax-M2.1-highspeed`、`MiniMax-M2`，以及按名称加到渠道里的其他文本模型 |
| 语音合成 | `speech-2.8-hd`、`speech-2.8-turbo`、`speech-2.6-hd`、`speech-2.6-turbo`、`speech-02-hd`、`speech-02-turbo` |
| 语音识别 | `asr-1.0` |
| 视频 | `MiniMax-H3`、`MiniMax-H3-Highspeed`、`MiniMax-H3-Lite`、`MiniMax-H3-Max` |
| 视频提示词 | `MiniMax-H3-Context-IR`（在 MiniMax-H3 上运行） |
| 视频重生成 | `MiniMax-H3-Regeneration`（在 MiniMax-H3 上运行） |
| 图片 | `MiniMax-H3-Image`、`MiniMax-H3-Image-Highspeed` |
| 音乐 | `music-3.0`、`music-2.6`、`music-cover` |

| 接口 | 模型 |
| --- | --- |
| `POST /v1/chat/completions`、`POST /v1/responses`、`POST /v1/messages` | 文本 |
| `POST /v1/audio/speech` | 语音合成 |
| `POST /v1/audio/transcriptions` | 语音识别 |
| `POST /v1/videos`、`GET /v1/videos/{id}`、`GET /v1/videos/{id}/content` | 视频 |
| `POST /v1/responses` | 视频（作为视频任务，见下文） |
| `POST /v2/video_generation` | 视频，MiniMax 原生请求体 |
| `GET /v2/query/video_generation/{id}` | 所有视频、Context-IR 和重生成任务 |
| `DELETE /v2/video_generation/{id}` | 取消或删除视频、Context-IR、重生成任务 |
| `POST /v2/h3_context_ir` | `MiniMax-H3-Context-IR`（或 `MiniMax-H3`） |
| `POST /v2/video_regeneration` | `MiniMax-H3-Regeneration`（或 `MiniMax-H3`） |
| `POST /v1/images/generations`、`POST /v1/images/edits` | 图片 |
| `POST /v1/h3_image_context_ir` | `MiniMax-H3-Image` |
| `POST /v1/music_generation` | 音乐 |

所有 MiniMax 路径也可以加 `/byaiden_minimax` 前缀调用（MiniMax 原生的图片请求体和返回只走带前缀的路径，因为不带前缀的图片路径是 OpenAI 格式）。原生路径只接受 `Authorization: Bearer` 形式的网关令牌。`{id}` 一律是网关的任务 ID。

### 文本

文本请求原样转发到渠道地址的 `/v1/chat/completions`、`/v1/responses` 和 `/anthropic/v1/messages`：`reasoning_effort`、`output_config`、工具调用等 MiniMax 参数照原样送达，new-api 按 MiniMax 返回的用量计费。`POST /v1/responses` 用视频模型时生成视频（与 1.x 相同），用其他模型时是文本请求。

### 语音合成和语音识别

语音合成：`input`（少于 10,000 字符）、`voice`（MiniMax 音色 ID；OpenAI 音色名使用默认音色）、`response_format`（默认 `mp3`，另有 `wav`、`pcm`、`flac`、`opus`）、`speed`（0.5 到 2.0），以及放在 `metadata` 里的 MiniMax 参数 `vol`、`pitch`、`emotion`、`text_normalization`、`latex_read`、`sample_rate`、`bitrate`、`channel`、`force_cbr`、`language_boost`、`pronunciation_dict`、`voice_modify`、`timbre_weights`、`text_normalization_mode`。插件向 MiniMax 请求流式音频，返回音频字节；设 `stream_format: "sse"` 时改为返回 OpenAI 的 `speech.audio.delta` 事件。`instructions` 会被拒绝（MiniMax 没有这个字段，请用 `metadata.emotion`）。

语音识别：multipart 的 `file`（wav、mp3、flac、m4a、aac、opus、ogg，最长 500 秒、50 MB），可选 `language`（作为语言提示发给 MiniMax），`response_format` 为 `json`（默认）或 `verbose_json`（含分段和说话人），`verbose_json` 加 `timestamp_granularities[]=word` 返回逐词时间戳。

### 视频

`/v1/videos` 的 OpenAI 字段：`prompt`、`seconds`、`size` 或 `resolution`（按模型支持 `480P`、`768P`、`2K`）、`ratio`、`input_reference`（URL、data URL 或 multipart 上传，作首帧），以及 `metadata` 里的 `first_frame_image`、`last_frame_image`、`reference_video`、`reference_audio`、`content`（MiniMax 完整的 content 数组）、`aigc_watermark`，`MiniMax-H3-Max` 还可用 `extra.prompt_expansion_mode`（`disabled`、`balanced` 或 `quality`）。`/v2/video_generation` 使用 MiniMax 原生请求体。

H3-Context-IR（`POST /v2/h3_context_ir`）：MiniMax 原生请求体（`content`、`duration` 4 到 15、`ratio`）；`model` 填 `MiniMax-H3-Context-IR` 或 MiniMax 的 `MiniMax-H3`。返回任务 ID，查询结果的 `task.content.prompt` 是增强后的提示词。纯文字请求没写 `ratio` 时使用 `16:9`。

视频重生成（`POST /v2/video_regeneration`）：二选一，`source_task_id`（同一渠道上已完成的 768P `MiniMax-H3` 任务的网关 ID；这种写法需要 MiniMax 为账号开通），或者 `content` 里放恰好一个角色为 `base_video` 的 `video_url` 以及原始输入；`resolution` 为 `2K`；`generate_audio` 和 `aigc_watermark` 可选。查询和下载方式与普通视频任务相同。

取消或删除（`DELETE /v2/video_generation/{id}`，带 JSON 请求体，`{}` 即可）：排队中的任务会被 MiniMax 取消（任务随后失败并退款），已完成的任务会删除记录；生成中的任务不能取消。渠道没有提供 `MiniMax-H3` 时，请在请求体里写 `"model"` 为该任务的模型。返回 MiniMax 的 `{task_id, action, status}`，其中是网关的任务 ID。

客户端轮询 `GET /v1/videos/{id}` 或 `GET /v2/query/video_generation/{id}`，从 `GET /v1/videos/{id}/content` 下载；每次下载插件都会向 MiniMax 取新的链接。

### 图片

OpenAI 字段：`prompt`、`n`（1 到 10）、`size`（`WIDTHxHEIGHT` 或 `auto`）、`response_format`，另支持 MiniMax 的 `aspect_ratio`、`area`（`1K`、`2K`、`4K`）、`output_format`、`output_compression`，文生图还可用 `disable_prompt_enhanced`。图片编辑接受 1 到 16 张参考图，可以用 JSON（`image` 传 URL，或 `images[].image_url`），也可以用 OpenAI SDK 的 multipart 上传（`image` / `image[]`）。图片接口等全部图片生成完才返回；单张失败的图片不放进结果，只有一张都没生成出来才算失败。

提示词增强（`POST /v1/h3_image_context_ir`，仅 `MiniMax-H3-Image`）：`prompt`，可选 `images`（1 到 16 张，按图片编辑增强）、`size`、`aspect_ratio`、`area`。立即返回 MiniMax 的 `revised_prompt` 和用量。

### 音乐

`POST /v1/music_generation` 使用 MiniMax 原生请求体：`model`、`prompt`、`lyrics`、`output_format`（默认 `hex`，或 `url`）、`audio_setting`、`lyrics_optimizer`、`is_instrumental`，`music-cover` 还需要 `audio_url`、`audio_base64` 或 `cover_feature_id` 之一。返回 MiniMax 的原始结果（hex 音频，或 24 小时内有效的链接）。MiniMax 自 2026-08-20 起不再向新账号开放音乐接口，只有此前用过的账号还能调用这些模型。

## 计费

下面的表达式直接用 MiniMax 国内站人民币标价的数字，适用于「1 元 = 1 美元额度」的站点。如果站点按真实美元结算，请把每个表达式再除以汇率（例如 `/ 7`）。需要加价时再乘以倍率。保存前请先核对 MiniMax 当前价格。

文本、语音合成和语音识别由 new-api 按普通请求计费，表达式表示每百万单位的价格：

| 模型 | 表达式 | 单位 |
| --- | --- | --- |
| `MiniMax-M3.1-Flash` | `tier("base", p * 1 + c * 4 + cr * 0.1)` | token |
| `MiniMax-M3` | `tier("base", p * 2.1 + c * 8.4 + cr * 0.42)` | token（输入超过 512K token 时 MiniMax 价格翻倍） |
| `speech-2.8-hd`、`speech-2.6-hd`、`speech-02-hd` | `tier("base", p * 700)` | `input` 的字符数 |
| `speech-2.8-turbo`、`speech-2.6-turbo`、`speech-02-turbo` | `tier("base", p * 400)` | `input` 的字符数 |
| `asr-1.0` | `tier("base", p * 694.44)` | 音频秒数，向上取整 |

MiniMax 语音合成标价为每万字符 3.5 元（hd）和 2 元（turbo），一个汉字按两个字符计；new-api 每个字符只计一次，所以 `p * 700` 和 `p * 400` 对应中文文本，不含汉字的文本用一半即可。语音识别每小时 2.5 元；插件把计费秒数作为请求的 token 数上报。其他文本模型请按 MiniMax 价格表设置。

视频、Context-IR、重生成、图片和音乐按任务计费，使用下列用量字段。提交时按请求预扣，最后按 MiniMax 报告的用量结算。计费模式选表达式：

| 模型 | 表达式（人民币标价数字） |
| --- | --- |
| `MiniMax-H3` | `u("resolution") == "2K" ? tier("2K", u("seconds") * 0.8 + u("input_video_seconds") * 0.8 + max(u("input_images") - 5, 0) * 0.2) : tier("768P", u("seconds") * 0.5 + u("input_video_seconds") * 0.5 + max(u("input_images") - 5, 0) * 0.2)` |
| `MiniMax-H3-Highspeed` | `u("resolution") == "768P" ? tier("768P", u("seconds") * 0.4 + u("input_video_seconds") * 0.4 + max(u("input_images") - 5, 0) * 0.2) : tier("480P", u("seconds") * 0.26 + u("input_video_seconds") * 0.26 + max(u("input_images") - 5, 0) * 0.2)` |
| `MiniMax-H3-Lite` | `u("resolution") == "768P" ? tier("768P", u("seconds") * 0.26 + u("input_video_seconds") * 0.26 + max(u("input_images") - 5, 0) * 0.13) : tier("480P", u("seconds") * 0.16 + u("input_video_seconds") * 0.16 + max(u("input_images") - 5, 0) * 0.13)` |
| `MiniMax-H3-Max` | `u("resolution") == "768P" ? tier("768P", u("seconds") * 0.5 + u("input_video_seconds") * 0.97 + max(u("input_images") - 2, 0) * 0.5) : tier("480P", u("seconds") * 0.33 + u("input_video_seconds") * 0.37 + max(u("input_images") - 2, 0) * 0.5)` |
| `MiniMax-H3-Context-IR` | `tier("base", (u("context_ir_input_tokens") * 5.8 + u("context_ir_output_tokens") * 23) / 1000000)` |
| `MiniMax-H3-Regeneration` | `tier("base", u("seconds") * 0.3 + u("input_video_seconds") * 0.3 + max(u("input_images") - 5, 0) * 0.15)` |
| `MiniMax-H3-Image` | `tier("base", (u("image_input_text_tokens") * 15 + u("image_input_image_tokens") * 10 + u("image_output_tokens") * 25) / 1000000)` |
| `MiniMax-H3-Image-Highspeed` | `tier("base", (u("image_input_text_tokens") * 15 + u("image_input_image_tokens") * 20 + u("image_output_tokens") * 50) / 1000000)` |
| `music-3.0`、`music-2.6`、`music-cover` | `tier("base", u("music_tracks") * 1)` |

- 视频：成片的 `seconds` 和 `resolution`，`input_images`（MiniMax 只对前 5 张之外的图片收费，`MiniMax-H3-Max` 是前 2 张之外，所以用 `max(... - 5, 0)`），`input_video_seconds`（MiniMax 报告实际时长前按 15 秒预扣）。请求没写时长按 5 秒计算（原生路径按 15 秒）；没写分辨率按 `768P`（原生路径按该模型最贵的一档）。
- Context-IR：`context_ir_input_tokens` 和 `context_ir_output_tokens`，MiniMax 报告前按 16,384 加每个素材 16,384 的输入 token、16,384 的输出 token 预扣（一个简短的文字提示词实际约 5,700 和 3,400）。
- 重生成：2K 成片的 `seconds`，加上原任务的输入图片和输入视频（MiniMax 会再次计费）；按原任务的数据预扣，未知时按 15 秒。
- 图片：输入文本、参考图和输出 token，按成功生成的每张图计；按张定价时用 `image_count`。提交时先预扣估算值（每 1024 像素 1 个输出 token，每张至少 4096 个；`auto` 尺寸按 `area` 算，默认 4K）。提示词增强在 `MiniMax-H3-Image` 上只计输入文本 token，上面的表达式已经覆盖；按张定价时不收费。
- 音乐：`music_tracks` 为成功生成的歌曲数，每首 1。
- 取消和删除请求的用量都是 0，上面的表达式不收费；被取消的排队任务会退款。

## 示例

```bash
curl https://your-gateway.example/v1/chat/completions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "MiniMax-M3.1-Flash", "messages": [{"role": "user", "content": "你好"}]}'
```

```bash
curl https://your-gateway.example/v1/audio/speech \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "speech-2.8-turbo", "input": "你好，欢迎使用 MiniMax。", "voice": "Chinese (Mandarin)_Lyrical_Voice"}' \
  -o speech.mp3
```

```bash
curl https://your-gateway.example/v1/videos \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "MiniMax-H3", "prompt": "平静池塘上漂着一只纸船", "seconds": 4, "size": "768P"}'
```

轮询 `GET /v1/videos/TASK_ID`，`status` 变成 `completed` 后下载 `GET /v1/videos/TASK_ID/content`。取消排队中的任务：

```bash
curl -X DELETE https://your-gateway.example/v2/video_generation/TASK_ID \
  -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" -d '{}'
```

## 经由另一台 New API 网关

一台网关（外层）转发到另一台持有 MiniMax 渠道的网关（中间层）时，两台都安装本插件，外层建一个 **New API** 渠道（类型 60）：API 地址填中间层网关地址，密钥填它的令牌，并在「上游任务插件」里选本插件。外层插件会把视频、Context-IR、重生成、取消、图片和音乐请求发到中间层的 `/byaiden_minimax/...` 路径，并从它的 `/v1/tasks/{id}/artifacts/video/content` 下载视频。中间层的返回保留 MiniMax 的用量，两层按同样的用量结算：外层用上面的表达式按自己的倍率定价即可。文本经 New API 渠道原样透传。

new-api 的 New API 渠道类型不转发语音合成和语音识别请求（报 "endpoint not supported"）。这两类请在外层另建一个普通 OpenAI 渠道，填中间层地址和令牌，加入语音合成和语音识别模型。

## 限制

- `MiniMax-H3` 生成 4 到 15 秒，分辨率 `768P` 或 `2K`；`MiniMax-H3-Highspeed` 和 `MiniMax-H3-Lite` 4 到 15 秒、`MiniMax-H3-Max` 5 到 15 秒，分辨率 `480P` 或 `768P`。所有 H3 视频模型最多 9 张图片、3 段参考视频、3 段参考音频；一个请求只能用首尾帧或参考素材之一。`MiniMax-H3-Lite` 用参考素材时不支持自适应比例，默认 `16:9`，纯文字请求也一样。`prompt` 和 `ratio` 必须是字符串。
- 图片请求每次生成 1 到 10 张。`WIDTHxHEIGHT` 尺寸要在 655,360 到 20,000,000 像素之间、宽高比 1:3 到 3:1，且不能和 `aspect_ratio`、`area` 同时使用。图片编辑总会做提示词增强，所以 `disable_prompt_enhanced` 只能用于文生图，并需指定固定尺寸或 `aspect_ratio`。不支持蒙版、透明背景、随机种子和流式返回图片。
- 不提供：WebSocket 语音合成（没有对应的 WebSocket 转发）、异步长文本语音合成（结果是 MiniMax 文件存储里的压缩包）、声音复刻、音色设计和音色管理（属于账号管理而非生成）、文件管理、歌词生成和翻唱预处理、视频 Agent 模板，以及 MiniMax 的任务列表（会显示整个 MiniMax 账号的任务）。这些请直接使用 MiniMax。
- 所有接口都拒绝 `callback_url`，请改为查询任务。
- 图片和音乐生成不是幂等的：客户端重试会重新生成、重新计费。4K 多张图或一首歌可能要好几分钟；图片请求网关最多等到协议超时（默认 600 秒）。
- MiniMax 只保留 7 天视频任务，链接会过期，请及时下载。
- 被 MiniMax 拒绝的请求和失败的任务不计费。
