---
locale: en
translations:
  zh-CN: README.zh-CN.md
---

# MiniMax

**English** | [简体中文](README.zh-CN.md)

Serves the MiniMax API from ONE new-api channel with one MiniMax API key:

- Text: OpenAI Chat Completions, OpenAI Responses and Anthropic Messages, passed through unchanged, streaming included.
- Speech: OpenAI speech (`/v1/audio/speech`), answered with the audio file or OpenAI speech events.
- Transcription: OpenAI transcriptions (`/v1/audio/transcriptions`).
- Video: `MiniMax-H3`, `MiniMax-H3-Highspeed`, `MiniMax-H3-Lite` and `MiniMax-H3-Max` through OpenAI videos, Responses and MiniMax's own `/v2` endpoints, plus H3-Context-IR (an enhanced video prompt), video regeneration (768P to 2K) and task cancel or delete.
- Images: `MiniMax-H3-Image` and `MiniMax-H3-Image-Highspeed` generation and editing, and H3-Image-Context-IR (prompt enhancement on its own).
- Music: `music-3.0`, `music-2.6` and `music-cover`.

Requires new-api v1.0.0-rc.50 or later (plugins with a provider part). The plugin key is `byaiden_minimax`. The older Hailuo 2.3, 02 and 01 video models stay with the official `hailuo` plugin.

## Channel setup

1. Install the plugin and add ONE channel of type Task Plugin bound to `byaiden_minimax`. Selecting the plugin fills the channel model list with every model below.
2. Base URL and key. Use the address of the site your key belongs to; a key sent to the other site fails with an authentication error.

| Site | Base URL |
| --- | --- |
| China (default) | leave empty, or `https://api.minimaxi.com` |
| International | `https://api.minimax.io` |

   Leave `/v1` off the end.
3. Fetch models lists the text models MiniMax returns for the key plus every speech, transcription, video, image and music model of this plugin (MiniMax's list has text models only). A model your key cannot use answers with MiniMax's own error; remove it from the channel.
4. Default voice (channel setting): the MiniMax voice ID used when a speech request names an OpenAI voice (`alloy`, `nova` and the others) or none. Default `English_Graceful_Lady`. MiniMax's system voice list has the others.
5. Set prices (see Billing). The channel test button sends a chat request; pick a text model as the test model.

Upgrading from 1.x keeps the key, the video and image endpoints and their billing facts; existing channels keep working. Add the new models to a channel (Fetch models, or type them) to offer them.

## Models and endpoints

| Kind | Models |
| --- | --- |
| Text | `MiniMax-M3.1-Flash`, `MiniMax-M3`, `MiniMax-M2.7`, `MiniMax-M2.7-highspeed`, `MiniMax-M2.5`, `MiniMax-M2.5-highspeed`, `MiniMax-M2.1`, `MiniMax-M2.1-highspeed`, `MiniMax-M2`, and any other text model added to the channel by name |
| Speech | `speech-2.8-hd`, `speech-2.8-turbo`, `speech-2.6-hd`, `speech-2.6-turbo`, `speech-02-hd`, `speech-02-turbo` |
| Transcription | `asr-1.0` |
| Video | `MiniMax-H3`, `MiniMax-H3-Highspeed`, `MiniMax-H3-Lite`, `MiniMax-H3-Max` |
| Video prompt | `MiniMax-H3-Context-IR` (runs on MiniMax-H3) |
| Video regeneration | `MiniMax-H3-Regeneration` (runs on MiniMax-H3) |
| Images | `MiniMax-H3-Image`, `MiniMax-H3-Image-Highspeed` |
| Music | `music-3.0`, `music-2.6`, `music-cover` |

| Endpoint | Models |
| --- | --- |
| `POST /v1/chat/completions`, `POST /v1/responses`, `POST /v1/messages` | text |
| `POST /v1/audio/speech` | speech |
| `POST /v1/audio/transcriptions` | transcription |
| `POST /v1/videos`, `GET /v1/videos/{id}`, `GET /v1/videos/{id}/content` | video |
| `POST /v1/responses` | video (as a video task, see below) |
| `POST /v2/video_generation` | video, MiniMax's own body |
| `GET /v2/query/video_generation/{id}` | every video, Context-IR and regeneration task |
| `DELETE /v2/video_generation/{id}` | cancel or delete a video, Context-IR or regeneration task |
| `POST /v2/h3_context_ir` | `MiniMax-H3-Context-IR` (or `MiniMax-H3`) |
| `POST /v2/video_regeneration` | `MiniMax-H3-Regeneration` (or `MiniMax-H3`) |
| `POST /v1/images/generations`, `POST /v1/images/edits` | images |
| `POST /v1/h3_image_context_ir` | `MiniMax-H3-Image` |
| `POST /v1/music_generation` | music |

Every MiniMax path is also served under `/byaiden_minimax/...` (MiniMax's own image bodies and replies only there, since the plain image paths are the OpenAI ones). Native paths accept the gateway token as `Authorization: Bearer` only. `{id}` is always the gateway's task id.

### Text

Text requests go to `/v1/chat/completions`, `/v1/responses` and `/anthropic/v1/messages` on the channel host, unchanged: MiniMax options such as `reasoning_effort`, `output_config` or tools reach MiniMax as sent, and new-api bills the usage MiniMax reports. `POST /v1/responses` with a video model makes a video (as in 1.x); any other model is a text request.

### Speech and transcription

Speech: `input` (under 10,000 characters), `voice` (a MiniMax voice ID; OpenAI voice names use the default voice), `response_format` (`mp3` default, `wav`, `pcm`, `flac`, `opus`), `speed` (0.5 to 2.0), and in `metadata` the MiniMax options `vol`, `pitch`, `emotion`, `text_normalization`, `latex_read`, `sample_rate`, `bitrate`, `channel`, `force_cbr`, `language_boost`, `pronunciation_dict`, `voice_modify`, `timbre_weights`, `text_normalization_mode`. The plugin asks MiniMax for its audio stream and returns the audio bytes; `stream_format: "sse"` returns OpenAI `speech.audio.delta` events instead. `instructions` is refused (MiniMax has no such field; use `metadata.emotion`).

Transcription: multipart `file` (wav, mp3, flac, m4a, aac, opus, ogg; up to 500 seconds and 50 MB), optional `language` (sent to MiniMax as its language hint), `response_format` `json` (default) or `verbose_json` (segments and speakers), and `timestamp_granularities[]=word` with `verbose_json` for word timestamps.

### Video

OpenAI fields for `/v1/videos`: `prompt`, `seconds`, `size` or `resolution` (`480P`, `768P`, `2K` as the model renders), `ratio`, `input_reference` (URL, data URL or multipart upload, the first frame), and `metadata` with `first_frame_image`, `last_frame_image`, `reference_video`, `reference_audio`, `content` (MiniMax's whole content array), `aigc_watermark` and, on `MiniMax-H3-Max`, `extra.prompt_expansion_mode` (`disabled`, `balanced` or `quality`). `/v2/video_generation` takes MiniMax's own body.

H3-Context-IR (`POST /v2/h3_context_ir`): MiniMax's body (`content`, `duration` 4 to 15, `ratio`); `model` is `MiniMax-H3-Context-IR` or MiniMax's `MiniMax-H3`. It returns a task id; the query reply holds the enhanced prompt in `task.content.prompt`. A text-only request without `ratio` gets `16:9`.

Regeneration (`POST /v2/video_regeneration`): either `source_task_id` (the gateway id of a finished 768P `MiniMax-H3` task on the same channel; MiniMax enables this form per account) or `content` with exactly one `video_url` of role `base_video` plus the original inputs; `resolution` is `2K`; `generate_audio` and `aigc_watermark` are optional. Poll and download like any video task.

Cancel or delete (`DELETE /v2/video_generation/{id}` with a JSON body, `{}` is enough): MiniMax cancels a queued task (the task then fails and is refunded) or deletes the record of a finished one; a running task cannot be cancelled. Set `"model"` in the body to the task's model when the channel does not offer `MiniMax-H3`. The reply is MiniMax's `{task_id, action, status}` with the gateway's task id.

Clients poll `GET /v1/videos/{id}` or `GET /v2/query/video_generation/{id}` and download from `GET /v1/videos/{id}/content`; the plugin asks MiniMax for a fresh link on each download. The native query reply keeps MiniMax's `{task: {...}}` shape (status, usage, resolution, `content.prompt` of Context-IR tasks) with the gateway's task id in `task.id` and, once the video is done, the gateway's own artifact address in `task.content.url` (a signed link on the gateway's server address; left out when the gateway has no server address set). MiniMax's own task, file and trace ids and its CDN links are not passed on, also not through a second gateway.

### Images

OpenAI fields: `prompt`, `n` (1 to 10), `size` (`WIDTHxHEIGHT` or `auto`), `response_format`, plus MiniMax's `aspect_ratio`, `area` (`1K`, `2K`, `4K`), `output_format`, `output_compression` and, on text to image, `disable_prompt_enhanced`. Edits take 1 to 16 reference images as JSON (`image` URLs or `images[].image_url`) or OpenAI SDK multipart uploads (`image` / `image[]`). The image endpoints wait for every image; a failed image is left out, and the request fails only when no image is made. The gateway keeps no copy of these synchronous replies, so with `response_format` `url` the image links are MiniMax's own short-lived ones; `b64_json` keeps the images inside the reply. MiniMax's trace id is left out of the native reply.

Prompt enhancement (`POST /v1/h3_image_context_ir`, `MiniMax-H3-Image` only): `prompt`, optional `images` (1 to 16, enhanced as an edit), `size`, `aspect_ratio`, `area`. It answers at once with MiniMax's `revised_prompt` and usage.

### Music

`POST /v1/music_generation` takes MiniMax's body: `model`, `prompt`, `lyrics`, `output_format` (`hex` default, or `url`), `audio_setting`, `lyrics_optimizer`, `is_instrumental`, and for `music-cover` one of `audio_url`, `audio_base64` or `cover_feature_id`. It answers with MiniMax's reply without its trace id (hex audio, or with `output_format` `url` MiniMax's own link, valid for 24 hours). MiniMax stopped offering its music APIs to new accounts on 2026-08-20; only accounts that used them before can call these models.

## Billing

The expressions below use MiniMax's China site list prices as plain CNY numbers, for sites that sell 1 USD of quota for 1 CNY. If your site bills in real USD, divide each expression by your rate (for example `/ 7`). Multiply by your margin as needed. Check MiniMax's current prices first.

Text, speech and transcription are billed by new-api as ordinary requests; their expressions give the price per million units:

| Model | Expression | Units |
| --- | --- | --- |
| `MiniMax-M3.1-Flash` | `tier("base", p * 1 + c * 4 + cr * 0.1)` | tokens |
| `MiniMax-M3` | `tier("base", p * 2.1 + c * 8.4 + cr * 0.42)` | tokens (MiniMax doubles the price above 512K input tokens) |
| `speech-2.8-hd`, `speech-2.6-hd`, `speech-02-hd` | `tier("base", p * 700)` | characters of `input` |
| `speech-2.8-turbo`, `speech-2.6-turbo`, `speech-02-turbo` | `tier("base", p * 400)` | characters of `input` |
| `asr-1.0` | `tier("base", p * 694.44)` | seconds of audio, rounded up |

MiniMax lists speech at CNY 3.5 (hd) and 2.0 (turbo) per 10,000 characters and counts a Chinese character as two; new-api counts every character once, so `p * 700` and `p * 400` cover Chinese text, and half of that matches text without Chinese characters. Transcription is CNY 2.5 per hour; the plugin reports the billed seconds as the request's tokens. For the other text models use MiniMax's price list.

Video, Context-IR, regeneration, images and music are billed as tasks from these usage facts. The submission reserves the requested amount and settles on the usage MiniMax reports. Use the expression billing mode:

| Model | Expression (CNY list price numbers) |
| --- | --- |
| `MiniMax-H3` | `u("resolution") == "2K" ? tier("2K", u("seconds") * 0.8 + u("input_video_seconds") * 0.8 + max(u("input_images") - 5, 0) * 0.2) : tier("768P", u("seconds") * 0.5 + u("input_video_seconds") * 0.5 + max(u("input_images") - 5, 0) * 0.2)` |
| `MiniMax-H3-Highspeed` | `u("resolution") == "768P" ? tier("768P", u("seconds") * 0.4 + u("input_video_seconds") * 0.4 + max(u("input_images") - 5, 0) * 0.2) : tier("480P", u("seconds") * 0.26 + u("input_video_seconds") * 0.26 + max(u("input_images") - 5, 0) * 0.2)` |
| `MiniMax-H3-Lite` | `u("resolution") == "768P" ? tier("768P", u("seconds") * 0.26 + u("input_video_seconds") * 0.26 + max(u("input_images") - 5, 0) * 0.13) : tier("480P", u("seconds") * 0.16 + u("input_video_seconds") * 0.16 + max(u("input_images") - 5, 0) * 0.13)` |
| `MiniMax-H3-Max` | `u("resolution") == "768P" ? tier("768P", u("seconds") * 0.5 + u("input_video_seconds") * 0.97 + max(u("input_images") - 2, 0) * 0.5) : tier("480P", u("seconds") * 0.33 + u("input_video_seconds") * 0.37 + max(u("input_images") - 2, 0) * 0.5)` |
| `MiniMax-H3-Context-IR` | `tier("base", u("context_ir_input_tokens") * 5.8 / 1000000 + u("context_ir_output_tokens") * 23 / 1000000)` |
| `MiniMax-H3-Regeneration` | `tier("base", u("seconds") * 0.3 + u("input_video_seconds") * 0.3 + max(u("input_images") - 5, 0) * 0.15)` |
| `MiniMax-H3-Image` | `tier("base", u("image_input_text_tokens") * 15 / 1000000 + u("image_input_image_tokens") * 10 / 1000000 + u("image_output_tokens") * 25 / 1000000)` |
| `MiniMax-H3-Image-Highspeed` | `tier("base", u("image_input_text_tokens") * 15 / 1000000 + u("image_input_image_tokens") * 20 / 1000000 + u("image_output_tokens") * 50 / 1000000)` |
| `music-3.0`, `music-2.6`, `music-cover` | `tier("base", u("music_tracks") * 1)` |

- Video: `seconds` and `resolution` of the output, `input_images` (MiniMax charges only the images beyond the first 5, the first 2 on `MiniMax-H3-Max`, hence `max(... - 5, 0)`; the gateway cannot turn `max(...)` into a price table, so model pages show these video expressions as raw expressions while billing them exactly), `input_video_seconds` (held at 15 seconds until MiniMax reports the length). A request without a duration counts 5 seconds, or 15 on MiniMax's own path; without a resolution, `768P`, or the model's dearest on MiniMax's own path.
- Context-IR: `context_ir_input_tokens` and `context_ir_output_tokens`, held at 16,384 plus 16,384 per media item and 16,384 output tokens until MiniMax reports them (a short text prompt used about 5,700 and 3,400).
- Regeneration: the 2K output `seconds` plus the source task's input images and input video, which MiniMax bills again; held at the source task's figures, or 15 seconds when they are unknown.
- Images: input text, reference image and output tokens, counted per delivered image, or `image_count` for a per-image price. The request holds an estimate (one output token per 1024 pixels and at least 4096 an image; `auto` sizes count their `area`, 4K by default). Prompt enhancement is billed on `MiniMax-H3-Image` as input text tokens only, which the expression above prices; with a per-image price it costs nothing.
- Music: `music_tracks` is 1 per delivered song.
- Cancel and delete requests carry zero facts, so these expressions charge nothing for them; a cancelled queued task is refunded.

## Example

```bash
curl https://your-gateway.example/v1/chat/completions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "MiniMax-M3.1-Flash", "messages": [{"role": "user", "content": "Hello"}]}'
```

```bash
curl https://your-gateway.example/v1/audio/speech \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "speech-2.8-turbo", "input": "Hello from MiniMax.", "voice": "English_Graceful_Lady"}' \
  -o speech.mp3
```

```bash
curl https://your-gateway.example/v1/videos \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "MiniMax-H3", "prompt": "A paper boat on a calm pond", "seconds": 4, "size": "768P"}'
```

Poll `GET /v1/videos/TASK_ID` until `status` is `completed`, then download `GET /v1/videos/TASK_ID/content`. To cancel a queued task:

```bash
curl -X DELETE https://your-gateway.example/v2/video_generation/TASK_ID \
  -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" -d '{}'
```

## Through another New API gateway

When one gateway (outer) forwards to another (middle) that holds the MiniMax channel, install this plugin on both and give the outer gateway a **New API** channel (type 60) with the middle gateway's address as Base URL, one of its tokens as key, and this plugin picked under upstream task plugins. The outer plugin then sends video, Context-IR, regeneration, cancel, image and music requests to the middle gateway's `/byaiden_minimax/...` routes and downloads videos from its `/v1/tasks/{id}/artifacts/video/content`. The middle gateway's replies keep MiniMax's usage, so both gateways settle on the same facts: price the outer gateway with the expressions above at your own margin. Text passes through the New API channel unchanged.

new-api's New API channel type does not carry speech or transcription requests ("endpoint not supported"). For those, add an ordinary OpenAI channel on the outer gateway with the middle gateway's address and token and the speech and transcription models.

## Limits

- `MiniMax-H3` makes 4 to 15 seconds at `768P` or `2K`; `MiniMax-H3-Highspeed` and `MiniMax-H3-Lite` 4 to 15 seconds and `MiniMax-H3-Max` 5 to 15 seconds, at `480P` or `768P`. Every H3 video model takes up to 9 images, 3 reference videos and 3 reference audio clips, and a request uses either frame images or reference media. `MiniMax-H3-Lite` has no adaptive ratio with reference media, so such requests default to `16:9`, as text-only requests do. `prompt` and `ratio` must be strings.
- An image request makes 1 to 10 images. A `WIDTHxHEIGHT` size covers 655,360 to 20,000,000 pixels with a ratio from 1:3 to 3:1 and cannot be combined with `aspect_ratio` or `area`. Image edits always use prompt enhancement, so `disable_prompt_enhanced` works on text to image only, with a fixed size or `aspect_ratio`. Masks, transparent backgrounds, seeds and streamed image replies are not supported.
- Not served: WebSocket speech (no WebSocket relay for it), asynchronous long-text speech (its result is an archive in MiniMax's file storage), voice cloning, voice design and voice management (account management rather than generation), file management, lyrics generation and cover preprocessing, video agent templates, and MiniMax's task list (it would show every task of the MiniMax account). Use MiniMax directly for them.
- `callback_url` is refused on every endpoint; poll the task instead.
- Image and music generation are not idempotent: a client retry generates and bills again. A large 4K image batch or a song can take minutes; the gateway waits up to its protocol timeout (600 seconds by default) for images.
- MiniMax keeps video tasks for 7 days and its links expire; download results promptly.
- Requests MiniMax rejects, and tasks that fail, are not billed.
