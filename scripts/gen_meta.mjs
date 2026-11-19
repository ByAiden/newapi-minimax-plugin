// Writes the manifest into plugin.js as a plain JSON literal (the marketplace
// and the gateway's install page read it without running the plugin).
// Usage: node scripts/gen_meta.mjs [repo]
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repo = resolve(process.argv[2] || ".");
const file = repo + "/plugin.js";
const p = await import(pathToFileURL(file).href + "?t=" + Date.now());
const source = readFileSync(file, "utf8");
const START = "export const meta = ";
const END = "\n};\n";
const begin = source.indexOf(START);
const end = source.indexOf(END, begin);
if (begin < 0 || end < 0) throw new Error("manifest block not found");
// The author is kept from the current manifest (the publisher's GitHub login).
const current = JSON.parse(source.slice(begin + START.length, end) + "\n}");
if (!current.author || !current.author.name) throw new Error("the current manifest has no author");
const author = current.author;

function profile(models, schema, examples) {
  return { models: models, schema: schema, examples: examples };
}

const usageSchema = Object.assign(
  {},
  p.H3_USAGE_SCHEMA,
  { resolution: { enum: ["480P", "768P", "2K"], description: p.H3_USAGE_SCHEMA.resolution.description } },
  p.IMAGE_USAGE_SCHEMA,
  p.CONTEXT_IR_USAGE_SCHEMA,
  p.MUSIC_USAGE_SCHEMA,
);
const zero = Object.fromEntries(Object.keys(usageSchema).map((key) => [key, key === "resolution" ? "768P" : 0]));
const TASK_VIDEO = p.VIDEO_MODELS;

const manifest = {
  apiVersion: 1,
  key: p.PLUGIN_KEY,
  name: "MiniMax",
  icon: "Minimax.Color",
  description: {
    en: "MiniMax text, speech, transcription, H3 video, H3-Image and music on one channel",
    zh: "一个渠道接入 MiniMax 文本、语音合成、语音识别、H3 视频、H3-Image 图片与音乐",
  },
  version: "2.0.0",
  author: author,
  website: "https://platform.minimax.io/docs/api-reference/api-overview",
  baseUrl: "https://api.minimaxi.com",
  models: p.MODEL_IDS,
  fetchMode: "per_task",
  upstreams: ["vendor", "new_api"],
  usageSchema: usageSchema,
  usageExamples: [
    { label: "H3 768P 5s", facts: Object.assign({}, zero, p.H3_EXAMPLES[0].facts) },
    { label: "text to image 4K", facts: Object.assign({}, zero, p.IMAGE_EXAMPLES[1].facts) },
    { label: "Context-IR", facts: Object.assign({}, zero, p.CONTEXT_IR_EXAMPLES[0].facts) },
    { label: "one song", facts: Object.assign({}, zero, p.MUSIC_EXAMPLES[0].facts) },
  ],
  usageProfiles: [
    profile(["MiniMax-H3"], p.H3_USAGE_SCHEMA, p.H3_EXAMPLES),
    profile(p.FAST_VIDEO_MODELS, p.H3_FAST_USAGE_SCHEMA, p.H3_FAST_EXAMPLES),
    profile([p.CONTEXT_IR_MODEL], p.CONTEXT_IR_USAGE_SCHEMA, p.CONTEXT_IR_EXAMPLES),
    profile([p.REGENERATION_MODEL], p.REGENERATION_USAGE_SCHEMA, p.REGENERATION_EXAMPLES),
    profile(p.IMAGE_MODELS, p.IMAGE_USAGE_SCHEMA, p.IMAGE_EXAMPLES),
    profile(p.MUSIC_MODELS, p.MUSIC_USAGE_SCHEMA, p.MUSIC_EXAMPLES),
  ],
  routes: [
    { method: "POST", path: "/v2/video_generation", type: "submit", decode: "createH3Task", render: "taskCreated", models: TASK_VIDEO },
    { method: "GET", path: "/v2/query/video_generation/:task_id", type: "query", render: "h3TaskStatus" },
    { method: "DELETE", path: "/v2/video_generation/:task_id", type: "submit", decode: "cancelTask", render: "taskCancelled", retainResult: false },
    { method: "POST", path: "/v2/h3_context_ir", type: "submit", decode: "createContextIR", render: "taskCreated" },
    { method: "POST", path: "/v2/video_regeneration", type: "submit", decode: "createRegeneration", render: "taskCreated" },
    { method: "POST", path: "/v1/images/generations", type: "submit", decode: "createImage", render: "imageCreated", models: p.IMAGE_MODELS, retainResult: false },
    { method: "POST", path: "/v1/images/edits", type: "submit", decode: "editImage", render: "imageCreated", models: p.IMAGE_MODELS, retainResult: false },
    { method: "POST", path: "/v1/h3_image_context_ir", type: "submit", decode: "enhanceImagePrompt", render: "imagePromptEnhanced", models: ["MiniMax-H3-Image"], retainResult: false },
    { method: "POST", path: "/v1/music_generation", type: "submit", decode: "createMusic", render: "musicCreated", models: p.MUSIC_MODELS, retainResult: false },
  ],
  protocols: [
    { name: "openai_responses", supports: ["stream", "sync", "background"], models: TASK_VIDEO },
    { name: "openai_video", models: TASK_VIDEO },
    { name: "openai_image", models: p.IMAGE_MODELS },
  ],
  relay: [
    { incoming_path: "/v1/chat/completions", upstream_path: "/v1/chat/completions" },
    { incoming_path: "/v1/responses", upstream_path: "/v1/responses" },
    { incoming_path: "/v1/messages", upstream_path: "/anthropic/v1/messages" },
    { incoming_path: "/v1/audio/speech", upstream_path: "/v1/t2a_v2", converter: "plugin" },
    { incoming_path: "/v1/audio/transcriptions", upstream_path: "/v1/speech_to_text", converter: "plugin" },
    { incoming_path: "/v1/models", upstream_path: "/v1/models", converter: "plugin" },
  ],
  channelConfig: {
    type: "object",
    properties: {
      defaultVoice: {
        type: "string",
        title: { en: "Default voice", zh: "默认音色" },
        description: {
          en: "MiniMax voice ID used when a speech request names an OpenAI voice such as alloy, or none",
          zh: "语音合成请求使用 alloy 等 OpenAI 音色名或未指定音色时使用的 MiniMax 音色 ID",
        },
        default: "English_Graceful_Lady",
        minLength: 1,
        maxLength: 128,
      },
    },
  },
  keyHint: {
    en: "MiniMax API key of the site the Base URL points to",
    zh: "MiniMax API Key，与 Base URL 所在站点对应",
  },
};

// One property per line, two-space indent, like the published manifests.
const literal = JSON.stringify(manifest, null, 2);
const updated = source.slice(0, begin) + START + literal.slice(0, -1).replace(/\n$/, "") + END + source.slice(end + END.length);
writeFileSync(file, updated);
console.log("meta written:", manifest.models.length, "models,", manifest.routes.length, "routes,", manifest.relay.length, "relay routes");
