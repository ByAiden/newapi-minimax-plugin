---
translations:
  zh-CN: README.zh-CN.md
---
# MiniMax

**English** | [简体中文](README.zh-CN.md)

Generates videos with `MiniMax-H3`, `MiniMax-H3-Highspeed`, `MiniMax-H3-Lite` and `MiniMax-H3-Max` from text, frame images, or reference images, videos and audio, and generates and edits images with `MiniMax-H3-Image` and `MiniMax-H3-Image-Highspeed`.

This is version 1.5.0 of the `hailuo` plugin. It drops the Hailuo 2.3, 2.3 Fast, 02 and 01 series models; see the changelog before upgrading.

## Channel setup

- Choose the MiniMax (35) channel type.
- The key is an API key from the MiniMax open platform. The H3 video models and the image models are billed pay-as-you-go by MiniMax.
- Set the API address to the platform your key belongs to: `https://api.minimax.io` for the global platform, `https://api.minimax.cn` for the China platform (`https://api.minimaxi.com` reaches the same China platform and connects more reliably from gateways outside mainland China). Leave `/v1` off the end.
- To use another New API gateway as the upstream, choose New API (60) and enter that gateway's address and one of its tokens. That gateway needs this plugin version too.

## Models and endpoints

| Endpoint | What it does | Models |
| --- | --- | --- |
| `POST /v1/videos` | Creates a video from a prompt. For image to video, send `input_reference`, or upload it as a file in a multipart request. | H3 video models |
| `POST /v1/responses` | Creates a video through the Responses API, as a stream, a blocking call or a background call. A second image sets the last frame. | H3 video models |
| `POST /v2/video_generation` | Creates a video with MiniMax's own H3 body. | H3 video models |
| `GET /v2/query/video_generation/{task_id}` | Reads an H3 task. | H3 video models |

The H3 video models are `MiniMax-H3`, `MiniMax-H3-Highspeed`, `MiniMax-H3-Lite` and `MiniMax-H3-Max`. On `MiniMax-H3-Max`, `metadata.extra.prompt_expansion_mode` (`disabled`, `balanced` or `quality`) sets prompt expansion.
| `POST /v1/images/generations` | Text to image, OpenAI Images API: `prompt`, `n` (1 to 10), `size`, plus MiniMax's `aspect_ratio`, `area`, `output_format`, `output_compression` and `disable_prompt_enhanced`. | `MiniMax-H3-Image`, `MiniMax-H3-Image-Highspeed` |
| `POST /v1/images/edits` | Image editing with 1 to 16 reference images, as JSON (`image` URLs or `images[].image_url`) or as OpenAI SDK multipart uploads (`image` / `image[]`). | `MiniMax-H3-Image`, `MiniMax-H3-Image-Highspeed` |

The image endpoints wait for every image and answer with URLs, or with base64 data when the request sets `response_format: "b64_json"`. An image that fails or is withheld by MiniMax's content check is left out of the reply; the request fails only when no image is made. MiniMax's own image bodies and replies, failed images included, are served at `/hailuo/v1/images/generations` and `/hailuo/v1/images/edits`.

For videos, clients poll `GET /v1/videos/{task_id}` and download the file from `GET /v1/videos/{task_id}/content`. MiniMax's own video paths also work under `/hailuo`.

## Billing

Video and image models have separate price fields.

H3 video models, each with its own price:

- "Video generation unit price" is charged per second of video. A request without a duration counts 5 seconds, or 15 seconds on MiniMax's own path, and settles on the seconds MiniMax reports.
- "Output video resolution" gives each resolution its own price: `768P` and `2K` on `MiniMax-H3`, `480P` and `768P` on the other three. A request without a resolution counts `768P`, or the model's dearest on MiniMax's own path, and settles on the resolution of the finished video.
- "Input image unit price" counts every input image; MiniMax charges only the images beyond the first 5 (beyond the first 2 on `MiniMax-H3-Max`), so subtract them in the expression with `max(u("input_images") - 5, 0)`. "Input video unit price" is charged per second of input video, held at 15 seconds until MiniMax reports the actual length.

For example, `MiniMax-H3-Highspeed` at MiniMax's list price times a margin `M`:
`u("resolution") == "768P" ? tier("768P", (u("seconds") * 0.06 + u("input_video_seconds") * 0.06 + max(u("input_images") - 5, 0) * 0.03) * M) : tier("480P", (u("seconds") * 0.04 + u("input_video_seconds") * 0.04 + max(u("input_images") - 5, 0) * 0.03) * M)`

`MiniMax-H3-Image` and `MiniMax-H3-Image-Highspeed`, which MiniMax bills by tokens:

- "Image input text unit price", "Image reference input unit price" and "Image output unit price" are token prices. MiniMax counts the input tokens once for every image delivered, and prompt enhancement adds to the text tokens.
- "Image generation unit price" is charged per delivered image, for a per-image price instead of token prices.
- The request holds an estimate: the output tokens of the requested size (one token per 1024 pixels and at least 4096 an image; `auto` sizes count their `area`, 4K by default), and generous input estimates. It then settles on the usage MiniMax reports, so only delivered images are charged.

For example, to charge MiniMax's list price for `MiniMax-H3-Image` with a margin `M`, save a task expression such as `tier("base", (u("image_input_text_tokens") * 2.3 + u("image_input_image_tokens") * 1.5 + u("image_output_tokens") * 3.8) / 1000000 * M)`. Check MiniMax's current prices first; `MiniMax-H3-Image-Highspeed` costs more per image token.

## Example

```bash
curl https://your-gateway.example.com/v1/images/generations \
  -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{"model": "MiniMax-H3-Image", "prompt": "An orange cat on a sunlit windowsill, film texture", "aspect_ratio": "16:9", "area": "2K"}'
```

```bash
curl https://your-gateway.example.com/v1/videos \
  -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{"model": "MiniMax-H3", "prompt": "A fox trotting through fresh snow in a pine forest", "seconds": 6, "size": "768P"}'
```

## Limits

- `MiniMax-H3` makes 4 to 15 seconds at `768P` or `2K`. `MiniMax-H3-Highspeed` and `MiniMax-H3-Lite` make 4 to 15 seconds and `MiniMax-H3-Max` 5 to 15 seconds, at `480P` or `768P`.
- `MiniMax-H3-Lite` has no adaptive ratio with reference media, so such requests default to `16:9`; set `metadata.ratio` for another. Every H3 video model takes up to 9 images, 3 reference videos and 3 reference audio clips. A request uses either frame images or reference media.
- An image request makes 1 to 10 images. A `WIDTHxHEIGHT` size covers 655,360 to 20,000,000 pixels with a ratio from 1:3 to 3:1, and cannot be combined with `aspect_ratio` or `area`.
- Image edits always use prompt enhancement, so `disable_prompt_enhanced` works on text to image only, and there with a fixed size or `aspect_ratio`.
- Masks, transparent backgrounds, seeds and streamed image replies are not supported.
- MiniMax's image API is not idempotent: a retried request makes and charges new images. A large 4K batch can take minutes; the gateway waits up to its protocol timeout (600 seconds by default).
- Requests with `callback_url` are refused. Poll the task instead.

## Tests

```bash
npm test
```
