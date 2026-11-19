// MiniMax on one channel: text (OpenAI Chat Completions, Responses and
// Anthropic Messages, passed through), speech and transcription (converted from
// the OpenAI audio endpoints), MiniMax-H3 video tasks (generation,
// H3-Context-IR, regeneration, cancel and delete), MiniMax-H3-Image generation,
// editing and prompt enhancement, and music generation.

// ---------------------------------------------------------------------------
// Models. The manifest below is a plain literal written from these by
// scripts/gen_meta.mjs; a test checks that the two agree.

export const PLUGIN_KEY = "byaiden_minimax";

// The text models MiniMax lists at GET /v1/models. The text routes pass any
// other model name through as well.
export const TEXT_MODELS = [
  "MiniMax-M3.1-Flash",
  "MiniMax-M3",
  "MiniMax-M2.7",
  "MiniMax-M2.7-highspeed",
  "MiniMax-M2.5",
  "MiniMax-M2.5-highspeed",
  "MiniMax-M2.1",
  "MiniMax-M2.1-highspeed",
  "MiniMax-M2",
];

const H3_MODEL = "MiniMax-H3";
// What each H3 video model renders, the dearest resolution last
// (platform.minimax.io/docs/api-reference/video-generation-v2-create).
// H3-Lite has no adaptive ratio for reference media; only H3-Max takes extra.
export const VIDEO_PROFILES = {
  "MiniMax-H3": { resolutions: ["768P", "2K"], minDuration: 4 },
  "MiniMax-H3-Highspeed": { resolutions: ["480P", "768P"], minDuration: 4 },
  "MiniMax-H3-Lite": { resolutions: ["480P", "768P"], minDuration: 4, fixedReferenceRatio: true },
  "MiniMax-H3-Max": { resolutions: ["480P", "768P"], minDuration: 5, extra: true },
};
export const VIDEO_MODELS = Object.keys(VIDEO_PROFILES);
export const FAST_VIDEO_MODELS = VIDEO_MODELS.filter(function (model) {
  return model !== H3_MODEL;
});
// A mapped upstream name the plugin does not list may render anything the
// family renders.
const ANY_VIDEO_PROFILE = { resolutions: ["480P", "768P", "2K"], minDuration: 4 };
// H3-Context-IR and video regeneration run on MiniMax-H3 at MiniMax's own
// prices; the gateway names them as MiniMax's price list does.
export const CONTEXT_IR_MODEL = "MiniMax-H3-Context-IR";
export const REGENERATION_MODEL = "MiniMax-H3-Regeneration";
export const IMAGE_MODELS = ["MiniMax-H3-Image", "MiniMax-H3-Image-Highspeed"];
// H3-Image-Context-IR serves MiniMax-H3-Image only.
const IMAGE_PROMPT_MODEL = "MiniMax-H3-Image";
export const MUSIC_MODELS = ["music-3.0", "music-2.6", "music-cover"];
export const SPEECH_MODELS = ["speech-2.8-hd", "speech-2.8-turbo", "speech-2.6-hd", "speech-2.6-turbo", "speech-02-hd", "speech-02-turbo"];
export const TRANSCRIPTION_MODELS = ["asr-1.0"];

// Models served by the task part (each has a usage profile).
export const TASK_MODELS = VIDEO_MODELS.concat([CONTEXT_IR_MODEL, REGENERATION_MODEL], IMAGE_MODELS, MUSIC_MODELS);
// Models the vendor's /v1/models leaves out; Fetch models adds them.
export const MEDIA_MODELS = TASK_MODELS.concat(SPEECH_MODELS, TRANSCRIPTION_MODELS);
export const MODEL_IDS = TEXT_MODELS.concat(MEDIA_MODELS);

// The models a cancel or delete request may name: those of tasks MiniMax
// keeps on its /v2 task API.
const CANCEL_MODELS = VIDEO_MODELS.concat([CONTEXT_IR_MODEL, REGENERATION_MODEL]);

// ---------------------------------------------------------------------------
// Usage facts (written into the manifest by scripts/gen_meta.mjs).

const VIDEO_SECONDS_FIELD = {
  type: "number",
  unit: "second",
  description: { en: "Video generation unit price", zh: "视频生成单价" },
};
const RESOLUTION_DESCRIPTION = { en: "Output video resolution", zh: "输出视频分辨率" };
const INPUT_IMAGES_FIELD = { type: "number", unit: "count", description: { en: "Input image unit price", zh: "输入图片单价" } };
const INPUT_VIDEO_FIELD = { type: "number", unit: "second", description: { en: "Input video unit price", zh: "输入视频单价" } };

// MiniMax-H3 renders 768P or 2K. Input images are estimated at submit and
// settled on completion; input video is reserved at the request maximum.
export const H3_USAGE_SCHEMA = {
  seconds: VIDEO_SECONDS_FIELD,
  resolution: { enum: ["768P", "2K"], description: RESOLUTION_DESCRIPTION },
  input_images: INPUT_IMAGES_FIELD,
  input_video_seconds: INPUT_VIDEO_FIELD,
};

// H3-Highspeed, H3-Lite and H3-Max render 480P or 768P.
export const H3_FAST_USAGE_SCHEMA = Object.assign({}, H3_USAGE_SCHEMA, {
  resolution: { enum: ["480P", "768P"], description: RESOLUTION_DESCRIPTION },
});

// MiniMax bills an image request by tokens: input text (prompt enhancement
// included), input reference images and output images, each counted for every
// image delivered. image_count serves per-image prices instead.
export const IMAGE_USAGE_SCHEMA = {
  image_input_text_tokens: { type: "number", unit: "token", description: { en: "Image input text unit price", zh: "图片输入文本单价" } },
  image_input_image_tokens: { type: "number", unit: "token", description: { en: "Image reference input unit price", zh: "图片参考图输入单价" } },
  image_output_tokens: { type: "number", unit: "token", description: { en: "Image output unit price", zh: "图片输出单价" } },
  image_count: { type: "number", unit: "count", description: { en: "Image generation unit price", zh: "图片生成单价" } },
};

export const CONTEXT_IR_USAGE_SCHEMA = {
  context_ir_input_tokens: { type: "number", unit: "token", description: { en: "Context-IR input unit price", zh: "Context-IR 输入单价" } },
  context_ir_output_tokens: { type: "number", unit: "token", description: { en: "Context-IR output unit price", zh: "Context-IR 输出单价" } },
};

// Regeneration renders 2K from a 768P source and bills the source task's
// input media again.
export const REGENERATION_USAGE_SCHEMA = {
  seconds: VIDEO_SECONDS_FIELD,
  input_images: INPUT_IMAGES_FIELD,
  input_video_seconds: INPUT_VIDEO_FIELD,
};

export const MUSIC_USAGE_SCHEMA = {
  music_tracks: { type: "number", unit: "count", description: { en: "Music track unit price", zh: "音乐单曲单价" } },
};

function example(label, defaults, facts) {
  return { label: label, facts: Object.assign({}, defaults, facts) };
}

const H3_FACTS = { seconds: 5, resolution: "768P", input_images: 0, input_video_seconds: 0 };
const IMAGE_FACTS = { image_input_text_tokens: 0, image_input_image_tokens: 0, image_output_tokens: 0, image_count: 0 };
const REGENERATION_FACTS = { seconds: 5, input_images: 0, input_video_seconds: 0 };

export const H3_EXAMPLES = [
  example("H3 768P 5s", H3_FACTS, {}),
  example("H3 2K 5s", H3_FACTS, { resolution: "2K" }),
  example("H3 2K 5s · 9 images", H3_FACTS, { resolution: "2K", input_images: 9 }),
  example("H3 2K 5s · input video", H3_FACTS, { resolution: "2K", input_video_seconds: 15 }),
];
export const H3_FAST_EXAMPLES = [
  example("480P 5s", H3_FACTS, { resolution: "480P" }),
  example("768P 5s", H3_FACTS, {}),
  example("768P 10s · 9 images", H3_FACTS, { seconds: 10, input_images: 9 }),
  example("768P 5s · input video", H3_FACTS, { input_video_seconds: 15 }),
];
// Token counts follow MiniMax's own examples: an output image costs one token
// per 1024 pixels, so 2K 1:1 is 4096 tokens and 4K 1:1 is 16384.
export const IMAGE_EXAMPLES = [
  example("text to image 2K", IMAGE_FACTS, { image_input_text_tokens: 3200, image_output_tokens: 4096, image_count: 1 }),
  example("text to image 4K", IMAGE_FACTS, { image_input_text_tokens: 3200, image_output_tokens: 16384, image_count: 1 }),
  example("edit 2K · 2 refs", IMAGE_FACTS, { image_input_text_tokens: 12100, image_input_image_tokens: 11800, image_output_tokens: 4096, image_count: 1 }),
  example("prompt enhancement", IMAGE_FACTS, { image_input_text_tokens: 3489 }),
];
export const CONTEXT_IR_EXAMPLES = [example("text to video prompt", {}, { context_ir_input_tokens: 5664, context_ir_output_tokens: 3426 })];
export const REGENERATION_EXAMPLES = [
  example("2K 5s", REGENERATION_FACTS, {}),
  example("2K 10s · 7 images", REGENERATION_FACTS, { seconds: 10, input_images: 7 }),
  example("2K 5s · input video", REGENERATION_FACTS, { input_video_seconds: 15 }),
];
export const MUSIC_EXAMPLES = [example("one song", {}, { music_tracks: 1 })];

// The marketplace and the gateway read this manifest without running the plugin,
// so it is a plain literal (scripts/gen_meta.mjs writes it from the constants above).
export const meta = {
  "apiVersion": 1,
  "key": "byaiden_minimax",
  "name": "MiniMax",
  "icon": "Minimax.Color",
  "description": {
    "en": "MiniMax text, speech, transcription, H3 video, H3-Image and music on one channel",
    "zh": "一个渠道接入 MiniMax 文本、语音合成、语音识别、H3 视频、H3-Image 图片与音乐"
  },
  "version": "2.0.1",
  "author": {
    "name": "ByAiden",
    "url": "https://github.com/ByAiden"
  },
  "website": "https://platform.minimax.io/docs/api-reference/api-overview",
  "baseUrl": "https://api.minimaxi.com",
  "models": [
    "MiniMax-M3.1-Flash",
    "MiniMax-M3",
    "MiniMax-M2.7",
    "MiniMax-M2.7-highspeed",
    "MiniMax-M2.5",
    "MiniMax-M2.5-highspeed",
    "MiniMax-M2.1",
    "MiniMax-M2.1-highspeed",
    "MiniMax-M2",
    "MiniMax-H3",
    "MiniMax-H3-Highspeed",
    "MiniMax-H3-Lite",
    "MiniMax-H3-Max",
    "MiniMax-H3-Context-IR",
    "MiniMax-H3-Regeneration",
    "MiniMax-H3-Image",
    "MiniMax-H3-Image-Highspeed",
    "music-3.0",
    "music-2.6",
    "music-cover",
    "speech-2.8-hd",
    "speech-2.8-turbo",
    "speech-2.6-hd",
    "speech-2.6-turbo",
    "speech-02-hd",
    "speech-02-turbo",
    "asr-1.0"
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
    },
    "context_ir_input_tokens": {
      "type": "number",
      "unit": "token",
      "description": {
        "en": "Context-IR input unit price",
        "zh": "Context-IR 输入单价"
      }
    },
    "context_ir_output_tokens": {
      "type": "number",
      "unit": "token",
      "description": {
        "en": "Context-IR output unit price",
        "zh": "Context-IR 输出单价"
      }
    },
    "music_tracks": {
      "type": "number",
      "unit": "count",
      "description": {
        "en": "Music track unit price",
        "zh": "音乐单曲单价"
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
        "image_count": 0,
        "context_ir_input_tokens": 0,
        "context_ir_output_tokens": 0,
        "music_tracks": 0
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
        "image_count": 1,
        "context_ir_input_tokens": 0,
        "context_ir_output_tokens": 0,
        "music_tracks": 0
      }
    },
    {
      "label": "Context-IR",
      "facts": {
        "seconds": 0,
        "resolution": "768P",
        "input_images": 0,
        "input_video_seconds": 0,
        "image_input_text_tokens": 0,
        "image_input_image_tokens": 0,
        "image_output_tokens": 0,
        "image_count": 0,
        "context_ir_input_tokens": 5664,
        "context_ir_output_tokens": 3426,
        "music_tracks": 0
      }
    },
    {
      "label": "one song",
      "facts": {
        "seconds": 0,
        "resolution": "768P",
        "input_images": 0,
        "input_video_seconds": 0,
        "image_input_text_tokens": 0,
        "image_input_image_tokens": 0,
        "image_output_tokens": 0,
        "image_count": 0,
        "context_ir_input_tokens": 0,
        "context_ir_output_tokens": 0,
        "music_tracks": 1
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
        "MiniMax-H3-Context-IR"
      ],
      "schema": {
        "context_ir_input_tokens": {
          "type": "number",
          "unit": "token",
          "description": {
            "en": "Context-IR input unit price",
            "zh": "Context-IR 输入单价"
          }
        },
        "context_ir_output_tokens": {
          "type": "number",
          "unit": "token",
          "description": {
            "en": "Context-IR output unit price",
            "zh": "Context-IR 输出单价"
          }
        }
      },
      "examples": [
        {
          "label": "text to video prompt",
          "facts": {
            "context_ir_input_tokens": 5664,
            "context_ir_output_tokens": 3426
          }
        }
      ]
    },
    {
      "models": [
        "MiniMax-H3-Regeneration"
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
          "label": "2K 5s",
          "facts": {
            "seconds": 5,
            "input_images": 0,
            "input_video_seconds": 0
          }
        },
        {
          "label": "2K 10s · 7 images",
          "facts": {
            "seconds": 10,
            "input_images": 7,
            "input_video_seconds": 0
          }
        },
        {
          "label": "2K 5s · input video",
          "facts": {
            "seconds": 5,
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
        },
        {
          "label": "prompt enhancement",
          "facts": {
            "image_input_text_tokens": 3489,
            "image_input_image_tokens": 0,
            "image_output_tokens": 0,
            "image_count": 0
          }
        }
      ]
    },
    {
      "models": [
        "music-3.0",
        "music-2.6",
        "music-cover"
      ],
      "schema": {
        "music_tracks": {
          "type": "number",
          "unit": "count",
          "description": {
            "en": "Music track unit price",
            "zh": "音乐单曲单价"
          }
        }
      },
      "examples": [
        {
          "label": "one song",
          "facts": {
            "music_tracks": 1
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
      "method": "DELETE",
      "path": "/v2/video_generation/:task_id",
      "type": "submit",
      "decode": "cancelTask",
      "render": "taskCancelled",
      "retainResult": false
    },
    {
      "method": "POST",
      "path": "/v2/h3_context_ir",
      "type": "submit",
      "decode": "createContextIR",
      "render": "taskCreated"
    },
    {
      "method": "POST",
      "path": "/v2/video_regeneration",
      "type": "submit",
      "decode": "createRegeneration",
      "render": "taskCreated"
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
    },
    {
      "method": "POST",
      "path": "/v1/h3_image_context_ir",
      "type": "submit",
      "decode": "enhanceImagePrompt",
      "render": "imagePromptEnhanced",
      "models": [
        "MiniMax-H3-Image"
      ],
      "retainResult": false
    },
    {
      "method": "POST",
      "path": "/v1/music_generation",
      "type": "submit",
      "decode": "createMusic",
      "render": "musicCreated",
      "models": [
        "music-3.0",
        "music-2.6",
        "music-cover"
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
  ],
  "relay": [
    {
      "incoming_path": "/v1/chat/completions",
      "upstream_path": "/v1/chat/completions"
    },
    {
      "incoming_path": "/v1/responses",
      "upstream_path": "/v1/responses"
    },
    {
      "incoming_path": "/v1/messages",
      "upstream_path": "/anthropic/v1/messages"
    },
    {
      "incoming_path": "/v1/audio/speech",
      "upstream_path": "/v1/t2a_v2",
      "converter": "plugin"
    },
    {
      "incoming_path": "/v1/audio/transcriptions",
      "upstream_path": "/v1/speech_to_text",
      "converter": "plugin"
    },
    {
      "incoming_path": "/v1/models",
      "upstream_path": "/v1/models",
      "converter": "plugin"
    }
  ],
  "channelConfig": {
    "type": "object",
    "properties": {
      "defaultVoice": {
        "type": "string",
        "title": {
          "en": "Default voice",
          "zh": "默认音色"
        },
        "description": {
          "en": "MiniMax voice ID used when a speech request names an OpenAI voice such as alloy, or none",
          "zh": "语音合成请求使用 alloy 等 OpenAI 音色名或未指定音色时使用的 MiniMax 音色 ID"
        },
        "default": "English_Graceful_Lady",
        "minLength": 1,
        "maxLength": 128
      }
    }
  },
  "keyHint": {
    "en": "MiniMax API key of the site the Base URL points to",
    "zh": "MiniMax API Key，与 Base URL 所在站点对应"
  }
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
  return ctx.baseUrl + (viaGateway(ctx) ? "/" + PLUGIN_KEY : "");
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
// metadata or, failing that, the top-level ratio.
function h3Ratio(req, content, profile) {
  const ratio = trimmed((req.metadata || {}).ratio) || trimmed(req.ratio);
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

// A presenter's task: dynamic routes hand over a list of TaskViews.
function taskView(task) {
  if (Array.isArray(task)) return plainObject(task[0]) || {};
  return plainObject(task) || {};
}

// MiniMax's ids, file ids, trace ids and links do not leave the gateway:
// members named like an id or a link and string values holding a URL are
// dropped at every depth.
const VENDOR_KEY = /(^|_)(id|ids|url|urls)$/i;
const VENDOR_LINK = /^(https?:)?\/\//i;

function scrubbed(value) {
  if (Array.isArray(value)) {
    return value
      .filter(function (item) {
        return !(typeof item === "string" && VENDOR_LINK.test(item.trim()));
      })
      .map(scrubbed);
  }
  if (!plainObject(value)) return value;
  const out = {};
  for (const key of Object.keys(value)) {
    const item = value[key];
    if (VENDOR_KEY.test(key)) continue;
    if (typeof item === "string" && VENDOR_LINK.test(item.trim())) continue;
    out[key] = scrubbed(item);
  }
  return out;
}

// A synchronous MiniMax reply without the trace ids MiniMax adds.
function withoutTrace(body) {
  const out = Object.assign({}, plainObject(body) || {});
  delete out.request_id;
  delete out.trace_id;
  return out;
}

// A MiniMax /v2 task as the gateway presents it: MiniMax's fields (status,
// usage, the Context-IR prompt...) without its ids and links, the video at
// the gateway's own artifact address once the task has finished. Without
// one (a list of tasks, or no public address configured) the link is left
// out rather than MiniMax's given.
function presentedH3Task(ctx, current) {
  const output = scrubbed(current);
  const artifact = ctx && plainObject(ctx.artifacts) ? plainObject(ctx.artifacts.video) : null;
  const url = trimmed(artifact && artifact.url);
  if (url) output.content = Object.assign({}, plainObject(output.content) || {}, { url: url });
  return output;
}

function nativeImageIntent(ctx, operation) {
  const body = jsonBody(ctx);
  const model = body.model.trim();
  const imageBody = Object.assign({}, body);
  delete imageBody.model;
  return imageIntent(model, operation, imageBody);
}

const mediaNative = {
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
  // MiniMax answers /v2 with a bare task_id: the gateway's own id here.
  taskCreated: function (ctx, task) {
    const view = taskView(task);
    const reply = { task_id: view.task_id };
    const base = plainObject(plainObject(view.data) ? view.data.base_resp : null);
    if (base) reply.base_resp = scrubbed(base);
    return reply;
  },
  // The /v2 query reply, {task: {...}}, with the gateway's task id and its
  // own artifact address in place of MiniMax's. Before the first poll the
  // task holds the create reply, {task_id}, which is not part of it.
  h3TaskStatus: function (ctx, task) {
    const view = taskView(task);
    const data = plainObject(view.data) || {};
    if (h3APIError(data)) return { error: scrubbed(data.error) };
    const current = h3QueryTask(data);
    const output = current ? presentedH3Task(ctx, current) : {};
    output.id = view.task_id;
    if (view.status === "FAILURE" && output.status !== "failed" && output.status !== "cancelled") {
      output.status = "failed";
      output.error = { message: view.fail_reason || "task failed" };
    } else if (!current) {
      output.status = view.status === "IN_PROGRESS" ? "running" : "queued";
    }
    return { task: output };
  },
  // MiniMax's image reply without its trace id. The gateway keeps no copy of
  // a synchronous reply, so a url is MiniMax's own short-lived link
  // (response_format b64_json keeps the images inside the reply).
  imageCreated: function (ctx, task) {
    return withoutTrace(taskView(task).data);
  },
  // MiniMax's typed error with the HTTP status.
  error: function (ctx, error) {
    const type = ERROR_TYPES[error.httpStatus] || (error.httpStatus >= 500 ? "server_error" : "bad_request_error");
    return { type: "error", error: { type: type, message: error.message, http_code: String(error.httpStatus) }, request_id: error.requestId || "" };
  },
};

function mediaSubmitRequest(ctx) {
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

function mediaSubmitResponse(ctx, resp) {
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

function mediaUsage(ctx) {
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
function mediaUsageOnSubmit(ctx, body) {
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

// A finished video task: MiniMax's link, or another gateway's presenter
// output, which names the video's modality but may carry no link.
function hasVideo(ctx) {
  if (h3ArtifactURL(ctx)) return true;
  const task = h3QueryTask(artifactData(ctx));
  if (!task || task.status !== "succeeded") return false;
  return trimmed(task.modality) === "video" || ["generation", "regeneration"].includes(trimmed(task.task_type));
}

export function listArtifacts(task) {
  if (task.status !== "SUCCESS") return [];
  return hasVideo(task) ? [{ key: "video", type: "video", mimeType: "video/mp4" }] : [];
}


function mediaUsageOnComplete(task, taskResult, body) {
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
      if (present(req.prompt) && typeof req.prompt !== "string") throw new Error("prompt must be a string");
      if (present(req.ratio) && typeof req.ratio !== "string") throw new Error("ratio must be a string");
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
      if (present(req.ratio)) requestBody.ratio = req.ratio;
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
    // String() would turn an array or object prompt into "[object Object]"
    // and MiniMax would bill a video of that text.
    if (present(req.prompt) && typeof req.prompt !== "string") throw new Error("prompt must be a string");
    if (present(req.ratio) && typeof req.ratio !== "string") throw new Error("ratio must be a string");
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

// ---------------------------------------------------------------------------
// Shared helpers of the newer endpoints

// The vendor fields the OpenAI-style video requests carry in metadata; the
// MiniMax body has them at the top level. aigc_watermark is a field of
// MiniMax's China API (platform.minimaxi.com).
const H3_METADATA_FIELDS = ["aigc_watermark"];

// The /v2 and image error types by HTTP status.
const ERROR_TYPES = { 401: "authorized_error", 402: "insufficient_balance_error", 403: "authorized_error", 422: "unprocessable_entity_error", 429: "rate_limit_error" };

function fail(message) {
  throw new Error(message);
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function onlyFields(body, allowed) {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) fail(key + " is not supported");
  }
}

function boundedNumber(value, maximum) {
  if (!present(value) || value === "") return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > maximum) return undefined;
  return number;
}

// The kind of task a request or a persisted task is: the decoders mark the
// newer kinds, and polling contexts carry the action.
const ACTION_KINDS = {
  cancel_task: "cancel",
  h3_context_ir: "context_ir",
  video_regeneration: "regeneration",
  image_prompt: "image_prompt",
  music_generation: "music",
};

function taskKind(ctx) {
  const req = plainObject(ctx && ctx.requestBody);
  if (req && typeof req.kind === "string" && req.kind) return req.kind;
  const kind = ACTION_KINDS[trimmed(ctx && ctx.action)];
  if (kind) return kind;
  return "media";
}

function bearer(ctx) {
  return viaGateway(ctx) ? ctx.authHeader || "Bearer " + ctx.apiKey : "Bearer " + ctx.apiKey;
}

function jsonHeaders(ctx) {
  return { "Content-Type": "application/json", Accept: "application/json", Authorization: bearer(ctx) };
}

// MiniMax answers some calls with HTTP 200 and base_resp.status_code set.
function baseRespError(body) {
  const base = plainObject(plainObject(body) ? body.base_resp : null);
  if (!base || !present(base.status_code) || Number(base.status_code) === 0) return "";
  return (trimmed(base.status_msg) || "MiniMax request failed") + " (" + base.status_code + ")";
}

// An upstream name for MiniMax's H3 task endpoints: the gateway's Context-IR
// and regeneration names stand for MiniMax-H3 there.
function h3UpstreamModel(ctx, gatewayName) {
  const model = trimmed(ctx.upstreamModel) || trimmed(ctx.model);
  if (!model || model === gatewayName) return H3_MODEL;
  return model;
}

function originTask(ctx, publicId) {
  const tasks = Array.isArray(ctx.originTasks) ? ctx.originTasks : [];
  const wanted = trimmed(publicId);
  return tasks.find(function (task) {
    return task && trimmed(task.taskId) === wanted;
  }) || tasks[0] || null;
}

// The MiniMax task object stored for a gateway task, the plain query reply or
// a New API gateway's presenter output.
function storedH3Task(data) {
  return h3QueryTask(artifactData({ data: data }));
}

// ---------------------------------------------------------------------------
// H3-Context-IR: an enhanced video prompt, as a /v2 task

const CONTEXT_IR_FIELDS = ["model", "content", "duration", "ratio", "callback_url"];
// MiniMax's example spends 5,664 input and 3,426 output tokens on a short
// text-to-video prompt; media items add their own context.
const CONTEXT_IR_INPUT_BASE = 16384;
const CONTEXT_IR_INPUT_PER_MEDIA = 16384;
const CONTEXT_IR_OUTPUT_RESERVE = 16384;
const CONTEXT_IR_MAX_TOKENS = 2000000;

function contextIRBody(body) {
  onlyFields(body, CONTEXT_IR_FIELDS);
  refuseCallback(body);
  if (!Array.isArray(body.content)) fail("content must be an array");
  const content = validateH3Content(body.content);
  if (!present(body.duration)) fail("duration is required (4 to 15 seconds)");
  h3Duration(body.duration, videoProfile(H3_MODEL));
  if (present(body.ratio) && typeof body.ratio !== "string") fail("ratio must be a string");
  const out = Object.assign({}, body);
  delete out.model;
  if (!trimmed(out.ratio) && h3TextOnly(content)) out.ratio = "16:9";
  return out;
}

function contextIRFacts(body) {
  const content = Array.isArray(body.content) ? body.content : [];
  let input = CONTEXT_IR_INPUT_BASE;
  for (const item of content) {
    if (!plainObject(item)) continue;
    if (item.type === "text") input += codePoints(trimmed(item.text));
    else input += CONTEXT_IR_INPUT_PER_MEDIA;
  }
  return { context_ir_input_tokens: input, context_ir_output_tokens: CONTEXT_IR_OUTPUT_RESERVE };
}

function contextIRUsage(task) {
  const usage = plainObject(task && task.usage) || {};
  const facts = {};
  const input = boundedNumber(usage.prompt_tokens, CONTEXT_IR_MAX_TOKENS);
  const output = boundedNumber(usage.completion_tokens, CONTEXT_IR_MAX_TOKENS);
  if (input !== undefined) facts.context_ir_input_tokens = Math.round(input);
  if (output !== undefined) facts.context_ir_output_tokens = Math.round(output);
  return Object.keys(facts).length ? facts : null;
}

// ---------------------------------------------------------------------------
// Video regeneration: a 768P MiniMax-H3 video again at 2K

const REGENERATION_FIELDS = ["model", "source_task_id", "content", "resolution", "generate_audio", "aigc_watermark", "callback_url"];
const REGENERATION_MAX_SECONDS = 15;

function regenerationBody(body) {
  onlyFields(body, REGENERATION_FIELDS);
  refuseCallback(body);
  const bySource = present(body.source_task_id);
  if (bySource === present(body.content)) fail("send either source_task_id or content");
  if (present(body.resolution) && body.resolution !== "2K") fail("resolution must be 2K");
  for (const key of ["generate_audio", "aigc_watermark"]) {
    if (present(body[key]) && typeof body[key] !== "boolean") fail(key + " must be true or false");
  }
  const out = Object.assign({}, body, { resolution: "2K" });
  delete out.model;
  if (bySource) {
    if (typeof body.source_task_id !== "string" || !body.source_task_id.trim()) fail("source_task_id must be a task id of this gateway");
    delete out.source_task_id;
    return { body: out, sourceTaskId: body.source_task_id.trim() };
  }
  if (!Array.isArray(body.content)) fail("content must be an array");
  const bases = body.content.filter(function (item) {
    return plainObject(item) && item.type === "video_url" && trimmed(item.role) === "base_video";
  });
  if (bases.length !== 1) fail("content must hold exactly one video_url item with role base_video");
  validateH3Content(
    body.content.filter(function (item) {
      return !(plainObject(item) && trimmed(item.role) === "base_video");
    }),
  );
  return { body: out, sourceTaskId: "" };
}

// The source task's own output and inputs are billed again; without them the
// reservation holds the longest video MiniMax regenerates.
function regenerationFacts(ctx) {
  const req = ctx.requestBody || {};
  const facts = { seconds: REGENERATION_MAX_SECONDS, input_images: 0, input_video_seconds: 0 };
  if (req.sourceTaskId) {
    const origin = originTask(ctx, req.sourceTaskId);
    const source = origin ? storedH3Task(origin.data) : null;
    const usage = plainObject(source && source.usage) || {};
    const seconds = boundedNumber(usage.output_seconds, REGENERATION_MAX_SECONDS) || boundedNumber(source && source.duration, REGENERATION_MAX_SECONDS);
    if (seconds) facts.seconds = seconds;
    facts.input_images = boundedNumber(usage.input_image_count, H3_MAX_REFERENCE_IMAGES) || 0;
    const inputSeconds = boundedNumber(usage.input_seconds, H3_MAX_INPUT_VIDEO_SECONDS);
    facts.input_video_seconds = inputSeconds === undefined ? (source ? 0 : H3_MAX_INPUT_VIDEO_SECONDS) : inputSeconds;
    return facts;
  }
  const content = Array.isArray(plainObject(req.vendorBody) && req.vendorBody.content) ? req.vendorBody.content : [];
  for (const item of content) {
    if (!plainObject(item)) continue;
    if (item.type === "image_url") facts.input_images += 1;
    if (item.type === "video_url" && trimmed(item.role) !== "base_video") facts.input_video_seconds = H3_MAX_INPUT_VIDEO_SECONDS;
  }
  return facts;
}

function regenerationUsage(task) {
  const usage = plainObject(task && task.usage) || {};
  const facts = {};
  const seconds = boundedNumber(usage.output_seconds, REGENERATION_MAX_SECONDS);
  const images = boundedNumber(usage.input_image_count, H3_MAX_REFERENCE_IMAGES);
  const input = boundedNumber(usage.input_seconds, H3_MAX_INPUT_VIDEO_SECONDS);
  if (seconds !== undefined) facts.seconds = seconds;
  if (images !== undefined && Number.isInteger(images)) facts.input_images = images;
  if (input !== undefined) facts.input_video_seconds = input;
  return Object.keys(facts).length ? facts : null;
}

// ---------------------------------------------------------------------------
// Cancel or delete a /v2 task: a zero-priced request on the task's channel

// The facts of a request that costs nothing, complete for the model's profile.
function zeroFacts(model) {
  if (model === CONTEXT_IR_MODEL) return { context_ir_input_tokens: 0, context_ir_output_tokens: 0 };
  if (model === REGENERATION_MODEL) return { seconds: 0, input_images: 0, input_video_seconds: 0 };
  return { seconds: 0, resolution: videoProfile(model).resolutions[0], input_images: 0, input_video_seconds: 0 };
}

function cancelModel(name) {
  const model = trimmed(name);
  if (!model) return H3_MODEL;
  return model;
}

// ---------------------------------------------------------------------------
// H3-Image-Context-IR: MiniMax-H3-Image prompt enhancement on its own

const IMAGE_PROMPT_FIELDS = ["model", "prompt", "images", "size", "aspect_ratio", "area"];
const IMAGE_PROMPT_MAX_TOKENS = 2000000;

function imagePromptBody(body) {
  onlyFields(body, IMAGE_PROMPT_FIELDS);
  const prompt = stringField(body, "prompt");
  if (!prompt) fail("prompt is required");
  if (codePoints(prompt) > IMAGE_MAX_PROMPT_CHARS) fail("prompt must be at most " + IMAGE_MAX_PROMPT_CHARS + " characters");
  imagePixels(body);
  let references = 0;
  if (present(body.images)) {
    if (!Array.isArray(body.images) || !body.images.length || body.images.length > IMAGE_MAX_REFERENCES) fail("images must hold 1 to " + IMAGE_MAX_REFERENCES + " reference images");
    body.images.forEach(referenceImage);
    references = body.images.length;
  }
  const out = Object.assign({}, body);
  delete out.model;
  const textTokens = codePoints(prompt) + (references ? IMAGE_TEXT_TOKENS_PER_REFERENCE * references : IMAGE_TEXT_TOKENS_GENERATE);
  return { body: out, facts: { image_input_text_tokens: textTokens, image_input_image_tokens: 0, image_output_tokens: 0, image_count: 0 } };
}

function imagePromptUsage(body) {
  const usage = plainObject(plainObject(body) ? body.usage : null) || {};
  const tokens = boundedNumber(usage.input_tokens !== undefined ? usage.input_tokens : usage.total_tokens, IMAGE_PROMPT_MAX_TOKENS);
  if (tokens === undefined) return null;
  return { image_input_text_tokens: Math.round(tokens), image_input_image_tokens: 0, image_output_tokens: 0, image_count: 0 };
}

// ---------------------------------------------------------------------------
// Music generation (synchronous; MiniMax answers with hex audio or a URL)

const MUSIC_FIELDS = ["model", "prompt", "lyrics", "stream", "output_format", "audio_setting", "lyrics_optimizer", "is_instrumental", "audio_url", "audio_base64", "cover_feature_id"];
const MUSIC_MAX_PROMPT = 2000;
const MUSIC_MAX_LYRICS = 3500;

function musicBody(model, body) {
  onlyFields(body, MUSIC_FIELDS);
  if (present(body.stream) && body.stream !== false) fail("stream is not supported; the gateway answers once the song is done");
  for (const key of ["prompt", "lyrics", "audio_url", "audio_base64", "cover_feature_id"]) {
    if (present(body[key]) && typeof body[key] !== "string") fail(key + " must be a string");
  }
  for (const key of ["lyrics_optimizer", "is_instrumental"]) {
    if (present(body[key]) && typeof body[key] !== "boolean") fail(key + " must be true or false");
  }
  if (present(body.output_format) && body.output_format !== "url" && body.output_format !== "hex") fail("output_format must be url or hex");
  if (present(body.audio_setting) && !plainObject(body.audio_setting)) fail("audio_setting must be an object");
  const prompt = trimmed(body.prompt);
  const lyrics = trimmed(body.lyrics);
  if (codePoints(prompt) > MUSIC_MAX_PROMPT) fail("prompt must be at most " + MUSIC_MAX_PROMPT + " characters");
  if (codePoints(lyrics) > MUSIC_MAX_LYRICS) fail("lyrics must be at most " + MUSIC_MAX_LYRICS + " characters");
  const cover = /cover/.test(model);
  const sources = ["audio_url", "audio_base64", "cover_feature_id"].filter(function (key) {
    return trimmed(body[key]);
  });
  if (cover) {
    if (!prompt) fail("prompt is required for a cover");
    if (sources.length !== 1) fail("a cover needs exactly one of audio_url, audio_base64 or cover_feature_id");
  } else {
    if (sources.length) fail(sources[0] + " is only valid on music-cover");
    if (body.is_instrumental === true && !prompt) fail("prompt is required for instrumental music");
    if (body.is_instrumental !== true && !lyrics && body.lyrics_optimizer !== true) fail("lyrics are required (or set lyrics_optimizer or is_instrumental)");
  }
  const out = Object.assign({}, body);
  delete out.model;
  return out;
}

function musicAudio(body) {
  const data = plainObject(plainObject(body) ? body.data : null);
  return data ? trimmed(data.audio) : "";
}

// ---------------------------------------------------------------------------
// Native routes

export const native = Object.assign({}, mediaNative, {
  // DELETE /v2/video_generation/{task_id}: cancels a queued task or deletes a
  // finished task's record at MiniMax. The path holds the gateway task id.
  cancelTask: function (ctx) {
    const params = ctx.params || {};
    const taskId = trimmed(params.task_id);
    if (!taskId) fail("task_id is required");
    let body = {};
    if (ctx.body && ctx.body.kind === "json") {
      body = plainObject(ctx.body.value);
      if (!body) fail("request body must be an object");
    }
    onlyFields(body, ["model"]);
    if (present(body.model) && typeof body.model !== "string") fail("model must be a string");
    // The model only picks the price profile (every fact is zero); a model
    // the plugin does not list may be a channel alias of one it does.
    const model = cancelModel(body.model);
    if (TASK_MODELS.indexOf(model) >= 0 && CANCEL_MODELS.indexOf(model) < 0) fail(model + " has no task to cancel; name the model of the video task");
    return { kind: "submit", model: model, action: "cancel_task", originTaskIds: [taskId], requestBody: { kind: "cancel", model: model, taskId: taskId } };
  },
  // POST /v2/h3_context_ir: MiniMax's body; model MiniMax-H3 or the gateway's
  // MiniMax-H3-Context-IR.
  createContextIR: function (ctx) {
    const body = jsonBody(ctx);
    const name = body.model.trim();
    const model = name === H3_MODEL ? CONTEXT_IR_MODEL : name;
    return { kind: "submit", model: model, action: "h3_context_ir", requestBody: { kind: "context_ir", model: model, vendorBody: contextIRBody(body) } };
  },
  // POST /v2/video_regeneration: by a gateway task id (source_task_id) or by
  // the source video and its inputs (content).
  createRegeneration: function (ctx) {
    const body = jsonBody(ctx);
    const name = body.model.trim();
    const model = name === H3_MODEL ? REGENERATION_MODEL : name;
    const checked = regenerationBody(body);
    const intent = { kind: "submit", model: model, action: "video_regeneration", requestBody: { kind: "regeneration", model: model, vendorBody: checked.body, sourceTaskId: checked.sourceTaskId } };
    if (checked.sourceTaskId) intent.originTaskIds = [checked.sourceTaskId];
    return intent;
  },
  // POST /v1/h3_image_context_ir
  enhanceImagePrompt: function (ctx) {
    const body = jsonBody(ctx);
    const model = body.model.trim();
    if (model === "MiniMax-H3-Image-Highspeed") fail("H3-Image-Context-IR serves MiniMax-H3-Image only");
    const checked = imagePromptBody(body);
    return { kind: "submit", model: model, action: "image_prompt", requestBody: { kind: "image_prompt", model: model, promptBody: checked.body } };
  },
  // POST /v1/music_generation
  createMusic: function (ctx) {
    const body = jsonBody(ctx);
    const model = body.model.trim();
    return { kind: "submit", model: model, action: "music_generation", requestBody: { kind: "music", model: model, musicBody: musicBody(model, body) } };
  },
  // MiniMax's cancel reply, for the task the request named.
  taskCancelled: function (ctx, task) {
    const data = plainObject(task.data) || {};
    return { task_id: data.task_id, action: data.action, status: data.status };
  },
  // MiniMax's replies without its trace ids. A music url (output_format
  // url) is MiniMax's own link; the default hex keeps the audio in the reply.
  imagePromptEnhanced: function (ctx, task) {
    return withoutTrace(taskView(task).data);
  },
  musicCreated: function (ctx, task) {
    return withoutTrace(taskView(task).data);
  },
});

// ---------------------------------------------------------------------------
// Driver hooks

export function buildSubmitRequest(ctx) {
  const req = ctx.requestBody || {};
  const kind = taskKind(ctx);
  if (kind === "cancel") {
    const origin = originTask(ctx, req.taskId);
    if (!origin || !trimmed(origin.upstreamTaskId)) fail("the task to cancel was not found");
    const request = {
      url: apiRoot(ctx) + "/v2/video_generation/" + encodeURIComponent(trimmed(origin.upstreamTaskId)),
      method: "DELETE",
      headers: { Accept: "application/json", Authorization: bearer(ctx) },
      action: "cancel_task",
    };
    // The other gateway's route reads the model from a JSON body.
    if (viaGateway(ctx)) {
      request.headers["Content-Type"] = "application/json";
      request.body = { model: trimmed(ctx.upstreamModel) || trimmed(ctx.model) || H3_MODEL };
    }
    return request;
  }
  if (kind === "context_ir") {
    const gateway = viaGateway(ctx);
    const body = Object.assign({}, contextIRBody(Object.assign({}, req.vendorBody)), { model: gateway ? trimmed(ctx.upstreamModel) || CONTEXT_IR_MODEL : h3UpstreamModel(ctx, CONTEXT_IR_MODEL) });
    return { url: apiRoot(ctx) + "/v2/h3_context_ir", method: "POST", headers: jsonHeaders(ctx), body: body, action: "h3_context_ir" };
  }
  if (kind === "regeneration") {
    const gateway = viaGateway(ctx);
    const body = Object.assign({}, req.vendorBody, { model: gateway ? trimmed(ctx.upstreamModel) || REGENERATION_MODEL : h3UpstreamModel(ctx, REGENERATION_MODEL) });
    if (req.sourceTaskId) {
      const origin = originTask(ctx, req.sourceTaskId);
      if (!origin || !trimmed(origin.upstreamTaskId)) fail("the source task was not found");
      body.source_task_id = trimmed(origin.upstreamTaskId);
    }
    return { url: apiRoot(ctx) + "/v2/video_regeneration", method: "POST", headers: jsonHeaders(ctx), body: body, action: "video_regeneration" };
  }
  if (kind === "image_prompt") {
    const checked = imagePromptBody(Object.assign({}, req.promptBody));
    const body = Object.assign({}, checked.body, { model: trimmed(ctx.upstreamModel) || IMAGE_PROMPT_MODEL });
    return { url: apiRoot(ctx) + "/v1/h3_image_context_ir", method: "POST", headers: jsonHeaders(ctx), body: body, action: "image_prompt" };
  }
  if (kind === "music") {
    const body = Object.assign({}, musicBody(trimmed(req.model) || trimmed(ctx.upstreamModel), Object.assign({}, req.musicBody)), { model: trimmed(ctx.upstreamModel) || trimmed(ctx.model) });
    return { url: apiRoot(ctx) + "/v1/music_generation", method: "POST", headers: jsonHeaders(ctx), body: body, action: "music_generation" };
  }
  return mediaSubmitRequest(ctx);
}

function immediate(ctx, body, url) {
  const taskId = trimmed(ctx.publicTaskId);
  if (!taskId) fail("missing gateway task id");
  const done = { status: "SUCCESS", progress: "100%" };
  if (url) done.url = url;
  return { taskId: taskId, taskData: body, immediate: done };
}

export function parseSubmitResponse(ctx, resp) {
  const body = resp.body || {};
  const kind = taskKind(ctx);
  if (kind === "cancel") {
    const req = ctx.requestBody || {};
    const result = trimmed(body.action) || trimmed(body.status);
    if (result !== "cancelled" && result !== "deleted") fail(baseRespError(body) || "MiniMax did not cancel or delete the task");
    return immediate(ctx, { task_id: trimmed(req.taskId), action: result, status: trimmed(body.status) || result });
  }
  if (kind === "image_prompt") {
    if (!plainObject(body)) fail("invalid prompt enhancement response");
    if (!trimmed(body.revised_prompt)) fail(baseRespError(body) || trimmed(plainObject(body.error) && body.error.message) || "MiniMax returned no enhanced prompt");
    return immediate(ctx, body, "");
  }
  if (kind === "music") {
    if (!plainObject(body)) fail("invalid music generation response");
    const error = baseRespError(body);
    if (error) fail(error);
    const audio = musicAudio(body);
    if (!audio) fail("MiniMax returned no audio");
    return immediate(ctx, body, /^https?:\/\//i.test(audio) ? audio : "");
  }
  return mediaSubmitResponse(ctx, resp);
}

export function extractUsage(ctx) {
  const req = ctx.requestBody || {};
  const kind = taskKind(ctx);
  if (kind === "cancel") {
    if (ctx.usagePurpose === "billing_ratios") return { seconds: 0 };
    return zeroFacts(trimmed(ctx.upstreamModel) || trimmed(ctx.model) || trimmed(req.model));
  }
  if (kind === "context_ir") {
    if (ctx.usagePurpose === "billing_ratios") return null;
    return contextIRFacts(req.vendorBody || {});
  }
  if (kind === "regeneration") {
    if (ctx.usagePurpose === "billing_ratios") return null;
    return regenerationFacts(ctx);
  }
  if (kind === "image_prompt") {
    if (ctx.usagePurpose === "billing_ratios") return null;
    return imagePromptBody(Object.assign({}, req.promptBody)).facts;
  }
  if (kind === "music") {
    if (ctx.usagePurpose === "billing_ratios") return null;
    return { music_tracks: 1 };
  }
  return mediaUsage(ctx);
}

// Only legacy per-call pricing calls this hook.
export function extractUsageOnSubmit(ctx, body) {
  const kind = taskKind(ctx);
  if (kind !== "media") return null;
  return mediaUsageOnSubmit(ctx, body);
}

export function extractUsageOnComplete(task, taskResult, body) {
  const kind = taskKind(task);
  if (kind === "cancel") return null;
  if (kind === "image_prompt") return imagePromptUsage(body);
  if (kind === "music") return musicAudio(body) ? { music_tracks: 1 } : null;
  const h3Task = h3QueryTask(body);
  const type = trimmed(h3Task && h3Task.task_type);
  if (kind === "context_ir" || type === "h3_context_ir") return h3Task ? contextIRUsage(h3Task) : null;
  if (kind === "regeneration" || type === "regeneration") return h3Task ? regenerationUsage(h3Task) : null;
  return mediaUsageOnComplete(task, taskResult, body);
}

// A /v2 video artifact: a fresh link from MiniMax (its links expire), the
// stored one when the query fails, or the other gateway's artifact endpoint.
export function buildContentRequest(ctx) {
  const method = (ctx.clientRequest && ctx.clientRequest.method) || "GET";
  if (ctx.artifactKey !== "video") fail("artifact_not_found");
  if (viaGateway(ctx)) {
    if (!trimmed(ctx.upstreamTaskId)) fail("artifact_not_found");
    return {
      url: String(ctx.baseUrl || "").replace(/\/+$/, "") + "/v1/tasks/" + encodeURIComponent(trimmed(ctx.upstreamTaskId)) + "/artifacts/video/content",
      method: method,
      headers: { Authorization: bearer(ctx) },
    };
  }
  let url = "";
  if (trimmed(ctx.upstreamTaskId) && typeof utils !== "undefined" && utils && typeof utils.fetch === "function") {
    try {
      const fresh = utils.fetch({
        url: String(ctx.baseUrl || "").replace(/\/+$/, "") + "/v2/query/video_generation/" + encodeURIComponent(trimmed(ctx.upstreamTaskId)),
        method: "GET",
        headers: { Accept: "application/json", Authorization: "Bearer " + ctx.apiKey },
        responseType: "json",
      });
      if (fresh && fresh.status >= 200 && fresh.status < 300) {
        const body = typeof fresh.body === "string" ? JSON.parse(fresh.body) : fresh.body;
        const task = h3QueryTask(body);
        if (task && task.status === "succeeded") url = trimmed(task.content && task.content.url);
      }
    } catch (e) {
      url = "";
    }
  }
  if (!url) url = h3ArtifactURL(ctx);
  if (!url) fail("artifact_not_found");
  return { url: url, method: method, credentialless: true };
}

// ---------------------------------------------------------------------------
// Provider part: model list, speech and transcription. The text routes use
// the host's passthrough and never reach these hooks.

const SPEECH_PATH = "/v1/audio/speech";
const TRANSCRIPTION_PATH = "/v1/audio/transcriptions";
const MODELS_PATH = "/v1/models";
const DEFAULT_VOICE = "English_Graceful_Lady";
const OPENAI_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse", "marin", "cedar"];
const SPEECH_FORMATS = { mp3: "audio/mpeg", wav: "audio/wav", pcm: "audio/pcm", flac: "audio/flac", opus: "audio/ogg" };
const SPEECH_FIELDS = ["model", "input", "voice", "response_format", "speed", "instructions", "stream_format", "metadata"];
const SPEECH_MAX_CHARS = 10000;
// MiniMax options a speech request may carry in metadata, by where they go.
const SPEECH_VOICE_OPTIONS = ["vol", "pitch", "emotion", "text_normalization", "latex_read"];
const SPEECH_AUDIO_OPTIONS = ["sample_rate", "bitrate", "channel", "force_cbr"];
const SPEECH_TOP_OPTIONS = ["language_boost", "pronunciation_dict", "voice_modify", "timbre_weights", "text_normalization_mode"];
const TRANSCRIPTION_FIELDS = ["model", "language", "response_format", "temperature", "prompt", "timestamp_granularities", "timestamp_granularities[]"];
const TRANSCRIPTION_FORMATS = ["json", "verbose_json"];

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function hexValue(text, index) {
  const pair = parseInt(text.substr(index * 2, 2), 16);
  if (!(pair >= 0 && pair <= 255)) throw new Error("invalid hex audio");
  return pair;
}

// MiniMax sends audio as hex; the host's binary outputs take base64.
export function hexToBase64(hex) {
  const text = typeof hex === "string" ? hex.trim() : "";
  if (text.length % 2 || /[^0-9a-fA-F]/.test(text)) throw new Error("invalid hex audio");
  const bytes = text.length / 2;
  const parts = [];
  for (let i = 0; i < bytes; i += 3) {
    const b0 = hexValue(text, i);
    const b1 = i + 1 < bytes ? hexValue(text, i + 1) : 0;
    const b2 = i + 2 < bytes ? hexValue(text, i + 2) : 0;
    parts.push(
      B64.charAt(b0 >> 2) +
        B64.charAt(((b0 & 3) << 4) | (b1 >> 4)) +
        (i + 1 < bytes ? B64.charAt(((b1 & 15) << 2) | (b2 >> 6)) : "=") +
        (i + 2 < bytes ? B64.charAt(b2 & 63) : "="),
    );
  }
  return parts.join("");
}

function convertError(status, message, code) {
  const error = { status: status, message: message, type: "upstream_error" };
  if (code) error.code = String(code);
  return { error: error };
}

function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

// HTTP statuses for MiniMax's business codes on HTTP 200 replies.
const CODE_STATUS = { 1002: 429, 1004: 401, 1008: 402, 1026: 422, 1027: 422, 1039: 429, 1041: 429, 2013: 400, 2014: 400, 2022: 404, 2049: 401, 2053: 402, 2056: 429, 2061: 403, 2062: 429, 2067: 402, 2068: 403, 2069: 404 };

function upstreamError(parsed, status) {
  const body = plainObject(parsed) || {};
  const error = plainObject(body.error);
  const base = plainObject(body.base_resp);
  const message = (error && trimmed(error.message)) || (base && trimmed(base.status_msg) ? trimmed(base.status_msg) + " (" + base.status_code + ")" : "") || "MiniMax request failed";
  const code = base && present(base.status_code) ? Number(base.status_code) : 0;
  let http = status >= 400 && status <= 599 ? status : CODE_STATUS[code] || (code ? 400 : 502);
  if (error && Number(error.http_code) >= 400 && Number(error.http_code) <= 599) http = Number(error.http_code);
  return convertError(http, "MiniMax: " + message, code || (error && error.type) || undefined);
}

export function buildSpeechRequest(body, model, config) {
  if (!plainObject(body)) fail("A JSON body is required.");
  onlyFields(body, SPEECH_FIELDS);
  if (typeof body.input !== "string" || !body.input.trim()) fail("input is required");
  if (codePoints(body.input) >= SPEECH_MAX_CHARS) fail("input must be shorter than " + SPEECH_MAX_CHARS + " characters");
  if (present(body.voice) && typeof body.voice !== "string") fail("voice must be a string");
  let voice = trimmed(body.voice);
  if (!voice || OPENAI_VOICES.includes(voice.toLowerCase())) voice = trimmed(config && config.defaultVoice) || DEFAULT_VOICE;
  const format = !present(body.response_format) || body.response_format === "" ? "mp3" : String(body.response_format).toLowerCase();
  if (!own(SPEECH_FORMATS, format)) fail("response_format must be one of " + Object.keys(SPEECH_FORMATS).join(", "));
  if (present(body.instructions) && body.instructions !== "") fail("instructions are not supported; set metadata.emotion or another MiniMax voice option");
  if (present(body.stream_format) && body.stream_format !== "audio" && body.stream_format !== "sse") fail("stream_format must be audio or sse");
  const metadata = present(body.metadata) ? plainObject(body.metadata) : {};
  if (!metadata) fail("metadata must be an object");
  const known = SPEECH_VOICE_OPTIONS.concat(SPEECH_AUDIO_OPTIONS, SPEECH_TOP_OPTIONS);
  for (const key of Object.keys(metadata)) if (!known.includes(key)) fail("metadata." + key + " is not supported");
  const voiceSetting = { voice_id: voice };
  if (present(body.speed)) {
    if (typeof body.speed !== "number" || body.speed < 0.5 || body.speed > 2) fail("speed must be between 0.5 and 2.0");
    voiceSetting.speed = body.speed;
  }
  for (const key of SPEECH_VOICE_OPTIONS) if (present(metadata[key])) voiceSetting[key] = metadata[key];
  const audioSetting = { format: format };
  for (const key of SPEECH_AUDIO_OPTIONS) if (present(metadata[key])) audioSetting[key] = metadata[key];
  const out = {
    model: model,
    text: body.input,
    stream: true,
    stream_options: { exclude_aggregated_audio: true },
    voice_setting: voiceSetting,
    audio_setting: audioSetting,
  };
  for (const key of SPEECH_TOP_OPTIONS) if (present(metadata[key])) out[key] = metadata[key];
  return { body: out, format: format };
}

function formValue(fields, name) {
  const raw = fields[name];
  if (raw === undefined) return undefined;
  const list = Array.isArray(raw) ? raw : [raw];
  if (list.length > 1 && name.indexOf("timestamp_granularities") !== 0) fail(name + " must be provided once");
  return list;
}

export function buildTranscriptionRequest(form, model) {
  if (!form || !plainObject(form.fields) || !Array.isArray(form.files)) fail("A multipart form with a file is required.");
  const fields = form.fields;
  onlyFields(fields, TRANSCRIPTION_FIELDS);
  const first = function (name) {
    const list = formValue(fields, name);
    return list ? list[0] : undefined;
  };
  if (trimmed(first("prompt"))) fail("prompt is not supported");
  const format = trimmed(first("response_format")) || "json";
  if (!TRANSCRIPTION_FORMATS.includes(format)) fail("response_format must be json or verbose_json");
  const files = form.files.filter(function (file) {
    return file.field === "file";
  });
  if (files.length !== 1 || form.files.length !== 1) fail("exactly one audio file is required in the file field");
  const granularities = (formValue(fields, "timestamp_granularities[]") || []).concat(formValue(fields, "timestamp_granularities") || []);
  const upstream = { model: model, response_format: format };
  if (granularities.indexOf("word") >= 0) {
    if (format !== "verbose_json") fail("word timestamps need response_format verbose_json");
    upstream.timestamp_level = "word";
  }
  const headers = {};
  const language = trimmed(first("language"));
  if (language) headers.language = language;
  return { form: { fields: upstream, files: [{ field: "file", from: "file" }] }, headers: headers, responseFormat: format };
}

// MiniMax bills transcription by the audio's duration; the seconds, rounded
// up, travel as the request's tokens.
export function transcriptionReply(parsed, state) {
  const text = typeof parsed.text === "string" ? parsed.text : "";
  const raw = Number(parsed.duration);
  const seconds = Number.isFinite(raw) && raw > 0 ? Math.ceil(raw) : 0;
  const usage = { type: "tokens", input_tokens: seconds, output_tokens: 0, total_tokens: seconds, prompt_tokens: seconds, completion_tokens: 0, seconds: seconds };
  if (state && state.responseFormat === "verbose_json") {
    const reply = { task: "transcribe", language: trimmed(state.language), duration: Number.isFinite(raw) ? raw : 0, text: text, usage: usage };
    if (Array.isArray(parsed.segments)) reply.segments = parsed.segments;
    if (present(parsed.n_speakers)) reply.n_speakers = parsed.n_speakers;
    return reply;
  }
  return { text: text, usage: usage };
}

// MiniMax's model list has its text models only; the plugin's media models
// are added, since the same key calls them.
export function modelListReply(response) {
  const parsed = typeof response.body === "string" ? parseJSON(response.body) : null;
  if (!plainObject(parsed) || !Array.isArray(parsed.data)) return convertError(502, "MiniMax returned an unreadable model list");
  const ids = [];
  for (const item of parsed.data) {
    const id = plainObject(item) && typeof item.id === "string" ? item.id.trim() : "";
    if (id && ids.indexOf(id) < 0) ids.push(id);
  }
  for (const id of MEDIA_MODELS) if (ids.indexOf(id) < 0) ids.push(id);
  return {
    body: {
      object: "list",
      data: ids.map(function (id) {
        return { id: id, object: "model", owned_by: "minimax" };
      }),
    },
    contentType: "application/json",
  };
}

export function convertRequest(ctx, request) {
  const model = trimmed(request && request.model) || trimmed(request && request.body && request.body.model);
  if (!model) fail("model is required");
  if (ctx.path === SPEECH_PATH) {
    const built = buildSpeechRequest(request.body, model, ctx.config);
    const clientStream = request.stream === true || (plainObject(request.body) && request.body.stream_format === "sse");
    return {
      method: "POST",
      body: built.body,
      stream: true,
      state: { kind: "speech", format: built.format, clientStream: clientStream, chunks: 0, characters: 0 },
    };
  }
  if (ctx.path === TRANSCRIPTION_PATH) {
    const built = buildTranscriptionRequest(request.form, model);
    return {
      method: "POST",
      form: built.form,
      headers: built.headers,
      stream: false,
      state: { kind: "transcription", responseFormat: built.responseFormat, language: trimmed(built.headers.language) },
    };
  }
  fail("This plugin does not convert " + ctx.path);
}

function speechChunk(state, data) {
  const audio = plainObject(data.data) ? trimmed(data.data.audio) : "";
  const final = plainObject(data.data) && Number(data.data.status) === 2;
  const extra = plainObject(data.extra_info) || {};
  if (Number.isInteger(extra.usage_characters) && extra.usage_characters > state.characters) state.characters = extra.usage_characters;
  // The last event repeats the whole audio unless MiniMax honoured
  // exclude_aggregated_audio; keep it only when nothing came before.
  if (!audio || (final && state.chunks > 0)) return { final: final, base64: "" };
  return { final: final, base64: hexToBase64(audio) };
}

function speechResult(state, chunk) {
  const result = { state: state };
  if (chunk.base64) {
    state.chunks += 1;
    if (state.clientStream) result.events = [{ data: { type: "speech.audio.delta", audio: chunk.base64 } }];
    else {
      result.chunks = [{ bodyBase64: chunk.base64 }];
      result.contentType = SPEECH_FORMATS[state.format] || "application/octet-stream";
    }
  }
  if (state.clientStream && chunk.final) {
    const events = result.events || [];
    events.push({ data: { type: "speech.audio.done", usage: { input_tokens: state.characters, output_tokens: 0, total_tokens: state.characters } } });
    result.events = events;
  }
  return result;
}

export function convertResponse(ctx, response) {
  const state = ctx.state || {};
  const status = response.status;
  const text = response.body !== undefined ? response.body : "";
  const parsed = typeof text === "string" ? parseJSON(text) : null;
  if (ctx.path === MODELS_PATH) {
    if (status < 200 || status >= 300) return upstreamError(parsed, status);
    return modelListReply(response);
  }
  if (status < 200 || status >= 300) return upstreamError(parsed, status);
  if (baseRespError(parsed)) return upstreamError(parsed, 0);
  if (state.kind === "transcription") {
    if (!plainObject(parsed)) return convertError(502, "MiniMax returned an unreadable transcription reply");
    return { body: transcriptionReply(parsed, state) };
  }
  if (state.kind === "speech") {
    // A whole JSON reply instead of the requested stream: its hex audio.
    if (!plainObject(parsed)) return convertError(502, "MiniMax answered speech without audio");
    if (state.clientStream) return convertError(502, "MiniMax answered a streamed speech request without a stream");
    const audio = plainObject(parsed.data) ? trimmed(parsed.data.audio) : "";
    if (!audio || /^https?:/i.test(audio)) return convertError(502, "MiniMax answered speech without audio");
    return { bodyBase64: hexToBase64(audio), contentType: SPEECH_FORMATS[state.format] || "application/octet-stream" };
  }
  return convertError(502, "unexpected MiniMax reply");
}

export function convertStreamEvent(ctx, input) {
  const state = Object.assign({ chunks: 0, characters: 0 }, ctx.state || {});
  if (input && input.done) {
    if (!state.chunks) return convertError(502, "MiniMax returned no audio");
    return { state: state };
  }
  const data = input && typeof input.data === "string" ? parseJSON(input.data) : null;
  if (!plainObject(data)) return convertError(502, "MiniMax sent an unreadable speech event");
  if (baseRespError(data) || plainObject(data.error)) return upstreamError(data, 0);
  return speechResult(state, speechChunk(state, data));
}
