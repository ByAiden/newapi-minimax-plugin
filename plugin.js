// MiniMax-H3 family video generation (H3, H3-Highspeed, H3-Lite, H3-Max) on
// MiniMax's /v2 video API, and MiniMax-H3-Image
// text-to-image and image editing on its synchronous OpenAI-style image API.

const VIDEO_SECONDS_FIELD = {
  type: "number",
  unit: "second",
  description: { en: "Video generation unit price", zh: "视频生成单价" },
};

const RESOLUTION_DESCRIPTION = { en: "Output video resolution", zh: "输出视频分辨率" };

// MiniMax-H3 renders 768P or 2K.
const H3_USAGE_SCHEMA = {
  seconds: VIDEO_SECONDS_FIELD,
  resolution: {
    enum: ["768P", "2K"],
    description: RESOLUTION_DESCRIPTION,
  },
  // Input image count (estimated at submit, actual on completion).
  input_images: {
    type: "number",
    unit: "count",
    description: { en: "Input image unit price", zh: "输入图片单价" },
  },
  // Input video duration in seconds (reserved at the request maximum, actual on completion).
  input_video_seconds: {
    type: "number",
    unit: "second",
    description: { en: "Input video unit price", zh: "输入视频单价" },
  },
};

// H3-Highspeed, H3-Lite and H3-Max render 480P or 768P; the other fields are
// MiniMax-H3's.
const H3_FAST_USAGE_SCHEMA = Object.assign({}, H3_USAGE_SCHEMA, {
  resolution: {
    enum: ["480P", "768P"],
    description: RESOLUTION_DESCRIPTION,
  },
});

// MiniMax bills an image request by tokens: input text (prompt enhancement
// included), input reference images and output images, each counted for every
// image delivered. image_count serves per-image prices instead.
const IMAGE_USAGE_SCHEMA = {
  image_input_text_tokens: {
    type: "number",
    unit: "token",
    description: { en: "Image input text unit price", zh: "图片输入文本单价" },
  },
  image_input_image_tokens: {
    type: "number",
    unit: "token",
    description: { en: "Image reference input unit price", zh: "图片参考图输入单价" },
  },
  image_output_tokens: {
    type: "number",
    unit: "token",
    description: { en: "Image output unit price", zh: "图片输出单价" },
  },
  image_count: {
    type: "number",
    unit: "count",
    description: { en: "Image generation unit price", zh: "图片生成单价" },
  },
};

const H3_MODEL = "MiniMax-H3";
// What each H3 video model renders, the dearest resolution last
// (platform.minimax.io/docs/api-reference/video-generation-v2-create).
// H3-Lite has no adaptive ratio for reference media; only H3-Max takes extra.
const VIDEO_PROFILES = {
  "MiniMax-H3": { resolutions: ["768P", "2K"], minDuration: 4 },
  "MiniMax-H3-Highspeed": { resolutions: ["480P", "768P"], minDuration: 4 },
  "MiniMax-H3-Lite": { resolutions: ["480P", "768P"], minDuration: 4, fixedReferenceRatio: true },
  "MiniMax-H3-Max": { resolutions: ["480P", "768P"], minDuration: 5, extra: true },
};
const VIDEO_MODELS = Object.keys(VIDEO_PROFILES);
const FAST_VIDEO_MODELS = VIDEO_MODELS.filter(function (model) {
  return model !== H3_MODEL;
});
// A mapped upstream name the plugin does not list may render anything the
// family renders.
const ANY_VIDEO_PROFILE = { resolutions: ["480P", "768P", "2K"], minDuration: 4 };
const IMAGE_MODELS = ["MiniMax-H3-Image", "MiniMax-H3-Image-Highspeed"];

// The vendor fields the OpenAI-style video requests carry in metadata; the
// MiniMax body has them at the top level. aigc_watermark is a field of
// MiniMax's China API (platform.minimaxi.com).
const H3_METADATA_FIELDS = ["aigc_watermark"];

// The /v2 and image error types by HTTP status.
const ERROR_TYPES = { 401: "authorized_error", 402: "insufficient_balance_error", 403: "authorized_error", 422: "unprocessable_entity_error", 429: "rate_limit_error" };

const H3_EXAMPLE_FACTS = { seconds: 5, resolution: "768P", input_images: 0, input_video_seconds: 0 };
const IMAGE_EXAMPLE_FACTS = { image_input_text_tokens: 0, image_input_image_tokens: 0, image_output_tokens: 0, image_count: 0 };

function h3Example(label, facts) {
  return { label: label, facts: Object.assign({}, H3_EXAMPLE_FACTS, facts) };
}

function imageExample(label, facts) {
  return { label: label, facts: Object.assign({}, IMAGE_EXAMPLE_FACTS, facts) };
}

const H3_EXAMPLES = [
  h3Example("H3 768P 5s", {}),
  h3Example("H3 2K 5s", { resolution: "2K" }),
  h3Example("H3 2K 5s · 9 images", { resolution: "2K", input_images: 9 }),
  h3Example("H3 2K 5s · input video", { resolution: "2K", input_video_seconds: 15 }),
];

const H3_FAST_EXAMPLES = [
  h3Example("480P 5s", { resolution: "480P" }),
  h3Example("768P 5s", {}),
  h3Example("768P 10s · 9 images", { seconds: 10, input_images: 9 }),
  h3Example("768P 5s · input video", { input_video_seconds: 15 }),
];

// Token counts follow MiniMax's own examples: an output image costs one token
// per 1024 pixels, so 2K 1:1 is 4096 tokens and 4K 1:1 is 16384.
const IMAGE_EXAMPLES = [
  imageExample("text to image 2K", { image_input_text_tokens: 3200, image_output_tokens: 4096, image_count: 1 }),
  imageExample("text to image 4K", { image_input_text_tokens: 3200, image_output_tokens: 16384, image_count: 1 }),
  imageExample("edit 2K · 2 refs", { image_input_text_tokens: 12100, image_input_image_tokens: 11800, image_output_tokens: 4096, image_count: 1 }),
];

// The marketplace reads meta without running the plugin, so it is a plain
// literal. MiniMax request and response bodies answer at MiniMax's own paths
// and under /<key>; the image paths are the host's OpenAI image endpoints, so
// their MiniMax bodies answer under /<key> only, which a downstream New API
// gateway calls. The image API answers synchronously and has no task to re-query.
export const meta = {
  "apiVersion": 1,
  "key": "byaiden_minimax",
  "name": "MiniMax H3",
  "icon": "Minimax.Color",
  "description": {
    "en": "MiniMax-H3, H3-Highspeed, H3-Lite and H3-Max video generation (text, frames, and multimodal reference) and MiniMax-H3-Image generation and editing",
    "zh": "MiniMax-H3、H3-Highspeed、H3-Lite、H3-Max 视频生成（文生视频、首尾帧、多模态参考）与 MiniMax-H3-Image 图片生成和编辑"
  },
  "version": "1.2.0",
  "author": {
    "name": "ByAiden",
    "url": "https://github.com/ByAiden"
  },
  "website": "https://platform.minimax.io/docs/guides/image-generation",
  "baseUrl": "https://api.minimaxi.com",
  "models": [
    "MiniMax-H3",
    "MiniMax-H3-Highspeed",
    "MiniMax-H3-Lite",
    "MiniMax-H3-Max",
    "MiniMax-H3-Image",
    "MiniMax-H3-Image-Highspeed"
  ],
  "fetchMode": "per_task",
  "upstreams": [
    "vendor",
    "new_api"
  ],
  "usageSchema": {
    "seconds": {
      "type": "number",
      "unit": "second",
      "description": {
        "en": "Video generation unit price",
        "zh": "视频生成单价"
      }
    },
    "resolution": {
      "enum": [
        "480P",
        "768P",
        "2K"
      ],
      "description": {
        "en": "Output video resolution",
        "zh": "输出视频分辨率"
      }
    },
    "input_images": {
      "type": "number",
      "unit": "count",
      "description": {
        "en": "Input image unit price",
        "zh": "输入图片单价"
      }
    },
    "input_video_seconds": {
      "type": "number",
      "unit": "second",
      "description": {
        "en": "Input video unit price",
        "zh": "输入视频单价"
      }
    },
    "image_input_text_tokens": {
      "type": "number",
      "unit": "token",
      "description": {
        "en": "Image input text unit price",
        "zh": "图片输入文本单价"
      }
    },
    "image_input_image_tokens": {
      "type": "number",
      "unit": "token",
      "description": {
        "en": "Image reference input unit price",
        "zh": "图片参考图输入单价"
      }
    },
    "image_output_tokens": {
      "type": "number",
      "unit": "token",
      "description": {
        "en": "Image output unit price",
        "zh": "图片输出单价"
      }
    },
    "image_count": {
      "type": "number",
      "unit": "count",
      "description": {
        "en": "Image generation unit price",
        "zh": "图片生成单价"
      }
    }
  },
  "usageExamples": [
    {
      "label": "H3 768P 5s",
      "facts": {
        "seconds": 5,
        "resolution": "768P",
        "input_images": 0,
        "input_video_seconds": 0,
        "image_input_text_tokens": 0,
        "image_input_image_tokens": 0,
        "image_output_tokens": 0,
        "image_count": 0
      }
    },
    {
      "label": "text to image 4K",
      "facts": {
        "seconds": 0,
        "resolution": "768P",
        "input_images": 0,
        "input_video_seconds": 0,
        "image_input_text_tokens": 3200,
        "image_input_image_tokens": 0,
        "image_output_tokens": 16384,
        "image_count": 1
      }
    }
  ],
  "usageProfiles": [
    {
      "models": [
        "MiniMax-H3"
      ],
      "schema": {
        "seconds": {
          "type": "number",
          "unit": "second",
          "description": {
            "en": "Video generation unit price",
            "zh": "视频生成单价"
          }
        },
        "resolution": {
          "enum": [
            "768P",
            "2K"
          ],
          "description": {
            "en": "Output video resolution",
            "zh": "输出视频分辨率"
          }
        },
        "input_images": {
          "type": "number",
          "unit": "count",
          "description": {
            "en": "Input image unit price",
            "zh": "输入图片单价"
          }
        },
        "input_video_seconds": {
          "type": "number",
          "unit": "second",
          "description": {
            "en": "Input video unit price",
            "zh": "输入视频单价"
          }
        }
      },
      "examples": [
        {
          "label": "H3 768P 5s",
          "facts": {
            "seconds": 5,
            "resolution": "768P",
            "input_images": 0,
            "input_video_seconds": 0
          }
        },
        {
          "label": "H3 2K 5s",
          "facts": {
            "seconds": 5,
            "resolution": "2K",
            "input_images": 0,
            "input_video_seconds": 0
          }
        },
        {
          "label": "H3 2K 5s · 9 images",
          "facts": {
            "seconds": 5,
            "resolution": "2K",
            "input_images": 9,
            "input_video_seconds": 0
          }
        },
        {
          "label": "H3 2K 5s · input video",
          "facts": {
            "seconds": 5,
            "resolution": "2K",
            "input_images": 0,
            "input_video_seconds": 15
          }
        }
      ]
    },
    {
      "models": [
        "MiniMax-H3-Highspeed",
        "MiniMax-H3-Lite",
        "MiniMax-H3-Max"
      ],
      "schema": {
        "seconds": {
          "type": "number",
          "unit": "second",
          "description": {
            "en": "Video generation unit price",
            "zh": "视频生成单价"
          }
        },
        "resolution": {
          "enum": [
            "480P",
            "768P"
          ],
          "description": {
            "en": "Output video resolution",
            "zh": "输出视频分辨率"
          }
        },
        "input_images": {
          "type": "number",
          "unit": "count",
          "description": {
            "en": "Input image unit price",
            "zh": "输入图片单价"
          }
        },
        "input_video_seconds": {
          "type": "number",
          "unit": "second",
          "description": {
            "en": "Input video unit price",
            "zh": "输入视频单价"
          }
        }
      },
      "examples": [
        {
          "label": "480P 5s",
          "facts": {
            "seconds": 5,
            "resolution": "480P",
            "input_images": 0,
            "input_video_seconds": 0
          }
        },
        {
          "label": "768P 5s",
          "facts": {
            "seconds": 5,
            "resolution": "768P",
            "input_images": 0,
            "input_video_seconds": 0
          }
        },
        {
          "label": "768P 10s · 9 images",
          "facts": {
            "seconds": 10,
            "resolution": "768P",
            "input_images": 9,
            "input_video_seconds": 0
          }
        },
        {
          "label": "768P 5s · input video",
          "facts": {
            "seconds": 5,
            "resolution": "768P",
            "input_images": 0,
            "input_video_seconds": 15
          }
        }
      ]
    },
    {
      "models": [
        "MiniMax-H3-Image",
        "MiniMax-H3-Image-Highspeed"
      ],
      "schema": {
        "image_input_text_tokens": {
          "type": "number",
          "unit": "token",
          "description": {
            "en": "Image input text unit price",
            "zh": "图片输入文本单价"
          }
        },
        "image_input_image_tokens": {
          "type": "number",
          "unit": "token",
          "description": {
            "en": "Image reference input unit price",
            "zh": "图片参考图输入单价"
          }
        },
        "image_output_tokens": {
          "type": "number",
          "unit": "token",
          "description": {
            "en": "Image output unit price",
            "zh": "图片输出单价"
          }
        },
        "image_count": {
          "type": "number",
          "unit": "count",
          "description": {
            "en": "Image generation unit price",
            "zh": "图片生成单价"
          }
        }
      },
      "examples": [
        {
          "label": "text to image 2K",
          "facts": {
            "image_input_text_tokens": 3200,
            "image_input_image_tokens": 0,
            "image_output_tokens": 4096,
            "image_count": 1
          }
        },
        {
          "label": "text to image 4K",
          "facts": {
            "image_input_text_tokens": 3200,
            "image_input_image_tokens": 0,
            "image_output_tokens": 16384,
            "image_count": 1
          }
        },
        {
          "label": "edit 2K · 2 refs",
          "facts": {
            "image_input_text_tokens": 12100,
            "image_input_image_tokens": 11800,
            "image_output_tokens": 4096,
            "image_count": 1
          }
        }
      ]
    }
  ],
  "routes": [
    {
      "method": "POST",
      "path": "/v2/video_generation",
      "type": "submit",
      "decode": "createH3Task",
      "render": "taskCreated",
      "models": [
        "MiniMax-H3",
        "MiniMax-H3-Highspeed",
        "MiniMax-H3-Lite",
        "MiniMax-H3-Max"
      ]
    },
    {
      "method": "GET",
      "path": "/v2/query/video_generation/:task_id",
      "type": "query",
      "render": "h3TaskStatus"
    },
    {
      "method": "POST",
      "path": "/v1/images/generations",
      "type": "submit",
      "decode": "createImage",
      "render": "imageCreated",
      "models": [
        "MiniMax-H3-Image",
        "MiniMax-H3-Image-Highspeed"
      ],
      "retainResult": false
    },
    {
      "method": "POST",
      "path": "/v1/images/edits",
      "type": "submit",
      "decode": "editImage",
      "render": "imageCreated",
      "models": [
        "MiniMax-H3-Image",
        "MiniMax-H3-Image-Highspeed"
      ],
      "retainResult": false
    }
  ],
  "protocols": [
    {
      "name": "openai_responses",
      "supports": [
        "stream",
        "sync",
        "background"
      ],
      "models": [
        "MiniMax-H3",
        "MiniMax-H3-Highspeed",
        "MiniMax-H3-Lite",
        "MiniMax-H3-Max"
      ]
    },
    {
      "name": "openai_video",
      "models": [
        "MiniMax-H3",
        "MiniMax-H3-Highspeed",
        "MiniMax-H3-Lite",
        "MiniMax-H3-Max"
      ]
    },
    {
      "name": "openai_image",
      "models": [
        "MiniMax-H3-Image",
        "MiniMax-H3-Image-Highspeed"
      ]
    }
  ]
};

function trimmed(value) {
  return String(value === undefined || value === null ? "" : value).trim();
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function present(value) {
  return value !== undefined && value !== null;
}

// The members of source that hold a value.
function definedFields(source, keys) {
  const fields = {};
  for (const key of keys) {
    if (present(source[key])) fields[key] = source[key];
  }
  return fields;
}

// On a New API channel the same plugin answers on another gateway, which
// serves the MiniMax wire format under the plugin's key.
function viaGateway(ctx) {
  return Boolean(ctx.upstream && ctx.upstream.kind === "new_api");
}

function apiRoot(ctx) {
  return ctx.baseUrl + (viaGateway(ctx) ? "/" + meta.key : "");
}

function authHeaders(ctx) {
  return { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + ctx.apiKey };
}

function isImageModel(model) {
  return IMAGE_MODELS.includes(trimmed(model));
}

// An image task by either model identity: the channel may map a declared
// image model to an upstream name the plugin does not list.
function imageTask(ctx) {
  if (isImageModel(ctx.upstreamModel) || isImageModel(ctx.model)) return true;
  return Boolean(plainObject(ctx.requestBody) && ctx.requestBody.imageBody);
}

// ---------------------------------------------------------------------------
// MiniMax-H3 video

const H3_MAX_DURATION = 15;
const H3_DEFAULT_DURATION = 5;
const H3_MAX_FRAME_IMAGES = 2;
const H3_MAX_REFERENCE_IMAGES = 9;
const H3_MAX_REFERENCE_VIDEOS = 3;
const H3_MAX_REFERENCE_AUDIOS = 3;
const H3_MAX_INPUT_VIDEO_SECONDS = 15;

// The rules of the first listed model among the names, the channel's
// upstream name first; a name the plugin does not list takes the family's.
function videoProfile() {
  for (let i = 0; i < arguments.length; i++) {
    const name = trimmed(arguments[i]);
    if (VIDEO_PROFILES[name]) return Object.assign({ name: name }, VIDEO_PROFILES[name]);
  }
  return Object.assign({ name: trimmed(arguments[0]) || H3_MODEL }, ANY_VIDEO_PROFILE);
}

// The H3 models render up to 15 seconds from 4 (H3-Max from 5); the host
// protocols default to 5.
function h3Duration(raw, profile) {
  if (raw === undefined || raw === null || raw === "") return H3_DEFAULT_DURATION;
  const seconds = Number(raw);
  if (!Number.isInteger(seconds) || seconds < profile.minDuration || seconds > H3_MAX_DURATION) {
    throw new Error(profile.name + " duration must be an integer between " + profile.minDuration + " and " + H3_MAX_DURATION + " seconds");
  }
  return seconds;
}

// Every H3 model renders 768P, the default.
function h3Resolution(req, profile) {
  const metadata = req.metadata || {};
  const raw = trimmed(metadata.resolution) || trimmed(req.resolution) || trimmed(req.size);
  if (!raw) return "768P";
  const value = raw.toUpperCase();
  const resolution = value.includes("2K") ? "2K" : value.includes("768") ? "768P" : value.includes("480") ? "480P" : "";
  if (!profile.resolutions.includes(resolution)) throw new Error(profile.name + " resolution must be " + profile.resolutions.join(" or "));
  return resolution;
}

// H3-Max's extra options; MiniMax rejects any other field in extra.
function h3Extra(metadata, profile) {
  if (!present(metadata.extra)) return undefined;
  if (!profile.extra) throw new Error("extra is supported by MiniMax-H3-Max only");
  const extra = plainObject(metadata.extra);
  if (!extra) throw new Error("extra must be an object");
  for (const key of Object.keys(extra)) {
    if (key !== "prompt_expansion_mode") throw new Error("extra." + key + " is not supported");
  }
  if (present(extra.prompt_expansion_mode) && !["disabled", "balanced", "quality"].includes(extra.prompt_expansion_mode))
    throw new Error("extra.prompt_expansion_mode must be disabled, balanced or quality");
  return extra;
}

function h3MediaItem(type, url, role) {
  const item = { type: type, role: role };
  item[type] = { url: url };
  return item;
}

// Accepts a single value or an array; file placeholders stay objects and are
// resolved by the host after the body is built.
function h3MediaList(source, key) {
  const raw = source[key];
  if (!present(raw)) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  return values.filter(function (value) {
    return value && typeof value === "object" ? true : Boolean(trimmed(value));
  });
}

function h3FrameImages(req) {
  const metadata = req.metadata || {};
  const images = h3MediaList(req, "images");
  if (images.length > H3_MAX_FRAME_IMAGES) throw new Error(H3_MODEL + " accepts at most " + H3_MAX_FRAME_IMAGES + " frame images");
  const frames = [];
  if (metadata.first_frame_image) frames.push(h3MediaItem("image_url", metadata.first_frame_image, "first_frame"));
  if (metadata.last_frame_image) frames.push(h3MediaItem("image_url", metadata.last_frame_image, "last_frame"));
  if (frames.length) return frames;
  return images.map(function (url, index) {
    return h3MediaItem("image_url", url, index === 0 ? "first_frame" : "last_frame");
  });
}

function validateH3Content(items) {
  let hasText = false;
  let hasFrame = false;
  let hasReference = false;
  let firstFrames = 0;
  let lastFrames = 0;
  let referenceImages = 0;
  let referenceVideos = 0;
  let referenceAudios = 0;
  let inputImages = 0;
  for (const item of items) {
    if (!plainObject(item)) continue;
    const role = trimmed(item.role);
    if (item.type === "text" && trimmed(item.text)) {
      hasText = true;
      continue;
    }
    if (item.type === "image_url") {
      inputImages += 1;
      if (!role || role === "first_frame") {
        firstFrames += 1;
        hasFrame = true;
      } else if (role === "last_frame") {
        lastFrames += 1;
        hasFrame = true;
      } else if (role === "middle_frame") {
        hasFrame = true;
      } else if (role === "reference_image") {
        referenceImages += 1;
        hasReference = true;
      }
      continue;
    }
    if (item.type === "video_url") {
      referenceVideos += 1;
      hasReference = true;
      continue;
    }
    if (item.type === "audio_url") {
      referenceAudios += 1;
      hasReference = true;
    }
  }
  if (!hasText) throw new Error(H3_MODEL + " requires a non-empty text item");
  if (firstFrames > 1) throw new Error(H3_MODEL + " accepts at most one first_frame image");
  if (lastFrames > 1) throw new Error(H3_MODEL + " accepts at most one last_frame image");
  if (referenceImages > H3_MAX_REFERENCE_IMAGES) throw new Error(H3_MODEL + " accepts at most " + H3_MAX_REFERENCE_IMAGES + " reference images");
  if (inputImages > H3_MAX_REFERENCE_IMAGES) throw new Error(H3_MODEL + " accepts at most " + H3_MAX_REFERENCE_IMAGES + " input images");
  if (referenceVideos > H3_MAX_REFERENCE_VIDEOS) throw new Error(H3_MODEL + " accepts at most " + H3_MAX_REFERENCE_VIDEOS + " reference videos");
  if (referenceAudios > H3_MAX_REFERENCE_AUDIOS) throw new Error(H3_MODEL + " accepts at most " + H3_MAX_REFERENCE_AUDIOS + " reference audios");
  if (hasFrame && hasReference) throw new Error(H3_MODEL + " cannot mix frame images with reference media");
  return items;
}

// metadata.content is the full multimodal passthrough; otherwise the content
// array is assembled from prompt, frame images, and reference media.
function h3Content(req) {
  const metadata = req.metadata || {};
  const prompt = trimmed(req.prompt);
  if (present(metadata.content)) {
    if (!Array.isArray(metadata.content)) throw new Error("metadata.content must be an array");
    const items = metadata.content;
    const hasText = items.some(function (item) {
      return item && item.type === "text" && trimmed(item.text);
    });
    if (hasText) return validateH3Content(items);
    if (!prompt) throw new Error(H3_MODEL + " metadata.content requires a text item or a prompt");
    return validateH3Content([{ type: "text", text: prompt }].concat(items));
  }
  const content = prompt ? [{ type: "text", text: prompt }] : [];
  for (const frame of h3FrameImages(req)) content.push(frame);
  const videos = h3MediaList(metadata, "reference_video");
  if (videos.length > H3_MAX_REFERENCE_VIDEOS) throw new Error(H3_MODEL + " accepts at most " + H3_MAX_REFERENCE_VIDEOS + " reference videos");
  for (const video of videos) content.push(h3MediaItem("video_url", video, "reference_video"));
  const audios = h3MediaList(metadata, "reference_audio");
  if (audios.length > H3_MAX_REFERENCE_AUDIOS) throw new Error(H3_MODEL + " accepts at most " + H3_MAX_REFERENCE_AUDIOS + " reference audios");
  for (const audio of audios) content.push(h3MediaItem("audio_url", audio, "reference_audio"));
  if (!content.length) throw new Error(H3_MODEL + " requires a prompt or a media input");
  return validateH3Content(content);
}

function h3HasVisualContent(content) {
  return content.some(function (item) {
    return item && (item.type === "image_url" || item.type === "video_url");
  });
}

// Text alone is text-to-video, which needs a ratio other than adaptive; frames
// and reference media, audio alone included, default to adaptive
// (platform.minimax.io/docs/api-reference/video-generation-v2-create).
function h3TextOnly(content) {
  return !content.some(function (item) {
    return item && (item.type === "image_url" || item.type === "video_url" || item.type === "audio_url");
  });
}

function h3HasReference(content) {
  return content.some(function (item) {
    return item && /^reference_/.test(trimmed(item.role));
  });
}

// The host protocols default text-to-video to 16:9, and reference media on
// H3-Lite, which has no adaptive ratio for them; MiniMax checks a ratio from
// metadata.
function h3Ratio(req, content, profile) {
  const ratio = trimmed((req.metadata || {}).ratio);
  if (ratio) return ratio;
  if (h3TextOnly(content) || (profile.fixedReferenceRatio && h3HasReference(content))) return "16:9";
  return "adaptive";
}

// The content, duration and resolution MiniMax-H3 renders: those the host
// protocols build from prompt, images, size and metadata, with defaults, or a
// native body's own. MiniMax checks a native body; a duration or resolution
// it leaves out or the plugin cannot read is reserved at the dearest.
function h3Request(req, profile) {
  const body = req.vendorBody;
  if (!body) return { content: h3Content(req), duration: h3Duration(req.duration, profile), resolution: h3Resolution(req, profile) };
  const missing = body.duration === undefined || body.duration === null || body.duration === "";
  const resolution = trimmed(body.resolution).toUpperCase();
  return {
    content: validateH3Content(body.content),
    duration: missing ? H3_MAX_DURATION : h3Duration(body.duration, profile),
    resolution: profile.resolutions.includes(resolution) ? resolution : profile.resolutions[profile.resolutions.length - 1],
  };
}

function h3QueryTask(body) {
  const task = plainObject(body) ? body.task : null;
  return plainObject(task);
}

function h3APIError(body) {
  const error = plainObject(body) ? plainObject(body.error) : null;
  if (!error) return null;
  const message = trimmed(error.message);
  if (!message) return null;
  const statusCode = Number(error.http_code || error.code || 0);
  return { message: message, statusCode: Number.isInteger(statusCode) ? statusCode : 0 };
}

// ---------------------------------------------------------------------------
// MiniMax-H3-Image

const IMAGE_MAX_PROMPT_CHARS = 32000;
const IMAGE_MAX_COUNT = 10;
const IMAGE_MAX_REFERENCES = 16;
const IMAGE_MAX_REFERENCE_BYTES = 64 * 1024 * 1024;
const IMAGE_MIN_PIXELS = 655360;
const IMAGE_MAX_PIXELS = 20000000;
const IMAGE_AREA_PIXELS = { "1K": 1024 * 1024, "2K": 2048 * 2048, "4K": 4096 * 4096 };
const IMAGE_DEFAULT_AREA = "4K";
const IMAGE_OUTPUT_FORMATS = ["png", "jpeg", "jpg", "webp"];
// One output image token covers 1024 pixels (2720x1536 is 4080 tokens), with
// at least 4096 tokens an image: a live 1024x1024 image was billed 4096.
const IMAGE_PIXELS_PER_TOKEN = 1024;
const IMAGE_MIN_OUTPUT_TOKENS = 4096;
// MiniMax reports input tokens only after generation: the reservation holds
// these per delivered image and settles on the reported usage. Its examples
// show about 3,200 text tokens for a short text-to-image prompt and about
// 6,000 text and 5,900 image tokens per reference image on an edit.
const IMAGE_TEXT_TOKENS_GENERATE = 8192;
const IMAGE_TEXT_TOKENS_PER_REFERENCE = 6144;
const IMAGE_IMAGE_TOKENS_PER_REFERENCE = 6144;

// The body fields each operation sends. stream is refused: the gateway
// answers once every image is done.
const IMAGE_FIELDS = ["prompt", "n", "size", "aspect_ratio", "area", "output_format", "response_format", "output_compression"];
const IMAGE_GENERATE_FIELDS = IMAGE_FIELDS.concat(["disable_prompt_enhanced"]);
const IMAGE_DATA_URL = /^data:image\/[a-z0-9.+-]+;base64,/;

function codePoints(text) {
  return Array.from(text).length;
}

function integerField(body, key, minimum, maximum) {
  const value = body[key];
  if (!present(value)) return undefined;
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(key + " must be an integer between " + minimum + " and " + maximum);
  return value;
}

function stringField(body, key) {
  const value = body[key];
  if (!present(value)) return "";
  if (typeof value !== "string") throw new Error(key + " must be a string");
  return value.trim();
}

// X:Y with integers from 1 to 300 and a ratio from 1:3 to 3:1.
function validRatio(width, height) {
  return width * 3 >= height && height * 3 >= width;
}

function aspectRatio(value) {
  if (!value || value === "auto") return value;
  const match = /^(\d{1,3}):(\d{1,3})$/.exec(value);
  const x = match ? Number(match[1]) : 0;
  const y = match ? Number(match[2]) : 0;
  if (!match || x < 1 || x > 300 || y < 1 || y > 300 || !validRatio(x, y)) throw new Error("aspect_ratio must be auto or X:Y between 1:3 and 3:1");
  return value;
}

// The output pixels of one image: an explicit WIDTHxHEIGHT, or the area level
// (default 4K) that auto sizes target.
function imagePixels(body) {
  const size = stringField(body, "size");
  const ratio = aspectRatio(stringField(body, "aspect_ratio"));
  const area = stringField(body, "area").toUpperCase();
  if (area && !IMAGE_AREA_PIXELS[area]) throw new Error("area must be 1K, 2K or 4K");
  if (size && size !== "auto") {
    const match = /^(\d+)x(\d+)$/.exec(size);
    if (!match) throw new Error("size must be auto or WIDTHxHEIGHT");
    const width = Number(match[1]);
    const height = Number(match[2]);
    const pixels = width * height;
    if (pixels < IMAGE_MIN_PIXELS || pixels > IMAGE_MAX_PIXELS) throw new Error("size must cover " + IMAGE_MIN_PIXELS + " to " + IMAGE_MAX_PIXELS + " pixels");
    if (!validRatio(width, height)) throw new Error("size must have an aspect ratio between 1:3 and 3:1");
    if (present(body.aspect_ratio) || present(body.area)) throw new Error("aspect_ratio and area cannot be set with a WIDTHxHEIGHT size");
    return { pixels: pixels, fixedRatio: true };
  }
  return { pixels: IMAGE_AREA_PIXELS[area || IMAGE_DEFAULT_AREA], fixedRatio: Boolean(ratio && ratio !== "auto") };
}

// A reference image: an HTTP(S) URL, an mm_file:// upload, a
// data:image/<lowercase format>;base64 URL, or a host file placeholder.
function referenceImage(entry) {
  const item = plainObject(entry);
  if (item && typeof item.__fileRef === "string") return { image_url: item };
  const value = item ? item.image_url : entry;
  if (plainObject(value) && typeof value.__fileRef === "string") return { image_url: value };
  const url = typeof value === "string" ? value.trim() : "";
  if (!/^https?:\/\//i.test(url) && !/^mm_file:\/\/\S+$/.test(url) && !IMAGE_DATA_URL.test(url))
    throw new Error("each image must be an HTTP(S) URL, an mm_file:// file, or a data:image/<format>;base64 URL");
  return { image_url: url };
}

// Checks a MiniMax image body and derives the facts its reservation holds.
// MiniMax checks the fields itself; the gateway checks what it prices and
// what MiniMax would charge for and then reject.
function checkImageBody(operation, body) {
  const prompt = stringField(body, "prompt");
  if (!prompt) throw new Error("prompt is required");
  if (codePoints(prompt) > IMAGE_MAX_PROMPT_CHARS) throw new Error("prompt must be at most " + IMAGE_MAX_PROMPT_CHARS + " characters");
  if (present(body.stream) && body.stream !== false) throw new Error("stream is not supported; the gateway answers once every image is done");
  if (present(body.callback_url)) throw new Error("callback_url is not supported");
  const count = integerField(body, "n", 1, IMAGE_MAX_COUNT) || 1;
  integerField(body, "output_compression", 0, 100);
  const outputFormat = stringField(body, "output_format").toLowerCase();
  if (outputFormat && !IMAGE_OUTPUT_FORMATS.includes(outputFormat)) throw new Error("output_format must be png, jpeg, jpg or webp");
  const responseFormat = stringField(body, "response_format");
  if (responseFormat && responseFormat !== "url" && responseFormat !== "b64_json") throw new Error("response_format must be url or b64_json");
  const size = imagePixels(body);
  let references = 0;
  if (operation === "edit") {
    if (!Array.isArray(body.images) || !body.images.length) throw new Error("images must hold 1 to " + IMAGE_MAX_REFERENCES + " reference images");
    if (body.images.length > IMAGE_MAX_REFERENCES) throw new Error("images must hold 1 to " + IMAGE_MAX_REFERENCES + " reference images");
    body.images.forEach(referenceImage);
    references = body.images.length;
    if (present(body.disable_prompt_enhanced)) throw new Error("disable_prompt_enhanced is not supported on image edits");
  } else {
    if (present(body.images) || present(body.image)) throw new Error("reference images are only valid on /v1/images/edits");
    if (present(body.disable_prompt_enhanced) && typeof body.disable_prompt_enhanced !== "boolean") throw new Error("disable_prompt_enhanced must be true or false");
    if (body.disable_prompt_enhanced === true && !size.fixedRatio)
      throw new Error("disable_prompt_enhanced requires a WIDTHxHEIGHT size or an X:Y aspect_ratio");
  }
  const promptTokens = codePoints(prompt);
  const textTokens = operation === "edit" ? promptTokens + IMAGE_TEXT_TOKENS_PER_REFERENCE * references : promptTokens + IMAGE_TEXT_TOKENS_GENERATE;
  return {
    action: operation === "edit" ? "image_to_image" : "text_to_image",
    facts: {
      image_input_text_tokens: count * textTokens,
      image_input_image_tokens: count * references * IMAGE_IMAGE_TOKENS_PER_REFERENCE,
      image_output_tokens: count * Math.max(Math.ceil(size.pixels / IMAGE_PIXELS_PER_TOKEN), IMAGE_MIN_OUTPUT_TOKENS),
      image_count: count,
    },
  };
}

function imageIntent(model, operation, body) {
  const checked = checkImageBody(operation, body);
  return { kind: "submit", model: model, action: checked.action, requestBody: { model: model, imageOperation: operation, imageBody: body } };
}

function imageOperation(req) {
  return req.imageOperation === "edit" ? "edit" : "generate";
}

function imageEntries(body) {
  const data = plainObject(body) ? body.data : null;
  return Array.isArray(data) ? data.filter(plainObject) : [];
}

// The images MiniMax delivered; a failed image holds only error.
function deliveredImages(body) {
  return imageEntries(body).filter(function (item) {
    return trimmed(item.url) || trimmed(item.b64_json);
  });
}

function imageFailure(body) {
  const failed = imageEntries(body).find(function (item) {
    return plainObject(item.error);
  });
  const error = (failed && failed.error) || (plainObject(body) && plainObject(body.error)) || {};
  const message = trimmed(error.message) || "image generation returned no images";
  return trimmed(error.code) ? message + " (" + trimmed(error.code) + ")" : message;
}

function usageNumber(value) {
  if (!present(value) || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : undefined;
}

// The usage MiniMax bills, which counts delivered images only.
function imageUsage(body) {
  const usage = plainObject(plainObject(body) ? body.usage : null) || {};
  const input = plainObject(usage.input_tokens_details) || {};
  const output = plainObject(usage.output_tokens_details) || {};
  const facts = {};
  const values = {
    image_input_text_tokens: usageNumber(input.text_tokens),
    image_input_image_tokens: usageNumber(input.image_tokens),
    image_output_tokens: usageNumber(output.image_tokens),
    image_count: usageNumber(usage.generated_images),
  };
  for (const key of Object.keys(values)) {
    if (values[key] !== undefined) facts[key] = values[key];
  }
  if (facts.image_count === undefined || facts.image_count > IMAGE_MAX_COUNT) facts.image_count = Math.min(deliveredImages(body).length, IMAGE_MAX_COUNT);
  return facts;
}

// OpenAI image fields a client may send that MiniMax has no use for.
const IGNORED_OPENAI_IMAGE_FIELDS = ["user", "quality", "style", "moderation", "input_fidelity", "partial_images", "response_format"];

function formBoolean(value, key) {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(key + " must be true or false");
}

// An OpenAI image request in MiniMax's body. The host answers b64_json itself,
// so MiniMax always returns URLs.
function openAIImageBody(ctx) {
  const operation = ctx.operation === "edit" ? "edit" : "generate";
  let req = {};
  const uploads = [];
  if (ctx.body && ctx.body.kind === "json") {
    req = plainObject(ctx.body.value);
    if (!req) throw new Error("request body must be an object");
  } else if (ctx.body && ctx.body.kind === "multipart") {
    const fields = ctx.body.fields || {};
    for (const name of Object.keys(fields)) {
      if (/^image(\[\d*\])?$/.test(name)) {
        req.image = (req.image || []).concat(fields[name]);
        continue;
      }
      if (fields[name].length > 1) throw new Error(name + " must be provided once");
      req[name] = fields[name][0];
    }
    for (const key of ["n", "output_compression"]) {
      if (present(req[key])) req[key] = Number(req[key]);
    }
    if (present(req.disable_prompt_enhanced)) req.disable_prompt_enhanced = formBoolean(req.disable_prompt_enhanced, "disable_prompt_enhanced");
    if (present(req.stream)) req.stream = formBoolean(req.stream, "stream");
    for (const file of ctx.body.files || []) {
      if (!/^image(\[\d*\])?$/.test(file.field)) throw new Error("unexpected file field: " + file.field);
      // MiniMax reads Base64 references only as data:image/<lowercase format>;base64 URLs.
      const mimeType = trimmed(file.mimeType).toLowerCase();
      uploads.push({ __fileRef: file.ref, encoding: "dataUrl", mimeType: /^image\/[a-z0-9.+-]+$/.test(mimeType) ? mimeType : "image/png", maxBytes: IMAGE_MAX_REFERENCE_BYTES });
    }
  } else throw new Error("JSON or multipart body required");
  if (present(req.mask)) throw new Error("mask is not supported");
  if (present(req.background) && req.background !== "auto" && req.background !== "opaque") throw new Error("background " + req.background + " is not supported");
  const body = {};
  // checkImageBody refuses disable_prompt_enhanced on an edit.
  for (const key of IMAGE_GENERATE_FIELDS) {
    if (key !== "response_format" && present(req[key])) body[key] = req[key];
  }
  if (present(req.stream)) body.stream = req.stream;
  for (const key of Object.keys(req)) {
    if (!IMAGE_GENERATE_FIELDS.includes(key) && !IGNORED_OPENAI_IMAGE_FIELDS.includes(key) && !["model", "image", "images", "background", "stream", "n"].includes(key))
      throw new Error(key + " is not supported");
  }
  const images = [];
  for (const key of ["image", "images"]) {
    if (!present(req[key])) continue;
    for (const entry of Array.isArray(req[key]) ? req[key] : [req[key]]) images.push(entry);
  }
  for (const upload of uploads) images.push(upload);
  if (operation === "edit") body.images = images.map(referenceImage);
  else if (images.length) throw new Error("image is only valid on /v1/images/edits");
  return { operation: operation, body: body };
}

// ---------------------------------------------------------------------------
// Responses and video protocol helpers

function responsesInput(req) {
  const texts = [],
    images = [];
  const input = req.input;
  if (typeof input === "string") texts.push(input);
  else if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === "string") {
        texts.push(item);
        continue;
      }
      if (!plainObject(item)) continue;
      const content = item.content === undefined ? [item] : Array.isArray(item.content) ? item.content : [item.content];
      for (const part of content) {
        if (typeof part === "string") {
          texts.push(part);
          continue;
        }
        if (!plainObject(part)) continue;
        if (["input_text", "text"].includes(part.type) && typeof part.text === "string") texts.push(part.text);
        if (["input_image", "image_url"].includes(part.type)) {
          let image = part.image_url;
          if (image && typeof image === "object") image = image.url;
          if (trimmed(image)) images.push(trimmed(image));
        }
      }
    }
  }
  return {
    prompt: texts
      .filter(function (text) {
        return trimmed(text);
      })
      .join("\n"),
    images: images,
  };
}

function responsesVideoText(ctx) {
  const artifact = ctx && ctx.artifacts && ctx.artifacts.video;
  const url = trimmed(artifact && artifact.url);
  if (!url) throw new Error("video artifact is unavailable");
  const escaped = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return '<video controls src="' + escaped + '"></video>';
}

function jsonBody(ctx) {
  if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
  const body = plainObject(ctx.body.value);
  if (!body) throw new Error("request body must be an object");
  if (typeof body.model !== "string" || !body.model.trim()) throw new Error("model is required");
  return body;
}

// MiniMax would call these back with its own task ids, which the gateway does
// not hand out, so a native request carrying one is refused.
function refuseCallback(body) {
  if (present(body.callback_url)) throw new Error("callback_url is not supported; query the task instead");
}

function nativeImageIntent(ctx, operation) {
  const body = jsonBody(ctx);
  const model = body.model.trim();
  const imageBody = Object.assign({}, body);
  delete imageBody.model;
  return imageIntent(model, operation, imageBody);
}

export const native = {
  // MiniMax-H3's own body, sent as is for MiniMax to check.
  createH3Task: function (ctx) {
    const body = jsonBody(ctx);
    refuseCallback(body);
    if (!Array.isArray(body.content)) throw new Error("content must be an array");
    const content = validateH3Content(body.content);
    h3Duration(body.duration, videoProfile(body.model));
    return { kind: "submit", model: body.model, action: h3HasVisualContent(content) ? "image_to_video" : "text_to_video", requestBody: { model: body.model, vendorBody: body } };
  },
  // MiniMax's image bodies, sent as is; MiniMax checks the fields the gateway
  // does not price.
  createImage: function (ctx) {
    return nativeImageIntent(ctx, "generate");
  },
  editImage: function (ctx) {
    return nativeImageIntent(ctx, "edit");
  },
  // MiniMax answers /v2 with a bare task_id.
  taskCreated: function (ctx, task) {
    return Object.assign({}, plainObject(task.data) || {}, { task_id: task.task_id });
  },
  // The /v2 query reply, {task: {...}}. Before the first poll the task holds
  // the create reply, {task_id}, which is not part of it.
  h3TaskStatus: function (ctx, task) {
    const data = plainObject(task.data) || {};
    if (h3APIError(data)) return data;
    const current = h3QueryTask(data);
    const output = Object.assign({}, current || {}, { id: task.task_id });
    if (task.status === "FAILURE" && output.status !== "failed" && output.status !== "cancelled") {
      output.status = "failed";
      output.error = { message: task.fail_reason || "task failed" };
    } else if (!current) {
      output.status = task.status === "IN_PROGRESS" ? "running" : "queued";
    }
    return current ? Object.assign({}, data, { task: output }) : { task: output };
  },
  // MiniMax's own image reply, with every image and failure as MiniMax sent it.
  imageCreated: function (ctx, task) {
    return plainObject(task.data) || {};
  },
  // MiniMax's typed error with the HTTP status.
  error: function (ctx, error) {
    const type = ERROR_TYPES[error.httpStatus] || (error.httpStatus >= 500 ? "server_error" : "bad_request_error");
    return { type: "error", error: { type: type, message: error.message, http_code: String(error.httpStatus) }, request_id: error.requestId || "" };
  },
};

export function buildSubmitRequest(ctx) {
  const req = ctx.requestBody || {};
  const model = ctx.upstreamModel;
  if (imageTask(ctx)) {
    const operation = imageOperation(req);
    const body = Object.assign({}, req.imageBody || {}, { model: model });
    const checked = checkImageBody(operation, body);
    return {
      url: apiRoot(ctx) + (operation === "edit" ? "/v1/images/edits" : "/v1/images/generations"),
      method: "POST",
      headers: authHeaders(ctx),
      body: body,
      action: checked.action,
    };
  }
  const profile = videoProfile(model, ctx.model);
  const h3 = h3Request(req, profile);
  const content = h3.content;
  let body;
  if (req.vendorBody) body = Object.assign({}, req.vendorBody, { model: model });
  else {
    const metadata = req.metadata || {};
    body = Object.assign(
      { model: model, content: content, resolution: h3.resolution, duration: h3.duration, ratio: h3Ratio(req, content, profile) },
      definedFields(metadata, H3_METADATA_FIELDS)
    );
    const extra = h3Extra(metadata, profile);
    if (extra) body.extra = extra;
  }
  return {
    url: apiRoot(ctx) + "/v2/video_generation",
    method: "POST",
    headers: authHeaders(ctx),
    body: body,
    action: h3HasVisualContent(content) ? "image_to_video" : "text_to_video",
  };
}

export function parseSubmitResponse(ctx, resp) {
  const body = resp.body || {};
  if (imageTask(ctx)) {
    if (!plainObject(body)) throw new Error("invalid image generation response");
    // MiniMax answers 200 while at least one image succeeds.
    if (!deliveredImages(body).length) throw new Error(imageFailure(body));
    // The synchronous API has no vendor task; keep the gateway's own id.
    const taskId = trimmed(ctx.publicTaskId);
    if (!taskId) throw new Error("missing gateway task id");
    const first = deliveredImages(body).find(function (item) {
      return trimmed(item.url);
    });
    return { taskId: taskId, taskData: body, immediate: { status: "SUCCESS", progress: "100%", url: first ? trimmed(first.url) : "" } };
  }
  const apiError = h3APIError(body);
  if (apiError) throw new Error(apiError.message);
  // /v2 returns a bare task_id and adds base_resp only when the call is rejected.
  const base = body.base_resp;
  if (base && base.status_code !== 0) throw new Error(base.status_msg || "MiniMax submit failed");
  if (!body.task_id) throw new Error("missing task_id");
  return { taskId: body.task_id, taskData: body };
}

export function extractUsage(ctx) {
  const req = ctx.requestBody || {};
  if (imageTask(ctx)) {
    const facts = checkImageBody(imageOperation(req), req.imageBody || {}).facts;
    // Legacy per-call pricing multiplies the price by every ratio returned
    // here, so the ratio is the requested image count alone.
    if (ctx.usagePurpose === "billing_ratios") return { image_count: facts.image_count };
    return facts;
  }
  if (ctx.usagePurpose === "billing_ratios") return null;
  const h3 = h3Request(req, videoProfile(ctx.upstreamModel, ctx.model, req.model));
  const content = h3.content;
  return {
    seconds: h3.duration,
    resolution: h3.resolution,
    input_images: content.filter(function (item) {
      return item && item.type === "image_url";
    }).length,
    // Input URLs do not expose duration. Reserve the documented total limit;
    // polling replaces it with usage.input_seconds after success.
    input_video_seconds: content.some(function (item) {
      return item && item.type === "video_url";
    })
      ? H3_MAX_INPUT_VIDEO_SECONDS
      : 0,
  };
}

// Only legacy per-call pricing calls this hook: an image request settles on
// the images MiniMax delivered.
export function extractUsageOnSubmit(ctx, body) {
  if (!imageTask(ctx)) return null;
  return { image_count: imageUsage(body).image_count };
}

export function buildQueryRequest(ctx) {
  // Polling carries no relay info; the host fills these identities from the
  // persisted task properties.
  return {
    url: apiRoot(ctx) + "/v2/query/video_generation/" + encodeURIComponent(ctx.taskId),
    method: "GET",
    headers: { Accept: "application/json", Authorization: "Bearer " + ctx.apiKey },
  };
}

export function parseTaskResult(ctx, body) {
  const apiError = h3APIError(body);
  if (apiError) {
    if (apiError.statusCode === 408 || apiError.statusCode === 429 || apiError.statusCode >= 500) throw new Error(apiError.message);
    return { code: apiError.statusCode, status: "FAILURE", progress: "100%", reason: apiError.message };
  }
  const task = h3QueryTask(body);
  if (!task) return { status: "UNKNOWN", reason: "missing task in MiniMax reply" };
  const statuses = { queued: "QUEUED", running: "IN_PROGRESS", succeeded: "SUCCESS", failed: "FAILURE", cancelled: "FAILURE" };
  const status = statuses[task.status];
  if (!status) return { status: "UNKNOWN", reason: "unrecognized status: " + trimmed(task.status) };
  const result = { code: 0, status: status, progress: status === "QUEUED" ? "30%" : status === "IN_PROGRESS" ? "50%" : "100%" };
  if (status === "SUCCESS") {
    const url = trimmed(task.content && task.content.url);
    if (url) result.url = url;
  }
  if (status === "FAILURE") result.reason = trimmed(task.error && task.error.message) || "task " + trimmed(task.status);
  return result;
}

function artifactData(ctx) {
  const data = (ctx && ctx.data) || {};
  if (data.data && typeof data.data === "object" && data.data.task_id && Object.prototype.hasOwnProperty.call(data.data, "data")) return data.data.data || {};
  return data;
}

// /v2 tasks expose a public CDN URL.
function h3ArtifactURL(ctx) {
  const task = h3QueryTask(artifactData(ctx));
  return task ? trimmed(task.content && task.content.url) : "";
}

export function listArtifacts(task) {
  if (task.status !== "SUCCESS") return [];
  return h3ArtifactURL(task) ? [{ key: "video", type: "video", mimeType: "video/mp4" }] : [];
}

export function buildContentRequest(ctx) {
  if (ctx.artifactKey !== "video") throw new Error("artifact_not_found");
  const url = h3ArtifactURL(ctx);
  if (!url) throw new Error("artifact_not_found");
  return { url: url, method: ctx.clientRequest.method, credentialless: true };
}

export function extractUsageOnComplete(task, taskResult, body) {
  if (imageTask(task)) return imageUsage(body);
  const h3Task = h3QueryTask(body);
  if (!h3Task) return null;
  const profile = videoProfile(task.upstreamModel, task.model);
  const resolution = trimmed(h3Task.resolution).toUpperCase();
  const facts = {};
  if (profile.resolutions.includes(resolution)) facts.resolution = resolution;
  const usage = plainObject(h3Task.usage) || {};
  const fields = [
    { key: "seconds", value: usage.output_seconds, minimum: profile.minDuration, maximum: H3_MAX_DURATION, integer: false },
    { key: "input_images", value: usage.input_image_count, minimum: 0, maximum: H3_MAX_REFERENCE_IMAGES, integer: true },
    { key: "input_video_seconds", value: usage.input_seconds, minimum: 0, maximum: H3_MAX_INPUT_VIDEO_SECONDS, integer: false },
  ];
  // Omit malformed or out-of-contract upstream values so settlement keeps
  // the bounded submission estimate instead of accepting a new multiplier.
  for (const field of fields) {
    if (field.value === undefined || field.value === null || field.value === "") continue;
    const value = Number(field.value);
    if (!Number.isFinite(value) || value < field.minimum || value > field.maximum || (field.integer && !Number.isInteger(value))) continue;
    facts[field.key] = value;
  }
  return Object.keys(facts).length ? facts : null;
}

export const protocols = {
  openai_responses: {
    decodeRequest: function (ctx) {
      if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
      const req = plainObject(ctx.body.value);
      if (!req) throw new Error("request body must be an object");
      const model = trimmed(req.model);
      if (!model) throw new Error("model is required");
      if (req.input !== undefined && typeof req.input !== "string" && !Array.isArray(req.input)) throw new Error("input must be a string or array");
      if (req.images !== undefined && !Array.isArray(req.images)) throw new Error("images must be an array");
      if (req.metadata !== undefined && !plainObject(req.metadata)) throw new Error("metadata must be an object");
      const input = responsesInput(req);
      const prompt = input.prompt || trimmed(req.prompt);
      const images = [];
      for (const image of [req.image, req.input_reference].concat(req.images || [], input.images)) {
        if (trimmed(image) && !images.includes(trimmed(image))) images.push(trimmed(image));
      }
      if (!prompt && images.length === 0) throw new Error("input is required");
      const metadata = Object.assign({}, req.metadata || {});
      if (images.length && !metadata.first_frame_image) metadata.first_frame_image = images[0];
      if (images.length > 1 && !metadata.last_frame_image) metadata.last_frame_image = images[1];
      const requestBody = { model: model, prompt: prompt, metadata: metadata };
      if (images.length) requestBody.images = images;
      if (Object.prototype.hasOwnProperty.call(req, "seconds")) requestBody.duration = req.seconds;
      else if (Object.prototype.hasOwnProperty.call(req, "duration")) requestBody.duration = req.duration;
      if (Object.prototype.hasOwnProperty.call(req, "size")) requestBody.size = req.size;
      else if (Object.prototype.hasOwnProperty.call(req, "resolution")) requestBody.size = req.resolution;
      const profile = videoProfile(ctx.upstreamModel, model);
      const content = h3Request(requestBody, profile).content;
      h3Extra(metadata, profile);
      return { kind: "submit", model: model, action: h3HasVisualContent(content) ? "image_to_video" : "text_to_video", requestBody: requestBody };
    },
    renderEvents: function (ctx, task, previousState) {
      const status = String(task.status || "UNKNOWN").toUpperCase();
      const value = Number(String(task.progress || "").replace("%", ""));
      const progress = Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
      const state = { status: status, progress: progress };
      if (status === "SUCCESS") {
        const text = responsesVideoText(ctx);
        const events = previousState && previousState.status === status ? [] : [{ type: "output", data: text }];
        return { events: events, state: state, done: true };
      }
      if (status === "FAILURE")
        return { events: [{ type: "error", code: "task_failed", message: task.fail_reason || "task failed" }], state: state, done: true };
      if (previousState && previousState.status === status && previousState.progress === progress) return { events: [], state: state, done: false };
      const event = { type: "progress", message: status.toLowerCase() };
      if (progress !== null) event.progress = progress;
      return { events: [event], state: state, done: false };
    },
    renderFinal: function (ctx, _task) {
      return {
        output: [
          {
            type: "message",
            status: "completed",
            role: "assistant",
            content: [{ type: "output_text", text: responsesVideoText(ctx), annotations: [], logprobs: [] }],
          },
        ],
        metadata: { vendor: "minimax" },
      };
    },
  },
  openai_image: {
    decodeRequest: function (ctx) {
      const model = trimmed(ctx.model);
      if (!model) throw new Error("model is required");
      const request = openAIImageBody(ctx);
      return imageIntent(model, request.operation, request.body);
    },
    // Delivered images only; MiniMax reports a failed image with its error.
    render: function (ctx, task) {
      const body = plainObject(task.data) || {};
      const output = {
        data: deliveredImages(body).map(function (item) {
          const entry = trimmed(item.url) ? { url: trimmed(item.url) } : { b64_json: item.b64_json };
          if (trimmed(item.revised_prompt)) entry.revised_prompt = item.revised_prompt;
          return entry;
        }),
      };
      if (Number(body.created) > 0) output.created = Number(body.created);
      if (trimmed(body.output_format)) output.output_format = trimmed(body.output_format);
      return output;
    },
  },
};

const statusMap = { NOT_START: "queued", SUBMITTED: "queued", QUEUED: "queued", IN_PROGRESS: "in_progress", SUCCESS: "completed", FAILURE: "failed" };

protocols.openai_video = {
  decodeRequest: function (ctx) {
    if (!ctx.body || (ctx.body.kind !== "json" && ctx.body.kind !== "multipart")) throw new Error("JSON or multipart body required");
    let req;
    let hasInputReferenceFile = false;
    if (ctx.body.kind === "json") {
      if (!plainObject(ctx.body.value)) throw new Error("JSON object required");
      req = Object.assign({}, ctx.body.value);
    } else {
      req = {};
      const fields = ctx.body.fields || {};
      for (const name of Object.keys(fields)) {
        if (fields[name].length > 1) throw new Error(name + " must be provided once");
        req[name] = fields[name][0];
      }
      for (const file of ctx.body.files || []) {
        if (file.field !== "input_reference") throw new Error("unexpected file field: " + file.field);
        if (hasInputReferenceFile) throw new Error("input_reference must be provided once");
        hasInputReferenceFile = true;
      }
      if (req.metadata !== undefined) {
        let parsed;
        try {
          parsed = JSON.parse(req.metadata);
        } catch (e) {
          throw new Error("metadata must be a JSON object string");
        }
        if (!plainObject(parsed)) throw new Error("metadata must be a JSON object string");
        req.metadata = parsed;
      }
    }
    const seconds = req.seconds === undefined ? req.duration : req.seconds;
    if (seconds !== undefined) req.duration = Number(seconds);
    if (hasInputReferenceFile) {
      req.metadata = Object.assign({}, req.metadata || {}, {
        first_frame_image: { __fileRef: "request_file:input_reference", encoding: "dataUrl", maxBytes: 20971520 },
      });
    } else {
      const image = trimmed(req.input_reference || req.image);
      if (image) {
        req.metadata = Object.assign({}, req.metadata || {});
        if (!req.metadata.first_frame_image) req.metadata.first_frame_image = image;
      }
    }
    // vendorBody carries a native request's own body; clients of this protocol cannot set it.
    delete req.vendorBody;
    const requestBody = Object.assign({}, req, { model: ctx.model });
    const profile = videoProfile(ctx.upstreamModel, ctx.model);
    const content = h3Request(requestBody, profile).content;
    h3Extra(requestBody.metadata || {}, profile);
    return { kind: "submit", model: ctx.model, action: h3HasVisualContent(content) ? "image_to_video" : "text_to_video", requestBody: requestBody };
  },
  render: function (ctx, task) {
    const output = {
      id: task.task_id,
      object: "video",
      model: task.properties && task.properties.origin_model_name ? task.properties.origin_model_name : "",
      status: statusMap[task.status] || "unknown",
      progress: Number(String(task.progress || "0").replace("%", "")),
      created_at: task.created_at,
    };
    if (task.updated_at) output.completed_at = task.updated_at;
    if (task.status === "FAILURE") output.error = { message: task.fail_reason || "task failed", code: "task_failed" };
    return output;
  },
};
